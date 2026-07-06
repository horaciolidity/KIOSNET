import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit3, 
  Trash2, 
  X, 
  Save, 
  AlertCircle,
  ScanBarcode
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import type { Product, ProductCategory, ProductUnit } from '../store/useInventoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

const CATEGORIES: ProductCategory[] = ['Lacteos', 'Panaderia', 'Bebidas', 'Cigarrillos', 'Fiambreria', 'Otros'];
const UNITS: ProductUnit[] = ['UNIDAD', 'KILO', 'LITRO'];

const Inventory: React.FC = () => {
  const { user } = useAuthStore();
  const { security } = useSettingsStore();
  const { products, addProduct, updateProduct, deleteProduct } = useInventoryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const isEmployee = user?.role === 'EMPLOYEE' && (security?.employeeBlockInventory ?? true);

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  // Form State (Using strings for numbers to allow empty inputs)
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price: '' as string | number,
    costPrice: '' as string | number,
    stock: '' as string | number,
    minStock: '' as string | number,
    unit: 'UNIDAD' as ProductUnit,
    category: 'Otros' as ProductCategory,
    active: true,
    wholesalePrice: '' as string | number,
    wholesaleMinQty: '' as string | number,
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode.includes(searchTerm)
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      barcode: '',
      price: '',
      costPrice: '',
      stock: '',
      minStock: '5',
      unit: 'UNIDAD',
      category: 'Otros',
      active: true,
      wholesalePrice: '',
      wholesaleMinQty: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode,
      price: product.price.toString(),
      costPrice: product.costPrice.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      unit: product.unit,
      category: product.category,
      active: product.active,
      wholesalePrice: product.wholesalePrice !== undefined && product.wholesalePrice !== null ? product.wholesalePrice.toString() : '',
      wholesaleMinQty: product.wholesaleMinQty !== undefined && product.wholesaleMinQty !== null ? product.wholesaleMinQty.toString() : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalData = {
      ...formData,
      price: Number(formData.price) || 0,
      costPrice: Number(formData.costPrice) || 0,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
      wholesalePrice: formData.wholesalePrice !== '' ? Number(formData.wholesalePrice) : null,
      wholesaleMinQty: formData.wholesaleMinQty !== '' ? Number(formData.wholesaleMinQty) : null,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, finalData);
    } else {
      addProduct(finalData);
    }
    setIsModalOpen(false);
  };

  const exportToCSV = () => {
    const headers = ['Nombre,Código,Categoría,Unidad,Costo,Precio,Stock,Mínimo\n'];
    const rows = products.map(p => 
      `${p.name},${p.barcode},${p.category},${p.unit},${p.costPrice},${p.price},${p.stock},${p.minStock}`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const exportToTXT = () => {
    const content = products.map(p => 
      `PRODUCTO: ${p.name} | CÓDIGO: ${p.barcode} | STOCK: ${p.stock} | PRECIO: $${p.price}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_${new Date().toLocaleDateString()}.txt`;
    link.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [name, barcode, category, unit, costPrice, price, stock, minStock] = line.split(',');

        if (name) {
          const existingProduct = products.find(p => p.barcode === barcode && barcode !== '');
          
          const productData = {
            name: name || 'Sin Nombre',
            barcode: barcode || '',
            category: (CATEGORIES.includes(category as any) ? category : 'Otros') as ProductCategory,
            unit: (UNITS.includes(unit as any) ? unit : 'UNIDAD') as ProductUnit,
            costPrice: Number(costPrice) || 0,
            price: Number(price) || 0,
            stock: Number(stock) || 0,
            minStock: Number(minStock) || 0,
            active: true
          };

          if (existingProduct) {
            updateProduct(existingProduct.id, productData);
          } else {
            addProduct(productData);
          }
        }
      }
      alert('Importación completada con éxito');
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Inventario</h1>
          <p className="text-slate-500 dark:text-slate-400">Total de productos: {products.length}</p>
        </div>
        {!isEmployee && (
          <div className="flex gap-3">
            <label className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-all">
              <Plus size={16} className="text-blue-600" /> Importar
              <input type="file" className="hidden" accept=".csv,.txt" onChange={handleImport} />
            </label>
            <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-r border-slate-200 dark:border-slate-800"
              >
                <Download size={16} /> Excel
              </button>
              <button 
                onClick={exportToTXT}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                TXT
              </button>
            </div>
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus size={20} /> Nuevo Producto
            </button>
          </div>
        )}
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o código de barras..." 
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-12 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 transition-all">
            <Filter size={18} /> Filtros
          </button>
        </div>
        
        {lowStockCount > 0 ? (
          <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-3xl border border-orange-100 dark:border-orange-500/20 flex items-center gap-4 animate-pulse">
            <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-lg shadow-orange-500/40">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-orange-900 dark:text-orange-400 font-black text-xl leading-none">
                {lowStockCount}
              </p>
              <p className="text-orange-700 dark:text-orange-300 text-xs font-bold uppercase tracking-wider mt-1">Stock Bajo</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 opacity-50">
            <div className="p-3 bg-slate-300 dark:bg-slate-700 rounded-2xl text-white">
              <Package size={24} />
            </div>
            <div>
              <p className="text-slate-900 dark:text-white font-black text-xl leading-none">0</p>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Stock Al Día</p>
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Producto / Código</th>
                <th className="px-8 py-5">Categoría</th>
                <th className="px-8 py-5">Unidad</th>
                <th className="px-8 py-5">Precios</th>
                <th className="px-8 py-5">Stock Actual</th>
                {!isEmployee && <th className="px-8 py-5 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map((product) => (
                <tr 
                  key={product.id} 
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group relative ${
                    product.stock <= product.minStock ? 'bg-orange-50/30 dark:bg-orange-500/5' : ''
                  }`}
                >
                  <td className="px-8 py-5">
                    {product.stock <= product.minStock && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                    )}
                    <div>
                      <p className="font-black text-slate-900 dark:text-white text-lg">{product.name}</p>
                      <p className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-1">
                        <ScanBarcode size={12} /> {product.barcode || 'SIN CÓDIGO'}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-xl uppercase tracking-tighter">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{product.unit}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div>
                      <p className="text-lg font-black text-emerald-600">${product.price.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Costo: ${product.costPrice}</p>
                      {product.wholesalePrice != null && (
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                          P. Mayor: ${product.wholesalePrice.toLocaleString()} ({product.wholesaleMinQty} u.)
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <span className={`text-xl font-black ${product.stock <= product.minStock ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                        {product.stock}
                      </span>
                      {product.stock <= product.minStock && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Min: {product.minStock}</p>
                  </td>
                  {!isEmployee && (
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(product)}
                          className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-2xl transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => { if(confirm('¿Seguro?')) deleteProduct(product.id) }}
                          className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-2xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Side Panel for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] shadow-2xl border border-white/10 flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 flex-shrink-0 rounded-t-[32px]">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl text-white">
                  <Package size={20} />
                </div>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                <X size={22} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormGroup label="Nombre del Producto" colSpan="md:col-span-2">
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ej: Leche Entera 1L"
                  />
                </FormGroup>

                <FormGroup label="Código de Barras">
                  <div className="relative">
                    <ScanBarcode className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                    <input 
                      type="text" 
                      className="form-input pl-12" 
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      placeholder="Escanear o escribir..."
                    />
                  </div>
                </FormGroup>

                <FormGroup label="Categoría">
                  <select 
                    className="form-input appearance-none"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value as ProductCategory})}
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </FormGroup>

                <FormGroup label="Precio de Costo">
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      className="form-input pl-8" 
                      value={formData.costPrice}
                      placeholder="0"
                      onChange={(e) => setFormData({...formData, costPrice: e.target.value})}
                    />
                  </div>
                </FormGroup>

                <FormGroup label="Precio de Venta">
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-emerald-500 font-bold">$</span>
                    <input 
                      type="number" 
                      className="form-input pl-8 border-emerald-500/20 focus:ring-emerald-500/10" 
                      value={formData.price}
                      placeholder="0"
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                    />
                  </div>
                </FormGroup>

                <FormGroup label="Precio Mayorista (Opcional)">
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-blue-500 font-bold">$</span>
                    <input 
                      type="number" 
                      className="form-input pl-8 border-blue-500/20 focus:ring-blue-500/10" 
                      value={formData.wholesalePrice}
                      placeholder="Sin precio mayorista"
                      onChange={(e) => setFormData({...formData, wholesalePrice: e.target.value})}
                    />
                  </div>
                </FormGroup>

                <FormGroup label="Cant. Mínima Mayorista">
                  <input 
                    type="number" 
                    className="form-input" 
                    value={formData.wholesaleMinQty}
                    placeholder="Mínimo de unidades (Ej: 5)"
                    onChange={(e) => setFormData({...formData, wholesaleMinQty: e.target.value})}
                  />
                </FormGroup>

                <FormGroup label="Stock Actual">
                  <input 
                    type="number" 
                    className="form-input" 
                    value={formData.stock}
                    placeholder="0"
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                  />
                </FormGroup>

                <FormGroup label="Stock Mínimo">
                  <input 
                    type="number" 
                    className="form-input" 
                    value={formData.minStock}
                    placeholder="0"
                    onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                  />
                </FormGroup>

                <FormGroup label="Unidad de Medida">
                  <div className="flex gap-2">
                    {UNITS.map(unit => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setFormData({...formData, unit})}
                        className={`flex-1 py-3 rounded-2xl text-xs font-black transition-all border ${formData.unit === unit ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-transparent hover:border-slate-300'}`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </FormGroup>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2.5 bg-blue-600 text-white rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all active:scale-95"
                >
                  <Save size={18} /> {editingProduct ? 'Actualizar' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS for form inputs in this page */}
      <style>{`
        .form-input {
          width: 100%;
          background: #f8fafc;
          border: 1px solid transparent;
          border-radius: 1rem;
          padding: 0.875rem 1.5rem;
          color: #0f172a;
          font-weight: 600;
          transition: all 0.2s;
          outline: none;
        }
        .dark .form-input {
          background: #1e293b;
          color: white;
          border-color: #334155;
        }
        .form-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
          background: white;
        }
        .dark .form-input:focus {
          background: #0f172a;
        }
      `}</style>
    </div>
  );
};

const FormGroup = ({ label, children, colSpan }: any) => (
  <div className={`space-y-2 ${colSpan}`}>
    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    {children}
  </div>
);

export default Inventory;
