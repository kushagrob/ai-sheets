import type { NextRequest } from "next/server"
import * as XLSX from "xlsx"
import Papa from "papaparse"

export default async function handler(req: NextRequest) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const filename = file.name.toLowerCase()

    if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: "array" })
      const sheets = []

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          raw: false,
        }) as any[][]

        sheets.push({
          id: `sheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: sheetName,
          data: data,
        })
      }

      return Response.json({
        success: true,
        workbook: {
          id: `wb-${Date.now()}`,
          name: file.name,
          sheets: sheets,
        },
      })
    } else if (filename.endsWith(".csv")) {
      // Parse CSV file
      const text = new TextDecoder().decode(buffer)

      return new Promise((resolve) => {
        Papa.parse(text, {
          complete: (results) => {
            const sheet = {
              id: `sheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: "Sheet1",
              data: results.data as any[][],
            }

            resolve(
              Response.json({
                success: true,
                workbook: {
                  id: `wb-${Date.now()}`,
                  name: file.name,
                  sheets: [sheet],
                },
              }),
            )
          },
          error: (error) => {
            resolve(
              Response.json(
                {
                  success: false,
                  error: `CSV parsing error: ${error.message}`,
                },
                { status: 400 },
              ),
            )
          },
        })
      })
    } else {
      return Response.json(
        {
          success: false,
          error: "Unsupported file type. Please upload .xlsx, .xls, or .csv files.",
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("File parsing error:", error)
    return Response.json(
      {
        success: false,
        error: "Failed to parse file",
      },
      { status: 500 },
    )
  }
}

export const config = {
  runtime: "edge",
}
