import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileImage,
  ImageIcon,
  Inbox,
  Layers,
  PenSquare,
  Sparkles,
  Upload,
} from 'lucide-react'
import { getSession, logout } from '@/lib/auth.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  formatSeriesCardLine,
  formatSeriesCatalogLine,
  formatSeriesRating,
  mapApiSeriesToLocal,
  slugifySeriesTitle,
} from '@/utils/seriesModel.js'
import { LABEL_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import { useChapters, usePages, usePageIssues, useSeriesByMangaka, useUpdateSeries } from '@/api/hooks'
import AddSeriesModal from './AddSeriesModal.jsx'
import './ChapterReader.css'
import '@/styles/mangaPage.css'

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Workspace' },
]

const STATUS_BADGE = {
  draft: { label: 'Nháp', className: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
  inProduction: { label: 'Chờ Assistant', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  ready: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  done: { label: 'Hoàn tất', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
  publishing: { label: 'Đang phát hành', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400' },
  delayed: { label: 'Hoãn', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400' },
  cancelled: { label: 'Hủy', className: 'bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400' },
  // Legacy local labels — fallback nếu nơi nào còn dùng
  assistant: { label: 'Chờ Assistant', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  review: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  tantou: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
}

function mapChapterStatus(s) {
  // Enum BE ChapterService: InProduction / Ready / Published / Delayed / Cancelled
  const v = String(s ?? '')
  if (v === 'Published') return 'done'
  if (v === 'Ready') return 'ready'
  if (v === 'Delayed') return 'delayed'
  if (v === 'Cancelled') return 'cancelled'
  if (v === 'InProduction') return 'inProduction'
  // Fallback cho các demo / local: map xuống 1 trong 5 nhóm trên
  const lower = v.toLowerCase()
  if (lower === 'approved' || lower === 'published' || lower === 'done') return 'done'
  if (lower === 'tantou' || lower === 'editing') return 'ready'
  if (lower === 'review') return 'ready'
  if (lower === 'assistant' || lower === 'drawing' || lower === 'pending') return 'inProduction'
  return 'inProduction'
}

function seriesPath(series) {
  const slug = series.slug ?? slugifySeriesTitle(series.title)
  return `/mangaka/series/${slug}`
}

function DetailShell({ children, onLogout }) {
  const user = getSession()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="page-container flex-1 py-8">{children}</main>
    </div>
  )
}

function Breadcrumb({ items }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Đường dẫn">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">{item.label}</Link>
            ) : (
              <span className={isLast ? 'font-medium text-foreground' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="size-3.5" /> : null}
          </span>
        )
      })}
    </nav>
  )
}

function ChapterReader({ series, activeRow, pages, staleOnly, progressPct, statusBadge, basePath, chapterId, onOpenAnnotate, onLogout, onOpenLayerWorkspace, serverPageIssues = [] }) {
  const [pageIndex, setPageIndex] = useState(0)
  const total = pages.length
  const safeIndex = total > 0 ? Math.min(Math.max(pageIndex, 0), total - 1) : 0

  useEffect(() => {
    setPageIndex(0)
  }, [activeRow?.id, total])

  useEffect(() => {
    function onKey(e) {
      if (total <= 1) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setPageIndex(i => Math.min(i + 1, total - 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setPageIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Home') {
        setPageIndex(0)
      } else if (e.key === 'End') {
        setPageIndex(total - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  function goPrev() { setPageIndex(i => Math.max(i - 1, 0)) }
  function goNext() { setPageIndex(i => Math.min(i + 1, total - 1)) }
  function goTo(i) { setPageIndex(Math.max(0, Math.min(i, total - 1))) }

  const current = total > 0 ? pages[safeIndex] : null
  const canPrev = safeIndex > 0
  const canNext = safeIndex < total - 1

  return (
    <DetailShell onLogout={onLogout}>
      <Breadcrumb
        items={[
          { label: 'Mangaka', to: '/mangaka' },
          { label: series.title, to: basePath },
          { label: `Ch. ${activeRow.num}` },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="h-1.5" style={{ background: series.color }} />
            <CardHeader className="pb-3">
              <CardDescription>{series.title}</CardDescription>
              <CardTitle className="text-2xl">Chapter {activeRow.num}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusBadge.className} variant="secondary">{statusBadge.label}</Badge>
                <span className="text-xs text-muted-foreground">{activeRow.date}</span>
              </div>
              <p className="text-sm">
                {pages.length} trang đã upload
              </p>
              {progressPct !== null ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: series.color }} />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">Khổ trang: 728×1030 px (chuẩn manga)</p>
            </CardContent>
            <Separator />
            <CardContent className="space-y-2 pt-4">
              <Button asChild variant="outline" className="w-full">
                <Link to={basePath}>
                  <ArrowLeft className="size-4" />
                  Danh sách chapter
                </Link>
              </Button>
              <Button className="w-full" onClick={onOpenAnnotate}>
                <PenSquare className="size-4" />
                Mở ghi chú / upload
              </Button>
              {activeRow ? (
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <Link to={`${basePath}/chapter/${chapterId}/page/${activeRow.localPageId ?? `u-${activeRow.id}`}`}>
                    <Layers className="size-4" />
                    Quản lý Layers
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {staleOnly ? (
            <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Ảnh chưa hiển thị được</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Dữ liệu cũ (trước khi lưu ảnh) — upload lại 1 lần trên Mangaka.
                </p>
                <Button size="sm" className="w-full" onClick={onOpenAnnotate}>
                  Upload lại chapter
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </aside>

        <section aria-label={`Trang chapter ${activeRow.num}`}>
          {pages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <ImageIcon className="size-12 text-muted-foreground/60" />
                <p>Chapter chưa có ảnh.</p>
                <Button onClick={onOpenAnnotate}>
                  <Upload className="size-4" />
                  Upload tại Mangaka
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="cr-stage-wrap">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canPrev}
                  aria-label="Trang trước"
                  className={cn(
                    'cr-nav cr-nav--prev',
                    !canPrev && 'cr-nav--disabled',
                  )}
                >
                  <ChevronLeft className="size-7" />
                </button>

                <div
                  className="cr-stage"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = e.clientX - rect.left
                    if (x < rect.width / 3) goPrev()
                    else if (x > (rect.width * 2) / 3) goNext()
                  }}
                  role="presentation"
                >
                  {current?.url ? (
                    <img
                      key={current.id ?? safeIndex}
                      src={current.url}
                      alt={`${series.title} Ch.${activeRow.num} trang ${safeIndex + 1}`}
                      className="cr-stage__img"
                      decoding="async"
                    />
                  ) : (
                    <div className="cr-stage__empty">
                      <span>Trang {safeIndex + 1}</span>
                      <p>728×1030 · upload lại để hiện ảnh</p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNext}
                  aria-label="Trang sau"
                  className={cn(
                    'cr-nav cr-nav--next',
                    !canNext && 'cr-nav--disabled',
                  )}
                >
                  <ChevronRight className="size-7" />
                </button>
              </div>

              <div className="cr-toolbar">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={!canPrev}
                  className="cr-toolbar__btn"
                >
                  <ChevronLeft className="size-4" />
                  Trang trước
                </Button>

                <div className="cr-counter">
                  <span className="cr-counter__current">{safeIndex + 1}</span>
                  <span className="cr-counter__divider">/</span>
                  <span className="cr-counter__total">{total}</span>
                  {current?.name ? (
                    <span className="cr-counter__name">· {current.name}</span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  {onOpenLayerWorkspace && activeRow ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenLayerWorkspace(activeRow, pageIndex)}
                      className="cr-toolbar__btn"
                      title="Quản lý Layers cho trang này"
                    >
                      <Layers className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={goNext}
                    disabled={!canNext}
                    className="cr-toolbar__btn cr-toolbar__btn--primary"
                  >
                    Trang sau
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              {/* PageIssues panel (server-side notes from Assistant/Editor) */}
              {serverPageIssues.length > 0 ? (
                <details className="cr-page-issues rounded border bg-amber-50 dark:bg-amber-500/5">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-500/10">
                    {serverPageIssues.length} ghi chú từ Assistant/Editor
                  </summary>
                  <div className="space-y-2 border-t border-amber-200 px-3 py-2 dark:border-amber-500/20">
                    {serverPageIssues.map((issue, idx) => (
                      <div key={issue.issueid ?? issue.Issueid ?? `srv-issue-${idx}`} className="rounded bg-white p-2 text-xs shadow-sm dark:bg-zinc-800">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-600 dark:text-amber-100">
                            {issue.issueType ?? issue.Issuetype ?? '?'}
                          </span>
                          <span className="text-muted-foreground">{issue.workCategory ?? issue.Workcategory ?? ''}</span>
                        </div>
                        {(issue.description ?? '').trim() && (
                          <p className="mt-1 text-zinc-700 dark:text-zinc-300">{issue.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              {total > 1 ? (
                <div className="cr-thumbs" role="tablist" aria-label="Danh sách trang">
                  {pages.map((pg, i) => (
                    <button
                      key={pg.id ?? i}
                      type="button"
                      role="tab"
                      aria-selected={i === safeIndex}
                      aria-label={`Trang ${i + 1}`}
                      onClick={() => goTo(i)}
                      className={cn('cr-thumb', i === safeIndex && 'cr-thumb--active')}
                    >
                      {pg.url ? (
                        <img src={pg.url} alt="" className="cr-thumb__img" loading="lazy" />
                      ) : (
                        <span className="cr-thumb__empty">{i + 1}</span>
                      )}
                      <span className="cr-thumb__num">{i + 1}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </DetailShell>
  )
}

export default function SeriesUploadDetail() {
  const { seriesSlug, chapterId } = useParams()
  const navigate = useNavigate()
  const session = getSession()
  const mangakaId = session?.id ?? session?.userid ?? null
  const [editSeriesOpen, setEditSeriesOpen] = useState(false)
  const updateSeries = useUpdateSeries()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleOpenLayerWorkspace(activeRow, pageIdx) {
    if (!series || !activeRow) return
    const pageId = activeRow.localPageId ?? `u-${activeRow.id}-${pageIdx}`
    navigate(`${basePath}/chapter/${chapterId}/page/${pageId}`)
  }

  // Fetch series từ API theo mangakaId để có ID chuẩn từ DB
  const { data: apiSeriesRaw = [] } = useSeriesByMangaka(mangakaId)
  const apiSeries = useMemo(
    () => (Array.isArray(apiSeriesRaw) ? apiSeriesRaw.map((s, i) => mapApiSeriesToLocal(s, i)).filter(Boolean) : []),
    [apiSeriesRaw],
  )

  const series = useMemo(() => {
    if (!seriesSlug) return null
    return apiSeries.find(s => s.slug === seriesSlug)
      ?? apiSeries.find(s => slugifySeriesTitle(s.title) === seriesSlug)
      ?? null
  }, [apiSeries, seriesSlug])

  const serverSeriesId = series?.seriesid ?? series?.id
  const { data: serverChapters = [] } = useChapters(serverSeriesId)
  // Dùng chapterId (URL param) để fetch server pages — hook phải gọi trước activeRow useMemo
  const { data: rawServerPages = [] } = usePages(chapterId)
  const { data: serverPageIssues = [] } = usePageIssues({ chapterId: chapterId ? Number(chapterId) : undefined })

  const seriesTitle = series?.title ?? ''

  const chapterRows = useMemo(() => {
    if (!seriesTitle) return []
    return serverChapters.map(ch => ({
      id: ch.chapterid ?? ch.Chapterid ?? ch.id,
      series: seriesTitle,
      num: ch.chapternumber ?? ch.ChapterNumber ?? ch.chapterNumber ?? ch.number ?? 1,
      type: 'IMAGE',
      pages: ch.pagecount ?? ch.pageCount ?? ch.totalPages ?? 0,
      status: mapChapterStatus(ch.status ?? ch.Status ?? 'draft'),
      date: ch.createdat ?? ch.Createdat ?? new Date().toLocaleDateString('vi-VN'),
      apiChapterId: ch.chapterid ?? ch.Chapterid ?? ch.id,
      localPageId: `srv-${ch.chapterid ?? ch.Chapterid ?? ch.id}`,
    }))
  }, [seriesTitle, serverChapters])

  const activeRow = useMemo(
    () => (chapterId ? chapterRows.find(r => String(r.id) === String(chapterId) || String(r.apiChapterId) === String(chapterId)) : null),
    [chapterRows, chapterId],
  )

  function handleEditSeriesSubmit(form) {
    if (!series) return
    const seriesId = series.seriesid ?? series.id
    updateSeries.mutate(
      { id: seriesId, data: form },
      {
        onSuccess: () => {
          setEditSeriesOpen(false)
          const newSlug = form.slug ?? slugifySeriesTitle(form.title ?? series.title)
          if (newSlug !== seriesSlug) {
            navigate(`/mangaka/series/${newSlug}`, { replace: true })
          }
        },
      },
    )
  }

  const chapterCards = useMemo(() => chapterRows.map(row => {
    const rowChapterId = row.apiChapterId ?? null
    const rowServerPages = rawServerPages.filter(p => {
      const pid = p.pageid ?? p.Pageid ?? p.id
      return String(pid) === String(rowChapterId)
    })
    const serverPageCover = rowServerPages.length > 0 && rowServerPages[0]?.pageImageUrl
      ? { url: rowServerPages[0].pageImageUrl, name: 'cover' }
      : null
    const cover = serverPageCover
      ?? rowServerPages.find(p => p?.pageImageUrl ?? p?.compositeImageUrl ?? p?.imageUrl)
      ?? null
    const uploaded = row.pages ?? rowServerPages.length ?? 0
    return { row, cover, uploaded, serverPages: rowServerPages }
  }), [chapterRows, rawServerPages])

  if (!series) {
    return (
      <DetailShell onLogout={handleLogout}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="size-12 text-muted-foreground/60" />
            <h1 className="text-2xl font-bold">Không tìm thấy truyện</h1>
            <p className="text-muted-foreground">Series có thể đã bị xóa hoặc chưa được lưu trong phiên làm việc.</p>
            <Button asChild>
              <Link to="/mangaka">
                <ArrowLeft className="size-4" />
                Về Mangaka
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DetailShell>
    )
  }

  const slug = series.slug ?? slugifySeriesTitle(series.title)
  const basePath = `/mangaka/series/${slug}`

  if (chapterId && activeRow) {
    // Xây dựng danh sách pages: ưu tiên server pages nếu là chapter server
    const apiChapterId = activeRow.apiChapterId ?? null
    const serverPageList = (rawServerPages.length > 0)
      ? rawServerPages.map((p, i) => ({
          id: p.pageid ?? p.Pageid ?? p.id ?? `srv-p-${i}`,
          name: p.pagetitle ?? `Trang ${i + 1}`,
          url: p.pageImageUrl ?? p.compositeImageUrl ?? p.imageUrl ?? null,
          apiPageId: p.pageid ?? p.Pageid ?? p.id,
          index: i,
        }))
      : []

    const pages = serverPageList
    const pagesWithMedia = pages.filter(p => p?.url)
    const staleOnly = pages.length > 0 && pagesWithMedia.length === 0
    const progressPct = pages.length > 0 ? Math.min(100, pages.length * 4) : null
    const statusBadge = STATUS_BADGE[activeRow.status] ?? STATUS_BADGE.draft

    const openAnnotate = () => navigate('/mangaka', {
      state: { tab: 'annotate', series: series.title, chapterId: activeRow.id },
    })

    return (
      <ChapterReader
        series={series}
        activeRow={activeRow}
        pages={pages}
        staleOnly={staleOnly}
        progressPct={progressPct}
        statusBadge={statusBadge}
        basePath={basePath}
        chapterId={chapterId}
        onOpenAnnotate={openAnnotate}
        onLogout={handleLogout}
        onOpenLayerWorkspace={handleOpenLayerWorkspace}
        serverPageIssues={serverPageIssues}
      />
    )
  }

  const initials = (series.title.length >= 2 ? series.title : `${series.title}●`).slice(0, 2)
  const seriesBadge = STATUS_BADGE[series.status] ?? STATUS_BADGE.draft

  return (
    <DetailShell onLogout={handleLogout}>
      <Breadcrumb
        items={[
          { label: 'Mangaka', to: '/mangaka' },
          { label: series.title },
        ]}
      />

      <Card className="mb-6 overflow-hidden p-0">
        <div
          className="relative px-6 py-8 sm:px-8 sm:py-10"
          style={{
            background: `linear-gradient(135deg, ${series.color}30, transparent 60%), linear-gradient(180deg, hsl(var(--background)), hsl(var(--background)))`,
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div
              className="flex aspect-[3/4] w-32 shrink-0 items-center justify-center rounded-xl text-3xl font-extrabold text-white shadow-lg sm:w-40"
              style={{ background: `linear-gradient(135deg, ${series.color}, ${series.color}88)` }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={seriesBadge.className} variant="secondary">
                  {series.statusLabel ?? seriesBadge.label}
                </Badge>
                {series.needsFullDebutPipeline ? (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400" variant="secondary">
                    <Sparkles className="size-3" />
                    Lần đầu · có {LABEL_EDITOR_BOARD}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{series.title}</h1>
              {series.altTitle && series.altTitle !== series.title ? (
                <p className="text-base text-muted-foreground">{series.altTitle}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">{formatSeriesCardLine(series)}</p>
              <p className="text-xs text-muted-foreground">
                {formatSeriesCatalogLine(series)} · {formatSeriesRating(series)}
              </p>
              {series.authorName ? (
                <p className="text-xs text-muted-foreground">Tác giả · <span className="font-medium text-foreground">{series.authorName}</span></p>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Thống kê</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{chapterCards.length}</div>
                  <p className="text-xs text-muted-foreground">Chapter upload</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{series.chapters ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Tổng chapter</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{series.marks ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Vùng ghi chú</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{Math.round(series.progress ?? 0)}%</div>
                  <p className="text-xs text-muted-foreground">Tiến độ</p>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, series.progress ?? 0)}%`, background: series.color }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4">
              <Button variant="outline" className="w-full" onClick={() => setEditSeriesOpen(true)}>
                <PenSquare className="size-4" />
                Chỉnh sửa hồ sơ
              </Button>
              <Button asChild className="w-full">
                <Link to="/mangaka" state={{ tab: 'annotate', series: series.title, seriesId: series.seriesid ?? series.id }}>
                  <Upload className="size-4" />
                  Upload chapter
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/mangaka" state={{ tab: 'annotate', series: series.title, seriesId: series.seriesid ?? series.id }}>
                  <PenSquare className="size-4" />
                  Ghi chú trang
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Giới thiệu</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setEditSeriesOpen(true)}>
                  Chỉnh sửa
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!series.metadataComplete ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Hồ sơ chưa đầy đủ — bấm "Chỉnh sửa" để bổ sung tóm tắt, thể loại…
                </p>
              ) : null}
              <p className="text-sm leading-relaxed">
                {series.synopsis || <span className="text-muted-foreground italic">Chưa có tóm tắt truyện.</span>}
              </p>
              {series.genres?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {series.genres.map(g => (
                    <Badge key={g} variant="secondary">{g}</Badge>
                  ))}
                </div>
              ) : null}
              {series.tags?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {series.tags.map(t => (
                    <Badge key={t} variant="outline">#{t}</Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Chapter đã upload</h2>
                <p className="text-sm text-muted-foreground">Bấm chapter để xem toàn bộ ảnh trang</p>
              </div>
              <Badge variant="outline">{chapterCards.length} chapter</Badge>
            </div>

            {chapterCards.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileImage className="size-10 text-muted-foreground/60" />
                  <p>Chưa có chapter — bắt đầu upload từ trang Mangaka Workspace.</p>
                  <Button asChild>
                    <Link to="/mangaka" state={{ tab: 'annotate', series: series.title, seriesId: series.seriesid ?? series.id }}>
                      <Upload className="size-4" />
                      Upload chapter đầu tiên
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chapterCards.map(({ row, cover, uploaded }) => {
                  const pct = uploaded > 0 ? Math.min(100, uploaded * 4) : null
                  const chapterBadge = STATUS_BADGE[row.status] ?? STATUS_BADGE.draft
                  return (
                    <li key={row.id}>
                      <Link
                        to={`${basePath}/chapter/${row.id}`}
                        className="group block"
                      >
                        <Card className="overflow-hidden p-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                          <div className="relative manga-page manga-page--card overflow-hidden bg-muted">
                            {cover?.url ? (
                              <img src={cover.url} alt="" className="manga-page__media" />
                            ) : (
                              <div className="manga-page__empty">
                                <span>Ch.{row.num}</span>
                              </div>
                            )}
                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent py-3 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                              Xem trang →
                            </span>
                          </div>
                          <CardContent className="space-y-2 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-sm">Chapter {row.num}</strong>
                              <Badge className={cn('text-[10px]', chapterBadge.className)} variant="secondary">
                                {chapterBadge.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {uploaded} trang · {row.type}
                            </p>
                            {pct !== null ? (
                              <div className="h-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: series.color }}
                                />
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="mt-8">
        <Button asChild variant="ghost" size="sm">
          <Link to="/mangaka" state={{ tab: 'series' }}>
            <ArrowLeft className="size-4" />
            Quay lại danh sách series
          </Link>
        </Button>
      </div>

      <AddSeriesModal
        open={editSeriesOpen}
        mode="edit"
        initialSeries={series}
        onClose={() => setEditSeriesOpen(false)}
        onSubmit={handleEditSeriesSubmit}
        authorName={series.authorName}
        existingTitles={apiSeries.map(s => s.title).filter(Boolean)}
      />
    </DetailShell>
  )
}

export { seriesPath }
