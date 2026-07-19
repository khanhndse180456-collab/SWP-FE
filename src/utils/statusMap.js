// utils/statusMap.js
//
// Nguồn chân lý duy nhất cho việc chuẩn hoá status trong toàn bộ app.
// Các giá trị dưới đây khớp CHÍNH XÁC với CHECK constraint trong DB
// (xem file schema SQL), không được tự thêm giá trị khác ở đây.

// chapters.status CHECK: 'InProduction' | 'Ready' | 'Published' | 'Delayed' | 'Cancelled'
const CHAPTER_STATUS_MAP = {
  inproduction: 'in_progress',
  ready: 'submitted',     // đã gộp layer & gửi, đang chờ Mangaka duyệt
  published: 'approved',
  delayed: 'delayed',     // trễ deadline — KHÔNG phải "cần sửa"
  cancelled: 'cancelled', // chapter bị hủy — KHÔNG phải "cần sửa"
}

export function normalizeChapterStatus(raw) {
  const key = String(raw ?? '').toLowerCase()
  return CHAPTER_STATUS_MAP[key] ?? key
}

// page_issues.issue_type CHECK: 'Revision' | 'Production'
// page_issues.status CHECK: 'Reported' | 'InProgress' | 'Resolved' | 'Completed' | 'Cancelled'
//
// "Note cần sửa đang mở" = issue_type Revision, và status còn Reported/InProgress
// (Resolved/Completed/Cancelled coi như đã xử lý xong, không tính là "cần sửa" nữa).
export function isOpenRevisionIssue(issue) {
  const type = String(issue?.issueType ?? issue?.issue_type ?? issue?.IssueType ?? '').toLowerCase()
  const status = String(issue?.status ?? issue?.Status ?? '').toLowerCase()
  return type === 'revision' && (status === 'reported' || status === 'inprogress')
}

// mangaka_assistants.status CHECK: 'Pending' | 'Active' | 'Suspended' | 'Inactive'
// (dùng cho các dòng "quan hệ hợp tác" enrichMangakaAssistantRow — để badge
// không hiển thị nhầm các giá trị lowercase workflow của chapter)
const CONTRACT_STATUS_MAP = {
  pending: 'contract_pending',
  active: 'contract_active',
  suspended: 'contract_suspended',
  inactive: 'contract_inactive',
}

export function normalizeContractStatus(raw) {
  const key = String(raw ?? '').toLowerCase()
  return CONTRACT_STATUS_MAP[key] ?? key
}