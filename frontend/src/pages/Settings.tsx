import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Smartphone, 
  CreditCard, 
  Store, 
  ChevronRight,
  Save,
  CheckCircle2,
  QrCode
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string | null>('business');
  const [showSaved, setShowSaved] = useState(false);
  const { user } = useAuthStore();
  
  const store = useSettingsStore();
  const businessInfo = store.businessInfo || {
    name: 'Mi Comercio',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    mercadoPago: { accessToken: '', posId: '', isActive: false }
  };
  const notifications = store.notifications || {
    lowStockAlerts: true,
    dailyReports: true,
    newSaleNotifications: true
  };
  const display = store.display || {
    welcomeMessage: '',
    showLogo: true
  };
  const security = store.security || {
    adminPin: '1234',
    employeeBlockInventory: true,
    employeeBlockCash: true
  };
  const { 
    updateBusinessInfo, 
    updateNotifications, 
    updateDisplay,
    updateSecurity
  } = store;

  const handleSave = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Ajustes del Sistema</h1>
          <p className="text-slate-500 dark:text-slate-400">Configura tu comercio y preferencias de la aplicación.</p>
        </div>
        {showSaved && (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={18} />
            <span className="text-sm font-bold">Cambios guardados</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-3">
          <NavButton 
            icon={<Store size={20} />} 
            title="Mi Comercio" 
            active={activeSection === 'business'} 
            onClick={() => setActiveSection('business')}
          />
          <NavButton 
            icon={<Bell size={20} />} 
            title="Notificaciones" 
            active={activeSection === 'notifications'} 
            onClick={() => setActiveSection('notifications')}
          />
          <NavButton 
            icon={<Smartphone size={20} />} 
            title="Pantalla Cliente" 
            active={activeSection === 'display'} 
            onClick={() => setActiveSection('display')}
          />
          <NavButton 
            icon={<Shield size={20} />} 
            title="Seguridad" 
            active={activeSection === 'security'} 
            onClick={() => setActiveSection('security')}
          />
          <NavButton 
            icon={<CreditCard size={20} />} 
            title="Plan y Suscripción" 
            active={activeSection === 'plan'} 
            onClick={() => setActiveSection('plan')}
          />
          <NavButton 
            icon={<QrCode size={20} />} 
            title="Integraciones API" 
            active={activeSection === 'api'} 
            onClick={() => setActiveSection('api')}
          />

        </div>

        {/* Content Area */}
        <div className="lg:col-span-2">
          {!activeSection ? (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
              <SettingsIcon size={64} className="mb-4 opacity-20" />
              <p className="font-medium text-lg">Selecciona una categoría para configurar</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="p-8 space-y-8">
                {activeSection === 'business' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">Información del Comercio</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input 
                        label="Nombre del Negocio" 
                        value={businessInfo.name} 
                        onChange={(e: any) => updateBusinessInfo({ name: e.target.value })} 
                      />
                      <Input 
                        label="ID Fiscal / RUT / CUIT" 
                        value={businessInfo.taxId} 
                        onChange={(e: any) => updateBusinessInfo({ taxId: e.target.value })} 
                      />
                      <Input 
                        label="Dirección" 
                        value={businessInfo.address} 
                        onChange={(e: any) => updateBusinessInfo({ address: e.target.value })} 
                      />
                      <Input 
                        label="Teléfono de Contacto" 
                        value={businessInfo.phone} 
                        onChange={(e: any) => updateBusinessInfo({ phone: e.target.value })} 
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'notifications' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">Preferencias de Alerta</h3>
                    <div className="space-y-4">
                      <Toggle 
                        label="Alertas de Stock Bajo" 
                        description="Notificar cuando un producto alcance el mínimo."
                        checked={notifications.lowStockAlerts}
                        onChange={(val: any) => updateNotifications({ lowStockAlerts: val })}
                      />
                      <Toggle 
                        label="Reportes Diarios Automáticos" 
                        description="Enviar resumen de ventas al finalizar el día."
                        checked={notifications.dailyReports}
                        onChange={(val: any) => updateNotifications({ dailyReports: val })}
                      />
                      <Toggle 
                        label="Notificaciones de Nueva Venta" 
                        description="Mostrar un aviso visual por cada venta realizada."
                        checked={notifications.newSaleNotifications}
                        onChange={(val: any) => updateNotifications({ newSaleNotifications: val })}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'display' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">Pantalla de Cliente</h3>
                    <div className="space-y-6">
                      <Input 
                        label="Mensaje de Bienvenida / Promocional" 
                        value={display.welcomeMessage} 
                        onChange={(e: any) => updateDisplay({ welcomeMessage: e.target.value })} 
                      />
                      <Toggle 
                        label="Mostrar Logo en Display" 
                        description="Muestra el logo del comercio en la pantalla del cliente."
                        checked={display.showLogo}
                        onChange={(val: any) => updateDisplay({ showLogo: val })}
                      />
                    </div>
                  </div>
                )}

                {activeSection === 'security' && (
                  <div className="relative min-h-[300px] animate-in fade-in duration-300">
                    {/* Locked Overlay for Free/Standard users */}
                    {!(user?.subActive && user?.plan === 'PRO') && (
                      <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center rounded-[32px]">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mb-4">
                          <Shield size={32} />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">Seguridad & Control de Roles (PRO)</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 leading-relaxed">
                          La restricción de inventario para empleados y el bloqueo de caja fuerte requieren una suscripción **PRO** activa.
                        </p>
                        <button 
                          onClick={() => setActiveSection('plan')}
                          className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/20"
                        >
                          Actualizar a Plan PRO
                        </button>
                      </div>
                    )}

                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Shield className="text-blue-600" /> Seguridad y Control de Roles
                        </h3>
                        <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                          Función Pro
                        </span>
                      </div>

                      <div className="space-y-6">
                        {/* PIN Configuration */}
                        <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                          <div>
                            <h4 className="text-base font-black text-slate-900 dark:text-white">PIN de Seguridad del Administrador</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Este PIN es requerido para cambiar del modo Empleado a Administrador en la barra lateral del POS.</p>
                          </div>
                          <div className="max-w-xs relative">
                            <input 
                              type="password"
                              maxLength={8}
                              placeholder="PIN de Administrador"
                              value={security?.adminPin || ''}
                              onChange={(e) => updateSecurity({ adminPin: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 px-6 text-slate-900 dark:text-white font-black text-lg tracking-[0.25em] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                          </div>
                        </div>

                        {/* Permissions matrix */}
                        <div className="space-y-4">
                          <h4 className="text-base font-black text-slate-900 dark:text-white">Restricciones para el Modo Empleado</h4>
                          <div className="space-y-4">
                            <Toggle 
                              label="Bloquear Inventario" 
                              description="El empleado no podrá añadir, editar o eliminar productos del catálogo."
                              checked={security?.employeeBlockInventory ?? true}
                              onChange={(val: boolean) => updateSecurity({ employeeBlockInventory: val })}
                            />
                            <Toggle 
                              label="Ocultar Ganancias de Caja" 
                              description="Oculta los resúmenes de ganancias netas en las pantallas de caja e historial."
                              checked={security?.employeeBlockCash ?? true}
                              onChange={(val: boolean) => updateSecurity({ employeeBlockCash: val })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'plan' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">Licencia y Facturación</h3>
                    
                    {user?.subActive ? (
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-500/20">
                        <div className="relative z-10 space-y-4">
                          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">Licencia Activa</span>
                          <h4 className="text-3xl font-black uppercase tracking-tight">Plan {user?.plan}</h4>
                          <p className="text-emerald-100 text-sm">Tu comercio se encuentra operando con acceso completo ilimitado y cobros habilitados.</p>
                          <div className="pt-2">
                            <button 
                              onClick={() => {
                                // Trigger subscription page display
                                useAuthStore.setState({ user: { ...user!, subActive: false, salesCount: 50 } });
                              }}
                              className="bg-white text-emerald-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-md"
                            >
                              Ver / Cambiar Plan
                            </button>
                          </div>
                        </div>
                        <CreditCard className="absolute -right-10 -bottom-10 w-48 h-48 text-white/10 -rotate-12" />
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-blue-600/20">
                        <div className="relative z-10 space-y-4">
                          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">Período de Prueba</span>
                          <h4 className="text-3xl font-black uppercase tracking-tight">Plan Gratis (Trial)</h4>
                          <p className="text-blue-100 text-sm">Estás utilizando las 50 ventas de prueba gratuitas. Una vez completadas, deberás activar un plan mensual para continuar.</p>
                          <div className="pt-2">
                            <button 
                              onClick={() => {
                                // Trigger subscription page display
                                useAuthStore.setState({ user: { ...user!, subActive: false, salesCount: 50 } });
                              }}
                              className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-all shadow-md"
                            >
                              Suscribirse a Plan Estándar / PRO
                            </button>
                          </div>
                        </div>
                        <CreditCard className="absolute -right-10 -bottom-10 w-48 h-48 text-white/10 -rotate-12" />
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'api' && (
                  <div className="relative min-h-[300px] animate-in fade-in duration-300">
                    {/* Locked Overlay for Free/Standard users */}
                    {!(user?.subActive && user?.plan === 'PRO') && (
                      <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center rounded-[32px]">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                          <QrCode size={32} />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">Cobro por QR de Mercado Pago (PRO)</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 leading-relaxed">
                          La integración automatizada con códigos QR de Mercado Pago en tu POS requiere una suscripción **PRO** activa.
                        </p>
                        <button 
                          onClick={() => setActiveSection('plan')}
                          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                        >
                          Actualizar a Plan PRO
                        </button>
                      </div>
                    )}

                    <div className="space-y-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center gap-2">
                        <QrCode className="text-blue-600" /> Mercado Pago (QR Dinámico)
                      </h3>
                      <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/20 text-sm text-blue-800 dark:text-blue-300 mb-6 font-medium">
                        Configura tu cuenta de Mercado Pago para generar cobros automáticos mediante código QR en tu mostrador o pantalla display.
                      </div>
                      <div className="space-y-4">
                        <Toggle 
                          label="Activar Cobro por QR en POS" 
                          description="Habilita la opción de cobrar con QR dinámico de Mercado Pago en la pantalla de ventas."
                          checked={businessInfo.mercadoPago?.isActive || false}
                          onChange={(val: any) => updateBusinessInfo({ mercadoPago: { ...businessInfo.mercadoPago, isActive: val } })}
                        />
                        <Input 
                          label="Access Token (Producción)" 
                          value={businessInfo.mercadoPago?.accessToken || ''} 
                          onChange={(e: any) => updateBusinessInfo({ mercadoPago: { ...businessInfo.mercadoPago, accessToken: e.target.value } })} 
                        />
                        <Input 
                          label="ID de Caja (POS ID)" 
                          value={businessInfo.mercadoPago?.posId || ''} 
                          onChange={(e: any) => updateBusinessInfo({ mercadoPago: { ...businessInfo.mercadoPago, posId: e.target.value } })} 
                        />
                      </div>
                    </div>
                  </div>
                )}


              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button 
                  onClick={handleSave}
                  className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Save size={18} /> Guardar Cambios
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NavButton = ({ icon, title, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all group ${
      active 
      ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/20 scale-[1.02]' 
      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-500/30'
    }`}
  >
    <div className="flex items-center gap-4">
      <div className={`${active ? 'text-white' : 'group-hover:text-blue-500'} transition-colors`}>
        {icon}
      </div>
      <span className="font-bold text-sm">{title}</span>
    </div>
    <ChevronRight size={16} className={active ? 'text-white' : 'text-slate-300'} />
  </button>
);

const Input = ({ label, value, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">{label}</label>
    <input 
      type="text" 
      value={value}
      onChange={onChange}
      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3.5 px-6 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
    />
  </div>
);

const Toggle = ({ label, description, checked, onChange }: any) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
    <div>
      <p className="font-bold text-slate-900 dark:text-white text-sm">{label}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
    <button 
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full transition-all relative ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'right-1' : 'left-1'}`}></div>
    </button>
  </div>
);

export default Settings;
