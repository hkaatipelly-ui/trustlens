import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tl_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const authRequest = /\/api\/auth\/(login|register)$/.test(error.config?.url || '');
    if (error.response?.status === 401 && !authRequest) {
      localStorage.removeItem('tl_token');
      window.dispatchEvent(new Event('tl:session-expired'));
    }
    return Promise.reject(error);
  },
);

export default api;
