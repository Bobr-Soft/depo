import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Automatikus autentikáció kezelés
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Ha lejárt/érvénytelen a token, töröljük és átirányítunk a login oldalra
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};
