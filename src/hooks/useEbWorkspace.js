import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import axiosClient from "@/api/axiosClient.js";
import {
  buildCouncilAggregateFromMembers,
  buildInitialScores,
  buildScoreFields,
  clampScore,
  getClassification,
  isEbStatus,
  mapEvalDetailToScores,
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
  const [pending, setPending] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm, onCancel, danger? }
  const [publishFormatDialog, setPublishFormatDialog] = useState(null); // { seriesId, title, onSelect, onCancel }

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);
  const [activeMemberId, setActiveMemberId] = useState("");
  const [scores, setScores] = useState(buildInitialScores);
  const [scoreErrors, setScoreErrors] = useState(buildInitialScores);
  const [feedback, setFeedback] = useState("");
  const [selectedPublishFormat, setSelectedPublishFormat] = useState("Monthly");

  const loadedRef = useRef(false);

  // ── Load hàng chờ EB ──────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const seriesRes = await axiosClient.get("/Series");
      const raw = seriesRes.data;
      const all = Array.isArray(raw) ? raw : (raw?.data ?? []);
      const ebData = all.filter(s => isEbStatus(s.status));

      if (process.env.NODE_ENV !== 'production') {
        console.log('[EbWorkspace] DEBUG: total=%d, eb-match=%d', all.length, ebData.length);
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const scoreFields = useMemo(() => buildScoreFields(), []);

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

    // Hiện dialog chọn định dạng phát hành
    setPublishFormatDialog({
      seriesId,
      title,
      onSelect: async (format) => {
        setPublishFormatDialog(null);
        await doApprove(seriesId, title, format);
      },
      onCancel: () => setPublishFormatDialog(null),
    });
  }

  async function doApprove(seriesId, title, format) {
    try {
      // 1. Cập nhật định dạng phát hành (Monthly / Weekly)
      await axiosClient.patch(`/Series/${seriesId}/publish-format`, { publishformat: format });

      // 2. Cập nhật status sang Publishing
      await axiosClient.patch(`/Series/${seriesId}/status`, { status: "Publishing" });

      // 3. Chấp nhận và hoàn tất
      toast.success(`Đã chấp nhận "${title}" — chuyển sang phát hành.`);
      setSelectedId(null);
      loadedRef.current = false;
      loadQueue();
    } catch { /* interceptor toast */ }
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
    publishFormatDialog,
    setPublishFormatDialog,
    selectedPublishFormat,
    setSelectedPublishFormat,
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
  };
}

export default useEbWorkspace;