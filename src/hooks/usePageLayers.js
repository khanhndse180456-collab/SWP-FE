import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { layersService } from '@/api/layersService.js'
import { pagesService } from '@/api/api.js'

const BLEND_OPTIONS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']

function apiLayerToUi(raw) {
  if (!raw || typeof raw !== 'object') {
    return { id: '', name: '', imageUrl: '', visible: true, opacity: 100, blendMode: 'normal', index: 0 }
  }
  return {
    id: String(raw.layerid ?? raw.Layerid ?? raw.id ?? raw._id ?? ''),
    name: String(raw.layername ?? raw.LayerName ?? raw.name ?? `Layer ${raw.index ?? 0}`),
    imageUrl: raw.fileurl ?? raw.Fileurl ?? raw.imageUrl ?? raw.url ?? '',
    visible: raw.isvisible ?? raw.isVisible ?? raw.IsVisible ?? true,
    opacity: Number(raw.opacity ?? raw.Opacity ?? 100),
    blendMode: BLEND_OPTIONS.includes(raw.blendMode) ? raw.blendMode : 'normal',
    index: Number(raw.index ?? raw.zIndex ?? 0),
    currentVersionNo: raw.versionnumber ?? raw.versionNumber ?? raw.currentVersionNo ?? 1,
  }
}

export function usePageLayers(pageId, { uploaderId } = {}) {
  const [layers, setLayers] = useState([])
  const [originalImage, setOriginalImage] = useState(null)
  const [resultImage, setResultImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState(null)

  // Submission IDs are client-generated (sub-*) - skip API calls
  const isSubmissionPage = typeof pageId === 'string' && pageId.startsWith('sub-')

  const refresh = useCallback(async () => {
    if (!pageId || isSubmissionPage) return
    setLoading(true)
    setError(null)
    try {
      const [pageRes, layersRes] = await Promise.all([
        pagesService.getById(pageId),
        layersService.list(pageId),
      ])

      if (pageRes?.status === 'fulfilled') {
        const p = pageRes.value?.data ?? pageRes.value
        setOriginalImage(p?.pageimageurl ?? p?.Pageimageurl ?? null)
        setResultImage(p?.pageimageurl ?? p?.Pageimageurl ?? null)
      }

      const rawLayers = Array.isArray(layersRes) ? layersRes : []
      setLayers(rawLayers.map(apiLayerToUi))
    } catch (err) {
      setError(err?.message ?? 'Lỗi không xác định')
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addLayer = useCallback(
    async ({ file, index, layerName }) => {
      if (!pageId) return null
      setUploading(true)
      try {
        const nextIdx = index ?? layers.length
        const res = await layersService.uploadLayer(pageId, {
          file,
          index: nextIdx,
          uploaderId,
          layerName: layerName || `Layer ${nextIdx + 1}`,
        })
        const raw = res?.data ?? res
        const ui = apiLayerToUi(raw)
        if (!ui.id) throw new Error('Backend không trả về layer sau khi tạo.')
        setLayers((cur) => {
          const next = [...cur.filter((l) => l.id !== ui.id), ui]
          next.sort((a, b) => a.index - b.index)
          return next
        })
        toast.success(`Đã thêm layer #${ui.index}.`)
        return ui
      } catch (err) {
        toast.error(err?.response?.data?.message ?? 'Không upload được layer.')
        throw err
      } finally {
        setUploading(false)
      }
    },
    [pageId, uploaderId, layers.length],
  )

  const updateLayer = useCallback(
    async (layerId, patch) => {
      if (!pageId) return
      setLayers((cur) =>
        cur.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      )
      try {
        await layersService.updateLayer(layerId, {
          layerName: patch.name,
          zIndex: patch.index,
          opacity: patch.opacity,
        })
      } catch (err) {
        toast.error(err?.response?.data?.message ?? 'Không cập nhật được layer.')
        await refresh()
      }
    },
    [pageId, refresh],
  )

  const toggleVisibility = useCallback(
    async (layerId) => {
      setLayers((cur) =>
        cur.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
      )
      try {
        await layersService.toggleVisibility(layerId)
      } catch (err) {
        toast.error('Không đổi được trạng thái hiển thị layer.')
        await refresh()
      }
    },
    [refresh],
  )

  const setLocalVisibility = useCallback((layerId, visible) => {
    setLayers((cur) =>
      cur.map((l) => (l.id === layerId ? { ...l, visible } : l)),
    )
  }, [])

  const setLocalOpacity = useCallback((layerId, opacity) => {
    setLayers((cur) =>
      cur.map((l) => (l.id === layerId ? { ...l, opacity } : l)),
    )
  }, [])

  const deleteLayer = useCallback(
    async (layerId) => {
      if (!pageId) return
      const target = layers.find((l) => l.id === layerId)
      const ok = window.confirm(`Xóa layer #${target?.index ?? '?'}?`)
      if (!ok) return
      try {
        await layersService.softDeleteLayer(layerId)
        setLayers((cur) => cur.filter((l) => l.id !== layerId))
        toast.success('Đã xóa layer.')
      } catch (err) {
        toast.error(err?.response?.data?.message ?? 'Không xóa được layer.')
      }
    },
    [pageId, layers],
  )

  const reorderLayers = useCallback(
    async (orderedIds) => {
      const reordered = orderedIds
        .map((id, idx) => {
          const layer = layers.find((l) => l.id === id)
          return layer ? { ...layer, index: idx } : null
        })
        .filter(Boolean)
      setLayers(reordered)
      try {
        await Promise.all(
          orderedIds.map((id, idx) =>
            layersService.updateLayer(id, { zIndex: idx }),
          ),
        )
      } catch (err) {
        toast.error('Không sắp xếp lại được layer.')
        await refresh()
      }
    },
    [layers, refresh],
  )

  const finalize = useCallback(async () => {
    if (!pageId) return null
    setFinalizing(true)
    try {
      const res = await layersService.finalize(pageId)
      const raw = res?.data ?? res
      // Backend trả về { Message, Pageimageurl } — lấy Pageimageurl
      const url = raw?.pageimageurl ?? raw?.Pageimageurl ?? raw?.data?.pageimageurl ?? null
      if (!url) throw new Error('Backend không trả về ảnh gộp.')
      setResultImage(url)
      toast.success('Đã gộp layer thành ảnh hoàn chỉnh.')
      return url
    } catch (err) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Không gộp được layer.')
      throw err
    } finally {
      setFinalizing(false)
    }
  }, [pageId])

  const visibleLayers = useMemo(() => layers.filter((l) => l.visible), [layers])

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
  }
}
