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
  Key
} from 'lucide-react';
import api from '../utils/api';

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
      const response = await api.get('/admin/dashboard');
      setTenants(response.data.tenants);
      setPrices(response.data.prices);
      setFeedbackMessage(null);
    } catch (error: any) {
      console.error('Error fetching admin dashboard:', error);
      setFeedbackMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error al conectar con el servidor.'
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
      await api.post('/admin/prices', prices);
      setFeedbackMessage({ type: 'success', text: 'Precios de suscripción actualizados con éxito en la base de datos.' });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error: any) {
      console.error('Error saving prices:', error);
      setFeedbackMessage({ type: 'error', text: error.response?.data?.message || 'Error al guardar los precios.' });
    } finally {
      setSavingPrices(false);
    }
  };

  const [togglingTenantId, setTogglingTenantId] = useState<string | null>(null);

  const handleToggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      setTogglingTenantId(tenantId);
      const response = await api.post(`/admin/tenants/${tenantId}/toggle-status`, {
        subActive: !currentStatus
      });
      setFeedbackMessage({
        type: 'success',
        text: response.data.message
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      
      // Update local state directly
      setTenants(prev => prev.map(t => 
        t.id === tenantId ? { ...t, subActive: !currentStatus } : t
      ));
    } catch (error: any) {
      console.error('Error toggling tenant status:', error);
      setFeedbackMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error al cambiar el estado del comercio.'
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
                        <span className="font-black text-slate-900 dark:text-white text-sm">{t.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">{t.id}</span>
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
                      <button
                        onClick={() => handleToggleTenantStatus(t.id, t.subActive)}
                        disabled={togglingTenantId === t.id}
                        className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${
                          t.subActive
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20'
                        }`}
                      >
                        {togglingTenantId === t.id ? (
                          'Procesando...'
                        ) : t.subActive ? (
                          'Desactivar'
                        ) : (
                          'Activar'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;
