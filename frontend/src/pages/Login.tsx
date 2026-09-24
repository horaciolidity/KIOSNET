import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, Mail, Loader2, Store, User, ArrowRight, Gift, Headphones, Users, Monitor, Printer, Package } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const Login: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const cleanEmail = email.trim();
      // 1. Authenticate with Supabase Auth
      let { data, error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      
      let sessionUser = data?.user;
      let isAutoRegistered = false;

      if (authError) {
        throw authError;
      }

      if (!sessionUser) throw new Error('No se pudo iniciar sesión');

      // 2. Fetch public User and Tenant profile data
      const { data: dbUser, error: dbUserError } = await supabase
        .from('User')
        .select('id, email, name, role, tenantId, onboardingCompleted')
        .eq('id', sessionUser.id)
        .single();

      if (dbUserError || !dbUser) {
        throw new Error('No se encontró el perfil del usuario en la base de datos');
      }

      // Fetch tenant explicitly to avoid array/object mapping issues
      const { data: tenant, error: tenantError } = await supabase
        .from('Tenant')
        .select('plan, subActive, subExpiresAt')
        .eq('id', dbUser.tenantId)
        .single();

      if (tenantError) {
        throw new Error('No se encontró el comercio asociado en la base de datos');
      }

      const { count } = await supabase
        .from('Sale')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', dbUser.tenantId);
      const userObj = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role as 'ADMIN' | 'EMPLOYEE',
        tenantId: dbUser.tenantId,
        plan: tenant?.plan || 'FREE',
        subActive: (tenant?.subActive && (tenant?.subExpiresAt ? new Date(tenant.subExpiresAt) > new Date() : true)) || false,
        subExpiresAt: tenant?.subExpiresAt || null,
        salesCount: count || 0,
        onboardingCompleted: dbUser.onboardingCompleted || false
      };

      if (isAutoRegistered) {
        setSuccess('¡Comercio creado y registrado con éxito! Redirigiendo...');
      } else {
        setSuccess('Sesión iniciada. Redirigiendo...');
      }

      setTimeout(() => {
        setAuth(userObj, data.session?.access_token || '');
        if (userObj.role === 'ADMIN') {
          navigate('/dashboard');
        } else {
          navigate('/pos');
        }
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas o error de conexión');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const cleanEmail = email.trim();
      // 1. Sign up to Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (authError) throw authError;

      const sessionUser = authData?.user;
      if (!sessionUser) throw new Error('No se pudo registrar la cuenta');

      // 2. Check if a database trigger already created the User and Tenant
      const { data: existingUser } = await supabase
        .from('User')
        .select('tenantId')
        .eq('id', sessionUser.id)
        .maybeSingle();

      let currentTenantId = existingUser?.tenantId;

      if (existingUser && currentTenantId) {
        // Trigger already created them. Just update the existing Tenant and User.
        await supabase.from('Tenant').update({
          name: storeName,
          updatedAt: new Date().toISOString()
        }).eq('id', currentTenantId);

        await supabase.from('User').update({
          name,
          role: 'ADMIN',
          updatedAt: new Date().toISOString()
        }).eq('id', sessionUser.id);
      } else {
        // No trigger. Create Tenant and User manually.
        currentTenantId = crypto.randomUUID();
        
        const { error: tenantErr } = await supabase.from('Tenant').insert({
          id: currentTenantId,
          name: storeName,
          plan: 'FREE',
          subActive: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        if (tenantErr) throw tenantErr;

        const { error: userErr } = await supabase.from('User').insert({
          id: sessionUser.id,
          email: cleanEmail,
          name,
          role: 'ADMIN',
          active: true,
          tenantId: currentTenantId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        if (userErr) throw userErr;
      }

      await supabase.from('Category').insert([
        { name: 'General', tenantId: currentTenantId },
        { name: 'Bebidas', tenantId: currentTenantId },
        { name: 'Comestibles', tenantId: currentTenantId }
      ]);

      await supabase.from('Setting').insert([
        { key: 'business_name', value: storeName, tenantId: currentTenantId },
        { key: 'business_phone', value: '', tenantId: currentTenantId },
        { key: 'business_address', value: '', tenantId: currentTenantId },
        { key: 'business_tax_id', value: '', tenantId: currentTenantId },
        { key: 'mercado_pago_active', value: 'false', tenantId: currentTenantId }
      ]);

      setSuccess('¡Comercio registrado con éxito! Iniciando sesión...');

      // 3. Complete login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (loginError) throw loginError;

      const userObj = {
        id: sessionUser.id,
        email: cleanEmail,
        name,
        role: 'ADMIN' as const,
        tenantId: currentTenantId,
        plan: 'FREE',
        subActive: false,
        subExpiresAt: null,
        salesCount: 0,
        onboardingCompleted: false
      };

      setTimeout(() => {
        setAuth(userObj, loginData.session?.access_token || '');
        navigate('/dashboard');
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Error al registrar el comercio');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950 text-white font-sans relative overflow-hidden">
      
      {/* Left Side: Marketing / Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative items-center justify-center p-12 overflow-hidden border-r border-white/5">
        {/* Background gradients for the left side */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-zinc-950 to-slate-900 z-0"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-emerald-600/10 rounded-full blur-[120px] z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[100px] z-0"></div>
        
        <div className="relative z-10 w-full max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-2xl shadow-indigo-500/20 overflow-hidden p-1 backdrop-blur-md">
              <img src="/kiosnet_logo.png" alt="KIOSNET Logo" className="w-full h-full object-cover rounded-[14px]" />
            </div>
            <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-indigo-300 to-white bg-clip-text text-transparent uppercase">KIOSNET</h2>
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-black tracking-tight mb-4 text-white leading-[1.1]">
            El control total de tu comercio, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">en la nube.</span>
          </h1>
          <p className="text-lg text-zinc-400 mb-8 leading-relaxed font-medium">
            El sistema de gestión y punto de venta definitivo. Simple, rápido y seguro.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 1. 50 ventas gratuitas */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-bl-lg shadow-sm">¡GRATIS!</div>
              <Gift className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm font-bold text-emerald-300">50 Ventas de Prueba</h3>
                <p className="text-emerald-400/80 text-xs">Sin tarjeta de crédito</p>
              </div>
            </div>

            {/* 2. Mayoristas */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
              <Package className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm font-bold text-white">Minorista y Mayorista</h3>
                <p className="text-zinc-400 text-xs">Multilista de precios</p>
              </div>
            </div>
            
            {/* 3. Lector e Impresora */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
              <Printer className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm font-bold text-white">Hardware 100% Compatible</h3>
                <p className="text-zinc-400 text-xs">Lectora y ticketera 80mm</p>
              </div>
            </div>

            {/* 4. Pantalla Cliente */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
              <Monitor className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm font-bold text-white">Pantalla de Cliente</h3>
                <p className="text-zinc-400 text-xs">Más transparencia al cobrar</p>
              </div>
            </div>

            {/* 5. Empleados */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
              <Users className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm font-bold text-white">Gestión de Empleados</h3>
                <p className="text-zinc-400 text-xs">Control de turnos y permisos</p>
              </div>
            </div>

            {/* 6. Soporte */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
              <Headphones className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="text-sm font-bold text-white">Soporte Técnico 24/7</h3>
                <p className="text-zinc-400 text-xs">Siempre listos para ayudarte</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-7/12 xl:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Background visual graphics for mobile */}
        <div className="absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/15 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[100px]"></div>
        </div>

        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative z-10 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="lg:hidden inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/80 border border-white/20 shadow-2xl shadow-blue-500/20 mb-4 overflow-hidden p-1 backdrop-blur-md">
              <img src="/kiosnet_logo.png" alt="KIOSNET Logo" className="w-full h-full object-cover rounded-[14px]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {isRegistering ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isRegistering ? 'Empieza a gestionar tu negocio de forma inteligente.' : 'Ingresa a tu panel de control KIOSNET.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm text-center font-medium">
              {success}
            </div>
          )}

          {isRegistering ? (
            /* REGISTRATION FORM */
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Nombre del Comercio</label>
                <div className="relative">
                  <Store className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ej. Kiosco El Sol"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Tu Nombre</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan@ejemplo.com"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 group disabled:opacity-70 mt-4 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Comenzar Gratis
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="text-center pt-4">
                <p className="text-sm text-slate-400">
                  ¿Ya tienes una cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setError('');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    Inicia Sesión
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* LOGIN FORM */
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contraseña</label>
                  <a href="#" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">¿Olvidaste tu contraseña?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 group disabled:opacity-70 mt-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Entrar al Sistema
                  </>
                )}
              </button>

              <div className="text-center pt-4">
                <p className="text-sm text-slate-400">
                  ¿Eres nuevo?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setError('');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    Registra tu comercio
                  </button>
                </p>
              </div>
            </form>
          )}

          <div className="mt-8 text-center text-slate-500 text-xs pt-6">
            <p>© 2026 KIOSNET. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
