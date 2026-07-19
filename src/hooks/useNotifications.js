import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { notificationsService } from '@/api/notificationsService.js'
import { getApiErrorMessage } from '@/api/api.js'

const POLL_INTERVAL_MS = 45_000
const MAX_ITEMS = 30

function normalize(raw) {
  if (!raw) return null
  return {
    id: String(raw.id ?? raw.notificationId ?? ''),
    title: raw.title ?? 'Thong bao',
    message: raw.message ?? raw.body ?? '',
    isRead: Boolean(raw.isRead ?? raw.read),
    createdAt: raw.createdAt ?? null,
    seriesId: raw.seriesId ?? null,
    referenceType: raw.referenceType ?? null,
    referenceId: raw.referenceId ?? null,
    raw,
  }
}

export function useNotifications({ pollInterval = POLL_INTERVAL_MS, enabled = true, onNew } = {}) {
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const timerRef = useRef(null)
  const seenIdsRef = useRef(new Set())
  const firstLoadRef = useRef(true)
  const onNewRef = useRef(onNew)

  useEffect(() => {
    onNewRef.current = onNew
  }, [onNew])

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await notificationsService.list()
      const list = (Array.isArray(res) ? res : []).map(normalize).filter(n => n.id)

      const seen = seenIdsRef.current
      const fresh = list.filter(n => !seen.has(n.id))
      for (const n of list) seen.add(n.id)

      setItems(list.slice(0, MAX_ITEMS))
      setUnreadCount(list.filter(n => !n.isRead).length)

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
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await notificationsService.markRead(id)
      await refresh()
    } catch (err) {
      setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: false } : n)))
      setUnreadCount(prev => prev + 1)
      toast.error(getApiErrorMessage(err, 'Khong danh dau duoc da doc.'))
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    const prevItems = items
    const prevCount = unreadCount
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await notificationsService.markAllRead()
      await refresh()
    } catch (err) {
      setItems(prevItems)
      setUnreadCount(prevCount)
      toast.error(getApiErrorMessage(err, 'Khong danh dau duoc tat ca.'))
    }
  }, [items, unreadCount, refresh])

  return { items, unreadCount, loading, refresh, markRead, markAllRead }
}