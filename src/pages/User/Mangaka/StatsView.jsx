import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart3, TrendingUp, Users, Heart } from 'lucide-react'

export default function StatsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Thống kê & Báo cáo</h1>
        <p className="text-sm text-muted-foreground">Theo dõi lượt đọc, mức độ phổ biến và hiệu suất công việc của bạn.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tổng lượt xem</CardTitle>
            <TrendingUp className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">148.5K</div>
            <p className="text-[10px] text-muted-foreground mt-1">+12.4% so với tuần trước</p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Người theo dõi</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,450</div>
            <p className="text-[10px] text-muted-foreground mt-1">+340 người theo dõi mới</p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Lượt yêu thích</CardTitle>
            <Heart className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45.2K</div>
            <p className="text-[10px] text-muted-foreground mt-1">Đánh giá trung bình: 4.8/5</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics placeholders */}
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="size-4.5 text-primary" />
            Lượt xem theo thời gian
          </CardTitle>
          <CardDescription className="text-xs">Số lượng người đọc trung bình hàng ngày trong 30 ngày qua.</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">Biểu đồ lượt xem đang tải...</p>
        </CardContent>
      </Card>
    </div>
  )
}
