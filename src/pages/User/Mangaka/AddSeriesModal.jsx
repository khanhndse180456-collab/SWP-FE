import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  SERIES_CONTENT_RATINGS,
  createEmptySeriesForm,
  seriesToForm,
} from '@/utils/seriesModel.js'
import { useGenres, useTags, useCreateGenre, useCreateTag } from '@/api/hooks'

// Helper: lay ID tu 1 genre/tag item (co the la object hoac string)
// Response sau normalize: genre_id, genre_name, tag_id, tag_name
function itemId(item) {
  if (!item) return null
  if (typeof item === 'object') {
    return item.genre_id ?? item.genreid ?? item.genreId ?? item.GenreId
      ?? item.tag_id ?? item.tagid ?? item.tagId ?? item.TagId
      ?? item.id ?? null
  }
  return null
}
function itemName(item) {
  if (!item) return ''
  if (typeof item === 'object') {
    const found = item.genre_name ?? item.genrename ?? item.genreName ?? item.GenreName
      ?? item.tag_name ?? item.tagname ?? item.tagName ?? item.TagName
      ?? item.name ?? item.Name ?? null
    if (found == null) return ''
    if (typeof found === 'object') return JSON.stringify(found)
    return String(found)
  }
  return String(item)
}
function itemKey(item, index) {
  const id = itemId(item)
  const name = itemName(item)
  return id != null ? `id:${String(id)}` : (name && typeof name !== 'object') ? `name:${name}` : `idx:${index}`
}

export default function AddSeriesModal({
  open,
  onClose,
  onSubmit,
  mode = 'create',
  initialSeries = null,
  authorName = '',
  existingTitles = [],
}) {
  const isEdit = mode === 'edit' && initialSeries
  if (open && isEdit) {
    console.log('[AddSeriesModal] Debug initialSeries:', initialSeries)
  }

  // Danh sach tu API (dang object { id, name })
  const { data: rawGenres = [], isLoading: genresLoading } = useGenres()
  const { data: rawTags = [], isLoading: tagsLoading } = useTags()

  // Chuyen doi API data sang array of { id, name } cho de truy cap
  const apiGenres = useMemo(() => rawGenres.map((g) => {
    return { id: itemId(g), name: itemName(g), _raw: g }
  }).filter(g => g.id != null || g.name), [rawGenres])

  const apiTags = useMemo(() => rawTags.map((t) => {
    return { id: itemId(t), name: itemName(t), _raw: t }
  }).filter(t => t.id != null || t.name), [rawTags])

  // Mutation de create new genre/tag
  const createGenre = useCreateGenre()
  const createTag = useCreateTag()

  const [form, setForm] = useState(() => createEmptySeriesForm(authorName))
  // genreIds: array of numbers (server IDs), tagIds: array of numbers
  const [selectedGenreIds, setSelectedGenreIds] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState([])

  // Trang thai tao genre/tag moi inline
  const [newGenreName, setNewGenreName] = useState('')
  const [creatingGenre, setCreatingGenre] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  const [touched, setTouched] = useState(false)

  // Helper resolve: lay selected IDs tu series (co the la string names hoac numbers)
  const resolveSelectedIds = (seriesGenres, seriesTags) => {
    // Genres: seriesGenres la array of string names
    const gIds = Array.isArray(seriesGenres) ? seriesGenres.map(gName => {
      // Tim trong apiGenres da load
      const found = apiGenres.find(g => g.name === String(gName))
      if (found?.id != null) return Number(found.id)
      // Neu apiGenres chua load, tra ve null de reset
      return null
    }).filter(id => id != null) : []
    // Tags: seriesTags la array of string names
    const tIds = Array.isArray(seriesTags) ? seriesTags.map(tName => {
      const found = apiTags.find(t => t.name === String(tName))
      if (found?.id != null) return Number(found.id)
      return null
    }).filter(id => id != null) : []
    return { gIds, tIds }
  }

  // Đồng bộ form và selected IDs khi mở modal hoặc khi danh sách genres/tags tải xong
  useEffect(() => {
    if (!open) return
    if (isEdit) {
      const f = seriesToForm(initialSeries)
      setForm(f)
      const { gIds, tIds } = resolveSelectedIds(initialSeries.genres, initialSeries.tags)
      setSelectedGenreIds(gIds)
      setSelectedTagIds(tIds)
    } else {
      setForm(createEmptySeriesForm(authorName))
      setSelectedGenreIds([])
      setSelectedTagIds([])
    }
    setNewGenreName('')
    setNewTagName('')
    setCreatingGenre(false)
    setCreatingTag(false)
    setTouched(false)
  }, [open, isEdit, initialSeries, apiGenres, apiTags, authorName])

  const titlesForValidation = useMemo(() => {
    if (!isEdit) return existingTitles
    const self = String(initialSeries?.title ?? '').toLowerCase()
    return existingTitles.filter(t => String(t).toLowerCase() !== self)
  }, [existingTitles, isEdit, initialSeries])

  // Inline validation: khop voi selectedGenreIds/tagIds thay vi form.genres/tagIds
  const validation = useMemo(() => {
    const errors = {}
    const title = String(form.title ?? '').trim()
    if (title.length < 2) errors.title = 'Tên series tối thiểu 2 ký tự.'
    else if (titlesForValidation.some(t => String(t).toLowerCase() === title.toLowerCase())) {
      errors.title = 'Đã có series trùng tên.'
    }
    const synopsis = String(form.synopsis ?? '').trim()
    if (synopsis.length < 1) errors.synopsis = 'Vui lòng nhập tóm tắt.'
    if (selectedGenreIds.length === 0) errors.genres = 'Chọn ít nhất một thể loại.'
    if (!isEdit && !form.coverImage) {
      errors.coverImage = 'Vui lòng chọn ảnh bìa.'
    } else if (form.coverImage) {
      const isImg = form.coverImage.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(form.coverImage.name)
      if (!isImg) {
        errors.coverImage = 'Ảnh bìa phải là định dạng hình ảnh (png, jpg, jpeg, webp, gif).'
      }
    }
    if (!isEdit && !form.proposalFile) {
      errors.proposalFile = 'Vui lòng đính kèm file bản đề xuất.'
    } else if (form.proposalFile) {
      const isPdfOrDoc = form.proposalFile.type === 'application/pdf' || 
                         form.proposalFile.type === 'application/msword' ||
                         form.proposalFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                         /\.(pdf|doc|docx)$/i.test(form.proposalFile.name)
      if (!isPdfOrDoc) {
        errors.proposalFile = 'File đề xuất phải là định dạng PDF hoặc Word (.doc, .docx).'
      }
    }
    return { ok: Object.keys(errors).length === 0, errors }
  }, [form, titlesForValidation, selectedGenreIds, isEdit])

  function patch(updates) {
    setForm(prev => ({ ...prev, ...updates }))
  }

  function toggleGenreById(id) {
    setSelectedGenreIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id].slice(0, 5)
    )
  }

  function toggleTagById(id) {
    setSelectedTagIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id].slice(0, 8)
    )
  }

  // Tao genre moi inline
  async function handleCreateGenre() {
    const name = newGenreName.trim()
    if (!name) return
    setCreatingGenre(true)
    try {
      const res = await createGenre.mutateAsync({ genreName: name })
      const newId = res.data?.genreId ?? res.data?.GenreId ?? res.data?.id
      if (newId != null) {
        setSelectedGenreIds(prev => [...prev, Number(newId)].slice(0, 5))
      }
      setNewGenreName('')
    } catch {
      // interceptor se show toast loi
    } finally {
      setCreatingGenre(false)
    }
  }

  // Tao tag moi inline
  async function handleCreateTag() {
    const name = newTagName.trim()
    if (!name) return
    setCreatingTag(true)
    try {
      const res = await createTag.mutateAsync({ tagName: name })
      const newId = res.data?.tagId ?? res.data?.TagId ?? res.data?.id
      if (newId != null) {
        setSelectedTagIds(prev => [...prev, Number(newId)].slice(0, 8))
      }
      setNewTagName('')
    } catch {
      // interceptor se show toast loi
    } finally {
      setCreatingTag(false)
    }
  }

  function handleClose() {
    setForm(isEdit ? seriesToForm(initialSeries) : createEmptySeriesForm(authorName))
    setSelectedGenreIds(isEdit ? (initialSeries?._genreIds ?? []) : [])
    setSelectedTagIds(isEdit ? (initialSeries?._tagIds ?? []) : [])
    setTouched(false)
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!validation.ok) return
    // Gui genreIds/tagIds (numbers) de backend map
    onSubmit({ ...form, genreIds: selectedGenreIds, tagIds: selectedTagIds }, {
      mode: isEdit ? 'edit' : 'create',
      seriesId: initialSeries?.id,
    })
    if (!isEdit) {
      setForm(createEmptySeriesForm(authorName))
      setSelectedGenreIds([])
      setSelectedTagIds([])
    }
    setTouched(false)
  }

  const err = (key) => {
    const error = validation.errors[key]
    if (!error) return null
    if (touched) return error
    // Show format/type errors immediately if a file has been selected
    if (key === 'coverImage' && form.coverImage && error.includes('định dạng')) return error
    if (key === 'proposalFile' && form.proposalFile && error.includes('định dạng')) return error
    return null
  }

  // Tra ve selected genre/tag names (hien thi tren chip)
  const selectedGenreNames = useMemo(() => {
    return selectedGenreIds.map(id => {
      const found = apiGenres.find(g => g.id === id)
      return found?.name ?? `Genre #${id}`
    })
  }, [selectedGenreIds, apiGenres])

  const selectedTagNames = useMemo(() => {
    return selectedTagIds.map(id => {
      const found = apiTags.find(t => t.id === id)
      return found?.name ?? `Tag #${id}`
    })
  }, [selectedTagIds, apiTags])

  function handleOutsideInteraction(e) {
    const el = e.target
    if (el && (el.tagName === 'INPUT' || el.closest && el.closest('label'))) {
      const input = el.tagName === 'INPUT' ? el : el.querySelector('input')
      if (input && input.type === 'file') e.preventDefault()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent
        className="asm-dialog max-h-[90vh] overflow-y-auto"
        onInteractOutside={handleOutsideInteraction}
        onEscapeKeyDown={(e) => { e.preventDefault(); handleClose() }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{isEdit ? 'Chỉnh sửa series' : 'Tạo series mới'}</DialogTitle>
          <DialogDescription>Điền thông tin để tạo hoặc cập nhật series truyện.</DialogDescription>
        </DialogHeader>

        {/* Header */}
        <div className="asm-hero">
          <div className="asm-hero__glow asm-hero__glow--1" />
          <div className="asm-hero__glow asm-hero__glow--2" />
          <div className="asm-hero__inner">
            <div className="asm-hero__pill">
              <span className="asm-hero__pill-dot" />
              {isEdit ? 'Chỉnh sửa series' : 'Series mới'}
            </div>
            <h2 className="asm-hero__title">
              {isEdit ? `✦ ${initialSeries?.title || ''}` : 'Đăng ký series mới'}
            </h2>
            <p className="asm-hero__sub">
              {isEdit
                ? 'Cập nhật thông tin để hoàn thiện hồ sơ truyện.'
                : 'Khai báo hồ sơ để các bên phối hợp trên cùng một nguồn chuẩn.'}
            </p>
            {isEdit && !initialSeries?.metadataComplete ? (
              <Alert className="asm-warn">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Hồ sơ chưa đầy đủ — nên điền tóm tắt và thể loại.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>

        <form id="series-form" onSubmit={handleSubmit} className="asm-body">
          {/* ===== SECTION 1: Thong tin truyen ===== */}
          <section className="asm-section">
            <div className="asm-section__head">
              <span className="asm-section__num">1</span>
              <h3 className="asm-section__title">Thông tin truyện</h3>
            </div>

            <div className="asm-field">
              <Label className="asm-label" htmlFor="series-title">
                Tên hiển thị <span className="asm-req">*</span>
              </Label>
              <Input
                id="series-title"
                className="asm-input"
                value={form.title}
                onChange={e => patch({ title: e.target.value })}
                placeholder="Ví dụ: Huyền Long Ký"
                maxLength={120}
                autoFocus
                aria-invalid={!!err('title')}
              />
              {err('title') && <p className="asm-error">{err('title')}</p>}
            </div>

            <div className="asm-field">
              <Label className="asm-label" htmlFor="series-alt">Tên khác / Romaji</Label>
              <Input
                id="series-alt"
                className="asm-input"
                value={form.altTitle}
                onChange={e => patch({ altTitle: e.target.value })}
                placeholder="Tùy chọn"
                maxLength={120}
              />
            </div>

            {/* Tags */}
            <div className="asm-field">
              <Label className="asm-label">
                Tag / Thẻ
                {tagsLoading && <Loader2 className="ml-1 inline size-3 animate-spin text-muted-foreground" />}
              </Label>

              {/* Selected tag chips */}
              {selectedTagNames.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedTagNames.map((name, i) => (
                    <Badge key={selectedTagIds[i]} variant="secondary" className="pl-2 pr-1 py-0.5 text-xs gap-1">
                      #{name}
                      <button
                        type="button"
                        onClick={() => toggleTagById(selectedTagIds[i])}
                        className="ml-0.5 rounded-sm hover:bg-destructive/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={v => {
                    const tag = apiTags.find(t => t.name === v)
                    if (tag && tag.id != null) toggleTagById(tag.id)
                  }}
                >
                  <SelectTrigger className="asm-input flex-1">
                    <SelectValue placeholder="Chọn tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {apiTags
                      .filter(t => !selectedTagIds.includes(t.id))
                      .map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    {apiTags.filter(t => !selectedTagIds.includes(t.id)).length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Tất cả tag đã được chọn</div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => setCreatingTag(v => !v)}
                >
                  <Plus className="size-3" />
                  Tạo mới
                </Button>
              </div>

              {/* Inline tao tag */}
              {creatingTag && (
                <div className="mt-2 flex gap-2">
                  <Input
                    className="asm-input flex-1"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="Tên tag mới..."
                    maxLength={40}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
                  />
                  <Button type="button" size="sm" onClick={handleCreateTag} disabled={!newTagName.trim() || creatingTag}>
                    {creatingTag ? <Loader2 className="size-3 animate-spin" /> : 'Tạo'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setCreatingTag(false); setNewTagName('') }}>
                    Hủy
                  </Button>
                </div>
              )}
            </div>

            <div className="asm-field">
              <Label className="asm-label" htmlFor="series-synopsis">
                Tóm tắt / giới thiệu <span className="asm-req">*</span>
              </Label>
              <Textarea
                id="series-synopsis"
                className="asm-textarea"
                value={form.synopsis}
                onChange={e => patch({ synopsis: e.target.value })}
                placeholder="Cốt truyện, bối cảnh, nhân vật chính..."
                rows={4}
                maxLength={2000}
                aria-invalid={!!err('synopsis')}
              />
              <div className="asm-char-count">
                <span className={form.synopsis.length < 1 ? 'asm-char-count--warn' : ''}>
                  {form.synopsis.length}/2000
                </span>
                {err('synopsis') && <span className="asm-error">{err('synopsis')}</span>}
              </div>
            </div>

            {/* File uploads */}
            <div className="asm-row">
              <div className="asm-field">
                <Label className="asm-label" htmlFor="series-cover">
                  Ảnh bìa {!isEdit && <span className="asm-req">*</span>}
                </Label>
                <Input
                  id="series-cover"
                  className="asm-input"
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null
                    if (file) {
                      const isImg = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name)
                      if (!isImg) {
                        toast.error('Ảnh bìa phải là định dạng hình ảnh (png, jpg, jpeg, webp, gif).')
                        e.target.value = ''
                        patch({ coverImage: null })
                        return
                      }
                    }
                    patch({ coverImage: file })
                  }}
                />
                {form.coverImage ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Đã chọn: <span className="font-medium">{form.coverImage.name}</span>
                    ({(form.coverImage.size / 1024).toFixed(1)} KB)
                  </p>
                ) : isEdit && initialSeries.coverImage ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ảnh bìa cũ: <a href={initialSeries.coverImage} target="_blank" rel="noreferrer" className="text-amber-600 hover:text-amber-700 font-medium underline">Xem ảnh hiện tại</a>
                  </p>
                ) : null}
                {(err('coverImage')) && <p className="asm-error">{err('coverImage')}</p>}
              </div>
              <div className="asm-field">
                <Label className="asm-label" htmlFor="series-proposal">
                  File bản đề xuất (PDF) {!isEdit && <span className="asm-req">*</span>}
                </Label>
                <Input
                  id="series-proposal"
                  className="asm-input"
                  type="file"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null
                    if (file) {
                      const isPdfOrDoc = file.type === 'application/pdf' || 
                                         file.type === 'application/msword' ||
                                         file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                                         /\.(pdf|doc|docx)$/i.test(file.name)
                      if (!isPdfOrDoc) {
                        toast.error('File đề xuất phải là định dạng PDF hoặc Word (.pdf, .doc, .docx).')
                        e.target.value = ''
                        patch({ proposalFile: null })
                        return
                      }
                    }
                    patch({ proposalFile: file })
                  }}
                />
                {form.proposalFile ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Đã chọn: <span className="font-medium">{form.proposalFile.name}</span>
                    ({(form.proposalFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : isEdit && initialSeries.proposalFileUrl ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Bản đề xuất cũ: <a href={initialSeries.proposalFileUrl} target="_blank" rel="noreferrer" className="text-amber-600 hover:text-amber-700 font-medium underline">Tải xuống file hiện tại</a>
                  </p>
                ) : null}
                {(err('proposalFile')) && <p className="asm-error">{err('proposalFile')}</p>}
              </div>
            </div>
          </section>

          {/* ===== SECTION 2: Phan loai ===== */}
          <section className="asm-section">
            <div className="asm-section__head">
              <span className="asm-section__num">2</span>
              <h3 className="asm-section__title">Phân loại</h3>
            </div>

            {/* The loai */}
            <div className="asm-field">
              <Label className="asm-label">
                Thể loại <span className="asm-hint">(tối đa 5)</span>
                {genresLoading && <Loader2 className="ml-1 inline size-3 animate-spin text-muted-foreground" />}
              </Label>

              {/* Selected genre chips */}
              {selectedGenreNames.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedGenreNames.map((name, i) => (
                    <Badge key={selectedGenreIds[i]} variant="secondary" className="pl-2 pr-1 py-0.5 text-xs gap-1">
                      {name}
                      <button
                        type="button"
                        onClick={() => toggleGenreById(selectedGenreIds[i])}
                        className="ml-0.5 rounded-sm hover:bg-destructive/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={v => {
                    const genre = apiGenres.find(g => g.name === v)
                    if (genre && genre.id != null) toggleGenreById(genre.id)
                  }}
                >
                  <SelectTrigger className="asm-input flex-1">
                    <SelectValue placeholder="Chọn thể loại..." />
                  </SelectTrigger>
                  <SelectContent>
                    {apiGenres
                      .filter(g => !selectedGenreIds.includes(g.id))
                      .map((g) => (
                        <SelectItem key={g.id} value={g.name}>
                          {g.name}
                        </SelectItem>
                      ))}
                    {apiGenres.filter(g => !selectedGenreIds.includes(g.id)).length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Tất cả thể loại đã được chọn</div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => setCreatingGenre(v => !v)}
                >
                  <Plus className="size-3" />
                  Tạo mới
                </Button>
              </div>

              {/* Inline tao genre */}
              {creatingGenre && (
                <div className="mt-2 flex gap-2">
                  <Input
                    className="asm-input flex-1"
                    value={newGenreName}
                    onChange={e => setNewGenreName(e.target.value)}
                    placeholder="Tên thể loại mới..."
                    maxLength={40}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateGenre())}
                  />
                  <Button type="button" size="sm" onClick={handleCreateGenre} disabled={!newGenreName.trim() || creatingGenre}>
                    {creatingGenre ? <Loader2 className="size-3 animate-spin" /> : 'Tạo'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setCreatingGenre(false); setNewGenreName('') }}>
                    Hủy
                  </Button>
                </div>
              )}

              {/* Loading state */}
              {genresLoading && apiGenres.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Đang tải thể loại...</p>
              )}
              {err('genres') && <p className="asm-error">{err('genres')}</p>}
            </div>

            {/* Phan loai noi dung */}
            <div className="asm-field">
              <Label className="asm-label">Phân loại nội dung</Label>
              <Select value={form.contentRating} onValueChange={v => patch({ contentRating: v })}>
                <SelectTrigger className="asm-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERIES_CONTENT_RATINGS.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="font-medium">{r.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Mo ta chi tiet cua rating dang chon */}
              {form.contentRating && (() => {
                const selected = SERIES_CONTENT_RATINGS.find(r => r.value === form.contentRating)
                return selected?.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
                ) : null
              })()}
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="asm-footer">
          {touched && !validation.ok ? (
            <p className="asm-footer__warn">Vui lòng kiểm tra các trường còn thiếu</p>
          ) : null}
          <Button type="button" variant="outline" onClick={handleClose} className="asm-btn-cancel">
            Hủy
          </Button>
          <Button
            type="submit"
            form="series-form"
            className="asm-btn-submit"
          >
            {isEdit ? 'Lưu thay đổi' : 'Tạo series'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}