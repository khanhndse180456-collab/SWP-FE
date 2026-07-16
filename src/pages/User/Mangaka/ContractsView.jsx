import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ContractsView({ contracts = [] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hợp đồng của tôi</h1>
        <p className="text-sm text-muted-foreground">Quản lý các thỏa thuận và hợp đồng với hệ thống và Assistant.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {contracts.length === 0 ? (
          <Card className="col-span-2 border bg-card p-12 text-center text-muted-foreground">
            <FileText className="size-12 mx-auto mb-3 opacity-40 text-muted-foreground" />
            <p className="text-sm font-semibold">Chưa có hợp đồng nào được ký kết.</p>
          </Card>
        ) : (
          contracts.map((c) => {
            const status = (c.status ?? '').toLowerCase()
            const isActive = status === 'active' || status === 'approved'
            return (
              <Card key={c.id ?? c.contractId} className="border bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold">{c.title ?? `Hợp đồng #${c.id ?? c.contractId}`}</CardTitle>
                    <CardDescription className="text-xs">{c.description ?? 'Thỏa thuận hợp tác dịch vụ vẽ truyện tranh.'}</CardDescription>
                  </div>
                  <Badge variant="secondary" className={isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                    {isActive ? 'Đang hiệu lực' : 'Đang xử lý'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-primary" />
                    <span>Ngày ký: {c.createdat ? new Date(c.createdat).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-500" />
                    )}
                    <span>Đối tác: {c.assistantName ?? c.assistant_name ?? 'Hệ thống'}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
