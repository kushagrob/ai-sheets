import { tool } from 'ai';
import { z } from 'zod';
import { executeSpreadsheetTool } from './agent';
import { Workbook } from '@/types/workbook';

export function createSpreadsheetTools(workbook: Workbook) {
  return {
    setData: tool({
      description: 'Set the data for a specific cell or range of cells. Use for raw values, not formulas.',
      inputSchema: z.object({
        sheetId: z.string().describe('The ID of the sheet to modify.'),
        range: z.string().describe('The cell range, e.g., "A1" or "B2:D10".'),
        data: z.array(z.array(z.any())).describe('A 2D array of data to set.'),
      }),
      execute: async (params) => {
        return executeSpreadsheetTool('setData', params, workbook);
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
        return executeSpreadsheetTool('applyFormula', params, workbook);
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
  };
}