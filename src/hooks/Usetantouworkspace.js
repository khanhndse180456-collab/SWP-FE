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

  // ── Chapter + pages thật của series đang review ───────────────────────────
  // Chỉ fetch khi đang mở review (reviewOpen) để tránh gọi API thừa.
  const reviewSeriesId = reviewOpen ? selectedSub?.seriesid : undefined
  const { data: reviewChapters = [], isLoading: reviewChaptersLoading } = useChapters(reviewSeriesId)

  // Chapter đầu tiên (nhỏ nhất theo chapternumber) — chapter Mangaka mới gửi lên
  const reviewChapter = useMemo(() => {
    if (!Array.isArray(reviewChapters) || reviewChapters.length === 0) return null
    return [...reviewChapters].sort((a, b) => {
      const an = a.chapternumber ?? a.Chapternumber ?? 0
      const bn = b.chapternumber ?? b.Chapternumber ?? 0
      return an - bn
    })[0]
  }, [reviewChapters])

  const reviewChapterId = reviewChapter
    ? (reviewChapter.chapterid ?? reviewChapter.Chapterid ?? reviewChapter.id)
    : undefined

  const reviewChapterNumber = reviewChapter
    ? (reviewChapter.chapternumber ?? reviewChapter.Chapternumber ?? '—')
    : '—'

  const { data: reviewPagesRaw = [], isLoading: reviewPagesLoading } = usePages(reviewChapterId)

  // Map về shape gọn cho TantouPageReview: { serverPageId, url, name }
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

  // MỚI: Gộp sẵn "submission" đầy đủ cho TantouPageReview — trước đây component
  // cha (TantouEditor.jsx) tự ráp lại field chapterNum/pageLabel/pipeline từ nhiều
  // nguồn khác nhau và bị thiếu (gây ra "Ch. —" và trang trống). Giờ hook trả về
  // sẵn 1 object đầy đủ, component cha chỉ cần dùng thẳng làm prop `submission`.
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

  // Backend state machine: Draft → EditorReview → EBReview (không cho nhảy thẳng
  // Draft → EBReview, xem _validTransitions trong SeriesService.cs). Tantou "Chuyển
  // sang EB" phải đi qua EditorReview trước nếu series đang ở Draft.
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
    handleRefreshStudio,
    // review
    selectedSub,
    reviewSubmission, // ← MỚI: dùng thẳng làm prop `submission` cho TantouPageReview
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