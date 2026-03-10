import axios from 'axios';

const normalizeBaseUrl = (value?: string) => {
  const raw = (value || 'http://localhost:3000').trim();
  return raw.replace(/\/+$/, '');
};

export const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_URL),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  config.headers = config.headers ?? {};
  const headers = config.headers as { Authorization?: string; set?: (name: string, value: string) => void; delete?: (name: string) => void };

  if (token) {
    if (typeof headers.set === 'function') {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      headers.Authorization = `Bearer ${token}`;
    }
  } else {
    if (typeof headers.delete === 'function') {
      headers.delete('Authorization');
    } else {
      delete headers.Authorization;
    }
  }

  return config;
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
  const commonHeaders = api.defaults.headers.common as {
    Authorization?: string;
    set?: (name: string, value: string) => void;
    delete?: (name: string) => void;
  };

  if (token) {
    if (typeof commonHeaders.set === 'function') {
      commonHeaders.set('Authorization', `Bearer ${token}`);
    } else {
      commonHeaders.Authorization = `Bearer ${token}`;
    }
    return;
  }

  if (typeof commonHeaders.delete === 'function') {
    commonHeaders.delete('Authorization');
    return;
  }

  delete commonHeaders.Authorization;
};
