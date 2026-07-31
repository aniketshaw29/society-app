// ---------------------------------------------------------------------------
// useLocalVisitors — reads from SQLite + subscribes to Supabase Realtime
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  getTodayLocalVisitors,
  updateLocalVisitor,
  getLocalVisitorByLocalId,
} from '@/lib/db/visitors';
import {
  resolveStatusConflict,
  resolveExitTime,
} from '@/services/conflictResolver';
import { logConflict } from '@/lib/db/conflicts';
import type { LocalVisitor, VisitorLog } from '@/types';

// ---------------------------------------------------------------------------
// DB row mapper (matches Supabase snake_case column names)
// ---------------------------------------------------------------------------

interface DbVisitorRow {
  id: string;
  society_id: string;
  flat_id: string;
  guard_id?: string | null;
  visitor_name: string;
  visitor_phone?: string | null;
  visitor_photo_url?: string | null;
  vehicle_number?: string | null;
  purpose?: string | null;
  entry_method: string;
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  created_at: string;
  updated_at: string;
}

function dbRowToVisitorLog(row: DbVisitorRow): VisitorLog {
  return {
    id: row.id,
    societyId: row.society_id,
    flatId: row.flat_id,
    guardId: row.guard_id ?? null,
    visitorName: row.visitor_name,
    visitorPhone: row.visitor_phone ?? null,
    visitorPhotoUrl: row.visitor_photo_url ?? null,
    vehicleNumber: row.vehicle_number ?? null,
    purpose: row.purpose ?? null,
    entryMethod: row.entry_method as VisitorLog['entryMethod'],
    status: row.status as VisitorLog['status'],
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    entryTime: row.entry_time ?? null,
    exitTime: row.exit_time ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseLocalVisitorsResult {
  visitors: LocalVisitor[];
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Subscribes to Supabase Realtime visitor_logs updates for the society.
   * When the resident approves/denies a visitor, the Realtime event fires and
   * the local SQLite record is updated with the conflict-resolved status.
   *
   * Returns a cleanup / unsubscribe function.
   */
  subscribeToStatusUpdates: () => () => void;
}

export function useLocalVisitors(societyId: string): UseLocalVisitorsResult {
  const [visitors, setVisitors] = useState<LocalVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Refresh local visitor list from SQLite ─────────────────────────────

  const refresh = useCallback(async () => {
    if (!societyId) return;
    setLoading(true);
    try {
      const rows = await getTodayLocalVisitors(societyId);
      setVisitors(rows);
    } catch (err) {
      console.warn('[useLocalVisitors] refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Realtime subscription ──────────────────────────────────────────────

  const subscribeToStatusUpdates = useCallback((): (() => void) => {
    if (!societyId) return () => undefined;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`local_visitors_status:${societyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'visitor_logs',
          filter: `society_id=eq.${societyId}`,
        },
        async (payload) => {
          const serverUpdate = dbRowToVisitorLog(payload.new as DbVisitorRow);

          // Find the matching local record by server id
          let localRecord: LocalVisitor | null = null;

          // Try by server id first
          setVisitors((prev) => {
            const found = prev.find((v) => v.id === serverUpdate.id);
            if (found) localRecord = found;
            return prev; // no-op — we just need to read the value
          });

          if (!localRecord) return;

          const local = localRecord as LocalVisitor;

          // Resolve status conflict
          const { resolvedStatus, hadConflict: statusConflict } = resolveStatusConflict(
            local,
            serverUpdate
          );

          if (statusConflict) {
            await logConflict({
              visitorLocalId: local.localId,
              conflictType: 'status_conflict',
              localValue: local.status,
              serverValue: serverUpdate.status,
              resolvedValue: resolvedStatus,
            });
          }

          // Resolve exit_time conflict
          const { resolvedExitTime, hadConflict: exitConflict } = resolveExitTime(
            local,
            serverUpdate
          );

          if (exitConflict) {
            await logConflict({
              visitorLocalId: local.localId,
              conflictType: 'exit_time_conflict',
              localValue: local.exitTime ?? '',
              serverValue: serverUpdate.exitTime ?? '',
              resolvedValue: resolvedExitTime ?? '',
            });
          }

          // Persist resolved values to SQLite
          await updateLocalVisitor(local.localId, {
            status: resolvedStatus as LocalVisitor['status'],
            exitTime: resolvedExitTime,
          });

          // Refresh in-memory state
          await refresh();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [societyId, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return {
    visitors,
    loading,
    refresh,
    subscribeToStatusUpdates,
  };
}
