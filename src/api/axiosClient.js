import axios from 'axios'
import { toast } from 'sonner'
import { clearSession } from '@/lib/auth.js'
import { authService } from '@/api'

const baseURL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'https://localhost:7243/api')

// ── PascalCase → snake_case normalizer (recursive) ──────────────────────────────
// Converts: Seriesid→series_id, GenreId→genre_id, Pageimageurl→page_image_url
function toSnakeCase(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
}

function normalizeKeys(obj) {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(normalizeKeys)
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toSnakeCase(k), normalizeKeys(v)])
  )
}

// ── JWT helpers & auto-refresh ─────────────────────────────────────────────────
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '=='.slice((base64.length + 4) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return {}
  }
}

function tokenExpiresAtMs(token) {
  const p = decodeJwtPayload(token)
  return Number.isFinite(p?.exp) ? p.exp * 1000 : 0
}

// Proactive refresh: nếu token còn < 5 phút thì refresh ngay (trước khi gửi request)
const REFRESH_AHEAD_MS = 5 * 60 * 1000

let refreshInflight = null

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) throw new Error('No refresh token available')

  if (!refreshInflight) {
    refreshInflight = authService
      .refreshToken({ token: refreshToken })
      .then(res => {
        const data = res?.data
        // snake-case transformer already ran, so try lowercase first
        const newToken = data?.token ?? data?.Token
        const newRefresh = data?.refresh_token ?? data?.refreshToken ?? data?.RefreshToken
        if (!newToken) throw new Error('Refresh response missing access token')
        localStorage.setItem('token', newToken)
        if (newRefresh) localStorage.setItem('refreshToken', newRefresh)

        // Cập nhật sessionStorage để role/exp mới đồng bộ
        try {
          const raw = sessionStorage.getItem('auth_user')
          if (raw) {
            const session = JSON.parse(raw)
            session.token = newToken
            if (newRefresh) session.refreshToken = newRefresh
            sessionStorage.setItem('auth_user', JSON.stringify(session))
          }
        } catch { /* ignore */ }

        window.__apiLog.push({ phase: 'refresh', ts: Date.now(), message: 'Access token refreshed proactively' })
        return newToken
      })
      .finally(() => {
        // Reset after a tick so queued requests can attach to the resolved promise
        setTimeout(() => { refreshInflight = null }, 0)
      })
  }
  return refreshInflight
}

function maybeProactiveRefresh(config) {
  const token = config?.headers?.Authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return Promise.resolve()
  if (config.url?.includes('/auth/')) return Promise.resolve()

  const expMs = tokenExpiresAtMs(token)
  if (!expMs) return Promise.resolve()
  if (Date.now() < expMs - REFRESH_AHEAD_MS) return Promise.resolve()

  // Token sắp hết hạn hoặc đã hết → refresh trước
  return refreshAccessToken().catch(() => { /* fallback: để request đi tới, 401 sẽ xử lý */ })
}

const instance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  transformResponse: [
    ...(axios.defaults.transformResponse ?? []),
    (data) => {
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch { return data }
      }
      return normalizeKeys(data)
    },
  ],
})

// Global API log (access via window.__apiLog in browser console)
window.__apiLog = []

// ── Request interceptor ─────────────────────────────────────────────────────────
instance.interceptors.request.use(async config => {
  await maybeProactiveRefresh(config)

  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  const entry = { phase: 'request', ts: Date.now(), method: config.method?.toUpperCase(), url: config.url, params: config.params, data: config.data instanceof FormData ? '[FormData]' : config.data }
  window.__apiLog.push(entry)

  console.group(`\u27A4  ${config.method?.toUpperCase()} ${config.url}`)
  console.log('params:', config.params)
  console.log('data:', config.data instanceof FormData ? '[FormData]' : config.data)
  console.groupEnd()

  config.startTime = Date.now()
  return config
})

// ── Response interceptor ───────────────────────────────────────────────────────
instance.interceptors.response.use(
  res => {
    const ms = Date.now() - (res.config.startTime || 0)
    const { method, url, params } = res.config

    window.__apiLog.push({ phase: 'response', ts: Date.now(), ms, method: method?.toUpperCase(), url, status: res.status, data: res.data })

    console.group(`\u2714  ${method?.toUpperCase()} ${url}  (${ms}ms)  ${res.status}`)
    console.log('params:', params)
    console.log('data:', res.data)
    console.groupEnd()

    // Toast chỉ cho mutations, không phải GET (Đã tắt để tránh trùng lặp thông báo hệ thống)
    // const isMutation = !['get', 'head', 'options'].includes(method?.toLowerCase())
    // if (isMutation) {
    //   const msg = extractSuccessMessage(res.data) ?? `${method?.toUpperCase()} ${url} thanh cong`
    //   toast.success(msg)
    // }

    return res
  },

  err => {
    const ms = Date.now() - (err.config?.startTime || 0)
    const method = err.config?.method?.toUpperCase() ?? '???'
    const url = err.config?.url ?? '???'
    const status = err.response?.status
    const errorData = err.response?.data
    const errorMsg = extractErrorMessage(errorData) || err.message

    // ── Auto-retry on 401: refresh once, then replay the original request ───────
    const originalRequest = err.config
    const alreadyRetried = originalRequest?._retried
    const isAuthEndpoint = url?.includes('/auth/')

    if (status === 401 && !alreadyRetried && !isAuthEndpoint) {
      originalRequest._retried = true
      return refreshAccessToken()
        .then(newToken => {
          originalRequest.headers = originalRequest.headers ?? {}
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return instance.request(originalRequest)
        })
        .catch(refreshErr => {
          // Refresh thất bại → fall through tới handler logout
          console.warn('[axiosClient] refresh-on-401 failed:', refreshErr?.message)
          // Trả về một 401 marker để caller biết refresh đã thử nhưng fail
          const finalErr = new Error('Session expired. Please log in again.')
          finalErr.isRefreshFailed = true
          finalErr.originalError = refreshErr
          throw finalErr
        })
    }

    console.group(`\u2718  ${method} ${url}  (${ms}ms)  ${status ?? 'NETWORK ERROR'}`)
    console.log('status:', status)
    console.log('error:', errorMsg)
    console.log('response:', errorData)
    console.log('full error:', err)
    console.groupEnd()

    window.__apiLog.push({ phase: 'error', ts: Date.now(), ms, method, url, status, error: errorMsg, response: errorData })

    if (status === 401) {
      clearSession()
      window.dispatchEvent(new Event('auth-session-change'))
      window.dispatchEvent(new CustomEvent('auth-401', { detail: { url } }))
    }

    if (status === 403) {
      const backendMsg = errorMsg && errorMsg !== 'Ban khong co quyen thuc hien thao tac nay' ? ` (${errorMsg})` : ''
      // silentError vẫn được tôn trọng cho 403 để nhất quán
      if (!err.config?.silentError) {
        toast.error(`Ban khong co quyen thuc hien thao tac nay${backendMsg}`)
      }
      return Promise.reject(err)
    }

    const userMsg = buildUserErrorMsg(status, errorMsg, method)
    // MỚI: cho phép nơi gọi request đánh dấu `silentError: true` trong config
    // để tự xử lý lỗi riêng (vd: composite hàng loạt khi gửi chapter, chấp nhận
    // vài page fail vì chưa có layer) mà không bị toast global này che mất
    // thông báo thành công của luồng chính (vd: "Đã gửi chapter cho Mangaka").
    // Cách dùng ở nơi gọi: axios.post(url, data, { silentError: true })
    if (!err.config?.silentError) {
      toast.error(userMsg)
    }

    return Promise.reject(err)
  },
)

// ── Helpers ────────────────────────────────────────────────────────────────────
function extractSuccessMessage(data) {
  if (!data) return null
  if (typeof data === 'string') return data
  return (
    data.message ??
    data.msg ??
    data.Message ??
    data.successMessage ??
    data.messageContent ??
    null
  )
}

function extractErrorMessage(data) {
  if (!data) return null
  if (typeof data === 'string') return data

  // ASP.NET Core ModelState validation trả về dạng ProblemDetails:
  // { title: "One or more validation errors occurred.", status: 400,
  //   errors: { FieldName: ["The FieldName field is required."] } }
  // Trước đây code chỉ đọc "title" (câu chung chung, không nói field nào sai) —
  // giờ ưu tiên đọc "errors" trước để hiện đúng field bị backend từ chối.
  if (data.errors && typeof data.errors === 'object') {
    const detail = Object.entries(data.errors)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
      .join(' | ')
    if (detail) return detail
  }

  return (
    data.message ??
    data.msg ??
    data.error ??
    data.Message ??
    data.errorMessage ??
    data.title ??
    JSON.stringify(data) ??
    null
  )
}

function buildUserErrorMsg(status, errorMsg, method) {
  if (!status) {
    return 'Khong the ket noi den server. Vui long kiem tra backend da chay chua.'
  }
  switch (status) {
    case 400: return `Du lieu khong hop le (${method}). ${errorMsg}`
    case 401: return 'Chua dang nhap hoac session het han. Vui long dang nhap lai.'
    case 403: return 'Ban khong co quyen thuc hien thao tac nay.'
    case 404: return `Khong tim thay tai nguyen. ${errorMsg}`
    case 409: return errorMsg || 'Xung dot du lieu. Vui long kiem tra lai.'
    case 422: return `Loi xac thuc du lieu. ${errorMsg}`
    case 500: return 'Loi server. Vui long thu lai sau.'
    default:   return errorMsg || `Loi ${status}. Vui long thu lai.`
  }
}

export default instance