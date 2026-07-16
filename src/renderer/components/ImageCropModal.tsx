import React, { useState, useEffect, useCallback } from 'react'
import { Modal, Button, Switch, Slider, Space, Row, Col, Divider, Typography, Tooltip } from 'antd'
import {
  UndoOutlined,
  UndoOutlined as RotateLeftIcon,
  RedoOutlined as RotateRightIcon,
  PictureOutlined,
  BgColorsOutlined,
  ScissorOutlined,
} from '@ant-design/icons'
import './ImageCropModal.css'

const { Text } = Typography

interface ImageEdits {
  grayscale: boolean
  rotation: number
  crop: { x: number; y: number; width: number; height: number } | null
}

interface ImageCropModalProps {
  visible: boolean
  imageUrl: string
  initialEdits: ImageEdits
  onClose: () => void
  onSave: (edits: ImageEdits) => void
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  visible,
  imageUrl,
  initialEdits,
  onClose,
  onSave,
}) => {
  const [grayscale, setGrayscale] = useState(false)
  const [rotation, setRotation] = useState(0)

  // Sliders represent the margins cropped from each edge (0 to 80%)
  const [cropLeft, setCropLeft] = useState(0)
  const [cropRight, setCropRight] = useState(0)
  const [cropTop, setCropTop] = useState(0)
  const [cropBottom, setCropBottom] = useState(0)

  // Load and translate initial edits
  useEffect(() => {
    if (visible) {
      setGrayscale(initialEdits.grayscale)
      setRotation(initialEdits.rotation || 0)

      if (initialEdits.crop) {
        setCropLeft(initialEdits.crop.x)
        setCropTop(initialEdits.crop.y)
        setCropRight(100 - initialEdits.crop.x - initialEdits.crop.width)
        setCropBottom(100 - initialEdits.crop.y - initialEdits.crop.height)
      } else {
        setCropLeft(0)
        setCropRight(0)
        setCropTop(0)
        setCropBottom(0)
      }
    }
  }, [visible, initialEdits])

  // Reset to original settings
  const handleReset = useCallback(() => {
    setGrayscale(false)
    setRotation(0)
    setCropLeft(0)
    setCropRight(0)
    setCropTop(0)
    setCropBottom(0)
  }, [])

  // Cycle rotation: rotate right 90 degrees
  const handleRotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  // Rotate left 90 degrees
  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360)
  }, [])

  const handleSave = useCallback(() => {
    // Check if there is actual cropping
    const hasCrop = cropLeft > 0 || cropRight > 0 || cropTop > 0 || cropBottom > 0
    const cropVal = hasCrop
      ? {
          x: cropLeft,
          y: cropTop,
          width: 100 - cropLeft - cropRight,
          height: 100 - cropTop - cropBottom,
        }
      : null

    onSave({
      grayscale,
      rotation,
      crop: cropVal,
    })
    onClose()
  }, [grayscale, rotation, cropLeft, cropRight, cropTop, cropBottom, onSave, onClose])

  return (
    <Modal
      title={
        <Space>
          <span role="img" aria-label="image-edit">
            🎨
          </span>
          <span>图片编辑与裁剪</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={950}
      className="image-crop-modal"
      destroyOnClose
      footer={
        <Row justify="space-between" align="middle" style={{ width: '100%' }}>
          <Col>
            <Button icon={<UndoOutlined />} onClick={handleReset}>
              重置修改
            </Button>
          </Col>
          <Col>
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button type="primary" onClick={handleSave}>
                应用并保存
              </Button>
            </Space>
          </Col>
        </Row>
      }
    >
      <div className="image-crop-layout">
        {/* Left Column: Interactive Preview */}
        <div className="image-crop-preview-container">
          <div className="image-crop-wrapper">
            <img
              src={imageUrl}
              alt="Crop preview target"
              className="image-crop-target"
              style={{
                filter: grayscale ? 'grayscale(100%)' : 'none',
                transform: `rotate(${rotation}deg)`,
              }}
            />
            {/* The visual dotted crop frame overlaid */}
            <div
              className="crop-active-box"
              style={{
                left: `${cropLeft}%`,
                top: `${cropTop}%`,
                right: `${cropRight}%`,
                bottom: `${cropBottom}%`,
              }}
            >
              <div className="crop-grid-lines" />
            </div>
          </div>
        </div>

        {/* Right Column: Precision Sliders and Settings */}
        <div className="image-crop-controls">
          {/* Section: Colors */}
          <div className="control-group">
            <div className="control-group-title">
              <BgColorsOutlined /> 色彩调整
            </div>
            <div className="switch-row">
              <Text>改为黑白 (Grayscale)</Text>
              <Switch checked={grayscale} onChange={setGrayscale} />
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* Section: Rotation */}
          <div className="control-group">
            <div className="control-group-title">
              <PictureOutlined /> 方向旋转
            </div>
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Button
                  block
                  icon={<RotateLeftIcon />}
                  onClick={handleRotateLeft}
                >
                  向左旋转 90°
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  block
                  icon={<RotateRightIcon />}
                  onClick={handleRotateRight}
                >
                  向右旋转 90°
                </Button>
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* Section: Cropping */}
          <div className="control-group">
            <div className="control-group-title">
              <ScissorOutlined /> 精确裁剪 (外边距比例)
            </div>

            {/* Top Crop */}
            <div className="slider-row">
              <div className="slider-label">
                <span>上方裁切</span>
                <span className="slider-value">{cropTop}%</span>
              </div>
              <Slider
                min={0}
                max={Math.min(80, 100 - cropBottom - 10)}
                value={cropTop}
                onChange={setCropTop}
                tooltip={{ formatter: (v) => `${v}%` }}
              />
            </div>

            {/* Bottom Crop */}
            <div className="slider-row">
              <div className="slider-label">
                <span>下方裁切</span>
                <span className="slider-value">{cropBottom}%</span>
              </div>
              <Slider
                min={0}
                max={Math.min(80, 100 - cropTop - 10)}
                value={cropBottom}
                onChange={setCropBottom}
                tooltip={{ formatter: (v) => `${v}%` }}
              />
            </div>

            {/* Left Crop */}
            <div className="slider-row">
              <div className="slider-label">
                <span>左侧裁切</span>
                <span className="slider-value">{cropLeft}%</span>
              </div>
              <Slider
                min={0}
                max={Math.min(80, 100 - cropRight - 10)}
                value={cropLeft}
                onChange={setCropLeft}
                tooltip={{ formatter: (v) => `${v}%` }}
              />
            </div>

            {/* Right Crop */}
            <div className="slider-row">
              <div className="slider-label">
                <span>右侧裁切</span>
                <span className="slider-value">{cropRight}%</span>
              </div>
              <Slider
                min={0}
                max={Math.min(80, 100 - cropLeft - 10)}
                value={cropRight}
                onChange={setCropRight}
                tooltip={{ formatter: (v) => `${v}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ImageCropModal
