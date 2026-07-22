import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  ImageIcon,
  Loader2,
  Sparkles,
} from 'lucide-react'
import ReviewCompositeDialog from './ReviewCompositeDialog.jsx'
import { pagesService } from '@/api/api.js'
import { useUpdateChapterStatus, useUpdatePageStatus } from '@/api/hooks/useApi.js'
import { toast } from 'sonner'

const STATUS_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'ready', label: 'Đã gộp — chờ duyệt' },
  { id: 'inproduction', label: 'Đang làm' },
  { id: 'published', label: 'Hoàn tất' },
  { id: 'cancelled', label: 'Bị huỷ' },
]

export default function ChapterView({
  seriesList,
  chapterRows,
  onOpenAddChapter,
  onOpenEditChapter,
  onDeleteChapter,
  onViewChapterDetail,
  STATUS_BADGE,
}) {
  const [selectedSeriesId, setSelectedSeriesId] = useState(() => {
    if (seriesList && seriesList.length > 0) {
      return String(seriesList[0].id)
    }
    return 'all'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewChapter, setReviewChapter] = useState(null)
  const updateStatus = useUpdateChapterStatus()
  const updatePageStatus = useUpdatePageStatus()

  const activeSeries = useMemo(() => {
    return seriesList.find(s => String(s.id) === selectedSeriesId)
  }, [seriesList, selectedSeriesId])

  const filteredChapters = useMemo(() => {
    let list = chapterRows
    if (activeSeries) {
      list = list.filter(c => String(c.series).toLowerCase() === activeSeries.title.toLowerCase())
    }
    if (searchQuery.trim()) {
      list = list.filter(c => (c.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
    }
    if (statusFilter !== 'all') {
      list = list.filter(c => String(c.status).toLowerCase() === statusFilter)
    }
    return list
  }, [chapterRows, activeSeries, searchQuery, statusFilter])

  const countsByStatus = useMemo(() => {
    const c = { all: chapterRows.length }
    for (const f of STATUS_FILTERS) {
      if (f.id === 'all') continue
      c[f.id] = chapterRows.filter(r => String(r.status).toLowerCase() === f.id).length
    }
    return c
  }, [chapterRows])

  function handleReviewOpen(chapter) {
    setReviewChapter(chapter)
  }

  function handleReviewClose() {
    setReviewChapter(null)
  }

  async function handleApprove(chapterId) {
    if (!chapterId) return
    try {
      await updateStatus.mutateAsync({ id: Number(chapterId), status: 'Ready' })
      handleReviewClose()
    } catch {
      /* toast handled by hook */
    }
  }

  async function handleRequestRevision(chapterId, note) {
    if (!chapterId) return
    try {
      await updateStatus.mutateAsync({ id: Number(chapterId), status: 'InProduction' })
      toast.success(note ? `Đã gửi yêu cầu sửa: ${note}` : 'Đã gửi yêu cầu sửa cho Assistant.')
      handleReviewClose()
    } catch {
      /* toast handled by hook */
    }
  }

  async function handleApprovePage(pageId) {
    if (!pageId) return
    try {
      // 1. Cập nhật trạng thái trang sang Approved
      await updatePageStatus.mutateAsync({ id: Number(pageId), status: 'Approved' })
      // 2. Đồng thời chuyển Chapter sang Published
      if (reviewChapter) {
        const chapterId = reviewChapter.id ?? reviewChapter.chapterId ?? reviewChapter.chapterid ?? reviewChapter.Chapterid
        await updateStatus.mutateAsync({ id: Number(chapterId), status: 'Published' })
      }
      toast.success('Đã duyệt trang và hoàn tất chapter.')
      handleReviewClose()
    } catch (err) {
      // Fallback: nếu trang đang ở InWork, tự động chuyển InWork -> Reviewing -> Approved
      const msg = err?.response?.data?.message ?? err?.message ?? ''
      if (msg.includes('InWork')) {
        try {
          await updatePageStatus.mutateAsync({ id: Number(pageId), status: 'Reviewing' })
          await updatePageStatus.mutateAsync({ id: Number(pageId), status: 'Approved' })
          if (reviewChapter) {
            const chapterId = reviewChapter.id ?? reviewChapter.chapterId ?? reviewChapter.chapterid ?? reviewChapter.Chapterid
            await updateStatus.mutateAsync({ id: Number(chapterId), status: 'Published' })
          }
          toast.success('Đã duyệt trang và hoàn tất chapter.')
          handleReviewClose()
        } catch (fallbackErr) {
          toast.error(fallbackErr?.response?.data?.message ?? 'Không thể chuyển trạng thái để duyệt.')
        }
      }
    }
  }

  async function handleRequestRevisionPage(pageId, note) {
    if (!pageId) return
    try {
      // 1. Cập nhật trạng thái trang sang InWork
      await updatePageStatus.mutateAsync({ id: Number(pageId), status: 'InWork' })
      // 2. Chuyển Chapter về InProduction để Assistant vẽ lại
      if (reviewChapter) {
        const chapterId = reviewChapter.id ?? reviewChapter.chapterId ?? reviewChapter.chapterid ?? reviewChapter.Chapterid
        await updateStatus.mutateAsync({ id: Number(chapterId), status: 'InProduction' })
      }
      toast.success(note ? `Đã gửi yêu cầu sửa: ${note}` : 'Đã gửi yêu cầu sửa cho Assistant.')
      handleReviewClose()
    } catch {
      /* toast handled by hook */
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {activeSeries ? activeSeries.title : 'Quản lý Chapter'}
          </h1>
          <p className="text-sm text-muted-foreground">Quản lý chapters của series.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
            <SelectTrigger className="w-56 h-9 bg-background">
              <SelectValue placeholder="Chọn Series" />
            </SelectTrigger>
            <SelectContent>
              {seriesList.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => onOpenAddChapter(activeSeries)}
            disabled={!activeSeries}
            className="bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="size-4 mr-2" />
            Thêm chapter mới
          </Button>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col gap-3 bg-card p-3 rounded-lg border sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm chapter..."
            className="pl-9 h-9"
          />
        </div>
        <div className="-mx-1 flex flex-wrap gap-1 px-1">
          {STATUS_FILTERS.map(f => {
            const count = countsByStatus[f.id] ?? 0
            const active = statusFilter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ' +
                  (active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground')
                }
              >
                {f.label}
                {count > 0 && (
                  <span
                    className={
                      'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ' +
                      (active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chapter Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-4 w-[12%]">Ảnh gộp</th>
                <th className="p-4 w-[16%]">Chapter</th>
                <th className="p-4 w-[34%]">Tiêu đề</th>
                <th className="p-4 w-[14%]">Trạng thái</th>
                <th className="p-4 w-[12%]">Ngày đăng</th>
                <th className="p-4 w-[12%] text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredChapters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Không tìm thấy chapter nào.
                  </td>
                </tr>
              ) : (
                filteredChapters.map(c => (
                  <ChapterRow
                    key={c.id ?? c.chapterId}
                    chapter={c}
                    badge={STATUS_BADGE[c.status?.toLowerCase()] || STATUS_BADGE.draft}
                    isReady={String(c.status).toLowerCase() === 'ready'}
                    onView={() => onViewChapterDetail?.(c)}
                    onEdit={() => onOpenEditChapter?.(c)}
                    onDelete={() => onDeleteChapter?.(c.id)}
                    onReview={() => handleReviewOpen(c)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {reviewChapter && (
        <ReviewCompositeDialog
          open={!!reviewChapter}
          chapter={reviewChapter}
          onClose={handleReviewClose}
          onApprove={handleApprovePage}
          onRequestRevision={handleRequestRevisionPage}
          busy={updatePageStatus.isPending}
        />
      )}
    </div>
  )
}

function ChapterRow({ chapter, badge, isReady, onView, onEdit, onDelete, onReview }) {
  const chapterId = chapter.id ?? chapter.chapterId
  const { data: pages, isLoading } = useQuery({
    queryKey: ['pages', chapterId],
    enabled: !!chapterId && isReady,
    queryFn: async () => {
      const res = await pagesService.getAll(chapterId)
      const raw = res?.data
      return Array.isArray(raw) ? raw : (raw?.data ?? [])
    },
    staleTime: 30_000,
  })
  const firstPage = Array.isArray(pages) ? pages[0] : null
  const compositeUrl =
    firstPage?.pageimageurl
    ?? firstPage?.pageImageUrl
    ?? firstPage?.compositeimageurl
    ?? firstPage?.compositeImageUrl
    ?? firstPage?.composite_image_url
    ?? null

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="p-3">
        {isReady ? (
          <button
            type="button"
            onClick={onReview}
            className="relative size-12 overflow-hidden rounded-md border bg-muted transition-transform hover:scale-105"
            title="Mở cửa sổ duyệt ảnh đã gộp"
          >
            {isLoading ? (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : compositeUrl ? (
              <img src={compositeUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-4" />
              </div>
            )}
            {compositeUrl && (
              <span className="absolute right-0.5 top-0.5 rounded-full bg-sky-500 px-1 py-0.5 text-[8px] font-bold text-white">
                <Sparkles className="size-2.5" />
              </span>
            )}
          </button>
        ) : (
          <div className="flex size-12 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground/50">
            <ImageIcon className="size-4" />
          </div>
        )}
      </td>
      <td className="p-4 font-semibold text-foreground">
        Chapter {chapter.num ?? chapter.chapterNum}
      </td>
      <td className="p-4">
        <span
          className="font-medium text-foreground hover:underline cursor-pointer"
          onClick={onView}
        >
          {chapter.title}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          ({chapter.pages || 0} trang)
        </span>
      </td>
      <td className="p-4">
        <Badge className={badge.className} variant="secondary">
          {badge.label}
        </Badge>
      </td>
      <td className="p-4 text-xs text-muted-foreground">
        {chapter.date || chapter.createdAt || 'Nháp'}
      </td>
      <td className="p-4">
        <div className="flex items-center justify-center gap-1.5">
          {isReady && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-sky-700 hover:bg-sky-500/10"
              onClick={onReview}
              title="Mở cửa sổ duyệt ảnh"
            >
              <Sparkles className="size-3.5" />
              <span className="text-[11px] font-semibold">Duyệt</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={onView}
            title="Xem chi tiết / Annotate"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            title="Sửa thông tin"
          >
            <Edit2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Xóa"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
