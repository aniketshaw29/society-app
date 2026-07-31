import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { RecurringStaff, CreateStaffInput } from '@/types';

// ---------------------------------------------------------------------------
// useRecurringStaff — resident-side hook for managing their flat's staff
// ---------------------------------------------------------------------------

interface UseRecurringStaffReturn {
  staff: RecurringStaff[];
  loading: boolean;
  error: string | null;
  add: (data: CreateStaffInput) => Promise<RecurringStaff>;
  update: (id: string, data: Partial<CreateStaffInput & { isActive: boolean }>) => Promise<RecurringStaff>;
  deactivate: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRecurringStaff(): UseRecurringStaffReturn {
  const [staff, setStaff] = useState<RecurringStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ staff: RecurringStaff[] }>('/recurring-staff');
      setStaff(res.data.staff ?? []);
    } catch {
      setError('Could not load staff list');
    } finally {
      setLoading(false);
    }
  }, []);

  const add = useCallback(async (data: CreateStaffInput): Promise<RecurringStaff> => {
    const res = await api.post<{ staff: RecurringStaff }>('/recurring-staff', data);
    const newStaff = res.data.staff;
    setStaff((prev) => [...prev, newStaff]);
    return newStaff;
  }, []);

  const update = useCallback(
    async (id: string, data: Partial<CreateStaffInput & { isActive: boolean }>): Promise<RecurringStaff> => {
      const res = await api.patch<{ staff: RecurringStaff }>(`/recurring-staff/${id}`, data);
      const updated = res.data.staff;
      setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    },
    []
  );

  const deactivate = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/recurring-staff/${id}`);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { staff, loading, error, add, update, deactivate, refresh };
}
