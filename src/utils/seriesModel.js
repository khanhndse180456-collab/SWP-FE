/** Mô hình series — Mangaka khai báo đầy đủ; Editor Board / Assistant chỉ đọc tóm tắt. */

import { LABEL_EDITOR_BOARD, LABEL_TANTOU_EDITOR } from '../constants/roleTerminology.js'

export const SERIES_GENRES = [
  'Hành động', 'Phiêu lưu', 'Hài hước', 'Drama', 'Lãng mạn', 'Giả tưởng',
  'Kinh dị', 'Thể thao', 'Đời thường', 'Huyền ảo', 'Võ thuật', 'Isekai',
]

export const SERIES_DEMOGRAPHICS = [
  { value: 'shonen', label: 'Shōnen' },
  { value: 'shojo', label: 'Shōjo' },
  { value: 'seinen', label: 'Seinen' },
  { value: 'josei', label: 'Josei' },
  { value: 'all', label: 'Mọi lứa tuổi' },
]

export const SERIES_FORMATS = [
  { value: 'manga', label: 'Manga (Nhật)' },
  { value: 'manhwa', label: 'Manhwa (Hàn)' },
  { value: 'manhua', label: 'Manhua (Trung)' },
  { value: 'webtoon', label: 'Webtoon (cuộn dọc)' },
]

export const SERIES_LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
]

/**
 * Phan loai noi dung — map sang gia tri backend (CHECK constraint tren DB).
 * Backend: CONSTRAINT [chk_series_agerating] CHECK ([agerating] IN ('G','PG-13','R-16','R-18'))
 */
export const SERIES_CONTENT_RATINGS = [
  { value: 'G',     label: 'G — Mọi lứa tuổi',         description: 'Phù hợp mọi độ tuổi, không hạn chế nội dung.' },
  { value: 'PG-13', label: 'PG-13 — 13 tuổi trở lên',  description: 'Có thể có cảnh bạo lực nhẹ, kinh dị hoặc nhạy cảm.' },
  { value: 'R-16',  label: 'R-16 — 16 tuổi trở lên',   description: 'Chứa nội dung bạo lực, phiêu lưu mạo hiểm hoặc khiêu khích hơn.' },
  { value: 'R-18',  label: 'R-18 — Chỉ người lớn',      description: 'Chỉ dành cho người từ 18 tuổi trở lên. Có nội dung nhạy cảm rõ ràng.' },
]

export const SERIES_PUBLICATION_STATUSES = [
  { value: 'preparing', label: 'Chuẩn bị phát hành' },
  { value: 'ongoing', label: 'Đang ra' },
  { value: 'hiatus', label: 'Tạm dừng' },
  { value: 'completed', label: 'Hoàn thành' },
]

export const SERIES_PUBLISH_TYPES = [
  {
    value: 'debut',
    label: 'Phát hành lần đầu trên nền tảng',
    hint: `Luồng đầy đủ: Assistant → bạn duyệt → ${LABEL_TANTOU_EDITOR} → ${LABEL_EDITOR_BOARD} biểu quyết → xuất bản.`,
  },
  {
    value: 'continuing',
    label: 'Series đã có / chỉ thêm chapter',
    hint: `Không qua vòng ${LABEL_EDITOR_BOARD}; chapter mới chỉ qua ${LABEL_TANTOU_EDITOR}.`,
  },
]

export const SERIES_PALETTE = ['#457b9d', '#06d6a0', '#ffb703', '#bc6c25', '#7209b7', '#219ebc', '#e63946', '#9b5de5']

const DEMOGRAPHIC_LABEL = Object.fromEntries(SERIES_DEMOGRAPHICS.map((d) => [d.value, d.label]))
const FORMAT_LABEL = Object.fromEntries(SERIES_FORMATS.map((f) => [f.value, f.label]))
const LANGUAGE_LABEL = Object.fromEntries(SERIES_LANGUAGES.map((l) => [l.value, l.label]))
const RATING_LABEL = Object.fromEntries(SERIES_CONTENT_RATINGS.map((r) => [r.value, r.label]))
const PUB_LABEL = Object.fromEntries(SERIES_PUBLICATION_STATUSES.map((p) => [p.value, p.label]))

export function slugifySeriesTitle(title) {
  const base = String(title)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `series-${Date.now()}`
}

export function createEmptySeriesForm(authorName = '') {
  return {
    title: '',
    altTitle: '',
    synopsis: '',
    genres: [],
    demographic: 'shonen',
    format: 'manga',
    language: 'vi',
    contentRating: 'G',
    publicationStatus: 'preparing',
    publishType: 'debut',
    color: SERIES_PALETTE[0],
    tags: [],
    tagInput: '',
  }
}

/** Chuẩn hóa series cũ trong localStorage. */
export function normalizeSeries(raw, index = 0) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const title = String(s.title ?? '').trim() || `Series ${s.id ?? index + 1}`
  const slug = String(s.slug ?? '').trim() || slugifySeriesTitle(title)
  // Extract string names from genres/tags (co the la object {GenreId, GenreName} hoac string)
  const extractNames = (arr) => {
    if (!Array.isArray(arr)) return []
    return arr.map(item => {
      if (!item) return null
      if (typeof item === 'string') return item
      if (typeof item === 'object') {
        const name = item.genreName ?? item.GenreName ?? item.tagName ?? item.TagName ?? null
        if (typeof name === 'string') return name
        // Nested object: { en: "Action", vi: "Han dong" }
        if (typeof name === 'object' && name !== null) {
          return Object.values(name).find(v => typeof v === 'string' && v) ?? null
        }
        return null
      }
      return null
    }).filter(Boolean)
  }
  const genres = extractNames(s.genres)
  const tags = extractNames(s.tags)
  const publishType = s.publishType ?? (s.needsFullDebutPipeline ? 'debut' : 'continuing')
  const needsFullDebutPipeline = s.needsFullDebutPipeline ?? publishType === 'debut'

  const normalized = {
    id: s.id ?? index + 1,
    slug,
    title,
    altTitle: String(s.altTitle ?? '').trim(),
    synopsis: String(s.synopsis ?? '').trim(),
    genres: genres.length ? genres : (String(s.synopsis ?? '').trim() ? ['Đời thường'] : []),
    demographic: s.demographic ?? 'shonen',
    format: s.format ?? 'manga',
    language: s.language ?? 'vi',
    contentRating: s.contentRating ?? 'all',
    publicationStatus: s.publicationStatus ?? 'ongoing',
    publishType,
    needsFullDebutPipeline,
    authorName: String(s.authorName ?? '').trim() || 'Mangaka',
    authorId: s.authorId ?? null,
    createdAt: s.createdAt ?? new Date().toISOString(),
    tags,
    color: s.color ?? SERIES_PALETTE[(s.id ?? index) % SERIES_PALETTE.length],
    coverImage: s.coverImage ?? null,
    proposalFileUrl: s.proposalFileUrl ?? null,
    chapters: s.chapters ?? 0,
    marks: s.marks ?? 0,
    status: s.status ?? 'draft',
    updated: s.updated ?? '—',
    progress: s.progress ?? 0,
    metadataComplete: s.metadataComplete !== false && Boolean(String(s.synopsis ?? '').trim()),
  }
  normalized.statusLabel = s.statusLabel ?? buildWorkflowStatusLabel(normalized)
  return normalized
}

export function normalizeSeriesList(list) {
  if (!Array.isArray(list)) return []
  return list.map((s, i) => normalizeSeries(s, i))
}

export function buildWorkflowStatusLabel(s) {
  const pub = PUB_LABEL[s.publicationStatus] ?? 'Chuẩn bị'
  if (s.status === 'assistant') return 'Đang vẽ ngoại cảnh'
  if (s.status === 'review') return 'Chờ Tantou duyệt'
  if (s.status === 'draft') {
    if (s.publicationStatus === 'preparing') return `Bản nháp · ${pub}`
    return 'Bản nháp'
  }
  return pub
}

export function formatSeriesCatalogLine(series) {
  const fmt = FORMAT_LABEL[series.format] ?? series.format
  const demo = DEMOGRAPHIC_LABEL[series.demographic] ?? series.demographic
  const lang = LANGUAGE_LABEL[series.language] ?? series.language
  return `${fmt} · ${demo} · ${lang}`
}

/** Một dòng ngắn trên thẻ series / Editor Board — tránh chữ nhỏ chồng chữ. */
export function formatSeriesCardLine(series) {
  const s = typeof series?.title === 'string' ? series : normalizeSeries(series)
  const genreBit = s.genres?.length ? s.genres.slice(0, 2).join(' · ') : ''
  const fmtRaw = FORMAT_LABEL[s.format] ?? s.format ?? ''
  const fmt = String(fmtRaw).replace(/\s*\([^)]*\)\s*$/, '').trim()
  return [genreBit, fmt].filter(Boolean).join(' · ') || '—'
}

export function formatSeriesRating(series) {
  return RATING_LABEL[series.contentRating] ?? series.contentRating
}

/** Payload gửi Editor Board / Assistant — không cần toàn bộ workspace. */
export function seriesToExternalSummary(series) {
  const s = normalizeSeries(series)
  return {
    id: s.id,
    title: s.title,
    slug: s.slug,
    genres: s.genres,
    demographic: s.demographic,
    demographicLabel: DEMOGRAPHIC_LABEL[s.demographic],
    format: s.format,
    formatLabel: FORMAT_LABEL[s.format],
    language: s.language,
    contentRating: s.contentRating,
    ratingLabel: RATING_LABEL[s.contentRating],
    synopsis: s.synopsis,
    synopsisShort: s.synopsis.length > 140 ? `${s.synopsis.slice(0, 137)}…` : s.synopsis,
    authorName: s.authorName,
    altTitle: s.altTitle,
    publishType: s.publishType,
    publicationStatus: s.publicationStatus,
    publicationLabel: PUB_LABEL[s.publicationStatus],
    catalogLine: formatSeriesCatalogLine(s),
  }
}

export function seriesToForm(series) {
  const s = normalizeSeries(series)
  return {
    title: s.title,
    altTitle: s.altTitle || '',
    synopsis: s.synopsis || '',
    genres: [...(s.genres || [])],
    demographic: s.demographic,
    format: s.format,
    language: s.language,
    contentRating: s.contentRating,
    publicationStatus: s.publicationStatus,
    publishType: s.publishType,
    color: s.color,
    tags: Array.isArray(s.tags) ? [...s.tags] : [],
    tagInput: '',
  }
}

export function validateSeriesForm(form, existingTitles = [], options = {}) {
  const errors = {}
  const title = String(form.title ?? '').trim()
  const excludeTitle = String(options.excludeTitle ?? '').trim().toLowerCase()
  if (title.length < 2) errors.title = 'Tên series tối thiểu 2 ký tự.'
  else if (existingTitles.some((t) => {
    const lower = String(t).toLowerCase()
    if (excludeTitle && lower === excludeTitle) return false
    return lower === title.toLowerCase()
  })) {
    errors.title = 'Đã có series trùng tên.'
  }

  const synopsis = String(form.synopsis ?? '').trim()
  if (synopsis.length < 1) errors.synopsis = 'Vui lòng nhập tóm tắt.'

  if (!Array.isArray(form.genres) || form.genres.length === 0) {
    errors.genres = 'Chọn ít nhất một thể loại.'
  } else if (form.genres.length > 5) {
    errors.genres = 'Tối đa 5 thể loại.'
  }

  if (!form.demographic) errors.demographic = 'Chọn đối tượng độc giả.'
  if (!form.format) errors.format = 'Chọn định dạng truyện.'
  if (!form.language) errors.language = 'Chọn ngôn ngữ gốc.'
  if (!form.contentRating) errors.contentRating = 'Chọn phân loại nội dung.'
  if (!form.publicationStatus) errors.publicationStatus = 'Chọn trạng thái phát hành.'

  return { ok: Object.keys(errors).length === 0, errors }
}

export function buildSeriesFromForm(form, { id, authorName, authorId }) {
  const title = String(form.title).trim()
  const publishType = form.publishType === 'continuing' ? 'continuing' : 'debut'
  const needsFullDebutPipeline = publishType === 'debut'
  const tags = Array.isArray(form.tags)
    ? form.tags.filter(Boolean).slice(0, 8)
    : String(form.tags ?? '').split(/[,;#]+/).map((t) => t.trim()).filter(Boolean).slice(0, 8)

  const series = normalizeSeries({
    id,
    slug: slugifySeriesTitle(title),
    title,
    altTitle: String(form.altTitle ?? '').trim(),
    synopsis: String(form.synopsis ?? '').trim(),
    genres: [...form.genres],
    demographic: form.demographic,
    format: form.format,
    language: form.language,
    contentRating: form.contentRating,
    publicationStatus: form.publicationStatus,
    publishType,
    needsFullDebutPipeline,
    authorName: authorName || 'Mangaka',
    authorId,
    createdAt: new Date().toISOString(),
    tags,
    color: form.color ?? SERIES_PALETTE[id % SERIES_PALETTE.length],
    chapters: 0,
    marks: 0,
    status: 'draft',
    updated: 'Vừa tạo',
    progress: 0,
    metadataComplete: true,
  })

  return {
    ...series,
    statusLabel: buildWorkflowStatusLabel(series),
  }
}

/** Cập nhật hồ sơ series — giữ id, tiến độ, chapter, trạng thái workflow. */
export function applySeriesFormUpdate(existing, form) {
  const base = normalizeSeries(existing)
  const title = String(form.title).trim()
  const publishType = form.publishType === 'continuing' ? 'continuing' : 'debut'
  const needsFullDebutPipeline = publishType === 'debut'
  const synopsis = String(form.synopsis ?? '').trim()
  const tags = Array.isArray(form.tags)
    ? form.tags.filter(Boolean).slice(0, 8)
    : String(form.tags ?? '').split(/[,;#]+/).map((t) => t.trim()).filter(Boolean).slice(0, 8)

  const merged = normalizeSeries({
    ...base,
    slug: slugifySeriesTitle(title),
    title,
    altTitle: String(form.altTitle ?? '').trim(),
    synopsis,
    genres: [...form.genres],
    demographic: form.demographic,
    format: form.format,
    language: form.language,
    contentRating: form.contentRating,
    publicationStatus: form.publicationStatus,
    publishType,
    needsFullDebutPipeline,
    tags,
    color: form.color ?? base.color,
    metadataComplete: synopsis.length >= 1,
    updated: 'Vừa cập nhật hồ sơ',
  })

  return {
    ...merged,
    statusLabel: buildWorkflowStatusLabel({ ...base, ...merged }),
  }
}

/** Series tạo nhanh khi upload chapter trước khi khai báo hồ sơ. */
export function buildSeriesFromUploadTitle(title, { id, authorName, colorIndex = 0 }) {
  const series = normalizeSeries({
    id,
    title: String(title).trim(),
    slug: slugifySeriesTitle(title),
    synopsis: '',
    genres: [],
    publicationStatus: 'preparing',
    publishType: 'debut',
    needsFullDebutPipeline: true,
    authorName: authorName || 'Mangaka',
    chapters: 1,
    marks: 0,
    status: 'draft',
    statusLabel: 'Đã upload · cần bổ sung hồ sơ',
    updated: 'Vừa upload',
    progress: 15,
    color: SERIES_PALETTE[colorIndex % SERIES_PALETTE.length],
    metadataComplete: false,
  })
  return series
}

/**
 * Map 1 record Series từ backend (DTOs/SeriesDto) sang shape local.
 * Axios response đã được normalize về snake_case:
 *   series_id, title, synopsis, cover_image_url, proposal_file_url,
 *   age_rating, publish_format, mangaka_id, tantou_editor_id,
 *   genres[{genre_id, genre_name}], tags[{tag_id, tag_name}]
 */
export function mapApiSeriesToLocal(raw, index = 0) {
  if (!raw) return null
  const id = raw.seriesid ?? raw.series_id ?? raw.seriesId ?? raw.id ?? index + 1
  const title = String(raw.title ?? '').trim() || `Series ${id}`
  const status = String(raw.status ?? 'draft').toLowerCase()
  const agerating = String(raw.agerating ?? raw.age_rating ?? raw.ageRating ?? 'G').toUpperCase()
  const validRatings = ['G', 'PG-13', 'R-16', 'R-18']
  const safeRating = validRatings.includes(agerating) ? agerating : 'G'
  const pubFormat = String(raw.publishformat ?? raw.publish_format ?? raw.publishFormat ?? 'continuing')
  return normalizeSeries({
    id,
    seriesid: id,
    title,
    altTitle: title,
    synopsis: String(raw.synopsis ?? '').trim(),
    coverImage: raw.coverimageurl ?? raw.coverImageUrl ?? raw.CoverImageUrl ?? raw.Coverimageurl ?? raw.cover_image_url ?? null,
    proposalFileUrl: raw.proposalfileurl ?? raw.proposalFileUrl ?? raw.ProposalFileUrl ?? raw.Proposalfileurl ?? raw.proposal_file_url ?? null,
    genres: Array.isArray(raw.genres)
      ? raw.genres.map(g => {
          const v = g.genre_name ?? g.genrename ?? g.genreName ?? g.name ?? g.Name ?? null
          if (typeof v === 'object' && v !== null) {
            return Object.values(v).find(val => typeof val === 'string' && val) ?? null
          }
          return typeof v === 'string' ? v : null
        }).filter(Boolean)
      : [],
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(t => {
          const v = t.tag_name ?? t.tagname ?? t.tagName ?? t.name ?? t.Name ?? null
          if (typeof v === 'object' && v !== null) {
            return Object.values(v).find(val => typeof val === 'string' && val) ?? null
          }
          return typeof v === 'string' ? v : null
        }).filter(Boolean)
      : [],
    contentRating: safeRating,
    publicationStatus: status,
    publishType: pubFormat,
    needsFullDebutPipeline: pubFormat.toLowerCase() === 'debut',
    authorName: 'Mangaka',
    mangakaid: raw.mangakaid ?? raw.mangaka_id ?? raw.mangakaId,
    tantoueditorid: raw.tantoueditorid ?? raw.tantou_editor_id ?? raw.tantouEditorId,
    chapters: 0,
    marks: 0,
    status: (status === 'publishing') ? 'publishing' : (status === 'approved' || status === 'completed') ? 'done' : (status === 'cancelled') ? 'cancelled' : (status === 'pending' || status === 'editorreview' || status === 'editorreviewing' || status === 'submittedtoeditor' || status === 'ebreview') ? 'review' : 'draft',
    updated: (() => {
      const dateStr = raw.updatedat ?? raw.updated_at ?? raw.updatedAt ?? raw.createdat ?? raw.created_at ?? raw.createdAt;
      if (!dateStr) return 'Chưa cập nhật';
      try {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return 'Chưa cập nhật';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      } catch {
        return 'Chưa cập nhật';
      }
    })(),
    progress: 0,
    metadataComplete: Boolean(String(raw.synopsis ?? '').trim()),
    createdat: raw.createdat ?? raw.created_at ?? raw.createdAt,
    approvedat: raw.approvedat ?? raw.approved_at ?? raw.approvedAt,
  })
}

export function mapApiSeriesListToLocal(list) {
  if (!Array.isArray(list)) return []
  return list.map((s, i) => mapApiSeriesToLocal(s, i)).filter(Boolean)
}
