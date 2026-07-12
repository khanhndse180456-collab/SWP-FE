import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { statusVariant, statusLabel } from '@/pages/User/Tantou/TantouEditor.helpers.jsx'
import { CoverThumb } from './CoverThumb.jsx'

export function SubmissionCard({ sub, onReview, hasChapter = true }) {
  return (
    <Card className="group transition-all hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <CoverThumb url={sub.coverimageurl} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{sub.title}</h3>
            <Badge variant={statusVariant(sub.status)}>{statusLabel(sub.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {sub.publishformat} · {sub.agerating}
          </p>
          {sub.synopsis && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{sub.synopsis}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReview(sub)}
          disabled={!hasChapter}
          title={!hasChapter ? 'Mangaka chưa nộp chương nào cho series này' : undefined}
        >
          {hasChapter ? 'Mở & nhận xét' : 'Chưa có chương'}
        </Button>
      </CardContent>
    </Card>
  )
}