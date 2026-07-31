import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import type { UserProfile } from '@/types';
import type { VisitorLog } from '@/hooks/useVisitorApproval';

// ============================================================
// Types
// ============================================================

export interface ResidentDashboardData {
  pendingCount: number;
  recentVisitors: VisitorLog[];
  members: UserProfile[];
  loading: boolean;
  refresh(): Promise<void>;
}

// ============================================================
// Row mapper
// ============================================================

function mapVisitorRow(row: Record<string, unknown>): VisitorLog {
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

export function useResidentDashboard(flatId: string | null): ResidentDashboardData {
  const [pendingCount, setPendingCount] = useState(0);
  const [recentVisitors, setRecentVisitors] = useState<VisitorLog[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    if (!flatId) return;
    setLoading(true);
    try {
      // Fetch pending count, last 5 visitors, and flat members in parallel
      const [pendingResult, recentResult, membersResult] = await Promise.allSettled([
        // 1. Pending count
        supabase
          .from('visitor_logs')
          .select('id', { count: 'exact', head: true })
          .eq('flat_id', flatId)
          .eq('status', 'pending'),

        // 2. Last 5 visitors (any status)
        supabase
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
          .order('created_at', { ascending: false })
          .limit(5),

        // 3. Flat members via backend API (includes role from user_profiles)
        api.get<{ members: UserProfile[] }>(`/flats/${flatId}/members`),
      ]);

      // Handle pending count
      if (pendingResult.status === 'fulfilled') {
        setPendingCount(pendingResult.value.count ?? 0);
      }

      // Handle recent visitors
      if (recentResult.status === 'fulfilled' && recentResult.value.data) {
        setRecentVisitors(
          recentResult.value.data.map((row) => mapVisitorRow(row as Record<string, unknown>))
        );
      }

      // Handle members
      if (membersResult.status === 'fulfilled') {
        setMembers(membersResult.value.data.members ?? []);
      }
    } catch (err) {
      console.error('[useResidentDashboard] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [flatId]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription: update pending count on any visitor_log change for this flat
  useEffect(() => {
    if (!flatId) return;

    const channel = supabase
      .channel(`dashboard:flat_id=eq.${flatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitor_logs',
          filter: `flat_id=eq.${flatId}`,
        },
        async () => {
          // Re-fetch pending count only (lightweight)
          const { count } = await supabase
            .from('visitor_logs')
            .select('id', { count: 'exact', head: true })
            .eq('flat_id', flatId)
            .eq('status', 'pending');
          setPendingCount(count ?? 0);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [flatId]);

  return { pendingCount, recentVisitors, members, loading, refresh };
}
