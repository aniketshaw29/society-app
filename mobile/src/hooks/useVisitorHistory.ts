import { useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import type { VisitorLog, VisitorLogStatus, HistoryFilters } from '@/types';

interface VisitorHistoryResponse {
  visitors: VisitorLog[];
  total: number;
  page: number;
  totalPages: number;
}

interface UseVisitorHistoryResult {
  visitors: VisitorLog[];
  loading: boolean;
  hasMore: boolean;
  total: number;
  fetchPage: (page: number, filters: HistoryFilters) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for paginated visitor history.
 * scope='guard'    → fetches all visitors for the society
 * scope='resident' → fetches only this resident's flat visitors
 */
export function useVisitorHistory(scope: 'guard' | 'resident'): UseVisitorHistoryResult {
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Track current page and filters so loadMore can re-use them
  const currentPageRef = useRef(1);
  const currentFiltersRef = useRef<HistoryFilters>({});

  const fetchPage = useCallback(
    async (page: number, filters: HistoryFilters): Promise<void> => {
      setLoading(true);
      try {
        const params = buildQueryParams(page, filters, scope);
        const res = await api.get<VisitorHistoryResponse>(
          `/visitors/history?${params}`
        );
        const data = res.data;

        if (page === 1) {
          setVisitors(data.visitors);
        } else {
          setVisitors((prev) => [...prev, ...data.visitors]);
        }

        setTotal(data.total);
        setHasMore(page < data.totalPages);
        currentPageRef.current = page;
        currentFiltersRef.current = filters;
      } finally {
        setLoading(false);
      }
    },
    [scope]
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (loading || !hasMore) return;
    await fetchPage(currentPageRef.current + 1, currentFiltersRef.current);
  }, [loading, hasMore, fetchPage]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchPage(1, currentFiltersRef.current);
  }, [fetchPage]);

  return { visitors, loading, hasMore, total, fetchPage, loadMore, refresh };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryParams(
  page: number,
  filters: HistoryFilters,
  scope: 'guard' | 'resident'
): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(filters.limit ?? 20));
  params.set('scope', scope);

  if (filters.status) {
    params.set('status', filters.status as VisitorLogStatus);
  }
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.flatId) params.set('flatId', filters.flatId);
  if (filters.search && filters.search.trim()) {
    params.set('search', filters.search.trim());
  }

  // Expand date range shortcuts to concrete fromDate/toDate
  if (filters.dateRange && !filters.fromDate) {
    const { from, to } = resolveDateRange(filters.dateRange);
    params.set('fromDate', from);
    params.set('toDate', to);
  }

  return params.toString();
}

function resolveDateRange(range: HistoryFilters['dateRange']): {
  from: string;
  to: string;
} {
  const now = new Date();
  const today = now.toISOString().split('T')[0]!;

  if (range === 'today') {
    return { from: today, to: today };
  }
  if (range === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return { from: weekAgo.toISOString().split('T')[0]!, to: today };
  }
  if (range === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);
    return { from: monthAgo.toISOString().split('T')[0]!, to: today };
  }
  return { from: today, to: today };
}
