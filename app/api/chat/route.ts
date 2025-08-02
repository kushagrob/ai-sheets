import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { createSpreadsheetTools } from "../_lib/tools"
import { createSystemPrompt } from "../_lib/prompt"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    let { messages, workbook, activeSheetId, selection } = body

        // Ensure messages is an array
    if (!Array.isArray(messages)) {
      console.error("Messages is not an array:", messages)
      return new Response(
        JSON.stringify({ error: "Invalid messages format - expected array" }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
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
      return new Response(
        JSON.stringify({ error: "Active sheet not found in workbook" }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Use the comprehensive system prompt from prompt.ts
    const systemPrompt = createSystemPrompt(workbook, activeSheetId, selection)

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
    
    // Handle different types of errors
    if (error instanceof SyntaxError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (error instanceof Error && error.message.includes('rate limit')) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), 
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (error instanceof Error && error.message.includes('quota')) {
      return new Response(
        JSON.stringify({ error: "API quota exceeded. Please check your subscription." }), 
        { 
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Generic server error
    return new Response(
      JSON.stringify({ 
        error: "Internal server error. Please try again later.",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

