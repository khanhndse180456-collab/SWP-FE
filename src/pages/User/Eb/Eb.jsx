import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Gavel, Loader2, Search, X, XCircle } from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
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
import { NAV_LINKS, SCORE_MAX } from "@/constants/eb.js";
import { useEbWorkspace } from "@/hooks/useEbWorkspace.js";
import { getClassification } from "@/pages/User/Eb/Eb.helpers.js";
import { CouncilScoresTable } from "@/components/User/Eb/CouncilScoresTable.jsx";
import { ScoreFieldCard } from "@/components/User/Eb/ScoreFieldCard.jsx";
import { ThresholdTable } from "@/components/User/Eb/ThresholdTable.jsx";
import "./Eb.css";

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
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />
      <WorkspaceHero
        label={`${LABEL_EDITOR_BOARD} · Hội đồng`}
        title={`Xin chào${user?.name ? `, ${user.name}` : ""}`}
        description="Nhập điểm từng thành viên Hội đồng — bảng tổng hợp cập nhật realtime từ API."
        className="ws-hero--eb"
      />

      <main className="page-container flex-1 space-y-8 py-8">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
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

          {/* Ảnh series */}
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
        </section>

        {/* Hàng chờ duyệt */}
        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Gavel className="size-5 text-primary" />Hàng chờ duyệt EB
            </h2>
            <p className="text-sm text-muted-foreground">
              Series đang ở trạng thái EBReview — click để chọn và nhập điểm.
            </p>
          </div>

          {!loadingQueue && pending.length > 0 && (
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên series hoặc mô tả..."
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                className="h-9 pl-8 pr-8 text-sm"
              />
              {queueSearch && (
                <button
                  type="button"
                  onClick={() => setQueueSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {loadingQueue
            ? (
              <Card>
                <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />Đang tải hàng chờ…
                </CardContent>
              </Card>
            )
            : filteredPending.length === 0
              ? (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    {pending.length === 0
                      ? "Không có series trong hàng chờ EB duyệt."
                      : "Không tìm thấy series khớp từ khoá tìm kiếm."}
                  </CardContent>
                </Card>
              )
              : (
                <div className="grid gap-4">
                  {filteredPending.map((p, idx) => {
                    const id = p._resolvedId;
                    const title = p.title ?? p.series_title ?? `Series #${id}`;
                    const assessment = getQueueAssessment(id);
                    const isActive = id === selectedId;
                    const notReady = !assessment.isSelected || assessment.scoredCount < assessment.total;
                    const lockReason = !assessment.isSelected
                      ? "Click vào thẻ để chọn series này trước"
                      : assessment.scoredCount < assessment.total
                        ? `Cần chấm đủ điểm (${assessment.scoredCount}/${assessment.total} thành viên)`
                        : undefined;

                    return (
                      <Card
                        key={id ?? idx}
                        onClick={() => setSelectedId(id)}
                        className={`cursor-pointer transition-shadow hover:shadow-md ${isActive ? "ring-2 ring-primary" : ""}`}
                      >
                        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex gap-4">
                            {(p.coverimageurl || p.cover_image_url) && (
                              <div className="size-14 shrink-0 overflow-hidden rounded-lg">
                                <img
                                  src={p.coverimageurl ?? p.cover_image_url}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              </div>
                            )}
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">{title}</h3>
                                <Badge variant="secondary">✦ {p.status ?? p.Status ?? "EBReview"}</Badge>
                                {p.agerating && <Badge variant="outline" className="text-[11px]">{p.agerating}</Badge>}
                                {assessment.isSelected && assessment.scoredCount > 0
                                  ? (
                                    <Badge variant="secondary" className={`border text-[11px] ${assessment.classification.className}`}>
                                      {assessment.scoredCount}/{assessment.total} đã chấm · {assessment.classification.label}
                                    </Badge>
                                  )
                                  : <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                      {assessment.isSelected ? "Chưa có điểm" : "Click để xem điểm"}
                                    </Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {p.synopsis ?? ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleReject(id, title)}
                                disabled={notReady}
                                title={lockReason}
                              >
                                <XCircle className="size-4" />Từ chối
                              </Button>
                              <Button
                                onClick={() => handleApprove(id, title)}
                                disabled={notReady}
                                title={lockReason}
                              >
                                <CheckCircle2 className="size-4" />Chấp nhận
                              </Button>
                            </div>
                            {notReady && (
                              <p className="text-[11px] text-muted-foreground">{lockReason}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
        </section>
      </main>

      <Footer />

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