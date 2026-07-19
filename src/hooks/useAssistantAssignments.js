import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getSession } from '@/lib/auth'
import { chaptersService } from '@/api'
import { seriesService } from '@/api'
import { pagesService } from '@/api'
import { pageIssuesService } from '@/api/api.js'
import axiosClient from '@/api/axiosClient.js'
import { normalizeChapterStatus, normalizeContractStatus, isOpenRevisionIssue } from '@/utils/statusMap.js'

// LƯU Ý QUAN TRỌNG:
// Backend KHÔNG có controller `Submissions` hay `Contracts` (đã kiểm tra
// toàn bộ Swagger). Mọi cuộc gọi tới /Submissions/* hoặc /Contracts/* sẽ
// luôn 404 vì endpoint không tồn tại — không phải lỗi URL sai, mà là tính
// năng chưa được backend implement. Đã bỏ hoàn toàn 2 nguồn này khỏi hook.
// Nguồn dữ liệu hợp lệ duy nhất cho assignment của Assistant:
//   - GET /api/Chapters/assistant/{assistantId}
//   - GET /api/MangakaAssistant (quan hệ hợp tác Mangaka-Assistant)
// TODO: nếu sản phẩm cần luồng "Assistant nộp bài / submission review",
// cần đề xuất DUYKHANH thêm SubmissionsController thật ở backend.

// Đếm số page_issues đang mở (Revision + Reported/InProgress) cho 1 danh
// sách pageId. BE chỉ có endpoint lọc theo pageId nên phải gọi song song
// theo từng trang — nếu sau này BE thêm filter theo chapterId, gộp lại
// thành 1 request duy nhất ở đây.
async function countOpenRevisionsForPages(pageIds) {
  if (!pageIds.length) return 0
  const results = await Promise.all(
    pageIds.map(async (pid) => {
      try {
        const res = await pageIssuesService.getAll({ pageId: pid })
        const raw = res?.data
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
        return list.filter(isOpenRevisionIssue).length
      } catch {
        return 0
      }
    }),
  )
  return results.reduce((sum, n) => sum + n, 0)
}

async function enrichChapterWithSeries(chapter) {
  const cid = chapter.chapterid ?? chapter.Chapterid ?? chapter.id ?? null
  const sid = chapter.seriesid ?? chapter.Seriesid ?? null

  let seriesTitle = null
  if (sid) {
    try {
      const sr = await seriesService.getById(sid)
      seriesTitle = sr?.data?.title ?? null
    } catch { /* ignore */ }
  }

  let pageList = []
  try {
    const pagesRes = await pagesService.getAll(cid)
    pageList = Array.isArray(pagesRes?.data) ? pagesRes.data : []
  } catch { /* ignore */ }

  const pageIds = pageList.map(p => p.pageid).filter(Boolean)
  const openRevisionCount = await countOpenRevisionsForPages(pageIds)

  return {
    contractId: null,
    mangakaId: chapter.mangakaid ?? chapter.Mangakaid ?? null,
    mangakaName: null,
    seriesId: sid,
    chapterId: cid,
    seriesTitle: seriesTitle ?? 'Unknown Series',
    chapterNum: chapter.chapter_number ?? chapter.chapternumber ?? chapter.ChapterNumber ?? null,
    title: chapter.title ?? chapter.Title ?? null,
    status: normalizeChapterStatus(chapter.status ?? chapter.Status ?? 'InProduction'),
    openRevisionCount,
    pages: pageList.map(p => ({
      id: p.pageid,
      url: p.pageimageurl,
      pageNum: p.pagenumber,
    })),
    pageCount: pageList.length,
  }
}

async function enrichMangakaAssistantRow(row) {
  const sid = row.seriesid ?? row.Seriesid ?? row.seriesId ?? null

  const base = {
    contractId: row.id ?? row.mangakaassistantid ?? row.MangakaAssistantId ?? null,
    mangakaId: row.mangakaid ?? row.Mangakaid ?? row.mangakaId ?? null,
    mangakaName: row.mangakaName ?? row.mangaka_name ?? null,
    seriesId: sid,
    chapterId: null,
    seriesTitle: null,
    chapterNum: null,
    title: null,
    status: normalizeContractStatus(row.status ?? 'Active'),
    openRevisionCount: 0,
    pages: [],
    pageCount: 0,
  }

  if (!sid) return { ...base, seriesTitle: base.seriesTitle ?? 'Unknown Series' }

  try {
    const sr = await seriesService.getById(sid)
    return { ...base, seriesTitle: sr?.data?.title ?? 'Unknown Series' }
  } catch {
    return { ...base, seriesTitle: 'Unknown Series' }
  }
}

export function useAssistantAssignments() {
  const session = getSession()
  const assistantId = session?.id ?? session?.userid ?? null
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!assistantId) {
      setAssignments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Nguồn 1: chapter được giao trực tiếp cho assistant này
      const chaptersRes = await chaptersService.getByAssistant(assistantId)
      const chapterList = Array.isArray(chaptersRes?.data) ? chaptersRes.data : []
      const chapterAssignments = await Promise.all(chapterList.map(enrichChapterWithSeries))

      // Nguồn 2: quan hệ hợp tác Mangaka-Assistant (dùng để hiện các
      // series đang hợp tác dù chưa có chapter cụ thể nào được giao)
      let assistantRows = []
      try {
        const res = await axiosClient.get('/MangakaAssistant', { params: { assistantId } })
        const all = Array.isArray(res?.data) ? res.data : []
        assistantRows = all.filter(r =>
          String(r.assistantid ?? r.Assistantid ?? r.assistantId ?? '') === String(assistantId)
        )
      } catch (err) {
        console.warn('[useAssistantAssignments] failed to fetch MangakaAssistant:', err)
      }
      const relationAssignments = await Promise.all(assistantRows.map(enrichMangakaAssistantRow))

      // Deduplicate: ưu tiên chapter assignment nếu cùng seriesId đã có
      const seriesIds = new Set(chapterAssignments.map(a => a.seriesId).filter(Boolean))
      const extraRelations = relationAssignments.filter(a => !a.seriesId || !seriesIds.has(a.seriesId))

      const seen = new Set()
      const dedup = (arr) => arr.filter(a => {
        const source = a.chapterId ? 'chapter' : a.contractId ? 'contract' : 'unknown'
        const id = a.chapterId ?? a.contractId
        const key = `${source}:${id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const merged = dedup([...chapterAssignments, ...extraRelations])
      setAssignments(merged)
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Không tải được danh sách việc.'
      setError(msg)
      toast.error(msg)
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [assistantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!assistantId) return

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onContractUpdated = () => { void refresh() }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('assistant-assignments-changed', onContractUpdated)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('assistant-assignments-changed', onContractUpdated)
    }
  }, [assistantId, refresh])

  return { assignments, loading, error, refresh }
}