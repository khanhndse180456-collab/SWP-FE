import { useEffect, useState } from 'react'
import { Edit, Key, Loader2, Mail, Shield, ShieldCheck } from 'lucide-react'
import { api } from '@/api/adminApi.js'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getProfile()
      setProfile(data)
    } catch (err) {
      setError(err.message || 'Lỗi tải hồ sơ')
      console.error('Load profile error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải hồ sơ...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hồ sơ</h1>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-destructive">
            <p className="text-sm font-medium">{error || 'Không thể tải hồ sơ'}</p>
            <Button onClick={loadProfile} className="mt-4">
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hồ sơ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Thông tin tài khoản Admin</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="relative h-32 bg-gradient-to-br from-primary via-rose-500 to-amber-400">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.3),transparent_70%)]" />
          </div>
          <div className="-mt-12 flex flex-col items-center px-6 pb-6 text-center">
            <Avatar className="size-24 border-4 border-card shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-3xl font-bold text-primary-foreground">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-3 text-xl font-bold">{profile.name}</h2>
            <Badge variant="secondary" className="mt-1">
              <ShieldCheck className="size-3.5" />
              {profile.role}
            </Badge>
            <div className="mt-4 flex w-full gap-2">
              <Button className="flex-1">
                <Edit className="size-4" />
                Chỉnh sửa
              </Button>
              <Button variant="outline" className="flex-1">
                <Key className="size-4" />
                Đổi mật khẩu
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin cá nhân</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: 'Họ tên', value: profile.name, icon: null },
              { label: 'Email', value: profile.email, icon: Mail },
              { label: 'Vai trò', value: profile.role, icon: Shield, badge: true },
              { label: 'Ngày tạo', value: profile.createdAt, icon: null },
              {
                label: 'Trạng thái',
                value: profile.status === 'active' ? 'Hoạt động' : 'Bị khoá',
                statusOk: profile.status === 'active',
              },
            ].map((row, i, arr) => {
              const Icon = row.icon
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {Icon ? <Icon className="size-4" /> : null}
                      {row.label}
                    </div>
                    {row.badge ? (
                      <Badge variant="secondary">{row.value}</Badge>
                    ) : row.statusOk !== undefined ? (
                      <Badge
                        className={row.statusOk
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400'}
                        variant="secondary"
                      >
                        {row.value}
                      </Badge>
                    ) : (
                      <span className="font-medium">{row.value}</span>
                    )}
                  </div>
                  {i < arr.length - 1 ? <Separator /> : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}