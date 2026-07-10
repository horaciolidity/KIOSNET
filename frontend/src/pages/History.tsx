import React, { useState } from 'react';
import { 
  History as HistoryIcon, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Banknote,
  CreditCard,
  SendHorizontal,
  Package,
  TrendingUp,
  ArrowDownCircle,
  Clock
} from 'lucide-react';
import { useCashStore } from '../store/useCashStore';

const History: React.FC = () => {
  const { history, fetchHistory, loading } = useCashStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'TODOS' | 'VENTA' | 'EGRESO' | 'SISTEMA'>('TODOS');
  const [filterPeriod, setFilterPeriod] = useState<'HOY' | 'SEMANA' | 'QUINCENA' | 'MES'>('MES');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.id.includes(searchTerm);
    const matchesType = filterType === 'TODOS' || item.type === filterType;
    
    const itemDate = new Date(item.timestamp);
    const now = new Date();
    
    let matchesPeriod = true;
    if (filterPeriod === 'HOY') {
      matchesPeriod = itemDate.toDateString() === now.toDateString();
    } else if (filterPeriod === 'SEMANA') {
      const diffTime = Math.abs(now.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      matchesPeriod = diffDays <= 7;
    } else if (filterPeriod === 'QUINCENA') {
      const diffTime = Math.abs(now.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      matchesPeriod = diffDays <= 15;
    } else if (filterPeriod === 'MES') {
      const diffTime = Math.abs(now.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      matchesPeriod = diffDays <= 30;
    }

    return matchesSearch && matchesType && matchesPeriod;
  });

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const totalSales = filteredHistory.filter(t => t.type === 'VENTA').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredHistory.filter(t => t.type === 'EGRESO').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Historial de Operaciones <HistoryIcon className="text-blue-600" />
            {loading && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full animate-pulse">
                Actualizando...
              </span>
            )}
          </h1>
          <p className="text-slate-500 font-medium">Registro detallado de todos los movimientos del sistema.</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={18} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-300 ${loading ? 'opacity-60 animate-pulse pointer-events-none' : ''}`}>
        <SummaryCard title="Ventas en Historial" amount={totalSales} icon={<TrendingUp size={20}/>} color="emerald" />
        <SummaryCard title="Gastos en Historial" amount={totalExpenses} icon={<ArrowDownCircle size={20}/>} color="red" />
        <SummaryCard title="Balance Neto" amount={totalSales - totalExpenses} icon={<HistoryIcon size={20}/>} color="blue" />
      </div>

      {/* Period Filter Tabs */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm max-w-lg">
        {[
          { key: 'HOY', label: 'Hoy' },
          { key: 'SEMANA', label: 'Esta Semana' },
          { key: 'QUINCENA', label: 'Esta Quincena' },
          { key: 'MES', label: 'Últimos 30 Días' }
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setFilterPeriod(p.key as any)}
            className={`flex-1 text-center py-2.5 rounded-xl text-xs font-black transition-all ${
              filterPeriod === p.key
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por ID, descripción o nota..." 
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3.5 px-12 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['TODOS', 'VENTA', 'EGRESO', 'SISTEMA'].map((type) => (
            <button 
              key={type}
              onClick={() => setFilterType(type as any)}
              className={`px-6 py-3 rounded-2xl text-xs font-black transition-all border ${
                filterType === type 
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500 hover:border-slate-200 dark:hover:border-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Main History Table */}
      <div className={`bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-8 py-5">Fecha / Hora</th>
                <th className="px-8 py-5">Tipo / ID</th>
                <th className="px-8 py-5">Descripción</th>
                <th className="px-8 py-5">Método</th>
                <th className="px-8 py-5 text-right">Monto</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold italic">No se encontraron movimientos para los filtros seleccionados</td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer ${expandedRow === item.id ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
                      onClick={() => toggleRow(item.id)}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                            <Clock size={16} className="text-slate-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.type === 'VENTA' ? 'bg-blue-100 text-blue-600' : 
                          item.type === 'PAGO_DEUDA' ? 'bg-orange-100 text-orange-600' :
                          item.type === 'EGRESO' ? 'bg-red-100 text-red-600' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {item.type}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">#{item.id}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{item.description}</p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                          {item.method === 'EFECTIVO' ? <Banknote size={14}/> : 
                           item.method === 'TRANSFERENCIA' ? <SendHorizontal size={14}/> : 
                           item.method === 'CUENTA_CORRIENTE' ? <CreditCard size={14}/> : 
                           item.method === 'NINGUNO' ? null : <CreditCard size={14}/>}
                          {item.method !== 'NINGUNO' && (item.method === 'CUENTA_CORRIENTE' ? 'CTA. CTE' : item.method)}
                        </div>
                      </td>
                      <td className={`px-8 py-5 text-right font-black text-lg ${
                        item.type === 'EGRESO' ? 'text-red-500' : 
                        item.type === 'VENTA' || item.type === 'PAGO_DEUDA' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'
                      }`}>
                        {item.type === 'EGRESO' ? '-' : '+'}${item.amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {expandedRow === item.id ? <ChevronUp className="text-slate-300 ml-auto" /> : <ChevronDown className="text-slate-300 ml-auto" />}
                      </td>
                    </tr>
                    
                    {/* Expanded Detail Row */}
                    {expandedRow === item.id && (
                      <tr className="bg-slate-50/50 dark:bg-slate-800/20 animate-in fade-in duration-300">
                        <td colSpan={6} className="px-8 py-8 border-t border-slate-100 dark:border-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Package size={14} /> Detalle de Productos
                              </h4>
                              {item.details?.items ? (
                                <div className="space-y-2">
                                  {item.details.items.map((prod: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-center text-xs">
                                          {idx + 1}
                                        </div>
                                        <div>
                                          <p className="font-bold text-sm text-slate-900 dark:text-white">{prod.name}</p>
                                          <p className="text-[10px] text-slate-500">{prod.category} • Cantidad: {prod.quantity}</p>
                                        </div>
                                      </div>
                                      <p className="font-black text-blue-600">${(prod.price * prod.quantity).toLocaleString()}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm italic text-slate-400">Sin detalles adicionales registrados.</p>
                              )}
                            </div>
                            
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Novedades / Notas</h4>
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 min-h-[80px]">
                                  <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                                    {item.details?.note || "Sin notas registradas para esta operación."}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <button className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                                  <Download size={14} /> Descargar Ticket
                                </button>
                                {item.type === 'VENTA' && (
                                  <button className="flex-1 bg-blue-600 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                                    <TrendingUp size={14} /> Ver Reporte
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, amount, icon, color }: any) => {
  const styles: any = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-100 dark:border-emerald-500/20',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-100 dark:border-red-500/20',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 border-blue-100 dark:border-blue-500/20'
  };

  return (
    <div className={`p-6 rounded-[32px] border ${styles[color]} flex items-center gap-4 shadow-sm`}>
      <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{title}</p>
        <h3 className="text-2xl font-black tracking-tight">${amount.toLocaleString()}</h3>
      </div>
    </div>
  );
};

export default History;
