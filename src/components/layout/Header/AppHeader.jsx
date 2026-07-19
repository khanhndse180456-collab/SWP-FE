import { Link } from 'react-router-dom'
import { BookOpen, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/providers'
import { getRolePath } from '@/lib/auth'
import { cn } from '@/lib/utils'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'

// Role nào được thấy chuông thông báo — mặc định: tất cả trừ ADMIN.
const DEFAULT_BELL_ROLES = new Set(['MANGAKA', 'ASSISTANT', 'TANTOU', 'EDITOR_BOARD'])

/**
 * Header dùng chung cho mọi role (Mangaka, Tantou, EB, Assistant, ...).
 * - Tự render NotificationBell cho role được phép (mặc định trừ ADMIN).
 * - Tự render UserMenu với menu item build sẵn theo role.
 * - Cho phép override hoàn toàn qua props `notificationSlot` / `userMenuSlot`.
 *
 * Props:
 *  - brand: { label, icon, to } (mặc định MangaHub)
 *  - links: [{label, to, href}]
 *  - onLogout
 *  - hideForGuest: nếu false sẽ hiện nút Đăng nhập/Đăng ký
 *  - bellRoles: Set<string> | array các role được thấy bell (override)
 *  - notificationSlot: ReactNode thay thế bell hoàn toàn
 *  - userMenuSlot: ReactNode thay thế user menu
 *  - showNotificationBell: false để ẩn bell
 *  - showUserMenu: false để ẩn user menu
 */
export default function AppHeader({
  brand,
  links = [],
  onLogout,
  hideForGuest = false,
  bellRoles,
  notificationSlot,
  userMenuSlot,
  showNotificationBell = true,
  showUserMenu = true,
  className,
}) {
  const { user } = useAuth()
  const role = user?.role ?? null
  const workspacePath = user ? getRolePath(user.role) : null

  const isGuest = !user
  const bellSet = bellRoles
    ? new Set(Array.isArray(bellRoles) ? bellRoles : [...bellRoles])
    : DEFAULT_BELL_ROLES
  const showBell = showNotificationBell && role && bellSet.has(role)

  const brandNode = brand ?? {
    label: 'MangaHub',
    icon: BookOpen,
    to: '/',
  }
  const BrandIcon = brandNode.icon

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl',
        className,
      )}
    >
      <div className="page-container flex h-16 items-center justify-between gap-4">
        <Link
          to={brandNode.to ?? '/'}
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          {BrandIcon ? (
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BrandIcon className="size-4" />
            </span>
          ) : null}
          <span className="hidden sm:inline">{brandNode.label}</span>
        </Link>

        {links.length > 0 && (
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const cls =
                'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
              if (link.href) {
                return (
                  <a key={link.label} href={link.href} className={cls}>
                    {link.label}
                  </a>
                )
              }
              return (
                <Link key={link.label} to={link.to} className={cls}>
                  {link.label}
                </Link>
              )
            })}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {showBell ? (notificationSlot ?? <NotificationBell />) : null}

          {showUserMenu && user ? (
            (userMenuSlot ?? <UserMenu onLogout={onLogout} />)
          ) : isGuest && !hideForGuest ? (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/login">Đăng nhập</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Đăng ký</Link>
              </Button>
            </>
          ) : workspacePath && !onLogout ? (
            <Button asChild size="sm">
              <Link to={workspacePath}>Workspace</Link>
            </Button>
          ) : null}

          {links.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" className="md:hidden">
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {links.map((link) =>
                  link.href ? (
                    <DropdownMenuItem key={link.label} asChild>
                      <a href={link.href}>{link.label}</a>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={link.label} asChild>
                      <Link to={link.to}>{link.label}</Link>
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  )
}