export type CellContentType = 'r_code' | 'image' | 'empty'

export interface TextStyle {
  bold?: boolean
  italic?: boolean
  fontSize?: number
  fontFamily?: string
}

export interface CellTitle {
  text: string
  style: TextStyle
}

export interface CellNote {
  text: string
  style: TextStyle
}

export interface ImageEdits {
  grayscale: boolean
  rotation: number
  crop: { x: number; y: number; width: number; height: number } | null
}

export interface RCodeContent {
  type: 'r_code'
  code: string
  cachedImageBase64: string | null
}

export interface ImageContent {
  type: 'image'
  originalPath: string
  edits: ImageEdits
}

export interface EmptyContent {
  type: 'empty'
}

export type CellContent = RCodeContent | ImageContent | EmptyContent

export interface GridCell {
  id: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
  title: CellTitle | null
  note: CellNote | null
  content: CellContent
}

export interface GridConfig {
  rows: number
  cols: number
  cells: GridCell[]
}

export interface ExportSettings {
  defaultFormat: 'png' | 'jpeg' | 'tiff'
  defaultDpi: 150 | 300
}

export interface ProjectData {
  version: string
  name: string
  created: string
  modified: string
  grid: GridConfig
  exportSettings: ExportSettings
  pageOrientation: 'portrait' | 'landscape'
  pageFormat?: 'a4' | 'ppt'
  theme?: 'nature' | 'science' | 'cell' | 'ieee'
  globalChineseFont?: string
  globalWesternFont?: string
  globalTitleAlign?: 'left' | 'center' | 'right'
  globalNoteAlign?: 'left' | 'center' | 'right'
  globalAutoNumber?: 'abc' | 'abc_lowercase' | '123' | 'roman' | 'manual'
  gridGap?: number
  defaultExportPath?: string
}

export interface REnvironment {
  found: boolean
  path: string
  version: string
}

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  rows: number
  cols: number
  icon: string
  mergedCells?: Array<{ row: number; col: number; rowSpan: number; colSpan: number }>
}

declare module 'utif' {
  export function encodeImage(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, metadata?: any): ArrayBuffer;
  export function encode(ifds: any[]): ArrayBuffer;
}
