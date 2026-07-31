import { useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import type { AxiosError } from 'axios';

// ============================================================
// Types
// ============================================================

export interface SocietyPreview {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  totalFlats: number;
}

export interface JoinedProfile {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  societyId: string;
  flatId: string;
}

interface UseJoinSocietyReturn {
  loading: boolean;
  error: string | null;
  foundSociety: SocietyPreview | null;
  lookupInviteCode: (code: string) => Promise<SocietyPreview | null>;
  joinSociety: (
    societyId: string,
    flatId: string,
    residentType: 'owner' | 'tenant',
    fullName: string,
    inviteCode: string
  ) => Promise<void>;
  clearError: () => void;
  clearFoundSociety: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosError = err as AxiosError<{ error?: { message: string }; message?: string }>;
  return (
    axiosError.response?.data?.error?.message ??
    axiosError.response?.data?.message ??
    fallback
  );
}

// ============================================================
// Hook
// ============================================================

export function useJoinSociety(): UseJoinSocietyReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundSociety, setFoundSociety] = useState<SocietyPreview | null>(null);

  const setRole = useAuthStore((s) => s.setRole);
  const setSocietyId = useAuthStore((s) => s.setSocietyId);
  const setFlatId = useAuthStore((s) => s.setFlatId);
  const setSociety = useSocietyStore((s) => s.setSociety);

  /**
   * Look up a society by invite code.
   * Returns the society preview on success, null on 404/error.
   */
  const lookupInviteCode = async (code: string): Promise<SocietyPreview | null> => {
    setLoading(true);
    setError(null);
    setFoundSociety(null);

    try {
      const res = await api.get<{ society: SocietyPreview }>(
        `/societies/by-invite/${code.toUpperCase()}`
      );
      setFoundSociety(res.data.society);
      return res.data.society;
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: { code: string; message: string } }>;
      if (axiosError.response?.status === 404) {
        setError('No society found for this invite code. Please check and try again.');
      } else {
        setError(extractErrorMessage(err, 'Failed to look up invite code'));
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Join a society after code lookup and flat selection.
   */
  const joinSociety = async (
    societyId: string,
    flatId: string,
    residentType: 'owner' | 'tenant',
    fullName: string,
    inviteCode: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{
        profile: JoinedProfile;
        society: { id: string; name: string };
      }>(`/societies/${societyId}/join`, {
        inviteCode: inviteCode.toUpperCase(),
        flatId,
        residentType,
        fullName,
      });

      const { profile, society } = res.data;

      // Update auth store
      setRole(profile.role as 'flat_owner' | 'tenant');
      setSocietyId(profile.societyId);
      setFlatId(profile.flatId);

      // Update society store with basic info
      setSociety({
        id: society.id,
        name: society.name,
        address: foundSociety?.address ?? '',
        city: foundSociety?.city ?? '',
        state: foundSociety?.state ?? '',
        pincode: '',
        inviteCode: inviteCode.toUpperCase(),
        adminId: '',
        totalBuildings: 0,
        totalFlats: foundSociety?.totalFlats ?? 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: { code: string; message: string } }>;
      if (axiosError.response?.status === 409) {
        setError('You have already joined this society and flat.');
      } else {
        setError(extractErrorMessage(err, 'Failed to join society. Please try again.'));
      }
      throw err; // re-throw so the screen can decide not to navigate
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    foundSociety,
    lookupInviteCode,
    joinSociety,
    clearError: () => setError(null),
    clearFoundSociety: () => setFoundSociety(null),
  };
}
