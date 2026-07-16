import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Eye, Edit2, Trash2 } from 'lucide-react'

export default function ChapterView({
  seriesList,
  chapterRows,
  onOpenAddChapter,
  onOpenEditChapter,
  onDeleteChapter,
  onViewChapterDetail,
  STATUS_BADGE,
}) {
  const [selectedSeriesId, setSelectedSeriesId] = useState(() => {
    if (seriesList && seriesList.length > 0) {
      return String(seriesList[0].id)
    }
    return 'all'
  })
  const [searchQuery, setSearchQuery] = useState('')

  const activeSeries = useMemo(() => {
    return seriesList.find(s => String(s.id) === selectedSeriesId)
  }, [seriesList, selectedSeriesId])

  const filteredChapters = useMemo(() => {
    let list = chapterRows
    if (activeSeries) {
      list = chapterRows.filter(c => String(c.series).toLowerCase() === activeSeries.title.toLowerCase())
    }
    if (searchQuery.trim()) {
      list = list.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return list
  }, [chapterRows, activeSeries, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {activeSeries ? activeSeries.title : 'Quản lý Chapter'}
          </h1>
          <p className="text-sm text-muted-foreground">Quản lý chapters của series.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
            <SelectTrigger className="w-56 h-9 bg-background">
              <SelectValue placeholder="Chọn Series" />
            </SelectTrigger>
            <SelectContent>
              {seriesList.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => onOpenAddChapter(activeSeries)}
            disabled={!activeSeries}
            className="bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="size-4 mr-2" />
            Thêm chapter mới
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm chapter..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Chapter Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-4 w-[20%]">Chapter</th>
                <th className="p-4 w-[40%]">Tiêu đề</th>
                <th className="p-4 w-[15%]">Trạng thái</th>
                <th className="p-4 w-[15%]">Ngày đăng</th>
                <th className="p-4 w-[10%] text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredChapters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Không tìm thấy chapter nào.
                  </td>
                </tr>
              ) : (
                filteredChapters.map(c => {
                  const badge = STATUS_BADGE[c.status?.toLowerCase()] || STATUS_BADGE.draft
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-semibold text-foreground">
                        Chapter {c.num}
                      </td>
                      <td className="p-4">
                        <span
                          className="font-medium text-foreground hover:underline cursor-pointer"
                          onClick={() => onViewChapterDetail(c)}
                        >
                          {c.title}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">({c.pages || 0} trang)</span>
                      </td>
                      <td className="p-4">
                        <Badge className={badge.className} variant="secondary">
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {c.date || c.createdAt || 'Nháp'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => onViewChapterDetail(c)}
                            title="Xem chi tiết / Annotate"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => onOpenEditChapter(c)}
                            title="Sửa thông tin"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10"
                            onClick={() => onDeleteChapter(c.id)}
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
