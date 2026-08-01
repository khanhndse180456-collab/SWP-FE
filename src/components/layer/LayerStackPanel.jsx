import { useRef, useState } from 'react'
import { Eye, EyeOff, GripVertical, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ACCENT_BY_INDEX = [
  '#8b5cf6',
  '#22c55e',
  '#f59e0b',
  '#3b82f6',
  '#ec4899',
  '#06b6d4',
  '#f43f5e',
  '#a3a3a3',
]

function LayerRow({ layer, index, accent, draggable, onDragStart, onDragOver, onDrop, onToggle, onOpacity, onRemove, onPickFile, onRename, uploading }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(layer.name)
  // FIX: trước đây cả <li> luôn draggable={true}, nên chỉ cần bấm/di chuột nhẹ
  // vào BẤT KỲ đâu trong dòng (icon mắt, thumbnail, tên layer...) trình duyệt
  // đã hiểu nhầm thành bắt đầu kéo-thả HTML5 (tạo "ghost" nổi đè lên UI, các nút
  // bấm không nhận click đúng) — gây cảm giác "lệch/lỗi cả layer".
  // Sửa: chỉ bật draggable khi mousedown bắt đầu đúng từ tay cầm (GripVertical);
  // các thao tác khác trong dòng (click nút, kéo opacity...) không kích hoạt kéo.
  const [canDrag, setCanDrag] = useState(false)

  const commitName = () => {
    setEditing(false)
    if (draftName.trim() && draftName !== layer.name) onRename(layer.id, draftName.trim())
    else setDraftName(layer.name)
  }

  return (
    <li
      draggable={draggable && canDrag}
      onDragStart={(e) => onDragStart?.(e, layer.id)}
      onDragOver={(e) => onDragOver?.(e, layer.id)}
      onDrop={(e) => onDrop?.(e, layer.id)}
      onDragEnd={() => setCanDrag(false)}
      className={cn(
        'group rounded-lg border p-2.5 transition-colors',
        layer.visible
          ? 'border-white/10 bg-white/5'
          : 'border-dashed border-white/5 bg-white/[0.02] opacity-60',
      )}
      style={accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : undefined}
    >
      <div className="flex items-center gap-2">
        {draggable && (
          <GripVertical
            className="size-4 shrink-0 cursor-grab text-white/30 active:cursor-grabbing"
            onMouseDown={() => setCanDrag(true)}
            onMouseUp={() => setCanDrag(false)}
            title="Kéo để sắp xếp thứ tự layer"
          />
        )}

        <Button
          size="icon-xs"
          variant={layer.visible ? 'secondary' : 'outline'}
          onClick={() => onToggle(layer.id)}
          className="size-7"
          title={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
        >
          {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
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
          {editing ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') {
                  setDraftName(layer.name)
                  setEditing(false)
                }
              }}
              className="w-full rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-xs text-white outline-none focus:border-violet-500"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="block w-full truncate text-left text-xs font-medium text-white/90 hover:text-white"
              title="Đổi tên"
            >
              {layer.name}
            </button>
          )}
          <p className="text-[10px] text-white/40">Layer #{index}</p>
        </div>

        <Button
          size="icon-xs"
          variant="ghost"
          className={cn(
            "size-7 transition-colors",
            String(layer.name || '').toLowerCase() === 'default'
              ? "text-white/10 cursor-not-allowed opacity-30"
              : "text-white/40 hover:bg-white/10 hover:text-white"
          )}
          onClick={() => {
            if (String(layer.name || '').toLowerCase() !== 'default') {
              onRemove(layer.id)
            }
          }}
          disabled={String(layer.name || '').toLowerCase() === 'default'}
          title={String(layer.name || '').toLowerCase() === 'default' ? "Không thể xóa layer mặc định" : "Xóa layer"}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/*
        FIX: <li> cha ở trên có draggable={true} (để kéo sắp xếp thứ tự layer bằng
        HTML5 drag-and-drop). Nếu không chặn, một cú mousedown bắt đầu trên
        <input type="range"> bên trong vẫn bị trình duyệt hiểu là điểm bắt đầu kéo
        cả dòng layer (vì nó tìm ancestor gần nhất có draggable=true), nên KHÔNG
        kéo được thanh trượt opacity — đây là lỗi kinh điển của range input đặt
        trong container draggable.

        Cách sửa: stopPropagation ngay tại mousedown để sự kiện không lan lên
        <li>, đồng thời đặt draggable={false} tường minh cho khu vực này và cho
        chính input — trình duyệt sẽ không còn coi đây là điểm khởi tạo kéo-thả
        layer nữa, thanh trượt opacity hoạt động bình thường.
      */}
      <div
        className="mt-2 flex items-center gap-2"
        draggable={false}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="shrink-0 text-[10px] text-white/40">Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={layer.opacity}
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => onOpacity(layer.id, Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500"
        />
        <div className="flex items-center gap-0.5">
          <input
            type="number"
            min={0}
            max={100}
            value={layer.opacity}
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, Number(e.target.value)))
              onOpacity(layer.id, val)
            }}
            className="w-10 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-center font-mono text-[10px] text-white/95 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-violet-500/50"
          />
          <span className="text-[10px] text-white/40">%</span>
        </div>
      </div>
    </li>
  )
}

export default function LayerStackPanel({
  layers,
  loading,
  uploading,
  onAddLayer,
  onToggle,
  onOpacity,
  onRemove,
  onRename,
  onReorder,
  onPickFile,
  className,
}) {
  const fileRef = useRef(null)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const isImg = file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
    if (!isImg) {
      toast.error('Layer phải là định dạng hình ảnh (png, jpg, jpeg, webp).')
      return
    }
    await onAddLayer?.(file)
  }

  const handleDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }
  const handleDrop = (e, dropId) => {
    e.preventDefault()
    if (!dragId || dragId === dropId) {
      setDragId(null)
      setOverId(null)
      return
    }
    const ids = layers.map((l) => l.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(dropId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...ids]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragId)
    onReorder?.(next)
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className={cn('flex h-full flex-col rounded-lg border border-white/10 bg-zinc-900/60', className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
            <ImagePlus className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-white/90">Layer stack</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
            {layers.length}
          </span>
        </div>
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-white/40">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Đang tải layer…
          </div>
        ) : layers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-white/40">
            <ImagePlus className="size-8 text-white/20" />
            <p>Chưa có layer nào.</p>
            <p>Bấm Upload để thêm.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {layers.map((layer, idx) => (
              <div
                key={layer.id}
                className={cn(
                  'transition-all',
                  overId === layer.id && dragId && dragId !== layer.id && 'translate-y-0.5',
                )}
              >
                <LayerRow
                  layer={layer}
                  index={idx + 1}
                  accent={ACCENT_BY_INDEX[idx % ACCENT_BY_INDEX.length]}
                  draggable
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onToggle={onToggle}
                  onOpacity={onOpacity}
                  onRemove={onRemove}
                  onRename={onRename}
                  uploading={uploading}
                />
              </div>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}