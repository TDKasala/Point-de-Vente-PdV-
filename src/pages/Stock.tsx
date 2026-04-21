import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../store/useStore';
import { Plus, Minus, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Stock() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('stock', { ascending: true }); 
    
    if (error) {
      console.error('Fetch products error:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const updateProductStock = async (product: Product, amount: number) => {
    if (!user) return;
    const newStock = Math.max(0, product.stock + amount); 
    
    setProducts(products.map(p => p.id === product.id ? { ...p, stock: newStock } : p));

    const { error } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', product.id);
    
    if (error) {
      console.error("Erreur de mise à jour du stock", error);
      fetchProducts();
      alert("Erreur lors de la mise à jour du stock");
    } else {
      setSuccessMessage(`Stock de ${product.name} mis à jour : ${newStock}`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Gestion des stocks</h1>
        <p className="text-brand-text-muted">Ajustez rapidement l'inventaire en temps réel</p>
      </div>

      {successMessage && (
        <div className="mb-6 bg-brand-accent/20 border border-brand-accent text-brand-accent px-4 py-4 rounded-xl flex items-center shadow-sm animate-fade-in">
          <CheckCircle2 size={24} className="mr-3 flex-shrink-0" />
          <span className="font-medium text-lg">{successMessage}</span>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-brand-text-muted">Chargement...</div>
        ) : products.length === 0 ? (
          <div className="bg-brand-surface p-12 rounded-2xl border border-brand-border text-center text-brand-text-muted">
            Aucun produit à gérer.
          </div>
        ) : (
          products.map(product => {
            const isLowStock = product.stock > 0 && product.stock < 5;
            const isOutOfStock = product.stock === 0;

            return (
              <div 
                key={product.id} 
                className={`bg-brand-surface p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between transition-colors ${
                  isOutOfStock ? 'border-red-500/50 bg-red-500/5' : 
                  isLowStock ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-brand-border'
                }`}
              >
                <div className="flex items-center mb-4 sm:mb-0">
                  <div className={`mr-5 p-3 rounded-xl hidden sm:flex items-center justify-center ${
                    isOutOfStock ? 'bg-red-500/20 text-red-500' : 
                    isLowStock ? 'bg-yellow-500/20 text-yellow-500' : 'bg-brand-surface-light text-brand-text-muted'
                  }`}>
                    <AlertCircle size={24} className={isOutOfStock || isLowStock ? 'opacity-100' : 'opacity-0'} />
                  </div>
                  <div>
                    <h3 className="font-bold text-brand-text text-xl mb-1">{product.name}</h3>
                    <div className="flex items-center">
                      <span className={`font-mono text-sm px-3 py-1 rounded-lg font-bold ${
                        isOutOfStock ? 'bg-red-500/20 text-red-400' : 
                        isLowStock ? 'bg-yellow-500/20 text-yellow-400' : 'bg-brand-accent/20 text-brand-accent'
                      }`}>
                        Stock: {product.stock}
                      </span>
                      {isLowStock && (
                        <span className="ml-3 text-sm text-yellow-500 font-bold">Stock faible</span>
                      )}
                      {isOutOfStock && (
                        <span className="ml-3 text-sm text-red-500 font-bold">Épuisé</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop controls */}
                <div className="hidden sm:flex items-center space-x-3">
                  <button
                    onClick={() => updateProductStock(product, -1)}
                    disabled={product.stock <= 0}
                    className="p-3 border border-brand-border rounded-xl text-brand-text-muted hover:text-white hover:bg-brand-surface-light disabled:opacity-50 transition-colors"
                  >
                    <Minus size={22} />
                  </button>
                  <button
                    onClick={() => updateProductStock(product, 1)}
                    className="p-3 border border-transparent rounded-xl text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20 transition-colors"
                  >
                    <Plus size={22} />
                  </button>
                </div>

                {/* Mobile controls */}
                <div className="flex sm:hidden space-x-3 w-full mt-2">
                  <button
                    onClick={() => updateProductStock(product, -1)}
                    disabled={product.stock <= 0}
                    className="flex-1 flex justify-center items-center py-4 rounded-xl bg-brand-surface-light text-brand-text disabled:opacity-50"
                  >
                    <Minus size={20} className="mr-2"/> Retirer
                  </button>
                  <button
                    onClick={() => updateProductStock(product, 1)}
                    className="flex-1 flex justify-center items-center py-4 rounded-xl bg-brand-accent/10 text-brand-accent font-bold"
                  >
                    <Plus size={20} className="mr-2"/> Ajouter
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
