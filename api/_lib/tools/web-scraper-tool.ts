import { z } from "zod"
import * as cheerio from "cheerio"

export const webScraperTool = {
  description: "Scrapes tabular data from a given URL. Returns a 2D array of the table data.",
  parameters: z.object({
    url: z.string().url().describe("The URL to scrape data from."),
    tableSelector: z.string().optional().describe('CSS selector for the table (optional, defaults to "table").'),
  }),
}

export async function scrapeWebpage(url: string, tableSelector = "table") {
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SpreadsheetBot/1.0)",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Find tables
    const tables = $(tableSelector)

    if (tables.length === 0) {
      return {
        success: false,
        error: "No tables found on the webpage",
        data: [],
      }
    }

    // Extract data from the first table
    const tableData: any[][] = []

    tables
      .first()
      .find("tr")
      .each((_, row) => {
        const rowData: any[] = []
        $(row)
          .find("td, th")
          .each((_, cell) => {
            const cellText = $(cell).text().trim()
            // Try to parse as number if it looks like one
            const numValue = Number.parseFloat(cellText.replace(/[,$%]/g, ""))
            rowData.push(isNaN(numValue) ? cellText : numValue)
          })
        if (rowData.length > 0) {
          tableData.push(rowData)
        }
      })

    return {
      success: true,
      data: tableData,
      rowCount: tableData.length,
      columnCount: tableData[0]?.length || 0,
      url,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      data: [],
    }
  }
}
