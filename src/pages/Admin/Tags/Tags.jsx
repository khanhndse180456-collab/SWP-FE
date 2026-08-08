import { useEffect, useState } from 'react'
import { Edit, Loader2, Plus, Search, Tag, Trash2 } from 'lucide-react'
import { api } from '@/api/Adminapi.js'
import axiosClient from '@/api/axiosClient.js'
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
import { toast } from 'sonner'

export default function Tags() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name-asc')

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState(null)
  const [tagName, setTagName] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete dialog states
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    try {
      setLoading(true)
      setError(null)
      const [tagsRes, seriesRes] = await Promise.all([
        api.getTags(),
        axiosClient.get('/Series')
      ])

      const tags = Array.isArray(tagsRes) ? tagsRes : []
      const series = Array.isArray(seriesRes.data) ? seriesRes.data : (Array.isArray(seriesRes) ? seriesRes : [])

      // Calculate series count per tag (map by tag name match, case-insensitive)
      const counts = {}
      series.forEach(s => {
        const sTags = s.tags ?? s.Tags ?? []
        sTags.forEach(t => {
          const name = t.tag_name ?? t.tagName ?? t.tagname ?? t.name ?? ''
          if (name) {
            const key = name.trim().toLowerCase()
            counts[key] = (counts[key] || 0) + 1
          }
        })
      })

      const listWithCounts = tags.map(t => {
        const key = (t.tagname || '').trim().toLowerCase()
        return {
          ...t,
          seriesCount: counts[key] || 0
        }
      })

      setList(listWithCounts)
    } catch (err) {
      setError(err.message || 'Lỗi tải danh sách tag')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenCreate() {
    setSelectedTag(null)
    setTagName('')
    setDialogOpen(true)
  }

  function handleOpenEdit(tag) {
    setSelectedTag(tag)
    setTagName(tag.tagname || '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!tagName.trim()) return
    try {
      setSaving(true)
      const payload = { tagname: tagName.trim() }
      if (selectedTag) {
        // Update
        const tagId = selectedTag.tagid ?? selectedTag.id
        await api.updateTag(tagId, payload)
        toast.success('Cập nhật tag thành công!')
      } else {
        // Create
        await api.createTag(payload)
        toast.success('Thêm tag mới thành công!')
      }
      setDialogOpen(false)
      loadTags()
    } catch (err) {
      toast.error(err.message || 'Có lỗi xảy ra khi lưu tag')
    } finally {
      setSaving(false)
    }
  }

  function handleOpenDelete(tag) {
    setTagToDelete(tag)
    setDeleteOpen(true)
  }

  async function handleDelete() {
    if (!tagToDelete) return
    try {
      setDeleting(true)
      const tagId = tagToDelete.tagid ?? tagToDelete.id
      await api.deleteTag(tagId)
      toast.success('Xóa tag thành công!')
      setDeleteOpen(false)
      loadTags()
    } catch (err) {
      toast.error(err.message || 'Xóa tag thất bại')
    } finally {
      setDeleting(false)
    }
  }

  // Filter
  const filtered = list.filter(t =>
    (t.tagname || '').toLowerCase().includes(search.toLowerCase())
  )

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return (a.tagname || '').localeCompare(b.tagname || '', 'vi')
    }
    if (sortBy === 'name-desc') {
      return (b.tagname || '').localeCompare(a.tagname || '', 'vi')
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
        <p className="mt-3 text-sm">Đang tải danh sách tag...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý Tags</h1>
          <p className="mt-1 text-sm text-muted-foreground">Phân loại bộ truyện thông qua nhãn (tags)</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="size-4" />
          Thêm Tag
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-destructive">
            <p className="text-sm font-medium">{error}</p>
            <Button onClick={loadTags} className="mt-4">Thử lại</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm nhãn..."
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
                <SelectItem value="name-asc">Tên tag (A-Z)</SelectItem>
                <SelectItem value="name-desc">Tên tag (Z-A)</SelectItem>
                <SelectItem value="count-desc">Số lượng truyện (Nhiều nhất)</SelectItem>
                <SelectItem value="count-asc">Số lượng truyện (Ít nhất)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map(t => {
              const tagId = t.tagid ?? t.id
              return (
                <Card key={tagId} className="group hover:border-primary/50 transition-all duration-200">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Tag className="size-4 text-primary shrink-0" />
                        <span className="font-medium text-sm">{t.tagname}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium mt-1">
                        Sử dụng: <span className="text-primary font-semibold">{t.seriesCount || 0} truyện</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleOpenEdit(t)}
                      >
                        <Edit className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 hover:bg-destructive/10"
                        onClick={() => handleOpenDelete(t)}
                      >
                        <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {sorted.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                Không tìm thấy tag nào phù hợp
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTag ? 'Sửa Tag' : 'Thêm Tag Mới'}</DialogTitle>
            <DialogDescription>
              Nhập tên nhãn dán cho truyện
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tagName">Tên Tag</Label>
              <Input
                id="tagName"
                placeholder="Ví dụ: Isekai, Romance..."
                value={tagName}
                onChange={e => setTagName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving || !tagName.trim()}>
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
            <DialogTitle>Xóa Tag</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa tag <strong className="text-foreground">"{tagToDelete?.tagname}"</strong>? Hành động này không thể hoàn tác.
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
