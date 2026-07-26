import { useMemo, useState, useRef } from 'react'
import { ArrowLeft, CheckCircle2, Eraser, MessageSquarePlus, MousePointer2, Square, Send, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { noteTaskLabel } from '@/constants/workspaceTasks.js'
import { LABEL_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import { getSession } from '@/lib/auth.js'
import {
  usePageIssues,
  useCreatePageIssue,
  useDeletePageIssue,
} from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import '@/styles/mangaPage.css'

// Backend PageIssueDto.Create chỉ chấp nhận đúng 2 giá trị này cho IssueType
// (xem [AllowedValues] trong DTOs/PageIssueDto.cs)
const TANTOU_REVISION_TYPE = 'Revision'   // dùng cho mọi comment/box/reply từ Tantou
const MANGAKA_PRODUCTION_TYPE = 'Production' // ghi chú/task do Mangaka tạo

// WorkCategory hợp lệ: Content, Dialog, Inking, Effects, Shading, Background
const DEFAULT_WORK_CATEGORY = 'Content'

// Backend chưa có cột parent_note_id nên không thể lưu quan hệ reply -> note
// thật sự. Tạm nhúng marker vào đầu `description` để tự parse lại ở FE.
// TODO: đề xuất DUYKHANH thêm cột `parent_note_id` vào bảng page_issues để
// bỏ workaround này.
const REPLY_PREFIX_RE = /^\[\[reply:(.+?)\]\]\s?/
function encodeReply(parentId, text) {
  return `[[reply:${parentId}]] ${text}`
}
function decodeReply(desc) {
  const m = REPLY_PREFIX_RE.exec(desc || '')
  if (!m) return null
  return { parentNoteId: m[1], text: (desc || '').slice(m[0].length) }
}

function issueField(issue, camelKey, lowerKey) {
  return issue?.[camelKey] ?? issue?.[lowerKey] ?? issue?.[camelKey?.toLowerCase()] ?? null
}
function tantouCommentAuthor(issue) {
  return issueField(issue, 'createdByName', 'created_by_name') ?? 'Tantou Editor'
}
function tantouCommentText(issue) {
  const raw = issueField(issue, 'description', 'description') ?? ''
  const decoded = decodeReply(raw)
  return decoded ? decoded.text : raw
}
function tantouCommentDate(issue) {
  const raw = issueField(issue, 'createdat', 'createdAt')
  if (!raw) return ''
  try { return new Date(raw).toLocaleString('vi-VN') } catch { return '' }
}
function issueId(issue) { return issueField(issue, 'issueid', 'issueId') }
function issueType(issue) { return issueField(issue, 'issueType', 'issue_type') }
function boxWidthOf(issue) { return issueField(issue, 'boxWidth', 'box_width') ?? 0 }
function boxHeightOf(issue) { return issueField(issue, 'boxHeight', 'box_height') ?? 0 }

function TantouCommentPanel({ pageId, title = 'Nhận xét của Tantou' }) {
  const [draft, setDraft] = useState('')
  const session = getSession()

  const { data: issuesRaw = [], isLoading } = usePageIssues({ pageId })
  const createIssue = useCreatePageIssue()
  const deleteIssue = useDeletePageIssue()

  // Chỉ lấy các Revision "chung" (không có box vẽ trên trang, không phải reply)
  const tantouComments = useMemo(() => {
    if (!Array.isArray(issuesRaw)) return []
    return issuesRaw
      .filter(i =>
        issueType(i) === TANTOU_REVISION_TYPE &&
        boxWidthOf(i) === 0 &&
        boxHeightOf(i) === 0 &&
        !decodeReply(issueField(i, 'description', 'description'))
      )
      .sort((a, b) => {
        const ad = new Date(issueField(a, 'createdat', 'createdAt') ?? 0).getTime()
        const bd = new Date(issueField(b, 'createdat', 'createdAt') ?? 0).getTime()
        return bd - ad
      })
  }, [issuesRaw])

  async function handleAdd() {
    const text = draft.trim()
    if (!text) { toast.error('Nhập nội dung nhận xét trước khi gửi.'); return }
    if (!pageId) { toast.error('Chưa xác định được trang để gắn nhận xét.'); return }
    try {
      await createIssue.mutateAsync({
        pageid: pageId,
        createdById: session?.id ?? session?.userid ?? null,
        assignedToId: null,
        issueType: TANTOU_REVISION_TYPE,
        workCategory: DEFAULT_WORK_CATEGORY,
        boxX: 0, boxY: 0, boxWidth: 0, boxHeight: 0,
        description: text,
        deadline: null,
      })
      setDraft('')
      toast.success('Đã thêm nhận xét.')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Không gửi được nhận xét — thử lại.')
    }
  }

  async function handleDelete(id) {
    if (typeof window !== 'undefined' && !window.confirm('Xóa nhận xét này?')) return
    try {
      await deleteIssue.mutateAsync(id)
      toast.success('Đã xóa nhận xét.')
    } catch {
      toast.error('Không xóa được nhận xét.')
    }
  }

  return (
    <Card className="border-sky-200 dark:border-sky-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="size-4 text-sky-600" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>
          Ghi chú riêng của bạn — không thay đổi nội dung của Mangaka/Assistant, chỉ lưu thêm bên cạnh.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!pageId ? (
          <p className="text-xs text-muted-foreground">Chưa có trang nào để nhận xét.</p>
        ) : (
          <>
            <Textarea
              rows={2}
              placeholder="Viết nhận xét, đánh giá lại..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="resize-y"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAdd} disabled={createIssue.isPending || !draft.trim()}>
                <Send className="size-3.5" />
                {createIssue.isPending ? 'Đang gửi...' : 'Gửi nhận xét'}
              </Button>
            </div>
            <Separator />
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Đang tải nhận xét...</p>
            ) : tantouComments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có nhận xét nào.</p>
            ) : (
              <ScrollArea className="max-h-56">
                <ul className="space-y-2 pr-3">
                  {tantouComments.map((c, idx) => {
                    const cid = issueId(c) ?? `tc-${idx}`
                    return (
                      <li key={cid} className="rounded-lg border bg-sky-50/50 p-3 text-sm dark:bg-sky-500/5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
                            {tantouCommentAuthor(c)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{tantouCommentDate(c)}</span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(cid)}
                              title="Xóa nhận xét"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{tantouCommentText(c)}</p>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function TantouPageReview({
  submission,
  editorialComment,
  onEditorialCommentChange,
  onBack,
  onForwardEb,
  onRequestRevision,
  onApproveRecurring,
  actionsMode = 'eb', // 'eb' = hiện EB actions (debut/recurring review), 'studio' = chapter workspace
  // Studio chapter actions
  onChapterForwardEb,
  onChapterRequestRevision,
  onChapterApprove,
  pages = [],
  pageIndex = 0,
  onPageIndexChange,
}) {
  const session = getSession()
  const [selectedMangakaId, setSelectedMangakaId] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)

  const [tool, setTool] = useState('draw')
  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [selectedTantouBoxId, setSelectedTantouBoxId] = useState(null)
  const [newBoxDraft, setNewBoxDraft] = useState('')
  const [showNewBoxPanel, setShowNewBoxPanel] = useState(false)
  const [tempBox, setTempBox] = useState(null)
  // Studio revision comment (đã bỏ — không cần ghi chú riêng, nhận xét nằm trong box)

  const boardRef = useRef(null)

  const currentPage = pages[pageIndex] ?? null
  const currentPageId = currentPage?.pageid ?? null

  const { data: pageIssuesRaw = [] } = usePageIssues({ pageId: currentPageId })
  const createIssue = useCreatePageIssue()
  const deleteIssue = useDeletePageIssue()

  // Box vẽ trên trang: Revision có box thật (width/height > 0), không phải reply
  const tantouBoxes = useMemo(() => {
    if (!Array.isArray(pageIssuesRaw)) return []
    return pageIssuesRaw
      .filter(i =>
        issueType(i) === TANTOU_REVISION_TYPE &&
        boxWidthOf(i) > 0 &&
        boxHeightOf(i) > 0
      )
      .map(i => ({
        id: String(issueId(i)),
        x: issueField(i, 'boxX', 'box_x') ?? 0,
        y: issueField(i, 'boxY', 'box_y') ?? 0,
        w: issueField(i, 'boxWidth', 'box_width') ?? 0,
        h: issueField(i, 'boxHeight', 'box_height') ?? 0,
        text: issueField(i, 'description', 'description') ?? '',
      }))
  }, [pageIssuesRaw])

  const mangakaNotes = useMemo(() => {
    if (!Array.isArray(pageIssuesRaw)) return []
    return pageIssuesRaw
      .filter(i => issueType(i) === MANGAKA_PRODUCTION_TYPE)
      .map(i => ({
        id: String(issueId(i)),
        x: issueField(i, 'boxX', 'box_x') ?? 0,
        y: issueField(i, 'boxY', 'box_y') ?? 0,
        w: issueField(i, 'boxWidth', 'box_width') ?? 0,
        h: issueField(i, 'boxHeight', 'box_height') ?? 0,
        text: issueField(i, 'description', 'description') ?? '',
        taskType: issueField(i, 'workCategory', 'work_category') ?? DEFAULT_WORK_CATEGORY,
      }))
  }, [pageIssuesRaw])

  const selectedMangaka = useMemo(() => {
    if (!selectedMangakaId) return null
    return mangakaNotes.find((n, i) => (n.id || `m-${i}`) === selectedMangakaId) ?? null
  }, [mangakaNotes, selectedMangakaId])

  // Reply = Revision không có box, có marker [[reply:<id>]] trong description
  const tantouReplies = useMemo(() => {
    if (!Array.isArray(pageIssuesRaw)) return []
    return pageIssuesRaw
      .filter(i => issueType(i) === TANTOU_REVISION_TYPE)
      .map(i => {
        const decoded = decodeReply(issueField(i, 'description', 'description'))
        if (!decoded) return null
        return {
          id: String(issueId(i)),
          parentNoteId: decoded.parentNoteId,
          text: decoded.text,
          author: issueField(i, 'createdByName', 'created_by_name') ?? 'Tantou Editor',
          date: (() => {
            const raw = issueField(i, 'createdat', 'createdAt')
            if (!raw) return ''
            try { return new Date(raw).toLocaleString('vi-VN') } catch { return '' }
          })(),
        }
      })
      .filter(Boolean)
  }, [pageIssuesRaw])

  const selectedNoteReplies = useMemo(() => {
    if (!selectedMangakaId) return []
    return tantouReplies.filter(r => r.parentNoteId === selectedMangakaId)
  }, [tantouReplies, selectedMangakaId])

  async function handleSendReply() {
    const text = replyDraft.trim()
    if (!text || !selectedMangakaId || !currentPageId) {
      toast.error('Vui lòng nhập nội dung phản hồi.')
      return
    }
    try {
      await createIssue.mutateAsync({
        pageid: currentPageId,
        createdById: session?.id ?? session?.userid ?? null,
        assignedToId: null,
        issueType: TANTOU_REVISION_TYPE,
        workCategory: selectedMangaka?.taskType ?? DEFAULT_WORK_CATEGORY,
        boxX: 0, boxY: 0, boxWidth: 0, boxHeight: 0,
        description: encodeReply(selectedMangakaId, text),
        deadline: null,
      })
      setReplyDraft('')
      toast.success('Đã gửi phản hồi.')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Không gửi được phản hồi.')
    }
  }

  async function handleDeleteReply(id) {
    if (!window.confirm('Xóa phản hồi này?')) return
    try {
      await deleteIssue.mutateAsync(id)
      toast.success('Đã xóa phản hồi.')
    } catch {
      toast.error('Không xóa được phản hồi.')
    }
  }

  function getPercent(e, ref) {
    const el = ref?.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  function onBoardMouseDown(e, ref) {
    if (!currentPageId) {
      if (tool === 'draw') toast.error('Chưa có trang để tạo ô nhận xét.')
      return
    }
    if (tool === 'delete') { setSelectedTantouBoxId(null); return }
    if (tool !== 'draw') return
    const pt = getPercent(e, ref)
    setDrawStart(pt)
    setDrawCurrent(pt)
    setSelectedTantouBoxId(null)
    setShowNewBoxPanel(false)
    setTempBox(null)
  }

  function onBoardMouseMove(e, ref) {
    if (!drawStart) return
    setDrawCurrent(getPercent(e, ref))
  }

  function onBoardMouseUp() {
    if (!drawStart || !drawCurrent) return
    const boxX = Math.min(drawStart.x, drawCurrent.x)
    const boxY = Math.min(drawStart.y, drawCurrent.y)
    const w = Math.abs(drawCurrent.x - drawStart.x)
    const h = Math.abs(drawCurrent.y - drawStart.y)
    setDrawStart(null)
    setDrawCurrent(null)
    if (w < 2 || h < 2) return

    setTempBox({ x: boxX, y: boxY, w, h })
    setSelectedTantouBoxId(null)
    setNewBoxDraft('')
    setShowNewBoxPanel(true)
  }

  function onBoxClick(e, bid) {
    e.stopPropagation()
    if (tool === 'delete') {
      handleDeleteBox(bid)
      return
    }
    setSelectedTantouBoxId(bid)
    setSelectedMangakaId(null)
    setTool('select')
  }

  function onMangakaNoteClick(e, mid) {
    e.stopPropagation()
    setSelectedMangakaId(mid)
    setSelectedTantouBoxId(null)
  }

  async function handleCreateBox(x, y, w, h) {
    const text = newBoxDraft.trim()
    if (!text || !currentPageId) {
      toast.error('Vui lòng nhập nội dung nhận xét.')
      return
    }
    try {
      await createIssue.mutateAsync({
        pageid: currentPageId,
        createdById: session?.id ?? session?.userid ?? null,
        assignedToId: null,
        issueType: TANTOU_REVISION_TYPE,
        workCategory: DEFAULT_WORK_CATEGORY,
        boxX: Math.round(x), boxY: Math.round(y), boxWidth: Math.round(w), boxHeight: Math.round(h), description: text,
        deadline: null,
      })
      setNewBoxDraft('')
      setShowNewBoxPanel(false)
      setTempBox(null)
      setTool('draw')
      toast.success('Đã thêm nhận xét.')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Không tạo được nhận xét.')
    }
  }

  async function handleDeleteBox(id) {
    if (!window.confirm('Xóa nhận xét này?')) return
    try {
      await deleteIssue.mutateAsync(id)
      toast.success('Đã xóa nhận xét.')
      setSelectedTantouBoxId(null)
    } catch {
      toast.error('Không xóa được nhận xét.')
    }
  }

  function handleCancelNewBox() {
    setShowNewBoxPanel(false)
    setTempBox(null)
  }

  if (!submission) return null

  const isDebut = submission.pipeline === 'debut'
  const pageImageUrl = currentPage?.pageimageurl ?? currentPage?.url ?? submission.mangakaImageUrl ?? null
  const noPagesAvailable = pages.length === 0 // MỚI: chưa có trang nào để hiển thị/nhận xét

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Danh sách
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{submission.seriesTitle}</h2>
          <p className="text-sm text-muted-foreground">
            Ch. {submission.chapterNum} · {submission.pageLabel}
            {pages.length > 0 ? ` · Trang ${pageIndex + 1}/${pages.length}` : null}
          </p>
        </div>
        <Badge variant={submission.pipeline === 'debut' ? 'destructive' : 'secondary'}>
          {submission.pipeline === 'debut' ? 'Lần đầu · có EB' : 'Đã qua EB'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b bg-muted/30 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Trang truyện</CardTitle>
                <CardDescription>Ô đỏ = Mangaka · Ô xanh = Nhận xét của bạn</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={tool === 'draw' ? 'default' : 'outline'}
                  onClick={e => { e.stopPropagation(); setTool('draw') }}
                  disabled={!currentPageId}
                  className="gap-1"
                >
                  <Square className="size-3.5" />
                  Tạo ô nhận xét
                </Button>
                <Button
                  size="sm"
                  variant={tool === 'select' ? 'default' : 'outline'}
                  onClick={e => { e.stopPropagation(); setTool('select') }}
                >
                  <MousePointer2 className="size-3.5" />
                  Chọn
                </Button>
                <Button
                  size="sm"
                  variant={tool === 'delete' ? 'destructive' : 'outline'}
                  onClick={e => { e.stopPropagation(); setTool(tool === 'delete' ? 'draw' : 'delete') }}
                  className="gap-1"
                >
                  <Eraser className="size-3.5" />
                  Xóa
                </Button>
                {pages.length > 1 && onPageIndexChange ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={pageIndex === 0}
                      onClick={e => { e.stopPropagation(); onPageIndexChange(pageIndex - 1) }}
                    >
                      ‹
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {pageIndex + 1}/{pages.length}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={pageIndex >= pages.length - 1}
                      onClick={e => { e.stopPropagation(); onPageIndexChange(pageIndex + 1) }}
                    >
                      ›
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center bg-zinc-950 p-4 md:p-6">
            {noPagesAvailable ? (
              // MỚI: message rõ ràng khi series/chapter chưa có trang nào,
              // thay vì để board đen kèm toast lỗi gây khó hiểu.
              <div className="flex h-96 w-full items-center justify-center text-center text-sm text-muted-foreground">
                Chưa có trang nào để nhận xét — Mangaka chưa nộp chương này.
              </div>
            ) : (
              <div className="relative w-full max-w-[728px]">
                <div
                  ref={boardRef}
                  className={`mk-board manga-page manga-page--canvas relative mx-auto aspect-[728/1030] bg-zinc-900 select-none border-2 border-zinc-700 rounded ${tool === 'draw' ? 'cursor-crosshair' : tool === 'delete' ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  onMouseDown={e => onBoardMouseDown(e, boardRef)}
                  onMouseMove={e => onBoardMouseMove(e, boardRef)}
                  onMouseUp={onBoardMouseUp}
                  onMouseLeave={onBoardMouseUp}
                >
                  {pageImageUrl ? (
                    <img
                      src={pageImageUrl}
                      alt=""
                      className="mk-board__img manga-page__media absolute inset-0 size-full object-contain pointer-events-none"
                      draggable={false}
                      width={728}
                      height={1030}
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                    />
                  ) : null}

                  {/* Tantou comment boxes */}
                  {tantouBoxes.map((box, idx) => {
                    const bid = box.id || `tb-${idx}`
                    return (
                      <div
                        key={bid}
                        className={`absolute box-border rounded border-2 border-sky-500 bg-sky-500/15 cursor-pointer transition-shadow ${selectedTantouBoxId === bid ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''
                          }`}
                        style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                        onClick={e => onBoxClick(e, bid)}
                        title={box.text || 'Nhận xét của Tantou'}
                      >
                        <span className="absolute left-1 top-0.5 rounded bg-sky-600 px-1 text-[10px] font-bold text-white">
                          T{idx + 1}
                        </span>
                      </div>
                    )
                  })}

                  {/* Mangaka notes (read-only) */}
                  {mangakaNotes.map((n, idx) => {
                    const mid = n.id || `m-${idx}`
                    return (
                      <div
                        key={mid}
                        className={`absolute box-border cursor-pointer rounded border-2 border-dashed border-rose-500 bg-rose-500/15 transition-shadow ${selectedMangakaId === mid ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''
                          }`}
                        style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${n.w}%`, height: `${n.h}%` }}
                        onClick={e => onMangakaNoteClick(e, mid)}
                        title={n.text || 'Ghi chú Mangaka'}
                      >
                        <span className="absolute left-1 top-0.5 rounded bg-rose-600 px-1 text-[10px] font-bold text-white">
                          M{idx + 1}
                        </span>
                      </div>
                    )
                  })}

                  {/* Drawing preview */}
                  {drawStart && drawCurrent && (
                    <div
                      className="absolute border-2 border-dashed border-sky-400 bg-sky-500/20"
                      style={{
                        left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                        top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                        width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                        height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                      }}
                    />
                  )}

                  {tempBox && showNewBoxPanel && (
                    <div
                      className="absolute box-border rounded border-2 border-dashed border-sky-400 bg-sky-500/20 animate-pulse"
                      style={{
                        left: `${tempBox.x}%`,
                        top: `${tempBox.y}%`,
                        width: `${tempBox.w}%`,
                        height: `${tempBox.h}%`,
                      }}
                    >
                      <span className="absolute left-1 top-0.5 rounded bg-sky-500 px-1 text-[10px] font-bold text-white">
                        Mới
                      </span>
                    </div>
                  )}
                </div>

                {/* New box input panel */}
                {showNewBoxPanel && tempBox && (
                  <div className="absolute inset-x-0 bottom-0 bg-background/95 p-4 backdrop-blur">
                    <div className="mx-auto max-w-lg rounded-lg border bg-background p-4 shadow-xl">
                      <h4 className="mb-2 font-medium">Nhận xét cho ô mới</h4>
                      <Textarea
                        rows={3}
                        placeholder="Nhập nhận xét của bạn..."
                        value={newBoxDraft}
                        onChange={e => setNewBoxDraft(e.target.value)}
                        className="mb-3"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelNewBox}
                        >
                          Hủy
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleCreateBox(tempBox.x, tempBox.y, tempBox.w, tempBox.h)}
                          disabled={createIssue.isPending || !newBoxDraft.trim()}
                        >
                          <Send className="size-3" />
                          {createIssue.isPending ? 'Đang gửi...' : 'Tạo nhận xét'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {mangakaNotes.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ghi chú Mangaka</CardTitle>
                <CardDescription>Click vào ô trên trang hoặc danh sách bên dưới để xem chi tiết & nhận xét lại</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <ScrollArea className="max-h-48">
                  <div className="space-y-2 pr-3">
                    {mangakaNotes.map((n, i) => {
                      const mid = n.id || `m-${i}`
                      const replyCount = tantouReplies.filter(r => r.parentNoteId === mid).length
                      return (
                        <button
                          key={mid}
                          type="button"
                          onClick={() => { setSelectedMangakaId(mid); setReplyDraft('') }}
                          className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selectedMangakaId === mid ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="border-rose-200 text-rose-700">
                              M{i + 1}
                            </Badge>
                            {replyCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {replyCount} phản hồi
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-muted-foreground">{n.text || '—'}</p>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>

                {selectedMangaka ? (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-rose-700">{noteTaskLabel(selectedMangaka.taskType)}</p>
                      <p className="text-sm">{selectedMangaka.text || 'Không có mô tả'}</p>
                    </div>

                    {selectedNoteReplies.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Phản hồi của bạn:</p>
                        {selectedNoteReplies.map((reply, idx) => (
                          <div key={reply.id || `r-${idx}`} className="rounded-md bg-background p-2 text-sm">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-sky-600">{reply.author}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{reply.date}</span>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteReply(reply.id)}
                                  title="Xóa phản hồi"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-sm">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Nhận xét lại cho ô này..."
                        value={replyDraft}
                        onChange={e => setReplyDraft(e.target.value)}
                        className="resize-y text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={handleSendReply}
                        disabled={createIssue.isPending || !replyDraft.trim()}
                        className="w-full gap-1"
                      >
                        <Send className="size-3" />
                        {createIssue.isPending ? 'Đang gửi...' : 'Gửi phản hồi'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Chọn 1 ô để xem chi tiết & nhận xét.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-xs text-muted-foreground">
                Trang này chưa có ghi chú nào từ Mangaka.
              </CardContent>
            </Card>
          )}

          {tantouBoxes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nhận xét của bạn ({tantouBoxes.length})</CardTitle>
                <CardDescription>Click vào ô xanh trên trang để xem chi tiết</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {tantouBoxes.map((box, idx) => {
                  const bid = box.id || `tb-${idx}`
                  return (
                    <button
                      key={bid}
                      type="button"
                      onClick={() => { setSelectedTantouBoxId(bid); setSelectedMangakaId(null) }}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selectedTantouBoxId === bid ? 'border-sky-500 bg-sky-500/5' : 'hover:bg-muted/50'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="border-sky-200 text-sky-700">
                          T{idx + 1}
                        </Badge>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteBox(bid) }}
                        >
                          <Trash2 className="size-3" />
                          Xóa
                        </Button>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{box.text || '—'}</p>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {actionsMode === 'studio' ? (
            // Studio mode: chapter actions
            <div className="page-container flex flex-wrap items-center justify-end gap-2 py-3">
              {onChapterRequestRevision && (
                <Button
                  variant="outline"
                  onClick={() => onChapterRequestRevision('')}
                  className="gap-2 h-8 mr-auto"
                >
                  <XCircle className="size-4" />
                  Yêu cầu sửa
                </Button>
              )}
              {onChapterForwardEb && (
                <Button
                  variant="secondary"
                  onClick={onChapterForwardEb}
                  className="gap-2 h-8"
                >
                  <Send className="size-4" />
                  Chuyển EB chấm
                </Button>
              )}
              {/* Tantou chỉ được gửi EB, không duyệt trực tiếp */}
            </div>
          ) : (
            // EB/debut review mode
            <div className="page-container flex flex-wrap items-center justify-end gap-2 py-3">
              {isDebut && (
                <Button
                  variant="outline"
                  onClick={onRequestRevision ?? (() => {})}
                  className="gap-2"
                >
                  <XCircle className="size-4" />
                  Yêu cầu chỉnh sửa
                </Button>
              )}

              {/* Tantou: gửi recurring chapter cho EB xem, không duyệt trực tiếp */}
              <Button onClick={isDebut ? (onForwardEb ?? (() => {})) : (onChapterForwardEb ?? (() => {}))} className="gap-2">
                <CheckCircle2 className="size-4" />
                {isDebut ? 'Chấp nhận' : 'Gửi EB xem'}
              </Button>
            </div>
          )}
      </div>
    </div>
  )
}