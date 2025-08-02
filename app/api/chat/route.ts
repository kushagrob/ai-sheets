import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { createSpreadsheetTools } from "../_lib/tools"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    let { messages, workbook, activeSheetId, selection } = body

        // Ensure messages is an array
    if (!Array.isArray(messages)) {
      console.error("Messages is not an array:", messages)
      return new Response("Invalid messages format", { status: 400 })
    }

    // Messages are already in proper UIMessage format from frontend - no conversion needed!
    

    
    if (!workbook || !workbook.sheets) {
      console.warn("No workbook provided – creating a new empty workbook on the fly")
      workbook = {
        id: `wb-${Date.now()}`,
        name: "untitled.xlsx",
        sheets: [
          {
            id: `sh-${Date.now()}`,
            name: "Sheet1",
            data: Array(50)
              .fill(null)
              .map(() => Array(52).fill("")),
          },
        ],
      }
    }

    if (!activeSheetId) {
      activeSheetId = workbook.sheets[0].id
    }

    // Find the active sheet
    const activeSheet = workbook.sheets.find((sheet: any) => sheet.id === activeSheetId)
    if (!activeSheet) {
      console.error("Active sheet not found:", activeSheetId, "Available sheets:", workbook.sheets.map((s: any) => s.id))
      return new Response("Active sheet not found", { status: 400 })
    }

    // Construct system prompt
    const systemPrompt = `You are an AI assistant for a spreadsheet application. You help users manipulate, analyze, and work with their spreadsheet data.

Current Context:
- Workbook: "${workbook.name}"
- Active Sheet: "${activeSheet.name}" (ID: ${activeSheetId})
- Selected Range: ${selection || "None"}
- Sheet Data: ${JSON.stringify(activeSheet.data.slice(0, 20))}${activeSheet.data.length > 20 ? "... (truncated)" : ""}

You have access to the following tools that you MUST use to make changes to the spreadsheet:
1. setData - Set raw values in cells (use this to populate data, headers, labels, etc.)
2. applyFormula - Apply Excel-style formulas to cells (use this for calculations)
3. askForClarification - Ask user for more information

IMPORTANT: When the user asks you to create content, analyze data, or build models:
1. ALWAYS use the setData tool to add headers, labels, and data to the spreadsheet
2. ALWAYS use the applyFormula tool for any calculations
3. Don't just describe what you would do - actually do it by calling the tools
4. PROVIDE CONVERSATIONAL UPDATES - explain what you're doing BEFORE each tool call
5. COMPLETE THE ENTIRE TASK - don't stop after just creating headers

CRITICAL: Use this conversational pattern:
- Explain what you're about to do in natural language
- Make the tool call
- Briefly confirm what was accomplished
- Explain the next step
- Continue until complete

Example flow:
"Let me start by creating the main headers for our budget tracker..."
[setData tool call]
"Great! Now I'll add the income categories..."
[setData tool call]
"Perfect! Next, I'll add the expense categories..."
[setData tool calls]

WORKFLOW for complex requests:
1. Create structure and headers with setData
2. Add actual data points and values with setData  
3. Add formulas and calculations with applyFormula
4. Continue until the full analysis/model is complete
5. Provide summary and insights

For the current request, start by explaining what you'll build, then use setData to create appropriate headers and structure, then add data and formulas as needed. CONTINUE working until the complete analysis is finished.`

    // Filter out messages with empty content before conversion
    const filteredMessages = messages.filter(msg => {
      if (msg.role === 'assistant') {
        // For assistant messages, check if they have actual content
        return msg.parts && msg.parts.length > 0 && msg.parts.some((part: any) => 
          part.type === 'text' && part.text && part.text.trim().length > 0
        )
      }
      // Always include user messages (they should never be empty)
      return true
    })

    console.log("🔍 Filtered messages count:", filteredMessages.length, "from original:", messages.length)

    // Convert UIMessages to ModelMessages for the AI model
    const modelMessages = convertToModelMessages(filteredMessages)

    // Create the streaming response with multi-step capability
    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: modelMessages,
      tools: createSpreadsheetTools(workbook),
      stopWhen: stepCountIs(20), // Allow up to 10 tool calls for complex tasks
      onStepFinish: ({ toolResults }) => {
        if (toolResults.length > 0) {
          // Save updated workbook to a temporary global store that the client can access
          // This is a workaround since we can't easily pass the workbook back through the stream
          if (typeof global !== 'undefined') {
            (global as any).lastUpdatedWorkbook = workbook
          }
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}

