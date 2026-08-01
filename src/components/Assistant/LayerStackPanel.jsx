import { useRef, useState } from 'react'
import { Eye, EyeOff, GripVertical, ImagePlus, Layers, MoreVertical, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn']
const BLEND_LABEL = {
  normal: 'Binh thuong',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  'color-dodge': 'Color Dodge',
  'color-burn': 'Color Burn',
}

function LayerThumb({ url, name }) {
  const [errored, setErrored] = useState(false)
  if (!url || errored) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <ImagePlus className="h-5 w-5" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={name || 'layer'}
      className="h-full w-full object-cover"
      onError={() => setErrored(true)}
      draggable={false}
    />
  )
}

export default function LayerStackPanel({
  layers,
  loading,
  uploading,
  onAddLayer,
  onUpdateLayer,
  onDeleteLayer,
  onReorder,
  canEdit,
  className,
}) {
  const fileRef = useRef(null)
  const [dragId, setDragId] = useState(null)

  const reversed = [...layers].reverse()

  function handleAddFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const isImg = file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
    if (!isImg) {
      toast.error('Layer phải là định dạng hình ảnh (png, jpg, jpeg, webp).')
      e.target.value = ''
      return
    }
    const nextIdx = layers.length
    onAddLayer?.({ file, index: nextIdx })
    e.target.value = ''
  }

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) return
    const ids = layers.map(l => l.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    onReorder?.(ids)
    setDragId(null)
  }

  function handleFileReplace(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const isImg = file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
    if (!isImg) {
      toast.error('Layer phải là định dạng hình ảnh (png, jpg, jpeg, webp).')
      e.target.value = ''
      return
    }
    onAddLayer?.({ file, index: layers.length })
    e.target.value = ''
  }

  return (
    <div className={cn('flex h-full flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-slate-800">Layer</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{layers.length}</Badge>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <ImagePlus className="mr-1 h-3 w-3" />
            Them layer
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileReplace} />
      </div>

      <ScrollArea className="flex-1 pr-1">
        <div className="space-y-1.5 pb-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Dang tai layer...</div>
          ) : layers.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white py-8 text-center">
              <Layers className="mx-auto mb-1 h-6 w-6 text-slate-300" />
              <div className="text-xs text-slate-500">Chua co layer nao.</div>
              {canEdit && (
                <button onClick={() => fileRef.current?.click()} className="mt-2 text-xs font-medium text-violet-600 hover:underline">
                  + Upload layer dau tien
                </button>
              )}
            </div>
          ) : (
            reversed.map((layer) => (
              <div
                key={layer.id}
                onDragOver={e => { e.preventDefault() }}
                onDrop={() => handleDrop(layer.id)}
                className={cn(
                  'group flex items-stretch gap-2 rounded-md border bg-white p-2 transition',
                  layer.visible ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-70',
                  dragId === layer.id && 'ring-2 ring-violet-400',
                )}
              >
                <div
                  className="flex h-14 w-14 shrink-0 cursor-grab items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 active:cursor-grabbing"
                  draggable
                  onDragStart={() => setDragId(layer.id)}
                  title="Keo de sap xep lai"
                >
                  <LayerThumb url={layer.imageUrl} name={layer.name} />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="shrink-0 border-violet-200 bg-violet-50 text-[10px] font-mono text-violet-700">
                      #{layer.index}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{layer.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="range" min={0} max={100}
                      value={layer.opacity}
                      onChange={(e) => onUpdateLayer?.(layer.id, { opacity: Number(e.target.value) })}
                      className="h-1 flex-1 cursor-pointer accent-violet-600"
                    />
                    <span className="w-7 text-right font-mono text-[10px] text-slate-500">{layer.opacity}%</span>
                  </div>
                </div>

                <div className="flex w-7 flex-col items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateLayer?.(layer.id, { visible: !layer.visible })}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    title={layer.visible ? 'An layer' : 'Hien layer'}
                  >
                    {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = (e) => {
                          const f = e.target.files?.[0]
                          if (f) {
                            const isImg = f.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)
                            if (!isImg) {
                              toast.error('Layer phải là định dạng hình ảnh (png, jpg, jpeg, webp).')
                              return
                            }
                            onAddLayer?.({ file: f, index: layers.findIndex(l => l.id === layer.id) })
                          }
                        }
                        input.click()
                      }}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      title="Upload version moi"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDeleteLayer?.(layer.id)}
                      className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Xoa layer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
