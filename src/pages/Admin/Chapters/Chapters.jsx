import { useEffect, useState } from 'react'
import { Image as ImageIcon, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { api } from '@/api/adminApi.js'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function ChapterDialog({ mangaId, open, onClose, onSave }) {
  const [form, setForm] = useState({ number: '', title: '', pages: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (open) setForm({ number: '', title: '', pages: '' })
  }, [open])

  async function handleSave() {
    if (!form.number) return
    setSaving(true)
    await api.createChapter({
      ...form,
      mangaId,
      uploadedBy: 'Admin',
      uploadedAt: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm chương mới</DialogTitle>
          <DialogDescription>Upload chương cho bộ truyện đang chọn</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Số chương *</Label>
              <Input type="number" value={form.number} onChange={e => set('number', e.target.value)} placeholder="143" />
            </div>
            <div className="space-y-2">
              <Label>Số trang</Label>
              <Input type="number" value={form.pages} onChange={e => set('pages', e.target.value)} placeholder="24" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tiêu đề chương</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Tên chương (tuỳ chọn)" />
          </div>
          <div className="space-y-2">
            <Label>Tải ảnh lên</Label>
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Upload className="size-5" />
              </div>
              <p className="text-sm font-medium">Kéo thả ảnh vào đây</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — tối đa 50MB</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving || !form.number}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? 'Đang lưu...' : 'Thêm chương'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Chapters() {
  const [mangaList, setMangaList] = useState([])
  const [selectedManga, setSelectedManga] = useState(null)
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)

  useEffect(() => {
    api.getMangaList().then(d => {
      setMangaList(d)
      if (d.length > 0) setSelectedManga(d[0])
    })
  }, [])

  useEffect(() => {
    if (!selectedManga) return
    setLoading(true)
    api.getChaptersByManga(selectedManga.id).then(d => {
      const mapped = d.map(c => ({
        ...c,
        uploadedBy: c.uploadedBy === '—' || !c.uploadedBy ? selectedManga.author : c.uploadedBy
      }))
      setChapters(mapped)
      setLoading(false)
    })
  }, [selectedManga])

  async function handleDelete(id) {
    if (!confirm('Xoá chương này?')) return
    await api.deleteChapter(id)
    setChapters(c => c.filter(ch => ch.id !== id))
  }

  async function handleSave() {
    setModal(false)
    setLoading(true)
    const d = await api.getChaptersByManga(selectedManga.id)
    const mapped = d.map(c => ({
      ...c,
      uploadedBy: c.uploadedBy === '—' || !c.uploadedBy ? selectedManga.author : c.uploadedBy
    }))
    setChapters(mapped)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chương truyện</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quản lý chương cho từng bộ truyện</p>
        </div>
        <Button onClick={() => setModal(true)} disabled={!selectedManga}>
          <Plus className="size-4" />
          Thêm chương
        </Button>
      </div>

      {selectedManga ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="size-14 overflow-hidden rounded-lg bg-muted shadow flex items-center justify-center">
              {selectedManga.cover ? (
                <img src={selectedManga.cover} alt={selectedManga.title} className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                  style={{ background: selectedManga.bg }}
                >
                  {selectedManga.initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{selectedManga.title}</div>
              <div className="text-xs text-muted-foreground">{selectedManga.chapters} chương · {chapters.length} đang xem</div>
            </div>
            <Select
              value={String(selectedManga.id)}
              onValueChange={(v) => setSelectedManga(mangaList.find(m => m.id === Number(v)))}
            >
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {mangaList.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-7 animate-spin" />
          <p className="mt-3 text-sm">Đang tải...</p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Chương</th>
                  <th className="px-4 py-3 text-left font-medium">Tiêu đề</th>
                  <th className="px-4 py-3 text-left font-medium">Trang</th>
                  <th className="px-4 py-3 text-left font-medium">Đăng bởi</th>
                  <th className="px-4 py-3 text-left font-medium">Ngày đăng</th>
                  <th className="px-4 py-3" style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {chapters.map(ch => (
                  <tr key={ch.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">#{ch.number}</Badge>
                    </td>
                    <td className="px-4 py-3">{ch.title || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ImageIcon className="size-3.5" />
                        {ch.pages} trang
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{ch.uploadedBy}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{ch.uploadedAt}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(ch.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {chapters.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <ImageIcon className="size-8 opacity-30" />
                <p className="mt-2 text-sm">Chưa có chương nào</p>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      <ChapterDialog mangaId={selectedManga?.id} open={modal} onClose={() => setModal(false)} onSave={handleSave} />
    </div>
  )
}