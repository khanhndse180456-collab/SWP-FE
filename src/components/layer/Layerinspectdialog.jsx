import { useMemo, useState, useEffect } from 'react'
import { X, Eye, EyeOff, Layers as LayersIcon, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import LayerCanvas from './LayerCanvas.jsx'

/**
 * Modal kiểm tra từng layer riêng lẻ.
 * Toggle ở đây CHỈ ảnh hưởng đến việc hiển thị trong modal (local state),
 * KHÔNG gọi API và KHÔNG ảnh hưởng tới trạng thái visible thật của layer
 * đang dùng để edit/gộp — tránh vô tình đổi dữ liệu khi chỉ đang xem.
 */
export default function LayerInspectDialog({
  open,
  onClose,
  layers,
  baseImage,
  width = 800,
  height = 1100,
  pageLabel,
}) {
  const [localVisible, setLocalVisible] = useState({})
  const [soloId, setSoloId] = useState(null)
  const [showBase, setShowBase] = useState(true)

  // Mỗi lần mở modal, đồng bộ lại trạng thái hiện/ẩn ban đầu theo đúng layer thật
  useEffect(() => {
    if (!open) return
    const init = {}
    for (const l of layers) init[l.id] = l.visible
    setLocalVisible(init)
    setSoloId(null)
    setShowBase(true)
  }, [open, layers])

  const sorted = useMemo(() => [...layers].sort((a, b) => a.index - b.index), [layers])

  const displayLayers = useMemo(() => {
    if (soloId) {
      return sorted.map((l) => ({ ...l, visible: l.id === soloId }))
    }
    return sorted.map((l) => ({ ...l, visible: localVisible[l.id] ?? l.visible }))
  }, [sorted, localVisible, soloId])

  if (!open) return null

  const toggleOne = (id) => {
    setSoloId(null)
    setLocalVisible((cur) => ({ ...cur, [id]: !cur[id] }))
  }

  const showAll = () => {
    setSoloId(null)
    const next = {}
    for (const l of sorted) next[l.id] = true
    setLocalVisible(next)
  }

  const hideAll = () => {
    setSoloId(null)
    const next = {}
    for (const l of sorted) next[l.id] = false
    setLocalVisible(next)
  }

  const toggleSolo = (id) => {
    setSoloId((cur) => (cur === id ? null : id))
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.() }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-zinc-950/95 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
            <LayersIcon className="size-3.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">Kiểm tra layer{pageLabel ? ` · ${pageLabel}` : ''}</p>
            <p className="text-[11px] text-white/40">Bật/tắt từng layer để xem — không ảnh hưởng dữ liệu thật</p>
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-8 text-white/60 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          title="Đóng (Esc)"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="min-h-0 flex-1 overflow-hidden bg-black">
          <LayerCanvas
            layers={displayLayers}
            width={width}
            height={height}
            baseImage={showBase ? baseImage : null}
            className="h-full w-full"
          />
        </div>

        {/* Sidebar toggle list */}
        <div className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-zinc-950">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
            <span className="text-xs font-semibold text-white/80">
              Layer ({sorted.length})
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px]"
                onClick={showAll}
              >
                Hiện tất cả
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px]"
                onClick={hideAll}
              >
                Ẩn tất cả
              </Button>
            </div>
          </div>

          {/* Toggle ảnh gốc */}
          <div className="shrink-0 border-b border-white/10 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowBase((v) => !v)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                showBase
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                  : 'border-white/10 bg-white/5 text-white/50',
              )}
            >
              {showBase ? <Eye className="size-3.5 shrink-0" /> : <EyeOff className="size-3.5 shrink-0" />}
              <span className="text-xs font-medium">Ảnh gốc (nền)</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sorted.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-white/40">
                <ImagePlus className="size-8 text-white/20" />
                <p>Chưa có layer nào.</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {sorted.map((layer) => {
                  const isVisible = soloId ? layer.id === soloId : (localVisible[layer.id] ?? layer.visible)
                  const isSolo = soloId === layer.id
                  return (
                    <li
                      key={layer.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 transition-colors',
                        isSolo
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : isVisible
                            ? 'border-white/10 bg-white/5'
                            : 'border-dashed border-white/5 bg-white/[0.02] opacity-60',
                      )}
                    >
                      <Button
                        size="icon-xs"
                        variant={isVisible ? 'secondary' : 'outline'}
                        className="size-7 shrink-0"
                        onClick={() => toggleOne(layer.id)}
                        title={isVisible ? 'Ẩn layer' : 'Hiện layer'}
                      >
                        {isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </Button>

                      <div className="size-9 shrink-0 overflow-hidden rounded border border-white/10 bg-black/40">
                        {layer.imageUrl ? (
                          <img src={layer.imageUrl} alt="" className="size-full object-contain" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-white/30">
                            <ImagePlus className="size-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white/90">{layer.name}</p>
                        <p className="text-[10px] text-white/40">
                          Layer #{layer.index + 1} · {layer.opacity}%
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={isSolo ? 'default' : 'ghost'}
                        className={cn(
                          'h-6 shrink-0 px-2 text-[10px]',
                          !isSolo && 'text-white/50 hover:bg-white/10 hover:text-white',
                        )}
                        onClick={() => toggleSolo(layer.id)}
                        title="Chỉ xem riêng layer này"
                      >
                        {isSolo ? 'Đang solo' : 'Solo'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}