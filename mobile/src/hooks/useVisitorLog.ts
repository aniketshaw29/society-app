import api from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { VisitorLog, VisitorLogStatus } from '@/types';

// ============================================================
// Types
// ============================================================

export interface CreateVisitorInput {
  flatId: string;
  visitorName: string;
  visitorPhone?: string;
  purpose: 'guest' | 'delivery' | 'service' | 'cab' | 'other';
  vehicleNumber?: string;
  entryMethod: 'manual';
}

// ============================================================
// Hook
// ============================================================

/**
 * Encapsulates all visitor-log API operations for the guard flow.
 * Pure functions — no React state. Screens compose this with useState/useCallback.
 */
export function useVisitorLog() {
  // ── Submit Visitor ──────────────────────────────────────────────────────

  /**
   * Creates a new visitor_logs row via POST /visitors.
   * Throws if visitorName is blank or the API call fails.
   */
  const submitVisitor = async (data: CreateVisitorInput): Promise<VisitorLog> => {
    if (!data.visitorName || data.visitorName.trim().length === 0) {
      throw new Error('Visitor name is required.');
    }

    const response = await api.post<{ visitor: VisitorLog }>('/visitors', {
      flatId: data.flatId,
      visitorName: data.visitorName.trim(),
      visitorPhone: data.visitorPhone ?? undefined,
      purpose: data.purpose,
      vehicleNumber: data.vehicleNumber ?? undefined,
      entryMethod: data.entryMethod,
    });

    return response.data.visitor;
  };

  // ── Mark Exit ───────────────────────────────────────────────────────────

  /**
   * Marks a visitor as exited via PATCH /visitors/:id/exit.
   */
  const markExit = async (visitorId: string): Promise<void> => {
    await api.patch(`/visitors/${visitorId}/exit`);
  };

  // ── Fetch Active ────────────────────────────────────────────────────────

  /**
   * Returns the guard's active visitor list (pending/approved/entered).
   */
  const fetchActive = async (): Promise<VisitorLog[]> => {
    const response = await api.get<{ visitors: VisitorLog[] }>('/visitors/active');
    return response.data.visitors;
  };

  // ── Subscribe to Active ─────────────────────────────────────────────────

  /**
   * Opens a Supabase realtime channel on visitor_logs.
   * Calls onUpdate with the full refreshed list whenever a row changes.
   * Returns an unsubscribe function — call it on component unmount.
   */
  const subscribeToActive = (
    onUpdate: (visitors: VisitorLog[]) => void
  ): (() => void) => {
    const channel = supabase
      .channel('visitor_logs_active')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_logs',
          filter: `status=in.(pending,approved,entered)`,
        },
        async () => {
          // Re-fetch the full list on any change so the caller
          // always gets a consistent ordered snapshot.
          try {
            const updated = await fetchActive();
            onUpdate(updated);
          } catch (err) {
            console.warn('[useVisitorLog] realtime re-fetch failed:', err);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  };

  return {
    submitVisitor,
    markExit,
    fetchActive,
    subscribeToActive,
  };
}

// ============================================================
// Status badge helper (used by VisitorCard)
// ============================================================

export const STATUS_LABELS: Record<VisitorLogStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  entered: 'Entered',
  exited: 'Exited',
  expired: 'Expired',
};

export const STATUS_COLORS: Record<VisitorLogStatus, string> = {
  pending: '#F59E0B',
  approved: '#10B981',
  denied: '#EF4444',
  entered: '#3B82F6',
  exited: '#6B7280',
  expired: '#9CA3AF',
};
