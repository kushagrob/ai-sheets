"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { X, Send, Paperclip, GripVertical, Plus, Square, RefreshCw, AlertCircle, Wifi, WifiOff, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  const { 
    messages, 
    sendMessage, 
    stopMessage, 
    newChat, 
    retryLastMessage,
    clearError,
    isLoading, 
    error,
    connectionStatus,
    canRetry
  } = useChatMessages(workbookId, activeSheetId)
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
      console.log('Sending message:', inputValue.trim())
      await sendMessage(inputValue.trim())
      setInputValue("")
    } else {
      console.log('Cannot send message:', { inputValue: inputValue.trim(), isLoading })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSuggestionClick = async (suggestion: string) => {
    if (!isLoading) {
      await sendMessage(suggestion)
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
    <div className="flex flex-shrink-0" style={{ width }}>
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
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium">AI Assistant</h3>
              {/* Connection Status Indicator */}
              <div className="flex items-center">
                {connectionStatus === 'connected' && (
                  <div title="Connected">
                    <Wifi className="h-3 w-3 text-green-500" />
                  </div>
                )}
                {connectionStatus === 'disconnected' && (
                  <div title="Disconnected">
                    <WifiOff className="h-3 w-3 text-yellow-500" />
                  </div>
                )}
                {connectionStatus === 'error' && (
                  <div title="Connection Error">
                    <XCircle className="h-3 w-3 text-red-500" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500">Ask AI Sheets to do your work for you</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={newChat}
              disabled={isLoading}
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleChatPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tip Section */}
        <div className="p-4 bg-blue-50 border-b">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Ask AI Sheets to do your work for you. Most tasks take 3-15 minutes to complete. All
            changes can be reverted.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 border-b">
            <Alert variant={error.type === 'workbook' ? 'default' : 'destructive'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error.message}</span>
                <div className="flex items-center space-x-2 ml-4">
                  {canRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryLastMessage}
                      disabled={isLoading}
                      className="h-6 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="h-6 text-xs"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Try these suggestions</h4>
              <div className="space-y-2">
                <button 
                  className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm"
                  onClick={() => handleSuggestionClick("Determine returns on buying a 3-bed vs renting in NYC in 2025")}
                  disabled={isLoading}
                >
                  Determine returns on buying a 3-bed vs renting in NYC in 2025
                </button>
                <button 
                  className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm"
                  onClick={() => handleSuggestionClick("Create a personal budget tracker with spending insights")}
                  disabled={isLoading}
                >
                  Create a personal budget tracker with spending insights
                </button>
                <button 
                  className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm"
                  onClick={() => handleSuggestionClick("Build me a three statement model for Tesla")}
                  disabled={isLoading}
                >
                  Build me a three statement model for Tesla
                </button>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            // Extract text from UIMessage parts
            const messageText = message.parts
              ?.filter(part => part.type === 'text')
              ?.map(part => 'text' in part ? part.text : '')
              ?.join('') || ''
            
            return (
              <div key={message.id || index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{messageText}</p>
                </div>
              </div>
            )
          })}
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
                placeholder={isLoading ? "Generating response..." : "Type your message here..."}
                className="min-h-[40px] max-h-[120px] resize-none pr-10"
                disabled={isLoading}
              />
              <Button variant="ghost" size="sm" className="absolute right-2 top-2 p-1">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            {isLoading ? (
              <Button
                onClick={stopMessage}
                size="sm"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
                title="Stop generation"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || connectionStatus === 'error'}
                size="sm"
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
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
    </div>
  )
}
