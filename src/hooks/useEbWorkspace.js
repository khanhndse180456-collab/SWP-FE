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
  mapEvalDetailToScores,
  normalizeStatus,
  validateScore,
} from "@/pages/User/Eb/Eb.helpers.js";

/**
 * Hook điều phối toàn bộ logic của trang Eb (Editor Board):
 * - tải hàng chờ EB + danh sách thành viên hội đồng + điểm đã chấm
 * - quản lý form nhập điểm (theo từng thành viên, từng series)
 * - lưu điểm, chấp nhận / từ chối series
 * - quản lý series (xem tất cả, sửa thông tin, đổi trạng thái/định dạng thủ công,
 *   đánh dấu series đã xuất bản xong → Completed)
 */
// Số thành viên Hội đồng bắt buộc phải chấm đủ trước khi được Chấp nhận/Từ chối
const REQUIRED_COUNCIL_MEMBERS = 5;

export function useEbWorkspace() {
  // ── Server state ──────────────────────────────────────────────────────────
  const [pending, setPending] = useState([]); // Series chờ EB chấm điểm
  const [allEvaluations, setAllEvaluations] = useState([]); // Tất cả các bản chấm điểm của hệ thống
  const [members, setMembers] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm, onCancel, danger? }

  // ── Đổi định dạng phát hành từ tab Lịch sử (sửa sau khi đã chấp nhận) ────
  const [editFormatDialog, setEditFormatDialog] = useState(null); // { seriesId, title, currentFormat, onSelect, onCancel }

  // ── Chọn định dạng phát hành ngay khi bấm "Chấp nhận" (thay vì mặc định Monthly) ─
  const [approveFormatDialog, setApproveFormatDialog] = useState(null); // { seriesId, title, onSelect, onCancel }

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
  const TERMINAL_STATUSES = new Set(["Publishing", "Cancelled", "Completed"]);
  const ACTION_OF = new Map([
    ["Publishing", "approve"],
    ["Cancelled", "reject"],
    ["Completed", "approve"],
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
      // FIX: thêm seriesId vào mỗi chapter item — trước đây thiếu field này nên
      // logic gộp timeline ở Eb.jsx (group theo seriesId) luôn bỏ qua chapter events.
      const chapterItems = publishedChapters.map(ch => ({
        id: `ch-${ch.id || ch.chapterid}`,
        action: ch.status === "RevisionRequested" ? "reject" : "approve",
        type: "chapter",
        chapterId: ch.id || ch.chapterid,
        seriesId: String(ch.seriesid ?? ch.series_id ?? ch.SeriesId ?? ""),
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
      const [seriesRes, evalsRes] = await Promise.all([
        axiosClient.get("/Series"),
        axiosClient.get("/BoardEvaluation")
      ]);
      const raw = seriesRes.data;
      const all = Array.isArray(raw) ? raw : (raw?.data ?? []);
      // Lọc series chờ EB chấm điểm: Chỉ những series nào ở trạng thái eb review hoặc awaiting eb score mới hiển thị để chấm
      const ebData = all.filter(s => 
        isAwaitingEbScore(s.status) || 
        isEbStatus(s.status)
      );

      if (process.env.NODE_ENV !== 'production') {
        console.log('[EbWorkspace] DEBUG: total=%d, awaiting-eb=%d', all.length, ebData.length);
      }

      const normalized = ebData.map(item => ({
        ...item,
        _resolvedId: String(item.series_id ?? item.seriesid ?? item.id),
      }));

      const rawEvals = evalsRes.data;
      const evalsList = Array.isArray(rawEvals) ? rawEvals : (rawEvals?.data ?? []);
      setAllEvaluations(evalsList);
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
        setAllEvaluations(all);
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

  // ── Ranking: điểm TB HĐ của tất cả series trong hàng chờ ──────────────────
  const [ranking, setRanking] = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const loadRanking = useCallback(async () => {
    setLoadingRanking(true);
    try {
      const [queueRes, evalsRes, usersRes] = await Promise.allSettled([
        axiosClient.get("/Series"),
        axiosClient.get("/BoardEvaluation"),
        axiosClient.get("/users/evaluators"),
      ]);

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

      const evalsRaw = evalsRes.status === "fulfilled" ? (evalsRes.value.data?.data ?? evalsRes.value.data ?? []) : [];
      const evalsAll = Array.isArray(evalsRaw) ? evalsRaw : [];

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

  // ── Bảng xếp hạng theo kỳ phát hành (từ dữ liệu vừa import) ──────────────
  const [issueRankings, setIssueRankings] = useState([]);
  const [loadingIssueRankings, setLoadingIssueRankings] = useState(false);
  const [currentIssue, setCurrentIssue] = useState(null); // { issueYear, issueNumber }

  const loadRankingsByIssue = useCallback(async (issueYear, issueNumber) => {
    if (!issueYear || !issueNumber) return;
    setLoadingIssueRankings(true);
    try {
      const res = await axiosClient.get(`/Rankings/${issueYear}/${issueNumber}`);
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
      const normalized = list
        .map(r => ({
          rankingId: r.ranking_id ?? r.rankingId ?? r.RankingId ?? r.Rankingid,
          seriesId: r.series_id ?? r.seriesId ?? r.SeriesId ?? r.Seriesid,
          seriesTitle: r.series_title ?? r.seriesTitle ?? r.SeriesTitle ?? `Series #${r.series_id ?? r.seriesId ?? ""}`,
          issueNumber: r.issue_number ?? r.issueNumber ?? r.IssueNumber,
          issueYear: r.issue_year ?? r.issueYear ?? r.IssueYear,
          voteCount: r.vote_count ?? r.voteCount ?? r.VoteCount ?? 0,
          rankPosition: r.rank_position ?? r.rankPosition ?? r.RankPosition ?? null,
          isBottomRank: Boolean(r.is_bottom_rank ?? r.isBottomRank ?? r.IsBottomRank ?? false),
          recordedAt: r.recorded_at ?? r.recordedAt ?? r.RecordedAt ?? null,
        }))
        .sort((a, b) => (a.rankPosition ?? 999) - (b.rankPosition ?? 999));
      setIssueRankings(normalized);
      setCurrentIssue({ issueYear, issueNumber });
      try {
        localStorage.setItem('eb_last_issue', JSON.stringify({ issueYear, issueNumber }));
      } catch { /* ignore storage errors (private mode, quota...) */ }
    } catch (err) {
      console.warn("[issueRankings] load failed", err);
      setIssueRankings([]);
    } finally {
      setLoadingIssueRankings(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('eb_last_issue');
      if (saved) {
        const { issueYear, issueNumber } = JSON.parse(saved);
        if (issueYear && issueNumber) {
          loadRankingsByIssue(issueYear, issueNumber);
        }
      }
    } catch { /* ignore malformed storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importRankings = useCallback(async (file, issueNumber, issueYear) => {
    if (!file) return
    const formData = new FormData()
    formData.append('excelFile', file)
    formData.append('issueNumber', issueNumber)
    formData.append('issueYear', issueYear)
    try {
      await axiosClient.post('/Rankings/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadRanking()
      await loadRankingsByIssue(issueYear, issueNumber)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể import xếp hạng.'
      toast.error(msg)
      throw err
    }
  }, [loadRanking, loadRankingsByIssue])

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  // ── Quản lý Series (tab riêng — xem TẤT CẢ series bất kể trạng thái,
  // sửa thông tin cơ bản, đổi trạng thái / định dạng phát hành thủ công) ─────
  // LƯU Ý: endpoint PUT /Series/{id} dùng để sửa thông tin (title, genre,
  // coverimageurl, synopsis, authorname) không xuất hiện ở nơi khác trong
  // codebase gốc — cần đối chiếu lại với BE (payload/route) nếu khác.
  const [allSeries, setAllSeries] = useState([]);
  const [loadingAllSeries, setLoadingAllSeries] = useState(false);
  const [savingSeriesEdit, setSavingSeriesEdit] = useState(false);

  const loadAllSeries = useCallback(async () => {
    setLoadingAllSeries(true);
    try {
      const res = await axiosClient.get("/Series");
      const raw = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      const normalized = list.map((s, idx) => ({
        ...s,
        _resolvedId: String(s.seriesid ?? s.series_id ?? s.SeriesId ?? s.id ?? idx),
      }));
      setAllSeries(normalized);
    } catch (err) {
      console.warn("[allSeries] load failed", err);
      toast.error("Không thể tải danh sách series.");
      setAllSeries([]);
    } finally {
      setLoadingAllSeries(false);
    }
  }, []);

  useEffect(() => {
    loadAllSeries();
  }, [loadAllSeries]);

  // Sửa thông tin cơ bản của series (tên, thể loại, ảnh bìa, mô tả, tác giả)
  const updateSeriesInfo = useCallback(async (seriesId, payload) => {
    setSavingSeriesEdit(true);
    try {
      await axiosClient.put(`/Series/${seriesId}`, payload);
      toast.success("Đã cập nhật thông tin series.");
      await loadAllSeries();
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không thể cập nhật thông tin series."));
      return false;
    } finally {
      setSavingSeriesEdit(false);
    }
  }, [loadAllSeries]);

  // Đổi trạng thái series thủ công — tái dùng endpoint PATCH /Series/{id}/status
  const updateSeriesStatus = useCallback(async (seriesId, status) => {
    try {
      await axiosClient.patch(`/Series/${seriesId}/status`, { status });
      toast.success(`Đã đổi trạng thái series → ${status}.`);
      await loadAllSeries();
      // đồng bộ các danh sách khác đang phụ thuộc status series
      loadedRef.current = false;
      loadQueue();
      loadHistory();
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không thể đổi trạng thái series."));
      return false;
    }
  }, [loadAllSeries, loadQueue, loadHistory]);

  // Đổi định dạng phát hành thủ công — tái dùng endpoint publish-format
  const updateSeriesFormat = useCallback(async (seriesId, format) => {
    try {
      await axiosClient.patch(`/Series/${seriesId}/publish-format`, { publishformat: format });
      toast.success(`Đã đổi định dạng phát hành → ${format}.`);
      await loadAllSeries();
      loadHistory();
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không thể đổi định dạng phát hành."));
      return false;
    }
  }, [loadAllSeries, loadHistory]);

  // Đánh dấu series đã đăng xong lên web — Publishing → Completed. Dùng ở tab
  // "Quản lý Series" khi nhân viên hoàn tất việc đăng thủ công cho series đang
  // ở trạng thái Publishing. Nếu về sau có tool up truyện tự động, API up truyện
  // có thể gọi thẳng updateSeriesStatus(seriesId, "Completed") khi chạy xong,
  // không cần người bấm nút này nữa.
  const handleMarkCompleted = useCallback(async (seriesId, title) => {
    const confirmed = await new Promise((resolve) => {
      setConfirmDialog({
        message: `Đánh dấu "${title}" đã hoàn tất xuất bản? Series sẽ chuyển sang trạng thái Completed.`,
        onConfirm: () => { setConfirmDialog(null); resolve(true); },
        onCancel: () => { setConfirmDialog(null); resolve(false); },
        danger: false,
      });
    });
    if (!confirmed) return false;
    return updateSeriesStatus(seriesId, "Completed");
  }, [updateSeriesStatus]);

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

    const activeMemberData = members.find(m => m.id === activeMemberId);
    const existingEvalId = activeMemberData?.evalDetail?.evaluationId;

    setSaving(true);
    try {
      if (existingEvalId) {
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

      await loadEvaluatorsStatus(selectedId);
      toast.success(
        `Đã lưu điểm ${activeMember?.name ?? "thành viên"} · DTB cá nhân ${average.toFixed(1)}`
      );
    } catch (err) {
      console.error('[handleSaveAssessment] Error:', err?.response?.data ?? err);
    } finally {
      setSaving(false);
    }
  }

  function getQueueAssessment(seriesId) {
    const seriesEvals = allEvaluations.filter(e =>
      String(e.seriesid ?? e.Seriesid ?? e.series_id) === String(seriesId)
    );
    const { councilAverage, scoredCount } = computeCouncilAverageForSeries(seriesEvals, scoreFields);
    const classification = scoredCount > 0 ? getClassification(councilAverage) : null;
    
    return {
      scoredCount,
      total: REQUIRED_COUNCIL_MEMBERS,
      classification,
      councilAverage,
      isSelected: String(seriesId) === String(selectedId),
    };
  }

  // Chạy các bước kiểm tra như handleApprove trước đây, nhưng thay vì tự chọn
  // định dạng "Monthly", mở dialog cho nhân viên chọn Theo tuần (Weekly) hay
  // Theo tháng (Monthly) trước khi thật sự duyệt.
  function requestApprove(seriesId, title) {
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

    setApproveFormatDialog({
      seriesId,
      title,
      onSelect: (format) => {
        setApproveFormatDialog(null);
        doApprove(seriesId, title, format);
      },
      onCancel: () => setApproveFormatDialog(null),
    });
  }

  async function doApprove(seriesId, title, format) {
    try {
      await axiosClient.patch(`/Series/${seriesId}/publish-format`, { publishformat: format });
      await axiosClient.patch(`/Series/${seriesId}/status`, { status: "Publishing" });

      const councilAvg = councilAggregate.councilAverage.toFixed(1);

      toast.success(`Đã chấm điểm "${title}" — đạt yêu cầu (${councilAvg}/10).`);
      loadHistory();
      setSelectedId(null);
      loadedRef.current = false;
      loadQueue();
    } catch { /* interceptor toast */ }
  }

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

      toast.success(`Đã từ chối "${title}" — trả về Mangaka.`);
      loadHistory();
      setSelectedId(null);
      loadedRef.current = false;
      loadQueue();
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
    chapterHistory,
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
    requestApprove,
    approveFormatDialog,
    handleReject,
    getQueueAssessment,
    loadQueue,
    // ranking
    ranking,
    loadingRanking,
    loadRanking,
    importRankings,
    // xếp hạng theo kỳ (từ dữ liệu vừa import — GET /Rankings/{issueYear}/{issueNumber})
    issueRankings,
    loadingIssueRankings,
    currentIssue,
    loadRankingsByIssue,
    // đổi định dạng phát hành từ bảng lịch sử
    openChangeFormatDialog,
    editFormatDialog,
    // ── quản lý series (tab mới) ──
    allSeries,
    loadingAllSeries,
    loadAllSeries,
    savingSeriesEdit,
    updateSeriesInfo,
    updateSeriesStatus,
    updateSeriesFormat,
    handleMarkCompleted,
  };
}

export default useEbWorkspace;