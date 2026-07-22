import { COMMON_CRITERIA, SCORE_MAX, TYPE_CRITERIA, EB_STATUSES } from "@/constants/eb.js";

// ─── Status helpers ─────────────────────────────────────────────────────────
export function normalizeStatus(raw) {
  return (raw ?? "").toLowerCase().replace(/[_\s-]/g, "");
}

export function isEbStatus(raw) {
  return EB_STATUSES.has(normalizeStatus(raw));
}

// ─── Score helpers ───────────────────────────────────────────────────────────
export function clampScore(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(SCORE_MAX, Math.max(0, parsed));
}

export function validateScore(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Vui lòng nhập điểm.";
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) return "Điểm phải là số.";
  if (parsed < 0 || parsed > SCORE_MAX) return `Điểm phải trong khoảng 0 - ${SCORE_MAX}.`;
  const stepped = Math.round(parsed * 2) / 2;
  if (Math.abs(stepped - parsed) > 0.001) return "Điểm chỉ nhận bước 0.5 (ví dụ: 7.5, 8.0, 8.5).";
  return "";
}

export function buildScoreFields() {
  return [...COMMON_CRITERIA, TYPE_CRITERIA.color];
}

export function buildInitialScores() {
  return { plotDialogue: "", artDesign: "", panelingCamera: "", pacingHook: "", coloring: "", toneShading: "" };
}

// Ngưỡng đạt trên thang điểm 10 — chỉnh số này nếu muốn ngưỡng khác
export const PASS_THRESHOLD = 5.0;

export function getClassification(average) {
  if (average < PASS_THRESHOLD) {
    return {
      label: "KHÔNG ĐẠT",
      note: "Series chưa đạt chất lượng, cần chỉnh sửa lớn trước khi xét lại.",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  return {
    label: "ĐẠT",
    note: "Series đạt yêu cầu chất lượng, có thể thông qua.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

// ─── Evaluation mapping / aggregation ───────────────────────────────────────
export function mapEvalDetailToScores(detail) {
  if (!detail) return buildInitialScores();
  // BE trả về snake_case: story_score / art_score / character_score / commercial_score / pacing_score.
  // Fallback camelCase cho dữ liệu local (form state) đã normalize.
  const v = (snake, camel) => detail[snake] ?? detail[camel] ?? 0;
  return {
    plotDialogue: String(v("story_score", "storyScore")),
    artDesign: String(v("art_score", "artScore")),
    panelingCamera: String(v("character_score", "characterScore")),
    coloring: String(v("commercial_score", "commercialScore")),
    toneShading: String(v("commercial_score", "commercialScore")),
    pacingHook: String(v("pacing_score", "pacingScore")),
  };
}

export function buildCouncilAggregateFromMembers(members, scoreFields) {
  const keys = scoreFields.map(f => f.key);

  const memberRows = members.map((m) => {
    if (!m.hasEvaluated || !m.evalDetail) {
      return { ...m, scored: false, scores: {}, average: 0 };
    }
    const scores = mapEvalDetailToScores(m.evalDetail);
    const vals = keys.map(k => Number(scores[k] ?? 0));
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { ...m, scored: true, scores, average: parseFloat(avg.toFixed(2)) };
  });

  const scoredRows = memberRows.filter(r => r.scored);
  const scoredCount = scoredRows.length;

  const criterionAverages = {};
  if (scoredCount > 0) {
    for (const key of keys) {
      const vals = scoredRows.map(r => Number(r.scores?.[key] ?? 0));
      criterionAverages[key] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    }
  }

  const councilAverage = scoredCount > 0
    ? parseFloat((scoredRows.reduce((sum, r) => sum + r.average, 0) / scoredCount).toFixed(2))
    : 0;

  return { memberRows, criterionAverages, councilAverage, scoredCount };
}

// ─── Tính DTB Hội đồng cho 1 series — dùng chung cho ranking & history ──────
//
// Input: danh sách evaluations của series (`/BoardEvaluation` phẳng), và `scoreFields`.
// Trả về { councilAverage, scoredCount }.
//
// Vì BE không lưu field `averageScore` sẵn, ta tự tính trung bình 5 tiêu chí
// (plotDialogue/artDesign/...) cho từng member, rồi trung bình cộng các member
// — giống y hệt `loadRanking` & `buildCouncilAggregateFromMembers`.
export function computeCouncilAverageForSeries(seriesEvals, scoreFields) {
  if (!Array.isArray(seriesEvals) || !seriesEvals.length) {
    return { councilAverage: null, scoredCount: 0 };
  }
  const scoredRows = seriesEvals.map((e) => {
    const scores = mapEvalDetailToScores(e);
    const vals = scoreFields.map((f) => clampScore(scores[f.key]));
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { scored: true, average: avg };
  });
  const scoredCount = scoredRows.length;
  if (!scoredCount) return { councilAverage: null, scoredCount: 0 };
  const sum = scoredRows.reduce((a, r) => a + r.average, 0);
  const councilAverage = parseFloat((sum / scoredCount).toFixed(2));
  return { councilAverage, scoredCount };
}