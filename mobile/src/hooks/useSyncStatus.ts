// ---------------------------------------------------------------------------
// useSyncStatus — exposes sync queue state and network connectivity
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from 'react';
import { startNetworkMonitor, isOnline } from '@/services/networkMonitor';
import {
  processQueue,
  getPendingCount,
  getAbandonedCount,
} from '@/services/syncService';

export interface UseSyncStatusResult {
  isOnline: boolean;
  pendingCount: number;
  abandonedCount: number;
  lastSyncAt: Date | null;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
}

export function useSyncStatus(): UseSyncStatusResult {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [abandonedCount, setAbandonedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncingRef = useRef(false); // guard against concurrent syncs

  // ── Refresh queue counts ───────────────────────────────────────────────

  const refreshCounts = useCallback(async () => {
    const [pending, abandoned] = await Promise.all([
      getPendingCount(),
      getAbandonedCount(),
    ]);
    setPendingCount(pending);
    setAbandonedCount(abandoned);
  }, []);

  // ── Trigger sync ───────────────────────────────────────────────────────

  const triggerSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      await processQueue();
      setLastSyncAt(new Date());
    } catch (err) {
      console.warn('[useSyncStatus] sync failed:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshCounts();
    }
  }, [refreshCounts]);

  // ── Initial connectivity check ─────────────────────────────────────────

  useEffect(() => {
    void isOnline().then(setOnline);
  }, []);

  // ── Network monitor ────────────────────────────────────────────────────

  useEffect(() => {
    const cleanup = startNetworkMonitor(
      () => {
        setOnline(true);
        // Auto-trigger sync when connectivity returns
        void triggerSync();
      },
      () => {
        setOnline(false);
      }
    );
    return cleanup;
  }, [triggerSync]);

  // ── Poll queue counts every 5 s ─────────────────────────────────────────

  useEffect(() => {
    void refreshCounts();
    const interval = setInterval(() => void refreshCounts(), 5_000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  return {
    isOnline: online,
    pendingCount,
    abandonedCount,
    lastSyncAt,
    isSyncing,
    triggerSync,
  };
}
