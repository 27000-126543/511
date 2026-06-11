import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

export const authApi = {
  login: (data: { username: string; password: string }) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
};

export const instrumentsApi = {
  list: (params?: any) => api.get('/instruments', { params }),
  getTypes: () => api.get('/instruments/types'),
  get: (id: string) => api.get(`/instruments/${id}`),
  create: (data: any) => api.post('/instruments', data),
  update: (id: string, data: any) => api.put(`/instruments/${id}`, data),
  delete: (id: string) => api.delete(`/instruments/${id}`),
};

export const reservationsApi = {
  myReservations: (params?: any) => api.get('/reservations/my', { params }),
  getByInstrument: (instrumentId: string, params?: any) => api.get(`/reservations/instrument/${instrumentId}`, { params }),
  recommend: (instrumentId: string, params?: any) => api.get(`/reservations/recommend/${instrumentId}`, { params }),
  checkConflict: (params: any) => api.get('/reservations/check-conflict', { params }),
  create: (data: any) => api.post('/reservations', data),
  get: (id: string) => api.get(`/reservations/${id}`),
  checkIn: (id: string) => api.post(`/reservations/${id}/check-in`),
  checkOut: (id: string) => api.post(`/reservations/${id}/check-out`),
  cancel: (id: string) => api.delete(`/reservations/${id}`),
};

export const statusApi = {
  getRecent: (instrumentId: string, limit?: number) => api.get(`/status/instrument/${instrumentId}/recent`, { params: { limit } }),
  getStatistics: (instrumentId: string, hours?: number) => api.get(`/status/instrument/${instrumentId}/statistics`, { params: { hours } }),
  addStatus: (instrumentId: string, data: any) => api.post(`/status/instrument/${instrumentId}`, data),
};

export const budgetApi = {
  myGroup: () => api.get('/budget/my-group'),
  getGroups: () => api.get('/budget/groups'),
  getRecords: (groupId: string, params?: any) => api.get(`/budget/${groupId}/records`, { params }),
  recharge: (groupId: string, data: any) => api.post(`/budget/${groupId}/recharge`, data),
  setBudget: (groupId: string, data: any) => api.put(`/budget/${groupId}/set-budget`, data),
};

export const maintenanceApi = {
  getPlans: (params?: any) => api.get('/maintenance/plans', { params }),
  createPlan: (data: any) => api.post('/maintenance/plans', data),
  updatePlan: (id: string, data: any) => api.put(`/maintenance/plans/${id}`, data),
  getOrders: (params?: any) => api.get('/maintenance/orders', { params }),
  getOrder: (id: string) => api.get(`/maintenance/orders/${id}`),
  createOrder: (data: any) => api.post('/maintenance/orders', data),
  assignOrder: (id: string, data: any) => api.post(`/maintenance/orders/${id}/assign`, data),
  startOrder: (id: string) => api.post(`/maintenance/orders/${id}/start`),
  completeOrder: (id: string, data: any) => api.post(`/maintenance/orders/${id}/complete`, data),
  getEngineers: (params?: any) => api.get('/maintenance/engineers', { params }),
  createEngineer: (data: any) => api.post('/maintenance/engineers', data),
};

export const statisticsApi = {
  groupUsage: (params?: any) => api.get('/statistics/group/usage', { params }),
  instituteSummary: (params?: any) => api.get('/statistics/institute/summary', { params }),
  getMonthlyReports: () => api.get('/statistics/monthly-reports'),
  getMonthlyReport: (id: string) => api.get(`/statistics/monthly-reports/${id}`),
};

export const notificationsApi = {
  list: (params?: any) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  setPriority: (id: string, priority: number) => api.put(`/users/${id}/priority`, { priority }),
  getGroupMembers: () => api.get('/users/group/members'),
  getGroups: () => api.get('/users/groups/list'),
  createGroup: (data: any) => api.post('/users/groups', data),
};

export default api;
