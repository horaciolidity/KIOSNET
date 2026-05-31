import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, Mail, Loader2, Store, User, ArrowRight } from 'lucide-react';
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
      // 1. Authenticate with Supabase Auth
      let { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      
      let sessionUser = data?.user;
      let isAutoRegistered = false;

      if (authError) {
        // Handle auto-registration client-side if it matches the previous backend behavior
        if (authError.message.includes('Invalid login credentials') || authError.message.includes('should be registered')) {
          try {
            const signUpRes = await supabase.auth.signUp({ email, password });
            if (signUpRes.error) throw signUpRes.error;
            sessionUser = signUpRes.data.user;
            
            if (sessionUser) {
              isAutoRegistered = true;
              const tenantId = crypto.randomUUID();
              const autoStoreName = `Comercio de ${email.split('@')[0]}`;
              
              await supabase.from('Tenant').insert({
                id: tenantId,
                name: autoStoreName,
                plan: 'FREE',
                subActive: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });

              await supabase.from('User').insert({
                id: sessionUser.id,
                email,
                name: email.split('@')[0],
                role: 'ADMIN',
                active: true,
                tenantId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });

              await supabase.from('Category').insert([
                { name: 'General', tenantId },
                { name: 'Bebidas', tenantId },
                { name: 'Comestibles', tenantId }
              ]);

              await supabase.from('Setting').insert([
                { key: 'business_name', value: autoStoreName, tenantId },
                { key: 'business_phone', value: '', tenantId },
                { key: 'business_address', value: '', tenantId },
                { key: 'business_tax_id', value: '', tenantId },
                { key: 'mercado_pago_active', value: 'false', tenantId }
              ]);

              // Login again to establish session
              const reLogin = await supabase.auth.signInWithPassword({ email, password });
              data = reLogin.data;
              sessionUser = reLogin.data.user;
            }
          } catch (regErr: any) {
            throw new Error('Credenciales incorrectas o error de conexión');
          }
        } else {
          throw authError;
        }
      }

      if (!sessionUser) throw new Error('No se pudo iniciar sesión');

      // 2. Fetch public User and Tenant profile data
      const { data: dbUser, error: dbUserError } = await supabase
        .from('User')
        .select(`
          id, email, name, role, tenantId,
          tenant:Tenant(plan, subActive, subExpiresAt)
        `)
        .eq('id', sessionUser.id)
        .single();

      if (dbUserError || !dbUser) {
        throw new Error('No se encontró el perfil del usuario en la base de datos');
      }

      const { count } = await supabase
        .from('Sale')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', dbUser.tenantId);

      const tenant = dbUser.tenant as any;
      const userObj = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role as 'ADMIN' | 'EMPLOYEE',
        tenantId: dbUser.tenantId,
        plan: tenant?.plan || 'FREE',
        subActive: tenant?.subActive || false,
        subExpiresAt: tenant?.subExpiresAt || null,
        salesCount: count || 0
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
      // 1. Sign up to Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;

      const sessionUser = authData?.user;
      if (!sessionUser) throw new Error('No se pudo registrar la cuenta');

      // 2. Provision Tenant, User, Default Categories, Default Settings
      const tenantId = crypto.randomUUID();
      
      const { error: tenantErr } = await supabase.from('Tenant').insert({
        id: tenantId,
        name: storeName,
        plan: 'FREE',
        subActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (tenantErr) throw tenantErr;

      const { error: userErr } = await supabase.from('User').insert({
        id: sessionUser.id,
        email,
        name,
        role: 'ADMIN',
        active: true,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (userErr) throw userErr;

      await supabase.from('Category').insert([
        { name: 'General', tenantId },
        { name: 'Bebidas', tenantId },
        { name: 'Comestibles', tenantId }
      ]);

      await supabase.from('Setting').insert([
        { key: 'business_name', value: storeName, tenantId },
        { key: 'business_phone', value: '', tenantId },
        { key: 'business_address', value: '', tenantId },
        { key: 'business_tax_id', value: '', tenantId },
        { key: 'mercado_pago_active', value: 'false', tenantId }
      ]);

      setSuccess('¡Comercio registrado con éxito! Iniciando sesión...');

      // 3. Complete login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      const userObj = {
        id: sessionUser.id,
        email,
        name,
        role: 'ADMIN' as const,
        tenantId,
        plan: 'FREE',
        subActive: false,
        subExpiresAt: null,
        salesCount: 0
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans relative overflow-hidden">
      {/* Background visual graphics */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-600/15 rounded-full blur-[130px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/15 rounded-full blur-[130px]"></div>
      </div>

      <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative z-10 my-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900/80 border border-white/20 shadow-2xl shadow-blue-500/20 mb-4 overflow-hidden p-1 backdrop-blur-md">
            <img src="/kiosnet_logo.png" alt="KIOSNET Logo" className="w-full h-full object-cover rounded-[20px]" />
          </div>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent uppercase">KIOSNET</h1>
          <p className="text-slate-400 mt-2 font-medium">
            {isRegistering ? 'Registra tu Comercio en la Nube' : 'Sistema de Gestión Profesional'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm text-center">
            {success}
          </div>
        )}

        {isRegistering ? (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Nombre del Comercio</label>
              <div className="relative">
                <Store className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Mi Kiosko / Kiosco Express"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Nombre del Dueño (Admin)</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Email de Acceso</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@email.com"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
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
                  Registrar mi Comercio
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setError('');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                ¿Ya tienes una cuenta? Iniciar Sesión
              </button>
            </div>
          </form>
        ) : (
          /* LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 group disabled:opacity-70 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Entrar al Sistema
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(true);
                  setError('');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                ¿Eres nuevo? Registrar mi comercio (Dueño)
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-slate-400 text-xs border-t border-white/5 pt-6 space-y-2">
          <p>Demo Admin: <span className="text-white font-bold">admin@pos.com</span> / <span className="text-white font-bold">admin123</span></p>
          <p>Demo Empleado: <span className="text-white font-bold">empleado@pos.com</span> / <span className="text-white font-bold">empleado123</span></p>
          <p className="pt-4 text-slate-600">© 2026 KIOSNET. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
