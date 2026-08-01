import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopBarBell, TopBarUserMenu } from "./WorkspaceTopBar.jsx";

/**
 * Sidebar layout dùng chung cho các workspace (Mangaka / Tantou / EB).
 * - Logo + tên app ở top
 * - Menu items dạng button, active = bg-primary
 * - Logout ở bottom
 *
 * Props:
 *  - logoIcon: LucideIcon   icon hiển thị trong logo box
 *  - appName: string         tên app (default "MangaPublish")
 *  - items: Array<{ id, label, icon: LucideIcon, badge?: number | string }>
 *  - activeId: string
 *  - onSelect: (id) => void
 *  - onLogout: () => void
 *  - user: any               thông tin user hiện tại (chỉ dùng cho tooltip đăng xuất)
 *  - footerSlot: ReactNode   nút custom ở dưới cùng (vd. "Về workspace khác")
 *  - accentClass: string     class cho box icon logo, ví dụ "bg-primary"
 */
export default function SidebarNav({
  logoIcon: LogoIcon,
  appName = "MangaPublish",
  items = [],
  activeId,
  onSelect,
  onLogout,
  onProfile,
  user,
  footerSlot,
  accentClass = "bg-primary text-primary-foreground",
}) {
  return (
    <aside className="sticky top-0 h-screen flex w-64 shrink-0 flex-col border-r bg-zinc-950 text-zinc-100">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800 px-6">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl shadow-xs",
            accentClass,
          )}
        >
          {LogoIcon ? <LogoIcon className="size-4" /> : null}
        </span>
        <span className="text-lg font-bold tracking-tight text-white">
          {appName}
        </span>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-semibold transition-all",
                active
                  ? "bg-primary text-white shadow-xs"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" /> : null}
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && Number(item.badge) > 0 && (
                <span
                  className={cn(
                    'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                    active
                      ? 'bg-white text-primary'
                      : 'bg-primary text-primary-foreground',
                  )}
                >
                  {Number(item.badge) > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-3 border-t border-zinc-800 p-4">
        {user ? (
          <div className="flex items-center justify-between gap-2 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800/80">
            <button
              type="button"
              onClick={onProfile}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg p-1 text-left hover:bg-zinc-800 transition-colors min-w-0 flex-1 focus:outline-none"
              title="Xem hồ sơ cá nhân"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-white shadow-xs">
                {(() => {
                  const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean)
                  if (parts.length === 0) return '?'
                  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
                  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                })()}
              </span>
              <span className="flex min-w-0 flex-col flex-1">
                <span className="truncate text-xs font-semibold text-white text-left">{user?.name || 'Tài khoản'}</span>
                <span className="truncate text-[10px] uppercase tracking-wider text-zinc-550 text-left">
                  {user?.role === 'MANGAKA' ? 'Mangaka' : 
                   user?.role === 'ASSISTANT' ? 'Assistant' : 
                   user?.role === 'TANTOU' ? 'Tantou Editor' : 
                   user?.role === 'EDITOR_BOARD' ? 'EB' : 
                   user?.role === 'ADMIN' ? 'Admin' : (user?.role ?? 'Thành viên')}
                </span>
              </span>
            </button>
            <TopBarBell userId={user.id ?? user.userId ?? user.userid ?? null} isSidebar={true} />
          </div>
        ) : null}

        {footerSlot}
        {onLogout ? (
          <button
            onClick={onLogout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2 text-left text-sm font-semibold text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
            title={user?.name ? `Đăng xuất ${user.name}` : "Đăng xuất"}
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        ) : null}
      </div>
    </aside>
  );
}
