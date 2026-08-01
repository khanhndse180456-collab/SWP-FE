import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationsService } from '@/api/notificationsService.js'
import { useAuth } from '@/lib/providers'

const POLL_INTERVAL_MS = 45_000
const MAX_ITEMS = 30

// ============================================================
// Module-level overlay: lưu các ID đã được "xem" trong session.
// Tồn tại xuyên suốt SPA (remount, navigation, header re-render)
// và persist cả khi F5 nhờ sessionStorage.
// Key theo userId (nếu có) để tránh trộn giữa các account.
// ============================================================
const OVERLAY_KEY_PREFIX = 'swp.notifications.readIds.'

function loadOverlayFromStorage(userId) {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.sessionStorage.getItem(OVERLAY_KEY_PREFIX + (userId ?? 'anon'))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveOverlayToStorage(userId, set) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      OVERLAY_KEY_PREFIX + (userId ?? 'anon'),
      JSON.stringify(Array.from(set)),
    )
  } catch {
    /* ignore quota */
  }
}

function pickFirst(...candidates) {
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== '') return c
  }
  return undefined
}

function normalize(raw, role) {
  if (!raw) return null
  const id = pickFirst(
    raw.id,
    raw.Id,
    raw.notificationId,
    raw.NotificationId,
    raw.notification_id,
    raw.notificationID,
  )
  if (id == null) return null

  const title = pickFirst(raw.title, raw.Title, 'Thông báo') || 'Thông báo'
  const message = pickFirst(raw.message, raw.Message, raw.body, raw.Body, '') || ''
  const isRead = Boolean(
    pickFirst(
      raw.isRead,
      raw.IsRead,
      raw.read,
      raw.Read,
      raw.is_read,
      raw.isread,
    ),
  )
  const createdAt = pickFirst(raw.createdAt, raw.CreatedAt, raw.created_at, raw.createdat)
  const userId = pickFirst(raw.userId, raw.UserId, raw.user_id, raw.userid)
  const seriesId = pickFirst(raw.seriesId, raw.SeriesId, raw.series_id, raw.seriesid)
  const referenceType = pickFirst(raw.referenceType, raw.ReferenceType, raw.reference_type)
  const referenceId = pickFirst(raw.referenceId, raw.ReferenceId, raw.reference_id)

  const seriesTitle = pickFirst(raw.seriesTitle, raw.SeriesTitle, raw.series_title)
  const chapterId = pickFirst(raw.chapterId, raw.ChapterId, raw.chapter_id)
  const pageId = pickFirst(raw.pageId, raw.PageId, raw.page_id)

  let link = ''
  let linkState = null

  if (referenceType === 'Issue') {
    if (seriesTitle && chapterId && pageId) {
      if (role === 'ASSISTANT') {
        link = '/assistant'
        linkState = {
          tab: 'dashboard',
          chapterId: String(chapterId),
          pageId: String(pageId)
        }
      } else {
        const slug = seriesTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        link = `/mangaka/series/${slug}/chapter/${chapterId}/page/${pageId}`
      }
    }
  } else if (referenceType === 'Chapter') {
    if (role === 'ASSISTANT') {
      link = '/assistant'
      linkState = {
        tab: 'dashboard',
        chapterId: chapterId ? String(chapterId) : null
      }
    } else {
      link = '/mangaka'
      linkState = {
        tab: 'page',
        series: seriesTitle,
        seriesId: seriesId,
        chapterId: chapterId ? String(chapterId) : null
      }
    }
  } else if (referenceType === 'Contract') {
    if (role === 'ASSISTANT') {
      link = '/assistant'
      linkState = { openCollab: true }
    } else {
      link = '/mangaka'
      linkState = { tab: 'contract' }
    }
  } else if (referenceType === 'Evaluation') {
    if (role === 'ASSISTANT') {
      link = '/assistant'
      linkState = { tab: 'history' }
    } else {
      link = '/mangaka'
      linkState = { tab: 'history' }
    }
  }

  return {
    id: String(id),
    title,
    message,
    isRead,
    createdAt,
    userId,
    seriesId,
    referenceType,
    referenceId,
    link,
    linkState,
    raw,
  }
}

export function useNotifications({
  pollInterval = POLL_INTERVAL_MS,
  enabled = true,
  onNew,
  userId = null,
} = {}) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const timerRef = useRef(null)
  const seenIdsRef = useRef(new Set())
  const firstLoadRef = useRef(true)
  const onNewRef = useRef(onNew)
  const userIdRef = useRef(userId)

  useEffect(() => {
    onNewRef.current = onNew
  }, [onNew])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // Local overlay: các ID đã được người dùng "xem" trong session này,
  // độc lập với phản hồi server (BE có thể không persist isRead).
  // Lưu ở sessionStorage → tồn tại xuyên remount và cả khi F5 nhẹ (cùng tab).
  const readIdsRef = useRef(null)
  if (readIdsRef.current == null) {
    readIdsRef.current = loadOverlayFromStorage(userIdRef.current)
  }

  const persistOverlay = () => saveOverlayToStorage(userIdRef.current, readIdsRef.current)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const params = userIdRef.current ? { userId: Number(userIdRef.current) } : {}
      const res = await notificationsService.list(params)
      const role = user?.role ?? null
      const list = (Array.isArray(res) ? res : []).map(raw => normalize(raw, role)).filter(n => n.id)

      const seen = seenIdsRef.current
      const fresh = list.filter(n => !seen.has(n.id))
      for (const n of list) seen.add(n.id)

      // Merge local read state vào list từ server
      const merged = list.map(n => (
        readIdsRef.current.has(n.id) ? { ...n, isRead: true } : n
      ))

      setItems(merged.slice(0, MAX_ITEMS))
      setUnreadCount(merged.filter(n => !n.isRead).length)

      // eslint-disable-next-line no-console
      console.log('[useNotifications] refresh → items:', merged.length, 'unread:', merged.filter(n => !n.isRead).length, 'firstIds:', merged.slice(0, 3).map(n => ({ id: n.id, userId: n.userId, isRead: n.isRead })))

      if (merged.length === 0 && Array.isArray(res)) {
        // eslint-disable-next-line no-console
        console.warn('[useNotifications] raw sample →', res[0])
      }

      if (fresh.length && !firstLoadRef.current) {
        const handler = onNewRef.current
        if (typeof handler === 'function') {
          for (const n of fresh) handler(n)
        }
      }
      firstLoadRef.current = false
    } catch (err) {
      console.warn('[notifications] refresh failed', err?.message ?? err)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    void refresh()
    const id = window.setInterval(() => { void refresh() }, pollInterval)
    timerRef.current = id
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [enabled, pollInterval, refresh])

  const markRead = useCallback(async (id) => {
    const sid = String(id)
    // Ghi nhận local: id này đã được xem trong session
    const overlay = readIdsRef.current
    if (!overlay.has(sid)) {
      overlay.add(sid)
      persistOverlay()
    }
    setItems(prev => prev.map(n => (n.id === sid ? { ...n, isRead: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await notificationsService.markRead(sid)
      // Không gọi refresh() — overlay giữ đúng trạng thái đã xem.
    } catch (err) {
      // Không rollback UI: user đã "xem", giữ đã đọc.
      console.warn('[notifications] markRead failed:', err?.message ?? err)
    }
  }, [])

  const markAllRead = useCallback(async () => {
    // Ghi nhận tất cả ID hiện tại vào overlay + persist
    const overlay = readIdsRef.current
    let changed = false
    for (const n of items) {
      if (!overlay.has(n.id)) {
        overlay.add(n.id)
        changed = true
      }
    }
    if (changed) persistOverlay()
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await notificationsService.markAllRead()
    } catch (err) {
      console.warn('[notifications] markAllRead failed:', err?.message ?? err)
    }
  }, [items])

  return { items, unreadCount, loading, refresh, markRead, markAllRead }
}