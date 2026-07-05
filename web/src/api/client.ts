import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const api = axios.create({ baseURL });

const ACCESS = 'yard_access';
const REFRESH = 'yard_refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

api.interceptors.request.use((config) => {
  const t = tokens.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Transparent access-token refresh on 401.
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && tokens.refresh) {
      original._retry = true;
      refreshing ??= (async () => {
        try {
          const { data } = await axios.post(`${baseURL}/auth/refresh`, {
            refreshToken: tokens.refresh,
          });
          tokens.set(data.accessToken, data.refreshToken);
          return data.accessToken as string;
        } catch {
          tokens.clear();
          return null;
        } finally {
          refreshing = null;
        }
      })();
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export function apiError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const m = e.response?.data?.message;
    return Array.isArray(m) ? m.join(', ') : (m ?? e.message);
  }
  return String(e);
}
