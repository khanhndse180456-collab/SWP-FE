import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Eye, Edit2, Trash2 } from 'lucide-react'

export default function SeriesView({
  seriesList,
  ebApprovedMap,
  uploadPctBySeries,
  onOpenAddSeries,
  onOpenEdit,
  onDelete,
  onViewSeries,
  STATUS_BADGE,
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSeries = seriesList.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series của tôi</h1>
          <p className="text-sm text-muted-foreground">Quản lý tất cả các series bạn đã tạo.</p>
        </div>
        <Button onClick={onOpenAddSeries} className="bg-primary text-primary-foreground font-semibold">
          <Plus className="size-4 mr-2" />
          Thêm series mới
        </Button>
      </div>

      {/* Filter and search */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm series..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Series Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-4 w-[45%]">Series</th>
                <th className="p-4 w-[15%]">Trạng thái</th>
                <th className="p-4 w-[12%] text-center">Chapters</th>
                <th className="p-4 w-[18%]">Cập nhật cuối</th>
                <th className="p-4 w-[10%] text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredSeries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Không tìm thấy series nào.
                  </td>
                </tr>
              ) : (
                filteredSeries.map(s => {
                  const badge = STATUS_BADGE[s.status?.toLowerCase()] || STATUS_BADGE.draft
                  const initials = (s.title.length >= 2 ? s.title : `${s.title}●`).slice(0, 2)
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {s.coverImage ? (
                            <img src={s.coverImage} alt={s.title} className="size-12 object-cover rounded-md border" />
                          ) : (
                            <div
                              className="size-12 flex items-center justify-center rounded-md font-bold text-white text-xs shrink-0"
                              style={{ background: `linear-gradient(135deg, ${s.color || '#6366f1'}, ${s.color || '#6366f1'}88)` }}
                            >
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate hover:underline cursor-pointer" onClick={() => onViewSeries(s)}>
                              {s.title}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {s.genres?.slice(0, 2).map((g, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                  {g}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={badge.className} variant="secondary">
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-center font-medium">
                        {s.chapters || 0}
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {s.updated || 'Vừa cập nhật'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => onViewSeries(s)}
                            title="Xem chi tiết"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => onOpenEdit(s)}
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10"
                            onClick={() => onDelete(s.id)}
                            title="Xóa"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
