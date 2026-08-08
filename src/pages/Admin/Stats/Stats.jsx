import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react'
import { api } from '@/api/Adminapi.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function formatNum(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return n
}

export default function Stats() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('6m')

  const [bxhYear, setBxhYear] = useState(2026)
  const [bxhIssue, setBxhIssue] = useState(53)
  const [bxhList, setBxhList] = useState([])
  const [bxhLoading, setBxhLoading] = useState(false)

  // Initially sync bxhList from data.rankings
  useEffect(() => {
    if (data?.rankings) {
      setBxhList(data.rankings)
    }
  }, [data])

  // Fetch rankings when year or issue changes
  useEffect(() => {
    let active = true
    async function fetchRankings() {
      try {
        setBxhLoading(true)
        const res = await api.getRankingsByIssue(bxhYear, bxhIssue)
        if (active) {
          const mapped = res.map(r => ({
            title: r.series_title ?? r.seriesTitle ?? 'Không tên',
            votes: r.vote_count ?? r.voteCount ?? 0,
            rank: r.rank_position ?? r.rankPosition ?? 0,
            recordedAt: r.recorded_at ?? r.recordedAt
          }))
          setBxhList(mapped)
        }
      } catch (err) {
        console.error('Lỗi tải BXH:', err)
        if (active) setBxhList([])
      } finally {
        if (active) setBxhLoading(false)
      }
    }

    if (data) {
      fetchRankings()
    }
    return () => { active = false }
  }, [bxhYear, bxhIssue])

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      setLoading(true)
      setError(null)
      const result = await api.getStats()
      setData(result)
      if (result.latestYear) setBxhYear(result.latestYear)
      if (result.latestNumber) setBxhIssue(result.latestNumber)
    } catch (err) {
      setError(err.message || 'Lỗi tải thống kê')
      console.error('Load stats error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải thống kê...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thống kê</h1>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-destructive">
            <p className="text-sm font-medium">{error || 'Không thể tải thống kê'}</p>
            <Button onClick={loadStats} className="mt-4">
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const availableIssues = data.availableIssues || []
  const years = Array.from(new Set(availableIssues.map(i => i.year))).sort((a, b) => b - a)
  const issuesForYear = availableIssues.filter(i => i.year === bxhYear).map(i => i.number).sort((a, b) => b - a)

  const maxVotes = Math.max(...bxhList.map(r => r.votes), 1)
  const maxTop = data.topManga[0]?.reads || 1

  const milestones = [
    Math.round(maxVotes),
    Math.round(maxVotes * 0.75),
    Math.round(maxVotes * 0.5),
    Math.round(maxVotes * 0.25),
    0
  ]

  // Get recording time from the first item if available
  const recordedTime = bxhList[0]?.recordedAt 
    ? new Date(bxhList[0].recordedAt).toLocaleDateString('vi-VN') 
    : null

  const conicStop = data.deviceSplit.reduce((acc, d) => {
    const prev = acc.total
    acc.total += d.pct
    acc.parts.push(`${d.color} ${prev}% ${acc.total}%`)
    return acc
  }, { total: 0, parts: [] })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thống kê</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tổng quan hoạt động của hệ thống</p>
        </div>
        <div className="flex rounded-md border bg-card p-1">
          {[['7d', '7 ngày'], ['1m', '1 tháng'], ['6m', '6 tháng'], ['1y', '1 năm']].map(([v, l]) => (
            <Button
              key={v}
              size="sm"
              variant={range === v ? 'secondary' : 'ghost'}
              onClick={() => setRange(v)}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.overview.map(s => {
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <div className="mt-1.5 text-2xl font-bold tracking-tight">{s.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Bảng xếp hạng bình chọn</CardTitle>
            <CardDescription>
              Phiếu bầu của độc giả {recordedTime && `(Ghi nhận ngày: ${recordedTime})`}
            </CardDescription>
          </div>
          {availableIssues.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Năm:</span>
                <select
                  value={bxhYear}
                  onChange={e => {
                    const newYear = Number(e.target.value)
                    setBxhYear(newYear)
                    // Reset issue to first available for that year
                    const firstIssue = availableIssues.find(i => i.year === newYear)?.number || 1
                    setBxhIssue(firstIssue)
                  }}
                  className="h-8 rounded-md border bg-transparent px-2 text-xs focus:outline-none"
                >
                  {years.map(y => (
                    <option key={y} value={y} className="bg-popover text-popover-foreground">{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Kỳ:</span>
                <select
                  value={bxhIssue}
                  onChange={e => setBxhIssue(Number(e.target.value))}
                  className="h-8 rounded-md border bg-transparent px-2 text-xs focus:outline-none"
                >
                  {issuesForYear.map(num => (
                    <option key={num} value={num} className="bg-popover text-popover-foreground">Kỳ {num}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-gradient-to-t from-violet-500 to-indigo-500" />
              Số phiếu bầu (Votes)
            </div>
          </div>
          {bxhLoading ? (
            <div className="flex h-52 items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : bxhList.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-xs text-muted-foreground border-b border-muted">
              Không có dữ liệu xếp hạng. Vui lòng import trước.
            </div>
          ) : (
            <>
              <div className="flex h-52 gap-4">
                {/* Y-Axis Milestones */}
                <div className="flex flex-col justify-between text-right text-[10px] text-muted-foreground w-12 pb-1 pr-2 border-r select-none">
                  {milestones.map((val, idx) => (
                    <div key={idx}>{val}</div>
                  ))}
                </div>

                {/* Bars Grid */}
                <div className="relative flex-1 flex h-full items-end gap-6 border-b border-muted pb-1">
                  {/* Gridlines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none select-none">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <div key={idx} className="w-full border-t border-muted/30" style={{ height: '0px' }} />
                    ))}
                  </div>

                  {bxhList.map((r, i) => {
                    const heightPct = (r.votes / maxVotes) * 100
                    return (
                      <div key={i} className="group relative flex h-full flex-1 flex-col justify-end items-center gap-2 z-10">
                        {/* Hover Tooltip */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover border px-1.5 py-0.5 rounded shadow-sm z-20 pointer-events-none">
                          {r.votes.toLocaleString('vi-VN')} phiếu
                        </div>
                        <div
                          className="w-full max-w-[40px] rounded-t bg-gradient-to-t from-violet-500 to-indigo-500 transition-all group-hover:from-violet-600 group-hover:to-indigo-600 shadow-sm"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-2 flex pl-16 gap-6">
                {bxhList.map((r, i) => (
                  <div key={i} className="flex-1 text-center text-xs text-muted-foreground truncate max-w-[120px]" title={r.title}>
                    {r.title}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top truyện được bình chọn cao nhất</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topManga.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                  #{i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 truncate text-sm font-medium">{m.title}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-rose-400"
                      style={{ width: `${(m.reads / maxTop) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{formatNum(m.reads)} phiếu</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trạng thái bộ truyện</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div
              className="relative grid size-40 place-items-center rounded-full"
              style={{ background: `conic-gradient(${conicStop.parts.join(',')})` }}
            >
              <div className="grid size-24 place-items-center rounded-full bg-card text-lg font-bold">
                {data.deviceSplit[0]?.pct || 0}%
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {data.deviceSplit.map(d => (
                <div key={d.label} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-sm" style={{ background: d.color }} />
                    {d.label}
                  </div>
                  <span className="font-medium tabular-nums text-muted-foreground">{d.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}