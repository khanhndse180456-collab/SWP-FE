import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()

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
  // LƯU Ý: filter KHÔNG loại bỏ 'draft'/'submitted'/'ready' để Tantou luôn thấy
  // chapter Mantou vừa gửi — kể cả khi BE chưa đổi status (lỗi 400) hoặc status
  // nằm ngoài whitelist. Chỉ loại 'cancelled' (xóa) và 'published' (đã xong);
  // 'ready' (đã gửi EB) vẫn hiển thị trong section "Đang chờ EB chấm".
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
          st !== 'cancelled' &&
          st !== 'published'
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

  // MỚI: tự động refetch chapter + series khi Tantou quay lại tab trình duyệt
  // hoặc tab app — đảm bảo chapter mới do Mangaka gửi sẽ hiện ngay khi Tantou
  // mở lại trang studio, không phải F5 thủ công. Pattern giống Mangaka: dùng
  // queryClient.invalidateQueries sau mỗi thao tác.
  useEffect(() => {
    function refreshOnVisible() {
      if (document.visibilityState !== 'visible') return
      queryClient.invalidateQueries({ queryKey: ['chapters'] })
      queryClient.invalidateQueries({ queryKey: ['series'] })
    }
    document.addEventListener('visibilitychange', refreshOnVisible)
    window.addEventListener('focus', refreshOnVisible)
    return () => {
      document.removeEventListener('visibilitychange', refreshOnVisible)
      window.removeEventListener('focus', refreshOnVisible)
    }
  }, [queryClient])

  // MỚI: polling mỗi 30 giây để đảm bảo Tantou luôn thấy chapter mới nhất
  // do Mangaka gửi mà không cần thao tác tay. Cùng cadence với
  // useNotifications (staleTime: 30_000). Dừng khi tab ẩn để tiết kiệm.
  useEffect(() => {
    let id = null
    function start() {
      if (id) return
      id = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['chapters'] })
        queryClient.invalidateQueries({ queryKey: ['series'] })
      }, 30_000)
    }
    function stop() {
      if (id) { clearInterval(id); id = null }
    }
    function sync() {
      if (document.visibilityState === 'visible') start()
      else stop()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [queryClient])

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
    () => studioChapters
      .map(ch => {
        const seriesInfo = seriesById.get(ch.seriesid) ?? null
        // Hiện chapter khi series đã được Tantou duyệt (EBReview trở đi)
        const isAccepted = seriesInfo && (isEbStatus(seriesInfo.status) || isApprovedStatus(seriesInfo.status))
        return {
          ...ch,
          seriesInfo,
          _hidden: !isAccepted,
        }
      })
      .filter(ch => !ch._hidden)
      .map(({ _hidden, ...rest }) => rest),
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

  // ── Accept series (Debut queue) ────────────────────────────────────────────
  async function handleAcceptSeries(seriesId) {
    try {
      const series = debutQueue.find(s => s.seriesid === seriesId)
      // Nếu series còn ở Draft thì phải đẩy qua EditorReview trước,
      // vì BE không cho chuyển thẳng Draft → EBReview.
      if (series && normalizeStatus(series.status) === 'draft') {
        await axiosClient.patch(`/Series/${seriesId}/status`, { status: 'EditorReview' })
      }
      await axiosClient.patch(`/Series/${seriesId}/status`, { status: 'EBReview' })
      toast.success('Đã chấp nhận series.')
      await loadSeries()
      await queryClient.invalidateQueries({ queryKey: ['chapters'] })
    } catch { /* interceptor toast */ }
  }

  // ── Reject series (Debut queue) ────────────────────────────────────────────
  async function handleRejectSeries(seriesId, reason) {
    const safeReason = (reason ?? '').trim()
    if (!safeReason) {
      toast.error('Nhập lý do từ chối.')
      return false
    }
    try {
      // NOTE: Bảng Series hiện KHÔNG có cột rejectReason — chỉ gửi status.
      // TODO: Sau khi BE thêm cột rejectReason, gửi kèm để lưu lý do.
      await axiosClient.patch(`/Series/${seriesId}/status`, {
        status: 'Cancelled',
      })
      toast.success('Đã từ chối series.')
      setSelectedSeriesId(null)
      await loadSeries()
      await queryClient.invalidateQueries({ queryKey: ['chapters'] })
      await queryClient.invalidateQueries({ queryKey: ['series'] })
      return true
    } catch { return false }
  }

  // ── Chapter actions (Studio) ───────────────────────────────────────────────
  async function handleChapterForwardEb(chapterId) {
    try {
      await axiosClient.patch(`/Chapters/${chapterId}/status`, 'Ready')
      toast.success('Đã gửi chapter cho EB xem.')
      await loadStudioChapters(new Map(series.map(s => [s.seriesid, s])))
      await queryClient.invalidateQueries({ queryKey: ['chapters'] })
    } catch { /* interceptor toast */ }
  }

  async function handleChapterRequestRevision(chapterId, comment) {
    // Bỏ validation ghi chú — nhận xét nằm trong các box trên ảnh (đã gửi riêng khi tạo)
    try {
      await axiosClient.patch(`/Chapters/${chapterId}/request-revision`, { Comment: comment || '' })
      toast.success('Đã gửi yêu cầu sửa cho Mangaka.')
      await loadStudioChapters(new Map(series.map(s => [s.seriesid, s])))
    } catch { /* interceptor toast */ }
  }

  async function handleChapterApprove(chapterId) {
    try {
      await axiosClient.patch(`/Chapters/${chapterId}/status`, 'Published')
      toast.success('Đã duyệt chapter thành công.')
      await loadStudioChapters(new Map(series.map(s => [s.seriesid, s])))
      await queryClient.invalidateQueries({ queryKey: ['chapters'] })
    } catch { /* interceptor toast */ }
  }

  function handleRefreshStudio() {
    const map = new Map()
    series.forEach(s => map.set(s.seriesid, s))
    loadStudioChapters(map)
    // MỚI: đồng bộ cache React Query giống pattern Mangaka — đảm bảo useChapters()
    // ở TantouPageReview cũng được refetch, không chỉ studioQueue state.
    queryClient.invalidateQueries({ queryKey: ['chapters'] })
    queryClient.invalidateQueries({ queryKey: ['series'] })
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
    handleAcceptSeries,
    handleRejectSeries,
    handleChapterForwardEb,
    handleChapterRequestRevision,
    handleChapterApprove,
    // schedule
    savingScheduleId,
    handleSetSchedule,
  }
}