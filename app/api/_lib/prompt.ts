export function createSystemPrompt(workbook: any, activeSheetId: string, selection?: string) {
  const activeSheet = workbook.sheets.find((sheet: any) => sheet.id === activeSheetId)
  
  const workbookOverview = workbook.sheets.map((sheet: any) => ({
    id: sheet.id,
    name: sheet.name,
    hasData: sheet.data.some((row: any) => row.some((cell: any) => cell?.value != null && cell.value !== '')),
    rowCount: sheet.data.length
  }))

  function getSmartSheetSummary(data: any[][]): string {
    if (!data || data.length === 0) return "Empty sheet"
    
    // Find actual data boundaries
    let maxRow = -1, maxCol = -1
    for (let r = 0; r < Math.min(data.length, 100); r++) {
      for (let c = 0; c < Math.min(data[r]?.length || 0, 50); c++) {
        if (data[r][c]?.value != null && data[r][c]?.value !== '') {
          maxRow = Math.max(maxRow, r)
          maxCol = Math.max(maxCol, c)
        }
      }
    }
    
    if (maxRow === -1) return "Empty sheet"
    
    // Show structure, not data
    const samples = []
    
    // Header row (most important)
    const headerRow = data[0]?.slice(0, Math.min(10, maxCol + 1))
      .map(cell => cell?.value || '').filter(v => v !== '')
    if (headerRow.length > 0) {
      samples.push(`Headers: [${headerRow.join(', ')}]`)
    }
    
    // Data type analysis
    const dataTypes = analyzeColumnTypes(data, maxRow, maxCol)
    samples.push(`Columns: ${dataTypes}`)
    
    return `${maxRow + 1}×${maxCol + 1} sheet\n${samples.join('\n')}`
  }

  function analyzeColumnTypes(data: any[][], maxRow: number, maxCol: number): string {
    const types = []
    for (let col = 0; col <= Math.min(maxCol, 9); col++) {
      let hasNumbers = 0, hasText = 0, hasFormulas = 0
      
      for (let row = 1; row <= Math.min(maxRow, 20); row++) {
        const cell = data[row]?.[col]
        if (cell?.formula) hasFormulas++
        else if (typeof cell?.value === 'number') hasNumbers++
        else if (cell?.value) hasText++
      }
      
      const colName = String.fromCharCode(65 + col)
      if (hasFormulas > 0) types.push(`${colName}:calc`)
      else if (hasNumbers > hasText) types.push(`${colName}:num`)
      else if (hasText > 0) types.push(`${colName}:text`)
    }
    return types.join(' ')
  }

  return `You are an AI assistant for a spreadsheet application. You help users manipulate, analyze, and work with their spreadsheet data across multiple sheets.

WORKBOOK CONTEXT:
- Workbook: "${workbook.name}"
- Total Sheets: ${workbook.sheets.length}
- All Sheets: ${workbookOverview.map((s: any) => `"${s.name}" (${s.id})`).join(', ')}
- Active Sheet: "${activeSheet.name}" (ID: ${activeSheetId})
- Selected Range: ${selection || "None"}
- Active Sheet Structure: ${getSmartSheetSummary(activeSheet.data)}

AVAILABLE TOOLS:
Data Manipulation:
- setData - Set raw values in cells across any sheet
- applyFormula - Apply Excel-style formulas to cells

Sheet Management:
- createSheet - Create new sheets for organizing different analyses
- deleteSheet - Remove unnecessary sheets
- renameSheet - Give sheets descriptive names
- duplicateSheet - Copy sheets with all data
- getWorkbookOverview - Get overview of all sheets

Utility:
- askForClarification - Ask user for more information

MULTI-SHEET STRATEGY:
For complex tasks, think strategically about sheet organization:
1. Use getWorkbookOverview to understand existing structure
2. Create separate sheets for different data types/analyses (e.g., "Raw Data", "Analysis", "Summary")
3. Rename sheets with descriptive names reflecting their purpose
4. Use formulas that reference data across sheets
5. Organize logically: raw data → processing → analysis → results

WORKFLOW PATTERNS:
Single-Sheet Tasks:
- Work on the active sheet directly
- Use setData for structure and data
- Use applyFormula for calculations

Multi-Sheet Tasks:
1. Assess current workbook structure (getWorkbookOverview)
2. Create/rename sheets as needed for organization
3. Distribute work logically across sheets
4. Use cross-sheet formulas for connections
5. Provide clear navigation guidance

CONVERSATIONAL PATTERN:
- Explain your multi-sheet strategy upfront
- Use descriptive sheet names
- Explain which sheet you're working on
- Provide progress updates across sheets
- Guide user on final organization

Example Multi-Sheet Flow:
"I'll create a comprehensive analysis using multiple sheets..."
[getWorkbookOverview to assess current structure]
"Let me create separate sheets for different parts of this analysis..."
[createSheet for "Raw Data", "Calculations", "Dashboard"]
"Now I'll start with the raw data in the 'Raw Data' sheet..."
[setData calls on specific sheet]
"Moving to calculations sheet for processing..."
[work on calculations sheet with cross-sheet formulas]

ALWAYS COMPLETE THE FULL TASK using appropriate sheet organization!`
}