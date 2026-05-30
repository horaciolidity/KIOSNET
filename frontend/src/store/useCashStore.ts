import { create } from 'zustand';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from './useAuthStore';

export interface CashTransaction {
  id: string;
  type: 'INGRESO' | 'EGRESO' | 'VENTA' | 'SISTEMA' | 'PAGO_DEUDA';
  amount: number;
  profit?: number;
  method: 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'NINGUNO' | 'CUENTA_CORRIENTE';
  description: string;
  timestamp: string;
  details?: any;
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
  history: CashTransaction[];
  loading: boolean;
  fetchActiveSession: () => Promise<void>;
  openBox: (amount: number) => Promise<void>;
  closeBox: (amount: number) => Promise<void>;
  addTransaction: (transaction: Omit<CashTransaction, 'id' | 'timestamp'>) => Promise<void>;
}

function mapFrontendTypeToDb(type: string, amount: number): 'IN' | 'OUT' {
  if (type === 'EGRESO') return 'OUT';
  if (type === 'INGRESO' || type === 'VENTA' || type === 'PAGO_DEUDA') return 'IN';
  return amount >= 0 ? 'IN' : 'OUT';
}

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
      const { data: reg, error } = await supabase
        .from('CashRegister')
        .select('*, movements:CashMovement(*)')
        .eq('userId', user.id)
        .eq('status', 'OPEN')
        .eq('tenantId', user.tenantId)
        .maybeSingle();

      if (error) throw error;

      if (reg) {
        // Map database cash register and its movements
        const mappedTransactions: CashTransaction[] = (reg.movements || []).map((m: any) => ({
          id: m.id,
          type: mapDbToFrontendType(m.type, m.description),
          amount: m.amount,
          method: 'EFECTIVO',
          description: m.description,
          timestamp: m.createdAt,
        }));

        // Sort descending by timestamp
        mappedTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const currentBalance = mappedTransactions.reduce((acc, t) => {
          if (t.type === 'EGRESO') return acc - t.amount;
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
      const { data: reg, error: regError } = await supabase
        .from('CashRegister')
        .insert({
          userId: user.id,
          tenantId: user.tenantId,
          openingBalance: amount,
          status: 'OPEN',
          notes: 'Apertura de Caja'
        })
        .select()
        .single();

      if (regError) throw regError;

      const { data: openMovement, error: movError } = await supabase
        .from('CashMovement')
        .insert({
          registerId: reg.id,
          amount,
          type: 'IN',
          description: 'Apertura de Caja'
        })
        .select()
        .single();

      if (movError) throw movError;

      const openTx: CashTransaction = {
        id: openMovement.id,
        type: 'SISTEMA',
        amount: amount,
        method: 'EFECTIVO',
        description: 'Apertura de Caja',
        timestamp: openMovement.createdAt
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
      alert(`Error al abrir caja: ${error.message || 'Error inesperado'}`);
      set({ loading: false });
    }
  },

  closeBox: async (amount) => {
    const session = get().session;
    if (!session.isOpen || session.id === '1') return;

    set({ loading: true });
    try {
      const { error: regError } = await supabase
        .from('CashRegister')
        .update({
          closingBalance: amount,
          status: 'CLOSED',
          closedAt: new Date().toISOString(),
          notes: 'Cierre de Caja'
        })
        .eq('id', session.id);

      if (regError) throw regError;

      const { data: closeMovement, error: movError } = await supabase
        .from('CashMovement')
        .insert({
          registerId: session.id,
          amount,
          type: 'OUT',
          description: 'Cierre de Caja'
        })
        .select()
        .single();

      if (movError) throw movError;

      const closeTx: CashTransaction = {
        id: closeMovement.id,
        type: 'SISTEMA',
        amount: amount,
        method: 'EFECTIVO',
        description: 'Cierre de Caja',
        timestamp: closeMovement.createdAt
      };

      set({
        session: {
          ...session,
          isOpen: false,
          closedAt: new Date().toISOString(),
          closingBalance: amount
        },
        history: [closeTx, ...get().history],
        loading: false
      });
    } catch (error: any) {
      console.error('Error closing cash register in Supabase:', error);
      alert(`Error al cerrar caja: ${error.message || 'Error inesperado'}`);
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
      const { data: savedMovement, error: movError } = await supabase
        .from('CashMovement')
        .insert({
          registerId: session.id,
          amount: tx.amount,
          type: mapFrontendTypeToDb(tx.type, tx.amount),
          description: tx.description
        })
        .select()
        .single();

      if (movError) throw movError;

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
      alert(`Error al registrar movimiento: ${error.message || 'Error inesperado'}`);
      set({
        session,
        history: get().history.filter((t) => t.id !== tempId)
      });
    }
  }
}));
