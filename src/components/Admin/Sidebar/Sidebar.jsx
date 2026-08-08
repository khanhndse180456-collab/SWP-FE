import {
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Users as UsersIcon,
  Tag as TagIcon,
  Layers as LayersIcon,
  ChevronDown,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_ITEMS = [
  {
    section: 'Tổng quan',
    links: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'manga', label: 'Quản lý truyện', icon: BookOpen },
      { id: 'chapters', label: 'Chương truyện', icon: FileText },
    ],
  },
  {
    section: 'Danh mục',
    links: [
      { id: 'genres', label: 'Thể loại', icon: LayersIcon },
      { id: 'tags', label: 'Tags', icon: TagIcon },
    ],
  },
  {
    section: 'Cộng đồng',
    links: [
      { id: 'users', label: 'Người dùng', icon: UsersIcon },
    ],
  },
  {
    section: 'Hệ thống',
    links: [
      { id: 'stats', label: 'Thống kê', icon: BarChart3 },
    ],
  },
]

export default function Sidebar({ activePage = 'dashboard', onNavigate }) {
  const navigate = useNavigate()

  function handleLogout() {
    // Xóa hết các key liên quan tới auth, không chỉ token/role
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    sessionStorage.clear()

    // Dùng navigate thay vì window.location.href để không full reload
    // (nếu app có interceptor/context phụ thuộc state, full reload sẽ mất state đó luôn -> đúng ý)
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">MangaHub</div>
            <div className="text-xs text-muted-foreground">Admin Panel</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.section}
            </div>
            <div className="space-y-1">
              {group.links.map(link => {
                const Icon = link.icon
                const active = activePage === link.id
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => onNavigate?.(link.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{link.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full h-12 justify-start gap-3 px-2 hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-xs font-bold text-primary-foreground">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left text-xs min-w-0">
                <div className="font-semibold truncate">Admin</div>
                <div className="text-[10px] text-muted-foreground truncate">Super Admin</div>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-56 mb-2">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-xs font-bold text-primary-foreground">
                    AD
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-semibold">Admin</div>
                  <Badge variant="outline" className="mt-0.5 h-4 text-[10px]">Super Admin</Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate?.('profile')} className="cursor-pointer">
              <User className="size-4 mr-2" />
              Hồ sơ
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="size-4 mr-2" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}