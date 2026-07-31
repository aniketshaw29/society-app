import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { UserProfile } from '@/types';

// ============================================================
// Types
// ============================================================

export interface AddMemberData {
  phone: string;
  fullName: string;
  residentType: 'owner' | 'tenant';
}

export interface UseFlatMembersResult {
  members: UserProfile[];
  loading: boolean;
  addMember(data: AddMemberData): Promise<void>;
  removeMember(memberId: string): Promise<void>;
  refresh(): Promise<void>;
}

// ============================================================
// Hook
// ============================================================

export function useFlatMembers(flatId: string | null): UseFlatMembersResult {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    if (!flatId) return;
    setLoading(true);
    try {
      const res = await api.get<{ members: UserProfile[] }>(
        `/flats/${flatId}/members`
      );
      setMembers(res.data.members ?? []);
    } catch (err) {
      console.error('[useFlatMembers] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [flatId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addMember = useCallback(
    async (data: AddMemberData): Promise<void> => {
      if (!flatId) throw new Error('No flat ID');
      const res = await api.post<{ member: UserProfile }>(
        `/flats/${flatId}/members`,
        data
      );
      setMembers((prev) => [...prev, res.data.member]);
    },
    [flatId]
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<void> => {
      if (!flatId) throw new Error('No flat ID');
      await api.delete(`/flats/${flatId}/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    },
    [flatId]
  );

  return { members, loading, addMember, removeMember, refresh };
}
