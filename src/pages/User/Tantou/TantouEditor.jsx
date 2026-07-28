import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Calendar, Clock, Loader2, Sparkles, Ban, X } from 'lucide-react'
import SidebarNav from '@/components/layout/SidebarNav.jsx'
import WorkspaceTopBar from '@/components/layout/WorkspaceTopBar.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import axiosClient from '@/api/axiosClient.js'
import { getSession, logout } from '@/lib/auth.js'
import { LABEL_EDITOR_BOARD, LABEL_TANTOU_EDITOR } from '@/constants/roleTerminology.js'
import { useTantouWorkspace } from '@/hooks/Usetantouworkspace.js'
import { normalizeStatus, isDebutStatus, isEbStatus, statusLabel } from './TantouEditor.helpers.jsx'
import { CoverThumb } from '@/components/User/Tantou/CoverThumb.jsx'
import { SeriesSlideCard } from '@/components/User/Tantou/SeriesSlideCard.jsx'
import TantouPageReview from './TantouPageReview.jsx'
import './TantouEditor.css'

const SIDEBAR_ITEMS = [
  { id: 'debut',    label: 'Duyệt Series',    icon: Sparkles },
  { id: 'studio',   label: 'Duyệt Chapters',  icon: Clock },
  { id: 'schedule', label: 'Lịch phát hành',  icon: Calendar },
]

function getChapterLayer(item) {
  const st = normalizeStatus(item.status)
  if (st === 'published') return 'done'
  const seriesWithEb = item.seriesInfo && isEbStatus(item.seriesInfo.status)
  if (seriesWithEb || st === 'ready') return 'eb'
  return 'inprogress'
}

export default function TantouEditor() {
  const navigate = useNavigate()
  const user = getSession()

  const {
    loading,
    debutQueue,
    scheduleSeries,
    studioLoading,
    studioQueue,
    selectedSub,
    reviewSubmission,
    reviewOpen,
    editorialComment,
    setEditorialComment,
    reviewPageIndex,
    setReviewPageIndex,
    reviewChapterId,
    reviewPages,
    reviewPagesLoading,
    closeReview,
    handleForwardEb,
    handleRequestRevision,
    handleAcceptSeries,
    handleRejectSeries,
    handleChapterRequestRevision,
    handleChapterApprove,
  } = useTantouWorkspace()

  const [tab, setTab] = useState('debut')
  const [selectedSeriesId, setSelectedSeriesId] = useState(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)

  // Studio 2-panel
  const [selectedSeriesIdForChapters, setSelectedSeriesIdForChapters] = useState(null)
  const [selectedChapter, setSelectedChapter]           = useState(null)
  const [selectedChapterPages, setSelectedChapterPages]  = useState([])
  const [selectedChapterPagesLoading, setSelectedChapterPagesLoading] = useState(false)
  const [selectedChapterPageIndex, setSelectedChapterPageIndex] = useState(0)

  // Hiện chapters khi series đã được Tantou accept (không còn Debut status)
  const filteredStudioQueue = useMemo(() => {
    return studioQueue.filter(ch => !isDebutStatus(ch.seriesInfo?.status))
  }, [studioQueue])

  const layeredStudioQueue = useMemo(() => {
    const maps = { inprogress: new Map(), eb: new Map(), done: new Map() }

    for (const item of filteredStudioQueue) {
      const layer = getChapterLayer(item)
      const map = maps[layer]
      const seriesId = item.seriesInfo?.seriesid ?? item.seriesid ?? 'unknown'
      if (!map.has(seriesId)) {
        map.set(seriesId, {
          seriesId,
          seriesTitle: item.seriesInfo?.title ?? 'Không rõ series',
          coverUrl: item.seriesInfo?.coverimageurl ?? null,
          chapters: [],
        })
      }
      map.get(seriesId).chapters.push(item)
    }

    const getCreatedAt = item => new Date(item.createdat ?? item.createdAt ?? 0).getTime()

    const result = {}
    for (const layerKey of ['inprogress', 'eb', 'done']) {
      const groups = Array.from(maps[layerKey].values())
      for (const group of groups) {
        group.chapters.sort((a, b) => getCreatedAt(b) - getCreatedAt(a))
        group.latestCreatedAt = group.chapters.length ? getCreatedAt(group.chapters[0]) : 0
      }
      groups.sort((a, b) => {
        if (b.latestCreatedAt !== a.latestCreatedAt) return b.latestCreatedAt - a.latestCreatedAt
        return a.seriesTitle.localeCompare(b.seriesTitle)
      })
      result[layerKey] = groups
    }
    return result
  }, [filteredStudioQueue])

  const studioSections = [
    { key: 'inprogress', label: 'Đang thực hiện',                    dot: 'bg-sky-500',    groups: layeredStudioQueue.inprogress },
    { key: 'eb',         label: `Đang chờ ${LABEL_EDITOR_BOARD} chấm`, dot: 'bg-violet-500', groups: layeredStudioQueue.eb },
    { key: 'done',       label: 'Đã phát hành',                      dot: 'bg-emerald-500', groups: layeredStudioQueue.done },
  ]

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function openChapter(chapter) {
    setSelectedChapter(chapter)
    setSelectedChapterPagesLoading(true)
    setSelectedChapterPageIndex(0)
    const chapterId = chapter.chapterid ?? chapter.id
    console.log('[TantouEditor] openChapter → chapterId:', chapterId, 'chapter:', chapter)
    try {
      const res = await axiosClient.get('/Pages', { params: { chapterId } })
      const pages = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      console.log('[TantouEditor] pages fetched:', pages.length, JSON.stringify(pages, null, 2))
      setSelectedChapterPages(pages)
    } catch (err) {
      console.error('[TantouEditor] pages fetch error:', err?.response?.data ?? err)
      setSelectedChapterPages([])
    }
    finally { setSelectedChapterPagesLoading(false) }
  }

  function closeChapter() {
    setSelectedChapter(null)
    setSelectedChapterPages([])
  }

  function selectSeriesForChapters(seriesId) {
    setSelectedSeriesIdForChapters(seriesId)
    setSelectedChapter(null)
    setSelectedChapterPages([])
  }

  // ── Review mode (Duyệt Series) ───────────────────────────────────────────
  if (reviewOpen && selectedSub) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="page-container flex-1 py-8">
          {reviewPagesLoading || !reviewSubmission ? (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Đang tải trang truyện...
            </div>
          ) : (
            <TantouPageReview
              submission={reviewSubmission}
              editorialComment={editorialComment}
              onEditorialCommentChange={setEditorialComment}
              onBack={closeReview}
              onForwardEb={handleForwardEb}
              onRequestRevision={handleRequestRevision}
              onApproveRecurring={undefined}
              pages={reviewPages}
              pagesLoading={reviewPagesLoading}
              pageIndex={reviewPageIndex}
              onPageIndexChange={setReviewPageIndex}
              chapterId={reviewChapterId}
              revisionHistory={[]}
            />
          )}
        </main>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="ws-page--tantou flex min-h-screen bg-slate-900/5 dark:bg-zinc-950">
      <SidebarNav
        logoIcon={BookOpen}
        items={SIDEBAR_ITEMS}
        activeId={tab}
        onSelect={setTab}
        onLogout={user ? handleLogout : undefined}
        accentClass="bg-sky-600 text-white"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopBar
          user={user}
          onLogout={user ? handleLogout : undefined}
          titleSlot={
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">{LABEL_TANTOU_EDITOR}</p>
              <h1 className="text-base font-bold tracking-tight">
                Xin chào{user?.name ? `, ${user.name}` : ''}
              </h1>
            </div>
          }
        />
        <main className="flex-1 overflow-y-auto bg-zinc-50/50 p-8 dark:bg-zinc-950/20">
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          {/* ── Tab: Duyệt Series ── */}
          <TabsContent value="debut">
            {loading ? (
              <div className="flex items-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" /> Đang tải...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Slide bar: debut queue */}
                {debutQueue.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">Series chờ duyệt</h2>
                      <Badge variant="secondary" className="text-[10px]">{debutQueue.length}</Badge>
                    </div>
                    <div
                      className="hide-scrollbar flex gap-3 overflow-x-auto pb-2"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {debutQueue.map(series => (
                        <SeriesSlideCard
                          key={series.seriesid}
                          series={series}
                          isSelected={selectedSeriesId === series.seriesid}
                          onClick={() => setSelectedSeriesId(
                            selectedSeriesId === series.seriesid ? null : series.seriesid
                          )}
                        />
                      ))}
                    </div>
                    {/* Series detail when selected */}
                    {selectedSeriesId && (() => {
                      const selected = debutQueue.find(s => s.seriesid === selectedSeriesId)
                      if (!selected) return null
                      return (
                        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row">
                            <CoverThumb url={selected.coverimageurl} sizeClass="size-32 sm:size-40" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold">{selected.title}</h3>
                                <Badge variant="secondary">{statusLabel(selected.status)}</Badge>
                                {selected.agerating && (
                                  <Badge variant="outline">{selected.agerating}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{selected.publishformat}</p>
                              {selected.synopsis && (
                                <p className="text-sm leading-relaxed">{selected.synopsis}</p>
                              )}
                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAcceptSeries(selected.seriesid)}
                                >
                                  Chấp nhận series
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setRejectReason('')
                                    setRejectModalOpen(true)
                                  }}
                                >
                                  <Ban className="mr-1 size-4" />
                                  Từ chối series
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })()}
                  </div>
                )}

                {debutQueue.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Không có series nào cần duyệt.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Duyệt Chapters ── */}
          <TabsContent value="studio">
            {selectedChapter ? (
              // ── 2-panel: chapter workspace ──
              <div className="flex gap-4" style={{ minHeight: '600px' }}>
                {/* Panel trái: danh sách chapters của series đã chọn */}
                <div className="w-80 shrink-0 space-y-4 overflow-y-auto">
                  <Button variant="outline" size="sm" onClick={closeChapter}>
                    ← Quay lại danh sách
                  </Button>

                  {/* Series info header */}
                  {(() => {
                    const series = studioQueue.find(ch => ch.seriesid === selectedChapter.seriesid)?.seriesInfo
                    return series ? (
                      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                        <CoverThumb url={series.coverimageurl} sizeClass="size-12" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm">{series.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {studioQueue.filter(ch => ch.seriesid === selectedChapter.seriesid).length} chapters
                          </p>
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* Danh sách chapters theo status */}
                  {studioSections.map(section => {
                    const seriesChapters = studioQueue.filter(
                      ch => ch.seriesid === selectedChapter.seriesid && getChapterLayer(ch) === section.key
                    )
                    if (seriesChapters.length === 0) return null
                    return (
                      <div key={section.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${section.dot}`} />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {section.label}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{seriesChapters.length}</Badge>
                        </div>
                        {seriesChapters.map(ch => (
                            <div
                              key={ch.chapterid}
                              onClick={() => openChapter(ch)}
                              className={`cursor-pointer rounded-md border p-2 text-xs transition-all hover:shadow-sm ${
                                selectedChapter.chapterid === ch.chapterid
                                  ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30 ring-1 ring-sky-400'
                                  : 'border-border'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium">
                                  Ch.{ch.chapternumber ?? ch.chapterNumber ?? '?'} — {ch.title ?? 'Không tên'}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )
                  })}
                </div>

                {/* Panel phải: chapter slide bar + workspace */}
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Slide bar: all chapters of this series */}
                  {(() => {
                    const allSeriesChapters = studioQueue.filter(ch => ch.seriesid === selectedChapter.seriesid)
                    if (allSeriesChapters.length <= 1) return null
                    return (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Chapters của series này
                        </p>
                        <div
                          className="hide-scrollbar flex gap-2 overflow-x-auto pb-1"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {allSeriesChapters.map(ch => (
                            <div
                              key={ch.chapterid}
                              onClick={() => openChapter(ch)}
                              className={`shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-all ${
                                selectedChapter.chapterid === ch.chapterid
                                  ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-400 dark:bg-sky-950/30'
                                  : 'border-border bg-card hover:border-sky-300'
                              }`}
                            >
                              <span className="font-medium">
                                Ch.{ch.chapternumber ?? ch.chapterNumber ?? '?'}
                              </span>
                              <span className="ml-1 text-muted-foreground">
                                {ch.title ? ch.title.slice(0, 12) + (ch.title.length > 12 ? '…' : '') : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {(() => {
                    const ch = selectedChapter
                    // Transform chapter → submission shape for TantouPageReview header
                    const chapterSubmission = {
                      ...ch,
                      seriesTitle: ch.seriesInfo?.title ?? ch.title ?? 'Không rõ series',
                      chapterNum: ch.chapternumber ?? ch.chapterNumber ?? '?',
                      pageLabel: ch.title ?? '',
                      pipeline: 'recurring', // chapters are always recurring, not debut
                    }
                    return (
                      <TantouPageReview
                        submission={chapterSubmission}
                        editorialComment=""
                        onEditorialCommentChange={() => {}}
                        onBack={closeChapter}
                        onForwardEb={undefined}
                        onRequestRevision={undefined}
                        onApproveRecurring={undefined}
                        actionsMode="studio"
                        onChapterRequestRevision={(comment) => handleChapterRequestRevision(selectedChapter.chapterid ?? selectedChapter.id, comment)}
                        onChapterApprove={() => handleChapterApprove(selectedChapter.chapterid ?? selectedChapter.id)}
                        pages={selectedChapterPages}
                        pagesLoading={selectedChapterPagesLoading}
                        pageIndex={selectedChapterPageIndex}
                        onPageIndexChange={setSelectedChapterPageIndex}
                        chapterId={selectedChapter.chapterid ?? selectedChapter.id}
                        revisionHistory={[]}
                      />
                    )
                  })()}
                </div>
              </div>
            ) : selectedSeriesIdForChapters ? (
              // ── Chỉ chọn series — hiện chapter list của series đó ──
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setSelectedSeriesIdForChapters(null)}>
                    ← Chọn series khác
                  </Button>
                  {(() => {
                    const series = studioQueue.find(ch => ch.seriesid === selectedSeriesIdForChapters)?.seriesInfo
                    return series ? (
                      <div className="flex items-center gap-3">
                        <CoverThumb url={series.coverimageurl} sizeClass="size-10" />
                        <div>
                          <p className="font-semibold">{series.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {studioQueue.filter(ch => ch.seriesid === selectedSeriesIdForChapters).length} chapters trong pipeline
                          </p>
                        </div>
                      </div>
                    ) : null
                  })()}
                </div>

                {studioSections.map(section => {
                  const seriesChapters = studioQueue.filter(
                    ch => ch.seriesid === selectedSeriesIdForChapters && getChapterLayer(ch) === section.key
                  )
                  if (seriesChapters.length === 0) return null
                  return (
                    <div key={section.key} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${section.dot}`} />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {section.label}
                        </h3>
                        <Badge variant="outline" className="text-[10px]">{seriesChapters.length}</Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {seriesChapters.map(ch => (
                          <Card
                            key={ch.chapterid}
                            onClick={() => openChapter(ch)}
                            className="cursor-pointer transition-all hover:shadow-md hover:border-sky-300"
                          >
                            <CardContent className="flex flex-col gap-2 p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-sm">
                                    Ch.{ch.chapternumber ?? ch.chapterNumber ?? '?'}
                                  </p>
                                  {ch.title && (
                                    <p className="text-xs text-muted-foreground line-clamp-1">{ch.title}</p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {studioSections.every(s => studioQueue.filter(ch => ch.seriesid === selectedSeriesIdForChapters && getChapterLayer(ch) === s.key).length === 0) && (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Series này chưa có chapter nào trong pipeline.
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              // ── Chưa chọn series — hiện series slide bar + search ──
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Duyệt Chapters</h2>
                  <p className="text-sm text-muted-foreground">
                    Chọn series để xem &amp; nhận xét chapters. Duyệt thẳng để xuất bản.
                  </p>
                </div>

                {studioLoading ? (
                  <div className="flex items-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Đang tải tiến độ...
                  </div>
                ) : studioQueue.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Không có chapter nào trong pipeline.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Slide bar: series có chapters */}
                    {(() => {
                      const seriesWithChapters = layeredStudioQueue.inprogress
                        .concat(layeredStudioQueue.eb)
                        .concat(layeredStudioQueue.done)
                        .filter(g => g.chapters.length > 0)
                      if (seriesWithChapters.length === 0) return null
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                              Series trong pipeline
                            </h3>
                            <Badge variant="outline" className="text-[10px]">{seriesWithChapters.length}</Badge>
                          </div>
                          <div
                            className="hide-scrollbar flex gap-3 overflow-x-auto pb-2"
                            style={{ scrollbarWidth: 'thin' }}
                          >
                            {seriesWithChapters.map(group => (
                              <div
                                key={group.seriesId}
                                onClick={() => selectSeriesForChapters(group.seriesId)}
                                className={`group shrink-0 cursor-pointer rounded-xl border bg-card p-3 text-xs transition-all hover:shadow-md ${
                                  selectedSeriesIdForChapters === group.seriesId
                                    ? 'border-sky-400 ring-1 ring-sky-400 bg-sky-50 dark:bg-sky-950/30'
                                    : 'border-border hover:border-sky-300'
                                }`}
                                style={{ width: '160px' }}
                              >
                                <CoverThumb url={group.coverUrl} sizeClass="w-full h-20 mb-2" />
                                <p className="line-clamp-2 font-semibold leading-tight">{group.seriesTitle}</p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {group.chapters.length} chapter{group.chapters.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Chapter count summary */}
                    <div className="space-y-3">
                      {studioSections.map(section => {
                        const total = section.groups.reduce((sum, g) => sum + g.chapters.length, 0)
                        if (total === 0) return null
                        return (
                          <div key={section.key} className="flex items-center gap-3">
                            <span className={`size-2 rounded-full ${section.dot}`} />
                            <span className="text-sm font-medium">{section.label}</span>
                            <Badge variant="outline" className="text-[10px]">{total}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Lịch phát hành (chỉ xem) ── */}
          <TabsContent value="schedule" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Lịch phát hành</h2>
              <p className="text-sm text-muted-foreground">
                Series đã được {LABEL_EDITOR_BOARD} chấp nhận. Mục này chỉ để xem, không chỉnh sửa được ở đây.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Đang tải...
              </div>
            ) : scheduleSeries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Chưa có series qua {LABEL_EDITOR_BOARD}.
                </CardContent>
              </Card>
            ) : (
              scheduleSeries.map(row => (
                <Card key={row.seriesid} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className="shrink-0 p-4">
                      <CoverThumb url={row.coverimageurl ?? row.Coverimageurl} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardHeader>
                        <CardTitle className="truncate">{row.title}</CardTitle>
                        <CardDescription className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.agerating && (
                              <Badge variant="outline" className="text-[10px]">
                                {row.agerating}
                              </Badge>
                            )}
                            {row.publishformat && (
                              <span className="text-xs text-muted-foreground">
                                {row.publishformat}
                              </span>
                            )}
                          </div>
                          {row.synopsis && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {row.synopsis}
                            </p>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Badge variant={row.cadence ? 'default' : 'outline'}>
                          {row.cadence
                            ? `Đang phát hành: ${row.cadence === 'weekly' ? 'Theo tuần' : 'Theo tháng'}`
                            : 'Chưa đặt lịch phát hành'}
                        </Badge>
                      </CardFooter>
                    </div>
                  </div>
                </Card>
              ))
            )}

            </TabsContent>
        </Tabs>

        {/* Modal từ chối series */}
        <Dialog open={rejectModalOpen} onOpenChange={(v) => !v && setRejectModalOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="size-5 text-destructive" />
                Từ chối series
              </DialogTitle>
              <DialogDescription>
                Nhập lý do từ chối để gửi cho Mangaka. Series sẽ chuyển sang trạng thái <b>Draft</b>.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={4}
              placeholder="Ví dụ: Nội dung chưa phù hợp đối tượng mục tiêu, cần chỉnh sửa cốt truyện..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="resize-y"
              autoFocus
            />
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setRejectModalOpen(false)} disabled={rejectBusy}>
                Hủy
              </Button>
              <Button
                variant="destructive"
                disabled={rejectBusy || !rejectReason.trim()}
                onClick={async () => {
                  if (!selectedSeriesId) return
                  setRejectBusy(true)
                  const ok = await handleRejectSeries(selectedSeriesId, rejectReason)
                  setRejectBusy(false)
                  if (ok) {
                    setRejectModalOpen(false)
                    setRejectReason('')
                  }
                }}
              >
                {rejectBusy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                Xác nhận từ chối
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </main>
      </div>
    </div>
  )
}