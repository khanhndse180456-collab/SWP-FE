import { LABEL_EDITOR_BOARD, PATH_EDITOR_BOARD } from '@/constants/roleTerminology.js'

export const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Mangaka' },
  { to: PATH_EDITOR_BOARD, label: LABEL_EDITOR_BOARD },
]

// ── Nhóm trạ thái Series ────────────────────────────────────────────────────
export const DEBUT_STATUSES     = new Set(['editorreview'])  // đã Mangaka nộp, đang chờ Tantou xét
export const APPROVED_STATUSES  = new Set(['publishing', 'completed'])
export const EB_STATUSES        = new Set(['ebreview'])