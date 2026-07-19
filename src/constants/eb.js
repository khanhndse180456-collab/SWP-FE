// ─── Eb (Editor Board) constants ───────────────────────────────────────────

export const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/tantou", label: "Tantou Editor" },
];

export const COMMON_CRITERIA = [
  { key: "plotDialogue", label: "Cốt truyện & Lời thoại", hint: "Plot & Dialogue" },
  { key: "artDesign", label: "Nét vẽ & Tạo hình nhân vật", hint: "Art Style & Character Design" },
  { key: "panelingCamera", label: "Phân khung & Góc máy", hint: "Paneling & Camera Angles" },
  { key: "pacingHook", label: "Nhịp độ & Cao trào", hint: "Pacing & Hook" },
];

export const TYPE_CRITERIA = {
  color: { key: "coloring", label: "Đổ màu & Phối màu", hint: "Coloring" },
};

export const SCORE_MAX = 10;

export const EB_STATUSES = new Set([
  "ebreview", "underreview", "eb_review", "eb-review",
  "editorreview", "submitted", "readyforreview", "ready_for_review",
]);