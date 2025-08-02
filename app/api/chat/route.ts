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

CRITICAL COMPLETION RULES:
- After completing a user's request, ALWAYS provide a brief summary of what was accomplished
- Do NOT continue making changes unless the user asks for something specific
- When you've fulfilled the request, use the taskComplete tool to signal completion
- If you're unsure if you're done, ask the user if they need anything else

Current Context:
- Workbook: "${workbook.name}"
- Active Sheet: "${activeSheet.name}" (ID: ${activeSheetId})
- Selected Range: ${selection || "None"}
- Sheet Data: ${JSON.stringify(activeSheet.data.slice(0, 20))}${activeSheet.data.length > 20 ? "... (truncated)" : ""}

Tools available:
1. setData - Set raw values in cells (use this to populate data, headers, labels, etc.)
2. applyFormula - Apply Excel-style formulas to cells (use this for calculations)
3. askForClarification - Ask user for more information
4. taskComplete - Signal that the current task is finished

WORKFLOW for requests:
1. Understand the user's specific request
2. Execute the necessary tool calls to fulfill it (setData, applyFormula)
3. Provide conversational updates as you work
4. When the request is fulfilled, use taskComplete tool with a summary
5. STOP and wait for the next instruction

IMPORTANT: When working:
- Explain what you're about to do before each tool call
- Use setData for headers, labels, and data
- Use applyFormula for calculations
- When you've completed what the user asked for, use taskComplete
- Do NOT keep adding "improvements" unless specifically requested`

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
      stopWhen: stepCountIs(50), // Allow up to 50 tool calls for complex tasks
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

