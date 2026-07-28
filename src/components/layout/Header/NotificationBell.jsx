import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

  const visible = useMemo(() => items, [items])

  const navigate = useNavigate()

  function handleItemClick(n) {
    if (!n.isRead) {
      void markRead(n.id)
    }
    if (typeof onItemClick === 'function') {
      onItemClick(n)
    } else if (n.link) {
      navigate(n.link, { state: n.linkState })
    }
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
                  void markAllRead()
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

        <div 
          className="max-h-[360px] overflow-y-auto"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
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
                        <Link to={n.link} state={n.linkState} onClick={() => handleItemClick(n)} className="block">
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
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
