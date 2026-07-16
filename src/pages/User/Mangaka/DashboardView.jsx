import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, FileText, ImageIcon, ClipboardCheck, Bell } from 'lucide-react'

export default function DashboardView({
  mangakaName,
  stats,
  recentSeries,
  recentNotifications,
  onNavigateTab,
  onSelectSeries,
  STATUS_BADGE,
}) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          Chào mừng trở lại, <span className="font-semibold text-foreground">{mangakaName}</span> 👋
          <span className="text-xs text-muted-foreground">· Đây là tổng quan về các tác phẩm và hoạt động của bạn.</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs border bg-card text-card-foreground">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tổng số series</p>
              <div className="text-2xl font-bold">{stats.totalSeries}</div>
              <p className="text-[10px] text-emerald-600 font-medium">+2 so với tháng trước</p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <BookOpen className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card text-card-foreground">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Đang chờ duyệt</p>
              <div className="text-2xl font-bold">{stats.pendingApproval}</div>
              <p className="text-[10px] text-muted-foreground">Cần editor duyệt</p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <ClipboardCheck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card text-card-foreground">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Đang tiến hành</p>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-[10px] text-muted-foreground">Đang đăng</p>
            </div>
            <div className="p-3 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
              <ImageIcon className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border bg-card text-card-foreground">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Đã hoàn thành</p>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-[10px] text-emerald-600 font-medium">Đã kết thúc</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileText className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Split section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Series */}
        <Card className="border bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Series gần đây</CardTitle>
              <CardDescription className="text-xs">Các series được cập nhật gần đây nhất</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary hover:underline font-semibold"
              onClick={() => onNavigateTab('series')}
            >
              Xem tất cả series →
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentSeries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Chưa có series nào.</p>
            ) : (
              recentSeries.map(s => {
                const badge = STATUS_BADGE[s.status?.toLowerCase()] || STATUS_BADGE.draft
                const initials = (s.title.length >= 2 ? s.title : `${s.title}●`).slice(0, 2)
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/45 transition-colors cursor-pointer"
                    onClick={() => {
                      onSelectSeries(s.title)
                      onNavigateTab('series')
                    }}
                  >
                    {s.coverImage ? (
                      <img src={s.coverImage} alt={s.title} className="size-11 object-cover rounded-md" />
                    ) : (
                      <div
                        className="size-11 flex items-center justify-center rounded-md font-bold text-white text-sm"
                        style={{ background: `linear-gradient(135deg, ${s.color || '#6366f1'}, ${s.color || '#6366f1'}88)` }}
                      >
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Chapter {s.chapters || 0} · Cập nhật {s.updated || 'Gần đây'}
                      </p>
                    </div>
                    <Badge className={badge.className} variant="secondary">
                      {badge.label}
                    </Badge>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Thông báo mới</CardTitle>
              <CardDescription className="text-xs">Cập nhật hoạt động từ Editor và Assistant</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary hover:underline font-semibold"
              onClick={() => onNavigateTab('notifications')}
            >
              Xem tất cả
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentNotifications.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Chưa có thông báo mới.</p>
            ) : (
              recentNotifications.slice(0, 4).map(n => (
                <div key={n.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/20">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0 mt-0.5">
                    <Bell className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{n.title || n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{n.content || n.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {n.createdat ? new Date(n.createdat).toLocaleString('vi-VN') : 'Vừa xong'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
