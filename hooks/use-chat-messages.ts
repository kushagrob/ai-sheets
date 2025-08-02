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

export interface ChatError {
  type: 'network' | 'timeout' | 'server' | 'stream' | 'workbook' | 'unknown'
  message: string
  canRetry: boolean
  originalError?: Error
}

export function useChatMessages(_workbookId: string, activeSheetId: string) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ChatError | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected')
  const [lastMessage, setLastMessage] = useState<string>('')

  const createErrorObject = (error: any, type: ChatError['type'] = 'unknown'): ChatError => {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        type: 'network',
        message: 'Request was cancelled',
        canRetry: true,
        originalError: error
      }
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection failed. Please check your internet connection.',
        canRetry: true,
        originalError: error
      }
    }
    
    if (error instanceof Error && error.message.includes('timeout')) {
      return {
        type: 'timeout',
        message: 'Request timed out. The server may be busy.',
        canRetry: true,
        originalError: error
      }
    }
    
    if (error instanceof Error && error.message.includes('HTTP')) {
      const status = error.message.match(/HTTP (\d+)/)?.[1]
      return {
        type: 'server',
        message: status === '500' 
          ? 'Server error. Please try again in a moment.'
          : status === '400'
          ? 'Invalid request. Please try a different message.'
          : `Server error (${status}). Please try again.`,
        canRetry: status !== '400',
        originalError: error
      }
    }
    
    return {
      type,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      canRetry: true,
      originalError: error instanceof Error ? error : undefined
    }
  }

  const sendMessage = async (message: string) => {
    const timeoutMs = 30000 // 30 second timeout
    let timeoutId: NodeJS.Timeout
    
    try {
      console.log('sendMessage called with:', message)
      setIsLoading(true)
      setError(null)
      setConnectionStatus('connected')
      setLastMessage(message)

      // Create new AbortController for this request
      const controller = new AbortController()
      setAbortController(controller)

      // Set up timeout
      timeoutId = setTimeout(() => {
        controller.abort()
        setConnectionStatus('error')
      }, timeoutMs)

      // Add user message in proper UIMessage format
      const userMessage: UIMessage = { 
        id: `msg-${Date.now()}-user`,
        role: "user", 
        parts: [{ type: "text", text: message }]
      }
      setMessages(prev => [...prev, userMessage])

      // Get fresh workbook data
      let workbook = null
      try {
        workbook = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("workbook") || "null") : null
      } catch (e) {
        console.warn('Failed to parse workbook from localStorage:', e)
      }
      
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
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = response.statusText
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // Fallback to text if JSON parsing fails
          try {
            errorMessage = await response.text() || errorMessage
          } catch {
            // Use default status text if everything fails
          }
        }
        throw new Error(`HTTP ${response.status}: ${errorMessage}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body received from server")
      }

      let currentTextBlockContent = ""
      let currentMessageId: string | null = null
      const decoder = new TextDecoder()
      let streamError: Error | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data:')) {
              try {
                const data = JSON.parse(line.slice(5))
                
                // Check for error in stream
                if (data.type === 'error') {
                  streamError = new Error(data.message || 'Stream error occurred')
                  break
                }
                
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
                    } else {
                      console.warn('Failed to fetch workbook - response not ok:', workbookResponse.status)
                    }
                  } catch (workbookError) {
                    console.error('Failed to fetch workbook during streaming:', workbookError)
                    // Don't fail the entire request for workbook sync issues
                    setError(createErrorObject(workbookError, 'workbook'))
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
                    } else {
                      console.warn('Failed to fetch workbook after tool completion:', workbookResponse.status)
                    }
                  } catch (workbookError) {
                    console.error('Failed to fetch workbook during streaming:', workbookError)
                    // Don't fail the entire request for workbook sync issues
                  }
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', parseError)
                // Continue processing other lines instead of failing
              }
            }
          }
          
          if (streamError) break
        }
      } finally {
        reader.releaseLock()
      }

      if (streamError) {
        throw streamError
      }

      // Final cleanup - finalize any remaining text block
      if (currentTextBlockContent.trim() && currentMessageId) {
        console.log('Final message completed')
      }

      // Fetch updated workbook after completion
      try {
        const workbookResponse = await fetch('/api/workbook')
        if (workbookResponse.ok) {
          const updatedWorkbook = await workbookResponse.json()
          localStorage.setItem("workbook", JSON.stringify(updatedWorkbook))
          window.dispatchEvent(new Event('workbook-updated'))
        } else {
          console.warn('Failed to fetch final workbook update:', workbookResponse.status)
        }
      } catch (workbookError) {
        console.error('Failed to fetch updated workbook:', workbookError)
        // Set workbook error but don't fail the chat
        setError(createErrorObject(workbookError, 'workbook'))
      }

      setConnectionStatus('connected')

    } catch (err) {
      console.error("Send message error:", err)
      clearTimeout(timeoutId!)
      
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted')
        setConnectionStatus('disconnected')
        // Add a message indicating the request was stopped
        const stopMessage: UIMessage = {
          id: `msg-${Date.now()}-stop`,
          role: "assistant",
          parts: [{ type: "text", text: "Request stopped by user." }]
        }
        setMessages(prev => [...prev, stopMessage])
      } else {
        const chatError = createErrorObject(err)
        setError(chatError)
        setConnectionStatus('error')
        
        // Add error message to chat
        const errorMessage: UIMessage = {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          parts: [{ type: "text", text: `❌ ${chatError.message}` }]
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }

  const stopMessage = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const retryLastMessage = async () => {
    if (lastMessage && !isLoading) {
      await sendMessage(lastMessage)
    }
  }

  const clearError = () => {
    setError(null)
  }

  const newChat = () => {
    // Abort any ongoing request when starting a new chat
    if (abortController) {
      abortController.abort()
    }
    setMessages([])
    setError(null)
    setConnectionStatus('connected')
    setLastMessage('')
  }

  return {
    messages,
    sendMessage,
    stopMessage,
    newChat,
    retryLastMessage,
    clearError,
    isLoading,
    error,
    connectionStatus,
    canRetry: !!error?.canRetry && !!lastMessage,
  }
}
