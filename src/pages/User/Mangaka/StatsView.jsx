import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart3, TrendingUp, Users, Heart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function StatsView({ seriesList = [], chapterRows = [] }) {
  // Compute statistics
  const totalSeries = seriesList.length
  const totalChapters = chapterRows.length
  
  // Count by status
  const publishedChapters = chapterRows.filter(c => c.status === 'Published' || c.status === 'published' || c.status === 'done').length
  const draftChapters = chapterRows.filter(c => c.status === 'Draft' || c.status === 'draft' || c.status === 'InProduction' || c.status === 'inproduction').length
  const reviewChapters = chapterRows.filter(c => c.status === 'Ready' || c.status === 'ready' || c.status === 'review' || c.status === 'ReadyForReview' || c.status === 'EbReview').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Thống kê & Báo cáo</h1>
        <p className="text-sm text-muted-foreground">Theo dõi số lượng tác phẩm và hiệu suất công việc của bạn.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tổng số Series</CardTitle>
            <TrendingUp className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSeries}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Series tác phẩm của riêng bạn</p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tổng số Chapter</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChapters}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Đã xuất bản: {publishedChapters} · Chờ duyệt: {reviewChapters}
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tỷ lệ hoàn thành bản thảo</CardTitle>
            <Heart className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalChapters > 0 ? Math.round((publishedChapters / totalChapters) * 100) : 0}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Bản thảo nháp: {draftChapters} chapter</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics placeholders */}
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="size-4.5 text-primary" />
            Chi tiết các tác phẩm
          </CardTitle>
          <CardDescription className="text-xs">Danh sách số lượng chapter đã tạo theo từng Series.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-muted/5">
          {seriesList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Chưa có tác phẩm nào để thống kê.</p>
          ) : (
            seriesList.map(s => {
              const count = chapterRows.filter(c => c.series === s.title).length
              return (
                <div key={s.seriesid || s.id} className="flex justify-between items-center py-3 text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="size-2 rounded-full bg-primary" />
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.title}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count} Chapter
                  </Badge>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
