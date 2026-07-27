import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Gavel, Loader2, Search, X, XCircle, ClipboardList, Image as ImageIcon, Trophy, History, Pencil, Upload, ChevronLeft, ChevronRight, Library, RefreshCcw } from "lucide-react";
import SidebarNav from "@/components/layout/SidebarNav.jsx";
import WorkspaceTopBar from "@/components/layout/WorkspaceTopBar.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner'
import { Input } from "@/components/ui/input";
import { getSession, logout } from "@/lib/auth.js";
import { placeholderPageDataUrl } from "@/utils/assistantWorkspaceStorage.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import { SCORE_MAX } from "@/constants/eb.js";
import { useEbWorkspace } from "@/hooks/useEbWorkspace.js";
import { getClassification, isSeriesPassing } from "@/pages/User/Eb/Eb.helpers.js";
import { CouncilScoresTable } from "@/components/User/Eb/CouncilScoresTable.jsx";
import { ScoreFieldCard } from "@/components/User/Eb/ScoreFieldCard.jsx";
import { ThresholdTable } from "@/components/User/Eb/ThresholdTable.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog.jsx";
import { useSeriesById, usePages } from "@/api/hooks/useApi.js";
import "./Eb.css";

const SIDEBAR_ITEMS = [
  { id: 'queue',    label: 'Chấm điểm',    icon: Gavel },
  { id: 'chapters', label: 'Duyệt chapter', icon: BookOpen },
  { id: 'series',   label: 'Quản lý Series', icon: Library },
  { id: 'ranking',  label: 'Xếp hạng',     icon: Trophy },
  { id: 'rubric',   label: 'Quy chế chấm', icon: ClipboardList },
  { id: 'image',    label: 'Xem ảnh',      icon: ImageIcon },
  { id: 'history',  label: 'Lịch sử',      icon: History },
];

// Định dạng phát hành hợp lệ (dùng chung cho dialog đổi định dạng & quản lý series)
const FORMAT_OPTIONS = [
  { value: "Weekly",  label: "📆 Theo tuần (Weekly)",   hint: "1 chapter / tuần" },
  { value: "Monthly", label: "📅 Theo tháng (Monthly)", hint: "1 chapter / tháng" },
];

// Nhóm trạng thái dùng cho các Tab lọc ở tab "Quản lý Series". `statuses: null`
// nghĩa là nhóm "Tất cả" — không lọc theo trạng thái, dùng chung với dropdown lọc
// chi tiết bên cạnh.
const SERIES_GROUPS = [
  { id: "pending",     label: "Chờ duyệt",     statuses: ["Draft", "EditorReview", "EBReview", "PendingReview"] },
  { id: "publishing",  label: "Chờ xuất bản",  statuses: ["Publishing"] },
  { id: "completed",   label: "Đã hoàn tất",   statuses: ["Completed"] },
  { id: "all",         label: "Tất cả",        statuses: null },
];

export default function Eb() {
  const navigate = useNavigate();
  const user = getSession();

  const {
    pending,
    members,
    loadingQueue,
    loadingMembers,
    saving,
    confirmDialog,
    selectedId,
    setSelectedId,
    activeMemberId,
    setActiveMemberId,
    scores,
    scoreErrors,
    feedback,
    setFeedback,
    scoreFields,
    councilAggregate,
    councilClassification,
    activeMember,
    activeSubmission,
    average,
    updateScore,
    normalizeScoreField,
    handleSaveAssessment,
    requestApprove,
    approveFormatDialog,
    handleReject,
    getQueueAssessment,
    ranking,
    loadingRanking,
    loadRanking,
    importRankings,
    issueRankings,
    loadingIssueRankings,
    currentIssue,
    loadRankingsByIssue,
    ebChapters,
    loadingEbChapters,
    loadEbChapters,
    seriesScores,
    seriesMap,
    handleEbChapterApprove,
    handleEbChapterReject,
    history,
    chapterHistory,
    loadingHistory,
    loadHistory,
    openChangeFormatDialog,
    editFormatDialog,
    // quản lý series
    allSeries,
    loadingAllSeries,
    loadAllSeries,
    savingSeriesEdit,
    updateSeriesInfo,
    updateSeriesStatus,
    updateSeriesFormat,
    handleMarkCompleted,
  } = useEbWorkspace();

  // Lấy chi tiết series (BE có thể trả thêm field tantouComment ở GET /Series/:id
  // dù GET /Series list không trả). Để EB xem được nhận xét Tantou.
  const { data: seriesDetail } = useSeriesById(selectedId);
  const seriesDetailMerged = useMemo(() => {
    if (!activeSubmission) return null;
    if (!seriesDetail) return activeSubmission;
    if (selectedId) {
      // eslint-disable-next-line no-console
      console.log('[EB] GET /Series/' + selectedId + ' →', seriesDetail);
      // eslint-disable-next-line no-console
      console.log('[EB] All keys:', Object.keys(seriesDetail));
      // eslint-disable-next-line no-console
      console.log('[EB] activeSubmission keys:', Object.keys(activeSubmission));
    }
    return { ...activeSubmission, ...seriesDetail };
  }, [activeSubmission, seriesDetail, selectedId]);

  function handleLogout() { logout(); navigate("/login"); }

  const [tab, setTab] = useState("queue");
  const [queueSearch, setQueueSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  const [importIssueNumber, setImportIssueNumber] = useState("");
  const [importIssueYear, setImportIssueYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    if (currentIssue?.issueNumber != null) setImportIssueNumber(String(currentIssue.issueNumber));
    if (currentIssue?.issueYear != null) setImportIssueYear(String(currentIssue.issueYear));
  }, [currentIssue]);

  // Chapter review modal state
  const [reviewChapter, setReviewChapter] = useState(null); // chapter object
  const [reviewPageIndex, setReviewPageIndex] = useState(0);

  // ── Quản lý Series: tìm kiếm / lọc / sửa ──────────────────────────────────
  const [seriesMgmtSearch, setSeriesMgmtSearch] = useState("");
  const [seriesStatusFilter, setSeriesStatusFilter] = useState("all");
  const [seriesGroupTab, setSeriesGroupTab] = useState("pending");
  const [editingSeries, setEditingSeries] = useState(null); // series object đang sửa

  const handleImportClick = () => {
    const issueNumber = Number(importIssueNumber);
    const issueYear = Number(importIssueYear);
    if (!issueNumber || issueNumber < 1 || issueNumber > 53) {
      toast.error("Issue Number phải từ 1 đến 53.");
      return;
    }
    if (!issueYear || issueYear < 2000) {
      toast.error("Vui lòng nhập Issue Year hợp lệ.");
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const issueNumber = Number(importIssueNumber);
    const issueYear = Number(importIssueYear);

    if (!issueNumber || issueNumber < 1 || issueNumber > 53) {
      toast.error("Issue Number phải từ 1 đến 53.");
      e.target.value = '';
      return;
    }
    if (!issueYear || issueYear < 2000) {
      toast.error("Vui lòng nhập Issue Year hợp lệ.");
      e.target.value = '';
      return;
    }

    setImporting(true);
    try {
      await importRankings(file, issueNumber, issueYear);
      toast.success('Import xếp hạng thành công.');
    } catch {
      // toast handled in hook
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab]);

  useEffect(() => {
    if (tab === "chapters") loadEbChapters();
  }, [tab, loadEbChapters]);

  useEffect(() => {
    if (tab === "series") loadAllSeries();
  }, [tab, loadAllSeries]);

  const filteredPending = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(p => {
      const title = (p.title ?? p.series_title ?? "").toLowerCase();
      const synopsis = (p.synopsis ?? "").toLowerCase();
      return title.includes(q) || synopsis.includes(q);
    });
  }, [pending, queueSearch]);

  // Danh sách trạng thái xuất hiện trong dữ liệu thực tế + các trạng thái quyết
  // định thủ công phổ biến (Publishing / Cancelled / Completed) để luôn có sẵn
  // trong bộ lọc.
  const seriesStatusOptions = useMemo(() => {
    const set = new Set(["Publishing", "Cancelled", "Completed"]);
    allSeries.forEach(s => {
      const st = s.status ?? s.Status;
      if (st) set.add(st);
    });
    return Array.from(set).sort();
  }, [allSeries]);

  // Số lượng series theo từng nhóm Tab — hiển thị badge đếm trên mỗi Tab.
  const seriesGroupCounts = useMemo(() => {
    const counts = {};
    SERIES_GROUPS.forEach(g => {
      counts[g.id] = g.statuses
        ? allSeries.filter(s => g.statuses.includes(s.status ?? s.Status ?? "")).length
        : allSeries.length;
    });
    return counts;
  }, [allSeries]);

  const filteredAllSeries = useMemo(() => {
    const q = seriesMgmtSearch.trim().toLowerCase();
    const activeGroup = SERIES_GROUPS.find(g => g.id === seriesGroupTab);
    return allSeries.filter(s => {
      const title = (s.title ?? s.series_title ?? "").toLowerCase();
      const author = (s.authorname ?? s.author ?? "").toLowerCase();
      const status = s.status ?? s.Status ?? "";
      const matchesQuery = !q || title.includes(q) || author.includes(q);
      const matchesGroup = !activeGroup?.statuses || activeGroup.statuses.includes(status);
      // Dropdown lọc chi tiết chỉ áp dụng thêm khi đang ở Tab "Tất cả".
      const matchesStatus = seriesGroupTab !== "all" || seriesStatusFilter === "all" || status === seriesStatusFilter;
      return matchesQuery && matchesGroup && matchesStatus;
    });
  }, [allSeries, seriesMgmtSearch, seriesStatusFilter, seriesGroupTab]);

  function seriesStatusBadgeClass(status) {
    if (status === "Publishing") return "border-blue-200 bg-blue-50 text-blue-700";
    if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "Cancelled") return "border-red-200 bg-red-50 text-red-700";
    return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }

  // BE có thể trả `genre`/`tags` dạng string, object {tag_id, tag_name}, hoặc
  // mảng các object đó — chuẩn hoá về text hiển thị an toàn (tránh crash React
  // "Objects are not valid as a React child").
  function resolveDisplayText(raw) {
    if (raw == null || raw === "") return "—";
    if (typeof raw === "string" || typeof raw === "number") return String(raw);
    const pickName = (item) => {
      if (item == null) return "";
      if (typeof item === "string" || typeof item === "number") return String(item);
      return item.tag_name ?? item.tagName ?? item.name ?? item.Name ?? item.label ?? "";
    };
    if (Array.isArray(raw)) {
      const names = raw.map(pickName).filter(Boolean);
      return names.length ? names.join(", ") : "—";
    }
    if (typeof raw === "object") {
      const name = pickName(raw);
      return name || "—";
    }
    return "—";
  }

  const activeTitle = activeSubmission?.title ?? activeSubmission?.series_title ?? "";
  const activeSeriesImage =
    activeSubmission?.cover_image_url ??
    activeSubmission?.coverimageurl ??
    activeSubmission?.coverImageUrl ??
    activeSubmission?.manga_image_url ??
    placeholderPageDataUrl(activeTitle || "Chưa chọn series");

  return (
    <div className="ws-page--eb flex min-h-screen bg-slate-900/5 dark:bg-zinc-950">
      {/* Sidebar menu — đồng bộ y hệt Mangaka */}
      <SidebarNav
        logoIcon={BookOpen}
        appName="MangaPublish"
        items={SIDEBAR_ITEMS}
        activeId={tab}
        onSelect={setTab}
        onLogout={user ? handleLogout : undefined}
        accentClass="bg-emerald-600 text-white"
      />

      {/* Panel Hàng chờ duyệt — ngay cạnh sidebar, scroll riêng */}
      <aside className="flex w-80 shrink-0 flex-col border-r bg-white dark:bg-zinc-950">
        <div className="flex h-16 items-center justify-between gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Gavel className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Hàng chờ duyệt
            </h2>
          </div>
          <Badge variant="secondary" className="text-[11px]">{pending.length}</Badge>
        </div>

        {!loadingQueue && pending.length > 0 && (
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Tìm theo tên series..."
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                className="h-9 pl-8 pr-8 text-sm"
              />
              {queueSearch && (
                <button
                  type="button"
                  onClick={() => setQueueSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {loadingQueue ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-8 text-sm text-zinc-500 dark:border-zinc-800">
              <Loader2 className="size-4 animate-spin" />Đang tải…
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
              {pending.length === 0
                ? "Chưa có series nào chờ duyệt."
                : "Không tìm thấy series khớp."}
            </div>
          ) : (
            filteredPending.map((p, idx) => {
              const id = p._resolvedId;
              const title = p.title ?? p.series_title ?? `Series #${id}`;
              const assessment = getQueueAssessment(id);
              const isActive = id === selectedId;
              return (
                <button
                  key={id ?? idx}
                  type="button"
                  onClick={() => { setSelectedId(id); setTab("queue"); }}
                  className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm dark:bg-primary/10"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  }`}
                >
                  {(p.coverimageurl || p.cover_image_url) ? (
                    <img
                      src={p.coverimageurl ?? p.cover_image_url}
                      alt=""
                      className="size-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                      isActive ? "bg-primary/15 text-primary" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {(title?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={`line-clamp-1 text-xs font-semibold ${
                      isActive ? "text-primary" : "text-zinc-900 dark:text-zinc-100"
                    }`}>
                      {title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {p.status ?? p.Status ?? "EBReview"}
                      </Badge>
                      {assessment.isSelected && assessment.scoredCount > 0 ? (
                        <Badge variant="secondary" className={`border px-1.5 py-0 text-[10px] ${assessment.classification.className}`}>
                          {assessment.scoredCount}/{assessment.total} · {assessment.classification.label}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          Chưa chấm
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopBar
          user={user}
          onLogout={user ? handleLogout : undefined}
          titleSlot={
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{LABEL_EDITOR_BOARD} · Hội đồng</p>
              <h1 className="text-base font-bold tracking-tight">
                Xin chào{user?.name ? `, ${user.name}` : ""}
              </h1>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto p-8">
          {tab === "queue" && (
          <div className="space-y-6">
              <Card>
                <CardHeader className="space-y-2">
                  <CardTitle>
                    Nhập điểm{user?.name ? ` — ${user.name}` : " (tài khoản đại diện)"}
                  </CardTitle>
                  <CardDescription>Chọn series trong hàng chờ, chọn thành viên, nhập điểm rồi Lưu.</CardDescription>
                </CardHeader>
            <CardContent className="space-y-6">
              {(() => {
                const source = seriesDetailMerged ?? activeSubmission;
                const last =
                  source?.tantouComment ??
                  source?.tantoucomment ??
                  source?.TantouComment ??
                  source?.editorialComment ??
                  source?.EditorialComment ??
                  source?.comment ??
                  source?.Comment ??
                  source?.lastTantouComment ??
                  "";
                if (!last) return null;
                const author =
                  source?.tantouName ??
                  source?.tantouEditorName ??
                  source?.tantouEditor ??
                  "Tantou";
                const at =
                  source?.tantouCommentAt ??
                  source?.editorialCommentAt ??
                  source?.CommentAt ??
                  null;
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                        Nhận xét từ Tantou
                      </p>
                      {at && (
                        <span className="text-[11px] text-amber-700">
                          {new Date(at).toLocaleString("vi-VN")}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-amber-900">{last}</p>
                    <p className="mt-2 text-[11px] text-amber-700">— {author}</p>
                  </div>
                );
              })()}

              <div className="eb-rep-banner rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Tài khoản đại diện: <span className="text-primary">{user?.name ?? "Thư ký Hội đồng"}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Chọn thành viên HĐ, nhập điểm thay họ, rồi lưu — có thể lần lượt nhập cho từng người trong cùng series.</p>
              </div>

              <div className="space-y-2">
                <Label>Series đang chấm</Label>
                {loadingQueue
                  ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Đang tải hàng chờ…</div>
                  : (
                    <Select
                      value={selectedId ?? ""}
                      onValueChange={v => setSelectedId(v)}
                      disabled={pending.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={pending.length ? "Chọn series trong hàng chờ" : "Chưa có series chờ EB duyệt"} />
                      </SelectTrigger>
                      <SelectContent>
                        {pending.map((item, idx) => {
                          const id = item._resolvedId;
                          const label = item.title ?? item.series_title ?? `Series #${id}`;
                          return (
                            <SelectItem key={id ?? idx} value={id}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
              </div>

              <div className="space-y-2">
                <Label>Thành viên đang nhập điểm</Label>
                {loadingMembers
                  ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Đang tải danh sách Hội đồng…</div>
                  : members.length === 0
                    ? <p className="text-sm text-muted-foreground">Không có thành viên Hội đồng nào.</p>
                    : (
                      <Select value={activeMemberId} onValueChange={setActiveMemberId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn thành viên Hội đồng" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member, idx) => {
                            const isActive = member.id === activeMemberId;
                            return (
                              <SelectItem key={member.id ?? idx} value={member.id}>
                                {member.name}
                                {member.hasEvaluated
                                  ? " · đã chấm ✓"
                                  : isActive
                                    ? " · đang nhập"
                                    : " · chưa chấm"}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                {activeMember && (
                  <p className="text-xs text-muted-foreground">
                    {activeMember.title} — DTB cá nhân tạm tính:{" "}
                    <strong className="text-foreground">{average.toFixed(1)}</strong>
                    {(() => {
                      const memberClassify = getClassification(average);
                      return (
                        <Badge variant="secondary" className={`ml-2 text-[10px] border ${memberClassify.className}`}>
                          {memberClassify.label}
                        </Badge>
                      );
                    })()}
                    {activeMember.hasEvaluated && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-emerald-200 text-emerald-700">Đã chấm</Badge>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Điểm các thành viên Hội đồng</h3>
                  <p className="text-xs text-muted-foreground">
                    {loadingMembers ? "Đang tải điểm…" : "Hiển thị điểm đã lưu của từng thành viên và trung bình chung."}
                  </p>
                </div>
                {loadingMembers
                  ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Đang tải…</div>
                  : (
                    <CouncilScoresTable
                      memberRows={councilAggregate.memberRows}
                      scoreFields={scoreFields}
                      criterionAverages={councilAggregate.criterionAverages}
                      councilAverage={councilAggregate.councilAverage}
                      scoredCount={councilAggregate.scoredCount}
                      activeMemberId={activeMemberId}
                    />
                  )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {scoreFields.map((field, idx) => {
                  const isLastOdd = idx === scoreFields.length - 1 && scoreFields.length % 2 === 1;
                  return (
                    <div key={field.key} className={isLastOdd ? "md:col-span-2" : ""}>
                      <ScoreFieldCard
                        field={field}
                        score={scores[field.key]}
                        error={scoreErrors[field.key]}
                        onScoreChange={val => updateScore(field.key, val)}
                        onBlur={() => normalizeScoreField(field.key)}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Nhận xét chung cho series</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Nhận xét tổng quan của Hội đồng về series này..."
                  className="min-h-28"
                />
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">DTB Hội đồng (tổng hợp)</p>
                <div className="flex items-end justify-between gap-3">
                  <div className="text-4xl font-bold tracking-tight text-foreground">{councilAggregate.councilAverage.toFixed(1)}</div>
                  <Badge variant="outline">/ {SCORE_MAX}.0</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {councilAggregate.scoredCount}/{members.length} thành viên đã chấm
                  {activeMember && <> · Đang nhập cho <strong className="text-foreground">{activeMember.name}</strong> (DTB {average.toFixed(1)})</>}
                </p>
                <Badge variant="secondary" className={`border ${councilClassification.className}`}>{councilClassification.label}</Badge>
                <p className="text-sm text-muted-foreground">{councilClassification.note}</p>
                <ThresholdTable />
              </div>

              <div className="sticky bottom-4 z-10">
                <div className="flex items-center gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-md backdrop-blur">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activeMember?.name ?? "Chọn thành viên"}{" · "}
                      <span className="text-muted-foreground">DTB cá nhân</span>{" "}{average.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      DTB HĐ: <strong className="text-foreground">{councilAggregate.councilAverage.toFixed(1)}</strong>{" · "}
                      <Badge variant="secondary" className={`border text-[10px] py-0 px-1.5 ${councilClassification.className}`}>{councilClassification.label}</Badge>
                    </p>
                  </div>
                  <Button
                    onClick={handleSaveAssessment}
                    disabled={saving || !activeMemberId || !selectedId}
                    className="shrink-0"
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {activeMember?.hasEvaluated ? "Cập nhật điểm" : "Lưu điểm"}
                  </Button>
                </div>
                {(() => {
                  if (!selectedId || !activeSubmission) return null
                  const assessment = getQueueAssessment(selectedId)
                  const title = activeSubmission.title ?? activeSubmission.series_title ?? `Series #${selectedId}`
                  const notReady = !assessment.isSelected || assessment.scoredCount < assessment.total
                  return (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                      <p className="mr-auto text-sm text-muted-foreground">
                        <span>Đang chấm:</span>{" "}
                        <strong className="text-foreground">{title}</strong>
                        {assessment.scoredCount > 0 && (
                          <span className="ml-2 text-xs">
                            ({assessment.scoredCount}/{assessment.total} đã chấm)
                          </span>
                        )}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleReject(selectedId, title)}
                        disabled={notReady}
                        title={notReady ? "Cần chấm đủ điểm trước khi duyệt" : undefined}
                      >
                        <XCircle className="size-4" />Từ chối
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => requestApprove(selectedId, title)}
                        disabled={notReady}
                        title={notReady ? "Cần chấm đủ điểm trước khi duyệt" : undefined}
                      >
                        <CheckCircle2 className="size-4" />Chấp nhận
                      </Button>
                    </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          </div>
          )}

          {tab === "series" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Library className="size-5 text-primary" />
                    <CardTitle>Quản lý Series</CardTitle>
                  </div>
                  <CardDescription>
                    Xem toàn bộ series theo trạng thái, sửa thông tin cơ bản, đổi trạng thái / định dạng phát hành thủ công, hoặc đánh dấu series đã xuất bản xong.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tab lọc theo nhóm trạng thái */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                    {SERIES_GROUPS.map(g => {
                      const isActive = seriesGroupTab === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSeriesGroupTab(g.id)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
                          }`}
                        >
                          {g.label}
                          <Badge
                            variant="secondary"
                            className={`px-1.5 py-0 text-[10px] ${isActive ? "bg-primary/15 text-primary" : ""}`}
                          >
                            {seriesGroupCounts[g.id] ?? 0}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
                      <Input
                        placeholder="Tìm theo tên series hoặc tác giả..."
                        value={seriesMgmtSearch}
                        onChange={e => setSeriesMgmtSearch(e.target.value)}
                        className="h-9 pl-8 pr-8 text-sm"
                      />
                      {seriesMgmtSearch && (
                        <button
                          type="button"
                          onClick={() => setSeriesMgmtSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                    {seriesGroupTab === "all" && (
                      <Select value={seriesStatusFilter} onValueChange={setSeriesStatusFilter}>
                        <SelectTrigger className="h-9 w-48 text-sm">
                          <SelectValue placeholder="Lọc theo trạng thái" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả trạng thái</SelectItem>
                          {seriesStatusOptions.map(st => (
                            <SelectItem key={st} value={st}>{st}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" variant="outline" onClick={loadAllSeries} disabled={loadingAllSeries}>
                      {loadingAllSeries ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                      Tải lại
                    </Button>
                  </div>

                  {loadingAllSeries ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />Đang tải danh sách series…
                    </div>
                  ) : filteredAllSeries.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-10 text-center text-sm text-muted-foreground dark:border-zinc-800">
                      {allSeries.length === 0 ? "Chưa có series nào trong hệ thống." : "Không tìm thấy series khớp bộ lọc."}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border dark:border-zinc-800">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Series</th>
                            <th className="px-3 py-2 text-left">Tác giả</th>
                            <th className="px-3 py-2 text-left">Thể loại</th>
                            <th className="px-3 py-2 text-center">Trạng thái</th>
                            <th className="px-3 py-2 text-center">Định dạng</th>
                            <th className="px-3 py-2 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAllSeries.map((s) => {
                            const sid = s._resolvedId;
                            const title = s.title ?? s.series_title ?? s.Title ?? `Series #${sid}`;
                            const author = resolveDisplayText(
                              s.authorname ?? s.author_name ?? s.authorName ?? s.Authorname ??
                              s.author ?? s.Author ?? s.mangakaName ?? s.mangaka_name ??
                              s.mangakaname ?? s.creatorName ?? s.penName
                            );
                            const genre = resolveDisplayText(
                              s.genre ?? s.Genre ?? s.category ?? s.Category ??
                              s.genreName ?? s.genre_name ?? s.tags ?? s.Tags
                            );
                            const status = s.status ?? s.Status ?? "—";
                            const format = s.publishformat ?? s.Publishformat ?? s.publishFormat ?? "—";
                            const cover = s.coverimageurl ?? s.cover_image_url ?? s.coverImageUrl;
                            const isCancelled = status === "Cancelled";
                            const isCompleted = status === "Completed";
                            const isLocked = isCancelled || isCompleted;
                            const isPublishing = status === "Publishing";
                            return (
                              <tr key={sid} className="border-t align-top dark:border-zinc-800">
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2.5">
                                    {cover ? (
                                      <img src={cover} alt="" className="size-9 shrink-0 rounded object-cover" />
                                    ) : (
                                      <div className="flex size-9 shrink-0 items-center justify-center rounded bg-zinc-100 text-xs font-semibold text-zinc-500 dark:bg-zinc-800">
                                        {(title?.[0] ?? "?").toUpperCase()}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => { setSelectedId(sid); setTab("queue"); }}
                                        className="line-clamp-1 text-left font-medium text-foreground hover:text-primary hover:underline"
                                        title="Mở series này trong tab Chấm điểm"
                                      >
                                        {title}
                                      </button>
                                      <p className="text-[11px] text-muted-foreground">#{sid}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-muted-foreground">{author}</td>
                                <td className="px-3 py-3 text-muted-foreground">{genre}</td>
                                <td className="px-3 py-3 text-center">
                                  {isLocked ? (
                                    <Badge variant="secondary" className={`border text-[11px] ${seriesStatusBadgeClass(status)}`}>
                                      {status}
                                    </Badge>
                                  ) : (
                                    <Select
                                      value={status}
                                      onValueChange={(v) => updateSeriesStatus(sid, v)}
                                    >
                                      <SelectTrigger className={`h-7 w-auto min-w-[110px] border px-2 text-[11px] ${seriesStatusBadgeClass(status)}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from(new Set([status, ...seriesStatusOptions])).map(st => (
                                          <SelectItem key={st} value={st}>{st}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {isLocked ? (
                                    <span className="text-[11px] text-muted-foreground">{format !== "—" ? format : "—"}</span>
                                  ) : (
                                    <Select
                                      value={format !== "—" ? format : ""}
                                      onValueChange={(v) => updateSeriesFormat(sid, v)}
                                    >
                                      <SelectTrigger className="h-7 w-auto min-w-[110px] px-2 text-[11px]">
                                        <SelectValue placeholder="Chưa đặt" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {FORMAT_OPTIONS.map(opt => (
                                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-right">
                                  {isCancelled ? (
                                    <span className="text-[11px] text-muted-foreground italic">Đã hủy — không thể sửa</span>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      {isPublishing && (
                                        <Button
                                          size="sm"
                                          className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                                          onClick={() => handleMarkCompleted(sid, title)}
                                          title="Đánh dấu series đã đăng xong lên web"
                                        >
                                          <CheckCircle2 className="size-3.5" />
                                          Hoàn tất
                                        </Button>
                                      )}
                                      {!isCompleted && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1"
                                          onClick={() => setEditingSeries(s)}
                                        >
                                          <Pencil className="size-3.5" />
                                          Sửa
                                        </Button>
                                      )}
                                      {isCompleted && (
                                        <span className="text-[11px] text-muted-foreground italic">Đã hoàn tất</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "ranking" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-5 text-amber-500" />
                    <CardTitle>Bảng xếp hạng series</CardTitle>
                  </div>
                  <CardDescription>
                    Xếp hạng các series đã được Hội đồng chấp nhận (đủ 5/5 lượt chấm, status = Publishing) theo điểm trung bình Hội đồng giảm dần.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRanking ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />Đang tải bảng xếp hạng…
                    </div>
                  ) : ranking.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-10 text-center text-sm text-muted-foreground dark:border-zinc-800">
                      Chưa có series được chấp nhận — chấm đủ 5/5 điểm rồi nhấn Chấp nhận để đưa series vào bảng xếp hạng.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border dark:border-zinc-800">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-center w-16">Hạng</th>
                            <th className="px-3 py-2 text-left">Series</th>
                            <th className="px-3 py-2 text-center w-40">Điểm trung bình HĐ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ranking.map((row, idx) => {
                            const rankIcon =
                              idx === 0 ? "🥇" :
                              idx === 1 ? "🥈" :
                              idx === 2 ? "🥉" :
                              <span className="text-xs text-muted-foreground">#{idx + 1}</span>;
                            return (
                              <tr key={row.seriesId} className="border-t dark:border-zinc-800">
                                <td className="px-3 py-3 text-center text-base">{rankIcon}</td>
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedId(row.seriesId); setTab("queue"); }}
                                    className="text-left font-medium text-foreground hover:text-primary hover:underline"
                                    title="Mở series này trong tab Chấm điểm"
                                  >
                                    {row.title}
                                  </button>
                                  {row.author && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">Tác giả: {row.author}</p>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className="text-base font-bold text-foreground tabular-nums">
                                    {row.councilAverage.toFixed(2)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!loadingRanking && (
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="import-issue-number" className="text-xs text-muted-foreground whitespace-nowrap">
                          Kỳ (1-53)
                        </Label>
                        <Input
                          id="import-issue-number"
                          type="number"
                          placeholder="Kỳ"
                          value={importIssueNumber}
                          onChange={e => setImportIssueNumber(e.target.value)}
                          className="h-9 w-20 text-sm"
                          min={1}
                          max={53}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="import-issue-year" className="text-xs text-muted-foreground whitespace-nowrap">
                          Năm
                        </Label>
                        <Input
                          id="import-issue-year"
                          type="number"
                          placeholder="Năm"
                          value={importIssueYear}
                          onChange={e => setImportIssueYear(e.target.value)}
                          className="h-9 w-24 text-sm"
                        />
                      </div>
                      <Button size="sm" variant="outline" onClick={handleImportClick} disabled={importing}>
                        {importing ? <Loader2 className="size-4" /> : <Upload className="size-4" />}
                        {importing ? 'Đang import...' : 'Import Excel'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={loadRanking}>
                        <Loader2 className="size-4" />Tải lại
                      </Button>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleImportFile}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Xếp hạng theo kỳ (vote độc giả)</CardTitle>
                      <CardDescription>
                        {currentIssue
                          ? <>Kỳ {currentIssue.issueNumber}/{currentIssue.issueYear} — dữ liệu vote đã import.</>
                          : "Chưa có dữ liệu — import Excel hoặc nhập Kỳ/Năm rồi bấm Xem."}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadRankingsByIssue(Number(importIssueYear), Number(importIssueNumber))}
                        disabled={loadingIssueRankings}
                      >
                        {loadingIssueRankings ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
                        Xem kỳ {importIssueNumber || "?"}/{importIssueYear || "?"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingIssueRankings ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />Đang tải…
                    </div>
                  ) : issueRankings.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-10 text-center text-sm text-muted-foreground dark:border-zinc-800">
                      Chưa có dữ liệu xếp hạng cho kỳ này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border dark:border-zinc-800">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-center w-16">Hạng</th>
                            <th className="px-3 py-2 text-left">Series</th>
                            <th className="px-3 py-2 text-center w-28">Vote</th>
                            <th className="px-3 py-2 text-center w-32">Bottom rank</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issueRankings.map((row, idx) => (
                            <tr key={row.rankingId ?? `${row.seriesId ?? "row"}-${idx}`} className="border-t dark:border-zinc-800">
                              <td className="px-3 py-3 text-center text-base">
                                {row.rankPosition === 1 ? "🥇" : row.rankPosition === 2 ? "🥈" : row.rankPosition === 3 ? "🥉" : `#${row.rankPosition ?? "-"}`}
                              </td>
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => { setSelectedId(String(row.seriesId)); setTab("queue"); }}
                                  className="text-left font-medium text-foreground hover:text-primary hover:underline"
                                >
                                  {row.seriesTitle}
                                </button>
                              </td>
                              <td className="px-3 py-3 text-center font-semibold tabular-nums">{row.voteCount}</td>
                              <td className="px-3 py-3 text-center">
                                {row.isBottomRank ? (
                                  <Badge variant="destructive" className="text-[10px]">Bottom rank</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "rubric" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quy chế chấm điểm</CardTitle>
                  <CardDescription>
                    Mỗi series được chấm trên 4 tiêu chí chính + đổ màu (nếu là bản màu). Thang điểm 0–10.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ThresholdTable />
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "image" && (
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Xem ảnh series</CardTitle>
                  <CardDescription>
                    {activeTitle
                      ? <>Ảnh preview của <strong className="text-foreground">{activeTitle}</strong> — series đang chọn ở hàng chờ.</>
                      : "Chọn một series ở hàng chờ bên trái để xem ảnh."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="mx-auto flex max-h-[70vh] w-fit items-center justify-center overflow-hidden rounded-2xl border bg-muted/30">
                    <img
                      src={activeSeriesImage}
                      alt={activeTitle ? `Ảnh series ${activeTitle}` : "Ảnh series đang chấm"}
                      className="max-h-[70vh] w-auto object-contain"
                    />
                  </div>
                  {activeSubmission?.synopsis && (
                    <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
                      {activeSubmission.synopsis}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "chapters" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-4 text-primary" />
                    Duyệt chapter
                  </CardTitle>
                  <CardDescription>Chỉ hiển thị chapters của series đã có điểm EB và đạt threshold (≥5).</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingEbChapters ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Đang tải...
                    </div>
                  ) : ebChapters.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                      <BookOpen className="size-6 opacity-60" />
                      <p>Không có chapter nào chờ duyệt.</p>
                      <p className="text-xs">Hãy chấm điểm Series ở tab "Chấm điểm" trước.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {(() => {
                        const grouped = {};
                        ebChapters.forEach((chapter) => {
                          const sid = String(chapter.seriesid ?? chapter.series_id ?? "");
                          const seriesInfo = seriesMap[sid];
                          const seriesName = seriesInfo?.title
                            ?? seriesInfo?.series_title
                            ?? seriesInfo?.SeriesTitle
                            ?? chapter.seriesTitle
                            ?? chapter.series_title
                            ?? `Series #${sid}`;
                          if (!grouped[sid]) {
                            grouped[sid] = {
                              seriesTitle: seriesName,
                              seriesId: sid,
                              seriesScore: seriesScores[sid] ?? null,
                              chapters: [],
                            };
                          }
                          grouped[sid].chapters.push(chapter);
                        });
                        Object.values(grouped).forEach(g => {
                          g.chapters.sort((a, b) => (a.chapternumber ?? 0) - (b.chapternumber ?? 0));
                        });
                        return Object.values(grouped);
                      })().map((group) => {
                        const isPassing = group.seriesScore != null && isSeriesPassing(group.seriesScore);
                        return (
                          <div key={group.seriesId} className="rounded-lg border bg-card">
                            <div className="flex items-center justify-between border-b px-4 py-3">
                              <div>
                                <p className="font-semibold">{group.seriesTitle}</p>
                                <p className="text-xs text-muted-foreground">Series #{group.seriesId}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {group.seriesScore != null ? (
                                  <Badge variant={isPassing ? "default" : "destructive"} className="text-sm">
                                    ⭐ {group.seriesScore.toFixed(1)}/10
                                    {isPassing ? " · Đạt" : " · Không đạt"}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-sm">
                                    ⏳ Chưa có điểm
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="divide-y">
                              {group.chapters.map((chapter) => {
                                const chapterId = chapter.chapterid ?? chapter.id;
                                const chapterNum = chapter.chapternumber ?? "?";
                                const title = chapter.title ?? `Chapter ${chapterNum}`;
                                const coverUrl = chapter.coverImageUrl ?? chapter.coverimageurl;
                                const chStatus = String(chapter.status ?? "").toLowerCase();
                                const isReady = chStatus === "ready";
                                return (
                                  <div key={chapterId} className="flex items-start gap-4 p-4">
                                    {coverUrl && (
                                      <img src={coverUrl} alt={title} className="h-16 w-12 rounded object-cover" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{title}</p>
                                      <p className="text-xs text-muted-foreground">Chapter {chapterNum}</p>
                                      <Badge variant="outline" className="mt-1 text-xs">{chapter.status}</Badge>
                                      {!isReady && (
                                        <p className="mt-1 text-xs text-amber-600">
                                          Chưa sẵn sàng — chờ chuyển sang Ready mới duyệt được
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setReviewChapter(chapter);
                                          setReviewPageIndex(0);
                                        }}
                                        className="gap-1"
                                      >
                                        <ImageIcon className="size-4" />
                                        Xem
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleEbChapterApprove(chapterId, title, group.seriesId)}
                                        disabled={!isReady}
                                        title={!isReady ? "Chapter phải ở trạng thái Ready để duyệt" : undefined}
                                        className="gap-1"
                                      >
                                        <CheckCircle2 className="size-4" />
                                        Duyệt
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleEbChapterReject(chapterId, title, group.seriesId)}
                                        className="gap-1"
                                      >
                                        <XCircle className="size-4" />
                                        Từ chối
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    Lịch sử hoạt động
                  </CardTitle>
                  <CardDescription>Timeline hợp nhất: điểm Series + quyết định Chapter — chỉ hiển thị series mà Hội đồng đã ra quyết định (Chấp nhận/Từ chối).</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingHistory ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Đang tải...
                    </div>
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                      <History className="size-6 opacity-60" />
                      <p>Chưa có hoạt động nào.</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {(() => {
                        const seriesMap = new Map();
                        const lookupTitle = (sid) => {
                          const s = seriesMap?.[sid];
                          return s?.title ?? s?.series_title ?? s?.seriesTitle ?? `Series #${sid}`;
                        };
                        // Add series events — đây là nguồn DUY NHẤT quyết định series nào
                        // được hiển thị. Chỉ series đã có quyết định EB (Publishing/Cancelled)
                        // mới xuất hiện trong Lịch sử.
                        history.forEach(item => {
                          const sid = String(item.seriesId);
                          if (!seriesMap.has(sid)) {
                            seriesMap.set(sid, {
                              seriesId: sid,
                              seriesTitle: item.seriesTitle || lookupTitle(sid),
                              seriesScore: item.score,
                              events: [],
                            });
                          } else {
                            const existing = seriesMap.get(sid);
                            if (item.score != null && existing.seriesScore == null) {
                              existing.seriesScore = item.score;
                            }
                          }
                        });
                        // Add chapter events — gộp thành 1 dòng tóm tắt duy nhất.
                        // FIX: chỉ gộp chapter event cho series đã có trong seriesMap
                        // (tức đã được EB chấm điểm/duyệt). Series chưa có quyết định EB
                        // không được tạo entry mới ở đây, dù có chapter Published/Rejected
                        // từ nguồn khác.
                        const chapterByAction = new Map(); // sid → { approve: [], reject: [], latestAt: null }
                        chapterHistory.forEach(item => {
                          const sid = String(item.seriesId ?? item.series_id ?? "");
                          if (!sid) return;
                          if (!seriesMap.has(sid)) return; // series chưa được EB chấm điểm → bỏ qua
                          if (!chapterByAction.has(sid)) {
                            chapterByAction.set(sid, { approve: [], reject: [], latestAt: null });
                          }
                          const agg = chapterByAction.get(sid);
                          const at = item.at || item.createdAt;
                          if (!agg.latestAt || new Date(at) > new Date(agg.latestAt)) {
                            agg.latestAt = at;
                          }
                          if (item.action === "approve" || item.status === "Published") {
                            agg.approve.push(item);
                          } else if (item.action === "reject" || item.status === "Cancelled" || item.status === "RevisionRequested") {
                            agg.reject.push(item);
                          }
                        });
                        chapterByAction.forEach((agg, sid) => {
                          const total = agg.approve.length + agg.reject.length;
                          const parts = [];
                          if (agg.approve.length > 0) parts.push(`${agg.approve.length} đã duyệt`);
                          if (agg.reject.length > 0) parts.push(`${agg.reject.length} từ chối`);
                          seriesMap.get(sid).events.push({
                            id: `chapter-summary-${sid}`,
                            type: "chapter-summary",
                            at: agg.latestAt,
                            chapterApprove: agg.approve.length,
                            chapterReject: agg.reject.length,
                            chapterTotal: total,
                            summary: parts.join(" · "),
                          });
                        });
                        // Sort events by time
                        seriesMap.forEach(group => {
                          group.events.sort((a, b) => new Date(b.at) - new Date(a.at));
                        });
                        return Array.from(seriesMap.values()).sort((a, b) => {
                          const aTime = a.events[0]?.at ? new Date(a.events[0].at) : new Date(0);
                          const bTime = b.events[0]?.at ? new Date(b.events[0].at) : new Date(0);
                          return bTime - aTime;
                        });
                      })().map((group) => {
                        const isPassing = group.seriesScore != null && isSeriesPassing(group.seriesScore);
                        return (
                          <div key={group.seriesId} className="rounded-lg border bg-card">
                            <div className="flex items-center justify-between border-b px-4 py-3">
                              <div>
                                <p className="font-semibold">{group.seriesTitle}</p>
                                <p className="text-xs text-muted-foreground">Series #{group.seriesId}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {group.seriesScore != null ? (
                                  <Badge variant={isPassing ? "default" : "destructive"} className="text-sm">
                                    ⭐ {group.seriesScore.toFixed(1)}/10
                                    {isPassing ? " · Đạt" : " · Không đạt"}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-sm">Chưa chấm điểm</Badge>
                                )}
                              </div>
                            </div>
                            <div className="divide-y">
                              {group.events.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">Chưa có hoạt động</div>
                              ) : (
                                group.events.map((event, idx) => {
                                  const time = new Date(event.at);
                                  const timeLabel = time.toLocaleString("vi-VN", {
                                    hour: "2-digit", minute: "2-digit",
                                    day: "2-digit", month: "2-digit",
                                  });
                                  const isChapter = event.type === "chapter";
                                  const isChapterSummary = event.type === "chapter-summary";
                                  const isApprove = event.action === "approve";
                                  const iconBg = isChapterSummary
                                    ? "bg-emerald-100 text-emerald-600"
                                    : isChapter
                                      ? (isApprove ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")
                                      : (isApprove ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600");
                                  return (
                                    <div key={event.id ?? idx} className="flex items-start gap-4 p-4">
                                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                                        {isChapterSummary ? (
                                          <CheckCircle2 className="size-4" />
                                        ) : isChapter ? (
                                          isApprove ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />
                                        ) : (
                                          isApprove ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium">
                                          {isChapterSummary ? (
                                            <>Chapters đã xử lý: <span className="text-emerald-700">{event.summary}</span></>
                                          ) : isChapter ? (
                                            `Chapter: ${event.chapterTitle ?? `Chapter #${event.chapterId}`}`
                                          ) : (
                                            `Series: ${event.seriesTitle}`
                                          )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {isChapterSummary
                                            ? `Tổng ${event.chapterTotal} chapter`
                                            : isChapter
                                              ? `${isApprove ? "Đã duyệt" : "Đã từ chối"} bởi EB`
                                              : `${isApprove ? "Đã chấp nhận" : "Đã từ chối"}`}
                                        </p>
                                      </div>
                                      <div className="text-right text-xs text-muted-foreground shrink-0">
                                        <p>{timeLabel}</p>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-xl space-y-4 mx-4">
            <p className="text-sm text-foreground leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={confirmDialog.onCancel}>Huỷ</Button>
              <Button
                variant={confirmDialog.danger ? "destructive" : "default"}
                onClick={confirmDialog.onConfirm}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chọn định dạng phát hành ngay khi bấm Chấp nhận */}
      <ApproveFormatDialog dialog={approveFormatDialog} />

      {/* Đổi định dạng phát hành (gọi từ tab Lịch sử) */}
      <ChangeFormatDialog dialog={editFormatDialog} />

      {/* Sửa thông tin series (gọi từ tab Quản lý Series) */}
      <SeriesEditDialog
        series={editingSeries}
        saving={savingSeriesEdit}
        onClose={() => setEditingSeries(null)}
        onSave={async (payload) => {
          const sid = editingSeries._resolvedId;
          const ok = await updateSeriesInfo(sid, payload);
          if (ok) setEditingSeries(null);
        }}
      />

      {/* Modal xem chi tiết chapter */}
      <ChapterReviewModal
        chapter={reviewChapter}
        onClose={() => setReviewChapter(null)}
        onApprove={handleEbChapterApprove}
        onReject={handleEbChapterReject}
      />
    </div>
  );
}

// ── Chapter Review Modal ────────────────────────────────────────────────────
function ChapterReviewModal({ chapter, onClose, onApprove, onReject }) {
  const chapterId = chapter?.chapterid ?? chapter?.id;
  const { data: pages = [], isLoading: pagesLoading } = usePages(chapterId);
  const [pageIndex, setPageIndex] = useState(0);

  if (!chapter) return null;

  const chapterNum = chapter.chapternumber ?? "?";
  const title = chapter.title ?? `Chapter ${chapterNum}`;
  const seriesTitle = chapter.seriesTitle ?? chapter.series_title ?? "—";
  const currentPage = pages[pageIndex];
  const chapterSeriesId = chapter.seriesid ?? chapter.series_id;

  return (
    <Dialog open={!!chapter} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{seriesTitle} — {title}</DialogTitle>
          <DialogDescription>
            Chapter {chapterNum} • {pages.length} trang
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {chapter.tantouComment && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-800 mb-1">📝 Nhận xét của Tantou</p>
              <p className="text-sm text-amber-900">{chapter.tantouComment}</p>
            </div>
          )}

          {pagesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ImageIcon className="size-8 mb-2 opacity-50" />
              <p>Không có trang nào.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex(i => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Trang {pageIndex + 1} / {pages.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={pageIndex >= pages.length - 1}
                  onClick={() => setPageIndex(i => Math.min(pages.length - 1, i + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              {currentPage && (
                <div className="flex justify-center">
                  <img
                    src={currentPage.pageimageurl ?? currentPage.page_image_url}
                    alt={`Page ${pageIndex + 1}`}
                    className="max-h-[60vh] max-w-full object-contain rounded border"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button
            variant="destructive"
            onClick={() => { onReject(chapterId, title, chapterSeriesId); onClose(); }}
          >
            <XCircle className="size-4 mr-1" />
            Từ chối
          </Button>
          <Button
            onClick={() => { onApprove(chapterId, title, chapterSeriesId); onClose(); }}
          >
            <CheckCircle2 className="size-4 mr-1" />
            Chấp nhận
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog chọn định dạng phát hành khi bấm "Chấp nhận" ────────────────────
// Không tự động gán "Monthly" nữa — nhân viên chọn Weekly/Monthly ngay lúc
// duyệt, chọn xong là xác nhận luôn (không cần bấm thêm nút Lưu).
function ApproveFormatDialog({ dialog }) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-xl space-y-4 mx-4">
        <h3 className="text-base font-semibold">Chọn định dạng phát hành</h3>
        <p className="text-sm text-muted-foreground">
          Chấp nhận <strong className="text-foreground">{dialog.title}</strong> — chọn tần suất phát hành cho series này.
        </p>
        <div className="space-y-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
              onClick={() => dialog.onSelect(opt.value)}
            >
              <span className="font-medium">{opt.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={dialog.onCancel}>Huỷ</Button>
        </div>
      </div>
    </div>
  );
}

// ── Dialog đổi định dạng phát hành (mở từ tab Lịch sử) ─────────────────────
function ChangeFormatDialog({ dialog }) {
  const [picked, setPicked] = useState(dialog?.currentFormat || "Weekly");
  useEffect(() => {
    if (dialog) setPicked(dialog.currentFormat || "Weekly");
  }, [dialog]);

  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-xl space-y-4 mx-4">
        <h3 className="text-base font-semibold">Đổi định dạng phát hành</h3>
        <p className="text-sm text-muted-foreground">
          Cập nhật định dạng cho <strong className="text-foreground">{dialog.title}</strong>
          {dialog.currentFormat && (
            <> (hiện đang là <strong className="text-foreground">{dialog.currentFormat}</strong>)</>
          )}.
        </p>
        <div className="space-y-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                picked === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => setPicked(opt.value)}
            >
              <span className="font-medium">{opt.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={dialog.onCancel}>Huỷ</Button>
          <Button
            onClick={() => dialog.onSelect(picked)}
            disabled={!picked || picked === dialog.currentFormat}
          >
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Dialog sửa thông tin series (mở từ tab Quản lý Series) ────────────────
// LƯU Ý: gửi PUT /Series/{id} với các field bên dưới — hãy đối chiếu tên field
// với DTO Update thực tế ở backend (ASP.NET Core) nếu API trả lỗi 400.
function SeriesEditDialog({ series, saving, onClose, onSave }) {
  const [form, setForm] = useState({ title: "", genre: "", authorname: "", coverimageurl: "", synopsis: "" });

  useEffect(() => {
    if (!series) return;
    setForm({
      title: series.title ?? series.series_title ?? "",
      genre: series.genre ?? series.Genre ?? "",
      authorname: series.authorname ?? series.author ?? "",
      coverimageurl: series.coverimageurl ?? series.cover_image_url ?? "",
      synopsis: series.synopsis ?? "",
    });
  }, [series]);

  if (!series) return null;

  function update(key, value) {
    setForm(cur => ({ ...cur, [key]: value }));
  }

  return (
    <Dialog open={!!series} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa thông tin series</DialogTitle>
          <DialogDescription>Series #{series._resolvedId}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="series-title">Tên series</Label>
            <Input id="series-title" value={form.title} onChange={e => update("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="series-genre">Thể loại</Label>
              <Input id="series-genre" value={form.genre} onChange={e => update("genre", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="series-author">Tác giả</Label>
              <Input id="series-author" value={form.authorname} onChange={e => update("authorname", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="series-cover">Link ảnh bìa</Label>
            <Input id="series-cover" value={form.coverimageurl} onChange={e => update("coverimageurl", e.target.value)} placeholder="https://..." />
            {form.coverimageurl && (
              <img src={form.coverimageurl} alt="" className="mt-2 h-24 w-18 rounded object-cover border" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="series-synopsis">Mô tả / Synopsis</Label>
            <Textarea id="series-synopsis" value={form.synopsis} onChange={e => update("synopsis", e.target.value)} className="min-h-24" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Huỷ</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}