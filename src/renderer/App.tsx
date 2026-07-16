import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Button,
  Tooltip,
  Space,
  Tag,
  Typography,
  Input,
  InputNumber,
  Select,
  Radio,
  Empty,
  message,
  ConfigProvider,
  Modal,
  Switch,
  Slider,
} from 'antd'
import {
  PlusOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  ExportOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  PictureOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import { useProjectStore } from './store/project-store'
import { TEMPLATES } from './utils/template-data'
import { createGridFromTemplate } from './utils/grid-utils'
import type { GridCell, TemplateDefinition, CellContentType } from './types/project'
import RCodeEditor from './components/RCodeEditor'
import ImageCropModal from './components/ImageCropModal'
import ExportModal from './components/ExportModal'
import logoUrl from './assets/logo.png'

declare global {
  interface Window {
    picccAPI?: any
  }
}

const { Text } = Typography
const { TextArea } = Input

const getAntdTheme = (themeName: string) => {
  let primaryColor = '#1677ff'
  if (themeName === 'nature') primaryColor = '#007f4e'
  else if (themeName === 'science') primaryColor = '#b30000'
  else if (themeName === 'cell') primaryColor = '#e0533c'
  else if (themeName === 'ieee') primaryColor = '#005a9c'

  return {
    token: {
      colorPrimary: primaryColor,
      borderRadius: 8,
    },
  }
}

/* ─── Mini Grid Preview for Templates ─── */
function MiniGridPreview({ template }: { template: TemplateDefinition }) {
  const { rows, cols, mergedCells } = template

  // Build a lookup for merged cells
  const mergedMap = useMemo(() => {
    const map = new Map<string, { rowSpan: number; colSpan: number; isOrigin: boolean }>()
    if (mergedCells) {
      for (const mc of mergedCells) {
        for (let r = mc.row; r < mc.row + mc.rowSpan; r++) {
          for (let c = mc.col; c < mc.col + mc.colSpan; c++) {
            map.set(`${r},${c}`, {
              rowSpan: mc.rowSpan,
              colSpan: mc.colSpan,
              isOrigin: r === mc.row && c === mc.col,
            })
          }
        }
      }
    }
    return map
  }, [mergedCells, rows, cols])

  const gridItems: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`
      const merged = mergedMap.get(key)
      if (merged && !merged.isOrigin) continue // skip non-origin merged positions
      const style: React.CSSProperties = {
        gridRow: merged ? `${r + 1} / span ${merged.rowSpan}` : undefined,
        gridColumn: merged ? `${c + 1} / span ${merged.colSpan}` : undefined,
      }
      gridItems.push(
        <div
          key={key}
          className={`mini-cell ${merged ? 'mini-cell-merged' : ''}`}
          style={style}
        />
      )
    }
  }

  return (
    <div className="template-preview">
      <div
        className="mini-grid"
        style={{
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {gridItems}
      </div>
    </div>
  )
}

/* Helper for roman numerals */
function getRomanNumeral(num: number): string {
  const romanMap: Array<[number, string]> = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ]
  let result = ''
  let remaining = num
  for (const [val, char] of romanMap) {
    while (remaining >= val) {
      result += char
      remaining -= val
    }
  }
  return result
}

/* ─── Grid Cell Component ─── */
function GridCellView({
  cell,
  isSelected,
  onSelect,
}: {
  cell: GridCell
  isSelected: boolean
  onSelect: () => void
}) {
  const { currentProject, swapCellContents, updateCell } = useProjectStore()
  const hasContent = cell.content.type !== 'empty'
  const hasNote = cell.note && cell.note.text.trim().length > 0

  // Calculate cell sequence index for auto numbering
  const cellIndex = useMemo(() => {
    if (!currentProject) return -1
    const sorted = [...currentProject.grid.cells].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      return a.col - b.col
    })
    return sorted.findIndex((c) => c.id === cell.id)
  }, [currentProject?.grid.cells, cell.id])

  // Get auto-number prefix
  const prefix = useMemo(() => {
    if (cellIndex === -1 || !currentProject) return ''
    const mode = currentProject.globalAutoNumber || '123'
    if (mode === 'manual') return ''
    if (mode === 'abc') return String.fromCharCode(65 + cellIndex)
    if (mode === 'abc_lowercase') return String.fromCharCode(97 + cellIndex)
    if (mode === '123') return String(cellIndex + 1)
    if (mode === 'roman') return getRomanNumeral(cellIndex + 1)
    return ''
  }, [cellIndex, currentProject?.globalAutoNumber])

  const hasTitle = prefix.length > 0 || (cell.title && cell.title.text.trim().length > 0)
  const isDraggable = hasContent || hasTitle || hasNote

  // Fonts setup: combine Western and Chinese fonts
  const fontFam = useMemo(() => {
    const west = currentProject?.globalWesternFont || '"Times New Roman"'
    const chin = currentProject?.globalChineseFont || 'Microsoft YaHei'
    return `${west}, ${chin}, sans-serif`
  }, [currentProject?.globalWesternFont, currentProject?.globalChineseFont])

  const titleStyle: React.CSSProperties = {
    fontFamily: fontFam,
    fontSize: cell.title?.style?.fontSize ? `${cell.title.style.fontSize}px` : undefined,
    textAlign: cell.title?.style?.fontFamily ? undefined : (currentProject?.globalTitleAlign || 'left'),
  }

  const noteStyle: React.CSSProperties = {
    fontFamily: fontFam,
    fontSize: cell.note?.style?.fontSize ? `${cell.note.style.fontSize}px` : undefined,
    textAlign: cell.note?.style?.fontFamily ? undefined : (currentProject?.globalNoteAlign || 'center'),
  }

  const renderContent = () => {
    switch (cell.content.type) {
      case 'r_code':
        if (cell.content.cachedImageBase64) {
          return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img
                src={cell.content.cachedImageBase64}
                alt="R output"
                style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
              />
            </div>
          )
        }
        return (
          <CodeOutlined
            className={`cell-content-icon ${hasContent ? 'has-content' : ''}`}
          />
        )
      case 'image': {
        if (!cell.content.originalPath) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <PictureOutlined style={{ fontSize: '28px', marginBottom: '6px', color: 'var(--border)' }} />
              <span style={{ fontSize: '11px' }}>待导入图片</span>
            </div>
          )
        }
        const edits = cell.content.edits || { grayscale: false, rotation: 0, crop: null }
        const path = cell.content.originalPath.startsWith('file://')
          ? cell.content.originalPath
          : `file://${cell.content.originalPath}`

        const imgStyle: React.CSSProperties = {}
        const containerStyle: React.CSSProperties = {
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }

        if (edits.grayscale) {
          imgStyle.filter = 'grayscale(100%)'
        }

        if (edits.rotation) {
          imgStyle.transform = `rotate(${edits.rotation}deg)`
        }

        if (edits.crop) {
          const { x, y, width, height } = edits.crop
          imgStyle.position = 'absolute'
          imgStyle.width = `${(100 / width) * 100}%`
          imgStyle.height = `${(100 / height) * 100}%`
          imgStyle.left = `${(-x / width) * 100}%`
          imgStyle.top = `${(-y / height) * 100}%`
          imgStyle.objectFit = 'cover'
        } else {
          imgStyle.width = '100%'
          imgStyle.height = '100%'
          imgStyle.objectFit = 'contain'
        }

        return (
          <div style={containerStyle}>
            <img
              src={path}
              alt=""
              style={imgStyle}
            />
          </div>
        )
      }
      case 'empty':
      default:
        return <span className="cell-empty-hint">+</span>
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', cell.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    
    // Check if dropping an asset file from our asset library
    const assetPath = e.dataTransfer.getData('text/asset-path')
    if (assetPath) {
      updateCell(cell.id, {
        content: {
          type: 'image',
          originalPath: assetPath,
          edits: { grayscale: false, rotation: 0, crop: null }
        }
      })
      return
    }

    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId && !sourceId.startsWith('file://')) {
      if (sourceId !== cell.id) {
        swapCellContents(sourceId, cell.id)
      }
    }
  }

  return (
    <div
      className={`grid-cell ${isSelected ? 'grid-cell-selected' : ''} ${
        hasContent ? 'grid-cell-has-content' : ''
      }`}
      style={{
        gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
        gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
        cursor: isDraggable ? 'grab' : 'pointer'
      }}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={onSelect}
    >
      {hasTitle && (
        <div className="cell-title" style={titleStyle}>
          {prefix && <span style={{ marginRight: '6px', fontWeight: 'bold' }}>{prefix}</span>}
          {cell.title?.text || ''}
        </div>
      )}
      <div className="cell-content-area">{renderContent()}</div>
      {hasNote && <div className="cell-note" style={noteStyle}>{cell.note!.text}</div>}
    </div>
  )
}

/* ─── Properties Panel ─── */
function PropertiesPanel({
  cell,
  onUpdate,
  onEditRCode,
  onEditImage,
  messageApi,
}: {
  cell: GridCell
  onUpdate: (updates: Partial<GridCell>) => void
  onEditRCode: () => void
  onEditImage: () => void
  messageApi: any
}) {
  const [titleText, setTitleText] = useState(cell.title?.text ?? '')
  const [noteText, setNoteText] = useState(cell.note?.text ?? '')
  const [contentType, setContentType] = useState<CellContentType>(cell.content.type)

  const [titleFontFamily, setTitleFontFamily] = useState(cell.title?.style?.fontFamily ?? '"Times New Roman", Georgia, serif')
  const [titleFontSize, setTitleFontSize] = useState<number>(cell.title?.style?.fontSize ?? 12)

  const [noteFontFamily, setNoteFontFamily] = useState(cell.note?.style?.fontFamily ?? '"Times New Roman", Georgia, serif')
  const [noteFontSize, setNoteFontSize] = useState<number>(cell.note?.style?.fontSize ?? 11)

  // Sync state when cell changes
  useEffect(() => {
    setTitleText(cell.title?.text ?? '')
    setNoteText(cell.note?.text ?? '')
    setContentType(cell.content.type)
    setTitleFontFamily(cell.title?.style?.fontFamily ?? '"Times New Roman", Georgia, serif')
    setTitleFontSize(cell.title?.style?.fontSize ?? 12)
    setNoteFontFamily(cell.note?.style?.fontFamily ?? '"Times New Roman", Georgia, serif')
    setNoteFontSize(cell.note?.style?.fontSize ?? 11)
  }, [cell.id, cell.title, cell.note])

  const handleTitleBlur = useCallback(() => {
    const trimmed = titleText.trim()
    onUpdate({
      title: trimmed ? {
        text: trimmed,
        style: {
          ...cell.title?.style,
          fontFamily: titleFontFamily,
          fontSize: titleFontSize
        }
      } : null,
    })
  }, [titleText, titleFontFamily, titleFontSize, cell.title?.style, onUpdate])

  const handleNoteBlur = useCallback(() => {
    const trimmed = noteText.trim()
    onUpdate({
      note: trimmed ? {
        text: trimmed,
        style: {
          ...cell.note?.style,
          fontFamily: noteFontFamily,
          fontSize: noteFontSize
        }
      } : null,
    })
  }, [noteText, noteFontFamily, noteFontSize, cell.note?.style, onUpdate])

  const handleTitleFontChange = (family: string, size: number) => {
    setTitleFontFamily(family)
    setTitleFontSize(size)
    const trimmed = titleText.trim()
    if (trimmed) {
      onUpdate({
        title: {
          text: trimmed,
          style: {
            ...cell.title?.style,
            fontFamily: family,
            fontSize: size
          }
        }
      })
    }
  }

  const handleNoteFontChange = (family: string, size: number) => {
    setNoteFontFamily(family)
    setNoteFontSize(size)
    const trimmed = noteText.trim()
    if (trimmed) {
      onUpdate({
        note: {
          text: trimmed,
          style: {
            ...cell.note?.style,
            fontFamily: family,
            fontSize: size
          }
        }
      })
    }
  }

  const handleContentTypeChange = useCallback(
    (type: CellContentType) => {
      setContentType(type)
      switch (type) {
        case 'r_code':
          onUpdate({ content: { type: 'r_code', code: '', cachedImageBase64: null } })
          break
        case 'image':
          onUpdate({
            content: {
              type: 'image',
              originalPath: '',
              edits: { grayscale: false, rotation: 0, crop: null },
            },
          })
          break
        case 'empty':
          onUpdate({ content: { type: 'empty' } })
          break
      }
    },
    [onUpdate]
  )

  const handleImportImage = useCallback(async () => {
    if (window.picccAPI?.image?.import) {
      try {
        const result = await window.picccAPI.image.import()
        if (result.success && result.paths && result.paths.length > 0) {
          onUpdate({
            content: {
              type: 'image',
              originalPath: result.paths[0],
              edits: { grayscale: false, rotation: 0, crop: null },
            },
          })
        }
      } catch {
        messageApi.error('导入图片失败')
      }
    } else {
      messageApi.info('图片导入需要在桌面应用中使用')
    }
  }, [onUpdate, messageApi])

  const handleEditRCode = useCallback(() => {
    onEditRCode()
  }, [onEditRCode])

  return (
    <div className="props-panel">
      {/* Title Section */}
      <div className="props-section">
        <div className="props-section-title">
          <EditOutlined /> 标题
        </div>
        <div className="props-field">
          <Input
            placeholder="输入单元格标题..."
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            onBlur={handleTitleBlur}
            onPressEnter={handleTitleBlur}
            size="small"
          />
        </div>
        <div className="props-field" style={{ display: 'flex', gap: '6px' }}>
          <Select
            size="small"
            style={{ flex: 2 }}
            value={titleFontFamily}
            onChange={(val) => handleTitleFontChange(val, titleFontSize)}
            options={[
              { value: '"Times New Roman", Georgia, serif', label: 'Times New Roman' },
              { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
              { value: 'Georgia, serif', label: 'Georgia' },
              { value: 'Courier New, monospace', label: 'Courier New' },
              { value: 'system-ui, sans-serif', label: 'System UI' },
            ]}
          />
          <InputNumber
            size="small"
            style={{ flex: 1 }}
            min={6}
            max={48}
            value={titleFontSize}
            onChange={(val) => val && handleTitleFontChange(titleFontFamily, val)}
          />
        </div>
      </div>

      {/* Content Type Section */}
      <div className="props-section">
        <div className="props-section-title">
          <AppstoreOutlined /> 类型
        </div>
        <div className="props-field">
          <Radio.Group
            value={contentType}
            onChange={(e) => handleContentTypeChange(e.target.value)}
            size="small"
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="empty">空白</Radio>
              <Radio value="r_code">
                <Space>
                  <CodeOutlined /> R 代码
                </Space>
              </Radio>
              <Radio value="image">
                <Space>
                  <PictureOutlined /> 图片
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {/* Content-specific actions */}
        {contentType === 'r_code' && (
          <div className="props-field" style={{ marginTop: 8 }}>
            <Button
              icon={<CodeOutlined />}
              size="small"
              block
              onClick={handleEditRCode}
            >
              编辑 R 代码
            </Button>
          </div>
        )}
        {contentType === 'image' && (
          <div className="props-field" style={{ marginTop: 8 }}>
            <Button
              icon={<PictureOutlined />}
              size="small"
              type="primary"
              block
              onClick={handleImportImage}
            >
              导入图片
            </Button>
            {cell.content.type === 'image' && cell.content.originalPath && (
              <>
                <Text
                  type="secondary"
                  style={{ fontSize: 11, marginTop: 4, display: 'block', marginBottom: 8 }}
                  ellipsis
                >
                  {cell.content.originalPath.split('/').pop()}
                </Text>
                <Button
                  icon={<PictureOutlined />}
                  size="small"
                  block
                  onClick={onEditImage}
                >
                  编辑与裁剪图片
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Note Section */}
      <div className="props-section">
        <div className="props-section-title">
          <EditOutlined /> 注释
        </div>
        <div className="props-field">
          <TextArea
            placeholder="输入注释..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleNoteBlur}
            autoSize={{ minRows: 2, maxRows: 4 }}
            size="small"
          />
        </div>
        <div className="props-field" style={{ display: 'flex', gap: '6px' }}>
          <Select
            size="small"
            style={{ flex: 2 }}
            value={noteFontFamily}
            onChange={(val) => handleNoteFontChange(val, noteFontSize)}
            options={[
              { value: '"Times New Roman", Georgia, serif', label: 'Times New Roman' },
              { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
              { value: 'Georgia, serif', label: 'Georgia' },
              { value: 'Courier New, monospace', label: 'Courier New' },
              { value: 'system-ui, sans-serif', label: 'System UI' },
            ]}
          />
          <InputNumber
            size="small"
            style={{ flex: 1 }}
            min={6}
            max={48}
            value={noteFontSize}
            onChange={(val) => val && handleNoteFontChange(noteFontFamily, val)}
          />
        </div>
      </div>

      {/* Cell Info */}
      <div className="props-section">
        <div className="props-section-title"><AppstoreOutlined /> 信息</div>
        <Text type="secondary" style={{ fontSize: 11 }}>
          位置: 第 {cell.row + 1} 行, 第 {cell.col + 1} 列
        </Text>
        {(cell.rowSpan > 1 || cell.colSpan > 1) && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            跨度: {cell.rowSpan}×{cell.colSpan}
          </Text>
        )}
      </div>

      {/* Clear Content */}
      <Button
        icon={<DeleteOutlined />}
        size="small"
        danger
        block
        onClick={() =>
          onUpdate({
            content: { type: 'empty' },
            title: null,
            note: null,
          })
        }
      >
        清空单元格
      </Button>
    </div>
  )
}

/* ─── Main App ─── */
export default function App() {
  const {
    currentProject,
    filePath,
    isDirty,
    rEnvironment,
    selectedCellId,
    createProject,
    updateCell,
    selectCell,
    setREnvironment,
    setPageOrientation,
    setPageFormat,
    switchProjectLayout,
    updateGlobalSettings,
    setTheme,
  } = useProjectStore()

  const [messageApi, contextHolder] = message.useMessage()

  // R Code Editor state
  const [rEditorVisible, setREditorVisible] = useState(false)
  const [rEditorCellId, setREditorCellId] = useState<string | null>(null)

  // Image Crop Editor state
  const [imageCropVisible, setImageCropVisible] = useState(false)
  const [imageCropCellId, setImageCropCellId] = useState<string | null>(null)

  // Project Name Editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')

  // Gap Slider state
  const [isHoveredGap, setIsHoveredGap] = useState(false)
  const [isDraggingGap, setIsDraggingGap] = useState(false)

  // Export settings state
  const [exportVisible, setExportVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [customRPath, setCustomRPath] = useState(() => localStorage.getItem('piccc_pref_custom_r_path') || '')

  // System Preferences (stored in localStorage)
  const [showClassicTemplates, setShowClassicTemplates] = useState(() => {
    const saved = localStorage.getItem('piccc_pref_show_classic')
    return saved !== null ? saved === 'true' : true
  })
  const [enableAssetLibrary, setEnableAssetLibrary] = useState(() => {
    const saved = localStorage.getItem('piccc_pref_enable_asset_lib')
    return saved === 'true'
  })
  const [assetLibraryPath, setAssetLibraryPath] = useState(() => {
    return localStorage.getItem('piccc_pref_asset_path') || ''
  })
  const [assetSortOrder, setAssetSortOrder] = useState<'time_desc' | 'time_asc' | 'name_asc' | 'name_desc'>(() => {
    return (localStorage.getItem('piccc_pref_asset_sort') as any) || 'time_desc'
  })

  // List of files in the asset library
  const [assetsList, setAssetsList] = useState<Array<{ name: string; path: string; mtime: number; size: number }>>([])

  // Default asset path (inside project folder)
  const defaultAssetPath = useMemo(() => {
    if (filePath) {
      const lastSlash = filePath.lastIndexOf('/')
      if (lastSlash !== -1) {
        return filePath.substring(0, lastSlash) + '/assets'
      }
    }
    return ''
  }, [filePath])

  // Sync preferences to localStorage
  useEffect(() => {
    localStorage.setItem('piccc_pref_show_classic', String(showClassicTemplates))
  }, [showClassicTemplates])

  useEffect(() => {
    localStorage.setItem('piccc_pref_enable_asset_lib', String(enableAssetLibrary))
  }, [enableAssetLibrary])

  useEffect(() => {
    localStorage.setItem('piccc_pref_asset_path', assetLibraryPath)
  }, [assetLibraryPath])

  useEffect(() => {
    localStorage.setItem('piccc_pref_asset_sort', assetSortOrder)
  }, [assetSortOrder])

  // Fetch asset files list
  const fetchAssets = useCallback(async () => {
    if (!enableAssetLibrary) return
    const path = assetLibraryPath || defaultAssetPath
    if (!path) {
      setAssetsList([])
      return
    }
    try {
      if (window.picccAPI?.assets?.listFiles) {
        const res = await window.picccAPI.assets.listFiles(path)
        if (res.success && res.files) {
          const sorted = [...res.files].sort((a, b) => {
            if (assetSortOrder === 'time_desc') return b.mtime - a.mtime
            if (assetSortOrder === 'time_asc') return a.mtime - b.mtime
            if (assetSortOrder === 'name_asc') return a.name.localeCompare(b.name)
            if (assetSortOrder === 'name_desc') return b.name.localeCompare(a.name)
            return 0
          })
          setAssetsList(sorted)
        }
      }
    } catch {
      // ignore
    }
  }, [enableAssetLibrary, assetLibraryPath, defaultAssetPath, assetSortOrder])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // Classic and Custom template states
  const [classicTemplates, setClassicTemplates] = useState<TemplateDefinition[]>(TEMPLATES)
  const [customTemplates, setCustomTemplates] = useState<TemplateDefinition[]>([])
  const [classicCollapsed, setClassicCollapsed] = useState(false)
  const [customModalVisible, setCustomModalVisible] = useState(false)
  const [editLayoutModalVisible, setEditLayoutModalVisible] = useState(false)

  // Load custom templates and classic templates order on mount
  useEffect(() => {
    const savedClassicOrder = localStorage.getItem('piccc_classic_template_order')
    if (savedClassicOrder) {
      try {
        const orderIds = JSON.parse(savedClassicOrder)
        const sorted = [...TEMPLATES].sort((a, b) => {
          const idxA = orderIds.indexOf(a.id)
          const idxB = orderIds.indexOf(b.id)
          if (idxA === -1 && idxB === -1) return 0
          if (idxA === -1) return 1
          if (idxB === -1) return -1
          return idxA - idxB
        })
        setClassicTemplates(sorted)
      } catch {
        // ignore
      }
    }

    const savedCustom = localStorage.getItem('piccc_custom_templates')
    if (savedCustom) {
      try {
        setCustomTemplates(JSON.parse(savedCustom))
      } catch {
        // ignore
      }
    }
  }, [])

  const handleReorderClassicTemplates = useCallback(
    (draggedId: string, targetId: string) => {
      const dragIndex = classicTemplates.findIndex((t) => t.id === draggedId)
      const hoverIndex = classicTemplates.findIndex((t) => t.id === targetId)
      if (dragIndex === -1 || hoverIndex === -1) return
      const updated = [...classicTemplates]
      const [removed] = updated.splice(dragIndex, 1)
      updated.splice(hoverIndex, 0, removed)
      setClassicTemplates(updated)
      localStorage.setItem(
        'piccc_classic_template_order',
        JSON.stringify(updated.map((t) => t.id))
      )
    },
    [classicTemplates]
  )

  const handleReorderCustomTemplates = useCallback(
    (draggedId: string, targetId: string) => {
      const dragIndex = customTemplates.findIndex((t) => t.id === draggedId)
      const hoverIndex = customTemplates.findIndex((t) => t.id === targetId)
      if (dragIndex === -1 || hoverIndex === -1) return
      const updated = [...customTemplates]
      const [removed] = updated.splice(dragIndex, 1)
      updated.splice(hoverIndex, 0, removed)
      setCustomTemplates(updated)
      localStorage.setItem('piccc_custom_templates', JSON.stringify(updated))
    },
    [customTemplates]
  )

  const handleSaveCustomTemplate = (
    name: string,
    mergedCells: Array<{ row: number; col: number; rowSpan: number; colSpan: number }>
  ) => {
    const newTpl: TemplateDefinition = {
      id: `custom-${Math.random().toString(36).substring(2, 9)}`,
      name,
      description: '10×10 自定义绘制排版布局',
      rows: 10,
      cols: 10,
      icon: '📐',
      mergedCells,
    }
    const updated = [...customTemplates, newTpl]
    setCustomTemplates(updated)
    localStorage.setItem('piccc_custom_templates', JSON.stringify(updated))
    setCustomModalVisible(false)
    messageApi.success(`已保存自定义模板 "${name}"`)
  }

  const handleDeleteCustomTemplate = useCallback(
    (id: string) => {
      const updated = customTemplates.filter((t) => t.id !== id)
      setCustomTemplates(updated)
      localStorage.setItem('piccc_custom_templates', JSON.stringify(updated))
      messageApi.success('已成功删除该自定义模板')
    },
    [customTemplates, messageApi]
  )

  const handleSaveCurrentLayoutAsTemplate = useCallback(
    (name: string) => {
      if (!currentProject) return

      const mergedCells = currentProject.grid.cells
        .filter((c) => c.rowSpan > 1 || c.colSpan > 1)
        .map((c) => ({
          row: c.row,
          col: c.col,
          rowSpan: c.rowSpan,
          colSpan: c.colSpan,
        }))

      const newTpl: TemplateDefinition = {
        id: `custom-${Math.random().toString(36).substring(2, 9)}`,
        name,
        description: `从 "${currentProject.name}" 保存的 ${currentProject.grid.rows}×${currentProject.grid.cols} 自定义排版`,
        rows: currentProject.grid.rows,
        cols: currentProject.grid.cols,
        icon: '📐',
        mergedCells,
      }

      const updated = [...customTemplates, newTpl]
      setCustomTemplates(updated)
      localStorage.setItem('piccc_custom_templates', JSON.stringify(updated))
      messageApi.success(`已另存为自定义模板 "${name}"`)
    },
    [currentProject, customTemplates, messageApi]
  )

  // Detect R environment on mount
  useEffect(() => {
    const detectR = async () => {
      const savedCustomRPath = localStorage.getItem('piccc_pref_custom_r_path') || ''
      if (savedCustomRPath && window.picccAPI?.r?.setCustomPath) {
        try {
          await window.picccAPI.r.setCustomPath(savedCustomRPath)
        } catch (e) {
          console.error(e)
        }
      }
      if (window.picccAPI?.r?.detect) {
        try {
          const env = await window.picccAPI.r.detect()
          setREnvironment(env)
        } catch {
          setREnvironment({ found: false, path: '', version: '' })
        }
      }
    }
    detectR()
  }, [setREnvironment])

  // Get selected cell object
  const selectedCell = useMemo(() => {
    if (!currentProject || !selectedCellId) return null
    return currentProject.grid.cells.find((c) => c.id === selectedCellId) ?? null
  }, [currentProject, selectedCellId])

  // Check if a template is currently active/matching the project grid
  const isTemplateActive = useCallback((tpl: TemplateDefinition) => {
    if (!currentProject) return false
    if (currentProject.grid.rows !== tpl.rows || currentProject.grid.cols !== tpl.cols) return false

    const projectMerged = currentProject.grid.cells
      .filter((c) => c.rowSpan > 1 || c.colSpan > 1)
      .map((c) => `${c.row},${c.col},${c.rowSpan},${c.colSpan}`)
      .sort()

    const tplMerged = (tpl.mergedCells || [])
      .map((mc) => `${mc.row},${mc.col},${mc.rowSpan},${mc.colSpan}`)
      .sort()

    if (projectMerged.length !== tplMerged.length) return false
    return projectMerged.every((val, idx) => val === tplMerged[idx])
  }, [currentProject])

  // Handle template click with content migration
  const handleTemplateClick = useCallback(
    (template: TemplateDefinition) => {
      const applyTemplateSettings = () => {
        const saved = localStorage.getItem('piccc_template_settings')
        if (saved) {
          try {
            const settingsMap = JSON.parse(saved)
            if (settingsMap[template.id]) {
              updateGlobalSettings(settingsMap[template.id])
              return
            }
          } catch {
            // ignore
          }
        }
        // Fallback standard setting profile for fresh layout templates
        updateGlobalSettings({
          globalChineseFont: 'Microsoft YaHei',
          globalWesternFont: '"Times New Roman"',
          globalTitleAlign: 'left',
          globalNoteAlign: 'center',
          globalAutoNumber: '123',
        })
      }

      // If no project exists yet, create a fresh one directly
      if (!currentProject) {
        createProject(template.rows, template.cols, template.mergedCells)
        if (template.pageFormat && template.pageOrientation) {
          updateGlobalSettings({
            pageFormat: template.pageFormat,
            pageOrientation: template.pageOrientation
          })
        }
        applyTemplateSettings()
        messageApi.success(`已创建 ${template.name} 布局`)
        return
      }

      // Generate the new grid cells
      const newCells = createGridFromTemplate(template)
      const newCellsCount = newCells.length

      // Gather all cells that have actual content (image, code or non-empty title/note)
      const existingContents = currentProject.grid.cells
        .filter(
          (c) =>
            c.content.type !== 'empty' ||
            (c.title && c.title.text.trim()) ||
            (c.note && c.note.text.trim())
        )
        .map((c) => ({
          title: c.title,
          note: c.note,
          content: c.content,
        }))

      const performMigration = () => {
        // Populated the new template layout cells using the existing content
        const migratedCells = newCells.map((cell, idx) => {
          const source = existingContents[idx]
          if (source) {
            return {
              ...cell,
              title: source.title,
              note: source.note,
              content: source.content,
            }
          }
          return cell
        })

        switchProjectLayout(template.rows, template.cols, migratedCells)
        if (template.pageFormat && template.pageOrientation) {
          updateGlobalSettings({
            pageFormat: template.pageFormat,
            pageOrientation: template.pageOrientation
          })
        }
        applyTemplateSettings()
        messageApi.success(`已切换至 ${template.name} 布局并迁移已有图表`)
      }

      // If existing contents exceed new layout cell capacity, warn/prompt the user
      if (existingContents.length > newCellsCount) {
        Modal.confirm({
          title: '确认切换布局？',
          content: `新布局仅包含 ${newCellsCount} 个单元格，而当前项目有 ${existingContents.length} 个单元格包含内容。切换后，排在后面的 ${existingContents.length - newCellsCount} 个单元格的内容将被丢弃。`,
          okText: '确认切换',
          cancelText: '取消',
          onOk: performMigration,
        })
      } else {
        performMigration()
      }
    },
    [currentProject, createProject, switchProjectLayout, updateGlobalSettings, messageApi]
  )

  // Handle cell update from properties panel
  const handleCellUpdate = useCallback(
    (updates: Partial<GridCell>) => {
      if (selectedCellId) {
        updateCell(selectedCellId, updates)
      }
    },
    [selectedCellId, updateCell]
  )

  // Handle opening R code editor
  const handleOpenREditor = useCallback(() => {
    if (selectedCellId) {
      setREditorCellId(selectedCellId)
      setREditorVisible(true)
    }
  }, [selectedCellId])

  // Handle saving R code from editor
  const handleSaveRCode = useCallback(
    (code: string, imageDataUrl: string | null) => {
      if (rEditorCellId) {
        updateCell(rEditorCellId, {
          content: {
            type: 'r_code',
            code,
            cachedImageBase64: imageDataUrl,
          },
        })
      }
    },
    [rEditorCellId, updateCell]
  )

  // Handle changing asset library folder path
  const handleChangeAssetPath = useCallback(async () => {
    if (window.picccAPI?.assets?.selectFolder) {
      try {
        const res = await window.picccAPI.assets.selectFolder()
        if (res.success && res.path) {
          setAssetLibraryPath(res.path)
          messageApi.success('素材库路径已更新')
        }
      } catch {
        messageApi.error('选择文件夹失败')
      }
    } else {
      messageApi.info('该操作需要在桌面端中使用')
    }
  }, [messageApi])

  // Handle manual R re-detection
  const handleDetectR = useCallback(async () => {
    if (window.picccAPI?.r?.detect) {
      messageApi.loading({ content: '正在重新自动检测 R 环境...', key: 'r-detect-msg', duration: 0 })
      try {
        const env = await window.picccAPI.r.detect()
        setREnvironment(env)
        if (env.found) {
          messageApi.success({ content: `检测成功！已发现 R ${env.version}`, key: 'r-detect-msg' })
        } else {
          messageApi.error({ content: '自动检测失败，建议手动指定 Rscript 执行路径。', key: 'r-detect-msg', duration: 3 })
        }
      } catch (err) {
        messageApi.error({ content: 'R 环境检测出错', key: 'r-detect-msg' })
      }
    }
  }, [setREnvironment, messageApi])

  // Handle manual selection of Rscript executable
  const handleSelectCustomR = useCallback(async () => {
    if (window.picccAPI?.r?.selectExecutable && window.picccAPI?.r?.setCustomPath) {
      try {
        const res = await window.picccAPI.r.selectExecutable()
        if (res.success && res.path) {
          messageApi.loading({ content: '正在验证所选的 Rscript 可执行文件...', key: 'r-custom-msg', duration: 0 })
          const verify = await window.picccAPI.r.setCustomPath(res.path)
          setREnvironment(verify)
          if (verify.found) {
            localStorage.setItem('piccc_pref_custom_r_path', res.path)
            setCustomRPath(res.path)
            messageApi.success({ content: `手动配置成功！已发现 R ${verify.version}`, key: 'r-custom-msg' })
          } else {
            messageApi.error({ content: '验证失败：所选文件不是合法的 Rscript 可执行文件，或运行出错。', key: 'r-custom-msg', duration: 3 })
          }
        }
      } catch (err) {
        messageApi.error({ content: '选择文件时发生错误', key: 'r-custom-msg' })
      }
    }
  }, [setREnvironment, messageApi])

  // Handle clearing custom Rscript path and restoring default auto-detect
  const handleClearCustomR = useCallback(async () => {
    if (window.picccAPI?.r?.setCustomPath) {
      try {
        localStorage.removeItem('piccc_pref_custom_r_path')
        setCustomRPath('')
        messageApi.loading({ content: '已重置，正在重新检测系统默认 R 环境...', key: 'r-reset-msg', duration: 0 })
        const verify = await window.picccAPI.r.setCustomPath(null)
        setREnvironment(verify)
        if (verify.found) {
          messageApi.success({ content: `已恢复默认！自动发现 R ${verify.version}`, key: 'r-reset-msg' })
        } else {
          messageApi.warning({ content: '已恢复默认，但未能在默认路径中检测到 R。', key: 'r-reset-msg', duration: 3 })
        }
      } catch (err) {
        messageApi.error({ content: '恢复默认时出错', key: 'r-reset-msg' })
      }
    }
  }, [setREnvironment, messageApi])

  // Find active template matching current project grid config
  const activeTemplate = useMemo(() => {
    const foundStatic = TEMPLATES.find(isTemplateActive)
    if (foundStatic) return { tpl: foundStatic, isCustom: false }
    const foundCustom = customTemplates.find(isTemplateActive)
    if (foundCustom) return { tpl: foundCustom, isCustom: true }
    return null
  }, [isTemplateActive, customTemplates])

  // Compute page ratio styles dynamically (A4 vs PPT 16:9)
  const pageStyle = useMemo<React.CSSProperties>(() => {
    if (!currentProject) return {}
    const isPortrait = currentProject.pageOrientation === 'portrait'
    const isPPT = currentProject.pageFormat === 'ppt'

    let ratioStr = '1 / 1.4142'
    let ratioVal = 1 / 1.4142
    if (isPPT) {
      ratioStr = isPortrait ? '9 / 16' : '16 / 9'
      ratioVal = isPortrait ? 9 / 16 : 16 / 9
    } else {
      ratioStr = isPortrait ? '1 / 1.4142' : '1.4142 / 1'
      ratioVal = isPortrait ? 1 / 1.4142 : 1.4142 / 1
    }

    const limitWidth = isPortrait ? (isPPT ? 440 : 560) : (isPPT ? 820 : 792)

    return {
      aspectRatio: ratioStr,
      width: `min(100%, calc((100vh - 120px) * ${ratioVal}), ${limitWidth}px)`,
      height: 'auto',
      maxHeight: 'calc(100vh - 120px)',
    }
  }, [currentProject?.pageOrientation, currentProject?.pageFormat])

  // Handle custom template renaming
  const handleRenameCustomTemplate = useCallback(
    (id: string, newName: string) => {
      const updated = customTemplates.map((tpl) => {
        if (tpl.id === id) {
          return { ...tpl, name: newName }
        }
        return tpl
      })
      setCustomTemplates(updated)
      localStorage.setItem('piccc_custom_templates', JSON.stringify(updated))
      messageApi.success(`模板名称已修改为 "${newName}"`)
    },
    [customTemplates, messageApi]
  )

  // Handle global settings change, updating current project and persisting to template profile
  const handleUpdateGlobalSettings = useCallback(
    (settings: Partial<ProjectData>) => {
      updateGlobalSettings(settings)
      if (activeTemplate) {
        const saved = localStorage.getItem('piccc_template_settings')
        let settingsMap: any = {}
        if (saved) {
          try {
            settingsMap = JSON.parse(saved)
          } catch {
            // ignore
          }
        }
        settingsMap[activeTemplate.tpl.id] = {
          ...settingsMap[activeTemplate.tpl.id],
          ...settings,
        }
        localStorage.setItem('piccc_template_settings', JSON.stringify(settingsMap))
      }
    },
    [activeTemplate, updateGlobalSettings]
  )

  const handleSaveEditedLayout = useCallback(
    (name: string, newMergedCells: Array<{ row: number; col: number; rowSpan: number; colSpan: number }>) => {
      if (!currentProject) return

      // Perform switch layout with content migration
      const newCells = createGridFromTemplate({
        id: 'temp',
        name: 'temp',
        description: 'temp',
        rows: 10,
        cols: 10,
        mergedCells: newMergedCells,
      })

      // Migrate contents
      const existingContents = currentProject.grid.cells
        .filter(
          (c) =>
            c.content.type !== 'empty' ||
            (c.title && c.title.text.trim()) ||
            (c.note && c.note.text.trim())
        )
        .map((c) => ({
          title: c.title,
          note: c.note,
          content: c.content,
        }))

      const performSwitch = () => {
        const migratedCells = newCells.map((cell, idx) => {
          const source = existingContents[idx]
          if (source) {
            return {
              ...cell,
              title: source.title,
              note: source.note,
              content: source.content,
            }
          }
          return cell
        })

        switchProjectLayout(10, 10, migratedCells)
        setEditLayoutModalVisible(false)

        // If there's an active custom template, check if layout changed
        if (activeTemplate && activeTemplate.isCustom) {
          const tplMergedStr = (activeTemplate.tpl.mergedCells || [])
            .map((mc) => `${mc.row},${mc.col},${mc.rowSpan},${mc.colSpan}`)
            .sort()
            .join(';')

          const newMergedStr = newMergedCells
            .map((mc) => `${mc.row},${mc.col},${mc.rowSpan},${mc.colSpan}`)
            .sort()
            .join(';')

          if (tplMergedStr !== newMergedStr) {
            Modal.confirm({
              title: '是否保存修改到模板？',
              content: `检测到单元格大小和范围发生了变化。是否同步将修改保存到自定义模板 "${activeTemplate.tpl.name}" 中？`,
              okText: '确认保存',
              cancelText: '仅临时调整',
              onOk: () => {
                const updated = customTemplates.map((t) => {
                  if (t.id === activeTemplate.tpl.id) {
                    return { ...t, mergedCells: newMergedCells }
                  }
                  return t
                })
                setCustomTemplates(updated)
                localStorage.setItem('piccc_custom_templates', JSON.stringify(updated))
                messageApi.success(`已同步更新模板 "${activeTemplate.tpl.name}" 的布局配置`)
              },
              onCancel: () => {
                messageApi.info('排版已临时调整，未同步保存到模板卡片')
              },
            })
            return
          }
        }
        messageApi.success('排版布局已调整')
      }

      if (existingContents.length > newCells.length) {
        Modal.confirm({
          title: '确认调整排版布局？',
          content: `调整后的布局包含 ${newCells.length} 个单元格，而当前有 ${existingContents.length} 个单元格包含内容。调整后，排在后面的 ${existingContents.length - newCells.length} 个单元格的内容将被丢弃。`,
          okText: '确认调整',
          cancelText: '取消',
          onOk: performSwitch,
        })
      } else {
        performSwitch()
      }
    },
    [currentProject, activeTemplate, customTemplates, switchProjectLayout, messageApi]
  )

  // Handle opening image editor
  const handleOpenImageEditor = useCallback(() => {
    if (selectedCellId) {
      setImageCropCellId(selectedCellId)
      setImageCropVisible(true)
    }
  }, [selectedCellId])

  // Handle saving image editor edits
  const handleSaveImageEdits = useCallback(
    (edits: any) => {
      if (imageCropCellId) {
        const cell = currentProject?.grid.cells.find(c => c.id === imageCropCellId)
        if (cell && cell.content.type === 'image') {
          updateCell(imageCropCellId, {
            content: {
              ...cell.content,
              edits,
            },
          })
        }
      }
    },
    [imageCropCellId, currentProject, updateCell]
  )

  // Handle open project
  const handleOpen = useCallback(async () => {
    if (window.picccAPI?.dialog?.openFile) {
      try {
        const result = await window.picccAPI.dialog.openFile({
          filters: [{ name: 'Piccc 项目', extensions: ['piccc'] }],
        })
        if (result) {
          messageApi.info('正在加载项目...')
        }
      } catch {
        messageApi.error('打开项目失败')
      }
    } else {
      messageApi.info('文件操作需要在桌面应用中使用')
    }
  }, [messageApi])

  // Handle save project
  const handleSave = useCallback(() => {
    if (window.picccAPI?.dialog?.saveFile) {
      messageApi.info('正在保存...')
    } else {
      messageApi.info('文件操作需要在桌面应用中使用')
    }
  }, [messageApi])

  // Handle export
  const handleExport = useCallback(() => {
    if (!currentProject) {
      messageApi.warning('请先创建或打开项目')
      return
    }
    setExportVisible(true)
  }, [currentProject, messageApi])

  return (
    <ConfigProvider locale={zhCN} theme={getAntdTheme(currentProject?.theme || 'nature')}>
      {contextHolder}
      <div className="app-layout" data-theme={currentProject?.theme || 'nature'}>
        {/* ═══ Header ═══ */}
        <header className="app-header">
          <Tooltip title="点击打开系统设置" placement="bottomLeft">
            <div className="logo" onClick={() => setSettingsVisible(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <img src={logoUrl} alt="Piccc Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            </div>
          </Tooltip>
          {currentProject && (
            <>
              <div className="header-divider" />
              {isEditingName ? (
                <Input
                  size="small"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => {
                    setIsEditingName(false)
                    if (editingName.trim()) {
                      updateGlobalSettings({ name: editingName.trim() })
                    }
                  }}
                  onPressEnter={() => {
                    setIsEditingName(false)
                    if (editingName.trim()) {
                      updateGlobalSettings({ name: editingName.trim() })
                    }
                  }}
                  autoFocus
                  style={{
                    width: '130px',
                    height: '22px',
                    fontSize: '12px',
                    padding: '0 6px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                  }}
                />
              ) : (
                <Tooltip title="双击重命名项目" placement="bottom">
                  <span
                    className="project-name"
                    onDoubleClick={() => {
                      setEditingName(currentProject.name)
                      setIsEditingName(true)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {currentProject.name}
                    {isDirty && <span className="dirty-dot" />}
                  </span>
                </Tooltip>
              )}
            </>
          )}
          <div className="header-actions">
            <Tooltip title="新建项目">
              <Button
                className="header-btn"
                type="text"
                icon={<PlusOutlined />}
                onClick={() => createProject(2, 2)}
              >
                新建
              </Button>
            </Tooltip>
            <Tooltip title="打开项目">
              <Button
                className="header-btn"
                type="text"
                icon={<FolderOpenOutlined />}
                onClick={handleOpen}
              >
                打开
              </Button>
            </Tooltip>
            <Tooltip title="保存项目">
              <Button
                className="header-btn"
                type="text"
                icon={<SaveOutlined />}
                onClick={handleSave}
              >
                保存
              </Button>
            </Tooltip>
            <div className="header-divider" />
            <Tooltip title="导出图片">
              <Button
                className="header-btn header-btn-primary"
                type="text"
                icon={<ExportOutlined />}
                onClick={handleExport}
              >
                导出
              </Button>
            </Tooltip>
          </div>
        </header>

        {/* ═══ Body ═══ */}
        <div className="app-body">
          {/* ─── Left Sidebar: Templates & Settings ─── */}
          <aside className="sidebar-left">
            <div className="sidebar-title">
              <AppstoreOutlined /> 页面与排版
            </div>
            
            <div className="navigator-section">
              <div className="page-settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span className="page-settings-label" style={{ display: 'block', marginBottom: '4px' }}>画布规格 (纸张/比例)</span>
                  <Radio.Group
                    size="small"
                    value={currentProject?.pageFormat || 'a4'}
                    onChange={(e) => setPageFormat(e.target.value)}
                    disabled={!currentProject}
                    style={{ width: '100%' }}
                  >
                    <Radio.Button value="a4" style={{ width: '50%', textAlign: 'center' }}>A4 纸张</Radio.Button>
                    <Radio.Button value="ppt" style={{ width: '50%', textAlign: 'center' }}>PPT 16:9</Radio.Button>
                  </Radio.Group>
                </div>
                <div>
                  <span className="page-settings-label" style={{ display: 'block', marginBottom: '4px' }}>画布方向</span>
                  <Radio.Group
                    size="small"
                    value={currentProject?.pageOrientation || 'portrait'}
                    onChange={(e) => setPageOrientation(e.target.value)}
                    disabled={!currentProject}
                    style={{ width: '100%' }}
                  >
                    <Radio.Button value="portrait" style={{ width: '50%', textAlign: 'center' }}>纵向</Radio.Button>
                    <Radio.Button value="landscape" style={{ width: '50%', textAlign: 'center' }}>横向</Radio.Button>
                  </Radio.Group>
                </div>
              </div>
            </div>

            {showClassicTemplates && (
              <>
                <div
                  className="sidebar-title"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', marginTop: '4px' }}
                  onClick={() => setClassicCollapsed(!classicCollapsed)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AppstoreOutlined /> 经典科研模板
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', paddingRight: '8px' }}>
                    {classicCollapsed ? '展开 ＋' : '收起 －'}
                  </span>
                </div>
                {!classicCollapsed && (
                  <div className="template-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {classicTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className={`template-card ${
                          isTemplateActive(tpl) ? 'template-card-active' : ''
                        }`}
                        onClick={() => handleTemplateClick(tpl)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/classic-tpl-id', tpl.id)
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          const draggedId = e.dataTransfer.getData('text/classic-tpl-id')
                          if (draggedId) {
                            handleReorderClassicTemplates(draggedId, tpl.id)
                          }
                        }}
                        style={{ cursor: 'grab' }}
                      >
                        <MiniGridPreview template={tpl} />
                        <div className="template-info">
                          <div className="template-name">
                            {tpl.icon} {tpl.name}
                          </div>
                          <div className="template-desc"><span>{tpl.description}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="sidebar-title" style={{ borderTop: '1px solid var(--border-light)', marginTop: '8px' }}>
              <AppstoreOutlined /> 自定义排版
            </div>
            <div style={{ padding: '6px 12px 2px' }}>
              <Button
                type="dashed"
                icon={<PlusOutlined style={{ fontSize: '13px', fontWeight: 'bold' }} />}
                block
                size="small"
                onClick={() => setCustomModalVisible(true)}
              />
            </div>
            <div className="template-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {customTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  暂无自定义模板
                </div>
              ) : (
                customTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`template-card ${
                      isTemplateActive(tpl) ? 'template-card-active' : ''
                    }`}
                    onClick={() => handleTemplateClick(tpl)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/custom-tpl-id', tpl.id)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const draggedId = e.dataTransfer.getData('text/custom-tpl-id')
                      if (draggedId) {
                        handleReorderCustomTemplates(draggedId, tpl.id)
                      }
                    }}
                    style={{ cursor: 'grab' }}
                  >
                    <MiniGridPreview template={tpl} />
                    <div className="template-info">
                      <div className="template-name" style={{ fontSize: '12px', fontWeight: '500' }}>
                        {tpl.icon} {tpl.name}
                      </div>
                      <div className="template-desc" style={{ fontSize: '10px' }}><span>{tpl.description}</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {enableAssetLibrary && (
              <>
                <div className="sidebar-title" style={{ borderTop: '1px solid var(--border-light)', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderOpenOutlined /> 科研素材库
                  </span>
                  <Tooltip title="刷新素材文件">
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined rotate={45} style={{ transform: 'rotate(45deg)' }} />}
                      onClick={fetchAssets}
                      style={{ fontSize: '11px', padding: 0 }}
                    />
                  </Tooltip>
                </div>
                <div className="asset-library-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 8px 8px', minHeight: '180px' }}>
                  <div style={{ padding: '6px 4px', fontSize: '10px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    📂 路径: {assetLibraryPath || defaultAssetPath || '未指定'}
                  </div>
                  <div className="asset-grid" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', padding: '4px 0' }}>
                    {assetsList.length === 0 ? (
                      <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '11px' }}>
                        无可用图片文件 (PNG/JPG等)
                      </div>
                    ) : (
                      assetsList.map((asset) => {
                        const fileUrl = asset.path.startsWith('file://') ? asset.path : `file://${asset.path}`
                        return (
                          <Tooltip key={asset.path} title={`${asset.name} (${Math.round(asset.size / 1024)} KB)`} placement="top">
                            <div
                              className="asset-card"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', fileUrl)
                                e.dataTransfer.setData('text/asset-path', asset.path)
                              }}
                              style={{
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                padding: '4px',
                                cursor: 'grab',
                                background: '#fff',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                overflow: 'hidden',
                                transition: 'all 0.2s',
                              }}
                            >
                              <img
                                src={fileUrl}
                                alt={asset.name}
                                style={{
                                  width: '100%',
                                  height: '52px',
                                  objectFit: 'contain',
                                  background: '#f8fafc',
                                  borderRadius: '2px',
                                }}
                              />
                              <div
                                style={{
                                  fontSize: '9px',
                                  width: '100%',
                                  textAlign: 'center',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {asset.name}
                              </div>
                            </div>
                          </Tooltip>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>

          {/* ─── Center: Grid Canvas ─── */}
          <main className="canvas-area" onClick={() => selectCell(null)}>
            {!currentProject ? (
              <div className="canvas-empty">
                <Empty
                  description="选择左侧模板开始创建"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              <div className="a4-page" style={pageStyle}>
                <div
                  className="grid-canvas"
                  style={{
                    gridTemplateRows: `repeat(${currentProject.grid.rows}, 1fr)`,
                    gridTemplateColumns: `repeat(${currentProject.grid.cols}, 1fr)`,
                    gap: `${currentProject.gridGap !== undefined ? currentProject.gridGap : 12}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {currentProject.grid.cells.map((cell) => (
                    <GridCellView
                      key={cell.id}
                      cell={cell}
                      isSelected={cell.id === selectedCellId}
                      onSelect={() => selectCell(cell.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </main>

          {/* ─── Right Sidebar: Properties ─── */}
          <aside className="sidebar-right">
            <div className="sidebar-title">
              <EditOutlined /> 属性面板
            </div>
            {selectedCell ? (
              <PropertiesPanel
                cell={selectedCell}
                onUpdate={handleCellUpdate}
                onEditRCode={handleOpenREditor}
                onEditImage={handleOpenImageEditor}
                messageApi={messageApi}
              />
            ) : activeTemplate ? (
              <TemplatePropertiesPanel
                template={activeTemplate.tpl}
                isCustom={activeTemplate.isCustom}
                onRename={handleRenameCustomTemplate}
                onDelete={handleDeleteCustomTemplate}
                onSaveCurrentAsTemplate={handleSaveCurrentLayoutAsTemplate}
                onUpdateSettings={handleUpdateGlobalSettings}
                onEditLayout={() => setEditLayoutModalVisible(true)}
                messageApi={messageApi}
              />
            ) : (
              <div className="props-hint">
                <AppstoreOutlined />
                <span>点击网格中的单元格<br />以编辑其属性</span>
              </div>
            )}
          </aside>
        </div>

        {/* ═══ Status Bar ═══ */}
        <footer className="status-bar" style={{ gap: '16px' }}>
          <div className="status-item">
            <span
              className={`status-dot ${
                rEnvironment.found ? 'status-dot-green' : 'status-dot-red'
              }`}
            />
            {rEnvironment.found
              ? `R ${rEnvironment.version}`
              : 'R 未检测到'}
          </div>
          <div className="status-spacer" />
          {currentProject && (
            <div className="status-item">
              {currentProject.grid.rows}×{currentProject.grid.cols} 网格
              {' · '}
              {currentProject.grid.cells.length} 个单元格
            </div>
          )}
          {isDirty && (
            <div className="status-item">
              <span className="status-dot status-dot-yellow" />
              未保存
            </div>
          )}
        </footer>

        {/* ═══ R Code Editor Modal ═══ */}
        {rEditorCellId && (() => {
          const editingCell = currentProject?.grid.cells.find(c => c.id === rEditorCellId)
          const initialCode = editingCell?.content.type === 'r_code' ? editingCell.content.code : ''
          const cachedImage = editingCell?.content.type === 'r_code' ? editingCell.content.cachedImageBase64 : null
          return (
            <RCodeEditor
              visible={rEditorVisible}
              initialCode={initialCode}
              cachedImage={cachedImage}
              cellId={rEditorCellId}
              onClose={() => {
                setREditorVisible(false)
                setREditorCellId(null)
              }}
              onSave={handleSaveRCode}
            />
          )
        })()}

        {/* ═══ Image Crop Modal ═══ */}
        {imageCropCellId && (() => {
          const editingCell = currentProject?.grid.cells.find(c => c.id === imageCropCellId)
          if (editingCell && editingCell.content.type === 'image') {
            const path = editingCell.content.originalPath.startsWith('file://')
              ? editingCell.content.originalPath
              : `file://${editingCell.content.originalPath}`
            return (
              <ImageCropModal
                visible={imageCropVisible}
                imageUrl={path}
                initialEdits={editingCell.content.edits}
                onClose={() => {
                  setImageCropVisible(false)
                  setImageCropCellId(null)
                }}
                onSave={handleSaveImageEdits}
              />
            )
          }
          return null
        })()}

        {/* ═══ Export Modal ═══ */}
        <ExportModal
          visible={exportVisible}
          project={currentProject}
          onClose={() => setExportVisible(false)}
        />

        {/* ═══ Settings Modal ═══ */}
        <Modal
          title="⚙️ 系统设置"
          open={settingsVisible}
          onCancel={() => setSettingsVisible(false)}
          footer={null}
          width={420}
          destroyOnClose
        >
          <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Theme Settings */}
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: '6px' }}>
                🎨 期刊视觉主题
              </Typography.Text>
              <Typography.Paragraph type="secondary" style={{ fontSize: '11px', marginBottom: '8px', lineHeight: '1.4' }}>
                选择经典刊物的经典元素与配色体系，切换后将即时更新软件视觉系统。
              </Typography.Paragraph>
              <Select
                value={currentProject?.theme || 'nature'}
                onChange={(val) => {
                  if (currentProject) {
                    setTheme(val)
                  }
                }}
                disabled={!currentProject}
                options={[
                  { value: 'nature', label: '🌿 Nature (翡翠绿)' },
                  { value: 'science', label: '🌋 Science (绯红色)' },
                  { value: 'cell', label: '🧬 Cell (珊瑚橘)' },
                  { value: 'ieee', label: '📡 IEEE (深蓝色)' },
                ]}
                placeholder={currentProject ? "选择视觉主题..." : "请先新建项目..."}
                style={{ width: '100%' }}
              />
            </div>

            {/* Default Export Path Settings */}
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: '6px' }}>
                📁 默认导出文件夹
              </Typography.Text>
              <Typography.Paragraph type="secondary" style={{ fontSize: '11px', marginBottom: '8px', lineHeight: '1.4' }}>
                配置排版图表导出时的默认文件夹。未指定时将由系统提示选择或保存至项目目录。
              </Typography.Paragraph>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  size="small"
                  value={currentProject?.defaultExportPath || '未指定，默认保存至项目或上次导出路径'}
                  disabled
                  placeholder="选择默认导出文件夹"
                  style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)' }}
                />
                <Button 
                  size="small" 
                  type="primary" 
                  ghost 
                  disabled={!currentProject}
                  onClick={async () => {
                    if (window.picccAPI?.assets?.selectFolder) {
                      const res = await window.picccAPI.assets.selectFolder()
                      if (res.success && res.path) {
                        updateGlobalSettings({ defaultExportPath: res.path })
                        messageApi.success('已更新默认导出路径')
                      }
                    }
                  }}
                >
                  选择路径
                </Button>
              </div>
            </div>

            {/* R Environment Settings */}
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: '6px' }}>
                📊 R 语言执行环境
              </Typography.Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>当前状态:</span>
                  <Tag color={rEnvironment.found ? 'success' : 'error'} style={{ margin: 0, fontSize: '11px' }}>
                    {rEnvironment.found ? `已连接 (v${rEnvironment.version})` : '未检测到 R 环境'}
                  </Tag>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: '1.4' }}>
                  <strong>执行路径:</strong> {rEnvironment.path || '无'}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <Button 
                    size="small" 
                    type="primary" 
                    ghost
                    onClick={handleDetectR}
                  >
                    自动重新检测
                  </Button>
                  <Button 
                    size="small" 
                    onClick={handleSelectCustomR}
                  >
                    手动选择 Rscript
                  </Button>
                  {customRPath && (
                    <Button 
                      size="small" 
                      danger 
                      type="text"
                      onClick={handleClearCustomR}
                      style={{ padding: '0 4px', fontSize: '11px' }}
                    >
                      恢复默认
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Template Display Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Typography.Text strong style={{ display: 'block' }}>
                  🔲 显示经典科研模板
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                  在左侧边栏显示系统预设的科研网格布局模板
                </Typography.Text>
              </div>
              <Switch checked={showClassicTemplates} onChange={setShowClassicTemplates} />
            </div>

            {/* Enable Material Library */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Typography.Text strong style={{ display: 'block' }}>
                  📁 开启科研素材库
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                  加载本地文件夹中的图表，提供缩略图快捷拖拽与管理
                </Typography.Text>
              </div>
              <Switch checked={enableAssetLibrary} onChange={setEnableAssetLibrary} />
            </div>

            {/* Material Library Details (only visible if enabled) */}
            {enableAssetLibrary && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <Typography.Text style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                    素材库物理路径
                  </Typography.Text>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input
                      size="small"
                      value={assetLibraryPath || defaultAssetPath || '未指定，默认指向项目下的 assets 目录'}
                      disabled
                      placeholder="请选择素材库文件夹"
                      style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)' }}
                    />
                    <Button size="small" type="primary" ghost onClick={handleChangeAssetPath}>
                      更改路径
                    </Button>
                  </div>
                  {!filePath && !assetLibraryPath && (
                    <span style={{ fontSize: '10px', color: '#ff4d4f', display: 'block', marginTop: '4px' }}>
                      ⚠️ 项目未保存，无法生成默认路径。请手动选择目录，或先保存项目。
                    </span>
                  )}
                </div>

                <div>
                  <Typography.Text style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                    素材文件排列顺序
                  </Typography.Text>
                  <Select
                    size="small"
                    value={assetSortOrder}
                    onChange={(val) => setAssetSortOrder(val)}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'time_desc', label: '🕒 按修改时间：从新到旧 (最新靠前)' },
                      { value: 'time_asc', label: '🕒 按修改时间：从旧到新' },
                      { value: 'name_asc', label: '🔤 按文件名称：A 至 Z' },
                      { value: 'name_desc', label: '🔤 按文件名称：Z 至 A' },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* ═══ Custom Template Modal ═══ */}
        <CustomTemplateModal
          visible={customModalVisible}
          onClose={() => setCustomModalVisible(false)}
          onSave={handleSaveCustomTemplate}
          messageApi={messageApi}
        />

        {currentProject && (
          <CustomTemplateModal
            visible={editLayoutModalVisible}
            onClose={() => setEditLayoutModalVisible(false)}
            onSave={handleSaveEditedLayout}
            initialName={activeTemplate ? activeTemplate.tpl.name : currentProject.name}
            initialMergedCells={currentProject.grid.cells
              .filter((c) => c.rowSpan > 1 || c.colSpan > 1)
              .map((c) => ({
                id: c.id,
                row: c.row,
                col: c.col,
                rowSpan: c.rowSpan,
                colSpan: c.colSpan,
              }))
            }
            okText="确认并调整网格布局"
            messageApi={messageApi}
          />
        )}
      </div>
    </ConfigProvider>
  )
}

/* ─── Custom Template Designer Modal ─── */
interface CustomTemplateModalProps {
  visible: boolean
  onClose: () => void
  onSave: (
    name: string,
    mergedCells: Array<{ row: number; col: number; rowSpan: number; colSpan: number }>,
    pageFormat?: 'a4' | 'ppt',
    pageOrientation?: 'portrait' | 'landscape'
  ) => void
  initialName?: string
  initialMergedCells?: Array<{ id: string; row: number; col: number; rowSpan: number; colSpan: number }>
  okText?: string
}

function CustomTemplateModal({
  visible,
  onClose,
  onSave,
  initialName = '',
  initialMergedCells = [],
  okText = '确认并保存模板',
  messageApi,
}: CustomTemplateModalProps) {
  const currentProject = useProjectStore((state) => state.currentProject)

  const [templateName, setTemplateName] = useState('')
  const [mergedCells, setMergedCells] = useState<Array<{ id: string; row: number; col: number; rowSpan: number; colSpan: number }>>([])
  
  // Wizard steps: 1 = choose page format/orientation, 2 = draw cells
  const [step, setStep] = useState<1 | 2>(1)
  const [pageFormat, setPageFormat] = useState<'a4' | 'ppt'>('a4')
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait')

  // Drag state
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ row: number; col: number } | null>(null)

  // Sync state on open
  useEffect(() => {
    if (visible) {
      setTemplateName(initialName || `自定义模板 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`)
      setMergedCells(initialMergedCells || [])
      setDragStart(null)
      setDragEnd(null)

      if (initialMergedCells && initialMergedCells.length > 0) {
        setStep(2)
      } else {
        setStep(1)
        if (currentProject) {
          setPageFormat(currentProject.pageFormat || 'a4')
          setPageOrientation(currentProject.pageOrientation || 'portrait')
        } else {
          setPageFormat('a4')
          setPageOrientation('portrait')
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const checkOverlap = (
    r1: number, c1: number, r2: number, c2: number
  ) => {
    return mergedCells.some((cell) => {
      const existR1 = cell.row
      const existR2 = cell.row + cell.rowSpan - 1
      const existC1 = cell.col
      const existC2 = cell.col + cell.colSpan - 1
      return !(r2 < existR1 || r1 > existR2 || c2 < existC1 || c1 > existC2)
    })
  }

  const handleCellMouseDown = (row: number, col: number) => {
    // Check if clicked inside an already merged cell
    const isOccupied = mergedCells.some(cell => 
      row >= cell.row && row < cell.row + cell.rowSpan &&
      col >= cell.col && col < cell.col + cell.colSpan
    )
    if (isOccupied) return

    setDragStart({ row, col })
    setDragEnd({ row, col })
  }

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!dragStart) return
    setDragEnd({ row, col })
  }

  const handleMouseUp = () => {
    if (!dragStart || !dragEnd) {
      setDragStart(null)
      setDragEnd(null)
      return
    }

    const rMin = Math.min(dragStart.row, dragEnd.row)
    const rMax = Math.max(dragStart.row, dragEnd.row)
    const cMin = Math.min(dragStart.col, dragEnd.col)
    const cMax = Math.max(dragStart.col, dragEnd.col)

    // Check if new selection overlaps with any existing cells
    if (!checkOverlap(rMin, cMin, rMax, cMax)) {
      setMergedCells(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          row: rMin,
          col: cMin,
          rowSpan: rMax - rMin + 1,
          colSpan: cMax - cMin + 1
        }
      ])
    } else {
      messageApi?.error('选定区域与已画格子重叠，请重新绘制')
    }

    setDragStart(null)
    setDragEnd(null)
  }

  const handleDeleteCell = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMergedCells(prev => prev.filter(c => c.id !== id))
  }

  const handleConfirmSave = () => {
    const name = templateName.trim()
    if (!name) {
      messageApi?.error('请输入模板名称')
      return
    }
    if (mergedCells.length === 0) {
      messageApi?.error('请至少绘制一个合并单元格')
      return
    }
    onSave(name, mergedCells.map(c => ({
      row: c.row,
      col: c.col,
      rowSpan: c.rowSpan,
      colSpan: c.colSpan
    })), pageFormat, pageOrientation)
  }

  // Render 10x10 preview dots
  const gridCells = []
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      gridCells.push(
        <div
          key={`${r}-${c}`}
          className="designer-cell-dot"
          style={{ aspectRatio: 'auto' }}
          onMouseDown={() => handleCellMouseDown(r, c)}
          onMouseEnter={() => handleCellMouseEnter(r, c)}
        />
      )
    }
  }

  // Compute grid position helper for drawing overlay cells
  const getCellPositionStyle = (cell: { row: number; col: number; rowSpan: number; colSpan: number }): React.CSSProperties => {
    return {
      gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
      gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
      width: '100%',
      height: '100%',
    }
  }

  // Calculate current drag preview box grid position
  let dragPreviewStyle: React.CSSProperties | null = null
  if (dragStart && dragEnd) {
    const rMin = Math.min(dragStart.row, dragEnd.row)
    const rMax = Math.max(dragStart.row, dragEnd.row)
    const cMin = Math.min(dragStart.col, dragEnd.col)
    const cMax = Math.max(dragStart.col, dragEnd.col)
    
    dragPreviewStyle = {
      gridRow: `${rMin + 1} / span ${rMax - rMin + 1}`,
      gridColumn: `${cMin + 1} / span ${cMax - cMin + 1}`,
      width: '100%',
      height: '100%',
    }
  }

  const designerStyle = useMemo<React.CSSProperties>(() => {
    const isPortrait = pageOrientation === 'portrait'
    const isPPT = pageFormat === 'ppt'
    
    let ratio = '1 / 1'
    if (isPPT) {
      ratio = isPortrait ? '9 / 16' : '16 / 9'
    } else {
      ratio = isPortrait ? '1 / 1.4142' : '1.4142 / 1'
    }
    
    return {
      aspectRatio: ratio,
      maxWidth: isPortrait ? '280px' : '420px',
      height: 'auto',
      transition: 'all 0.2s ease',
    }
  }, [pageFormat, pageOrientation])

  return (
    <Modal
      title="设计自定义排版模板"
      open={visible}
      onCancel={onClose}
      onOk={handleConfirmSave}
      okText={okText}
      cancelText="关闭"
      width={480}
      destroyOnClose
      footer={step === 1 ? null : undefined}
    >
      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
          <div>
            <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
              第一步：选择页面规格
            </Typography.Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div 
                onClick={() => setPageFormat('a4')}
                style={{
                  border: `2px solid ${pageFormat === 'a4' ? 'var(--accent)' : 'var(--border)'}`,
                  background: pageFormat === 'a4' ? 'var(--accent-bg)' : '#ffffff',
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: pageFormat === 'a4' ? 'var(--shadow-md)' : 'none',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: pageFormat === 'a4' ? 'var(--accent)' : 'var(--text-primary)' }}>A4 纸张</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>适合学术期刊、学位论文排版</div>
              </div>

              <div 
                onClick={() => setPageFormat('ppt')}
                style={{
                  border: `2px solid ${pageFormat === 'ppt' ? 'var(--accent)' : 'var(--border)'}`,
                  background: pageFormat === 'ppt' ? 'var(--accent-bg)' : '#ffffff',
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: pageFormat === 'ppt' ? 'var(--shadow-md)' : 'none',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📺</div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: pageFormat === 'ppt' ? 'var(--accent)' : 'var(--text-primary)' }}>PPT 幻灯片</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>适合学术汇报、16:9 比例演示</div>
              </div>
            </div>
          </div>

          <div>
            <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
              第二步：选择纸张方向
            </Typography.Text>
            <Radio.Group 
              value={pageOrientation} 
              onChange={e => setPageOrientation(e.target.value)} 
              optionType="button"
              buttonStyle="solid"
              style={{ width: '100%', display: 'flex', gap: '10px' }}
            >
              <Radio.Button value="portrait" style={{ flex: 1, textAlign: 'center', height: '40px', lineHeight: '38px', borderRadius: '8px' }}>
                ↕️ 纵向 (Portrait)
              </Radio.Button>
              <Radio.Button value="landscape" style={{ flex: 1, textAlign: 'center', height: '40px', lineHeight: '38px', borderRadius: '8px' }}>
                ↔️ 横向 (Landscape)
              </Radio.Button>
            </Radio.Group>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              type="primary" 
              size="large"
              onClick={() => setStep(2)}
              style={{ width: '100%', height: '44px', borderRadius: '8px', fontWeight: 'bold' }}
            >
              下一步：开始画格子 👉
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ marginBottom: 6, display: 'block' }}>
              模板名称
            </Typography.Text>
            <Input
              placeholder="请输入自定义模板名称..."
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tag color="blue" style={{ fontSize: '11px', padding: '2px 8px', margin: 0 }}>
              🎯 规格：{pageFormat === 'a4' ? '📄 A4 纸张' : '📺 PPT 幻灯片'} ({pageOrientation === 'portrait' ? '纵向' : '横向'})
            </Tag>
            {initialMergedCells.length === 0 && (
              <Button type="link" size="small" onClick={() => setStep(1)} style={{ padding: 0 }}>
                修改规格
              </Button>
            )}
          </div>

          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 12, display: 'block' }}>
            💡 <b>绘制指南：</b>在下方 10×10 的画板上按住鼠标左键并拖拽，可以画出跨越任意行列合并的“大格子”。点击格子右上角的 <b>×</b> 可以删除它。其他未画格子的空白区域会自动填充为 1×1 的普通小格子。
          </Typography.Text>

          <div
            className="custom-grid-designer"
            style={designerStyle}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Background Dots Grid */}
            <div className="designer-canvas-grid">
              {gridCells}
            </div>

            {/* Overlay Layer for Drawn Cells & Preview */}
            <div className="designer-canvas-grid-overlay">
              {mergedCells.map((cell) => (
                <div
                  key={cell.id}
                  className="designer-drawn-cell"
                  style={getCellPositionStyle(cell)}
                >
                  <span className="designer-drawn-cell-label">
                    {cell.rowSpan}×{cell.colSpan}
                  </span>
                  <button
                    className="designer-drawn-cell-delete"
                    onClick={(e) => handleDeleteCell(cell.id, e)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {dragPreviewStyle && (
                <div className="designer-preview-cell" style={dragPreviewStyle} />
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

/* ─── Template Properties Panel ─── */
interface TemplatePropertiesPanelProps {
  template: TemplateDefinition
  isCustom: boolean
  onRename?: (id: string, newName: string) => void
  onDelete?: (id: string) => void
  onSaveCurrentAsTemplate?: (name: string) => void
  onUpdateSettings?: (settings: Partial<ProjectData>) => void
  onEditLayout?: () => void
  messageApi?: any
}

function TemplatePropertiesPanel({
  template,
  isCustom,
  onRename,
  onDelete,
  onSaveCurrentAsTemplate,
  onUpdateSettings,
  onEditLayout,
  messageApi,
}: TemplatePropertiesPanelProps) {
  const { currentProject, updateGlobalSettings: storeUpdateSettings } = useProjectStore()
  const [name, setName] = useState(template.name)
  const [isDraggingPropsGap, setIsDraggingPropsGap] = useState(false)

  useEffect(() => {
    setName(template.name)
  }, [template.id, template.name])

  const handleBlur = () => {
    const trimmed = name.trim()
    if (trimmed && onRename && trimmed !== template.name) {
      onRename(template.id, trimmed)
    }
  }

  const handleSettingsChange = (settings: Partial<ProjectData>) => {
    if (onUpdateSettings) {
      onUpdateSettings(settings)
    } else {
      storeUpdateSettings(settings)
    }
  }

  // Handle saving current project layout as a new custom template
  const handleSaveAsTemplateClick = () => {
    if (!onSaveCurrentAsTemplate || !currentProject) return
    Modal.confirm({
      title: '另存为自定义模板',
      content: (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: '12px' }}>这将把当前项目的网格及单元格合并样式保存为新的模板。请输入模板名称：</p>
          <Input id="save-as-tpl-name-input" defaultValue={`自定义排版-${currentProject.grid.rows}x${currentProject.grid.cols}`} />
        </div>
      ),
      okText: '确认保存',
      cancelText: '取消',
      onOk: () => {
        const input = document.getElementById('save-as-tpl-name-input') as HTMLInputElement
        const nameVal = input ? input.value.trim() : ''
        if (nameVal) {
          onSaveCurrentAsTemplate(nameVal)
        } else {
          messageApi?.error('保存失败：模板名称不能为空')
        }
      }
    })
  }

  // Handle deletion of this custom template with confirmation
  const handleDeleteClick = () => {
    if (!onDelete) return
    Modal.confirm({
      title: '确认删除自定义模板？',
      content: `模板 "${template.name}" 将会被永久删除，此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        onDelete(template.id)
      }
    })
  }

  // Fallbacks for global configurations
  const chineseFont = currentProject?.globalChineseFont || 'Microsoft YaHei'
  const westernFont = currentProject?.globalWesternFont || '"Times New Roman"'
  const titleAlign = currentProject?.globalTitleAlign || 'left'
  const noteAlign = currentProject?.globalNoteAlign || 'center'
  const autoNumber = currentProject?.globalAutoNumber || '123'

  return (
    <div className="props-panel">
      {/* Direct Template Name Input without frames */}
      <div style={{ marginBottom: '8px', padding: '0 4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
          名称 {isCustom ? '(可修改)' : '(预设模板)'}
        </span>
        {isCustom ? (
          <Input
            size="middle"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            onPressEnter={handleBlur}
            placeholder="修改模板名称..."
          />
        ) : (
          <Input
            size="middle"
            value={template.name}
            disabled
            style={{ color: 'var(--text-primary)', fontWeight: '500', background: '#f8fafc' }}
          />
        )}
      </div>

      {/* Global Typography Settings */}
      {currentProject && (
        <>
          <div className="props-section">
            <div className="props-section-title">
              📖 字体
            </div>
            
            <div className="props-field" style={{ marginBottom: '10px' }}>
              <span className="props-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                中文
              </span>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={chineseFont}
                onChange={(val) => handleSettingsChange({ globalChineseFont: val })}
                options={[
                  { value: 'Microsoft YaHei', label: '微软雅黑 (YaHei)' },
                  { value: 'SimSun', label: '宋体 (SimSun)' },
                  { value: 'SimHei', label: '黑体 (SimHei)' },
                  { value: 'KaiTi', label: '楷体 (KaiTi)' },
                  { value: 'system-ui', label: '系统默认字体' },
                ]}
              />
            </div>

            <div className="props-field">
              <span className="props-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                英文/西文
              </span>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={westernFont}
                onChange={(val) => handleSettingsChange({ globalWesternFont: val })}
                options={[
                  { value: '"Times New Roman"', label: 'Times New Roman' },
                  { value: 'Arial', label: 'Arial' },
                  { value: 'Georgia', label: 'Georgia' },
                  { value: 'Courier New', label: 'Courier New' },
                  { value: 'Helvetica', label: 'Helvetica' },
                ]}
              />
            </div>
          </div>

          <div className="props-section">
            <div className="props-section-title">
              📐 对齐
            </div>
            
            <div className="props-field" style={{ marginBottom: '10px' }}>
              <span className="props-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                标题
              </span>
              <Radio.Group
                size="small"
                value={titleAlign}
                onChange={(e) => handleSettingsChange({ globalTitleAlign: e.target.value })}
                style={{ width: '100%' }}
              >
                <Radio.Button value="left" style={{ width: '33.3%', textAlign: 'center' }}>靠左</Radio.Button>
                <Radio.Button value="center" style={{ width: '33.3%', textAlign: 'center' }}>居中</Radio.Button>
                <Radio.Button value="right" style={{ width: '33.4%', textAlign: 'center' }}>靠右</Radio.Button>
              </Radio.Group>
            </div>

            <div className="props-field">
              <span className="props-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                注释
              </span>
              <Radio.Group
                size="small"
                value={noteAlign}
                onChange={(e) => handleSettingsChange({ globalNoteAlign: e.target.value })}
                style={{ width: '100%' }}
              >
                <Radio.Button value="left" style={{ width: '33.3%', textAlign: 'center' }}>靠左</Radio.Button>
                <Radio.Button value="center" style={{ width: '33.3%', textAlign: 'center' }}>居中</Radio.Button>
                <Radio.Button value="right" style={{ width: '33.4%', textAlign: 'center' }}>靠右</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          <div className="props-section">
            <div className="props-section-title">
              🔢 编号
            </div>
            <div className="props-field">
              <Select
                size="small"
                style={{ width: '100%' }}
                value={autoNumber}
                onChange={(val) => handleSettingsChange({ globalAutoNumber: val })}
                options={[
                  { value: '123', label: '🔢 数字 (1, 2, 3...)' },
                  { value: 'abc', label: '🔠 大写字母 (A, B, C...)' },
                  { value: 'abc_lowercase', label: '🔤 小写字母 (a, b, c...)' },
                  { value: 'roman', label: '🏛️ 罗马数字 (I, II, III...)' },
                  { value: 'manual', label: '✍️ 手动编号 (无前缀)' },
                ]}
              />
            </div>
          </div>
        </>
      )}

      {/* 📐 间距 */}
      {currentProject && (
        <div className="props-section" style={{ marginTop: '4px' }}>
          <div className="props-section-title">
            <span>📐 间距</span>
          </div>
          <div className="props-gap-slider" style={{ padding: '0 8px' }}>
            <Slider
              min={0}
              max={5}
              step={1}
              value={(() => {
                const gap = currentProject.gridGap !== undefined ? currentProject.gridGap : 12;
                if (gap >= 12) return 5;
                if (gap >= 9.6) return 4;
                if (gap >= 7.2) return 3;
                if (gap >= 4.8) return 2;
                if (gap >= 2.4) return 1;
                return 0;
              })()}
              onChange={(val) => {
                let newGap = 12;
                if (val === 4) newGap = 9.6;
                else if (val === 3) newGap = 7.2;
                else if (val === 2) newGap = 4.8;
                else if (val === 1) newGap = 2.4;
                else if (val === 0) newGap = 0;
                handleSettingsChange({ gridGap: newGap });
              }}
              onChangeStart={() => setIsDraggingPropsGap(true)}
              onChangeComplete={() => setIsDraggingPropsGap(false)}
              tooltip={{
                open: isDraggingPropsGap,
                formatter: (val) => {
                  if (val === 5) return '正常';
                  if (val === 4) return '还可以';
                  if (val === 3) return '有点窄';
                  if (val === 2) return '嗯？';
                  if (val === 1) return '你确定';
                  return '不管了';
                },
                placement: 'top',
                overlayClassName: 'props-gap-tooltip',
                getPopupContainer: (node) => node.parentElement || document.body,
              }}
            />
          </div>
        </div>
      )}

      {/* Save Layout and Delete Template Actions (Horizontal, icon-only) */}
      <div style={{ marginTop: '16px', padding: '0 4px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isCustom && onEditLayout && (
            <Tooltip title="编辑网格布局 (大小/范围)">
              <Button
                type="default"
                size="middle"
                icon={<EditOutlined style={{ fontSize: '17px' }} />}
                onClick={onEditLayout}
                style={{ flex: 1, borderColor: 'var(--accent)', color: 'var(--accent)' }}
              />
            </Tooltip>
          )}
          {currentProject && (
            <Tooltip title="将当前布局另存为模板">
              <Button
                type="primary"
                ghost
                size="middle"
                icon={<SaveOutlined style={{ fontSize: '17px' }} />}
                onClick={handleSaveAsTemplateClick}
                style={{ flex: 1 }}
              />
            </Tooltip>
          )}
          {isCustom && (
            <Tooltip title="删除该自定义模板">
              <Button
                danger
                size="middle"
                icon={<DeleteOutlined style={{ fontSize: '17px' }} />}
                onClick={handleDeleteClick}
                style={{ flex: 1 }}
              />
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}

