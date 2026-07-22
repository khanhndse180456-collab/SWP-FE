/**
 * Unwrap the standard backend envelope {succeeded, message, errors, data, status_code}.
 * Returns `res.data.data` if present, else `res.data` (for raw responses that
 * aren't wrapped, e.g. some endpoints). Falls back to null.
 */
function unwrap(res) {
  if (!res) return null
  const payload = res.data
  if (payload && typeof payload === 'object' && 'data' in payload && !Array.isArray(payload)) {
    return payload.data
  }
  return payload ?? null
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  seriesService,
  chaptersService,
  pagesService,
  pageLayersService,
  pageIssuesApi,
  usersService,
  assistantProfileService,
  tantouService,
  genresService,
  tagsService,
  contractsService,
} from '@/api'
import { notificationsService } from '@/api/notificationsService'
import { getSession } from '@/lib/auth'

/* ===========================
   AVAILABLE ASSISTANTS
   =========================== */
export function useAvailableAssistants() {
  return useQuery({
    queryKey: ['available-assistants'],
    queryFn: async () => {
      const res = await usersService.getAvailableAssistants()
      return unwrap(res) ?? []
    },
  })
}

/* ===========================
   SERIES HOOKS
   =========================== */
export function useSeries() {
  return useQuery({
    queryKey: ['series'],
    queryFn: async () => {
      const res = await seriesService.getAll()
      return unwrap(res)
    },
  })
}

export function useSeriesByMangaka(mangakaId) {
  return useQuery({
    queryKey: ['series', 'mangaka', mangakaId],
    queryFn: async () => {
      const res = await seriesService.getByMangaka(mangakaId)
      return unwrap(res) ?? []
    },
    enabled: !!mangakaId,
  })
}

export function useSeriesById(id) {
  return useQuery({
    queryKey: ['series', id],
    queryFn: async () => {
      const res = await seriesService.getById(id)
      return unwrap(res)
    },
    enabled: !!id,
  })
}

export function useCreateSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData) => seriesService.create(formData),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['series'] }) },
  })
}

export function useUpdateSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => seriesService.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['series'] })
      qc.invalidateQueries({ queryKey: ['series', id] })
    },
  })
}

export function useUpdateSeriesStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => seriesService.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['series'] })
      qc.invalidateQueries({ queryKey: ['series', id] })
    },
  })
}

export function useAssignTantouEditor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seriesId, tantouEditorId }) =>
      seriesService.updateTantouEditor(seriesId, tantouEditorId),
    onSuccess: (_, { seriesId }) => {
      qc.invalidateQueries({ queryKey: ['series'] })
      qc.invalidateQueries({ queryKey: ['series', seriesId] })
    },
  })
}

export function useDeleteSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => seriesService.softDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['series'] }) },
  })
}

export function useHardDeleteSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => seriesService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['series'] }) },
  })
}

/* ===========================
   CHAPTERS HOOKS
   =========================== */
export function useChapters(seriesId) {
  return useQuery({
    queryKey: ['chapters', seriesId ? { seriesId } : 'all'],
    queryFn: async () => {
      const res = await chaptersService.getAll(seriesId)
      return unwrap(res) ?? []
    },
  })
}

export function useChapterById(id) {
  return useQuery({
    queryKey: ['chapters', id],
    queryFn: async () => {
      const res = await chaptersService.getById(id)
      return unwrap(res)
    },
    enabled: !!id,
  })
}

export function useChaptersByAssistant(assistantId) {
  return useQuery({
    queryKey: ['chapters', 'assistant', assistantId],
    queryFn: async () => {
      const res = await chaptersService.getByAssistant(assistantId)
      return unwrap(res) ?? []
    },
    enabled: !!assistantId,
  })
}

export function useCreateChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => chaptersService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chapters'] }) },
  })
}

export function useUpdateChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => chaptersService.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['chapters'] })
      qc.invalidateQueries({ queryKey: ['chapters', id] })
    },
  })
}

export function useDeleteChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => chaptersService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chapters'] }) },
  })
}

export function useUpdateChapterStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => chaptersService.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['chapters'] })
      qc.invalidateQueries({ queryKey: ['chapters', id] })
    },
  })
}

/* ===========================
   PAGES HOOKS
   =========================== */
export function usePages(chapterId) {
  // chapterId có thể là string (local ID như "u-xxx") hoặc number (server ID)
  const numericId = Number(chapterId)
  const isServerId = Number.isFinite(numericId)
  return useQuery({
    queryKey: ['pages', isServerId ? { chapterId: numericId } : 'local'],
    queryFn: async () => {
      const res = await pagesService.getAll(isServerId ? numericId : null)
      return unwrap(res) ?? []
    },
    enabled: isServerId,
  })
}

export function usePageById(id) {
  return useQuery({
    queryKey: ['pages', id],
    queryFn: async () => { const res = await pagesService.getById(id); return unwrap(res) },
    enabled: !!id,
  })
}

export function useCreatePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData) => pagesService.create(formData),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pages'] }) },
  })
}

export function useUpdatePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => pagesService.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['pages'] })
      qc.invalidateQueries({ queryKey: ['pages', id] })
    },
  })
}

export function useUpdatePageIsSentToMangaka() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isSentToMangaka }) => pagesService.updateIsSentToMangaka(id, isSentToMangaka),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['pages'] })
      qc.invalidateQueries({ queryKey: ['pages', id] })
      qc.invalidateQueries({ queryKey: ['chapters'] })
    },
  })
}

export function useDeletePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => pagesService.softDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pages'] }) },
  })
}

export function useHardDeletePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => pagesService.hardDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pages'] }) },
  })
}

export function usePageComposite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId) => pagesService.composite(pageId),
    onSuccess: (_, pageId) => {
      qc.invalidateQueries({ queryKey: ['pages'] })
      qc.invalidateQueries({ queryKey: ['pages', pageId] })
    },
  })
}

export function usePageLayers(pageId) {
  const numericId = pageId != null ? Number(pageId) : null
  const isServerId = numericId != null && Number.isFinite(numericId) && numericId > 0
  return useQuery({
    queryKey: ['pageLayers', 'byPage', numericId],
    queryFn: async () => {
      const res = await pageLayersService.getAll(numericId)
      const data = unwrap(res)
      return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
    },
    enabled: isServerId,
  })
}

export function usePageLayerById(id) {
  return useQuery({
    queryKey: ['pageLayers', id],
    queryFn: async () => {
      const res = await pageLayersService.getById(id)
      return unwrap(res)
    },
    enabled: !!id,
  })
}

export function useCreatePageLayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData) => pageLayersService.create(formData),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pageLayers'] }) },
  })
}

export function useUpdatePageLayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => pageLayersService.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['pageLayers'] })
      qc.invalidateQueries({ queryKey: ['pageLayers', id] })
    },
  })
}

export function useDeletePageLayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => pageLayersService.softDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pageLayers'] }) },
  })
}

export function useHardDeletePageLayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => pageLayersService.hardDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pageLayers'] }) },
  })
}

export function useTogglePageLayerVisibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => pageLayersService.toggleVisibility(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pageLayers'] }) },
  })
}

/* ===========================
   PAGE ISSUES HOOKS
   =========================== */
// Hỗ trợ cả 2 dạng: usePageIssues({ pageId }) hoặc usePageIssues({ chapterId })
// BE trả raw array PageIssueDto[] (không wrap)
export function usePageIssues({ pageId, chapterId, status } = {}) {
  const pid = pageId != null ? Number(pageId) : null
  const cid = chapterId != null ? Number(chapterId) : null
  const numericId = pid ?? cid
  const isServerId = Number.isFinite(numericId)
  const key = isServerId
    ? { pageId: pid, chapterId: pid ? null : cid, status: status ?? null }
    : 'local'
  return useQuery({
    queryKey: ['pageIssues', key],
    queryFn: async () => {
      const res = await pageIssuesApi.getAll({ pageId: pid, chapterId: pid ? null : cid, status })
      const data = unwrap(res)
      return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
    },
    enabled: isServerId,
  })
}

export function usePageIssueById(id) {
  return useQuery({
    queryKey: ['pageIssues', id],
    queryFn: async () => { const res = await pageIssuesApi.getById(id); return unwrap(res) },
    enabled: !!id,
  })
}

export function useCreatePageIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => pageIssuesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pageIssues'] }) },
  })
}

export function useUpdatePageIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => pageIssuesApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['pageIssues'] })
      qc.invalidateQueries({ queryKey: ['pageIssues', id] })
    },
  })
}

export function useUpdatePageIssueStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => pageIssuesApi.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['pageIssues'] })
      qc.invalidateQueries({ queryKey: ['pageIssues', id] })
    },
  })
}

export function useDeletePageIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => pageIssuesApi.softDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pageIssues'] }) },
  })
}

/* ===========================
   CONTRACTS (MangakaAssistant)
   =========================== */
export function useContracts({ mangakaId, assistantId } = {}) {
  return useQuery({
    queryKey: ['contracts', { mangakaId, assistantId }],
    queryFn: async () => { const res = await contractsService.getAll({ mangakaId, assistantId }); return unwrap(res) ?? [] },
  })
}

export function useContractById(id) {
  return useQuery({
    queryKey: ['contracts', 'detail', id],
    queryFn: async () => { const res = await contractsService.getById(id); return unwrap(res) },
    enabled: !!id,
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => contractsService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }) },
  })
}

export function useUpdateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => contractsService.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', 'detail', id] })
    },
  })
}

export function useUpdateContractStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => contractsService.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', 'detail', id] })
    },
  })
}

export function useSoftDeleteContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => contractsService.softDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }) },
  })
}

export function useUploadContractFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, formData }) => contractsService.uploadFile(id, formData),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', 'detail', id] })
    },
  })
}

/* ===========================
   GENRES & TAGS HOOKS
   =========================== */
export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => { const res = await genresService.getAll(); return unwrap(res) ?? [] },
    staleTime: 5 * 60 * 1000,
  })
}

export function useGenreById(id) {
  return useQuery({
    queryKey: ['genres', id],
    queryFn: async () => { const res = await genresService.getById(id); return unwrap(res) },
    enabled: !!id,
  })
}

export function useCreateGenre() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => genresService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['genres'] }) },
  })
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => { const res = await tagsService.getAll(); return unwrap(res) ?? [] },
    staleTime: 5 * 60 * 1000,
  })
}

export function useTagById(id) {
  return useQuery({
    queryKey: ['tags', id],
    queryFn: async () => { const res = await tagsService.getById(id); return unwrap(res) },
    enabled: !!id,
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => tagsService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }) },
  })
}

/* ===========================
   ASSISTANT PROFILE HOOKS
   =========================== */
export function useAvailableAssistantProfiles() {
  return useQuery({
    queryKey: ['assistant-profiles', 'available'],
    queryFn: async () => { const res = await assistantProfileService.getAvailable(); return unwrap(res) ?? [] },
  })
}

export function useAssistantProfile(assistantId) {
  return useQuery({
    queryKey: ['assistant-profiles', assistantId],
    queryFn: async () => { const res = await assistantProfileService.getById(assistantId); return unwrap(res) },
    enabled: !!assistantId,
  })
}

/* ===========================
   TANTOU EDITOR HOOKS
   =========================== */
export function useAvailableTantouEditors() {
  return useQuery({
    queryKey: ['tantou-editors', 'available'],
    queryFn: async () => { const res = await tantouService.getAvailable(); return unwrap(res) ?? [] },
  })
}

export function useTantouEditor(editorId) {
  return useQuery({
    queryKey: ['tantou-editors', editorId],
    queryFn: async () => { const res = await tantouService.getById(editorId); return unwrap(res) },
    enabled: !!editorId,
  })
}

/* ===========================
   USERS HOOKS
   =========================== */

// Chỉ 2 role này có bảng profile riêng ở backend (xem UsersController.GetProfile).
// Tantou / Editor Board / Admin chưa có bảng profile riêng → gọi /users/profile
// sẽ bị BadRequest "Unsupported role for profile."
const PROFILE_SUPPORTED_ROLES = new Set(['MANGAKA', 'ASSISTANT'])

export function useProfile() {
  const session = getSession()
  const roleKey = session?.role
  const supported = PROFILE_SUPPORTED_ROLES.has(roleKey)

  return useQuery({
    // roleKey trong key để tự refetch đúng nếu đổi tài khoản/role giữa các lần
    queryKey: ['profile', roleKey],
    queryFn: async () => {
      const res = await usersService.getProfile()
      return unwrap(res)
    },
    // Chỉ thật sự gọi API cho role có bảng profile riêng
    enabled: supported,
    // Role không hỗ trợ → dùng luôn dữ liệu cơ bản đã có sẵn trong session lúc
    // login, khỏi cần gọi API và tránh lỗi 400 "Unsupported role for profile"
    initialData: !supported && session
      ? {
          userid: session.userid ?? session.id,
          username: session.username,
          fullname: session.fullname ?? session.name,
          email: session.email,
          roleid: session.roleid,
        }
      : undefined,
  })
}

// Các role không có bảng profile riêng (chưa hỗ trợ chỉnh sửa qua /users/profile/*)
export function isProfileEditable(roleKey) {
  return PROFILE_SUPPORTED_ROLES.has(roleKey)
}

export function useUpdateProfile(roleKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => usersService.updateProfile(data, roleKey ?? 'MANGAKA'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      if (roleKey === 'ASSISTANT') {
        qc.invalidateQueries({ queryKey: ['assistant-profiles', 'available'] })
      }
    },
  })
}

/* ===========================
   NOTIFICATIONS HOOKS
   =========================== */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.list(),
    staleTime: 30 * 1000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => notificationsService.markRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => notificationsService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
}