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
  pastRegisters: any[];
  loading: boolean;
  fetchActiveSession: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchPastRegisters: () => Promise<void>;
  openBox: (amount: number) => Promise<void>;
  closeBox: (amount: number) => Promise<void>;
  addTransaction: (transaction: Omit<CashTransaction, 'id' | 'timestamp'>) => Promise<void>;
}

function parseUtcDateString(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  // If the date string has no timezone offset, append Z to treat it as UTC
  if (!dateStr.includes('Z') && !dateStr.includes('+') && !/-\d{2}:\d{2}$/.test(dateStr)) {
    const formatted = dateStr.replace(' ', 'T');
    return formatted.endsWith('Z') ? formatted : formatted + 'Z';
  }
  return dateStr;
}

function mapFrontendTypeToDb(type: string, amount: number): 'IN' | 'OUT' {
  if (type === 'EGRESO') return 'OUT';
  if (type === 'INGRESO' || type === 'VENTA' || type === 'PAGO_DEUDA') return 'IN';
  return amount >= 0 ? 'IN' : 'OUT';
}

export function mapDbToFrontendType(type: 'IN' | 'OUT', description: string, paymentMethod?: string): {
  txType: 'INGRESO' | 'EGRESO' | 'VENTA' | 'SISTEMA' | 'PAGO_DEUDA';
  method: CashTransaction['method'];
} {
  const desc = description.toLowerCase();

  // Determine transaction type
  let txType: CashTransaction['type'];
  if (desc.includes('venta')) txType = 'VENTA';
  else if (desc.includes('deuda') || desc.includes('pago')) txType = 'PAGO_DEUDA';
  else if (desc.includes('apertura') || desc.includes('cierre')) txType = 'SISTEMA';
  else txType = type === 'IN' ? 'INGRESO' : 'EGRESO';

  // Determine payment method from stored paymentMethod field
  let method: CashTransaction['method'] = 'EFECTIVO';
  if (paymentMethod) {
    const pm = paymentMethod.toUpperCase();
    if (pm === 'DEBITO') method = 'DEBITO';
    else if (pm === 'CREDITO') method = 'CREDITO';
    else if (pm === 'TRANSFERENCIA') method = 'TRANSFERENCIA';
    else if (pm === 'CUENTA_CORRIENTE') method = 'CUENTA_CORRIENTE';
    else if (pm === 'NINGUNO') method = 'NINGUNO';
    else method = 'EFECTIVO';
  }

  return { txType, method };
}

/**
 * Calculate the physical cash balance in the register.
 * Only EFECTIVO movements affect the cash drawer.
 * Cuenta Corriente, Transferencias, Débito, Crédito are NOT physical cash.
 */
function calculateCashBalance(openingBalance: number, transactions: CashTransaction[]): number {
  return transactions.reduce((acc, t) => {
    // Skip apertura/sistema (already counted in openingBalance)
    if (t.type === 'SISTEMA') return acc;
    // Egresos always reduce cash (they're always physical cash out)
    if (t.type === 'EGRESO') return acc - t.amount;
    // Ingresos manuales in cash only
    if (t.type === 'INGRESO' && t.method === 'EFECTIVO') return acc + t.amount;
    // Sales: only cash sales affect the drawer
    if (t.type === 'VENTA' && t.method === 'EFECTIVO') return acc + t.amount;
    // PAGO_DEUDA: customer paying off their cuenta corriente in cash
    if (t.type === 'PAGO_DEUDA' && t.method === 'EFECTIVO') return acc + t.amount;
    // Non-cash payments (TRANSFERENCIA, DEBITO, CREDITO, CUENTA_CORRIENTE) don't go in the drawer
    return acc;
  }, openingBalance);
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
  pastRegisters: [],
  loading: false,

  fetchActiveSession: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    try {
      const { data: rows, error } = await supabase
        .from('CashRegister')
        .select('*, movements:CashMovement(*)')
        .eq('userId', user.id)
        .eq('status', 'OPEN')
        .eq('tenantId', user.tenantId)
        .order('openedAt', { ascending: false })
        .limit(1);

      if (error) throw error;
      const reg = rows?.[0] ?? null;

      if (reg) {
        // Map database cash register and its movements — preserve paymentMethod
        const mappedTransactions: CashTransaction[] = (reg.movements || []).map((m: any) => {
          const { txType, method } = mapDbToFrontendType(m.type, m.description, m.paymentMethod);
          return {
            id: m.id,
            type: txType,
            amount: m.amount,
            method,
            profit: m.profit ?? undefined,
            description: m.description,
            timestamp: parseUtcDateString(m.createdAt),
            details: m.details ?? undefined,
          };
        });

        // Sort descending by timestamp
        mappedTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // currentBalance = only the PHYSICAL CASH in the drawer
        const currentBalance = calculateCashBalance(reg.openingBalance, mappedTransactions);

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

  fetchHistory: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    try {
      // Clean up movements older than 30 days for this tenant securely
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      try {
        const { data: registers } = await supabase
          .from('CashRegister')
          .select('id')
          .eq('tenantId', user.tenantId);

        const registerIds = (registers || []).map(r => r.id);
        
        if (registerIds.length > 0) {
          await supabase
            .from('CashMovement')
            .delete()
            .in('registerId', registerIds)
            .lt('createdAt', thirtyDaysAgo.toISOString());
        }
      } catch (err) {
        console.error('Error cleaning up old cash movements:', err);
      }

      const { data: movements, error } = await supabase
        .from('CashMovement')
        .select(`
          id,
          amount,
          type,
          paymentMethod,
          profit,
          description,
          createdAt,
          details,
          register:CashRegister!inner(tenantId)
        `)
        .eq('CashRegister.tenantId', user.tenantId)
        .order('createdAt', { ascending: false });

      if (error) throw error;

      const mappedTransactions: CashTransaction[] = (movements || []).map((m: any) => {
        const { txType, method } = mapDbToFrontendType(m.type, m.description, m.paymentMethod);
        return {
          id: m.id,
          type: txType,
          amount: m.amount,
          method,
          profit: m.profit ?? undefined,
          description: m.description,
          timestamp: parseUtcDateString(m.createdAt),
          details: m.details ?? undefined,
        };
      });

      set({
        history: mappedTransactions,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching cash history from Supabase:', error);
      set({ loading: false });
    }
  },

  fetchPastRegisters: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('CashRegister')
        .select('*, movements:CashMovement(*)')
        .eq('tenantId', user.tenantId)
        .eq('status', 'CLOSED')
        .order('openedAt', { ascending: false })
        .limit(10);

      if (error) throw error;
      set({ pastRegisters: data || [], loading: false });
    } catch (error) {
      console.error('Error fetching past registers from Supabase:', error);
      set({ loading: false });
    }
  },

  openBox: async (amount) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loading: true });
    try {
      // Check if there is already an open register for this tenant
      const { data: existingReg, error: checkError } = await supabase
        .from('CashRegister')
        .select('id')
        .eq('tenantId', user.tenantId)
        .eq('status', 'OPEN')
        .limit(1);

      if (checkError) throw checkError;

      if (existingReg && existingReg.length > 0) {
        alert('Ya existe una caja abierta para este comercio en otro dispositivo o pestaña. Por favor, ciérrala antes de abrir una nueva.');
        set({ loading: false });
        get().fetchActiveSession();
        return;
      }

      const { data: reg, error: regError } = await supabase
        .from('CashRegister')
        .insert({
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          registerId: reg.id,
          tenantId: user.tenantId,
          amount,
          type: 'IN',
          paymentMethod: 'EFECTIVO',
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

    const user = useAuthStore.getState().user;
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
          id: crypto.randomUUID(),
          registerId: session.id,
          tenantId: user?.tenantId,
          amount,
          type: 'OUT',
          paymentMethod: 'EFECTIVO',
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
        timestamp: parseUtcDateString(closeMovement.createdAt)
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
    const user = useAuthStore.getState().user;

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

    // Only EFECTIVO payments change the physical balance
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

    // 2. Persist to Supabase — store paymentMethod and profit
    try {
      const { data: savedMovement, error: movError } = await supabase
        .from('CashMovement')
        .insert({
          id: crypto.randomUUID(),
          registerId: session.id,
          tenantId: user?.tenantId,
          amount: tx.amount,
          type: mapFrontendTypeToDb(tx.type, tx.amount),
          paymentMethod: tx.method,
          profit: tx.profit ?? null,
          description: tx.description,
          details: tx.details ?? null
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
            timestamp: parseUtcDateString(savedMovement.createdAt)
          } : t)
        },
        history: state.history.map((t) => t.id === tempId ? {
          ...t,
          id: savedMovement.id,
          timestamp: parseUtcDateString(savedMovement.createdAt)
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
