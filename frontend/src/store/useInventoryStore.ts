import { create } from 'zustand';
import api from '../utils/api';

export type ProductUnit = 'UNIDAD' | 'KILO' | 'LITRO';
export type ProductCategory = 'Lacteos' | 'Panaderia' | 'Bebidas' | 'Cigarrillos' | 'Fiambreria' | 'Otros';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: ProductUnit;
  category: ProductCategory;
  active: boolean;
  createdAt: string;
}

interface InventoryState {
  products: Product[];
  loading: boolean;
  fetchProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

// Helper to get or create categoryId on backend by name
async function getOrCreateCategoryId(categoryName: string): Promise<string> {
  try {
    const catsResponse = await api.get('/categories');
    const categories = catsResponse.data;
    
    const found = categories.find((c: any) => c.name.toLowerCase() === categoryName.toLowerCase());
    if (found) return found.id;
    
    const createResponse = await api.post('/categories', { name: categoryName });
    return createResponse.data.id;
  } catch (e) {
    console.error('Error resolving category in backend:', e);
    return 'Otros';
  }
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  loading: false,

  fetchProducts: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/products');
      const mapped = response.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode || '',
        price: p.sellingPrice,
        costPrice: p.costPrice,
        stock: p.stock,
        minStock: p.minStock,
        unit: p.unit as ProductUnit,
        category: (p.category?.name || 'Otros') as ProductCategory,
        active: p.active,
        createdAt: p.createdAt,
      }));
      set({ products: mapped, loading: false });
    } catch (error) {
      console.error('Error fetching products from Supabase:', error);
      set({ loading: false });
    }
  },

  addProduct: async (productData) => {
    // 1. Optimistic Update (zero latency UI!)
    const tempId = 'temp-' + Math.random().toString(36).substr(2, 9);
    const newProductTemp: Product = {
      ...productData,
      id: tempId,
      createdAt: new Date().toISOString(),
    };
    
    set((state) => ({
      products: [...state.products, newProductTemp],
    }));

    // 2. Persist to Supabase via backend in the background
    try {
      const categoryId = await getOrCreateCategoryId(productData.category);
      const payload = {
        name: productData.name,
        barcode: productData.barcode,
        categoryId,
        costPrice: productData.costPrice,
        sellingPrice: productData.price, // map price to sellingPrice
        stock: productData.stock,
        minStock: productData.minStock,
        unit: productData.unit,
      };

      const response = await api.post('/products', payload);
      const savedProduct = response.data;

      // Swap the temp ID with the real DB ID
      set((state) => ({
        products: state.products.map((p) => p.id === tempId ? {
          ...p,
          id: savedProduct.id,
          createdAt: savedProduct.createdAt,
        } : p),
      }));
    } catch (error) {
      console.error('Error persisting product to Supabase:', error);
      // Revert if API call fails
      set((state) => ({
        products: state.products.filter((p) => p.id !== tempId),
      }));
    }
  },

  updateProduct: async (id, productData) => {
    // 1. Optimistic Update
    const originalProducts = get().products;
    set((state) => ({
      products: state.products.map((p) => p.id === id ? { ...p, ...productData } : p),
    }));

    // 2. Persist to Supabase
    try {
      let categoryId: string | undefined;
      if (productData.category) {
        categoryId = await getOrCreateCategoryId(productData.category);
      }

      const payload = {
        name: productData.name,
        barcode: productData.barcode,
        categoryId,
        costPrice: productData.costPrice,
        sellingPrice: productData.price, // map price to sellingPrice
        stock: productData.stock,
        minStock: productData.minStock,
        unit: productData.unit,
        active: productData.active,
      };

      await api.put(`/products/${id}`, payload);
    } catch (error) {
      console.error('Error updating product in Supabase:', error);
      // Revert if API call fails
      set({ products: originalProducts });
    }
  },

  deleteProduct: async (id) => {
    // 1. Optimistic Update
    const originalProducts = get().products;
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    }));

    // 2. Persist to Supabase (Soft Delete)
    try {
      await api.delete(`/products/${id}`);
    } catch (error) {
      console.error('Error soft-deleting product in Supabase:', error);
      // Revert if API call fails
      set({ products: originalProducts });
    }
  },
}));
