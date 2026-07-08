import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Check, CreditCard, LogOut, Loader2, Sparkles, RefreshCw, Zap, ArrowLeft, QrCode } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import axios from 'axios';

const MP_DEFAULT_TOKEN = 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';

const SubscriptionPay: React.FC = () => {
  const { user, token, setAuth, logout, setSubscriptionActive } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'STANDARD' | 'PRO'>('STANDARD');
  const [selectedMonths, setSelectedMonths] = useState<number>(1);
  const [prices, setPrices] = useState({ price_standard: 12320, price_pro: 15730 });

  // Helper to verify and activate payment directly from client side
  const checkAndActivatePayment = async (plan: 'STANDARD' | 'PRO', months: number, paymentId?: string | null) => {
    const tenantId = user?.tenantId;
    if (!tenantId) return { success: false };

    let approvedPaymentFound = false;
    let approvedPlan = plan;
    let approvedMonths = months;

    // Strategy 1: Direct payment lookup if we have paymentId
    if (paymentId) {
      try {
        const pResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${MP_DEFAULT_TOKEN}` }
        });
        const paymentInfo = pResponse.data;
        if (paymentInfo.status === 'approved' && paymentInfo.external_reference?.startsWith('sub_')) {
          approvedPaymentFound = true;
          const parts = paymentInfo.external_reference.split('_');
          approvedPlan = parts[1] || plan;
          approvedMonths = parseInt(parts[3], 10) || months;
        }
      } catch (err) {
        console.error('Error looking up payment directly:', err);
      }
    }

    // Strategy 2: Search by external_reference
    if (!approvedPaymentFound) {
      const ref = `sub_${plan}_${tenantId}_${months}`;
      try {
        const searchResponse = await axios.get(`https://api.mercadopago.com/v1/payments/search?external_reference=${ref}`, {
          headers: { Authorization: `Bearer ${MP_DEFAULT_TOKEN}` }
        });
        const approvedPayment = searchResponse.data.results?.find((p: any) => p.status === 'approved');
        if (approvedPayment) {
          approvedPaymentFound = true;
          const parts = ref.split('_');
          approvedPlan = parts[1] as any;
          approvedMonths = parseInt(parts[3], 10) || 1;
        }
      } catch (err) {
        console.error('Error searching payments by external reference:', err);
      }
    }

    if (approvedPaymentFound) {
      // Get current Tenant details
      const { data: tenant, error: fetchErr } = await supabase
        .from('Tenant')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (fetchErr) throw fetchErr;

      let baseDate = new Date();
      if (tenant?.subActive && tenant.subExpiresAt && new Date(tenant.subExpiresAt) > new Date()) {
        baseDate = new Date(tenant.subExpiresAt);
      }
      baseDate.setMonth(baseDate.getMonth() + approvedMonths);

      // Update Tenant on Supabase directly!
      const { data: updatedTenant, error: updateErr } = await supabase
        .from('Tenant')
        .update({
          subActive: true,
          plan: approvedPlan,
          subExpiresAt: baseDate.toISOString()
        })
        .eq('id', tenantId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const { count: salesCount } = await supabase
        .from('Sale')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', tenantId);

      return {
        success: true,
        subActive: true,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
          role: user?.role,
          tenantId: tenantId,
          plan: updatedTenant.plan,
          subActive: true,
          subExpiresAt: updatedTenant.subExpiresAt,
          salesCount: salesCount || 0
        }
      };
    }

    return { success: false };
  };

  // Parse search params to pre-select plan & fetch prices
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const planParam = params.get('plan');
    if (planParam === 'STANDARD' || planParam === 'PRO') {
      setSelectedPlan(planParam);
    }

    // Restore selected plan/months if returning from a MP redirect that failed to auto-activate
    const savedPlan = localStorage.getItem('kiosnet_pending_plan');
    const savedMonths = localStorage.getItem('kiosnet_pending_months');
    if (savedPlan && (savedPlan === 'STANDARD' || savedPlan === 'PRO')) {
      setSelectedPlan(savedPlan as 'STANDARD' | 'PRO');
    }
    if (savedMonths) {
      setSelectedMonths(parseInt(savedMonths, 10) || 1);
    }

    const fetchPrices = async () => {
      try {
        const { data: configPrices, error } = await supabase
          .from('SystemConfig')
          .select('key, value');
        
        if (error) throw error;
        
        let priceStandard = 12320;
        let pricePro = 15730;

        configPrices?.forEach(cfg => {
          const val = Number(cfg.value);
          if (cfg.key === 'price_standard' && !isNaN(val)) priceStandard = val;
          if (cfg.key === 'price_pro' && !isNaN(val)) pricePro = val;
        });

        setPrices({
          price_standard: priceStandard,
          price_pro: pricePro
        });
      } catch (err) {
        console.error('Error fetching dynamic plan prices:', err);
      }
    };
    fetchPrices();
  }, [location.search]);


  // Poll every 10s when QR has been shown — check if MP confirmed the payment
  useEffect(() => {
    let intervalId: any;

    if (paymentOpened && qrImageUrl && user && !user.subActive) {
      intervalId = setInterval(async () => {
        try {
          const verifyResponse = await checkAndActivatePayment(selectedPlan, selectedMonths);

          if (verifyResponse.success && verifyResponse.subActive && verifyResponse.user) {
            localStorage.removeItem('kiosnet_pending_plan');
            localStorage.removeItem('kiosnet_pending_months');
            setSubscriptionActive(true);
            setAuth(verifyResponse.user as any, token || '');
            clearInterval(intervalId);
          }
        } catch (err) {
          console.error('Error polling QR subscription status:', err);
        }
      }, 10000); // Poll every 10 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [paymentOpened, qrImageUrl, user, token, selectedPlan, selectedMonths, setAuth, setSubscriptionActive]);


  // ── Notificar pago manualmente al superadmin ──────────────────────────────
  const handleNotifyPayment = async (senderAccount?: string) => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;
    setNotifying(true);
    try {
      const { error: notifyErr } = await supabase
        .from('Tenant')
        .update({
          paymentNotification: {
            notifiedAt: new Date().toISOString(),
            plan: selectedPlan,
            months: selectedMonths,
            amount: (selectedPlan === 'PRO' ? prices.price_pro : prices.price_standard) * selectedMonths,
            status: 'PENDING',
            senderAccount: senderAccount || 'No especificada'
          }
        })
        .eq('id', tenantId);

      if (notifyErr) throw notifyErr;

      setNotified(true);
      alert('¡Pago Notificado con Éxito! El administrador ha sido alertado y activará tu cuenta a la brevedad.');
    } catch (err: any) {
      console.error(err);
      alert('Error al notificar el pago: ' + (err.message || err));
    } finally {
      setNotifying(false);
    }
  };

  const handlePaySubscription = async () => {
    setLoading(true);
    setError('');
    try {
      const numMonths = selectedMonths;
      const price = selectedPlan === 'PRO' ? prices.price_pro : prices.price_standard;
      const finalPrice = price * numMonths;
      const title = selectedPlan === 'PRO' ? `Suscripción KIOSNET Pro (${numMonths} Mes${numMonths > 1 ? 'es' : ''})` : `Suscripción KIOSNET Estándar (${numMonths} Mes${numMonths > 1 ? 'es' : ''})`;
      const planId = selectedPlan === 'PRO' ? 'kiosnet_subscription_pro' : 'kiosnet_subscription_standard';
      const tenantId = user?.tenantId;

      const mpResponse = await axios.post(
        'https://api.mercadopago.com/checkout/preferences',
        {
          items: [
            {
              id: planId,
              title: title,
              quantity: 1,
              unit_price: finalPrice,
              currency_id: 'ARS'
            }
          ],
          back_urls: {
            success: `${window.location.origin}/dashboard?sub=success&plan=${selectedPlan}&months=${numMonths}`,
            failure: `${window.location.origin}/dashboard?sub=failure`,
            pending: `${window.location.origin}/dashboard?sub=pending`
          },
          auto_return: 'approved',
          external_reference: `sub_${selectedPlan}_${tenantId}_${numMonths}`
        },
        {
          headers: {
            Authorization: `Bearer ${MP_DEFAULT_TOKEN}`
          }
        }
      );

      const initPoint = mpResponse.data.init_point;
      
      // Save plan/months to localStorage BEFORE redirect so we can use them when MP returns
      localStorage.setItem('kiosnet_pending_plan', selectedPlan);
      localStorage.setItem('kiosnet_pending_months', String(selectedMonths));

      // Redirect current tab to MP (enables native app deep-link on mobile)
      window.location.href = initPoint;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al conectar con Mercado Pago. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };


  const handlePayQR = async () => {
    setQrLoading(true);
    setError('');
    try {
      const numMonths = selectedMonths;
      const price = selectedPlan === 'PRO' ? prices.price_pro : prices.price_standard;
      const finalPrice = price * numMonths;
      const title = selectedPlan === 'PRO' ? `Suscripción KIOSNET Pro (${numMonths} Mes${numMonths > 1 ? 'es' : ''})` : `Suscripción KIOSNET Estándar (${numMonths} Mes${numMonths > 1 ? 'es' : ''})`;
      const planId = selectedPlan === 'PRO' ? 'kiosnet_subscription_pro' : 'kiosnet_subscription_standard';
      const tenantId = user?.tenantId;

      const mpResponse = await axios.post(
        'https://api.mercadopago.com/checkout/preferences',
        {
          items: [
            {
              id: planId,
              title: title,
              quantity: 1,
              unit_price: finalPrice,
              currency_id: 'ARS'
            }
          ],
          back_urls: {
            success: `${window.location.origin}/dashboard?sub=success&plan=${selectedPlan}&months=${numMonths}`,
            failure: `${window.location.origin}/dashboard?sub=failure`,
            pending: `${window.location.origin}/dashboard?sub=pending`
          },
          auto_return: 'approved',
          external_reference: `sub_${selectedPlan}_${tenantId}_${numMonths}`
        },
        {
          headers: {
            Authorization: `Bearer ${MP_DEFAULT_TOKEN}`
          }
        }
      );

      const initPoint = mpResponse.data.init_point;
      const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(initPoint)}`;
      
      setQrImageUrl(qrImage);
      setQrCodeUrl(initPoint);
      setPaymentOpened(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al generar QR. Inténtalo de nuevo.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleCheckPaymentManually = async () => {
    setChecking(true);
    setError('');
    try {
      const verifyResponse = await checkAndActivatePayment(selectedPlan, selectedMonths);

      if (verifyResponse.success && verifyResponse.subActive && verifyResponse.user) {
        localStorage.removeItem('kiosnet_pending_plan');
        localStorage.removeItem('kiosnet_pending_months');
        setSubscriptionActive(true);
        setAuth(verifyResponse.user as any, token || '');
      } else {
        setError('El pago aún no fue reportado por Mercado Pago. Si pagaste con QR, esperá 30 segundos más y volvé a intentar. Si usaste el botón y completaste el pago, recargá la página e intentá de nuevo.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
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
              onClick={() => {
                if (user?.subActive && user?.plan === 'PRO') {
                  alert('Tienes un plan PRO activo. Solo puedes volver al plan Estándar una vez que tu suscripción actual haya vencido.');
                  return;
                }
                setSelectedPlan('STANDARD');
              }}
              className={`p-8 rounded-[32px] border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                user?.subActive && user?.plan === 'PRO' ? 'opacity-40 cursor-not-allowed' : ''
              } ${
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
                    {user?.subActive && user?.plan === 'PRO' && (
                      <p className="text-[10px] text-red-400 font-bold uppercase mt-1">Bloqueado (Pro Activo)</p>
                    )}
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
            
            {/* Months Selector / Upgrade Alert */}
            {(() => {
              const isUpgradeMode = user?.subActive && user?.plan === 'STANDARD' && selectedPlan === 'PRO';
              const remainingDays = user?.subExpiresAt ? Math.max(1, Math.ceil((new Date(user.subExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
              
              if (isUpgradeMode) {
                return (
                  <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5 text-left space-y-2">
                    <h4 className="text-white font-bold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      Modo Upgrade Pro Activo
                    </h4>
                    <p className="text-slate-300 text-sm">
                      Tienes una licencia Estándar activa con <strong>{remainingDays} días</strong> restantes. Se te cobrará únicamente la diferencia prorrateada diaria para pasar al plan Pro hasta el final de tu período actual.
                    </p>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
                      Tu fecha de vencimiento seguirá siendo la misma.
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <h4 className="text-white font-medium">Duración de la suscripción</h4>
                    <p className="text-slate-400 text-sm">Paga más meses juntos y asegura tu acceso</p>
                  </div>
                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/10 relative">
                    {[1, 3, 6, 12].map(m => (
                      <button
                        key={m}
                        onClick={() => setSelectedMonths(m)}
                        className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedMonths === m 
                            ? 'bg-indigo-500 text-white shadow-md' 
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {m === 12 ? (
                          <>
                            12 Meses
                            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-bounce whitespace-nowrap">
                              ¡Pagas 10!
                            </span>
                          </>
                        ) : `${m} ${m === 1 ? 'Mes' : 'Meses'}`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/10 flex justify-between items-center text-left">
              <div>
                <p className="text-slate-400 text-sm">Total a pagar</p>
                {(() => {
                  const isUpgradeMode = user?.subActive && user?.plan === 'STANDARD' && selectedPlan === 'PRO';
                  const remainingDays = user?.subExpiresAt ? Math.max(1, Math.ceil((new Date(user.subExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
                  
                  if (isUpgradeMode) {
                    return (
                      <p className="text-white font-bold text-xl">
                        ${Math.max(150, Math.round(remainingDays * ((prices.price_pro - prices.price_standard) / 30))).toLocaleString()} ARS
                      </p>
                    );
                  }

                  return (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-white font-bold text-xl">
                          ${((selectedPlan === 'PRO' ? prices.price_pro : prices.price_standard) * (selectedMonths === 12 ? 10 : selectedMonths)).toLocaleString()} ARS
                        </p>
                        {selectedMonths === 12 && (
                          <span className="text-slate-500 line-through text-xs font-bold">
                            ${((selectedPlan === 'PRO' ? prices.price_pro : prices.price_standard) * 12).toLocaleString()} ARS
                          </span>
                        )}
                      </div>
                      {selectedMonths === 12 && (
                        <p className="text-[10px] text-emerald-500 font-black uppercase mt-0.5">¡Promoción activa: 2 meses gratis!</p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Plan Seleccionado</p>
                <p className="text-indigo-400 font-bold uppercase">
                  {user?.subActive && user?.plan === 'STANDARD' && selectedPlan === 'PRO' 
                    ? 'Upgrade Pro' 
                    : `${selectedPlan} x${selectedMonths}`}
                </p>
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

            {/* Notificar pago manual (para transferencias bancarias o si MP no confirma) */}
            <div className="mt-2 p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
              <div className="text-left">
                <p className="text-amber-400 font-bold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  ¿Ya realizaste la transferencia?
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Si pagaste por transferencia bancaria al alias <strong className="text-blue-400 font-mono">horacio.asa</strong> o por cualquier otro medio, notificá al administrador para que active tu cuenta.
                </p>
              </div>
              <button
                onClick={() => {
                  const account = prompt('Por favor, ingresa el NOMBRE del titular de la cuenta o banco desde donde enviaste el pago para que el administrador pueda identificarlo rápidamente:');
                  if (account === null) return; // cancelado
                  handleNotifyPayment(account);
                }}
                disabled={notifying || notified}
                className={`w-full font-extrabold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer ${
                  notified
                    ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                } disabled:opacity-70`}
              >
                {notifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : notified ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    ¡Notificación Enviada!
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Notificar Pago al Administrador
                  </>
                )}
              </button>
            </div>

            {/* General Support Help Link */}
            <div className="mt-6 pt-6 border-t border-white/5 flex flex-col items-center justify-center gap-2">
              <p className="text-xs text-slate-400 font-medium">¿Tienes alguna duda o error con tu suscripción?</p>
              <a
                href="https://wa.me/5492617048835?text=Hola!%20Tengo%20una%20duda%20o%20inconveniente%20con%20el%20pago%20de%20suscripcion%20en%20KIOSNET"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-black transition-all uppercase tracking-wider"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.835-1.921c1.554.922 3.19 1.408 4.887 1.409 5.864 0 10.635-4.757 10.638-10.613.002-2.836-1.1-5.503-3.102-7.51-2.003-2.008-4.667-3.112-7.502-3.113-5.869 0-10.64 4.757-10.643 10.615-.001 1.83.488 3.619 1.417 5.176L1.83 22.097l5.062-1.849zm12.015-8.18c-.31-.156-1.839-.908-2.11-.1-.271.1-.387.417-.474.517-.087.1-.175.111-.486-.044-.31-.156-1.31-.483-2.495-1.54-.922-.822-1.543-1.838-1.724-2.15-.18-.31-.019-.478.136-.633.14-.139.31-.361.466-.543.156-.183.208-.313.31-.522.104-.21.052-.392-.026-.549-.078-.156-.685-1.651-.938-2.26-.247-.594-.499-.514-.685-.523-.175-.009-.377-.01-.58-.01a1.116 1.116 0 00-.809.378c-.277.311-1.057 1.033-1.057 2.52 0 1.487 1.082 2.922 1.232 3.122.15.2.2.13 1.134 3.013.9.78 1.637 1.543 2.5 1.868.863.325 1.653.24 2.273.15.688-.1 1.839-.751 2.1-.1.26.65.26 1.205.13 1.438-.13.233-.387.35-.698.506z"/>
                </svg>
                Soporte por WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-8 max-w-md mx-auto bg-slate-900/90 border border-white/10 rounded-3xl p-8 text-center space-y-6 flex flex-col items-center shadow-2xl backdrop-blur-xl">
            {qrImageUrl ? (
              <div className="flex flex-col items-center w-full">
                <h3 className="text-xl font-bold mb-2">Escanea para pagar</h3>
                
                {/* Mobile direct payment redirection button */}
                <div className="w-full md:hidden mb-6 space-y-4">
                  <a
                    href={qrCodeUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold py-4 px-6 rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 text-sm uppercase tracking-wider"
                  >
                    <CreditCard className="w-5 h-5" />
                    Pagar desde este Celular
                  </a>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                    <div className="relative flex justify-center"><span className="bg-slate-900/90 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">o escanea el QR con Mercado Pago</span></div>
                  </div>
                </div>

                <p className="text-sm text-slate-400 mb-6 hidden md:block">Abre la app de <strong>Mercado Pago</strong> y escanea este código QR</p>
                <p className="text-xs text-slate-400 mb-6 md:hidden">Si estás usando otro dispositivo, escanea este código QR con Mercado Pago</p>
                
                <div className="bg-white p-4 rounded-2xl shadow-xl shadow-blue-500/10 mb-6">
                  <img src={qrImageUrl} alt="Mercado Pago QR Code" className="w-48 h-48 object-contain" />
                </div>
                
                <div className="w-full space-y-4 mt-2">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                    <div className="relative flex justify-center"><span className="bg-slate-900/90 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">¿OTRAS APPS O BANCOS?</span></div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 text-left space-y-2">
                    <p className="text-xs text-slate-300">Si deseas abonar con una app bancaria distinta a Mercado Pago, realiza una transferencia a:</p>
                    <div className="bg-slate-950 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Alias</p>
                        <p className="text-sm font-bold text-blue-400 font-mono">horacio.asa</p>
                      </div>
                      <button onClick={() => navigator.clipboard.writeText('horacio.asa')} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">Copiar</button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Transfiere el monto exacto de <strong>${((selectedPlan === 'PRO' ? prices.price_pro : prices.price_standard) * selectedMonths).toLocaleString()} ARS</strong> y luego haz clic en el botón de abajo para notificar el pago.
                    </p>
                    
                    <button
                      onClick={() => {
                        const account = prompt('Por favor, ingresa el NOMBRE del titular de la cuenta o banco desde donde enviaste el pago para que el administrador pueda identificarlo rápidamente:');
                        if (account === null) return; // cancelado
                        handleNotifyPayment(account);
                      }}
                      disabled={notifying || notified}
                      className={`w-full mt-3 font-extrabold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer ${
                        notified
                          ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                      } disabled:opacity-70`}
                    >
                      {notifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : notified ? (
                        <>
                          <Sparkles className="w-4 h-4" />
                          ¡Notificación Enviada!
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          Notificar Pago al Administrador
                        </>
                      )}
                    </button>
                  </div>
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

            <div className="w-full space-y-3 pt-4 border-t border-white/5">
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
                  setQrCodeUrl(null);
                }}
                className="w-full bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-medium py-2 rounded-xl transition-all text-xs cursor-pointer"
              >
                Cancelar o Cambiar método de pago
              </button>

              <div className="border-t border-white/5 my-2 pt-2"></div>
              
              {/* WhatsApp instant support in case of error */}
              <a
                href="https://wa.me/5492617048835?text=Hola!%20Tengo%20un%20inconveniente%20con%20el%20pago%20de%20suscripcion%20en%20KIOSNET"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold py-3 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer uppercase tracking-wider"
              >
                <svg className="w-4 h-4 fill-emerald-400" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.835-1.921c1.554.922 3.19 1.408 4.887 1.409 5.864 0 10.635-4.757 10.638-10.613.002-2.836-1.1-5.503-3.102-7.51-2.003-2.008-4.667-3.112-7.502-3.113-5.869 0-10.64 4.757-10.643 10.615-.001 1.83.488 3.619 1.417 5.176L1.83 22.097l5.062-1.849zm12.015-8.18c-.31-.156-1.839-.908-2.11-.1-.271.1-.387.417-.474.517-.087.1-.175.111-.486-.044-.31-.156-1.31-.483-2.495-1.54-.922-.822-1.543-1.838-1.724-2.15-.18-.31-.019-.478.136-.633.14-.139.31-.361.466-.543.156-.183.208-.313.31-.522.104-.21.052-.392-.026-.549-.078-.156-.685-1.651-.938-2.26-.247-.594-.499-.514-.685-.523-.175-.009-.377-.01-.58-.01a1.116 1.116 0 00-.809.378c-.277.311-1.057 1.033-1.057 2.52 0 1.487 1.082 2.922 1.232 3.122.15.2.2.13 1.134 3.013.9.78 1.637 1.543 2.5 1.868.863.325 1.653.24 2.273.15.688-.1 1.839-.751 2.1-.1.26.65.26 1.205.13 1.438-.13.233-.387.35-.698.506z"/>
                </svg>
                ¿Hubo un error? WhatsApp de Soporte
              </a>
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
