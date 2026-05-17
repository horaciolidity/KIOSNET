import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  tenantId: string;
  plan: string;
  subActive: boolean;
  salesCount?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setSubscriptionActive: (active: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      setSubscriptionActive: (active) => set((state) => {
        if (!state.user) return state;
        return {
          user: {
            ...state.user,
            subActive: active
          }
        };
      })
    }),
    {
      name: 'auth-storage',
    }
  )
);

