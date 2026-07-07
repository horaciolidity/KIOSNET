import { create } from 'zustand';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from './useAuthStore';

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
  wholesalePrice?: number | null;
  wholesaleMinQty?: number | null;
}

interface InventoryState {
  products: Product[];
  loading: boolean;
  fetchProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

// Helper to get or create categoryId on Supabase by name
async function getOrCreateCategoryId(categoryName: string, tenantId: string): Promise<string> {
  try {
    const { data: categories, error: getError } = await supabase
      .from('Category')
      .select('id, name')
      .eq('tenantId', tenantId);

    if (getError) throw getError;

    const found = categories?.find((c: any) => c.name.toLowerCase() === categoryName.toLowerCase());
    if (found) return found.id;

    // Create category if it doesn't exist
    const { data: newCat, error: createError } = await supabase
      .from('Category')
      .insert({ id: crypto.randomUUID(), name: categoryName, tenantId })
      .select('id')
      .single();

    if (createError) throw createError;
    return newCat.id;
  } catch (e) {
    console.error('Error resolving category in Supabase:', e);
    throw e; // Propagate error to caller
  }
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  loading: false,

  fetchProducts: async () => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('Product')
        .select('*, category:Category(name)')
        .eq('tenantId', tenantId)
        .eq('active', true);

      if (error) throw error;

      const mapped = (data || []).map((p: any) => ({
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
        wholesalePrice: p.wholesalePrice != null ? Number(p.wholesalePrice) : null,
        wholesaleMinQty: p.wholesaleMinQty != null ? Number(p.wholesaleMinQty) : null,
      }));
      set({ products: mapped, loading: false });
    } catch (error) {
      console.error('Error fetching products from Supabase:', error);
      set({ loading: false });
    }
  },

  addProduct: async (productData) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 0. Validate barcode uniqueness before optimistic UI update
    if (productData.barcode) {
      const { data: existing } = await supabase
        .from('Product')
        .select('id')
        .eq('barcode', productData.barcode)
        .eq('tenantId', tenantId)
        .eq('active', true)
        .maybeSingle();

      if (existing) {
        alert('Ya tienes un producto registrado con este código de barras');
        return; // Abort add operation early
      }
    }

    // 1. Optimistic Update – add temporary product to UI
    const tempId = 'temp-' + Math.random().toString(36).substr(2, 9);
    const newProductTemp: Product = {
      ...productData,
      id: tempId,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      products: [...state.products, newProductTemp],
    }));

    // 2. Persist to Supabase
    try {
      const categoryId = await getOrCreateCategoryId(productData.category, tenantId);

      const payload = {
        name: productData.name,
        barcode: productData.barcode || null,
        categoryId,
        costPrice: Number(productData.costPrice),
        sellingPrice: Number(productData.price),
        stock: Number(productData.stock),
        minStock: Number(productData.minStock),
        unit: productData.unit,
        tenantId,
        active: true,
        updatedAt: new Date().toISOString(),
        wholesalePrice: productData.wholesalePrice !== undefined && productData.wholesalePrice !== null && String(productData.wholesalePrice) !== '' ? Number(productData.wholesalePrice) : null,
        wholesaleMinQty: productData.wholesaleMinQty !== undefined && productData.wholesaleMinQty !== null && String(productData.wholesaleMinQty) !== '' ? Number(productData.wholesaleMinQty) : null,
      };

      const { data: savedProduct, error: insertError } = await supabase
        .from('Product')
        .insert({ id: crypto.randomUUID(), ...payload })
        .select()
        .single();

      if (insertError) throw insertError;

      // Replace temporary product with the persisted version
      set((state) => ({
        products: state.products.map((p) =>
          p.id === tempId ? { ...p, ...savedProduct, createdAt: savedProduct.createdAt } : p
        ),
      }));
    } catch (error) {
      console.error('Error persisting product to Supabase:', error);
      // Revert optimistic addition on failure
      set((state) => ({
        products: state.products.filter((p) => p.id !== tempId),
      }));
    }
  },

  updateProduct: async (id, productData) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 1. Optimistic Update
    const originalProducts = get().products;
    set((state) => ({
      products: state.products.map((p) => p.id === id ? { ...p, ...productData } : p),
    }));

    // 2. Persist to Supabase
    try {
      let categoryId: string | undefined;
      if (productData.category) {
        categoryId = await getOrCreateCategoryId(productData.category, tenantId);
      }

      const payload: any = {
        name: productData.name,
        barcode: productData.barcode || null,
        categoryId,
        costPrice: productData.costPrice !== undefined ? Number(productData.costPrice) : undefined,
        sellingPrice: productData.price !== undefined ? Number(productData.price) : undefined,
        stock: productData.stock !== undefined ? Number(productData.stock) : undefined,
        minStock: productData.minStock !== undefined ? Number(productData.minStock) : undefined,
        unit: productData.unit,
        active: productData.active,
        wholesalePrice: productData.wholesalePrice !== undefined ? (productData.wholesalePrice !== null && String(productData.wholesalePrice) !== '' ? Number(productData.wholesalePrice) : null) : undefined,
        wholesaleMinQty: productData.wholesaleMinQty !== undefined ? (productData.wholesaleMinQty !== null && String(productData.wholesaleMinQty) !== '' ? Number(productData.wholesaleMinQty) : null) : undefined,
      };

      // Clean undefined keys
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      const { error: updateError } = await supabase
        .from('Product')
        .update(payload)
        .eq('id', id)
        .eq('tenantId', tenantId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating product in Supabase:', error);
      // Revert if API call fails
      set({ products: originalProducts });
    }
  },

  deleteProduct: async (id) => {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (!tenantId) return;

    // 1. Optimistic Update
    const originalProducts = get().products;
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    }));

    // 2. Persist to Supabase (Soft Delete)
    try {
      const { error: deleteError } = await supabase
        .from('Product')
        .update({ active: false })
        .eq('id', id)
        .eq('tenantId', tenantId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error('Error soft-deleting product in Supabase:', error);
      // Revert if API call fails
      set({ products: originalProducts });
    }
  },
}));
