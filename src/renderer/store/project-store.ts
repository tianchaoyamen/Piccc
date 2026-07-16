import { create } from 'zustand'

import { createEmptyGrid, generateId } from '../utils/grid-utils'
import type {
  ProjectData,
  GridCell,
  REnvironment,
  ExportSettings,
} from '../types/project'

interface ProjectState {
  currentProject: ProjectData | null
  filePath: string | null
  isDirty: boolean
  rEnvironment: REnvironment
  selectedCellId: string | null
  isLoading: boolean

  createProject: (
    rows: number,
    cols: number,
    mergedCells?: Array<{ row: number; col: number; rowSpan: number; colSpan: number }>
  ) => void
  loadProject: (data: ProjectData, filePath: string) => void
  saveProject: (newPath?: string) => void
  updateCell: (cellId: string, updates: Partial<GridCell>) => void
  selectCell: (cellId: string | null) => void
  setREnvironment: (env: REnvironment) => void
  setGridSize: (rows: number, cols: number) => void
  updateExportSettings: (settings: Partial<ExportSettings>) => void
  setPageOrientation: (orientation: 'portrait' | 'landscape') => void
  setPageFormat: (format: 'a4' | 'ppt') => void
  setTheme: (theme: 'nature' | 'science' | 'cell' | 'ieee') => void
  switchProjectLayout: (rows: number, cols: number, cells: GridCell[]) => void
  swapCellContents: (cellIdA: string, cellIdB: string) => void
  updateGlobalSettings: (settings: Partial<ProjectData>) => void
  markDirty: () => void
  setLoading: (loading: boolean) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  filePath: null,
  isDirty: false,
  rEnvironment: { found: false, path: '', version: '' },
  selectedCellId: null,
  isLoading: false,

  createProject: (rows, cols, mergedCells) => {
    const now = new Date().toISOString()
    let cells: GridCell[]

    if (mergedCells && mergedCells.length > 0) {
      // Handle merged cells: first create merged ones, then fill remaining
      const occupied = new Set<string>()
      cells = []

      for (const mc of mergedCells) {
        cells.push({
          id: generateId(),
          row: mc.row,
          col: mc.col,
          rowSpan: mc.rowSpan,
          colSpan: mc.colSpan,
          title: null,
          note: null,
          content: { type: 'empty' },
        })
        for (let r = mc.row; r < mc.row + mc.rowSpan; r++) {
          for (let c = mc.col; c < mc.col + mc.colSpan; c++) {
            occupied.add(`${r},${c}`)
          }
        }
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!occupied.has(`${r},${c}`)) {
            cells.push({
              id: generateId(),
              row: r,
              col: c,
              rowSpan: 1,
              colSpan: 1,
              title: null,
              note: null,
              content: { type: 'empty' },
            })
          }
        }
      }
    } else {
      cells = createEmptyGrid(rows, cols)
    }

    const project: ProjectData = {
      version: '1.0.0',
      name: '未命名项目',
      created: now,
      modified: now,
      grid: {
        rows,
        cols,
        cells,
      },
      exportSettings: {
        defaultFormat: 'png',
        defaultDpi: 300,
      },
      pageOrientation: 'portrait',
      pageFormat: 'a4',
      theme: 'nature',
      globalChineseFont: 'Microsoft YaHei',
      globalWesternFont: '"Times New Roman"',
      globalTitleAlign: 'left',
      globalNoteAlign: 'center',
      globalAutoNumber: '123',
      gridGap: 12,
    }

    set({
      currentProject: project,
      filePath: null,
      isDirty: false,
      selectedCellId: null,
    })
  },

  loadProject: (data, filePath) => {
    // Add compatibility check for pageOrientation and global typography settings
    const project = {
      ...data,
      pageOrientation: data.pageOrientation || 'portrait',
      pageFormat: data.pageFormat || 'a4',
      theme: data.theme || 'nature',
      globalChineseFont: data.globalChineseFont || 'Microsoft YaHei',
      globalWesternFont: data.globalWesternFont || '"Times New Roman"',
      globalTitleAlign: data.globalTitleAlign || 'left',
      globalNoteAlign: data.globalNoteAlign || 'center',
      globalAutoNumber: data.globalAutoNumber || '123',
    }
    set({
      currentProject: project,
      filePath,
      isDirty: false,
      selectedCellId: null,
    })
  },

  saveProject: (newPath) => {
    const { currentProject } = get()
    if (!currentProject) return

    const updated: ProjectData = {
      ...currentProject,
      modified: new Date().toISOString(),
    }

    set({
      currentProject: updated,
      isDirty: false,
      filePath: newPath ?? get().filePath,
    })
  },

  updateCell: (cellId, updates) => {
    const { currentProject } = get()
    if (!currentProject) return

    const newCells = currentProject.grid.cells.map((cell) =>
      cell.id === cellId ? { ...cell, ...updates } : cell
    )

    set({
      currentProject: {
        ...currentProject,
        modified: new Date().toISOString(),
        grid: {
          ...currentProject.grid,
          cells: newCells,
        },
      },
      isDirty: true,
    })
  },

  selectCell: (cellId) => {
    set({ selectedCellId: cellId })
  },

  setREnvironment: (env) => {
    set({ rEnvironment: env })
  },

  setGridSize: (rows, cols) => {
    const { currentProject } = get()
    if (!currentProject) return

    const cells = createEmptyGrid(rows, cols)

    set({
      currentProject: {
        ...currentProject,
        modified: new Date().toISOString(),
        grid: { rows, cols, cells },
      },
      isDirty: true,
      selectedCellId: null,
    })
  },

  updateExportSettings: (settings) => {
    const { currentProject } = get()
    if (!currentProject) return

    set({
      currentProject: {
        ...currentProject,
        exportSettings: {
          ...currentProject.exportSettings,
          ...settings,
        },
      },
      isDirty: true,
    })
  },

  setPageOrientation: (orientation) => {
    const { currentProject } = get()
    if (!currentProject) return

    set({
      currentProject: {
        ...currentProject,
        pageOrientation: orientation,
      },
      isDirty: true,
    })
  },

  setPageFormat: (format) => {
    const { currentProject } = get()
    if (!currentProject) return

    set({
      currentProject: {
        ...currentProject,
        pageFormat: format,
      },
      isDirty: true,
    })
  },

  setTheme: (theme) => {
    const { currentProject } = get()
    if (!currentProject) return

    set({
      currentProject: {
        ...currentProject,
        theme,
      },
      isDirty: true,
    })
  },

  switchProjectLayout: (rows, cols, cells) => {
    const { currentProject } = get()
    if (!currentProject) return

    set({
      currentProject: {
        ...currentProject,
        modified: new Date().toISOString(),
        grid: {
          rows,
          cols,
          cells,
        },
        gridGap: 12,
      },
      isDirty: true,
      selectedCellId: null,
    })
  },

  swapCellContents: (cellIdA, cellIdB) => {
    const { currentProject } = get()
    if (!currentProject) return

    const cellA = currentProject.grid.cells.find((c) => c.id === cellIdA)
    const cellB = currentProject.grid.cells.find((c) => c.id === cellIdB)
    if (!cellA || !cellB) return

    const newCells = currentProject.grid.cells.map((cell) => {
      if (cell.id === cellIdA) {
        return {
          ...cell,
          title: cellB.title,
          note: cellB.note,
          content: cellB.content,
        }
      }
      if (cell.id === cellIdB) {
        return {
          ...cell,
          title: cellA.title,
          note: cellA.note,
          content: cellA.content,
        }
      }
      return cell
    })

    set({
      currentProject: {
        ...currentProject,
        modified: new Date().toISOString(),
        grid: {
          ...currentProject.grid,
          cells: newCells,
        },
      },
      isDirty: true,
    })
  },

  updateGlobalSettings: (settings) => {
    const { currentProject } = get()
    if (!currentProject) return

    set({
      currentProject: {
        ...currentProject,
        modified: new Date().toISOString(),
        ...settings,
      },
      isDirty: true,
    })
  },

  markDirty: () => {
    set({ isDirty: true })
  },

  setLoading: (loading) => {
    set({ isLoading: loading })
  },
}))
