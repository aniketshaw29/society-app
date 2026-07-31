import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { Notice, CreateNoticeInput } from '@/types';

// ---------------------------------------------------------------------------
// Error helper (shared pattern with other hooks)
// ---------------------------------------------------------------------------

function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
    return axiosErr.response?.data?.error?.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// useNotices
// ---------------------------------------------------------------------------

export function useNotices(scope: 'resident' | 'admin') {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = scope === 'admin' ? '/notices/admin' : '/notices';
      const { data } = await api.get<{ notices: Notice[] }>(endpoint);
      setNotices(data.notices ?? []);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to load notices');
      setError(msg);
      console.error('[useNotices] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Admin-only: create a new notice
  const create = useCallback(async (data: CreateNoticeInput): Promise<Notice> => {
    const { data: res } = await api.post<{ notice: Notice }>('/notices', data);
    const created = res.notice;
    setNotices((prev) => [created, ...prev]);
    return created;
  }, []);

  // Admin-only: update a notice
  const update = useCallback(
    async (id: string, data: Partial<CreateNoticeInput>): Promise<Notice> => {
      const { data: res } = await api.patch<{ notice: Notice }>(`/notices/${id}`, data);
      const updated = res.notice;
      setNotices((prev) => prev.map((n) => (n.id === id ? updated : n)));
      return updated;
    },
    []
  );

  // Admin-only: archive (soft-delete) a notice
  const archive = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/notices/${id}`);
    setNotices((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'archived' as const } : n))
    );
  }, []);

  return {
    notices,
    loading,
    error,
    create,
    update,
    archive,
    refresh,
  };
}
