import { create } from 'zustand';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from './useAuthStore';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  document?: string;
  debt: number;
  limit: number;
  lastPurchase?: string;
  createdAt: string;
}

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  fetchCustomers: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'debt'>) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addDebt: (id: string, amount: number) => Promise<void>;
  payDebt: (id: string, amount: number) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  loading: false,

  fetchCustomers: async () => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('Customer')
        .select('*, sales:Sale(createdAt)')
        .eq('tenantId', tenantId);

      if (error) throw error;

      const mapped = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        document: c.address || '',
        debt: c.balance || 0,
        limit: c.creditLimit || 0,
        lastPurchase: c.sales && c.sales.length > 0 ? c.sales[c.sales.length - 1].createdAt : undefined,
        createdAt: c.createdAt,
      }));
      set({ customers: mapped, loading: false });
    } catch (error) {
      console.error('Error fetching customers from Supabase:', error);
      set({ loading: false });
    }
  },

  addCustomer: async (customerData) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 1. Optimistic Update
    const tempId = 'temp-' + Math.random().toString(36).substr(2, 9);
    const newCustomerTemp: Customer = {
      ...customerData,
      id: tempId,
      debt: 0,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      customers: [newCustomerTemp, ...state.customers],
    }));

    // 2. Persist to Supabase
    try {
      const payload = {
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.document || '',
        creditLimit: Number(customerData.limit),
        balance: 0,
        tenantId
      };

      const { data: savedCustomer, error: insertError } = await supabase
        .from('Customer')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      set((state) => ({
        customers: state.customers.map((c) => c.id === tempId ? {
          ...c,
          id: savedCustomer.id,
          createdAt: savedCustomer.createdAt,
        } : c),
      }));
    } catch (error) {
      console.error('Error adding customer to Supabase:', error);
      // Revert if failed
      set((state) => ({
        customers: state.customers.filter((c) => c.id !== tempId),
      }));
    }
  },

  updateCustomer: async (id, customerData) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 1. Optimistic Update
    const originalCustomers = get().customers;
    set((state) => ({
      customers: state.customers.map((c) => c.id === id ? { ...c, ...customerData } : c),
    }));

    // 2. Persist to Supabase
    try {
      const payload: any = {
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.document,
        creditLimit: customerData.limit !== undefined ? Number(customerData.limit) : undefined,
        balance: customerData.debt !== undefined ? Number(customerData.debt) : undefined,
      };

      // Clean undefined keys
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      const { error: updateError } = await supabase
        .from('Customer')
        .update(payload)
        .eq('id', id)
        .eq('tenantId', tenantId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating customer in Supabase:', error);
      // Revert if failed
      set({ customers: originalCustomers });
    }
  },

  deleteCustomer: async (id) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 1. Optimistic Update
    const originalCustomers = get().customers;
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
    }));

    // 2. Persist to Supabase
    try {
      const { error: deleteError } = await supabase
        .from('Customer')
        .delete()
        .eq('id', id)
        .eq('tenantId', tenantId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error('Error deleting customer in Supabase:', error);
      // Revert if failed
      set({ customers: originalCustomers });
    }
  },

  addDebt: async (id, amount) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 1. Optimistic Update
    const originalCustomers = get().customers;
    const target = originalCustomers.find(c => c.id === id);
    if (!target) return;

    const newDebt = target.debt + amount;

    set((state) => ({
      customers: state.customers.map((c) => c.id === id ? {
        ...c,
        debt: newDebt,
        lastPurchase: new Date().toISOString()
      } : c),
    }));

    // 2. Persist to Supabase
    try {
      const { error: updateError } = await supabase
        .from('Customer')
        .update({ balance: newDebt })
        .eq('id', id)
        .eq('tenantId', tenantId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error adding debt in Supabase:', error);
      // Revert if failed
      set({ customers: originalCustomers });
    }
  },

  payDebt: async (id, amount) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 1. Optimistic Update
    const originalCustomers = get().customers;
    const target = originalCustomers.find(c => c.id === id);
    if (!target) return;

    const newDebt = Math.max(0, target.debt - amount);

    set((state) => ({
      customers: state.customers.map((c) => c.id === id ? {
        ...c,
        debt: newDebt
      } : c),
    }));

    // 2. Persist to Supabase
    try {
      const { error: updateError } = await supabase
        .from('Customer')
        .update({ balance: newDebt })
        .eq('id', id)
        .eq('tenantId', tenantId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error paying debt in Supabase:', error);
      // Revert if failed
      set({ customers: originalCustomers });
    }
  },
}));
