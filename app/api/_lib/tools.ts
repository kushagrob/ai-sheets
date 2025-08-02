import { tool } from 'ai';
import { z } from 'zod';
import { Workbook } from '@/types/workbook';

// Helper function to convert Excel-style cell reference to row/col indices
function cellToIndices(cell: string): { row: number; col: number } {
  const match = cell.match(/^([A-Z]+)(\d+)$/)
  if (!match) throw new Error(`Invalid cell reference: ${cell}`)

  const [, colStr, rowStr] = match
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  col -= 1 // Convert to 0-based

  const row = Number.parseInt(rowStr) - 1 // Convert to 0-based

  return { row, col }
}

// Helper function to parse range like "A1:C3"
function parseRange(range: string): { startRow: number; startCol: number; endRow: number; endCol: number } {
  if (range.includes(":")) {
    const [start, end] = range.split(":")
    const startIndices = cellToIndices(start)
    const endIndices = cellToIndices(end)
    return {
      startRow: startIndices.row,
      startCol: startIndices.col,
      endRow: endIndices.row,
      endCol: endIndices.col,
    }
  } else {
    // Single cell
    const indices = cellToIndices(range)
    return {
      startRow: indices.row,
      startCol: indices.col,
      endRow: indices.row,
      endCol: indices.col,
    }
  }
}


export function createSpreadsheetTools(workbook: Workbook) {
  return {
    setData: tool({
      description: 'Set the data for a specific cell or range of cells. Use for raw values, not formulas.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        range: z.string().describe('The cell range, e.g., "A1" or "B2:D10".'),
        data: z.union([
          z.array(z.array(z.any())), 
          z.string()
        ]).describe('A 2D array of data to set, or a JSON string representation of the array.'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        const { range } = params
        let data: any[][]
        
        // Handle both array and string inputs
        if (typeof params.data === 'string') {
          try {
            data = JSON.parse(params.data)
            if (!Array.isArray(data) || !Array.isArray(data[0])) {
              throw new Error("Invalid data format")
            }
          } catch (error) {
            return { success: false, error: "Invalid JSON data format" }
          }
        } else {
          data = params.data as any[][]
        }
        try {
          const rangeIndices = parseRange(range)

          // Ensure sheet has enough rows and columns
          const maxRow = rangeIndices.endRow + 1
          const maxCol = rangeIndices.endCol + 1

          while (sheet.data.length < maxRow) {
            sheet.data.push([])
          }

          // Set the data
          let dataRowIndex = 0
          for (let row = rangeIndices.startRow; row <= rangeIndices.endRow && dataRowIndex < data.length; row++) {
            while (sheet.data[row].length < maxCol) {
              sheet.data[row].push({ value: null })
            }

            let dataColIndex = 0
            for (
              let col = rangeIndices.startCol;
              col <= rangeIndices.endCol && dataColIndex < data[dataRowIndex].length;
              col++
            ) {
              const cellValue = data[dataRowIndex][dataColIndex]
              sheet.data[row][col] = { value: cellValue === "" ? null : cellValue }
              dataColIndex++
            }
            dataRowIndex++
          }

          return {
            success: true,
            message: `Data set in range ${range}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to set data: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    applyFormula: tool({
      description: 'Apply an Excel-style formula to a cell.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        cell: z.string().describe('The single cell to apply the formula to, e.g., "C5".'),
        formula: z.string().describe('The formula string, e.g., "=SUM(A1:B10)".'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        const { cell, formula } = params
        try {
          const { row, col } = cellToIndices(cell)

          // Ensure sheet has enough rows and columns
          while (sheet.data.length <= row) {
            sheet.data.push([])
          }
          while (sheet.data[row].length <= col) {
            sheet.data[row].push({ value: null })
          }

          // Store the formula without pre-computing the result
          // The result will be computed dynamically in the grid
          sheet.data[row][col] = { value: null, formula: formula }

          return {
            success: true,
            message: `Formula ${formula} applied to cell ${cell}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to apply formula: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    insertRows: tool({
      description: 'Insert new rows at a specific position.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        rowIndex: z.number().describe('The row index to insert at (0-based).'),
        count: z.number().default(1).describe('Number of rows to insert.'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        const { rowIndex, count = 1 } = params
        try {
          // Insert empty rows at the specified index
          for (let i = 0; i < count; i++) {
            sheet.data.splice(rowIndex, 0, [])
          }

          return {
            success: true,
            message: `Inserted ${count} row(s) at index ${rowIndex}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to insert rows: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    insertColumns: tool({
      description: 'Insert new columns at a specific position.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        columnIndex: z.number().describe('The column index to insert at (0-based).'),
        count: z.number().default(1).describe('Number of columns to insert.'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        const { columnIndex, count = 1 } = params
        try {
          // Insert empty columns at the specified index for all rows
          for (let row = 0; row < sheet.data.length; row++) {
            for (let i = 0; i < count; i++) {
              sheet.data[row].splice(columnIndex, 0, { value: null })
            }
          }

          return {
            success: true,
            message: `Inserted ${count} column(s) at index ${columnIndex}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to insert columns: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    deleteRows: tool({
      description: 'Delete rows from the sheet.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        startRow: z.number().describe('Starting row index (0-based).'),
        count: z.number().default(1).describe('Number of rows to delete.'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        const { startRow, count = 1 } = params
        try {
          // Delete rows starting from startRow
          sheet.data.splice(startRow, count)

          return {
            success: true,
            message: `Deleted ${count} row(s) starting from index ${startRow}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to delete rows: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    deleteColumns: tool({
      description: 'Delete columns from the sheet.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        startColumn: z.number().describe('Starting column index (0-based).'),
        count: z.number().default(1).describe('Number of columns to delete.'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        const { startColumn, count = 1 } = params
        try {
          // Delete columns starting from startColumn for all rows
          for (let row = 0; row < sheet.data.length; row++) {
            sheet.data[row].splice(startColumn, count)
          }

          return {
            success: true,
            message: `Deleted ${count} column(s) starting from index ${startColumn}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to delete columns: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    askForClarification: tool({
      description: 'Ask the user a clarifying question if the request is ambiguous.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user.'),
      }),
      execute: async (params) => {
        return { question: params.question, requiresResponse: true };
      },
    }),

    taskComplete: tool({
      description: 'Signal that the current task is finished and provide a summary.',
      inputSchema: z.object({
        summary: z.string().describe('Brief summary of what was accomplished.'),
      }),
      execute: async (params) => {
        return { completed: true, summary: params.summary };
      },
    }),

    createSheet: tool({
      description: 'Create a new sheet in the workbook.',
      inputSchema: z.object({
        name: z.string().describe('The name for the new sheet.'),
      }),
      execute: async (params) => {
        try {
          const newSheetId = `sh-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          const newSheet = {
            id: newSheetId,
            name: params.name,
            data: Array(50)
              .fill(null)
              .map(() => Array(52).fill(null).map(() => ({ value: null }))),
          }

          workbook.sheets.push(newSheet)

          return {
            success: true,
            message: `Created new sheet "${params.name}" with ID ${newSheetId}`,
            sheetId: newSheetId,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to create sheet: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    deleteSheet: tool({
      description: 'Delete a sheet from the workbook. Cannot delete the last remaining sheet.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to delete.'),
      }),
      execute: async (params) => {
        try {
          if (workbook.sheets.length <= 1) {
            return {
              success: false,
              error: "Cannot delete the last remaining sheet in the workbook",
            }
          }

          const sheetIndex = workbook.sheets.findIndex((s) => s.id === params.sheetId)
          if (sheetIndex === -1) {
            return {
              success: false,
              error: "Sheet not found",
            }
          }

          const deletedSheet = workbook.sheets[sheetIndex]
          workbook.sheets.splice(sheetIndex, 1)

          return {
            success: true,
            message: `Deleted sheet "${deletedSheet.name}"`,
            remainingSheets: workbook.sheets.map(s => ({ id: s.id, name: s.name })),
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to delete sheet: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    renameSheet: tool({
      description: 'Rename an existing sheet.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to rename.'),
        newName: z.string().describe('The new name for the sheet.'),
      }),
      execute: async (params) => {
        try {
          const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
          if (!sheet) {
            return {
              success: false,
              error: "Sheet not found",
            }
          }

          const oldName = sheet.name
          sheet.name = params.newName

          return {
            success: true,
            message: `Renamed sheet from "${oldName}" to "${params.newName}"`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to rename sheet: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    copySheet: tool({
      description: 'Create a copy of an existing sheet.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to copy.'),
        newName: z.string().describe('The name for the copied sheet.'),
      }),
      execute: async (params) => {
        try {
          const sourceSheet = workbook.sheets.find((s) => s.id === params.sheetId)
          if (!sourceSheet) {
            return {
              success: false,
              error: "Source sheet not found",
            }
          }

          const newSheetId = `sh-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          const copiedSheet = {
            id: newSheetId,
            name: params.newName,
            data: sourceSheet.data.map(row => 
              row.map(cell => ({ ...cell }))
            ),
          }

          workbook.sheets.push(copiedSheet)

          return {
            success: true,
            message: `Created copy of sheet "${sourceSheet.name}" as "${params.newName}" with ID ${newSheetId}`,
            sheetId: newSheetId,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to copy sheet: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    listSheets: tool({
      description: 'Get a list of all sheets in the workbook with their details.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const sheets = workbook.sheets.map(sheet => ({
            id: sheet.id,
            name: sheet.name,
            rowCount: sheet.data.length,
            columnCount: sheet.data[0]?.length || 0,
          }))

          return {
            success: true,
            sheets,
            totalSheets: sheets.length,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to list sheets: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    applyFormulaToRange: tool({
      description: 'Apply a formula pattern to multiple cells in a range. Automatically adjusts cell references.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        startCell: z.string().describe('Starting cell, e.g., "D5".'),
        endCell: z.string().describe('Ending cell, e.g., "D10".'),
        formulaPattern: z.string().describe('Formula pattern with placeholders. Use {ROW} for current row, {COL} for current column. Example: "=C{ROW}-B{ROW}" or "=SUM(A1:A{ROW})"'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        try {
          const startIndices = cellToIndices(params.startCell)
          const endIndices = cellToIndices(params.endCell)
          let successCount = 0

          for (let row = startIndices.row; row <= endIndices.row; row++) {
            for (let col = startIndices.col; col <= endIndices.col; col++) {
              // Ensure sheet has enough rows and columns
              while (sheet.data.length <= row) {
                sheet.data.push([])
              }
              while (sheet.data[row].length <= col) {
                sheet.data[row].push({ value: null })
              }

              // Generate formula for this cell
              let formula = params.formulaPattern
              
              // Replace placeholders first
              formula = formula.replace(/{ROW}/g, (row + 1).toString())
              
              // Generate column letter(s) properly (A, B, ..., Z, AA, AB, ...)
              let colStr = ""
              let tempCol = col
              while (tempCol >= 0) {
                colStr = String.fromCharCode(65 + (tempCol % 26)) + colStr
                tempCol = Math.floor(tempCol / 26) - 1
                if (tempCol < 0) break
              }
              formula = formula.replace(/{COL}/g, colStr)
              
              // Adjust relative cell references in the formula
              // Calculate offset from start position
              const rowOffset = row - startIndices.row
              const colOffset = col - startIndices.col
              
              // Find and adjust cell references (but not absolute ones with $)
              formula = formula.replace(/(?<!\$)[A-Z]+(?<!\$)\d+/g, (cellRef) => {
                try {
                  const { row: refRow, col: refCol } = cellToIndices(cellRef)
                  const newRow = refRow + rowOffset
                  const newCol = refCol + colOffset
                  
                  // Convert back to cell reference (handle multi-letter columns)
                  let newColStr = ""
                  let tempCol = newCol
                  while (tempCol >= 0) {
                    newColStr = String.fromCharCode(65 + (tempCol % 26)) + newColStr
                    tempCol = Math.floor(tempCol / 26) - 1
                    if (tempCol < 0) break
                  }
                  return `${newColStr}${newRow + 1}`
                } catch {
                  return cellRef // If parsing fails, keep original
                }
              })

              // Store the formula without pre-computing the result
              // The result will be computed dynamically in the grid
              sheet.data[row][col] = { value: null, formula: formula }
              successCount++
            }
          }

          return {
            success: true,
            message: `Applied formula pattern to ${successCount} cells in range ${params.startCell}:${params.endCell}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to apply formula to range: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

    setDataGrid: tool({
      description: 'Set data for multiple cells efficiently using a grid format. More efficient than multiple setData calls.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        startCell: z.string().describe('Top-left cell to start placing data, e.g., "A1".'),
        data: z.union([
          z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
          z.string()
        ]).describe('2D array of data to place. Each sub-array is a row, or a JSON string representation.'),
      }),
      execute: async (params) => {
        const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
        if (!sheet) {
          return { success: false, error: "Sheet not found" }
        }

        let data: (string | number | null)[][]
        
        // Handle both array and string inputs
        if (typeof params.data === 'string') {
          try {
            data = JSON.parse(params.data)
            if (!Array.isArray(data) || !Array.isArray(data[0])) {
              throw new Error("Invalid data format")
            }
          } catch (error) {
            return { success: false, error: "Invalid JSON data format" }
          }
        } else {
          data = params.data as (string | number | null)[][]
        }

        try {
          const startIndices = cellToIndices(params.startCell)
          let cellsSet = 0

          for (let dataRow = 0; dataRow < data.length; dataRow++) {
            const sheetRow = startIndices.row + dataRow
            
            // Ensure the row exists
            while (sheet.data.length <= sheetRow) {
              sheet.data.push([])
            }

            for (let dataCol = 0; dataCol < data[dataRow].length; dataCol++) {
              const sheetCol = startIndices.col + dataCol
              
              // Ensure the column exists
              while (sheet.data[sheetRow].length <= sheetCol) {
                sheet.data[sheetRow].push({ value: null })
              }

              const value = data[dataRow][dataCol]
              sheet.data[sheetRow][sheetCol] = { value: value === "" ? null : value }
              cellsSet++
            }
          }

          return {
            success: true,
            message: `Set data for ${cellsSet} cells starting from ${params.startCell}`,
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to set data grid: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      },
    }),

  };
}