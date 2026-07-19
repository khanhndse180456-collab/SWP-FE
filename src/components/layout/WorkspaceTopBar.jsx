import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  LogOut,
  RefreshCcw,
  User as UserIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { getRolePath } from '@/lib/auth'
import { useNotifications } from '@/hooks/useNotifications'

const ROLE_LABEL = {
  MANGAKA: 'Mangaka',
  TANTOU: 'Tantou Editor',
  EDITOR_BOARD: 'EB',
  ASSISTANT: 'Assistant',
  ADMIN: 'Admin',
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

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

function TopBarBell() {
  const { items, unreadCount, loading, refresh, markAllRead, markRead } = useNotifications({
    enabled: true,
  })
  const list = useMemo(() => items.slice(0, 8), [items])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Thông báo"
          className="relative flex size-10 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thông báo {unreadCount > 0 ? `· ${unreadCount} mới` : ''}
          </DropdownMenuLabel>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => refresh()}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Làm mới"
            >
              <RefreshCcw className={cn('size-3.5', loading && 'animate-spin')} />
            </button>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Đánh dấu đã đọc tất cả"
              >
                <CheckCircle2 className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <Check className="size-6" />
            <p>Bạn đã cập nhật tất cả thông báo.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {list.map((n) => {
                const isRead = !!n.isRead
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => { if (!isRead) markRead(n.id) }}
                      className={cn(
                        'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent',
                        !isRead && 'bg-accent/40',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!isRead ? (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        ) : (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate', !isRead ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                            {n.title || n.message || 'Thông báo'}
                          </p>
                          {n.message && n.title ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                          ) : null}
                          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to="/notifications"
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 py-2 text-xs font-medium"
          >
            Xem tất cả
            <ExternalLink className="size-3" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TopBarUserMenu({ user, onLogout }) {
  const navigate = useNavigate()
  const initials = getInitials(user?.name)
  const roleLabel = ROLE_LABEL[user?.role] ?? user?.role ?? 'Thành viên'
  const workspacePath = user ? getRolePath(user.role) : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tài khoản"
          className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 pl-1.5 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
          title={user?.name ? `Tài khoản ${user.name}` : 'Tài khoản'}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-white shadow-xs">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:flex sm:flex-col">
            <span className="truncate text-xs font-semibold text-foreground">{user?.name || 'Tài khoản'}</span>
            <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {roleLabel}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <div className="px-3 py-2.5">
          <p className="truncate text-sm font-semibold">{user?.name || 'Khách'}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
          <Badge className="mt-1.5">{roleLabel}</Badge>
        </div>

        <DropdownMenuSeparator />

        {workspacePath ? (
          <DropdownMenuItem asChild>
            <Link to={workspacePath} className="flex w-full cursor-pointer items-center gap-2">
              <UserIcon className="size-4" />
              Workspace của tôi
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex w-full cursor-pointer items-center gap-2">
            <UserIcon className="size-4" />
            Hồ sơ cá nhân
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            if (typeof onLogout === 'function') onLogout()
            else navigate('/login')
          }}
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-500/10 dark:focus:text-red-400"
        >
          <LogOut className="size-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Top bar dùng chung cho các workspace.
 * - Sticky trên đầu main content
 * - Trái: titleSlot (vd: tiêu đề trang)
 * - Phải: bell + avatar menu (khi có user)
 *
 * Props:
 *  - titleSlot: ReactNode         tuỳ chọn — render ở góc trái (vd: tiêu đề tab)
 *  - user: any                    bật bell + user menu khi có
 *  - onLogout: () => void
 */
export default function WorkspaceTopBar({ titleSlot, user, onLogout }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex min-w-0 items-center gap-3">{titleSlot}</div>
      {user ? (
        <div className="flex shrink-0 items-center gap-2">
          <TopBarBell />
          <TopBarUserMenu user={user} onLogout={onLogout} />
        </div>
      ) : null}
    </header>
  )
}
