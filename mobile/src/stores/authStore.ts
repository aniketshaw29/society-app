import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  societyId: string | null;
  flatId: string | null;
}

interface AuthActions {
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setRole: (role: UserRole | null) => void;
  setSocietyId: (societyId: string | null) => void;
  setFlatId: (flatId: string | null) => void;
  clearAuth: () => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  session: null,
  user: null,
  role: null,
  societyId: null,
  flatId: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (session) => {
        set({ session, user: session?.user ?? null });
      },

      setUser: (user) => {
        set({ user });
      },

      setRole: (role) => {
        set({ role });
      },

      setSocietyId: (societyId) => {
        set({ societyId });
      },

      setFlatId: (flatId) => {
        set({ flatId });
      },

      clearAuth: () => {
        set(initialState);
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive state; session tokens live in SecureStore
      partialize: (state) => ({
        role: state.role,
        societyId: state.societyId,
        flatId: state.flatId,
      }),
    }
  )
);
