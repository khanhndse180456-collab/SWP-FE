import { Badge } from '@/components/ui/badge'
import { CoverThumb } from './CoverThumb.jsx'
import { normalizeStatus, statusVariant, statusLabel } from '@/pages/User/Tantou/TantouEditor.helpers.jsx'

export function SeriesSlideCard({ series, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`group shrink-0 cursor-pointer rounded-xl border p-3 text-xs transition-all hover:shadow-md ${
        isSelected
          ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-400 dark:bg-sky-950/30'
          : 'border-border bg-card hover:border-sky-300'
      }`}
      style={{ width: '160px' }}
    >
      <CoverThumb url={series.coverimageurl} sizeClass="w-full h-24 mb-2" />
      <p className="line-clamp-2 font-semibold leading-tight">{series.title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge variant={statusVariant(series.status)} className="text-[10px] px-1.5 py-0">
          {statusLabel(series.status)}
        </Badge>
        {series.publishformat && (
          <span className="text-[10px] text-muted-foreground">{series.publishformat}</span>
        )}
      </div>
    </div>
  )
}
