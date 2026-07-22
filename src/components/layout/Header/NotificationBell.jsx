import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, ExternalLink, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

function timeAgo(iso) {
  if (!iso) return ''
  const t = typeof iso === 'string' ? Date.parse(iso) : iso
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  return `${d} ngày trước`
}

const TICK_MS = 500

/**
 * Chuông thông báo dùng chung cho mọi role.
 * Badge giảm TỪNG CÁI MỘT cho đến khi hết (theo yêu cầu UX).
 *
 *  - Click 1 item → markRead ngay → badge -1 tức thì.
 *  - Mở dropdown → sau 600ms, mỗi TICK_MS giảm 1 cái hiển thị được xem.
 *  - Local overlay (trong hook) + sessionStorage đảm bảo BE không persist
 *    thì trạng thái "đã đọc" vẫn đúng cho tới khi đóng tab.
 */
export default function NotificationBell({
  pollInterval,
  className,
  onItemClick,
  maxItems = 8,
}) {
  const { items, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications({
    pollInterval,
  })
  const [open, setOpen] = useState(false)

  const queueRef = useRef([])        // Hàng đợi ID cần markRead
  const viewedRef = useRef(new Set()) // Đã đẩy vào markRead (chống gọi 2 lần)
  const timersRef = useRef([])
  const markReadRef = useRef(markRead)

  // Giữ ref của markRead mới nhất
  useEffect(() => { markReadRef.current = markRead }, [markRead])

  const visible = useMemo(() => items.slice(0, maxItems), [items, maxItems])

  // Khi mở dropdown: xây queue + bắt đầu drain.
  // Deps [open] (không [visible]) để giữa chừng refresh là không reset queue.
  useEffect(() => {
    for (const t of timersRef.current) window.clearTimeout(t)
    timersRef.current = []

    if (!open) {
      queueRef.current = []
      return undefined
    }

    const buildFromVisible = () => {
      queueRef.current = visible
        .filter((n) => !n.isRead && !viewedRef.current.has(n.id))
        .map((n) => n.id)
    }
    buildFromVisible()

    const drain = () => {
      if (queueRef.current.length === 0) return
      const id = queueRef.current.shift()
      if (!id) return
      viewedRef.current.add(id)
      const p = markReadRef.current(id)
      if (p && typeof p.catch === 'function') p.catch(() => {})
      const t = window.setTimeout(drain, TICK_MS)
      timersRef.current.push(t)
    }

    const start = window.setTimeout(drain, 600)
    timersRef.current.push(start)

    return () => {
      for (const t of timersRef.current) window.clearTimeout(t)
      timersRef.current = []
    }
  }, [open, visible, markRead])

  // Khi items thay đổi (refresh) → bổ sung unread mới (chưa viewed) vào queue phía sau
  useEffect(() => {
    if (!open) return
    const existing = new Set(queueRef.current)
    let added = false
    for (const n of visible) {
      if (!n.isRead && !viewedRef.current.has(n.id) && !existing.has(n.id)) {
        queueRef.current.push(n.id)
        added = true
      }
    }
    if (added && timersRef.current.length === 0) {
      const drain = () => {
        if (queueRef.current.length === 0) return
        const id = queueRef.current.shift()
        if (!id) return
        viewedRef.current.add(id)
        const p = markReadRef.current(id)
        if (p && typeof p.catch === 'function') p.catch(() => {})
        const t = window.setTimeout(drain, TICK_MS)
        timersRef.current.push(t)
      }
      const t = window.setTimeout(drain, TICK_MS)
      timersRef.current.push(t)
    }
  }, [items, open, visible])

  function handleItemClick(n) {
    viewedRef.current.add(n.id)
    if (!n.isRead) {
      const p = markReadRef.current(n.id)
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    queueRef.current = queueRef.current.filter((id) => id !== n.id)
    if (typeof onItemClick === 'function') onItemClick(n)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Thông báo"
          className={cn(
            'relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            className,
          )}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <DropdownMenuLabel className="p-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thông báo
          </DropdownMenuLabel>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                void refresh()
              }}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Làm mới"
            >
              <RefreshCcw className={cn('size-3.5', loading && 'animate-spin')} />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  // Đánh dấu toàn bộ ID hiện tại đã xem để UI cập nhật ngay
                  for (const n of visible) viewedRef.current.add(n.id)
                  void markAllRead()
                  queueRef.current = []
                }}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                title="Đánh dấu tất cả đã đọc"
              >
                <Check className="mr-0.5 inline size-3" />
                Đọc tất cả
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[360px]">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-8 text-center text-xs text-muted-foreground">
              <Bell className="size-6 opacity-40" />
              <p>Không có thông báo nào.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((n) => {
                const content = (
                  <div className="flex w-full items-start gap-2">
                    {!n.isRead && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{n.title}</p>
                      {n.message && (
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {n.link && (
                      <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                )
                if (n.link && !onItemClick) {
                  return (
                    <li key={n.id}>
                      <DropdownMenuItem asChild>
                        <Link to={n.link} onClick={() => handleItemClick(n)} className="block">
                          {content}
                        </Link>
                      </DropdownMenuItem>
                    </li>
                  )
                }
                return (
                  <li key={n.id}>
                    <DropdownMenuItem
                      onClick={() => handleItemClick(n)}
                      className="cursor-pointer"
                    >
                      {content}
                    </DropdownMenuItem>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-3 py-1.5 text-center">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 w-full text-[11px]"
          >
            <Link to="/notifications">Xem tất cả</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
