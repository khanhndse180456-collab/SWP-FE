import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Camera,
  Check,
  Edit2,
  FileText,
  Globe,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Shield,
  Star,
  User,
  Calendar,
  BookOpen,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProfile, useUpdateProfile, isProfileEditable } from '@/api'
import { ROLE_KEY_TO_ID, clearSession, getSession } from '@/lib/auth'
import { cn } from '@/lib/utils'

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

const ROLE_CONFIG = {
  MANGAKA: { label: 'Mangaka', color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400', icon: BookOpen },
  ASSISTANT: { label: 'Assistant', color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400', icon: Layers },
  TANTOU: { label: 'Tantou Editor', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400', icon: Edit2 },
  EDITOR_BOARD: { label: 'Editor Board', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: Shield },
  ADMIN: { label: 'Admin', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-400', icon: Shield },
}

const STATS = [
  { label: 'Series', value: 12, icon: BookOpen },
  { label: 'Chapter', value: 156, icon: Layers },
  { label: 'Đánh giá', value: '4.9', icon: Star },
]

export default function Profile({ isWorkspaceMode = false, stats }) {
  const navigate = useNavigate()
  const { data: profile, isLoading } = useProfile()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    penName: '',
    bio: '',
    phoneNumber: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    portfolioUrl: '',
    isAvailable: true,
    skills: '',
    softwareUsed: '',
  })

  const session = getSession()
  const roleKey = session?.role
    ?? (profile?.roleid ? Object.keys(ROLE_KEY_TO_ID).find(k => ROLE_KEY_TO_ID[k] === profile.roleid) : null)
  const updateProfileMutation = useUpdateProfile(roleKey)
  const roleConfig = ROLE_CONFIG[roleKey] ?? ROLE_CONFIG.MANGAKA
  const RoleIcon = roleConfig.icon

  // Tantou / Editor Board / Admin chưa có bảng profile riêng ở backend
  // (xem UsersController.GetProfile) → không cho chỉnh sửa qua trang này,
  // chỉ hiển thị thông tin cơ bản lấy từ session lúc đăng nhập.
  const editable = isProfileEditable(roleKey)

  useEffect(() => {
    if (!profile) return
    setForm({
      username: profile.username ?? '',
      fullName: profile.fullname ?? profile.fullName ?? '',
      penName: profile.penName ?? profile.penname ?? profile.pen_name ?? '',
      bio: profile.bio ?? profile.Bio ?? '',
      phoneNumber: profile.phoneNumber ?? profile.phonenumber ?? profile.phone_number ?? '',
      bankName: profile.bankName ?? profile.bankname ?? '',
      bankAccountNumber: profile.bankAccountNumber ?? profile.bankaccountnumber ?? '',
      bankAccountName: profile.bankAccountName ?? profile.bankaccountname ?? '',
      portfolioUrl: profile.portfolioUrl ?? profile.portfolio_url ?? '',
      isAvailable: profile.isAvailable ?? profile.isavailable ?? profile.is_available ?? false,
      skills: profile.skills ?? profile.Skills ?? '',
      softwareUsed: profile.softwareUsed ?? profile.softwareused ?? profile.software_used ?? '',
    })
  }, [profile])

  const initials = (profile?.fullname ?? profile?.username ?? 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSave() {
    if (!editable) return // an toàn hai lớp — UI đã ẩn nút nhưng vẫn chặn ở handler
    if (!form.fullName?.trim()) {
      toast.error('Họ tên không được để trống.')
      return
    }
    const payload = {
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber,
      skills: form.skills,
      softwareUsed: form.softwareUsed,
      bio: form.bio,
    }
    if (roleKey === 'MANGAKA') {
      if (!form.penName?.trim()) {
        toast.error('Bút danh (PenName) không được để trống với Mangaka.')
        return
      }
      payload.penName = form.penName.trim()
      payload.bankName = form.bankName
      payload.bankAccountNumber = form.bankAccountNumber
      payload.bankAccountName = form.bankAccountName
    } else if (roleKey === 'ASSISTANT') {
      payload.portfolioUrl = form.portfolioUrl
      payload.isAvailable = form.isAvailable
      payload.bankName = form.bankName
      payload.bankAccountNumber = form.bankAccountNumber
      payload.bankAccountName = form.bankAccountName
    }
    updateProfileMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Cập nhật hồ sơ thành công!')
        setEditing(false)
      },
      onError: (err) => {
        const body = err?.response?.data
        const message = typeof body === 'string' ? body : body?.message ?? body?.title
        toast.error(message || 'Không cập nhật được hồ sơ.')
      },
    })
  }

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  if (isLoading) {
    if (isWorkspaceMode) {
      return (
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-2xl bg-muted" />
          <div className="h-48 rounded-2xl bg-muted" />
        </div>
      )
    }
    return (
      <div className="flex min-h-screen flex-col">
        <Header links={NAV_LINKS} />
        <main className="page-container flex-1 py-12">
          <div className="mx-auto max-w-4xl">
            <div className="animate-pulse space-y-6">
              <div className="h-32 rounded-2xl bg-muted" />
              <div className="h-48 rounded-2xl bg-muted" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col bg-background", !isWorkspaceMode && "min-h-screen")}>
      {!isWorkspaceMode && <Header links={NAV_LINKS} />}

      <main className={cn("flex-1", !isWorkspaceMode && "py-8")}>
        <div className="page-container mx-auto max-w-5xl">
          {/* Hero Banner */}
          <div className="relative mb-16 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-rose-500/10 to-violet-500/10 p-8 md:p-12">
            <div className="absolute inset-0 bg-grid-pattern opacity-30" />
            <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-violet-500/20 blur-3xl" />

            <div className="relative flex flex-col items-center gap-6 md:flex-row md:gap-12">
              {/* Avatar */}
              <div className="relative">
                <Avatar className="size-32 border-4 border-background shadow-2xl md:size-40">
                  <AvatarImage src={profile?.avatar || profile?.avatar_url || profile?.picture} alt={profile?.fullname} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-3xl font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {editable && (
                  <button className="absolute bottom-0 right-0 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
                    <Camera className="size-4" />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                  <h1 className="text-3xl font-bold tracking-tight">{profile?.fullname || 'Người dùng'}</h1>
                  <Badge className={cn('gap-1.5', roleConfig.color)} variant="secondary">
                    <RoleIcon className="size-3.5" />
                    {roleConfig.label}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{profile?.email}</p>

                {/* Stats — chỉ có ý nghĩa với Mangaka/Assistant (số liệu sáng tác) */}
                {editable && (
                  <div className="mt-6 flex flex-wrap justify-center gap-6 md:justify-start">
                    {[
                      { label: 'Series', value: stats?.seriesCount ?? 0, icon: BookOpen },
                      { label: 'Chapter', value: stats?.chaptersCount ?? 0, icon: Layers },
                      { label: 'Đánh giá', value: stats?.rating ?? '5.0', icon: Star },
                    ].map(s => {
                      const Icon = s.icon
                      return (
                        <div key={s.label} className="flex items-center gap-2">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-background/80 shadow-sm">
                            <Icon className="size-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-xl font-bold">{s.value}</div>
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleLogout} className="gap-2">
                  <LogOut className="size-4" />
                  Đăng xuất
                </Button>
                {editable && (
                  <Button onClick={() => setEditing(true)} className="gap-2">
                    <Edit2 className="size-4" />
                    Chỉnh sửa
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className={cn('grid w-full', editable ? 'grid-cols-3' : 'grid-cols-2')}>
              <TabsTrigger value="profile" className="gap-2">
                <User className="size-4" />
                Hồ sơ
              </TabsTrigger>
              {editable && (
                <TabsTrigger value="activity" className="gap-2">
                  <BookOpen className="size-4" />
                  Hoạt động
                </TabsTrigger>
              )}
              <TabsTrigger value="settings" className="gap-2">
                <Shield className="size-4" />
                Cài đặt
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin cá nhân</CardTitle>
                  <CardDescription>
                    {editable
                      ? 'Cập nhật thông tin hồ sơ của bạn'
                      : 'Thông tin tài khoản — vai trò này chưa hỗ trợ chỉnh sửa hồ sơ qua trang web.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!editable ? (
                    // ── Role không có bảng profile riêng (Tantou / EB / Admin) ──
                    // Chỉ hiển thị thông tin cơ bản từ session, không có form chỉnh sửa,
                    // không có bút danh / portfolio / kỹ năng / thông tin thanh toán
                    // (những field này thuộc bảng profile riêng của Mangaka/Assistant).
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3 rounded-lg border p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <User className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Họ và tên</p>
                          <p className="font-medium">{profile?.fullname || 'Chưa cập nhật'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <Mail className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{profile?.email || 'Chưa cập nhật'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <User className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Tên đăng nhập</p>
                          <p className="font-medium">{profile?.username || 'Chưa cập nhật'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                          <Shield className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Vai trò</p>
                          <p className="font-medium">{roleConfig.label}</p>
                        </div>
                      </div>
                    </div>
                  ) : editing ? (
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="fullName">Họ và tên *</Label>
                            <Input
                              id="fullName"
                              value={form.fullName}
                              onChange={e => handleChange('fullName', e.target.value)}
                              placeholder="Nhập họ và tên"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={profile?.email ?? ''} disabled />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="phoneNumber">Số điện thoại</Label>
                            <Input
                              id="phoneNumber"
                              value={form.phoneNumber}
                              onChange={e => handleChange('phoneNumber', e.target.value)}
                              placeholder="0xxx..."
                            />
                          </div>
                          {roleKey === 'MANGAKA' && (
                            <div className="space-y-2">
                              <Label htmlFor="penName">Bút danh *</Label>
                              <Input
                                id="penName"
                                value={form.penName}
                                onChange={e => handleChange('penName', e.target.value)}
                                placeholder="Bút danh"
                              />
                            </div>
                          )}
                          {roleKey === 'ASSISTANT' && (
                            <div className="space-y-2">
                              <Label htmlFor="portfolioUrl">Portfolio URL</Label>
                              <Input
                                id="portfolioUrl"
                                value={form.portfolioUrl}
                                onChange={e => handleChange('portfolioUrl', e.target.value)}
                                placeholder="https://..."
                              />
                            </div>
                          )}
                        </div>

                        {roleKey === 'ASSISTANT' && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="skills">Kỹ năng</Label>
                              <Input
                                id="skills"
                                value={form.skills}
                                onChange={e => handleChange('skills', e.target.value)}
                                placeholder="Sketching, Inking..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="softwareUsed">Phần mềm</Label>
                              <Input
                                id="softwareUsed"
                                value={form.softwareUsed}
                                onChange={e => handleChange('softwareUsed', e.target.value)}
                                placeholder="Photoshop, Krita..."
                              />
                            </div>
                          </div>
                        )}

                        {roleKey === 'ASSISTANT' && (
                          <div className="flex items-center gap-3 rounded-lg border p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                              <Star className="size-5 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                              <Label>Sẵn sàng nhận việc</Label>
                              <p className="text-xs text-muted-foreground mt-0.5">Bật để các mangaka có thể liên hệ thuê bạn</p>
                            </div>
                            <div
                              onClick={() => handleChange('isAvailable', !form.isAvailable)}
                              className={cn(
                                'flex h-7 w-12 cursor-pointer items-center rounded-full px-1 transition-colors',
                                form.isAvailable ? 'bg-emerald-500 justify-end' : 'bg-muted justify-start',
                              )}
                            >
                              <div className="size-5 rounded-full bg-white shadow" />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="bio">Giới thiệu bản thân</Label>
                          <Textarea
                            id="bio"
                            value={form.bio}
                            onChange={e => handleChange('bio', e.target.value)}
                            placeholder="Viết vài dòng giới thiệu về bạn..."
                            rows={3}
                          />
                        </div>

                        {(roleKey === 'MANGAKA' || roleKey === 'ASSISTANT') && (
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Thông tin thanh toán</Label>
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="space-y-2">
                                <Label htmlFor="bankName">Ngân hàng</Label>
                                <Input id="bankName" value={form.bankName} onChange={e => handleChange('bankName', e.target.value)} placeholder="Vietcombank..." />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="bankAccountNumber">Số tài khoản</Label>
                                <Input id="bankAccountNumber" value={form.bankAccountNumber} onChange={e => handleChange('bankAccountNumber', e.target.value)} placeholder="123456..." />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="bankAccountName">Chủ tài khoản</Label>
                                <Input id="bankAccountName" value={form.bankAccountName} onChange={e => handleChange('bankAccountName', e.target.value)} placeholder="NGUYEN VAN A" />
                              </div>
                            </div>
                          </div>
                        )}

                      <div className="flex gap-2">
                        <Button onClick={handleSave} disabled={updateProfileMutation.isPending} className="gap-2">
                          {updateProfileMutation.isPending ? (
                            <>Đang lưu...</>
                          ) : (
                            <>
                              <Check className="size-4" />
                              Lưu thay đổi
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setEditing(false)}>
                          Hủy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 rounded-lg border p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                              <User className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Họ và tên</p>
                              <p className="font-medium">{profile?.fullname || 'Chưa cập nhật'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 rounded-lg border p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                              <Mail className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Email</p>
                              <p className="font-medium">{profile?.email || 'Chưa cập nhật'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 rounded-lg border p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                              {roleKey === 'MANGAKA' ? (
                                <User className="size-5 text-primary" />
                              ) : (
                                <Globe className="size-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {roleKey === 'MANGAKA' ? 'Bút danh' : 'Portfolio'}
                              </p>
                              <p className="font-medium">
                                {roleKey === 'MANGAKA'
                                  ? (profile?.penName || profile?.penname || profile?.pen_name || 'Chưa cập nhật')
                                  : (profile?.portfolioUrl || profile?.portfolio_url || 'Chưa cập nhật')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 rounded-lg border p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                              <FileText className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Giới thiệu</p>
                              <p className="font-medium">{profile?.bio || profile?.Bio || 'Chưa cập nhật'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-3 rounded-lg border p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                              <Phone className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Số điện thoại</p>
                              <p className="font-medium">{profile?.phoneNumber || profile?.phonenumber || profile?.phone_number || 'Chưa cập nhật'}</p>
                            </div>
                          </div>

                          {roleKey === 'ASSISTANT' && (
                            <>
                              <div className="flex items-center gap-3 rounded-lg border p-4">
                                <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
                                  <Layers className="size-5 text-violet-600" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Kỹ năng</p>
                                  <p className="font-medium">{profile?.skills || profile?.Skills || 'Chưa cập nhật'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 rounded-lg border p-4">
                                <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10">
                                  <BookOpen className="size-5 text-rose-600" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Phần mềm sử dụng</p>
                                  <p className="font-medium">{profile?.softwareUsed || profile?.softwareused || profile?.software_used || 'Chưa cập nhật'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 rounded-lg border p-4">
                                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                                  <Star className="size-5 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Sẵn sàng nhận việc</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div
                                      className={cn(
                                        'flex h-6 w-11 items-center rounded-full px-0.5 transition-colors cursor-pointer',
                                        form.isAvailable
                                          ? 'bg-emerald-500 justify-end'
                                          : 'bg-muted justify-start',
                                      )}
                                    >
                                      <div className="size-5 rounded-full bg-white shadow transition-all" />
                                    </div>
                                    <span className={cn(
                                      'text-sm font-medium',
                                      form.isAvailable ? 'text-emerald-600' : 'text-muted-foreground',
                                    )}>
                                      {form.isAvailable ? '● Đang bật' : '○ Đang tắt'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {(roleKey === 'MANGAKA' || roleKey === 'ASSISTANT') && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Thông tin thanh toán</h3>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="flex items-center gap-3 rounded-lg border p-4">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                <span className="text-sm font-bold text-amber-600">BANK</span>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Ngân hàng</p>
                                <p className="font-medium">{profile?.bankName || profile?.bankname || '—'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border p-4">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                <span className="text-sm font-bold text-amber-600">STK</span>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Số tài khoản</p>
                                <p className="font-medium">{profile?.bankAccountNumber || profile?.bankaccountnumber || '—'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border p-4">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                <span className="text-sm font-bold text-amber-600">NAME</span>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Chủ tài khoản</p>
                                <p className="font-medium">{profile?.bankAccountName || profile?.bankaccountname || '—'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Bio — chỉ hiện khi role có bảng profile riêng và có bio */}
              {editable && (profile?.bio || profile?.Bio) ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Giới thiệu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{profile.bio || profile.Bio}</p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* Activity Tab — chỉ Mangaka/Assistant có dữ liệu hoạt động sáng tác */}
            {editable && (
              <TabsContent value="activity" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Hoạt động gần đây</CardTitle>
                    <CardDescription>Lịch sử các hoạt động của bạn trên nền tảng</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(stats?.recentActivities && stats.recentActivities.length > 0 ? stats.recentActivities : [
                        { icon: BookOpen, action: 'Khởi tạo tài khoản', detail: 'Tài khoản hoạt động bình thường', time: 'Hệ thống' }
                      ]).map((item, i) => {
                        const Icon = item.icon || BookOpen
                        return (
                          <div key={i} className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <Icon className="size-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{item.action}</p>
                              <p className="text-sm text-muted-foreground">{item.detail}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{item.time}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cài đặt tài khoản</CardTitle>
                  <CardDescription>Quản lý các cài đặt bảo mật và quyền riêng tư</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Shield className="size-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium">Bảo mật</p>
                        <p className="text-sm text-muted-foreground">Cập nhật mật khẩu và bảo mật</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Quản lý</Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
                        <Mail className="size-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium">Thông báo</p>
                        <p className="text-sm text-muted-foreground">Cài đặt email và thông báo</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Cài đặt</Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10">
                        <LogOut className="size-5 text-rose-600" />
                      </div>
                      <div>
                        <p className="font-medium">Đăng xuất</p>
                        <p className="text-sm text-muted-foreground">Đăng xuất khỏi tài khoản</p>
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleLogout}>Đăng xuất</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      {!isWorkspaceMode && <Footer />}
    </div>
  )
}