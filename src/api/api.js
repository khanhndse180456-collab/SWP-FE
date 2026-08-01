import axios from './axiosClient'

// ── AUTH ────────────────────────────────────────────────────────────────────────
export const authService = {
  login: (data) => {
    console.log('[API] POST /auth/login', data)
    return axios.post('/auth/login', data)
  },
  register: (data) => {
    console.log('[API] POST /auth/register', data)
    return axios.post('/auth/register', data)
  },
  refreshToken: (data) => {
    console.log('[API] POST /auth/refresh-token', data)
    return axios.post('/auth/refresh-token', data)
  },
  logout: (data) => {
    console.log('[API] POST /auth/logout', data)
    return axios.post('/auth/logout', data)
  },
  createStaff: (data) => {
    console.log('[API] POST /auth/create-staff', data)
    return axios.post('/auth/create-staff', data)
  },
  profile: () => {
    console.log('[API] GET /users/profile')
    return axios.get('/users/profile')
  },
}

// ── SERIES ──────────────────────────────────────────────────────────────────────
export const seriesService = {
  getAll: () => {
    console.log('[API] GET /Series')
    return axios.get('/Series')
  },
  getById: (id) => {
    console.log('[API] GET /Series/:id', id)
    return axios.get(`/Series/${id}`)
  },
  getByMangaka: (mangakaId) => {
    console.log('[API] GET /Series/mangakaid/:mangakaId', mangakaId)
    return axios.get(`/Series/mangakaid/${mangakaId}`)
  },
  getByTitle: (title, mangakaId) => {
    // No server-side title filter — fetch all by mangaka, then filter client-side
    console.log('[API] GET /Series/mangakaid/', mangakaId, '→ filter by title:', title)
    return axios.get(`/Series/mangakaid/${mangakaId}`)
  },
  create: (formData) => {
    console.log('[API] POST /Series', Object.fromEntries(formData))
    return axios.post('/Series', formData)
  },
  update: (id, formData) => {
    console.log('[API] PUT /Series/:id', id, Object.fromEntries(formData))
    return axios.put(`/Series/${id}`, formData)
  },
  softDelete: (id) => {
    console.log('[API] DELETE /Series/softdelete/:id', id)
    return axios.delete(`/Series/softdelete/${id}`)
  },
  delete: (id) => {
    console.log('[API] DELETE /Series/:id', id)
    return axios.delete(`/Series/${id}`)
  },
  updateStatus: (id, status) => {
    console.log('[API] PATCH /Series/:id/status', id, status)
    return axios.patch(`/Series/${id}/status`, { status })
  },
  updatePublishFormat: (id, publishFormat) => {
    console.log('[API] PATCH /Series/:id/publish-format', id, publishFormat)
    return axios.patch(`/Series/${id}/publish-format`, { publishformat: publishFormat })
  },
  updateTantouEditor: (id, tantouEditorId) => {
    console.log('[API] PATCH /Series/:id/tantou-editor', id, tantouEditorId)
    return axios.patch(`/Series/${id}/tantou-editor`, { tantoueditorid: tantouEditorId })
  },
}

// ── CHAPTERS ────────────────────────────────────────────────────────────────────
export const chaptersService = {
  getAll: (seriesId) => {
    console.log('[API] GET /Chapters', { seriesId })
    return axios.get('/Chapters', { params: seriesId != null ? { seriesId } : undefined })
  },
  getById: (id) => {
    console.log('[API] GET /Chapters/:id', id)
    return axios.get(`/Chapters/${id}`)
  },
  create: (data) => {
    console.log('[API] POST /Chapters', data)
    return axios.post('/Chapters', data)
  },
  update: (id, data) => {
    console.log('[API] PUT /Chapters/:id', id, data)
    return axios.put(`/Chapters/${id}`, data)
  },
  delete: (id) => {
    console.log('[API] DELETE /Chapters/:id/soft', id)
    return axios.delete(`/Chapters/${id}/soft`)
  },
  getByAssistant: (assistantId) => {
    console.log('[API] GET /Chapters/assistant/:assistantId', assistantId)
    return axios.get(`/Chapters/assistant/${assistantId}`)
  },
  updateStatus: (id, status) => {
    console.log('[API] PATCH /Chapters/:id/status', id, status)
    return axios.patch(`/Chapters/${id}/status`, JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

// ── PAGES ─────────────────────────────────────────────────────────────────────
export const pagesService = {
  getAll: (chapterId, isSentToMangaka) => {
    console.log('[API] GET /Pages', { chapterId, isSentToMangaka })
    const params = {}
    if (chapterId != null) params.chapterId = chapterId
    if (isSentToMangaka != null) params.isSentToMangaka = isSentToMangaka
    return axios.get('/Pages', { params: Object.keys(params).length > 0 ? params : undefined })
  },
  getById: (id) => {
    console.log('[API] GET /Pages/:id', id)
    return axios.get(`/Pages/${id}`)
  },
  create: (formData) => {
    const entries = {}
    for (const [k, v] of formData) { entries[k] = v }
    console.log('[API] POST /Pages', entries)
    return axios.post('/Pages', formData)
  },
  update: (id, formData) => {
    const entries = {}
    for (const [k, v] of formData) { entries[k] = v }
    console.log('[API] PUT /Pages/:id', id, entries)
    return axios.put(`/Pages/${id}`, formData)
  },
  // MỚI: nhận thêm `options` (vd { silentError: true }) và forward xuống axios
  // để nơi gọi có thể tắt toast lỗi global — dùng khi cố tình gọi composite
  // hàng loạt và chấp nhận một số page fail vì chưa có layer (xem LayerEditor.jsx).
  composite: (pageId, options = {}) => {
    console.log('[API] POST /Pages/:id/composite', pageId)
    return axios.post(`/Pages/${pageId}/composite`, undefined, options)
  },
  updateIsSentToMangaka: (id, isSentToMangaka) => {
    console.log('[API] PATCH /Pages/:id/is-sent-to-mangaka', id, isSentToMangaka)
    return axios.patch(`/Pages/${id}/is-sent-to-mangaka`, JSON.stringify(isSentToMangaka), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
  softDelete: (id) => {
    console.log('[API] DELETE /Pages/:id/soft', id)
    return axios.delete(`/Pages/${id}/soft`)
  },
  hardDelete: (id) => {
    console.log('[API] DELETE /Pages/:id', id)
    return axios.delete(`/Pages/${id}`)
  },
}

// ── PAGE LAYERS ────────────────────────────────────────────────────────────────
export const pageLayersService = {
  getAll: (pageId) => {
    console.log('[API] GET /PageLayers?pageId=', pageId)
    return axios.get('/PageLayers', { params: pageId != null ? { pageId } : undefined })
  },
  getById: (id) => {
    console.log('[API] GET /PageLayers/:id', id)
    return axios.get(`/PageLayers/${id}`)
  },
  create: (formData) => {
    const entries = {}
    for (const [k, v] of formData) { entries[k] = v }
    console.log('[API] POST /PageLayers', entries)
    return axios.post('/PageLayers', formData)
  },
  update: (id, formData) => {
    const entries = {}
    for (const [k, v] of formData) { entries[k] = v }
    console.log('[API] PUT /PageLayers/:id', id, entries)
    return axios.put(`/PageLayers/${id}`, formData)
  },
  toggleVisibility: (id) => {
    console.log('[API] PATCH /PageLayers/:id/visibility', id)
    return axios.patch(`/PageLayers/${id}/visibility`)
  },
  softDelete: (id) => {
    console.log('[API] DELETE /PageLayers/:id/soft', id)
    return axios.delete(`/PageLayers/${id}/soft`)
  },
  hardDelete: (id) => {
    console.log('[API] DELETE /PageLayers/:id', id)
    return axios.delete(`/PageLayers/${id}`)
  },
}

// ── PAGE ISSUES ────────────────────────────────────────────────────────────────
export const pageIssuesService = {
  // GET /PageIssues?pageId=N (preferred) or ?chapterId=N (fallback) or ?status=...
  // Returns raw PageIssueDto[] (not wrapped)
  getAll: ({ pageId, chapterId, status } = {}) => {
    const params = {}
    if (pageId != null) params.pageId = pageId
    else if (chapterId != null) params.chapterId = chapterId
    if (status) params.status = status
    console.log('[API] GET /PageIssues', params)
    return axios.get('/PageIssues', { params: Object.keys(params).length ? params : undefined })
  },
  getById: (id) => {
    console.log('[API] GET /PageIssues/:id', id)
    return axios.get(`/PageIssues/${id}`)
  },
  create: (data) => {
    console.log('[API] POST /PageIssues', data)
    return axios.post('/PageIssues', data)
  },
  update: (id, data) => {
    console.log('[API] PUT /PageIssues/:id', id, data)
    return axios.put(`/PageIssues/${id}`, data)
  },
  delete: (id) => {
    console.log('[API] DELETE /PageIssues/:id', id)
    return axios.delete(`/PageIssues/${id}`)
  },
}

// ── GENRES ─────────────────────────────────────────────────────────────────────
export const genresService = {
  getAll: () => {
    console.log('[API] GET /Genres')
    return axios.get('/Genres')
  },
  getById: (id) => {
    console.log('[API] GET /Genres/:id', id)
    return axios.get(`/Genres/${id}`)
  },
  create: (data) => {
    console.log('[API] POST /Genres', data)
    return axios.post('/Genres', data)
  },
}

// ── TAGS ────────────────────────────────────────────────────────────────────────
export const tagsService = {
  getAll: () => {
    console.log('[API] GET /Tags')
    return axios.get('/Tags')
  },
  getById: (id) => {
    console.log('[API] GET /Tags/:id', id)
    return axios.get(`/Tags/${id}`)
  },
  create: (data) => {
    console.log('[API] POST /Tags', data)
    return axios.post('/Tags', data)
  },
}

// ── USERS ─────────────────────────────────────────────────────────────────────
export const usersService = {
  getProfile: () => {
    console.log('[API] GET /users/profile')
    return axios.get('/users/profile')
  },
  updateProfile(data, roleKey) {
    console.log('[API] PUT /users/profile (roleKey:', roleKey, ')', data)
    const endpoint = roleKey === 'MANGAKA'
      ? '/users/profile/mangaka'
      : roleKey === 'ASSISTANT'
        ? '/users/profile/assistant'
        : '/users/profile/mangaka'
    const fd = new FormData()
    if (roleKey === 'MANGAKA') {
      if (data.fullName) fd.append('FullName', data.fullName)
      if (data.penName) fd.append('PenName', data.penName)
      if (data.bio !== undefined) fd.append('Bio', data.bio)
      if (data.phoneNumber !== undefined) fd.append('PhoneNumber', data.phoneNumber)
      if (data.bankName !== undefined) fd.append('BankName', data.bankName)
      if (data.bankAccountNumber !== undefined) fd.append('BankAccountNumber', data.bankAccountNumber)
      if (data.bankAccountName !== undefined) fd.append('BankAccountName', data.bankAccountName)
    } else if (roleKey === 'ASSISTANT') {
      if (data.fullName) fd.append('FullName', data.fullName)
      if (data.phoneNumber !== undefined) fd.append('PhoneNumber', data.phoneNumber)
      if (data.portfolioUrl !== undefined) fd.append('PortfolioUrl', data.portfolioUrl)
      if (data.isAvailable !== undefined) fd.append('IsAvailable', String(data.isAvailable))
      if (data.skills !== undefined) fd.append('Skills', data.skills)
      if (data.softwareUsed !== undefined) fd.append('SoftwareUsed', data.softwareUsed)
      if (data.bankName !== undefined) fd.append('BankName', data.bankName)
      if (data.bankAccountNumber !== undefined) fd.append('BankAccountNumber', data.bankAccountNumber)
      if (data.bankAccountName !== undefined) fd.append('BankAccountName', data.bankAccountName)
    } else {
      if (data.fullName) fd.append('FullName', data.fullName)
    }
    return axios.put(endpoint, fd)
  },
  getAvailableAssistants: () => {
    console.log('[API] GET /users/available-assistants')
    return axios.get('/users/available-assistants')
  },
}

// ── ASSISTANT PROFILE ─────────────────────────────────────────────────────────
export const assistantProfileService = {
  getAvailable: () => {
    console.log('[API] GET /users/available-assistants')
    return axios.get('/users/available-assistants')
  },
  getById: (id) => {
    console.log('[API] GET /users/:id', id)
    return axios.get(`/users/${id}`)
  },
}

// ── TANTOU EDITORS ─────────────────────────────────────────────────────────
export const tantouService = {
  getAvailable: () => {
    console.log('[API] GET /users/tantou-editors')
    return axios.get('/users/tantou-editors')
  },
  getById: (id) => {
    console.log('[API] GET /users/:id', id)
    return axios.get(`/users/${id}`)
  },
}

// ── CONTRACTS (MangakaAssistant) ──────────────────────────────────────────────
export const contractsService = {
  getAll({ mangakaId, assistantId } = {}) {
    console.log('[API] GET /MangakaAssistant', { mangakaId, assistantId })
    return axios.get('/MangakaAssistant', {
      params: {
        ...(mangakaId != null && { mangakaId }),
        ...(assistantId != null && { assistantId }),
      },
    })
  },
  getById: (id) => {
    console.log('[API] GET /MangakaAssistant/:id', id)
    return axios.get(`/MangakaAssistant/${id}`)
  },
  create: (data) => {
    console.log('[API] POST /MangakaAssistant', data)
    return axios.post('/MangakaAssistant', data)
  },
  update: (id, data) => {
    console.log('[API] PUT /MangakaAssistant/:id', id, data)
    return axios.put(`/MangakaAssistant/${id}`, data)
  },
  updateStatus: (id, status) => {
    console.log('[API] PATCH /MangakaAssistant/:id/status', id, status)
    return axios.patch(`/MangakaAssistant/${id}/status`, { Status: status })
  },
  softDelete: (id) => {
    console.log('[API] DELETE /MangakaAssistant/:id', id)
    return axios.delete(`/MangakaAssistant/${id}`)
  },
  uploadFile: (id, formData) => {
    console.log('[API] PUT /MangakaAssistant/:id/upload-file', id)
    return axios.put(`/MangakaAssistant/${id}/upload-file`, formData)
  },
}

// ── PAGE ISSUES (duplicated service) ──────────────────────────────────────────
export const pageIssuesApi = {
  // GET /PageIssues?pageId=N (preferred) or ?chapterId=N (fallback) or ?status=...
  getAll: ({ pageId, chapterId, status } = {}) => {
    const params = {}
    if (pageId != null) params.pageId = pageId
    else if (chapterId != null) params.chapterId = chapterId
    if (status) params.status = status
    console.log('[API] GET /PageIssues', params)
    return axios.get('/PageIssues', { params: Object.keys(params).length ? params : undefined })
  },
  getById: (id) => {
    console.log('[API] GET /PageIssues/:id', id)
    return axios.get(`/PageIssues/${id}`)
  },
  create: (data) => {
    console.log('[API] POST /PageIssues', data)
    return axios.post('/PageIssues', data)
  },
  update: (id, data) => {
    console.log('[API] PUT /PageIssues/:id', id, data)
    return axios.put(`/PageIssues/${id}`, data)
  },
  updateStatus: (id, status) => {
    console.log('[API] PATCH /PageIssues/:id/status', id, status)
    return axios.patch(`/PageIssues/${id}/status`, { Status: status })
  },
  softDelete: (id) => {
    console.log('[API] DELETE /PageIssues/:id/soft', id)
    return axios.delete(`/PageIssues/${id}/soft`)
  },
  hardDelete: (id) => {
    console.log('[API] DELETE /PageIssues/:id', id)
    return axios.delete(`/PageIssues/${id}`)
  },
}

// ── ERROR HELPER ──────────────────────────────────────────────────────────────
export function getApiErrorMessage(err, fallback) {
  const data = err?.response?.data
  if (!data) return fallback ?? err?.message ?? 'Da xay ra loi.'
  if (typeof data === 'string') return data
  return (
    data.message ??
    data.msg ??
    data.error ??
    data.Message ??
    data.errorMessage ??
    data.title ??
    fallback ??
    JSON.stringify(data)
  )
}