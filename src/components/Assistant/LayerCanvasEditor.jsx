import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  Canvas,
  Circle,
  Ellipse,
  FabricImage,
  FabricText,
  IText,
  Line,
  PencilBrush,
  Rect,
} from 'fabric'
import { MANGA_PAGE_HEIGHT, MANGA_PAGE_WIDTH } from '../../constants/mangaPageDimensions.js'
import { noteTaskLabel } from '../../constants/workspaceTasks.js'
import { createCanvasHistory } from './canvasHistory.js'
import { colorWithOpacity, pickColorFromCanvas } from './layerCanvasUtils.js'
import './LayerCanvasEditor.css'

const NOTE_FILL = 'rgba(230, 57, 70, 0.1)'
const NOTE_STROKE = '#e63946'

const DRAW_TOOLS = new Set(['pencil', 'brush', 'marker', 'eraser'])
const SHAPE_TOOLS = new Set(['line', 'rect', 'ellipse'])

function fitImageToPage(img) {
  const iw = img.width || 1
  const ih = img.height || 1
  const scale = Math.min(MANGA_PAGE_WIDTH / iw, MANGA_PAGE_HEIGHT / ih)
  const w = iw * scale
  const h = ih * scale
  img.set({
    scaleX: scale,
    scaleY: scale,
    left: (MANGA_PAGE_WIDTH - w) / 2,
    top: (MANGA_PAGE_HEIGHT - h) / 2,
    originX: 'left',
    originY: 'top',
  })
}

function tagObject(obj, layerId, layerType) {
  obj.set({
    layerId,
    layerType,
  })
}

function applyPaintObjectInteractivity(obj, tool, layerLocked) {
  const canSelect = tool === 'select' && !layerLocked
  obj.set({
    selectable: canSelect,
    evented: canSelect,
  })
}

function brushWidthForTool(tool, baseSize) {
  if (tool === 'pencil') return Math.max(1, baseSize * 0.55)
  if (tool === 'marker') return Math.max(2, baseSize * 1.6)
  return Math.max(1, baseSize)
}

const LayerCanvasEditor = forwardRef(function LayerCanvasEditor(
  {
    submission,
    layers,
    activeLayerId,
    activeLayerName = '',
    activeLayerColor = '#9b5de5',
    tool = 'brush',
    inputMode = 'web',
    brushColor = '#000000',
    fillColor = '#ffffff',
    brushSize = 6,
    brushOpacity = 100,
    shapeFilled = true,
    onEyedropperColor,
    onTabletStatus,
    onHistoryChange,
  },
  ref,
) {
  const hostRef = useRef(null)
  const fabricRef = useRef(null)
  const historyRef = useRef(null)
  const activeLayerRef = useRef(activeLayerId)
  const toolRef = useRef(tool)
  const shapeDraftRef = useRef(null)
  const shapeStartRef = useRef(null)
  const onHistoryChangeRef = useRef(onHistoryChange)

  activeLayerRef.current = activeLayerId
  toolRef.current = tool
  onHistoryChangeRef.current = onHistoryChange

  const recordHistoryRef = useRef(() => {})
  recordHistoryRef.current = () => {
    const canvas = fabricRef.current
    const history = historyRef.current
    if (!canvas || !history || history.isRestoring()) return
    onHistoryChangeRef.current?.(history.push(canvas))
  }

  useImperativeHandle(ref, () => ({
    exportComposite() {
      const canvas = fabricRef.current
      if (!canvas) return null
      return exportWithLayerVisibility(canvas, layers, ['base', 'notes', 'paint'])
    },
    exportOverlayOnly() {
      const canvas = fabricRef.current
      if (!canvas) return null
      return exportWithLayerVisibility(canvas, layers, ['paint'], true)
    },
    async undo() {
      const canvas = fabricRef.current
      const history = historyRef.current
      if (!canvas || !history) return history?.getState() ?? { canUndo: false, canRedo: false }
      const state = await history.undo(canvas)
      onHistoryChangeRef.current?.(state)
      return state
    },
    async redo() {
      const canvas = fabricRef.current
      const history = historyRef.current
      if (!canvas || !history) return history?.getState() ?? { canUndo: false, canRedo: false }
      const state = await history.redo(canvas)
      onHistoryChangeRef.current?.(state)
      return state
    },
    deleteLayerObjects(layerId) {
      const canvas = fabricRef.current
      if (!canvas || !layerId) return
      canvas.getObjects().filter(o => o.layerId === layerId).forEach(o => canvas.remove(o))
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      recordHistoryRef.current()
    },
    clearLayer(layerId) {
      const canvas = fabricRef.current
      if (!canvas || !layerId) return
      canvas.getObjects().filter(o => o.layerId === layerId && o.layerType === 'paint').forEach(o => canvas.remove(o))
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      recordHistoryRef.current()
    },
  }))

  useEffect(() => {
    if (!hostRef.current || !submission?.mangakaImageUrl) return undefined

    const el = document.createElement('canvas')
    hostRef.current.replaceChildren(el)

    const canvas = new Canvas(el, {
      width: MANGA_PAGE_WIDTH,
      height: MANGA_PAGE_HEIGHT,
      backgroundColor: '#141210',
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas
    historyRef.current = createCanvasHistory()

    let cancelled = false

    ;(async () => {
      try {
        const img = await FabricImage.fromURL(submission.mangakaImageUrl, { crossOrigin: 'anonymous' })
        if (cancelled) return
        fitImageToPage(img)
        tagObject(img, 'base', 'base')
        img.selectable = false
        img.evented = false
        canvas.add(img)

        ;(submission.notes || []).forEach((n, idx) => {
          const rect = new Rect({
            left: (n.x / 100) * MANGA_PAGE_WIDTH,
            top: (n.y / 100) * MANGA_PAGE_HEIGHT,
            width: (n.w / 100) * MANGA_PAGE_WIDTH,
            height: (n.h / 100) * MANGA_PAGE_HEIGHT,
            fill: NOTE_FILL,
            stroke: NOTE_STROKE,
            strokeWidth: 2,
            strokeDashArray: [8, 5],
            rx: 4,
            ry: 4,
          })
          tagObject(rect, 'notes', 'notes')
          rect.selectable = false
          rect.evented = false
          canvas.add(rect)

          const hint = [n.text, noteTaskLabel(n.taskType)].filter(Boolean).join(' · ')
          if (hint) {
            const label = new FabricText(`${idx + 1}. ${hint.slice(0, 48)}`, {
              left: rect.left + 6,
              top: rect.top + 6,
              fontSize: 12,
              fill: '#fff',
              backgroundColor: 'rgba(230, 57, 70, 0.88)',
              padding: 4,
              selectable: false,
              evented: false,
            })
            tagObject(label, 'notes', 'notes')
            canvas.add(label)
          }
        })

        canvas.requestRenderAll()
        onHistoryChangeRef.current?.(historyRef.current.reset(canvas))
      } catch {
        onHistoryChangeRef.current?.(historyRef.current.reset(canvas))
      }
    })()

    const onPathCreated = (opt) => {
      const path = opt.path
      if (!path) return
      const layerId = activeLayerRef.current
      if (!layerId || !String(layerId).startsWith('paint')) return
      tagObject(path, layerId, 'paint')
      applyPaintObjectInteractivity(path, toolRef.current, false)
      canvas.requestRenderAll()
      recordHistoryRef.current()
    }

    const onObjectModified = () => {
      if (historyRef.current?.isRestoring()) return
      recordHistoryRef.current()
    }

    canvas.on('path:created', onPathCreated)
    canvas.on('object:modified', onObjectModified)

    return () => {
      cancelled = true
      canvas.off('path:created', onPathCreated)
      canvas.off('object:modified', onObjectModified)
      canvas.dispose()
      fabricRef.current = null
      historyRef.current = null
    }
  }, [submission?.id, submission?.mangakaImageUrl])

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const canvas = fabricRef.current
        const history = historyRef.current
        if (canvas && history) {
          history.undo(canvas).then(state => onHistoryChangeRef.current?.(state))
        }
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        const canvas = fabricRef.current
        const history = historyRef.current
        if (canvas && history) {
          history.redo(canvas).then(state => onHistoryChangeRef.current?.(state))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const isDraw = DRAW_TOOLS.has(tool)
    canvas.isDrawingMode = isDraw
    canvas.selection = tool === 'select'
    canvas.defaultCursor = tool === 'eyedropper' ? 'crosshair' : tool === 'fill' ? 'cell' : 'default'

    if (isDraw) {
      const brush = new PencilBrush(canvas)
      const w = brushWidthForTool(tool, brushSize)
      brush.width = w
      if (tool === 'eraser') {
        brush.color = '#141210'
      } else if (tool === 'marker') {
        brush.color = colorWithOpacity(brushColor, Math.min(brushOpacity, 55))
      } else {
        brush.color = colorWithOpacity(brushColor, brushOpacity)
      }
      canvas.freeDrawingBrush = brush
    }

    const activeLayer = layers.find(l => l.id === activeLayerId)
    canvas.getObjects().forEach((obj) => {
      if (obj.layerType === 'paint') {
        applyPaintObjectInteractivity(obj, tool, activeLayer?.locked)
      }
    })
    canvas.requestRenderAll()
  }, [tool, brushColor, brushSize, brushOpacity, layers, activeLayerId])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    canvas.getObjects().forEach((obj) => {
      const layer = layers.find(l => l.id === obj.layerId)
      if (!layer) return
      obj.visible = layer.visible !== false
      if (obj.layerType === 'base' || obj.layerType === 'notes') {
        obj.selectable = false
        obj.evented = false
      } else if (obj.layerType === 'paint') {
        applyPaintObjectInteractivity(obj, tool, layer.locked)
      }
    })
    canvas.requestRenderAll()
  }, [layers, tool])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || inputMode !== 'tablet') return undefined

    const upper = canvas.upperCanvasEl
    if (!upper) return undefined

    const onPointer = (e) => {
      if (e.pointerType === 'pen') {
        onTabletStatus?.({ connected: true, label: e.pointerType === 'pen' ? 'Bút vẽ (pen)' : 'Tablet' })
        if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
          const pressure = e.pressure > 0 ? e.pressure : 0.5
          const base = brushWidthForTool(toolRef.current, brushSize)
          canvas.freeDrawingBrush.width = Math.max(1, base * (0.35 + pressure * 1.5))
        }
      }
    }

    upper.addEventListener('pointerdown', onPointer)
    upper.addEventListener('pointermove', onPointer)
    return () => {
      upper.removeEventListener('pointerdown', onPointer)
      upper.removeEventListener('pointermove', onPointer)
    }
  }, [inputMode, brushSize, onTabletStatus])

  useEffect(() => {
    const canvas = fabricRef.current
    const needsMouseHandlers =
      SHAPE_TOOLS.has(tool) || tool === 'fill' || tool === 'text' || tool === 'eyedropper'
    if (!canvas || !needsMouseHandlers) {
      return undefined
    }

    canvas.isDrawingMode = false
    canvas.selection = false

    const removeDraft = () => {
      if (shapeDraftRef.current) {
        canvas.remove(shapeDraftRef.current)
        shapeDraftRef.current = null
      }
    }

    const commitShape = (obj) => {
      const layerId = activeLayerRef.current
      if (typeof layerId !== 'string' || !layerId.startsWith('paint')) return
      tagObject(obj, layerId, 'paint')
      applyPaintObjectInteractivity(obj, toolRef.current, false)
      canvas.add(obj)
      canvas.requestRenderAll()
      recordHistoryRef.current()
    }

    const onDown = (opt) => {
      const layerId = activeLayerRef.current
      if (typeof layerId !== 'string' || !layerId.startsWith('paint')) return
      const p = canvas.getPointer(opt.e)

      if (toolRef.current === 'eyedropper') {
        const picked = pickColorFromCanvas(canvas, p.x, p.y)
        if (picked) onEyedropperColor?.(picked)
        return
      }

      if (toolRef.current === 'fill') {
        const stamp = new Circle({
          left: p.x - brushSize * 3,
          top: p.y - brushSize * 3,
          radius: Math.max(8, brushSize * 3),
          fill: colorWithOpacity(fillColor, brushOpacity),
          stroke: null,
          originX: 'left',
          originY: 'top',
        })
        commitShape(stamp)
        return
      }

      if (toolRef.current === 'text') {
        const text = new IText('Nhập chữ…', {
          left: p.x,
          top: p.y,
          fontSize: Math.max(14, brushSize * 3),
          fill: colorWithOpacity(brushColor, brushOpacity),
          fontFamily: 'system-ui, sans-serif',
        })
        commitShape(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        text.selectAll()
        return
      }

      if (!SHAPE_TOOLS.has(toolRef.current)) return

      shapeStartRef.current = p
      removeDraft()

      const stroke = colorWithOpacity(brushColor, brushOpacity)
      const fill = shapeFilled ? colorWithOpacity(fillColor, brushOpacity) : 'transparent'

      if (toolRef.current === 'line') {
        shapeDraftRef.current = new Line([p.x, p.y, p.x, p.y], {
          stroke,
          strokeWidth: Math.max(1, brushSize / 2),
          selectable: false,
          evented: false,
        })
      } else if (toolRef.current === 'rect') {
        shapeDraftRef.current = new Rect({
          left: p.x,
          top: p.y,
          width: 1,
          height: 1,
          fill,
          stroke,
          strokeWidth: Math.max(1, brushSize / 3),
          selectable: false,
          evented: false,
        })
      } else if (toolRef.current === 'ellipse') {
        shapeDraftRef.current = new Ellipse({
          left: p.x,
          top: p.y,
          rx: 1,
          ry: 1,
          fill,
          stroke,
          strokeWidth: Math.max(1, brushSize / 3),
          selectable: false,
          evented: false,
        })
      }

      if (shapeDraftRef.current) canvas.add(shapeDraftRef.current)
    }

    const onMove = (opt) => {
      if (!shapeStartRef.current || !shapeDraftRef.current) return
      const p = canvas.getPointer(opt.e)
      const s = shapeStartRef.current
      const draft = shapeDraftRef.current

      if (toolRef.current === 'line') {
        draft.set({ x2: p.x, y2: p.y })
      } else if (toolRef.current === 'rect') {
        const left = Math.min(s.x, p.x)
        const top = Math.min(s.y, p.y)
        draft.set({ left, top, width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) })
      } else if (toolRef.current === 'ellipse') {
        const left = Math.min(s.x, p.x)
        const top = Math.min(s.y, p.y)
        draft.set({
          left,
          top,
          rx: Math.abs(p.x - s.x) / 2,
          ry: Math.abs(p.y - s.y) / 2,
        })
      }
      canvas.requestRenderAll()
    }

    const onUp = () => {
      if (!shapeDraftRef.current || !shapeStartRef.current) return
      const draft = shapeDraftRef.current
      canvas.remove(draft)
      shapeDraftRef.current = null
      shapeStartRef.current = null

      const stroke = colorWithOpacity(brushColor, brushOpacity)
      const fill = shapeFilled ? colorWithOpacity(fillColor, brushOpacity) : 'transparent'

      if (toolRef.current === 'line') {
        if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 3) return
        commitShape(
          new Line([draft.x1, draft.y1, draft.x2, draft.y2], {
            stroke,
            strokeWidth: Math.max(1, brushSize / 2),
          }),
        )
      } else if (toolRef.current === 'rect' && draft.width > 2 && draft.height > 2) {
        commitShape(
          new Rect({
            left: draft.left,
            top: draft.top,
            width: draft.width,
            height: draft.height,
            fill,
            stroke,
            strokeWidth: Math.max(1, brushSize / 3),
          }),
        )
      } else if (toolRef.current === 'ellipse' && draft.rx > 2 && draft.ry > 2) {
        commitShape(
          new Ellipse({
            left: draft.left,
            top: draft.top,
            rx: draft.rx,
            ry: draft.ry,
            fill,
            stroke,
            strokeWidth: Math.max(1, brushSize / 3),
          }),
        )
      }
    }

    canvas.on('mouse:down', onDown)
    canvas.on('mouse:move', onMove)
    canvas.on('mouse:up', onUp)

    return () => {
      canvas.off('mouse:down', onDown)
      canvas.off('mouse:move', onMove)
      canvas.off('mouse:up', onUp)
      removeDraft()
    }
  }, [tool, brushColor, fillColor, brushSize, brushOpacity, shapeFilled, onEyedropperColor])

  if (!submission) {
    return (
      <div className="as-layer-editor as-layer-editor--empty">
        <p>Chọn việc từ Mangaka để mở ảnh trang và layer vẽ.</p>
      </div>
    )
  }

  return (
    <div
      className="as-layer-editor"
      style={{ '--active-layer-color': activeLayerColor }}
    >
      <div className="as-layer-editor__frame manga-page manga-page--canvas as-layer-editor__frame--active">
        <div ref={hostRef} className="as-layer-editor__host" />
        <div className="as-layer-editor__corner-badge" title={activeLayerName}>
          <span className="as-layer-editor__corner-dot" aria-hidden />
          {activeLayerName}
        </div>
      </div>
    </div>
  )
})

function exportWithLayerVisibility(canvas, layerDefs, includeTypes, transparentBg = false) {
  const snapshots = canvas.getObjects().map(o => ({
    obj: o,
    visible: o.visible,
  }))

  const prevBg = canvas.backgroundColor
  if (transparentBg) {
    canvas.backgroundColor = 'transparent'
  }

  canvas.getObjects().forEach((obj) => {
    const layer = layerDefs.find(l => l.id === obj.layerId)
    const typeOk = includeTypes.includes(obj.layerType)
    obj.visible = typeOk && layer?.visible !== false
  })

  const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })

  snapshots.forEach(({ obj, visible }) => {
    obj.visible = visible
  })
  canvas.backgroundColor = prevBg
  canvas.requestRenderAll()

  return dataUrl
}

export default LayerCanvasEditor
