import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  CreditCard, 
  Wallet, 
  Lock
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Link } from 'react-router-dom';

import { useCustomerStore } from '../store/useCustomerStore';
import { useCashStore } from '../store/useCashStore';

const Customers: React.FC = () => {
  const { user } = useAuthStore();
  const { customers, addCustomer, payDebt } = useCustomerStore();
  const { addTransaction } = useCashStore();
  
  const isPro = user?.subActive && user?.plan === 'PRO';
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Form states
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', document: '', limit: 10000 });
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'>('EFECTIVO');

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomer({ ...newCustomer, limit: Number(newCustomer.limit) });
    setIsAddModalOpen(false);
    setNewCustomer({ name: '', phone: '', document: '', limit: 10000 });
  };

  const handlePayDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(payAmount);
    if (amount <= 0 || amount > selectedCustomer.debt) return;
    
    payDebt(selectedCustomer.id, amount);
    addTransaction({
      type: 'PAGO_DEUDA',
      amount: amount,
      method: payMethod,
      description: `Pago de deuda - ${selectedCustomer.name}`
    });
    
    setIsPayModalOpen(false);
    setSelectedCustomer(null);
    setPayAmount('');
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const totalDebt = customers.reduce((acc, c) => acc + c.debt, 0);
  const totalLimit = customers.reduce((acc, c) => acc + c.limit, 0);


  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Clientes y Créditos <Users className="text-blue-600" />
          </h1>
          <p className="text-slate-500 font-medium">Gestiona cuentas corrientes y límites de crédito.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          disabled={!isPro}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl"><Users size={24}/></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Clientes</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{customers.length}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-500/10 text-orange-600 rounded-2xl"><CreditCard size={24}/></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Límite Otorgado</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">${totalLimit.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl"><Wallet size={24}/></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cobros Pendientes</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">${totalDebt.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3.5 px-12 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-medium"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-8 py-5">Cliente</th>
                <th className="px-8 py-5">Contacto</th>
                <th className="px-8 py-5 text-right">Deuda Actual</th>
                <th className="px-8 py-5 text-right">Límite</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-slate-400 font-bold">No hay clientes registrados.</td>
                </tr>
              )}
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-900 dark:text-white">{customer.name}</p>
                    <p className="text-xs text-slate-500">Última compra: {customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString() : 'Nunca'}</p>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-600 dark:text-slate-400">
                    {customer.phone}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`font-black text-lg ${customer.debt > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                      ${customer.debt.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right text-sm font-bold text-slate-500">
                    ${customer.limit.toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {customer.debt > 0 && (
                        <button 
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsPayModalOpen(true);
                          }}
                          disabled={!isPro} 
                          className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Cobrar Deuda
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRO Lock Screen Overlay */}
      {!isPro && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/40 rounded-3xl m-4">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] max-w-lg text-center shadow-2xl border border-indigo-100 dark:border-indigo-500/20 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/10">
              <Lock size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Función Premium</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              La gestión de Créditos de Clientes y Cuentas Corrientes está disponible únicamente en el <strong>Plan Pro</strong>.
            </p>
            <div className="space-y-4">
              <Link 
                to="/dashboard"
                className="w-full block bg-indigo-600 text-white py-4 rounded-[24px] font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all"
              >
                Actualizar a PRO
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Nuevo Cliente</h2>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Nombre Completo</label>
                <input required type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Teléfono</label>
                <input required type="text" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Documento / CUIT</label>
                <input type="text" value={newCustomer.document} onChange={e => setNewCustomer({...newCustomer, document: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Límite de Crédito ($)</label>
                <input required type="number" min="0" value={newCustomer.limit} onChange={e => setNewCustomer({...newCustomer, limit: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Debt Modal */}
      {isPayModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Cobrar Deuda</h2>
            <p className="text-slate-500 mb-6">Cliente: <span className="font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</span></p>
            
            <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-2xl mb-6">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">Deuda Total</p>
              <h3 className="text-3xl font-black text-orange-600">${selectedCustomer.debt.toLocaleString()}</h3>
            </div>

            <form onSubmit={handlePayDebt} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Monto a Pagar ($)</label>
                <input required type="number" max={selectedCustomer.debt} min="1" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 text-xl font-bold" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Método de Pago</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500/50">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="DEBITO">Débito</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsPayModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl">Cancelar</button>
                <button type="submit" className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600">Registrar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
