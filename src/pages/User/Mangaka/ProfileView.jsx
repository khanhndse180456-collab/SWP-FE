import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { User, ShieldAlert, CreditCard } from 'lucide-react'

export default function ProfileView({ user }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [penName, setPenName] = useState(user?.fullname ?? user?.name ?? 'Akira Toriyama')
  const [bio, setBio] = useState('Mangaka tự do đam mê kể chuyện qua tranh. Luôn cố gắng tạo ra những câu chuyện ý nghĩa!')
  const [phone, setPhone] = useState('0901234567')
  const [avatar, setAvatar] = useState(null)

  // Bank Info
  const [bankName, setBankName] = useState('Vietcombank')
  const [accountNumber, setAccountNumber] = useState('1234567890')
  const [accountName, setAccountName] = useState(user?.fullname ?? user?.name ?? 'Akira Toriyama')

  const handleSave = () => {
    toast.success('Đã lưu thay đổi thông tin cá nhân và ngân hàng!')
  }

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const isImg = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name)
      if (!isImg) {
        toast.error('Ảnh đại diện phải là định dạng hình ảnh (png, jpg, jpeg, webp, gif).')
        e.target.value = ''
        return
      }
      setAvatar(URL.createObjectURL(file))
      toast.success('Đã chọn ảnh đại diện mới!')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile của tôi</h1>
        <p className="text-sm text-muted-foreground">Quản lý thông tin cá nhân và tài khoản.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-px">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Thông tin cá nhân
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'security' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Bảo mật
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Avatar section */}
          <Card className="border bg-card h-fit">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <div className="size-28 rounded-full overflow-hidden border bg-muted flex items-center justify-center relative group">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-3xl font-extrabold text-muted-foreground">
                    {penName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="w-full text-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold"
                  onClick={() => document.getElementById('avatar-upload-input').click()}
                >
                  Đổi avatar
                </Button>
                <input
                  id="avatar-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <p className="text-[10px] text-muted-foreground mt-2">JPG, PNG tối đa 2MB</p>
              </div>
            </CardContent>
          </Card>

          {/* Form section */}
          <div className="space-y-6">
            {/* Personal info card */}
            <Card className="border bg-card">
              <CardHeader className="pb-3 flex flex-row items-center gap-2">
                <User className="size-4.5 text-primary" />
                <CardTitle className="text-base">Thông tin cá nhân</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="pen-name" className="text-xs">Bút danh (Pen name)</Label>
                  <Input id="pen-name" value={penName} onChange={(e) => setPenName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bio" className="text-xs">Tiểu sử</Label>
                  <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs">Số điện thoại</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Bank details card */}
            <Card className="border bg-card">
              <CardHeader className="pb-3 flex flex-row items-center gap-2">
                <CreditCard className="size-4.5 text-primary" />
                <CardTitle className="text-base">Thông tin ngân hàng</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="bank-name" className="text-xs">Ngân hàng</Label>
                    <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="account-num" className="text-xs">Số tài khoản</Label>
                    <Input id="account-num" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="account-name" className="text-xs">Tên tài khoản</Label>
                  <Input id="account-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} className="bg-primary text-primary-foreground font-semibold px-6">
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <Card className="max-w-xl border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              <CardTitle className="text-base">Cài đặt bảo mật</CardTitle>
            </div>
            <CardDescription className="text-xs">Đổi mật khẩu và cài đặt an toàn tài khoản.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Mật khẩu hiện tại</Label>
              <Input type="password" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mật khẩu mới</Label>
              <Input type="password" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Xác nhận mật khẩu mới</Label>
              <Input type="password" />
            </div>
            <div className="flex justify-end pt-2">
              <Button className="font-semibold">Cập nhật mật khẩu</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
