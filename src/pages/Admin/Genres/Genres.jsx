import { useEffect, useState } from 'react'
import { Edit, Layers, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '@/api/Adminapi.js'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function Genres() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name-asc')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [genreName, setGenreName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete dialog states
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [genreToDelete, setGenreToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadGenres()
  }, [])

  async function loadGenres() {
    try {
      setLoading(true)
      setError(null)
      const [genresRes, seriesRes] = await Promise.all([
        api.getGenres(),
        api.getMangaList()
      ])

      const genres = Array.isArray(genresRes) ? genresRes : []
      const series = Array.isArray(seriesRes) ? seriesRes : []

      // Calculate series count per genre (map by genre name match, case-insensitive)
      const counts = {}
      series.forEach(s => {
        (s.genre ?? []).forEach(gName => {
          const key = gName.trim().toLowerCase()
          counts[key] = (counts[key] || 0) + 1
        })
      })

      const listWithCounts = genres.map(g => {
        const key = (g.genrename || '').trim().toLowerCase()
        return {
          ...g,
          seriesCount: counts[key] || 0
        }
      })

      setList(listWithCounts)
    } catch (err) {
      setError(err.message || 'Lỗi tải danh sách thể loại')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenCreate() {
    setSelectedGenre(null)
    setGenreName('')
    setDescription('')
    setDialogOpen(true)
  }

  function handleOpenEdit(genre) {
    setSelectedGenre(genre)
    setGenreName(genre.genrename || '')
    setDescription(genre.description || '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!genreName.trim()) return
    try {
      setSaving(true)
      const payload = {
        genrename: genreName.trim(),
        description: description.trim() || null
      }
      if (selectedGenre) {
        // Update
        const genreId = selectedGenre.genreid ?? selectedGenre.id
        await api.updateGenre(genreId, payload)
        toast.success('Cập nhật thể loại thành công!')
      } else {
        // Create
        await api.createGenre(payload)
        toast.success('Thêm thể loại mới thành công!')
      }
      setDialogOpen(false)
      loadGenres()
    } catch (err) {
      toast.error(err.message || 'Có lỗi xảy ra khi lưu thể loại')
    } finally {
      setSaving(false)
    }
  }

  function handleOpenDelete(genre) {
    setGenreToDelete(genre)
    setDeleteOpen(true)
  }

  async function handleDelete() {
    if (!genreToDelete) return
    try {
      setDeleting(true)
      const genreId = genreToDelete.genreid ?? genreToDelete.id
      await api.deleteGenre(genreId)
      toast.success('Xóa thể loại thành công!')
      setDeleteOpen(false)
      loadGenres()
    } catch (err) {
      toast.error(err.message || 'Xóa thể loại thất bại')
    } finally {
      setDeleting(false)
    }
  }

  // Filter
  const filtered = list.filter(g =>
    (g.genrename || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(search.toLowerCase())
  )

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return (a.genrename || '').localeCompare(b.genrename || '', 'vi')
    }
    if (sortBy === 'name-desc') {
      return (b.genrename || '').localeCompare(a.genrename || '', 'vi')
    }
    if (sortBy === 'count-desc') {
      return (b.seriesCount || 0) - (a.seriesCount || 0)
    }
    if (sortBy === 'count-asc') {
      return (a.seriesCount || 0) - (b.seriesCount || 0)
    }
    return 0
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải danh sách thể loại...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý Thể loại</h1>
          <p className="mt-1 text-sm text-muted-foreground">Danh mục thể loại của manga trong hệ thống</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="size-4" />
          Thêm Thể loại
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-destructive">
            <p className="text-sm font-medium">{error}</p>
            <Button onClick={loadGenres} className="mt-4">Thử lại</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm thể loại..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Sắp xếp theo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Tên thể loại (A-Z)</SelectItem>
                <SelectItem value="name-desc">Tên thể loại (Z-A)</SelectItem>
                <SelectItem value="count-desc">Số lượng truyện (Nhiều nhất)</SelectItem>
                <SelectItem value="count-asc">Số lượng truyện (Ít nhất)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map(g => {
              const genreId = g.genreid ?? g.id
              return (
                <Card key={genreId} className="group hover:border-primary/50 transition-all duration-200">
                  <CardContent className="p-5 flex flex-col justify-between h-full min-h-[140px]">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="size-4 text-primary" />
                          <span className="font-semibold text-base">{g.genrename}</span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={() => handleOpenEdit(g)}
                          >
                            <Edit className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 hover:bg-destructive/10"
                            onClick={() => handleOpenDelete(g)}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground font-medium">
                        Số lượng truyện: <span className="text-primary font-semibold">{g.seriesCount || 0}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                        {g.description || 'Chưa có mô tả cho thể loại này.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {sorted.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                Không tìm thấy thể loại nào phù hợp
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedGenre ? 'Sửa Thể loại' : 'Thêm Thể loại Mới'}</DialogTitle>
            <DialogDescription>
              Thông tin chi tiết về thể loại truyện
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="genreName">Tên Thể loại</Label>
              <Input
                id="genreName"
                placeholder="Ví dụ: Hành động, Hài hước..."
                value={genreName}
                onChange={e => setGenreName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                placeholder="Mô tả tóm tắt nội dung/đặc trưng của thể loại..."
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving || !genreName.trim()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa Thể loại</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa thể loại <strong className="text-foreground">"{genreToDelete?.genrename}"</strong>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
