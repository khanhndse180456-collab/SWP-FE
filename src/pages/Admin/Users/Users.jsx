import { useEffect, useState } from 'react'
import { Edit, Eye, FileText, Loader2, Lock, Plus, Search, Trash2, Unlock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/api/adminApi.js'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CreateUserDialog from '@/components/Admin/Ui/createuserdialog.jsx'
import { toast } from 'sonner'
import { getSession } from '@/lib/auth.js'
import {
  Dialog as BaseDialog,
  DialogContent as BaseDialogContent,
  DialogDescription as BaseDialogDescription,
  DialogFooter as BaseDialogFooter,
  DialogHeader as BaseDialogHeader,
  DialogTitle as BaseDialogTitle,
} from '@/components/ui/dialog'

// roleId → label/class
const ROLES = [
  { id: 1, key: 'admin',    label: 'Admin',          cls: 'bg-rose-100 text-rose-700 hover:bg-rose-100' },
  { id: 2, key: 'eb',       label: 'Editorial Board', cls: 'bg-sky-100 text-sky-700 hover:bg-sky-100' },
  { id: 3, key: 'editor',   label: 'Tantou Editor',  cls: 'bg-violet-100 text-violet-700 hover:bg-violet-100' },
  { id: 4, key: 'mangaka',  label: 'Mangaka',        cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  { id: 5, key: 'assistant',label: 'Assistant',      cls: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
]
const ROLE_BY_KEY = Object.fromEntries(ROLES.map(r => [r.key, r]))
const ROLE_BY_ID  = Object.fromEntries(ROLES.map(r => [r.id,  r]))

const STATUS_LABEL = { active: 'Hoạt động', banned: 'Đã khoá' }
const STATUS_CLS = {
  active: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  banned: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
}

function RoleBadge({ roleKey }) {
  const r = ROLE_BY_KEY[roleKey] ?? { label: roleKey, cls: 'bg-slate-100 text-slate-700' }
  return <Badge className={r.cls} variant="secondary">{r.label}</Badge>
}

function UserDrawer({ user, onClose, onToggleStatus, onChangeRole }) {
  const [changing, setChanging] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  
  const self = getSession()
  const isSelf = String(user.email).toLowerCase() === String(self?.email).toLowerCase()
 
  useEffect(() => {
    setLoadingDetail(true)
    api.getUserDetail(user.id)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
  }, [user.id])

  async function handleToggle() {
    try {
      setChanging(true)
      await onToggleStatus(user.id, user.status === 'active' ? 'banned' : 'active')
    } finally {
      setChanging(false)
    }
  }
 
  async function handleChangeRole(roleKey) {
    try {
      setChanging(true)
      await onChangeRole(user.id, roleKey)
    } finally {
      setChanging(false)
    }
  }
 
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex w-full max-w-md flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold">Chi tiết người dùng</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
 
        <div className="flex flex-col items-center gap-3 border-b py-6">
          <Avatar className="size-20">
            {detail?.avatarUrl ? (
              <img src={detail.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-2xl font-bold text-primary-foreground">
                {user.initials}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="text-center">
            <div className="text-lg font-semibold">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
          <RoleBadge roleKey={user.role} />
        </div>
 
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thông tin</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tên đăng nhập</span>
                <span className="font-medium">{detail?.username || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngày tham gia</span>
                <span className="font-medium">{user.joinDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <Badge className={STATUS_CLS[user.status] ?? STATUS_CLS.active} variant="secondary">
                  {STATUS_LABEL[user.status] ?? user.status}
                </Badge>
              </div>
            </div>
          </div>
 
          {loadingDetail ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <>
              {detail.role === 'mangaka' && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hồ sơ Mangaka</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bút danh:</span>
                      <span className="font-medium">{detail.penName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SĐT:</span>
                      <span className="font-medium">{detail.phoneNumber || '—'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">Tiểu sử:</span>
                      <span className="font-medium bg-background p-2 rounded border block whitespace-pre-wrap leading-relaxed">{detail.bio || 'Chưa có tiểu sử'}</span>
                    </div>
                    <Separator className="my-2" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Tài khoản thanh toán</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ngân hàng:</span>
                      <span className="font-medium">{detail.bankName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Số tài khoản:</span>
                      <span className="font-medium">{detail.bankAccountNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tên tài khoản:</span>
                      <span className="font-medium">{detail.bankAccountName || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {detail.role === 'assistant' && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hồ sơ Assistant</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SĐT:</span>
                      <span className="font-medium">{detail.phoneNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trạng thái:</span>
                      <Badge variant={detail.isAvailable ? "default" : "secondary"}>
                        {detail.isAvailable ? 'Sẵn sàng nhận việc' : 'Bận'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Portfolio:</span>
                      {detail.portfolioUrl ? (
                        <a href={detail.portfolioUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline truncate max-w-[200px]">
                          {detail.portfolioUrl}
                        </a>
                      ) : <span>—</span>}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kỹ năng:</span>
                      <span className="font-medium">{detail.skills || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phần mềm:</span>
                      <span className="font-medium">{detail.softwareUsed || '—'}</span>
                    </div>
                    <Separator className="my-2" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Tài khoản thanh toán</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ngân hàng:</span>
                      <span className="font-medium">{detail.bankName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Số tài khoản:</span>
                      <span className="font-medium">{detail.bankAccountNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tên tài khoản:</span>
                      <span className="font-medium">{detail.bankAccountName || '—'}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}

          <Separator />
 
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Đổi vai trò</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <Button
                  key={r.key}
                  size="sm"
                  variant={user.role === r.key ? 'default' : 'outline'}
                  onClick={() => handleChangeRole(r.key)}
                  disabled={changing || isSelf}
                  title={isSelf ? "Không thể thay đổi vai trò của chính mình" : undefined}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
 
        <div className="border-t p-4">
          {user.status === 'active' ? (
            <Button
              variant="destructive"
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleToggle}
              disabled={changing || isSelf}
              title={isSelf ? "Không thể khoá tài khoản chính mình" : "Khoá tài khoản"}
            >
              <Lock className="mr-2 size-4" />
              Khoá tài khoản
            </Button>
          ) : (
            <Button
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleToggle}
              disabled={changing || isSelf}
            >
              <Unlock className="mr-2 size-4" />
              Mở khoá
            </Button>
          )}
        </div>
      </aside>
    </div>
  )
}

function ContractDialog({ contract, open, onClose, onSave, mangakas, assistants }) {
  const isEdit = !!contract?.id
  const [form, setForm] = useState({
    mangakaId: '',
    assistantId: '',
    salaryAmount: '',
    salaryType: 'Monthly',
    contractTerms: '',
    startDate: '',
    endDate: '',
    contractFileUrl: '',
  })
  const [selectedFile, setSelectedFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      if (isEdit) {
        setForm({
          mangakaId: String(contract.mangakaId),
          assistantId: String(contract.assistantId),
          salaryAmount: String(contract.salaryAmount),
          salaryType: contract.salaryType || 'Monthly',
          contractTerms: contract.contractTerms || '',
          startDate: contract.startDateRaw ? new Date(contract.startDateRaw).toISOString().split('T')[0] : '',
          endDate: contract.endDateRaw ? new Date(contract.endDateRaw).toISOString().split('T')[0] : '',
          contractFileUrl: contract.contractFileUrl || '',
        })
      } else {
        setForm({
          mangakaId: '',
          assistantId: '',
          salaryAmount: '',
          salaryType: 'Monthly',
          contractTerms: '',
          startDate: '',
          endDate: '',
          contractFileUrl: '',
        })
      }
    }
  }, [open, contract, isEdit])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.mangakaId || !form.assistantId || !form.salaryAmount || !form.contractTerms) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc!')
      return
    }

    try {
      setSaving(true)
      const payload = {
        mangakaId: Number(form.mangakaId),
        assistantId: Number(form.assistantId),
        salaryAmount: Number(form.salaryAmount),
        salaryType: form.salaryType,
        contractTerms: form.contractTerms,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        contractFileUrl: form.contractFileUrl || null,
      }

      let contractId = contract?.id
      if (isEdit) {
        await api.updateContract(contract.id, payload)
      } else {
        const res = await api.createContract(payload)
        contractId = res.contractId ?? res.contract_id ?? res.id
      }

      if (selectedFile && contractId) {
        await api.uploadContractFile(contractId, selectedFile)
      }

      toast.success(isEdit ? 'Cập nhật hợp đồng thành công!' : 'Tạo hợp đồng thành công!')
      onSave()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu hợp đồng')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BaseDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <BaseDialogContent className="sm:max-w-lg">
        <BaseDialogHeader>
          <BaseDialogTitle>{isEdit ? 'Cập nhật hợp đồng' : 'Tạo hợp đồng mới'}</BaseDialogTitle>
          <BaseDialogDescription>
            Thiết lập mối quan hệ hợp tác giữa Mangaka và Trợ lý (Assistant)
          </BaseDialogDescription>
        </BaseDialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tác giả (Mangaka) *</Label>
              <Select value={form.mangakaId} onValueChange={v => set('mangakaId', v)} disabled={isEdit}>
                <SelectTrigger><SelectValue placeholder="Chọn Mangaka..." /></SelectTrigger>
                <SelectContent>
                  {mangakas.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trợ lý (Assistant) *</Label>
              <Select value={form.assistantId} onValueChange={v => set('assistantId', v)} disabled={isEdit}>
                <SelectTrigger><SelectValue placeholder="Chọn Assistant..." /></SelectTrigger>
                <SelectContent>
                  {assistants.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lương (Salary Amount) *</Label>
              <Input type="number" value={form.salaryAmount} onChange={e => set('salaryAmount', e.target.value)} placeholder="5000000" />
            </div>
            <div className="space-y-2">
              <Label>Loại lương (Salary Type) *</Label>
              <Select value={form.salaryType} onValueChange={v => set('salaryType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Hàng tháng (Monthly)</SelectItem>
                  <SelectItem value="Fixed">Cố định (Fixed)</SelectItem>
                  <SelectItem value="PerChapter">Theo chương (PerChapter)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ngày bắt đầu</Label>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ngày kết thúc</Label>
              <Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chọn file hợp đồng (.pdf, .doc, .docx)</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              {form.contractFileUrl && !selectedFile && (
                <a href={form.contractFileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline shrink-0 truncate max-w-[120px]">
                  File hiện tại
                </a>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Điều khoản hợp đồng *</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
              value={form.contractTerms}
              onChange={e => set('contractTerms', e.target.value)}
              placeholder="Ghi rõ điều khoản hợp đồng..."
            />
          </div>
        </div>
        <BaseDialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo hợp đồng'}
          </Button>
        </BaseDialogFooter>
      </BaseDialogContent>
    </BaseDialog>
  )
}

export default function Users() {
  const [activeTab, setActiveTab] = useState('users') // 'users' or 'contracts'
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [confirmConfig, setConfirmConfig] = useState({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: null,
  })

  // Contract States
  const [contracts, setContracts] = useState([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [contractModal, setContractModal] = useState(null)
  const [contractDeleteConfirmId, setContractDeleteConfirmId] = useState(null)
  const [contractSearch, setContractSearch] = useState('')
  const [contractStatusFilter, setContractStatusFilter] = useState('all')

  useEffect(() => { 
    loadData()
    loadContracts()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const d = await api.getUsers()
      setList(d)
    } catch (err) {
      setError(err.message || 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  async function loadContracts() {
    try {
      setLoadingContracts(true)
      const d = await api.getContracts()
      setContracts(d)
    } catch (err) {
      console.error('Load contracts error:', err)
    } finally {
      setLoadingContracts(false)
    }
  }

  async function handleContractStatusChange(id, status) {
    try {
      await api.updateContractStatus(id, status)
      toast.success('Cập nhật trạng thái hợp đồng thành công!')
      loadContracts()
    } catch (err) {
      console.error(err)
      toast.error('Cập nhật trạng thái hợp đồng thất bại!')
    }
  }

  async function handleContractDelete(id) {
    setContractDeleteConfirmId(id)
  }

  async function confirmContractDelete() {
    if (!contractDeleteConfirmId) return
    try {
      await api.deleteContract(contractDeleteConfirmId)
      toast.success('Xoá hợp đồng thành công!')
      loadContracts()
    } catch (err) {
      console.error(err)
      toast.error('Xoá hợp đồng thất bại!')
    } finally {
      setContractDeleteConfirmId(null)
    }
  }

  async function handleToggleStatus(id, newStatus) {
    const userObj = list.find(u => u.id === id)
    if (!userObj) return

    const actionText = newStatus === 'banned' ? 'Khóa' : 'Mở khóa'
    const variant = newStatus === 'banned' ? 'destructive' : 'default'

    setConfirmConfig({
      open: true,
      title: `${actionText} tài khoản`,
      description: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} tài khoản của "${userObj.name}" không?`,
      variant: variant,
      onConfirm: async () => {
        try {
          await api.updateUserStatus(id, newStatus)
          setList(l => l.map(u => u.id === id ? { ...u, status: newStatus } : u))
          setSelected(s => s?.id === id ? { ...s, status: newStatus } : s)
          toast.success(`${actionText} tài khoản thành công!`)
        } catch (err) {
          console.error('Status error:', err)
          toast.error(err.message || `${actionText} tài khoản thất bại`)
        }
      }
    })
  }

  async function handleChangeRole(id, roleKey) {
    const role = ROLE_BY_KEY[roleKey]
    if (!role) return
    const userObj = list.find(u => u.id === id)
    if (!userObj) return

    setConfirmConfig({
      open: true,
      title: 'Thay đổi vai trò',
      description: `Bạn có chắc chắn muốn thay đổi vai trò của "${userObj.name}" thành "${role.label}" không?`,
      variant: 'default',
      onConfirm: async () => {
        try {
          await api.updateUserRole(id, role.id, userObj)
          setList(l => l.map(u => u.id === id ? { ...u, role: roleKey } : u))
          setSelected(s => s?.id === id ? { ...s, role: roleKey } : s)
          toast.success('Cập nhật vai trò thành công!')
        } catch (err) {
          console.error('Role error:', err)
          toast.error(err.response?.data?.message || err.message || 'Thay đổi vai trò thất bại')
        }
      }
    })
  }

  async function handleCreateUser(payload) {
    await api.createUser(payload)
    toast.success('Tạo tài khoản nhân viên thành công!')
    loadData()
  }

  const filtered = list.filter(u => {
    const q = search.toLowerCase()
    return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (roleFilter === 'all' || u.role === roleFilter)
  })

  const filteredContracts = contracts.filter(c => {
    const q = contractSearch.toLowerCase()
    const matchesSearch = !q || c.mangakaName.toLowerCase().includes(q) || c.assistantName.toLowerCase().includes(q)
    const matchesStatus = contractStatusFilter === 'all' || c.status.toLowerCase() === contractStatusFilter.toLowerCase()
    return matchesSearch && matchesStatus
  })

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Người dùng</h1>
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
          <h1 className="text-3xl font-bold tracking-tight">Người dùng & Hợp đồng</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý tài khoản người dùng và hợp đồng làm việc giữa Mangaka và Assistant.
          </p>
        </div>
        {activeTab === 'users' ? (
          <CreateUserDialog onCreated={handleCreateUser} />
        ) : (
          <Button onClick={() => setContractModal({})}>
            <Plus className="mr-2 size-4" />
            Tạo hợp đồng
          </Button>
        )}
      </div>

      <div className="flex border-b border-border gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "pb-3 pt-1 border-b-2 px-1 transition-all",
            activeTab === 'users'
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Danh sách tài khoản
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={cn(
            "pb-3 pt-1 border-b-2 px-1 transition-all",
            activeTab === 'contracts'
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Hợp đồng hợp tác
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm tên, email..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả vai trò</SelectItem>
                  {ROLES.map(r => (
                    <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

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
                      <th className="px-4 py-3 text-left font-medium">Người dùng</th>
                      <th className="px-4 py-3 text-left font-medium">Vai trò</th>
                      <th className="px-4 py-3 text-left font-medium">Tham gia</th>
                      <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                      <th className="px-4 py-3" style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                          Không tìm thấy người dùng nào.
                        </td>
                      </tr>
                    ) : filtered.map(u => {
                      const self = getSession()
                      const isSelf = String(u.email).toLowerCase() === String(self?.email).toLowerCase()
                      return (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9">
                                <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-xs font-bold text-primary-foreground">
                                  {u.initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{u.name}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={u.role}
                              onValueChange={(val) => handleChangeRole(u.id, val)}
                              disabled={isSelf}
                            >
                              <SelectTrigger className="h-8 w-36 py-0 px-2 text-xs font-medium border rounded-md shadow-none hover:bg-muted focus:ring-0 disabled:opacity-75 disabled:cursor-not-allowed">
                                <SelectValue placeholder="Vai trò">
                                  <RoleBadge roleKey={u.role} />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map(r => (
                                  <SelectItem key={r.key} value={r.key} className="text-xs">
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{u.joinDate}</td>
                          <td className="px-4 py-3">
                            <Badge className={STATUS_CLS[u.status] ?? STATUS_CLS.active} variant="secondary">
                              {STATUS_LABEL[u.status] ?? u.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => setSelected(u)}
                                title="Xem chi tiết"
                              >
                                <Eye className="size-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                              {u.status === 'active' ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleToggleStatus(u.id, 'banned')}
                                  disabled={isSelf}
                                  title={isSelf ? "Không thể khoá tài khoản chính mình" : "Khoá tài khoản"}
                                >
                                  <Lock className="size-4 text-amber-600" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleToggleStatus(u.id, 'active')}
                                  disabled={isSelf}
                                  title="Mở khoá tài khoản"
                                >
                                  <Unlock className="size-4 text-emerald-600" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          {loadingContracts ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="size-7 animate-spin" />
              <p className="mt-3 text-sm">Đang tải danh sách hợp đồng...</p>
            </div>
          ) : (
            <>
              <Card className="mb-4">
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Tìm tên Mangaka, Assistant..."
                      className="pl-9"
                      value={contractSearch}
                      onChange={e => setContractSearch(e.target.value)}
                    />
                  </div>
                  <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả trạng thái</SelectItem>
                      <SelectItem value="Pending">Chờ duyệt</SelectItem>
                      <SelectItem value="Active">Hoạt động</SelectItem>
                      <SelectItem value="Suspended">Tạm ngưng</SelectItem>
                      <SelectItem value="Inactive">Ngừng/Hủy</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Họa sĩ (Mangaka)</th>
                        <th className="px-4 py-3 text-left font-medium">Trợ lý (Assistant)</th>
                        <th className="px-4 py-3 text-left font-medium">Mức lương</th>
                        <th className="px-4 py-3 text-left font-medium">Thời hạn</th>
                        <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                        <th className="px-4 py-3" style={{ width: 120 }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredContracts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                            Không tìm thấy hợp đồng nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredContracts.map(c => (
                          <tr key={c.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">{c.mangakaName}</td>
                          <td className="px-4 py-3">{c.assistantName}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-primary">
                              {Number(c.salaryAmount).toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {c.salaryType === 'Monthly' ? 'Mỗi tháng' : c.salaryType === 'Fixed' ? 'Cố định' : 'Theo chương'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div>Bắt đầu: {c.startDate}</div>
                            <div>Kết thúc: {c.endDate}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={c.status}
                              onValueChange={(val) => handleContractStatusChange(c.id, val)}
                            >
                              <SelectTrigger className="h-8 w-28 py-0 px-2 text-xs font-medium border rounded-md">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pending" className="text-xs">Chờ duyệt</SelectItem>
                                <SelectItem value="Active" className="text-xs">Hoạt động</SelectItem>
                                <SelectItem value="Suspended" className="text-xs">Tạm ngưng</SelectItem>
                                <SelectItem value="Inactive" className="text-xs">Ngừng/Hủy</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {c.contractFileUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  asChild
                                >
                                  <a href={c.contractFileUrl} target="_blank" rel="noreferrer" title="Tải file hợp đồng">
                                    <FileText className="size-4" />
                                  </a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => setContractModal(c)}
                                title="Sửa hợp đồng"
                              >
                                <Edit className="size-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 hover:bg-destructive/10 text-destructive"
                                onClick={() => handleContractDelete(c.id)}
                                title="Xoá hợp đồng"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </>
    )}

      {selected && (
        <UserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onToggleStatus={handleToggleStatus}
          onChangeRole={handleChangeRole}
        />
      )}

      <ContractDialog
        open={contractModal !== null}
        contract={contractModal?.id ? contractModal : null}
        onClose={() => setContractModal(null)}
        onSave={() => {
          setContractModal(null)
          loadContracts()
        }}
        mangakas={list.filter(u => u.role === 'mangaka')}
        assistants={list.filter(u => u.role === 'assistant')}
      />

      <BaseDialog open={confirmConfig.open} onOpenChange={(o) => setConfirmConfig(c => ({ ...c, open: o }))}>
        <BaseDialogContent className="sm:max-w-md">
          <BaseDialogHeader>
            <BaseDialogTitle>{confirmConfig.title}</BaseDialogTitle>
            <BaseDialogDescription>
              {confirmConfig.description}
            </BaseDialogDescription>
          </BaseDialogHeader>
          <BaseDialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmConfig(c => ({ ...c, open: false }))}>
              Hủy
            </Button>
            <Button
              variant={confirmConfig.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={async () => {
                if (confirmConfig.onConfirm) {
                  await confirmConfig.onConfirm()
                }
                setConfirmConfig(c => ({ ...c, open: false }))
              }}
            >
              Xác nhận
            </Button>
          </BaseDialogFooter>
        </BaseDialogContent>
      </BaseDialog>

      <BaseDialog open={contractDeleteConfirmId !== null} onOpenChange={(o) => !o && setContractDeleteConfirmId(null)}>
        <BaseDialogContent className="sm:max-w-md">
          <BaseDialogHeader>
            <BaseDialogTitle>Xác nhận xoá hợp đồng</BaseDialogTitle>
            <BaseDialogDescription>
              Bạn có chắc chắn muốn xoá hợp đồng này? Hành động này sẽ được lưu trữ và không thể khôi phục.
            </BaseDialogDescription>
          </BaseDialogHeader>
          <BaseDialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setContractDeleteConfirmId(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={confirmContractDelete}>
              Xoá
            </Button>
          </BaseDialogFooter>
        </BaseDialogContent>
      </BaseDialog>
    </div>
  );
}