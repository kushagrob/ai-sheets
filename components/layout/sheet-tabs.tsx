"use client"
import { Plus, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Sheet } from "@/types/workbook"

interface SheetTabsProps {
  sheets: Sheet[]
  activeSheetId: string
  onSheetSelect: (sheetId: string) => void
}

export function SheetTabs({ sheets, activeSheetId, onSheetSelect }: SheetTabsProps) {
  return (
    <div className="flex items-center bg-gray-50 border-t px-2 py-1 space-x-1">
      <div className="flex items-center space-x-1">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            onClick={() => onSheetSelect(sheet.id)}
            className={`px-3 py-1 text-sm rounded-t border-t border-l border-r ${
              sheet.id === activeSheetId
                ? "bg-white border-gray-300 border-b-white -mb-px"
                : "bg-gray-100 border-gray-300 hover:bg-gray-200"
            }`}
          >
            {sheet.name}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="p-1">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <span>Ready</span>
        <div className="w-px h-4 bg-gray-300" />
        <span>100%</span>
        <Button variant="ghost" size="sm" className="p-1">
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
