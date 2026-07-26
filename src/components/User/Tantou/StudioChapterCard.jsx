import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LABEL_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import { normalizeStatus, statusVariant, statusLabel, isEbStatus, isApprovedStatus } from '@/pages/User/Tantou/TantouEditor.helpers.jsx'
import { CoverThumb } from './CoverThumb.jsx'

export function StudioChapterCard({ item, onClick }) {
  const s           = item.seriesInfo
  const st          = normalizeStatus(item.status)
  const isDelayed   = st === 'delayed'
  const isReady     = st === 'ready'
  const isPublished = st === 'published'

  const seriesWithEb     = s && isEbStatus(s.status)
  const seriesEbApproved = s && isApprovedStatus(s.status)

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all hover:shadow-md ${isDelayed && !seriesWithEb ? 'border-destructive/50' : ''}`}
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <CoverThumb url={s?.coverimageurl} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{s?.title ?? `Series #${item.seriesid}`}</h3>
            <Badge variant="secondary">Ch.{item.chapternumber}</Badge>
            <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>

            {seriesWithEb && (
              <Badge variant="outline" className="gap-1 border-violet-400 text-violet-600 dark:text-violet-400">
                <ShieldCheck className="size-3" />
                Series đang chờ {LABEL_EDITOR_BOARD} chấm
              </Badge>
            )}
            {isReady && (
              <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600 dark:text-amber-400">
                <Clock className="size-3" />
                Chờ {LABEL_EDITOR_BOARD} nhận xét
              </Badge>
            )}
            {isPublished && (
              <Badge variant="outline" className="gap-1 border-emerald-400 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                Đã {LABEL_EDITOR_BOARD} duyệt
              </Badge>
            )}
          </div>
          {item.title && (
            <p className="text-sm text-muted-foreground">{item.title}</p>
          )}
          {/* Deadline chỉ còn ý nghĩa khi series KHÔNG nằm bên EB chờ chấm */}
          {item.deadline && !seriesWithEb && (
            <p className={`text-xs ${isDelayed ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
              Deadline: {new Date(item.deadline).toLocaleDateString('vi-VN')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}