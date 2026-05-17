import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CashTransaction {
  id: string;
  type: 'INGRESO' | 'EGRESO' | 'VENTA' | 'SISTEMA' | 'PAGO_DEUDA';
  amount: number;
  profit?: number;
  method: 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'NINGUNO' | 'CUENTA_CORRIENTE';
  description: string;
  timestamp: string;
  details?: any; // To store items sold, etc.
}

export interface CashSession {
  id: string;
  isOpen: boolean;
  openedAt: string | null;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number;
  currentBalance: number;
  transactions: CashTransaction[];
}

interface CashState {
  session: CashSession;
  history: CashTransaction[]; // Permanent history
  openBox: (amount: number) => void;
  closeBox: (amount: number) => void;
  addTransaction: (transaction: Omit<CashTransaction, 'id' | 'timestamp'>) => void;
}

export const useCashStore = create<CashState>()(
  persist(
    (set) => ({
      session: {
        id: '1',
        isOpen: false,
        openedAt: null,
        closedAt: null,
        openingBalance: 0,
        closingBalance: 0,
        currentBalance: 0,
        transactions: []
      },
      history: [],
      openBox: (amount) => set((state) => {
        const openTx: CashTransaction = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'SISTEMA',
          amount: amount,
          method: 'EFECTIVO',
          description: 'Apertura de Caja',
          timestamp: new Date().toISOString()
        };
        return {
          session: {
            ...state.session,
            isOpen: true,
            openedAt: new Date().toISOString(),
            openingBalance: amount,
            currentBalance: amount,
            transactions: [],
            closedAt: null
          },
          history: [openTx, ...state.history]
        };
      }),
      closeBox: (amount) => set((state) => {
        const closeTx: CashTransaction = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'SISTEMA',
          amount: amount,
          method: 'EFECTIVO',
          description: 'Cierre de Caja',
          timestamp: new Date().toISOString()
        };
        return {
          session: {
            ...state.session,
            isOpen: false,
            closedAt: new Date().toISOString(),
            closingBalance: amount,
          },
          history: [closeTx, ...state.history]
        };
      }),
      addTransaction: (tx) => set((state) => {
        const newTx = {
          ...tx,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString()
        };
        
        let newBalance = state.session.currentBalance;
        if (tx.method === 'EFECTIVO') {
           newBalance = tx.type === 'EGRESO' 
            ? state.session.currentBalance - tx.amount 
            : state.session.currentBalance + tx.amount;
        }

        return {
          session: {
            ...state.session,
            currentBalance: newBalance,
            transactions: state.session.isOpen ? [newTx as CashTransaction, ...state.session.transactions] : state.session.transactions
          },
          history: [newTx as CashTransaction, ...state.history]
        };
      }),
    }),
    {
      name: 'cash-storage',
    }
  )
);
