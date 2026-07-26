import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import axiosClient from "@/api/axiosClient.js";
import { notificationsService } from "@/api/notificationsService.js";
import { getSession } from "@/lib/auth.js";
import { getApiErrorMessage } from "@/api/api.js";
import {
  buildCouncilAggregateFromMembers,
  buildInitialScores,
  buildScoreFields,
  clampScore,
  computeCouncilAverageForSeries,
  getClassification,
  isAwaitingEbScore,
  isEbStatus,
  isSeriesPassing,
  mapEvalDetailToScores,
  normalizeStatus,
  validateScore,
} from "@/pages/User/Eb/Eb.helpers.js";

/**
 * Hook điều phối toàn bộ logic của trang Eb (Editor Board):
 * - tải hàng chờ EB + danh sách thành viên hội đồng + điểm đã chấm
 * - quản lý form nhập điểm (theo từng thành viên, từng series)
 * - lưu điểm, chấp nhận / từ chối series
 */
// Số thành viên Hội đồng bắt buộc phải chấm đủ trước khi được Chấp nhận/Từ chối
const REQUIRED_COUNCIL_MEMBERS = 5;

export function useEbWorkspace() {
  // ── Server state ──────────────────────────────────────────────────────────
  const [pending, setPending] = useState([]); // Series chờ EB chấm điểm
  const [members, setMembers] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm, onCancel, danger? }

  // ── Đổi định dạng phát hành từ tab Lịch sử (sửa sau khi đã chấp nhận) ────
  const [editFormatDialog, setEditFormatDialog] = useState(null); // { seriesId, title, currentFormat, onSelect, onCancel }

  // ── Series scoring state (EB chấm điểm series trước khi duyệt chapter) ──────
  const [seriesScores, setSeriesScores] = useState({}); // { seriesId: councilAverage }
  const [seriesMap, setSeriesMap] = useState({}); // { seriesId: seriesObj } — để hiển thị tên series
  const [ebChapters, setEbChapters] = useState([]); // Chapters chờ EB duyệt (sau khi series đạt)
  const [loadingEbChapters, setLoadingEbChapters] = useState(false);

  // ── Derived (đặt sớm để loadHistory dùng được) ────────────────────────────
  const scoreFields = useMemo(() => buildScoreFields(), []);

  // Lịch sử chấp nhận / từ chối — suy ra từ Series.Status (BE không có audit log,
  // DTO Update của BoardEvaluation cũng thiếu field FinalDecision).
  //
  // Quy ước:
  //   Status = "Publishing" → action = "approve"
  //   Status = "Cancelled"  → action = "reject"
  //   Status khác           → bỏ qua (chưa quyết)
  // Thời gian: ưu tiên Approvedat, fallback Createdat.
  const TERMINAL_STATUSES = new Set(["Publishing", "Cancelled"]);
  const ACTION_OF = new Map([
    ["Publishing", "approve"],
    ["Cancelled", "reject"],
  ]);

  const [history, setHistory] = useState([]);
  const [chapterHistory, setChapterHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Lịch sử thông báo đã gửi (do hệ thống tạo khi duyệt/từ chối/chấm điểm)
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // EB đang thao tác (từ session) — dùng để loại trừ khỏi danh sách thông báo
  const currentSession = getSession();
  const currentUserId = currentSession?.id ?? currentSession?.userid ?? currentSession?.userId ?? null;

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [seriesRes, evalsRes, chapterRes] = await Promise.allSettled([
        axiosClient.get("/Series"),
        axiosClient.get("/BoardEvaluation"),
        axiosClient.get("/Chapters"),
      ]);
      const raw = seriesRes.status === "fulfilled"
        ? (seriesRes.value.data?.data ?? seriesRes.value.data ?? [])
        : [];
      const series = Array.isArray(raw) ? raw : [];
      const evals = evalsRes.status === "fulfilled"
        ? (Array.isArray(evalsRes.value.data?.data ?? evalsRes.value.data) ? (evalsRes.value.data?.data ?? evalsRes.value.data) : [])
        : [];

      // Load chapter history from API - filter client-side
      const chapterRaw = chapterRes.status === "fulfilled"
        ? (chapterRes.value.data?.data ?? chapterRes.value.data ?? [])
        : [];
      const allChapters = Array.isArray(chapterRaw) ? chapterRaw : [];
      const publishedChapters = allChapters.filter(ch => {
        const status = ch.status ?? ch.Status ?? "";
        return status === "Published" || status === "RevisionRequested";
      });
      const chapterItems = publishedChapters.map(ch => ({
        id: `ch-${ch.id || ch.chapterid}`,
        action: ch.status === "RevisionRequested" ? "reject" : "approve",
        type: "chapter",
        chapterId: ch.id || ch.chapterid,
        chapterTitle: ch.title ?? `Chapter ${ch.chapternumber ?? ch.chapter_number ?? ""}`,
        seriesTitle: ch.seriesTitle ?? ch.series_title ?? "",
        at: ch.updatedAt ?? ch.updated_at ?? ch.createdAt ?? ch.created_at ?? new Date().toISOString(),
        by: ch.updatedBy ?? ch.updated_by ?? "EB",
        status: ch.status,
      }));
      setChapterHistory(chapterItems);

      // Group evals theo series để tính DTB HĐ — dùng helper chung với loadRanking
      // để 2 tab Bảng xếp hạng + Lịch sử luôn hiển thị cùng một số.
      const evalsBySeries = new Map();
      for (const e of evals) {
        const sid = String(e.seriesid ?? e.Seriesid ?? e.seriesId ?? "");
        if (!sid) continue;
        const arr = evalsBySeries.get(sid) ?? [];
        arr.push(e);
        evalsBySeries.set(sid, arr);
      }

      const items = series
        .map((s, idx) => {
          const status = s.status ?? s.Status ?? "";
          if (!TERMINAL_STATUSES.has(status)) return null;
          const sid = String(s.seriesid ?? s.Seriesid ?? s.seriesId ?? s.id ?? "");
          const at = s.approvedAt ?? s.Approvedat ?? s.approvedat
            ?? s.updatedAt ?? s.Updatedat ?? s.updatedat
            ?? s.createdAt ?? s.Createdat ?? s.createdat
            ?? null;
          const format = s.publishformat ?? s.Publishformat ?? s.publishFormat ?? null;
          const seriesEvals = evalsBySeries.get(sid) ?? [];
          const { councilAverage, scoredCount } = computeCouncilAverageForSeries(seriesEvals, scoreFields);
          return {
            id: `${sid}-${status}`,
            action: ACTION_OF.get(status),
            seriesId: sid,
            seriesTitle: s.title ?? s.Title ?? s.series_title ?? `Series #${sid}`,
            at: at ? new Date(at).toISOString() : new Date(0).toISOString(),
            by: scoredCount > 0 ? `${scoredCount} TV` : "EB", // BE không lưu actor; hiển thị số thành viên chấm
            score: councilAverage,
            format: format || null,
            _sortKey: idx,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const ta = new Date(a.at).getTime();
          const tb = new Date(b.at).getTime();
          const aReal = ta > 0 ? ta : -a._sortKey;
          const bReal = tb > 0 ? tb : -b._sortKey;
          return bReal - aReal;
        })
        .map(({ _sortKey, ...rest }) => rest);

      if (import.meta.env.DEV) {
        const dist = series.reduce((m, s) => {
          const v = s.status ?? s.Status ?? "(empty)";
          m[v] = (m[v] ?? 0) + 1; return m;
        }, {});
        console.log("[history] series=", series.length, "items=", items.length,
          "evals=", evals.length, "status-dist=", dist);
        console.log("[history] chapters=", allChapters.length, "filtered=", chapterItems.length,
          "chapter statuses sample:", allChapters.slice(0, 3).map(c => ({
            status: c.status,
            Status: c.Status,
            title: c.title
          })));
      }
      setHistory(items);
    } catch (err) {
      console.warn("[history] load failed", err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [scoreFields]);

  // Load lịch sử thông báo của user hiện tại (EB) — /Notifications?userId=...
  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const res = await axiosClient.get("/Notifications", {
        params: currentUserId ? { userId: Number(currentUserId) } : undefined,
      });
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
      // Chuẩn hoá về camelCase
      const normalized = list
        .map((n, idx) => ({
          id: n.notification_id ?? n.notificationId ?? n.id ?? `n-${idx}`,
          userId: n.user_id ?? n.userId ?? n.userid ?? null,
          seriesId: n.series_id ?? n.seriesId ?? n.seriesid ?? null,
          title: n.title ?? "(không tiêu đề)",
          message: n.message ?? "",
          createdAt: n.created_at ?? n.createdAt ?? n.createdat ?? n.created_at ?? null,
          read: Boolean(n.read ?? n.is_read ?? n.isRead ?? false),
        }))
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
      setNotifications(normalized);
    } catch (err) {
      console.warn("[notifications] load failed", err);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }, [currentUserId]);

  // Xóa 1 notification khỏi lịch sử (gọi BE rồi remove khỏi state local để UI cập nhật ngay)
  const deleteNotification = useCallback(async (id) => {
    if (!id) return;
    const prev = notifications;
    // Optimistic remove
    setNotifications(prev.filter((n) => String(n.id) !== String(id)));
    try {
      await notificationsService.delete(id);
      toast.success("Đã xóa thông báo");
    } catch (err) {
      // Rollback nếu BE lỗi
      setNotifications(prev);
      toast.error(getApiErrorMessage(err, "Không xóa được thông báo"));
    }
  }, [notifications]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);
  const [activeMemberId, setActiveMemberId] = useState("");
  const [scores, setScores] = useState(buildInitialScores);
  const [scoreErrors, setScoreErrors] = useState(buildInitialScores);
  const [feedback, setFeedback] = useState("");

  const loadedRef = useRef(false);

  // ── Load hàng chờ EB ──────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const seriesRes = await axiosClient.get("/Series");
      const raw = seriesRes.data;
      const all = Array.isArray(raw) ? raw : (raw?.data ?? []);
      // Lọc series chờ EB chấm điểm (dùng cả 2 status để tương thích)
      const ebData = all.filter(s => isAwaitingEbScore(s.status) || isEbStatus(s.status));

      if (process.env.NODE_ENV !== 'production') {
        console.log('[EbWorkspace] DEBUG: total=%d, awaiting-eb=%d', all.length, ebData.length);
      }

      const normalized = ebData.map(item => ({
        ...item,
        _resolvedId: String(item.series_id ?? item.seriesid ?? item.id),
      }));

      setPending(normalized);

      setSelectedId(prev => {
        if (prev != null) return prev;
        return normalized.length ? normalized[0]._resolvedId : null;
      });
    } catch {
      toast.error("Không thể tải hàng chờ EB. Kiểm tra kết nối backend.");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadQueue();
  }, [loadQueue]);

  // ── Load evaluators + evaluations ────────────────────────────────────────
  // FIX: Dùng GET /BoardEvaluation (GetAll) rồi filter theo seriesId
  // vì không có endpoint riêng cho evaluators + scores
  const loadEvaluatorsStatus = useCallback(async (seriesId) => {
    if (!seriesId) { setMembers([]); return; }
    setLoadingMembers(true);
    try {
      const [usersRes, evalsRes] = await Promise.allSettled([
        axiosClient.get("/users/evaluators"),
        axiosClient.get("/BoardEvaluation"), // ← FIX: đổi từ /Submissions/${seriesId}/evaluations
      ]);

      // Danh sách evaluator
      let userList = [];
      if (usersRes.status === "fulfilled") {
        const raw = usersRes.value.data?.data ?? usersRes.value.data ?? [];
        userList = Array.isArray(raw) ? raw : [];
      }

      // Filter evaluations của seriesId này
      let evalList = [];
      if (evalsRes.status === "fulfilled") {
        const raw = evalsRes.value.data;
        const all = Array.isArray(raw) ? raw : (raw?.data ?? []);
        evalList = all.filter(e =>
          String(e.seriesid ?? e.Seriesid) === String(seriesId)
        );
      }

      let mapped = [];
      if (userList.length > 0) {
        mapped = userList.map(u => {
          const uid = String(u.userId ?? u.user_id ?? u.id ?? u.userid);
          // Match bằng inputtedbyid (vì Create dùng inputtedbyid = người nhập = EB member)
          const myEval = evalList.find(e =>
            String(e.inputtedbyid ?? e.Inputtedbyid) === uid
          );
          return {
            id: uid,
            name: u.fullName ?? u.full_name ?? u.fullname ?? u.username,
            title: "Thành viên Hội đồng",
            hasEvaluated: Boolean(myEval),
            evalDetail: myEval ? {
              evaluationId: myEval.evaluationid ?? myEval.evaluation_id ?? myEval.Evaluationid,
              // snake_case trước vì axiosClient normalizeKeys convert camelCase -> snake_case
              storyScore: myEval.story_score ?? myEval.storyScore ?? myEval.StoryScore ?? 0,
              artScore: myEval.art_score ?? myEval.artScore ?? myEval.ArtScore ?? 0,
              characterScore: myEval.character_score ?? myEval.characterScore ?? myEval.CharacterScore ?? 0,
              commercialScore: myEval.commercial_score ?? myEval.commercialScore ?? myEval.CommercialScore ?? 0,
              pacingScore: myEval.pacing_score ?? myEval.pacingScore ?? myEval.PacingScore ?? 0,
              feedback: myEval.feedback ?? "",
            } : null,
          };
        });

        // Không bổ sung member từ evalList vì Response DTO không có name field
        // → record inputtedbyid không nằm trong userList sẽ bị bỏ qua (data rác)
      }

      setMembers(mapped);
      if (mapped.length) {
        setActiveMemberId(prev => {
          const stillExists = mapped.find(m => m.id === prev);
          return stillExists ? prev : mapped[0].id;
        });
      } else {
        setActiveMemberId("");
      }
    } catch {
      toast.error("Không thể tải danh sách thành viên Hội đồng.");
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    loadEvaluatorsStatus(selectedId);
  }, [selectedId, loadEvaluatorsStatus]);

  // ── Điền form khi đổi member ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeMemberId || !members.length) {
      setScores(buildInitialScores());
      setScoreErrors(buildInitialScores());
      setFeedback("");
      return;
    }
    const member = members.find(m => m.id === activeMemberId);
    if (!member) return;

    if (member.hasEvaluated && member.evalDetail) {
      setScores(mapEvalDetailToScores(member.evalDetail));
      setFeedback(member.evalDetail.feedback ?? "");
    } else {
      setScores(buildInitialScores());
      setFeedback("");
    }
    setScoreErrors(buildInitialScores());
  }, [activeMemberId, members]);

  // ── Derived (đã khai báo ở đầu hook để loadHistory dùng được) ──────────────
  // const scoreFields = useMemo(() => buildScoreFields(), []);

  // ── Ranking: điểm TB HĐ của tất cả series trong hàng chờ ──────────────────
  // Phải đặt SAU `scoreFields` vì loadRanking đọc scoreFields để tính average.
  const [ranking, setRanking] = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const loadRanking = useCallback(async () => {
    setLoadingRanking(true);
    try {
      // Lấy song song: hàng chờ (cùng nguồn /Series như loadQueue) + tất cả evaluations + tất cả evaluators
      const [queueRes, evalsRes, usersRes] = await Promise.allSettled([
        axiosClient.get("/Series"),
        axiosClient.get("/BoardEvaluation"),
        axiosClient.get("/users/evaluators"),
      ]);

      // Pending list — ranking lấy trực tiếp từ /Series (KHÔNG lọc isEbStatus
      // như queue) rồi chỉ giữ những series đã được chấp nhận (status = "Publishing").
      // Sau khi "Chấp nhận", status rời khỏi nhóm EB_STATUSES → isEbStatus sẽ loại
      // mất series đã duyệt, nên ta bỏ isEbStatus khỏi filter cho ranking.
      const queueRaw = queueRes.status === "fulfilled"
        ? (queueRes.value.data?.data ?? queueRes.value.data ?? [])
        : [];
      const queueList = Array.isArray(queueRaw) ? queueRaw : [];
      const resolved = queueList
        .map((s, idx) => {
          const id = s.series_id ?? s.seriesid ?? s.SeriesId ?? s.seriesId ?? s.id ?? s._id ?? idx;
          return { ...s, _resolvedId: String(id) };
        })
        .filter(s => normalizeStatus(s.status ?? s.Status) === "publishing");

      // Map evaluator id → name (để hiển thị cột người chấm)
      const userListRaw = usersRes.status === "fulfilled"
        ? (usersRes.value.data?.data ?? usersRes.value.data ?? [])
        : [];
      const userList = Array.isArray(userListRaw) ? userListRaw : [];
      const userMap = new Map();
      for (const u of userList) {
        const uid = String(u.id ?? u.Id ?? u.userid ?? u.UserId ?? "");
        const name = u.fullname ?? u.Fullname ?? u.name ?? u.Name ?? u.username ?? `User #${uid}`;
        if (uid) userMap.set(uid, { id: uid, name });
      }

      // All evaluations
      const evalsRaw = evalsRes.status === "fulfilled" ? (evalsRes.value.data?.data ?? evalsRes.value.data ?? []) : [];
      const evalsAll = Array.isArray(evalsRaw) ? evalsRaw : [];

      // Tính aggregate per series — dùng helper chung với tab Lịch sử
      // để đảm bảo DTB hiển thị giống hệt nhau ở cả hai nơi.
      const rows = resolved.map((s) => {
        const sid = s._resolvedId;
        const seriesEvals = evalsAll.filter(e => {
          const eSid = String(e.seriesid ?? e.Seriesid ?? "");
          return eSid === sid;
        });
        const { councilAverage, scoredCount } = computeCouncilAverageForSeries(seriesEvals, scoreFields);
        const memberRows = seriesEvals.map((e, eIdx) => {
          const eUid = String(e.inputtedbyid ?? e.Inputtedbyid ?? `eval-${sid}-${eIdx}`);
          const userInfo = userMap.get(eUid);
          const scores = mapEvalDetailToScores(e);
          const vals = scoreFields.map(f => Number(scores[f.key] ?? 0));
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          return {
            id: eUid,
            name: userInfo?.name ?? `Thành viên #${eUid}`,
            scored: true,
            scores,
            average: parseFloat(avg.toFixed(2)),
          };
        });

        return {
          seriesId: sid,
          title: s.title ?? s.series_title ?? `Series #${sid}`,
          author: s.authorname ?? s.authorname ?? s.author ?? s.Authorname ?? null,
          genre: s.genre ?? s.Genre ?? null,
          coverimageurl: s.coverimageurl ?? s.cover_image_url ?? null,
          status: s.status ?? s.Status ?? "EBReview",
          scoredCount,
          total: REQUIRED_COUNCIL_MEMBERS,
          councilAverage: councilAverage ?? 0,
          memberRows,
          classification: scoredCount >= REQUIRED_COUNCIL_MEMBERS ? getClassification(councilAverage ?? 0) : null,
        };
      });

      // Sort: chỉ sort theo DTB HĐ giảm dần.
      // Vì đã filter status=Publishing + có điểm, không cần nhánh "chưa đủ".
      const ranked = rows
        .filter(r => r.scoredCount > 0)
        .sort((a, b) => b.councilAverage - a.councilAverage);

      setRanking(ranked);
    } catch {
      setRanking([]);
    } finally {
      setLoadingRanking(false);
    }
  }, [scoreFields]);

  const importRankings = useCallback(async (file) => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await axiosClient.post('/Rankings/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadRanking()
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể import xếp hạng.'
      toast.error(msg)
      throw err
    }
  }, [loadRanking])

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const councilAggregate = useMemo(
    () => buildCouncilAggregateFromMembers(members, scoreFields),
    [members, scoreFields]
  );

  const councilClassification = getClassification(councilAggregate.councilAverage);
  const activeMember = members.find(m => m.id === activeMemberId);

  const activeSubmission = pending.find(p => p._resolvedId === selectedId);

  const average = useMemo(() => {
    const total = scoreFields.reduce((sum, f) => sum + clampScore(scores[f.key]), 0);
    return scoreFields.length ? total / scoreFields.length : 0;
  }, [scoreFields, scores]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function updateScore(key, value) {
    setScores(cur => ({ ...cur, [key]: value }));
    setScoreErrors(cur => ({ ...cur, [key]: validateScore(value) }));
  }

  function normalizeScoreField(key) {
    const raw = String(scores[key] ?? "").trim();
    if (!raw) { setScoreErrors(cur => ({ ...cur, [key]: validateScore(raw) })); return; }
    const stepped = Math.round(clampScore(raw) * 2) / 2;
    const next = stepped.toFixed(1);
    setScores(cur => ({ ...cur, [key]: next }));
    setScoreErrors(cur => ({ ...cur, [key]: validateScore(next) }));
  }

  async function handleSaveAssessment() {
    if (!selectedId) { toast.error("Chưa chọn series để chấm điểm."); return; }
    if (!activeMemberId) { toast.error("Chưa chọn thành viên Hội đồng."); return; }

    const nextErrors = Object.fromEntries(
      scoreFields.map(f => [f.key, validateScore(scores[f.key])])
    );
    setScoreErrors(cur => ({ ...cur, ...nextErrors }));
    if (Object.values(nextErrors).some(Boolean)) {
      toast.error("Có tiêu chí chưa hợp lệ. Vui lòng kiểm tra lại điểm.");
      return;
    }

    // FIX: Kiểm tra member đã có evaluation chưa để POST hay PUT
    const activeMemberData = members.find(m => m.id === activeMemberId);
    const existingEvalId = activeMemberData?.evalDetail?.evaluationId;

    setSaving(true);
    try {
      if (existingEvalId) {
        // PUT /BoardEvaluation/{id} — cập nhật evaluation đã có
        const res = await axiosClient.put(`/BoardEvaluation/${existingEvalId}`, {
          storyScore: clampScore(scores.plotDialogue),
          artScore: clampScore(scores.artDesign),
          characterScore: clampScore(scores.panelingCamera),
          commercialScore: clampScore(scores.coloring),
          pacingScore: clampScore(scores.pacingHook),
          feedback: feedback.trim(),
        });
        console.log('[handleSaveAssessment] PUT response:', res.data);
      } else {
        // POST /BoardEvaluation — tạo evaluation mới
        const res = await axiosClient.post("/BoardEvaluation", {
          seriesid: Number(selectedId),
          inputtedbyid: Number(activeMemberId),
          storyScore: clampScore(scores.plotDialogue),
          artScore: clampScore(scores.artDesign),
          characterScore: clampScore(scores.panelingCamera),
          commercialScore: clampScore(scores.coloring),
          pacingScore: clampScore(scores.pacingHook),
          feedback: feedback.trim(),
        });
        console.log('[handleSaveAssessment] POST response:', res.data);
      }

      // Reload để cập nhật bảng điểm
      await loadEvaluatorsStatus(selectedId);
      toast.success(
        `Đã lưu điểm ${activeMember?.name ?? "thành viên"} · DTB cá nhân ${average.toFixed(1)}`
      );

      // Bắn thông báo tới Tantou + các EB khác khi có thành viên vừa chấm điểm (Đã gỡ bỏ do API Notifications/send không tồn tại)
      /*
      try {
        const submission = pending.find(p => p._resolvedId === String(selectedId));
        const tantouId = submission?.tantoueditorid ?? submission?.tantou_editor_id ?? submission?.tantouEditorId;
        const seriesTitle = submission?.title ?? submission?.Title ?? submission?.series_title ?? `Series #${selectedId}`;
        const newScoredCount = councilAggregate.memberRows?.filter(r => r.scored).length ?? 0;

        const targets = [];
        if (tantouId && Number(tantouId) !== Number(currentUserId)) targets.push({
          userId: Number(tantouId),
          title: "Hội đồng vừa chấm điểm tác phẩm phụ trách",
          message: `Thành viên Hội đồng vừa chấm điểm cho "${seriesTitle}" (${newScoredCount}/${REQUIRED_COUNCIL_MEMBERS} TV đã chấm). DTB hiện tại: ${(councilAggregate.councilAverage ?? 0).toFixed(1)}/5.`,
        });
        (councilAggregate.memberRows || [])
          .map(r => r.id)
          .filter(id => id != null && Number(id) !== Number(currentUserId) && Number(id) !== Number(activeMemberId))
          .forEach(ebId => {
            if (Number(ebId) === Number(tantouId)) return;
            targets.push({
              userId: Number(ebId),
              title: "Có thành viên vừa chấm điểm",
              message: `Một thành viên vừa chấm điểm cho "${seriesTitle}". Tiến độ: ${newScoredCount}/${REQUIRED_COUNCIL_MEMBERS} thành viên.`,
            });
          });

        await Promise.all(
          targets.map(t =>
            axiosClient.post("/Notifications/send", { ...t, seriesId: Number(selectedId) })
              .catch((err) => console.warn("[notify] failed →", t.userId, err?.message))
          )
        );
      } catch (notifyErr) {
        console.warn("[notify] handleSaveAssessment notify error", notifyErr);
      }
      */
    } catch (err) {
      console.error('[handleSaveAssessment] Error:', err?.response?.data ?? err);
      // axiosClient interceptor đã toast lỗi
    } finally {
      setSaving(false);
    }
  }

  // assessment chỉ thực sự chính xác cho series đang được chọn (selectedId),
  // vì members/councilAggregate được load theo selectedId. Series khác trong
  // list trả về scoredCount=0 → nút Approve/Reject sẽ bị disable cho tới khi
  // được click chọn (đúng ý: bắt buộc chọn + xem bảng điểm trước khi duyệt).
  function getQueueAssessment(seriesId) {
    if (String(seriesId) !== String(selectedId)) {
      return { scoredCount: 0, total: REQUIRED_COUNCIL_MEMBERS, classification: null, councilAverage: 0, isSelected: false };
    }
    return {
      scoredCount: councilAggregate.scoredCount,
      total: REQUIRED_COUNCIL_MEMBERS,
      classification: councilAggregate.scoredCount > 0 ? councilClassification : null,
      councilAverage: councilAggregate.councilAverage,
      isSelected: true,
    };
  }

  async function handleApprove(seriesId, title) {
    const assessment = getQueueAssessment(seriesId);

    if (!assessment.isSelected) {
      toast.error("Hãy chọn series này trước (click vào thẻ) để xem bảng điểm Hội đồng.");
      return;
    }

    const incomplete = assessment.scoredCount < assessment.total;
    if (incomplete) {
      toast.error(`Hội đồng mới chấm ${assessment.scoredCount}/${assessment.total} thành viên. Cần chấm đủ điểm trước khi chấp nhận.`);
      return;
    }

    const failing = assessment.classification?.label === "KHÔNG ĐẠT";
    if (failing) {
      toast.error(`Không thể chấp nhận — series đang ở mức KHÔNG ĐẠT (DTB ${assessment.councilAverage.toFixed(1)}). Cần đạt tối thiểu 2.5 điểm.`);
      return;
    }

    // Đồng bộ UX với "Duyệt chapter" của Tantou: không bật dialog phụ, chấp
    // nhận thẳng với định dạng mặc định "Monthly". Có thể đổi sau tại tab Lịch sử.
    await doApprove(seriesId, title, "Monthly");
  }

  async function doApprove(seriesId, title, format) {
    try {
      // 1. Cập nhật định dạng phát hành (Monthly / Weekly)
      await axiosClient.patch(`/Series/${seriesId}/publish-format`, { publishformat: format });

      // 2. Cập nhật status sang Publishing (series đã có điểm, đã duyệt, đang phát hành)
      await axiosClient.patch(`/Series/${seriesId}/status`, { status: "Publishing" });

      // Lưu series score vào state để UI chapters hiển thị
      const assessment = getQueueAssessment(seriesId);
      if (assessment?.councilAverage != null) {
        setSeriesScores(prev => ({ ...prev, [seriesId]: assessment.councilAverage }));
      }

      // Chuẩn bị nội dung thông báo
      const submission = pending.find(p => p._resolvedId === String(seriesId));
      const mangakaId = submission?.mangakaid ?? submission?.manga_ka_id ?? submission?.mangaka_id;
      const tantouId = submission?.tantoueditorid ?? submission?.tantou_editor_id ?? submission?.tantouEditorId;
      const councilAvg = councilAggregate.councilAverage.toFixed(1);
      const evalFeedback = councilAggregate.memberRows
        .filter(r => r.scored)
        .map(r => `${r.name}: ${r.average.toFixed(1)}`)
        .join(", ");

      const targets = [];
      // 1) Mangaka (tác giả)
      if (mangakaId) targets.push({
        userId: Number(mangakaId),
        title: "Tác phẩm đạt yêu cầu",
        message: `Tác phẩm "${title}" đã đạt yêu cầu với DTB Hội đồng: ${councilAvg}/10. Điểm thành viên: ${evalFeedback || "N/A"}.`,
      });
      // 2) Tantou (biên tập viên phụ trách)
      if (tantouId && Number(tantouId) !== Number(mangakaId)) targets.push({
        userId: Number(tantouId),
        title: "Tác phẩm phụ trách đạt yêu cầu",
        message: `Tác phẩm "${title}" mà bạn phụ trách đã đạt yêu cầu với DTB: ${councilAvg}/10.`,
      });
      // 3) Các EB khác trong Hội đồng (loại trừ EB đang thao tác — currentUserId)
      const ebList = (councilAggregate.memberRows || [])
        .map(r => r.id)
        .filter(id => id != null && Number(id) !== Number(currentUserId));
      ebList.forEach(ebId => {
        if (Number(ebId) === Number(mangakaId) || Number(ebId) === Number(tantouId)) return;
        targets.push({
          userId: Number(ebId),
          title: "Có tác phẩm mới đạt yêu cầu",
          message: `"${title}" đạt yêu cầu với DTB Hội đồng: ${councilAvg}/10.`,
        });
      });

      // Gửi song song, không block nếu một cái fail (Đã gỡ bỏ do API Notifications/send không tồn tại)
      /*
      await Promise.all(
        targets.map(t =>
          axiosClient.post("/Notifications/send", { ...t, seriesId: Number(seriesId) })
            .catch((err) => console.warn("[notify] failed →", t.userId, err?.message))
        )
      );
      */

      toast.success(`Đã chấm điểm "${title}" — đạt yêu cầu (${councilAvg}/10).`);
      // Reload history từ API (đã có FinalDecision = Approve trong DB).
      loadHistory();
      loadEbChapters(); // Refresh danh sách chapters
      setSelectedId(null);
      loadedRef.current = false;
      loadQueue();
    } catch { /* interceptor toast */ }
  }

  // ── Đổi định dạng phát hành (gọi từ bảng Lịch sử) ────────────────────────
  function openChangeFormatDialog(item) {
    setEditFormatDialog({
      seriesId: item.seriesId,
      title: item.seriesTitle,
      currentFormat: item.format,
      onSelect: async (newFormat) => {
        setEditFormatDialog(null);
        await doChangePublishFormat(item.seriesId, item.seriesTitle, newFormat);
      },
      onCancel: () => setEditFormatDialog(null),
    });
  }

  async function doChangePublishFormat(seriesId, title, newFormat) {
    if (!newFormat) return;
    try {
      await axiosClient.patch(`/Series/${seriesId}/publish-format`, { publishformat: newFormat });
      toast.success(`Đã đổi "${title}" → ${newFormat}.`);
      loadHistory();
    } catch (err) {
      console.warn("[history] change format failed", err);
      toast.error("Đổi định dạng thất bại. Vui lòng thử lại.");
    }
  }

  async function handleReject(seriesId, title) {
    const assessment = getQueueAssessment(seriesId);

    if (!assessment.isSelected) {
      toast.error("Hãy chọn series này trước (click vào thẻ) để xem bảng điểm Hội đồng.");
      return;
    }

    const incomplete = assessment.scoredCount < assessment.total;
    if (incomplete) {
      toast.error(`Hội đồng mới chấm ${assessment.scoredCount}/${assessment.total} thành viên. Cần chấm đủ điểm trước khi từ chối.`);
      return;
    }

    const confirmed = await new Promise((resolve) => {
      setConfirmDialog({
        message: `Từ chối "${title}"? Series sẽ bị trả về Mangaka chỉnh sửa.`,
        onConfirm: () => { setConfirmDialog(null); resolve(true); },
        onCancel: () => { setConfirmDialog(null); resolve(false); },
        danger: true,
      });
    });
    if (!confirmed) return;
    try {
      await axiosClient.patch(`/Series/${seriesId}/status`, { status: "Cancelled" });

      // Gửi thông báo cho Mangaka + Tantou + các EB khác
      const submission = pending.find(p => p._resolvedId === String(seriesId));
      const mangakaId = submission?.mangakaid ?? submission?.manga_ka_id ?? submission?.mangaka_id;
      const tantouId = submission?.tantoueditorid ?? submission?.tantou_editor_id ?? submission?.tantouEditorId;
      const councilAvg = councilAggregate.councilAverage.toFixed(1);
      const evalFeedback = councilAggregate.memberRows
        .filter(r => r.scored)
        .map(r => `${r.name}: ${r.average.toFixed(1)}`)
        .join(", ");

      const targets = [];
      if (mangakaId) targets.push({
        userId: Number(mangakaId),
        title: "Tác phẩm bị Hội đồng từ chối",
        message: `Tác phẩm "${title}" đã bị Hội đồng từ chối và trả về chỉnh sửa. DTB Hội đồng: ${councilAvg}/5. Điểm thành viên: ${evalFeedback || "N/A"}.`,
      });
      if (tantouId && Number(tantouId) !== Number(mangakaId)) targets.push({
        userId: Number(tantouId),
        title: "Tác phẩm phụ trách bị từ chối",
        message: `Tác phẩm "${title}" bạn phụ trách đã bị Hội đồng từ chối và trả về Mangaka chỉnh sửa. DTB Hội đồng: ${councilAvg}/5.`,
      });
      (councilAggregate.memberRows || [])
        .map(r => r.id)
        .filter(id => id != null && Number(id) !== Number(currentUserId))
        .forEach(ebId => {
          if (Number(ebId) === Number(mangakaId) || Number(ebId) === Number(tantouId)) return;
          targets.push({
            userId: Number(ebId),
            title: "Có tác phẩm bị Hội đồng từ chối",
            message: `Hội đồng vừa từ chối "${title}". DTB Hội đồng: ${councilAvg}/5.`,
          });
        });

      /*
      await Promise.all(
        targets.map(t =>
          axiosClient.post("/Notifications/send", { ...t, seriesId: Number(seriesId) })
            .catch((err) => console.warn("[notify] failed →", t.userId, err?.message))
        )
      );
      */

      toast.success(`Đã từ chối "${title}" — trả về Mangaka.`);
      // Series đã bị Cancelled — lịch sử Approve/Reject vẫn do BoardEvaluation quyết định,
      // nên reload từ API.
      loadHistory();
      setSelectedId(null);
      loadedRef.current = false;
      loadQueue();
    } catch { /* interceptor toast */ }
  }

  // ── EB Chapters (duyệt chapter từ Tantou gửi lên, sau khi Series đạt threshold) ─
  const loadEbChapters = useCallback(async () => {
    setLoadingEbChapters(true);
    try {
      // Lấy tất cả chapters (sẽ filter theo series status trong FE)
      // Hoặc dùng status = "Ready" nếu backend phân biệt rõ
      const [chaptersRes, seriesRes, evalsRes] = await Promise.allSettled([
        axiosClient.get("/Chapters"),
        axiosClient.get("/Series"),
        axiosClient.get("/BoardEvaluation"),
      ]);

      const chaptersRaw = chaptersRes.status === "fulfilled"
        ? (chaptersRes.value.data?.data ?? chaptersRes.value.data ?? [])
        : [];
      const seriesRaw = seriesRes.status === "fulfilled"
        ? (seriesRes.value.data?.data ?? seriesRes.value.data ?? [])
        : [];
      const evalsRaw = evalsRes.status === "fulfilled"
        ? (evalsRes.value.data?.data ?? evalsRes.value.data ?? [])
        : [];

      // Build series map với status (lowercase seriesid + fallback)
      const seriesLookup = {};
      for (const s of seriesRaw) {
        const sid = String(s.seriesid ?? s.series_id ?? s.Seriesid ?? s.id ?? "");
        seriesLookup[sid] = s;
      }
      setSeriesMap(seriesLookup);

      // Build series score map từ evaluations
      const scoresMap = {};
      for (const s of seriesRaw) {
        // Field id của Series là `seriesid` (lowercase)
        const sid = String(s.seriesid ?? s.series_id ?? s.Seriesid ?? s.id ?? "");
        const seriesEvals = evalsRaw.filter(e => {
          const evalSid = String(e.seriesid ?? e.Seriesid ?? e.series_id ?? "");
          return evalSid === sid;
        });
        const { councilAverage } = computeCouncilAverageForSeries(seriesEvals, scoreFields);
        if (councilAverage != null) {
          scoresMap[sid] = councilAverage;
        }
        // Nếu series có ebScore từ BE, dùng luôn
        if (s.ebScore != null || s.eb_score != null) {
          scoresMap[sid] = s.ebScore ?? s.eb_score;
        }
      }
      setSeriesScores(scoresMap);

      // Filter: lấy chapters của series đã có điểm + đạt threshold,
      // status phải là "Ready" hoặc "InProduction" (để EB thấy được
      // các chapter đang chờ - chỉ Duyệt được khi status = "Ready")
      const chapters = chaptersRaw.filter(ch => {
        const sid = String(ch.seriesid ?? ch.series_id ?? ch.SeriesId ?? "");
        const score = scoresMap[sid];
        const chStatus = String(ch.status ?? "").toLowerCase();
        if (score == null) return false;
        if (!isSeriesPassing(score)) return false;
        if (chStatus !== "ready" && chStatus !== "inproduction") return false;
        return true;
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[EbChapters] total chapters: ${chaptersRaw.length}, filtered: ${chapters.length}`);
        console.log(`[EbChapters] scoresMap:`, scoresMap);
        if (chaptersRaw[0]) {
          console.log(`[EbChapters] first chapter keys:`, Object.keys(chaptersRaw[0]));
          console.log(`[EbChapters] first chapter:`, chaptersRaw[0]);
        }
      }

      setEbChapters(chapters);
    } catch {
      setEbChapters([]);
    } finally {
      setLoadingEbChapters(false);
    }
  }, [scoreFields]);

  useEffect(() => {
    loadEbChapters();
  }, [loadEbChapters]);

  async function handleEbChapterApprove(chapterId, chapterTitle) {
    try {
      await axiosClient.patch(`/Chapters/${chapterId}/status`, 'Published');
      toast.success(`Đã duyệt chapter — published.`);
      // Add to local chapter history
      setChapterHistory(prev => [{
        id: `ch-${chapterId}-${Date.now()}`,
        action: "approve",
        type: "chapter",
        chapterId,
        chapterTitle,
        at: new Date().toISOString(),
        by: currentSession?.username ?? "EB",
      }, ...prev]);
      loadEbChapters();
    } catch { /* interceptor toast */ }
  }

  async function handleEbChapterReject(chapterId, chapterTitle) {
    const confirmed = await new Promise((resolve) => {
      setConfirmDialog({
        message: `Từ chối chapter "${chapterTitle}"?`,
        onConfirm: () => { setConfirmDialog(null); resolve(true); },
        onCancel: () => { setConfirmDialog(null); resolve(false); },
        danger: true,
      });
    });
    if (!confirmed) return;
    try {
      await axiosClient.patch(`/Chapters/${chapterId}/status`, 'RevisionRequested');
      toast.success(`Đã từ chối chapter.`);
      // Add to local chapter history
      setChapterHistory(prev => [{
        id: `ch-${chapterId}-${Date.now()}`,
        action: "reject",
        type: "chapter",
        chapterId,
        chapterTitle,
        at: new Date().toISOString(),
        by: currentSession?.username ?? "EB",
      }, ...prev]);
      loadEbChapters();
    } catch { /* interceptor toast */ }
  }

  return {
    // server state
    pending,
    members,
    loadingQueue,
    loadingMembers,
    saving,
    confirmDialog,
    // history (hành động duyệt)
    history,
    loadingHistory,
    loadHistory,
    // notifications (lịch sử thông báo)
    notifications,
    loadingNotifications,
    loadNotifications,
    deleteNotification,
    // UI state
    selectedId,
    setSelectedId,
    activeMemberId,
    setActiveMemberId,
    scores,
    scoreErrors,
    feedback,
    setFeedback,
    // derived
    scoreFields,
    councilAggregate,
    councilClassification,
    activeMember,
    activeSubmission,
    average,
    // handlers
    updateScore,
    normalizeScoreField,
    handleSaveAssessment,
    handleApprove,
    handleReject,
    getQueueAssessment,
    loadQueue,
    // ranking
    ranking,
    loadingRanking,
    loadRanking,
    importRankings,
    // eb chapters
    ebChapters,
    loadingEbChapters,
    loadEbChapters,
    handleEbChapterApprove,
    handleEbChapterReject,
    // series scores (cho UI chapters check threshold)
    seriesScores,
    seriesMap,
    // history (chấp nhận / từ chối — load từ API BoardEvaluation)
    chapterHistory,
    loadingHistory,
    loadHistory,
    // đổi định dạng phát hành từ bảng lịch sử
    openChangeFormatDialog,
    editFormatDialog,
  };
}

export default useEbWorkspace;