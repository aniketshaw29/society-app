import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { AxiosError } from 'axios';

// ============================================================
// Types
// ============================================================

export interface MgmtBuilding {
  id: string;
  societyId: string;
  name: string;
  totalFloors: number;
  flatCount: number;
  createdAt: string;
}

export interface MgmtFlat {
  id: string;
  societyId: string;
  buildingId: string;
  flatNumber: string;
  floor: number;
  isOccupied: boolean;
  createdAt?: string;
  // joined
  buildings?: { id: string; name: string } | null;
}

export interface MgmtResident {
  id: string;
  phone: string | null;
  fullName: string | null;
  role: string;
  societyId: string | null;
  flatId: string | null;
  isActive: boolean;
  // joined (optional from API)
  flatNumber?: string | null;
  buildingName?: string | null;
}

export interface MgmtGuard {
  id: string;
  userId: string;
  societyId: string;
  phone?: string | null;
  fullName?: string | null;
  gateName: string;
  shift: 'morning' | 'afternoon' | 'night';
  isActive: boolean;
}

// ============================================================
// Error helper
// ============================================================

function extractMessage(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ error?: { message: string }; message?: string }>;
  return (
    e.response?.data?.error?.message ??
    e.response?.data?.message ??
    fallback
  );
}

// ============================================================
// Hook
// ============================================================

export interface UseAdminManagementReturn {
  // Buildings
  buildings: MgmtBuilding[];
  buildingsLoading: boolean;
  fetchBuildings(societyId: string): Promise<void>;
  updateBuilding(societyId: string, id: string, data: Partial<Pick<MgmtBuilding, 'name' | 'totalFloors'>>): Promise<void>;
  deleteBuilding(societyId: string, id: string): Promise<void>;

  // Flats
  flats: MgmtFlat[];
  flatsLoading: boolean;
  fetchFlats(societyId: string, buildingId?: string): Promise<void>;
  updateFlat(societyId: string, id: string, data: Partial<Pick<MgmtFlat, 'flatNumber' | 'floor'>>): Promise<void>;
  deleteFlat(societyId: string, id: string): Promise<void>;

  // Residents
  residents: MgmtResident[];
  residentsLoading: boolean;
  fetchResidents(societyId: string, search?: string): Promise<void>;
  updateResident(societyId: string, userId: string, data: { fullName?: string; flatId?: string; residentType?: 'owner' | 'tenant' }): Promise<void>;
  deactivateResident(societyId: string, userId: string): Promise<void>;
  resendInvite(societyId: string, userId: string): Promise<void>;

  // Guards
  guards: MgmtGuard[];
  guardsLoading: boolean;
  fetchGuards(societyId: string): Promise<void>;
  updateGuard(societyId: string, guardId: string, data: { gateName?: string; shift?: string; isActive?: boolean }): Promise<void>;
  toggleGuardActive(societyId: string, guardId: string, isActive: boolean): Promise<void>;

  error: string | null;
  clearError(): void;
}

export function useAdminManagement(): UseAdminManagementReturn {
  const [buildings, setBuildings] = useState<MgmtBuilding[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);

  const [flats, setFlats] = useState<MgmtFlat[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(false);

  const [residents, setResidents] = useState<MgmtResident[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(false);

  const [guards, setGuards] = useState<MgmtGuard[]>([]);
  const [guardsLoading, setGuardsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // ── Buildings ────────────────────────────────────────────────

  const fetchBuildings = useCallback(async (societyId: string): Promise<void> => {
    setBuildingsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ buildings: MgmtBuilding[] }>(
        `/onboarding/societies/${societyId}/buildings`
      );
      setBuildings(res.data.buildings ?? []);
    } catch (err) {
      setError(extractMessage(err, 'Failed to load buildings'));
    } finally {
      setBuildingsLoading(false);
    }
  }, []);

  const updateBuilding = useCallback(async (
    societyId: string,
    id: string,
    data: Partial<Pick<MgmtBuilding, 'name' | 'totalFloors'>>
  ): Promise<void> => {
    setError(null);
    try {
      const res = await api.patch<{ building: MgmtBuilding }>(
        `/onboarding/societies/${societyId}/buildings/${id}`,
        data
      );
      const updated = res.data.building;
      setBuildings((prev) => prev.map((b) => b.id === id ? { ...b, ...updated } : b));
    } catch (err) {
      setError(extractMessage(err, 'Failed to update building'));
      throw err;
    }
  }, []);

  const deleteBuilding = useCallback(async (societyId: string, id: string): Promise<void> => {
    setError(null);
    try {
      await api.delete(`/onboarding/societies/${societyId}/buildings/${id}`);
      setBuildings((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(extractMessage(err, 'Failed to delete building'));
      throw err;
    }
  }, []);

  // ── Flats ────────────────────────────────────────────────────

  const fetchFlats = useCallback(async (societyId: string, buildingId?: string): Promise<void> => {
    setFlatsLoading(true);
    setError(null);
    try {
      const params = buildingId ? `?buildingId=${buildingId}` : '';
      const res = await api.get<{ flats: MgmtFlat[] }>(
        `/onboarding/societies/${societyId}/flats${params}`
      );
      setFlats(res.data.flats ?? []);
    } catch (err) {
      setError(extractMessage(err, 'Failed to load flats'));
    } finally {
      setFlatsLoading(false);
    }
  }, []);

  const updateFlat = useCallback(async (
    societyId: string,
    id: string,
    data: Partial<Pick<MgmtFlat, 'flatNumber' | 'floor'>>
  ): Promise<void> => {
    setError(null);
    try {
      const res = await api.patch<{ flat: MgmtFlat }>(
        `/onboarding/societies/${societyId}/flats/${id}`,
        data
      );
      const updated = res.data.flat;
      setFlats((prev) => prev.map((f) => f.id === id ? { ...f, ...updated } : f));
    } catch (err) {
      setError(extractMessage(err, 'Failed to update flat'));
      throw err;
    }
  }, []);

  const deleteFlat = useCallback(async (societyId: string, id: string): Promise<void> => {
    setError(null);
    try {
      await api.delete(`/onboarding/societies/${societyId}/flats/${id}`);
      setFlats((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(extractMessage(err, 'Failed to delete flat'));
      throw err;
    }
  }, []);

  // ── Residents ────────────────────────────────────────────────

  const fetchResidents = useCallback(async (societyId: string, search?: string): Promise<void> => {
    setResidentsLoading(true);
    setError(null);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get<{ residents: MgmtResident[] }>(
        `/onboarding/societies/${societyId}/residents${params}`
      );
      setResidents(res.data.residents ?? []);
    } catch (err) {
      setError(extractMessage(err, 'Failed to load residents'));
    } finally {
      setResidentsLoading(false);
    }
  }, []);

  const updateResident = useCallback(async (
    societyId: string,
    userId: string,
    data: { fullName?: string; flatId?: string; residentType?: 'owner' | 'tenant' }
  ): Promise<void> => {
    setError(null);
    try {
      const res = await api.patch<{ resident: MgmtResident }>(
        `/onboarding/societies/${societyId}/residents/${userId}`,
        data
      );
      const updated = res.data.resident;
      setResidents((prev) => prev.map((r) => r.id === userId ? { ...r, ...updated } : r));
    } catch (err) {
      setError(extractMessage(err, 'Failed to update resident'));
      throw err;
    }
  }, []);

  const deactivateResident = useCallback(async (societyId: string, userId: string): Promise<void> => {
    setError(null);
    try {
      await api.delete(`/onboarding/societies/${societyId}/residents/${userId}`);
      setResidents((prev) => prev.map((r) => r.id === userId ? { ...r, isActive: false } : r));
    } catch (err) {
      setError(extractMessage(err, 'Failed to deactivate resident'));
      throw err;
    }
  }, []);

  const resendInvite = useCallback(async (societyId: string, userId: string): Promise<void> => {
    setError(null);
    try {
      await api.post(`/onboarding/societies/${societyId}/residents/${userId}/resend-invite`);
    } catch (err) {
      setError(extractMessage(err, 'Failed to resend invite'));
      throw err;
    }
  }, []);

  // ── Guards ───────────────────────────────────────────────────

  const fetchGuards = useCallback(async (societyId: string): Promise<void> => {
    setGuardsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ guards: MgmtGuard[] }>(
        `/onboarding/societies/${societyId}/guards`
      );
      setGuards(res.data.guards ?? []);
    } catch (err) {
      setError(extractMessage(err, 'Failed to load guards'));
    } finally {
      setGuardsLoading(false);
    }
  }, []);

  const updateGuard = useCallback(async (
    societyId: string,
    guardId: string,
    data: { gateName?: string; shift?: string; isActive?: boolean }
  ): Promise<void> => {
    setError(null);
    try {
      const res = await api.patch<{ guard: MgmtGuard }>(
        `/onboarding/societies/${societyId}/guards/${guardId}`,
        data
      );
      const updated = res.data.guard;
      setGuards((prev) => prev.map((g) => g.id === guardId ? { ...g, ...updated } : g));
    } catch (err) {
      setError(extractMessage(err, 'Failed to update guard'));
      throw err;
    }
  }, []);

  const toggleGuardActive = useCallback(async (
    societyId: string,
    guardId: string,
    isActive: boolean
  ): Promise<void> => {
    return updateGuard(societyId, guardId, { isActive });
  }, [updateGuard]);

  return {
    buildings, buildingsLoading, fetchBuildings, updateBuilding, deleteBuilding,
    flats, flatsLoading, fetchFlats, updateFlat, deleteFlat,
    residents, residentsLoading, fetchResidents, updateResident, deactivateResident, resendInvite,
    guards, guardsLoading, fetchGuards, updateGuard, toggleGuardActive,
    error,
    clearError: () => setError(null),
  };
}
