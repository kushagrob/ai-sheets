"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import type { Sheet } from "@/types/workbook"

interface FormulaBarProps {
  selectedCell: { row: number; col: number }
  activeSheet: Sheet
  onCellUpdate: (sheetId: string, row: number, col: number, value: string) => void
}

export function FormulaBar({ selectedCell, activeSheet, onCellUpdate }: FormulaBarProps) {
  const [formulaValue, setFormulaValue] = useState("")

  // Convert column index to letter (0 -> A, 1 -> B, etc.)
  const getColumnLetter = (index: number): string => {
    let result = ""
    let num = index
    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26) - 1
    }
    return result
  }

  const cellAddress = `${getColumnLetter(selectedCell.col)}${selectedCell.row + 1}`

  useEffect(() => {
    const cellValue = activeSheet.data[selectedCell.row]?.[selectedCell.col] || ""
    setFormulaValue(String(cellValue))
  }, [selectedCell, activeSheet])

  const handleFormulaSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onCellUpdate(activeSheet.id, selectedCell.row, selectedCell.col, formulaValue)
    }
  }

  const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaValue(e.target.value)
  }

  const handleFormulaBlur = () => {
    // Update cell when formula bar loses focus
    const currentValue = activeSheet.data[selectedCell.row]?.[selectedCell.col] || ""
    if (formulaValue !== String(currentValue)) {
      onCellUpdate(activeSheet.id, selectedCell.row, selectedCell.col, formulaValue)
    }
  }

  return (
    <div className="flex items-center px-4 py-2 bg-white border-b space-x-2">
      <div className="flex items-center space-x-2">
        <Input value={cellAddress} readOnly className="w-20 text-sm font-mono bg-gray-50" />
        <span className="text-gray-500 font-mono">fx</span>
      </div>
      <Input
        value={formulaValue}
        onChange={handleFormulaChange}
        onKeyDown={handleFormulaSubmit}
        onBlur={handleFormulaBlur}
        className="flex-1 text-sm font-mono"
        placeholder="Enter formula or value..."
      />
    </div>
  )
}
