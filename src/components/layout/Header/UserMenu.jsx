import { Link } from 'react-router-dom'
import { LogOut, Settings, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/providers'
import { getRolePath, ROLE_LABELS } from '@/lib/auth'
import { cn } from '@/lib/utils'

const ROLE_ICON = {
  MANGAKA: '✍️',
  ASSISTANT: '🎨',
  TANTOU: '📝',
  EDITOR_BOARD: '🛡️',
  ADMIN: '🛠️',
}

/**
 * Menu profile dùng chung cho mọi role.
 *
 * Cách build:
 *  1) Nếu cha truyền `menuItems` (mảng {label, to/href, icon, onClick, danger, separator})
 *     → dùng luôn.
 *  2) Nếu không → tự build mặc định theo role:
 *     - MANGAKA: Workspace / Hồ sơ / Series của tôi / Đăng xuất
 *     - TANTOU:  Workspace / Hồ sơ / Duyệt series / Đăng xuất
 *     - EB:      Workspace / Hồ sơ / Ban duyệt / Đăng xuất
 *     - ASSISTANT: Workspace / Hồ sơ / Công việc / Đăng xuất
 *
 * Props:
 *  - onLogout: bắt buộc nếu đã đăng nhập (hiện nút Đăng xuất).
 *  - menuItems: override (optional).
 *  - className: class thêm cho nút trigger.
 *  - showLabel: hiện tên user bên cạnh avatar (mặc định true).
 */
export default function UserMenu({ onLogout, menuItems, className, showLabel = true }) {
  const { user } = useAuth()
  if (!user) return null

  const workspacePath = getRolePath(user.role)
  const items = menuItems ?? buildDefaultItems({ user, workspacePath, onLogout })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          <span className="text-base leading-none">{ROLE_ICON[user.role] ?? '👤'}</span>
          {showLabel && (
            <span className="max-w-[120px] truncate">{user.name}</span>
          )}
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {ROLE_LABELS[user.role] ?? user.role}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Đăng nhập với tư cách
          <div className="mt-0.5 text-sm font-medium text-foreground">
            {user.email ?? user.name}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it, idx) => {
          if (it.separator) return <DropdownMenuSeparator key={`sep-${idx}`} />
          const Icon = it.icon
          const className = cn(it.danger && 'text-destructive focus:text-destructive')
          const content = (
            <span className="flex items-center gap-2">
              {Icon ? <Icon className="size-4" /> : null}
              <span>{it.label}</span>
            </span>
          )
          if (it.href) {
            return (
              <DropdownMenuItem key={`${it.label}-${idx}`} asChild className={className}>
                <a href={it.href}>{content}</a>
              </DropdownMenuItem>
            )
          }
          if (it.to) {
            return (
              <DropdownMenuItem key={`${it.label}-${idx}`} asChild className={className}>
                <Link to={it.to}>{content}</Link>
              </DropdownMenuItem>
            )
          }
          return (
            <DropdownMenuItem
              key={`${it.label}-${idx}`}
              onClick={it.onClick}
              className={className}
            >
              {content}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function buildDefaultItems({ user, workspacePath, onLogout }) {
  const items = []
  if (workspacePath) {
    items.push({ label: 'Workspace', to: workspacePath, icon: Settings })
  }
  items.push({ label: 'Hồ sơ', to: '/profile', icon: UserRound })

  // Các link nhanh theo role (chỉ thêm nếu path khác workspace chính).
  const role = user.role
  if (role === 'MANGAKA') {
    items.push({ label: 'Series của tôi', to: '/mangaka/series' })
  } else if (role === 'TANTOU') {
    items.push({ label: 'Duyệt series', to: '/tantou/review' })
  } else if (role === 'EDITOR_BOARD') {
    items.push({ label: 'Ban duyệt', to: '/eb/review' })
  } else if (role === 'ASSISTANT') {
    items.push({ label: 'Công việc', to: '/assistant' })
  }

  if (onLogout) {
    items.push({ separator: true })
    items.push({ label: 'Đăng xuất', onClick: onLogout, icon: LogOut, danger: true })
  }
  return items
}