import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { PreApproval, CreatePreApprovalInput } from '@/types';

// ============================================================
// usePreApprovals
// ============================================================

export function usePreApprovals() {
  const [preApprovals, setPreApprovals] = useState<PreApproval[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ preApprovals: PreApproval[] }>('/pre-approvals');
      setPreApprovals(data.preApprovals ?? []);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to load pre-approvals');
      setError(msg);
      console.error('[usePreApprovals] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Create ─────────────────────────────────────────────────────────────────

  const create = useCallback(
    async (input: CreatePreApprovalInput): Promise<PreApproval> => {
      const { data } = await api.post<{ preApproval: PreApproval }>('/pre-approvals', input);
      const created = data.preApproval;
      // Optimistically prepend — the list refresh will reconcile
      setPreApprovals((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const cancel = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/pre-approvals/${id}`);
    // Update local state immediately
    setPreApprovals((prev) =>
      prev.map((pa) =>
        pa.id === id ? { ...pa, status: 'cancelled' as const } : pa
      )
    );
  }, []);

  return {
    preApprovals,
    loading,
    error,
    create,
    cancel,
    refresh,
  };
}

// ============================================================
// Error helper
// ============================================================

function extractErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err
  ) {
    const axiosErr = err as {
      response?: { data?: { error?: { message?: string } } };
    };
    return axiosErr.response?.data?.error?.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
