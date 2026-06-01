import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  ArrowUpRight,
  ArrowDownRight,
  BarChart3
} from 'lucide-react';
import { useCashStore } from '../store/useCashStore';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Reports: React.FC = () => {
  const { history, fetchHistory } = useCashStore();

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Data processing for charts
  const stats = useMemo(() => {
    const sales = history.filter(t => t.type === 'VENTA');
    const expenses = history.filter(t => t.type === 'EGRESO');
    
    const totalSales = sales.reduce((s, t) => s + t.amount, 0);
    const totalProfits = sales.reduce((s, t) => s + (t.profit || 0), 0);
    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
    
    // Sales by Category
    const categoryMap: Record<string, number> = {};
    sales.forEach(sale => {
      sale.details?.items?.forEach((item: any) => {
        categoryMap[item.category] = (categoryMap[item.category] || 0) + (item.price * item.quantity);
      });
    });
    const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // Sales by Method
    const methodMap: Record<string, number> = {};
    sales.forEach(sale => {
      methodMap[sale.method] = (methodMap[sale.method] || 0) + sale.amount;
    });
    const methodData = Object.entries(methodMap).map(([name, value]) => ({ name, value }));

    // Hourly/Daily Sales (mocking some trend if history is small)
    const timeData = history.slice(0, 10).reverse().map(t => ({
      time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      monto: t.amount,
      ganancia: t.profit || 0
    }));

    // Most sold products
    const productMap: Record<string, number> = {};
    sales.forEach(sale => {
      sale.details?.items?.forEach((item: any) => {
        productMap[item.name] = (productMap[item.name] || 0) + item.quantity;
      });
    });
    const topProducts = Object.entries(productMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalSales,
      totalProfits,
      totalExpenses,
      categoryData,
      methodData,
      timeData,
      topProducts,
      saleCount: sales.length
    };
  }, [history]);

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen overflow-y-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Analítica & Reportes <BarChart3 className="text-blue-600" />
          </h1>
          <p className="text-slate-500 font-medium">Estadísticas avanzadas del rendimiento de tu negocio.</p>
        </div>
        <div className="flex gap-4">
          <select className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-sm font-bold outline-none">
            <option>Hoy</option>
            <option>Ayer</option>
            <option>Últimos 7 días</option>
            <option>Este mes</option>
          </select>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
            Exportar Reporte
          </button>
        </div>
      </div>

      {/* High Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportStatCard 
          title="Ventas Totales" 
          value={`$${stats.totalSales.toLocaleString()}`} 
          change="+15.2%" 
          isPositive 
          icon={<DollarSign size={20}/>}
          color="blue"
        />
        <ReportStatCard 
          title="Ganancia Real" 
          value={`$${stats.totalProfits.toLocaleString()}`} 
          change="+8.4%" 
          isPositive 
          icon={<TrendingUp size={20}/>}
          color="emerald"
        />
        <ReportStatCard 
          title="Total Operaciones" 
          value={stats.saleCount.toString()} 
          change="+12" 
          isPositive 
          icon={<ShoppingCart size={20}/>}
          color="indigo"
        />
        <ReportStatCard 
          title="Gastos / Egresos" 
          value={`$${stats.totalExpenses.toLocaleString()}`} 
          change="-2.1%" 
          isPositive={false} 
          icon={<TrendingDown size={20}/>}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Sales Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Flujo de Ventas vs Ganancias</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <span className="text-xs font-bold text-slate-500 uppercase">Ventas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="text-xs font-bold text-slate-500 uppercase">Ganancias</span>
              </div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timeData}>
                <defs>
                  <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="monto" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorMonto)" />
                <Area type="monotone" dataKey="ganancia" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Pie Chart */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">Ventas por Categoría</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categoryData.length > 0 ? stats.categoryData : [{name: 'Sin datos', value: 1}]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  {stats.categoryData.length === 0 && <Cell fill="#e2e8f0" />}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {stats.categoryData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                <span className="text-[10px] font-black uppercase text-slate-500 truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Most Sold Products */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">Productos Más Vendidos</h3>
          <div className="space-y-6">
            {stats.topProducts.map((prod, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{prod.name}</span>
                  <span className="font-black text-blue-600">{prod.qty} uds</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-1000" 
                    style={{width: `${(prod.qty / (stats.topProducts[0]?.qty || 1)) * 100}%`}}
                  ></div>
                </div>
              </div>
            ))}
            {stats.topProducts.length === 0 && (
              <p className="text-center text-slate-400 py-10 italic">No hay ventas registradas aún.</p>
            )}
          </div>
        </div>

        {/* Methods Distribution */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">Métodos de Pago</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.methodData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  cursor={{fill: 'rgba(37, 99, 235, 0.05)'}}
                  contentStyle={{borderRadius: '20px', border: 'none'}}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportStatCard = ({ title, value, change, isPositive, icon, color }: any) => {
  const styles: any = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 border-blue-100 dark:border-blue-500/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-100 dark:border-emerald-500/20',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 border-indigo-100 dark:border-indigo-500/20',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-100 dark:border-red-500/20'
  };

  return (
    <div className={`p-8 rounded-[40px] border ${styles[color]} space-y-4 shadow-sm hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-center">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">{icon}</div>
        <div className={`flex items-center text-xs font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {change}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{title}</p>
        <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{value}</h2>
      </div>
    </div>
  );
};

export default Reports;
