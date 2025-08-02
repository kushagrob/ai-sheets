"use client"
import { useState } from "react"
import { Plus, MoreHorizontal, X, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Sheet } from "@/types/workbook"

interface SheetTabsProps {
  sheets: Sheet[]
  activeSheetId: string
  onSheetSelect: (sheetId: string) => void
  onCreateSheet: (name: string) => void
  onDeleteSheet: (sheetId: string) => void
  onRenameSheet: (sheetId: string, newName: string) => void
}

export function SheetTabs({ 
  sheets, 
  activeSheetId, 
  onSheetSelect, 
  onCreateSheet, 
  onDeleteSheet, 
  onRenameSheet 
}: SheetTabsProps) {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const handleStartRename = (sheet: Sheet) => {
    setEditingSheetId(sheet.id)
    setEditingName(sheet.name)
  }

  const handleFinishRename = () => {
    if (editingSheetId && editingName.trim()) {
      onRenameSheet(editingSheetId, editingName.trim())
    }
    setEditingSheetId(null)
    setEditingName("")
  }

  const handleCancelRename = () => {
    setEditingSheetId(null)
    setEditingName("")
  }

  const handleCreateSheet = () => {
    const newSheetName = `Sheet${sheets.length + 1}`
    onCreateSheet(newSheetName)
  }

  return (
    <div className="flex items-center bg-gray-50 border-t px-2 py-1 space-x-1">
      <div className="flex items-center space-x-1">
        {sheets.map((sheet) => (
          <div key={sheet.id} className="relative group">
            {editingSheetId === sheet.id ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleFinishRename()
                  } else if (e.key === "Escape") {
                    handleCancelRename()
                  }
                }}
                className="h-7 text-sm px-2 py-1 w-24"
                autoFocus
              />
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => onSheetSelect(sheet.id)}
                  className={`px-3 py-1 text-sm rounded-t border-t border-l border-r ${
                    sheet.id === activeSheetId
                      ? "bg-white border-gray-300 border-b-white -mb-px"
                      : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {sheet.name}
                </button>
                {sheet.id === activeSheetId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleStartRename(sheet)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      {sheets.length > 1 && (
                        <DropdownMenuItem 
                          onClick={() => onDeleteSheet(sheet.id)}
                          className="text-red-600"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        ))}
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-1"
          onClick={handleCreateSheet}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <span>Ready</span>
        <div className="w-px h-4 bg-gray-300" />
        <span>100%</span>
      </div>
    </div>
  )
}
