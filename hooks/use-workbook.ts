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
        .map(() => Array(26).fill("")),
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
          setWorkbook(emptyWorkbook, "Created empty workbook")
          setActiveSheetId(emptyWorkbook.sheets[0].id)
        }
      } else {
        // Create new empty workbook
        const emptyWorkbook = createEmptyWorkbook()
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
            newData.push(Array(26).fill(""))
          }

          // Ensure the column exists in the row
          while (newData[row].length <= col) {
            newData[row].push("")
          }

          newData[row][col] = value

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

  return {
    workbook,
    activeSheet,
    setActiveSheet,
    updateCell,
    loadWorkbook,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
