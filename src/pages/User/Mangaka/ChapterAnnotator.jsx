import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { toast } from 'sonner'
import {
  Eraser,
  Image as ImageIcon,
  Maximize2,
  MousePointer2,
  Plus,
  Send,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { LABEL_EDITOR_BOARD, LABEL_TANTOU_EDITOR } from '@/constants/roleTerminology.js'
import { NOTE_TASK_TYPES, noteTaskLabel } from '@/constants/workspaceTasks.js'
import { fileToStorableDataUrl } from '@/utils/mangakaWorkspaceStorage.js'
import { getActiveAssigneesForMangaka } from '@/utils/assistantRosterStorage.js'
import { useAuth } from '@/lib/providers'
import { useQueryClient } from '@tanstack/react-query'
import {
  usePages,
  usePageIssues,
  usePageLayers,
  useContracts,
  useAvailableAssistantProfiles,
  useAvailableTantouEditors,
  useUpdateChapterStatus,
  useChapters,
  useDeleteChapter,
  useCreateChapter,
  useCreatePage,
  useCreatePageIssue,
  useUpdatePageIssue,
  useDeletePageIssue,
  useUpdateSeriesStatus,
  useAssignTantouEditor
} from '@/api/hooks'
import { pagesService } from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

function uid() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function noteStableKey(note, idx = 0) {
  return note?.clientKey ?? note?.id ?? `note-idx-${idx}`
}

function displayChapterNum(baseStr, index) {
  const s = String(baseStr ?? '').trim()
  if (!s) return String(index + 1)
  const base = parseInt(s, 10)
  const isPureInt = Number.isFinite(base) && /^\d+$/.test(s)
  if (isPureInt) return base + index
  if (index === 0) return s
  return `${s}-${index + 1}`
}

/** Map ChapterDto từ API sang shape local để hiển thị. */
function mapApiChapterToLocal(raw, seriesTitle) {
  if (!raw) return null
  const cid = raw.chapterid ?? raw.Chapterid ?? raw.id ?? null
  const num = raw.chapternumber ?? raw.chapternumber ?? raw.ChapterNumber ?? 0
  const title = String(raw.title ?? '').trim() || `Ch. ${num}`
  return {
    id: String(cid),
    serverChapterId: Number(cid),
    num,
    title,
    series: seriesTitle,
    pages: [],
    cover: null,
    pageCount: raw.pagecount ?? raw.Pagecount ?? null,
    apiStatus: raw.status ?? raw.Status ?? null,
    deadline: raw.deadline ?? raw.Deadline ?? null,
    deadlineRaw: null,
    createdAt: raw.createdat ?? raw.Createdat ?? null,
    isApi: true,
  }
}

// Chapter workflow enum BE (ChapterStatus):
//   InProduction (đang làm) → Ready (chờ duyệt) → Published (đã đăng)
// Local draft chưa push lên server không có status → return null.
const CHAPTER_STATUS_LABELS = {
  InProduction: 'Đang làm',
  Ready: 'Chờ duyệt',
  Published: 'Đã đăng',
}
function chapterStatusLabel(status) {
  if (!status) return null
  return CHAPTER_STATUS_LABELS[status] ?? status
}
function chapterStatusBadgeClass(status) {
  if (status === 'Published') return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
  if (status === 'Ready') return 'bg-amber-500/15 text-amber-700 border-amber-500/30'
  if (status === 'InProduction') return 'bg-sky-500/15 text-sky-700 border-sky-500/30'
  return ''
}

function countChapterNotes(chapterId, pageList, notesMap) {
  return pageList.reduce(
    (sum, _, i) => sum + (notesMap[`${chapterId}-${i}`]?.length ?? 0),
    0,
  )
}

export default function ChapterAnnotator({
  selectedSeriesTitle,
  selectedSeriesId,
  onSelectedSeriesTitleChange,
  seriesOptions = [],
  chapterNum,
  onChapterNumChange,
  chapterNumHint,
  chapters,
  setChapters,
  activeChapterId,
  setActiveChapterId,
  pageIndex,
  setPageIndex,
  notes,
  setNotes,
  serverChapterId,   // real chapter ID on backend (for API calls)
  hiredAssistants = [],
  onOpenAssistantsTab,
  onUploadProgress,
  onUploadComplete,
  onSendToAssistant,
  onSendToTantou,
  seriesStatus,
  seriesTantouId,
}) {
  const fileRef = useRef(null)
  const coverFileRef = useRef(null)
  const boardRef = useRef(null)
  const fsBoardRef = useRef(null)
  const noteSaveTimersRef = useRef({})
  const loadedNoteKeysRef = useRef(new Set())
  const draftTextRef = useRef(new Map())
  const noteTextareaRefs = useRef(new Map())
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [newChapterDeadline, setNewChapterDeadline] = useState('')

  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [tool, setTool] = useState('draw')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uploadUi, setUploadUi] = useState(null)
  const [uploadRejectMessage, setUploadRejectMessage] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedAssistantId, setSelectedAssistantId] = useState(null)
  const [localRosterTick, setLocalRosterTick] = useState(0)
  const [tantouDialogOpen, setTantouDialogOpen] = useState(false)
  const [selectedTantouId, setSelectedTantouId] = useState(null)

  const [selectedTantouForSeries, setSelectedTantouForSeries] = useState('')
  const [isSubmittingSeriesReview, setIsSubmittingSeriesReview] = useState(false)

  const updateSeriesStatus = useUpdateSeriesStatus()
  const assignTantouEditor = useAssignTantouEditor()

  const isSeriesDraft = String(seriesStatus ?? '').toLowerCase() === 'draft'
  const isSeriesPublishing = String(seriesStatus ?? '').toLowerCase() === 'publishing'

  const handleSendSeriesForReview = async () => {
    if (!selectedSeriesId || !selectedTantouForSeries) return
    setIsSubmittingSeriesReview(true)
    try {
      await assignTantouEditor.mutateAsync({
        seriesId: Number(selectedSeriesId),
        tantouEditorId: Number(selectedTantouForSeries),
      })
      await updateSeriesStatus.mutateAsync({
        id: Number(selectedSeriesId),
        status: 'EditorReview',
      })
      toast.success('Đã chọn Tantou Editor và gửi duyệt Series thành công!')
      queryClient.invalidateQueries({ queryKey: ['series'] })
    } catch (err) {
      toast.error(`Gửi duyệt Series thất bại: ${err?.message ?? 'Lỗi không xác định'}`)
    } finally {
      setIsSubmittingSeriesReview(false)
    }
  }

  // BE flow: gửi thẳng tới Tantou qua API (đã bỏ qua Assistant)
  const updateChapterStatus = useUpdateChapterStatus()
  const { data: tantouEditorsRaw = [] } = useAvailableTantouEditors()
  console.log('[ChapterAnnotator] tantouEditorsRaw RAW:', JSON.stringify(tantouEditorsRaw, null, 2))


  // API: lấy tất cả chapter của series đang annotate từ DB.
  // selectedSeriesId có thể null khi user vừa chuyển series (chưa resolve xong id).
  const numericSeriesId = selectedSeriesId != null ? Number(selectedSeriesId) : null
  const { data: serverChapters = [] } = useChapters(Number.isFinite(numericSeriesId) ? numericSeriesId : undefined)
  const deleteChapterApi = useDeleteChapter()

  const createChapterMutation = useCreateChapter()
  const createPage = useCreatePage()
  const createPageIssue = useCreatePageIssue()
  const updatePageIssue = useUpdatePageIssue()
  const deletePageIssue = useDeletePageIssue()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Subscribe trực tiếp vào roster update event — không phụ thuộc parent re-render
  useEffect(() => {
    const onRoster = () => setLocalRosterTick(t => t + 1)
    window.addEventListener('mk-assistant-roster-update', onRoster)
    window.addEventListener('storage', onRoster)
    return () => {
      window.removeEventListener('mk-assistant-roster-update', onRoster)
      window.removeEventListener('storage', onRoster)
    }
  }, [])

  // Chặn browser mở tab mới khi user lỡ thả file ngoài dropzone.
  // Cũng bật highlight khi kéo file vào page.
  useEffect(() => {
    const hasFiles = (e) => {
      const types = e?.dataTransfer?.types
      if (!types) return false
      return Array.from(types).includes('Files')
    }
    const onWindowDragOver = (e) => { if (hasFiles(e)) e.preventDefault() }
    const onWindowDrop = (e) => {
      if (hasFiles(e)) e.preventDefault()
      setIsDragOver(false)
    }
    const onWindowDragEnter = (e) => { if (hasFiles(e)) setIsDragOver(true) }
    const onWindowDragLeave = (e) => {
      // Khi rời window hoặc sang dropzone (target related)
      if (e.relatedTarget == null) setIsDragOver(false)
    }
    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('drop', onWindowDrop)
    window.addEventListener('dragenter', onWindowDragEnter)
    window.addEventListener('dragleave', onWindowDragLeave)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('drop', onWindowDrop)
      window.removeEventListener('dragenter', onWindowDragEnter)
      window.removeEventListener('dragleave', onWindowDragLeave)
    }
  }, [])

  // Tính lại hiredAssistants mỗi khi localRosterTick thay đổi
  const localHiredAssistants = useMemo(() => {
    void localRosterTick
    const mkId = user?.id ?? user?.userid ?? null
    return getActiveAssigneesForMangaka(mkId)
  }, [localRosterTick, user])

  const localMangakaId = useMemo(() => {
    return user?.id ?? user?.userid ?? null
  }, [user])

  const { data: contractsRaw = [] } = useContracts({ mangakaId: localMangakaId })
  console.log('[ChapterAnnotator] contractsRaw:', contractsRaw)

  // API: fetch available assistants (for name lookup)
  const { data: assistantProfilesRaw = [] } = useAvailableAssistantProfiles()

  // Map accepted contracts -> assistant options (cùng format với MangakaAssistants).
  // Enum BE Mangaka_Assistants.status: chỉ 'active' khi đang trong đội (đã được Assistant accept).
  const contractsAssistants = useMemo(() => {
    const accepted = contractsRaw.filter(c => {
      const status = (c.status ?? '').toLowerCase()
      return status === 'active'
    })

    // Build assistantId -> profile map from available profiles
    const profileMap = {}
    for (const p of assistantProfilesRaw) {
      const pid = String(p.id ?? p.user_id ?? p.userid ?? p.assistant_id ?? p.assistantid ?? '')
      const name = p.fullname ?? p.fullName ?? p.name ?? p.username ?? 'Assistant'
      profileMap[pid] = name
    }

    console.log('[ChapterAnnotator] contractsAssistants raw:', accepted)
    console.log('[ChapterAnnotator] profileMap:', profileMap)

    return accepted.map(c => {
      const asstId = String(c.assistant_id ?? c.assistantid ?? '')
      const name = profileMap[asstId] ?? c.assistant_name ?? c.assistantName ?? 'Assistant'
      console.log('[ChapterAnnotator] mapping contract:', { asstId, name })
      return { value: asstId, label: name, assistantId: asstId }
    })
  }, [contractsRaw, assistantProfilesRaw])

  // Override hiredAssistants: uu tien API contracts, fallback localStorage, fallback props
  const effectiveHiredAssistants = useMemo(() => {
    if (contractsAssistants.length > 0) return contractsAssistants
    if (localHiredAssistants.length > 0) return localHiredAssistants
    return hiredAssistants ?? []
  }, [contractsAssistants, localHiredAssistants, hiredAssistants])

  // Chapter hiển thị: lấy từ API (DB) làm nguồn chính, merge với local state
  // để chapter vừa tạo (chưa refetch) vẫn hiện ngay.
  const trimmedTitle = selectedSeriesTitle.trim()
  const apiChapterShape = useMemo(() => {
    if (!trimmedTitle) return []
    const mapped = (serverChapters || [])
      .map(c => mapApiChapterToLocal(c, trimmedTitle))
      .filter(Boolean)

    // Backend đôi khi trả duplicate rows cho cùng 1 chapterid (do join) — chặn ở đây.
    const seen = new Set()
    const out = []
    for (const ch of mapped) {
      if (seen.has(ch.id)) {
        console.warn('[ChapterAnnotator] dropped duplicate chapter id from API:', ch.id, ch)
        continue
      }
      seen.add(ch.id)
      out.push(ch)
    }
    return out
  }, [serverChapters, trimmedTitle])

  const seriesChapters = useMemo(() => {
    if (!trimmedTitle) return []
    const localForSeries = chapters.filter(c => c.series === trimmedTitle)
    const apiServerIds = new Set(apiChapterShape.map(c => String(c.serverChapterId)))

    const localByServerId = new Map()
    for (const c of localForSeries) {
      const sid = c.serverChapterId ?? (Number.isFinite(Number(c.id)) ? Number(c.id) : null)
      if (sid != null) localByServerId.set(String(sid), c)
    }

    const sortedApi = [...apiChapterShape].sort((a, b) => (a.num ?? 0) - (b.num ?? 0))
    const merged = sortedApi.map(apiCh => {
      const localMatch = localByServerId.get(String(apiCh.serverChapterId))
      if (localMatch) {
        // Ép id/serverChapterId theo dữ liệu API — local object có thể mang id cũ/sai
        return { ...localMatch, id: apiCh.id, serverChapterId: apiCh.serverChapterId }
      }
      return apiCh
    })

    const localOnly = localForSeries.filter(c => {
      const sid = c.serverChapterId ?? (Number.isFinite(Number(c.id)) ? Number(c.id) : null)
      return sid == null || !apiServerIds.has(String(sid))
    })
    const combined = [...merged, ...localOnly]

    // ✅ Dedupe cuối cùng theo id — phòng trường hợp 1 chapter lọt vào cả 2 nhóm
    const seen = new Set()
    const deduped = []
    for (const c of combined) {
      const key = String(c.id)
      if (seen.has(key)) {
        console.warn('[ChapterAnnotator] DUPLICATE chapter id caught at final dedupe:', key, c)
        continue
      }
      seen.add(key)
      deduped.push(c)
    }
    return deduped
  }, [chapters, apiChapterShape, trimmedTitle])

  // activeChapter lookup từ seriesChapters (gồm cả local + API)
  const activeChapter = seriesChapters.find(c => c.id === activeChapterId) ?? null
  const localPages = activeChapter?.pages ?? []

  // Server-side data — chapter từ API có pages rỗng trong local map; load từ BE.
  const effectiveServerChapterId = useMemo(() => {
    if (serverChapterId) return serverChapterId
    if (!activeChapterId) return null
    const n = Number(activeChapterId)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [serverChapterId, activeChapterId])
  const { data: serverPages = [] } = usePages(effectiveServerChapterId)
  const { data: serverPageIssues = [] } = usePageIssues({ chapterId: effectiveServerChapterId })

  // Server-side PageLayer fallback: trường hợp BE trả về page có pageimageurl rỗng
  // (URL thực tế nằm ở PageLayer default). Fetch layer cho page đang xem để lấy URL.
  const currentPageServerId = useMemo(() => {
    const localP = (activeChapter?.pages ?? [])[pageIndex]
    if (localP?.serverPageId ?? localP?.apiPageId) return localP.serverPageId ?? localP.apiPageId
    const localServerId = localP?.serverPageId ?? localP?.apiPageId
    if (localServerId != null) return localServerId
    // serverPages: tìm theo thứ tự pageIndex
    const sp = Array.isArray(serverPages) ? serverPages[pageIndex] : null
    const sid = sp?.pageid ?? sp?.Pageid
    return sid != null ? Number(sid) : null
  }, [activeChapter, pageIndex, serverPages])

  const issuesForCurrentPage = useMemo(() => {
    if (currentPageServerId == null || !Number.isFinite(Number(currentPageServerId)) || !Array.isArray(serverPageIssues)) return []
    return serverPageIssues.filter(issue => {
      const issuePageId = issue.pageid ?? issue.pageId ?? issue.Pageid
      return issuePageId != null && Number(issuePageId) === Number(currentPageServerId)
    })
  }, [serverPageIssues, currentPageServerId])
  const { data: currentPageLayers = [] } = usePageLayers(currentPageServerId)
  const fallbackLayerUrl = useMemo(() => {
    // Lấy URL của layer đầu tiên visible (Zindex thấp nhất hoặc layername = 'Default').
    if (!Array.isArray(currentPageLayers)) return null
    const visible = currentPageLayers.filter(l => l && (l.Isvisible ?? l.isvisible ?? true) && !(l.Isdeleted ?? l.isdeleted ?? false))
    if (!visible.length) return currentPageLayers[0]?.Fileurl ?? currentPageLayers[0]?.fileurl ?? null
    const sorted = [...visible].sort((a, b) => {
      const az = a.Zindex ?? a.zindex ?? 999
      const bz = b.Zindex ?? b.zindex ?? 999
      if (az !== bz) return az - bz
      const aid = a.Layerid ?? a.layerid ?? 0
      const bid = b.Layerid ?? b.layerid ?? 0
      return aid - bid
    })
    return sorted[0]?.Fileurl ?? sorted[0]?.fileurl ?? null
  }, [currentPageLayers])

  // Ưu tiên serverPages từ API (để có đầy đủ serverPageId), fallback localPages FE mới upload.
  const pages = useMemo(() => {
    const dedupeById = (arr) => {
      const seen = new Set()
      const out = []
      for (const p of arr) {
        if (!p || !p.id) continue
        if (seen.has(p.id)) {
          console.warn('[ChapterAnnotator] dropped duplicate page id:', p.id, p)
          continue
        }
        seen.add(p.id)
        out.push(p)
      }
      return out
    }

    if (Array.isArray(serverPages) && serverPages.length > 0) {
      const mapped = serverPages
        .filter(p => p && (p.pageid ?? p.Pageid ?? p.pageId ?? p.PageId ?? p.id ?? p.pageimageurl ?? p.Pageimageurl ?? p.pageImageUrl ?? p.PageImageUrl ?? p.url))
        .map((p, i) => {
          const directUrl = p.pageimageurl ?? p.Pageimageurl ?? p.pageImageUrl ?? p.PageImageUrl ?? p.url ?? null
          const sid = p.pageid ?? p.Pageid ?? p.pageId ?? p.PageId ?? p.id ?? null
          return {
            id: String(sid ?? `srv-page-${i}`),
            name: `Page ${p.pagenumber ?? p.Pagenumber ?? p.pageNumber ?? p.PageNumber ?? i + 1}`,
            url: directUrl && String(directUrl).trim() !== '' ? directUrl : null,
            serverPageId: sid,
            isSentToMangaka:
              p.issenttomangaka === true ||
              p.issenttomangaka === 1 ||
              p.issenttomangaka === '1' ||
              p.isSentToMangaka === true ||
              p.isSentToMangaka === 1 ||
              p.isSentToMangaka === '1' ||
              p.IsSentToMangaka === true ||
              p.IsSentToMangaka === 1 ||
              p.IsSentToMangaka === '1',
          }
        })
      const result = dedupeById(mapped)
      console.log('[ChapterAnnotator] serverPages loaded & mapped:', result)
      return result
    }

    const resultLocal = dedupeById(localPages)
    console.log('[ChapterAnnotator] fallback to localPages:', resultLocal)
    return resultLocal
  }, [localPages, serverPages])

  // Nếu page hiện tại không có url trực tiếp nhưng có layer thì dùng URL layer.
  const effectiveCurrentPageUrl = useMemo(() => {
    const p = pages[pageIndex]
    if (!p) return null
    if (p.url && String(p.url).trim() !== '') return p.url
    const pServerId = p.serverPageId
    const curId = currentPageServerId
    if (pServerId != null && curId != null && Number(pServerId) === Number(curId)) {
      return fallbackLayerUrl
    }
    return null
  }, [pages, pageIndex, fallbackLayerUrl, currentPageServerId])
  const pageKey = activeChapter ? `${activeChapterId}-${pageIndex}` : ''
  const pageNotes = notes[pageKey] ?? []



  useEffect(() => {
    if (!isFullscreen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [isFullscreen])

  const handleUpdateServerIssue = useCallback((stableKey, field, value) => {
    const originalIssue = serverPageIssues.find(i => String(i.issueid ?? i.Issueid ?? i.id) === String(stableKey))
    if (!originalIssue) return

    const issueType = field === 'taskType'
      ? (value === 'revision' ? 'Revision' : value === 'production' ? 'Production' : 'Revision')
      : (originalIssue.issueType ?? originalIssue.Issuetype ?? 'Revision')

    const workCategory = field === 'taskType'
      ? (value === 'background' ? 'Background'
        : value === 'dialog' ? 'Dialog'
          : value === 'ink' ? 'Inking'
            : value === 'fx' ? 'Effects'
              : value === 'shading' ? 'Shading'
                : 'Content')
      : (originalIssue.workCategory ?? originalIssue.Workcategory ?? 'Background')

    const description = field === 'text' ? value : (originalIssue.description ?? originalIssue.Description ?? '')
    const deadline = field === 'deadline'
      ? new Date(value).toISOString()
      : (originalIssue.deadline ? new Date(originalIssue.deadline).toISOString() : null)

    updatePageIssue.mutate({
      id: Number(stableKey),
      data: {
        pageId: originalIssue.pageid ?? originalIssue.pageId ?? originalIssue.Pageid,
        createdById: originalIssue.createdById ?? originalIssue.Createdbyid ?? user?.id ?? 0,
        assignedToId: originalIssue.assignedToId ?? originalIssue.Assignedtoid ?? null,
        issueType,
        workCategory,
        boxX: originalIssue.boxX ?? originalIssue.Boxx ?? 0,
        boxY: originalIssue.boxY ?? originalIssue.Boxy ?? 0,
        boxWidth: originalIssue.boxWidth ?? originalIssue.Boxwidth ?? 0,
        boxHeight: originalIssue.boxHeight ?? originalIssue.Boxheight ?? 0,
        description,
        deadline,
      }
    }, {
      onSuccess: () => {
        toast.success('Đã cập nhật ghi chú trên server.')
        queryClient.invalidateQueries({ queryKey: ['pageIssues'] })
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message ?? 'Lỗi khi cập nhật.')
      }
    })
  }, [serverPageIssues, updatePageIssue, user, queryClient])

  const handleDeleteServerIssue = useCallback((stableKey) => {
    deletePageIssue.mutate(Number(stableKey), {
      onSuccess: () => {
        toast.success('Đã xóa ghi chú trên server.')
        setSelectedNoteId(prev => (prev === stableKey ? null : prev))
        queryClient.invalidateQueries({ queryKey: ['pageIssues'] })
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message ?? 'Lỗi khi xóa ghi chú.')
      }
    })
  }, [deletePageIssue, queryClient])

  const updateNoteField = useCallback((stableKey, field, value) => {
    const isServer = Number.isFinite(Number(stableKey))
    if (isServer) {
      handleUpdateServerIssue(stableKey, field, value)
    } else {
      setNotes(prev => ({
        ...prev,
        [pageKey]: (prev[pageKey] ?? []).map(n => (
          noteStableKey(n) === stableKey ? { ...n, [field]: value } : n
        )),
      }))
    }
  }, [pageKey, setNotes, handleUpdateServerIssue])

  const deleteNote = useCallback((stableKey) => {
    const isServer = Number.isFinite(Number(stableKey))
    if (isServer) {
      handleDeleteServerIssue(stableKey)
    } else {
      setNotes(prev => ({
        ...prev,
        [pageKey]: (prev[pageKey] ?? []).filter(n => noteStableKey(n) !== stableKey),
      }))
      setSelectedNoteId(prev => (prev === stableKey ? null : prev))
    }
  }, [pageKey, setNotes, handleDeleteServerIssue])

  const persistNoteById = useCallback(async (stableKey) => {
    const draftValue = draftTextRef.current.get(stableKey)
    if (draftValue !== undefined) {
      updateNoteField(stableKey, 'text', draftValue)
      draftTextRef.current.delete(stableKey)
    }
  }, [updateNoteField])

  useEffect(() => {
    if (!uploadRejectMessage) return undefined
    const t = window.setTimeout(() => setUploadRejectMessage(null), 6000)
    return () => window.clearTimeout(t)
  }, [uploadRejectMessage])

  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
        const tag = e.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        deleteNote(selectedNoteId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNoteId, deleteNote])



  const scheduleNoteSave = useCallback((stableKey, currentText) => {
    if (!stableKey) return
    if (!currentText?.trim()) return
    clearTimeout(noteSaveTimersRef.current[stableKey])
    noteSaveTimersRef.current[stableKey] = window.setTimeout(() => {
      void persistNoteById(stableKey)
    }, 1500)
  }, [persistNoteById])

  const [approvingPage, setApprovingPage] = useState(false)
  const handleApprovePage = async () => {
    const page = pages[pageIndex]
    const pId = page?.serverPageId
    if (!pId) {
      toast.error('Trang chưa có ID server.')
      return
    }
    setApprovingPage(true)
    try {
      // 1. Gọi API composite để lưu ảnh vào database
      await pagesService.composite(pId)

      // 2. Đổi biến isSentToMangaka thành false
      await pagesService.updateIsSentToMangaka(pId, false)

      toast.success(`Đã duyệt Trang ${pageIndex + 1} thành công và lưu ảnh hoàn chỉnh!`)

      // Invalidate query
      queryClient.invalidateQueries({ queryKey: ['pages'] })
    } catch (err) {
      toast.error('Duyệt bản vẽ thất bại: ' + (err?.response?.data?.message ?? err.message))
    } finally {
      setApprovingPage(false)
    }
  }

  const uploadTargetChapter = useMemo(
    () => seriesChapters.find(c => c.id === activeChapterId) ?? null,
    [seriesChapters, activeChapterId],
  )

  // Dùng chuỗi id ổn định làm dependency — seriesChapters là array mới mỗi render
  // (vì `chapters` prop từ Mangaka.jsx luôn là array mới identity), nên không thể
  // dùng thẳng seriesChapters làm dep / không thể đọc activeChapterId trực tiếp trong
  // effect — cả hai cách đều có thể gây setState lặp vô hạn nếu identity dao động.
  const seriesChapterIdsKey = useMemo(
    () => seriesChapters.map(c => c.id).join(','),
    [seriesChapters],
  )

  useEffect(() => {
    const trimmed = selectedSeriesTitle.trim()
    if (!trimmed) return
    const forSeries = seriesChapters
    if (!forSeries.length) {
      if (activeChapterId) setActiveChapterId(null)
      return
    }
    if (forSeries.some(c => c.id === activeChapterId)) return
    setPageIndex(0)
    setSelectedNoteId(null)
    setActiveChapterId(forSeries[0].id)
  }, [selectedSeriesTitle, seriesChapterIdsKey, activeChapterId, setPageIndex])
  const activateChapter = useCallback((ch, pageIdx = 0) => {
    setActiveChapterId(ch.id)
    setPageIndex(pageIdx)
    setSelectedNoteId(null)
  }, [setActiveChapterId, setPageIndex])

  const nextChapterNum = useMemo(() => {
    const trimmed = selectedSeriesTitle.trim()
    if (!trimmed) return 1
    const nums = seriesChapters
      .map(c => parseInt(String(c.num), 10))
      .filter(Number.isFinite)
    return nums.length === 0 ? 1 : Math.max(...nums) + 1
  }, [selectedSeriesTitle, seriesChapters])

  const createNewChapter = useCallback(() => {
    const trimmedSeries = selectedSeriesTitle.trim()
    if (!trimmedSeries) return

    const num = nextChapterNum
    const numKey = String(num)
    const existing = chapters.find(c => c.series === trimmedSeries && String(c.num) === numKey)
    if (existing) {
      activateChapter(existing, 0)
      return
    }

    const createdAt = new Date().toLocaleDateString('vi-VN')
    const title = newChapterTitle.trim() || `Chapter ${num}`
    const deadline = newChapterDeadline ? new Date(newChapterDeadline).toISOString() : null

    createChapterMutation.mutate({
      seriesid: Number(selectedSeriesId),
      chapternumber: Number(num),
      title: title,
      deadline: deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }, {
      onSuccess: (res) => {
        const responseData = res?.data ?? res
        const realChapterId = responseData?.chapterid ?? responseData?.id
        const ch = {
          id: String(realChapterId),
          serverChapterId: Number(realChapterId),
          series: trimmedSeries,
          num,
          title,
          pages: [],
          createdAt,
          deadline,
          deadlineRaw: newChapterDeadline,
          isApi: true,
        }
        setChapters(prev => [ch, ...prev])
        setActiveChapterId(String(realChapterId))
        setPageIndex(0)
        setSelectedNoteId(null)
        setUploadRejectMessage(null)
        setNewChapterTitle('')
        setNewChapterDeadline('')
        onChapterNumChange?.(String(num + 1))
        toast.success(`Đã tạo Ch. ${num} trên server!`)
      },
      onError: (err) => {
        toast.error(err?.response?.data?.message ?? 'Lỗi khi tạo chapter trên server.')
      }
    })
  }, [
    selectedSeriesTitle, selectedSeriesId, nextChapterNum, chapters, setChapters,
    setActiveChapterId, setPageIndex, onChapterNumChange, activateChapter,
    newChapterTitle, newChapterDeadline, createChapterMutation
  ])

  const handleFiles = useCallback(async (files) => {
    if (!files?.length) return
    const trimmedSeries = selectedSeriesTitle.trim()
    if (!trimmedSeries) return

    setUploadRejectMessage(null)

    const target = seriesChapters.find(c => c.id === activeChapterId)
    if (!target) {
      setUploadRejectMessage('Chọn hoặc bấm "Tạo chapter" trước.')
      return
    }

    const fileList = Array.from(files).filter(
      f => f.type.startsWith('image/') || f.name.match(/\.(png|jpe?g|webp)$/i),
    )
    if (!fileList.length) return

    try {
      setUploadUi({ series: trimmedSeries, chapter: target.num, pct: 5 })

      // Ưu tiên chapter.serverChapterId (đã lưu server) trước prop, rồi fallback.
      // Nếu vẫn không có → chapter còn là local nháp → tự đẩy lên server trước.
      let serverChapterId =
        target.serverChapterId
        ?? (Number.isFinite(Number(target.id)) ? Number(target.id) : null)
        ?? effectiveServerChapterId
        ?? null

      if (!Number.isFinite(Number(serverChapterId)) || Number(serverChapterId) <= 0) {
        const num = parseInt(String(target.num), 10) || 1
        const title = target.title || `Chapter ${num}`
        const isoDeadline = target.deadline
          ? new Date(target.deadline).toISOString()
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        const seriesIdNum = Number(selectedSeriesId)
        if (!Number.isFinite(seriesIdNum) || seriesIdNum <= 0) {
          setUploadRejectMessage('Series chưa có ID server — không thể tạo chapter ở đây.')
          setUploadUi(null)
          return
        }
        try {
          const res = await createChapterMutation.mutateAsync({
            seriesid: seriesIdNum,
            chapternumber: num,
            title,
            deadline: isoDeadline,
          })
          const respData = res?.data ?? res
          const realId = Number(respData?.chapterid ?? respData?.id)
          if (!Number.isFinite(realId) || realId <= 0) {
            throw new Error('Server không trả về chapter id hợp lệ.')
          }
          serverChapterId = realId
          // Cập nhật local state để UI sync
          setChapters(prev => prev.map(c =>
            c.id === target.id
              ? { ...c, id: String(realId), serverChapterId: realId, isApi: true }
              : c,
          ))
          setActiveChapterId(String(realId))
        } catch (createErr) {
          console.error('[upload] auto-create chapter failed:', createErr)
          setUploadRejectMessage(
            `Không lưu được chapter lên server: ${createErr?.response?.data?.message ?? createErr?.message ?? 'lỗi không xác định'}. Hãy tạo chapter trước.`,
          )
          setUploadUi(null)
          return
        }
      }

      const effectiveId = Number(serverChapterId)
      const currentPagesCount = pages.length
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const fd = new FormData()
        fd.append('chapterid', String(effectiveId))
        fd.append('pagenumber', String(currentPagesCount + i + 1))
        fd.append('pageFile', file)

        await createPage.mutateAsync(fd)

        const pct = 10 + Math.round(((i + 1) / fileList.length) * 90)
        setUploadUi({ series: trimmedSeries, chapter: target.num, pct })
      }

      toast.success('Đã tải lên các trang thành công!')
      queryClient.invalidateQueries({ queryKey: ['pages', effectiveId] })
      queryClient.invalidateQueries({ queryKey: ['chapters'] })
    } catch (err) {
      // Log đầy đủ để debug; hiển thị thông điệp dễ hiểu cho user
      console.error('[upload] createPage failed:', {
        status: err?.response?.status,
        url: err?.response?.config?.url,
        method: err?.response?.config?.method,
        body: err?.response?.data,
        message: err?.message,
        request: err?.response?.config?.data instanceof FormData
          ? Array.from(err.response.config.data.entries())
          : undefined,
      })
      const status = err?.response?.status
      const serverMsg = err?.response?.data?.message ?? err?.message
      const detail = status
        ? `HTTP ${status}: ${serverMsg ?? 'không rõ nguyên nhân'}`
        : (serverMsg ?? 'Lỗi khi upload trang lên server (kiểm tra kết nối mạng/CORS).')
      setUploadRejectMessage(detail)
    } finally {
      setUploadUi(null)
    }
  }, [
    selectedSeriesTitle, selectedSeriesId, activeChapterId, seriesChapters,
    pages, effectiveServerChapterId, createPage, createChapterMutation,
    setChapters, setActiveChapterId, queryClient,
  ])

  function onFileChange(e) {
    void handleFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    void handleFiles(e.dataTransfer.files)
  }

  const handleCoverFile = useCallback(async (file) => {
    if (!file || !activeChapterId) return
    const ok = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
    if (!ok) {
      setUploadRejectMessage('Ảnh bìa cần là PNG/JPG/WEBP.')
      return
    }
    try {
      const { dataUrl } = await fileToStorableDataUrl(file)
      setChapters(prev => {
        const exists = prev.some(c => c.id === activeChapterId)
        const patch = { cover: { url: dataUrl, name: file.name }, isCoverLocal: true }
        if (exists) {
          return prev.map(c => (c.id === activeChapterId ? { ...c, ...patch } : c))
        }
        // Chapter từ API chưa có trong local — thêm vào để UI hiển thị cover (chỉ client-side)
        const apiTarget = seriesChapters.find(c => c.id === activeChapterId)
        if (!apiTarget) return prev
        return [{ ...apiTarget, ...patch }, ...prev]
      })
      setUploadRejectMessage(null)
    } catch {
      setUploadRejectMessage('Không đọc được ảnh bìa — thử lại.')
    }
  }, [activeChapterId, setChapters, seriesChapters])

  function onCoverChange(e) {
    void handleCoverFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onCoverDrop(e) {
    e.preventDefault()
    void handleCoverFile(e.dataTransfer.files?.[0])
  }

  const removeCover = useCallback(() => {
    if (!activeChapterId) return
    setChapters(prev => prev.map(c => (c.id === activeChapterId ? { ...c, cover: null } : c)))
  }, [activeChapterId, setChapters])

  const deleteChapter = useCallback((chapterId) => {
    if (!chapterId) return

    // Tìm trong seriesChapters (gồm cả local + API chapters)
    const target = seriesChapters.find(c => c.id === chapterId)
    if (!target) {
      console.log('[DEBUG] deleteChapter - NOT FOUND in seriesChapters, id:', chapterId, 'available ids:', seriesChapters.map(c => ({ id: c.id, num: c.num, isApi: c.isApi })))
      return
    }
    const label = `Ch. ${target.num}${target.pages?.length ? ` (${target.pages.length} trang)` : ''}`

    const isServerChapter = !!(target.isApi || target.serverChapterId)

    // Xóa khỏi local state (optimistic)
    setChapters(prev => prev.filter(c => c.id !== chapterId))
    setNotes(prev => {
      const next = {}
      for (const k of Object.keys(prev)) {
        if (!k.startsWith(`${chapterId}-`)) next[k] = prev[k]
      }
      return next
    })
    if (activeChapterId === chapterId) {
      setActiveChapterId(null)
      setPageIndex(0)
      setSelectedNoteId(null)
    }

    // Gọi API soft-delete (PATCH isdelete=1)
    if (isServerChapter) {
      console.log('[ChapterAnnotator] deleteChapter API (soft-delete):', chapterId)
      deleteChapterApi.mutate(chapterId, {
        onSuccess: () => {
          toast.success(`Đã xóa ${label}`)
        },
        onError: (err) => {
          toast.error(`Xóa thất bại: ${err.message}`)
          console.error('[ChapterAnnotator] deleteChapter error:', err)
        },
      })
    } else {
      toast.success(`Đã xóa ${label} (chưa lưu server)`)
    }
  }, [seriesChapters, activeChapterId, setChapters, setNotes, setActiveChapterId, setPageIndex, deleteChapterApi])

  function getPercent(e, ref) {
    const el = ref?.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  function onNoteClick(e, stableKey) {
    e.stopPropagation()
    if (tool === 'delete') {
      deleteNote(stableKey)
      return
    }
    setSelectedNoteId(stableKey)
    setTool('select')
  }

  function onBoardMouseDown(e, ref) {
    if (!activeChapter) return
    if (tool === 'delete') { setSelectedNoteId(null); return }
    if (tool !== 'draw') return
    const pt = getPercent(e, ref)
    setDrawStart(pt)
    setDrawCurrent(pt)
    setSelectedNoteId(null)
  }

  function onBoardMouseMove(e, ref) {
    if (!drawStart) return
    setDrawCurrent(getPercent(e, ref))
  }

  function onBoardMouseUp() {
    if (!drawStart || !drawCurrent) return
    const x = Math.min(drawStart.x, drawCurrent.x)
    const y = Math.min(drawStart.y, drawCurrent.y)
    const w = Math.abs(drawCurrent.x - drawStart.x)
    const h = Math.abs(drawCurrent.y - drawStart.y)
    setDrawStart(null)
    setDrawCurrent(null)
    if (w < 2 || h < 2) return

    const clientKey = uid()
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
    const newNote = { id: clientKey, clientKey, x, y, w, h, text: '', taskType: 'background', assignee: '', deadline: tomorrowStr }
    setNotes(prev => ({
      ...prev,
      [pageKey]: [...(prev[pageKey] ?? []), newNote],
    }))
    setSelectedNoteId(clientKey)
  }

  function goPage(delta) {
    setPageIndex(i => {
      const next = i + delta
      if (next < 0 || next >= pages.length) return i
      return next
    })
    setSelectedNoteId(null)
  }

  const removeCurrentPage = useCallback(() => {
    if (!activeChapterId || !activeChapter) return
    const chId = activeChapterId
    const idx = pageIndex
    const oldPages = activeChapter.pages
    if (oldPages.length === 0) return

    const removed = oldPages[idx]
    if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)

    const newPages = oldPages.filter((_, i) => i !== idx)
    const chapterRemoved = newPages.length === 0

    setNotes((prev) => {
      const next = {}
      for (const k of Object.keys(prev)) {
        if (!k.startsWith(`${chId}-`)) next[k] = prev[k]
      }
      let ni = 0
      for (let oi = 0; oi < oldPages.length; oi++) {
        if (oi === idx) continue
        next[`${chId}-${ni}`] = prev[`${chId}-${oi}`] ?? []
        ni++
      }
      return next
    })
    setSelectedNoteId(null)
    setTool('draw')

    if (chapterRemoved) {
      const wasIdx = chapters.findIndex(c => c.id === chId)
      const out = chapters.filter(c => c.id !== chId)
      const pick = out.length ? out[Math.min(Math.max(wasIdx, 0), out.length - 1)] : null
      setChapters(out)
      setActiveChapterId(pick ? pick.id : null)
      setPageIndex(0)
      return
    }

    setChapters(prev => prev.map(ch => (ch.id === chId ? { ...ch, pages: newPages } : ch)))
    setPageIndex((pi) => {
      const max = newPages.length - 1
      return pi > max ? max : pi
    })
  }, [activeChapter, activeChapterId, pageIndex, chapters, setChapters, setNotes, setActiveChapterId, setPageIndex])

  const draftRect = drawStart && drawCurrent ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    w: Math.abs(drawCurrent.x - drawStart.x),
    h: Math.abs(drawCurrent.y - drawStart.y),
  } : null

  const totalNotes = activeChapter
    ? pages.reduce((sum, _, i) => sum + (notes[`${activeChapterId}-${i}`]?.length ?? 0), 0)
    : 0

  const canUpload = seriesOptions.length > 0
    && selectedSeriesTitle.trim().length > 0
    && !!uploadTargetChapter

  const selectedSeriesPipeline = seriesOptions.find(s => s.title === selectedSeriesTitle.trim())

  function ToolButtons() {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={tool === 'draw' ? 'default' : 'outline'}
          onClick={() => setTool('draw')}
        >
          <Square className="size-3.5" />
          Tạo ô
        </Button>
        <Button
          size="sm"
          variant={tool === 'select' ? 'default' : 'outline'}
          onClick={() => setTool('select')}
        >
          <MousePointer2 className="size-3.5" />
          Chọn ô
        </Button>
        <Button
          size="sm"
          variant={tool === 'delete' ? 'destructive' : 'outline'}
          onClick={() => setTool('delete')}
          title="Bấm vào ô trên trang để gỡ. Không xóa ảnh trang."
        >
          <Eraser className="size-3.5" />
          Gỡ ô
        </Button>
      </div>
    )
  }

  function PageNav({ compact = false }) {
    const canRemovePage = !!(activeChapter && pages.length > 0)
    return (
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="outline" disabled={pageIndex === 0} onClick={() => goPage(-1)}>
          ‹
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          <strong className="text-foreground">{pageIndex + 1}</strong> / {pages.length}
        </span>
        <Button size="icon-sm" variant="outline" disabled={pageIndex >= pages.length - 1} onClick={() => goPage(1)}>
          ›
        </Button>
        {canRemovePage ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={removeCurrentPage}
            title="Gỡ ảnh trang đang xem"
          >
            <Trash2 className="size-3.5" />
            {compact ? 'Gỡ' : 'Gỡ trang'}
          </Button>
        ) : null}
      </div>
    )
  }

  function PageThumbs() {
    if (!pages.length) {
      return <p className="text-xs text-muted-foreground">Chưa có trang — upload ở bên trên.</p>
    }
    return (
      <div className="flex gap-2 overflow-x-auto py-1">
        {pages.map((pg, i) => {
          const badge = notes[`${activeChapterId}-${i}`]?.length ?? 0
          return (
            <button
              key={`${pg.id}-${i}`}
              type="button"
              onClick={() => { setPageIndex(i); setSelectedNoteId(null) }}
              title={pg.name}
              className={cn(
                'relative shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === pageIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30',
              )}
            >
              <span className="manga-page manga-page--thumb-strip block">
                {pg.url ? (
                  <img src={pg.url} alt={pg.name} className="manga-page__media" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                )}
              </span>
              {badge > 0 ? (
                <Badge className="absolute right-0.5 top-0.5 h-4 px-1 text-[9px]" variant="destructive">
                  {badge}
                </Badge>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  function CanvasBoard({ refEl, fs = false }) {
    console.log('[ChapterAnnotator] pages:', pages, 'serverPageIssues:', serverPageIssues)
    return (
      <div
        ref={refEl}
        className={cn(
          'mk-board manga-page manga-page--canvas relative mx-auto',
          tool === 'draw' && 'mk-board--draw',
          tool === 'delete' && 'mk-board--delete',
          fs && 'mk-board--fullscreen',
        )}
        onMouseDown={e => onBoardMouseDown(e, refEl)}
        onMouseMove={e => onBoardMouseMove(e, refEl)}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseUp}
      >
        {effectiveCurrentPageUrl ? (
          <img
            src={effectiveCurrentPageUrl}
            alt=""
            className="mk-board__img manga-page__media"
            draggable={false}
            width={728}
            height={1030}
          />
        ) : (
          <div className="mk-board__placeholder manga-page__empty">
            <span>Trang {pageIndex + 1}</span>
            <p>728×1030 · upload ảnh để xem đúng khổ trang</p>
          </div>
        )}

        {pageNotes.map((n, idx) => {
          const stableKey = noteStableKey(n, idx)
          return (
            <div
              key={stableKey}
              className={cn(
                'mk-note-box',
                selectedNoteId === stableKey && 'selected',
                tool === 'delete' && 'mk-note-box--target',
              )}
              style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${n.w}%`, height: `${n.h}%` }}
              onClick={e => onNoteClick(e, stableKey)}
            >
              <span className="mk-note-box__num">{idx + 1}</span>
              {n.taskType ? (
                <span className="mk-note-box__task" title={n.assignee ? `Giao: ${n.assignee}` : undefined}>
                  {noteTaskLabel(n.taskType)}
                </span>
              ) : null}
              {(selectedNoteId === stableKey || tool === 'delete') ? (
                <button
                  type="button"
                  className="mk-note-box__delete"
                  onClick={e => { e.stopPropagation(); deleteNote(stableKey) }}
                  aria-label={`Gỡ ô ghi chú ${idx + 1}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          )
        })}

        {/* Server-side PageIssue overlays from Assistant/Editor */}
        {(() => {
          // Filter issues theo page đang xem (BE trả về tất cả issues của chapter).
          // Nếu page hiện tại chưa có serverPageId (mới upload, chưa sync lên BE),
          // thì tạm thời không hiển thị server issue nào (issue chỉ tồn tại trên server).
          const currentPageServerId = pages[pageIndex]?.serverPageId ?? pages[pageIndex]?.apiPageId
          const currentPageIdNum = currentPageServerId != null ? Number(currentPageServerId) : null
          const issuesForCurrentPageFiltered = (currentPageIdNum != null && Number.isFinite(currentPageIdNum))
            ? serverPageIssues.filter(issue => {
              const issuePageId = issue.pageid ?? issue.pageId ?? issue.Pageid
              return issuePageId != null && Number(issuePageId) === currentPageIdNum
            })
            : []
          return issuesForCurrentPageFiltered.map((issue, idx) => {
            const boxX = issue.boxX ?? issue.Boxx ?? issue.boxx ?? 0
            const boxY = issue.boxY ?? issue.Boxy ?? issue.boxy ?? 0
            const boxW = issue.boxWidth ?? issue.Boxwidth ?? 0
            const boxH = issue.boxHeight ?? issue.Boxheight ?? 0
            return (
              <div
                key={issue.issueid ?? issue.Issueid ?? `srv-issue-${idx}`}
                className="mk-issue-overlay"
                style={{
                  left: `${boxX}%`,
                  top: `${boxY}%`,
                  width: `${boxW}%`,
                  height: `${boxH}%`,
                }}
                title={`[${issue.issueType ?? issue.Issuetype ?? 'Issue'}] ${issue.description ?? ''}`}
              >
                <span className="mk-issue-overlay__type">
                  {issue.issueType ?? issue.Issuetype ?? '?'}
                </span>
              </div>
            )
          })
        })()}

        {draftRect ? (
          <div
            className="mk-note-box mk-note-box--draft"
            style={{
              left: `${draftRect.x}%`,
              top: `${draftRect.y}%`,
              width: `${draftRect.w}%`,
              height: `${draftRect.h}%`,
            }}
          />
        ) : null}
      </div>
    )
  }

  const NoteItem = memo(function NoteItem({
    note, index, selectedNoteId, hiredAssistants,
    onDelete, onSelect, onUpdate, textareaRefMap,
  }) {
    const stableKey = noteStableKey(note, index)
    return (
      <li
        className={cn(
          'rounded-lg border p-3 transition-all',
          note.isServer
            ? (selectedNoteId === stableKey ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/5')
            : (selectedNoteId === stableKey ? 'border-primary bg-primary/5' : 'bg-background'),
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <Badge variant={note.isServer ? 'secondary' : 'outline'} className={cn(note.isServer && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300')}>
            {note.isServer ? `Đã gửi #${index + 1}` : `Nháp #${index + 1}`}
          </Badge>
          <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(stableKey)}>
            <Trash2 className="size-3" />
            Gỡ
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Loại việc</Label>
          <Select
            value={note.taskType ?? 'background'}
            onValueChange={v => onUpdate(stableKey, 'taskType', v)}
          >
            <SelectTrigger className="h-8" onFocus={() => onSelect(stableKey)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_TASK_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 mt-2">
          <Label className="text-xs">Hạn chót</Label>
          <input
            type="date"
            className="w-full text-xs border rounded px-2 py-1 h-8 bg-background border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-primary"
            value={note.deadline ? String(note.deadline).substring(0, 10) : ''}
            onChange={e => onUpdate(stableKey, 'deadline', e.target.value)}
            onFocus={() => onSelect(stableKey)}
          />
        </div>
        <Textarea
          ref={el => {
            if (el) textareaRefMap.current.set(stableKey, el)
            else textareaRefMap.current.delete(stableKey)
          }}
          className="mt-2 text-sm"
          placeholder="Mô tả chi tiết (VD: vẽ cảnh phố đêm, thêm đèn neon)..."
          defaultValue={note.text ?? ''}
          onInput={e => {
            const value = e.target.value
            draftTextRef.current.set(stableKey, value)
            scheduleNoteSave(stableKey, value)
          }}
          onFocus={() => onSelect(stableKey)}
          rows={3}
        />
      </li>
    )
  })

  function NotesPanel({ inFullscreen = false }) {
    return (
      <Card className={cn('flex flex-col', inFullscreen && 'h-full overflow-hidden')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Ô ghi chú — Trang {pageIndex + 1}</CardTitle>
            {selectedNoteId ? (
              <Button size="xs" variant="ghost" className="text-destructive" onClick={() => deleteNote(selectedNoteId)}>
                Gỡ ô đang chọn
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          {effectiveHiredAssistants.length === 0 ? (
            <Alert className="border-violet-200 bg-violet-50/50 dark:border-violet-500/30 dark:bg-violet-500/5">
              <AlertDescription className="text-xs">
                Bạn có thể tạo chapter và upload ảnh ngay, hoặc gửi thẳng cho {LABEL_TANTOU_EDITOR} (không qua Assistant).
                Nếu muốn giao qua Assistant, hãy{' '}
                {onOpenAssistantsTab ? (
                  <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={onOpenAssistantsTab}>
                    thuê Assistant
                  </button>
                ) : (
                  'thuê Assistant ở tab Thuê Assistant'
                )}
                {' '}trước.
              </AlertDescription>
            </Alert>
          ) : null}

          {tool === 'delete' ? (
            <Alert className="border-destructive/30 bg-destructive/5">
              <Eraser className="size-4 text-destructive" />
              <AlertDescription className="text-xs">
                Đang ở chế độ <strong>gỡ ô ghi chú</strong> — chạm ô trên trang để xóa.
              </AlertDescription>
            </Alert>
          ) : null}

          {pageNotes.length === 0 && issuesForCurrentPage.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Chưa có ô nào. Chọn <strong>Tạo ô</strong>, kéo vùng trên trang, chọn loại việc và giao trợ lý.
            </p>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              {/* Section 1: Đã gửi (Trên server) */}
              <div className="flex flex-col min-h-0 flex-1">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-2">
                  Đã gửi (Trên Server)
                </h4>
                {issuesForCurrentPage.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic mb-2">Chưa có ghi chú nào được gửi.</p>
                ) : (
                  <div className="overflow-y-auto max-h-[220px] pr-1 flex-1">
                    <ul className="space-y-3">
                      {issuesForCurrentPage.map((issue, idx) => {
                        const serverId = String(issue.issueid ?? issue.Issueid ?? issue.id)
                        const rawCategory = issue.workCategory ?? issue.Workcategory ?? 'Background'
                        const taskType = rawCategory.toLowerCase()

                        const mappedNote = {
                          id: serverId,
                          clientKey: serverId,
                          taskType,
                          text: issue.description ?? issue.Description ?? '',
                          deadline: issue.deadline ? String(issue.deadline).substring(0, 10) : '',
                          isServer: true,
                        }

                        return (
                          <NoteItem
                            key={`srv-${serverId}`}
                            note={mappedNote}
                            index={idx}
                            selectedNoteId={selectedNoteId}
                            hiredAssistants={effectiveHiredAssistants}
                            onDelete={deleteNote}
                            onSelect={setSelectedNoteId}
                            onUpdate={updateNoteField}
                            textareaRefMap={noteTextareaRefs}
                          />
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <hr className="border-zinc-200 dark:border-zinc-800" />

              {/* Section 2: Bản nháp chưa gửi */}
              <div className="flex flex-col min-h-0 flex-1">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Bản nháp chưa gửi
                </h4>
                {pageNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Chưa có bản nháp nào. Chọn <strong>Tạo ô</strong> và kéo vùng trên trang.
                  </p>
                ) : (
                  <div className="overflow-y-auto max-h-[220px] pr-1 flex-1">
                    <ul className="space-y-3">
                      {pageNotes.map((n, idx) => (
                        <NoteItem
                          key={noteStableKey(n, idx)}
                          note={n}
                          index={idx}
                          selectedNoteId={selectedNoteId}
                          hiredAssistants={effectiveHiredAssistants}
                          onDelete={deleteNote}
                          onSelect={setSelectedNoteId}
                          onUpdate={updateNoteField}
                          textareaRefMap={noteTextareaRefs}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  function SendActionsBar({ compact = false }) {
    const handleAssistant = () => {
      if (!activeChapter || !onSendToAssistant) return
      if (!selectedAssistantId) {
        toast.error('Vui lòng chọn Assistant trước khi gửi.')
        return
      }
      const page = pages[pageIndex]
      onSendToAssistant({
        chapter: activeChapter,
        pageIndex,
        pageUrl: page?.url ?? null,
        pageName: page?.name,
        notes: pageNotes,
        assistantId: selectedAssistantId,
        apiPageId: page?.serverPageId ?? page?.apiPageId ?? null,
      })
    }
    const handleTantou = async () => {
      if (!activeChapter) return
      const realChapterId = activeChapter.serverChapterId ?? activeChapter.id
      if (!realChapterId || String(realChapterId).startsWith('ch-local-')) {
        toast.error('Chapter này chưa được lưu lên server — vui lòng tạo chapter trước.')
        return
      }
      if (pages.length === 0) {
        toast.error('Chưa có ảnh trang nào để gửi.')
        return
      }
      if (!seriesTantouId) {
        toast.error(`Series này chưa được gán ${LABEL_TANTOU_EDITOR}.`)
        return
      }
      try {
        await updateChapterStatus.mutateAsync({
          id: realChapterId,
          status: 'Ready',
        })
        toast.success(`Đã gửi thẳng cho ${LABEL_TANTOU_EDITOR} của series.`)
        onSendToTantou?.({
          chapter: activeChapter,
          pageIndex,
          pageName: pages[pageIndex]?.name,
          tantouId: seriesTantouId,
        })
      } catch (err) {
        toast.error(`Gửi thất bại: ${err?.message ?? 'Lỗi không xác định'}`)
      }
    }

    return (
      <>
        <Card
          className={cn(
            'border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background',
            compact && 'border-white/10 bg-zinc-900/80 text-white shadow-xl backdrop-blur',
          )}
        >
          <CardContent className={cn('flex flex-wrap items-center gap-3', compact ? 'p-3' : 'p-4')}>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold', compact && 'text-white')}>
                Sẵn sàng bàn giao Trang {pageIndex + 1}
              </p>
              <p className={cn('text-xs', compact ? 'text-zinc-300' : 'text-muted-foreground')}>
                {pageNotes.length > 0
                  ? `${pageNotes.length} ô ghi chú trên trang này · ${totalNotes} ô toàn chapter`
                  : `Chưa ghi chú nào trên trang · ${totalNotes} ô toàn chapter`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pages[pageIndex]?.isSentToMangaka && (
                <Button
                  size="sm"
                  onClick={handleApprovePage}
                  disabled={approvingPage}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white hover:from-emerald-500 hover:to-teal-500 mr-2"
                >
                  {approvingPage ? 'Đang duyệt...' : 'Duyệt bản vẽ'}
                </Button>
              )}
              {onSendToTantou && isSeriesPublishing ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!activeChapter || pages.length === 0}
                  title={`Gửi bản thảo sang ${LABEL_TANTOU_EDITOR}`}
                  onClick={handleTantou}
                  className={cn(compact && 'border-white/20 bg-transparent text-white hover:bg-white/10')}
                >
                  Gửi {LABEL_TANTOU_EDITOR}
                </Button>
              ) : null}
              <Select
                value={selectedAssistantId ?? ''}
                onValueChange={v => setSelectedAssistantId(v || null)}
              >
                <SelectTrigger className={cn('w-48', compact && 'border-white/20 bg-white/10 text-white')}>
                  <SelectValue placeholder="-- Chọn Assistant --" />
                </SelectTrigger>
                <SelectContent>
                  {effectiveHiredAssistants.filter(a => a.assistantId).length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Chưa có Assistant nào
                    </SelectItem>
                  ) : (
                    effectiveHiredAssistants
                      .filter(a => a.assistantId)
                      .map(a => (
                        <SelectItem key={a.assistantId} value={String(a.assistantId)}>
                          {a.label}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={
                  !activeChapter
                  || pages.length === 0
                  || pageNotes.length === 0
                  || !selectedAssistantId
                }
                onClick={handleAssistant}
              >
                <Send className="size-3.5" />
                Gửi ({totalNotes} ô)
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="size-6 justify-center p-0">1</Badge>
            <CardTitle className="text-base">Chapter & upload ảnh</CardTitle>
          </div>
          <CardDescription>
            Chọn chapter, nhập số trang — upload đúng bấy nhiêu ảnh (1 ảnh = 1 trang).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isSeriesDraft && selectedSeriesId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Series này đang ở trạng thái Nháp (Draft)
                </h4>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                  Bạn cần gán {LABEL_TANTOU_EDITOR} và gửi Series duyệt trước khi có thể gửi chapter cho biên tập viên.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-64">
                  <Select
                    value={selectedTantouForSeries || undefined}
                    onValueChange={setSelectedTantouForSeries}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={`— Chọn ${LABEL_TANTOU_EDITOR} —`} />
                    </SelectTrigger>
                    <SelectContent>
                      {tantouEditorsRaw
                        .filter(t => (t.userid ?? t.userId ?? t.user_id ?? t.id))
                        .map(t => {
                          const tid = String(t.userid ?? t.userId ?? t.user_id ?? t.id)
                          const tname = t.fullname ?? t.fullName ?? t.full_name ?? t.name ?? t.username ?? 'Tantou'
                          return <SelectItem key={tid} value={tid}>{tname}</SelectItem>
                        })}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={!selectedTantouForSeries || isSubmittingSeriesReview}
                  onClick={handleSendSeriesForReview}
                >
                  {isSubmittingSeriesReview ? 'Đang gửi...' : 'Gửi duyệt Series'}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Series (draft)</Label>
            <Select
              value={selectedSeriesTitle || undefined}
              onValueChange={(v) => onSelectedSeriesTitleChange(v)}
              disabled={seriesOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Chọn series —" />
              </SelectTrigger>
              <SelectContent>
                {seriesOptions
                  .filter(s => s.title) // chặn luôn SelectItem value="" gây cùng 1 bug
                  .map(s => (
                    <SelectItem key={s.id} value={s.title}>{s.title}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {chapterNumHint ? <p className="text-xs text-muted-foreground">{chapterNumHint}</p> : null}
            {selectedSeriesPipeline?.needsFullDebutPipeline ? (
              <Alert>
                <AlertDescription className="text-xs">
                  <strong>✦ Lần đầu:</strong> Assistant → bạn duyệt → {LABEL_TANTOU_EDITOR} → {LABEL_EDITOR_BOARD} biểu quyết → xuất bản.
                </AlertDescription>
              </Alert>
            ) : selectedSeriesPipeline ? (
              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Lần 2+:</strong> {LABEL_TANTOU_EDITOR} duyệt trực tiếp → xuất bản.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Chapter</h3>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tiêu đề chapter (mặc định: Ch. {nextChapterNum})</Label>
                  <Input
                    size="sm"
                    placeholder={`Ch. ${nextChapterNum}`}
                    value={newChapterTitle}
                    onChange={e => setNewChapterTitle(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hạn nộp bản thảo</Label>
                  <Input
                    size="sm"
                    type="date"
                    value={newChapterDeadline}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setNewChapterDeadline(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!selectedSeriesTitle.trim()}
                  onClick={createNewChapter}
                >
                  <Plus className="size-3.5" />
                  Tạo Chapter {nextChapterNum}
                </Button>
              </div>

              {seriesChapters.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có chapter — bấm nút trên để tạo Ch. {nextChapterNum}.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border divide-y bg-background">
                  <ul className="divide-y">
                    {seriesChapters.map(ch => {
                      const isPick = ch.id === activeChapterId
                      const noteCount = countChapterNotes(ch.id, ch.pages, notes)
                      const thumb = ch.cover?.url ?? ch.pages?.[0]?.url
                      const pageTotal = ch.pages.length || ch.pageCount || 0
                      return (
                        <li
                          key={ch.id}
                          className={cn(
                            'group flex items-center gap-2 px-3 py-2 transition-colors',
                            isPick ? 'bg-primary/10' : 'hover:bg-muted/50',
                          )}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                            onClick={() => activateChapter(ch, 0)}
                          >
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                              {thumb ? (
                                <img src={thumb} alt="" className="size-full object-cover" />
                              ) : (
                                <ImageIcon className="size-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">Ch. {ch.num}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {pageTotal} trang{ch.cover ? ' · có bìa' : ''}
                                  {ch.isApi ? ' · server' : ''}
                                </p>
                              </div>
                              {chapterStatusLabel(ch.apiStatus) ? (
                                <Badge
                                  variant="outline"
                                  className={cn('shrink-0 border px-1.5 py-0 text-[10px] font-medium', chapterStatusBadgeClass(ch.apiStatus))}
                                  title={`Trạng thái chapter trên server: ${ch.apiStatus}`}
                                >
                                  {chapterStatusLabel(ch.apiStatus)}
                                </Badge>
                              ) : null}
                              {noteCount > 0 ? (
                                <Badge variant="secondary" className="shrink-0 text-[10px]">
                                  {noteCount} ô
                                </Badge>
                              ) : null}
                            </div>
                          </button>
                          <span
                            className="cursor-pointer p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Xóa chapter"
                            onClick={(e) => { e.stopPropagation(); console.log('[DEBUG] click delete', ch.id, ch.num); deleteChapter(ch.id) }}
                          >
                            <Trash2 className="size-3.5" />
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Upload{uploadTargetChapter ? <> — <strong>Ch. {uploadTargetChapter.num}</strong></> : null}
                </h3>
                {uploadTargetChapter ? (
                  <Badge variant="outline" className="text-[10px]">
                    {uploadTargetChapter.pages.length} trang
                    {uploadTargetChapter.cover ? ' · có bìa' : ''}
                  </Badge>
                ) : null}
              </div>

              {uploadRejectMessage ? (
                <Alert variant="destructive">
                  <AlertDescription>{uploadRejectMessage}</AlertDescription>
                </Alert>
              ) : null}

              <input
                ref={coverFileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                hidden
                disabled={!uploadTargetChapter}
                onChange={onCoverChange}
              />
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ImageIcon className="size-3.5" />
                    Ảnh bìa chapter
                  </div>
                  {uploadTargetChapter?.cover ? (
                    <Button size="xs" variant="ghost" className="text-destructive" onClick={removeCover}>
                      <Trash2 className="size-3" />
                      Gỡ
                    </Button>
                  ) : null}
                </div>
                {uploadTargetChapter?.cover ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => uploadTargetChapter && coverFileRef.current?.click()}
                      className="group relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-background"
                      title="Bấm để đổi ảnh bìa"
                    >
                      <img src={uploadTargetChapter.cover.url} alt="Ảnh bìa" className="size-full object-cover transition-transform group-hover:scale-105" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{uploadTargetChapter.cover.name || 'cover.png'}</p>
                      <p className="text-xs text-muted-foreground">Bấm vào ảnh để đổi.</p>
                      <Button
                        size="xs"
                        variant="outline"
                        className="mt-2"
                        onClick={() => uploadTargetChapter && coverFileRef.current?.click()}
                      >
                        <Upload className="size-3" />
                        Đổi ảnh
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
                      uploadTargetChapter
                        ? 'hover:border-primary/50 hover:bg-muted/50'
                        : 'cursor-not-allowed opacity-60',
                    )}
                    onDrop={uploadTargetChapter ? onCoverDrop : e => e.preventDefault()}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => { if (uploadTargetChapter) coverFileRef.current?.click() }}
                    role={uploadTargetChapter ? 'button' : undefined}
                  >
                    <ImageIcon className="size-5 text-muted-foreground" />
                    <p className="text-xs font-medium">Bấm hoặc kéo thả ảnh bìa</p>
                    <p className="text-[11px] text-muted-foreground">
                      {uploadTargetChapter ? 'Chỉ 1 ảnh — dùng làm thumbnail chapter.' : 'Tạo / chọn chapter trước'}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  canUpload
                    ? 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
                    : 'cursor-not-allowed border-muted bg-muted/20 opacity-60',
                  uploadUi && 'border-primary bg-primary/5',
                  isDragOver && canUpload && 'border-primary bg-primary/10 ring-4 ring-primary/20',
                )}
                onDrop={canUpload ? onDrop : e => e.preventDefault()}
                onDragOver={e => e.preventDefault()}
                onDragEnter={e => { e.preventDefault(); if (canUpload) setIsDragOver(true) }}
                onDragLeave={e => {
                  // chỉ tắt khi rời khỏi dropzone hoàn toàn
                  if (e.currentTarget.contains(e.relatedTarget)) return
                  setIsDragOver(false)
                }}
                onClick={() => { if (canUpload) fileRef.current?.click() }}
                role={canUpload ? 'button' : undefined}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  hidden
                  disabled={!canUpload}
                  onChange={onFileChange}
                />
                <div className={cn(
                  'flex size-12 items-center justify-center rounded-xl transition-transform',
                  isDragOver && canUpload ? 'scale-110 bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                )}>
                  <Upload className="size-5" />
                </div>
                <p className="text-sm font-medium">
                  {isDragOver && canUpload
                    ? 'Thả ảnh vào đây để upload'
                    : 'Kéo thả ảnh trang hoặc bấm để chọn'}
                </p>
                {uploadUi ? (
                  <p className="text-xs text-primary">
                    Đang tải <strong>{uploadUi.series}</strong> · Ch. <strong>{uploadUi.chapter}</strong> · {uploadUi.pct}%
                  </p>
                ) : isDragOver && canUpload ? (
                  <p className="text-xs font-medium text-primary">
                    Chấp nhận nhiều ảnh PNG/JPG/WEBP
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {!selectedSeriesTitle.trim()
                      ? 'Chọn series ở trên'
                      : !uploadTargetChapter
                        ? 'Tạo hoặc chọn chapter bên trái'
                        : `Thêm ảnh vào Ch. ${uploadTargetChapter.num} (${uploadTargetChapter.pages.length} trang đã có)`}
                  </p>
                )}
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      {activeChapter ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="size-6 justify-center p-0">2</Badge>
                <div>
                  <CardTitle className="text-base">Ghi chú trên trang truyện</CardTitle>
                  <CardDescription>
                    <strong>{activeChapter.series}</strong> · Ch. <strong>{activeChapter.num}</strong>
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pages[pageIndex]?.isSentToMangaka && (
                  <Button
                    size="sm"
                    onClick={handleApprovePage}
                    disabled={approvingPage}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white hover:from-emerald-500 hover:to-teal-500"
                  >
                    {approvingPage ? 'Đang duyệt...' : 'Duyệt bản vẽ'}
                  </Button>
                )}
                <ToolButtons />
                <Button size="sm" variant="outline" onClick={() => setIsFullscreen(true)}>
                  <Maximize2 className="size-3.5" />
                  Phóng to
                </Button>
                <Badge variant="secondary">
                  {totalNotes} ô · {pages.length} trang
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PageNav />
              <div className="min-w-0 flex-1 overflow-x-auto">
                <PageThumbs />
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="flex justify-center rounded-lg border bg-zinc-950 p-4">
                <CanvasBoard refEl={boardRef} />
              </div>
              <NotesPanel />
            </div>
            <SendActionsBar />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chọn hoặc tạo chapter ở <strong>Bước 1</strong> để bắt đầu ghi chú.
          </CardContent>
        </Card>
      )}

      {isFullscreen && activeChapter ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950" role="dialog" aria-modal="true">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900 px-5 py-3 text-white">
            <div>
              <strong>{activeChapter.series} — Ch.{activeChapter.num}</strong>
              <span className="ml-2 text-sm text-zinc-400">· Trang {pageIndex + 1}/{pages.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pages[pageIndex]?.isSentToMangaka && (
                <Button
                  size="sm"
                  onClick={handleApprovePage}
                  disabled={approvingPage}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white hover:from-emerald-500 hover:to-teal-500 mr-2"
                >
                  {approvingPage ? 'Đang duyệt...' : 'Duyệt bản vẽ'}
                </Button>
              )}
              <ToolButtons />
              <PageNav compact />
              <Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setIsFullscreen(false)}>
                <X className="size-4" />
                Thu nhỏ
              </Button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-4 overflow-hidden p-4">
            <div className="flex items-center justify-center overflow-hidden">
              <CanvasBoard refEl={fsBoardRef} fs />
            </div>
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <div className="min-h-0 flex-1 overflow-hidden">
                <NotesPanel inFullscreen />
              </div>
              <SendActionsBar compact />
            </div>
          </div>

          <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-zinc-900 p-2">
            {pages.map((pg, i) => (
              <button
                key={`${pg.id}-${i}`}
                type="button"
                onClick={() => { setPageIndex(i); setSelectedNoteId(null) }}
                title={pg.name}
                className={cn(
                  'shrink-0 overflow-hidden rounded border-2 transition-colors',
                  i === pageIndex ? 'border-primary' : 'border-transparent',
                )}
              >
                <span className="manga-page manga-page--thumb-strip block">
                  {pg.url ? (
                    <img src={pg.url} alt={pg.name} className="manga-page__media" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-zinc-500">{i + 1}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Overlay hint toàn trang khi đang kéo file vào */}
      {isDragOver && canUpload ? (
        <div
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-sm"
          aria-hidden="true"
        >
          <div className="rounded-2xl border-2 border-dashed border-primary bg-background/80 px-10 py-8 text-center shadow-2xl">
            <Upload className="mx-auto size-10 text-primary" />
            <p className="mt-3 text-base font-semibold text-foreground">Thả ảnh để upload vào Ch. {uploadTargetChapter?.num}</p>
            <p className="mt-1 text-xs text-muted-foreground">PNG / JPG / WEBP — có thể thả nhiều ảnh cùng lúc</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}