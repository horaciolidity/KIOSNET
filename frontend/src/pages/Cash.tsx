import React, { useState } from 'react';
import { 
  Lock, 
  Unlock, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History as HistoryIcon, 
  Wallet,
  Clock,
  Banknote,
  SendHorizontal,
  CreditCard,
  X,
  TrendingUp,
  Activity,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Receipt
} from 'lucide-react';
import { useCashStore } from '../store/useCashStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

// ─────────────────────────────────────────────────────────────
// Method badge label & color helper
// ─────────────────────────────────────────────────────────────
const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
  EFECTIVO:        { label: 'Efectivo',         color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  TRANSFERENCIA:   { label: 'Transferencia',    color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-500/10' },
  DEBITO:          { label: 'Débito',            color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-500/10' },
  CREDITO:         { label: 'Crédito',           color: 'text-pink-600',    bg: 'bg-pink-50 dark:bg-pink-500/10' },
  CUENTA_CORRIENTE:{ label: 'Cta. Corriente',   color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-500/10' },
  NINGUNO:         { label: 'Sin método',        color: 'text-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800' },
};

const getMethod = (m: string) => METHOD_META[m] ?? METHOD_META['NINGUNO'];

const Cash: React.FC = () => {
  const { user } = useAuthStore();
  const { security } = useSettingsStore();
  const { session, openBox, closeBox, addTransaction } = useCashStore();

  React.useEffect(() => {
    useCashStore.getState().fetchActiveSession();
  }, []);

  const isEmployee = user?.role === 'EMPLOYEE' && (security?.employeeBlockCash ?? true);
  const [openingAmount, setOpeningAmount] = useState<string>('');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [showArqueo, setShowArqueo] = useState(false);
  const [txData, setTxData] = useState({
    type: 'INGRESO' as 'INGRESO' | 'EGRESO',
    amount: '',
    description: '',
    method: 'EFECTIVO' as any
  });

  // ──────────────────────────────────────────────────────────
  // Detailed financial calculations for the arqueo
  // ──────────────────────────────────────────────────────────
  const txs = session.transactions;

  // Sales by method
  const salesCash        = txs.filter(t => t.type === 'VENTA' && t.method === 'EFECTIVO').reduce((s, t) => s + t.amount, 0);
  const salesTransfer    = txs.filter(t => t.type === 'VENTA' && t.method === 'TRANSFERENCIA').reduce((s, t) => s + t.amount, 0);
  const salesDebit       = txs.filter(t => t.type === 'VENTA' && t.method === 'DEBITO').reduce((s, t) => s + t.amount, 0);
  const salesCredit      = txs.filter(t => t.type === 'VENTA' && t.method === 'CREDITO').reduce((s, t) => s + t.amount, 0);
  const salesCC          = txs.filter(t => t.type === 'VENTA' && t.method === 'CUENTA_CORRIENTE').reduce((s, t) => s + t.amount, 0);
  const totalSales       = salesCash + salesTransfer + salesDebit + salesCredit + salesCC;

  // Manual entries by method
  const manualIncomes    = txs.filter(t => t.type === 'INGRESO').reduce((s, t) => s + t.amount, 0);
  const debtPayments     = txs.filter(t => t.type === 'PAGO_DEUDA' && t.method === 'EFECTIVO').reduce((s, t) => s + t.amount, 0);

  // Expenses (always reduce cash)
  const totalExpenses    = txs.filter(t => t.type === 'EGRESO').reduce((s, t) => s + t.amount, 0);

  // Profit (sales - costs)
  const totalProfits     = txs.filter(t => t.type === 'VENTA').reduce((s, t) => s + (t.profit || 0), 0);

  // Totals per payment channel (all non-expense movements)
  const totalTransfers   = salesTransfer + txs.filter(t => t.type !== 'VENTA' && t.type !== 'EGRESO' && t.method === 'TRANSFERENCIA').reduce((s, t) => s + t.amount, 0);
  const totalDebit       = salesDebit   + txs.filter(t => t.type !== 'VENTA' && t.type !== 'EGRESO' && t.method === 'DEBITO').reduce((s, t) => s + t.amount, 0);
  const totalCredit      = salesCredit  + txs.filter(t => t.type !== 'VENTA' && t.type !== 'EGRESO' && t.method === 'CREDITO').reduce((s, t) => s + t.amount, 0);
  const totalCC          = salesCC      + txs.filter(t => t.type !== 'VENTA' && t.type !== 'EGRESO' && t.method === 'CUENTA_CORRIENTE').reduce((s, t) => s + t.amount, 0);

  // Grand total collected (all channels)
  const totalCollected   = salesCash + salesTransfer + salesDebit + salesCredit + manualIncomes + debtPayments;
  // Note: CC is not "collected" cash — it's a deferred payment

  const saleCount        = txs.filter(t => t.type === 'VENTA').length;

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(openingAmount) || 0;
    openBox(amount);
    setOpeningAmount('');
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    addTransaction({
      type: txData.type as any,
      amount: Number(txData.amount) || 0,
      description: txData.description,
      method: txData.method
    });
    setIsTxModalOpen(false);
    setTxData({ type: 'INGRESO', amount: '', description: '', method: 'EFECTIVO' });
  };

  // ──────────────────────────────────────────────────────────
  // Closed box screen
  // ──────────────────────────────────────────────────────────
  if (!session.isOpen) {
    return (
      <div className="p-8 h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[48px] shadow-2xl border border-slate-100 dark:border-slate-800 max-w-lg w-full text-center space-y-8 animate-in zoom-in-95">
          <div className="w-24 h-24 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
            <Lock size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Apertura de Caja</h1>
            <p className="text-slate-500 font-medium italic">Inicia el turno para comenzar a registrar movimientos.</p>
          </div>

          <form onSubmit={handleOpen} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Monto Inicial en Efectivo</label>
              <div className="relative">
                <span className="absolute left-6 top-5 text-slate-400 font-black text-xl">$</span>
                <input 
                  type="number"
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500 rounded-[24px] py-5 pl-12 pr-6 text-2xl font-black outline-none transition-all"
                  value={openingAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-xl hover:bg-blue-700 shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
            >
              ABRIR TURNO
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 h-[calc(100vh-64px)] overflow-y-auto bg-slate-50 dark:bg-slate-950 scrollbar-hide">

      {/* ── Header & Main Actions ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Caja Registradora <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
          </h1>
          <div className="flex items-center gap-4 text-slate-500 mt-2 font-bold uppercase text-xs tracking-widest">
            <div className="flex items-center gap-1"><Clock size={14}/> ABIERTO: {new Date(session.openedAt!).toLocaleTimeString()}</div>
            <div className="flex items-center gap-1"><Banknote size={14}/> INICIO: ${session.openingBalance.toLocaleString()}</div>
            <div className="flex items-center gap-1"><Receipt size={14}/> {saleCount} VENTA{saleCount !== 1 ? 'S' : ''}</div>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl"
          >
            <Wallet size={20} /> Movimiento
          </button>
          <button 
            onClick={() => setShowArqueo(v => !v)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 px-6 py-4 rounded-2xl font-black hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100 dark:border-indigo-500/20"
          >
            <BookOpen size={20} /> Arqueo {showArqueo ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          <button 
            onClick={() => { if(confirm('¿Cerrar caja?')) closeBox(session.currentBalance) }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-600 px-6 py-4 rounded-2xl font-black hover:bg-red-100 transition-all border border-red-100 dark:bg-red-500/10 dark:border-red-500/20"
          >
            <Unlock size={20} /> Cerrar Caja
          </button>
        </div>
      </div>

      {/* ── Top Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Efectivo en Caja" 
          amount={session.currentBalance} 
          icon={<Wallet size={20}/>} 
          color="blue"
          subtext="Saldo físico en cajón"
        />
        <StatCard 
          title="Ventas Totales" 
          amount={totalSales} 
          icon={<TrendingUp size={20}/>} 
          color="emerald"
          subtext={`${saleCount} venta${saleCount !== 1 ? 's' : ''} realizadas`}
        />
        {!isEmployee && (
          <StatCard 
            title="Ganancia Estimada" 
            amount={totalProfits} 
            icon={<Activity size={20}/>} 
            color="indigo"
            subtext="Ventas − Costos"
          />
        )}
        <StatCard 
          title="Gastos / Egresos" 
          amount={totalExpenses} 
          icon={<ArrowDownCircle size={20}/>} 
          color="red"
          subtext="Salidas de caja"
        />
      </div>

      {/* ── Payment Method Cards (detailed breakdown) ── */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Recaudación por Medio de Pago</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <PaymentCard title="Efectivo"       amount={salesCash}     icon={<Banknote size={22}/>}       colorKey="EFECTIVO" />
          <PaymentCard title="Transferencia"  amount={totalTransfers} icon={<SendHorizontal size={22}/>} colorKey="TRANSFERENCIA" />
          <PaymentCard title="Débito"         amount={totalDebit}    icon={<CreditCard size={22}/>}     colorKey="DEBITO" />
          <PaymentCard title="Crédito"        amount={totalCredit}   icon={<CreditCard size={22}/>}     colorKey="CREDITO" />
          <PaymentCard title="Cta. Corriente" amount={totalCC}       icon={<Activity size={22}/>}       colorKey="CUENTA_CORRIENTE" />
        </div>
      </div>

      {/* ── Arqueo Detallado (expandible) ── */}
      {showArqueo && (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-indigo-100 dark:border-indigo-500/20 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl text-indigo-600">
                <ShieldCheck size={22}/>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Arqueo de Caja</h2>
                <p className="text-xs text-slate-400 font-semibold">Resumen detallado del turno actual</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Ingresos */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ingresos del Turno</p>
                <ArqueoRow label="Saldo Apertura"        amount={session.openingBalance}    color="text-slate-600 dark:text-slate-400" />
                <ArqueoRow label="Ventas en Efectivo"    amount={salesCash}                 color="text-emerald-600" />
                <ArqueoRow label="Ventas Transferencia"  amount={salesTransfer}             color="text-blue-600" />
                <ArqueoRow label="Ventas Débito"         amount={salesDebit}                color="text-violet-600" />
                <ArqueoRow label="Ventas Crédito"        amount={salesCredit}               color="text-pink-600" />
                <ArqueoRow label="Ventas Cta. Corriente" amount={salesCC}                   color="text-orange-600" bold={false} italic />
                <ArqueoRow label="Ingresos Manuales"     amount={manualIncomes}             color="text-emerald-500" />
                <ArqueoRow label="Cobros de Deuda"       amount={debtPayments}              color="text-emerald-500" />
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <ArqueoRow label="TOTAL VENTAS + INGRESOS" amount={totalSales + manualIncomes + debtPayments} color="text-emerald-600" bold />
                </div>
              </div>

              {/* Right: Egresos + Resumen de Caja */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Egresos y Saldo Final</p>
                <ArqueoRow label="Total Egresos"         amount={totalExpenses}             color="text-red-500" sign="-" />
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                  <ArqueoRow label="SALDO EFECTIVO ESPERADO" amount={session.currentBalance} color="text-blue-600" bold />
                </div>

                <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl space-y-3 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">No ingresa al cajón físico</p>
                  <ArqueoRow label="Transferencias"      amount={totalTransfers}            color="text-blue-500" sign="=" />
                  <ArqueoRow label="Débito"              amount={totalDebit}                color="text-violet-500" sign="=" />
                  <ArqueoRow label="Crédito"             amount={totalCredit}               color="text-pink-500" sign="=" />
                  <ArqueoRow label="Cta. Corriente"      amount={totalCC}                   color="text-orange-500" sign="=" italic />
                </div>

                {!isEmployee && (
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl border border-indigo-100 dark:border-indigo-500/20">
                    <ArqueoRow label="Ganancia estimada" amount={totalProfits} color="text-indigo-600" bold />
                    <p className="text-[10px] text-indigo-400 font-semibold mt-1">Precio venta − Costo productos</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Transactions History ── */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-slate-900 dark:text-white">
          <h2 className="text-xl font-black flex items-center gap-2">
            <HistoryIcon size={24} className="text-blue-600" /> Historial de Movimientos
          </h2>
          <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 uppercase">{txs.length} Operaciones</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-8 py-5">Hora</th>
                <th className="px-8 py-5">Descripción</th>
                <th className="px-8 py-5">Medio de Pago</th>
                {!isEmployee && <th className="px-8 py-5 text-right">Ganancia</th>}
                <th className="px-8 py-5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {txs.length === 0 ? (
                <tr>
                  <td colSpan={isEmployee ? 4 : 5} className="px-8 py-20 text-center text-slate-400 font-bold italic">No hay movimientos registrados en este turno</td>
                </tr>
              ) : (
                txs.map((tx) => {
                  const meta = getMethod(tx.method);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="px-8 py-4 text-sm font-bold text-slate-500">
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-8 py-4">
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{tx.description}</p>
                        <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${
                          tx.type === 'EGRESO' ? 'bg-red-50 text-red-500 dark:bg-red-500/10' 
                          : tx.type === 'VENTA' ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10'
                          : tx.type === 'PAGO_DEUDA' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
                          : tx.type === 'SISTEMA' ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                          : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                        }`}>
                          {tx.type === 'PAGO_DEUDA' ? 'Cobro Deuda' : tx.type}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${meta.bg} ${meta.color}`}>
                          {tx.method === 'EFECTIVO' ? <Banknote size={12}/> 
                            : tx.method === 'TRANSFERENCIA' ? <SendHorizontal size={12}/> 
                            : <CreditCard size={12}/>}
                          {meta.label}
                        </span>
                      </td>
                      {!isEmployee && (
                        <td className="px-8 py-4 text-right">
                          {tx.profit ? (
                            <span className="text-sm font-bold text-indigo-500">+${tx.profit.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      )}
                      <td className={`px-8 py-4 text-right font-black text-lg ${tx.type === 'EGRESO' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {tx.type === 'EGRESO' ? '-' : '+'}${tx.amount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {txs.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan={isEmployee ? 2 : 2} className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Resumen del Turno</td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col gap-1 text-xs font-bold">
                      <span className="text-emerald-600">${salesCash.toLocaleString()} efectivo</span>
                      {totalTransfers > 0 && <span className="text-blue-600">${totalTransfers.toLocaleString()} transf.</span>}
                      {totalDebit > 0 && <span className="text-violet-600">${totalDebit.toLocaleString()} débito</span>}
                      {totalCredit > 0 && <span className="text-pink-600">${totalCredit.toLocaleString()} crédito</span>}
                    </div>
                  </td>
                  {!isEmployee && (
                    <td className="px-8 py-4 text-right font-bold text-indigo-500 text-sm">
                      +${totalProfits.toLocaleString()}
                    </td>
                  )}
                  <td className="px-8 py-4 text-right">
                    <div className="space-y-1">
                      <p className="text-emerald-600 font-black text-lg">${(totalSales + manualIncomes + debtPayments).toLocaleString()}</p>
                      <p className="text-red-500 font-bold text-xs">-${totalExpenses.toLocaleString()} egresos</p>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── New Transaction Modal ── */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Nuevo Movimiento</h2>
              <button onClick={() => setIsTxModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={24}/></button>
            </div>
            <form onSubmit={handleTransaction} className="p-8 space-y-6">
              {/* Type */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTxData({...txData, type: 'INGRESO'})} className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all ${txData.type === 'INGRESO' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500'}`}>
                  <ArrowUpCircle size={18}/> INGRESO
                </button>
                <button type="button" onClick={() => setTxData({...txData, type: 'EGRESO'})} className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all ${txData.type === 'EGRESO' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500'}`}>
                  <ArrowDownCircle size={18}/> EGRESO
                </button>
              </div>

              {/* Method (only for INGRESO) */}
              {txData.type === 'INGRESO' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Medio de pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTxData({...txData, method: m})}
                        className={`py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 border-2 transition-all ${txData.method === m ? `border-current ${getMethod(m).color} ${getMethod(m).bg}` : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400'}`}
                      >
                        {m === 'EFECTIVO' ? <Banknote size={14}/> : m === 'TRANSFERENCIA' ? <SendHorizontal size={14}/> : <CreditCard size={14}/>}
                        {getMethod(m).label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Monto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400 font-black">$</span>
                    <input type="number" required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-10 pr-4 font-black text-xl outline-none" value={txData.amount} onChange={(e) => setTxData({...txData, amount: e.target.value})} onFocus={(e) => e.target.select()} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Descripción</label>
                  <input type="text" required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-4 font-bold outline-none" placeholder="Ej: Pago de luz, carga de mercadería..." value={txData.description} onChange={(e) => setTxData({...txData, description: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-xl hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all">REGISTRAR</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

const StatCard = ({ title, amount, icon, color, subtext }: any) => {
  const colors: any = {
    blue:    'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    indigo:  'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20',
    red:     'text-red-600 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'
  };

  return (
    <div className={`p-6 rounded-[32px] border ${colors[color]} space-y-4`}>
      <div className="flex justify-between items-center">
        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">{icon}</div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{title}</p>
        <h3 className="text-2xl font-black tracking-tight">${amount.toLocaleString()}</h3>
        <p className="text-[10px] font-bold mt-1 opacity-60">{subtext}</p>
      </div>
    </div>
  );
};

const PaymentCard = ({ title, amount, icon, colorKey }: any) => {
  const meta = getMethod(colorKey);
  return (
    <div className={`p-5 rounded-[28px] border ${meta.bg} ${amount > 0 ? 'border-current/20' : 'border-slate-100 dark:border-slate-800'} flex items-center gap-4 transition-all`}>
      <div className={`p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm ${meta.color}`}>
        {icon}
      </div>
      <div>
        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${amount > 0 ? meta.color : 'text-slate-400'}`}>{title}</p>
        <h4 className={`text-xl font-black ${amount > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-700'}`}>
          ${amount.toLocaleString()}
        </h4>
      </div>
    </div>
  );
};

const ArqueoRow = ({ label, amount, color, bold = true, sign = '+', italic = false }: any) => (
  <div className="flex justify-between items-center">
    <span className={`text-sm font-${bold ? 'black' : 'semibold'} text-slate-500 dark:text-slate-400 ${italic ? 'italic' : ''}`}>{label}</span>
    <span className={`text-sm font-black ${color}`}>
      {sign !== '=' ? sign : ''}{sign === '-' ? '' : (sign === '+' ? '' : '')}${amount.toLocaleString()}
      {italic && <span className="text-[9px] ml-1 opacity-60">(diferida)</span>}
    </span>
  </div>
);

export default Cash;
