import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Calendar, Clock, Loader2, Search, Sparkles, X } from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { WorkspaceHero } from '@/components/layout/WorkspaceHero.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { getSession, logout } from '@/lib/auth.js'
import { LABEL_EDITOR_BOARD, LABEL_TANTOU_EDITOR } from '@/constants/roleTerminology.js'
import { NAV_LINKS } from '@/constants/tantou.js'
import { useTantouWorkspace } from '@/hooks/Usetantouworkspace.js'
import { normalizeStatus, isDebutStatus, isApprovedStatus, isEbStatus, statusLabel } from './TantouEditor.helpers.jsx'
import { CoverThumb } from '@/components/User/Tantou/CoverThumb.jsx'
import { SubmissionCard } from '@/components/User/Tantou/SubmissionCard.jsx'
import { StudioChapterCard } from '@/components/User/Tantou/StudioChapterCard.jsx'
import { SidebarFlow } from '@/components/User/Tantou/SidebarFlow.jsx'
import TantouPageReview from './TantouPageReview.jsx'
import './TantouEditor.css'

const DAY_MS = 24 * 60 * 60 * 1000
const URGENT_THRESHOLD_DAYS = 14  // deadline còn ≤ 14 ngày → coi là gấp

function getDaysLeft(deadline) {
  if (!deadline) return null
  const diffMs = new Date(deadline).getTime() - Date.now()
  return diffMs / DAY_MS
}

function formatDeadline(deadline) {
  if (!deadline) return '—'
  return new Date(deadline).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function urgencyLabel(daysLeft) {
  if (daysLeft < 0) return `Quá hạn ${Math.ceil(Math.abs(daysLeft))} ngày`
  if (daysLeft < 1) return 'Gấp — hôm nay/ngày mai'
  return `Còn ${Math.ceil(daysLeft)} ngày`
}

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
    ebQueue,
    scheduleSeries,
    loadSeries,
    studioLoading,
    studioQueue,
    delayedCount,
    handleRefreshStudio,
    selectedSub,
    reviewSubmission,      // ← SỬA: lấy submission đã ráp sẵn từ hook
    reviewOpen,
    editorialComment,
    setEditorialComment,
    reviewPageIndex,
    setReviewPageIndex,
    reviewChapterId,
    reviewChapterNumber,
    reviewPages,
    reviewPagesLoading,
    openReview,
    closeReview,
    handleForwardEb,
    handleRequestRevision,
  } = useTantouWorkspace()

  const [tab, setTab] = useState('debut')
  const [studioSearch, setStudioSearch]             = useState('')
  const [studioStatusFilter, setStudioStatusFilter] = useState('all')

  const filteredStudioQueue = useMemo(() => {
    const q = studioSearch.trim().toLowerCase()
    return studioQueue.filter(ch => {
      const matchStatus = studioStatusFilter === 'all' || normalizeStatus(ch.status) === studioStatusFilter
      const seriesTitle = (ch.seriesInfo?.title ?? '').toLowerCase()
      const chapterTitle = (ch.title ?? '').toLowerCase()
      const matchSearch = !q || seriesTitle.includes(q) || chapterTitle.includes(q)
      return matchStatus && matchSearch
    })
  }, [studioQueue, studioSearch, studioStatusFilter])

  const urgentChapters = useMemo(() => {
    return studioQueue
      .filter(ch => {
        if (getChapterLayer(ch) !== 'inprogress') return false
        const daysLeft = getDaysLeft(ch.deadline)
        return daysLeft !== null && daysLeft <= URGENT_THRESHOLD_DAYS
      })
      .map(ch => ({ ...ch, daysLeft: getDaysLeft(ch.deadline) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
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

  // ── Review mode ───────────────────────────────────────────────────────────
  if (reviewOpen && selectedSub) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />
        <main className="page-container flex-1 py-8">
          {reviewPagesLoading || !reviewSubmission ? (   // ← SỬA: chờ data thật trước khi render
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Đang tải trang truyện...
            </div>
          ) : (
            <TantouPageReview
              submission={reviewSubmission}              // ← SỬA: dùng submission đã ráp sẵn
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
    <div className="ws-page--tantou flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-sky-950 to-zinc-950"
        label={LABEL_TANTOU_EDITOR}
        title={`Xin chào${user?.name ? `, ${user.name}` : ''}`}
        description={`Nhận bản thảo từ Mangaka · viết nhận xét · chuyển ${LABEL_EDITOR_BOARD} · theo dõi tiến độ studio.`}
      />

      <main className="page-container flex-1 py-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="debut" className="gap-2">
              <Sparkles className="size-4" />
              Lần đầu → EB
              {(debutQueue.length + ebQueue.length) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {debutQueue.length + ebQueue.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="studio" className="gap-2">
              <Clock className="size-4" />
              Tiến độ studio
              {urgentChapters.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                  {urgentChapters.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="size-4" />
              Lịch xuất bản
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Lần đầu → EB ── */}
          <TabsContent value="debut" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Bản thảo đang xét</h2>
                    <p className="text-sm text-muted-foreground">
                      Xét chuyển {LABEL_EDITOR_BOARD} hoặc gửi Mangaka chỉnh (kèm nhận xét).
                    </p>
                  </div>
                  {loading ? (
                    <div className="flex items-center gap-2 py-8 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Đang tải...
                    </div>
                  ) : debutQueue.length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center text-muted-foreground">
                        Không có bản thảo nào chờ Tantou xét.
                      </CardContent>
                    </Card>
                  ) : (
                    debutQueue.map(sub => (
                      <SubmissionCard key={sub.seriesid} sub={sub} onReview={openReview} />
                    ))
                  )}
                </div>

                {!loading && ebQueue.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
                        Đang xét tại {LABEL_EDITOR_BOARD}
                        <Badge variant="outline" className="text-[10px]">{ebQueue.length}</Badge>
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Đã chuyển EB — chờ kết quả. Tantou không cần action.
                      </p>
                    </div>
                    {ebQueue.map(sub => (
                      <Card key={sub.seriesid} className="opacity-70">
                        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                          <CoverThumb url={sub.coverimageurl} />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{sub.title}</h3>
                              <Badge variant="default">{statusLabel(sub.status)}</Badge>
                              {sub.agerating && (
                                <Badge variant="outline" className="text-[11px]">{sub.agerating}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{sub.publishformat}</p>
                            {sub.synopsis && (
                              <p className="line-clamp-2 text-xs text-muted-foreground">{sub.synopsis}</p>
                            )}
                          </div>
                          <p className="shrink-0 text-xs text-muted-foreground">Chờ EB duyệt</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              <SidebarFlow onRefresh={loadSeries} />
            </div>
          </TabsContent>

          {/* ── Tab: Tiến độ studio ── */}
          <TabsContent value="studio" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Tiến độ studio</h2>
                <p className="text-sm text-muted-foreground">
                  Theo dõi trạng thái chapter. Duyệt Ready → Published là quyền của {LABEL_EDITOR_BOARD}.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs text-muted-foreground"
                onClick={handleRefreshStudio}
                disabled={studioLoading}
              >
                {studioLoading
                  ? <Loader2 className="size-3 animate-spin" />
                  : <Clock className="size-3" />
                }
                <span className="ml-1">Làm mới</span>
              </Button>
            </div>

            {!studioLoading && studioQueue.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Tìm series hoặc tên chương..."
                    value={studioSearch}
                    onChange={e => setStudioSearch(e.target.value)}
                    className="h-8 pl-8 pr-8 text-sm"
                  />
                  {studioSearch && (
                    <button
                      onClick={() => setStudioSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1">
                  {[
                    { value: 'all',          label: 'Tất cả' },
                    { value: 'inproduction', label: 'Đang làm' },
                    { value: 'delayed',      label: 'Trễ' },
                    { value: 'ready',        label: 'Sẵn sàng' },
                    { value: 'published',    label: 'Đã phát' },
                  ].map(opt => (
                    <Button
                      key={opt.value}
                      variant={studioStatusFilter === opt.value ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => setStudioStatusFilter(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {studioLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Đang tải tiến độ...
              </div>
            ) : filteredStudioQueue.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {studioQueue.length === 0
                    ? 'Không có chapter nào đang trong pipeline.'
                    : 'Không tìm thấy chapter khớp bộ lọc.'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {studioSections.map(section => {
                  const totalChapters = section.groups.reduce((sum, g) => sum + g.chapters.length, 0)
                  if (totalChapters === 0) return null
                  return (
                    <div key={section.key} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${section.dot}`} />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {section.label}
                        </h3>
                        <Badge variant="outline" className="text-[10px]">{totalChapters}</Badge>
                      </div>

                      <div className="space-y-5">
                        {section.groups.map(group => (
                          <div key={group.seriesId} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <CoverThumb url={group.coverUrl} />
                              <h4 className="font-semibold">{group.seriesTitle}</h4>
                              <Badge variant="outline" className="text-[10px]">
                                {group.chapters.length}
                              </Badge>
                            </div>
                            <div className="space-y-2 border-l-2 border-border pl-3">
                              {group.chapters.map(item => {
                                const daysLeft = getDaysLeft(item.deadline)
                                const isUrgent =
                                  section.key === 'inprogress' &&
                                  daysLeft !== null &&
                                  daysLeft <= URGENT_THRESHOLD_DAYS
                                return (
                                  <div key={item.chapterid} className="relative">
                                    {isUrgent && (
                                      <Badge
                                        variant="destructive"
                                        className="absolute -top-2 -right-2 z-10 gap-1 text-[10px] px-1.5 py-0.5"
                                      >
                                        <AlertTriangle className="size-3" />
                                        {urgencyLabel(daysLeft)}
                                      </Badge>
                                    )}
                                    <StudioChapterCard item={item} />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {filteredStudioQueue.length < studioQueue.length && (
                  <p className="text-center text-xs text-muted-foreground">
                    Hiện {filteredStudioQueue.length} / {studioQueue.length} chương
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Lịch xuất bản (chỉ xem) ── */}
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
                <Card key={row.seriesid}>
                  <CardHeader>
                    <CardTitle>{row.title}</CardTitle>
                    <CardDescription>{row.agerating}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Badge variant={row.cadence ? 'default' : 'outline'}>
                      {row.cadence
                        ? `Đang phát hành: ${row.cadence === 'weekly' ? 'Theo tuần' : 'Theo tháng'}`
                        : 'Chưa đặt lịch phát hành'}
                    </Badge>
                  </CardFooter>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  )
}