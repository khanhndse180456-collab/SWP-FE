import axios from './axiosClient'

function unwrap(res) {
  return res?.data !== undefined ? res.data : res
}

export const notificationsService = {
  list(params = {}) {
    return axios.get('/Notifications', { params }).then(unwrap)
  },

  markRead(id) {
    return axios.patch(`/Notifications/${id}/read`).then(unwrap)
  },

  markAllRead() {
    return axios.patch('/Notifications/read-all').then(unwrap)
  },

  delete(id) {
    return axios.delete(`/Notifications/${id}`).then(unwrap)
  },
}