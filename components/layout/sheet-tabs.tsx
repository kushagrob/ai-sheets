"use client"
import { useState, useRef, useEffect } from "react"
import { Plus, ChevronDown, X, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleStartRename = (sheet: Sheet) => {
    console.log('handleStartRename called for:', sheet.name, sheet.id)
    setEditingSheetId(sheet.id)
    setEditingName(sheet.name)
    setOpenDropdownId(null)
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

  const handleDropdownToggle = (sheetId: string) => {
    setOpenDropdownId(openDropdownId === sheetId ? null : sheetId)
  }

  const handleDeleteSheet = (sheetId: string) => {
    console.log('handleDeleteSheet called with:', sheetId)
    onDeleteSheet(sheetId)
    setOpenDropdownId(null)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
    }

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [openDropdownId])

  return (
    <div className="flex items-center bg-gray-50 border-t px-2 py-1 space-x-1 relative">
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
              <div className={`flex items-center rounded-t border-t border-l border-r relative ${
                sheet.id === activeSheetId
                  ? "bg-white border-gray-300 border-b-white -mb-px"
                  : "bg-gray-100 border-gray-300 hover:bg-gray-200"
              }`}>
                <button
                  onClick={() => onSheetSelect(sheet.id)}
                  className="px-3 py-1 text-sm flex-1 text-left"
                >
                  {sheet.name}
                </button>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-5 p-0 rounded-none hover:bg-black/5"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDropdownToggle(sheet.id)
                    }}
                  >
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                  </Button>
                  
                  {openDropdownId === sheet.id && (
                    <div 
                      ref={dropdownRef}
                      className="absolute bottom-full right-0 mb-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 min-w-[120px]"
                    >
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleStartRename(sheet)
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center"
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </button>
                      {sheets.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteSheet(sheet.id)
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center text-red-600"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
