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
  Unlock,
  Crown,
  HelpCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useTourStore } from '../../store/useTourStore';
import { useCashStore } from '../../store/useCashStore';
import { TourOverlay } from '../tour/TourOverlay';
import { supabase } from '../../utils/supabaseClient';
import axios from 'axios';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token, setAuth, fetchUserSession } = useAuthStore();
  const { businessInfo } = useSettingsStore();
  const { active: tourActive, startTourForRoute } = useTourStore();

  // Auto-start tour for the current route if never completed
  useEffect(() => {
    if (user) {
      const currentRoute = location.pathname;
      const supportedRoutes = ['/dashboard', '/billing', '/pos', '/inventory', '/cash', '/history', '/reports', '/settings', '/display'];
      if (!supportedRoutes.includes(currentRoute)) return;

      let storageKey = `kiosnet_tour_completed_${currentRoute}_${user.id}`;
      if (currentRoute === '/cash') {
        const isRegisterOpen = useCashStore.getState().session.isOpen;
        storageKey = `kiosnet_tour_completed_/cash_${isRegisterOpen ? 'open' : 'closed'}_${user.id}`;
      }
      const tourCompleted = localStorage.getItem(storageKey) === 'true';

      if (!tourCompleted && !tourActive) {
        const timer = setTimeout(() => {
          startTourForRoute(currentRoute);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, location.pathname, startTourForRoute, tourActive]);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Close sidebar on mobile screens by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Sync / Fetch user profile from Supabase on load to reflect subscription changes in real-time
  useEffect(() => {
    if (user) {
      fetchUserSession();
    }
  }, [location.pathname]);

  // Activate subscription when Mercado Pago redirects back to app with ?sub=success
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const subStatus = params.get('sub');

    if (subStatus === 'success' && user) {
      const plan = (params.get('plan') || localStorage.getItem('kiosnet_pending_plan') || 'STANDARD') as 'STANDARD' | 'PRO';
      const months = parseInt(params.get('months') || localStorage.getItem('kiosnet_pending_months') || '1', 10) || 1;
      const paymentId = params.get('payment_id');

      const activateSub = async () => {
        const maxRetries = 5;
        let attempt = 0;

        const tryActivate = async (): Promise<boolean> => {
          attempt++;
          const tenantId = user.tenantId;
          const mpToken = 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';
          let approvedPaymentFound = false;
          let approvedPlan = plan;
          let approvedMonths = months;
          let isUpgradePayment = false;

          // Fetch tenant first to read current date and plan details
          const { data: tenant, error: fetchErr } = await supabase
            .from('Tenant')
            .select('*')
            .eq('id', tenantId)
            .single();

          if (fetchErr) throw fetchErr;

          try {
            // Strategy 1: Direct payment lookup if we have paymentId
            if (paymentId) {
              const targetUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
              const pResponse = await axios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, {
                headers: { Authorization: `Bearer ${mpToken}` }
              });
              const paymentInfo = pResponse.data;
              if (paymentInfo.status === 'approved' && paymentInfo.external_reference?.startsWith('sub_')) {
                approvedPaymentFound = true;
                const parts = paymentInfo.external_reference.split('_');
                approvedPlan = (parts[1] || plan) as 'STANDARD' | 'PRO';
                if (parts[3] === 'upgrade') {
                  isUpgradePayment = true;
                  approvedMonths = 0;
                } else {
                  approvedMonths = parseInt(parts[3], 10) || months;
                }
              }
            }

            // Strategy 2: Search by external_reference
            if (!approvedPaymentFound) {
              const remainingDays = tenant?.subExpiresAt ? Math.max(1, Math.ceil((new Date(tenant.subExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
              const isUpgradeMode = months === 0 || (tenant?.subActive && tenant?.plan === 'STANDARD' && plan === 'PRO');
              const ref = isUpgradeMode 
                ? `sub_PRO_${tenantId}_upgrade_${remainingDays}` 
                : `sub_${plan}_${tenantId}_${months}`;
                
              const targetUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${ref}`;
              const searchResponse = await axios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, {
                headers: { Authorization: `Bearer ${mpToken}` }
              });
              const approvedPayment = searchResponse.data.results?.find((p: any) => p.status === 'approved');
              if (approvedPayment) {
                approvedPaymentFound = true;
                const refUsed = approvedPayment.external_reference || ref;
                const parts = refUsed.split('_');
                approvedPlan = (parts[1] || plan) as 'STANDARD' | 'PRO';
                if (parts[3] === 'upgrade') {
                  isUpgradePayment = true;
                  approvedMonths = 0;
                } else {
                  approvedMonths = parseInt(parts[3], 10) || 1;
                }
              }
            }

            if (approvedPaymentFound) {
              let baseDate = new Date();
              if (tenant?.subActive && tenant.subExpiresAt && new Date(tenant.subExpiresAt) > new Date()) {
                baseDate = new Date(tenant.subExpiresAt);
              }

              const updatePayload: any = {
                subActive: true,
                plan: approvedPlan
              };

              if (!isUpgradePayment) {
                baseDate.setMonth(baseDate.getMonth() + approvedMonths);
                updatePayload.subExpiresAt = baseDate.toISOString();
              } else {
                updatePayload.subExpiresAt = tenant?.subExpiresAt || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
              }

              const { data: updatedTenant, error: updateErr } = await supabase
                .from('Tenant')
                .update(updatePayload)
                .eq('id', tenantId)
                .select()
                .single();

              if (updateErr) throw updateErr;

              const { count: salesCount } = await supabase
                .from('Sale')
                .select('*', { count: 'exact', head: true })
                .eq('tenantId', tenantId);

              localStorage.removeItem('kiosnet_pending_plan');
              localStorage.removeItem('kiosnet_pending_months');

              setAuth({
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: tenantId,
                plan: updatedTenant.plan,
                subActive: true,
                subExpiresAt: updatedTenant.subExpiresAt,
                salesCount: salesCount || 0
              }, token || '');

              navigate(location.pathname, { replace: true });
              return true;
            }
          } catch (err) {
            console.error(`Activation attempt ${attempt} failed:`, err);
          }
          return false;
        };

        // Try activate with retries
        for (let i = 0; i < maxRetries; i++) {
          const success = await tryActivate();
          if (success) return;
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        // Fallback: Direct activation if MP redirects but API search is delayed
        try {
          console.warn('Fallback direct activation activated');
          const tenantId = user.tenantId;
          const { data: tenant, error: fetchErr } = await supabase
            .from('Tenant')
            .select('*')
            .eq('id', tenantId)
            .single();

          if (!fetchErr && tenant) {
            let baseDate = new Date();
            if (tenant.subActive && tenant.subExpiresAt && new Date(tenant.subExpiresAt) > new Date()) {
              baseDate = new Date(tenant.subExpiresAt);
            }
            baseDate.setMonth(baseDate.getMonth() + months);

            const { data: updatedTenant, error: updateErr } = await supabase
              .from('Tenant')
              .update({
                subActive: true,
                plan: plan,
                subExpiresAt: baseDate.toISOString()
              })
              .eq('id', tenantId)
              .select()
              .single();

            if (!updateErr && updatedTenant) {
              const { count: salesCount } = await supabase
                .from('Sale')
                .select('*', { count: 'exact', head: true })
                .eq('tenantId', tenantId);

              localStorage.removeItem('kiosnet_pending_plan');
              localStorage.removeItem('kiosnet_pending_months');

              setAuth({
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: tenantId,
                plan: updatedTenant.plan,
                subActive: true,
                subExpiresAt: updatedTenant.subExpiresAt,
                salesCount: salesCount || 0
              }, token || '');

              navigate(location.pathname, { replace: true });
            }
          }
        } catch (fallbackErr) {
          console.error('Fallback activation failed:', fallbackErr);
        }
      };

      activateSub();
    }
  }, [location.search, navigate, location.pathname, token, setAuth, user]);

  const isEmployee = user?.role === 'EMPLOYEE';

  const handleRoleToggle = () => {
    if (isEmployee) {
      setIsPinModalOpen(true);
      setEnteredPin('');
      setPinError('');
    } else {
      const isPro = user?.subActive && user?.plan === 'PRO';
      if (!isPro) {
        setIsUpgradeModalOpen(true);
      } else {
        setIsConfirmModalOpen(true);
      }
    }
  };

  const isSuperAdmin = user?.email === 'horaciowalterortiz@gmail.com';

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
    ] : []),
    ...(isSuperAdmin ? [
      { icon: <Lock size={20} className="text-amber-500" />, label: 'Panel Super Admin', path: '/super-admin' }
    ] : [])
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex overflow-hidden relative">
      {/* Mobile Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm md:hidden z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20'
        } fixed md:static inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden p-0.5 shadow-sm">
            <img src="/kiosnet_logo.png" alt="KIOSNET Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col truncate">
              <span className="font-black text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400">KIOSNET</span>
              <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-white truncate mt-0.5">
                {businessInfo?.name || 'Comercio'}
              </span>
            </div>
          )}
        </div>

        <nav id="tour-sidebar-menu" className="flex-1 overflow-y-auto px-4 space-y-2 mt-4 scrollbar-hide">
          {menuItems.map((item) => {
            if (item.external) {
              const handleExternalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                if (item.path === '/display') {
                  e.preventDefault();
                  window.open('/display', 'CustomerDisplay', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
                }
              };
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={handleExternalClick}
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

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          {/* Real-time Subscription Indicator */}
          {isSidebarOpen && user && (
            <div className="mb-2 bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 p-2.5 rounded-xl flex flex-col space-y-1 text-xs animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <span className="font-black text-[9px] uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  Plan: {user.subActive ? (user.plan === 'PRO' ? 'PRO' : 'ESTÁNDAR') : 'GRATUITO'}
                </span>
                {user.subActive ? (
                  <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md uppercase">Activo</span>
                ) : (
                  <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md uppercase">Prueba</span>
                )}
              </div>
              
              {!user.subActive ? (
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
                  {Math.max(0, 50 - (user.salesCount ?? 0))} ventas de prueba restantes
                </p>
              ) : (
                <div className="space-y-0.5">
                  {user.subExpiresAt && (
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Vence: {(() => {
                        const d = new Date(user.subExpiresAt);
                        return isNaN(d.getTime()) ? 'Mensual' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      })()}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-1">
                {!user.subActive && !isEmployee && (
                  <button 
                    onClick={() => navigate('/billing')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black py-1.5 rounded-lg transition-all text-center uppercase"
                  >
                    Activar
                  </button>
                )}
                <a
                  href="https://wa.me/5492617048835?text=Hola!%20Tengo%20un%20inconveniente%20o%20duda%20con%20el%20sistema%20KIOSNET"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black py-1.5 rounded-lg border border-emerald-500/20 transition-all uppercase tracking-wider"
                >
                  Soporte
                </a>
              </div>
            </div>
          )}

          <button 
            onClick={handleRoleToggle}
            className={`w-full flex items-center gap-4 px-4 py-2 rounded-xl transition-all text-left ${
              isEmployee 
                ? 'bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20' 
                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className={isEmployee ? 'text-orange-500' : 'text-emerald-500'}>
              {isEmployee ? <Lock size={18} /> : <Unlock size={18} />}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 leading-none">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rol Activo</p>
                <p className={`text-xs font-black mt-0.5 ${isEmployee ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {isEmployee ? 'Empleado' : 'Administrador'}
                </p>
              </div>
            )}
          </button>

          <button 
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-4 px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            {isSidebarOpen && <span className="text-sm font-medium">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <LogOut size={18} />
            {isSidebarOpen && <span className="text-sm font-medium">Cerrar Sesión</span>}
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
          {user && !user.subActive && (user.salesCount ?? 0) >= 50 && (
            <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg border-b border-red-500/20 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
                  <Lock size={20} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-sm tracking-tight uppercase">¡Período gratuito completado!</h4>
                  <p className="text-xs text-red-100 font-medium mt-0.5">
                    Has alcanzado las 50 ventas de prueba. Las ventas están bloqueadas temporalmente hasta que actives tu suscripción. Puedes seguir agregando productos a tu inventario.
                  </p>
                </div>
              </div>
              {!isEmployee && (
                <Link
                  to="/billing"
                  className="bg-white text-red-700 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-all shadow-md shrink-0"
                >
                  Activar Suscripción
                </Link>
              )}
            </div>
          )}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-8 border border-slate-100 dark:border-slate-800 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Cambiar a Administrador</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ingrese el PIN de Seguridad (PIN por defecto: <strong className="text-blue-600 dark:text-blue-400">1234</strong>) para desbloquear.</p>
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

      {/* Suggest Upgrade to PRO Modal */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 opacity-40 mix-blend-overlay"></div>
              <div className="w-16 h-16 bg-white/10 border border-white/20 text-white rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
                <Crown size={32} className="animate-pulse" />
              </div>
              <h3 className="text-2xl font-black relative z-10">¡Requiere KIOSNET PRO! 🚀</h3>
              <p className="text-indigo-100 text-xs font-bold mt-1 relative z-10">Eleva la seguridad y el control de tu comercio</p>
            </div>
            
            <div className="p-8 space-y-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-bold">
                El **Modo Empleado** es una característica exclusiva de la edición **PRO**. Permite ocultar tus ganancias netas, restringir la edición de inventario y proteger la caja diaria para tus cajeros de forma automática.
              </p>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 text-left space-y-2">
                <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Beneficios del Plan PRO</p>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 font-medium">
                  <li className="flex items-center gap-2">🟢 Ventas mensuales 100% ILIMITADAS</li>
                  <li className="flex items-center gap-2">🟢 Modo Empleado Configurable por PIN</li>
                  <li className="flex items-center gap-2">🟢 Pantalla Display interactiva para Clientes</li>
                  <li className="flex items-center gap-2">🟢 Cobro automático QR Mercado Pago</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-4 rounded-2xl font-black text-sm transition-all"
                >
                  Tal vez luego
                </button>
                <button 
                  onClick={() => {
                    setIsUpgradeModalOpen(false);
                    navigate('/billing?plan=PRO');
                  }}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                  Actualizar a PRO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Tour Guide Trigger Button */}
      {!tourActive && (
        <button 
          onClick={() => startTourForRoute(location.pathname)}
          className="fixed bottom-6 right-6 z-[90] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center group cursor-pointer"
          title="Iniciar tutorial interactivo"
        >
          <HelpCircle size={24} className="animate-pulse" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-[150px] group-hover:ml-2 font-black text-xs uppercase tracking-wider transition-all duration-300 whitespace-nowrap">
            Asistente
          </span>
        </button>
      )}
      
      {/* Interactive Tour Overlay */}
      <TourOverlay />
    </div>
  );
};

export default Layout;
