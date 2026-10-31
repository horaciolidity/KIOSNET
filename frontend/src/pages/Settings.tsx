import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Scale,
  Cpu,
  Barcode,
  Sliders,
  Play,
  QrCode,
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  Sparkles
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { ScaleService } from '../services/scaleService';
import { MercadoPagoService, MP_DIRECT_LINKS, type MPPos } from '../services/mercadoPagoService';

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string | null>('business');
  const [showSaved, setShowSaved] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
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
  const scaleConfig = store.scaleConfig || {
    enabled: false,
    mode: 'BOTH',
    directConfig: { connectionType: 'WEB_SERIAL', baudRate: 9600, protocol: 'SYSTEL_KRETZ', autoConnect: false },
    barcodeConfig: { prefix: '20', valueType: 'WEIGHT_GRAMS', codeLength: 5, valueLength: 5 }
  };
  const { 
    updateBusinessInfo, 
    updateNotifications, 
    updateDisplay,
    updateSecurity,
    updateScaleConfig,
    updateMercadoPago
  } = store;

  // Mercado Pago states
  const mpConfig = businessInfo.mercadoPago || {
    accessToken: '',
    posId: '',
    externalPosId: '',
    posName: '',
    userId: '',
    isActive: false,
    fixedQrImage: '',
    fixedQrData: ''
  };
  const [mpStatusMessage, setMpStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [availablePosList, setAvailablePosList] = useState<MPPos[]>([]);
  const [showToken, setShowToken] = useState(false);

  const handleTestAndLoadMP = () => {
    const token = mpConfig.accessToken?.trim();
    if (!token) {
      setMpStatusMessage({ type: 'error', text: 'Por favor ingresa primero tu Access Token.' });
      return;
    }

    const check = MercadoPagoService.validateTokenFormat(token);
    if (!check.valid) {
      setMpStatusMessage({ type: 'error', text: check.message });
      return;
    }

    updateMercadoPago({
      accessToken: token,
      userId: check.userId || mpConfig.userId || '',
      isActive: true
    });

    setMpStatusMessage({
      type: 'success',
      text: '✓ ¡Access Token verificado y guardado con éxito! Mercado Pago está activo.'
    });
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateMercadoPago({ fixedQrImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const [testDirectStatus, setTestDirectStatus] = useState<{ connected: boolean; weight: number }>({ connected: false, weight: 0 });
  const [testDirectMessage, setTestDirectMessage] = useState('');
  const [testBarcode, setTestBarcode] = useState('2000105012504');
  const [testBarcodeResult, setTestBarcodeResult] = useState<any>(null);

  const handleTestDirectScale = async () => {
    if (scaleConfig.directConfig.connectionType === 'SIMULATED') {
      const weight = ScaleService.simulateReadWeight();
      setTestDirectStatus({ connected: true, weight });
      setTestDirectMessage(`Simulación activa: peso obtenido ${weight.toFixed(3)} Kg`);
    } else {
      setTestDirectMessage('Solicitando puerto serie...');
      const res = await ScaleService.connectDirectScale(scaleConfig.directConfig.baudRate);
      setTestDirectMessage(res.message);
      setTestDirectStatus({ connected: res.success, weight: ScaleService.getLastWeight() });
    }
  };

  const handleSave = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  return (
    <div className="md:p-8 p-4 space-y-8 max-w-5xl">
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
        <div id="tour-settings-nav" className="space-y-3">
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
            icon={<Scale size={20} />} 
            title="Balanzas y Periféricos" 
            active={activeSection === 'peripherals'} 
            onClick={() => setActiveSection('peripherals')}
          />
          <NavButton 
            icon={<QrCode size={20} className="text-[#009EE3]" />} 
            title="Mercado Pago (Cobro QR)" 
            active={activeSection === 'mercadopago'} 
            onClick={() => setActiveSection('mercadopago')}
          />
          <NavButton 
            icon={<CreditCard size={20} />} 
            title="Plan y Suscripción" 
            active={activeSection === 'plan'} 
            onClick={() => setActiveSection('plan')}
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
            <div id="tour-settings-content" className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
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

                {activeSection === 'peripherals' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Scale className="text-blue-600" /> Balanzas & Periféricos Híbridos
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Configura la conexión directa por puerto serie/USB y el escaneo de códigos de barras generados por balanzas.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <Toggle 
                        label="Activar Integración con Balanzas" 
                        description="Habilita la lectura automática de peso y la interpretación de códigos de barras EAN-13 de balanzas."
                        checked={scaleConfig.enabled}
                        onChange={(val: boolean) => updateScaleConfig({ enabled: val })}
                      />

                      {scaleConfig.enabled && (
                        <>
                          <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                              Modo de Funcionamiento de la Balanza
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <button
                                type="button"
                                onClick={() => updateScaleConfig({ mode: 'DIRECT' })}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                  scaleConfig.mode === 'DIRECT'
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 shadow-md'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 dark:text-white">
                                  <Cpu size={18} className="text-blue-600" /> Balanza Directa
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Conectada por puerto Serie/USB al equipo. Lee el peso en tiempo real al cobrar.
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateScaleConfig({ mode: 'BARCODE' })}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                  scaleConfig.mode === 'BARCODE'
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 shadow-md'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 dark:text-white">
                                  <Barcode size={18} className="text-blue-600" /> Balanza con Etiquetadora
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Imprime etiquetas EAN-13. El POS interpreta el producto y el peso/precio al escanear.
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateScaleConfig({ mode: 'BOTH' })}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                  scaleConfig.mode === 'BOTH'
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 shadow-md'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 dark:text-white">
                                  <Sliders size={18} className="text-blue-600" /> Híbrido (Ambas)
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Soporta balanza en vivo por cable y etiquetas impresas por balanza simultáneamente.
                                </p>
                              </button>
                            </div>
                          </div>

                          {(scaleConfig.mode === 'DIRECT' || scaleConfig.mode === 'BOTH') && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                              <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                                <Cpu size={18} className="text-blue-600" /> Configuración de Conexión Directa
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Tipo de Conexión</label>
                                  <select
                                    value={scaleConfig.directConfig.connectionType}
                                    onChange={(e) => updateScaleConfig({
                                      directConfig: { ...scaleConfig.directConfig, connectionType: e.target.value as any }
                                    })}
                                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                                  >
                                    <option value="WEB_SERIAL">Web Serial API (RS232 / USB Serie - Systel/Kretz)</option>
                                    <option value="SIMULATED">Simulación para Pruebas (Modo Demo)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Baud Rate (Velocidad)</label>
                                  <select
                                    value={scaleConfig.directConfig.baudRate}
                                    onChange={(e) => updateScaleConfig({
                                      directConfig: { ...scaleConfig.directConfig, baudRate: Number(e.target.value) }
                                    })}
                                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                                  >
                                    <option value={9600}>9600 Baud (Predeterminado Systel/Kretz/Toledo)</option>
                                    <option value={4800}>4800 Baud</option>
                                    <option value={2400}>2400 Baud</option>
                                    <option value={19200}>19200 Baud</option>
                                  </select>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <span className={`w-3 h-3 rounded-full ${testDirectStatus.connected ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Estado: {testDirectStatus.connected ? 'CONECTADA Y LEYENDO' : 'DESCONECTADA'}
                                  </span>
                                  {testDirectStatus.weight > 0 && (
                                    <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-xl text-xs font-black">
                                      ⚖️ {testDirectStatus.weight.toFixed(3)} Kg
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleTestDirectScale}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                                  >
                                    <Play size={14} /> Probar Conexión Directa
                                  </button>
                                </div>
                              </div>
                              {testDirectMessage && (
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{testDirectMessage}</p>
                              )}
                            </div>
                          )}

                          {(scaleConfig.mode === 'BARCODE' || scaleConfig.mode === 'BOTH') && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                              <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                                <Barcode size={18} className="text-blue-600" /> Configuración de Código de Barras (EAN-13)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Prefijo de Etiqueta</label>
                                  <input
                                    type="text"
                                    maxLength={2}
                                    value={scaleConfig.barcodeConfig.prefix}
                                    onChange={(e) => updateScaleConfig({
                                      barcodeConfig: { ...scaleConfig.barcodeConfig, prefix: e.target.value }
                                    })}
                                    placeholder="20"
                                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                                  />
                                  <p className="text-[10px] text-slate-400 mt-1">Normalmente es '20' o '21' en balanzas de supermercado.</p>
                                </div>

                                <div>
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Dato Codificado en la Etiqueta</label>
                                  <select
                                    value={scaleConfig.barcodeConfig.valueType}
                                    onChange={(e) => updateScaleConfig({
                                      barcodeConfig: { ...scaleConfig.barcodeConfig, valueType: e.target.value as any }
                                    })}
                                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                                  >
                                    <option value="WEIGHT_GRAMS">Peso en Gramos (ej: 01250 = 1,250 Kg)</option>
                                    <option value="PRICE_CENTS">Precio Total en Centavos (ej: 03750 = $3.750)</option>
                                  </select>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Probar Interpretación de Código EAN-13</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    maxLength={13}
                                    value={testBarcode}
                                    onChange={(e) => setTestBarcode(e.target.value)}
                                    placeholder="Ej: 2000105012504"
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-bold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const res = ScaleService.parseBarcode(testBarcode, scaleConfig.barcodeConfig);
                                      setTestBarcodeResult(res);
                                    }}
                                    className="bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
                                  >
                                    Probar Escaneo
                                  </button>
                                </div>

                                {testBarcodeResult && (
                                  <div className={`p-3 rounded-xl text-xs font-bold ${testBarcodeResult.isScaleBarcode ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                                    {testBarcodeResult.isScaleBarcode ? (
                                      <div>
                                        <p>✅ Código de Balanza Válido</p>
                                        <p className="font-mono text-[11px] mt-1">
                                          Código Producto (PLU): <strong>{testBarcodeResult.productCode}</strong> | {testBarcodeResult.valueType === 'WEIGHT_GRAMS' ? `Peso: ${testBarcodeResult.weightKg?.toFixed(3)} Kg` : `Precio Total: $${testBarcodeResult.pricePaid?.toLocaleString()}`}
                                        </p>
                                      </div>
                                    ) : (
                                      <p>❌ El código ingresado no cumple con el prefijo o formato de balanza configurado ({scaleConfig.barcodeConfig.prefix}).</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
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
                                navigate('/billing');
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
                                navigate('/billing');
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

                {activeSection === 'mercadopago' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <QrCode className="text-[#009EE3]" /> Configuración de Mercado Pago (Cobro QR)
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Conecta tu cuenta para enviar el total de cada venta automáticamente a tu QR físico o digital.
                        </p>
                      </div>
                      <span className="bg-[#009EE3]/10 text-[#009EE3] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-[#009EE3]/20">
                        QR Integrado
                      </span>
                    </div>

                    {/* Master Toggle */}
                    <Toggle 
                      label="Habilitar Cobro con QR Mercado Pago" 
                      description="Reemplaza la opción de Crédito por Pago con QR en el Punto de Venta."
                      checked={mpConfig.isActive}
                      onChange={(val: boolean) => updateMercadoPago({ isActive: val })}
                    />

                    {/* DIRECT LINKS BANNER */}
                    <div className="bg-gradient-to-br from-[#009EE3]/10 via-[#009EE3]/5 to-transparent p-6 rounded-3xl border border-[#009EE3]/20 space-y-4">
                      <div className="flex items-center gap-2 text-[#009EE3]">
                        <Sparkles size={18} />
                        <h4 className="font-black text-sm uppercase tracking-wider">Enlaces Directos de tu Cuenta</h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Haz clic en estos enlaces para abrir directamente tu Mercado Pago, copiar tus datos y pegarlos aquí:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <a 
                          href={MP_DIRECT_LINKS.credentials}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-[#009EE3]/30 hover:border-[#009EE3] hover:shadow-md transition-all group cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#009EE3] transition-colors">
                              1. Copiar mi Access Token
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Panel de Desarrolladores MP
                            </span>
                          </div>
                          <ExternalLink size={16} className="text-[#009EE3]" />
                        </a>

                        <a 
                          href={MP_DIRECT_LINKS.storesAndPos}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-[#009EE3]/30 hover:border-[#009EE3] hover:shadow-md transition-all group cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#009EE3] transition-colors">
                              2. Ver mis Cajas & Imprimir QR
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Locales y Cajas del Negocio
                            </span>
                          </div>
                          <ExternalLink size={16} className="text-[#009EE3]" />
                        </a>
                      </div>
                    </div>

                    {/* TOKEN CONFIGURATION */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                      <div>
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Access Token de Producción
                        </label>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Empieza con <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-[11px]">APP_USR-...</code>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            type={showToken ? 'text' : 'password'}
                            placeholder="APP_USR-0000000000000000-000000-..."
                            value={mpConfig.accessToken || ''}
                            onChange={(e) => updateMercadoPago({ accessToken: e.target.value.trim() })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-12 text-slate-900 dark:text-white text-sm font-mono outline-none focus:ring-2 focus:ring-[#009EE3]/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestAndLoadMP}
                          disabled={!mpConfig.accessToken}
                          className="bg-[#009EE3] hover:bg-[#0088c4] text-white px-5 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-[#009EE3]/20 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 size={16} />
                          Guardar Token
                        </button>
                      </div>

                      {/* Status Feedback Message */}
                      {mpStatusMessage && (
                        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                          mpStatusMessage.type === 'success' 
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                            : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20'
                        }`}>
                          {mpStatusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                          <span>{mpStatusMessage.text}</span>
                        </div>
                      )}
                    </div>

                    {/* POS / CAJA CONFIGURATION */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          Caja / Punto de Venta Vinculado (Opcional)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Usa el enlace directo de arriba (<strong>2. Ver mis Cajas</strong>) para ver el número o nombre de tu caja y colocarlo aquí.
                        </p>
                      </div>

                      {availablePosList.length > 0 ? (
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Seleccionar Caja:</label>
                          <select
                            value={mpConfig.posId || ''}
                            onChange={(e) => {
                              const selected = availablePosList.find(p => String(p.id) === e.target.value);
                              if (selected) {
                                updateMercadoPago({
                                  posId: String(selected.id),
                                  externalPosId: selected.external_id || String(selected.id),
                                  posName: selected.name,
                                  fixedQrData: selected.qr?.qr_code || '',
                                  fixedQrImage: selected.qr?.image || mpConfig.fixedQrImage || ''
                                });
                              }
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#009EE3]/20"
                          >
                            <option value="">-- Seleccionar caja detectada --</option>
                            {availablePosList.map(p => (
                              <option key={p.id} value={String(p.id)}>
                                {p.name} (ID: {p.id}{p.external_id ? ` - Cod: ${p.external_id}` : ''})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                            ID de Caja / POS ID
                          </label>
                          <input 
                            type="text" 
                            placeholder="Ej: 12345678"
                            value={mpConfig.posId || ''}
                            onChange={(e) => updateMercadoPago({ posId: e.target.value })}
                            className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                            Código Externo de Caja (Opcional)
                          </label>
                          <input 
                            type="text" 
                            placeholder="Ej: CAJA1 o CAJAPRINCIPAL"
                            value={mpConfig.externalPosId || ''}
                            onChange={(e) => updateMercadoPago({ externalPosId: e.target.value })}
                            className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* FIXED QR IMAGE OR LINK PREVIEW */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          Código QR de la Tienda (Respaldo en Pantalla)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Si tienes una foto o imagen de tu QR fijo de mostrador, puedes subirla aquí para que la app siempre tenga una copia lista.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        {mpConfig.fixedQrImage ? (
                          <div className="relative group bg-white p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <img 
                              src={mpConfig.fixedQrImage} 
                              alt="QR Mostrador" 
                              className="w-36 h-36 object-contain rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={() => updateMercadoPago({ fixedQrImage: '' })}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full text-xs shadow-md opacity-90 hover:opacity-100"
                              title="Eliminar imagen"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                            <QrCode size={36} className="opacity-40 mb-2" />
                            <span className="text-[10px] font-bold">Sin imagen cargada</span>
                          </div>
                        )}

                        <div className="flex-1 space-y-3">
                          <label className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#009EE3] text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all shadow-sm">
                            <Upload size={16} className="text-[#009EE3]" />
                            <span>Subir imagen o foto del QR</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleQrImageUpload} 
                              className="hidden" 
                            />
                          </label>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Formato recomendado: JPG o PNG. Si no subes una imagen, el sistema generará el QR dinámico automáticamente al cobrar.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* PLAN PRO BADGE NOTE */}
                    <div className="p-4 bg-indigo-50/60 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 flex items-start gap-3">
                      <Sparkles className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                      <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                        <p className="font-bold">Diferenciación por Plan:</p>
                        <p className="text-indigo-700 dark:text-indigo-300">
                          <strong>Plan Estándar:</strong> El cobro con QR está disponible en la pantalla del POS y funciona con el QR impreso en el mostrador.
                        </p>
                        <p className="text-indigo-700 dark:text-indigo-300">
                          <strong>Plan PRO:</strong> Además de lo anterior, el código QR y el total a pagar se proyectan en tiempo real en la <strong>Pantalla Cliente</strong> para que el cliente lo escanee directo desde la segunda pantalla.
                        </p>
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
