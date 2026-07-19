import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImageIcon,
  Layers as LayersIcon,
  Loader2,
  Maximize2,
  MessageSquareWarning,
  Send,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pagesService, pageIssuesService } from '@/api/api.js'
import { layersService } from '@/api/layersService.js'

/**
 * Modal xem ảnh composite đã gộp từ Assistant. Có 2 hành động:
 *  - onApprove: chấp nhận chapter
 *  - onRequestRevision(comment?): yêu cầu Assistant sửa lại
 *
 * Props:
 *  - open: boolean
 *  - chapter: object chapter đang duyệt
 *  - onClose(): đóng dialog
 *  - onApprove(): duyệt
 *  - onRequestRevision(note?: string): yêu cầu sửa
 *  - busy: disable các nút trong khi mutation đang chạy
 */
export default function ReviewCompositeDialog({
  open,
  chapter,
  onClose,
  onApprove,
  onRequestRevision,
  busy = false,
}) {
  const chapterId = chapter?.id ?? chapter?.chapterId ?? null
  const [pageIdx, setPageIdx] = useState(0)
  const [reviewNote, setReviewNote] = useState('')
  const [previewLayer, setPreviewLayer] = useState(null) // { id, name, url, z, opacity } | null

  // Load các page của chapter
  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['pages', chapterId],
    enabled: !!chapterId && open,
    queryFn: async () => {
      const res = await pagesService.getAll(chapterId)
      const raw = res?.data
      return Array.isArray(raw) ? raw : (raw?.data ?? [])
    },
    staleTime: 30_000,
  })

  const pages = Array.isArray(pagesData) ? pagesData : []
  const rawFirstPage = pages[0] ?? null
  // BE trả id dưới nhiều dạng: Pageid / pageid / pageId / Id / id / PageId.
  const firstPageIdRaw =
    rawFirstPage?.Pageid
    ?? rawFirstPage?.pageid
    ?? rawFirstPage?.pageId
    ?? rawFirstPage?.PageId
    ?? rawFirstPage?.Id
    ?? rawFirstPage?.id
    ?? null
  const safeIdx = Math.min(Math.max(0, pageIdx), Math.max(0, pages.length - 1))
  const safePage = pages[safeIdx] ?? null
  const safePageId =
    safePage?.Pageid
    ?? safePage?.pageid
    ?? safePage?.pageId
    ?? safePage?.PageId
    ?? safePage?.Id
    ?? safePageId
    ?? null
  // Log 1 lần keys của page đầu tiên để biết BE gọi field id là gì
  if (typeof window !== 'undefined' && window.console && pages.length > 0 && !window.__rcKeysLogged) {
    window.__rcKeysLogged = true
    // eslint-disable-next-line no-console
    console.log('[ReviewCompositeDialog] firstPageKeys=' + (rawFirstPage ? Object.keys(rawFirstPage).join(',') : 'null'),
      'samplePage=' + JSON.stringify({
        ...rawFirstPage,
        pageimageurl: rawFirstPage?.pageimageurl ?? '<none>',
        // cắt url dài cho gọn
        pageImageUrl: rawFirstPage?.pageImageUrl ?? '<none>',
      }))
  }
  const compositeUrl =
    safePage?.pageimageurl
    ?? safePage?.pageImageUrl
    ?? safePage?.compositeimageurl
    ?? safePage?.compositeImageUrl
    ?? safePage?.composite_image_url
    ?? null

  // Layer do Assistant upload lên cho page này — Mangaka có thể bật/tắt để soi từng layer.
  // BE thật: GET /PageLayers?pageId=<id> (layersService.list đã unwrap về mảng).
  // Một số page DTO có thể kèm field "layers" (embedded) — lấy nguồn đầy đủ hơn.
  const { data: layersDataObj, isLoading: layersLoading } = useQuery({
    queryKey: ['pageLayers', safePageId],
    enabled: !!safePageId && open,
    queryFn: async () => {
      try {
        const [pageRes, listRes] = await Promise.all([
          pagesService.getById(safePageId).catch(() => null),
          layersService.list(safePageId).catch(() => null),
        ])
        const p = pageRes?.data ?? pageRes
        const embedded = Array.isArray(p?.layers) ? p.layers : []
        const standalone = Array.isArray(listRes)
          ? listRes
          : (Array.isArray(listRes?.data) ? listRes.data : [])
        const pool = embedded.length > 0 ? embedded : standalone
        if (embedded.length > 0 && Array.isArray(standalone)) {
          const seen = new Set(embedded.map((x) => String(
            x?.layerid ?? x?.layer_id ?? x?.LayerId ?? x?.id ?? '',
          )))
          for (const s of standalone) {
            const sid = String(s?.layerid ?? s?.layer_id ?? s?.LayerId ?? s?.id ?? '')
            if (sid && !seen.has(sid)) pool.push(s)
          }
        }
        const originalUrl =
          p?.originalImageUrl ??
          p?.originalimageurl ??
          p?.original_image_url ??
          p?.pageimageurl ??
          p?.Pageimageurl ??
          null
        return { layers: pool, originalUrl }
      } catch (e) {
        console.warn('[ReviewCompositeDialog] load layers failed:', e)
        return { layers: [], originalUrl: null }
      }
    },
    staleTime: 15_000,
  })

  const layersRaw = layersDataObj?.layers ?? []
  const originalUrl = layersDataObj?.originalUrl ?? null

  // localVisible cho phép tắt/mở từng layer trong dialog mà không gọi BE.
  const [localVisible, setLocalVisible] = useState({})
  // focusedLayerId: khi bấm row layer → chỉ hiện layer đó, các layer khác ẩn.
  // Bấm lại row đó (hoặc nút Reset focus) → bỏ focus.
  const [focusedLayerId, setFocusedLayerId] = useState(null)
  useEffect(() => {
    // reset khi đổi trang
    setLocalVisible({})
  }, [safePageId])

  const layers = useMemo(() => {
    const list = Array.isArray(layersRaw) ? layersRaw : []
    return list
      .map((raw) => {
        const id = String(
          raw?.layerid
          ?? raw?.layer_id
          ?? raw?.LayerId
          ?? raw?.id
          ?? ''
        )
        // URL: BE PascalCase thường là "Imageurl" / "Fileurl" / "ImageUrl" / "FileUrl";
        // 1 số BE trả "imageurl"/"fileurl"/"image_url"/"file_url"/"url".
        const url =
          raw?.Imageurl
          ?? raw?.imageurl
          ?? raw?.image_url
          ?? raw?.Fileurl
          ?? raw?.fileurl
          ?? raw?.file_url
          ?? raw?.ImageUrl
          ?? raw?.FileUrl
          ?? raw?.imageUrl
          ?? raw?.url
          ?? raw?.Url
          ?? ''
        const name =
          raw?.Layername
          ?? raw?.layername
          ?? raw?.layer_name
          ?? raw?.LayerName
          ?? raw?.name
          ?? `Layer ${raw?.zindex ?? raw?.index ?? 0}`
        const z = Number(
          raw?.Zindex
          ?? raw?.zindex
          ?? raw?.z_index
          ?? raw?.index
          ?? raw?.zIndex
          ?? 0
        )
        const op = Number(
          raw?.Opacity
          ?? raw?.opacity
          ?? 1
        )
        const opacity = Number.isFinite(op) && op > 1 ? op / 100 : (Number.isFinite(op) ? op : 1)
        const isVisibleRaw =
          raw?.Isvisible
          ?? raw?.isvisible
          ?? raw?.isVisible
          ?? raw?.visible
          ?? true
        const isVisible = isVisibleRaw !== false && isVisibleRaw !== 0 && isVisibleRaw !== 'false'
        return { id, url, name, z, opacity, isVisible }
      })
      .filter((l) => l.id)
      .sort((a, b) => a.z - b.z)
  }, [layersRaw])

  // Khi danh sách layer đổi, tôn trọng isvisible=false của BE làm trạng thái ẩn ban đầu.
  useEffect(() => {
    if (layers.length === 0) return
    setLocalVisible((cur) => {
      const next = { ...cur }
      let changed = false
      for (const l of layers) {
        if (l.isVisible === false && next[l.id] !== false) {
          next[l.id] = false
          changed = true
        }
      }
      return changed ? next : cur
    })
  }, [layers])

  const visibleLayerCount = useMemo(
    () => layers.reduce((acc, l) => acc + (isLayerVisible(l) ? 1 : 0), 0),
    [layers, focusedLayerId, localVisible]
  )

  // Khi có focusedLayerId, layer đó hiện, các layer khác ẩn.
  // Khi không focus, lấy theo localVisible như cũ.
  function isLayerVisible(l) {
    if (focusedLayerId) return l.id === focusedLayerId
    return localVisible[l.id] !== false
  }

  function toggleFocus(l) {
    setFocusedLayerId((cur) => (cur === l.id ? null : l.id))
  }

  function clearFocus() {
    setFocusedLayerId(null)
  }

  if (typeof window !== 'undefined' && window.console) {
    // In JSON để log không bị collapse thành "Object" trong DevTools.
    const safe = (v) => {
      try { return JSON.stringify(v) } catch { return String(v) }
    }
    // eslint-disable-next-line no-console
    console.log(
      '[ReviewCompositeDialog]',
      'page=' + (safeIdx + 1),
      'safePageId=' + safe(safePageId),
      'pagesLen=' + pages.length,
      'layersRawLen=' + (Array.isArray(layersRaw) ? layersRaw.length : 'not-array'),
      'layersMapped=' + layers.length,
      'compositeUrl=' + (compositeUrl ? '<set>' : 'null'),
      'layers=' + safe(layers.map((l) => ({ id: l.id, z: l.z, url: l.url ? '<set>' : 'null', name: l.name, hidden: localVisible[l.id] === false }))),
    )
  }

  // Reset về page đầu khi đổi chapter
  useEffect(() => {
    if (open) setPageIdx(0)
  }, [open, chapterId])

  // Đếm số note của page hiện tại để hiện badge
  const { data: issueCount } = useQuery({
    queryKey: ['pageIssues', 'count', safePageId],
    enabled: !!safePageId,
    queryFn: async () => {
      const res = await pageIssuesService.getAll({ pageId: safePageId })
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.data ?? [])
      return list.length
    },
    staleTime: 15_000,
  })

  function handleApprove() {
    if (busy) return
    if (!safePageId) return
    onApprove?.(safePageId)
  }

  async function handleRequestRevision() {
    if (busy) return
    if (!safePageId) {
      toast.error('Chưa có trang nào để ghi chú.')
      return
    }
    const note = reviewNote.trim()
    if (!note) {
      toast.error('Hãy nhập ghi chú trước khi yêu cầu sửa.')
      return
    }
    try {
      // Ghi 1 PageIssue kèm note để Assistant đọc được
      await pageIssuesService.create({
        pageId: Number(safePageId),
        description: note,
        status: 'Pending',
        boxX: 0,
        boxY: 0,
        boxWidth: 1,
        boxHeight: 1,
      })
    } catch (err) {
      // Nếu service không hỗ trợ create theo shape này, vẫn tiếp tục flow duyệt.
      console.warn('[ReviewCompositeDialog] failed to write note:', err)
    }
    onRequestRevision?.(safePageId, note)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="size-4 text-primary" />
                {chapter?.series ?? chapter?.seriesTitle ?? 'Chapter'}
                <span className="text-muted-foreground">· Ch.{chapter?.num ?? chapter?.chapterNum}</span>
              </DialogTitle>
              <DialogDescription>
                {chapter?.title || 'Xem lại ảnh đã gộp trước khi duyệt.'}
              </DialogDescription>
            </div>
            {/* Bỏ nút X thủ công — DialogContent shadcn đã tự render nút close ở góc trên-phải. */}
          </div>
        </DialogHeader>

        {/* Body: ảnh composite + sidebar note */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Canvas */}
          <div className="flex min-h-0 flex-1 flex-col bg-zinc-950">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              {pagesLoading ? (
                <div className="flex items-center gap-2 text-white/60">
                  <Loader2 className="size-5 animate-spin" />
                  Đang tải trang…
                </div>
              ) : (
                <CompositeStack compositeUrl={compositeUrl} originalUrl={originalUrl} layers={layers} isLayerVisible={isLayerVisible} pageNumber={safeIdx + 1} />
              )}
            </div>

            {pages.length > 1 && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/5 bg-zinc-950 px-4 py-2 text-white/70">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/60 hover:bg-white/10 hover:text-white"
                  disabled={safeIdx <= 0}
                  onClick={() => setPageIdx(i => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs tabular-nums">
                  Trang {safeIdx + 1} / {pages.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/60 hover:bg-white/10 hover:text-white"
                  disabled={safeIdx >= pages.length - 1}
                  onClick={() => setPageIdx(i => Math.min(pages.length - 1, i + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar: note + actions */}
          <aside className="flex w-full shrink-0 flex-col gap-3 border-t bg-card p-4 md:w-80 md:border-l md:border-t-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Thông tin chapter
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Số trang:</span>
                  <span className="font-semibold">{pages.length}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Note hiện có:</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {issueCount ?? 0}
                  </Badge>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <Badge variant="secondary" className="bg-sky-100 text-sky-700">
                    Đã gộp
                  </Badge>
                </li>
              </ul>
            </div>

            {/* Layer do Assistant upload — Mangaka bật/tắt để soi từng layer.
                Luôn hiển thị khối này để Mangaka biết BE có / không có layer nào.
                Nếu rỗng → hiển thị "chưa có layer nào" thay vì ẩn để khỏi hiểu nhầm. */}
            <div className="flex min-h-0 flex-col">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <LayersIcon className="size-3.5" />
                  Layer của Assistant
                </p>
                <div className="flex items-center gap-1">
                  {focusedLayerId && (
                    <button
                      type="button"
                      onClick={clearFocus}
                      className="flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                      title="Bỏ focus, hiện lại tất cả layer"
                    >
                      <X className="size-3" />
                      <span>Bỏ focus</span>
                    </button>
                  )}
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {visibleLayerCount}/{layers.length}
                  </Badge>
                </div>
              </div>

              <div className="max-h-56 min-h-[80px] overflow-y-auto rounded-md border bg-background/50">
                {layersLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Đang tải layer…
                  </div>
                ) : layers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1 px-3 py-6 text-center text-[11px] text-muted-foreground">
                    <ImageIcon className="size-4 opacity-50" />
                    <span>Chưa có layer nào do Assistant gửi.</span>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {layers.map((l) => {
                      const hidden = localVisible[l.id] === false
                      const focused = focusedLayerId === l.id
                      return (
                        <li
                          key={l.id}
                          className={`group flex items-center gap-1.5 px-1.5 py-1.5 text-[11px] ${
                            focused ? 'rounded bg-primary/10 ring-1 ring-primary/40' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setLocalVisible((cur) => ({ ...cur, [l.id]: hidden }))
                            }
                            className={`shrink-0 rounded p-1 transition-colors ${
                              hidden
                                ? 'text-muted-foreground hover:bg-muted'
                                : 'text-primary hover:bg-primary/10'
                            }`}
                            title={hidden ? 'Hiện layer' : 'Ẩn layer'}
                          >
                            {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            #{l.z}
                          </span>
                          {/* Thumbnail — bấm vào ảnh để focus layer (chỉ hiện layer này) */}
                          {l.url ? (
                            <button
                              type="button"
                              onClick={() => toggleFocus(l)}
                              className={`relative h-7 w-7 shrink-0 overflow-hidden rounded border bg-muted transition-all hover:ring-2 hover:ring-primary/40 ${
                                focused ? 'border-primary ring-2 ring-primary/60' : ''
                              }`}
                              title={`Focus layer: ${l.name}`}
                            >
                              <img
                                src={l.url}
                                alt={l.name}
                                className="h-full w-full object-cover"
                                draggable={false}
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-dashed bg-muted text-muted-foreground">
                              <ImageIcon className="size-3" />
                            </span>
                          )}
                          {/* Bấm vào tên layer → toggle focus */}
                          <button
                            type="button"
                            onClick={() => toggleFocus(l)}
                            className={`min-w-0 flex-1 truncate text-left ${
                              hidden ? 'text-muted-foreground line-through' : ''
                            } ${focused ? 'font-semibold text-primary' : ''}`}
                            title={`Focus: ${l.name}`}
                          >
                            {l.name}
                          </button>
                          {l.url && (
                            <button
                              type="button"
                              onClick={() => setPreviewLayer(l)}
                              className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] text-primary opacity-60 transition-opacity hover:bg-primary/10 hover:opacity-100"
                              title="Mở ảnh layer ở kích thước lớn (modal)"
                            >
                              <Maximize2 className="size-3" />
                              <span>Xem</span>
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="rev-note"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <MessageSquareWarning className="mb-0.5 mr-1 inline size-3.5" />
                Ghi chú yêu cầu sửa
              </label>
              <textarea
                id="rev-note"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={4}
                placeholder="Mô tả phần Assistant cần sửa…"
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-xs"
                disabled={busy}
              />
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <Button
                onClick={handleApprove}
                disabled={busy}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white hover:from-emerald-500 hover:to-teal-500"
              >
                {busy ? (
                  <><Loader2 className="mr-1 size-4 animate-spin" /> Đang xử lý…</>
                ) : (
                  <><Send className="mr-1 size-4" /> Duyệt — chuyển tiếp</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleRequestRevision}
                disabled={busy || !reviewNote.trim()}
                className="w-full border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
              >
                <MessageSquareWarning className="mr-1 size-4" />
                Yêu cầu Assistant sửa
              </Button>
            </div>
          </aside>
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/30 px-5 py-2 text-[11px] text-muted-foreground sm:justify-start">
          Hành động này sẽ cập nhật trạng thái chapter. Assistant sẽ nhận được thông báo tương ứng.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Mount modal preview ngoài <Dialog> chính để tránh xung đột portal/nút X.
// Mount modal preview ra document.body bằng Portal — hoàn toàn tách biệt DOM tree
// với Dialog chính, nên chỉ có 1 nút X duy nhất.
function LayerPreviewPortal({ layer, onClose }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <LayerPreviewDialog layer={layer} onClose={onClose} />,
    document.body,
  )
}

/**
 * Vẽ ảnh nền (ảnh gộp) + các layer đang bật của Assistant chồng lên.
 * - Có compositeUrl → layer đầu tiên là <img> gốc (đã gộp).
 * - Không có → dùng layer đầu tiên đang bật làm nền để xem layer trống.
 * - localVisible: { [layerId]: false } = ẩn, mặc định hiện.
 */
function CompositeStack({ compositeUrl, originalUrl, layers, isLayerVisible, pageNumber }) {
  const visibleLayers = layers.filter((l) => isLayerVisible?.(l) ?? true)

  // Ưu tiên originalUrl làm ảnh nền để khi ẩn/hiện các layer overlay động sẽ có hiệu ứng chuẩn.
  // Nếu không có originalUrl, fallback về compositeUrl hoặc layer cao nhất.
  let baseSrc = originalUrl || compositeUrl || null
  if (!baseSrc && visibleLayers.length > 0) {
    const top = [...visibleLayers].sort((a, b) => b.z - a.z)[0]
    baseSrc = top?.url || null
  }

  if (!baseSrc) {
    return (
      <div className="flex flex-col items-center gap-2 text-white/40">
        <ImageIcon className="size-10" />
        <p className="text-xs">Trang này chưa có ảnh gộp hoặc layer nào.</p>
        <p className="px-4 text-center text-[10px] opacity-70">
          Yêu cầu Assistant upload layer & bấm "Hoàn tất" để composite trước khi gửi duyệt.
        </p>
      </div>
    )
  }

  const overlays = visibleLayers.filter(
    (l) => l.url && l.url !== baseSrc,
  )

  return (
    <div className="relative flex max-w-full items-center justify-center p-1">
      <div className="relative flex items-center justify-center">
        <img
          src={baseSrc}
          alt={`Trang ${pageNumber}`}
          className="max-h-[75vh] w-auto max-w-full rounded bg-white object-contain shadow-2xl"
          draggable={false}
        />
        {overlays.length > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {overlays.map((l) => (
              <img
                key={l.id}
                src={l.url}
                alt={l.name}
                style={{ opacity: l.opacity }}
                className="max-h-[75vh] w-auto max-w-full object-contain"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ))}
          </div>
        )}
        {!compositeUrl && (
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            Chưa gộp — đang hiện layer cao nhất
          </div>
        )}
      </div>

      <a
        href={baseSrc}
        target="_blank"
        rel="noreferrer"
        className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
        title="Xem ảnh đầy đủ trong tab mới"
      >
        <Maximize2 className="size-4" />
      </a>
    </div>
  )
}

/**
 * Modal xem ảnh layer full-size + URL copy + nút tải.
 * Dùng overlay thủ công (không lồng <Dialog> khác trong dialog cha) để:
 *   - Tránh bị 2 nút X (DialogContent của shadcn tự có nút X).
 *   - Tránh xung đột portal/focus giữa 2 modal.
 */
function LayerPreviewDialog({ layer, onClose }) {
  // ESC để đóng
  useEffect(() => {
    if (!layer) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layer, onClose])

  if (!layer) return null
  const url = layer.url

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-lg bg-zinc-950 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LayersIcon className="size-4 text-primary" />
              <span className="truncate">{layer.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-white/50">z=#{layer.z}</span>
            </div>
            <div className="text-[11px] text-white/50">
              Xem ảnh layer do Assistant gửi · opacity {Math.round((layer.opacity ?? 1) * 100)}%
            </div>
          </div>
          {/* NÚT X DUY NHẤT */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="size-8 shrink-0 rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="mx-auto size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
          {url ? (
            <img
              src={url}
              alt={layer.name}
              className="max-h-[80vh] w-auto max-w-full rounded object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-white/40">
              <ImageIcon className="size-10" />
              <p className="text-xs">Layer này không có URL ảnh.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-4 py-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
            >
              Mở tab mới
            </a>
          )}
          {url && (
            <button
              type="button"
              onClick={() => {
                try {
                  navigator.clipboard?.writeText(url)
                  toast.success('Đã copy URL ảnh layer.')
                } catch {
                  toast.error('Không copy được, hãy copy thủ công.')
                }
              }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
            >
              Copy URL
            </button>
          )}
          {url && (
            <a
              href={url}
              download={`layer-${layer.id}.png`}
              className="rounded-md bg-primary/80 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary"
            >
              Tải về
            </a>
          )}
          <span
            className="ml-auto max-w-[60%] truncate font-mono text-[10px] text-white/40"
            title={url}
          >
            {url || '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
