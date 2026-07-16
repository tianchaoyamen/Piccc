import type { GridCell, TemplateDefinition } from '../types/project'

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Creates an empty grid of cells with unique IDs.
 */
export function createEmptyGrid(rows: number, cols: number): GridCell[] {
  const cells: GridCell[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        id: generateId(),
        row,
        col,
        rowSpan: 1,
        colSpan: 1,
        title: null,
        note: null,
        content: { type: 'empty' },
      })
    }
  }
  return cells
}

/**
 * Creates a grid from a TemplateDefinition, handling merged cells.
 * Merged cells replace multiple individual cells with a single cell spanning rows/cols.
 */
export function createGridFromTemplate(template: TemplateDefinition): GridCell[] {
  const { rows, cols, mergedCells } = template

  // Start with all positions available
  const occupied = new Set<string>()
  const cells: GridCell[] = []

  // First, create merged cells
  if (mergedCells && mergedCells.length > 0) {
    for (const mc of mergedCells) {
      const cell: GridCell = {
        id: generateId(),
        row: mc.row,
        col: mc.col,
        rowSpan: mc.rowSpan,
        colSpan: mc.colSpan,
        title: null,
        note: null,
        content: { type: 'empty' },
      }
      cells.push(cell)

      // Mark all positions occupied by this merged cell
      for (let r = mc.row; r < mc.row + mc.rowSpan; r++) {
        for (let c = mc.col; c < mc.col + mc.colSpan; c++) {
          occupied.add(`${r},${c}`)
        }
      }
    }
  }

  // Then fill remaining positions with single cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!occupied.has(`${row},${col}`)) {
        cells.push({
          id: generateId(),
          row,
          col,
          rowSpan: 1,
          colSpan: 1,
          title: null,
          note: null,
          content: { type: 'empty' },
        })
      }
    }
  }

  return cells
}

/**
 * Find the cell at a given row/col position, considering spans.
 */
export function getCellAtPosition(
  cells: GridCell[],
  row: number,
  col: number
): GridCell | undefined {
  return cells.find((cell) => {
    const rowInRange = row >= cell.row && row < cell.row + cell.rowSpan
    const colInRange = col >= cell.col && col < cell.col + cell.colSpan
    return rowInRange && colInRange
  })
}

/**
 * Check if a grid position is occupied by any cell (considering spans).
 * Optionally exclude a specific cell by ID.
 */
export function isPositionOccupied(
  cells: GridCell[],
  row: number,
  col: number,
  excludeId?: string
): boolean {
  return cells.some((cell) => {
    if (excludeId && cell.id === excludeId) return false
    const rowInRange = row >= cell.row && row < cell.row + cell.rowSpan
    const colInRange = col >= cell.col && col < cell.col + cell.colSpan
    return rowInRange && colInRange
  })
}
