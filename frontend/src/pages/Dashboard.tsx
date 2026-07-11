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
import { useCustomerStore } from '../store/useCustomerStore';
import { supabase } from '../utils/supabaseClient';

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { businessInfo } = useSettingsStore();
  const { products, loading: inventoryLoading } = useInventoryStore();
  const { history, fetchHistory, loading: cashLoading } = useCashStore();
  const { customers, loading: customerLoading } = useCustomerStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const [prices, setPrices] = useState({ price_standard: 12320, price_pro: 15730 });
  const [hardwareLinks, setHardwareLinks] = useState({ link_scanner: '', link_printer: '', link_display: '' });

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
          const linkScanner = data.find((c: any) => c.key === 'link_scanner')?.value || '';
          const linkPrinter = data.find((c: any) => c.key === 'link_printer')?.value || '';
          const linkDisplay = data.find((c: any) => c.key === 'link_display')?.value || '';

          setPrices({
            price_standard: standardPrice ? Number(standardPrice) : 12320,
            price_pro: proPrice ? Number(proPrice) : 15730
          });
          setHardwareLinks({
            link_scanner: linkScanner,
            link_printer: linkPrinter,
            link_display: linkDisplay
          });
        }
      } catch (err) {
        console.error('Error fetching plan prices from Supabase:', err);
      }
    };
    fetchPrices();
  }, []);

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const salesToday = history.filter(t => {
    if (t.type !== 'VENTA') return false;
    try {
      const dateStr = new Date(t.timestamp).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
      const todayStr = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
      return dateStr === todayStr;
    } catch (e) {
      return false;
    }
  }).reduce((s, t) => s + t.amount, 0);
  const isStatsLoading = inventoryLoading || cashLoading || customerLoading;
  
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
        <div className="flex gap-4" id="tour-dashboard-license">
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
      <div id="tour-dashboard-stats" className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-300 ${isStatsLoading ? 'opacity-65 animate-pulse pointer-events-none' : ''}`}>
        <StatCard title="Ventas Hoy" value={`$${salesToday.toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-blue-600" />} color="blue" />
        <StatCard title="Productos" value={products.length.toString()} icon={<Package className="w-6 h-6 text-emerald-600" />} color="emerald" />
        <StatCard title="Stock Bajo" value={lowStockCount.toString()} icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} color="orange" />
        <StatCard title="Clientes" value={customers.length.toString()} icon={<Users className="w-6 h-6 text-indigo-600" />} color="indigo" />
      </div>

      {/* Hardware Tips Banner */}
      <div id="tour-dashboard-hardware">
        <HardwareTips hardwareLinks={hardwareLinks} />
      </div>

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

const HardwareTips = ({ hardwareLinks }: { hardwareLinks: { link_scanner: string; link_printer: string; link_display: string } }) => (
  <div className="relative overflow-hidden rounded-[40px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
    {/* Top accent bar */}
    <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

    <div className="p-8 md:p-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-500/20 mb-3">
            <Zap size={12} /> hardware 100% compatible y listo
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
            Equipá tu caja y vendé como las grandes cadenas
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-2 max-w-2xl">
            KIOSNET ya está programado para recibir tus dispositivos. Conectá tus periféricos mediante USB o Bluetooth y el sistema los detectará de forma automática y transparente.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-xl shadow-blue-500/25 flex-shrink-0">
          <ScanBarcode size={36} className="text-white" />
        </div>
      </div>

      {/* Grid of Devices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Barcode Scanner Card */}
        <div className="group relative rounded-[32px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1">
          <div className="space-y-4">
            <div className="w-full h-40 bg-slate-200 dark:bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-100 dark:border-slate-800 flex items-center justify-center p-1">
              <img src="/barcode_scanner_mockup_1780360667453.png" alt="Lector Código de Barras" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Lector de Códigos</h3>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">Lectora de barra USB/Bluetooth</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Añadí artículos al carrito al instante, realizá búsquedas inteligentes de stock y evitá errores humanos al cargar precios manualmente.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
            <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
              🔌 Conectar y listo
            </span>
            {hardwareLinks.link_scanner && (
              <a href={hardwareLinks.link_scanner} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-blue-600 hover:underline">
                Comprar recomendado →
              </a>
            )}
          </div>
        </div>

        {/* Thermal Printer Card */}
        <div className="group relative rounded-[32px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:-translate-y-1">
          <div className="space-y-4">
            <div className="w-full h-40 bg-slate-200 dark:bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-100 dark:border-slate-800 flex items-center justify-center p-1">
              <img src="/thermal_printer_mockup_1780360685003.png" alt="Impresora Térmica" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Ticketera Térmica</h3>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">Impresora estándar 80mm</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Imprimí comprobantes profesionales para tus clientes directamente desde la pantalla de venta. Compatible con comandos ESC/POS estándar.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
            <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
              🧾 Compatible 100%
            </span>
            {hardwareLinks.link_printer && (
              <a href={hardwareLinks.link_printer} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-indigo-600 hover:underline">
                Comprar recomendado →
              </a>
            )}
          </div>
        </div>

        {/* Customer Broadcast Display Card */}
        <div className="group relative rounded-[32px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 p-6 flex flex-col justify-between hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-1">
          <div className="space-y-4">
            <div className="w-full h-40 bg-slate-200 dark:bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-100 dark:border-slate-800 flex items-center justify-center p-1">
              <img src="/customer_display_mockup_1780360703023.png" alt="Pantalla de Clientes" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Pantalla Cliente</h3>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-0.5">Terminal Broadcast KIOSNET</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Usa una segunda tablet o monitor para que tu cliente visualice el detalle de su compra y el saldo en tiempo real. ¡Genera máxima confianza de compra!
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <span className="text-[10px] font-black text-amber-500 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
                ⭐ Exclusivo PRO
              </span>
              <a 
                href="/display" 
                onClick={(e) => {
                  e.preventDefault();
                  window.open('/display', 'CustomerDisplay', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
                }}
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs font-black text-blue-600 hover:underline"
              >
                Abrir Pantalla →
              </a>
            </div>
            {hardwareLinks.link_display && (
              <a href={hardwareLinks.link_display} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-emerald-600 hover:underline">
                Comprar recomendado →
              </a>
            )}
          </div>
        </div>

      </div>

      {/* Support and Setup Assistance Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-55 dark:bg-slate-800/40 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/80 shadow-inner">
        <div className="flex items-start gap-4 text-left">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.835-1.921c1.554.922 3.19 1.408 4.887 1.409 5.864 0 10.635-4.757 10.638-10.613.002-2.836-1.1-5.503-3.102-7.51-2.003-2.008-4.667-3.112-7.502-3.113-5.869 0-10.64 4.757-10.643 10.615-.001 1.83.488 3.619 1.417 5.176L1.83 22.097l5.062-1.849zm12.015-8.18c-.31-.156-1.839-.908-2.11-.1-.271.1-.387.417-.474.517-.087.1-.175.111-.486-.044-.31-.156-1.31-.483-2.495-1.54-.922-.822-1.543-1.838-1.724-2.15-.18-.31-.019-.478.136-.633.14-.139.31-.361.466-.543.156-.183.208-.313.31-.522.104-.21.052-.392-.026-.549-.078-.156-.685-1.651-.938-2.26-.247-.594-.499-.514-.685-.523-.175-.009-.377-.01-.58-.01a1.116 1.116 0 00-.809.378c-.277.311-1.057 1.033-1.057 2.52 0 1.487 1.082 2.922 1.232 3.122.15.2.2.13 1.134 3.013.9.78 1.637 1.543 2.5 1.868.863.325 1.653.24 2.273.15.688-.1 1.839-.751 2.1-.1.26.65.26 1.205.13 1.438-.13.233-.387.35-.698.506z" />
            </svg>
          </div>
          <div>
            <h4 className="font-black text-slate-900 dark:text-white text-base">¿Tenés alguna duda o necesitas ayuda técnica para configurarlos?</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl font-medium">
              Ponete en contacto de inmediato conmigo a través de mi celular de soporte de KIOSNET. Te guío paso a paso en la conexión sin cargo.
            </p>
          </div>
        </div>
        <a 
          href="https://wa.me/5492617048835?text=Hola!%20Necesito%20ayuda%20para%20conectar%20el%20lector/impresora%20en%20KIOSNET"
          target="_blank" 
          rel="noopener noreferrer" 
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm px-6 py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
        >
          Hablar con Soporte
        </a>
      </div>

    </div>
  </div>
);

export default Dashboard;
