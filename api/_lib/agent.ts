import type { Workbook } from "../../types/workbook"

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

// Simple formula evaluator (basic implementation)
function evaluateFormula(formula: string, workbook: Workbook, sheetId: string): any {
  // Remove the = sign
  const expr = formula.substring(1)

  // Handle SUM function
  if (expr.startsWith("SUM(") && expr.endsWith(")")) {
    const rangeStr = expr.slice(4, -1)
    const sheet = workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return "#ERROR!"

    try {
      const range = parseRange(rangeStr)
      let sum = 0

      for (let row = range.startRow; row <= range.endRow; row++) {
        for (let col = range.startCol; col <= range.endCol; col++) {
          const value = sheet.data[row]?.[col]
          if (typeof value === "number") {
            sum += value
          } else if (typeof value === "string") {
            const num = Number.parseFloat(value)
            if (!isNaN(num)) sum += num
          }
        }
      }

      return sum
    } catch (error) {
      return "#ERROR!"
    }
  }

  // Handle simple arithmetic with cell references
  // This is a basic implementation - a full formula engine would be much more complex
  let result = expr

  // Replace cell references with their values
  const cellRefs = expr.match(/[A-Z]+\d+/g) || []
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (sheet) {
    for (const cellRef of cellRefs) {
      try {
        const { row, col } = cellToIndices(cellRef)
        const value = sheet.data[row]?.[col] || 0
        result = result.replace(cellRef, String(value))
      } catch (error) {
        return "#ERROR!"
      }
    }
  }

  // Evaluate simple arithmetic
  try {
    // Basic safety check - only allow numbers, operators, and parentheses
    if (!/^[\d+\-*/().\s]+$/.test(result)) {
      return "#ERROR!"
    }
    return eval(result)
  } catch (error) {
    return "#ERROR!"
  }
}

export async function executeSpreadsheetTool(toolName: string, params: any, workbook: Workbook): Promise<any> {
  const sheet = workbook.sheets.find((s) => s.id === params.sheetId)
  if (!sheet) {
    return { success: false, error: "Sheet not found" }
  }

  switch (toolName) {
    case "setData": {
      const { range, data } = params
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
            sheet.data[row].push("")
          }

          let dataColIndex = 0
          for (
            let col = rangeIndices.startCol;
            col <= rangeIndices.endCol && dataColIndex < data[dataRowIndex].length;
            col++
          ) {
            sheet.data[row][col] = data[dataRowIndex][dataColIndex]
            dataColIndex++
          }
          dataRowIndex++
        }

        return {
          success: true,
          message: `Data set in range ${range}`,
          updatedWorkbook: workbook,
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to set data: ${error instanceof Error ? error.message : "Unknown error"}`,
        }
      }
    }

    case "applyFormula": {
      const { cell, formula } = params
      try {
        const { row, col } = cellToIndices(cell)

        // Ensure sheet has enough rows and columns
        while (sheet.data.length <= row) {
          sheet.data.push([])
        }
        while (sheet.data[row].length <= col) {
          sheet.data[row].push("")
        }

        // Evaluate the formula
        const result = evaluateFormula(formula, workbook, params.sheetId)
        sheet.data[row][col] = result

        return {
          success: true,
          message: `Formula ${formula} applied to cell ${cell}, result: ${result}`,
          updatedWorkbook: workbook,
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to apply formula: ${error instanceof Error ? error.message : "Unknown error"}`,
        }
      }
    }

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}
