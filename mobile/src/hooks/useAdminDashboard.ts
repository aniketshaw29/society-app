import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { AxiosError } from 'axios';

// ============================================================
// Types
// ============================================================

export interface AdminStats {
  totalFlats: number;
  occupiedFlats: number;
  guardsOnDuty: number;
  visitorsToday: number;
  activeSos: number;
  visitorTrend: Array<{ date: string; count: number }>;
}

export interface ActivityItem {
  type: 'visitor' | 'sos';
  id: string;
  summary: string;
  createdAt: string;
  status: string;
}

// ============================================================
// Error helper
// ============================================================

function extractMessage(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ error?: { message: string }; message?: string }>;
  return (
    e.response?.data?.error?.message ??
    e.response?.data?.message ??
    fallback
  );
}

// ============================================================
// Hook
// ============================================================

export interface UseAdminDashboardReturn {
  stats: AdminStats | null;
  activity: ActivityItem[];
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

export function useAdminDashboard(): UseAdminDashboardReturn {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, activityRes] = await Promise.allSettled([
        api.get<AdminStats>('/admin/stats'),
        api.get<{ activity: ActivityItem[] }>('/admin/activity'),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      } else {
        setError(extractMessage(statsRes.reason, 'Failed to load stats'));
      }

      if (activityRes.status === 'fulfilled') {
        setActivity(activityRes.value.data.activity ?? []);
      }
    } catch (err) {
      setError(extractMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, activity, loading, error, refresh };
}
