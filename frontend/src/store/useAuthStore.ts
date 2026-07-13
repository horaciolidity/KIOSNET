import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../utils/supabaseClient';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  tenantId: string;
  plan: string;
  subActive: boolean;
  subExpiresAt?: string | Date | null;
  salesCount?: number;
  onboardingCompleted?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => Promise<void>;
  setSubscriptionActive: (active: boolean) => void;
  fetchUserSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, token: null });
      },
      setSubscriptionActive: (active) => set((state) => {
        if (!state.user) return state;
        return {
          user: {
            ...state.user,
            subActive: active
          }
        };
      }),
      fetchUserSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          set({ user: null, token: null });
          return;
        }

        try {
          // Fetch additional profile details
          const { data: dbUser, error: dbUserError } = await supabase
            .from('User')
            .select(`
              id, email, name, role, tenantId, onboardingCompleted,
              tenant:Tenant(plan, subActive, subExpiresAt)
            `)
            .eq('id', session.user.id)
            .single();

          if (dbUserError || !dbUser) {
            console.error('Profile not found for session user:', dbUserError);
            return;
          }

          const { count } = await supabase
            .from('Sale')
            .select('*', { count: 'exact', head: true })
            .eq('tenantId', dbUser.tenantId);

          const tenant = dbUser.tenant as any;

          set({
            user: {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name,
              role: dbUser.role as 'ADMIN' | 'EMPLOYEE',
              tenantId: dbUser.tenantId,
              plan: tenant?.plan || 'FREE',
              subActive: (tenant?.subActive && (tenant?.subExpiresAt ? new Date(tenant.subExpiresAt) > new Date() : true)) || false,
              subExpiresAt: tenant?.subExpiresAt || null,
              salesCount: count || 0,
              onboardingCompleted: dbUser.onboardingCompleted || false
            },
            token: session.access_token
          });
        } catch (e) {
          console.error('Error fetching user profile:', e);
        }
      }
    }),
    {
      name: 'auth-storage',
    }
  )
);
