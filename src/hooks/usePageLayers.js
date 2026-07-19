import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { layersService } from "@/api/layersService.js";
import { pagesService } from "@/api/api.js";

const BLEND_OPTIONS = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
];

function apiLayerToUi(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      id: "",
      name: "",
      imageUrl: "",
      visible: true,
      opacity: 100,
      blendMode: "normal",
      index: 0,
    };
  }
  const rawOpacity = raw.opacity ?? raw.Opacity ?? null;
  const opacityVal = rawOpacity !== null
    ? (Number(rawOpacity) <= 1.0 ? Number(rawOpacity) * 100 : Number(rawOpacity))
    : 100;

  return {
    id: String(raw.layer_id ?? raw.layerid ?? raw.Layerid ?? raw.LayerId ?? raw.id ?? raw._id ?? ""),
    name: String(
      raw.layer_name ?? raw.layername ?? raw.LayerName ?? raw.name ?? `Layer ${raw.index ?? 0}`
    ),
    imageUrl: raw.file_url ?? raw.fileurl ?? raw.Fileurl ?? raw.FileUrl ?? raw.imageUrl ?? raw.url ?? "",
    visible: raw.is_visible ?? raw.isvisible ?? raw.isVisible ?? raw.IsVisible ?? true,
    opacity: opacityVal,
    blendMode: BLEND_OPTIONS.includes(raw.blendMode) ? raw.blendMode : "normal",
    index: Number(raw.z_index ?? raw.index ?? raw.zIndex ?? raw.ZIndex ?? 0),
    currentVersionNo:
      raw.version_number ?? raw.versionnumber ?? raw.versionNumber ?? raw.VersionNumber ?? raw.currentVersionNo ?? 1,
  };
}

// Backend có thể trả về layer theo nhiều "hình dạng" khác nhau tuỳ endpoint:
// - object layer trực tiếp: { layerId, layerName, ... }
// - bọc trong { data: {...} }
// - bọc trong { layer: {...} }
// - bọc trong { result: {...} }
// - bọc trong { message, data: {...} } (như finalize())
// Hàm này thử từng khả năng, ưu tiên object nào có field id nhận diện được layer.
function extractLayerPayload(res) {
  const candidates = [
    res,
    res?.data,
    res?.layer,
    res?.result,
    res?.data?.layer,
    res?.data?.result,
  ].filter((c) => c && typeof c === "object");

  const hasIdField = (obj) =>
    obj.layer_id ?? obj.layerid ?? obj.Layerid ?? obj.LayerId ?? obj.id ?? obj._id;

  const found = candidates.find((c) => hasIdField(c) !== undefined && hasIdField(c) !== null);
  return found ?? res?.data ?? res;
}

export function usePageLayers(pageId, { uploaderId } = {}) {
  const [layers, setLayers] = useState([]);
  const [dbLayers, setDbLayers] = useState([]);
  const [originalImage, setOriginalImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState(null);

  // Submission IDs are client-generated (sub-*) - skip API calls.
  // pageId có thể là number (page thật từ backend, ví dụ 5) hoặc string
  // (id giả "sub-*" từ luồng submission cũ), nên phải kiểm tra kiểu trước
  // khi gọi .startsWith để tránh crash "pageId?.startsWith is not a function".
  const isSubmissionPage =
    typeof pageId === "string" && pageId.startsWith("sub-");

  const refresh = useCallback(async () => {
    if (!pageId || isSubmissionPage) return;
    setLoading(true);
    setError(null);
    try {
      const [pageRes, layersRes] = await Promise.all([
        pagesService.getById(pageId),
        layersService.list(pageId),
      ]);

      // LƯU Ý: Promise.all trả về giá trị resolve trực tiếp (khác Promise.allSettled),
      // nên KHÔNG có field { status, value } — trước đây check "fulfilled" luôn false,
      // khiến originalImage/resultImage không bao giờ được set lúc refresh() (vd sau F5),
      // dù backend đã lưu Pageimageurl đúng.
      const p = pageRes?.data ?? pageRes;
      // original = ảnh gốc, result = ảnh sau khi Assistant gộp layer.
      // Thường BE chỉ lưu 1 trường Pageimageurl — sau khi finalize() BE ghi đè
      // thẳng Pageimageurl = ảnh gộp, nên cả 2 cùng URL là đúng. Phòng trường hợp
      // BE tách riêng (compositeImageUrl / merged_image_url) thì vẫn nhận ra.
      const originalUrl =
        p?.pageimageurl ?? p?.Pageimageurl ?? p?.originalImageUrl ?? null;
      const resultUrl =
        p?.compositeimageurl
        ?? p?.compositeImageUrl
        ?? p?.merged_image_url
        ?? p?.mergedImageUrl
        ?? p?.pageimageurl
        ?? p?.Pageimageurl
        ?? null;
      setOriginalImage(originalUrl);
      setResultImage(resultUrl);

      const rawLayers = Array.isArray(layersRes) ? layersRes : [];
      const uiLayers = rawLayers.map(apiLayerToUi);
      setLayers(uiLayers);
      setDbLayers(JSON.parse(JSON.stringify(uiLayers)));
    } catch (err) {
      setError(err?.message ?? "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addLayer = useCallback(
    async ({ file, index, layerName }) => {
      if (!pageId) return null;
      setUploading(true);
      try {
        const nextIdx = index ?? layers.length;
        const res = await layersService.uploadLayer(pageId, {
          file,
          index: nextIdx,
          uploaderId,
          layerName: layerName || `Layer ${nextIdx + 1}`,
        });

        // DEBUG TẠM: nếu vẫn lỗi, mở console và copy log này gửi lại để mình xem field thật.
        console.log("[usePageLayers] uploadLayer raw response:", res);

        const raw = extractLayerPayload(res);
        const ui = apiLayerToUi(raw);

        if (!ui.id) {
          // Backend không trả về layer nhận diện được -> fallback: refresh lại toàn bộ
          // danh sách layer từ server thay vì crash cứng, để không chặn luồng upload.
          console.warn(
            "[usePageLayers] Không tìm thấy id layer trong response, fallback sang refresh().",
            res
          );
          await refresh();
          toast.success(`Đã thêm layer #${nextIdx}.`);
          return null;
        }

        setLayers((cur) => {
          const next = [...cur.filter((l) => l.id !== ui.id), ui];
          next.sort((a, b) => a.index - b.index);
          return next;
        });
        setDbLayers((cur) => {
          const next = [...cur.filter((l) => l.id !== ui.id), ui];
          next.sort((a, b) => a.index - b.index);
          return next;
        });
        toast.success(`Đã thêm layer #${ui.index}.`);
        return ui;
      } catch (err) {
        toast.error(err?.response?.data?.message ?? "Không upload được layer.");
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [pageId, uploaderId, layers.length, refresh],
  );

  const updateLayer = useCallback(
    (layerId, patch) => {
      setLayers((cur) =>
        cur.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      );
    },
    [],
  );

  const toggleVisibility = useCallback(
    (layerId) => {
      setLayers((cur) =>
        cur.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
      );
    },
    [],
  );

  const setLocalVisibility = useCallback((layerId, visible) => {
    setLayers((cur) =>
      cur.map((l) => (l.id === layerId ? { ...l, visible } : l)),
    );
  }, []);

  const setLocalOpacity = useCallback((layerId, opacity) => {
    setLayers((cur) =>
      cur.map((l) => (l.id === layerId ? { ...l, opacity } : l)),
    );
  }, []);

  const deleteLayer = useCallback(
    async (layerId) => {
      if (!pageId) return;
      const target = layers.find((l) => l.id === layerId);
      const ok = window.confirm(`Xóa layer #${target?.index ?? "?"}?`);
      if (!ok) return;
      try {
        await layersService.softDeleteLayer(layerId);
        setLayers((cur) => cur.filter((l) => l.id !== layerId));
        setDbLayers((cur) => cur.filter((l) => l.id !== layerId));
        toast.success("Đã xóa layer.");
      } catch (err) {
        toast.error(err?.response?.data?.message ?? "Không xóa được layer.");
      }
    },
    [pageId, layers],
  );

  const reorderLayers = useCallback(
    (orderedIds) => {
      setLayers((cur) => {
        const next = orderedIds
          .map((id, idx) => {
            const layer = cur.find((l) => l.id === id);
            return layer ? { ...layer, index: idx } : null;
          })
          .filter(Boolean);
        return next;
      });
    },
    [],
  );

  const finalize = useCallback(async () => {
    if (!pageId) return null;
    setFinalizing(true);
    try {
      const res = await layersService.finalize(pageId);
      const raw = res?.data ?? res;
      // Backend trả về { Message, Pageimageurl } — lấy Pageimageurl
      const url =
        raw?.pageimageurl ??
        raw?.Pageimageurl ??
        raw?.data?.pageimageurl ??
        null;
      if (!url) throw new Error("Backend không trả về ảnh gộp.");
      setResultImage(url);
      toast.success("Đã gộp layer thành ảnh hoàn chỉnh.");
      return url;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? err?.message ?? "Không gộp được layer.",
      );
      throw err;
    } finally {
      setFinalizing(false);
    }
  }, [pageId]);

  const saveChanges = useCallback(async () => {
    if (!pageId) return;
    setSaving(true);
    try {
      const changedLayers = layers.filter((cur) => {
        const db = dbLayers.find((l) => l.id === cur.id);
        if (!db) return false;
        return (
          db.name !== cur.name ||
          db.visible !== cur.visible ||
          db.opacity !== cur.opacity ||
          db.index !== cur.index
        );
      });

      if (changedLayers.length > 0) {
        await Promise.all(
          changedLayers.map((l) =>
            layersService.updateLayer(l.id, {
              layerName: l.name,
              zIndex: l.index,
              opacity: l.opacity / 100,
              isVisible: l.visible,
            }),
          ),
        );
      }
      toast.success("Đã lưu tất cả thay đổi.");
      setDbLayers(JSON.parse(JSON.stringify(layers)));
    } catch (err) {
      toast.error(err?.response?.data?.message ?? "Không lưu được thay đổi.");
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [pageId, layers, dbLayers, refresh]);

  const hasChanges = useMemo(() => {
    if (layers.length !== dbLayers.length) return true;
    return layers.some((cur) => {
      const db = dbLayers.find((l) => l.id === cur.id);
      if (!db) return true;
      return (
        db.name !== cur.name ||
        db.visible !== cur.visible ||
        db.opacity !== cur.opacity ||
        db.index !== cur.index
      );
    });
  }, [layers, dbLayers]);

  const visibleLayers = useMemo(
    () => layers.filter((l) => l.visible),
    [layers],
  );

  return {
    layers,
    visibleLayers,
    originalImage,
    resultImage,
    loading,
    saving,
    uploading,
    finalizing,
    error,
    hasChanges,
    refresh,
    addLayer,
    updateLayer,
    toggleVisibility,
    setLocalVisibility,
    setLocalOpacity,
    deleteLayer,
    reorderLayers,
    finalize,
    saveChanges,
  };
}