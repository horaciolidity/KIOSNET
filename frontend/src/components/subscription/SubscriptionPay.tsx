import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Check, CreditCard, LogOut, Loader2, Sparkles, RefreshCw, Zap } from 'lucide-react';
import api from '../../utils/api';

const SubscriptionPay: React.FC = () => {
  const { user, token, setAuth, logout, setSubscriptionActive } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'STANDARD' | 'PRO'>('STANDARD');

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
      const response = await api.post('/payments/mercadopago/subscription', { plan: selectedPlan });
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
          
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
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
                  <span className="text-4xl font-black">$12.320</span>
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
                  <span className="text-4xl font-black text-indigo-200">$15.730</span>
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
          <div className="mt-8 max-w-xl mx-auto text-center space-y-4">
            <button
              onClick={handlePaySubscription}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-70 group cursor-pointer text-base uppercase tracking-wider"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Activar Plan {selectedPlan === 'PRO' ? 'Pro' : 'Estándar'} con Mercado Pago
                </>
              )}
            </button>
            <p className="text-xs text-slate-500">
              Serás redirigido de forma segura a Mercado Pago para realizar la activación mensual del POS en tu cuenta.
            </p>
          </div>
        ) : (
          <div className="mt-8 max-w-md mx-auto bg-slate-900/90 border border-white/10 rounded-3xl p-8 text-center space-y-6 flex flex-col items-center shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mb-2 relative">
              <div className="absolute inset-0 rounded-full border border-blue-500/40 animate-ping opacity-75"></div>
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>

            <div>
              <h3 className="text-lg font-bold">Esperando confirmación...</h3>
              <p className="text-slate-400 text-xs leading-relaxed mt-2 px-4">
                Completando pago del **Plan {selectedPlan === 'PRO' ? 'Pro' : 'Estándar'}** en Mercado Pago... Una vez acreditado, KIOSNET se desbloqueará de forma automática en tu pantalla.
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
                onClick={() => setPaymentOpened(false)}
                className="w-full bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-medium py-2 rounded-xl transition-all text-xs cursor-pointer"
              >
                Cambiar de plan / reintentar
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
