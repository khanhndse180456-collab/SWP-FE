import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Sidebar layout dùng chung cho các workspace (Mangaka / Tantou / EB).
 * - Logo + tên app ở top
 * - Menu items dạng button, active = bg-primary
 * - Logout ở bottom
 *
 * Props:
 *  - logoIcon: LucideIcon   icon hiển thị trong logo box
 *  - appName: string         tên app (default "MangaPublish")
 *  - items: Array<{ id, label, icon: LucideIcon }>
 *  - activeId: string
 *  - onSelect: (id) => void
 *  - onLogout: () => void
 *  - user: any               thông tin user hiện tại (chỉ dùng cho tooltip đăng xuất)
 *  - footerSlot: ReactNode   nút custom ở dưới cùng (vd. "Về workspace khác")
 *  - accentClass: string     class cho box icon logo, ví dụ "bg-primary"
 */
export default function SidebarNav({
  logoIcon: LogoIcon,
  appName = 'MangaPublish',
  items = [],
  activeId,
  onSelect,
  onLogout,
  user,
  footerSlot,
  accentClass = 'bg-primary text-primary-foreground',
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-zinc-950 text-zinc-100">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800 px-6">
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-xl shadow-xs',
            accentClass,
          )}
        >
          {LogoIcon ? <LogoIcon className="size-4" /> : null}
        </span>
        <span className="text-lg font-bold tracking-tight text-white">{appName}</span>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {items.map(item => {
          const Icon = item.icon
          const active = activeId === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-semibold transition-all',
                active
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white',
              )}
            >
              {Icon ? <Icon className="size-4" /> : null}
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-2 border-t border-zinc-800 p-4">
        {footerSlot}
        {onLogout ? (
          <button
            onClick={onLogout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
            title={user?.name ? `Đăng xuất ${user.name}` : 'Đăng xuất'}
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        ) : null}
      </div>
    </aside>
  )
}
