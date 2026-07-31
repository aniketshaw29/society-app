import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Society, Building, Flat } from '@/types';

interface SocietyState {
  society: Society | null;
  buildings: Building[];
  flats: Flat[];
}

interface SocietyActions {
  setSociety: (society: Society | null) => void;
  setBuildings: (buildings: Building[]) => void;
  setFlats: (flats: Flat[]) => void;
  clearSociety: () => void;
}

export type SocietyStore = SocietyState & SocietyActions;

const initialState: SocietyState = {
  society: null,
  buildings: [],
  flats: [],
};

export const useSocietyStore = create<SocietyStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSociety: (society) => {
        set({ society });
      },

      setBuildings: (buildings) => {
        set({ buildings });
      },

      setFlats: (flats) => {
        set({ flats });
      },

      clearSociety: () => {
        set(initialState);
      },
    }),
    {
      name: 'society-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
