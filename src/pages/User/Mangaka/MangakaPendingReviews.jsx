import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { pagesService } from '@/api/api.js'
import { useUpdateChapterStatus, useUpdatePageStatus } from '@/api/hooks/useApi.js'
import { layersService } from '@/api/layersService.js'
import ReviewCompositeDialog from './ReviewCompositeDialog.jsx'

/**
 * Card "Chapter chờ duyệt" hiển thị các chapter có status === 'Ready'
 * (Assistant đã gộp layer & gửi qua). Click vào card mở dialog xem
 * ảnh composite + Duyệt / Yêu cầu sửa.
 *
 * Props:
 *  - chapterRows: Array các chapter từ Mangaka.jsx
 *  - onNavigateTab(tab): callback khi muốn chuyển sang tab khác
 */
export default function MangakaPendingReviews({ chapterRows, onNavigateTab }) {
  const pending = (chapterRows ?? []).filter(c => String(c.status).toLowerCase() === 'ready')
  const updateStatus = useUpdateChapterStatus()
  const updatePageStatus = useUpdatePageStatus()
  const [openChapterId, setOpenChapterId] = useState(null)
  const [busy, setBusy] = useState(false)

  const openChapter = pending.find(c => (c.id ?? c.chapterId) === openChapterId) ?? null

  function closeDialog() {
    setOpenChapterId(null)
    setBusy(false)
  }

  async function handleApprove(chapterId) {
    if (!chapterId) return
    setBusy(true)
    try {
      await updateStatus.mutateAsync({ id: Number(chapterId), status: 'Ready' })
    } finally {
      setBusy(false)
      closeDialog()
    }
  }

  async function handleRequestRevision(chapterId) {
    if (!chapterId) return
    setBusy(true)
    try {
      await updateStatus.mutateAsync({ id: Number(chapterId), status: 'InProduction' })
    } finally {
      setBusy(false)
      closeDialog()
    }
  }

  async function handleApprovePage(pageId) {
    if (!pageId) return
    setBusy(true)
    try {
      await updatePageStatus.mutateAsync({ id: Number(pageId), status: 'Approved' })
    } finally {
      setBusy(false)
      closeDialog()
    }
  }

  async function handleRequestRevisionPage(pageId) {
    if (!pageId) return
    setBusy(true)
    try {
      await updatePageStatus.mutateAsync({ id: Number(pageId), status: 'InWork' })
    } finally {
      setBusy(false)
      closeDialog()
    }
  }

  if (!pending.length) {
    return (
      <Card className="border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Chapter chờ duyệt
          </CardTitle>
          <CardDescription>Assistant đã gộp layer & gửi qua cho bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
            Hiện không có chapter nào chờ duyệt.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Chapter chờ duyệt
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {pending.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Assistant đã gộp layer & gửi qua. Click để xem ảnh và duyệt.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-semibold text-primary hover:underline"
            onClick={() => onNavigateTab?.('chapter')}
          >
            Xem tất cả Chapter →
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.slice(0, 6).map(ch => (
              <PendingReviewItem
                key={ch.id ?? ch.chapterId}
                chapter={ch}
                onOpen={() => setOpenChapterId(ch.id ?? ch.chapterId)}
              />
            ))}
          </ul>
          {pending.length > 6 && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              +{pending.length - 6} chapter khác. Xem ở tab Chapter.
            </p>
          )}
        </CardContent>
      </Card>

      {openChapter && (
        <ReviewCompositeDialog
          open={!!openChapter}
          chapter={openChapter}
          onClose={closeDialog}
          onApprove={handleApprovePage}
          onRequestRevision={handleRequestRevisionPage}
          busy={busy || updatePageStatus.isPending}
        />
      )}
    </>
  )
}

function PendingReviewItem({ chapter, onOpen }) {
  const chapterId = chapter.id ?? chapter.chapterId

  // Lấy page đầu tiên của chapter để hiện thumbnail composite
  const { data: pages, isLoading } = useQuery({
    queryKey: ['pages', chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const res = await pagesService.getAll(chapterId)
      const raw = res?.data
      return Array.isArray(raw) ? raw : (raw?.data ?? [])
    },
    staleTime: 30_000,
  })

  const firstPage = Array.isArray(pages) ? pages[0] : null
  const firstPageId = firstPage?.id ?? firstPage?.pageid ?? null
  const compositeUrl =
    firstPage?.pageimageurl
    ?? firstPage?.pageImageUrl
    ?? firstPage?.compositeimageurl
    ?? firstPage?.compositeImageUrl
    ?? firstPage?.composite_image_url
    ?? null
  const pageCount = Array.isArray(pages) ? pages.length : 0

  // Fallback thumbnail: nếu page chưa có ảnh gộp, lấy layer z cao nhất của page đầu tiên.
  const { data: fallbackLayerUrl } = useQuery({
    queryKey: ['firstPageTopLayer', firstPageId],
    enabled: !!firstPageId && !compositeUrl && !isLoading,
    queryFn: async () => {
      const res = await layersService.list(firstPageId).catch(() => null)
      const list = Array.isArray(res)
        ? res
        : (Array.isArray(res?.data) ? res.data : [])
      if (!Array.isArray(list) || list.length === 0) return null
      const sorted = [...list].sort((a, b) => {
        const za = Number(a?.zindex ?? a?.z_index ?? a?.index ?? 0)
        const zb = Number(b?.zindex ?? b?.z_index ?? b?.index ?? 0)
        return zb - za
      })
      const top = sorted[0]
      return (
        top?.Imageurl
        ?? top?.imageurl
        ?? top?.image_url
        ?? top?.Fileurl
        ?? top?.fileurl
        ?? top?.file_url
        ?? top?.ImageUrl
        ?? top?.FileUrl
        ?? top?.imageUrl
        ?? top?.url
        ?? null
      )
    },
    staleTime: 30_000,
  })

  const thumbUrl = compositeUrl || fallbackLayerUrl || null

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full flex-col gap-2 overflow-hidden rounded-lg border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {isLoading ? (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt={chapter.title || chapter.seriesTitle}
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageIcon className="size-6" />
              <span className="text-[10px]">chưa có layer</span>
            </div>
          )}
          <Badge
            variant="secondary"
            className="absolute right-1.5 top-1.5 h-5 bg-sky-500 px-1.5 text-[10px] font-bold text-white hover:bg-sky-500"
          >
            READY
          </Badge>
          {!compositeUrl && fallbackLayerUrl && (
            <Badge
              variant="secondary"
              className="absolute bottom-1.5 left-1.5 h-5 bg-amber-500 px-1.5 text-[10px] font-bold text-white hover:bg-amber-500"
            >
              chưa gộp
            </Badge>
          )}
        </div>
        <div className="space-y-0.5 px-3 pb-3">
          <p className="truncate text-xs font-semibold">
            {chapter.series ?? chapter.seriesTitle ?? '—'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Ch.{chapter.num ?? chapter.chapterNum} · {chapter.title || 'Không tiêu đề'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {pageCount > 0 ? `${pageCount} trang · ${compositeUrl ? 'đã gộp' : 'chưa gộp'}` : 'Đang tải trang…'}
          </p>
        </div>
      </button>
    </li>
  )
}
