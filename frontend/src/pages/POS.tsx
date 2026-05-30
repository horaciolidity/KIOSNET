import React, { useState } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  UserPlus,
  ScanBarcode,
  X,
  Printer,
  Download,
  CheckCircle2,
  SendHorizontal,
  AlertCircle,
  QrCode,
  Loader2
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import type { Product, ProductCategory } from '../store/useInventoryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useCashStore } from '../store/useCashStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../utils/supabaseClient';
import axios from 'axios';

interface CartItem extends Product {
  quantity: number;
}

const CATEGORY_EMOJIS: Record<ProductCategory, string> = {
  'Lacteos': '🥛',
  'Panaderia': '🥐',
  'Bebidas': '🥤',
  'Cigarrillos': '🚬',
  'Fiambreria': '🍖',
  'Otros': '📦'
};

const POS: React.FC = () => {
  const { products } = useInventoryStore();
  const { businessInfo } = useSettingsStore();
  const { session, addTransaction } = useCashStore();
  const { customers } = useCustomerStore();
  const { user } = useAuthStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todos'>('Todos');
  
  const activePlan = user?.subActive ? user?.plan : 'FREE';
  const isPro = activePlan === 'PRO';
  const isStandardOrPro = activePlan === 'STANDARD' || activePlan === 'PRO';
  const hasMP = isPro && businessInfo?.mercadoPago?.isActive;

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Checkout State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO' | 'CREDITO' | 'CUENTA_CORRIENTE' | 'MERCADOPAGO'>('EFECTIVO');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [note, setNote] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [saleId, setSaleId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isWaitingForMP, setIsWaitingForMP] = useState(false);
  const [mpInitPoint, setMpInitPoint] = useState<string>('');
  const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    if (!session.isOpen) {
      alert('Debes abrir la caja primero');
      return;
    }
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        return prevCart.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        const step = item.unit === 'UNIDAD' ? 1 : 0.1;
        const newQty = Math.max(step, item.quantity + (delta * step));
        return { ...item, quantity: parseFloat(newQty.toFixed(3)) };
      }
      return item;
    }));
  };

  const updateQuantityDirect = (productId: string, qty: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: parseFloat(Math.max(0.001, qty).toFixed(3)) };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalCost = cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const profit = total - totalCost;
  const change = Number(amountPaid) > 0 ? Number(amountPaid) - total : 0;

  React.useEffect(() => {
    broadcastChannelRef.current = new BroadcastChannel('pos_display_channel');
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  React.useEffect(() => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'STATE_UPDATE',
        cart,
        total,
        paymentMethod,
        isWaitingForMP,
        change,
        amountPaid,
        isFinished
      });
    }
  }, [cart, total, paymentMethod, isWaitingForMP, change, amountPaid, isFinished]);

  // Handle request for state from newly opened display tab
  React.useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'REQUEST_STATE' && broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'STATE_UPDATE',
          cart,
          total,
          paymentMethod,
          isWaitingForMP,
          change,
          amountPaid,
          isFinished
        });
      }
    };
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.addEventListener('message', handleMessage);
      return () => broadcastChannelRef.current?.removeEventListener('message', handleMessage);
    }
  }, [cart, total, paymentMethod, isWaitingForMP, change, amountPaid, isFinished]);

  const finalizeTransaction = async () => {
    if (!user) {
      alert('Debe iniciar sesión para realizar ventas.');
      return;
    }

    try {
      // 1. Verify billing limits (max 50 sales for free tier)
      const { count: salesCount } = await supabase
        .from('Sale')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', user.tenantId);

      if (!user.subActive && salesCount !== null && salesCount >= 50) {
        alert('Límite de ventas gratuitas (50 ventas) alcanzado. Por favor, activa tu suscripción en Configuración para continuar.');
        return;
      }

      const newSaleId = crypto.randomUUID();

      // 2. Create the sale in Supabase
      const { error: saleErr } = await supabase
        .from('Sale')
        .insert({
          id: newSaleId,
          total: Number(total),
          subtotal: Number(total),
          discount: 0,
          paymentMethod: paymentMethod === 'EFECTIVO' ? 'CASH' : paymentMethod === 'CUENTA_CORRIENTE' ? 'CREDIT' : 'TRANSFER',
          customerId: selectedCustomerId || null,
          sellerId: user.id,
          tenantId: user.tenantId,
          receivedAmount: Number(amountPaid) || total,
          changeAmount: change,
          status: 'COMPLETED'
        });

      if (saleErr) throw saleErr;

      // 3. Create sale items
      const { error: itemsErr } = await supabase
        .from('SaleItem')
        .insert(cart.map(item => ({
          saleId: newSaleId,
          productId: item.id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          costPrice: Number(item.costPrice)
        })));

      if (itemsErr) throw itemsErr;

      // 4. Decrement physical stock for each product
      for (const item of cart) {
        const { data: prod } = await supabase
          .from('Product')
          .select('stock')
          .eq('id', item.id)
          .single();

        const currentStock = prod?.stock || 0;
        await supabase
          .from('Product')
          .update({ stock: currentStock - item.quantity })
          .eq('id', item.id);
      }

      // 5. Update customer balance if fia (CREDIT)
      if (paymentMethod === 'CUENTA_CORRIENTE' && selectedCustomerId) {
        const { data: cust } = await supabase
          .from('Customer')
          .select('balance')
          .eq('id', selectedCustomerId)
          .single();

        const currentBalance = cust?.balance || 0;
        await supabase
          .from('Customer')
          .update({ balance: currentBalance + total })
          .eq('id', selectedCustomerId);
      }

      const customer = customers.find(c => c.id === selectedCustomerId);
      const customerName = customer ? customer.name : '';

      addTransaction({
        type: 'VENTA',
        amount: total,
        profit: profit,
        method: paymentMethod === 'MERCADOPAGO' ? 'TRANSFERENCIA' as any : paymentMethod as any,
        description: `Venta ${newSaleId} ${customerName ? `(Cliente: ${customerName})` : ''} ${note ? '- ' + note : ''}`,
        details: {
          items: cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            category: item.category
          })),
          saleId: newSaleId,
          note: note,
          customerId: selectedCustomerId
        }
      });

      // Reload products and customers to ensure stock levels and balances are 100% correct in UI!
      useInventoryStore.getState().fetchProducts();
      useCustomerStore.getState().fetchCustomers();

      setSaleId(newSaleId);
      setIsFinished(true);
      setIsWaitingForMP(false);
      
      // Dynamic database-backed salesCount increment
      const currentAuth = useAuthStore.getState();
      if (currentAuth.user) {
        currentAuth.setAuth({
          ...currentAuth.user,
          salesCount: (currentAuth.user.salesCount || 0) + 1
        }, currentAuth.token || '');
      }
      
      useSettingsStore.getState().incrementSales();
    } catch (error: any) {
      console.error('Error finalizando la venta:', error);
      alert(`Hubo un error al procesar la venta: ${error.message || 'Error inesperado'}`);
    }
  };

  const handleFinishSale = async () => {
    if (paymentMethod === 'CUENTA_CORRIENTE' && !selectedCustomerId) {
      alert('Debes seleccionar un cliente para cobrar con Cuenta Corriente.');
      return;
    }

    if (!user) {
      alert('Debe iniciar sesión para realizar ventas.');
      return;
    }

    if (paymentMethod === 'MERCADOPAGO') {
      setIsWaitingForMP(true);
      try {
        const pendingSaleId = crypto.randomUUID();

        // 1. Create pending sale in DB
        const { error: saleErr } = await supabase
          .from('Sale')
          .insert({
            id: pendingSaleId,
            total: Number(total),
            subtotal: Number(total),
            discount: 0,
            paymentMethod: 'TRANSFER',
            customerId: selectedCustomerId || null,
            sellerId: user.id,
            tenantId: user.tenantId,
            receivedAmount: total,
            changeAmount: 0,
            status: 'PENDING'
          });

        if (saleErr) throw saleErr;

        // 2. Request Mercado Pago Checkout preference directly
        const token = businessInfo?.mercadoPago?.accessToken || 'APP_USR-4849164774633719-051714-00b8cfd0d13fdaf15a8646fe8447a2cc-345296566';
        const mpResponse = await axios.post(
          'https://api.mercadopago.com/checkout/preferences',
          {
            items: cart.map(item => ({
              id: item.id,
              title: item.name,
              quantity: Number(item.quantity),
              unit_price: Number(item.price),
              currency_id: 'ARS'
            })),
            external_reference: pendingSaleId
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const initPoint = mpResponse.data.init_point;
        setSaleId(pendingSaleId);
        setMpInitPoint(initPoint);

        // 3. Poll Mercado Pago API directly to check if the payment is approved
        const pollInterval = setInterval(async () => {
          try {
            const mpSearchResponse = await axios.get(
              `https://api.mercadopago.com/v1/payments/search?external_reference=${pendingSaleId}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );

            const approvedPayment = mpSearchResponse.data.results?.find((p: any) => p.status === 'approved');
            if (approvedPayment) {
              clearInterval(pollInterval);

              // 4. Mark sale as completed in Supabase
              await supabase
                .from('Sale')
                .update({ status: 'COMPLETED' })
                .eq('id', pendingSaleId);

              // 5. Create sale items
              await supabase
                .from('SaleItem')
                .insert(cart.map(item => ({
                  saleId: pendingSaleId,
                  productId: item.id,
                  quantity: Number(item.quantity),
                  price: Number(item.price),
                  costPrice: Number(item.costPrice)
                })));

              // 6. Decrement physical stock
              for (const item of cart) {
                const { data: prod } = await supabase
                  .from('Product')
                  .select('stock')
                  .eq('id', item.id)
                  .single();

                const currentStock = prod?.stock || 0;
                await supabase
                  .from('Product')
                  .update({ stock: currentStock - item.quantity })
                  .eq('id', item.id);
              }
              
              // Refresh stores
              useInventoryStore.getState().fetchProducts();
              useCustomerStore.getState().fetchCustomers();

              // Register local cash transaction
              const customer = customers.find(c => c.id === selectedCustomerId);
              const customerName = customer ? customer.name : '';

              addTransaction({
                type: 'VENTA',
                amount: total,
                profit: profit,
                method: 'TRANSFERENCIA',
                description: `Venta MP QR ${pendingSaleId} ${customerName ? `(Cliente: ${customerName})` : ''} ${note ? '- ' + note : ''}`,
                details: {
                  items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    category: item.category
                  })),
                  saleId: pendingSaleId,
                  note: 'Aprobado vía Consulta Directa a Mercado Pago',
                  customerId: selectedCustomerId
                }
              });

              setIsFinished(true);
              setIsWaitingForMP(false);
              setMpInitPoint('');
              useSettingsStore.getState().incrementSales();
            }
          } catch (err) {
            console.error('Error polling status from Mercado Pago:', err);
          }
        }, 2000);

        // Store poll interval globally to clear it later
        (window as any).mpPollInterval = pollInterval;

      } catch (error: any) {
        console.error('Error starting Mercado Pago transaction:', error);
        alert('Hubo un error al conectar con Mercado Pago. Intente nuevamente.');
        setIsWaitingForMP(false);
      }
    } else {
      finalizeTransaction();
    }
  };

  const resetPOS = () => {
    if ((window as any).mpPollInterval) {
      clearInterval((window as any).mpPollInterval);
      (window as any).mpPollInterval = null;
    }
    setCart([]);
    setIsCheckoutOpen(false);
    setIsFinished(false);
    setAmountPaid('');
    setNote('');
    setSaleId('');
    setSelectedCustomerId('');
    setMpInitPoint('');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950 print:bg-white relative">
      {/* Print-only Ticket Wrapper */}
      <div className="hidden print:block print:absolute print:inset-0 print:z-[200] bg-white p-4 w-[80mm] mx-auto text-black font-mono text-[10pt]">
        <div className="text-center border-b border-black pb-4 mb-4">
          <p className="font-bold text-lg uppercase">{businessInfo?.name || 'Comercio'}</p>
          <p className="text-sm">{businessInfo?.address}</p>
          <p className="text-sm">CUIT: {businessInfo?.taxId}</p>
          <p className="text-sm">Tel: {businessInfo?.phone}</p>
          <p className="text-sm">{businessInfo?.email}</p>
          {selectedCustomerId && (
            <p className="text-sm mt-1 font-bold">Cliente: {customers.find(c => c.id === selectedCustomerId)?.name}</p>
          )}
          <p className="mt-2 text-xs font-bold">Venta: {saleId}</p>
          <p className="text-xs">{new Date().toLocaleString()}</p>
        </div>
        <div className="space-y-1 mb-4">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.name.substring(0, 22)}</span>
              <span>${(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-black pt-2 space-y-1">
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>${total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>PAGO ({paymentMethod})</span>
            <span>${Number(amountPaid) || total}</span>
          </div>
          {paymentMethod === 'EFECTIVO' && (
            <div className="flex justify-between font-bold">
              <span>VUELTO</span>
              <span>${change.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="text-center mt-6 pt-4 border-t border-black italic text-sm">
          <p>¡Gracias por su compra!</p>
          <p>Conserve su ticket</p>
        </div>
      </div>

      {/* Screen View */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800 print:hidden">
        {!session.isOpen && (
          <div className="absolute inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <div className="bg-white dark:bg-slate-900 p-12 rounded-[48px] shadow-2xl max-w-md space-y-6 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-500/20 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={40} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Caja Cerrada</h2>
              <p className="text-slate-500 font-medium">Debes realizar la apertura de caja para comenzar a realizar ventas.</p>
              <button 
                onClick={() => window.location.href = '/cash'}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
              >
                IR A CAJA
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Escanear código o buscar producto..." 
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-12 text-lg font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute right-4 top-3.5 p-1 bg-blue-600 rounded-lg text-white">
              <ScanBarcode size={20} />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <CategoryTab 
              label="Todos" 
              active={selectedCategory === 'Todos'} 
              onClick={() => setSelectedCategory('Todos')} 
            />
            {(Object.keys(CATEGORY_EMOJIS) as ProductCategory[]).map(cat => (
              <CategoryTab 
                key={cat}
                label={cat} 
                emoji={CATEGORY_EMOJIS[cat]}
                active={selectedCategory === cat} 
                onClick={() => setSelectedCategory(cat)} 
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`bg-white dark:bg-slate-900 p-4 rounded-[32px] border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:shadow-xl transition-all text-left group relative overflow-hidden ${product.stock <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl mb-4">
                  {CATEGORY_EMOJIS[product.category]}
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 h-10 mb-2 leading-tight">
                  {product.name}
                </h3>
                <p className="text-xl font-black text-blue-600">
                  ${product.price.toLocaleString()}
                  <span className="text-xs text-slate-400 font-medium ml-1">
                    / {product.unit === 'KILO' ? 'Kg' : product.unit === 'LITRO' ? 'L' : 'Ud'}
                  </span>
                </p>
                {product.stock <= product.minStock && (
                  <span className="absolute top-4 right-4 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Side */}
      <div className="hidden md:flex w-[420px] bg-white dark:bg-slate-900 flex flex-col shadow-2xl z-10 print:hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart size={24} className="text-blue-600" /> Venta Actual
          </h2>
          <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 px-3 py-1 rounded-full text-xs font-black">
            {cart.length} ITEMS
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 space-y-4">
              <ShoppingCart size={64} strokeWidth={1} />
              <p className="font-bold text-lg text-slate-400">Escanee productos para empezar</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {CATEGORY_EMOJIS[item.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate text-sm">{item.name}</p>
                  <p className="text-slate-400 text-xs font-semibold">
                    {item.unit === 'KILO' 
                      ? `${Math.round(item.quantity * 1000)}g x $${item.price.toLocaleString()}/Kg` 
                      : item.unit === 'LITRO' 
                        ? `${Math.round(item.quantity * 1000)}cc x $${item.price.toLocaleString()}/L` 
                        : `${item.quantity} Ud x $${item.price.toLocaleString()}/Ud`
                    }
                  </p>
                  <p className="text-blue-600 font-black text-sm">${(item.price * item.quantity).toLocaleString()}</p>
                </div>
                {item.unit === 'KILO' || item.unit === 'LITRO' ? (
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <input 
                      type="number"
                      min="1"
                      step="10"
                      value={Math.round(item.quantity * 1000)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateQuantityDirect(item.id, val / 1000);
                      }}
                      className="w-16 bg-transparent text-right font-black text-sm outline-none border-b border-dashed border-slate-300 focus:border-blue-500"
                    />
                    <span className="text-[10px] font-bold text-slate-400 pr-1">
                      {item.unit === 'KILO' ? 'g' : 'cc'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-slate-400 hover:text-blue-600"><Minus size={16} /></button>
                    <input 
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        updateQuantityDirect(item.id, Math.max(1, val));
                      }}
                      className="w-8 bg-transparent text-center font-black text-sm outline-none"
                    />
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-slate-400 hover:text-blue-600"><Plus size={16} /></button>
                  </div>
                )}
                <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex justify-between items-center text-slate-900 dark:text-white">
            <span className="text-lg font-black">TOTAL</span>
            <span className="text-3xl font-black text-blue-600 tracking-tighter">${total.toLocaleString()}</span>
          </div>

          {!user?.subActive && (user?.salesCount ?? 0) >= 50 ? (
            <button 
              onClick={() => window.location.href = '/billing'}
              className="w-full bg-gradient-to-r from-red-600 to-amber-600 text-white py-5 rounded-[24px] font-black text-lg hover:from-red-500 hover:to-amber-500 transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-2"
            >
              VENTAS BLOQUEADAS (ACTIVA PLAN)
            </button>
          ) : (
            <button 
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
            >
              PAGAR AHORA
            </button>
          )}
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-5">
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-between px-6 py-4 rounded-2xl font-black text-base shadow-xl shadow-blue-600/30 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-100 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-200"></span>
              </span>
              <span className="uppercase tracking-wider">Ver Carrito ({cart.length})</span>
            </div>
            <span className="text-xl tracking-tight">${total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-950/60 backdrop-blur-sm flex justify-end transition-opacity duration-300">
          <div className="w-full max-w-[420px] bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart size={24} className="text-blue-600" /> Venta Actual
              </h2>
              <button 
                onClick={() => setIsMobileCartOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-sm">
                    {CATEGORY_EMOJIS[item.category]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate text-sm">{item.name}</p>
                    <p className="text-slate-400 text-xs font-semibold">
                      {item.unit === 'KILO' 
                        ? `${Math.round(item.quantity * 1000)}g x $${item.price.toLocaleString()}/Kg` 
                        : item.unit === 'LITRO' 
                          ? `${Math.round(item.quantity * 1000)}cc x $${item.price.toLocaleString()}/L` 
                          : `${item.quantity} Ud x $${item.price.toLocaleString()}/Ud`
                      }
                    </p>
                    <p className="text-blue-600 font-black text-sm">${(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                  {item.unit === 'KILO' || item.unit === 'LITRO' ? (
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <input 
                        type="number"
                        min="1"
                        step="10"
                        value={Math.round(item.quantity * 1000)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateQuantityDirect(item.id, val / 1000);
                        }}
                        className="w-16 bg-transparent text-right font-black text-sm outline-none border-b border-dashed border-slate-300 focus:border-blue-500"
                      />
                      <span className="text-[10px] font-bold text-slate-400 pr-1">
                        {item.unit === 'KILO' ? 'g' : 'cc'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-slate-400 hover:text-blue-600"><Minus size={16} /></button>
                      <input 
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1;
                          updateQuantityDirect(item.id, Math.max(1, val));
                        }}
                        className="w-8 bg-transparent text-center font-black text-sm outline-none"
                      />
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-slate-400 hover:text-blue-600"><Plus size={16} /></button>
                    </div>
                  )}
                  <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 space-y-4 pb-24">
              <div className="flex justify-between items-center text-slate-900 dark:text-white">
                <span className="text-lg font-black">TOTAL</span>
                <span className="text-3xl font-black text-blue-600 tracking-tighter">${total.toLocaleString()}</span>
              </div>

              {!user?.subActive && (user?.salesCount ?? 0) >= 50 ? (
                <button 
                  onClick={() => window.location.href = '/billing'}
                  className="w-full bg-gradient-to-r from-red-600 to-amber-600 text-white py-5 rounded-[24px] font-black text-lg hover:from-red-500 hover:to-amber-500 transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  VENTAS BLOQUEADAS (ACTIVA PLAN)
                </button>
              ) : (
                <button 
                  disabled={cart.length === 0}
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  PAGAR AHORA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            {!isFinished && !isWaitingForMP ? (
              <>
                <div className="flex-1 p-8 space-y-8 overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Finalizar Venta</h2>
                    <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={24}/></button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <PaymentMethodBtn active={paymentMethod === 'EFECTIVO'} onClick={() => setPaymentMethod('EFECTIVO')} icon={<Banknote size={24}/>} label="Efectivo" />
                    <PaymentMethodBtn active={paymentMethod === 'TRANSFERENCIA'} onClick={() => setPaymentMethod('TRANSFERENCIA')} icon={<SendHorizontal size={24}/>} label="Transf." />
                    <PaymentMethodBtn active={paymentMethod === 'DEBITO'} onClick={() => setPaymentMethod('DEBITO')} icon={<CreditCard size={24}/>} label="Débito" />
                    <PaymentMethodBtn active={paymentMethod === 'CREDITO'} onClick={() => setPaymentMethod('CREDITO')} icon={<CreditCard size={24}/>} label="Crédito" />
                    {isStandardOrPro && (
                      <PaymentMethodBtn active={paymentMethod === 'CUENTA_CORRIENTE'} onClick={() => setPaymentMethod('CUENTA_CORRIENTE')} icon={<UserPlus size={24}/>} label="Cta. Cte" />
                    )}
                    {hasMP && (
                      <PaymentMethodBtn active={paymentMethod === 'MERCADOPAGO'} onClick={() => setPaymentMethod('MERCADOPAGO')} icon={<QrCode size={24}/>} label="QR MP" />
                    )}
                  </div>

                  {paymentMethod === 'MERCADOPAGO' && (
                    <div className="bg-[#009EE3]/10 p-6 rounded-[32px] border border-[#009EE3]/20 space-y-4">
                      <p className="text-xs font-black uppercase tracking-widest text-[#009EE3]">Pago con QR Dinámico</p>
                      <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">Al confirmar, el total a cobrar se enviará automáticamente a tu lector QR de Mercado Pago. Espera a que el cliente escanee y pague.</p>
                    </div>
                  )}

                  {paymentMethod === 'CUENTA_CORRIENTE' && (
                    <div className="bg-orange-50 dark:bg-orange-500/10 p-6 rounded-[32px] border border-orange-100 dark:border-orange-500/20 space-y-4">
                      <p className="text-xs font-black uppercase tracking-widest text-orange-600">Cobro con Cuenta Corriente (Fiado)</p>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Seleccionar Cliente:</label>
                        <select 
                          value={selectedCustomerId} 
                          onChange={(e) => setSelectedCustomerId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 font-bold outline-none focus:border-orange-500 text-slate-900 dark:text-white"
                        >
                          <option value="">-- Elija un cliente --</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name} (Límite disp: ${Math.max(0, c.limit - c.debt).toLocaleString()})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'EFECTIVO' && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 space-y-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cálculo de Vuelto</p>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Paga con:</label>
                          <div className="relative">
                            <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                            <input type="number" autoFocus className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-8 pr-4 font-black text-xl outline-none focus:border-blue-500" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-600 dark:text-slate-300">Vuelto:</label>
                          <div className={`text-3xl font-black ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${change.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1">Novedades / Nota (Opcional)</label>
                    <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/10 min-h-[100px]" placeholder="Ej: Cliente habitual, pago pendiente de $10, etc..." value={note} onChange={(e) => setNote(e.target.value)}></textarea>
                  </div>
                </div>
                <div className="w-full md:w-[320px] bg-slate-50 dark:bg-slate-800/30 p-8 border-l border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Resumen</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-slate-500"><span>Total Productos</span><span className="font-bold text-slate-900 dark:text-white">{cart.length}</span></div>
                      <div className="flex justify-between text-sm text-slate-500"><span>Método</span><span className="font-bold text-blue-600">{paymentMethod}</span></div>
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center"><span className="text-lg font-black text-slate-900 dark:text-white leading-none">A PAGAR</span><span className="text-3xl font-black text-blue-600">${total.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <button onClick={handleFinishSale} disabled={paymentMethod === 'EFECTIVO' && (Number(amountPaid) < total)} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-xl hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50">CONFIRMAR</button>
                </div>
              </>
            ) : isWaitingForMP ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6 bg-slate-900 text-white min-h-[500px]">
                <h2 className="text-3xl font-black text-[#009EE3] flex items-center gap-2">
                  <QrCode size={36} /> Mercado Pago
                </h2>
                <div className="bg-white p-4 rounded-3xl shadow-xl animate-in zoom-in-95 duration-300">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mpInitPoint)}`} 
                    alt="QR Mercado Pago" 
                    className="w-[220px] h-[220px]"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Escanee para Pagar</h3>
                  <p className="text-slate-400 text-sm max-w-xs mx-auto">Escanea el código QR dinámico desde la App de Mercado Pago o tu banco para completar el pago de <strong>${total.toLocaleString()}</strong>.</p>
                </div>
                <div className="flex items-center gap-3 text-slate-300 bg-white/5 px-6 py-3 rounded-full text-sm font-bold">
                  <Loader2 className="animate-spin text-[#009EE3]" size={18} />
                  Aguardando confirmación de pago...
                </div>
                <button 
                  onClick={resetPOS}
                  className="text-red-400 hover:text-red-300 font-bold text-sm underline pt-2"
                >
                  Cancelar Pago
                </button>
                <div className="border-t border-white/5 my-2 pt-4 w-full max-w-xs"></div>
                <a
                  href={`https://wa.me/5492617048835?text=${encodeURIComponent(`Hola! Tengo un inconveniente con el cobro de una venta de $${total.toLocaleString()} (Venta ID: ${saleId}) en KIOSNET.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold transition-all uppercase tracking-wider w-full max-w-xs cursor-pointer"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.835-1.921c1.554.922 3.19 1.408 4.887 1.409 5.864 0 10.635-4.757 10.638-10.613.002-2.836-1.1-5.503-3.102-7.51-2.003-2.008-4.667-3.112-7.502-3.113-5.869 0-10.64 4.757-10.643 10.615-.001 1.83.488 3.619 1.417 5.176L1.83 22.097l5.062-1.849zm12.015-8.18c-.31-.156-1.839-.908-2.11-.1-.271.1-.387.417-.474.517-.087.1-.175.111-.486-.044-.31-.156-1.31-.483-2.495-1.54-.922-.822-1.543-1.838-1.724-2.15-.18-.31-.019-.478.136-.633.14-.139.31-.361.466-.543.156-.183.208-.313.31-.522.104-.21.052-.392-.026-.549-.078-.156-.685-1.651-.938-2.26-.247-.594-.499-.514-.685-.523-.175-.009-.377-.01-.58-.01a1.116 1.116 0 00-.809.378c-.277.311-1.057 1.033-1.057 2.52 0 1.487 1.082 2.922 1.232 3.122.15.2.2.13 1.134 3.013.9.78 1.637 1.543 2.5 1.868.863.325 1.653.24 2.273.15.688-.1 1.839-.751 2.1-.1.26.65.26 1.205.13 1.438-.13.233-.387.35-.698.506z"/>
                  </svg>
                  Reportar error por WhatsApp
                </a>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 animate-in zoom-in-95 duration-300 overflow-y-auto">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20"><CheckCircle2 size={48} /></div>
                <div><h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">¡Venta Exitosa!</h2><p className="text-slate-500 font-medium">La transacción se ha registrado correctamente.</p></div>
                <div className="w-full max-w-[320px] bg-slate-50 dark:bg-slate-800 p-6 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700 font-mono text-left text-xs text-slate-600 dark:text-slate-400 space-y-4">
                  <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-4">
                    <p className="font-black text-slate-900 dark:text-white text-base uppercase">{businessInfo?.name || 'Comercio'}</p>
                    <p>{businessInfo?.address}</p>
                    <p>CUIT: {businessInfo?.taxId}</p>
                    <p>Tel: {businessInfo?.phone}</p>
                    <p>{businessInfo?.email}</p>
                    {selectedCustomerId && (
                      <p className="font-bold mt-1 text-slate-800 dark:text-slate-200">Cliente: {customers.find(c => c.id === selectedCustomerId)?.name}</p>
                    )}
                    <p className="mt-2 opacity-75">ID: {saleId}</p>
                  </div>
                  <div className="space-y-1">{cart.map(item => (<div key={item.id} className="flex justify-between"><span>{item.quantity}x {item.name.substring(0, 20)}</span><span>${(item.price * item.quantity).toLocaleString()}</span></div>))}</div>
                  <div className="border-t border-dashed border-slate-300 pt-4 space-y-2"><div className="flex justify-between font-black text-slate-900 dark:text-white text-sm"><span>TOTAL</span><span>${total.toLocaleString()}</span></div><div className="flex justify-between"><span>PAGO ({paymentMethod})</span><span>${Number(amountPaid) || total}</span></div>{paymentMethod === 'EFECTIVO' && (<div className="flex justify-between text-emerald-600 font-bold"><span>VUELTO</span><span>${change.toLocaleString()}</span></div>)}</div>
                  <div className="text-center pt-4 opacity-50"><p>¡Gracias por su compra!</p><p>{new Date().toLocaleString()}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full max-sm">
                  <button onClick={handlePrint} className="flex items-center justify-center gap-2 bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 transition-all"><Printer size={18} /> Ticket 80mm</button>
                  <button onClick={handlePrint} className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-900 p-4 rounded-2xl font-bold hover:bg-slate-50 transition-all"><Download size={18} /> Guardar PDF</button>
                </div>
                <button onClick={resetPOS} className="text-blue-600 font-black hover:underline">NUEVA VENTA</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryTab = ({ label, emoji, active, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all border ${active ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-blue-500'}`}>{emoji && <span>{emoji}</span>}{label}</button>
);

const PaymentMethodBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-[32px] border-2 transition-all ${active ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/20 scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500 hover:border-blue-300'}`}>{icon}<span className="font-bold text-sm">{label}</span></button>
);

export default POS;
