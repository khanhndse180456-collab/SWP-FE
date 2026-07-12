import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import axiosClient from '@/api/axiosClient.js'
import { useChapters, usePages } from '@/api/hooks'
import { LABEL_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import {
  normalizeStatus,
  isDebutStatus,
  isApprovedStatus,
  isEbStatus,
  cadenceFromFormat,
} from '@/pages/User/Tantou/TantouEditor.helpers.jsx'

export function useTantouWorkspace() {
  // ── Series ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [series, setSeries] = useState([])

  // ── Studio chapters (chỉ xem — duyệt chapter là quyền EB) ────────────────
  const [studioLoading, setStudioLoading] = useState(false)
  const [studioChapters, setStudioChapters] = useState([])

  // ── Review (Mangaka → Tantou) ────────────────────────────────────────────
  const [selectedSub, setSelectedSub] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [editorialComment, setEditorialComment] = useState('')
  const [reviewPageIndex, setReviewPageIndex] = useState(0)

  // ── Lịch xuất bản ─────────────────────────────────────────────────────────
  const [savingScheduleId, setSavingScheduleId] = useState(null)

  // ── Load series ───────────────────────────────────────────────────────────
  const loadSeries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosClient.get('/Series')
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      const active = raw.filter(s => {
        const st = normalizeStatus(s.status)
        return st !== 'cancelled' && st !== 'completed'
      })
      setSeries(active)
    } catch { /* interceptor toast */ }
    finally { setLoading(false) }
  }, [])

  // ── Load chapter studio (phụ thuộc seriesById) ────────────────────────────
  const loadStudioChapters = useCallback(async (seriesMap) => {
    if (seriesMap.size === 0) return
    setStudioLoading(true)
    try {
      const res = await axiosClient.get('/Chapters')
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      const active = raw.filter(ch => {
        const st = normalizeStatus(ch.status)
        return (
          seriesMap.has(ch.seriesid) &&
          st !== 'draft' &&
          st !== 'cancelled'
        )
      })
      setStudioChapters(active)
    } catch { /* interceptor toast */ }
    finally { setStudioLoading(false) }
  }, [])

  useEffect(() => { loadSeries() }, [loadSeries])

  useEffect(() => {
    if (loading) return
    const map = new Map()
    series.forEach(s => map.set(s.seriesid, s))
    loadStudioChapters(map)
  }, [loading, series, loadStudioChapters])

  // ── Derived ───────────────────────────────────────────────────────────────
  const seriesById = useMemo(() => {
    const map = new Map()
    series.forEach(s => map.set(s.seriesid, s))
    return map
  }, [series])

  const debutQueue = useMemo(
    () => series.filter(s => isDebutStatus(s.status)),
    [series],
  )

  const ebQueue = useMemo(
    () => series.filter(s => isEbStatus(s.status)),
    [series],
  )

  const scheduleSeries = useMemo(
    () => series
      .filter(s => isApprovedStatus(s.status))
      .map(s => ({ ...s, cadence: cadenceFromFormat(s.publishformat) })),
    [series],
  )

  const studioQueue = useMemo(
    () => studioChapters.map(ch => ({
      ...ch,
      seriesInfo: seriesById.get(ch.seriesid) ?? null,
    })),
    [studioChapters, seriesById],
  )

  const delayedCount = useMemo(
    () => studioQueue.filter(ch => normalizeStatus(ch.status) === 'delayed').length,
    [studioQueue],
  )

  // MỚI: tập seriesid đang có ít nhất 1 chapter chưa Published — tức còn
  // "sống", có khả năng có trang để Tantou nhận xét. Dùng để disable nút
  // "Mở & nhận xét" ở SubmissionCard cho series chưa có chapter nào, tránh
  // user bấm vào rồi mới thấy khung đen/toast lỗi. Tận dụng lại studioChapters
  // đã fetch sẵn — không tốn thêm API call.
  const seriesWithPendingChapter = useMemo(() => {
    const set = new Set()
    studioChapters.forEach(ch => {
      if (normalizeStatus(ch.status) !== 'published') set.add(ch.seriesid)
    })
    return set
  }, [studioChapters])

  // ── Chapter + pages thật của series đang review ───────────────────────────
  const reviewSeriesId = reviewOpen ? selectedSub?.seriesid : undefined
  const { data: reviewChapters = [], isLoading: reviewChaptersLoading } = useChapters(reviewSeriesId)

  // Ưu tiên chapter CHƯA Published (còn cần Tantou xử lý); trong nhóm đó lấy
  // chapter tạo gần đây nhất. Nếu không còn chapter nào chưa Published thì
  // mới fallback về toàn bộ danh sách (mới nhất trước).
  const reviewChapter = useMemo(() => {
    if (!Array.isArray(reviewChapters) || reviewChapters.length === 0) return null
    const pending = reviewChapters.filter(ch => normalizeStatus(ch.status) !== 'published')
    const pool = pending.length > 0 ? pending : reviewChapters
    return [...pool].sort((a, b) => {
      const ad = new Date(a.createdat ?? a.Createdat ?? 0).getTime()
      const bd = new Date(b.createdat ?? b.Createdat ?? 0).getTime()
      return bd - ad
    })[0]
  }, [reviewChapters])

  const reviewChapterId = reviewChapter
    ? (reviewChapter.chapterid ?? reviewChapter.Chapterid ?? reviewChapter.id)
    : undefined

  const reviewChapterNumber = reviewChapter
    ? (reviewChapter.chapternumber ?? reviewChapter.Chapternumber ?? '—')
    : '—'

  const { data: reviewPagesRaw = [], isLoading: reviewPagesLoading } = usePages(reviewChapterId)

  const reviewPages = useMemo(() => {
    if (!Array.isArray(reviewPagesRaw)) return []
    return reviewPagesRaw
      .filter(p => p && (p.pageimageurl ?? p.Pageimageurl))
      .sort((a, b) => (a.pagenumber ?? a.Pagenumber ?? 0) - (b.pagenumber ?? b.Pagenumber ?? 0))
      .map((p, i) => ({
        serverPageId: p.pageid ?? p.Pageid,
        url: p.pageimageurl ?? p.Pageimageurl,
        name: `Trang ${p.pagenumber ?? p.Pagenumber ?? i + 1}`,
      }))
  }, [reviewPagesRaw])

  const reviewSubmission = useMemo(() => {
    if (!selectedSub) return null
    const st = normalizeStatus(selectedSub.status)
    const pipeline = isDebutStatus(st) ? 'debut' : 'recurring'
    const currentPage = reviewPages[reviewPageIndex] ?? null
    return {
      seriesid: selectedSub.seriesid,
      seriesTitle: selectedSub.title ?? selectedSub.seriesTitle ?? '—',
      chapterNum: reviewChapterNumber,
      pageLabel: currentPage?.name ?? (reviewPages.length ? `Trang ${reviewPageIndex + 1}` : '—'),
      pipeline,
      mangakaImageUrl: currentPage?.url ?? null,
    }
  }, [selectedSub, reviewChapterNumber, reviewPages, reviewPageIndex])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openReview(sub) {
    setSelectedSub({ ...sub, __kind: 'series' })
    setEditorialComment('')
    setReviewPageIndex(0)
    setReviewOpen(true)
  }

  function closeReview() {
    setReviewOpen(false)
    setSelectedSub(null)
    loadSeries()
  }

  async function handleForwardEb() {
    if (!selectedSub) return
    try {
      const currentStatus = normalizeStatus(selectedSub.status)
      if (currentStatus === 'draft') {
        await axiosClient.patch(`/Series/${selectedSub.seriesid}/status`, { status: 'EditorReview' })
      }
      await axiosClient.patch(`/Series/${selectedSub.seriesid}/status`, { status: 'EBReview' })
      toast.success(`Đã chuyển "${selectedSub.title}" sang ${LABEL_EDITOR_BOARD}.`)
      setReviewOpen(false)
      loadSeries()
    } catch { /* interceptor toast */ }
  }

  async function handleRequestRevision() {
    if (!selectedSub) return
    if (!editorialComment.trim()) {
      toast.error('Nhập ghi chú trước khi yêu cầu Mangaka chỉnh sửa.')
      return
    }
    try {
      await axiosClient.patch(`/Series/${selectedSub.seriesid}/request-revision`, {
        Comment: editorialComment.trim(),
      })
      toast.success('Đã gửi yêu cầu chỉnh sửa cho Mangaka.')
      setReviewOpen(false)
      loadSeries()
    } catch { /* interceptor toast */ }
  }

  async function handleSetSchedule(seriesid, cadence) {
    const publishformat = cadence === 'weekly' ? 'Weekly' : 'Monthly'
    setSavingScheduleId(seriesid)
    try {
      await axiosClient.patch(`/Series/${seriesid}/publish-format`, { Publishformat: publishformat })
      toast.success(`Đã đặt lịch ${cadence === 'weekly' ? 'theo tuần' : 'theo tháng'}.`)
      await loadSeries()
    } catch { /* interceptor toast */ }
    finally { setSavingScheduleId(null) }
  }

  function handleRefreshStudio() {
    const map = new Map()
    series.forEach(s => map.set(s.seriesid, s))
    loadStudioChapters(map)
  }

  return {
    // series
    loading,
    debutQueue,
    ebQueue,
    scheduleSeries,
    loadSeries,
    // studio
    studioLoading,
    studioQueue,
    delayedCount,
    seriesWithPendingChapter,
    handleRefreshStudio,
    // review
    selectedSub,
    reviewSubmission,
    reviewOpen,
    editorialComment,
    setEditorialComment,
    reviewPageIndex,
    setReviewPageIndex,
    reviewChapterId,
    reviewChapterNumber,
    reviewPages,
    reviewPagesLoading: reviewChaptersLoading || reviewPagesLoading,
    openReview,
    closeReview,
    handleForwardEb,
    handleRequestRevision,
    // schedule
    savingScheduleId,
    handleSetSchedule,
  }
}