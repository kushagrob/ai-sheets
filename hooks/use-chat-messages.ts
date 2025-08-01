"use client"

import { useState } from "react"
import { useChat } from "ai/react"
import type { Workbook } from "@/types/workbook"

interface ChatMessage {
  type: "user" | "ai" | "status"
  content: string
}

export function useChatMessages(workbookId: string, activeSheetId: string) {
  const [workbook, setWorkbook] = useState<Workbook | null>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
    body: {
      workbook,
      activeSheetId,
    },
    onResponse: (response) => {
      console.log("Chat response received:", response)
    },
    onFinish: (message) => {
      console.log("Chat finished:", message)
      // Handle any workbook updates from the AI response
      try {
        const content = message.content
        if (content.includes("updatedWorkbook")) {
          // Parse and extract workbook updates
          // This would need to be implemented based on the AI response format
        }
      } catch (error) {
        console.error("Error processing AI response:", error)
      }
    },
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  // Convert AI SDK messages to our format
  const chatMessages: ChatMessage[] = messages.map((msg) => ({
    type: msg.role === "user" ? "user" : "ai",
    content: msg.content,
  }))

  const sendMessage = async (message: string) => {
    // Get current workbook from localStorage or state
    const currentWorkbook = JSON.parse(localStorage.getItem("workbook") || "null")
    setWorkbook(currentWorkbook)

    // Use the AI SDK's handleSubmit with our message
    const syntheticEvent = {
      preventDefault: () => {},
      target: { message: { value: message } },
    } as any

    handleInputChange({ target: { value: message } } as any)
    handleSubmit(syntheticEvent)
  }

  return {
    messages: chatMessages,
    sendMessage,
    isLoading,
    error,
  }
}
