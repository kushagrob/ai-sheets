"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import type { Sheet } from "@/types/workbook"
import { evaluateFormula } from "@/lib/formula-engine"

interface GridContainerProps {
  sheet: Sheet
  workbook: any // Full workbook for formula evaluation
  onCellSelect: (cell: { row: number; col: number }) => void
  onCellUpdate: (sheetId: string, row: number, col: number, value: string) => void
  onUndo: () => boolean
  onRedo: () => boolean
  scrollRef?: React.RefObject<HTMLDivElement>
}

export function GridContainer({ sheet, workbook, onCellSelect, onCellUpdate, onUndo, onRedo, scrollRef }: GridContainerProps) {
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 })
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Calculate the display value for a cell (evaluate formula if present)
  const getCellDisplayValue = (cell: any): string => {
    if (!cell) return ""
    
    // If cell has a formula, evaluate it dynamically
    if (cell.formula) {
      try {
        const result = evaluateFormula(cell.formula, workbook, sheet.id)
        
        // Handle different types of results
        if (result === null || result === undefined) {
          return ""
        }
        if (typeof result === 'string' && result.startsWith('#')) {
          return result // Error values like #ERROR!, #DIV/0!, etc.
        }
        
        return String(result)
      } catch (error) {
        console.error("Formula evaluation error:", error)
        return "#ERROR!"
      }
    }
    
    // Otherwise return the stored value
    return String(cell.value === null || cell.value === undefined ? "" : cell.value)
  }

  // Generate column headers (A, B, C, ..., Z, AA, AB, ...)
  const getColumnHeader = (index: number): string => {
    let result = ""
    let num = index
    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26) - 1
      if (num < 0) break
    }
    return result
  }

  const handleCellClick = (row: number, col: number) => {
    // If we're currently editing, save the changes first
    if (editingCell) {
      handleEditSubmit()
    }

    setSelectedCell({ row, col })
    setSelectedRange(null) // Clear range selection when clicking individual cell
    onCellSelect({ row, col })
    setEditingCell(null)
  }

  const isCellInSelection = (row: number, col: number): boolean => {
    if (selectedRange) {
      return row >= selectedRange.startRow && 
             row <= selectedRange.endRow && 
             col >= selectedRange.startCol && 
             col <= selectedRange.endCol
    }
    return selectedCell.row === row && selectedCell.col === col
  }

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col })
    const cell = sheet.data[row]?.[col]
    // When editing, show the formula if it exists, otherwise show the value
    const displayValue = cell?.formula || (cell?.value ? String(cell.value) : "")
    setEditValue(displayValue)
    setSelectedCell({ row, col })
    onCellSelect({ row, col })
  }

  const handleEditSubmit = () => {
    if (editingCell) {
      onCellUpdate(sheet.id, editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
      setEditValue("")
    }
  }

  // Ensure we have enough rows and columns
  const maxRows = Math.max(50, sheet.data.length)
  const maxCols = 52 // A-Z, AA-AZ (Excel-like)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log("Key pressed:", e.key, "Ctrl:", e.ctrlKey, "Meta:", e.metaKey)

    // Handle Ctrl/Cmd shortcuts first
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault()
          e.stopPropagation()
          console.log("Select All triggered - preventing browser default")
          // Select all cells in the visible range
          setSelectedRange({
            startRow: 0,
            startCol: 0,
            endRow: maxRows - 1,
            endCol: maxCols - 1
          })
          return
        case "z":
          e.preventDefault()
          e.stopPropagation()
          console.log("Undo triggered")
          const undoResult = onUndo()
          console.log("Undo result:", undoResult)
          return
        case "y":
          e.preventDefault()
          e.stopPropagation()
          console.log("Redo triggered")
          const redoResult = onRedo()
          console.log("Redo result:", redoResult)
          return
        case "c":
          e.preventDefault()
          e.stopPropagation()
          console.log("Copy triggered")
          return
        case "v":
          e.preventDefault()
          e.stopPropagation()
          console.log("Paste triggered")
          return
        case "x":
          e.preventDefault()
          e.stopPropagation()
          console.log("Cut triggered")
          return
      }
    }

    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault()
        handleEditSubmit()
      } else if (e.key === "Escape") {
        e.preventDefault()
        setEditingCell(null)
        setEditValue("")
      }
    } else {
      // Handle Escape to clear range selection
      if (e.key === "Escape" && selectedRange) {
        e.preventDefault()
        setSelectedRange(null)
        return
      }
      // Handle navigation when not editing
      const { row, col } = selectedCell
      let newRow = row
      let newCol = col

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          newRow = Math.max(0, row - 1)
          break
        case "ArrowDown":
          e.preventDefault()
          newRow = Math.min(49, row + 1) // Max 50 rows
          break
        case "ArrowLeft":
          e.preventDefault()
          newCol = Math.max(0, col - 1)
          break
        case "ArrowRight":
          e.preventDefault()
          newCol = Math.min(51, col + 1) // Max 52 columns
          break
        case "Enter":
          e.preventDefault()
          // Start editing on Enter
          handleCellDoubleClick(row, col)
          return
        case "F2":
          e.preventDefault()
          // Start editing on F2 (Excel convention)
          handleCellDoubleClick(row, col)
          return
        case "Delete":
        case "Backspace":
          e.preventDefault()
          // Clear cell content - handle range or single cell
          if (selectedRange) {
            // Clear all cells in the selected range
            for (let r = selectedRange.startRow; r <= selectedRange.endRow; r++) {
              for (let c = selectedRange.startCol; c <= selectedRange.endCol; c++) {
                onCellUpdate(sheet.id, r, c, "")
              }
            }
          } else {
            // Clear single cell
            onCellUpdate(sheet.id, row, col, "")
          }
          return
        default:
          // Start editing if user types a character
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            setEditingCell({ row, col })
            setEditValue(e.key)
            return
          }
      }

      if (newRow !== row || newCol !== col) {
        setSelectedCell({ row: newRow, col: newCol })
        onCellSelect({ row: newRow, col: newCol })
      }
    }
  }

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  useEffect(() => {
    // Auto-focus the grid container when component mounts
    const gridContainer = document.querySelector('[tabindex="0"]') as HTMLElement
    if (gridContainer) {
      gridContainer.focus()
    }
  }, [])

  return (
    <div
      ref={scrollRef}
      className="flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset overflow-auto min-w-0"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        // Ensure the grid gets focus when clicked anywhere
        e.currentTarget.focus()
      }}
      style={{ outline: "none" }}
    >
      <div className="relative">
        <table className="border-collapse" style={{ minWidth: '5300px' }}>
          <thead>
            <tr>
              <th className="w-12 h-6 bg-gray-100 border border-gray-300 text-xs font-normal sticky top-0 z-10"></th>
              {Array.from({ length: maxCols }, (_, i) => (
                <th
                  key={i}
                  className="w-[100px] min-w-[100px] h-6 bg-gray-100 border border-gray-300 text-xs font-normal px-2 sticky top-0 z-10"
                >
                  {getColumnHeader(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }, (_, rowIndex) => (
              <tr key={rowIndex}>
                <td className="w-12 h-6 bg-gray-100 border border-gray-300 text-xs text-center font-normal sticky left-0 z-10">
                  {rowIndex + 1}
                </td>
                {Array.from({ length: maxCols }, (_, colIndex) => {
                  const cell = sheet.data[rowIndex]?.[colIndex]
                  // In the grid, always show the computed value (evaluate formulas dynamically)
                  const cellValue = getCellDisplayValue(cell)
                  const isSelected = isCellInSelection(rowIndex, colIndex)
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex

                  return (
                    <td
                      key={colIndex}
                      className={`w-[100px] min-w-[100px] h-6 border border-gray-300 px-1 text-xs cursor-cell relative ${
                        isSelected ? "bg-blue-100 border-blue-500 border-2 z-20" : "hover:bg-gray-50"
                      }`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleEditSubmit}
                          onKeyDown={handleKeyDown}
                          className="w-full h-full border-none outline-none bg-white text-xs px-1 absolute inset-0 z-30"
                          style={{ minHeight: "22px" }}
                        />
                      ) : (
                        <span className="block truncate leading-5">{String(cellValue)}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
