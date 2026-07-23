import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileDown,
  Image as ImageIcon,
  Layers as LayersIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePageLayers } from '@/hooks/usePageLayers.js'
import { chaptersService, usersService, pageIssuesService, pagesService } from '@/api/api.js'
import LayerCanvas from './LayerCanvas.jsx'
import LayerStackPanel from './LayerStackPanel.jsx'
import LayerInspectDialog from './LayerInspectDialog.jsx'
import { ImageLightbox } from './ImageLightbox.jsx'

const CANVAS_W = 800
const CANVAS_H = 1100

export default function LayerEditor({ chapter, pageId: pageIdProp, onSubmitted, pages: pagesProp, pageIssues: pageIssuesProp, fullscreen = false }) {
  const pages = pagesProp ?? chapter?.pages ?? []
  const [pageIdx, setPageIdx] = useState(0)
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showOriginal, setShowOriginal] = useState(true)
  const [showNotes, setShowNotes] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [inspectOpen, setInspectOpen] = useState(false)
  const [pageNotes, setPageNotes] = useState(pageIssuesProp ?? [])
  const [notesLoading, setNotesLoading] = useState(false)
  const [user, setUser] = useState(null)

  const safeIdx = Math.min(Math.max(0, pageIdx), Math.max(0, pages.length - 1))
  const safePage = pages[safeIdx] ?? null
  const activePageId = safePage?.id ?? pageIdProp ?? null

  // Lấy user info cho uploaderId
  useEffect(() => {
    usersService.getProfile()
      .then(res => {
        const raw = res?.data ?? res
        setUser(raw?.data ?? raw)
      })
      .catch(() => null)
  }, [])

  const layersApi = usePageLayers(activePageId, { uploaderId: user?.userid ?? user?.id ?? null })
  const {
    layers,
    originalImage,
    resultImage,
    loading,
    saving,
    hasChanges,
    uploading,
    finalizing,
    addLayer,
    updateLayer,
    toggleVisibility,
    setLocalOpacity,
    deleteLayer,
    reorderLayers,
    finalize,
    refresh,
    saveChanges,
  } = layersApi

  // Cảnh báo khi người dùng tắt trình duyệt / chuyển trang khác mà chưa lưu
  useEffect(() => {
    if (!hasChanges) return undefined
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = 'Bạn có thay đổi chưa lưu. Bạn có chắc muốn rời đi?'
      return e.returnValue
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  const handlePageChange = (newIdx) => {
    if (hasChanges) {
      const ok = window.confirm('Bạn có thay đổi chưa lưu trên trang này. Chuyển trang khác sẽ mất những thay đổi này. Bạn có chắc muốn tiếp tục?')
      if (!ok) return
    }
    setPageIdx(newIdx)
  }

  // Notes cho page hiện tại — dùng pageId (preferred) thay vì chapterId
  useEffect(() => {
    // Nếu có pageIssuesProp (từ submission) thì dùng trực tiếp, không gọi API
    if (pageIssuesProp && pageIssuesProp.length > 0) {
      setPageNotes(pageIssuesProp)
      return
    }
    let cancelled = false
    async function load() {
      if (!activePageId) {
        setPageNotes([])
        return
      }
      setNotesLoading(true)
      try {
        // BE trả về raw array PageIssueDto[] — không filter theo status
        // để hiển thị cả "Pending" (note mới từ Mangaka)
        const res = await pageIssuesService.getAll({ pageId: activePageId })
        if (cancelled) return
        const raw = res?.data
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
        // Map BE fields → UI fields (BE trả PascalCase nhưng snake-case transform sẽ đổi)
        // BE: issueid, pageid, description, status, boxX, boxY, boxWidth, boxHeight
        // Sau transform: issueid, pageid, description, status, box_x, box_y, box_width, box_height
        const mapped = list.map(n => ({
          id: n.issue_id ?? n.issueid ?? n.issueId ?? n.Issueid ?? n.id,
          pageId: n.page_id ?? n.pageid ?? n.pageId ?? n.Pageid,
          description: n.description ?? n.Description ?? '',
          status: n.status ?? n.Status ?? 'Pending',
          x: Number(n.box_x ?? n.boxx ?? n.boxX ?? n.BoxX ?? n.x ?? 0),
          y: Number(n.box_y ?? n.boxy ?? n.boxY ?? n.BoxY ?? n.y ?? 0),
          w: Number(n.box_width ?? n.boxwidth ?? n.boxWidth ?? n.BoxWidth ?? n.w ?? n.width ?? 10),
          h: Number(n.box_height ?? n.boxheight ?? n.boxHeight ?? n.BoxHeight ?? n.h ?? n.height ?? 10),
        }))
        console.log('[LayerEditor] notes for pageId', activePageId, '→', mapped.length, 'items:', mapped.map(n => ({ id: n.id, status: n.status, desc: n.description?.slice(0, 30) })))
        setPageNotes(mapped)
      } catch (err) {
        console.error('[LayerEditor] failed to load notes:', err)
        if (!cancelled) setPageNotes([])
      } finally {
        if (!cancelled) setNotesLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [activePageId])

  const baseImage = showOriginal ? (originalImage ?? safePage?.url ?? null) : null

  const handleAddLayer = useCallback(async (file) => {
    if (!activePageId) {
      toast.error('Chưa có trang để thêm layer. Hãy chọn 1 trang trước.')
      return
    }
    const nextIdx = layers.length
    await addLayer({ file, index: nextIdx })
  }, [activePageId, layers.length, addLayer])

  const handleFinalize = useCallback(async () => {
    if (!activePageId) return
    try {
      await finalize()
    } catch { /* toast đã hiện */ }
  }, [activePageId, finalize])

  const handleSubmitChapter = useCallback(async () => {
    if (!chapter?.chapterId) {
      toast.error('Không tìm thấy chapterId — không thể gửi.')
      return
    }
    if (!activePageId) {
      toast.error('Chưa chọn trang để gửi.')
      return
    }
    setSubmittingAll(true)
    try {
      if (hasChanges) {
        toast.info('Đang lưu thay đổi...')
        await saveChanges()
      }
      toast.info('Đang gửi trang cho Mangaka…')
      await pagesService.updateIsSentToMangaka(activePageId, true)
      
      // Update chapter status
      // LƯU Ý: backend chỉ chấp nhận các trạng thái Chapter: InProduction, Ready,
      // Delayed, Cancelled, Published (xem _validTransitions trong ChapterService.cs).
      // Từ InProduction, bước hợp lệ để báo "đã xong, chờ Mangaka duyệt" là "Ready".
      if (chaptersService.updateStatus) {
        await chaptersService.updateStatus(chapter.chapterId, 'Ready')
      }
      toast.success('Đã gửi trang cho Mangaka.')
      onSubmitted?.()
    } catch (err) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Gửi trang thất bại.')
    } finally {
      setSubmittingAll(false)
    }
  }, [chapter?.chapterId, activePageId, hasChanges, saveChanges, onSubmitted])

  const baseFileName = `${chapter?.seriesTitle ?? 'chapter'}-Ch${chapter?.chapterNum ?? ''}`
  const pageLabel = `Trang ${safeIdx + 1}`

  return (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-zinc-950',
        fullscreen ? 'rounded-none border-none' : 'shadow-xl shadow-black/30',
      )}
    >
      {/* TOPBAR */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-zinc-950/95 px-4 py-2 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/20">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white/90">
              {chapter?.seriesTitle} · Ch.{chapter?.chapterNum}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
              <span>
                <span className="font-medium text-white/60">
                  Trang {safeIdx + 1} / {pages.length}
                </span>
              </span>
              <span className="text-white/20">·</span>
              <span>
                <span className="font-semibold text-violet-400">{layers.length}</span> layer
                {layers.length !== 1 ? 's' : ''}
              </span>
              {resultImage && originalImage && resultImage !== originalImage && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                    đã gộp
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {pages.length > 1 && (
            <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                disabled={safeIdx <= 0}
                onClick={() => handlePageChange(Math.max(0, safeIdx - 1))}
                title="Trang trước"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[3.5rem] px-2 text-center text-xs font-bold tabular-nums text-white/80">
                {safeIdx + 1} / {pages.length}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                disabled={safeIdx >= pages.length - 1}
                onClick={() => handlePageChange(Math.min(pages.length - 1, safeIdx + 1))}
                title="Trang sau"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}

          <div className="mx-1 h-6 w-px bg-white/10" />

          <Button
            size="sm"
            variant={showOriginal ? 'secondary' : 'ghost'}
            className={cn(
              'h-8 gap-1.5 px-2.5 text-xs font-medium',
              showOriginal
                ? 'border border-violet-500/40 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                : 'text-white/50 hover:bg-white/10 hover:text-white/80',
            )}
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Gốc
          </Button>


          {pageNotes.length > 0 && (
            <Button
              size="sm"
              variant={showNotes ? 'secondary' : 'ghost'}
              className={cn(
                'h-8 gap-1.5 px-2.5 text-xs font-medium',
                showNotes
                  ? 'border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                  : 'text-white/50 hover:bg-white/10 hover:text-white/80',
              )}
              onClick={() => setShowNotes((v) => !v)}
            >
              <span className="inline-block size-2 rounded-sm bg-rose-500" />
              Note ({pageNotes.length})
            </Button>
          )}

          <div className="mx-1 h-6 w-px bg-white/10" />

          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={() => {
              const url = safePage?.url
              if (!url) return
              const a = document.createElement('a')
              a.href = url
              a.download = `${baseFileName}-p${safeIdx + 1}.png`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              toast.success('Đã tải ảnh gốc.')
            }}
            disabled={!safePage?.url}
            title="Tải ảnh gốc"
          >
            <ArrowDownToLine className="size-3.5" />
          </Button>

          {resultImage && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => {
                const a = document.createElement('a')
                a.href = resultImage
                a.download = `${baseFileName}-p${safeIdx + 1}-final.png`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                toast.success('Đã tải ảnh gộp.')
              }}
              title="Tải ảnh gộp"
            >
              <FileDown className="size-3.5" />
            </Button>
          )}

          <Button
            size="icon-sm"
            variant="ghost"
            className={cn(
              'size-8 text-white/50 hover:bg-white/10 hover:text-white',
              loading && 'animate-spin',
            )}
            onClick={() => refresh()}
            title="Làm mới"
          >
            <RefreshCw className="size-4" />
          </Button>

          {/* Xem từng layer — mở modal kiểm tra bật/tắt riêng lẻ */}
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={() => setInspectOpen(true)}
            disabled={layers.length === 0}
            title="Xem từng layer"
          >
            <LayersIcon className="size-4" />
          </Button>

          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={() => setLightbox({ src: resultImage || baseImage, title: `Trang ${safeIdx + 1} · ${layers.length} layer` })}
            disabled={!baseImage && !resultImage}
            title="Phóng to ảnh"
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </header>

      {/* MAIN AREA */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black">
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3"
          >
            {/*
              LayerCanvas tự đo kích thước khung chứa (containerRef, qua ResizeObserver)
              và tự tính zoom để canvas fit đúng khung — không cần ép aspect-ratio bằng
              CSS ở đây nữa (cách cũ dùng style aspectRatio từng xung đột với logic fit
              JS bên trong, khiến container luôn khớp sẵn tỉ lệ 800:1100 một cách giả tạo).

              fitMode="contain": ảnh trang luôn hiện TRỌN VẸN trong khung, không bao
              giờ bị crop mất góc hay note đánh dấu ở rìa (như từng xảy ra với
              fitMode="cover" trước đây — giả định "tỉ lệ khung gần giống tỉ lệ
              trang" hoá ra không đúng với dữ liệu thực tế, khiến các note ở góc
              trên bị cắt cụt). Đánh đổi duy nhất là có thể dư viền đen 2 bên nếu
              tỉ lệ trang khác tỉ lệ khung — chấp nhận được để đổi lấy việc không
              bao giờ mất nội dung/note.
            */}
            <LayerCanvas
              layers={layers}
              width={CANVAS_W}
              height={CANVAS_H}
              mode="edit"
              fullscreen={fullscreen}
              baseImage={baseImage}
              className="h-full w-full"
              fitMode="contain"
              notes={pageNotes}
              showNotes={showNotes}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/5 bg-zinc-950/95 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-3">
              {(uploading || notesLoading || finalizing) && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60 backdrop-blur">
                  <Loader2 className="size-3 animate-spin text-violet-400" />
                  {uploading ? 'Đang upload layer…' : finalizing ? 'Đang gộp ảnh…' : 'Đang tải ghi chú…'}
                </div>
              )}
              {pages.length > 1 && (
                <span className="text-[11px] text-white/30">{pages.length} trang trong chapter</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  'h-8 gap-1.5 border px-3 text-xs font-medium transition-all duration-200',
                  hasChanges
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50'
                    : 'text-white/40 border-white/5 bg-white/5 cursor-not-allowed opacity-50'
                )}
                onClick={saveChanges}
                disabled={saving || !hasChanges}
                title="Lưu tất cả thay đổi của layer"
              >
                {saving ? (
                  <><Loader2 className="size-3.5 animate-spin" /> Đang lưu…</>
                ) : (
                  <>Lưu thay đổi</>
                )}
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500"
                disabled={submittingAll || saving || !activePageId}
                onClick={handleSubmitChapter}
              >
                {submittingAll ? (
                  <><Loader2 className="size-3.5 animate-spin" /> Đang gửi trang…</>
                ) : (
                  <><Send className="size-3.5" /> Gửi Mangaka</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar — Final image preview + layer stack */}
        <div className="flex w-96 shrink-0 flex-col border-l border-white/5 bg-zinc-950">
          {/* Final preview */}
          {resultImage && (
            <div className="border-b border-white/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <ImageIcon className="size-3" />
                  </div>
                  <span className="text-xs font-semibold text-white/80">Ảnh gộp</span>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  sẵn sàng
                </span>
              </div>
              <div
                className="group/final relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/5"
                onClick={() => setInspectOpen(true)}
                title="Click để kiểm tra từng layer"
              >
                <img
                  src={resultImage}
                  alt="Final"
                  className="block h-28 w-full object-contain"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/final:bg-black/40">
                  <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover/final:opacity-100">
                    <LayersIcon className="size-3" /> Xem layer
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden p-2">
            <LayerStackPanel
              layers={layers}
              loading={loading}
              uploading={uploading}
              onAddLayer={handleAddLayer}
              onToggle={toggleVisibility}
              onOpacity={(id, op) => setLocalOpacity(id, op)}
              onRemove={deleteLayer}
              onRename={(id, name) => updateLayer(id, { name })}
              onReorder={reorderLayers}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.title}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}

      <LayerInspectDialog
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        layers={layers}
        baseImage={baseImage}
        width={CANVAS_W}
        height={CANVAS_H}
        pageLabel={pageLabel}
      />
    </div>
  )
}