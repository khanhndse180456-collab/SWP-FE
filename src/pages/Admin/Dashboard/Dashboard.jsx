import { useEffect, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  TrendingUp,
  Users,
  XCircle,
  PenTool,
  UserCheck,
  ShieldCheck,
} from 'lucide-react'
import { api } from '@/api/Adminapi.js'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STATUS_LABEL = {
  Approved:    { label: 'Đang xuất bản', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  Publishing:  { label: 'Đang xuất bản', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  publishing:  { label: 'Đang xuất bản', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  ongoing:     { label: 'Đang xuất bản', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  Ongoing:     { label: 'Đang xuất bản', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  Rejected:    { label: 'Từ chối',       class: 'bg-red-100 text-red-700 hover:bg-red-100' },
  Pending:     { label: 'Chờ duyệt',     class: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  UnderReview: { label: 'Đang xét',      class: 'bg-sky-100 text-sky-700 hover:bg-sky-100' },
  Submitted:   { label: 'Đã nộp',        class: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
}

const SERIES_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#14b8a6', '#8b5cf6']

function initials(title = '') {
  return title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??'
}

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="text-3xl font-bold tracking-tight">{value ?? '—'}</div>
        </div>
        <div className={cn('flex size-11 items-center justify-center rounded-xl', colorClass)}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function SeriesStatsPanel({ stats }) {
  const items = [
    { label: 'Chờ duyệt',  value: stats.pending_series   ?? stats.pendingSeries,   color: 'text-amber-600',   icon: Clock },
    { label: 'Đang xuất bản',   value: stats.approved_series  ?? stats.approvedSeries,  color: 'text-emerald-600', icon: CheckCircle2 },
    { label: 'Từ chối',    value: stats.rejected_series  ?? stats.rejectedSeries,  color: 'text-red-600',     icon: XCircle },
    { label: 'Đang xuất bản (Đang ra)',    value: stats.ongoing_series   ?? stats.ongoingSeries,   color: 'text-sky-600',     icon: TrendingUp },
    { label: 'Hoàn thành', value: stats.completed_series ?? stats.completedSeries, color: 'text-purple-600',  icon: BookOpen },
  ]
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Thống kê Series</CardTitle>
        <CardDescription>Phân bổ theo trạng thái</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={cn('size-4', item.color)} />
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums', item.color)}>{item.value ?? 0}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function TopSeriesTable({ series }) {
  if (!series?.length) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Series nổi bật</CardTitle>
          <CardDescription>Các series đang xuất bản</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">Chưa có series nào được duyệt.</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Series nổi bật</CardTitle>
        <CardDescription>Các series đang xuất bản trong hệ thống</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y border-t">
          {series.map((s, idx) => {
            const id = s.seriesid ?? s.series_id ?? s.id
            const title = s.title ?? `Series #${id}`
            const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.Approved
            const genreNames = s.genres?.map(g => g?.genrename ?? g?.genre_name ?? g?.name ?? '').filter(Boolean).join(', ') || '—'
            return (
              <div key={id ?? idx} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/50">
                {s.coverimageurl ? (
                  <img src={s.coverimageurl} alt={title} className="size-10 shrink-0 rounded-lg object-cover shadow-sm" />
                ) : (
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
                    style={{ background: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                  >
                    {initials(title)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{title}</div>
                  <div className="text-xs text-muted-foreground">{genreNames}</div>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  {s.publishformat ?? '—'}
                </div>
                <Badge className={st.class} variant="secondary">{st.label}</Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [overview, setOverview]       = useState(null)
  const [seriesStats, setSeriesStats] = useState(null)
  const [topSeries, setTopSeries]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  useEffect(() => {
    Promise.all([
      api.getDashboardData(),
      api.getMangaList()
    ]).then(([{ overview, seriesStats, topSeries }, mangaList]) => {
      const hydratedTopSeries = topSeries.map(ts => {
        const tsId = ts.seriesid ?? ts.series_id ?? ts.id
        const fullManga = mangaList.find(m => String(m.id) === String(tsId))
        return {
          ...ts,
          publishformat: ts.publishformat ?? fullManga?.publishFormat ?? '—',
          genres: ts.genres?.length ? ts.genres : (fullManga?.genreList ?? []),
          coverimageurl: ts.coverimageurl ?? ts.cover_image_url ?? fullManga?.cover ?? null
        }
      })

      setOverview(overview)
      setSeriesStats(seriesStats)
      setTopSeries(hydratedTopSeries)
    })
    .catch(() => setError('Không thể tải dữ liệu dashboard.'))
    .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <XCircle className="size-8 text-red-500" />
        <p className="mt-3 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Row 1: Tổng quan người dùng theo role */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Người dùng theo vai trò</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Tổng người dùng"
            value={overview?.total_users ?? overview?.totalUsers}
            icon={Users}
            colorClass="bg-primary/10 text-primary"
          />
          <StatCard
            label="Mangaka"
            value={overview?.total_mangakas ?? overview?.totalMangakas}
            icon={PenTool}
            colorClass="bg-emerald-500/10 text-emerald-600"
          />
          <StatCard
            label="Assistant"
            value={overview?.total_assistants}
            icon={UserCheck}
            colorClass="bg-violet-500/10 text-violet-600"
          />
          <StatCard
            label="Editor (EB)"
            value={overview?.total_ebs}
            icon={ShieldCheck}
            colorClass="bg-sky-500/10 text-sky-600"
          />
          <StatCard
            label="Tantou Editor"
            value={overview?.total_tantous}
            icon={Users}
            colorClass="bg-rose-500/10 text-rose-600"
          />
        </div>
      </div>

      {/* Row 2: Nội dung */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nội dung</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <StatCard
            label="Tổng series"
            value={overview?.total_series ?? overview?.totalSeries}
            icon={BookOpen}
            colorClass="bg-amber-500/10 text-amber-600"
          />
          <StatCard
            label="Tổng chương"
            value={overview?.total_chapters ?? overview?.totalChapters}
            icon={BookOpen}
            colorClass="bg-teal-500/10 text-teal-600"
          />
        </div>
      </div>

      {/* Row 3: Series stats + Top series */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TopSeriesTable series={topSeries} />
        {seriesStats && <SeriesStatsPanel stats={seriesStats} />}
      </div>
    </div>
  )
}