import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  DollarSign, 
  AlertTriangle,
  CheckCircle2,
  Lock,
  Zap,
  CreditCard,
  Crown,
  Printer,
  ScanBarcode,
  Wallet,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useCashStore } from '../store/useCashStore';
import { supabase } from '../utils/supabaseClient';

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { businessInfo } = useSettingsStore();
  const { products } = useInventoryStore();
  const { history, fetchHistory } = useCashStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const [prices, setPrices] = useState({ price_standard: 12320, price_pro: 15730 });

  // Fetch plan prices from dynamic pricing backend API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const { data, error } = await supabase
          .from('SystemConfig')
          .select('*');

        if (error) throw error;

        if (data) {
          const standardPrice = data.find((c: any) => c.key === 'price_standard')?.value;
          const proPrice = data.find((c: any) => c.key === 'price_pro')?.value;
          setPrices({
            price_standard: standardPrice ? Number(standardPrice) : 12320,
            price_pro: proPrice ? Number(proPrice) : 15730
          });
        }
      } catch (err) {
        console.error('Error fetching plan prices from Supabase:', err);
      }
    };
    fetchPrices();
  }, []);

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const salesToday = history.filter(t => t.type === 'VENTA').reduce((s, t) => s + t.amount, 0);
  
  // Real Database Subscription Details
  const activePlan = user?.subActive ? user?.plan : 'FREE';
  const salesUsed = user?.salesCount ?? 0;
  const salesLimit = 50;
  const salesPercentage = Math.min((salesUsed / salesLimit) * 100, 100);

  // Calculate real remaining license days
  const daysRemaining = user?.subExpiresAt 
    ? Math.max(1, Math.round((new Date(user.subExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) 
    : 0;

  const handleSelectPlan = (plan: 'STANDARD' | 'PRO') => {
    navigate(`/billing?plan=${plan}`);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen overflow-y-auto pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white">Panel de Control</h1>
          <p className="text-slate-500 font-medium">Bienvenido a {businessInfo?.name || 'tu Comercio'}.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan Actual</p>
              <p className="text-sm font-black text-blue-600">{activePlan}</p>
            </div>
            <div className={`p-2 rounded-xl ${activePlan === 'FREE' ? 'bg-slate-100' : 'bg-blue-600 text-white'}`}>
              {activePlan === 'PRO' ? <Crown size={20}/> : <Zap size={20}/>}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Progress (Only for Free) */}
      {activePlan === 'FREE' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity size={20} className="text-blue-600" /> Ventas Disponibles (Base de datos)
            </h3>
            <span className="text-sm font-black text-slate-500">{salesUsed} / {salesLimit}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${salesPercentage > 80 ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${salesPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-slate-500 font-medium italic">
            {salesUsed >= salesLimit 
              ? 'Has agotado tus 50 ventas gratuitas. Tu facturación en el POS se ha bloqueado. Por favor, selecciona un plan mensual debajo para continuar.' 
              : `Te quedan ${salesLimit - salesUsed} ventas gratuitas para probar el sistema.`}
          </p>
        </div>
      )}

      {/* Active Plan Balance (For Standard/Pro) */}
      {activePlan !== 'FREE' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet size={20} className="text-emerald-500" /> Suscripción Activa ({activePlan})
            </h3>
            <p className="text-sm text-slate-500 font-medium">Tu licencia está activa y se encuentra sincronizada con la base de datos de KIOSNET.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl text-center">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Días Restantes</p>
              <p className="text-xl font-black text-emerald-500">
                {daysRemaining} días
              </p>
            </div>
            {user?.subExpiresAt && (
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha de Vencimiento</p>
                <h2 className="text-lg font-black text-slate-700 dark:text-slate-300">
                  {new Date(user.subExpiresAt).toLocaleDateString()}
                </h2>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Ventas Hoy" value={`$${salesToday.toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-blue-600" />} color="blue" />
        <StatCard title="Productos" value={products.length.toString()} icon={<Package className="w-6 h-6 text-emerald-600" />} color="emerald" />
        <StatCard title="Stock Bajo" value={lowStockCount.toString()} icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} color="orange" />
        <StatCard title="Clientes" value="0" icon={<Users className="w-6 h-6 text-indigo-600" />} color="indigo" />
      </div>

      {/* Hardware Tips Banner */}
      <HardwareTips />

      {/* Plans Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Planes de Suscripción Mensual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Standard Plan */}
          <PlanCard 
            title="Plan Estándar"
            price={prices.price_standard}
            color="blue"
            active={activePlan === 'STANDARD'}
            onSelect={() => handleSelectPlan('STANDARD')}
            features={[
              { text: "Ventas Ilimitadas", active: true },
              { text: "Lector de Código de Barras", active: true },
              { text: "Ticketera Térmica 80mm", active: true },
              { text: "Control de Inventario", active: true },
              { text: "Modo Empleado", active: false },
              { text: "Pantalla Display Cliente", active: false },
              { text: "Gestión de Créditos", active: false },
            ]}
          />

          {/* Pro Plan */}
          <PlanCard 
            title="Plan Pro"
            price={prices.price_pro}
            color="indigo"
            featured
            active={activePlan === 'PRO'}
            onSelect={() => handleSelectPlan('PRO')}
            features={[
              { text: "Ventas Ilimitadas", active: true },
              { text: "Lector de Código de Barras", active: true },
              { text: "Ticketera Térmica 80mm", active: true },
              { text: "Modo Empleado Configurable", active: true },
              { text: "Pantalla Display Cliente", active: true },
              { text: "Gestión de Créditos Cliente", active: true },
              { text: "Reportes Avanzados", active: true },
            ]}
          />
        </div>
      </div>

      {/* Mercado Pago CTA */}
      <div className="bg-blue-600 rounded-[48px] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl shadow-blue-600/30">
        <div className="relative z-10 space-y-4 text-center md:text-left">
          <h2 className="text-4xl font-black leading-tight">Paga ahora con Mercado Pago</h2>
          <p className="text-blue-100 text-lg font-medium max-w-md">Activa tu licencia mensual de forma inmediata y no detengas tus ventas.</p>
          <div className="flex gap-4 justify-center md:justify-start">
            <div className="flex items-center gap-2 text-sm font-black bg-white/10 px-4 py-2 rounded-full">
              <ScanBarcode size={18} /> Lector OK
            </div>
            <div className="flex items-center gap-2 text-sm font-black bg-white/10 px-4 py-2 rounded-full">
              <Printer size={18} /> Térmica OK
            </div>
          </div>
        </div>
        <button 
          onClick={() => navigate('/billing')}
          className="relative z-10 bg-white text-blue-600 px-10 py-6 rounded-[28px] font-black text-2xl flex items-center gap-4 hover:bg-slate-50 transition-all shadow-2xl active:scale-95 group"
        >
          <CreditCard size={32} /> PAGAR LICENCIA
        </button>
        {/* Abstract background circles */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => {
  const styles: any = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    orange: 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20'
  };

  return (
    <div className={`p-8 rounded-[40px] border ${styles[color]} shadow-sm hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
          {icon}
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{title}</p>
      <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</h2>
    </div>
  );
};

const PlanCard = ({ title, price, featured, features, active, onSelect }: any) => (
  <div className={`p-10 rounded-[48px] border-2 flex flex-col justify-between transition-all relative ${
    featured 
    ? 'bg-white dark:bg-slate-900 border-indigo-600 shadow-2xl shadow-indigo-600/10 scale-[1.02]' 
    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm'
  }`}>
    {featured && (
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl">
        Recomendado
      </div>
    )}
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-400 font-bold text-sm">Licencia mensual para comercio</p>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-black text-slate-900 dark:text-white">${price.toLocaleString()}</span>
        <span className="text-slate-400 font-bold">/ mes</span>
      </div>
      <ul className="space-y-4 pt-4 border-t border-slate-50 dark:border-slate-800">
        {features.map((f: any, i: number) => (
          <li key={i} className={`flex items-center gap-3 text-sm font-bold ${f.active ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600 line-through'}`}>
            {f.active ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Lock size={18} className="opacity-50" />}
            {f.text}
          </li>
        ))}
      </ul>
    </div>
    <button onClick={active ? undefined : onSelect} className={`mt-10 w-full py-5 rounded-[24px] font-black text-lg transition-all ${
      active 
      ? 'bg-emerald-100 text-emerald-600 cursor-default' 
      : 'bg-slate-900 text-white hover:bg-slate-800'
    }`}>
      {active ? 'PLAN ACTIVO' : 'SELECCIONAR PLAN'}
    </button>
  </div>
);

const HardwareTips = () => (
  <div className="relative overflow-hidden rounded-[40px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
    {/* Top accent bar */}
    <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

    <div className="p-8 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-500/20 mb-3">
            <Zap size={12} /> Aprovechá al Máximo KIOSNET
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
            Equipá tu caja y vendé como un profesional
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-2 max-w-xl">
            Con un lector de código de barras y una ticketera térmica de 80mm, KIOSNET funciona a plena velocidad — exactamente como los sistemas de grandes cadenas de comercio.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-xl shadow-blue-500/25 flex-shrink-0">
          <ScanBarcode size={36} className="text-white" />
        </div>
      </div>

      {/* Two Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Barcode Scanner Card */}
        <div className="group relative rounded-3xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-6 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 flex-shrink-0">
              <ScanBarcode size={26} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Lector de Código de Barras</h3>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">USB / Bluetooth</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {[
              'Añadí productos al carrito al instante — sin tipear nada',
              'Buscá en tu inventario con un simple escaneo',
              'Eliminá errores de carga y acelerá cada venta',
              'Compatible con cualquier lector HID estándar'
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300 font-medium">
                <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                {tip}
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-4 border-t border-blue-100 dark:border-blue-500/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Velocidad de carga</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-500/20 rounded-full overflow-hidden">
                <div className="h-full w-[96%] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
              </div>
              <span className="text-xs font-black text-blue-600">×10 más rápido</span>
            </div>
          </div>
        </div>

        {/* Thermal Printer Card */}
        <div className="group relative rounded-3xl border border-violet-100 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5 p-6 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-violet-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-violet-600/20 flex-shrink-0">
              <Printer size={26} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Ticketera Térmica 80mm</h3>
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mt-0.5">USB / Serie</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {[
              'Imprimí tickets profesionales desde el POS con un clic',
              'Formato 80mm optimizado — logo, CUIT, ítems y vuelto',
              'Compatible con impresoras ESC/POS estándar del mercado',
              'Tus clientes se van con comprobante: más confianza y orden'
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300 font-medium">
                <CheckCircle2 size={16} className="text-violet-500 flex-shrink-0 mt-0.5" />
                {tip}
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-4 border-t border-violet-100 dark:border-violet-500/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Experiencia del cliente</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-2 bg-violet-100 dark:bg-violet-500/20 rounded-full overflow-hidden">
                <div className="h-full w-[92%] bg-gradient-to-r from-violet-500 to-purple-500 rounded-full" />
              </div>
              <span className="text-xs font-black text-violet-600">Nivel Pro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tip */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-6 py-4 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Consejo Pro</span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
          Conectá el lector al puerto USB y KIOSNET lo detecta automáticamente. No requiere ningún driver ni configuración extra.
        </p>
      </div>
    </div>
  </div>
);

export default Dashboard;
