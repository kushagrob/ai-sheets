"use client"

import { useState } from "react"
import type { UIMessage } from "ai"

// Helper function to generate user-friendly tool messages
function getToolMessage(toolName: string, input: any): string {
  // Handle both AI SDK 5.0 (input) and older versions (args)
  const params = input || {}
  
  switch (toolName) {
    case 'setData':
      if (params?.range && params?.data) {
        const rowCount = Array.isArray(params.data) ? params.data.length : 1
        const colCount = Array.isArray(params.data?.[0]) ? params.data[0].length : 1
        return `Setting data in range ${params.range} (${rowCount}×${colCount} cells)`
      }
      return 'Adding data to spreadsheet...'
    
    case 'applyFormula':
      if (params?.cell && params?.formula) {
        return `Applying formula ${params.formula} to cell ${params.cell}`
      }
      return 'Adding formula to spreadsheet...'
    
    case 'askForClarification':
      if (params?.question) {
        return `Asking: ${params.question}`
      }
      return 'Asking for clarification...'
    
    default:
      return `Using ${toolName} tool...`
  }
}

export function useChatMessages(_workbookId: string, activeSheetId: string) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const sendMessage = async (message: string) => {
    try {
      console.log('sendMessage called with:', message)
      setIsLoading(true)
      setError(null)

      // Add user message in proper UIMessage format
      const userMessage: UIMessage = { 
        id: `msg-${Date.now()}-user`,
        role: "user", 
        parts: [{ type: "text", text: message }]
      }
      setMessages(prev => [...prev, userMessage])

      // Get fresh workbook data
      const workbook = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("workbook") || "null") : null
      
      // Send messages directly as UIMessages - no conversion needed!
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          workbook,
          activeSheetId,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      let currentTextBlockContent = ""
      let currentMessageId: string | null = null
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5))
              
              // Handle AI SDK 5.0 streaming protocol
              if (data.type === 'text-delta' && data.delta) {
                currentTextBlockContent += data.delta
                
                // Create new message if we don't have one for this text block
                if (!currentMessageId) {
                  currentMessageId = `msg-${Date.now()}-ai-${Math.random()}`
                  const newMessage: UIMessage = {
                    id: currentMessageId,
                    role: "assistant",
                    parts: [{ type: "text", text: currentTextBlockContent }]
                  }
                  setMessages(prev => [...prev, newMessage])
                } else {
                  // Update existing message for this text block
                  setMessages(prev => {
                    const newMessages = [...prev]
                    const messageIndex = newMessages.findIndex(m => m.id === currentMessageId)
                    if (messageIndex !== -1) {
                      newMessages[messageIndex].parts = [{ type: "text", text: currentTextBlockContent }]
                    }
                    return newMessages
                  })
                }
              }
              
              // Handle step completion - this creates completely separate messages
              else if (data.type === 'finish-step') {
                console.log('Step completed, creating new message and updating workbook...')
                
                // Finalize current message and prepare for next one
                if (currentTextBlockContent.trim()) {
                  currentMessageId = null // Reset for next message
                  currentTextBlockContent = ""
                }
                
                // Update workbook in real-time
                try {
                  const workbookResponse = await fetch('/api/workbook')
                  if (workbookResponse.ok) {
                    const updatedWorkbook = await workbookResponse.json()
                    localStorage.setItem("workbook", JSON.stringify(updatedWorkbook))
                    window.dispatchEvent(new Event('workbook-updated'))
                    console.log('Workbook updated in real-time after step')
                  }
                } catch (workbookError) {
                  console.error('Failed to fetch workbook during streaming:', workbookError)
                }
              }
              
              // Handle tool input available (complete tool call with arguments)
              else if (data.type === 'tool-input-available') {
                console.log('✅ Tool call available:', data.toolName, data.input)
                
                // Create a brief tool indicator message
                const toolMessage = getToolMessage(data.toolName, data.input)
                const toolIndicatorMessage: UIMessage = {
                  id: `tool-${Date.now()}-${Math.random()}`,
                  role: "assistant", 
                  parts: [{ type: "text", text: `🔧 ${toolMessage}` }]
                }
                setMessages(prev => [...prev, toolIndicatorMessage])
              }
              

              
              // Handle tool output available (tool execution completed)
              else if (data.type === 'tool-output-available') {
                console.log('✅ Tool completed:', data.toolCallId, data.output?.message)
                try {
                  const workbookResponse = await fetch('/api/workbook')
                  if (workbookResponse.ok) {
                    const updatedWorkbook = await workbookResponse.json()
                    localStorage.setItem("workbook", JSON.stringify(updatedWorkbook))
                    window.dispatchEvent(new Event('workbook-updated'))
                    console.log('Workbook updated after tool completion')
                  }
                } catch (workbookError) {
                  console.error('Failed to fetch workbook during streaming:', workbookError)
                }
              }
            } catch (e) {
              // Ignore JSON parsing errors
            }
          }
        }
      }

      // Final cleanup - finalize any remaining text block
      if (currentTextBlockContent.trim() && currentMessageId) {
        // The final message is already created, just ensure it's properly finalized
        console.log('Final message completed')
      }

      // Fetch updated workbook after completion
      try {
        const workbookResponse = await fetch('/api/workbook')
        if (workbookResponse.ok) {
          const updatedWorkbook = await workbookResponse.json()
          localStorage.setItem("workbook", JSON.stringify(updatedWorkbook))
          window.dispatchEvent(new Event('workbook-updated'))
        }
      } catch (workbookError) {
        console.error('Failed to fetch updated workbook:', workbookError)
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
      console.error("Send message error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const newChat = () => {
    setMessages([])
    setError(null)
  }

  return {
    messages,
    sendMessage,
    newChat,
    isLoading,
    error,
  }
}
