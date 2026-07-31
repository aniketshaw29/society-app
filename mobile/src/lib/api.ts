import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getErrorMessage } from './errorCodes';

const SESSION_KEY = 'supabase_session';

// ── Lazy import for authStore to avoid circular deps ──────────────────────────
// We import dynamically at call-time so the module graph stays clean.
async function clearAuthAndRedirect(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Best-effort; session may already be gone
  }
  try {
    // Dynamically import to avoid circular dependency
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().clearAuth();
  } catch {
    // Store may not be initialised yet
  }
  // Redirect to login via expo-router (imported lazily for the same reason)
  try {
    const { router } = await import('expo-router');
    router.replace('/(auth)/login');
  } catch {
    // Router not ready — navigation will fall through to route guard
  }
}

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request interceptor: inject Supabase session token ────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as { access_token?: string };
        if (session?.access_token) {
          config.headers.set('Authorization', `Bearer ${session.access_token}`);
        }
      }
    } catch (err) {
      // Session read failed — continue without token
      console.warn('[api] Could not read session from SecureStore:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: retry + error normalisation ─────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (typeof error.config & { _retryCount?: number }) | undefined;

    // ── 401 Unauthorized: clear session and redirect to login ──────────────
    if (error.response?.status === 401) {
      console.warn('[api] 401 received — clearing session');
      await clearAuthAndRedirect();
      const code = 'unauthorized';
      return Promise.reject({ code, message: getErrorMessage(code), status: 401 });
    }

    // ── Retry on 5xx or network error (up to 2 times) ──────────────────────
    if (config) {
      config._retryCount = config._retryCount ?? 0;
      const isNetworkError = !error.response;
      const is5xx = error.response !== undefined && error.response.status >= 500;

      if ((isNetworkError || is5xx) && config._retryCount < 2) {
        config._retryCount++;
        const delayMs = 1000 * config._retryCount; // 1 s, then 2 s
        console.warn(
          `[api] Retry ${config._retryCount}/2 in ${delayMs}ms (${
            isNetworkError ? 'network error' : `HTTP ${error.response?.status}`
          })`
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        return api(config);
      }
    }

    // ── Extract structured error from backend response ─────────────────────
    const responseData = error.response?.data as
      | { error?: { code?: string; message?: string; details?: unknown } }
      | undefined;

    const code: string =
      responseData?.error?.code ??
      (error.response ? 'server_error' : 'network_error');

    const message = getErrorMessage(code);

    if (__DEV__) {
      console.error('[api] Request failed:', {
        url: error.config?.url,
        status: error.response?.status,
        code,
        message,
      });
    }

    return Promise.reject({
      code,
      message,
      status: error.response?.status,
      details: responseData?.error?.details,
    });
  }
);

export default api;
