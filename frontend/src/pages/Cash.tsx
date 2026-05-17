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
  Activity
} from 'lucide-react';
import { useCashStore } from '../store/useCashStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

const Cash: React.FC = () => {
  const { user } = useAuthStore();
  const { security } = useSettingsStore();
  const { session, openBox, closeBox, addTransaction } = useCashStore();
  const isEmployee = user?.role === 'EMPLOYEE' && (security?.employeeBlockCash ?? true);
  const [openingAmount, setOpeningAmount] = useState<string>('');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txData, setTxData] = useState({
    type: 'INGRESO' as 'INGRESO' | 'EGRESO',
    amount: '',
    description: '',
    method: 'EFECTIVO' as any
  });

  // Calculate detailed stats
  const totalSales = session.transactions.filter(t => t.type === 'VENTA').reduce((s, t) => s + t.amount, 0);
  const totalProfits = session.transactions.filter(t => t.type === 'VENTA').reduce((s, t) => s + (t.profit || 0), 0);
  const totalCash = session.transactions.filter(t => t.method === 'EFECTIVO' && t.type !== 'EGRESO').reduce((s, t) => s + t.amount, 0);
  const totalTransfers = session.transactions.filter(t => t.method === 'TRANSFERENCIA').reduce((s, t) => s + t.amount, 0);
  const totalDigital = session.transactions.filter(t => t.method === 'DEBITO' || t.method === 'CREDITO').reduce((s, t) => s + t.amount, 0);
  const totalCuentaCorriente = session.transactions.filter(t => t.method === 'CUENTA_CORRIENTE').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = session.transactions.filter(t => t.type === 'EGRESO').reduce((s, t) => s + t.amount, 0);

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
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Caja Registradora <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
          </h1>
          <div className="flex items-center gap-4 text-slate-500 mt-2 font-bold uppercase text-xs tracking-widest">
            <div className="flex items-center gap-1"><Clock size={14}/> ABIERTO: {new Date(session.openedAt!).toLocaleTimeString()}</div>
            <div className="flex items-center gap-1"><Banknote size={14}/> INICIO: ${session.openingBalance.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl"
          >
            <Wallet size={20} /> Movimiento
          </button>
          <button 
            onClick={() => { if(confirm('¿Cerrar caja?')) closeBox(session.currentBalance) }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-600 px-8 py-4 rounded-2xl font-black hover:bg-red-100 transition-all border border-red-100"
          >
            <Unlock size={20} /> Cerrar Caja
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Saldo Efectivo" 
          amount={session.currentBalance} 
          icon={<Wallet size={20}/>} 
          color="blue"
          subtext="Físico en caja"
        />
        <StatCard 
          title="Ventas Totales" 
          amount={totalSales} 
          icon={<TrendingUp size={20}/>} 
          color="emerald"
          subtext={`${session.transactions.filter(t => t.type === 'VENTA').length} ventas realizadas`}
        />
        {!isEmployee && (
          <StatCard 
            title="Ganancia Estimada" 
            amount={totalProfits} 
            icon={<Activity size={20}/>} 
            color="indigo"
            subtext="Ventas - Costos"
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

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <PaymentStatCard 
          title="Efectivo" 
          amount={totalCash} 
          icon={<Banknote size={24}/>}
          method="EFECTIVO"
        />
        <PaymentStatCard 
          title="Transferencias" 
          amount={totalTransfers} 
          icon={<SendHorizontal size={24}/>}
          method="TRANSFERENCIA"
        />
        <PaymentStatCard 
          title="Débito / Crédito" 
          amount={totalDigital} 
          icon={<CreditCard size={24}/>}
          method="DIGITAL"
        />
        <PaymentStatCard 
          title="Cta. Corriente" 
          amount={totalCuentaCorriente} 
          icon={<Activity size={24}/>}
          method="CUENTA_CORRIENTE"
        />
      </div>

      {/* Transactions History */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-slate-900 dark:text-white">
          <h2 className="text-xl font-black flex items-center gap-2">
            <HistoryIcon size={24} className="text-blue-600" /> Historial de Movimientos
          </h2>
          <span className="text-xs font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 uppercase">{session.transactions.length} Operaciones</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-8 py-5">Hora</th>
                <th className="px-8 py-5">Descripción</th>
                <th className="px-8 py-5">Método</th>
                {!isEmployee && <th className="px-8 py-5 text-right">Ganancia</th>}
                <th className="px-8 py-5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {session.transactions.length === 0 ? (
                <tr>
                  <td colSpan={isEmployee ? 4 : 5} className="px-8 py-20 text-center text-slate-400 font-bold italic">No hay movimientos registrados en este turno</td>
                </tr>
              ) : (
                session.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                    <td className="px-8 py-5 text-sm font-bold text-slate-500">
                      {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-900 dark:text-white">{tx.description}</p>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${tx.type === 'EGRESO' ? 'text-red-500' : tx.type === 'VENTA' ? 'text-blue-500' : 'text-emerald-500'}`}>
                        {tx.type}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
                        {tx.method === 'EFECTIVO' ? <Banknote size={14}/> : tx.method === 'TRANSFERENCIA' ? <SendHorizontal size={14}/> : <CreditCard size={14}/>}
                        {tx.method}
                      </div>
                    </td>
                    {!isEmployee && (
                      <td className="px-8 py-5 text-right">
                        {tx.profit ? (
                          <span className="text-sm font-bold text-indigo-500">+${tx.profit.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    )}
                    <td className={`px-8 py-5 text-right font-black text-lg ${tx.type === 'EGRESO' ? 'text-red-500' : 'text-emerald-500'}`}>
                      {tx.type === 'EGRESO' ? '-' : '+'}${tx.amount.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isTxModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Nuevo Movimiento</h2>
              <button onClick={() => setIsTxModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={24}/></button>
            </div>
            <form onSubmit={handleTransaction} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTxData({...txData, type: 'INGRESO'})} className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all ${txData.type === 'INGRESO' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500'}`}>
                  <ArrowUpCircle size={18}/> INGRESO
                </button>
                <button type="button" onClick={() => setTxData({...txData, type: 'EGRESO'})} className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all ${txData.type === 'EGRESO' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500'}`}>
                  <ArrowDownCircle size={18}/> EGRESO
                </button>
              </div>
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

const StatCard = ({ title, amount, icon, color, subtext }: any) => {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'
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

const PaymentStatCard = ({ title, amount, icon }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 flex items-center gap-4 shadow-sm">
    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 group-hover:text-blue-600 transition-colors">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
      <h4 className="text-xl font-black text-slate-900 dark:text-white">${amount.toLocaleString()}</h4>
    </div>
  </div>
);

export default Cash;
