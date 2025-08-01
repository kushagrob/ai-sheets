import { streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { spreadsheetTools } from "./_lib/tools/spreadsheet-tools"
import { webScraperTool } from "./_lib/tools/web-scraper-tool"
import { executeSpreadsheetTool } from "./_lib/agent"

const chatRequestSchema = z.object({
  workbook: z.object({
    id: z.string(),
    name: z.string(),
    sheets: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        data: z.array(z.array(z.any())),
      }),
    ),
  }),
  activeSheetId: z.string(),
  message: z.string(),
  selection: z.string().optional(),
  chatHistory: z
    .array(
      z.object({
        type: z.enum(["user", "ai", "status"]),
        content: z.string(),
      }),
    )
    .default([]),
})

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const body = await req.json()
    const { workbook, activeSheetId, message, selection, chatHistory } = chatRequestSchema.parse(body)

    // Find the active sheet
    const activeSheet = workbook.sheets.find((sheet) => sheet.id === activeSheetId)
    if (!activeSheet) {
      return new Response("Active sheet not found", { status: 400 })
    }

    // Construct system prompt
    const systemPrompt = `You are an AI assistant for a spreadsheet application. You help users manipulate, analyze, and work with their spreadsheet data.

Current Context:
- Workbook: "${workbook.name}"
- Active Sheet: "${activeSheet.name}" (ID: ${activeSheetId})
- Selected Range: ${selection || "None"}
- Sheet Data: ${JSON.stringify(activeSheet.data.slice(0, 20))}${activeSheet.data.length > 20 ? "... (truncated)" : ""}

You have access to the following tools:
1. setData - Set raw values in cells
2. applyFormula - Apply Excel-style formulas
3. scrapeWebpage - Extract data from websites
4. askForClarification - Ask user for more information

Always be helpful, accurate, and explain what you're doing. When making changes, describe them clearly.`

    // Convert chat history to AI SDK format
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...chatHistory.map((msg) => ({
        role: msg.type === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ]

    // Create the streaming response
    const result = await streamText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      messages,
      tools: {
        setData: {
          description: spreadsheetTools.setData.description,
          parameters: spreadsheetTools.setData.parameters,
          execute: async (params) => {
            return executeSpreadsheetTool("setData", params, workbook)
          },
        },
        applyFormula: {
          description: spreadsheetTools.applyFormula.description,
          parameters: spreadsheetTools.applyFormula.parameters,
          execute: async (params) => {
            return executeSpreadsheetTool("applyFormula", params, workbook)
          },
        },
        scrapeWebpage: {
          description: webScraperTool.description,
          parameters: webScraperTool.parameters,
          execute: async (params) => {
            const { scrapeWebpage } = await import("./_lib/tools/web-scraper-tool")
            return await scrapeWebpage(params.url)
          },
        },
        askForClarification: {
          description: "Ask the user a clarifying question if the request is ambiguous.",
          parameters: z.object({
            question: z.string().describe("The question to ask the user."),
          }),
          execute: async (params) => {
            return { question: params.question, requiresResponse: true }
          },
        },
      },
      maxToolRoundtrips: 5,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}

export const config = {
  runtime: "edge",
}
