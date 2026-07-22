import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  Handshake,
  Image as ImageIcon,
  Inbox,
  Layers as LayersIcon,
  Lightbulb,
  Settings as SettingsIcon,
  TrendingUp,
} from 'lucide-react'
import {
  LayoutDashboard,
  Send,
  BarChart3,
  History as HistoryIcon,
  User,
} from 'lucide-react'
import SidebarNav from '@/components/layout/SidebarNav.jsx'
import WorkspaceTopBar from '@/components/layout/WorkspaceTopBar.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getSession, logout } from '@/lib/auth.js'
import { useAssistantAssignments } from '@/hooks/useAssistantAssignments.js'
import { useCollaborationRequests } from '@/hooks/useCollaborationRequests.js'
import LayerEditor from '@/components/layer/LayerEditor.jsx'
import CollaborationRequestsDialog from '@/components/CollaborationRequestsDialog.jsx'

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Chapter của tôi', icon: Briefcase },
  { id: 'submit', label: 'Đã gửi Mangaka', icon: Send },
  { id: 'history', label: 'Lịch sử', icon: HistoryIcon },
  { id: 'stats', label: 'Thống kê', icon: BarChart3 },
  { id: 'profile', label: 'Hồ sơ', icon: User },
  { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
]

const STATS = [
  { label: 'Chapter nhận', icon: Inbox, color: 'amber' },
  { label: 'Đang làm', icon: LayersIcon, color: 'violet' },
  { label: 'Chờ duyệt', icon: Clock, color: 'sky' },
  { label: 'Đã duyệt', icon: CheckCircle2, color: 'emerald' },
  { label: 'Thu nhập', icon: TrendingUp, color: 'rose' },
]

// Khớp đúng các giá trị được normalizeChapterStatus() trả về
// (xem utils/statusMap.js). Không thêm status "ảo" không tồn tại ở BE nữa.
const STATUS_BADGE = {
  pending:      { label: 'Chờ nhận',      className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  in_progress:  { label: 'Đang xử lý',    className: 'bg-violet-100 text-violet-700 hover:bg-violet-100' },
  submitted:    { label: 'Chờ Mangaka duyệt', className: 'bg-sky-100 text-sky-700 hover:bg-sky-100' },
  approved:     { label: 'Đã duyệt',      className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  delayed:      { label: 'Trễ deadline',  className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  cancelled:    { label: 'Đã hủy',        className: 'bg-zinc-200 text-zinc-600 hover:bg-zinc-200' },
  // Trạng thái của "quan hệ hợp tác" (mangaka_assistants), không phải chapter
  contract_pending:   { label: 'Hợp tác: chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  contract_active:    { label: 'Đang hợp tác',        className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  contract_suspended: { label: 'Tạm dừng hợp tác',    className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  contract_inactive:  { label: 'Ngừng hợp tác',       className: 'bg-zinc-200 text-zinc-600 hover:bg-zinc-200' },
}

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ nhận' },
  { id: 'in_progress', label: 'Đang làm' },
  { id: 'submitted', label: 'Chờ duyệt' },
  { id: 'approved', label: 'Đã xong' },
  { id: 'delayed', label: 'Trễ deadline' },
]

export default function Assistant() {
  const navigate = useNavigate()
  const session = getSession()
  const user = session ?? {}

  const { assignments, loading: assignmentsLoading, refresh } = useAssistantAssignments()
  const { pendingCount } = useCollaborationRequests()
  const [selectedChapterId, setSelectedChapterId] = useState(null)
  const [taskFilter, setTaskFilter] = useState('all')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [collabDialogOpen, setCollabDialogOpen] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [studioSearch, setStudioSearch] = useState('')

  const selectedAssignment = useMemo(
    () => {
      if (selectedChapterId) {
        const found = assignments.find(a => (a.chapterId ?? a.id) === selectedChapterId)
        if (found) return found
      }
      return assignments[0] ?? null
    },
    [assignments, selectedChapterId],
  )

  // Auto-select chapter đầu tiên
  useEffect(() => {
    if (!assignments.length) {
      setSelectedChapterId(null)
      return
    }
    if (!assignments.some(a => (a.chapterId ?? a.id) === selectedChapterId)) {
      setSelectedChapterId(assignments[0]?.chapterId ?? assignments[0]?.id ?? null)
    }
  }, [assignments, selectedChapterId])

  // ESC để thoát fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const filteredChapters = useMemo(() => {
    if (taskFilter === 'all') return assignments
    return assignments.filter(a => {
      const s = String(a.status ?? '').toLowerCase()
      return s === taskFilter
    })
  }, [assignments, taskFilter])

  const counts = useMemo(() => {
    const c = { all: assignments.length }
    for (const f of FILTERS) {
      if (f.id === 'all') continue
      c[f.id] = assignments.filter(a => String(a.status ?? '').toLowerCase() === f.id).length
    }
    return c
  }, [assignments])

  const statsDisplayed = useMemo(() => {
    const pending = assignments.filter(a => String(a.status).toLowerCase() === 'pending').length
    const progress = assignments.filter(a => String(a.status).toLowerCase() === 'in_progress').length
    const review = assignments.filter(a => String(a.status).toLowerCase() === 'submitted').length
    const approved = assignments.filter(a => String(a.status).toLowerCase() === 'approved').length
    return [
      { ...STATS[0], value: String(pending || assignments.length) },
      { ...STATS[1], value: String(progress) },
      { ...STATS[2], value: String(review) },
      { ...STATS[3], value: String(approved) },
      { ...STATS[4], value: '—' },
    ]
  }, [assignments])

  // Danh sách chapter đang có note "cần sửa" mở — lấy từ dữ liệu thật
  // (page_issues.issue_type = Revision, status Reported/InProgress),
  // KHÔNG dùng chapter.status vì DB không có giá trị "Revision" cho chapter.
  const revisionChapters = useMemo(
    () => assignments.filter(a => (a.openRevisionCount ?? 0) > 0),
    [assignments],
  )
  const totalOpenRevisionIssues = useMemo(
    () => revisionChapters.reduce((sum, a) => sum + (a.openRevisionCount ?? 0), 0),
    [revisionChapters],
  )

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleSelectChapter(chapter) {
    // Submissions have id but no chapterId; use id for selection
    const key = chapter.chapterId ?? chapter.id ?? null
    setSelectedChapterId(key)
  }

  function handleGoToRevisions() {
    if (!revisionChapters.length) return
    setSelectedChapterId(revisionChapters[0].chapterId ?? revisionChapters[0].id ?? null)
    setTab('dashboard')
  }

  return (
    <div className="flex min-h-screen bg-slate-900/5 dark:bg-zinc-950">
      <SidebarNav
        logoIcon={LayersIcon}
        appName="MangaPublish"
        items={SIDEBAR_ITEMS}
        activeId={tab}
        onSelect={setTab}
        onLogout={user ? handleLogout : undefined}
        accentClass="bg-violet-600 text-white"
      />

      <div className="flex flex-1 flex-col min-w-0">
        <WorkspaceTopBar
          user={user}
          onLogout={user ? handleLogout : undefined}
        />
        <main className="flex-1 overflow-y-auto bg-zinc-50/50 p-8 dark:bg-zinc-950/20">
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList className="h-auto flex-wrap">
              {SIDEBAR_ITEMS.slice(0, 5).map(item => {
                const Icon = item.icon
                return (
                  <TabsTrigger key={item.id} value={item.id} className="gap-2">
                    <Icon className="size-4" />
                    {item.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {/* DASHBOARD TAB */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* Banner: cần sửa — dựa trên page_issues thật, không dựa chapter.status */}
              {revisionChapters.length > 0 && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
                  <AlertTriangle className="size-5 shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                      {revisionChapters.length} chapter có {totalOpenRevisionIssues} note cần sửa
                    </p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/70">
                      Xem ghi chú ở dưới editor, upload layer sửa rồi gộp & gửi lại.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-red-300 text-red-600 hover:bg-red-100"
                    onClick={handleGoToRevisions}
                  >
                    Xem ngay
                  </Button>
                </div>
              )}

              {/* Banner: có yêu cầu hợp tác */}
              {pendingCount > 0 && (
                <Card
                  className="mb-6 cursor-pointer border-violet-200 bg-gradient-to-br from-violet-500/5 via-background to-background transition-colors hover:border-violet-400 hover:bg-violet-500/10"
                  onClick={() => setCollabDialogOpen(true)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Handshake className="size-4 text-violet-600" />
                      {pendingCount} yêu cầu hợp tác mới
                    </CardTitle>
                    <CardDescription>
                      Nhấn để xem chi tiết và phản hồi.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              {/* Main: 2 cột */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
                {/* LEFT: danh sách chapter */}
                <aside className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Chapter được giao</CardTitle>
                      <CardDescription>Chọn chapter để xử lý</CardDescription>
                      <div className="-mb-1 mt-1 flex flex-wrap gap-1 pt-2">
                        {FILTERS.map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setTaskFilter(f.id)}
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                              taskFilter === f.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                            )}
                          >
                            {f.label}
                            {counts[f.id] > 0 && (
                              <span className={cn(
                                'ml-1 rounded-full px-1 py-0.5 text-[10px] font-bold',
                                taskFilter === f.id
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted text-muted-foreground',
                              )}>
                                {counts[f.id]}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="px-0">
                      {assignmentsLoading ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">Đang tải…</div>
                      ) : filteredChapters.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">Không có chapter nào.</div>
                      ) : (
                        <ScrollArea className="max-h-[calc(100vh-320px)]">
                          <ul className="space-y-1 p-3 pt-0">
                            {filteredChapters.map(ch => {
                              const badge = STATUS_BADGE[(ch.status ?? '').toLowerCase()] ?? STATUS_BADGE.pending
                              const cover = ch.pages?.find(p => p.url) ?? ch.pages?.[0]
                              const coverUrl = cover?.url ?? ch.mangakaImageUrl ?? ch.referenceImageUrl ?? null
                              const notesCount = ch.openRevisionCount ?? 0
                              // Use composite key to match deduplication logic
                              const source = ch._source ?? (ch.id ? 'submission' : ch.contractId ? 'contract' : 'chapter')
                              const itemKey = `${source}:${ch.id ?? ch.contractId ?? ch.chapterId}`
                              const displayChapterId = ch.chapterId ?? ch.id
                              const isSelected = displayChapterId === selectedChapterId
                              return (
                                <li key={itemKey}>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectChapter(ch)}
                                    className={cn(
                                      'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
                                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                                    )}
                                  >
                                    <span className="shrink-0 size-12 overflow-hidden rounded border bg-muted">
                                      {coverUrl ? (
                                        <img src={coverUrl} alt="" className="size-full object-cover" />
                                      ) : (
                                        <span className="flex size-full items-center justify-center text-muted-foreground">
                                          <ImageIcon className="size-4" />
                                        </span>
                                      )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold">
                                        {ch.seriesTitle}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        Ch.{ch.chapterNum}{ch.title ? ` · ${ch.title}` : ''}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {ch.pageCount ?? ch.pages?.length ?? 0} trang
                                        {notesCount > 0 ? ` · ${notesCount} note cần sửa` : ''}
                                      </p>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        <Badge className={cn('mt-1', badge.className)} variant="secondary">
                                          {badge.label}
                                        </Badge>
                                        {notesCount > 0 && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
                                            <AlertTriangle className="size-2.5" /> {notesCount} note
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stats */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="size-4 text-primary" />
                        Thống kê
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {statsDisplayed.map((s, i) => {
                        const Icon = s.icon
                        return (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={cn('size-4', `text-${s.color}-500`)} />
                              <span className="text-xs text-muted-foreground">{s.label}</span>
                            </div>
                            <span className="font-semibold tabular-nums">{s.value}</span>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  {/* Process guide */}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Lightbulb className="size-4 text-primary" />
                        Quy trình
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="relative space-y-2 border-l border-muted pl-5">
                        {[
                          'Chọn chapter bên trái',
                          'Chọn trang trong editor',
                          'Upload layer theo thứ tự (0, 1, 2...)',
                          'Điều chỉnh hiển thị / opacity',
                          'Bấm "Gộp layer" để xuất ảnh hoàn chỉnh',
                          'Bấm "Gửi Mangaka" khi đã xong tất cả trang',
                        ].map((text, i) => (
                          <li key={i} className="relative">
                            <span className="absolute -left-[26px] flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                              {i + 1}
                            </span>
                            <p className="text-xs text-muted-foreground">{text}</p>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </aside>

                {/* RIGHT: Layer Editor */}
                <div className="flex min-h-[calc(100vh-200px)] flex-col">
                  {selectedAssignment ? (
                    <div className="relative flex h-full min-h-0 flex-col">
                      {/* Determine if this is a submission (has id field but no chapterId) */}
                      {(() => {
                        const isSubmission = Boolean(selectedAssignment.id) && !selectedAssignment.chapterId
                        const pages = isSubmission && selectedAssignment.mangakaImageUrl
                          ? [{ id: `sub-${selectedAssignment.id}-0`, url: selectedAssignment.mangakaImageUrl, pageNum: 1 }]
                          : (selectedAssignment.pages ?? []).map(p => ({
                            id: p.id,
                            url: p.url,
                            pageNum: p.pageNum,
                          }))
                        return (
                          <LayerEditor
                            chapter={{
                              seriesTitle: selectedAssignment.seriesTitle,
                              chapterNum: selectedAssignment.chapterNum,
                              chapterId: selectedAssignment.chapterId,
                              pages,
                            }}
                            pageId={isSubmission ? undefined : selectedAssignment.pages?.[0]?.id}
                            pageIssues={isSubmission ? (selectedAssignment.notes ?? []) : undefined}
                            onSubmitted={() => {
                              void refresh()
                              toast.success('Đã gửi chapter. Đang tải lại danh sách…')
                            }}
                          />
                        )
                      })()}
                    </div>
                  ) : (
                    <Card className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
                      <ImageIcon className="size-12 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Chọn một chapter bên trái để bắt đầu.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Upload layer → Gộp → Gửi Mangaka
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TASKS TAB: danh sách chapter full-width */}
            <TabsContent value="tasks" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Chapter được giao</CardTitle>
                      <CardDescription>Chọn chapter để xử lý</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Input
                        placeholder="Tìm chapter..."
                        value={studioSearch}
                        onChange={e => setStudioSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="-mb-1 mt-1 flex flex-wrap gap-1 pt-2">
                    {FILTERS.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setTaskFilter(f.id)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                          taskFilter === f.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                        )}
                      >
                        {f.label}
                        {counts[f.id] > 0 && (
                          <span className={cn(
                            'ml-1 rounded-full px-1 py-0.5 text-[10px] font-bold',
                            taskFilter === f.id
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground',
                          )}>
                            {counts[f.id]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  {assignmentsLoading ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Đang tải…</div>
                  ) : filteredChapters.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Không có chapter nào.</div>
                  ) : (
                    <ScrollArea className="max-h-[60vh]">
                      <ul className="space-y-1 p-3 pt-0">
                        {filteredChapters
                          .filter(ch => !studioSearch.trim() || (ch.seriesTitle ?? '').toLowerCase().includes(studioSearch.toLowerCase()))
                          .map(ch => {
                            const badge = STATUS_BADGE[(ch.status ?? '').toLowerCase()] ?? STATUS_BADGE.pending
                            const cover = ch.pages?.find(p => p.url) ?? ch.pages?.[0]
                            const coverUrl = cover?.url ?? ch.mangakaImageUrl ?? ch.referenceImageUrl ?? null
                            const notesCount = ch.openRevisionCount ?? 0
                            const source = ch._source ?? (ch.id ? 'submission' : ch.contractId ? 'contract' : 'chapter')
                            const itemKey = `${source}:${ch.id ?? ch.contractId ?? ch.chapterId}`
                            const displayChapterId = ch.chapterId ?? ch.id
                            const isSelected = displayChapterId === selectedChapterId
                            return (
                              <li key={itemKey}>
                                <button
                                  type="button"
                                  onClick={() => { handleSelectChapter(ch); setTab('dashboard') }}
                                  className={cn(
                                    'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
                                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                                  )}
                                >
                                  <span className="shrink-0 size-12 overflow-hidden rounded border bg-muted">
                                    {coverUrl ? (
                                      <img src={coverUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                      <span className="flex size-full items-center justify-center text-muted-foreground">
                                        <ImageIcon className="size-4" />
                                      </span>
                                    )}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">
                                      {ch.seriesTitle}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      Ch.{ch.chapterNum}{ch.title ? ` · ${ch.title}` : ''}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {ch.pageCount ?? ch.pages?.length ?? 0} trang
                                      {notesCount > 0 ? ` · ${notesCount} note cần sửa` : ''}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      <Badge className={badge.className} variant="secondary">
                                        {badge.label}
                                      </Badge>
                                      {notesCount > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
                                          <AlertTriangle className="size-2.5" /> {notesCount} note
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              </li>
                            )
                          })}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUBMIT TAB: các chapter đã gửi Mangaka */}
            <TabsContent value="submit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="size-4 text-primary" />
                    Chapter đã gửi Mangaka
                  </CardTitle>
                  <CardDescription>
                    Các chapter đã hoàn tất layer và gửi chờ duyệt.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const submitted = assignments.filter(a => {
                      const s = String(a.status).toLowerCase()
                      return s === 'submitted' || s === 'approved'
                    })
                    if (submitted.length === 0) {
                      return <p className="text-sm text-muted-foreground">Chưa có chapter nào được gửi.</p>
                    }
                    return (
                      <ul className="divide-y">
                        {submitted.map(ch => {
                          const badge = STATUS_BADGE[String(ch.status).toLowerCase()] ?? STATUS_BADGE.pending
                          return (
                            <li key={ch.id ?? ch.chapterId} className="flex items-center justify-between py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{ch.seriesTitle}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Ch.{ch.chapterNum}{ch.title ? ` · ${ch.title}` : ''}
                                </p>
                              </div>
                              <Badge className={badge.className} variant="secondary">
                                {badge.label}
                              </Badge>
                            </li>
                          )
                        })}
                      </ul>
                    )
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            {/* HISTORY TAB */}
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HistoryIcon className="size-4 text-primary" />
                    Lịch sử xử lý
                  </CardTitle>
                  <CardDescription>
                    Các chapter đã hoàn tất (đã duyệt / trễ deadline / bị hủy).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const closed = assignments.filter(a => {
                      const s = String(a.status).toLowerCase()
                      return s === 'approved' || s === 'delayed' || s === 'cancelled'
                    })
                    if (closed.length === 0) {
                      return <p className="text-sm text-muted-foreground">Chưa có lịch sử.</p>
                    }
                    return (
                      <ul className="divide-y">
                        {closed.map(ch => {
                          const badge = STATUS_BADGE[String(ch.status).toLowerCase()] ?? STATUS_BADGE.pending
                          return (
                            <li key={ch.id ?? ch.chapterId} className="flex items-center justify-between py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{ch.seriesTitle}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Ch.{ch.chapterNum}{ch.title ? ` · ${ch.title}` : ''}
                                </p>
                              </div>
                              <Badge className={badge.className} variant="secondary">
                                {badge.label}
                              </Badge>
                            </li>
                          )
                        })}
                      </ul>
                    )
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            {/* STATS TAB: thống kê grid */}
            <TabsContent value="stats" className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {statsDisplayed.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <Card key={i}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <span
                          className={cn(
                            'flex size-10 items-center justify-center rounded-lg',
                            `bg-${s.color}-500/10`,
                          )}
                        >
                          <Icon className={cn('size-5', `text-${s.color}-500`)} />
                        </span>
                        <div>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          <p className="text-lg font-bold tabular-nums">{s.value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            {/* PROFILE / SETTINGS placeholders (giống Mangaka) */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="size-4 text-primary" />
                    Hồ sơ Assistant
                  </CardTitle>
                  <CardDescription>Thông tin cá nhân & liên hệ.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Tên:</span> {user?.name ?? '—'}</p>
                  <p><span className="text-muted-foreground">Email:</span> {user?.email ?? '—'}</p>
                  <p><span className="text-muted-foreground">Vai trò:</span> Assistant</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SettingsIcon className="size-4 text-primary" />
                    Cài đặt
                  </CardTitle>
                  <CardDescription>Tùy chỉnh workspace của bạn.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Các tùy chọn sẽ được bổ sung trong phiên bản tiếp theo.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <CollaborationRequestsDialog open={collabDialogOpen} onOpenChange={setCollabDialogOpen} />
    </div>
  )
}