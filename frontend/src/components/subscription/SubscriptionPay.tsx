import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Check, CreditCard, LogOut, Loader2, Sparkles, RefreshCw, Zap, ArrowLeft, QrCode } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';

const SubscriptionPay: React.FC = () => {
  const { user, token, setAuth, logout, setSubscriptionActive } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'STANDARD' | 'PRO'>('STANDARD');
  const [selectedMonths, setSelectedMonths] = useState<number>(1);
  const [prices, setPrices] = useState({ price_standard: 12320, price_pro: 15730 });

  // Parse search params to pre-select plan & fetch prices
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const planParam = params.get('plan');
    if (planParam === 'STANDARD' || planParam === 'PRO') {
      setSelectedPlan(planParam);
    }

    const fetchPrices = async () => {
      try {
        const response = await api.get('/payments/prices');
        setPrices(response.data);
      } catch (err) {
        console.error('Error fetching dynamic plan prices:', err);
      }
    };
    fetchPrices();
  }, [location.search]);

  // 1. Poll the `/api/auth/me` endpoint to auto-unlock when payment is approved
  useEffect(() => {
    let intervalId: any;

    if (paymentOpened && user && !user.subActive) {
      intervalId = setInterval(async () => {
        try {
          const response = await api.get('/auth/me');
          const freshUser = response.data.user;
          
          if (freshUser.subActive) {
            setSubscriptionActive(true);
            setAuth(freshUser, token || '');
            clearInterval(intervalId);
          }
        } catch (err) {
          console.error('Error polling user subscription status:', err);
        }
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [paymentOpened, user, token, setAuth, setSubscriptionActive]);

  const handlePaySubscription = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/payments/mercadopago/subscription', { 
        plan: selectedPlan, 
        months: selectedMonths 
      });
      const { initPoint } = response.data;
      
      // Open the Mercado Pago Checkout link in a new tab
      window.open(initPoint, '_blank');
      setPaymentOpened(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al conectar con Mercado Pago. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayQR = async () => {
    setQrLoading(true);
    setError('');
    try {
      const response = await api.post('/payments/mercadopago/subscription-qr', { 
        plan: selectedPlan, 
        months: selectedMonths 
      });
      
      if (response.data.success && response.data.qrImage) {
        setQrImageUrl(response.data.qrImage);
        setPaymentOpened(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al generar QR. Inténtalo de nuevo.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleCheckPaymentManually = async () => {
    setChecking(true);
    setError('');
    try {
      const response = await api.get('/auth/me');
      const freshUser = response.data.user;
      
      if (freshUser.subActive) {
        setSubscriptionActive(true);
        setAuth(freshUser, token || '');
      } else {
        setError('El pago aún no ha sido reportado por Mercado Pago. Si acabas de abonar, aguarda 10 segundos y vuelve a presionar verificar.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
    } finally {
      setChecking(false);
    }
  };

  const salesCount = user?.salesCount ?? 0;
  const salesPercentage = Math.min((salesCount / 50) * 100, 100);

  const standardFeatures = [
    'Catálogo de productos ilimitado',
    'Arqueos de caja diaria e historial',
    'Cuentas corrientes para clientes',
    'Reportes básicos de venta',
    'Límite de hasta 1000 ventas / mes'
  ];

  const proFeatures = [
    'Todo lo del Plan Estándar',
    'Ventas mensuales 100% ILIMITADAS',
    'Sincronización multiusuario activa',
    'Cobro automático QR Mercado Pago',
    'Reportes y estadísticas avanzadas',
    'Soporte prioritario 24/7'
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans relative overflow-hidden">
      {/* Visual background accents */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[140px]"></div>
      </div>

      <div className="w-full max-w-5xl px-4 py-8 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center p-1">
              <img src="/kiosnet_logo.png" alt="KIOSNET Logo" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div>
              <span className="text-xl font-black tracking-wider bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">KIOSNET</span>
              <p className="text-xs text-slate-500 font-medium">SaaS Multiusuario</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {(user?.subActive || (user?.salesCount ?? 0) < 50) && (
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </button>
            )}
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl text-sm font-medium transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Free trial progress card */}
        <div className="mb-8 p-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-400 text-xs font-bold uppercase tracking-wider">Período de Prueba</span>
              <span className="text-slate-400 text-sm font-medium">¡50 ventas de regalo!</span>
            </div>
            <h3 className="text-lg font-bold text-white">Has completado el límite de ventas de prueba gratuitas</h3>
            <p className="text-xs text-slate-400">
              Registraste {salesCount} de 50 ventas en tu comercio. Para continuar administrando tu negocio en la nube, activa tu suscripción mensual.
            </p>
          </div>
          
          <div className="flex-1 max-w-md w-full space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-400">
              <span>PROGRESO DE LA PRUEBA</span>
              <span className={salesCount >= 50 ? 'text-red-400' : 'text-blue-400'}>{salesCount} / 50 Ventas</span>
            </div>
            <div className="w-full h-3.5 bg-slate-950 rounded-full border border-white/5 overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  salesCount >= 50 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}
                style={{ width: `${salesPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!paymentOpened ? (
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Standard Plan Card */}
            <div 
              onClick={() => setSelectedPlan('STANDARD')}
              className={`p-8 rounded-[32px] border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                selectedPlan === 'STANDARD' 
                  ? 'bg-slate-900/90 border-blue-500/50 shadow-2xl shadow-blue-500/5 ring-1 ring-blue-500/30' 
                  : 'bg-white/5 border-white/10 hover:border-white/20 shadow-lg'
              }`}
            >
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">Uso Estándar</h3>
                    <p className="text-slate-400 text-xs mt-1">El POS perfecto para pequeños comercios.</p>
                  </div>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    selectedPlan === 'STANDARD' 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : 'border-white/20 bg-transparent'
                  }`}>
                    {selectedPlan === 'STANDARD' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">${prices.price_standard.toLocaleString()}</span>
                  <span className="text-slate-400 text-sm font-semibold">/ mes ARS</span>
                </div>

                <div className="border-t border-white/5 my-4"></div>

                <div className="space-y-3.5">
                  {standardFeatures.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pro Plan Card */}
            <div 
              onClick={() => setSelectedPlan('PRO')}
              className={`p-8 rounded-[32px] border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                selectedPlan === 'PRO' 
                  ? 'bg-slate-900/90 border-indigo-500/50 shadow-2xl shadow-indigo-500/5 ring-1 ring-indigo-500/30' 
                  : 'bg-white/5 border-white/10 hover:border-white/20 shadow-lg'
              }`}
            >
              {/* Popular tag badge */}
              <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-500 to-purple-600 text-white text-[10px] font-black tracking-widest px-4 py-1.5 rounded-bl-2xl uppercase flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 animate-pulse" />
                RECOMENDADO
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      Edición Pro
                      <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">Potencia total e ilimitada para tu negocio.</p>
                  </div>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    selectedPlan === 'PRO' 
                      ? 'border-indigo-500 bg-indigo-500 text-white' 
                      : 'border-white/20 bg-transparent'
                  }`}>
                    {selectedPlan === 'PRO' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-indigo-200">${prices.price_pro.toLocaleString()}</span>
                  <span className="text-slate-400 text-sm font-semibold">/ mes ARS</span>
                </div>

                <div className="border-t border-white/5 my-4"></div>

                <div className="space-y-3.5">
                  {proFeatures.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        ) : null}

        {/* Action Button & Disclaimer */}
        {!paymentOpened ? (
          <div className="mt-8 max-w-xl mx-auto text-center space-y-6">
            
            {/* Months Selector */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <h4 className="text-white font-medium">Duración de la suscripción</h4>
                <p className="text-slate-400 text-sm">Paga más meses juntos y asegura tu acceso</p>
              </div>
              <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/10">
                {[1, 3, 6, 12].map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonths(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedMonths === m 
                        ? 'bg-indigo-500 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {m} {m === 1 ? 'Mes' : 'Meses'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/10 flex justify-between items-center text-left">
              <div>
                <p className="text-slate-400 text-sm">Total a pagar</p>
                <p className="text-white font-bold text-xl">
                  ${((selectedPlan === 'PRO' ? prices.price_pro : prices.price_standard) * selectedMonths).toLocaleString()} ARS
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Plan Seleccionado</p>
                <p className="text-indigo-400 font-bold uppercase">{selectedPlan} x{selectedMonths}</p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={handlePaySubscription}
                disabled={loading || qrLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-70 group cursor-pointer text-base uppercase tracking-wider"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Activar Plan {selectedPlan === 'PRO' ? 'Pro' : 'Estándar'}
                </>
              )}
            </button>
            <button
              onClick={handlePayQR}
              disabled={loading || qrLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-extrabold py-4 rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-3 disabled:opacity-70 group cursor-pointer text-base uppercase tracking-wider"
            >
              {qrLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <QrCode className="w-5 h-5 group-hover:scale-110 transition-transform text-blue-400" />
                  Pagar con QR en Pantalla
                </>
              )}
            </button>
            <p className="text-xs text-slate-500">
              Abona de forma segura mediante Mercado Pago. La activación de tu cuenta será automática e inmediata.
            </p>
          </div>
        ) : (
          <div className="mt-8 max-w-md mx-auto bg-slate-900/90 border border-white/10 rounded-3xl p-8 text-center space-y-6 flex flex-col items-center shadow-2xl backdrop-blur-xl">
            {qrImageUrl ? (
              <div className="flex flex-col items-center">
                <h3 className="text-xl font-bold mb-2">Escanea para pagar</h3>
                <p className="text-sm text-slate-400 mb-6">Abre la app de Mercado Pago y escanea este código QR</p>
                <div className="bg-white p-4 rounded-2xl shadow-xl shadow-blue-500/10 mb-6">
                  <img src={qrImageUrl} alt="Mercado Pago QR Code" className="w-48 h-48 object-contain" />
                </div>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mb-2 relative">
                <div className="absolute inset-0 rounded-full border border-blue-500/40 animate-ping opacity-75"></div>
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold">Esperando confirmación...</h3>
              <p className="text-slate-400 text-xs leading-relaxed mt-2 px-4">
                Una vez acreditado el pago del **Plan {selectedPlan === 'PRO' ? 'Pro' : 'Estándar'}**, KIOSNET se desbloqueará de forma automática.
              </p>
            </div>

            <div className="w-full space-y-3 pt-4">
              <button
                onClick={handleCheckPaymentManually}
                disabled={checking}
                className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold py-3.5 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2.5 text-sm cursor-pointer"
              >
                {checking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Comprobar Pago Ahora
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setPaymentOpened(false);
                  setQrImageUrl(null);
                }}
                className="w-full bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-medium py-2 rounded-xl transition-all text-xs cursor-pointer"
              >
                Cancelar o Cambiar método de pago
              </button>
            </div>
          </div>
        )}

        <div className="text-center text-slate-600 text-xs mt-12">
          © 2026 KIOSNET. Todos los derechos reservados. Sistema SaaS multi-usuario de administración de comercios y puntos de venta.
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPay;
