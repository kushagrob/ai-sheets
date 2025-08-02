// Smart compression function for sheet data
function compressSheetData(data: any[][], maxChars: number = 8000): string {
  if (!data || data.length === 0) return "Sheet is empty"
  
  // Find actual data boundaries (ignore empty rows/columns)
  let maxRow = -1
  let maxCol = -1
  const nonEmptyCells: { row: number; col: number; cell: any }[] = []
  
  for (let row = 0; row < data.length; row++) {
    if (!data[row]) continue
    for (let col = 0; col < data[row].length; col++) {
      const cell = data[row][col]
      if (cell && (cell.value !== null && cell.value !== "" && cell.value !== undefined) || cell.formula) {
        nonEmptyCells.push({ row, col, cell })
        maxRow = Math.max(maxRow, row)
        maxCol = Math.max(maxCol, col)
      }
    }
  }
  
  if (nonEmptyCells.length === 0) return "Sheet contains no data"
  
  // Helper to convert column index to Excel notation (0=A, 1=B, etc.)
  const getColumnName = (col: number): string => {
    let result = ""
    let num = col
    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26) - 1
      if (num < 0) break
    }
    return result
  }
  
  // Create compact representation
  let result = `Data range: A1:${getColumnName(maxCol)}${maxRow + 1} (${nonEmptyCells.length} non-empty cells)\n`
  
  // Separate values and formulas for better readability
  const cellsWithValues: string[] = []
  const cellsWithFormulas: string[] = []
  
  for (const { row, col, cell } of nonEmptyCells) {
    const cellRef = `${getColumnName(col)}${row + 1}`
    
    if (cell.formula) {
      const value = cell.value !== null && cell.value !== undefined ? ` (=${cell.value})` : ""
      cellsWithFormulas.push(`${cellRef}: ${cell.formula}${value}`)
    } else {
      const displayValue = typeof cell.value === 'string' && cell.value.length > 50 
        ? `"${cell.value.substring(0, 47)}..."` 
        : JSON.stringify(cell.value)
      cellsWithValues.push(`${cellRef}: ${displayValue}`)
    }
  }
  
  // Add values section
  if (cellsWithValues.length > 0) {
    result += `\nValues: ${cellsWithValues.join(', ')}`
  }
  
  // Add formulas section (more important, so always include)
  if (cellsWithFormulas.length > 0) {
    result += `\nFormulas: ${cellsWithFormulas.join(', ')}`
  }
  
  // Truncate if too long, but preserve formulas
  if (result.length > maxChars) {
    if (cellsWithFormulas.length > 0) {
      // Prioritize formulas - keep all formulas and truncate values
      const formulaSection = `\nFormulas: ${cellsWithFormulas.join(', ')}`
      const availableForValues = maxChars - result.split('\nValues:')[0].length - formulaSection.length - 100
      
      if (cellsWithValues.length > 0 && availableForValues > 0) {
        let truncatedValues = ""
        let charCount = 0
        for (const value of cellsWithValues) {
          if (charCount + value.length + 2 > availableForValues) break
          truncatedValues += (truncatedValues ? ', ' : '') + value
          charCount += value.length + 2
        }
        result = result.split('\nValues:')[0] + `\nValues: ${truncatedValues}...` + formulaSection
      } else {
        result = result.split('\nValues:')[0] + formulaSection
      }
    } else {
      // No formulas, just truncate values
      result = result.substring(0, maxChars - 3) + "..."
    }
  }
  
  return result
}

export function createSystemPrompt(workbook: any, activeSheetId: string, selection?: string) {
  const activeSheet = workbook.sheets.find((sheet: any) => sheet.id === activeSheetId)
  const workbookOverview = workbook.sheets.map((sheet: any) => ({
    id: sheet.id,
    name: sheet.name
  }))
  
  // Use smart compression for sheet data
  const compressedSheetData = compressSheetData(activeSheet.data)

  return `You are an AI assistant for a spreadsheet application. You help users manipulate, analyze, and work with their spreadsheet data.

WORKBOOK CONTEXT:
- Workbook: "${workbook.name}"
- Total Sheets: ${workbook.sheets.length}
- All Sheets: ${workbookOverview.map((s: any) => `"${s.name}" (${s.id})`).join(', ')}
- Active Sheet: "${activeSheet.name}" (ID: ${activeSheetId})
- Selected Range: ${selection || "None"}
- Current Sheet Data: ${compressedSheetData}

AVAILABLE TOOLS:

EFFICIENT DATA TOOLS (Use these for better performance):
- setDataGrid - Set multiple cells at once using 2D array (much faster than individual setData calls)
- applyFormulaToRange - Apply formula patterns to multiple cells (e.g., "=C{ROW}-B{ROW}" for D5:D10)

BASIC DATA TOOLS (Use sparingly):
- setData - Set single cell values (numbers, text, etc.) - NEVER use for formulas
- applyFormula - Apply single formula to one cell (=SUM, =A1+B1, etc.) - ALWAYS use for formulas starting with =

SHEET MANAGEMENT TOOLS:
You have full sheet management capabilities! Use these tools actively:
- createSheet - Create new sheets for different purposes (e.g., "Analysis", "Summary")
- deleteSheet - Remove unwanted sheets (protects against deleting the last sheet)
- renameSheet - Give sheets meaningful names (e.g., rename "Sheet1" to something descriptive)
- copySheet - Duplicate sheets with data intact (useful for templates or monthly copies)
- listSheets - See all available sheets and their 

ORGANIZATION TOOLS:
- insertRows - Insert new rows at a specific position
- insertColumns - Insert new columns at a specific position
- deleteRows - Delete rows from the sheet
- deleteColumns - Delete columns from the sheet

UTILITY TOOLS:
- askForClarification - Ask the user a clarifying question if the request is ambiguous
- taskComplete - Signal that the current task is finished

EFFICIENCY GUIDELINES:
- Use setDataGrid instead of multiple setData calls (can set 20+ cells in one operation)
- Use applyFormulaToRange for similar formulas across ranges (like difference calculations)
- USE SHEET MANAGEMENT TOOLS to organize data across multiple sheets
- Batch similar operations together rather than alternating between different tool types

ENHANCED FORMULA ENGINE:
The spreadsheet now supports 40+ Excel functions including:

STATISTICAL: SUM, AVERAGE, COUNT, COUNTA, MAX, MIN, STDEV, VAR
LOGICAL: IF, AND, OR, NOT
LOOKUP: VLOOKUP, HLOOKUP, INDEX, MATCH
FINANCIAL: NPV, IRR, PMT, PV, FV
DATE/TIME: TODAY, NOW, DATE, YEAR, MONTH, DAY
TEXT: CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM
CONDITIONAL: SUMIF, COUNTIF, AVERAGEIF
MATH: ROUND, ROUNDUP, ROUNDDOWN, ABS, SQRT, POWER

CRITICAL: Formula vs Data:
- Use applyFormula/applyFormulaToRange for ANY expression starting with = (like =IF(A1>100,"High","Low"), =VLOOKUP(B2,D:F,2,FALSE), =NPV(0.1,C1:C5))
- Use setData/setDataGrid ONLY for static values (like numbers 100, 200 or text "Total")
- Complex formulas are now fully supported (financial modeling, conditional logic, lookups)
- This ensures calculated values display correctly instead of showing formula text

PERFORMANCE OPTIMIZATION EXAMPLES:
Instead of: Multiple setData + multiple applyFormula calls
Do this: setDataGrid for all static data, then applyFormulaToRange for calculations



SHEET HANDLING NOTES:
- When working with data, always specify the correct sheetId parameter
- The active sheet is "${activeSheet.name}" (ID: ${activeSheetId}) but you can operate on any sheet by ID
- ALWAYS use listSheets first to understand the workbook structure before creating new sheets
- When creating new sheets, use descriptive names that reflect their purpose
- Sheet operations will automatically update the workbook state and are immediately visible to users
- Use copySheet to duplicate templates or backup important data

IMPORTANT: You have powerful sheet management capabilities - USE THEM! Don't hesitate to create, rename, or organize sheets when it makes sense for the user's workflow.

Always prioritize efficient tools for better performance. If the user request is ambiguous, use askForClarification. When working across multiple sheets, be explicit about which sheet you're targeting.`
}