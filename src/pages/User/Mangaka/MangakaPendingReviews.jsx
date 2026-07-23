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
import { pagesService, chaptersService } from '@/api/api.js'
import { useUpdateChapterStatus, useUpdatePageIsSentToMangaka } from '@/api/hooks/useApi.js'
import { layersService } from '@/api/layersService.js'
import ReviewCompositeDialog from './ReviewCompositeDialog.jsx'

/**
 * Card "Trang chờ duyệt" hiển thị các page có isSentToMangaka === true
 * Click vào card mở dialog xem ảnh composite + Duyệt / Yêu cầu sửa.
 */
export default function MangakaPendingReviews({ chapterRows, onNavigateTab }) {
  const updateStatus = useUpdateChapterStatus()
  const updatePageStatus = useUpdatePageIsSentToMangaka()
  const [activePageId, setActivePageId] = useState(null)
  const [busy, setBusy] = useState(false)

  // Fetch các page có isSentToMangaka = true trực tiếp từ BE
  const { data: pendingPages, isLoading: listLoading } = useQuery({
    queryKey: ['pages', 'reviewing'],
    queryFn: async () => {
      const res = await pagesService.getAll(undefined, true)
      const raw = res?.data
      return Array.isArray(raw) ? raw : (raw?.data ?? [])
    },
    staleTime: 5000,
  })

  const pending = pendingPages ?? []
  const activePage = pending.find(p => String(p.id ?? p.pageid ?? p.pageId) === String(activePageId)) ?? null
  const openChapter = activePage
    ? (chapterRows ?? []).find(c => String(c.id ?? c.chapterId ?? c.chapterid) === String(activePage.chapterid ?? activePage.chapterId))
    : null

  function closeDialog() {
    setActivePageId(null)
    setBusy(false)
  }

  async function handleApprovePage(pageId) {
    if (!pageId) return
    setBusy(true)
    try {
      // 1. Duyệt trang -> đổi biến isSentToMangaka thành false
      await updatePageStatus.mutateAsync({ id: Number(pageId), isSentToMangaka: false })
      toast.success('Đã duyệt trang thành công.')
    } catch (err) {
      // lỗi được hook xử lý
    } finally {
      setBusy(false)
      closeDialog()
    }
  }

  async function handleRequestRevisionPage(pageId) {
    if (!pageId) return
    setBusy(true)
    try {
      // 1. Yêu cầu sửa -> đổi biến isSentToMangaka thành false
      await updatePageStatus.mutateAsync({ id: Number(pageId), isSentToMangaka: false })
      toast.success('Đã gửi yêu cầu sửa cho Assistant.')
    } catch (err) {
      // lỗi được hook xử lý
    } finally {
      setBusy(false)
      closeDialog()
    }
  }

  if (listLoading) {
    return (
      <Card className="border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary animate-pulse" />
            Trang chờ duyệt
          </CardTitle>
          <CardDescription>Đang tải danh sách trang chờ duyệt...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (!pending.length) {
    return (
      <Card className="border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Trang chờ duyệt
          </CardTitle>
          <CardDescription>Assistant đã gộp layer & gửi qua cho bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
            Hiện không có trang nào chờ duyệt.
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
              Trang chờ duyệt
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {pending.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Click vào trang để xem và thực hiện Duyệt hoặc Yêu cầu sửa.
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
            {pending.slice(0, 6).map(page => (
              <PendingPageReviewItem
                key={page.id ?? page.pageid ?? page.pageId}
                page={page}
                chapterRows={chapterRows}
                onOpen={() => setActivePageId(page.id ?? page.pageid ?? page.pageId)}
              />
            ))}
          </ul>
          {pending.length > 6 && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              +{pending.length - 6} trang khác.
            </p>
          )}
        </CardContent>
      </Card>

      {openChapter && (
        <ReviewCompositeDialog
          open={!!openChapter}
          chapter={openChapter}
          initialPageId={activePageId}
          onClose={closeDialog}
          onApprove={handleApprovePage}
          onRequestRevision={handleRequestRevisionPage}
          busy={busy || updatePageStatus.isPending}
        />
      )}
    </>
  )
}

function PendingPageReviewItem({ page, chapterRows, onOpen }) {
  const compositeUrl =
    page?.pageimageurl
    ?? page?.pageImageUrl
    ?? page?.compositeimageurl
    ?? page?.compositeImageUrl
    ?? page?.composite_image_url
    ?? null

  const chapter = (chapterRows ?? []).find(
    c => String(c.id ?? c.chapterId ?? c.chapterid) === String(page.chapterid ?? page.chapterId)
  )

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full flex-col gap-2 overflow-hidden rounded-lg border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {compositeUrl ? (
            <img
              src={compositeUrl}
              alt={`Page ${page.pagenumber}`}
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground bg-zinc-900">
              <ImageIcon className="size-6" />
              <span className="text-[10px]">chưa có ảnh gộp</span>
            </div>
          )}
          <Badge
            variant="secondary"
            className="absolute right-1.5 top-1.5 h-5 bg-sky-500 px-1.5 text-[10px] font-bold text-white hover:bg-sky-500"
          >
            REVIEWING
          </Badge>
        </div>
        <div className="space-y-0.5 px-3 pb-3">
          <p className="truncate text-xs font-semibold">
            {chapter?.series ?? chapter?.seriesTitle ?? '—'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Ch.{chapter?.num ?? chapter?.chapterNum ?? '—'} · {chapter?.title || 'Không tiêu đề'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Trang số {page.pagenumber}
          </p>
        </div>
      </button>
    </li>
  )
}
