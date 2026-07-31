import { useState } from 'react';
import api from '@/lib/api';
import { useSocietyStore } from '@/stores/societyStore';
import { useAuthStore } from '@/stores/authStore';
import type { AxiosError } from 'axios';

export interface CreateSocietyBody {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalBuildings?: number;
}

export interface CreatedSociety {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  invite_code: string;
  total_flats: number;
  is_active: boolean;
  created_at: string;
}

interface DuplicateWarning {
  warning: true;
  message: string;
  existingSociety: { id: string; name: string; city: string; pincode: string };
}

interface UseSocietyRegistrationReturn {
  loading: boolean;
  error: string | null;
  duplicateWarning: DuplicateWarning | null;
  registerSociety: (body: CreateSocietyBody) => Promise<CreatedSociety | null>;
  clearError: () => void;
  clearWarning: () => void;
}

export function useSocietyRegistration(): UseSocietyRegistrationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);

  const setSociety = useSocietyStore((s) => s.setSociety);
  const setRole = useAuthStore((s) => s.setRole);
  const setSocietyId = useAuthStore((s) => s.setSocietyId);

  const registerSociety = async (body: CreateSocietyBody): Promise<CreatedSociety | null> => {
    setLoading(true);
    setError(null);
    setDuplicateWarning(null);

    try {
      const response = await api.post<{ society: CreatedSociety }>('/societies', body);
      const society = response.data.society;

      // Update stores
      setSociety({
        id: society.id,
        name: society.name,
        address: society.address,
        city: society.city,
        state: society.state,
        pincode: society.pincode,
        inviteCode: society.invite_code,
        adminId: '',
        totalBuildings: body.totalBuildings ?? 0,
        totalFlats: 0,
        isActive: society.is_active,
        createdAt: society.created_at,
        updatedAt: society.created_at,
      });
      setRole('society_admin');
      setSocietyId(society.id);

      return society;
    } catch (err) {
      const axiosError = err as AxiosError<{ warning?: boolean; message?: string; error?: { message: string } }>;

      if (axiosError.response?.status === 409) {
        const data = axiosError.response.data;
        if (data?.warning) {
          setDuplicateWarning(data as DuplicateWarning);
          return null;
        }
      }

      const message =
        axiosError.response?.data?.error?.message ??
        axiosError.response?.data?.message ??
        'Failed to create society. Please try again.';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    duplicateWarning,
    registerSociety,
    clearError: () => setError(null),
    clearWarning: () => setDuplicateWarning(null),
  };
}
