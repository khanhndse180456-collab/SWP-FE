import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Gavel, Loader2, Search, X, XCircle, ClipboardList } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { getSession, logout } from "@/lib/auth.js";
import { placeholderPageDataUrl } from "@/utils/assistantWorkspaceStorage.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import { SCORE_MAX } from "@/constants/eb.js";
import { useEbWorkspace } from "@/hooks/useEbWorkspace.js";
import { getClassification } from "@/pages/User/Eb/Eb.helpers.js";
import { CouncilScoresTable } from "@/components/User/Eb/CouncilScoresTable.jsx";
import { ScoreFieldCard } from "@/components/User/Eb/ScoreFieldCard.jsx";
import { ThresholdTable } from "@/components/User/Eb/ThresholdTable.jsx";
import "./Eb.css";

const SIDEBAR_ITEMS = [
  { id: 'queue',  label: 'Chấm điểm',     icon: Gavel },
  { id: 'rubric', label: 'Quy chế chấm',  icon: ClipboardList },
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
    handleApprove,
    handleReject,
    getQueueAssessment,
    publishFormatDialog,
    setPublishFormatDialog,
    selectedPublishFormat,
    setSelectedPublishFormat,
  } = useEbWorkspace();

  function handleLogout() { logout(); navigate("/login"); }

  const [tab, setTab] = useState("queue");
  const [queueSearch, setQueueSearch] = useState("");

  const filteredPending = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(p => {
      const title = (p.title ?? p.series_title ?? "").toLowerCase();
      const synopsis = (p.synopsis ?? "").toLowerCase();
      return title.includes(q) || synopsis.includes(q);
    });
  }, [pending, queueSearch]);

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

        {tab === "queue" && selectedId && activeSubmission && (() => {
          const assessment = getQueueAssessment(selectedId);
          const notReady = !assessment.isSelected || assessment.scoredCount < assessment.total;
          const title = activeSubmission.title ?? activeSubmission.series_title ?? `Series #${selectedId}`;
          return (
            <div className="flex items-center gap-3 border-b bg-white px-8 py-3 dark:bg-zinc-950">
              <p className="text-sm">
                <span className="text-muted-foreground">Đang chấm:</span>{" "}
                <strong className="text-foreground">{title}</strong>
                {assessment.scoredCount > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({assessment.scoredCount}/{assessment.total} đã chấm)
                  </span>
                )}
              </p>
              <div className="ml-auto flex items-center gap-2">
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
                  onClick={() => handleApprove(selectedId, title)}
                  disabled={notReady}
                  title={notReady ? "Cần chấm đủ điểm trước khi duyệt" : undefined}
                >
                  <CheckCircle2 className="size-4" />Chấp nhận
                </Button>
              </div>
            </div>
          );
        })()}

        <main className="flex-1 overflow-y-auto p-8">
          {tab === "queue" && (
          <div className="space-y-6">
              <Card>
                <CardHeader className="space-y-2">
                  <CardTitle>Nhập điểm (tài khoản đại diện)</CardTitle>
                  <CardDescription>Chọn series trong hàng chờ, chọn thành viên, nhập điểm rồi Lưu.</CardDescription>
                </CardHeader>
            <CardContent className="space-y-6">
              {/* Banner đại diện */}
              <div className="eb-rep-banner rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Tài khoản đại diện: <span className="text-primary">{user?.name ?? "Thư ký Hội đồng"}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Chọn thành viên HĐ, nhập điểm thay họ, rồi lưu — có thể lần lượt nhập cho từng người trong cùng series.</p>
              </div>

              {/* Series */}
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

              {/* Thành viên */}
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
                          {members.map((member, idx) => (
                            <SelectItem key={member.id ?? idx} value={member.id}>
                              {member.name}{member.hasEvaluated ? " · đã chấm ✓" : " · chưa chấm"}
                            </SelectItem>
                          ))}
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

              {/* Bảng điểm HĐ */}
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

              {/* Score fields */}
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

              {/* Nhận xét chung */}
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

              {/* DTB tổng hợp */}
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

              {/* Sticky save bar */}
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
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Ảnh series từ Tantou</CardTitle>
              <CardDescription>Hình preview của series đang được chấm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-muted/30">
                <img
                  src={activeSeriesImage}
                  alt={activeTitle ? `Ảnh series ${activeTitle}` : "Ảnh series đang chấm"}
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Tantou gửi sang EB</Badge>
                  {activeSubmission?.agerating && <Badge variant="outline">{activeSubmission.agerating}</Badge>}
                  {activeSubmission?.publishformat && <Badge variant="outline">{activeSubmission.publishformat}</Badge>}
                </div>
                <p className="text-sm font-medium text-foreground">{activeTitle || "Chưa có series trong hàng chờ"}</p>
                <p className="text-sm text-muted-foreground">
                  {activeSubmission?.synopsis
                    ? <span className="line-clamp-3">{activeSubmission.synopsis}</span>
                    : "Ảnh lấy từ submission Tantou hoặc ảnh thay thế nếu chưa có."}
                </p>
              </div>
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

      {/* Publish Format Dialog */}
      {publishFormatDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-xl space-y-4 mx-4">
            <h3 className="text-base font-semibold">Chọn định dạng phát hành</h3>
            <p className="text-sm text-muted-foreground">
              Tác phẩm "{publishFormatDialog.title}" đạt yêu cầu. Chọn định dạng phát hành:
            </p>
            <div className="space-y-2">
              <button
                type="button"
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedPublishFormat === "Monthly"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setSelectedPublishFormat("Monthly")}
              >
                <span className="font-medium">📅 Theo tháng (Monthly)</span>
                <p className="text-xs text-muted-foreground mt-0.5">Phát hành 1 chapter/tuần trong tháng</p>
              </button>
              <button
                type="button"
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedPublishFormat === "Weekly"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setSelectedPublishFormat("Weekly")}
              >
                <span className="font-medium">📆 Theo tuần (Weekly)</span>
                <p className="text-xs text-muted-foreground mt-0.5">Phát hành 1 chapter/tuần quanh năm</p>
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={publishFormatDialog.onCancel}>Huỷ</Button>
              <Button onClick={() => publishFormatDialog.onSelect(selectedPublishFormat)}>
                Xác nhận phát hành
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}