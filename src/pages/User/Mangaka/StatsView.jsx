import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart3, TrendingUp, Users, Heart, Trophy, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSeriesRankingHistory } from '@/api/hooks'

function getWeekDateRange(year, weekNumber) {
  if (!year || !weekNumber) return ''
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay()
  const jan4IsoDay = jan4Day === 0 ? 7 : jan4Day
  const startOfWeek1 = new Date(jan4.getTime() - (jan4IsoDay - 1) * 24 * 60 * 60 * 1000)
  const startOfTargetWeek = new Date(startOfWeek1.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000)
  const endOfTargetWeek = new Date(startOfTargetWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
  
  const formatDate = (date) => {
    const d = String(date.getDate()).padStart(2, '0')
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const y = date.getFullYear()
    return `${d}/${m}/${y}`
  }
  return `${formatDate(startOfTargetWeek)} - ${formatDate(endOfTargetWeek)}`
}

export default function StatsView({ seriesList = [], chapterRows = [] }) {
  // Compute statistics
  const totalSeries = seriesList.length
  const totalChapters = chapterRows.length
  
  // Count by status
  const publishedChapters = chapterRows.filter(c => c.status === 'Published' || c.status === 'published' || c.status === 'done').length
  const draftChapters = chapterRows.filter(c => c.status === 'Draft' || c.status === 'draft' || c.status === 'InProduction' || c.status === 'inproduction').length
  const reviewChapters = chapterRows.filter(c => c.status === 'Ready' || c.status === 'ready' || c.status === 'review' || c.status === 'ReadyForReview' || c.status === 'EbReview').length

  // Series Selection for Rankings
  const [selectedRankSeriesId, setSelectedRankSeriesId] = useState(() => {
    return seriesList.length > 0 ? String(seriesList[0].id ?? seriesList[0].seriesid ?? '') : ''
  })

  // Sync selected series ID when series list loads
  useEffect(() => {
    if (seriesList.length > 0 && !selectedRankSeriesId) {
      setSelectedRankSeriesId(String(seriesList[0].id ?? seriesList[0].seriesid ?? ''))
    }
  }, [seriesList, selectedRankSeriesId])

  const { data: rankingHistory = [], isLoading: rankingLoading } = useSeriesRankingHistory(
    selectedRankSeriesId ? Number(selectedRankSeriesId) : undefined
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Thống kê & Báo cáo</h1>
        <p className="text-sm text-muted-foreground">Theo dõi số lượng tác phẩm, hiệu suất công việc và thứ hạng của bạn.</p>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Detail List of Series */}
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

        {/* Weekly Ranking Table */}
        <Card className="border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Trophy className="size-4.5 text-amber-500" />
                Bảng xếp hạng tuần (Weekly Ranking)
              </CardTitle>
              <CardDescription className="text-xs">Lịch sử thứ hạng bình chọn của độc giả theo từng số báo.</CardDescription>
            </div>
            {seriesList.length > 0 && (
              <Select value={selectedRankSeriesId} onValueChange={setSelectedRankSeriesId}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Chọn series..." />
                </SelectTrigger>
                <SelectContent>
                  {seriesList.map(s => (
                    <SelectItem key={s.id ?? s.seriesid} value={String(s.id ?? s.seriesid)} className="text-xs">
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {rankingLoading ? (
              <p className="text-xs text-muted-foreground text-center py-8">Đang tải lịch sử xếp hạng...</p>
            ) : rankingHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Tác phẩm này chưa có lịch sử xếp hạng tuần.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                    <th className="p-2">Số báo (Issue)</th>
                    <th className="p-2 text-center">Thứ hạng</th>
                    <th className="p-2 text-center">Lượt bình chọn</th>
                    <th className="p-2 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {rankingHistory.map((r, i) => {
                    const rankPosition = r.rank_position ?? r.rankPosition ?? r.RankPosition
                    const issueNumber = r.issue_number ?? r.issueNumber ?? r.IssueNumber
                    const issueYear = r.issue_year ?? r.issueYear ?? r.IssueYear
                    const voteCount = r.vote_count ?? r.voteCount ?? r.VoteCount
                    const isBottomRank = r.is_bottom_rank ?? r.isBottomRank ?? r.IsBottomRank
                    const rankingId = r.ranking_id ?? r.rankingId ?? r.RankingId

                    // Gold, silver, bronze formatting
                    let rankBadge = (
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        #{rankPosition}
                      </span>
                    )
                    if (rankPosition === 1) {
                      rankBadge = <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold">🥇 Hạng 1</Badge>
                    } else if (rankPosition === 2) {
                      rankBadge = <Badge className="bg-zinc-400 hover:bg-zinc-500 text-white font-bold">🥈 Hạng 2</Badge>
                    } else if (rankPosition === 3) {
                      rankBadge = <Badge className="bg-amber-700 hover:bg-amber-800 text-white font-bold">🥉 Hạng 3</Badge>
                    }

                    return (
                      <tr key={rankingId ?? i} className="hover:bg-muted/30">
                        <td className="p-2 font-medium">
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3 text-muted-foreground" />
                            Kỳ {issueNumber} ({issueYear})
                          </div>
                          <div className="text-[10px] text-muted-foreground ml-4">
                            ({getWeekDateRange(issueYear, issueNumber)})
                          </div>
                        </td>
                        <td className="p-2 text-center">{rankBadge}</td>
                        <td className="p-2 text-center font-medium text-zinc-800 dark:text-zinc-200">
                          {voteCount?.toLocaleString() ?? '—'}
                        </td>
                        <td className="p-2 text-center">
                          {isBottomRank ? (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Chót bảng</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
