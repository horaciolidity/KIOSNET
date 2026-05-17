import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      products: [
        {
          id: '1',
          name: 'Coca Cola 1.5L',
          barcode: '779000000001',
          price: 2500,
          costPrice: 1800,
          stock: 45,
          minStock: 10,
          unit: 'UNIDAD',
          category: 'Bebidas',
          active: true,
          createdAt: new Date().toISOString(),
        }
      ],
      addProduct: (productData) => set((state) => ({
        products: [
          ...state.products,
          {
            ...productData,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
          }
        ]
      })),
      updateProduct: (id, productData) => set((state) => ({
        products: state.products.map((p) => p.id === id ? { ...p, ...productData } : p)
      })),
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter((p) => p.id !== id)
      })),
    }),
    {
      name: 'inventory-storage',
    }
  )
);
