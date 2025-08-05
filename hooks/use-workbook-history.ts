"use client"

import { useState, useCallback, useEffect } from "react"
import type { Workbook } from "@/types/workbook"

interface HistoryEntry {
  workbook: Workbook
  timestamp: number
  action: string
}

export function useWorkbookHistory(initialWorkbook: Workbook | null) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [workbook, setWorkbook] = useState<Workbook | null>(initialWorkbook)

  // Initialize history when workbook is first set
  useEffect(() => {
    if (initialWorkbook && history.length === 0 && currentIndex === -1) {
      const entry: HistoryEntry = {
        workbook: JSON.parse(JSON.stringify(initialWorkbook)),
        timestamp: Date.now(),
        action: "Initial state",
      }
      setHistory([entry])
      setCurrentIndex(0)
      setWorkbook(initialWorkbook)
    }
  }, [initialWorkbook, history.length, currentIndex])

  const addToHistory = useCallback(
    (newWorkbook: Workbook, action: string) => {
      console.log("Adding to history:", action)

      const entry: HistoryEntry = {
        workbook: JSON.parse(JSON.stringify(newWorkbook)), // Deep clone
        timestamp: Date.now(),
        action,
      }

      setHistory((prev) => {
        // Remove any future history if we're not at the end
        const newHistory = prev.slice(0, currentIndex + 1)
        const updatedHistory = [...newHistory, entry]

        // Limit history to 50 entries
        if (updatedHistory.length > 50) {
          updatedHistory.shift()
          // Adjust currentIndex if we removed from the beginning
          setCurrentIndex(Math.max(0, currentIndex))
          return updatedHistory
        }

        // Update current index
        setCurrentIndex(updatedHistory.length - 1)
        return updatedHistory
      })

      setWorkbook(newWorkbook)
    },
    [currentIndex],
  )

  const undo = useCallback(() => {
    console.log("Undo called, currentIndex:", currentIndex, "history length:", history.length)
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      console.log("Undoing to index:", newIndex)
      setCurrentIndex(newIndex)
      setWorkbook(history[newIndex].workbook)
      return true
    }
    console.log("Cannot undo - at beginning of history")
    return false
  }, [currentIndex, history])

  const redo = useCallback(() => {
    console.log("Redo called, currentIndex:", currentIndex, "history length:", history.length)
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1
      console.log("Redoing to index:", newIndex)
      setCurrentIndex(newIndex)
      setWorkbook(history[newIndex].workbook)
      return true
    }
    console.log("Cannot redo - at end of history")
    return false
  }, [currentIndex, history])

  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1

  return {
    workbook,
    setWorkbook: addToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    historyLength: history.length,
  }
}
