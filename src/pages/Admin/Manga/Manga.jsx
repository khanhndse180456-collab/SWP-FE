import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Edit,
  Eye,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/api/adminApi.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const STATUS_LABEL = {
  draft: { label: 'Nháp', class: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
  editorreview: { label: 'Chờ duyệt biên tập', class: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  ebreview: { label: 'Chờ duyệt ban biên tập', class: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  publishing: { label: 'Đang ra', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
  ongoing: { label: 'Đang ra', class: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
  completed: { label: 'Hoàn thành', class: 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400' },
  cancelled: { label: 'Tạm dừng/Hủy', class: 'bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400' },
  hiatus: { label: 'Tạm dừng', class: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'draft', label: 'Nháp' },
  { value: 'editorreview', label: 'Chờ duyệt biên tập' },
  { value: 'ebreview', label: 'Chờ duyệt ban biên tập' },
  { value: 'publishing', label: 'Đang ra' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Tạm dừng/Hủy' },
]

function MangaDialog({ manga, open, onClose, onSave }) {
  const isEdit = !!manga?.id
  const [form, setForm] = useState({
    title: '',
    synopsis: '',
    ageRating: 'G',
    mangakaId: '',
    genreIds: [],
    tagIds: [],
    status: 'draft',
    publishFormat: 'Pending',
    coverImage: null,
    proposalFile: null,
  })
  const [genres, setGenres] = useState([])
  const [tags, setTags] = useState([])
  const [mangakas, setMangakas] = useState([])
  const [saving, setSaving] = useState(false)

  const getGenreId = g => g.genreId ?? g.genre_id ?? g.genreid ?? g.id
  const getGenreName = g => g.genreName ?? g.genrename ?? g.name
  const getTagId = t => t.tagId ?? t.tag_id ?? t.tagid ?? t.id
  const getTagName = t => t.tagName ?? t.tagname ?? t.name

  useEffect(() => {
    if (open) {
      api.getGenres().then(setGenres).catch(console.error)
      api.getTags().then(setTags).catch(console.error)
      api.getUsers().then(users => {
        setMangakas(users.filter(u => u.role === 'mangaka'))
      }).catch(console.error)

      if (isEdit) {
        const gIds = (manga?.genreList ?? []).map(getGenreId).filter(Boolean)
        const tIds = (manga?.tagList ?? []).map(getTagId).filter(Boolean)
        setForm({
          title: manga?.title ?? '',
          synopsis: manga?.synopsis ?? '',
          ageRating: manga?.ageRating ?? manga?.agerating ?? 'G',
          mangakaId: manga?.mangakaId ?? manga?.mangakaid ?? '',
          genreIds: gIds,
          tagIds: tIds,
          status: manga?.status ?? 'draft',
          publishFormat: manga?.publishFormat ?? manga?.publishformat ?? 'Pending',
          coverImage: null,
          proposalFile: null,
        })
      } else {
        setForm({
          title: '',
          synopsis: '',
          ageRating: 'G',
          mangakaId: '',
          genreIds: [],
          tagIds: [],
          status: 'draft',
          publishFormat: 'Pending',
          coverImage: null,
          proposalFile: null,
        })
      }
    }
  }, [open, manga, isEdit])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleGenre = (id) => {
    setForm(f => {
      const exists = f.genreIds.includes(id)
      return {
        ...f,
        genreIds: exists ? f.genreIds.filter(x => x !== id) : [...f.genreIds, id]
      }
    })
  }

  const toggleTag = (id) => {
    setForm(f => {
      const exists = f.tagIds.includes(id)
      return {
        ...f,
        tagIds: exists ? f.tagIds.filter(x => x !== id) : [...f.tagIds, id]
      }
    })
  }

  async function handleSave() {
    if (!form.title.trim()) return
    if (!isEdit && !form.mangakaId) {
      toast.error('Vui lòng chọn tác giả!')
      return
    }
    if (!isEdit && !form.coverImage) {
      toast.error('Vui lòng tải lên ảnh bìa!')
      return
    }
    if (!isEdit && !form.proposalFile) {
      toast.error('Vui lòng tải lên bản đề xuất!')
      return
    }

    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('Title', form.title)
      formData.append('Synopsis', form.synopsis)
      formData.append('Agerating', form.ageRating)
      
      if (!isEdit) {
        formData.append('Mangakaid', form.mangakaId)
      }

      form.genreIds.forEach(id => formData.append('GenreIds', id))
      form.tagIds.forEach(id => formData.append('TagIds', id))

      if (form.coverImage) {
        formData.append('coverImage', form.coverImage)
      }
      if (form.proposalFile) {
        formData.append('proposalFile', form.proposalFile)
      }

      if (isEdit) {
        await api.updateManga(manga.id, formData)
        
        // Cập nhật trạng thái nếu thay đổi
        if (form.status !== manga.status) {
          await api.updateMangaStatus(manga.id, form.status)
        }
        
        // Cập nhật hình thức xuất bản nếu thay đổi
        if (form.publishFormat !== manga.publishFormat) {
          await api.updateMangaPublishFormat(manga.id, form.publishFormat)
        }
      } else {
        const res = await api.createManga(formData)
        const newId = res?.Id ?? res?.id
        
        if (newId && form.status !== 'draft') {
          await api.updateMangaStatus(newId, form.status)
        }
        if (newId && form.publishFormat !== 'Pending') {
          await api.updateMangaPublishFormat(newId, form.publishFormat)
        }
      }
      onSave()
      toast.success(isEdit ? 'Cập nhật truyện thành công!' : 'Thêm truyện thành công!')
    } catch (err) {
      console.error('Save error:', err)
      const errorMsg = err.response?.data?.message 
        || (typeof err.response?.data === 'string' ? err.response.data : null)
        || err.message 
        || 'Lỗi không xác định khi lưu'
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa truyện' : 'Thêm truyện mới'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Cập nhật thông tin chi tiết bộ truyện' : 'Tạo hồ sơ bộ truyện mới trong hệ thống'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Tên truyện *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Nhập tên truyện..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tác giả (Mangaka) *</Label>
              {isEdit ? (
                <Input value={manga?.author || ''} disabled className="bg-muted text-muted-foreground" />
              ) : (
                <Select value={form.mangakaId ? String(form.mangakaId) : ''} onValueChange={v => set('mangakaId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tác giả..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mangakas.map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Giới hạn độ tuổi *</Label>
              <Select value={form.ageRating} onValueChange={v => set('ageRating', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="G">G (Mọi lứa tuổi)</SelectItem>
                  <SelectItem value="PG-13">PG-13 (Trên 13 tuổi)</SelectItem>
                  <SelectItem value="R-16">R-16 (Trên 16 tuổi)</SelectItem>
                  <SelectItem value="R-18">R-18 (Trên 18 tuổi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Nháp (Draft)</SelectItem>
                  <SelectItem value="editorreview">Chờ duyệt biên tập (EditorReview)</SelectItem>
                  <SelectItem value="ebreview">Chờ duyệt ban biên tập (EBReview)</SelectItem>
                  <SelectItem value="publishing">Đang phát hành (Publishing)</SelectItem>
                  <SelectItem value="completed">Hoàn thành (Completed)</SelectItem>
                  <SelectItem value="cancelled">Tạm dừng/Hủy (Cancelled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hình thức xuất bản</Label>
              <Select value={form.publishFormat} onValueChange={v => set('publishFormat', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Chờ duyệt (Pending)</SelectItem>
                  <SelectItem value="Weekly">Hàng tuần (Weekly)</SelectItem>
                  <SelectItem value="Monthly">Hàng tháng (Monthly)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tóm tắt / Mô tả truyện</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
              value={form.synopsis}
              onChange={e => set('synopsis', e.target.value)}
              placeholder="Nhập mô tả tóm tắt nội dung truyện..."
            />
          </div>

          <div className="space-y-2">
            <Label className="block">Thể loại (Genres)</Label>
            <div className="grid grid-cols-3 gap-2 border p-3 rounded-md max-h-[150px] overflow-y-auto">
              {genres.map(g => {
                const id = getGenreId(g)
                const name = getGenreName(g)
                return (
                  <label key={id} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.genreIds.includes(id)}
                      onChange={() => toggleGenre(id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="block">Nhãn (Tags)</Label>
            <div className="grid grid-cols-3 gap-2 border p-3 rounded-md max-h-[150px] overflow-y-auto">
              {tags.map(t => {
                const id = getTagId(t)
                const name = getTagName(t)
                return (
                  <label key={id} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.tagIds.includes(id)}
                      onChange={() => toggleTag(id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ảnh bìa {isEdit && '(Để trống nếu giữ nguyên)'}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => set('coverImage', e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bản đề xuất {isEdit && '(Để trống nếu giữ nguyên)'}</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => set('proposalFile', e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm truyện'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MangaDrawer({ manga, onClose, onEdit, onDelete }) {
  const st = STATUS_LABEL[manga.status] ?? STATUS_LABEL.ongoing
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex w-full max-w-md flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold">Chi tiết truyện</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-lg flex items-center justify-center">
            {manga.cover ? (
              <img src={manga.cover} alt={manga.title} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-5xl font-bold text-white"
                style={{ background: manga.bg }}
              >
                {manga.initials}
              </div>
            )}
          </div>
          <h2 className="mb-1 text-xl font-bold">{manga.title}</h2>
          <p className="mb-4 text-sm text-muted-foreground">bởi {manga.author}</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(manga.genre ?? []).map(g => (
              <Badge key={g} variant="outline">{g}</Badge>
            ))}
            {(manga.tags ?? []).map(t => (
              <Badge key={t} variant="secondary" className="text-[11px] font-normal">#{t}</Badge>
            ))}
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Tác giả (Mangaka)</span>
              <span className="font-medium">{manga.author}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge className={st.class} variant="secondary">{st.label}</Badge>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Hình thức</span>
              <span className="font-medium">{manga.publishFormat}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Độ tuổi</span>
              <span className="font-medium">{manga.ageRating}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">BTV phụ trách</span>
              <span className="font-medium">{manga.editor}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Số chương</span>
              <span className="font-medium">{manga.chapters}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Ngày tạo</span>
              <span className="font-medium">{manga.createdAt}</span>
            </div>
            {manga.approvedAt && (
              <div className="flex justify-between border-b py-2">
                <span className="text-muted-foreground">Ngày duyệt/xuất bản</span>
                <span className="font-medium">{manga.approvedAt}</span>
              </div>
            )}
            <div className="py-2">
              <span className="text-muted-foreground block mb-1">Tóm tắt</span>
              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded-md border">{manga.synopsis}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t p-4">
          <Button onClick={onEdit} className="flex-1">
            <Edit className="size-4" />
            Sửa
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            Xoá
          </Button>
        </div>
      </aside>
    </div>
  )
}

export default function Manga() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView] = useState('table')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const d = await api.getMangaList()
      setList(d)
    } catch (err) {
      setError(err.message || 'Lỗi tải dữ liệu')
      console.error('Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setModal(null)
    await loadData()
  }

  function handleDelete(id) {
    setDeleteConfirmId(id)
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return
    try {
      await api.deleteManga(deleteConfirmId)
      setSelected(null)
      setList(l => l.filter(m => m.id !== deleteConfirmId))
      toast.success('Xoá truyện thành công!')
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Xoá truyện thất bại!')
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const filtered = list.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.title.toLowerCase().includes(q) || m.author.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchStatus
  })

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Quản lý truyện</h1></div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-destructive">
            <p className="text-sm font-medium">{error}</p>
            <Button onClick={loadData} className="mt-4">Thử lại</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý truyện</h1>
          <p className="mt-1 text-sm text-muted-foreground">{list.length} bộ truyện trong hệ thống</p>
        </div>
        <Button onClick={() => setModal({})}>
          <Plus className="size-4" />
          Thêm truyện
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Tìm theo tên, tác giả..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex rounded-md border bg-background p-0.5">
              <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('table')}>
                <List className="size-4" />
              </Button>
              <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('grid')}>
                <LayoutGrid className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-7 animate-spin" />
          <p className="mt-3 text-sm">Đang tải...</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(m => {
            const st = STATUS_LABEL[m.status] ?? STATUS_LABEL.ongoing
            return (
              <Card key={m.id} onClick={() => setSelected(m)} className="group cursor-pointer gap-0 overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="aspect-[3/4] overflow-hidden bg-muted flex items-center justify-center">
                  {m.cover ? (
                    <img src={m.cover} alt={m.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-white" style={{ background: m.bg }}>
                      {m.initials}
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="truncate text-sm font-semibold">{m.title}</div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{m.chapters} ch</span>
                    <Badge className={cn('text-[10px]', st.class)} variant="secondary">{st.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium" style={{ width: 60 }}></th>
                  <th className="px-4 py-3 text-left font-medium">Tên truyện</th>
                  <th className="px-4 py-3 text-left font-medium">Thể loại</th>
                  <th className="px-4 py-3 text-left font-medium">Chương</th>
                  <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                  <th className="px-4 py-3" style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(m => {
                  const st = STATUS_LABEL[m.status] ?? STATUS_LABEL.ongoing
                  return (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="size-9 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                          {m.cover ? (
                            <img src={m.cover} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white" style={{ background: m.bg }}>
                              {m.initials}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{m.author}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(m.genre ?? []).map(g => (
                            <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2">{m.chapters}</td>
                      <td className="px-4 py-2">
                        <Badge className={st.class} variant="secondary">{st.label}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setSelected(m)}>
                            <Eye className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setModal(m)}>
                            <Edit className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <Search className="size-8 opacity-30" />
                <p className="mt-2 text-sm">Không tìm thấy kết quả</p>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      {selected ? (
        <MangaDrawer
          manga={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setModal(selected); setSelected(null) }}
          onDelete={() => handleDelete(selected.id)}
        />
      ) : null}

      <MangaDialog manga={modal?.id ? modal : null} open={modal !== null} onClose={() => setModal(null)} onSave={handleSave} />

      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xoá bộ truyện này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Huỷ</Button>
            <Button variant="destructive" onClick={confirmDelete}>Xoá</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}