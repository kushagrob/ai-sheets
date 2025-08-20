export interface CellPosition {
  row: number
  col: number
}

export interface CellBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewportInfo {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
  offsetX: number
  offsetY: number
}

export interface CanvasGridConfig {
  cellWidth: number
  cellHeight: number
  headerHeight: number
  headerWidth: number
  fontSize: number
  fontFamily: string
  gridLineColor: string
  headerBackgroundColor: string
  selectedCellColor: string
  selectedRangeColor: string
}

export const DEFAULT_GRID_CONFIG: CanvasGridConfig = {
  cellWidth: 100,
  cellHeight: 24,
  headerHeight: 24,
  headerWidth: 48,
  fontSize: 12,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  gridLineColor: '#d1d5db',
  headerBackgroundColor: '#f3f4f6',
  selectedCellColor: '#dbeafe',
  selectedRangeColor: '#bfdbfe'
}

export class CanvasGridRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: CanvasGridConfig
  private pixelRatio: number

  constructor(canvas: HTMLCanvasElement, config: CanvasGridConfig = DEFAULT_GRID_CONFIG) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.config = config
    this.pixelRatio = window.devicePixelRatio || 1
    this.setupCanvas()
  }

  private setupCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width * this.pixelRatio
    this.canvas.height = rect.height * this.pixelRatio
    this.ctx.scale(this.pixelRatio, this.pixelRatio)
    this.canvas.style.width = rect.width + 'px'
    this.canvas.style.height = rect.height + 'px'
  }

  getViewport(scrollLeft: number, scrollTop: number, canvasWidth: number, canvasHeight: number): ViewportInfo {
    const startCol = Math.floor(Math.max(0, scrollLeft - this.config.headerWidth) / this.config.cellWidth)
    const endCol = Math.ceil((scrollLeft + canvasWidth - this.config.headerWidth) / this.config.cellWidth)
    const startRow = Math.floor(Math.max(0, scrollTop - this.config.headerHeight) / this.config.cellHeight)
    const endRow = Math.ceil((scrollTop + canvasHeight - this.config.headerHeight) / this.config.cellHeight)

    return {
      startRow: Math.max(0, startRow),
      endRow: Math.min(49, endRow), // Max 50 rows
      startCol: Math.max(0, startCol),
      endCol: Math.min(51, endCol), // Max 52 columns
      offsetX: scrollLeft,
      offsetY: scrollTop
    }
  }

  getCellBounds(row: number, col: number, scrollLeft: number = 0, scrollTop: number = 0): CellBounds {
    return {
      x: this.config.headerWidth + col * this.config.cellWidth - scrollLeft,
      y: this.config.headerHeight + row * this.config.cellHeight - scrollTop,
      width: this.config.cellWidth,
      height: this.config.cellHeight
    }
  }

  getCellFromPoint(x: number, y: number, scrollLeft: number = 0, scrollTop: number = 0): CellPosition | null {
    if (x < this.config.headerWidth || y < this.config.headerHeight) {
      return null
    }

    const col = Math.floor((x - this.config.headerWidth + scrollLeft) / this.config.cellWidth)
    const row = Math.floor((y - this.config.headerHeight + scrollTop) / this.config.cellHeight)

    if (col < 0 || col > 51 || row < 0 || row > 49) {
      return null
    }

    return { row, col }
  }

  getColumnHeader(index: number): string {
    let result = ""
    let num = index
    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26) - 1
      if (num < 0) break
    }
    return result
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width / this.pixelRatio, this.canvas.height / this.pixelRatio)
  }

  drawGrid(viewport: ViewportInfo) {
    this.ctx.strokeStyle = this.config.gridLineColor
    this.ctx.lineWidth = 1

    for (let col = viewport.startCol; col <= viewport.endCol + 1; col++) {
      const x = this.config.headerWidth + col * this.config.cellWidth - viewport.offsetX
      this.ctx.beginPath()
      this.ctx.moveTo(x, 0)
      this.ctx.lineTo(x, this.canvas.height / this.pixelRatio)
      this.ctx.stroke()
    }

    for (let row = viewport.startRow; row <= viewport.endRow + 1; row++) {
      const y = this.config.headerHeight + row * this.config.cellHeight - viewport.offsetY
      this.ctx.beginPath()
      this.ctx.moveTo(0, y)
      this.ctx.lineTo(this.canvas.width / this.pixelRatio, y)
      this.ctx.stroke()
    }
  }

  drawHeaders(viewport: ViewportInfo) {
    this.ctx.fillStyle = this.config.headerBackgroundColor
    this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'

    this.ctx.fillRect(this.config.headerWidth - viewport.offsetX, 0, 
                     (viewport.endCol - viewport.startCol + 1) * this.config.cellWidth, 
                     this.config.headerHeight)
    
    this.ctx.fillStyle = '#000'
    for (let col = viewport.startCol; col <= viewport.endCol; col++) {
      const x = this.config.headerWidth + col * this.config.cellWidth + this.config.cellWidth / 2 - viewport.offsetX
      const y = this.config.headerHeight / 2
      this.ctx.fillText(this.getColumnHeader(col), x, y)
    }

    this.ctx.fillStyle = this.config.headerBackgroundColor
    this.ctx.fillRect(0, this.config.headerHeight - viewport.offsetY, 
                     this.config.headerWidth, 
                     (viewport.endRow - viewport.startRow + 1) * this.config.cellHeight)
    
    this.ctx.fillStyle = '#000'
    for (let row = viewport.startRow; row <= viewport.endRow; row++) {
      const x = this.config.headerWidth / 2
      const y = this.config.headerHeight + row * this.config.cellHeight + this.config.cellHeight / 2 - viewport.offsetY
      this.ctx.fillText((row + 1).toString(), x, y)
    }

    this.ctx.fillStyle = this.config.headerBackgroundColor
    this.ctx.fillRect(0, 0, this.config.headerWidth, this.config.headerHeight)
  }

  drawCellContent(row: number, col: number, content: string, viewport: ViewportInfo) {
    const bounds = this.getCellBounds(row, col, viewport.offsetX, viewport.offsetY)
    
    if (bounds.x + bounds.width < 0 || bounds.x > this.canvas.width / this.pixelRatio ||
        bounds.y + bounds.height < 0 || bounds.y > this.canvas.height / this.pixelRatio) {
      return
    }

    this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`
    this.ctx.fillStyle = '#000'
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'middle'

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2)
    this.ctx.clip()

    const textY = bounds.y + bounds.height / 2
    const textX = bounds.x + 4 // Small padding from left edge

    this.ctx.fillText(content, textX, textY)
    this.ctx.restore()
  }

  drawSelection(selectedCell: CellPosition, selectedRange: any, viewport: ViewportInfo) {
    if (selectedRange) {
      this.ctx.fillStyle = this.config.selectedRangeColor
      const startBounds = this.getCellBounds(selectedRange.startRow, selectedRange.startCol, viewport.offsetX, viewport.offsetY)
      const endBounds = this.getCellBounds(selectedRange.endRow, selectedRange.endCol, viewport.offsetX, viewport.offsetY)
      
      const x = Math.min(startBounds.x, endBounds.x)
      const y = Math.min(startBounds.y, endBounds.y)
      const width = Math.max(startBounds.x + startBounds.width, endBounds.x + endBounds.width) - x
      const height = Math.max(startBounds.y + startBounds.height, endBounds.y + endBounds.height) - y
      
      this.ctx.fillRect(x, y, width, height)
    } else {
      this.ctx.fillStyle = this.config.selectedCellColor
      const bounds = this.getCellBounds(selectedCell.row, selectedCell.col, viewport.offsetX, viewport.offsetY)
      this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    }

    this.ctx.strokeStyle = '#3b82f6'
    this.ctx.lineWidth = 2
    const bounds = this.getCellBounds(selectedCell.row, selectedCell.col, viewport.offsetX, viewport.offsetY)
    this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  }

  render(data: any[][], selectedCell: CellPosition, selectedRange: any, viewport: ViewportInfo, getCellDisplayValue: (cell: any) => string) {
    this.clear()
    
    this.drawGrid(viewport)
    
    this.drawHeaders(viewport)
    
    for (let row = viewport.startRow; row <= viewport.endRow; row++) {
      for (let col = viewport.startCol; col <= viewport.endCol; col++) {
        const cell = data[row]?.[col]
        const content = getCellDisplayValue(cell)
        if (content && content.trim() !== '') {
          this.drawCellContent(row, col, content, viewport)
        }
      }
    }
    
    this.drawSelection(selectedCell, selectedRange, viewport)
  }
}
