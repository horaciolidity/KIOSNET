import React from 'react';
import { 
  Monitor, 
  ShoppingCart, 
  CheckCircle2, 
  Lock
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { Link } from 'react-router-dom';

const CustomerDisplay: React.FC = () => {
  const { subscription, businessInfo } = useSettingsStore();
  const isPro = subscription.plan === 'PRO';

  const [displayData, setDisplayData] = React.useState<any>({
    cart: [],
    total: 0,
    paymentMethod: 'EFECTIVO',
    isWaitingForMP: false,
    change: 0,
    amountPaid: 0,
    isFinished: false
  });

  React.useEffect(() => {
    const channel = new BroadcastChannel('pos_display_channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'STATE_UPDATE') {
        setDisplayData(event.data);
      }
    };
    // Request current state from POS tab (if already open)
    channel.postMessage({ type: 'REQUEST_STATE' });

    return () => channel.close();
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-900 text-white p-8 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-white flex items-center gap-3">
            <Monitor className="text-blue-500" /> Pantalla Cliente
          </h1>
          <p className="text-slate-400 font-medium">Vista extendida para el cliente en mostrador.</p>
        </div>
        <div className="bg-slate-800 px-6 py-3 rounded-2xl font-black text-xl">
          {businessInfo.name}
        </div>
      </div>

      {displayData.isFinished ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95">
          <div className="w-32 h-32 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 size={64} />
          </div>
          <h1 className="text-6xl font-black text-white tracking-tight">¡Gracias por tu compra!</h1>
          <p className="text-2xl font-bold text-slate-400">Vuelve pronto a {businessInfo.name}</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-3 gap-8">
          <div className="col-span-2 bg-slate-800 rounded-[40px] p-8 flex flex-col">
            <h2 className="text-2xl font-black mb-6 text-slate-300">Tu Compra</h2>
            <div className="flex-1 space-y-4 overflow-y-auto pr-4 custom-scrollbar">
              {displayData.cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                  <ShoppingCart size={48} className="opacity-20" />
                  <p className="text-xl font-bold">Esperando productos...</p>
                </div>
              ) : (
                displayData.cart.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center text-2xl font-bold border-b border-slate-700 pb-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-4">
                      <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-xl text-lg">{item.quantity}x</span>
                      <span>{item.name}</span>
                    </div>
                    <span>${(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="bg-blue-600 rounded-[40px] p-8 flex flex-col justify-between shadow-2xl shadow-blue-600/20 transition-all">
            <div>
              <p className="text-blue-200 font-black uppercase tracking-widest mb-2">Total a Pagar</p>
              <h1 className="text-7xl font-black tracking-tighter">${displayData.total.toLocaleString()}</h1>
            </div>
            
            <div className="space-y-4 mt-8">
              {displayData.isWaitingForMP && displayData.paymentMethod === 'MERCADOPAGO' ? (
                <div className="bg-white p-6 rounded-[32px] text-center animate-in zoom-in-95">
                  <p className="font-black text-slate-900 mb-4 text-lg">Paga con Mercado Pago</p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://link.mercadopago.com.ar/qr_dinamico`} 
                    alt="QR MP" 
                    className="w-full h-auto rounded-xl shadow-sm"
                  />
                  <p className="text-blue-600 font-bold mt-4 animate-pulse">Esperando tu pago...</p>
                </div>
              ) : (
                displayData.paymentMethod === 'EFECTIVO' && Number(displayData.amountPaid) > 0 ? (
                  <div className="bg-white/10 p-6 rounded-[32px] space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between font-bold text-blue-100 text-lg">
                      <span>Paga con:</span>
                      <span>${Number(displayData.amountPaid).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-white/10 my-1"></div>
                    <div className="space-y-1 text-center py-4 bg-amber-500/20 rounded-2xl border border-amber-500/30">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Su Vuelto</p>
                      <h2 className="text-5xl font-black text-amber-400 tracking-tight">
                        ${displayData.change.toLocaleString()}
                      </h2>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/10 p-6 rounded-3xl flex items-center gap-4">
                    <ShoppingCart size={32} className="text-blue-200" />
                    <div>
                      <p className="font-bold text-lg">Total de la orden</p>
                      <p className="text-blue-200 text-sm">{displayData.cart.length} productos registrados</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRO Lock Screen Overlay */}
      {!isPro && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-slate-950/80">
          <div className="bg-slate-900 p-12 rounded-[48px] max-w-xl text-center shadow-2xl border border-indigo-500/30 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-indigo-500/20 text-indigo-400 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-500/20">
              <Lock size={48} />
            </div>
            <h2 className="text-4xl font-black text-white mb-4">Pantalla Extendida</h2>
            <p className="text-slate-400 text-lg font-medium mb-10 leading-relaxed">
              Muestra a tus clientes lo que están comprando en tiempo real en una segunda pantalla. Disponible solo en el <strong>Plan Pro</strong>.
            </p>
            <div className="space-y-4">
              <Link 
                to="/dashboard"
                className="w-full block bg-indigo-600 text-white py-5 rounded-[24px] font-black text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all"
              >
                Actualizar a PRO
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDisplay;
