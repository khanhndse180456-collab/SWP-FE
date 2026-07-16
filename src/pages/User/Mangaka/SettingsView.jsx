import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function SettingsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt</h1>
        <p className="text-sm text-muted-foreground">Tùy chỉnh thông báo và tùy chọn hiển thị hệ thống của bạn.</p>
      </div>

      <Card className="border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-bold">Cài đặt thông báo</CardTitle>
          <CardDescription className="text-xs">Chọn kênh nhận thông báo về cập nhật mới từ hệ thống.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Thông báo qua Email</Label>
              <p className="text-xs text-muted-foreground">Nhận email khi Editor duyệt hoặc phản hồi bản thảo của bạn.</p>
            </div>
            {/* simple input checkbox styled as toggle if switch is not imported, or standard input checkbox */}
            <input type="checkbox" defaultChecked className="size-4 text-primary accent-primary" />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Thông báo khi có tin nhắn mới</Label>
              <p className="text-xs text-muted-foreground">Báo động khi Assistant gửi layer chỉnh sửa mới.</p>
            </div>
            <input type="checkbox" defaultChecked className="size-4 text-primary accent-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
