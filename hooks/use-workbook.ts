"use client"

import { useState, useEffect } from "react"
import { useWorkbookHistory } from "./use-workbook-history"
import type { Workbook } from "@/types/workbook"



// Create a default empty workbook
const createEmptyWorkbook = (): Workbook => ({
  id: `wb-${Date.now()}`,
  name: "empty-sheet.xlsx",
  sheets: [
    {
      id: `sh-${Date.now()}`,
      name: "Sheet1",
      data: Array(50)
        .fill(null)
        .map(() => Array(52).fill(null).map(() => ({ value: null }))),
    },
  ],
})

export function useWorkbook() {
  const [activeSheetId, setActiveSheetId] = useState<string>("")
  const [isInitialized, setIsInitialized] = useState(false)
  const { workbook, setWorkbook, undo, redo, canUndo, canRedo } = useWorkbookHistory(null)

  useEffect(() => {
    if (!isInitialized) {
      // Try to load from localStorage first
      const savedWorkbook = localStorage.getItem("workbook")

      if (savedWorkbook) {
        try {
          const parsed = JSON.parse(savedWorkbook)
          setWorkbook(parsed, "Loaded from storage")
          setActiveSheetId(parsed.sheets[0]?.id || "")
        } catch (error) {
          console.error("Failed to parse saved workbook:", error)
          // Fall back to empty workbook
          const emptyWorkbook = createEmptyWorkbook()
          localStorage.setItem("workbook", JSON.stringify(emptyWorkbook))
          setWorkbook(emptyWorkbook, "Created empty workbook")
          setActiveSheetId(emptyWorkbook.sheets[0].id)
        }
      } else {
        // Create new empty workbook
        const emptyWorkbook = createEmptyWorkbook()
        localStorage.setItem("workbook", JSON.stringify(emptyWorkbook))
        setWorkbook(emptyWorkbook, "Created empty workbook")
        setActiveSheetId(emptyWorkbook.sheets[0].id)
      }

      setIsInitialized(true)
    }
  }, [setWorkbook, isInitialized])

  // Save to localStorage whenever workbook changes
  useEffect(() => {
    if (workbook && isInitialized) {
      localStorage.setItem("workbook", JSON.stringify(workbook))
    }
  }, [workbook, isInitialized])

  // Listen for workbook updates from AI chat
  useEffect(() => {
    const handleWorkbookUpdate = () => {
      const savedWorkbook = localStorage.getItem("workbook")
      if (savedWorkbook) {
        try {
          const parsed = JSON.parse(savedWorkbook)
          setWorkbook(parsed, "Updated from AI chat")
        } catch (error) {
          console.error("Failed to parse updated workbook:", error)
        }
      }
    }

    window.addEventListener('workbook-updated', handleWorkbookUpdate)
    return () => window.removeEventListener('workbook-updated', handleWorkbookUpdate)
  }, [setWorkbook])

  const activeSheet = workbook?.sheets.find((sheet) => sheet.id === activeSheetId)

  const setActiveSheet = (sheetId: string) => {
    setActiveSheetId(sheetId)
  }

  const updateCell = (sheetId: string, row: number, col: number, value: string) => {
    if (!workbook) {
      console.log("Cannot update cell - no workbook")
      return
    }

    console.log(`Updating cell ${String.fromCharCode(65 + col)}${row + 1} to:`, value)

    const updatedWorkbook = {
      ...workbook,
      sheets: workbook.sheets.map((sheet) => {
        if (sheet.id === sheetId) {
          const newData = [...sheet.data]

          // Ensure the row exists
          while (newData.length <= row) {
            newData.push(Array(52).fill(null).map(() => ({ value: null })))
          }

          // Ensure the column exists in the row
          while (newData[row].length <= col) {
            newData[row].push({ value: null })
          }

          // Handle formula vs value
          if (value.startsWith('=')) {
            // It's a formula - store formula, value will be computed dynamically
            newData[row][col] = { value: null, formula: value }
          } else {
            // It's a regular value
            newData[row][col] = { value: value === "" ? null : value }
          }

          return { ...sheet, data: newData }
        }
        return sheet
      }),
    }

    const cellAddress = `${String.fromCharCode(65 + col)}${row + 1}`
    setWorkbook(updatedWorkbook, `Edit cell ${cellAddress}`)
  }

  const loadWorkbook = (newWorkbook: Workbook) => {
    setWorkbook(newWorkbook, "Loaded new workbook")
    setActiveSheetId(newWorkbook.sheets[0]?.id || "")
  }

  const createSheet = (name: string) => {
    if (!workbook) return

    const newSheetId = `sh-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const newSheet = {
      id: newSheetId,
      name,
      data: Array(50)
        .fill(null)
        .map(() => Array(52).fill(null).map(() => ({ value: null }))),
    }

    const updatedWorkbook = {
      ...workbook,
      sheets: [...workbook.sheets, newSheet],
    }

    setWorkbook(updatedWorkbook, `Created sheet "${name}"`)
    setActiveSheetId(newSheetId)
  }

  const deleteSheet = (sheetId: string) => {
    if (!workbook || workbook.sheets.length <= 1) return

    const sheetIndex = workbook.sheets.findIndex((s) => s.id === sheetId)
    if (sheetIndex === -1) return

    const updatedWorkbook = {
      ...workbook,
      sheets: workbook.sheets.filter((s) => s.id !== sheetId),
    }

    setWorkbook(updatedWorkbook, `Deleted sheet`)

    // If the deleted sheet was active, switch to the first available sheet
    if (sheetId === activeSheetId) {
      setActiveSheetId(updatedWorkbook.sheets[0]?.id || "")
    }
  }

  const renameSheet = (sheetId: string, newName: string) => {
    if (!workbook) return

    const updatedWorkbook = {
      ...workbook,
      sheets: workbook.sheets.map((sheet) =>
        sheet.id === sheetId ? { ...sheet, name: newName } : sheet
      ),
    }

    setWorkbook(updatedWorkbook, `Renamed sheet to "${newName}"`)
  }

  const resetWorkbook = () => {
    const emptyWorkbook = createEmptyWorkbook()
    localStorage.setItem("workbook", JSON.stringify(emptyWorkbook))
    setWorkbook(emptyWorkbook, "Reset to new workbook")
    setActiveSheetId(emptyWorkbook.sheets[0].id)
  }

  return {
    workbook,
    activeSheet,
    setActiveSheet,
    updateCell,
    loadWorkbook,
    createSheet,
    deleteSheet,
    renameSheet,
    resetWorkbook,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
