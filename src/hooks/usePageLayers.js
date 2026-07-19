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

// UI luôn thao tác opacity theo thang 0–100 (khớp <input type="range">).
// Backend lưu opacity dạng phân số 0.00–1.00 (decimal, out-of-range nếu > 1).
// Hai hàm dưới đây là cặp convert 2 chiều, dùng thống nhất ở MỌI nơi gửi/nhận
// opacity — tránh tình trạng đọc thì chia/nhân đúng mà lúc LƯU lại quên convert
// ngược (đây chính là nguyên nhân lỗi "Parameter value '31.00' is out of range":
// updateLayer trước đây gửi thẳng giá trị UI (vd 31) lên thay vì 0.31).
function uiOpacityToApi(opacityUi) {
  const n = Number(opacityUi);
  if (!Number.isFinite(n)) return 1;
  const frac = n / 100;
  return Math.min(1, Math.max(0, Number(frac.toFixed(4))));
}

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
  const [originalImage, setOriginalImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
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
      setLayers(rawLayers.map(apiLayerToUi));
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
    async (layerId, patch) => {
      if (!pageId) return;
      setLayers((cur) =>
        cur.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      );
      try {
        // MỚI: backend bắt buộc LayerName ở mọi request update, kể cả khi
        // chỉ đổi opacity/index — nên luôn lấy tên hiện tại nếu patch không có,
        // tránh gửi layerName: undefined khiến backend trả 400.
        const current = layers.find((l) => l.id === layerId);
        const layerName = patch.name ?? current?.name ?? `Layer ${current?.index ?? 0}`;
        // FIX: opacity trong state/patch luôn ở thang UI (0–100), nhưng backend
        // lưu dạng phân số 0.00–1.00 (decimal) và validate range đó — gửi thẳng
        // số 0–100 (vd 31) sẽ bị BE từ chối: "Parameter value '31.00' is out of
        // range". Phải convert ngược bằng uiOpacityToApi trước khi gửi đi.
        const opacityUi = patch.opacity ?? current?.opacity;
        // FIX: isVisible trước đây bị rớt mất khi forward xuống layersService —
        // khiến toggleVisibility (dùng chung hàm này) không bao giờ đổi được
        // trạng thái hiển thị thật sự trên server, dù optimistic update ở UI
        // vẫn chạy đúng (nên nhìn tưởng thành công nhưng F5 lại lỗi).
        const isVisible = patch.isVisible ?? current?.visible;
        await layersService.updateLayer(layerId, {
          layerName,
          zIndex: patch.index ?? current?.index,
          opacity: opacityUi !== undefined ? uiOpacityToApi(opacityUi) : undefined,
          isVisible,
        });
      } catch (err) {
        toast.error(
          err?.response?.data?.message ?? "Không cập nhật được layer.",
        );
        await refresh();
      }
    },
    [pageId, refresh, layers],
  );

  const toggleVisibility = useCallback(
    async (layerId) => {
      const current = layers.find((l) => l.id === layerId);
      if (!current) return;
      const nextVisible = !current.visible;
      setLayers((cur) =>
        cur.map((l) => (l.id === layerId ? { ...l, visible: nextVisible } : l)),
      );
      try {
        // FIX: gọi thẳng layersService.updateLayer (không qua layersService.toggleVisibility,
        // vốn quên forward isVisible và trước đó bị gọi thiếu tham số từ hook này) —
        // luôn kèm layerName vì BE bắt buộc field này ở MỌI request PUT, kể cả khi
        // chỉ đổi isvisible. Gọi trực tiếp layersService (không qua hàm updateLayer ở
        // trên) để tránh setLayers optimistic update bị chạy chồng 2 lần.
        await layersService.updateLayer(layerId, {
          layerName: current.name || `Layer ${current.index ?? 0}`,
          zIndex: current.index,
          opacity: uiOpacityToApi(current.opacity),
          isVisible: nextVisible,
        });
      } catch (err) {
        toast.error("Không đổi được trạng thái hiển thị layer.");
        await refresh();
      }
    },
    [layers, refresh],
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
        toast.success("Đã xóa layer.");
      } catch (err) {
        toast.error(err?.response?.data?.message ?? "Không xóa được layer.");
      }
    },
    [pageId, layers],
  );

  const reorderLayers = useCallback(
    async (orderedIds) => {
      const reordered = orderedIds
        .map((id, idx) => {
          const layer = layers.find((l) => l.id === id);
          return layer ? { ...layer, index: idx } : null;
        })
        .filter(Boolean);
      setLayers(reordered);
      try {
        await Promise.all(
          orderedIds.map((id, idx) => {
            // MỚI: kèm layerName + opacity hiện tại — backend yêu cầu
            // LayerName bắt buộc ở mọi request update, kể cả khi chỉ đổi zIndex.
            // FIX: opacity ở đây cũng ở thang UI (0–100) — phải convert bằng
            // uiOpacityToApi trước khi gửi, cùng lý do với updateLayer() ở trên.
            const layer = layers.find((l) => l.id === id);
            return layersService.updateLayer(id, {
              zIndex: idx,
              layerName: layer?.name ?? `Layer ${idx}`,
              opacity: layer?.opacity !== undefined ? uiOpacityToApi(layer.opacity) : undefined,
              isVisible: layer?.visible,
            });
          }),
        );
      } catch (err) {
        toast.error("Không sắp xếp lại được layer.");
        await refresh();
      }
    },
    [layers, refresh],
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
    uploading,
    finalizing,
    error,
    refresh,
    addLayer,
    updateLayer,
    toggleVisibility,
    setLocalVisibility,
    setLocalOpacity,
    deleteLayer,
    reorderLayers,
    finalize,
  };
}