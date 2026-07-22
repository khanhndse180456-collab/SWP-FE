import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Send,
  StickyNote,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import SidebarNav from '@/components/layout/SidebarNav.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getSession, logout } from '@/lib/auth.js'
import {
  usePageById,
  usePages,
  usePageLayers,
  useCreatePageLayer,
  useUpdatePageLayer,
  useDeletePageLayer,
  useTogglePageLayerVisibility,
  usePageComposite,
  usePageIssues,
  useUpdatePageIssueStatus,
  useUpdateChapterStatus,
} from '@/api/hooks'
import { pagesService } from '@/api'
import '@/styles/mangaPage.css'

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Workspace' },
]

const LAYER_TYPE_OPTIONS = [
  { value: 'sketch', label: 'Phác thảo (Sketch)' },
  { value: 'lineart', label: 'Đi nét (Lineart)' },
  { value: 'color', label: 'Tô màu (Color)' },
  { value: 'background', label: 'Nền (Background)' },
  { value: 'text', label: 'Chữ (Text)' },
  { value: 'fx', label: 'Hiệu ứng (FX)' },
  { value: 'other', label: 'Khác' },
]

function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function uid() {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function LayerThumbnail({ layer, selected, onClick }) {
  const [img, setImg] = useState(null)
  const url = layer.dataUrl || layer.imageUrl || layer.url

  useEffect(() => {
    if (!url) return
    const imgEl = new window.Image()
    imgEl.onload = () => setImg(imgEl)
    imgEl.src = url
  }, [url])

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full overflow-hidden rounded-lg border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border',
        !layer.visible && 'opacity-40',
      )}
    >
      <div
        className="aspect-[3/4] w-full bg-muted"
        style={{ backgroundImage: url ? `url(${url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {!url ? (
          <div className="flex h-full w-full items-center justify-center">
            <Layers className="size-6 text-muted-foreground/40" />
          </div>
        ) : null}
      </div>
      {!layer.visible && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <EyeOff className="size-5 text-white" />
        </div>
      )}
    </button>
  )
}

function LayerItem({ layer, index, isSelected, onSelect, onToggleVisibility, onDelete, onDownload, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [img, setImg] = useState(null)
  const url = layer.dataUrl || layer.imageUrl || layer.url

  useEffect(() => {
    if (!url) return
    const imgEl = new window.Image()
    imgEl.onload = () => setImg(imgEl)
    imgEl.src = url
  }, [url])

  const typeLabel = LAYER_TYPE_OPTIONS.find(t => t.value === layer.layerType)?.label ?? layer.layerType ?? 'Layer'

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer',
        isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50',
        !layer.visible && 'opacity-60',
      )}
      onClick={onSelect}
    >
      <div className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
        <GripVertical className="size-3.5" />
      </div>

      <div className="size-10 shrink-0 overflow-hidden rounded border bg-muted">
        {img ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Layers className="size-3.5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{layer.name || layer.layerName || `Layer ${index + 1}`}</p>
        <p className="text-xs text-muted-foreground">{typeLabel}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onMoveUp() }}
          disabled={isFirst}
          title="Di chuyển lên"
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onMoveDown() }}
          disabled={isLast}
          title="Di chuyển xuống"
        >
          <ChevronDown className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onToggleVisibility() }}
          title={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
        >
          {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onDownload?.() }}
          disabled={!url}
          title="Tải layer về"
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Xóa layer"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function UploadLayerDialog({ open, onClose, onUpload }) {
  const fileRef = useRef(null)
  const [layerName, setLayerName] = useState('')
  const [layerType, setLayerType] = useState('lineart')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    fileToDataUrl(f).then(url => setPreview(url))
    if (!layerName) {
      const name = f.name.replace(/\.[^.]+$/, '')
      setLayerName(name)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f && (f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name))) {
      setFile(f)
      fileToDataUrl(f).then(url => setPreview(url))
      if (!layerName) {
        const name = f.name.replace(/\.[^.]+$/, '')
        setLayerName(name)
      }
    }
  }

  function handleSubmit() {
    if (!file || !layerName.trim()) return
    setUploading(true)
    fileToDataUrl(file).then(dataUrl => {
      onUpload({ name: layerName.trim(), layerType, dataUrl, file })
      setUploading(false)
      reset()
      onClose()
    })
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setLayerName('')
    setLayerType('lineart')
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Layer mới</DialogTitle>
          <DialogDescription>
            Upload file ảnh làm một layer (nét vẽ, màu, nền...). Kéo thả hoặc bấm chọn file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={handleFileChange} />
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-48 rounded-md object-contain" />
            ) : (
              <>
                <Upload className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Kéo thả hoặc bấm để chọn file</p>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP · Tối đa 20MB</p>
              </>
            )}
          </div>

          {preview && (
            <>
              <div className="space-y-2">
                <Label htmlFor="layer-name">Tên layer</Label>
                <Input
                  id="layer-name"
                  value={layerName}
                  onChange={e => setLayerName(e.target.value)}
                  placeholder="VD: Lineart Ch.1 Trang 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="layer-type">Loại layer</Label>
                <Select value={layerType} onValueChange={setLayerType}>
                  <SelectTrigger id="layer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAYER_TYPE_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Huỷ</Button>
                <Button className="flex-1" disabled={!file || !layerName.trim() || uploading} onClick={handleSubmit}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Thêm Layer
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CompositeResultDialog({ open, onClose, imageUrl }) {
  if (!imageUrl) return null
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ảnh hoàn chỉnh — Đã tạo!</DialogTitle>
          <DialogDescription>
            Backend đã gộp tất cả layer hiển thị thành một ảnh. Dùng ảnh này cho chapter.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border bg-muted">
            <img src={imageUrl} alt="Ảnh hoàn chỉnh" className="max-h-[60vh] w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              <X className="size-4" />
              Đóng
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const a = document.createElement('a')
                a.href = imageUrl
                a.download = 'composite.png'
                a.click()
              }}
            >
              <Download className="size-4" />
              Tải về
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function PageLayerWorkspace() {
  const navigate = useNavigate()
  const { seriesSlug, chapterId, pageId } = useParams()
  const user = getSession()
  const qc = useQueryClient()

  const serverPageId =
    typeof pageId === 'string' && (pageId.startsWith('u-') || pageId.startsWith('local-'))
      ? null
      : pageId

  const { data: serverPage, isLoading: pageLoading } = usePageById(serverPageId)
  const { data: serverLayers = [] } = usePageLayers(serverPageId)

  const createLayer = useCreatePageLayer()
  const updateLayer = useUpdatePageLayer()
  const deleteLayer = useDeletePageLayer()
  const toggleVisibility = useTogglePageLayerVisibility()
  const composite = usePageComposite()
  const updateIssueStatus = useUpdatePageIssueStatus()
  const updateChapterStatus = useUpdateChapterStatus()

  const [localLayers, setLocalLayers] = useState([])
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [compositeResult, setCompositeResult] = useState(null)
  const [compositeLoading, setCompositeLoading] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [selectedNote, setSelectedNote] = useState(null)
  const [sendingToMangaka, setSendingToMangaka] = useState(false)
  const [approving, setApproving] = useState(false)

  // Server-side page issues (notes from Mangaka)
  const { data: pageIssues = [] } = usePageIssues({ pageId: serverPageId ? Number(serverPageId) : null })
  const activeIssues = useMemo(
    () => (pageIssues || []).filter(i => {
      // Loại bỏ các issue đã đóng (Completed / Cancelled theo enum BE PageIssueService)
      const s = String(i.status ?? '').toLowerCase()
      return s !== 'completed' && s !== 'cancelled'
    }),
    [pageIssues],
  )

  const allLayers = useMemo(() => {
    const serverItems = serverLayers.map((l, i) => ({
      id: l.id ?? l.layerid ?? l.layer_id ?? l.layerId ?? `srv-${i}`,
      serverId: l.id ?? l.layerid ?? l.layer_id ?? l.layerId,
      name: l.layer_name ?? l.layername ?? l.layerName ?? l.name ?? `Layer ${i + 1}`,
      layerType: l.layer_type ?? l.layertype ?? l.layerType ?? l.type ?? 'other',
      imageUrl: l.file_url ?? l.fileurl ?? l.fileUrl ?? l.imageUrl ?? l.url,
      dataUrl: null,
      visible: l.is_visible !== false && l.isvisible !== false && l.visible !== false,
      index: Number(l.z_index ?? l.zindex ?? l.index ?? l.sortOrder ?? i),
      createdAt: l.created_at ?? l.createdat ?? l.createdAt,
    }))
    const localItems = localLayers.map((l, i) => ({
      id: l.localId,
      serverId: null,
      name: l.name,
      layerType: l.layerType,
      imageUrl: null,
      dataUrl: l.dataUrl,
      visible: l.visible !== false,
      index: serverItems.length + i,
    }))
    return [...serverItems, ...localItems].sort((a, b) => a.index - b.index)
  }, [serverLayers, localLayers])

  const selectedLayer = useMemo(
    () => allLayers.find(l => l.id === selectedLayerId) ?? null,
    [allLayers, selectedLayerId],
  )

  const visibleLayers = useMemo(
    () => allLayers.filter(l => l.visible),
    [allLayers],
  )

  useEffect(() => {
    if (allLayers.length > 0 && !selectedLayerId) {
      setSelectedLayerId(allLayers[0].id)
    }
  }, [allLayers.length])

  function handleUploadLayer({ name, layerType, dataUrl, file }) {
    const newLayer = {
      localId: localId(),
      name,
      layerType,
      dataUrl,
      file,
      visible: true,
    }

    // Nếu page đã có server ID → upload lên server ngay
    if (serverPageId && file) {
      const fd = new FormData()
      fd.append('pageId', serverPageId)
      fd.append('uploaderId', user?.id ?? 0)
      fd.append('layerName', name)
      fd.append('opacity', '1.0')
      fd.append('layerFile', file)
      createLayer.mutate(fd, {
        onSuccess: () => {
          toast.success(`Đã upload layer "${name}" lên server.`)
        },
        onError: (err) => {
          const msg = err?.response?.data?.message ?? err?.message
          toast.error(`Upload layer thất bại: ${msg}`)
          setLocalLayers(prev => [...prev, newLayer])
        },
      })
    } else {
      // Chưa có server page → chỉ lưu local
      setLocalLayers(prev => [...prev, newLayer])
      toast.success(`Đã thêm layer "${name}" — nhấn Composite để gộp ảnh.`)
    }
  }

  const handleToggleVisibility = useCallback((layerId) => {
    const layer = allLayers.find(l => l.id === layerId)
    if (!layer) return

    if (layer.serverId) {
      toggleVisibility.mutate(layer.serverId, {
        onSuccess: () => toast.success(layer.visible ? 'Đã ẩn layer' : 'Đã hiện layer'),
        onError: () => toast.error('Không cập nhật được visibility.'),
      })
    } else {
      setLocalLayers(prev =>
        prev.map(l => l.localId === layerId ? { ...l, visible: !l.visible } : l),
      )
    }
  }, [allLayers, toggleVisibility])

  const handleDeleteLayer = useCallback((layerId) => {
    const layer = allLayers.find(l => l.id === layerId)
    if (!layer) return
    if (!window.confirm(`Xóa layer "${layer.name}"?`)) return

    if (layer.serverId) {
      deleteLayer.mutate(layer.serverId, {
        onSuccess: () => toast.success('Đã xóa layer trên server.'),
        onError: () => toast.error('Không xóa được layer.'),
      })
    } else {
      setLocalLayers(prev => prev.filter(l => l.localId !== layerId))
      toast.success('Đã xóa layer khỏi danh sách.')
    }
    if (selectedLayerId === layerId) setSelectedLayerId(null)
  }, [allLayers, selectedLayerId, deleteLayer])

  const handleDownloadLayer = useCallback((layerId) => {
    const layer = allLayers.find(l => l.id === layerId)
    if (!layer) return
    const dlUrl = layer.dataUrl || layer.imageUrl
    if (!dlUrl) {
      toast.error('Layer chưa có URL ảnh.')
      return
    }
    if (dlUrl.startsWith('data:')) {
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = `${(layer.name || 'layer').replace(/[^\w\-]+/g, '_')}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } else {
      window.open(dlUrl, '_blank', 'noopener,noreferrer')
    }
  }, [allLayers])

  function handleMoveUp(layerId) {
    const idx = allLayers.findIndex(l => l.id === layerId)
    if (idx <= 0) return
    const arr = [...allLayers]
    const [item] = arr.splice(idx, 1)
    arr.splice(idx - 1, 0, item)
    const reindexed = arr.map((l, i) => ({ ...l, index: i }))
    syncLayerOrder(reindexed)
  }

  function handleMoveDown(layerId) {
    const idx = allLayers.findIndex(l => l.id === layerId)
    if (idx < 0 || idx >= allLayers.length - 1) return
    const arr = [...allLayers]
    const [item] = arr.splice(idx, 1)
    arr.splice(idx + 1, 0, item)
    const reindexed = arr.map((l, i) => ({ ...l, index: i }))
    syncLayerOrder(reindexed)
  }

  function syncLayerOrder(reindexed) {
    const serverItems = reindexed.filter(l => l.serverId !== null)
    const localItems = reindexed.filter(l => l.serverId === null)

    serverItems.forEach(l => {
      if (l.serverId) {
        updateLayer.mutate({ id: l.serverId, data: { zIndex: l.index } })
      }
    })

    setLocalLayers(localItems.map(l => ({ ...l, index: l.index })))
  }

  async function handleComposite() {
    if (!serverPageId) {
      toast.error('Chỉ có thể composite khi trang đã được lưu trên server.')
      return
    }
    if (allLayers.length === 0) {
      toast.error('Chưa có layer nào để composite.')
      return
    }

    setCompositeLoading(true)
    try {
      const res = await pagesService.composite(serverPageId)
      const url = res.data?.url ?? res.data?.imageUrl ?? res.data?.compositeUrl
      if (url) {
        setCompositeResult(url)
        toast.success('Đã gộp ảnh thành công!')
      } else {
        toast.error('Server không trả về URL ảnh composite.')
      }
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Lỗi khi gọi composite.'
      toast.error(msg)
    } finally {
      setCompositeLoading(false)
    }
  }

  function handleDismissNote(note) {
    if (!note) return
    const id = note.id ?? note.issueId
    if (!id) return
    // Enum BE PageIssueService không có 'Closed'. Hành động "Bỏ note" của Assistant
    // map sang 'Cancelled' — transition Resolved → Cancelled hợp lệ theo BE.
    updateIssueStatus.mutate(
      { id, status: 'Cancelled' },
      {
        onSuccess: () => {
          toast.success('Đã bỏ note.')
          setSelectedNote(null)
        },
        onError: (err) => {
          const msg = err?.response?.data?.message ?? err?.message ?? 'Lỗi khi bỏ note.'
          toast.error(msg)
        },
      },
    )
  }

  async function handleSendToMangaka() {
    if (!serverPageId) {
      toast.error('Trang chưa được lưu trên server.')
      return
    }
    const chapterId = serverPage?.chapterId ?? serverPage?.chapter_id
    if (!chapterId) {
      toast.error('Không xác định được chapter.')
      return
    }
    setSendingToMangaka(true)
    try {
      // Bước 1: composite (nếu chưa)
      if (allLayers.length > 0) {
        try { await pagesService.composite(serverPageId) } catch { /* ignore, có thể đã composite trước đó */ }
      }
      // Bước 2: Assistant gửi bản tổng hợp cho Mangaka — Cập nhật trạng thái page thành true
      if (!serverPage?.isSentToMangaka) {
        await pagesService.updateIsSentToMangaka(serverPageId, true)
      }
      toast.success('Đã gửi cho Mangaka duyệt.')
      qc.invalidateQueries({ queryKey: ['pages', serverPageId] })
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Lỗi khi gửi Mangaka.'
      toast.error(msg)
    } finally {
      setSendingToMangaka(false)
    }
  }

  async function handleApproveByMangaka() {
    if (!serverPageId) return
    setApproving(true)
    try {
      // 1. Gọi API composite để lưu ảnh vào database
      await pagesService.composite(serverPageId)

      // 2. Đổi biến isSentToMangaka thành false
      await pagesService.updateIsSentToMangaka(serverPageId, false)

      toast.success('Đã duyệt bản vẽ thành công và lưu ảnh hoàn chỉnh!')
      qc.invalidateQueries({ queryKey: ['pages', serverPageId] })
    } catch (err) {
      toast.error('Duyệt bản vẽ thất bại: ' + (err?.response?.data?.message ?? err.message))
    } finally {
      setApproving(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const canvasLayers = useMemo(() => visibleLayers.map((l, i) => ({
    imageUrl: l.dataUrl || l.imageUrl,
    visible: l.visible,
    index: l.index ?? i,
    opacity: 100,
  })), [visibleLayers])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b bg-muted/30">
        <div className="page-container py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" />
              Quay lại
            </Button>
            <span className="text-muted-foreground">/</span>
            <Button size="sm" variant="ghost" onClick={() => navigate('/mangaka')}>
              Mangaka
            </Button>
            <span className="text-muted-foreground">/</span>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/mangaka/series/${seriesSlug}`)}>
              {seriesSlug}
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Ch. {chapterId?.replace(/^u-/, '')}</span>
            <span className="text-muted-foreground">/</span>
            <Badge variant="outline">Trang {pageId?.replace(/^u-/, '')}</Badge>
          </div>
        </div>
      </div>

      <main className="flex flex-1">
        <div className="flex flex-1 flex-col xl:flex-row">
          {/* Left: Layer list panel */}
          <aside className="w-full border-r xl:w-80 xl:min-h-0">
            <div className="flex h-full flex-col">
              <div className="border-b bg-muted/20 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <span className="font-semibold">Layers</span>
                    <Badge variant="secondary" className="text-xs">{allLayers.length}</Badge>
                  </div>
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Plus className="size-3.5" />
                    Thêm Layer
                  </Button>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {visibleLayers.length}/{allLayers.length} hiển thị
                </p>
              </div>

              <div className="border-b bg-muted/10 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <StickyNote className="size-4 text-amber-500" />
                  <span className="font-medium">Notes từ Mangaka</span>
                  <Badge variant="secondary" className="text-xs">{activeIssues.length}</Badge>
                </div>
                <Button
                  size="xs"
                  variant={showNotes ? 'default' : 'outline'}
                  onClick={() => setShowNotes(v => !v)}
                >
                  {showNotes ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  {showNotes ? 'Đang hiện' : 'Đang ẩn'}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {allLayers.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                    <Layers className="size-8 text-muted-foreground/40" />
                    <p className="text-sm">Chưa có layer nào.</p>
                    <Button size="sm" onClick={() => setUploadOpen(true)}>
                      <Upload className="size-3.5" />
                      Upload layer đầu tiên
                    </Button>
                  </div>
                ) : (
                  allLayers.map((layer, idx) => (
                    <LayerItem
                      key={layer.id}
                      layer={layer}
                      index={idx}
                      isSelected={selectedLayerId === layer.id}
                      onSelect={() => setSelectedLayerId(layer.id)}
                      onToggleVisibility={() => handleToggleVisibility(layer.id)}
                      onDelete={() => handleDeleteLayer(layer.id)}
                      onDownload={() => handleDownloadLayer(layer.id)}
                      onMoveUp={() => handleMoveUp(layer.id)}
                      onMoveDown={() => handleMoveDown(layer.id)}
                      isFirst={idx === 0}
                      isLast={idx === allLayers.length - 1}
                    />
                  ))
                )}
              </div>

              <div className="border-t p-3 space-y-2">
                {String(user?.role ?? '').toUpperCase() === 'MANGAKA' && (
                  <>
                    {(serverPage?.isSentToMangaka === true || serverPage?.IsSentToMangaka === true) ? (
                      <Button
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white hover:from-emerald-500 hover:to-teal-500"
                        onClick={handleApproveByMangaka}
                        disabled={approving || !serverPageId}
                      >
                        {approving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Duyệt bản vẽ
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={handleComposite}
                        disabled={compositeLoading || allLayers.length === 0}
                      >
                        {compositeLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Wand2 className="size-4" />
                        )}
                        Tạo ảnh hoàn chỉnh
                      </Button>
                    )}
                  </>
                )}

                {String(user?.role ?? '').toUpperCase() === 'ASSISTANT' && (
                  <>
                    {!(serverPage?.isSentToMangaka === true || serverPage?.IsSentToMangaka === true) ? (
                      <Button
                        className="w-full"
                        variant="default"
                        onClick={handleSendToMangaka}
                        disabled={sendingToMangaka || !serverPageId}
                      >
                        {sendingToMangaka ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Gửi Mangaka duyệt
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant="outline"
                        disabled={true}
                      >
                        Đang chờ Mangaka duyệt...
                      </Button>
                    )}
                  </>
                )}

                {!serverPageId && (
                  <p className="text-xs text-muted-foreground text-center">
                    Trang cần được lưu server trước khi thao tác.
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Center: Canvas preview */}
          <div className="flex-1 flex flex-col min-h-[500px]">
            <div className="border-b bg-muted/10 px-4 py-2 flex items-center gap-3">
              <h2 className="text-sm font-semibold">Xem trước composite</h2>
              <span className="text-xs text-muted-foreground">
                {visibleLayers.length} layer hiển thị
              </span>
            </div>
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-zinc-950">
              <div className="relative max-w-full" style={{ aspectRatio: '728/1030' }}>
                {visibleLayers.map((layer, idx) => {
                  const url = layer.dataUrl || layer.imageUrl
                  if (!url) return null
                  return (
                    <img
                      key={layer.id}
                      src={url}
                      alt={layer.name}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ zIndex: idx }}
                    />
                  )
                })}
                {visibleLayers.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-12 mb-3 text-zinc-600" />
                    <p className="text-sm text-zinc-500">Chưa có layer hiển thị</p>
                    <p className="text-xs text-zinc-600 mt-1">Upload layer hoặc bật visibility để xem</p>
                  </div>
                )}

                {showNotes && activeIssues.map((issue) => {
                  const x = Number(issue.boxX ?? issue.BoxX ?? issue.x ?? 0)
                  const y = Number(issue.boxY ?? issue.BoxY ?? issue.y ?? 0)
                  const w = Number(issue.boxW ?? issue.BoxW ?? issue.width ?? issue.w ?? 10)
                  const h = Number(issue.boxH ?? issue.BoxH ?? issue.height ?? issue.h ?? 10)
                  const status = String(issue.status ?? 'Reported').toLowerCase()
                  const color = status === 'resolved' ? 'emerald' : status === 'inprogress' ? 'amber' : status === 'completed' ? 'emerald' : status === 'cancelled' ? 'zinc' : 'rose'
                  return (
                    <button
                      type="button"
                      key={issue.id ?? issue.issueId}
                      onClick={() => setSelectedNote(issue)}
                      className={cn(
                        'absolute rounded border-2 cursor-pointer transition-all',
                        'hover:shadow-lg',
                        color === 'emerald' && 'border-emerald-400 bg-emerald-400/15',
                        color === 'amber' && 'border-amber-400 bg-amber-400/15',
                        color === 'rose' && 'border-rose-400 bg-rose-400/15',
                      )}
                      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, zIndex: 9999 }}
                      title={issue.note ?? issue.title ?? 'Note từ Mangaka'}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Selected layer detail */}
          <aside className="w-full border-l xl:w-72">
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Chi tiết layer
              </h3>
              {selectedLayer ? (
                <div className="space-y-4">
                  <LayerThumbnail
                    layer={selectedLayer}
                    selected={true}
                    onClick={() => {}}
                  />
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tên</Label>
                      <p className="text-sm font-medium">{selectedLayer.name}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Loại</Label>
                      <p className="text-sm">
                        {LAYER_TYPE_OPTIONS.find(t => t.value === selectedLayer.layerType)?.label ?? selectedLayer.layerType ?? '—'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Trạng thái</Label>
                      <div className="flex items-center gap-2">
                        {selectedLayer.visible ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                            <Eye className="size-3 mr-1" /> Hiển thị
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-zinc-100 text-zinc-500">
                            <EyeOff className="size-3 mr-1" /> Ẩn
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nguồn</Label>
                      <p className="text-sm">{selectedLayer.serverId ? 'Server' : 'Local (chưa lưu)'}</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleToggleVisibility(selectedLayer.id)}
                      >
                        {selectedLayer.visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        {selectedLayer.visible ? 'Ẩn' : 'Hiện'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDeleteLayer(selectedLayer.id)}
                      >
                        <Trash2 className="size-3.5" />
                        Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Layers className="size-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm">Chọn một layer để xem chi tiết</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <UploadLayerDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUploadLayer}
      />
      <CompositeResultDialog
        open={!!compositeResult}
        onClose={() => setCompositeResult(null)}
        imageUrl={compositeResult}
      />

      <Dialog open={!!selectedNote} onOpenChange={(o) => !o && setSelectedNote(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Note từ Mangaka</DialogTitle>
            <DialogDescription>
              Xem chi tiết note và chọn <strong>Bỏ note</strong> nếu đã xử lý xong.
            </DialogDescription>
          </DialogHeader>
          {selectedNote ? (
            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Trạng thái</Label>
                <p className="font-medium">{selectedNote.status ?? 'Open'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nội dung</Label>
                <p className="rounded border bg-muted/40 p-2 text-sm whitespace-pre-wrap">
                  {selectedNote.note ?? selectedNote.title ?? '(Không có nội dung)'}
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setSelectedNote(null)}>Đóng</Button>
            <Button
              variant="destructive"
              onClick={() => handleDismissNote(selectedNote)}
              disabled={updateIssueStatus.isPending}
            >
              {updateIssueStatus.isPending ? 'Đang bỏ...' : 'Bỏ note'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
