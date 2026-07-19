import axios from './axiosClient'

function unwrap(res) {
  return res?.data !== undefined ? res.data : res
}

export const assistantLayersService = {
  list(pageId) {
    return axios.get(`/PageLayers/${pageId}`).then(unwrap)
  },

  // Backend nhan: layerFile (IFormFile), pageid, uploaderid, layername, zindex, opacity
  uploadLayer(pageId, { file, index, uploaderId, layerName, opacity = 100 }) {
    const fd = new FormData()
    fd.append('layerFile', file)
    fd.append('pageid', String(pageId))
    if (uploaderId != null) fd.append('uploaderid', String(uploaderId))
    if (layerName) fd.append('layername', layerName)
    if (index != null) fd.append('zindex', String(index))
    fd.append('opacity', (Number(opacity) / 100).toFixed(2))
    return axios.post('/PageLayers', fd).then(unwrap)
  },

  // Backend nhan multipart/form-data: layername, zindex, opacity, versionnumber, layerFile
  updateLayer(layerId, patch) {
    const fd = new FormData()
    if (patch.layerName !== undefined) fd.append('layername', patch.layerName)
    if (patch.zIndex !== undefined) fd.append('zindex', String(patch.zIndex))
    if (patch.opacity !== undefined) fd.append('opacity', (Number(patch.opacity) / 100).toFixed(2))
    if (patch.versionNumber !== undefined) fd.append('versionnumber', String(patch.versionNumber))
    if (patch.file !== undefined) fd.append('layerFile', patch.file)
    return axios.put(`/PageLayers/${layerId}`, fd).then(unwrap)
  },

  deleteLayer(layerId) {
    return axios.delete(`/PageLayers/${layerId}`).then(unwrap)
  },

  listVersions(layerId) {
    return axios.get(`/PageLayers/${layerId}`).then(unwrap)
  },
}
