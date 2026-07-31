import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface VisitorLog {
  id: string;
  societyId: string;
  flatId: string;
  guardId: string | null;
  visitorName: string;
  visitorPhone: string | null;
  visitorPhotoUrl: string | null;
  vehicleNumber: string | null;
  purpose: string;
  entryMethod: string;
  status: 'pending' | 'approved' | 'denied' | 'entered' | 'exited' | 'expired';
  approvedBy: string | null;
  approvedAt: string | null;
  entryTime: string | null;
  exitTime: string | null;
  createdAt: string;
  updatedAt: string;
  flat?: {
    flatNumber: string;
    buildingName: string | null;
  };
}

// ============================================================
// Raw DB row → VisitorLog mapper
// ============================================================

function mapRow(row: Record<string, unknown>): VisitorLog {
  const flat = row['flats'] as
    | { flat_number: string; buildings: { name: string } | null }
    | null
    | undefined;
  return {
    id: row['id'] as string,
    societyId: (row['society_id'] as string) ?? '',
    flatId: (row['flat_id'] as string) ?? '',
    guardId: (row['guard_id'] as string | null) ?? null,
    visitorName: (row['visitor_name'] as string) ?? '',
    visitorPhone: (row['visitor_phone'] as string | null) ?? null,
    visitorPhotoUrl: (row['visitor_photo_url'] as string | null) ?? null,
    vehicleNumber: (row['vehicle_number'] as string | null) ?? null,
    purpose: (row['purpose'] as string) ?? '',
    entryMethod: (row['entry_method'] as string) ?? 'manual',
    status: (row['status'] as VisitorLog['status']) ?? 'pending',
    approvedBy: (row['approved_by'] as string | null) ?? null,
    approvedAt: (row['approved_at'] as string | null) ?? null,
    entryTime: (row['entry_time'] as string | null) ?? null,
    exitTime: (row['exit_time'] as string | null) ?? null,
    createdAt: (row['created_at'] as string) ?? '',
    updatedAt: (row['updated_at'] as string) ?? '',
    flat: flat
      ? {
          flatNumber: flat.flat_number,
          buildingName: flat.buildings?.name ?? null,
        }
      : undefined,
  };
}

// ============================================================
// Hook
// ============================================================

export function useVisitorApproval() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------------------------------------
  // Fetch all pending visitors for a flat (used on home screen)
  // ----------------------------------------------------------
  const fetchPendingForFlat = useCallback(
    async (flatId: string): Promise<VisitorLog[]> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from('visitor_logs')
          .select(
            `id, society_id, flat_id, guard_id,
             visitor_name, visitor_phone, visitor_photo_url,
             vehicle_number, purpose, entry_method, status,
             approved_by, approved_at, entry_time, exit_time,
             created_at, updated_at,
             flats ( flat_number, buildings ( name ) )`
          )
          .eq('flat_id', flatId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (dbError) throw new Error(dbError.message);
        return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch visitors';
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ----------------------------------------------------------
  // Fetch a single visitor by ID (used on approval screen)
  // ----------------------------------------------------------
  const fetchVisitorDetail = useCallback(
    async (visitorId: string): Promise<VisitorLog> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<{ visitor: Record<string, unknown> }>(
          `/visitors/${visitorId}`
        );
        return mapRow(response.data.visitor);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch visitor';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ----------------------------------------------------------
  // Approve a visitor
  // ----------------------------------------------------------
  const approveVisitor = useCallback(async (visitorId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/visitors/${visitorId}/approve`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve visitor';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------------------------------------
  // Deny a visitor
  // ----------------------------------------------------------
  const denyVisitor = useCallback(async (visitorId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/visitors/${visitorId}/deny`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deny visitor';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------------------------------------
  // Realtime subscription — returns unsubscribe callback
  // ----------------------------------------------------------
  const subscribeToFlatVisitors = useCallback(
    (flatId: string, cb: (visitors: VisitorLog[]) => void): (() => void) => {
      const channel = supabase
        .channel(`visitor_logs:flat_id=eq.${flatId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visitor_logs',
            filter: `flat_id=eq.${flatId}`,
          },
          async () => {
            // Re-fetch the current pending list on any change
            const { data } = await supabase
              .from('visitor_logs')
              .select(
                `id, society_id, flat_id, guard_id,
                 visitor_name, visitor_phone, visitor_photo_url,
                 vehicle_number, purpose, entry_method, status,
                 approved_by, approved_at, entry_time, exit_time,
                 created_at, updated_at,
                 flats ( flat_number, buildings ( name ) )`
              )
              .eq('flat_id', flatId)
              .eq('status', 'pending')
              .order('created_at', { ascending: false });

            cb((data ?? []).map((row) => mapRow(row as Record<string, unknown>)));
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    },
    []
  );

  return {
    loading,
    error,
    fetchPendingForFlat,
    fetchVisitorDetail,
    approveVisitor,
    denyVisitor,
    subscribeToFlatVisitors,
  };
}
