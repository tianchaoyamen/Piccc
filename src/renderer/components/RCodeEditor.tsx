import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Modal, Button, Spin, Alert, Space, Typography, Empty, Tooltip } from 'antd'
import {
  PlayCircleOutlined,
  SaveOutlined,
  CloseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import { r } from '@codemirror/legacy-modes/mode/r'
import { oneDark } from '@codemirror/theme-one-dark'
import './RCodeEditor.css'

declare global {
  interface Window {
    picccAPI?: any
  }
}

const { Text } = Typography

interface RCodeEditorProps {
  visible: boolean
  initialCode: string
  cachedImage: string | null
  cellId: string
  onClose: () => void
  onSave: (code: string, imageDataUrl: string | null) => void
}

const RCodeEditor: React.FC<RCodeEditorProps> = ({
  visible,
  initialCode,
  cachedImage,
  cellId,
  onClose,
  onSave,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(cachedImage)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [executionTime, setExecutionTime] = useState<number | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setImageDataUrl(cachedImage)
      setError(null)
      setExecutionTime(null)
    }
  }, [visible, cachedImage])

  // Initialize CodeMirror
  useEffect(() => {
    if (!visible || !editorRef.current || viewRef.current) return

    const state = EditorState.create({
      doc: initialCode || '# Write your R code here\nlibrary(ggplot2)\n\n',
      extensions: [
        basicSetup,
        StreamLanguage.define(r),
        oneDark,
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': {
            fontFamily: '"Fira Code", "JetBrains Mono", monospace',
          },
        }),
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [visible])

  // Update editor content when initialCode changes
  useEffect(() => {
    if (viewRef.current && initialCode !== undefined) {
      const currentContent = viewRef.current.state.doc.toString()
      if (currentContent !== initialCode) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: initialCode,
          },
        })
      }
    }
  }, [initialCode])

  const handleRun = useCallback(async () => {
    if (!viewRef.current) return
    const code = viewRef.current.state.doc.toString()
    if (!code.trim()) {
      setError('请输入 R 代码')
      return
    }

    setIsRunning(true)
    setError(null)
    const startTime = Date.now()

    try {
      if (!window.picccAPI?.r?.execute) {
        setError('R 执行接口未就绪，请确保在桌面应用中运行')
        return
      }
      const result = await window.picccAPI.r.execute(code, 6, 5, 300)
      if (result.success) {
        setImageDataUrl(result.dataUrl)
        setError(null)
      } else {
        setError(result.error || 'R 代码执行失败')
      }
    } catch (err: any) {
      setError(err.message || '执行 R 代码时发生未知错误')
    } finally {
      setIsRunning(false)
      setExecutionTime((Date.now() - startTime) / 1000)
    }
  }, [])

  const handleSave = useCallback(() => {
    const code = viewRef.current
      ? viewRef.current.state.doc.toString()
      : initialCode
    onSave(code, imageDataUrl)
    onClose()
  }, [imageDataUrl, initialCode, onSave, onClose])

  return (
    <Modal
      title={
        <Space>
          <span role="img" aria-label="chart">
            📊
          </span>
          <span>R 代码编辑器</span>
          {cellId && (
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {cellId}
            </Text>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={Math.min(900, window.innerWidth * 0.9)}
      className="r-editor-modal"
      destroyOnClose
      footer={
        <Space>
          <Button icon={<CloseOutlined />} onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
          >
            保存并关闭
          </Button>
        </Space>
      }
    >
      <div className="r-editor-layout">
        {/* Left panel: Code Editor */}
        <div className="r-editor-left">
          <div className="r-editor-toolbar">
            <Tooltip title="运行代码 (执行 R 脚本并生成图表)">
              <Button
                className="r-run-btn"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={handleRun}
                loading={isRunning}
                disabled={isRunning}
              >
                运行
              </Button>
            </Tooltip>
            {isRunning && (
              <Text style={{ color: '#abb2bf', fontSize: 12 }}>
                正在执行...
              </Text>
            )}
          </div>
          <div className="r-editor-codemirror" ref={editorRef} />
        </div>

        {/* Right panel: Preview */}
        <div className="r-editor-right">
          {isRunning ? (
            <div className="r-editor-spin">
              <Spin size="large" />
              <Text type="secondary">正在执行 R 代码...</Text>
            </div>
          ) : imageDataUrl ? (
            <>
              <img
                src={imageDataUrl}
                alt="R 图表输出"
                className="r-preview-image"
              />
              {executionTime !== null && (
                <div className="r-preview-meta">
                  <ClockCircleOutlined />
                  <span>执行耗时 {executionTime.toFixed(2)} 秒</span>
                </div>
              )}
            </>
          ) : (
            <div className="r-preview-empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="运行 R 代码以预览图表"
              />
            </div>
          )}

          {error && (
            <div className="r-error-box">
              <Alert
                message="执行错误"
                description={error}
                type="error"
                showIcon
                closable
                onClose={() => setError(null)}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default RCodeEditor
