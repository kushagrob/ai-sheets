"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import type { Sheet } from "@/types/workbook"
import { evaluateFormula } from "@/lib/formula-engine"
import { CanvasGridRenderer, DEFAULT_GRID_CONFIG, type CellPosition } from "@/lib/canvas-grid"

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
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [editInputPosition, setEditInputPosition] = useState({ x: 0, y: 0, width: 0, height: 0 })
  
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<CanvasGridRenderer | null>(null)

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

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasGridRenderer(canvasRef.current, DEFAULT_GRID_CONFIG)
    }
  }, [])

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && rendererRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        canvasRef.current.width = rect.width * (window.devicePixelRatio || 1)
        canvasRef.current.height = rect.height * (window.devicePixelRatio || 1)
        canvasRef.current.style.width = rect.width + 'px'
        canvasRef.current.style.height = rect.height + 'px'
        const ctx = canvasRef.current.getContext('2d')!
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
        renderCanvas()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const renderCanvas = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const viewport = rendererRef.current.getViewport(scrollLeft, scrollTop, rect.width, rect.height)
    
    rendererRef.current.render(
      sheet.data,
      selectedCell,
      selectedRange,
      viewport,
      getCellDisplayValue
    )
  }, [sheet.data, selectedCell, selectedRange, scrollLeft, scrollTop, getCellDisplayValue])

  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const cellPos = rendererRef.current.getCellFromPoint(x, y, scrollLeft, scrollTop)
    if (cellPos) {
      handleCellClick(cellPos.row, cellPos.col)
    }
  }

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const cellPos = rendererRef.current.getCellFromPoint(x, y, scrollLeft, scrollTop)
    if (cellPos) {
      handleCellDoubleClick(cellPos.row, cellPos.col)
    }
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
    
    if (rendererRef.current) {
      const bounds = rendererRef.current.getCellBounds(row, col, scrollLeft, scrollTop)
      setEditInputPosition({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      })
    }
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

  // Handle scroll events
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    setScrollLeft(target.scrollLeft)
    setScrollTop(target.scrollTop)
  }

  useEffect(() => {
    // Auto-focus the grid container when component mounts
    const element = scrollRef?.current || containerRef.current
    if (element) {
      element.focus()
    }
  }, [])

  return (
    <div
      ref={scrollRef || containerRef}
      className="flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset overflow-auto min-w-0 relative"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      onMouseDown={(e) => {
        // Ensure the grid gets focus when clicked anywhere
        e.currentTarget.focus()
      }}
      style={{ outline: "none" }}
    >
      <div className="relative" style={{ width: '5300px', height: '1250px' }}>
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={handleCanvasDoubleClick}
          style={{ width: '5300px', height: '1250px' }}
        />
        
        {/* Input overlay for cell editing */}
        {editingCell && (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditSubmit}
            onKeyDown={handleKeyDown}
            className="absolute border-2 border-blue-500 outline-none bg-white text-xs px-1 z-30"
            style={{
              left: editInputPosition.x,
              top: editInputPosition.y,
              width: editInputPosition.width,
              height: editInputPosition.height,
              fontSize: '12px',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          />
        )}
      </div>
    </div>
  )
}
