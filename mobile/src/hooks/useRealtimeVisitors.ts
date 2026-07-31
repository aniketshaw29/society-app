import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import type { VisitorLog } from '@/types';

interface UseRealtimeVisitorsResult {
  visitors: VisitorLog[];
  isConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Subscribes to real-time visitor_logs changes for the given society.
 * Manages channel lifecycle (subscribe on mount, unsubscribe on unmount).
 * Reconnects when app returns to foreground after being backgrounded.
 */
export function useRealtimeVisitors(societyId: string): UseRealtimeVisitorsResult {
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchInitial = useCallback(async () => {
    if (!societyId) return;
    try {
      const res = await api.get<{ visitors: VisitorLog[] }>(
        `/visitors?societyId=${societyId}&limit=50`
      );
      setVisitors(res.data.visitors ?? []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load visitors';
      setError(message);
    }
  }, [societyId]);

  const subscribeToChannel = useCallback(() => {
    if (!societyId) return;

    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`visitor_logs:society_id=eq.${societyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_logs',
          filter: `society_id=eq.${societyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newVisitor = dbRowToVisitorLog(payload.new as DbVisitorRow);
            setVisitors((prev) => [newVisitor, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = dbRowToVisitorLog(payload.new as DbVisitorRow);
            setVisitors((prev) =>
              prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setVisitors((prev) => prev.filter((v) => v.id !== deletedId));
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          setError('Realtime connection lost. Pull to refresh.');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;
  }, [societyId]);

  // Initial data fetch + channel subscription
  useEffect(() => {
    if (!societyId) return;

    fetchInitial();
    subscribeToChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [societyId, fetchInitial, subscribeToChannel]);

  // Reconnect when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (previous === 'background' || previous === 'inactive') &&
        nextState === 'active'
      ) {
        // Re-fetch latest and resubscribe in case the connection dropped
        fetchInitial();
        subscribeToChannel();
      }
    });

    return () => subscription.remove();
  }, [fetchInitial, subscribeToChannel]);

  return {
    visitors,
    isConnected,
    error,
    refresh: fetchInitial,
  };
}

// ---------------------------------------------------------------------------
// DB row → VisitorLog mapper
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
