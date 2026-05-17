import { create } from 'zustand';
import api from '../utils/api';
import { useAuthStore } from './useAuthStore';

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
  loading: boolean;
  fetchActiveSession: () => Promise<void>;
  openBox: (amount: number) => Promise<void>;
  closeBox: (amount: number) => Promise<void>;
  addTransaction: (transaction: Omit<CashTransaction, 'id' | 'timestamp'>) => Promise<void>;
}

// Map frontend types to database MovementType
function mapFrontendTypeToDb(type: string, amount: number): 'IN' | 'OUT' {
  if (type === 'EGRESO') return 'OUT';
  if (type === 'INGRESO' || type === 'VENTA' || type === 'PAGO_DEUDA') return 'IN';
  return amount >= 0 ? 'IN' : 'OUT';
}

// Map database MovementType to frontend types
function mapDbToFrontendType(type: 'IN' | 'OUT', description: string): 'INGRESO' | 'EGRESO' | 'VENTA' | 'SISTEMA' | 'PAGO_DEUDA' {
  const desc = description.toLowerCase();
  if (desc.includes('venta')) return 'VENTA';
  if (desc.includes('deuda') || desc.includes('pago')) return 'PAGO_DEUDA';
  if (desc.includes('apertura') || desc.includes('cierre')) return 'SISTEMA';
  return type === 'IN' ? 'INGRESO' : 'EGRESO';
}

export const useCashStore = create<CashState>((set, get) => ({
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
  loading: false,

  fetchActiveSession: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    try {
      const response = await api.get(`/registers/active/${user.id}`);
      const reg = response.data;

      if (reg) {
        // Map database cash register and its movements
        const mappedTransactions: CashTransaction[] = (reg.movements || []).map((m: any) => ({
          id: m.id,
          type: mapDbToFrontendType(m.type, m.description),
          amount: m.amount,
          method: 'EFECTIVO', // DB movements track physical cash flow
          description: m.description,
          timestamp: m.createdAt,
        }));

        // Calculate current balance
        const currentBalance = mappedTransactions.reduce((acc, t) => {
          if (t.type === 'EGRESO') return acc - t.amount;
          // Apertura doesn't double count if it's already in openingBalance
          if (t.description === 'Apertura de Caja') return acc;
          return acc + t.amount;
        }, reg.openingBalance);

        set({
          session: {
            id: reg.id,
            isOpen: true,
            openedAt: reg.openedAt,
            closedAt: reg.closedAt,
            openingBalance: reg.openingBalance,
            closingBalance: reg.closingBalance || 0,
            currentBalance,
            transactions: mappedTransactions,
          },
          history: mappedTransactions,
          loading: false,
        });
      } else {
        // No active session found
        set({
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
          loading: false
        });
      }
    } catch (error) {
      console.error('Error fetching active cash session from Supabase:', error);
      set({ loading: false });
    }
  },

  openBox: async (amount) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    try {
      const response = await api.post('/registers/open', {
        userId: user.id,
        openingBalance: amount,
        notes: 'Apertura de Caja'
      });
      const reg = response.data;

      // Add a standard opening cash movement inside this register
      const openMovement = await api.post('/registers/movements', {
        registerId: reg.id,
        amount,
        type: 'IN',
        description: 'Apertura de Caja'
      });

      const openTx: CashTransaction = {
        id: openMovement.data.id,
        type: 'SISTEMA',
        amount: amount,
        method: 'EFECTIVO',
        description: 'Apertura de Caja',
        timestamp: openMovement.data.createdAt
      };

      set({
        session: {
          id: reg.id,
          isOpen: true,
          openedAt: reg.openedAt,
          closedAt: null,
          openingBalance: amount,
          closingBalance: 0,
          currentBalance: amount,
          transactions: [openTx]
        },
        history: [openTx, ...get().history],
        loading: false
      });
    } catch (error: any) {
      console.error('Error opening cash register in Supabase:', error);
      const errMsg = error.response?.data?.message || 'Error inesperado al abrir la caja';
      alert(`Error al abrir caja: ${errMsg}`);
      set({ loading: false });
    }
  },

  closeBox: async (amount) => {
    const session = get().session;
    if (!session.isOpen || session.id === '1') return;

    set({ loading: true });
    try {
      await api.patch(`/registers/${session.id}/close`, {
        closingBalance: amount,
        notes: 'Cierre de Caja'
      });

      // Add a closing cash movement
      const closeMovement = await api.post('/registers/movements', {
        registerId: session.id,
        amount,
        type: 'OUT',
        description: 'Cierre de Caja'
      });

      const closeTx: CashTransaction = {
        id: closeMovement.data.id,
        type: 'SISTEMA',
        amount: amount,
        method: 'EFECTIVO',
        description: 'Cierre de Caja',
        timestamp: closeMovement.data.createdAt
      };

      set({
        session: {
          ...session,
          isOpen: false,
          closedAt: closeMovement.data.closedAt,
          closingBalance: amount
        },
        history: [closeTx, ...get().history],
        loading: false
      });
    } catch (error: any) {
      console.error('Error closing cash register in Supabase:', error);
      const errMsg = error.response?.data?.message || 'Error inesperado al cerrar la caja';
      alert(`Error al cerrar caja: ${errMsg}`);
      set({ loading: false });
    }
  },

  addTransaction: async (tx) => {
    const session = get().session;
    if (!session.isOpen || session.id === '1') {
      // Local fallback if no session is open
      const tempTx: CashTransaction = {
        ...tx,
        id: 'temp-' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString()
      };
      set((state) => ({
        history: [tempTx, ...state.history]
      }));
      return;
    }

    // 1. Optimistic Update
    const tempId = 'temp-' + Math.random().toString(36).substr(2, 9);
    const tempTx: CashTransaction = {
      ...tx,
      id: tempId,
      timestamp: new Date().toISOString()
    };

    let newBalance = session.currentBalance;
    if (tx.method === 'EFECTIVO') {
      newBalance = tx.type === 'EGRESO'
        ? session.currentBalance - tx.amount
        : session.currentBalance + tx.amount;
    }

    set((state) => ({
      session: {
        ...state.session,
        currentBalance: newBalance,
        transactions: [tempTx, ...state.session.transactions]
      },
      history: [tempTx, ...state.history]
    }));

    // 2. Persist to Supabase
    try {
      const response = await api.post('/registers/movements', {
        registerId: session.id,
        amount: tx.amount,
        type: mapFrontendTypeToDb(tx.type, tx.amount),
        description: tx.description
      });

      const savedMovement = response.data;

      // Swap temp ID with actual Supabase ID
      set((state) => ({
        session: {
          ...state.session,
          transactions: state.session.transactions.map((t) => t.id === tempId ? {
            ...t,
            id: savedMovement.id,
            timestamp: savedMovement.createdAt
          } : t)
        },
        history: state.history.map((t) => t.id === tempId ? {
          ...t,
          id: savedMovement.id,
          timestamp: savedMovement.createdAt
        } : t)
      }));
    } catch (error: any) {
      console.error('Error recording movement in Supabase:', error);
      const errMsg = error.response?.data?.message || 'Error inesperado al registrar el movimiento';
      alert(`Error al registrar movimiento: ${errMsg}`);
      // Revert if API failed
      set({
        session,
        history: get().history.filter((t) => t.id !== tempId)
      });
    }
  }
}));
