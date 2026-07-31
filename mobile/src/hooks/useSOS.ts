import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { SosAlert } from '@/types';

// ============================================================
// useSOS
// ============================================================

export function useSOS() {
  const [history, setHistory] = useState<SosAlert[]>([]);
  const [activeAlert, setActiveAlert] = useState<SosAlert | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Fetch history ─────────────────────────────────────────

  const fetchHistory = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { data } = await api.get<{ alerts: SosAlert[] }>('/sos/history', {
        params: { limit: 20, page: 1 },
      });
      const alerts = data.alerts ?? [];
      setHistory(alerts);
      // Set activeAlert to the most recent active one (if any)
      const active = alerts.find((a) => a.status === 'active') ?? null;
      setActiveAlert(active);
    } catch (err) {
      console.error('[useSOS] fetchHistory error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // ── Trigger SOS ───────────────────────────────────────────

  const trigger = useCallback(async (message?: string): Promise<SosAlert> => {
    setLoading(true);
    try {
      const { data } = await api.post<{ sos: SosAlert }>('/sos', {
        message: message ?? undefined,
      });
      const newAlert = data.sos;
      // Prepend to history and set as active
      setHistory((prev) => [newAlert, ...prev]);
      setActiveAlert(newAlert);
      return newAlert;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Resolve SOS ───────────────────────────────────────────

  const resolve = useCallback(async (sosId: string): Promise<void> => {
    const { data } = await api.patch<{ sos: SosAlert }>(`/sos/${sosId}/resolve`);
    const resolved = data.sos;
    setHistory((prev) =>
      prev.map((a) => (a.id === sosId ? resolved : a))
    );
    if (activeAlert?.id === sosId) {
      setActiveAlert(null);
    }
  }, [activeAlert]);

  return {
    trigger,
    resolve,
    history,
    activeAlert,
    loading,
    fetchHistory,
  };
}
