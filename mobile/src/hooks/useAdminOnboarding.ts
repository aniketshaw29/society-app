import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { AxiosError } from 'axios';

// ============================================================
// Types
// ============================================================

export interface Building {
  id: string;
  societyId: string;
  name: string;
  totalFloors: number;
  flatCount: number;
  createdAt: string;
}

export interface Flat {
  id: string;
  societyId: string;
  buildingId: string;
  flatNumber: string;
  floor: number;
  isOccupied: boolean;
  createdAt?: string;
}

export interface Resident {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  societyId: string;
  flatId: string;
  residentType: 'owner' | 'tenant';
}

export interface Guard {
  id: string;
  userId?: string;
  societyId: string;
  phone: string;
  fullName: string;
  gateName: string;
  shift: 'morning' | 'afternoon' | 'night';
  isActive: boolean;
}

export interface AddBuildingBody {
  name: string;
  totalFloors: number;
}

export interface AddFlatBody {
  buildingId: string;
  flatNumber: string;
  floor: number;
}

export interface AddResidentBody {
  phone: string;
  fullName: string;
  flatId: string;
  residentType: 'owner' | 'tenant';
}

export interface AddGuardBody {
  phone: string;
  fullName: string;
  gateName?: string;
  shift?: 'morning' | 'afternoon' | 'night';
}

// ============================================================
// Hook
// ============================================================

interface UseAdminOnboardingReturn {
  loading: boolean;
  error: string | null;
  buildings: Building[];
  flats: Flat[];
  fetchBuildings: (societyId: string) => Promise<void>;
  fetchFlats: (societyId: string, buildingId?: string) => Promise<void>;
  addBuilding: (societyId: string, body: AddBuildingBody) => Promise<Building | null>;
  addFlat: (societyId: string, body: AddFlatBody) => Promise<Flat | null>;
  addResident: (societyId: string, body: AddResidentBody) => Promise<Resident | null>;
  addGuard: (societyId: string, body: AddGuardBody) => Promise<Guard | null>;
  clearError: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosError = err as AxiosError<{ error?: { message: string }; message?: string }>;
  return (
    axiosError.response?.data?.error?.message ??
    axiosError.response?.data?.message ??
    fallback
  );
}

export function useAdminOnboarding(): UseAdminOnboardingReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);

  const fetchBuildings = useCallback(async (societyId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ buildings: Building[] }>(
        `/onboarding/societies/${societyId}/buildings`
      );
      setBuildings(res.data.buildings ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch buildings'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFlats = useCallback(async (societyId: string, buildingId?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const params = buildingId ? `?buildingId=${buildingId}` : '';
      const res = await api.get<{ flats: Flat[] }>(
        `/onboarding/societies/${societyId}/flats${params}`
      );
      setFlats(res.data.flats ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch flats'));
    } finally {
      setLoading(false);
    }
  }, []);

  const addBuilding = async (societyId: string, body: AddBuildingBody): Promise<Building | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ building: Building }>(
        `/onboarding/societies/${societyId}/buildings`,
        body
      );
      const newBuilding = res.data.building;
      setBuildings((prev) => [...prev, newBuilding]);
      return newBuilding;
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to add building'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addFlat = async (societyId: string, body: AddFlatBody): Promise<Flat | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ flat: Flat }>(
        `/onboarding/societies/${societyId}/flats`,
        body
      );
      const newFlat = res.data.flat;
      setFlats((prev) => [...prev, newFlat]);
      return newFlat;
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to add flat'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addResident = async (societyId: string, body: AddResidentBody): Promise<Resident | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ resident: Resident }>(
        `/onboarding/societies/${societyId}/residents`,
        body
      );
      return res.data.resident;
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to add resident'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const addGuard = async (societyId: string, body: AddGuardBody): Promise<Guard | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ guard: Guard }>(
        `/onboarding/societies/${societyId}/guards`,
        body
      );
      return res.data.guard;
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to add guard'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    buildings,
    flats,
    fetchBuildings,
    fetchFlats,
    addBuilding,
    addFlat,
    addResident,
    addGuard,
    clearError: () => setError(null),
  };
}
