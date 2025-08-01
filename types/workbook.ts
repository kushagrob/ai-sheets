export interface Sheet {
  id: string
  name: string
  data: (string | number)[][]
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
