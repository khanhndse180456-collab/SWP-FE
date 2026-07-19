import { LABEL_EDITOR_BOARD, PATH_EDITOR_BOARD } from '@/constants/roleTerminology.js'

export const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Mangaka' },
  { to: PATH_EDITOR_BOARD, label: LABEL_EDITOR_BOARD },
]

// ── Nhóm trạng thái Series ───────────────────────────────────────────────────
export const DEBUT_STATUSES    = new Set(['draft', 'editorreview', 'submitted'])
export const APPROVED_STATUSES = new Set(['approved', 'publishing'])
export const EB_STATUSES       = new Set([
  'ebreview', 'underreview',         // đang ở Hội đồng
  'editorreview', 'submitted',       // Tantou vừa xong, chờ Hội đồng tiếp nhận
  'readyforreview', 'ready_for_review',
])