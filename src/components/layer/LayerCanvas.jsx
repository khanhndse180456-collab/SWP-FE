import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BLEND_TO_GLOBAL = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
}

const ZOOM_STEP = 0.15
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
// Khoảng đệm (px) chừa quanh canvas trong khung — để 0 để canvas fit sát khung ngoài,
// không còn khung đen nhỏ hơn nằm lọt thỏm bên trong nữa.
const FIT_PADDING = 0

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function LayerCanvas({
  layers,
  width = 800,
  height = 1100,
  className,
  baseImage,
  notes = [],
  showNotes = true,
  fullscreen = false,
  // 'contain' (mặc định, an toàn): ảnh luôn nằm trọn trong khung, có thể dư viền
  // đen nếu tỉ lệ khung khác tỉ lệ ảnh — không bao giờ bị crop hay phóng to quá đà.
  // 'cover': ảnh phủ kín khung, phần dư bị crop — chỉ nên dùng khi khung chứa có
  // tỉ lệ gần giống tỉ lệ ảnh (vd. khung đọc trang manga dọc trong LayerEditor).
  // Với khung rất rộng (như modal LayerInspectDialog, có thêm sidebar bên cạnh),
  // 'cover' sẽ ép zoom rất lớn để lấp đầy chiều ngang → ảnh bị phóng to/mờ/tràn,
  // nên các khung dạng đó nên giữ mặc định 'contain'.
  fitMode = 'contain',
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [imgCache, setImgCache] = useState({})
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef(null)
  const [panMode, setPanMode] = useState(false)
  const [renderError, setRenderError] = useState(null)

  // Kích thước thật của khung chứa (đo bằng ResizeObserver) — dùng ref để đo/tính
  // fit-zoom mà KHÔNG khiến effect chạy lại liên tục mỗi lần khung đổi kích thước
  // (khác với dùng state trực tiếp làm dependency, vốn sẽ liên tục ghi đè zoom
  // thủ công của người dùng mỗi khi cửa sổ resize).
  const containerSizeRef = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    containerSizeRef.current = { w: el.clientWidth, h: el.clientHeight }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      containerSizeRef.current = {
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Tính zoom sao cho canvas (width x height thật) vừa khung chứa, theo fitMode:
  // 'cover' (Math.max) = phủ kín khung, crop phần dư — dùng cho khung có tỉ lệ
  // gần giống ảnh (LayerEditor). 'contain' (Math.min) = ảnh luôn nằm trọn trong
  // khung, không crop, không phóng to quá đà — an toàn cho khung rất rộng/lệch
  // tỉ lệ (LayerInspectDialog), tránh lặp lại lỗi ảnh bị zoom khổng lồ và mờ.
  const computeFitZoom = useCallback(() => {
    const { w: cw, h: ch } = containerSizeRef.current
    if (!cw || !ch) return 1
    const availW = Math.max(50, cw - FIT_PADDING)
    const availH = Math.max(50, ch - FIT_PADDING)
    const scale = fitMode === 'cover'
      ? Math.max(availW / width, availH / height)
      : Math.min(availW / width, availH / height)
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +scale.toFixed(3)))
  }, [width, height, fitMode])

  const sorted = useMemo(() => [...layers].sort((a, b) => a.index - b.index), [layers])
  const visibleCount = sorted.filter((l) => l.visible).length

  // Preload ảnh
  useEffect(() => {
    const urls = sorted.map((l) => l.imageUrl).filter(Boolean)
    if (baseImage) urls.unshift(baseImage)
    const newOnes = urls.filter((u) => !imgCache[u])
    if (newOnes.length === 0) return
    let cancelled = false
    Promise.allSettled(newOnes.map(loadImage)).then((results) => {
      if (cancelled) return
      setImgCache((cur) => {
        const next = { ...cur }
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') next[newOnes[i]] = r.value
        })
        return next
      })
    })
    return () => { cancelled = true }
  }, [sorted, imgCache, baseImage])

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const draw = async () => {
      try {
        if (baseImage) {
          const baseImg = imgCache[baseImage]
          if (baseImg) {
            ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height)
          } else {
            ctx.fillStyle = '#1a1a1a'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
        } else {
          ctx.fillStyle = '#1a1a1a'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        // FIX: trước đây dùng [...sorted].reverse() khiến layer index THẤP
        // (thêm TRƯỚC, vd "Default") lại được vẽ SAU CÙNG → đè lên trên layer
        // thêm sau (vd "Layer 2") — ngược với kỳ vọng "layer thêm sau phải
        // chồng lên layer thêm trước". `sorted` đã tăng dần theo index sẵn,
        // nên chỉ cần vẽ tuần tự đúng thứ tự đó: index thấp vẽ trước (làm nền),
        // index cao vẽ sau cùng (đè lên trên) — không cần reverse nữa.
        const drawOrder = sorted.filter((l) => l.visible)
        for (const layer of drawOrder) {
          const img = imgCache[layer.imageUrl]
          if (!img) continue
          const op = (layer.opacity ?? 100) / 100
          ctx.save()
          ctx.globalAlpha = op
          ctx.globalCompositeOperation = BLEND_TO_GLOBAL[layer.blendMode] || 'source-over'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          ctx.restore()
        }

        // Vẽ notes overlay
        if (showNotes && notes.length > 0) {
          for (const note of notes) {
            // Hỗ trợ các kiểu shape: {box_x, box_y, box_width, box_height} (snake_case), {boxx, boxy...} (PascalCase) và {x, y, w, h} (mapped)
            const x = Number(note.x ?? note.box_x ?? note.boxx ?? note.boxX ?? 0)
            const y = Number(note.y ?? note.box_y ?? note.boxy ?? note.boxY ?? 0)
            const w = Number(note.w ?? note.box_width ?? note.boxwidth ?? note.boxWidth ?? 10)
            const h = Number(note.h ?? note.box_height ?? note.boxheight ?? note.boxHeight ?? 10)
            const nx = (canvas.width * x) / 100
            const ny = (canvas.height * y) / 100
            const nw = (canvas.width * w) / 100
            const nh = (canvas.height * h) / 100

            // Tô màu theo status: Pending = đỏ, InProgress = vàng, Completed = xám
            const status = (note.status ?? 'Pending').toLowerCase()
            const stroke = status === 'completed' ? '#9ca3af' : status === 'inprogress' ? '#f59e0b' : '#f43f5e'
            const fill = status === 'completed' ? 'rgba(156, 163, 175, 0.08)' : status === 'inprogress' ? 'rgba(245, 158, 11, 0.10)' : 'rgba(244, 63, 94, 0.10)'

            ctx.save()
            ctx.fillStyle = fill
            ctx.strokeStyle = stroke
            ctx.lineWidth = 2
            ctx.setLineDash([6, 4])
            ctx.fillRect(nx, ny, nw, nh)
            ctx.strokeRect(nx, ny, nw, nh)
            ctx.setLineDash([])

            // Vẽ label với số thứ tự + status
            const label = note.description
              ? `[${status}] ${note.description.slice(0, 40)}`
              : `[${status}] #${note.id ?? '?'}`
            if (label) {
              ctx.font = 'bold 11px sans-serif'
              const tw = ctx.measureText(label).width
              const padX = 5, padY = 3
              const lx = Math.min(nx, nx + nw - tw - padX * 2)
              const ly = Math.max(0, ny - 18)
              ctx.fillStyle = stroke
              ctx.fillRect(lx, ly, tw + padX * 2, 16)
              ctx.fillStyle = '#ffffff'
              ctx.fillText(label, lx + padX, ly + 12)
            }
            ctx.restore()
          }
        }

        setRenderError(null)
      } catch (err) {
        setRenderError(err.message)
      }
    }

    draw()
  }, [sorted, imgCache, baseImage, notes, showNotes])

  // Reset pan/zoom khi đổi page — zoom về đúng mức "vừa khung" (fit) thay vì
  // hardcode 100%, vì canvas luôn vẽ ở kích thước pixel thật (width x height)
  // và khung chứa thường nhỏ hơn nhiều so với đó.
  // requestAnimationFrame để đảm bảo containerRef đã có layout/kích thước đo
  // được (đặc biệt ở lần mount đầu tiên, trước khi ResizeObserver kịp bắn).
  useEffect(() => {
    setPan({ x: 0, y: 0 })
    const id = requestAnimationFrame(() => setZoom(computeFitZoom()))
    return () => cancelAnimationFrame(id)
  }, [baseImage, computeFitZoom])

  // Đã bỏ pan/zoom bằng lăn chuột (wheel) — trước đây lăn chuột dọc/ngang sẽ dịch
  // pan, dễ khiến ảnh bị "trôi" lệch ra khỏi vị trí fit ban đầu ngoài ý muốn.
  // Zoom giờ chỉ điều khiển qua nút +/- hoặc kéo chuột (khi bật chế độ Move).

  const handleMouseDown = useCallback((e) => {
    if (e.button === 0) {
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      setIsPanning(true)
    }
  }, [pan])

  const handleMouseMove = useCallback((e) => {
    if (isPanning && panStart.current) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      })
    }
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      panStart.current = null
    }
  }, [isPanning])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
  }, [])

  // Reset view → quay về đúng mức zoom "vừa khung" (fit), không phải luôn luôn 100%.
  const handleZoomReset = useCallback(() => {
    setZoom(computeFitZoom())
    setPan({ x: 0, y: 0 })
  }, [computeFitZoom])

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-zinc-950',
        className,
      )}
      style={{ cursor: isPanning ? 'grabbing' : panMode ? 'grab' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleZoomReset}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width,
          height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : undefined,
          flexShrink: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block"
        />

        {sorted.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
              <ImagePlus className="size-7 text-white/40" />
            </div>
            <div className="text-base font-semibold text-white/60">Chưa có layer nào</div>
            <div className="text-sm text-white/40">Upload để bắt đầu ghép</div>
          </div>
        )}

        {sorted.length > 0 && visibleCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-full border border-white/20 bg-zinc-900/90 px-4 py-2 text-sm font-medium text-white/70">
              Tất cả layer đang ẩn
            </div>
          </div>
        )}

        {sorted.length > 0 && visibleCount > 0 && (
          <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
            <span className="size-1.5 rounded-full bg-violet-400" />
            {visibleCount}/{sorted.length} hiện
          </div>
        )}

        {renderError && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-md border border-red-500/30 bg-red-950/90 px-3 py-1.5 text-xs font-medium text-red-300">
            Render lỗi: {renderError}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-black/80 px-2 py-1.5 shadow-xl backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="pointer-events-auto size-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={handleZoomOut}
          title="Thu nhỏ"
        >
          <ZoomOut className="size-3.5" />
        </Button>
        <button
          type="button"
          onClick={handleZoomReset}
          className="pointer-events-auto flex min-w-[52px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
        >
          {zoomPercent}%
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="pointer-events-auto size-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={handleZoomIn}
          title="Phóng to"
        >
          <ZoomIn className="size-3.5" />
        </Button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setPanMode((m) => !m)}
          className={cn(
            'pointer-events-auto size-7 text-white/80 hover:bg-white/10 hover:text-white',
            panMode && 'bg-white/10 text-white',
          )}
          title="Kéo di chuyển"
        >
          <Move className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="pointer-events-auto size-7 text-white/80 hover:bg-white/10 hover:text-white"
          onClick={handleZoomReset}
          title="Reset view (vừa khung)"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}