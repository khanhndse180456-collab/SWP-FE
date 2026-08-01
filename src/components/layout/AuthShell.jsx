import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1">
        <aside className="relative hidden w-[44%] overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-between">
          <img 
            src="/manga_login_bg.png" 
            alt="Manga Workspace" 
            className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/40 to-zinc-950/90" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/25 via-transparent to-transparent" />
          <div className="relative p-10">
            <Link to="/" className="flex items-center gap-2 text-white">
              <BookOpen className="size-5" />
              <span className="font-semibold">MangaHub</span>
            </Link>
          </div>
          <div className="relative space-y-6 p-10 pb-16">
            <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
            <p className="max-w-md text-zinc-300 leading-relaxed font-medium">{subtitle}</p>
          </div>
        </aside>
        <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md space-y-6">
            <div className="lg:hidden">
              <Link to="/" className="mb-8 flex items-center gap-2 font-semibold">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <BookOpen className="size-4" />
                </span>
                MangaHub
              </Link>
            </div>
            {children}
            {footer}
          </div>
        </main>
      </div>
    </div>
  )
}

export function RoleCard({ active, icon, title, desc, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50',
        active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card',
      )}
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground leading-relaxed">{desc}</span>
    </button>
  )
}
