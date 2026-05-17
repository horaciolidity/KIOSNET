import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'debt'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addDebt: (id: string, amount: number) => void;
  payDebt: (id: string, amount: number) => void;
}

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set) => ({
      customers: [],
      addCustomer: (customer) => set((state) => ({
        customers: [
          {
            ...customer,
            id: Math.random().toString(36).substr(2, 9),
            debt: 0,
            createdAt: new Date().toISOString()
          },
          ...state.customers
        ]
      })),
      updateCustomer: (id, updatedData) => set((state) => ({
        customers: state.customers.map(c => c.id === id ? { ...c, ...updatedData } : c)
      })),
      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter(c => c.id !== id)
      })),
      addDebt: (id, amount) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === id) {
            return {
              ...c,
              debt: c.debt + amount,
              lastPurchase: new Date().toISOString()
            };
          }
          return c;
        })
      })),
      payDebt: (id, amount) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === id) {
            return {
              ...c,
              debt: Math.max(0, c.debt - amount)
            };
          }
          return c;
        })
      }))
    }),
    {
      name: 'customers-storage',
    }
  )
);
