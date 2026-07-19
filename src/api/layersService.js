import axios from './axiosClient'

function unwrap(res) {
  return res?.data !== undefined ? res.data : res
}

export const layersService = {
  // GET /PageLayers?pageId= → BE thật có nhận [FromQuery] int? pageId.
  list(pageId) {
    const params = {}
    if (pageId != null && pageId !== '') params.pageId = Number(pageId)
    return axios.get('/PageLayers', { params }).then(unwrap)
  },

  // POST /PageLayers (multipart): layerFile + pageid + uploaderid + layername + zindex + opacity
  uploadLayer(pageId, { file, index, uploaderId, layerName, opacity = 1 }) {
    const fd = new FormData()
    fd.append('layerFile', file)
    fd.append('pageid', String(pageId))
    if (uploaderId != null) fd.append('uploaderid', String(uploaderId))
    if (layerName) fd.append('layername', layerName)
    if (index != null) fd.append('zindex', String(index))
    fd.append('opacity', Number(opacity).toFixed(2))
    return axios.post('/PageLayers', fd).then(unwrap)
  },

  // PUT /PageLayers/:id (multipart) — BE nhận layername/zindex/opacity/versionnumber/isvisible (PascalCase field),
  // nhưng form-data truyền string thoải mái, giữ lowercase cho khớp POST.
  updateLayer(layerId, patch) {
    const fd = new FormData()
    if (patch.layerName !== undefined) fd.append('layername', patch.layerName)
    if (patch.zIndex !== undefined) fd.append('zindex', String(patch.zIndex))
    if (patch.opacity !== undefined) fd.append('opacity', Number(patch.opacity).toFixed(2))
    if (patch.versionNumber !== undefined) fd.append('versionnumber', String(patch.versionNumber))
    if (patch.isVisible !== undefined) fd.append('isvisible', String(!!patch.isVisible))
    if (patch.file !== undefined) fd.append('layerFile', patch.file)
    return axios.put(`/PageLayers/${layerId}`, fd).then(unwrap)
  },

  // DELETE /PageLayers/:id/soft
  softDeleteLayer(layerId) {
    return axios.delete(`/PageLayers/${layerId}/soft`).then(unwrap)
  },

  // BE controller KHÔNG có endpoint /visibility. Đổi sang PUT update isvisible,
  // hoặc dùng local-only state nếu không cần persist.
  async toggleVisibility(layerId, isVisible) {
    return this.updateLayer(layerId, { isVisible: !!isVisible })
  },

  // POST /Pages/:id/composite (gộp ảnh → trả Pageimageurl)
  finalize(pageId) {
    return axios.post(`/Pages/${pageId}/composite`).then(unwrap)
  },
}
