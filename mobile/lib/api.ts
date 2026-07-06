import axios from 'axios';
import { API_URL } from './config';
import { tokens } from './tokens';

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && tokens.refresh) {
      original._retry = true;
      refreshing ??= (async () => {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken: tokens.refresh,
          });
          await tokens.set(data.accessToken, data.refreshToken);
          return data.accessToken as string;
        } catch {
          await tokens.clear();
          return null;
        } finally {
          refreshing = null;
        }
      })();
      const next = await refreshing;
      if (next) {
        original.headers.Authorization = `Bearer ${next}`;
        return api(original);
      }
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
