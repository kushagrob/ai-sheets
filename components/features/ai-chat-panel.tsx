"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { X, Send, Paperclip, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useUIStore } from "@/state/ui-store"
import { useChatMessages } from "@/hooks/use-chat-messages"

interface AIChatPanelProps {
  workbookId: string
  activeSheetId: string
  width: number
  onWidthChange: (width: number) => void
}

export function AIChatPanel({ workbookId, activeSheetId, width, onWidthChange }: AIChatPanelProps) {
  const { toggleChatPanel } = useUIStore()
  const { messages, sendMessage, isLoading } = useChatMessages(workbookId, activeSheetId)
  const [inputValue, setInputValue] = useState("")
  const [isResizing, setIsResizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (inputValue.trim() && !isLoading) {
      await sendMessage(inputValue.trim())
      setInputValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX // Negative because we're resizing from the left edge
      const newWidth = Math.max(280, Math.min(800, startWidth + deltaX)) // Min 280px, max 800px
      onWidthChange(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <>
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        className={`w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group ${
          isResizing ? "bg-blue-500" : ""
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Chat Panel Content */}
      <div className="flex-1 bg-white flex flex-col border-l">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-medium">AI Assistant</h3>
            <p className="text-sm text-gray-500">Ask Shortcut to do your work for you</p>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleChatPanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tip Section */}
        <div className="p-4 bg-blue-50 border-b">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Ask Shortcut to do your work for you. Most tasks take 3-15 minutes to complete. All
            changes can be reverted.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Try these suggestions</h4>
              <div className="space-y-2">
                <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm">
                  Determine returns on buying a 3-bed vs renting in NYC in 2025
                </button>
                <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm">
                  Create a personal budget tracker with spending insights
                </button>
                <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm">
                  Build me a three statement model for Tesla
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === "user"
                    ? "bg-blue-600 text-white"
                    : message.type === "status"
                      ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {message.type === "status" && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-3 w-3 border border-yellow-600 border-t-transparent rounded-full" />
                    <span className="text-sm">{message.content}</span>
                  </div>
                )}
                {message.type !== "status" && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t">
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Basic</span>
            <span className="text-xs text-gray-500">Max AI (2/2)</span>
            <div className="flex-1" />
            <span className="text-xs text-gray-500">Ask Mode</span>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs">
              Action
            </Button>
          </div>

          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here..."
                className="min-h-[40px] max-h-[120px] resize-none pr-10"
                disabled={isLoading}
              />
              <Button variant="ghost" size="sm" className="absolute right-2 top-2 p-1">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <button className="flex items-center space-x-1 hover:text-gray-700">
              <span>📁</span>
              <span>Open Excel File</span>
            </button>
            <div className="flex items-center space-x-2">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Pro Plan Active</span>
              </span>
              <span>⚡ Unlimited messages</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
