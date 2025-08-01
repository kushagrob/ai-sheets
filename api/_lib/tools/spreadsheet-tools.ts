import { z } from "zod"

export const spreadsheetTools = {
  setData: {
    description: "Set the data for a specific cell or range of cells. Use for raw values, not formulas.",
    parameters: z.object({
      sheetId: z.string().describe("The ID of the sheet to modify."),
      range: z.string().describe('The cell range, e.g., "A1" or "B2:D10".'),
      data: z.array(z.array(z.any())).describe("A 2D array of data to set."),
    }),
  },

  applyFormula: {
    description: "Apply an Excel-style formula to a cell.",
    parameters: z.object({
      sheetId: z.string(),
      cell: z.string().describe('The single cell to apply the formula to, e.g., "C5".'),
      formula: z.string().describe('The formula string, e.g., "=SUM(A1:B10)".'),
    }),
  },

  insertRows: {
    description: "Insert new rows at a specific position.",
    parameters: z.object({
      sheetId: z.string(),
      rowIndex: z.number().describe("The row index to insert at (0-based)."),
      count: z.number().default(1).describe("Number of rows to insert."),
    }),
  },

  insertColumns: {
    description: "Insert new columns at a specific position.",
    parameters: z.object({
      sheetId: z.string(),
      columnIndex: z.number().describe("The column index to insert at (0-based)."),
      count: z.number().default(1).describe("Number of columns to insert."),
    }),
  },

  deleteRows: {
    description: "Delete rows from the sheet.",
    parameters: z.object({
      sheetId: z.string(),
      startRow: z.number().describe("Starting row index (0-based)."),
      count: z.number().default(1).describe("Number of rows to delete."),
    }),
  },

  deleteColumns: {
    description: "Delete columns from the sheet.",
    parameters: z.object({
      sheetId: z.string(),
      startColumn: z.number().describe("Starting column index (0-based)."),
      count: z.number().default(1).describe("Number of columns to delete."),
    }),
  },
}
