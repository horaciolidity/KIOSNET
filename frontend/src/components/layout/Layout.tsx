import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wallet, 
  BarChart3, 
  Settings, 
  LogOut, 
  Sun, 
  Moon, 
  Menu,
  Bell,
  User as UserIcon,
  History,
  QrCode,
  X,
  Lock,
  Unlock
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useThemeStore } from '../../store/useThemeStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token, setAuth } = useAuthStore();
  const { businessInfo, subscription } = useSettingsStore();

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const isEmployee = user?.role === 'EMPLOYEE';

  const handleRoleToggle = () => {
    if (isEmployee) {
      setIsPinModalOpen(true);
      setEnteredPin('');
      setPinError('');
    } else {
      setIsConfirmModalOpen(true);
    }
  };

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <ShoppingCart size={20} />, label: 'Ventas (POS)', path: '/pos' },
    { icon: <Package size={20} />, label: 'Inventario', path: '/inventory' },
    { icon: <Wallet size={20} />, label: 'Caja', path: '/cash' },
    { icon: <History size={20} />, label: 'Historial', path: '/history' },
    ...(!isEmployee ? [
      { icon: <BarChart3 size={20} />, label: 'Reportes', path: '/reports' },
      { icon: <UserIcon size={20} />, label: 'Clientes (Crédito)', path: '/customers' },
      { icon: <LayoutDashboard size={20} />, label: 'Pantalla Cliente', path: '/display', external: true },
      { icon: <Settings size={20} />, label: 'Ajustes', path: '/settings' }
    ] : [])
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden p-0.5 shadow-sm">
            <img src="/kiosnet_logo.png" alt="KIOSNET Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col truncate">
              <span className="font-black text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400">KIOSNET</span>
              <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-white truncate mt-0.5">
                {businessInfo.name}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-2 mt-4 scrollbar-hide">
          {menuItems.map((item) => {
            if (item.external) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all group text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="group-hover:text-blue-500">
                    {item.icon}
                  </div>
                  {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                </a>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${
                  location.pathname === item.path
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className={location.pathname === item.path ? 'text-blue-600 dark:text-blue-400' : 'group-hover:text-blue-500'}>
                  {item.icon}
                </div>
                {isSidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Mercado Pago Indicator */}
          {isSidebarOpen && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-4 rounded-2xl flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
                <Wallet size={20} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Plan: {subscription.plan}</p>
              {subscription.plan === 'FREE' ? (
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {subscription.salesLimit - subscription.salesUsed} ventas restantes
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-600">Licencia Activa</p>
                  <p className="text-[10px] font-bold text-slate-500">Saldo: ${subscription.remainingBalance?.toFixed(0)}</p>
                </div>
              )}
              {subscription.plan === 'FREE' && (
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full mt-2 bg-blue-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-blue-700 transition-all"
                >
                  Actualizar Ahora
                </button>
              )}
            </div>
          )}

          <button 
            onClick={handleRoleToggle}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left"
          >
            <div className={isEmployee ? 'text-orange-500' : 'text-emerald-500'}>
              {isEmployee ? <Lock size={20} /> : <Unlock size={20} />}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 leading-none">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rol Activo</p>
                <p className={`text-sm font-black mt-0.5 ${isEmployee ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {isEmployee ? 'Empleado' : 'Administrador'}
                </p>
              </div>
            )}
          </button>

          <button 
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            {isSidebarOpen && <span className="font-medium">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-40">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-6">
            <button className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{user?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                <UserIcon size={24} />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          {children}
        </div>
      </main>

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

      {/* PIN Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-8 border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Cambiar a Administrador</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ingrese el PIN de Seguridad configurado en Ajustes para desbloquear.</p>
            </div>
            <div className="space-y-4">
              <input 
                type="password" 
                maxLength={8}
                className="w-full text-center bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 font-black text-3xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="••••"
                autoFocus
              />
              {pinError && (
                <p className="text-xs text-red-500 font-bold text-center">{pinError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setIsPinModalOpen(false)}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-black text-sm transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    const currentPin = useSettingsStore.getState().security.adminPin;
                    if (enteredPin === currentPin) {
                      setAuth({ ...user!, role: 'ADMIN' }, token || 'mock-token');
                      setIsPinModalOpen(false);
                      navigate('/dashboard');
                    } else {
                      setPinError('PIN de administrador incorrecto');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-black text-sm transition-all"
                >
                  Desbloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Switch to Employee Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-8 border border-slate-100 dark:border-slate-800 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-4">¿Activar Modo Empleado?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se ocultarán todas las secciones administrativas y ganancias netas para la sesión activa.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-black text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setAuth({ ...user!, role: 'EMPLOYEE' }, token || 'mock-token');
                  setIsConfirmModalOpen(false);
                  navigate('/pos');
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl font-black text-sm transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
