import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  image_url?: string;
  user_id: string;
}

export interface CartItem extends Product {
  quantity: number;
}

interface PosState {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  addToCart: (product) => set((state) => {
    const existing = state.cart.find((item) => item.id === product.id);
    if (existing) {
      // Limite la quantité ajoutée au stock disponible
      const newQuantity = Math.min(existing.quantity + 1, product.stock);
      return {
        cart: state.cart.map((item) =>
          item.id === product.id ? { ...item, quantity: newQuantity } : item
        ),
      };
    }
    
    // Si on ajoute le produit pour la première fois, on s'assure qu'il y a du stock
    if (product.stock > 0) {
      return { cart: [...state.cart, { ...product, quantity: 1 }] };
    }
    
    return state; // Ne rien faire si stock = 0
  }),
  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter((item) => item.id !== productId)
  })),
  updateQuantity: (productId, quantity) => set((state) => {
    if (quantity <= 0) {
      return { cart: state.cart.filter(item => item.id !== productId) };
    }
    return {
      cart: state.cart.map((item) =>
        // On s'assure ici aussi que l'update manuel ne dépasse pas le stock
        item.id === productId ? { ...item, quantity: Math.min(quantity, item.stock) } : item
      )
    };
  }),
  clearCart: () => set({ cart: [] }),
  cartTotal: () => {
    return get().cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }
}));
