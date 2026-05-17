import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SubscriptionPlan = 'FREE' | 'STANDARD' | 'PRO';

interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  taxId: string;
  mercadoPago: {
    accessToken: string;
    posId: string;
    isActive: boolean;
  };
}

interface SettingsState {
  businessInfo: BusinessInfo;
  subscription: {
    plan: SubscriptionPlan;
    salesUsed: number;
    salesLimit: number;
    status: 'ACTIVE' | 'EXPIRED' | 'TRIAL';
    remainingBalance?: number;
    dailyCost?: number;
  };
  notifications: {
    lowStockAlerts: boolean;
    dailyReports: boolean;
    newSaleNotifications: boolean;
  };
  display: {
    welcomeMessage: string;
    showLogo: boolean;
  };
  security: {
    adminPin: string;
    employeeBlockInventory: boolean;
    employeeBlockCash: boolean;
  };
  setBusinessInfo: (info: BusinessInfo) => void;
  updateBusinessInfo: (info: Partial<BusinessInfo>) => void;
  updateNotifications: (notif: Partial<SettingsState['notifications']>) => void;
  updateDisplay: (disp: Partial<SettingsState['display']>) => void;
  updateSecurity: (sec: Partial<SettingsState['security']>) => void;
  incrementSales: () => void;
  upgradePlan: (plan: SubscriptionPlan, cost: number) => void;
  deductDailyBalance: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      businessInfo: {
        name: 'Mi Comercio',
        address: 'Av. Principal 123',
        phone: '1123456789',
        email: 'contacto@micomercio.com',
        taxId: '20-12345678-9',
        mercadoPago: {
          accessToken: '',
          posId: '',
          isActive: false
        }
      },
      subscription: {
        plan: 'FREE',
        salesUsed: 0,
        salesLimit: 50,
        status: 'TRIAL',
        remainingBalance: 0,
        dailyCost: 0,
      },
      notifications: {
        lowStockAlerts: true,
        dailyReports: true,
        newSaleNotifications: true
      },
      display: {
        welcomeMessage: '¡Bienvenido a Mi Comercio!',
        showLogo: true
      },
      security: {
        adminPin: '1234',
        employeeBlockInventory: true,
        employeeBlockCash: true
      },
      setBusinessInfo: (businessInfo) => set({ businessInfo }),
      updateBusinessInfo: (info) => set((state) => ({ businessInfo: { ...state.businessInfo, ...info } })),
      updateNotifications: (notif) => set((state) => ({ notifications: { ...state.notifications, ...notif } })),
      updateDisplay: (disp) => set((state) => ({ display: { ...state.display, ...disp } })),
      updateSecurity: (sec) => set((state) => ({ security: { ...state.security, ...sec } })),
      incrementSales: () => set((state) => ({
        subscription: {
          ...state.subscription,
          salesUsed: state.subscription.salesUsed + 1
        }
      })),
      upgradePlan: (plan, cost) => set((state) => ({
        subscription: {
          ...state.subscription,
          plan,
          salesLimit: plan === 'FREE' ? 50 : Infinity,
          status: 'ACTIVE',
          remainingBalance: cost,
          dailyCost: cost / 30
        }
      })),
      deductDailyBalance: () => set((state) => {
        if (!state.subscription.remainingBalance || !state.subscription.dailyCost) return state;
        
        const newBalance = Math.max(0, state.subscription.remainingBalance - state.subscription.dailyCost);
        return {
          subscription: {
            ...state.subscription,
            remainingBalance: newBalance,
            status: newBalance <= 0 ? 'EXPIRED' : 'ACTIVE'
          }
        };
      }),
    }),
    {
      name: 'settings-storage',
    }
  )
);
