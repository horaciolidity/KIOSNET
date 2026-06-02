import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Crown, 
  Zap, 
  Search, 
  DollarSign, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw,
  Building,
  Key,
  X,
  Calendar,
  Power
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  plan: string;
  subActive: boolean;
  subExpiresAt: string | null;
  createdAt: string;
  salesCount: number;
  users: TenantUser[];
  paymentNotification?: {
    notifiedAt: string;
    plan: 'STANDARD' | 'PRO';
    months: number;
    amount: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    senderAccount?: string;
  } | null;
}

interface PricingConfig {
  price_standard: number;
  price_pro: number;
}

const SuperAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [prices, setPrices] = useState<PricingConfig>({ price_standard: 12320, price_pro: 15730 });
  const [loading, setLoading] = useState(true);
  const [savingPrices, setSavingPrices] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'FREE' | 'STANDARD' | 'PRO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch tenants along with users and sales
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('Tenant')
        .select(`
          id, name, email, phone, address, plan, subActive, subExpiresAt, createdAt, paymentNotification,
          users:User(id, email, name, role, active, createdAt),
          sales:Sale(id)
        `)
        .order('createdAt', { ascending: false });

      if (tenantsError) throw tenantsError;

      // Fetch pricing config
      const { data: configPrices, error: pricesError } = await supabase
        .from('SystemConfig')
        .select('key, value');

      if (pricesError) throw pricesError;

      let priceStandard = 12320;
      let pricePro = 15730;

      configPrices?.forEach(cfg => {
        const val = Number(cfg.value);
        if (cfg.key === 'price_standard' && !isNaN(val)) priceStandard = val;
        if (cfg.key === 'price_pro' && !isNaN(val)) pricePro = val;
      });

      const mappedTenants: Tenant[] = (tenantsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        phone: t.phone,
        address: t.address,
        plan: t.plan,
        subActive: t.subActive,
        subExpiresAt: t.subExpiresAt,
        createdAt: t.createdAt,
        salesCount: t.sales?.length || 0,
        users: t.users || [],
        paymentNotification: t.paymentNotification
      }));

      setTenants(mappedTenants);
      setPrices({
        price_standard: priceStandard,
        price_pro: pricePro
      });
      setFeedbackMessage(null);
    } catch (error: any) {
      console.error('Error fetching admin dashboard:', error);
      setFeedbackMessage({
        type: 'error',
        text: error.message || 'Error al conectar con la base de datos de Supabase.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePriceChange = (plan: 'standard' | 'pro', val: string) => {
    const numeric = parseInt(val.replace(/\D/g, '')) || 0;
    setPrices(prev => ({
      ...prev,
      [plan === 'standard' ? 'price_standard' : 'price_pro']: numeric
    }));
  };

  const savePrices = async () => {
    try {
      setSavingPrices(true);
      
      const { error: errStandard } = await supabase
        .from('SystemConfig')
        .upsert({ key: 'price_standard', value: String(prices.price_standard) });
        
      if (errStandard) throw errStandard;

      const { error: errPro } = await supabase
        .from('SystemConfig')
        .upsert({ key: 'price_pro', value: String(prices.price_pro) });

      if (errPro) throw errPro;

      setFeedbackMessage({ type: 'success', text: 'Precios de suscripción actualizados con éxito en la base de datos.' });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error: any) {
      console.error('Error saving prices:', error);
      setFeedbackMessage({ type: 'error', text: error.message || 'Error al guardar los precios.' });
    } finally {
      setSavingPrices(false);
    }
  };

  const [togglingTenantId, setTogglingTenantId] = useState<string | null>(null);
  const [activateModal, setActivateModal] = useState<{ tenantId: string; tenantName: string } | null>(null);
  const [activateDays, setActivateDays] = useState<string>('30');
  const [activatePlan, setActivatePlan] = useState<'STANDARD' | 'PRO'>('STANDARD');

  const openActivateModal = (tenantId: string, tenantName: string, currentPlan: string) => {
    setActivateDays('30');
    setActivatePlan((currentPlan === 'PRO' ? 'PRO' : 'STANDARD') as 'STANDARD' | 'PRO');
    setActivateModal({ tenantId, tenantName });
  };

  const handleToggleTenantStatus = async (tenantId: string, subActive: boolean, days?: number, plan?: string) => {
    try {
      setTogglingTenantId(tenantId);

      // Get current tenant data
      const { data: tenant, error: fetchErr } = await supabase
        .from('Tenant')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (fetchErr || !tenant) {
        throw new Error('Comercio no encontrado.');
      }

      const newStatus = subActive !== undefined ? subActive : !tenant.subActive;
      
      // Calculate new expiry
      let newExpiresAt: string | null = tenant.subExpiresAt;
      if (newStatus && days !== undefined) {
        const numDays = parseInt(String(days), 10);
        if (numDays > 0) {
          const baseDate = (tenant.subActive && tenant.subExpiresAt && new Date(tenant.subExpiresAt) > new Date())
            ? new Date(tenant.subExpiresAt)
            : new Date();
          baseDate.setDate(baseDate.getDate() + numDays);
          newExpiresAt = baseDate.toISOString();
        }
      }

      const updateData: any = { subActive: newStatus };
      if (plan) updateData.plan = plan;
      if (newExpiresAt) updateData.subExpiresAt = newExpiresAt;

      const { data: updatedTenant, error: updateErr } = await supabase
        .from('Tenant')
        .update(updateData)
        .eq('id', tenantId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const daysMsg = days && days > 0
        ? ` por ${days} días (hasta ${new Date(newExpiresAt!).toLocaleDateString('es-AR')})` 
        : '';

      setFeedbackMessage({
        type: 'success',
        text: `Comercio ${updatedTenant.name} ${updatedTenant.subActive ? `activado${daysMsg}` : 'desactivado'} exitosamente.`
      });
      setTimeout(() => setFeedbackMessage(null), 5000);
      
      // Update local state with returned tenant data and refresh the dashboard.
      setTenants(prev => prev.map(t => 
        t.id === tenantId 
          ? { 
              ...t, 
              subActive: updatedTenant.subActive,
              subExpiresAt: updatedTenant.subExpiresAt || t.subExpiresAt,
              plan: updatedTenant.plan || t.plan
            } 
          : t
      ));
      await fetchData();
      setActivateModal(null);
    } catch (error: any) {
      console.error('Error toggling tenant status:', error);
      setFeedbackMessage({
        type: 'error',
        text: error.message || 'Error al cambiar el estado del comercio.'
      });
    } finally {
      setTogglingTenantId(null);
    }
  };

  // Filter logic
  const filteredTenants = tenants.filter(t => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      t.name.toLowerCase().includes(query) || 
      (t.email && t.email.toLowerCase().includes(query)) ||
      (t.phone && t.phone.toLowerCase().includes(query)) ||
      t.users.some(u => u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query));

    const matchesPlan = planFilter === 'ALL' || t.plan === planFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') {
      matchesStatus = t.subActive;
    } else if (statusFilter === 'EXPIRED') {
      matchesStatus = !t.subActive;
    }

    return matchesSearch && matchesPlan && matchesStatus;
  });

  const totalSalesOverall = tenants.reduce((acc, t) => acc + t.salesCount, 0);
  const activeSubsCount = tenants.filter(t => t.subActive).length;

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen overflow-y-auto pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-amber-500/20">
            Súper Administrador
          </span>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mt-2">Panel KIOSNET</h1>
          <p className="text-slate-500 font-medium">Control global de usuarios, planes y facturación del sistema.</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all active:scale-95 shadow-sm"
          title="Recargar datos"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ⚠ PAGOS PENDIENTES BANNER */}
      {tenants.filter(t => t.paymentNotification?.status === 'PENDING').length > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-[32px] p-6 shadow-2xl shadow-orange-500/25">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center relative">
                <DollarSign size={28} className="text-white" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                  {tenants.filter(t => t.paymentNotification?.status === 'PENDING').length}
                </span>
              </div>
              <div>
                <p className="text-white/80 text-xs font-black uppercase tracking-widest">Acción Requerida</p>
                <h3 className="text-white text-xl font-black">
                  {tenants.filter(t => t.paymentNotification?.status === 'PENDING').length === 1
                    ? '1 Pago Pendiente de Aprobación'
                    : `${tenants.filter(t => t.paymentNotification?.status === 'PENDING').length} Pagos Pendientes de Aprobación`
                  }
                </h3>
                <p className="text-white/70 text-xs mt-0.5">
                  Los comercios marcados con «NUEVO PAGO» en la tabla de abajo esperan confirmación.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {tenants.filter(t => t.paymentNotification?.status === 'PENDING').map(t => (
                <div key={t.id} className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-4">
                  <div className="text-left flex-1">
                    <p className="text-white font-black text-sm">{t.name}</p>
                    <p className="text-white/70 text-xs">
                      Plan {t.paymentNotification!.plan} — {t.paymentNotification!.months} mes{t.paymentNotification!.months > 1 ? 'es' : ''} — ${t.paymentNotification!.amount.toLocaleString()} ARS
                    </p>
                    <p className="text-white/50 text-[10px]">
                      Notificado: {new Date(t.paymentNotification!.notifiedAt).toLocaleString('es-AR')}
                    </p>
                    {t.paymentNotification!.senderAccount && (
                      <p className="text-white bg-slate-950/20 border border-white/15 px-2 py-0.5 rounded-lg text-[10px] font-mono mt-1 inline-block">
                        Emisor: <strong>{t.paymentNotification!.senderAccount}</strong>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          let baseDate = new Date();
                          if (t.subActive && t.subExpiresAt && new Date(t.subExpiresAt) > new Date()) {
                            baseDate = new Date(t.subExpiresAt);
                          }
                          baseDate.setMonth(baseDate.getMonth() + t.paymentNotification!.months);
                          const { error } = await supabase.from('Tenant').update({
                            subActive: true,
                            plan: t.paymentNotification!.plan,
                            subExpiresAt: baseDate.toISOString(),
                            paymentNotification: { ...t.paymentNotification, status: 'APPROVED' }
                          }).eq('id', t.id);
                          if (error) throw error;
                          alert('¡Aprobado y activado!');
                          fetchData();
                        } catch (err: any) { alert('Error: ' + err.message); }
                      }}
                      className="bg-white text-orange-600 hover:bg-orange-50 font-black text-xs px-4 py-2 rounded-xl transition-all active:scale-95"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await supabase.from('Tenant').update({
                            paymentNotification: { ...t.paymentNotification, status: 'REJECTED' }
                          }).eq('id', t.id);
                          if (error) throw error;
                          fetchData();
                        } catch (err: any) { alert('Error: ' + err.message); }
                      }}
                      className="bg-white/20 hover:bg-red-500/30 text-white font-black text-xs px-4 py-2 rounded-xl transition-all active:scale-95"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {feedbackMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' 
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="font-bold text-sm">{feedbackMessage.text}</span>
        </div>
      )}

      {/* Grid of Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl text-blue-600">
            <Building size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comercios Totales</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{tenants.length}</h2>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600">
            <Crown size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Licencias Activas</p>
            <h2 className="text-3xl font-black text-emerald-600 mt-1">{activeSubsCount}</h2>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas Registradas</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{totalSalesOverall.toLocaleString()}</h2>
          </div>
        </div>
      </div>

      {/* Set Subscription Prices Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Key size={24} className="text-amber-500" /> Tarifas de Planes KIOSNET
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Configura los precios que se cobrarán a través de Mercado Pago en toda la aplicación.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Precio Plan Estándar ($ ARS)</label>
            <div className="relative">
              <span className="absolute left-4 top-4 font-black text-slate-400 text-lg">$</span>
              <input 
                type="text" 
                value={prices.price_standard.toLocaleString()}
                onChange={(e) => handlePriceChange('standard', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-8 pr-4 font-black text-slate-900 dark:text-white text-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="12,320"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Precio Plan Pro ($ ARS)</label>
            <div className="relative">
              <span className="absolute left-4 top-4 font-black text-slate-400 text-lg">$</span>
              <input 
                type="text" 
                value={prices.price_pro.toLocaleString()}
                onChange={(e) => handlePriceChange('pro', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-8 pr-4 font-black text-slate-900 dark:text-white text-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="15,730"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={savePrices}
            disabled={savingPrices}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-4 rounded-2xl flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <Save size={20} /> {savingPrices ? 'Guardando...' : 'Guardar Precios'}
          </button>
        </div>
      </div>

      {/* Users & Plans List */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users size={24} className="text-blue-600" /> Comercios Registrados
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Lista en tiempo real con estadísticas y detalles de suscripción.</p>
          </div>
          
          {/* Filters Bar */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search Input */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar comercio o email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors w-64"
              />
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            </div>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e: any) => setPlanFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-xs font-black uppercase text-slate-600 dark:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="ALL">Todos los Planes</option>
              <option value="FREE">Plan Free</option>
              <option value="STANDARD">Plan Estándar</option>
              <option value="PRO">Plan Pro</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-xs font-black uppercase text-slate-600 dark:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Con Suscripción Activa</option>
              <option value="EXPIRED">Sin Suscripción Activa</option>
            </select>
          </div>
        </div>

        {/* Table/List */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
            <p className="font-bold text-slate-400">Cargando base de datos...</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
            <Users className="text-slate-300 dark:text-slate-700 mx-auto mb-4" size={48} />
            <p className="font-bold text-slate-400">No se encontraron comercios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-400">Comercio</th>
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-400">Contacto</th>
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-400">Plan Asignado</th>
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-400">Estado Licencia</th>
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-400 text-center">Ventas Realizadas</th>
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-400">Fecha Alta</th>
                  <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-400 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white text-sm">{t.name}</span>
                          {t.paymentNotification && t.paymentNotification.status === 'PENDING' && (
                            <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce">
                              ¡NUEVO PAGO!
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">{t.id}</span>
                        {t.paymentNotification && t.paymentNotification.status === 'PENDING' && (
                          <div className="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded-xl text-left max-w-[220px]">
                            <p className="text-[9px] font-black text-red-500 uppercase tracking-wider">Reportó Transferencia</p>
                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                              Plan: {t.paymentNotification.plan} ({t.paymentNotification.months}m)
                            </p>
                            <p className="text-[10px] font-bold text-slate-900 dark:text-white">
                              Total: ${t.paymentNotification.amount.toLocaleString()} ARS
                            </p>
                            {t.paymentNotification.senderAccount && (
                              <p className="text-[9px] bg-slate-950/10 text-slate-600 dark:text-slate-300 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 font-mono mt-1 overflow-hidden truncate max-w-[200px]">
                                Emisor: <strong>{t.paymentNotification.senderAccount}</strong>
                              </p>
                            )}
                            <div className="flex gap-1.5 mt-2">
                              <button
                                onClick={async () => {
                                  try {
                                    // APROBAR PAGO
                                    // Calcular expiración
                                    let baseDate = new Date();
                                    if (t.subActive && t.subExpiresAt && new Date(t.subExpiresAt) > new Date()) {
                                      baseDate = new Date(t.subExpiresAt);
                                    }
                                    baseDate.setMonth(baseDate.getMonth() + t.paymentNotification!.months);
                                    
                                    const { error: appErr } = await supabase
                                      .from('Tenant')
                                      .update({
                                        subActive: true,
                                        plan: t.paymentNotification!.plan,
                                        subExpiresAt: baseDate.toISOString(),
                                        paymentNotification: {
                                          ...t.paymentNotification,
                                          status: 'APPROVED'
                                        }
                                      })
                                      .eq('id', t.id);
                                    if (appErr) throw appErr;
                                    alert('¡Pago aprobado y comercio activado con éxito!');
                                    fetchData();
                                  } catch (err: any) {
                                    alert('Error al aprobar: ' + err.message);
                                  }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black px-2 py-1 rounded-lg transition-all shrink-0"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    // RECHAZAR PAGO
                                    const { error: rejErr } = await supabase
                                      .from('Tenant')
                                      .update({
                                        paymentNotification: {
                                          ...t.paymentNotification,
                                          status: 'REJECTED'
                                        }
                                      })
                                      .eq('id', t.id);
                                    if (rejErr) throw rejErr;
                                    alert('Reporte de pago rechazado.');
                                    fetchData();
                                  } catch (err: any) {
                                    alert('Error al rechazar: ' + err.message);
                                  }
                                }}
                                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-black px-2 py-1 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-all shrink-0"
                              >
                                Rechazar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                          {t.users.find(u => u.role === 'ADMIN')?.email || t.email || 'Sin email'}
                        </span>
                        {t.phone && <span className="text-[10px] text-slate-400 font-medium mt-0.5">{t.phone}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {t.plan === 'PRO' ? (
                          <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border border-amber-500/20">
                            <Crown size={12} /> PRO
                          </span>
                        ) : t.plan === 'STANDARD' ? (
                          <span className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border border-blue-500/20">
                            <Zap size={12} /> STANDARD
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                            FREE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        {t.subActive ? (
                          <span className="flex items-center gap-1 text-emerald-500 font-black text-xs">
                            <CheckCircle size={14} /> ACTIVA
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500 font-black text-xs">
                            <XCircle size={14} /> BLOQUEADA
                          </span>
                        )}
                        {t.subExpiresAt && (
                          <span className="text-[10px] text-slate-400 mt-1 font-bold">
                            Vence: {new Date(t.subExpiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-mono font-black text-sm ${t.salesCount >= 50 && !t.subActive ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {t.salesCount} / {t.plan === 'FREE' ? '50' : '∞'}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!t.subActive ? (
                          <button
                            onClick={() => openActivateModal(t.id, t.name, t.plan)}
                            disabled={togglingTenantId === t.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20"
                          >
                            <Power size={11} />
                            {togglingTenantId === t.id ? 'Procesando...' : 'Activar'}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openActivateModal(t.id, t.name, t.plan)}
                              disabled={togglingTenantId === t.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20"
                            >
                              <Calendar size={11} />
                              Extender
                            </button>
                            <button
                              onClick={() => handleToggleTenantStatus(t.id, false)}
                              disabled={togglingTenantId === t.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                            >
                              <XCircle size={11} />
                              {togglingTenantId === t.id ? 'Procesando...' : 'Desactivar'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activation Modal */}
      {activateModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-1">Activar / Extender Suscripción</p>
                <h3 className="text-xl font-black">{activateModal.tenantName}</h3>
              </div>
              <button onClick={() => setActivateModal(null)} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Plan selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Plan a asignar</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setActivatePlan('STANDARD')}
                    className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${
                      activatePlan === 'STANDARD'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-400'
                    }`}
                  >
                    <Zap size={14} className="inline mr-1.5" />
                    Estándar
                  </button>
                  <button
                    onClick={() => setActivatePlan('PRO')}
                    className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${
                      activatePlan === 'PRO'
                        ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-400'
                    }`}
                  >
                    <Crown size={14} className="inline mr-1.5" />
                    Pro
                  </button>
                </div>
              </div>

              {/* Days input */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} /> Días de suscripción
                </label>
                <div className="flex gap-2">
                  {['0', '7', '15', '30', '60', '90'].map(d => (
                    <button
                      key={d}
                      onClick={() => setActivateDays(d)}
                      className={`flex-1 py-2 rounded-xl font-black text-xs border transition-all ${
                        activateDays === d
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-emerald-400'
                      }`}
                    >
                      {d === '0' ? 'Manual' : d + 'd'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  value={activateDays}
                  onChange={(e) => setActivateDays(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 font-black text-slate-900 dark:text-white text-lg text-center focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Cantidad de días"
                />
                {activateDays === '0' ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold text-center">
                    ⚠ Con 0 días, el comercio queda activo sin fecha de vencimiento.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 font-bold text-center">
                    Vencimiento: {(() => {
                      const d = new Date();
                      d.setDate(d.getDate() + parseInt(activateDays || '0'));
                      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    })()}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setActivateModal(null)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-black text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleToggleTenantStatus(
                    activateModal.tenantId,
                    true,
                    parseInt(activateDays || '0'),
                    activatePlan
                  )}
                  disabled={togglingTenantId === activateModal.tenantId}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white py-3.5 rounded-2xl font-black text-sm transition-all shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {togglingTenantId === activateModal.tenantId ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Power size={16} />
                  )}
                  {togglingTenantId === activateModal.tenantId ? 'Activando...' : 'Activar Ahora'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
