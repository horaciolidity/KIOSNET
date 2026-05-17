import React from 'react';
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
  Activity,
  QrCode,
  X
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useCashStore } from '../store/useCashStore';

const Dashboard: React.FC = () => {
  const { subscription, businessInfo, upgradePlan, deductDailyBalance } = useSettingsStore();
  const { products } = useInventoryStore();
  const { history } = useCashStore();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const salesToday = history.filter(t => t.type === 'VENTA').reduce((s, t) => s + t.amount, 0);
  
  const salesPercentage = (subscription.salesUsed / subscription.salesLimit) * 100;

  // Simulate daily deduction for visual purposes
  React.useEffect(() => {
    if (subscription.status === 'ACTIVE' && subscription.remainingBalance && subscription.remainingBalance > 0) {
      const interval = setInterval(() => {
        deductDailyBalance();
      }, 10000); // Deduct every 10 seconds to simulate days passing for demo
      return () => clearInterval(interval);
    }
  }, [subscription.status, subscription.remainingBalance, deductDailyBalance]);

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen overflow-y-auto pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white">Panel de Control</h1>
          <p className="text-slate-500 font-medium">Bienvenido a {businessInfo.name}.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan Actual</p>
              <p className="text-sm font-black text-blue-600">{subscription.plan}</p>
            </div>
            <div className={`p-2 rounded-xl ${subscription.plan === 'FREE' ? 'bg-slate-100' : 'bg-blue-600 text-white'}`}>
              {subscription.plan === 'PRO' ? <Crown size={20}/> : <Zap size={20}/>}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Progress (Only for Free) */}
      {subscription.plan === 'FREE' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity size={20} className="text-blue-600" /> Ventas Disponibles (Demo)
            </h3>
            <span className="text-sm font-black text-slate-500">{subscription.salesUsed} / {subscription.salesLimit}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${salesPercentage > 80 ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${salesPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-slate-500 font-medium italic">
            {subscription.salesUsed >= subscription.salesLimit 
              ? 'Has agotado tus ventas gratuitas. Actualiza tu plan para seguir operando.' 
              : `Te quedan ${subscription.salesLimit - subscription.salesUsed} ventas para probar el sistema.`}
          </p>
        </div>
      )}

      {/* Active Plan Balance (For Standard/Pro) */}
      {subscription.plan !== 'FREE' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet size={20} className="text-emerald-500" /> Saldo de Licencia {subscription.plan}
            </h3>
            <p className="text-sm text-slate-500 font-medium">El saldo de licencia se debita de forma proporcional diaria y se renueva al mes.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl text-center">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Días de Uso Restantes</p>
              <p className="text-xl font-black text-emerald-500">
                {Math.max(1, Math.round((subscription.remainingBalance || 0) / (subscription.dailyCost || 1)))} días
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo en Cuenta</p>
              <h2 className="text-3xl font-black text-emerald-500">${subscription.remainingBalance?.toFixed(0)}</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">Coste: -${subscription.dailyCost?.toFixed(0)} / día</p>
            </div>
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

      {/* Premium Pro Interactive Showcase (Upsell) */}
      {subscription.plan !== 'PRO' ? (
        <ProShowcase upgradePlan={upgradePlan} />
      ) : (
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-8 rounded-[40px] flex items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Crown size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400">¡Felicidades! Eres Usuario PRO</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
              Tienes habilitado el Modo Empleado Configurable, la Pantalla Display de Cliente interactiva en tiempo real y la Gestión Avanzada de Clientes con Crédito.
            </p>
          </div>
        </div>
      )}

      {/* Plans Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Actualiza tu Plan KIOSNET</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Standard Plan */}
          <PlanCard 
            title="Plan Estándar"
            price="12321"
            color="blue"
            active={subscription.plan === 'STANDARD'}
            onSelect={() => upgradePlan('STANDARD', 12321)}
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
            price="15890"
            color="indigo"
            featured
            active={subscription.plan === 'PRO'}
            onSelect={() => upgradePlan('PRO', 15890)}
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
          onClick={() => setIsPaymentModalOpen(true)}
          className="relative z-10 bg-white text-blue-600 px-10 py-6 rounded-[28px] font-black text-2xl flex items-center gap-4 hover:bg-slate-50 transition-all shadow-2xl active:scale-95 group"
        >
          <CreditCard size={32} /> PAGAR LICENCIA
        </button>
        {/* Abstract background circles */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl"></div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-[#009EE3] p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2">
                <QrCode size={24} /> Pagar con Mercado Pago
              </h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 text-center space-y-8">
              <div className="space-y-2">
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Escanea este código con tu app de Mercado Pago para abonar tu licencia.</p>
              </div>
              
              <div className="bg-white p-4 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-sm inline-block mx-auto">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://link.mercadopago.com.ar/tu_link_de_pago`} 
                  alt="QR Mercado Pago" 
                  className="w-48 h-48 rounded-xl"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                <div className="relative flex justify-center"><span className="bg-white dark:bg-slate-900 px-4 text-xs font-black text-slate-400 uppercase tracking-widest">O también puedes</span></div>
              </div>

              <button 
                onClick={() => window.open('https://link.mercadopago.com.ar/tu_link_de_pago', '_blank')}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              >
                Pagar vía Link Directo
              </button>
            </div>
          </div>
        </div>
      )}
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
        <span className="text-4xl font-black text-slate-900 dark:text-white">${price}</span>
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



const ProShowcase = ({ upgradePlan }: any) => {
  const [activeTab, setActiveTab] = React.useState<'display' | 'employees'>('display');
  // State for display mock
  const [mockCart, setMockCart] = React.useState<any[]>([
    { name: 'Coca Cola 1.5L', price: 1200, qty: 1 }
  ]);
  const [mockEmployeeRole, setMockEmployeeRole] = React.useState<'ADMIN' | 'EMPLOYEE'>('ADMIN');

  const addMockItem = () => {
    if (mockCart.length < 3) {
      setMockCart([...mockCart, { name: 'Pringles Original', price: 2300, qty: 1 }]);
    } else {
      setMockCart([{ name: 'Coca Cola 1.5L', price: 1200, qty: 1 }]);
    }
  };

  const mockTotal = mockCart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="bg-slate-900 text-white rounded-[40px] p-8 border border-slate-800 shadow-2xl relative overflow-hidden space-y-6 animate-in zoom-in-95 duration-500">
      {/* Decorative gradients */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="bg-indigo-500/20 text-indigo-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-500/30">
            Mini Demo Interactiva
          </span>
          <h2 className="text-3xl font-black tracking-tight mt-3 text-white">Prueba las Funciones Pro en Vivo</h2>
          <p className="text-slate-400 font-bold text-sm mt-1">Experimenta en tiempo real las herramientas exclusivas que impulsarán tu comercio.</p>
        </div>
        <button 
          onClick={() => upgradePlan('PRO', 15890)}
          className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-8 py-4 rounded-2xl font-black text-sm hover:from-indigo-600 hover:to-blue-600 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap self-start md:self-center"
        >
          🚀 ¡UPGRADE A PRO AHORA!
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-800 pb-3">
        <button 
          onClick={() => setActiveTab('display')}
          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'display' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          🖥️ Pantalla Display Cliente
        </button>
        <button 
          onClick={() => setActiveTab('employees')}
          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'employees' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          👥 Modo Empleado Inteligente
        </button>
      </div>

      {activeTab === 'display' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Mock POS interface */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-black uppercase text-slate-500 tracking-wider">Tu Computadora (POS Cajero)</p>
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
              </div>
              <div className="space-y-2">
                {mockCart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm font-bold border-b border-slate-900 pb-2">
                    <span className="text-slate-400">{item.qty}x {item.name}</span>
                    <span className="text-white">${item.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <button 
                onClick={addMockItem} 
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-black py-3 px-4 rounded-xl text-blue-400 transition-colors"
              >
                {mockCart.length < 3 ? '+ Escanear Producto' : '🔄 Reiniciar Carrito'}
              </button>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black text-slate-500">Total Cajero</p>
                <p className="text-2xl font-black text-blue-500">${mockTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Mock Customer Display */}
          <div className="bg-blue-600 text-white p-6 rounded-3xl border border-blue-500 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">Pantalla para tu Cliente (Segunda Pantalla)</p>
              <div className="mt-4 space-y-2">
                {mockCart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-bold border-b border-blue-500/30 pb-1">
                    <span>{item.qty}x {item.name}</span>
                    <span>${item.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-end mt-4 pt-2">
              <div>
                <p className="text-[9px] uppercase font-bold text-blue-200">Total a pagar</p>
                <p className="text-3xl font-black leading-none">${mockTotal.toLocaleString()}</p>
              </div>
              <div className="bg-white p-2 rounded-lg text-slate-900 flex flex-col items-center shadow-md">
                <QrCode size={40} className="text-slate-900" />
                <span className="text-[6px] font-black mt-1 uppercase text-[#009EE3]">Pagar con MP</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Role selector */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <p className="text-xs font-black uppercase text-slate-500 tracking-wider mb-4">Simula el Rol de Usuario</p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setMockEmployeeRole('ADMIN')}
                  className={`py-3 rounded-xl font-black text-xs border transition-all ${mockEmployeeRole === 'ADMIN' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  👑 Administrador / Dueño
                </button>
                <button 
                  onClick={() => setMockEmployeeRole('EMPLOYEE')}
                  className={`py-3 rounded-xl font-black text-xs border transition-all ${mockEmployeeRole === 'EMPLOYEE' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  💼 Empleado / Cajero
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-4 leading-relaxed font-bold">
                {mockEmployeeRole === 'ADMIN' 
                  ? 'Como Administrador tienes acceso completo para ver las ganancias netas de tu comercio, editar los precios de los productos y ver estadísticas históricas avanzadas.'
                  : 'Como Empleado tu única prioridad es atender al cliente. El sistema automáticamente restringe las ganancias y la edición de inventario para máxima seguridad.'}
              </p>
            </div>
          </div>

          {/* Interactive Interface Simulation */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between relative overflow-hidden transition-all duration-300">
            {mockEmployeeRole === 'EMPLOYEE' && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-4">
                <Lock size={32} className="text-red-500 mb-2 animate-bounce" />
                <p className="font-black text-sm uppercase tracking-wider text-red-500">Acceso Restringido</p>
                <p className="text-xs text-slate-400 max-w-[200px] mt-2 font-bold">Las estadísticas de ganancia y edición de precios están ocultas para empleados.</p>
              </div>
            )}
            
            <div className="space-y-4">
              <p className="text-xs font-black uppercase text-slate-500 tracking-wider">Preview de Reportes de Caja</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-950 rounded-xl">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase">Ventas Totales</p>
                    <p className="text-lg font-black text-white">$158,900</p>
                  </div>
                  <span className="text-emerald-500 text-xs font-bold">+15% vs ayer</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-indigo-500/20">
                  <div>
                    <p className="text-[10px] text-indigo-400 font-black uppercase">Ganancia Neta Estimada</p>
                    <p className="text-lg font-black text-indigo-400">$63,560</p>
                  </div>
                  <span className="text-indigo-400 text-xs font-bold">Margen: 40%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
