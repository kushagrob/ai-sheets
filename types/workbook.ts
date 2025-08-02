export interface Cell {
  value: string | number | null
  formula?: string
}

export interface Sheet {
  id: string
  name: string
  data: Cell[][]
}

export interface Workbook {
  id: string
  name: string
  sheets: Sheet[]
}

export interface ChatMessage {
  type: "user" | "ai" | "status" | "table"
  content: string
}
