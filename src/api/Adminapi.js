import axiosClient from '@/api/axiosClient.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function unwrap(res) {
    if (!res) return null
    const payload = res.data
    if (payload && typeof payload === 'object' && 'data' in payload && !Array.isArray(payload)) {
        return payload.data
    }
    return payload ?? null
}

const SERIES_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#14b8a6', '#8b5cf6', '#f43f5e', '#0ea5e9']
function initials(title = '') {
    return title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??'
}
function randomColor(id) {
    return SERIES_COLORS[(id ?? Math.random() * 8 | 0) % SERIES_COLORS.length]
}

// ─── API object ───────────────────────────────────────────────────────────────
export const api = {

    // ── MANGA / SERIES ──────────────────────────────────────────────────────────
    async getMangaList() {
        const res = await axiosClient.get('/Series')
        const data = unwrap(res) ?? []
        console.log("RAW SERIES DATA FROM API:", data[0] || {});
        return data.map((s, i) => {
            const sId = s.seriesid ?? s.series_id ?? s.id
            return {
                id: sId,
                title: s.title ?? `Series #${i + 1}`,
                author: s.mangaka_name ?? s.mangakaName ?? '—',
                status: (s.status ?? 'ongoing').toLowerCase(),
                chapters: s.chapter_count ?? s.chapterCount ?? 0,
                reads: s.totalviews ?? s.total_views ?? s.reads ?? 0,
                genre: (s.genres ?? []).map(g => typeof g === 'string' ? g : (g?.genre_name ?? g?.genrename ?? g?.name ?? '')).filter(Boolean),
                genreList: s.genres ?? [],
                tagList: s.tags ?? [],
                tags: (s.tags ?? []).map(t => typeof t === 'string' ? t : (t?.tag_name ?? t?.tagname ?? t?.name ?? '')).filter(Boolean),
                mangakaId: s.mangakaid ?? s.mangakaId ?? null,
                proposalFileUrl: s.proposalfileurl ?? s.proposalFileUrl ?? null,
                synopsis: s.synopsis ?? 'Chưa có tóm tắt',
                ageRating: s.agerating ?? s.age_rating ?? '—',
                publishFormat: s.publishformat ?? s.publish_format ?? '—',
                editor: s.tantou_editor_name ?? s.tantouEditorName ?? '—',
                createdAt: s.createdat ? new Date(s.createdat).toLocaleDateString('vi-VN') : '—',
                updatedAt: s.updatedat ? new Date(s.updatedat).toLocaleDateString('vi-VN') : '—',
                approvedAt: s.approvedat ? new Date(s.approvedat).toLocaleDateString('vi-VN') : null,
                bg: randomColor(sId ?? i),
                initials: initials(s.title),
                cover: s.coverimageurl ?? s.coverImageUrl ?? s.CoverImageUrl ?? s.cover_image_url ?? null,
            }
        })
    },

    async createManga(payload) {
        const res = await axiosClient.post('/Series', payload)
        return unwrap(res)
    },

    async updateManga(id, payload) {
        const res = await axiosClient.put(`/Series/${id}`, payload)
        return unwrap(res)
    },

    async updateMangaStatus(id, status) {
        const mapping = {
            draft: 'Draft',
            editorreview: 'EditorReview',
            ebreview: 'EBReview',
            publishing: 'Publishing',
            ongoing: 'Publishing',
            completed: 'Completed',
            cancelled: 'Cancelled',
            hiatus: 'Cancelled'
        }
        const apiStatus = mapping[status.toLowerCase()] ?? status
        const res = await axiosClient.patch(`/Series/${id}/status`, { Status: apiStatus })
        return unwrap(res)
    },

    async updateMangaPublishFormat(id, format) {
        const mapping = {
            pending: 'Pending',
            monthly: 'Monthly',
            weekly: 'Weekly'
        }
        const apiFormat = mapping[format.toLowerCase()] ?? format
        const res = await axiosClient.patch(`/Series/${id}/publish-format`, { Publishformat: apiFormat })
        return unwrap(res)
    },

    async deleteManga(id) {
        const res = await axiosClient.delete(`/Series/softdelete/${id}`)
        return unwrap(res)
    },

    // ── CHAPTERS ────────────────────────────────────────────────────────────────
    async getChaptersByManga(seriesId) {
        const res = await axiosClient.get('/Chapters', { params: { seriesId } })
        const data = unwrap(res) ?? []
        return data.map(c => ({
            id: c.chapterid ?? c.chapter_id ?? c.id,
            number: c.chapternumber ?? c.chapter_number ?? c.number,
            title: c.title ?? '',
            pages: c.totalpages ?? c.total_pages ?? c.pages ?? 0,
            uploadedBy: c.uploadedby ?? c.uploaded_by ?? c.createdby ?? '—',
            uploadedAt: c.createdat ? new Date(c.createdat).toLocaleDateString('vi-VN') : '—',
        }))
    },

    async createChapter(payload) {
        const res = await axiosClient.post('/Chapters', payload)
        return unwrap(res)
    },

    async deleteChapter(id) {
        const res = await axiosClient.delete(`/Chapters/${id}`)
        return unwrap(res)
    },

    // ── PROFILE ─────────────────────────────────────────────────────────────────
    async getProfile() {
        const res = await axiosClient.get('/Users/profile')
        const d = unwrap(res) ?? {}
        return {
            name: d.fullname ?? d.full_name ?? d.username ?? d.name ?? 'Admin',
            email: d.email ?? '—',
            role: d.role ?? d.rolename ?? 'ADMIN',
            status: d.status ?? 'active',
            createdAt: d.createdat ? new Date(d.createdat).toLocaleDateString('vi-VN') : '—',
            initials: (d.fullname ?? d.username ?? 'AD').slice(0, 2).toUpperCase(),
        }
    },

    // ── SETTINGS ────────────────────────────────────────────────────────────────
    async getSettings() {
        try {
            const res = await axiosClient.get('/Settings', { silentError: true })
            return unwrap(res)
        } catch {
            return {
                site: {
                    name: 'MangaPublish',
                    tagline: 'Nền tảng xuất bản manga',
                    maintenanceMode: false,
                },
                notifications: {
                    emailOnReport: true,
                    emailOnNewUser: false,
                    emailOnComment: true,
                    slackWebhook: '',
                },
                storage: { used: 12.4, total: 50, unit: 'GB' },
                apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            }
        }
    },

    async updateSettings(section, data) {
        try {
            const res = await axiosClient.put(`/Settings/${section}`, data, { silentError: true })
            return unwrap(res)
        } catch {
            return { success: true }
        }
    },

    // ── STATS ───────────────────────────────────────────────────────────────────
    async getStats() {
        const [ovRes, statsRes, topRes, usersRes, seriesRes] = await Promise.all([
            axiosClient.get('/Dashboard/Admin/Overview'),
            axiosClient.get('/Dashboard/Admin/SeriesStats'),
            axiosClient.get('/Dashboard/TopSeries'),
            axiosClient.get('/admin/users'),
            axiosClient.get('/Series')
        ])

        const users = usersRes.data?.data ?? []
        const series = seriesRes.data ?? []

        // Total reads = sum of views of all series
        const totalReads = series.reduce((sum, s) => sum + (s.totalviews ?? s.total_views ?? s.views ?? s.reads ?? 0), 0)

        // Count users by registration month/date if available
        const totalUsers = users.length
        const totalChapters = ovRes.data?.totalChapters ?? ovRes.data?.total_chapters ?? 0
        const totalSeries = ovRes.data?.totalSeries ?? series.length

        // Monthly data: let's build dynamic monthly data from real users' created dates
        const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
        const currentMonth = new Date().getMonth() // 0-11
        const last6Months = []
        for (let i = 5; i >= 0; i--) {
            const mIdx = (currentMonth - i + 12) % 12
            last6Months.push(months[mIdx])
        }

        const monthlyData = last6Months.map(mName => ({
            month: mName,
            reads: 0,
            users: 0,
        }))

        users.forEach(u => {
            const dateStr = u.created_at ?? u.createdAt
            if (dateStr) {
                const date = new Date(dateStr)
                const mName = months[date.getMonth()]
                const idx = last6Months.indexOf(mName)
                if (idx !== -1) {
                    monthlyData[idx].users += 1
                }
            }
        })

        series.forEach(s => {
            const dateStr = s.createdat ?? s.createdAt
            const views = s.totalviews ?? s.totalViews ?? s.views ?? s.reads ?? 0
            if (dateStr) {
                const date = new Date(dateStr)
                const mName = months[date.getMonth()]
                const idx = last6Months.indexOf(mName)
                if (idx !== -1) {
                    monthlyData[idx].reads += views
                }
            }
        })



        // Series status split
        const pending = statsRes.data?.pendingSeries ?? statsRes.data?.pending_series ?? 0
        const ongoing = statsRes.data?.ongoingSeries ?? statsRes.data?.ongoing_series ?? 0
        const completed = statsRes.data?.completedSeries ?? statsRes.data?.completed_series ?? 0
        const rejected = statsRes.data?.rejectedSeries ?? statsRes.data?.rejected_series ?? 0
        
        const totalStatus = (pending + ongoing + completed + rejected) || 1
        
        const deviceSplit = [
            { label: 'Đang ra', pct: Math.round((ongoing / totalStatus) * 100), color: '#6366f1' },
            { label: 'Chờ duyệt', pct: Math.round((pending / totalStatus) * 100), color: '#f59e0b' },
            { label: 'Hoàn thành', pct: Math.round((completed / totalStatus) * 100), color: '#10b981' },
            { label: 'Bị từ chối', pct: Math.round((rejected / totalStatus) * 100), color: '#f43f5e' },
        ].filter(d => d.pct > 0)

        // Make sure it sums to 100% if we have values
        if (deviceSplit.length > 0) {
            const sum = deviceSplit.reduce((acc, d) => acc + d.pct, 0)
            if (sum !== 100 && sum > 0) {
                deviceSplit[0].pct += (100 - sum)
            }
        } else {
            deviceSplit.push(
                { label: 'Chưa có truyện', pct: 100, color: '#94a3b8' }
            )
        }

        // Find latest weekly ranking issue dynamically
        let rankings = []
        let latestIssueLabel = 'Chưa có xếp hạng'
        let latestYear = 0
        let latestNumber = 0
        const uniqueIssuesMap = {}

        try {
            const sampleSeriesIds = series.slice(0, 3).map(s => s.seriesid ?? s.series_id ?? s.id).filter(Boolean)

            for (const sId of sampleSeriesIds) {
                const historyRes = await axiosClient.get(`/Rankings/series/${sId}`)
                const history = historyRes.data ?? []
                history.forEach(h => {
                    const year = h.issue_year ?? h.issueYear ?? 0
                    const number = h.issue_number ?? h.issueNumber ?? 0
                    if (year > 0 && number > 0) {
                        const key = `${year}-${number}`
                        uniqueIssuesMap[key] = { year, number }
                        if (year > latestYear || (year === latestYear && number > latestNumber)) {
                            latestYear = year
                            latestNumber = number
                        }
                    }
                })
            }

            if (latestYear > 0 && latestNumber > 0) {
                const rankingsRes = await axiosClient.get(`/Rankings/${latestYear}/${latestNumber}`)
                const rawRankings = rankingsRes.data ?? []
                rankings = rawRankings.map(r => ({
                    title: r.series_title ?? r.seriesTitle ?? 'Không tên',
                    votes: r.vote_count ?? r.voteCount ?? 0,
                    rank: r.rank_position ?? r.rankPosition ?? 0
                }))
                latestIssueLabel = `Kỳ ${latestNumber} - Năm ${latestYear}`
            }
        } catch (err) {
            console.error('Discover latest ranking issue error:', err)
        }

        const availableIssues = Object.values(uniqueIssuesMap).sort((a, b) => b.year - a.year || b.number - a.number)
        const totalVotes = rankings.reduce((sum, r) => sum + r.votes, 0)

        const overview = [
            { label: 'Tổng phiếu bầu (BXH)', value: totalVotes.toLocaleString('vi-VN') },
            { label: 'Người dùng mới', value: totalUsers.toString() },
            { label: 'Chương mới', value: totalChapters.toString() },
            { label: 'Bộ truyện', value: totalSeries.toString() },
        ]

        const topManga = [...rankings]
            .sort((a, b) => b.votes - a.votes)
            .slice(0, 5)
            .map(r => ({
                title: r.title,
                reads: r.votes,
            }))

        if (topManga.length === 0) {
            topManga.push({ title: 'Chưa có xếp hạng', reads: 0 })
        }

        return {
            overview,
            monthly: monthlyData,
            topManga,
            deviceSplit,
            rankings,
            latestIssueLabel,
            latestYear: latestYear || 2026,
            latestNumber: latestNumber || 1,
            availableIssues,
        }
    },

    // ── TAGS ────────────────────────────────────────────────────────────────────
    async getTags() {
        const res = await axiosClient.get('/Tags')
        return res.data ?? []
    },
    async createTag(payload) {
        const res = await axiosClient.post('/Tags', payload)
        return res.data
    },
    async updateTag(id, payload) {
        const res = await axiosClient.put(`/Tags/${id}`, payload)
        return res.data
    },
    async deleteTag(id) {
        const res = await axiosClient.delete(`/Tags/${id}`)
        return res.data
    },

    // ── GENRES ──────────────────────────────────────────────────────────────────
    async getGenres() {
        const res = await axiosClient.get('/Genres')
        return res.data ?? []
    },
    async createGenre(payload) {
        const res = await axiosClient.post('/Genres', payload)
        return res.data
    },
    async updateGenre(id, payload) {
        const res = await axiosClient.put(`/Genres/${id}`, payload)
        return res.data
    },
    async deleteGenre(id) {
        const res = await axiosClient.delete(`/Genres/${id}`)
        return res.data
    },

    // ── DASHBOARD ────────────────────────────────────────────────────────────────
    async getDashboardData() {
        const [ovRes, statsRes, topRes, usersRes] = await Promise.all([
            axiosClient.get('/Dashboard/Admin/Overview'),
            axiosClient.get('/Dashboard/Admin/SeriesStats'),
            axiosClient.get('/Dashboard/TopSeries'),
            axiosClient.get('/admin/users'),
        ])

        const users = usersRes.data?.data ?? []
        const count = (roleId) => users.filter(u => (u.role_id ?? u.roleId) === roleId).length

        return {
            overview: {
                total_assistants: count(5), // Assistant = 5
                total_ebs:        count(2), // EB = 2
                total_tantous:    count(3), // Tantou = 3
                total_mangakas:   count(4), // Mangaka = 4
                ...ovRes.data,
            },
            seriesStats: statsRes.data,
            topSeries: Array.isArray(topRes.data) ? topRes.data : [],
        }
    },

    async getUserDetail(id) {
        const res = await axiosClient.get(`/admin/users/${id}`)
        const u = unwrap(res) ?? {}
        const STATUS_FROM_API = { active: 'active', inactive: 'banned', locked: 'banned' }
        return {
            id: u.user_id ?? u.userId ?? u.userid ?? id,
            name: u.full_name ?? u.fullName ?? u.fullname ?? u.username,
            username: u.username,
            email: u.email ?? '—',
            role: (u.role_name ?? u.roleName ?? u.rolename ?? 'user').toLowerCase(),
            status: STATUS_FROM_API[String(u.status ?? 'active').toLowerCase()] ?? 'active',
            joinDate: (u.created_at ?? u.createdAt) ? new Date(u.created_at ?? u.createdAt).toLocaleDateString('vi-VN') : '—',
            initials: (u.full_name ?? u.fullName ?? u.username ?? 'U').slice(0, 2).toUpperCase(),
            penName: u.pen_name ?? u.penName ?? u.penname ?? null,
            avatarUrl: u.avatar_url ?? u.avatarUrl ?? u.avatarurl ?? null,
            bio: u.bio ?? null,
            phoneNumber: u.phone_number ?? u.phoneNumber ?? u.phonenumber ?? null,
            bankName: u.bank_name ?? u.bankName ?? u.bankname ?? null,
            bankAccountNumber: u.bank_account_number ?? u.bankAccountNumber ?? u.bankaccountnumber ?? null,
            bankAccountName: u.bank_account_name ?? u.bankAccountName ?? u.bankaccountname ?? null,
            portfolioUrl: u.portfolio_url ?? u.portfolioUrl ?? u.portfoliourl ?? null,
            skills: u.skills ?? null,
            softwareUsed: u.software_used ?? u.softwareUsed ?? u.softwareused ?? null,
            isAvailable: u.is_available ?? u.isAvailable ?? u.isavailable ?? null
        }
    },

    // ── USERS ────────────────────────────────────────────────────────────────────
    async getUsers() {
        const res = await axiosClient.get('/admin/users')
        const users = res.data?.data ?? []
        // Backend trả status dạng "Active"/"Inactive"/"Locked" (PascalCase).
        // Map về key nội bộ: cả "Inactive" và "Locked" đều coi là 'banned'
        // (không thể đăng nhập), giữ "Active" thành 'active'.
        const STATUS_FROM_API = { active: 'active', inactive: 'banned', locked: 'banned' }
        return users.map(u => ({
            id: u.user_id ?? u.userId,
            name: u.full_name ?? u.fullName ?? u.username,
            email: u.email ?? '—',
            role: (u.role_name ?? u.roleName ?? 'user').toLowerCase(),
            status: STATUS_FROM_API[String(u.status ?? 'active').toLowerCase()] ?? 'active',
            joinDate: (u.created_at ?? u.createdAt)
                ? new Date(u.created_at ?? u.createdAt).toLocaleDateString('vi-VN')
                : '—',
            initials: (u.full_name ?? u.fullName ?? u.username ?? 'U').slice(0, 2).toUpperCase(),
            readCount: u.read_count ?? u.readCount ?? 0,
            comments: u.comment_count ?? u.commentCount ?? 0,
            reports: u.report_count ?? u.reportCount ?? 0,
        }))
    },

    async updateUserStatus(id, status) {
        // Backend chỉ chấp nhận đúng 3 giá trị: "Active", "Inactive", "Locked"
        // (xem [AllowedValues] trên UserDto.AdminUpdateStatusRequest.Status).
        // Frontend dùng key nội bộ 'active'/'banned' nên cần map sang đúng enum.
        const STATUS_TO_API = { active: 'Active', banned: 'Locked' }
        const apiStatus = STATUS_TO_API[status] ?? status
        const res = await axiosClient.patch(`/admin/users/${id}/status`, { Status: apiStatus })
        return res.data
    },

    // PUT /admin/users/{id} là full-update endpoint. Field role phải đúng tên
    // cột FK ở backend (RoleId), không phải "Role" — nếu không backend có thể
    // bind sai và gây lỗi FK constraint khi insert giá trị không hợp lệ.
    async updateUserRole(id, roleId, currentInfo = {}) {
        const body = {
            FullName: currentInfo.name,
            Email: currentInfo.email,
            RoleId: roleId,
        }
        const res = await axiosClient.put(`/admin/users/${id}`, body)
        return res.data
    },

    async getRankingsByIssue(year, issue) {
        const res = await axiosClient.get(`/Rankings/${year}/${issue}`)
        return res.data ?? []
    },

    // POST /api/auth/create-staff — endpoint đúng để tạo tài khoản nội bộ
    // (EB, Tantou Editor, Mangaka, Assistant...). Field dùng camelCase
    // (userName, password, fullName, email, roleId), khác với AdminUsersController
    // (PascalCase). Response trả kèm token/refreshToken cho tài khoản mới tạo
    // nhưng ta không cần dùng — chỉ cần biết tạo thành công.
    async createUser({ username, password, fullName, email, roleId }) {
        const body = {
            userName: username,
            password,
            fullName,
            email,
            roleId,
        }
        const res = await axiosClient.post('/auth/create-staff', body)
        return unwrap(res)
    },

    // ── CONTRACTS (MANGAKA - ASSISTANT) ──────────────────────────────────────────
    async getContracts() {
        const res = await axiosClient.get('/MangakaAssistant')
        const data = unwrap(res) ?? []
        return data.map(c => ({
            id: c.contract_id ?? c.contractid ?? c.id,
            mangakaId: c.mangaka_id ?? c.mangakaid,
            assistantId: c.assistant_id ?? c.assistantid,
            mangakaName: c.mangaka_name ?? c.mangakaname ?? '—',
            assistantName: c.assistant_name ?? c.assistantname ?? '—',
            salaryAmount: c.salary_amount ?? c.salaryamount ?? 0,
            salaryType: c.salary_type ?? c.salarytype ?? 'Monthly',
            contractTerms: c.contract_terms ?? c.contractterms ?? '',
            status: c.status ?? 'Pending',
            startDate: c.start_date ?? c.startdate ? new Date(c.start_date ?? c.startdate).toLocaleDateString('vi-VN') : '—',
            endDate: c.end_date ?? c.enddate ? new Date(c.end_date ?? c.enddate).toLocaleDateString('vi-VN') : '—',
            startDateRaw: c.start_date ?? c.startdate ?? null,
            endDateRaw: c.end_date ?? c.enddate ?? null,
            contractFileUrl: c.contract_file_url ?? c.contractfileurl ?? null
        }))
    },

    async createContract(payload) {
        const res = await axiosClient.post('/MangakaAssistant', payload)
        return unwrap(res)
    },

    async updateContract(id, payload) {
        const res = await axiosClient.put(`/MangakaAssistant/${id}`, payload)
        return unwrap(res)
    },

    async updateContractStatus(id, status) {
        const res = await axiosClient.patch(`/MangakaAssistant/${id}/status`, { Status: status })
        return unwrap(res)
    },

    async uploadContractFile(id, file) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await axiosClient.put(`/MangakaAssistant/${id}/upload-file`, formData)
        return unwrap(res)
    },

    async deleteContract(id) {
        const res = await axiosClient.delete(`/MangakaAssistant/${id}`)
        return unwrap(res)
    },
}