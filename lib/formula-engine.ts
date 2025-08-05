import type { Workbook, Cell } from "@/types/workbook"

// Helper function to convert Excel-style cell reference to row/col indices
function cellToIndices(cell: string): { row: number; col: number } {
  // Handle absolute references by removing $ signs
  const cleanCell = cell.replace(/\$/g, '')
  const match = cleanCell.match(/^([A-Z]+)(\d+)$/)
  if (!match) throw new Error(`Invalid cell reference: ${cell}`)
  
  const colStr = match[1]
  const rowStr = match[2]
  
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  col -= 1 // Convert to 0-based
  
  const row = parseInt(rowStr) - 1 // Convert to 0-based
  
  return { row, col }
}

// Helper function to parse sheet references like 'Purchase Analysis'.B6 or SheetName.B6
function parseSheetReference(sheetRef: string, workbook: Workbook): { targetSheetId: string | null; cellRef: string } {
  let sheetName: string
  let cellRef: string
  
  // Handle quoted sheet names like 'Purchase Analysis'.B6
  if (sheetRef.includes("'")) {
    const match = sheetRef.match(/^'([^']+)'\.(.+)$/)
    if (!match) return { targetSheetId: null, cellRef: '' }
    sheetName = match[1]
    cellRef = match[2]
  } else {
    // Handle unquoted sheet names like SheetName.B6
    const parts = sheetRef.split('.')
    if (parts.length !== 2) return { targetSheetId: null, cellRef: '' }
    sheetName = parts[0]
    cellRef = parts[1]
  }
  
  // Find the sheet by name
  const targetSheet = workbook.sheets.find(sheet => sheet.name === sheetName)
  return {
    targetSheetId: targetSheet?.id || null,
    cellRef: cellRef
  }
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

// Get cell values from a range (evaluates formulas)
function getCellValues(workbook: Workbook, sheetId: string, range: { startRow: number; startCol: number; endRow: number; endCol: number }): number[] {
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (!sheet) return []

  const values: number[] = []
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      const cell = sheet.data[row]?.[col]
      if (!cell) continue
      
      let cellValue = cell.value
      
      // If cell has a formula, evaluate it
      if (cell.formula) {
        try {
          cellValue = evaluateFormula(cell.formula, workbook, sheetId)
        } catch {
          cellValue = cell.value // Fallback to stored value
        }
      }
      
      // Convert to number if possible
      if (typeof cellValue === "number") {
        values.push(cellValue)
      } else if (typeof cellValue === "string") {
        const num = Number.parseFloat(cellValue)
        if (!isNaN(num)) values.push(num)
      }
    }
  }
  return values
}

// Get cell value by reference (evaluates formulas recursively with circular reference protection)
function getCellValue(workbook: Workbook, sheetId: string, cellRef: string, evaluatingCells: Set<string> = new Set()): any {
  try {
    const { row, col } = cellToIndices(cellRef)
    const sheet = workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return 0
    
    const cell = sheet.data[row]?.[col]
    if (!cell) return 0
    
    // If this cell is already being evaluated, we have a circular reference
    const cellKey = `${sheetId}:${cellRef}`
    if (evaluatingCells.has(cellKey)) {
      return "#CIRCULAR!"
    }
    
    // If the cell has a formula, evaluate it
    if (cell.formula) {
      evaluatingCells.add(cellKey)
      try {
        const result = evaluateFormula(cell.formula, workbook, sheetId, row, col, evaluatingCells)
        evaluatingCells.delete(cellKey)
        return result
      } catch (error) {
        evaluatingCells.delete(cellKey)
        return "#ERROR!"
      }
    }
    
    return cell.value || 0
  } catch {
    return 0
  }
}

// Convert value to number for calculations with enhanced $ and % support
function toNumber(value: any): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    // Remove currency symbols, commas, and spaces
    let cleanValue = value.replace(/[$,\s]/g, '')
    
    // Handle percentages - convert to decimal
    if (cleanValue.endsWith('%')) {
      const percentNum = Number.parseFloat(cleanValue.slice(0, -1))
      return isNaN(percentNum) ? 0 : percentNum / 100
    }
    
    const num = Number.parseFloat(cleanValue)
    return isNaN(num) ? 0 : num
  }
  return 0
}

// Convert value to string
function toString(value: any): string {
  if (value === null || value === undefined) return ""
  return String(value)
}

// Parse function arguments from string like "A1,B2,5" with proper quote and parentheses handling
function parseArguments(argsStr: string): string[] {
  const args: string[] = []
  let current = ""
  let parenCount = 0
  let inQuotes = false
  
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i]
    
    // Handle quote state
    if (char === '"' && (i === 0 || argsStr[i-1] !== '\\')) {
      inQuotes = !inQuotes
    }
    
    if (!inQuotes) {
      if (char === "(") parenCount++
      if (char === ")") parenCount--
      
      if (char === "," && parenCount === 0) {
        args.push(current.trim())
        current = ""
        continue
      }
    }
    
    current += char
  }
  
  if (current.trim()) args.push(current.trim())
  
  return args
}

// Enhanced formula evaluator with comprehensive Excel functions
export function evaluateFormula(formula: string, workbook: Workbook, sheetId: string, currentRow?: number, currentCol?: number, evaluatingCells?: Set<string>): any {
  if (!formula || !formula.startsWith('=')) {
    return formula // Return as-is if not a formula
  }
  
  const expr = formula.substring(1).trim() // Remove =
  
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (!sheet) return "#REF!"

  try {
    const result = evaluateExpression(expr, workbook, sheetId, evaluatingCells)
    
    // Handle special return values
    if (result === null || result === undefined) {
      return 0
    }
    
    return result
  } catch (error) {
    console.error("Formula evaluation error for:", formula, error)
    return "#ERROR!"
  }
}

function evaluateExpression(expr: string, workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): any {
  // Handle function calls - only if the entire expression is a single function
  const functionMatch = expr.match(/^([A-Z]+)\(/)
  if (functionMatch) {
    const funcName = functionMatch[1]
    const funcStart = 0
    const argsStart = funcName.length + 1
    
    // Find the matching closing parenthesis for this function
    let parenCount = 1
    let pos = argsStart
    
    while (pos < expr.length && parenCount > 0) {
      if (expr[pos] === '(') parenCount++
      else if (expr[pos] === ')') parenCount--
      pos++
    }
    
    // Check if this function call spans the entire expression
    if (parenCount === 0 && pos === expr.length) {
      const argsStr = expr.substring(argsStart, pos - 1)
      return evaluateFunction(funcName, argsStr, workbook, sheetId, evaluatingCells)
    }
  }

  // Handle string concatenation with & operator
  if (expr.includes('&')) {
    return evaluateStringConcatenation(expr, workbook, sheetId, evaluatingCells)
  }

  // Handle cell references and simple expressions
  let result = expr

  // First, replace function calls within the expression
  // Use a helper function to properly match function calls with balanced parentheses
  result = replaceFunctionCalls(result, workbook, sheetId, evaluatingCells)

  // Replace cell references with their values more carefully
  // Handle cross-sheet references first (e.g., 'Sheet Name'.B6 or SheetName.B6)
  const sheetRefs = result.match(/'[^']+'\.\$?[A-Z]+\$?\d+|[A-Za-z][A-Za-z0-9_]*\.\$?[A-Z]+\$?\d+/g) || []
  for (const sheetRef of sheetRefs) {
    const { targetSheetId, cellRef } = parseSheetReference(sheetRef, workbook)
    if (targetSheetId) {
      const cellValue = getCellValue(workbook, targetSheetId, cellRef, evaluatingCells)
      
      // If the cell value is an error, propagate it
      if (typeof cellValue === 'string' && cellValue.startsWith('#')) {
        return cellValue
      }
      
      const numValue = toNumber(cellValue)
      let replacementValue: string
      
      // Always use the clean numeric value to avoid issues with currency symbols and commas
      if (isNaN(numValue)) {
        replacementValue = '0'
      } else {
        replacementValue = String(numValue)
      }
      
      // Escape special regex characters in the sheet reference
      const escapedSheetRef = sheetRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp('\\b' + escapedSheetRef + '\\b', 'g'), replacementValue)
    } else {
      // Sheet not found, replace with #REF! error
      const escapedSheetRef = sheetRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp('\\b' + escapedSheetRef + '\\b', 'g'), '#REF!')
    }
  }
  
  // Then handle regular cell references within current sheet
  // Regex to handle all Excel reference formats: $B$16, $B16, B$16, B16  
  const cellRefs = result.match(/\$?[A-Z]+\$?\d+/g) || []
  for (const cellRef of cellRefs) {
    const cellValue = getCellValue(workbook, sheetId, cellRef, evaluatingCells)
    
    // If the cell value is an error, propagate it
    if (typeof cellValue === 'string' && cellValue.startsWith('#')) {
      return cellValue
    }
    
    // Convert to number and always use the clean numeric value for replacement
    const numValue = toNumber(cellValue)
    let replacementValue: string
    
    // Always use the clean numeric value to avoid issues with currency symbols and commas
    if (isNaN(numValue)) {
      replacementValue = '0'
    } else {
      replacementValue = String(numValue)
    }
    
    // Replace each occurrence individually to avoid issues with similar cell refs
    // Escape dollar signs in the regex since they're special regex characters
    const escapedCellRef = cellRef.replace(/\$/g, '\\$')
    result = result.replace(new RegExp('\\b' + escapedCellRef + '\\b', 'g'), replacementValue)
  }

  // Handle quoted strings
  if (/^".*"$/.test(result.trim())) {
    return result.trim().slice(1, -1) // Remove quotes
  }

  // Handle currency values like $123.45
  if (/^\$\d+(\.\d+)?$/.test(result.trim())) {
    return parseFloat(result.trim().replace('$', ''))
  }

  // Handle percentage values like 25%
  if (/^\d+(\.\d+)?%$/.test(result.trim())) {
    const percentValue = parseFloat(result.trim().replace('%', ''))
    return percentValue / 100
  }

  // If result is just a number after substitution, return it directly
  if (/^-?\d+(\.\d+)?$/.test(result.trim())) {
    return parseFloat(result.trim())
  }

  // If result is a simple value (not an arithmetic expression), return it as-is
  if (!/[+\-*/()^]/.test(result.trim())) {
    // Check if it's a number, currency, or percentage
    const trimmed = result.trim()
    
    // Try parsing as currency
    if (trimmed.startsWith('$')) {
      const num = parseFloat(trimmed.replace(/[$,]/g, ''))
      if (!isNaN(num)) return num
    }
    
    // Try parsing as percentage
    if (trimmed.endsWith('%')) {
      const num = parseFloat(trimmed.replace('%', ''))
      if (!isNaN(num)) return num / 100
    }
    
    // Try parsing as regular number
    const num = parseFloat(trimmed)
    if (!isNaN(num)) {
      return num
    }
    
    // Otherwise return as string
    return trimmed
  }

  // Safe arithmetic evaluation (avoid eval)
  const arithmeticResult = evaluateArithmetic(result)
  return arithmeticResult
}

// Handle string concatenation with & operator
function evaluateStringConcatenation(expr: string, workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): string {
  // Split by & operator, but be careful about & inside function calls or quotes
  const parts = smartSplit(expr, '&')
  
  let result = ""
  for (const part of parts) {
    const trimmedPart = part.trim()
    if (!trimmedPart) continue
    
    const partResult = evaluateExpression(trimmedPart, workbook, sheetId, evaluatingCells)
    
    // Convert result to string for concatenation
    if (typeof partResult === 'string' && partResult.startsWith('#')) {
      return partResult // Return error if any part is an error
    }
    
    result += toString(partResult)
  }
  
  return result
}

// Helper function to replace function calls with proper parentheses handling
function replaceFunctionCalls(expr: string, workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): string {
  let result = expr
  let changed = true
  
  // Keep replacing functions until no more changes
  while (changed) {
    changed = false
    let i = 0
    
    while (i < result.length) {
      // Look for function names (uppercase letters followed by opening parenthesis)
      const remaining = result.substring(i)
      const funcMatch = remaining.match(/^([A-Z]+)\(/)
      
      if (funcMatch) {
        const funcName = funcMatch[1]
        const funcStart = i
        const argsStart = i + funcName.length + 1 // Position after the opening parenthesis
        
        // Find the matching closing parenthesis
        let parenCount = 1
        let pos = argsStart
        
        while (pos < result.length && parenCount > 0) {
          if (result[pos] === '(') parenCount++
          else if (result[pos] === ')') parenCount--
          pos++
        }
        
        if (parenCount === 0) {
          // Found matching parenthesis
          const argsEnd = pos - 1
          const funcEnd = pos
          const argsStr = result.substring(argsStart, argsEnd)
          const fullMatch = result.substring(funcStart, funcEnd)
          
          try {
            const funcResult = evaluateFunction(funcName, argsStr, workbook, sheetId, evaluatingCells)
            const replacement = String(toNumber(funcResult))
            result = result.substring(0, funcStart) + replacement + result.substring(funcEnd)
            changed = true
            break // Start over after making a change
          } catch (error) {
            console.error(`Function evaluation error for ${fullMatch}:`, error)
            const replacement = "#ERROR!"
            result = result.substring(0, funcStart) + replacement + result.substring(funcEnd)
            changed = true
            break // Start over after making a change
          }
        } else {
          // Unmatched parentheses, move to next character
          i++
        }
      } else {
        i++
      }
    }
  }
  
  return result
}

// Smart split function that respects parentheses and quotes
function smartSplit(expr: string, delimiter: string): string[] {
  const parts: string[] = []
  let current = ""
  let parenCount = 0
  let inQuotes = false
  
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i]
    
    if (char === '"' && (i === 0 || expr[i-1] !== '\\')) {
      inQuotes = !inQuotes
    }
    
    if (!inQuotes) {
      if (char === '(') parenCount++
      if (char === ')') parenCount--
      
      if (char === delimiter && parenCount === 0) {
        parts.push(current)
        current = ""
        continue
      }
    }
    
    current += char
  }
  
  if (current) parts.push(current)
  return parts
}

function evaluateArithmetic(expr: string): number | string {
  // Remove whitespace
  expr = expr.replace(/\s+/g, '')
  
  // Handle simple cases first
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return parseFloat(expr)
  }
  
  // Handle empty expression
  if (!expr) {
    return 0
  }
  
  // Clean up number formatting before evaluation
  // Handle currency symbols - remove $ and commas from numbers like $1,234.56
  expr = expr.replace(/\$([0-9,]+(\.\d+)?)/g, (match, number) => {
    return number.replace(/,/g, '')
  })
  
  // Handle standalone currency values without operators (e.g., just "$100")
  expr = expr.replace(/^\$([0-9,]+(\.\d+)?)$/, (match, number) => {
    return number.replace(/,/g, '')
  })
  
  // Convert percentages to decimals (20% -> 0.20, 15.5% -> 0.155)
  expr = expr.replace(/(\d+(\.\d+)?)\s*%/g, (match, number) => {
    return String(parseFloat(number) / 100)
  })
  
  // Handle standalone percentage values (e.g., just "20%")
  expr = expr.replace(/^(\d+(\.\d+)?)\s*%$/, (match, number) => {
    return String(parseFloat(number) / 100)
  })
  
  // Convert Excel-style ^ exponentiation to JavaScript ** exponentiation
  expr = expr.replace(/\^/g, '**')
  
  // Validate only contains allowed characters for arithmetic expressions
  // Allow digits, operators (+, -, *, /, **), decimal points, parentheses, currency ($), percentage (%), and commas
  if (!/^[\d+\-*/.()$%, ]*$/.test(expr)) {
    return "#ERROR!"
  }

  // Use Function constructor for safer evaluation with better error handling
  try {
    // Add extra validation for balanced parentheses
    let parenCount = 0
    for (const char of expr) {
      if (char === '(') parenCount++
      if (char === ')') parenCount--
      if (parenCount < 0) return "#ERROR!" // Unbalanced parentheses
    }
    if (parenCount !== 0) return "#ERROR!" // Unbalanced parentheses
    
    const result = new Function('return ' + expr)()
    if (typeof result !== 'number') {
      return "#ERROR!"
    }
    if (!isFinite(result)) {
      if (result === Infinity || result === -Infinity) {
        return "#DIV/0!"
      }
      return "#NUM!"
    }
    return result
  } catch (error) {
    console.error("Arithmetic evaluation failed for:", expr, error)
    return "#ERROR!"
  }
}

function evaluateFunction(funcName: string, argsStr: string, workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): any {
  const args = parseArguments(argsStr)

  switch (funcName) {
    // STATISTICAL FUNCTIONS
    case "SUM":
      return sumFunction(args, workbook, sheetId)
    
    case "AVERAGE":
      return averageFunction(args, workbook, sheetId)
    
    case "COUNT":
      return countFunction(args, workbook, sheetId)
    
    case "COUNTA":
      return countAFunction(args, workbook, sheetId)
    
    case "MAX":
      return maxFunction(args, workbook, sheetId)
    
    case "MIN":
      return minFunction(args, workbook, sheetId)
    
    case "STDEV":
    case "STDEV.S":
      return stdevFunction(args, workbook, sheetId)
    
    case "VAR":
    case "VAR.S":
      return varFunction(args, workbook, sheetId)

    // LOGICAL FUNCTIONS
    case "IF":
      return ifFunction(args, workbook, sheetId, evaluatingCells)
    
    case "AND":
      return andFunction(args, workbook, sheetId, evaluatingCells)
    
    case "OR":
      return orFunction(args, workbook, sheetId, evaluatingCells)
    
    case "NOT":
      return notFunction(args, workbook, sheetId, evaluatingCells)

    // LOOKUP FUNCTIONS
    case "VLOOKUP":
      return vlookupFunction(args, workbook, sheetId)
    
    case "HLOOKUP":
      return hlookupFunction(args, workbook, sheetId)
    
    case "INDEX":
      return indexFunction(args, workbook, sheetId)
    
    case "MATCH":
      return matchFunction(args, workbook, sheetId)

    // FINANCIAL FUNCTIONS
    case "NPV":
      return npvFunction(args, workbook, sheetId, evaluatingCells)
    
    case "IRR":
      return irrFunction(args, workbook, sheetId, evaluatingCells)
    
    case "PMT":
      return pmtFunction(args, workbook, sheetId, evaluatingCells)
    
    case "PV":
      return pvFunction(args, workbook, sheetId, evaluatingCells)
    
    case "FV":
      return fvFunction(args, workbook, sheetId, evaluatingCells)

    // DATE/TIME FUNCTIONS
    case "TODAY":
      return todayFunction()
    
    case "NOW":
      return nowFunction()
    
    case "DATE":
      return dateFunction(args, workbook, sheetId)
    
    case "YEAR":
      return yearFunction(args, workbook, sheetId)
    
    case "MONTH":
      return monthFunction(args, workbook, sheetId)
    
    case "DAY":
      return dayFunction(args, workbook, sheetId)

    // TEXT FUNCTIONS
    case "CONCATENATE":
      return concatenateFunction(args, workbook, sheetId)
    
    case "LEFT":
      return leftFunction(args, workbook, sheetId)
    
    case "RIGHT":
      return rightFunction(args, workbook, sheetId)
    
    case "MID":
      return midFunction(args, workbook, sheetId)
    
    case "LEN":
      return lenFunction(args, workbook, sheetId)
    
    case "UPPER":
      return upperFunction(args, workbook, sheetId)
    
    case "LOWER":
      return lowerFunction(args, workbook, sheetId)
    
    case "TRIM":
      return trimFunction(args, workbook, sheetId)

    // CONDITIONAL FUNCTIONS
    case "SUMIF":
      return sumIfFunction(args, workbook, sheetId)
    
    case "COUNTIF":
      return countIfFunction(args, workbook, sheetId)
    
    case "AVERAGEIF":
      return averageIfFunction(args, workbook, sheetId)

    // MATH FUNCTIONS
    case "ROUND":
      return roundFunction(args, workbook, sheetId)
    
    case "ROUNDUP":
      return roundUpFunction(args, workbook, sheetId)
    
    case "ROUNDDOWN":
      return roundDownFunction(args, workbook, sheetId)
    
    case "ABS":
      return absFunction(args, workbook, sheetId)
    
    case "SQRT":
      return sqrtFunction(args, workbook, sheetId)
    
    case "POWER":
      return powerFunction(args, workbook, sheetId, evaluatingCells)

    // REFERENCE FUNCTIONS
    case "ROW":
      return rowFunction(args, workbook, sheetId, evaluatingCells)
    
    case "COLUMN":
      return columnFunction(args, workbook, sheetId, evaluatingCells)
    
    case "INDIRECT":
      return indirectFunction(args, workbook, sheetId, evaluatingCells)

    default:
      throw new Error(`Unknown function: ${funcName}`)
  }
}

// STATISTICAL FUNCTION IMPLEMENTATIONS

function sumFunction(args: string[], workbook: Workbook, sheetId: string): number {
  let sum = 0
  for (const arg of args) {
    if (arg.includes(":")) {
      // Range
      const range = parseRange(arg)
      const values = getCellValues(workbook, sheetId, range)
      sum += values.reduce((a, b) => a + b, 0)
    } else {
      // Single value or cell
      const value = arg.match(/[A-Z]+\d+/) ? getCellValue(workbook, sheetId, arg) : parseFloat(arg)
      sum += toNumber(value)
    }
  }
  return sum
}

function averageFunction(args: string[], workbook: Workbook, sheetId: string): number {
  let sum = 0
  let count = 0
  for (const arg of args) {
    if (arg.includes(":")) {
      const range = parseRange(arg)
      const values = getCellValues(workbook, sheetId, range)
      sum += values.reduce((a, b) => a + b, 0)
      count += values.length
    } else {
      const value = arg.match(/[A-Z]+\d+/) ? getCellValue(workbook, sheetId, arg) : parseFloat(arg)
      if (!isNaN(toNumber(value))) {
        sum += toNumber(value)
        count++
      }
    }
  }
  return count > 0 ? sum / count : 0
}

function countFunction(args: string[], workbook: Workbook, sheetId: string): number {
  let count = 0
  for (const arg of args) {
    if (arg.includes(":")) {
      const range = parseRange(arg)
      count += getCellValues(workbook, sheetId, range).length
    } else {
      const value = arg.match(/[A-Z]+\d+/) ? getCellValue(workbook, sheetId, arg) : parseFloat(arg)
      if (!isNaN(toNumber(value))) count++
    }
  }
  return count
}

function countAFunction(args: string[], workbook: Workbook, sheetId: string): number {
  let count = 0
  for (const arg of args) {
    if (arg.includes(":")) {
      const range = parseRange(arg)
      const sheet = workbook.sheets.find((s) => s.id === sheetId)
      if (!sheet) continue
      
      for (let row = range.startRow; row <= range.endRow; row++) {
        for (let col = range.startCol; col <= range.endCol; col++) {
          const cell = sheet.data[row]?.[col]
          if (cell?.value !== null && cell?.value !== undefined && cell?.value !== "") {
            count++
          }
        }
      }
    } else {
      const value = arg.match(/[A-Z]+\d+/) ? getCellValue(workbook, sheetId, arg) : arg
      if (value !== null && value !== undefined && value !== "") count++
    }
  }
  return count
}

function maxFunction(args: string[], workbook: Workbook, sheetId: string): number {
  let max = -Infinity
  for (const arg of args) {
    if (arg.includes(":")) {
      const range = parseRange(arg)
      const values = getCellValues(workbook, sheetId, range)
      if (values.length > 0) {
        max = Math.max(max, Math.max(...values))
      }
    } else {
      const value = arg.match(/[A-Z]+\d+/) ? getCellValue(workbook, sheetId, arg) : parseFloat(arg)
      max = Math.max(max, toNumber(value))
    }
  }
  return max === -Infinity ? 0 : max
}

function minFunction(args: string[], workbook: Workbook, sheetId: string): number {
  let min = Infinity
  for (const arg of args) {
    if (arg.includes(":")) {
      const range = parseRange(arg)
      const values = getCellValues(workbook, sheetId, range)
      if (values.length > 0) {
        min = Math.min(min, Math.min(...values))
      }
    } else {
      const value = arg.match(/[A-Z]+\d+/) ? getCellValue(workbook, sheetId, arg) : parseFloat(arg)
      min = Math.min(min, toNumber(value))
    }
  }
  return min === Infinity ? 0 : min
}

function stdevFunction(args: string[], workbook: Workbook, sheetId: string): number {
  const values: number[] = []
  for (const arg of args) {
    if (arg.includes(":")) {
      const range = parseRange(arg)
      values.push(...getCellValues(workbook, sheetId, range))
    } else {
      const value = arg.match(/[A-Z]+\d+/) ? getCellValue(workbook, sheetId, arg) : parseFloat(arg)
      if (!isNaN(toNumber(value))) values.push(toNumber(value))
    }
  }
  
  if (values.length < 2) return 0
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function varFunction(args: string[], workbook: Workbook, sheetId: string): number {
  const stdev = stdevFunction(args, workbook, sheetId)
  return stdev * stdev
}

// LOGICAL FUNCTION IMPLEMENTATIONS

function ifFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): any {
  if (args.length < 2) throw new Error("IF requires at least 2 arguments")
  
  const condition = evaluateCondition(args[0], workbook, sheetId, evaluatingCells)
  const trueValue = args[1] ? evaluateExpression(args[1], workbook, sheetId, evaluatingCells) : true
  const falseValue = args[2] ? evaluateExpression(args[2], workbook, sheetId, evaluatingCells) : false
  
  return condition ? trueValue : falseValue
}

// Helper function to evaluate conditions with comparison operators
function evaluateCondition(expr: string, workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): boolean {
  // Handle comparison operators
  const comparisonOps = ['>=', '<=', '<>', '!=', '=', '>', '<']
  
  for (const op of comparisonOps) {
    if (expr.includes(op)) {
      const parts = expr.split(op)
      if (parts.length === 2) {
        const left = evaluateExpression(parts[0].trim(), workbook, sheetId, evaluatingCells)
        const right = evaluateExpression(parts[1].trim(), workbook, sheetId, evaluatingCells)
        
        // If either side is an error, return false
        if (typeof left === 'string' && left.startsWith('#') ||
            typeof right === 'string' && right.startsWith('#')) {
          return false
        }
        
        switch (op) {
          case '>=': return toNumber(left) >= toNumber(right)
          case '<=': return toNumber(left) <= toNumber(right)
          case '<>':
          case '!=': return left !== right
          case '=': return left === right
          case '>': return toNumber(left) > toNumber(right)
          case '<': return toNumber(left) < toNumber(right)
        }
      }
    }
  }
  
  // If no comparison operator, evaluate as boolean
  const result = evaluateExpression(expr, workbook, sheetId, evaluatingCells)
  
  // If result is an error, return false
  if (typeof result === 'string' && result.startsWith('#')) {
    return false
  }
  
  return Boolean(result)
}

function andFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): boolean {
  for (const arg of args) {
    const value = evaluateExpression(arg, workbook, sheetId, evaluatingCells)
    if (!value) return false
  }
  return true
}

function orFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): boolean {
  for (const arg of args) {
    const value = evaluateExpression(arg, workbook, sheetId, evaluatingCells)
    if (value) return true
  }
  return false
}

function notFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): boolean {
  if (args.length !== 1) throw new Error("NOT requires exactly 1 argument")
  const value = evaluateExpression(args[0], workbook, sheetId, evaluatingCells)
  return !value
}

// LOOKUP FUNCTION IMPLEMENTATIONS

function vlookupFunction(args: string[], workbook: Workbook, sheetId: string): any {
  if (args.length < 3) throw new Error("VLOOKUP requires at least 3 arguments")
  
  const lookupValue = evaluateExpression(args[0], workbook, sheetId)
  const tableRange = parseRange(args[1])
  const colIndex = parseInt(args[2]) - 1 // Convert to 0-based
  const exactMatch = args[3] ? evaluateExpression(args[3], workbook, sheetId) : false
  
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (!sheet) return "#N/A"
  
  // Search in the first column of the range
  for (let row = tableRange.startRow; row <= tableRange.endRow; row++) {
    const cellValue = sheet.data[row]?.[tableRange.startCol]?.value
    if (cellValue === lookupValue || (!exactMatch && toString(cellValue).toLowerCase().includes(toString(lookupValue).toLowerCase()))) {
      const returnCol = tableRange.startCol + colIndex
      if (returnCol <= tableRange.endCol) {
        return sheet.data[row]?.[returnCol]?.value || ""
      }
    }
  }
  
  return "#N/A"
}

function hlookupFunction(args: string[], workbook: Workbook, sheetId: string): any {
  if (args.length < 3) throw new Error("HLOOKUP requires at least 3 arguments")
  
  const lookupValue = evaluateExpression(args[0], workbook, sheetId)
  const tableRange = parseRange(args[1])
  const rowIndex = parseInt(args[2]) - 1 // Convert to 0-based
  const exactMatch = args[3] ? evaluateExpression(args[3], workbook, sheetId) : false
  
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (!sheet) return "#N/A"
  
  // Search in the first row of the range
  for (let col = tableRange.startCol; col <= tableRange.endCol; col++) {
    const cellValue = sheet.data[tableRange.startRow]?.[col]?.value
    if (cellValue === lookupValue || (!exactMatch && toString(cellValue).toLowerCase().includes(toString(lookupValue).toLowerCase()))) {
      const returnRow = tableRange.startRow + rowIndex
      if (returnRow <= tableRange.endRow) {
        return sheet.data[returnRow]?.[col]?.value || ""
      }
    }
  }
  
  return "#N/A"
}

function indexFunction(args: string[], workbook: Workbook, sheetId: string): any {
  if (args.length < 2) throw new Error("INDEX requires at least 2 arguments")
  
  try {
    const range = parseRange(args[0])
    const rowNumResult = evaluateExpression(args[1], workbook, sheetId)
    
    // Handle error in row number
    if (typeof rowNumResult === 'string' && rowNumResult.startsWith('#')) {
      return rowNumResult
    }
    
    const rowNum = toNumber(rowNumResult) - 1 // Convert to 0-based
    const colNum = args[2] ? toNumber(evaluateExpression(args[2], workbook, sheetId)) - 1 : 0 // Convert to 0-based
    
    const sheet = workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return "#REF!"
    
    // Validate row and column bounds
    if (rowNum < 0 || colNum < 0) {
      return "#REF!"
    }
    
    const targetRow = range.startRow + rowNum
    const targetCol = range.startCol + colNum
    
    // Check if target is within range bounds
    if (targetRow <= range.endRow && targetCol <= range.endCol && 
        targetRow >= range.startRow && targetCol >= range.startCol) {
      
      // Get the cell value, evaluating formula if present
      const cell = sheet.data[targetRow]?.[targetCol]
      if (cell?.formula) {
        return evaluateFormula(cell.formula, workbook, sheetId)
      }
      return cell?.value || ""
    }
    
    return "#REF!"
  } catch (error) {
    return "#REF!"
  }
}

function matchFunction(args: string[], workbook: Workbook, sheetId: string): number | string {
  if (args.length < 2) throw new Error("MATCH requires at least 2 arguments")
  
  try {
    const lookupValue = evaluateExpression(args[0], workbook, sheetId)
    
    // Handle error in lookup value
    if (typeof lookupValue === 'string' && lookupValue.startsWith('#')) {
      return lookupValue
    }
    
    const range = parseRange(args[1])
    // const matchType = args[2] ? parseInt(args[2]) : 1 // TODO: implement match types
    
    const sheet = workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return "#N/A"
    
    // Helper function to get evaluated cell value
    const getEvaluatedCellValue = (row: number, col: number) => {
      const cell = sheet.data[row]?.[col]
      if (cell?.formula) {
        try {
          return evaluateFormula(cell.formula, workbook, sheetId)
        } catch {
          return cell.value
        }
      }
      return cell?.value
    }
    
    // Helper function to compare values (handles number/string conversion)
    const valuesMatch = (cellVal: any, lookupVal: any) => {
      if (cellVal === lookupVal) return true
      
      // Try numeric comparison
      const cellNum = toNumber(cellVal)
      const lookupNum = toNumber(lookupVal)
      if (!isNaN(cellNum) && !isNaN(lookupNum)) {
        return cellNum === lookupNum
      }
      
      // Try string comparison
      return toString(cellVal) === toString(lookupVal)
    }
    
    // Check if it's a row or column range
    if (range.startRow === range.endRow) {
      // Row range (horizontal)
      for (let col = range.startCol; col <= range.endCol; col++) {
        const cellValue = getEvaluatedCellValue(range.startRow, col)
        if (valuesMatch(cellValue, lookupValue)) {
          return col - range.startCol + 1 // 1-based position
        }
      }
    } else if (range.startCol === range.endCol) {
      // Column range (vertical)
      for (let row = range.startRow; row <= range.endRow; row++) {
        const cellValue = getEvaluatedCellValue(row, range.startCol)
        if (valuesMatch(cellValue, lookupValue)) {
          return row - range.startRow + 1 // 1-based position
        }
      }
    } else {
      // Multi-dimensional range - treat as column-first search
      for (let row = range.startRow; row <= range.endRow; row++) {
        const cellValue = getEvaluatedCellValue(row, range.startCol)
        if (valuesMatch(cellValue, lookupValue)) {
          return row - range.startRow + 1 // 1-based position
        }
      }
    }
    
    return "#N/A"
  } catch (error) {
    return "#N/A"
  }
}

// FINANCIAL FUNCTION IMPLEMENTATIONS

function npvFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number {
  if (args.length < 2) throw new Error("NPV requires at least 2 arguments")
  
  const rate = toNumber(evaluateExpression(args[0], workbook, sheetId, evaluatingCells))
  let npv = 0
  
  for (let i = 1; i < args.length; i++) {
    const value = toNumber(evaluateExpression(args[i], workbook, sheetId, evaluatingCells))
    npv += value / Math.pow(1 + rate, i)
  }
  
  return npv
}

function irrFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number | string {
  // IRR calculation using Newton-Raphson method
  const values: number[] = []
  
  for (const arg of args) {
    if (arg.includes(":")) {
      const range = parseRange(arg)
      values.push(...getCellValues(workbook, sheetId, range))
    } else {
      const value = toNumber(evaluateExpression(arg, workbook, sheetId, evaluatingCells))
      values.push(value)
    }
  }
  
  if (values.length < 2) return "#NUM!"
  
  // Newton-Raphson iteration
  let rate = 0.1 // Initial guess
  for (let i = 0; i < 100; i++) {
    let npv = 0
    let dnpv = 0
    
    for (let j = 0; j < values.length; j++) {
      const power = Math.pow(1 + rate, j)
      npv += values[j] / power
      dnpv -= j * values[j] / (power * (1 + rate))
    }
    
    if (Math.abs(npv) < 1e-6) return rate
    
    rate = rate - npv / dnpv
  }
  
  return "#NUM!"
}

function pmtFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number {
  if (args.length < 3) throw new Error("PMT requires at least 3 arguments")
  
  const rate = toNumber(evaluateExpression(args[0], workbook, sheetId, evaluatingCells))
  const nper = toNumber(evaluateExpression(args[1], workbook, sheetId, evaluatingCells))
  const pv = toNumber(evaluateExpression(args[2], workbook, sheetId, evaluatingCells))
  const fv = args[3] ? toNumber(evaluateExpression(args[3], workbook, sheetId, evaluatingCells)) : 0
  const type = args[4] ? toNumber(evaluateExpression(args[4], workbook, sheetId, evaluatingCells)) : 0
  
  if (rate === 0) {
    return -(pv + fv) / nper
  }
  
  const pvif = Math.pow(1 + rate, nper)
  return (-pv * pvif - fv) / (((pvif - 1) / rate) * (1 + rate * type))
}

function pvFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number {
  if (args.length < 3) throw new Error("PV requires at least 3 arguments")
  
  const rate = toNumber(evaluateExpression(args[0], workbook, sheetId, evaluatingCells))
  const nper = toNumber(evaluateExpression(args[1], workbook, sheetId, evaluatingCells))
  const pmt = toNumber(evaluateExpression(args[2], workbook, sheetId, evaluatingCells))
  const fv = args[3] ? toNumber(evaluateExpression(args[3], workbook, sheetId, evaluatingCells)) : 0
  const type = args[4] ? toNumber(evaluateExpression(args[4], workbook, sheetId, evaluatingCells)) : 0
  
  if (rate === 0) {
    return -pmt * nper - fv
  }
  
  const pvif = Math.pow(1 + rate, nper)
  return (-pmt * (((pvif - 1) / rate) * (1 + rate * type)) - fv) / pvif
}

function fvFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number {
  if (args.length < 3) throw new Error("FV requires at least 3 arguments")
  
  const rate = toNumber(evaluateExpression(args[0], workbook, sheetId, evaluatingCells))
  const nper = toNumber(evaluateExpression(args[1], workbook, sheetId, evaluatingCells))
  const pmt = toNumber(evaluateExpression(args[2], workbook, sheetId, evaluatingCells))
  const pv = args[3] ? toNumber(evaluateExpression(args[3], workbook, sheetId, evaluatingCells)) : 0
  const type = args[4] ? toNumber(evaluateExpression(args[4], workbook, sheetId, evaluatingCells)) : 0
  
  if (rate === 0) {
    return -pv - pmt * nper
  }
  
  const fvif = Math.pow(1 + rate, nper)
  return -pv * fvif - pmt * (((fvif - 1) / rate) * (1 + rate * type))
}

// DATE/TIME FUNCTION IMPLEMENTATIONS

function todayFunction(): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 2
}

function nowFunction(): number {
  const now = new Date()
  return Math.floor((now.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 2 + 
         (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / (24 * 3600)
}

function dateFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 3) throw new Error("DATE requires exactly 3 arguments")
  
  const year = toNumber(evaluateExpression(args[0], workbook, sheetId))
  const month = toNumber(evaluateExpression(args[1], workbook, sheetId))
  const day = toNumber(evaluateExpression(args[2], workbook, sheetId))
  
  const date = new Date(year, month - 1, day)
  return Math.floor((date.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 2
}

function yearFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 1) throw new Error("YEAR requires exactly 1 argument")
  
  const serialNumber = toNumber(evaluateExpression(args[0], workbook, sheetId))
  const date = new Date(1900, 0, serialNumber - 1)
  return date.getFullYear()
}

function monthFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 1) throw new Error("MONTH requires exactly 1 argument")
  
  const serialNumber = toNumber(evaluateExpression(args[0], workbook, sheetId))
  const date = new Date(1900, 0, serialNumber - 1)
  return date.getMonth() + 1
}

function dayFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 1) throw new Error("DAY requires exactly 1 argument")
  
  const serialNumber = toNumber(evaluateExpression(args[0], workbook, sheetId))
  const date = new Date(1900, 0, serialNumber - 1)
  return date.getDate()
}

// TEXT FUNCTION IMPLEMENTATIONS

function concatenateFunction(args: string[], workbook: Workbook, sheetId: string): string {
  return args.map(arg => toString(evaluateExpression(arg, workbook, sheetId))).join("")
}

function leftFunction(args: string[], workbook: Workbook, sheetId: string): string {
  if (args.length < 1) throw new Error("LEFT requires at least 1 argument")
  
  const text = toString(evaluateExpression(args[0], workbook, sheetId))
  const numChars = args[1] ? toNumber(evaluateExpression(args[1], workbook, sheetId)) : 1
  
  return text.substring(0, numChars)
}

function rightFunction(args: string[], workbook: Workbook, sheetId: string): string {
  if (args.length < 1) throw new Error("RIGHT requires at least 1 argument")
  
  const text = toString(evaluateExpression(args[0], workbook, sheetId))
  const numChars = args[1] ? toNumber(evaluateExpression(args[1], workbook, sheetId)) : 1
  
  return text.substring(Math.max(0, text.length - numChars))
}

function midFunction(args: string[], workbook: Workbook, sheetId: string): string {
  if (args.length < 2) throw new Error("MID requires at least 2 arguments")
  
  const text = toString(evaluateExpression(args[0], workbook, sheetId))
  const startNum = toNumber(evaluateExpression(args[1], workbook, sheetId)) - 1 // Convert to 0-based
  const numChars = args[2] ? toNumber(evaluateExpression(args[2], workbook, sheetId)) : text.length
  
  return text.substring(startNum, startNum + numChars)
}

function lenFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 1) throw new Error("LEN requires exactly 1 argument")
  
  const text = toString(evaluateExpression(args[0], workbook, sheetId))
  return text.length
}

function upperFunction(args: string[], workbook: Workbook, sheetId: string): string {
  if (args.length !== 1) throw new Error("UPPER requires exactly 1 argument")
  
  const text = toString(evaluateExpression(args[0], workbook, sheetId))
  return text.toUpperCase()
}

function lowerFunction(args: string[], workbook: Workbook, sheetId: string): string {
  if (args.length !== 1) throw new Error("LOWER requires exactly 1 argument")
  
  const text = toString(evaluateExpression(args[0], workbook, sheetId))
  return text.toLowerCase()
}

function trimFunction(args: string[], workbook: Workbook, sheetId: string): string {
  if (args.length !== 1) throw new Error("TRIM requires exactly 1 argument")
  
  const text = toString(evaluateExpression(args[0], workbook, sheetId))
  return text.trim().replace(/\s+/g, ' ')
}

// CONDITIONAL FUNCTION IMPLEMENTATIONS

function sumIfFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length < 2) throw new Error("SUMIF requires at least 2 arguments")
  
  const range = parseRange(args[0])
  const criteria = evaluateExpression(args[1], workbook, sheetId)
  const sumRange = args[2] ? parseRange(args[2]) : range
  
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (!sheet) return 0
  
  let sum = 0
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      const cellValue = sheet.data[row]?.[col]?.value
      if (meetsCriteria(cellValue, criteria)) {
        const sumRow = sumRange.startRow + (row - range.startRow)
        const sumCol = sumRange.startCol + (col - range.startCol)
        const sumValue = sheet.data[sumRow]?.[sumCol]?.value
        sum += toNumber(sumValue)
      }
    }
  }
  
  return sum
}

function countIfFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 2) throw new Error("COUNTIF requires exactly 2 arguments")
  
  const range = parseRange(args[0])
  const criteria = evaluateExpression(args[1], workbook, sheetId)
  
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (!sheet) return 0
  
  let count = 0
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      const cellValue = sheet.data[row]?.[col]?.value
      if (meetsCriteria(cellValue, criteria)) {
        count++
      }
    }
  }
  
  return count
}

function averageIfFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length < 2) throw new Error("AVERAGEIF requires at least 2 arguments")
  
  const range = parseRange(args[0])
  const criteria = evaluateExpression(args[1], workbook, sheetId)
  const averageRange = args[2] ? parseRange(args[2]) : range
  
  const sheet = workbook.sheets.find((s) => s.id === sheetId)
  if (!sheet) return 0
  
  let sum = 0
  let count = 0
  
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      const cellValue = sheet.data[row]?.[col]?.value
      if (meetsCriteria(cellValue, criteria)) {
        const avgRow = averageRange.startRow + (row - range.startRow)
        const avgCol = averageRange.startCol + (col - range.startCol)
        const avgValue = sheet.data[avgRow]?.[avgCol]?.value
        sum += toNumber(avgValue)
        count++
      }
    }
  }
  
  return count > 0 ? sum / count : 0
}

// MATH FUNCTION IMPLEMENTATIONS

function roundFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length < 1) throw new Error("ROUND requires at least 1 argument")
  
  const number = toNumber(evaluateExpression(args[0], workbook, sheetId))
  const digits = args[1] ? toNumber(evaluateExpression(args[1], workbook, sheetId)) : 0
  
  const factor = Math.pow(10, digits)
  return Math.round(number * factor) / factor
}

function roundUpFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length < 1) throw new Error("ROUNDUP requires at least 1 argument")
  
  const number = toNumber(evaluateExpression(args[0], workbook, sheetId))
  const digits = args[1] ? toNumber(evaluateExpression(args[1], workbook, sheetId)) : 0
  
  const factor = Math.pow(10, digits)
  return Math.ceil(number * factor) / factor
}

function roundDownFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length < 1) throw new Error("ROUNDDOWN requires at least 1 argument")
  
  const number = toNumber(evaluateExpression(args[0], workbook, sheetId))
  const digits = args[1] ? toNumber(evaluateExpression(args[1], workbook, sheetId)) : 0
  
  const factor = Math.pow(10, digits)
  return Math.floor(number * factor) / factor
}

function absFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 1) throw new Error("ABS requires exactly 1 argument")
  
  const number = toNumber(evaluateExpression(args[0], workbook, sheetId))
  return Math.abs(number)
}

function sqrtFunction(args: string[], workbook: Workbook, sheetId: string): number {
  if (args.length !== 1) throw new Error("SQRT requires exactly 1 argument")
  
  const number = toNumber(evaluateExpression(args[0], workbook, sheetId))
  return Math.sqrt(number)
}

function powerFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number {
  if (args.length !== 2) throw new Error("POWER requires exactly 2 arguments")
  
  const number = toNumber(evaluateExpression(args[0], workbook, sheetId, evaluatingCells))
  const power = toNumber(evaluateExpression(args[1], workbook, sheetId, evaluatingCells))
  
  return Math.pow(number, power)
}

// REFERENCE FUNCTION IMPLEMENTATIONS

function rowFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number | string {
  if (args.length === 0) {
    // ROW() without arguments - need to get current cell position
    // This is a limitation - we don't have context of which cell is calling this
    // For now, return 1 as default
    return 1
  }
  
  // ROW(reference) - return the row number of the reference
  const cellRef = args[0].trim()
  try {
    const { row } = cellToIndices(cellRef)
    return row + 1 // Convert back to 1-based
  } catch {
    return "#REF!"
  }
}

function columnFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): number | string {
  if (args.length === 0) {
    // COLUMN() without arguments - need to get current cell position
    // This is a limitation - we don't have context of which cell is calling this
    // For now, return 1 as default
    return 1
  }
  
  // COLUMN(reference) - return the column number of the reference
  const cellRef = args[0].trim()
  try {
    const { col } = cellToIndices(cellRef)
    return col + 1 // Convert back to 1-based
  } catch {
    return "#REF!"
  }
}

function indirectFunction(args: string[], workbook: Workbook, sheetId: string, evaluatingCells?: Set<string>): any {
  if (args.length === 0) return "#REF!"
  
  const refText = toString(evaluateExpression(args[0], workbook, sheetId, evaluatingCells))
  
  try {
    // Handle sheet references in INDIRECT
    if (refText.includes("'") || refText.includes(".")) {
      const { targetSheetId, cellRef } = parseSheetReference(refText, workbook)
      if (targetSheetId) {
        return getCellValue(workbook, targetSheetId, cellRef, evaluatingCells)
      } else {
        return "#REF!"
      }
    } else {
      // Simple cell reference
      return getCellValue(workbook, sheetId, refText, evaluatingCells)
    }
  } catch {
    return "#REF!"
  }
}

// Helper function for conditional criteria
function meetsCriteria(cellValue: any, criteria: any): boolean {
  const cellStr = toString(cellValue).toLowerCase()
  const criteriaStr = toString(criteria)
  
  // Handle comparison operators
  if (criteriaStr.startsWith(">=")) {
    return toNumber(cellValue) >= toNumber(criteriaStr.substring(2))
  } else if (criteriaStr.startsWith("<=")) {
    return toNumber(cellValue) <= toNumber(criteriaStr.substring(2))
  } else if (criteriaStr.startsWith(">")) {
    return toNumber(cellValue) > toNumber(criteriaStr.substring(1))
  } else if (criteriaStr.startsWith("<")) {
    return toNumber(cellValue) < toNumber(criteriaStr.substring(1))
  } else if (criteriaStr.startsWith("=")) {
    return cellValue === criteriaStr.substring(1)
  } else if (criteriaStr.startsWith("*")) {
    return cellStr.endsWith(criteriaStr.substring(1).toLowerCase())
  } else if (criteriaStr.endsWith("*")) {
    return cellStr.startsWith(criteriaStr.substring(0, criteriaStr.length - 1).toLowerCase())
  } else {
    return cellValue === criteria
  }
}