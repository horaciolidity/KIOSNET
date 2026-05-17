import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Check, CreditCard, LogOut, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import api from '../../utils/api';

const SubscriptionPay: React.FC = () => {
  const { user, token, setAuth, logout, setSubscriptionActive } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [error, setError] = useState('');

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
            // Refresh complete Zustand store with fresh details
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
      const response = await api.post('/payments/mercadopago/subscription');
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

  const features = [
    'Catálogo de productos ilimitado en la nube',
    'Sincronización multiusuario en tiempo real',
    'Cobros seguros con Mercado Pago QR Dinámico',
    'Caja diaria, arqueos y movimientos integrados',
    'Cuentas corrientes para fiado de clientes',
    'Reportes estadísticos e informes de ventas',
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans relative overflow-hidden">
      {/* Visual background accents */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[140px]"></div>
      </div>

      <div className="w-full max-w-4xl px-4 py-8 relative z-10">
        <div className="flex justify-between items-center mb-8">
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
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl relative">
          
          {/* Welcome & Benefits Column */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                ¡Bienvenido a la nube, {user?.name}!
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight mb-4">
                Activa tu cuenta de <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">KIOSNET Pro</span>
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                Estás a un paso de activar tu Kiosco/Comercio. KIOSNET es un software SaaS multitenant profesional en donde cada tienda cuenta con su base de datos aislada, stock único e historial privado.
              </p>
            </div>

            <div className="space-y-3.5">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-slate-300 text-sm">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & Checkout Column */}
          <div className="flex flex-col justify-center items-center bg-slate-900/60 border border-white/5 rounded-3xl p-8 relative">
            {!paymentOpened ? (
              <div className="text-center w-full space-y-6">
                <div>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest block mb-2">PLAN MENSUAL PRO</span>
                  <div className="flex justify-center items-baseline gap-1">
                    <span className="text-5xl font-black">$5.000</span>
                    <span className="text-slate-400 text-sm font-semibold">/ mes ARS</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-3">Cancela en cualquier momento desde tu panel.</p>
                </div>

                <div className="border-t border-white/5 my-6"></div>

                <button
                  onClick={handlePaySubscription}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-70 group cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      Activar con Mercado Pago
                    </>
                  )}
                </button>
                
                <p className="text-xs text-slate-500">
                  Serás redirigido a la pasarela de pagos oficial de Mercado Pago para realizar la activación de forma 100% segura.
                </p>
              </div>
            ) : (
              <div className="text-center w-full space-y-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mb-2 relative">
                  <div className="absolute inset-0 rounded-full border border-blue-500/40 animate-ping opacity-75"></div>
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>

                <div>
                  <h3 className="text-lg font-bold">Esperando confirmación...</h3>
                  <p className="text-slate-400 text-xs leading-relaxed mt-2 px-4">
                    Completando pago en la pestaña de Mercado Pago... Una vez acreditado, KIOSNET se desbloqueará de forma automática en tu pantalla.
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
                    className="w-full bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-medium py-2 rounded-xl transition-all text-xs"
                  >
                    Volver a ver métodos de pago
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-slate-600 text-xs mt-8">
          © 2026 KIOSNET. Todos los derechos reservados. Sistema SaaS multi-usuario de administración en la nube.
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPay;
