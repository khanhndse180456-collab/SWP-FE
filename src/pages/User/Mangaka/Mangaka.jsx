import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  History,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  PenSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Workflow,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { WorkspaceHero } from '@/components/layout/WorkspaceHero.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { logout as authLogout } from '@/lib/auth.js'
import { useAuth } from '@/lib/providers'
import { cn } from '@/lib/utils'
import ChapterAnnotator from './ChapterAnnotator.jsx'
import AddSeriesModal from './AddSeriesModal.jsx'
import MangakaAssistants from './MangakaAssistants.jsx'
import { seriesPath } from './SeriesUploadDetail.jsx'
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
  PATH_TANTOU_EDITOR,
} from '@/constants/roleTerminology.js'
import {
  buildSubmissionFromMangakaPage,
  getAssistantSubmission,
  getPendingDeliverableForMangaka,
  pushAssistantSubmission,
  hydrateAssistantDeliverable,
  migrateAssistantStorage,
  updateDeliverableStatus,
} from '@/utils/assistantWorkspaceStorage.js'
import { pageIssuesService, seriesService, submissionsService } from '@/api'
import {
  listTantouSubmissions,
  pushTantouSubmissionFromMangaka,
} from '@/utils/tantouWorkspaceStorage.js'
import {
  getActiveAssigneesForMangaka,
} from '@/utils/assistantRosterStorage.js'
import {
  applySeriesFormUpdate,
  buildSeriesFromForm,
  buildSeriesFromUploadTitle,
  formatSeriesCardLine,
  mapApiSeriesToLocal,
  normalizeSeriesList,
  seriesToExternalSummary,
  slugifySeriesTitle,
} from '@/utils/seriesModel.js'
import { readEbDebutApproved } from '@/utils/ebDebutStorage.js'
import {
  useSeries,
  useSeriesByMangaka,
  useCreateSeries,
  useUpdateSeries,
  useDeleteSeries,
  useChapters,
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useCreatePage,
  useUpdateChapterStatus,
  useAvailableTantouEditors,
  useAssignTantouEditor,
  useNotifications,
} from '@/api/hooks'
import '@/styles/mangaPage.css'
import './Mangaka.css'

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

const STAT_DEFS = [
  { label: 'Series draft', icon: BookOpen, color: 'rose' },
  { label: 'Chapter đã upload', icon: FileText, color: 'sky' },
  { label: 'Chờ Assistant', icon: ImageIcon, color: 'violet' },
  { label: 'Chờ duyệt bản tổng hợp', icon: ClipboardCheck, color: 'amber' },
]

const STATUS_BADGE = {
  draft: { label: 'Nháp', className: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
  assistant: { label: 'Chờ Assistant', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  review: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  tantou: { label: `Chờ ${LABEL_TANTOU_EDITOR}`, className: 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400' },
  done: { label: 'Hoàn tất', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
}

/** Convert a data URL (blob: or data:) back to a File object for upload. */
export function dataUrlToFile(dataUrl, fallbackName = 'page.png') {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) return null
  const mimeType = matches[1]
  const base64 = matches[2]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ext = mimeType.split('/')[1] ?? 'png'
  const name = fallbackName.replace(/\.[^.]+$/, '') + '.' + ext
  return new File([bytes], name, { type: mimeType })
}

const PIPELINE_DEBUT_STEPS = [
  { step: 1, title: 'Mangaka → Assistant', desc: 'Gửi bản thảo & ô ghi chú' },
  { step: 2, title: 'Assistant → Mangaka', desc: 'Nhận bản vẽ, bạn duyệt / yêu cầu sửa' },
  { step: 3, title: `Mangaka → ${LABEL_TANTOU_EDITOR}`, desc: 'Chuyển bản đã duyệt sang Tantou Editor' },
  { step: 4, title: `${LABEL_TANTOU_EDITOR} → ${LABEL_EDITOR_BOARD}`, desc: 'Tantou Editor duyệt rồi đưa lên Editor Board' },
  { step: 5, title: `${LABEL_EDITOR_BOARD} biểu quyết`, desc: 'Editor Board chấp nhận → thông báo Mangaka' },
  { step: 6, title: 'Xuất bản', desc: 'Phát hành sau khi Editor Board đồng thuận' },
]

const PIPELINE_RECURRING_STEPS = [
  { step: 1, title: `Mangaka → ${LABEL_TANTOU_EDITOR}`, desc: 'Gửi chapter / bản thảo' },
  { step: 2, title: `${LABEL_TANTOU_EDITOR} duyệt`, desc: 'Chỉnh sửa & phê duyệt' },
  { step: 3, title: 'Xuất bản', desc: `Không cần vòng ${LABEL_EDITOR_BOARD}` },
]

const TAB_ITEMS = [
  { id: 'series', label: 'Series draft', icon: BookOpen },
  { id: 'chapters', label: 'Chapter', icon: FileText },
  { id: 'assistants', label: 'Thuê Assistant', icon: UserPlus },
  { id: 'annotate', label: 'Upload & Ghi chú', icon: PenSquare },
  { id: 'history', label: 'Lịch sử', icon: History },
]

function resolveAnnotatorActiveChapterId(chapters, preferredId) {
  if (chapters.some(c => c.id === preferredId)) return preferredId
  return chapters[0]?.id ?? 'ch-demo'
}

/** Ghép dòng bảng chapter với phiên upload (ảnh blob / placeholder). */
function resolveAnnotatorChapter(chapterRow, annotatorChapters) {
  if (!chapterRow || !Array.isArray(annotatorChapters)) return null
  const byId = annotatorChapters.find(c => c.id === chapterRow.id)
  if (byId) return byId
  return annotatorChapters.find(
    c => c.series === chapterRow.series && String(c.num) === String(chapterRow.num),
  ) ?? null
}

const STAT_ICON_BG = {
  rose: 'bg-rose-500/10 text-rose-600',
  sky: 'bg-sky-500/10 text-sky-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber: 'bg-amber-500/10 text-amber-600',
}

function StatCard({ def, value, trend }) {
  const Icon = def.icon
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {def.label}
          </p>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          <p className="text-xs text-muted-foreground">{trend}</p>
        </div>
        <div className={cn('flex size-11 items-center justify-center rounded-xl', STAT_ICON_BG[def.color])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function SeriesCard({ series, ebApproved, uploadPct, onOpenAnnotate, onOpenEdit, onDelete, onCompleteDebut }) {
  const isUploading = uploadPct > 0 && uploadPct < 100
  const barPct = isUploading ? uploadPct : Math.min(100, series.progress ?? 0)
  const toSeries = seriesPath(series)
  const statusBadge = STATUS_BADGE[series.status] ?? STATUS_BADGE.draft
  const initials = (series.title.length >= 2 ? series.title : `${series.title}●`).slice(0, 2)

  return (
    <Card className="group relative gap-0 overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: series.color }} />
      {series.needsFullDebutPipeline ? (
        <Badge
          className="absolute right-3 top-3 z-10 bg-amber-500 text-white hover:bg-amber-500"
          title={`Series lần đầu: đủ vòng ${LABEL_EDITOR_BOARD}.`}
        >
          <Sparkles className="size-3" />
          Lần đầu
        </Badge>
      ) : null}

      <Link
        to={toSeries}
        className="flex aspect-[16/7] items-center justify-center text-3xl font-extrabold tracking-tight text-white transition-transform group-hover:scale-[1.02]"
        style={{
          background: `linear-gradient(135deg, ${series.color}, ${series.color}88)`,
        }}
      >
        <span className="drop-shadow-lg">{initials}</span>
      </Link>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={toSeries}
            className="line-clamp-1 font-semibold hover:underline"
            title={series.title}
          >
            {series.title}
          </Link>
          <Badge className={statusBadge.className} variant="secondary">{series.statusLabel ?? statusBadge.label}</Badge>
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground">{formatSeriesCardLine(series)}</p>
        {!series.metadataComplete ? (
          <p className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="size-3" />
            Thiếu mô tả hồ sơ
          </p>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{series.chapters} ch</span>
          <span>·</span>
          <span>{series.marks} vùng ghi chú</span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{isUploading ? 'Đang tải chapter' : 'Tiến độ'}</span>
            <span className="font-medium tabular-nums">{Math.round(barPct)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${barPct}%`, background: series.color }}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{series.updated}</p>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t bg-muted/30 p-3">
        <div className="flex w-full flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to={toSeries}>Xem truyện</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenEdit}>
            Chỉnh sửa
          </Button>
          {series.status === 'Draft' ? (
            <Button size="sm" variant="ghost" onClick={onOpenAnnotate}>
              Đánh dấu vùng
            </Button>
          ) : null}
        </div>

        {series.needsFullDebutPipeline && !ebApproved ? (
          <Button asChild variant="secondary" size="sm" className="w-full bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300">
            <Link to={PATH_EDITOR_BOARD}>
              <Sparkles className="size-3.5" />
              Chờ {LABEL_EDITOR_BOARD} duyệt
            </Link>
          </Button>
        ) : null}

        {series.needsFullDebutPipeline && ebApproved ? (
          <Button size="sm" className="w-full" onClick={onCompleteDebut}>
            <CheckCircle2 className="size-3.5" />
            Hoàn tất vòng đầu
          </Button>
        ) : null}

        <div className="flex w-full justify-end">
          <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
            <Trash2 className="size-3" />
            Xóa
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function Mangaka() {
  const navigate = useNavigate()
  const location = useLocation()
  // locationKey không còn cần thiết để force re-render (effect location.state đã được sửa
  // để chỉ chạy 1 lần / mỗi state object), nhưng giữ lại phòng khi có chỗ khác dùng key này.
  const [locationKey, setLocationKey] = useState(0)
  // Dùng useAuth() thay vì getSession() trực tiếp để component reactive với auth state —
  // nếu không, khi token hết hạn hoặc user bị xóa, component vẫn giữ user cũ → render với state lệch → crash
  // ProtectedRoute đã chặn render khi authLoading=true, nên ở đây user luôn có hoặc đã logout
  const { user: authUser } = useAuth()
  const user = authUser
  const mangakaId = user?.id ?? user?.userid ?? null
  const mangakaName = user?.fullname ?? user?.name ?? 'Demo Mangaka'

  // API data
  const { data: apiSeriesRaw = [], isLoading: seriesLoading } = useSeriesByMangaka(mangakaId)
  const { data: apiChapters = [], isLoading: chaptersLoading } = useChapters()
  const createSeries = useCreateSeries()
  const updateSeries = useUpdateSeries()
  const deleteSeries = useDeleteSeries()
  const createChapter = useCreateChapter()
  const updateChapter = useUpdateChapter()
  const deleteChapter = useDeleteChapter()
  const createPage = useCreatePage()
  const updateChapterStatus = useUpdateChapterStatus()
  const availableTantouEditors = useAvailableTantouEditors()
  const assignTantouEditor = useAssignTantouEditor()

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectChapterId, setRejectChapterId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const [tab, setTab] = useState('annotate')
  // annotateSeries must read from location.state first (navigation carries the correct series),
  // then fall back to persisted workspace value — otherwise navigating from series detail
  // with "Upload chapter" shows the wrong series in the dropdown. Prefer seriesId over title
  // so we don't depend on title-string matching (server may normalize whitespace/case).
  const locationState = location.state

  // Resolve series từ nav state: ưu tiên seriesId (lookup ngược từ seriesList), fallback về title string.
  // Trả về string title hoặc '' nếu không resolve được.
  function resolveSeriesFromNavState(state, seriesListRef) {
    const sid = state?.seriesId
    if (sid != null && Array.isArray(seriesListRef) && seriesListRef.length) {
      const found = seriesListRef.find(s => String(s.seriesid ?? s.id) === String(sid))
      if (found?.title) return found.title
    }
    const title = state?.series
    if (typeof title === 'string' && title.trim()) return title.trim()
    return ''
  }

  const [annotateSeries, setAnnotateSeries] = useState(() => {
    const fromNav = resolveSeriesFromNavState(locationState, [])
    if (fromNav) return fromNav
    return ''
  })

  // Chapter theo series đang annotate — dùng cho list "Bản tổng hợp từ Assistant"
  const apiSeries = useMemo(
    () => (Array.isArray(apiSeriesRaw) ? apiSeriesRaw.map((s, i) => mapApiSeriesToLocal(s, i)).filter(Boolean) : []),
    [apiSeriesRaw],
  )
  const annotateSeriesId = useMemo(
    () => apiSeries.find(s => s.title === annotateSeries)?.id ?? null,
    [apiSeries, annotateSeries],
  )
  const { data: annotateChaptersRaw = [] } = useChapters(annotateSeriesId || undefined)

  // Chapter chờ Mangaka duyệt (status = MangakaReview khi Assistant gửi bản ghép về)
  const pendingFromAssistant = useMemo(
    () => (annotateChaptersRaw || []).filter(c => {
      const s = String(c.status ?? c.Status ?? '').toLowerCase().replace(/[\s_-]/g, '')
      return s === 'mangakareview'
    }),
    [annotateChaptersRaw],
  )

  // History: chapter đã gửi Tantou / duyệt / published
  const HISTORY_STATUSES = useMemo(() => new Set([
    'editorreviewing', 'submittedtoeditor', 'readyforprint', 'published',
    'mangakarejected', 'rejected',
  ]), [])
  const historyChapters = useMemo(
    () => (apiChapters || []).filter(c => {
      const s = String(c.status ?? c.Status ?? '').toLowerCase().replace(/[\s_-]/g, '')
      return HISTORY_STATUSES.has(s)
    }),
    [apiChapters, HISTORY_STATUSES],
  )

  function historyStatusLabel(status) {
    switch (status) {
      case 'editorreviewing':
      case 'submittedtoeditor':
        return 'Tantou đang xem'
      case 'readyforprint':
        return 'Sẵn sàng in'
      case 'published':
        return 'Đã xuất bản'
      case 'mangakarejected':
        return 'Assistant đang sửa'
      case 'rejected':
        return 'Bị từ chối'
      default:
        return status || '—'
    }
  }

  function historyBadgeClass(status) {
    if (status === 'published') return 'bg-emerald-100 text-emerald-700'
    if (status === 'rejected' || status === 'mangakarejected') return 'bg-rose-100 text-rose-700'
    if (status === 'readyforprint') return 'bg-sky-100 text-sky-700'
    return 'bg-amber-100 text-amber-700'
  }

  // A6: Khi có notification chapter.* mới → refetch chapter list
  const qc = useQueryClient()
  const { data: notifications = [] } = useNotifications()
  const lastSeenNotifIdsRef = useRef(new Set())
  useEffect(() => {
    if (!Array.isArray(notifications) || notifications.length === 0) return
    const last = lastSeenNotifIdsRef.current
    const fresh = notifications.filter(n => {
      const id = n.id ?? n.notificationId
      return id && !last.has(id)
    })
    fresh.forEach(n => {
      const id = n.id ?? n.notificationId
      if (id) last.add(id)
    })
    const hasChapterEvent = fresh.some(n => {
      const t = String(n.type ?? n.notificationType ?? '').toLowerCase()
      return t.startsWith('chapter.')
    })
    if (hasChapterEvent) {
      qc.invalidateQueries({ queryKey: ['chapters'] })
    }
  }, [notifications, qc])

  const [localSeriesList, setLocalSeriesList] = useState([])
  const [addSeriesOpen, setAddSeriesOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState(null)
  const [localChapterRows, setLocalChapterRows] = useState([])

  // Clear local data when API data is available (only use real API data)
  useEffect(() => {
    if (apiSeries.length > 0 || apiChapters.length > 0) {
      setLocalSeriesList([])
      setLocalChapterRows([])
    }
  }, [apiSeries.length, apiChapters.length])
  const [uploadPctBySeries, setUploadPctBySeries] = useState({})
  
  // Load persisted chapters from localStorage
  const [annotatorChapters, setAnnotatorChapters] = useState(() => {
    try {
      const saved = localStorage.getItem('mangaka_annotator_chapters')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('mangaka_annotator_chapters', JSON.stringify(annotatorChapters))
    } catch (e) { console.warn('Failed to persist annotatorChapters:', e) }
  }, [annotatorChapters])
  
  const [annotatorNotes, setAnnotatorNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('mangaka_annotator_notes')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  useEffect(() => {
    try {
      localStorage.setItem('mangaka_annotator_notes', JSON.stringify(annotatorNotes))
    } catch (e) { console.warn('Failed to persist annotatorNotes:', e) }
  }, [annotatorNotes])
  
  const [annotatorActiveChapterId, setAnnotatorActiveChapterId] = useState(null)
  const [annotatorPageIndex, setAnnotatorPageIndex] = useState(0)
  const [annotatorChapterNum, setAnnotatorChapterNum] = useState('1')
  const [annotatorPagesPerChapter, setAnnotatorPagesPerChapter] = useState('')
  const [annotatorUploadPageBudget, setAnnotatorUploadPageBudget] = useState('')
  const [ebApprovedTick, setEbApprovedTick] = useState(0)
  const [deliverableTick, setDeliverableTick] = useState(0)
  const [tantouTick, setTantouTick] = useState(0)
  const [tantouSendReady, setTantouSendReady] = useState(null)
  const [rosterTick, setRosterTick] = useState(0)

  // Use API data merged with optimistic local changes; deduplicate by id to avoid React key collisions.
  //
  // QUAN TRỌNG: phải useMemo ở đây. Nếu để là biểu thức thường (tính lại mỗi render), mảng này
  // sẽ có IDENTITY MỚI ở MỌI lần render — kể cả khi nội dung không đổi. Vì nhiều useEffect/useMemo
  // bên dưới (vd. effect xử lý location.state, workspaceSnapshot, chapterRowsBySeries...) đều
  // phụ thuộc trực tiếp vào seriesList/chapterRows, identity-mới-mỗi-render khiến các effect đó
  // chạy lại liên tục. Nếu effect nào trong số đó gọi setState KHÔNG điều kiện (như effect
  // location.state từng gọi setLocationKey vô điều kiện), sẽ tạo vòng lặp:
  //   render → seriesList mới → effect chạy → setState → re-render → seriesList lại mới → ...
  // → React throw "Maximum update depth exceeded" → ErrorBoundary hiện trang trắng báo lỗi.
  const seriesList = useMemo(
    () => Object.values(
      [...apiSeries, ...localSeriesList].reduce((acc, s) => ({ ...acc, [s.id]: s }), {}),
    ),
    [apiSeries, localSeriesList],
  )
  // Deduplicate by (series, num) — prefer row with chapterid (server), fallback to first found
  const chapterRows = useMemo(() => {
    const merged = [...apiChapters, ...localChapterRows]
    const byKey = {}
    for (const r of merged) {
      const key = `${r.series}-${r.num}`
      if (!byKey[key] || r.chapterid) byKey[key] = r
    }
    return Object.values(byKey)
  }, [apiChapters, localChapterRows])

  // Real chapter ID on backend for the currently active annotator chapter
  const annotatorServerChapterId = useMemo(() => {
    if (!annotatorActiveChapterId) return null
    const numericId = Number(annotatorActiveChapterId)
    if (!Number.isFinite(numericId)) return null  // local-only ID → not on server
    return numericId
  }, [annotatorActiveChapterId])

  const hiredAssistants = useMemo(() => {
    void rosterTick
    return getActiveAssigneesForMangaka(mangakaId)
  }, [mangakaId, rosterTick])

  const statValues = useMemo(() => {
    const pendingAssistant = chapterRows.filter(c => c.status === 'InProduction').length
    const pendingComposite = chapterRows.filter(c => c.status === 'Ready').length
    return [
      { value: String(seriesList.length), trend: 'Hồ sơ trong workspace' },
      { value: String(chapterRows.length), trend: `${chapterRows.length} dòng trong bảng Chapter` },
      { value: String(pendingAssistant), trend: pendingAssistant > 0 ? 'Đang gửi Assistant' : 'Không có' },
      { value: String(pendingComposite), trend: pendingComposite > 0 ? 'Cần duyệt' : 'Không có' },
    ]
  }, [seriesList.length, chapterRows])

  const nextChapterNumSuggest = useMemo(() => {
    const rows = chapterRows.filter(c => String(c.series) === String(annotateSeries))
    const nums = rows.map(r => {
      const n = typeof r.num === 'number' ? r.num : parseInt(String(r.num), 10)
      return Number.isNaN(n) ? null : n
    }).filter(n => n !== null)
    if (!nums.length) return '1'
    return String(Math.max(...nums) + 1)
  }, [chapterRows, annotateSeries])

  const annotateChapterHint = useMemo(() => {
    const n = chapterRows.filter(c => c.series === annotateSeries).length
    const tail = n ? `${n} dòng trong bảng Chapter` : 'Chưa có dòng trong bảng Chapter'
    return `Gợi ý tiếp theo Ch. ${nextChapterNumSuggest} · ${tail}`
  }, [chapterRows, annotateSeries, nextChapterNumSuggest])

  const chapterRowsBySeries = useMemo(() => {
    const order = []
    const map = new Map()
    for (const row of chapterRows) {
      const key = row.series || 'Khác'
      if (!map.has(key)) {
        map.set(key, [])
        order.push(key)
      }
      map.get(key).push(row)
    }
    return order.map(series => ({ series, chapters: map.get(series) }))
  }, [chapterRows])

  const pipelineSeries = useMemo(
    () => seriesList.find(s => s.title === annotateSeries) ?? seriesList[0],
    [seriesList, annotateSeries],
  )

  // Memoize seriesOptions de ChapterAnnotator Select khong bi re-render loop do ref thay doi.
  const seriesOptions = useMemo(
    () => seriesList.map(s => ({ id: s.id, title: s.title })),
    [seriesList],
  )

  const pendingDeliverableSlim = useMemo(
    () => getPendingDeliverableForMangaka(),
    [deliverableTick, chapterRows],
  )
  const [pendingDeliverable, setPendingDeliverable] = useState(null)
  useEffect(() => {
    if (!pendingDeliverableSlim) {
      setPendingDeliverable(null)
      return undefined
    }
    let cancelled = false
    hydrateAssistantDeliverable(pendingDeliverableSlim).then(h => {
      if (!cancelled) setPendingDeliverable(h)
    })
    return () => { cancelled = true }
  }, [pendingDeliverableSlim])

  const pendingCompositeReview = useMemo(() => {
    const head = pendingDeliverable ?? pendingDeliverableSlim
    if (head) {
      return chapterRows.find(
        r => r.series === head.seriesTitle
          && String(r.num) === String(head.chapterNum),
      ) ?? {
        id: head.chapterId,
        series: head.seriesTitle,
        num: head.chapterNum,
        status: 'InProduction',
      }
    }
    return chapterRows.find(r => r.status === 'InProduction' || r.status === 'Ready')
  }, [chapterRows, pendingDeliverable, pendingDeliverableSlim])

  // Rankings section removed — no demo data fallback

  const ebApprovedMap = useMemo(() => readEbDebutApproved(), [ebApprovedTick, seriesList])

  function handleSendToAssistant({ chapter, pageIndex, pageUrl, pageName, notes, assistantId }) {
    if (!notes?.length) return
    const assistant = hiredAssistants.find(a => String(a.assistantId) === String(assistantId))
    console.log('[Mangaka] handleSendToAssistant →', {
      series: chapter.series,
      chapterId: chapter.id,
      chapterNum: chapter.num,
      pageIndex,
      assistantId,
      assistantName: assistant?.name,
      notesCount: notes.length,
      activePageApiId: chapter?.pages?.[pageIndex]?.apiPageId,
    })
    const submission = buildSubmissionFromMangakaPage({
      seriesTitle: chapter.series,
      chapterId: chapter.id,
      chapterNum: chapter.num,
      pageIndex,
      pageName,
      mangakaImageUrl: pageUrl,
      notes,
      mangakaName: user?.name ?? 'Mangaka',
      assistantId,
    })
    console.log('[Mangaka] submission built →', { id: submission.id, chapterId: submission.chapterId, notes: submission.notes.map(n => n.clientKey) })

    // Save to BE API first, then localStorage as fallback
    const mangakaId = user?.id ?? null
    const mangakaName = user?.name ?? 'Mangaka'

    submissionsService.create({
      mangakaId,
      assistantId,
      chapterId: submission.chapterId,
      seriesTitle: chapter.series,
      chapterNum: chapter.num,
      referenceImageUrl: pageUrl,
      notes: notes.map(n => n.text).join('; '),
    }).catch(err => {
      console.warn('[Mangaka] Failed to save submission to BE, using localStorage fallback:', err)
      void pushAssistantSubmission(submission)
    })

    // Also keep localStorage for offline support
    void pushAssistantSubmission(submission)
    console.log('[Mangaka] submission saved, chapterId used:', submission.chapterId)

    const activePage = chapter?.pages?.[pageIndex]
    // Save notes to API (mapping sang field backend: PageId, CreatedById, IssueType, WorkCategory, BoxX/Y/W/H, Description)
    if (user?.id && activePage?.apiPageId) {
      notes.forEach((note) => {
        const issueType = note.taskType === 'revision' ? 'Revision' : note.taskType === 'production' ? 'Production' : 'Revision'
        const workCategory = note.taskType === 'background' ? 'Background'
          : note.taskType === 'dialog' ? 'Dialog'
            : note.taskType === 'ink' ? 'Inking'
              : note.taskType === 'fx' ? 'Effects'
                : note.taskType === 'shading' ? 'Shading'
                  : 'Content'
        pageIssuesService.create({
          pageId: activePage.apiPageId,
          createdById: user.id,
          issueType,
          workCategory,
          boxX: Math.round(note.x),
          boxY: Math.round(note.y),
          boxWidth: Math.round(note.w),
          boxHeight: Math.round(note.h),
          description: note.text ?? note.content ?? '',
        }).then(r => console.log('[Mangaka] pageIssuesService.create OK →', { noteClientKey: note.clientKey, response: JSON.stringify(r?.data) }))
          .catch(e => console.error('[Mangaka] pageIssuesService.create FAILED →', { noteClientKey: note.clientKey, error: e?.response?.data ?? e.message }))
      })
    }

    setLocalChapterRows(prev =>
      prev.map(r =>
        r.series === chapter.series && String(r.num) === String(chapter.num)
          ? { ...r, status: 'InProduction', statusLabel: 'Chờ Assistant' }
          : r,
      ),
    )

    // Chapter vẫn giữ 'InProduction' khi Assistant đang làm — Assistant chỉ tạo PageIssue,
    // KHÔNG đổi status chapter. Status chỉ chuyển sang 'Ready' khi Mangaka bấm "Hoàn tất chapter".
    // (Enum BE: InProduction → Ready → Published; không có 'StudioWorking'/'SubmittedToEditor'.)

    toast.success(`Đã gửi ${submission.pageLabel} (${notes.length} ô) cho ${assistant?.label ?? 'Assistant'}.`)
  }

  function sendChapterToTantou({ series, chapter, pageIndex = 0, pageName, notes = [], imageOverride }) {
    if (!chapter?.series) return
    const ebOk = !!ebApprovedMap[series?.title ?? chapter.series]
    const pipeline = series?.needsFullDebutPipeline && !ebOk ? 'debut' : 'recurring'
    const sub = pushTantouSubmissionFromMangaka({
      seriesTitle: chapter.series,
      seriesMeta: {
        genres: series?.genres ?? [],
        formatLabel: series?.formatLabel ?? 'Manga',
        authorName: user?.name ?? 'Mangaka',
        qualityScore: 70,
        popularityScore: 62,
        needsFullDebutPipeline: series?.needsFullDebutPipeline,
      },
      chapterId: chapter.id,
      chapterNum: chapter.num,
      pageIndex,
      pageName,
      mangakaImageUrl: imageOverride,
      mangakaNotes: notes,
      mangakaName: user?.name ?? 'Mangaka',
      pipeline,
    })
    setLocalChapterRows(prev =>
      prev.map(r =>
        r.series === chapter.series && String(r.num) === String(chapter.num)
          ? { ...r, status: 'Ready', statusLabel: `Chờ ${LABEL_TANTOU_EDITOR}` }
          : r,
      ),
    )

    // Cap nhat trang thai chapter tren server: InProduction -> Ready (theo enum BE ChapterService)
    const serverChapterId = Number(chapter.id)
    if (Number.isFinite(serverChapterId)) {
      updateChapterStatus.mutate(
        { id: serverChapterId, status: 'Ready' },
        {
          onError: (err) =>
            toast.error(`Cập nhật trạng thái chapter thất bại: ${err?.response?.data?.message ?? err.message}`),
        },
      )
    }

    // Gan Tantou Editor cho series tren server
    const serverSeriesId = Number(series?.id)
    const tantouId = series?.tantouEditorId ?? null
    if (Number.isFinite(serverSeriesId) && Number.isFinite(tantouId)) {
      assignTantouEditor.mutate(
        { seriesId: serverSeriesId, tantouEditorId: tantouId },
        {
          onError: (err) =>
            toast.error(`Gán Tantou Editor thất bại: ${err?.response?.data?.message ?? err.message}`),
        },
      )
    }

    toast.success(`Đã gửi ${sub.pageLabel} sang ${LABEL_TANTOU_EDITOR}.`)
    setTantouSendReady(null)
  }

  function handleSendToTantou({ chapter, pageIndex, pageUrl, pageName, notes }) {
    const series = seriesList.find(s => s.title === chapter.series)
    sendChapterToTantou({ series, chapter, pageIndex, pageName, notes, imageOverride: pageUrl })
  }

  function handleSendTantouFromReady() {
    if (!tantouSendReady) return
    const { deliverable, chapter, notes } = tantouSendReady
    const series = seriesList.find(s => s.title === chapter.series)
    sendChapterToTantou({
      series,
      chapter,
      pageIndex: deliverable.pageIndex ?? 0,
      pageName: deliverable.pageLabel,
      notes,
      imageOverride: deliverable.compositeDataUrl || deliverable.mangakaImageUrl,
    })
  }

  function handleCompositeDecision(decision) {
    if (!pendingCompositeReview) return
    const deliverableForDecision = pendingDeliverable ?? pendingDeliverableSlim
    if (deliverableForDecision) {
      if (decision === 'approve') {
        const notes = deliverableForDecision.submissionId
          ? (getAssistantSubmission(deliverableForDecision.submissionId)?.notes ?? [])
          : []
        setTantouSendReady({
          deliverable: { ...deliverableForDecision },
          chapter: { ...pendingCompositeReview },
          notes,
        })
      }
      updateDeliverableStatus(
        deliverableForDecision.id,
        decision === 'approve' ? 'approved' : 'revision_requested',
      )
      setDeliverableTick(t => t + 1)
    }
    setLocalChapterRows(prev => prev.map(r => {
      if (r.id !== pendingCompositeReview.id) return r
      if (decision === 'approve') {
        // Mangaka đã duyệt bản tổng hợp → chapter sẵn sàng nộp cho Tantou (Ready)
        return { ...r, status: 'Ready', statusLabel: 'Đã duyệt bản tổng hợp' }
      }
      // Yêu cầu sửa → đẩy Assistant/ Mangaka về lại giai đoạn InProduction
      return { ...r, status: 'InProduction', statusLabel: 'Yêu cầu chỉnh sửa' }
    }))
  }

  function acceptAssistantChapter(chapter) {
    if (!chapter?.id) return
    // Gọi API update status → Ready (theo enum BE ChapterService: InProduction → Ready).
    // Assistant không được đổi status chapter; chỉ Mangaka xác nhận thì mới Ready.
    updateChapterStatus.mutate(
      { id: chapter.id, status: 'Ready' },
      {
        onSuccess: () => toast.success('Đã chấp nhận, chuyển cho Tantou Editor.'),
        onError: (err) => toast.error(`Lỗi: ${err?.message ?? 'không xác định'}`),
      },
    )
  }

  function openRejectDialog(chapter) {
    if (!chapter?.id) return
    setRejectChapterId(chapter.id)
    setRejectReason('')
    setRejectDialogOpen(true)
  }

  function confirmReject() {
    if (!rejectChapterId) return
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.')
      return
    }
    // Update status → InProduction; truyền reason qua endpoint riêng nếu BE hỗ trợ (Note/Comment).
    updateChapterStatus.mutate(
      { id: rejectChapterId, status: 'InProduction', mangakaRejectionReason: rejectReason.trim() },
      {
        onSuccess: () => {
          toast.success('Đã từ chối, Assistant sẽ sửa lại.')
          setRejectDialogOpen(false)
          setRejectChapterId(null)
          setRejectReason('')
        },
        onError: (err) => toast.error(`Lỗi: ${err?.message ?? 'không xác định'}`),
      },
    )
  }

  const tantouRevisions = useMemo(
    () => listTantouSubmissions().filter(s => s.status === 'revision'),
    [tantouTick],
  )

  useEffect(() => {
    const onSync = () => setDeliverableTick(t => t + 1)
    migrateAssistantStorage().finally(onSync)
    window.addEventListener('storage', onSync)
    window.addEventListener('mk-assistant-storage', onSync)
    return () => {
      window.removeEventListener('storage', onSync)
      window.removeEventListener('mk-assistant-storage', onSync)
    }
  }, [])

  useEffect(() => {
    const onRoster = () => setRosterTick(t => t + 1)
    window.addEventListener('storage', onRoster)
    window.addEventListener('mk-assistant-roster-update', onRoster)
    return () => {
      window.removeEventListener('storage', onRoster)
      window.removeEventListener('mk-assistant-roster-update', onRoster)
    }
  }, [])

  useEffect(() => {
    const onTantou = () => setTantouTick(t => t + 1)
    window.addEventListener('mk-tantou-storage', onTantou)
    return () => window.removeEventListener('mk-tantou-storage', onTantou)
  }, [])

  const workflowSteps = useMemo(() => {
    if (!pipelineSeries) return PIPELINE_DEBUT_STEPS
    return pipelineSeries.needsFullDebutPipeline ? PIPELINE_DEBUT_STEPS : PIPELINE_RECURRING_STEPS
  }, [pipelineSeries])

  useEffect(() => {
    function bumpEbApproved() { setEbApprovedTick(t => t + 1) }
    window.addEventListener('mk-eb-approved-update', bumpEbApproved)
    window.addEventListener('storage', bumpEbApproved)
    return () => {
      window.removeEventListener('mk-eb-approved-update', bumpEbApproved)
      window.removeEventListener('storage', bumpEbApproved)
    }
  }, [])

  useEffect(() => {
    setAnnotatorChapterNum(nextChapterNumSuggest)
  }, [annotateSeries, nextChapterNumSuggest])

  useEffect(() => {
    if (seriesList.length === 0) {
      // Đợi API load — không reset annotateSeries ở đây để tránh ghi đè nav state.
      return
    }
    if (!annotateSeries) {
      setAnnotateSeries(seriesList[0].title)
      return
    }
    // Nếu user vừa navigate từ series detail với seriesId, KHÔNG fallback kể cả khi title
    // chưa khớp (có thể là do chuỗi title server normalize khác local). Ưu tiên nav state.
    if (locationState?.seriesId || (typeof locationState?.series === 'string' && locationState.series.trim())) {
      return
    }
    if (!seriesList.some(s => s.title === annotateSeries)) {
      setAnnotateSeries(seriesList[0].title)
    }
  }, [seriesList, annotateSeries, locationState])

  useEffect(() => {
    const marksBySeries = {}
    annotatorChapters.forEach(ch => {
      let c = 0
      ch.pages.forEach((_, pi) => {
        c += (annotatorNotes[`${ch.id}-${pi}`]?.length ?? 0)
      })
      marksBySeries[ch.series] = (marksBySeries[ch.series] ?? 0) + c
    })
    setLocalSeriesList(prev => {
      let changed = false
      const next = prev.map(s => {
        const nextMarks = marksBySeries[s.title]
        if (nextMarks === undefined) return s
        if (s.marks !== nextMarks) {
          changed = true
          return { ...s, marks: nextMarks }
        }
        return s
      })
      return changed ? next : prev
    })
  }, [annotatorChapters, annotatorNotes])



  function handleUploadProgress(series, pct) {
    const key = series.trim()
    if (!key) return
    if (pct === 0 || pct === undefined) {
      setUploadPctBySeries(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }
    setUploadPctBySeries(prev => ({ ...prev, [key]: pct }))
  }

  async function handleUploadComplete(payload) {
    const {
      series: titleRaw, num, pages, createdAt, chapterLocalId, isNewChapter,
      title: chapterTitle, deadline: chapterDeadline,
      annotatorChapters: nextAnnotatorChapters,
    } = payload
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : titleRaw
    if (!title) return

    const rowId = chapterLocalId || `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const displayNum = typeof num === 'number' && Number.isFinite(num) ? num : num
    const dateStr = createdAt ?? new Date().toLocaleDateString('vi-VN')

    // Lay mangakaId tu session de goi API
    const mangakaId = user?.id ?? null
    // Lookup real server series ID by title from the API (local IDs can collide with server IDs)
    let serverSeriesId = null
    let allSeriesTitles = []
    if (mangakaId) {
      try {
        const sr = await seriesService.getByTitle(title, mangakaId)
        const list = Array.isArray(sr?.data) ? sr.data : []
        const found = list.find(s => s.title === title)
        allSeriesTitles = list.map(s => ({ id: s.seriesid, title: s.title }))
        if (found?.seriesid) serverSeriesId = found.seriesid
        console.log('[handleUploadComplete] series lookup →', { title, serverSeriesId, allTitles: allSeriesTitles })
      } catch (e) {
        console.warn('[handleUploadComplete] series lookup failed:', e)
      }
    }

    const nextChapterRows = (() => {
      const idx = chapterRows.findIndex(r => r.id === rowId)
      if (idx >= 0) {
        return chapterRows.map((r, i) => (i === idx ? { ...r, pages, date: dateStr } : r))
      }
      return [{
        id: rowId, series: title, num: displayNum, type: 'PNG', pages,
        status: 'InProduction', date: dateStr,
      }, ...chapterRows]
    })()

    setLocalChapterRows(nextChapterRows)

    setLocalSeriesList(prev => {
      const idx = prev.findIndex(s => s.title === title)
      const bump = Math.min(22, Math.max(10, Math.round((pages ?? 18) / 5)))
      if (idx === -1) {
        const maxId = prev.reduce((m, s) => Math.max(m, s.id), 0)
        const created = buildSeriesFromUploadTitle(title, {
          id: maxId + 1,
          authorName: user?.name,
          colorIndex: maxId,
        })
        return [{ ...created, chapters: 1, progress: Math.min(100, bump + 18) }, ...prev]
      }
      return prev.map((s, i) => {
        if (i !== idx) return s
        const nextCount = isNewChapter ? (s.chapters ?? 0) + 1 : (s.chapters ?? 0)
        return {
          ...s,
          chapters: nextCount,
          progress: Math.min(99, (s.progress ?? 0) + (isNewChapter ? bump : Math.min(8, bump))),
          updated: 'Vừa upload',
          statusLabel: s.status === 'InProduction' ? s.statusLabel : 'Đã có upload',
          ...(s.status !== 'InProduction' && s.status !== 'Ready' ? { status: 'InProduction' } : {}),
        }
      })
    })

    // Capture current snapshot for use inside async callbacks (avoids stale closure)
    const snapshotForCallback = {
      chapterRows: nextChapterRows,
      annotatorChapters: nextAnnotatorChapters,
    }

    console.log('[DEBUG] handleUploadComplete →', {
      title, mangakaId, serverSeriesId,
      seriesListIds: seriesList.map(s => ({ id: s.id, title: s.title })),
      rowId,
      displayNum,
      pageCount: nextAnnotatorChapters.find(c => c.id === rowId)?.pages?.length,
    })
    if (mangakaId && serverSeriesId) {
      // Idempotent check: ưu tiên check trực tiếp từ API chapters (filter theo series)
      // Idempotent check: check theo seriesid + chapternumber
      // API format: { chapterid, seriesid, chapternumber, title, ... }
      const apiChapter = apiChapters.find(ch =>
        Number(ch.seriesid) === Number(serverSeriesId)
        && Number(ch.chapternumber) === Number(displayNum)
      )
      console.log('[DEBUG] apiChapter found:', apiChapter ? `id=${apiChapter.chapterid}` : 'undefined')
      const existingRow = chapterRows.find(r =>
        String(r.series) === String(title)
        && Number(r.num) === Number(displayNum)
      )
      // Ưu tiên API chapter id, fallback sang local chapterid
      const existingChapterId = apiChapter?.id ?? apiChapter?.chapterid ?? existingRow?.chapterid ?? null

      // Helper: patch state + flush workspace sau khi co real chapterid.
      const applyRealChapterId = (realChapterId, opts = {}) => {
        console.log('[applyRealChapterId] called with:', { realChapterId, opts, rowId })
        if (realChapterId == null) return
        const snap = snapshotForCallback
        setLocalChapterRows(prev => prev.map(r =>
          String(r.id) === String(rowId) || String(r.id) === String(realChapterId)
            ? { ...r, id: realChapterId, apiChapterId: realChapterId, chapterid: realChapterId }
            : r
        ))
        setAnnotatorChapters(prev => {
          const updated = prev.map(ch =>
            String(ch.id) === String(rowId)
              ? { ...ch, id: realChapterId }
              : ch
          )
          return updated
        })
        if (String(annotatorActiveChapterId) === String(rowId)) {
          setAnnotatorActiveChapterId(realChapterId)
        }
        // Upload pages (neu co) vao realChapterId — dùng snapshot để tránh stale
        if (!opts.skipPageUpload) {
          // Tìm chapter source - có thể là local rowId hoặc realChapterId
          const srcChapter = snap.annotatorChapters.find(c =>
            String(c.id) === String(rowId) || String(c.id) === String(realChapterId)
          )
          console.log('[applyRealChapterId] srcChapter found:', srcChapter?.id, 'pages:', srcChapter?.pages?.length)
          uploadPagesToServer({
            srcChapter, // truyền trực tiếp chapter source thay vì tìm lại
            realChapterId,
          })
        }
      }

      // Nếu local state đã có chapterid → dùng trực tiếp (idempotent)
      if (existingChapterId != null) {
        console.log('[handleUploadComplete] idempotent skip POST /Chapters → dùng existing chapterid:', existingChapterId)
        // Update row hiện tại với chapterid từ existing row
        setLocalChapterRows(prev => prev.map(r =>
          String(r.id) === String(rowId)
            ? { ...r, id: existingChapterId, chapterid: existingChapterId, apiChapterId: existingChapterId }
            : r
        ))
        toast.success(`Ch. ${displayNum} đã có trên server — upload trang vào chapter cũ.`)
        applyRealChapterId(existingChapterId)
      } else {
        // Kiểm tra với API xem chapter đã tồn tại chưa (phòng trường hợp local state bị reset)
        qc.invalidateQueries({ queryKey: ['chapters', { seriesId: serverSeriesId }] })
          .then(() => {
            // Sau khi refetch, kiểm tra lại
            const serverChapters = qc.getQueryData(['chapters', { seriesId: serverSeriesId }]) ?? []
            const serverChapter = serverChapters.find(ch =>
              Number(ch.chapterNumber ?? ch.chapternumber ?? ch.num) === Number(displayNum)
            )
            if (serverChapter?.id) {
              console.log('[handleUploadComplete] tìm thấy chapter trên server (sau refetch):', serverChapter.id)
              // Update row với chapterid rồi apply
              setLocalChapterRows(prev => prev.map(r =>
                String(r.series) === String(title) && Number(r.num) === Number(displayNum)
                  ? { ...r, chapterid: serverChapter.id, id: serverChapter.id }
                  : r
              ))
              applyRealChapterId(serverChapter.id, { skipPageUpload: true }) // skip vì sẽ upload ở dưới
              // Upload pages sau khi state đã update
              setTimeout(() => {
                uploadPagesToServer({
                  srcChapter: snapshotForCallback.annotatorChapters.find(c => c.id === rowId),
                  realChapterId: serverChapter.id,
                })
              }, 50)
              return // kết thúc, không tạo chapter mới
            } else {
              // Thực sự cần tạo chapter mới
              const chData = {
                seriesid: serverSeriesId,
                chapternumber: Number(displayNum),
                title: String(chapterTitle ?? `Chapter ${displayNum}`).trim(),
                deadline: chapterDeadline
                  ? new Date(chapterDeadline).toISOString()
                  : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              }
              console.log('[handleUploadComplete] GỌI API createChapter:', chData)
              createChapter.mutate(chData, {
                onSuccess: (createdChapter) => {
                  // Backend tra ve wrapped response: {succeeded, message, errors, data, statusCode}
                  // data that that nam trong createdChapter.data.data.*
                  const responseData = createdChapter?.data
                  const succeeded = responseData?.succeeded ?? true
                  if (succeeded === false) {
                    toast.error(responseData?.message ?? `Không tạo được Ch. ${displayNum} trên server.`)
                    return
                  }
                  toast.success(`Đã tạo Ch. ${displayNum} trên server!`)

                  // Lay real chapterId tu backend (ho tro ca wrapped va unwrapped)
                  const payloadData = responseData?.data ?? responseData
                  const realChapterId =
                    payloadData?.chapterid
                    ?? payloadData?.Chapterid
                    ?? payloadData?.chapterId
                    ?? payloadData?.id

                  if (realChapterId == null) {
                    toast.error('Server không trả về chapter ID — không thể upload trang.')
                    console.error('[Mangaka] createChapter response thiếu ID:', responseData)
                    return
                  }

                  applyRealChapterId(realChapterId)
                },
                onError: (err) => toast.error(err?.response?.data?.message ?? `Không tạo được Ch. ${displayNum} trên server.`),
              })
            }
          })
      }
    }
  }

  // Upload tung trang (pages) cua 1 chapter len server, gan vao realChapterId.
  // Dung chung cho ca nhanh createChapter thanh cong va nhanh idempotent (existing chapterid).
  function uploadPagesToServer({ srcChapter, realChapterId }) {
    if (!srcChapter) {
      console.warn('[uploadPagesToServer] srcChapter is null')
      return
    }
    console.log('[uploadPagesToServer] srcChapter:', srcChapter?.id, 'pages:', srcChapter?.pages?.length)
    if (!srcChapter?.pages?.length) {
      console.warn('[uploadPagesToServer] no pages found for chapter', rowId)
      return
    }
    srcChapter.pages.forEach((pg, idx) => {
      console.log('[uploadPagesToServer] page', idx, 'url:', pg?.url ? 'present' : 'MISSING')
      if (!pg?.url) return
      const file = dataUrlToFile(pg.url, pg.name ?? `page_${idx + 1}`)
      if (!file) return
      const fd = new FormData()
      fd.append('chapterid', String(realChapterId))
      fd.append('pagenumber', String(idx + 1))
      fd.append('pageFile', file)
      console.log('[Mangaka] POST /Pages trang', idx + 1, 'chapterId:', realChapterId)
      createPage.mutate(fd, {
        onSuccess: (res) => {
          console.log('[Mangaka] POST /Pages OK trang', idx + 1, '→ response:', JSON.stringify(res?.data))
          const pageResponseData = res?.data
          const pageSucceeded = pageResponseData?.succeeded ?? true
          if (pageSucceeded === false) {
            toast.error(`Upload trang ${idx + 1} thất bại: ${pageResponseData?.message ?? 'server trả về lỗi'}`)
            return
          }
          const pagePayload = pageResponseData?.data ?? pageResponseData
          const pageId =
            pageResponseData?.id
            ?? pagePayload?.pageid
            ?? pagePayload?.Pageid
            ?? pagePayload?.pageId
            ?? pagePayload?.id
          if (pageId) {
            toast.success(`Đã upload trang ${idx + 1} (ID: ${pageId})`)
            setAnnotatorChapters(prev => prev.map(ch => {
              if (String(ch.id) !== String(realChapterId)) return ch
              return {
                ...ch,
                pages: ch.pages.map((p, pi) =>
                  pi === idx ? { ...p, apiPageId: pageId } : p
                ),
              }
            }))
          } else {
            console.warn('[Mangaka] page response thiếu pageId:', pageResponseData)
          }
        },
        onError: (err) =>
          toast.error(`Upload trang ${idx + 1} thất bại: ${err?.response?.data?.message ?? err.message}`),
      })
    })
  }

  useEffect(() => {
    if (!addSeriesOpen) return
    function onKey(e) { if (e.key === 'Escape') setAddSeriesOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addSeriesOpen])

  function openAddSeriesModal() { setEditingSeries(null); setAddSeriesOpen(true) }
  function openEditSeriesModal(series) { setEditingSeries(series); setAddSeriesOpen(true) }
  function closeAddSeriesModal() { setAddSeriesOpen(false); setEditingSeries(null) }

  function confirmUpdateSeries(form) {
    if (!editingSeries) return
    const oldTitle = editingSeries.title
    const updated = applySeriesFormUpdate(
      seriesList.find(s => s.id === editingSeries.id) ?? editingSeries,
      form,
    )
    const newTitle = updated.title

    // Update trên server — multipart theo backend (PUT /api/Series/{id})
    const fd = new FormData()
    fd.append('title', newTitle)
    fd.append('synopsis', String(updated.synopsis ?? ''))
    fd.append('agerating', String(updated.contentRating ?? 'G'))
    // Gui genreIds/tagIds (numbers tu modal props), khong phai string names
    if (Array.isArray(form.genreIds)) form.genreIds.forEach(g => fd.append('genreIds', String(g)))
    if (Array.isArray(form.tagIds)) form.tagIds.forEach(t => fd.append('tagIds', String(t)))

    updateSeries.mutate(
      { id: editingSeries.id, data: fd },
      {
        onSuccess: () => toast.success('Đã cập nhật series trên server!'),
        onError: (err) => toast.error(err?.response?.data?.message ?? 'Không cập nhật được series trên server.'),
      },
    )

    // Update local state
    setLocalSeriesList(prev => prev.map(s => (s.id === editingSeries.id ? updated : s)))

    if (oldTitle !== newTitle) {
      setLocalChapterRows(prev => prev.map(c => (c.series === oldTitle ? { ...c, series: newTitle } : c)))
      setAnnotatorChapters(prev => prev.map(ch => (ch.series === oldTitle ? { ...ch, series: newTitle } : ch)))
      if (annotateSeries === oldTitle) setAnnotateSeries(newTitle)
    }

    closeAddSeriesModal()
    navigate(seriesPath(updated))
  }

  function confirmAddSeries(form) {
    const maxId = seriesList.reduce((m, s) => Math.max(m, s.id), 0)
    const newSeries = buildSeriesFromForm(form, {
      id: maxId + 1,
      authorName: user?.fullname ?? user?.name,
      authorId: user?.id ?? null,
    })

    // Gửi multipart tạo series trên server (PUT /api/Series)
    if (user?.id) {
      const fd = new FormData()
      fd.append('title', newSeries.title)
      fd.append('synopsis', String(newSeries.synopsis ?? ''))
      fd.append('mangakaid', String(user.id))
      fd.append('tantoueditorid', String(user.tantouEditorId ?? 1))
      fd.append('agerating', String(newSeries.contentRating ?? 'G'))
      // Gui genreIds/tagIds (numbers tu modal), khong phai string names
      if (Array.isArray(form.genreIds)) {
        form.genreIds.forEach(g => fd.append('genreIds', String(g)))
      }
      if (Array.isArray(form.tagIds)) {
        form.tagIds.forEach(t => fd.append('tagIds', String(t)))
      }
      // File bat buoc - backend tra ve BadRequest neu thieu
      const proposalFile = form.proposalFile instanceof File ? form.proposalFile : null
      const coverFile = form.coverImage instanceof File ? form.coverImage : null
      if (proposalFile) fd.append('proposalFile', proposalFile)
      if (coverFile) fd.append('coverImage', coverFile)
      // Neu chua co file, gui request de nhan loi tu server (hien toast thong bao)
      sendCreate(fd, newSeries)
      return
    }
  }

  function sendCreate(fd, newSeries) {
    // Optimistic: them vao list ngay de tranh race
    setLocalSeriesList(prev => {
      const exists = prev.some(s => s.title === newSeries.title)
      return exists ? prev : [newSeries, ...prev]
    })
    setAnnotateSeries(newSeries.title)
    closeAddSeriesModal()

    createSeries.mutate(fd, {
      onSuccess: (res) => {
        const serverId = res?.data?.data?.Id ?? res?.data?.Id ?? res?.data?.id
        const updatedSeries = serverId ? { ...newSeries, id: serverId, seriesid: serverId } : newSeries
        if (serverId) {
          // Sync server ID
          setLocalSeriesList(prev => prev.map(s => s.title === newSeries.title ? updatedSeries : s))
        }
        toast.success('Đã tạo series trên server!')
        navigate(seriesPath(updatedSeries), { state: { tab: 'annotate', series: updatedSeries.title } })
      },
      onError: (err) => {
        const body = err?.response?.data
        const msg = typeof body === 'string' ? body : body?.message ?? body?.title
        toast.error(msg || 'Không tạo được series trên server.')
        // Rollback optimistic add
        setLocalSeriesList(prev => prev.filter(s => s.title !== newSeries.title))
      },
    })
  }

  const existingSeriesTitles = useMemo(() => seriesList.map(s => s.title), [seriesList])

  function completeDebutPipeline(seriesId) {
    const target = seriesList.find(x => x.id === seriesId)
    if (target?.title) removeEbDebutApproval(target.title)
    setLocalSeriesList(prev => prev.map(s => (
      s.id === seriesId
        ? {
          ...s,
          needsFullDebutPipeline: false,
          statusLabel: s.status === 'InProduction' ? `Luồng ngắn (chỉ ${LABEL_TANTOU_EDITOR})` : s.statusLabel,
          updated: 'Đã chuyển sang luồng lần 2',
        }
        : s
    )))
    // Update on API — backend PUT /api/Series/{id} requires multipart/form-data
    const updatedSeries = localSeriesList.find(s => s.id === seriesId)
    if (updatedSeries) {
      const fd = new FormData()
      fd.append('title', updatedSeries.title ?? '')
      fd.append('synopsis', String(updatedSeries.synopsis ?? ''))
      fd.append('agerating', String(updatedSeries.contentRating ?? 'all'))
      if (Array.isArray(updatedSeries.genres)) {
        updatedSeries.genres.forEach(g => fd.append('genreIds', String(g)))
      }
      if (Array.isArray(updatedSeries.tags)) {
        updatedSeries.tags.forEach(t => fd.append('tagIds', String(t)))
      }
      updateSeries.mutate({ id: seriesId, data: fd })
    }
  }

  function deleteSeriesById(seriesId) {
    const target = seriesList.find(x => x.id === seriesId)
    if (!target) return
    const title = target.title
    const ok = window.confirm(
      `Xóa series "${title}"?\n\nCác chapter của series này sẽ bị gỡ. Thao tác không hoàn tác.`,
    )
    if (!ok) return

    // Delete from API
    deleteSeries.mutate(seriesId, {
      onSuccess: () => toast.success('Đã xóa series trên server!'),
      onError: () => toast.error('Không xóa được series trên server.'),
    })

    removeEbDebutApproval(title)

    const chaptersToDrop = annotatorChapters.filter(ch => ch.series === title)
    chaptersToDrop.forEach((ch) => {
      ch.pages?.forEach((p) => {
        if (p?.url?.startsWith('blob:')) URL.revokeObjectURL(p.url)
      })
    })

    const nextAnnotator = annotatorChapters.filter(ch => ch.series !== title)
    setAnnotatorChapters(nextAnnotator)
    setAnnotatorNotes((prev) => {
      const next = { ...prev }
      chaptersToDrop.forEach((ch) => {
        Object.keys(next).forEach((k) => {
          if (k.startsWith(`${ch.id}-`)) delete next[k]
        })
      })
      return next
    })
    setAnnotatorActiveChapterId((prev) => {
      if (nextAnnotator.some(c => c.id === prev)) return prev
      return nextAnnotator[0]?.id ?? null
    })
    setAnnotatorPageIndex(0)

    const remainingSeries = localSeriesList.filter(s => s.id !== seriesId)
    setLocalSeriesList(remainingSeries)
    setLocalChapterRows(prev => prev.filter(c => c.series !== title))
    setUploadPctBySeries((prev) => {
      const next = { ...prev }
      delete next[title]
      return next
    })
    setAnnotateSeries((cur) => (cur !== title ? cur : remainingSeries[0]?.title ?? ''))
  }

  // FIX VÒNG LẶP VÔ HẠN ("Maximum update depth exceeded"):
  // Trước đây effect này phụ thuộc trực tiếp vào `seriesList` (luôn có identity mới mỗi render
  // trước khi useMemo ở trên) và LUÔN LUÔN gọi setLocationKey ở cuối — không có điều kiện chặn.
  // → render → seriesList mới → effect chạy → setLocationKey → re-render → lặp vô hạn.
  //
  // Cách sửa: chỉ xử lý MỘT LẦN cho mỗi object location.state cụ thể (dùng ref so sánh identity),
  // và không còn cần setLocationKey để "force re-render" — state thay đổi (setTab/setAnnotateSeries...)
  // đã tự kích hoạt re-render đúng cách rồi.
  const processedNavStateRef = useRef(null)
  useEffect(() => {
    const st = location.state
    if (!st || typeof st !== 'object') return
    if (processedNavStateRef.current === st) return
    processedNavStateRef.current = st

    if (st.tab === 'chapters' || st.tab === 'annotate' || st.tab === 'series' || st.tab === 'assistants') setTab(st.tab)
    // Prefer seriesId (resolved via seriesList) over raw title string — avoids race when
    // user navigates before seriesList has loaded from API.
    const resolvedSeries = resolveSeriesFromNavState(st, seriesList)
    if (resolvedSeries) setAnnotateSeries(resolvedSeries)
    if (typeof st.chapterId === 'string' && st.chapterId) {
      setAnnotatorActiveChapterId(st.chapterId)
      setAnnotatorPageIndex(0)
    }
  }, [location.state, seriesList])

  function openAnnotate(seriesTitle, chapterLocalId) {
    setAnnotateSeries(seriesTitle)
    setTab('annotate')
    if (chapterLocalId) {
      setAnnotatorActiveChapterId(chapterLocalId)
      setAnnotatorPageIndex(0)
    }
  }

  function handleLogout() {
    authLogout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-rose-950 to-zinc-950"
        label="Mangaka Workspace"
        title={`Xin chào${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description={`Tạo hồ sơ giới thiệu & nộp bản thảo lên ${LABEL_EDITOR_BOARD} · đánh dấu vùng giao việc cho Assistant · duyệt bản tổng hợp ngay trên trang.`}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={openAddSeriesModal} className="bg-white text-zinc-900 hover:bg-zinc-100">
            <Plus className="size-4" />
            Đăng ký series
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={seriesList.length === 0}
            onClick={() => seriesList[0] && openAnnotate(seriesList[0].title)}
          >
            <Upload className="size-4" />
            Upload chapter
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setTab('assistants')}
          >
            <UserPlus className="size-4" />
            Thuê Assistant
          </Button>
        </div>
      </WorkspaceHero>

      <main className="page-container flex-1 py-8">
        {tab !== 'annotate' ? (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_DEFS.map((def, i) => (
              <StatCard key={def.label} def={def} value={statValues[i].value} trend={statValues[i].trend} />
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-5 h-auto flex-wrap">
                {TAB_ITEMS.map(t => {
                  const Icon = t.icon
                  return (
                    <TabsTrigger key={t.id} value={t.id} className="gap-2">
                      <Icon className="size-4" />
                      {t.label}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              <TabsContent value="series" className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Series của tôi</h2>
                    <p className="text-sm text-muted-foreground">Quản lý draft và luồng duyệt</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={openAddSeriesModal}>
                    <Plus className="size-4" />
                    Đăng ký series
                  </Button>
                </div>

                {seriesList.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Chưa có series nào — bấm "Đăng ký series" để bắt đầu.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {seriesList.map(s => (
                      <SeriesCard
                        key={s.id}
                        series={s}
                        ebApproved={!!ebApprovedMap[s.title]}
                        uploadPct={uploadPctBySeries[s.title] ?? 0}
                        onOpenAnnotate={() => openAnnotate(s.title)}
                        onOpenEdit={() => openEditSeriesModal(s)}
                        onDelete={() => deleteSeriesById(s.id)}
                        onCompleteDebut={() => completeDebutPipeline(s.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chapters" className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Chapter đã upload</h2>
                  <p className="text-sm text-muted-foreground">
                    Bấm tên truyện hoặc chapter để xem trang chi tiết.
                  </p>
                </div>

                {chapterRowsBySeries.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Chưa có chapter — upload ở tab Upload & Ghi chú.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {chapterRowsBySeries.map(({ series, chapters: groupChapters }) => {
                      const seriesMeta = seriesList.find(x => x.title === series)
                      const slug = seriesMeta?.slug ?? slugifySeriesTitle(series)
                      return (
                        <Card key={series} className="overflow-hidden p-0">
                          <Link
                            to={`/mangaka/series/${slug}`}
                            className="flex items-center gap-2 border-b bg-muted/30 px-5 py-3 transition-colors hover:bg-muted/50"
                          >
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: seriesMeta?.color ?? '#999' }}
                            />
                            <strong className="text-sm">{series}</strong>
                            {seriesMeta?.needsFullDebutPipeline ? (
                              <Sparkles className="size-3.5 text-amber-500" />
                            ) : null}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {groupChapters.length} chapter
                            </span>
                            <ChevronRight className="size-3.5 text-muted-foreground" />
                          </Link>
                          <div className="divide-y">
                            {groupChapters.map(c => {
                              const annot = resolveAnnotatorChapter(c, annotatorChapters)
                              const thumbUrl = annot?.pages?.find(p => p?.url)?.url
                              const statusBadge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft
                              return (
                                <Link
                                  key={c.id}
                                  to={`/mangaka/series/${slug}/chapter/${c.id}`}
                                  className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/30"
                                >
                                  {thumbUrl ? (
                                    <span className="manga-page manga-page--thumb-sm shrink-0 overflow-hidden rounded">
                                      <img src={thumbUrl} alt="" className="manga-page__media" />
                                    </span>
                                  ) : (
                                    <span className="flex size-[52px] shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                                      Ch.{c.num}
                                    </span>
                                  )}
                                  <span className="font-medium">Ch. {c.num}</span>
                                  <Badge variant="outline" className="text-[10px]">{c.type}</Badge>
                                  <span className="text-xs text-muted-foreground">{c.pages} trang</span>
                                  <Badge className={statusBadge.className} variant="secondary">
                                    {statusBadge.label}
                                  </Badge>
                                  <span className="ml-auto text-xs text-muted-foreground">{c.date}</span>
                                  <ChevronRight className="size-3.5 text-muted-foreground" />
                                </Link>
                              )
                            })}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assistants">
                <MangakaAssistants mangakaId={mangakaId} mangakaName={mangakaName} />
              </TabsContent>

              <TabsContent value="annotate">
                <ChapterAnnotator
                  key="annotate-tab"
                  selectedSeriesTitle={annotateSeries}
                  selectedSeriesId={annotateSeriesId}
                  onSelectedSeriesTitleChange={setAnnotateSeries}
                  seriesOptions={seriesOptions}
                  chapterNum={annotatorChapterNum}
                  onChapterNumChange={setAnnotatorChapterNum}
                  chapterNumHint={annotateChapterHint}
                  chapters={annotatorChapters}
                  setChapters={setAnnotatorChapters}
                  activeChapterId={annotatorActiveChapterId}
                  setActiveChapterId={setAnnotatorActiveChapterId}
                  pageIndex={annotatorPageIndex}
                  setPageIndex={setAnnotatorPageIndex}
                  notes={annotatorNotes}
                  setNotes={setAnnotatorNotes}
                  serverChapterId={annotatorServerChapterId}
                  hiredAssistants={hiredAssistants}
                  onOpenAssistantsTab={() => setTab('assistants')}
                  onUploadProgress={handleUploadProgress}
                  onUploadComplete={handleUploadComplete}
                  onSendToAssistant={handleSendToAssistant}
                  onSendToTantou={handleSendToTantou}
                />
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Lịch sử chapter</h2>
                  <p className="text-sm text-muted-foreground">
                    Các chapter đã gửi Tantou, đã duyệt, hoặc đã xuất bản.
                  </p>
                </div>
                {historyChapters.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <History className="size-10 mx-auto mb-3 opacity-40" />
                      <p>Chưa có chapter nào trong lịch sử.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {historyChapters.map((c) => {
                      const chId = c.id ?? c.chapterId
                      const num = c.chapterNumber ?? c.num ?? '?'
                      const title = c.title ?? c.chapterTitle ?? `Ch. ${num}`
                      const status = String(c.status ?? '').toLowerCase()
                      const series = apiSeries.find(s => s.id === (c.seriesId ?? c.series_id))
                      const updated = c.updatedAt ?? c.UpdatedAt
                      return (
                        <Card key={chId} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                              {series?.title ?? '—'} · Ch. {num}
                            </CardTitle>
                            <CardDescription className="truncate">{title}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <Badge
                              variant="secondary"
                              className={historyBadgeClass(status)}
                            >
                              {historyStatusLabel(status)}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {updated ? new Date(updated).toLocaleString('vi-VN') : ''}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Workflow className="size-4 text-primary" />
                  Quy trình làm việc
                </CardTitle>
                <CardDescription>
                  Theo series <strong className="text-foreground">{pipelineSeries?.title ?? '—'}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  className={pipelineSeries?.needsFullDebutPipeline
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400'}
                  variant="secondary"
                >
                  {pipelineSeries?.needsFullDebutPipeline
                    ? `✦ Lần đầu · có ${LABEL_EDITOR_BOARD}`
                    : `Lần 2+ · chỉ ${LABEL_TANTOU_EDITOR}`}
                </Badge>

                {pipelineSeries?.needsFullDebutPipeline && pipelineSeries.title && !ebApprovedMap[pipelineSeries.title] ? (
                  <p className="text-xs text-muted-foreground">
                    Chờ {LABEL_EDITOR_BOARD} duyệt vòng đầu —{' '}
                    <Link to={PATH_EDITOR_BOARD} className="font-medium text-primary hover:underline">
                      mở trang {LABEL_EDITOR_BOARD}
                    </Link>
                  </p>
                ) : null}

                <ol className="relative space-y-3 border-l border-muted pl-5">
                  {workflowSteps.map((w, i) => {
                    const isActive = i === 0
                    return (
                      <li key={w.step} className="relative">
                        <span
                          className={cn(
                            'absolute -left-[26px] flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card',
                            isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {w.step}
                        </span>
                        <p className="text-sm font-medium">{w.title}</p>
                        <p className="text-xs text-muted-foreground">{w.desc}</p>
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>

            {pendingFromAssistant.length > 0 ? (
              <Card className="border-emerald-300/40 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="size-4 text-emerald-600" />
                    Bản ghép từ Assistant ({pendingFromAssistant.length})
                  </CardTitle>
                  <CardDescription>
                    Duyệt hoặc từ chối các bản ghép mà Assistant vừa gửi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingFromAssistant.map((c) => {
                    const chId = c.id ?? c.chapterId
                    const num = c.chapterNumber ?? c.num ?? '?'
                    const title = c.title ?? c.chapterTitle ?? `Ch. ${num}`
                    return (
                      <div key={chId} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Ch. {num} — {title}</p>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                            Chờ duyệt
                          </Badge>
                        </div>
                        {c.mangakaRejectionReason ? (
                          <p className="text-xs text-destructive">
                            Từng bị từ chối: {c.mangakaRejectionReason}
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => acceptAssistantChapter(c)}
                            disabled={updateChapterStatus.isPending}
                          >
                            <CheckCircle2 className="size-3.5" />
                            Chấp nhận
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => openRejectDialog(c)}
                            disabled={updateChapterStatus.isPending}
                          >
                            Từ chối
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ) : null}

            {pendingCompositeReview ? (
              <Card className="border-primary/30 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="size-4 text-primary" />
                    Bản tổng hợp từ Assistant
                  </CardTitle>
                  <CardDescription>
                    <strong className="text-foreground">{pendingCompositeReview.series}</strong> · Ch. {pendingCompositeReview.num}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge
                    className={pendingCompositeReview.status === 'InProduction'
                      ? STATUS_BADGE.assistant.className
                      : STATUS_BADGE.review.className}
                    variant="secondary"
                  >
                    {pendingCompositeReview.status === 'InProduction' ? 'Chờ bạn phản hồi' : 'Chờ Assistant vẽ'}
                  </Badge>

                  <div className="overflow-hidden rounded-lg border bg-muted">
                    {pendingDeliverable?.compositeDataUrl ? (
                      <img src={pendingDeliverable.compositeDataUrl} alt={`Bản ghép ${pendingDeliverable.pageLabel}`} className="w-full" />
                    ) : pendingDeliverable?.overlayDataUrl ? (
                      <div className="relative">
                        {pendingDeliverable.mangakaImageUrl ? (
                          <img src={pendingDeliverable.mangakaImageUrl} alt="Ảnh gốc" className="w-full" />
                        ) : null}
                        <img src={pendingDeliverable.overlayDataUrl} alt="Layer Assistant" className="absolute inset-0 w-full" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 p-6 text-center text-xs text-muted-foreground">
                        <ImageIcon className="size-6 opacity-40" />
                        <span>Chờ Assistant gửi layer</span>
                      </div>
                    )}
                  </div>

                  {pendingDeliverable ? (
                    <p className="text-xs text-muted-foreground">
                      {pendingDeliverable.pageLabel}
                      {pendingDeliverable.sendMode === 'overlay' ? ' · Layer trong suốt' : ' · Bản ghép'}
                    </p>
                  ) : null}

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => handleCompositeDecision('approve')}>
                      <CheckCircle2 className="size-3.5" />
                      Phê duyệt
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCompositeDecision('revision')}>
                      Yêu cầu sửa
                    </Button>
                  </div>

                  {tantouSendReady ? (
                    <Button size="sm" className="w-full" onClick={handleSendTantouFromReady}>
                      <Send className="size-3.5" />
                      Gửi {LABEL_TANTOU_EDITOR}
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    disabled={seriesList.length === 0}
                    onClick={() => openAnnotate(pendingCompositeReview.series)}
                  >
                    Mở trên trang
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {tantouRevisions.length > 0 ? (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-4 text-amber-600" />
                    Nhận xét từ {LABEL_TANTOU_EDITOR}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tantouRevisions.slice(0, 3).map(s => (
                    <div key={s.id} className="rounded-lg border bg-card p-3">
                      <p className="text-sm font-semibold">{s.seriesTitle}</p>
                      <p className="text-xs text-muted-foreground">Ch. {s.chapterNum} · {s.pageLabel}</p>
                      {s.editorialComment ? (
                        <p className="mt-1.5 line-clamp-3 text-xs">{s.editorialComment}</p>
                      ) : null}
                      <Link to={PATH_TANTOU_EDITOR} className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline">
                        Xem chi tiết
                        <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {tab !== 'annotate' ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="size-4 text-primary" />
                    Mẹo nhanh
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Chọn loại việc (nền, tô bóng, hiệu ứng) cho từng vùng trước khi gửi Assistant — giảm vòng chỉnh sửa.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={seriesList.length === 0}
                    onClick={() => seriesList[0] && openAnnotate(seriesList[0].title)}
                  >
                    Bắt đầu ghi chú
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </main>

      <Footer />

      <AddSeriesModal
        open={addSeriesOpen}
        mode={editingSeries ? 'edit' : 'create'}
        initialSeries={editingSeries}
        onClose={closeAddSeriesModal}
        onSubmit={(form) => (editingSeries ? confirmUpdateSeries(form) : confirmAddSeries(form))}
        authorName={user?.name}
        existingTitles={existingSeriesTitles}
      />

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Từ chối bản ghép từ Assistant</DialogTitle>
            <DialogDescription>
              Nhập lý do — Assistant sẽ nhận được thông báo để chỉnh sửa lại.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Lý do</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Vd: Lớp text che mặt nhân vật chính ở trang 3."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={updateChapterStatus.isPending || !rejectReason.trim()}
            >
              {updateChapterStatus.isPending ? 'Đang gửi...' : 'Xác nhận từ chối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}