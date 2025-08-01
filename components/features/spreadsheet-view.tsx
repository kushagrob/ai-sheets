"use client"

import { useState } from "react"
import { Toolbar } from "@/components/layout/toolbar"
import { FormulaBar } from "@/components/layout/formula-bar"
import { GridContainer } from "@/components/layout/grid-container"
import { SheetTabs } from "@/components/layout/sheet-tabs"
import { AIChatPanel } from "@/components/features/ai-chat-panel"
import { useWorkbook } from "@/hooks/use-workbook"
import { useUIStore } from "@/state/ui-store"

export function SpreadsheetView() {
  const { workbook, activeSheet, setActiveSheet, updateCell, undo, redo, canUndo, canRedo } = useWorkbook()
  const { isChatPanelOpen, toggleChatPanel, chatPanelWidth, setChatPanelWidth } = useUIStore()
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 })

  if (!workbook || !activeSheet) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Menu Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
        <div className="flex items-center space-x-4">
          <button className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded text-sm">
            <span>📁</span>
            <span>Open Xlsx File</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1 border rounded text-sm">
            <span>📄</span>
            <span>New File</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1 border rounded text-sm">
            <span>📤</span>
            <span>Export File</span>
          </button>
        </div>
        <div className="text-sm font-medium">{workbook.name}</div>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleChatPanel}
            className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
          >
            <span>💬</span>
            <span>New Chat</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-1 bg-gray-800 text-white rounded text-sm">
            <span>📤</span>
            <span>Share File</span>
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b bg-gray-50">
        {["HOME", "INSERT", "PAGE LAYOUT", "FORMULAS", "DATA", "VIEW", "SETTINGS"].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "HOME" ? "bg-white border-b-2 border-blue-500" : "hover:bg-gray-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <Toolbar canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
      <FormulaBar selectedCell={selectedCell} activeSheet={activeSheet} onCellUpdate={updateCell} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1">
          <GridContainer
            sheet={activeSheet}
            onCellSelect={setSelectedCell}
            onCellUpdate={updateCell}
            onUndo={undo}
            onRedo={redo}
          />
          <SheetTabs sheets={workbook.sheets} activeSheetId={activeSheet.id} onSheetSelect={setActiveSheet} />
        </div>

        {isChatPanelOpen && (
          <div className="flex flex-shrink-0 bg-white" style={{ width: chatPanelWidth }}>
            <AIChatPanel
              workbookId={workbook.id}
              activeSheetId={activeSheet.id}
              width={chatPanelWidth}
              onWidthChange={setChatPanelWidth}
            />
          </div>
        )}
      </div>
    </div>
  )
}
