import React, { useState, useMemo, useCallback } from 'react'
import { Modal, Button, Radio, Slider, Space, Typography, Card, Row, Col, message } from 'antd'
import {
  FileImageOutlined,
  ColumnWidthOutlined,
  DashboardOutlined,
  DownloadOutlined,
  CloseOutlined
} from '@ant-design/icons'
import type { ProjectData } from '../types/project'
import './ExportModal.css'

const { Text } = Typography

interface ExportModalProps {
  visible: boolean
  project: ProjectData | null
  onClose: () => void
}

declare global {
  interface Window {
    picccAPI?: any
  }
}

const ExportModal: React.FC<ExportModalProps> = ({ visible, project, onClose }) => {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'tiff'>('png')
  const [dpi, setDpi] = useState<150 | 300>(300)
  const [widthInches, setWidthInches] = useState<number>(8)
  const [isExporting, setIsExporting] = useState(false)

  // Calculate grid dimensions
  const heightInches = useMemo(() => {
    if (!project) return 8
    const isPortrait = project.pageOrientation === 'portrait'
    return Number((isPortrait ? widthInches * 1.4142 : widthInches / 1.4142).toFixed(2))
  }, [project, widthInches])

  const pixels = useMemo(() => {
    return {
      w: Math.round(widthInches * dpi),
      h: Math.round(heightInches * dpi)
    }
  }, [widthInches, heightInches, dpi])

  const handleExport = useCallback(async () => {
    if (!project) return
    setIsExporting(true)

    try {
      // 1. Render canvas dynamically
      const dataUrl = await exportLayoutToCanvas(project, { format, dpi, widthInches })

      // 2. Trigger electron save file dialog and write binary
      if (window.picccAPI?.export?.render) {
        // Send base64 data to main process to write to file
        const result = await window.picccAPI.export.render({
          dataUrl,
          format,
          defaultName: project.name || 'figure_layout',
          defaultExportPath: project.defaultExportPath
        })

        if (result.success) {
          message.success('图表排版导出成功！')
          onClose()
        } else if (!result.canceled) {
          message.error(`导出失败: ${result.error}`)
        }
      } else {
        // Browser fallback (simulate link download for dev review)
        const link = document.createElement('a')
        link.download = `${project.name || 'layout'}.${format}`
        link.href = dataUrl
        link.click()
        message.success('已通过浏览器下载')
        onClose()
      }
    } catch (err: any) {
      console.error(err)
      message.error(`排版渲染出错: ${err.message || err}`)
    } finally {
      setIsExporting(false)
    }
  }, [project, format, dpi, widthInches, onClose])

  return (
    <Modal
      title={
        <Space>
          <span role="img" aria-label="export">
            📤
          </span>
          <span>导出选项</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      className="export-modal"
      destroyOnClose
      footer={
        <Space>
          <Button icon={<CloseOutlined />} onClick={onClose} disabled={isExporting}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={isExporting}
            disabled={!project}
          >
            导出排版图
          </Button>
        </Space>
      }
    >
      <div className="export-modal-body">
        {/* Format Section */}
        <div className="export-form-item">
          <div className="export-form-label">
            <FileImageOutlined /> 导出格式
          </div>
          <Radio.Group value={format} onChange={(e) => setFormat(e.target.value)}>
            <Radio.Button value="png">PNG (无损压缩)</Radio.Button>
            <Radio.Button value="jpeg">JPEG (照片质量)</Radio.Button>
            <Radio.Button value="tiff">TIFF (印刷级无损)</Radio.Button>
          </Radio.Group>
        </div>

        {/* DPI Section */}
        <div className="export-form-item">
          <div className="export-form-label">
            <DashboardOutlined /> 分辨率 (DPI)
          </div>
          <Radio.Group value={dpi} onChange={(e) => setDpi(e.target.value)}>
            <Radio value={150}>150 DPI (用于 PPT 幻灯片展示)</Radio>
            <Radio value={300}>300 DPI (期刊正式论文标准 - 印刷级)</Radio>
          </Radio.Group>
        </div>

        {/* Width Section */}
        <div className="export-form-item">
          <div className="export-form-label">
            <ColumnWidthOutlined /> 物理宽度 (英寸)
          </div>
          <Row gutter={16} align="middle">
            <Col span={16}>
              <Slider
                min={3}
                max={16}
                step={0.5}
                value={widthInches}
                onChange={setWidthInches}
                tooltip={{ formatter: (v) => v ? `${v} 英寸 (${Math.round(v * 2.54)} cm)` : '' }}
              />
            </Col>
            <Col span={8}>
              <Text strong>{widthInches} 英寸</Text>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                ({Math.round(widthInches * 2.54)} 厘米)
              </Text>
            </Col>
          </Row>
        </div>

        {/* Info Card */}
        {project && (
          <Card size="small" className="export-preview-card">
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  输出分辨率尺寸
                </Text>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                  {pixels.w} × {pixels.h} 像素
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  物理排版规格
                </Text>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                  {widthInches} × {heightInches} 英寸
                </div>
              </Col>
            </Row>
            <div className="export-info-text" style={{ marginTop: 8 }}>
              当前网格比例：
              <span className="export-info-highlight">
                {project.grid.rows} : {project.grid.cols}
              </span>
              ，导出时将自动保持网格格子的等宽排版。
            </div>
          </Card>
        )}
      </div>
    </Modal>
  )
}

// ─── Core Layout Exporter Canvas Renderer ──────────────────────────────────────

function drawImageContainWithRotation(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number
) {
  const isSwapped = (rotation / 90) % 2 !== 0
  const imgW = isSwapped ? img.height : img.width
  const imgH = isSwapped ? img.width : img.height

  const imgRatio = imgW / imgH
  const containerRatio = w / h

  let drawW = w
  let drawH = h

  if (imgRatio > containerRatio) {
    drawW = w
    drawH = w / imgRatio
  } else {
    drawH = h
    drawW = h * imgRatio
  }

  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  if (rotation) {
    ctx.rotate((rotation * Math.PI) / 180)
  }
  const scale = isSwapped ? drawW / img.height : drawW / img.width
  const origDrawW = img.width * scale
  const origDrawH = img.height * scale
  ctx.drawImage(img, -origDrawW / 2, -origDrawH / 2, origDrawW, origDrawH)
  ctx.restore()
}

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

async function exportLayoutToCanvas(
  project: ProjectData,
  options: { format: 'png' | 'jpeg' | 'tiff'; dpi: 150 | 300; widthInches: number }
): Promise<string> {
  const { format, dpi, widthInches } = options
  const grid = project.grid

  const scale = dpi
  const isPortrait = project.pageOrientation === 'portrait'
  const isPPT = project.pageFormat === 'ppt'
  const ratio = isPPT ? (16 / 9) : 1.4142
  const heightInches = isPortrait ? widthInches * ratio : widthInches / ratio

  const canvasWidth = Math.round(widthInches * scale)
  const canvasHeight = Math.round(heightInches * scale)

  // 0.35 inch margins on A4 paper
  const marginPx = Math.round(0.35 * scale)
  const printableWidthPx = canvasWidth - 2 * marginPx
  const printableHeightPx = canvasHeight - 2 * marginPx

  const cellWidthPx = printableWidthPx / grid.cols
  const cellHeightPx = printableHeightPx / grid.rows

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建排版 Canvas 画布')

  // Fill canvas with white background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Sort cells in layout order for numbering
  const sortedCells = [...grid.cells]
    .sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      return a.col - b.col
    })
    .filter((c) => c.content.type !== 'empty')

  // Draw cells
  for (const cell of grid.cells) {
    const x = marginPx + cell.col * cellWidthPx
    const y = marginPx + cell.row * cellHeightPx
    const w = cell.colSpan * cellWidthPx
    const h = cell.rowSpan * cellHeightPx

    // Calculate auto numbering prefix
    const cellIndex = sortedCells.findIndex((c) => c.id === cell.id)
    const autoNumberMode = project.globalAutoNumber || '123'
    let prefix = ''
    if (autoNumberMode !== 'manual' && cellIndex !== -1) {
      if (autoNumberMode === 'abc') {
        prefix = String.fromCharCode(65 + cellIndex)
      } else if (autoNumberMode === 'abc_lowercase') {
        prefix = String.fromCharCode(97 + cellIndex)
      } else if (autoNumberMode === '123') {
        prefix = String(cellIndex + 1)
      } else if (autoNumberMode === 'roman') {
        prefix = getRomanNumeral(cellIndex + 1)
      }
    }

    const hasTitle = prefix.length > 0 || (cell.title && cell.title.text.trim().length > 0)
    const hasNote = cell.note && cell.note.text.trim().length > 0

    // Font size scaling (point to pixels at current export DPI)
    const titleSizePt = cell.title?.style?.fontSize || 12
    const titleSizePx = Math.round(titleSizePt * (dpi / 72))
    const noteSizePt = cell.note?.style?.fontSize || 11
    const noteSizePx = Math.round(noteSizePt * (dpi / 72))

    // Reserve heights dynamically based on font size or cell height proportion
    const titleHeight = hasTitle ? Math.max(0.08 * h, titleSizePx * 1.5) : 0
    const noteHeight = hasNote ? Math.max(0.08 * h, noteSizePx * 1.5) : 0
    const contentY = y + titleHeight
    const contentH = h - titleHeight - noteHeight

    // Combine Western and Chinese fonts
    const westFont = project.globalWesternFont || '"Times New Roman"'
    const chinFont = project.globalChineseFont || 'Microsoft YaHei'
    const fontFamily = `${westFont}, ${chinFont}, sans-serif`

    const titleAlign = cell.title?.style?.fontFamily ? 'center' : (project.globalTitleAlign || 'left')
    const noteAlign = cell.note?.style?.fontFamily ? 'center' : (project.globalNoteAlign || 'center')

    // Draw Title
    if (hasTitle) {
      ctx.fillStyle = '#000000'
      const titleY = y + titleHeight / 2
      let startX = x + w / 2
      if (titleAlign === 'left') {
        startX = x + Math.round(4 * (scale / 72))
      } else if (titleAlign === 'right') {
        startX = x + w - Math.round(4 * (scale / 72))
      }

      ctx.textBaseline = 'middle'
      const titleText = cell.title?.text || ''

      if (prefix && titleText) {
        ctx.textAlign = 'left'
        
        ctx.font = `bold ${titleSizePx}px ${fontFamily}`
        const prefixWidth = ctx.measureText(prefix + ' ').width
        
        ctx.font = `${titleSizePx}px ${fontFamily}`
        const textWidth = ctx.measureText(titleText).width
        const totalWidth = prefixWidth + textWidth

        let drawStartX = startX
        if (titleAlign === 'center') {
          drawStartX = startX - totalWidth / 2
        } else if (titleAlign === 'right') {
          drawStartX = startX - totalWidth
        }

        ctx.font = `bold ${titleSizePx}px ${fontFamily}`
        ctx.fillText(prefix, drawStartX, titleY)
        ctx.font = `${titleSizePx}px ${fontFamily}`
        ctx.fillText(titleText, drawStartX + prefixWidth, titleY)
      } else if (prefix) {
        ctx.textAlign = titleAlign
        ctx.font = `bold ${titleSizePx}px ${fontFamily}`
        ctx.fillText(prefix, startX, titleY)
      } else {
        ctx.textAlign = titleAlign
        ctx.font = `${titleSizePx}px ${fontFamily}`
        ctx.fillText(titleText, startX, titleY)
      }
    }

    // Draw Note
    if (hasNote && cell.note) {
      ctx.fillStyle = '#333333'
      ctx.font = `${noteSizePx}px ${fontFamily}`
      ctx.textBaseline = 'middle'

      let noteX = x + w / 2
      if (noteAlign === 'left') {
        noteX = x + Math.round(4 * (scale / 72))
      } else if (noteAlign === 'right') {
        noteX = x + w - Math.round(4 * (scale / 72))
      }

      ctx.textAlign = noteAlign
      ctx.fillText(cell.note.text, noteX, y + h - noteHeight / 2)
    }

    // Draw Cell content
    if (cell.content.type === 'r_code' && cell.content.cachedImageBase64) {
      const img = await loadImage(cell.content.cachedImageBase64)
      drawImageContainWithRotation(ctx, img, x, contentY, w, contentH, 0)
    } else if (cell.content.type === 'image' && cell.content.originalPath) {
      const path = cell.content.originalPath.startsWith('file://')
        ? cell.content.originalPath
        : `file://${cell.content.originalPath}`
      const img = await loadImage(path)
      const edits = cell.content.edits || { grayscale: false, rotation: 0, crop: null }

      ctx.save()

      // Clip content area
      ctx.beginPath()
      ctx.rect(x, contentY, w, contentH)
      ctx.clip()

      // Grayscale filter
      if (edits.grayscale) {
        ctx.filter = 'grayscale(100%)'
      }

      // Rotation and Crop drawing
      if (edits.crop) {
        const cx = (edits.crop.x / 100) * img.width
        const cy = (edits.crop.y / 100) * img.height
        const cw = (edits.crop.width / 100) * img.width
        const ch = (edits.crop.height / 100) * img.height

        if (edits.rotation) {
          ctx.translate(x + w / 2, contentY + contentH / 2)
          ctx.rotate((edits.rotation * Math.PI) / 180)
          ctx.drawImage(img, cx, cy, cw, ch, -w / 2, -contentH / 2, w, contentH)
        } else {
          ctx.drawImage(img, cx, cy, cw, ch, x, contentY, w, contentH)
        }
      } else {
        drawImageContainWithRotation(ctx, img, x, contentY, w, contentH, edits.rotation || 0)
      }

      ctx.restore()
    }
  }

  // Render to base64
  if (format === 'tiff') {
    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
    const utif = await import('utif')
    const arrayBuffer = utif.encodeImage(imgData.data, canvasWidth, canvasHeight)
    const base64 = arrayBufferToBase64(arrayBuffer)
    return `data:image/tiff;base64,${base64}`
  } else {
    return canvas.toDataURL(`image/${format === 'jpeg' ? 'jpeg' : 'png'}`, 0.95)
  }
}

// Image Loader helper
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(new Error('图片加载失败: ' + src))
    img.src = src
  })
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export default ExportModal
