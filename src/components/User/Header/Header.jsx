// Re-export từ package dùng chung `components/layout/Header`.
// File này chỉ tồn tại để giữ backward-compat cho code cũ đang import
// `@/components/User/Header/Header.jsx`. Mọi code mới nên import từ
// `@/components/layout/Header`.
export { default } from '@/components/layout/Header/AppHeader.jsx'
export { AppHeader, NotificationBell, UserMenu } from '@/components/layout/Header'