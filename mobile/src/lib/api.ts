import axios, { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'supabase_session';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: inject Supabase session token
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

// Response interceptor: global error normalisation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response as {
        status: number;
        data: { message?: string };
      };
      console.error(`[api] ${status}:`, data?.message ?? error.message);
    } else {
      console.error('[api] Network error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
