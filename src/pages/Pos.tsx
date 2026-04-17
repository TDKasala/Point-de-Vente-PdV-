import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Minus, Trash2, Camera, User, BadgeAlert, ShoppingCart } from 'lucide-react';
import { usePosStore, Product } from '../store/useStore';
import { useAuth } from '../hooks/useAuth';

export default function Pos() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Mobile Money' | 'Carte'>('Espèces');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const cart = usePosStore((state) => state.cart);
  const addToCart = usePosStore((state) => state.addToCart);
  const removeFromCart = usePosStore((state) => state.removeFromCart);
  const updateQuantity = usePosStore((state) => state.updateQuantity);
  const clearCart = usePosStore((state) => state.clearCart);
  const cartTotal = usePosStore((state) => state.cartTotal);

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
      .order('name');
    
    if (error) {
      console.error('Erreur de chargement des produits', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchQuery))
  );

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    setProcessing(true);

    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          total: cartTotal(),
          payment_method: paymentMethod,
          user_id: user.id
        })
        .select()
        .single();

      if (saleError) throw saleError;
      if (!saleData) throw new Error("Vente non créée");

      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: item.stock - item.quantity })
          .eq('id', item.id);
        
        if (stockError) console.error("Erreur de mise à jour du stock", stockError);
      }

      setSuccessMessage(`Vente enregistrée avec succès. Total: R ${cartTotal().toFixed(2)}`);
      setPaymentModalOpen(false);
      clearCart();
      fetchProducts();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);

    } catch (error) {
      console.error("Erreur lors du paiement:", error);
      alert("Une erreur est survenue lors de l'enregistrement de la vente.");
    } finally {
      setProcessing(false);
    }
  };

  const shareOnWhatsApp = () => {
    const text = `Merci pour votre achat.\nTotal: R ${cartTotal().toFixed(2)}\n\nÀ bientôt !`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col lg:flex-row h-full font-sans">
      {/* Left side - Products */}
      <div className="flex-1 p-6 flex flex-col h-full lg:h-[calc(100vh)] overflow-hidden">
        {successMessage && (
          <div className="bg-brand-accent/20 border border-brand-accent text-brand-accent px-4 py-3 rounded-xl relative mb-6">
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}
        
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold hidden lg:block text-brand-text">Vente</h1>
          <div className="relative flex-1 lg:w-96 lg:flex-none">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-brand-text-muted" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3 border border-brand-border rounded-xl bg-brand-surface text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent text-base"
              placeholder="Rechercher un produit ou scanner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="hidden ml-4 bg-brand-surface px-4 py-3 border border-brand-border rounded-xl text-brand-text-muted text-sm lg:flex items-center">
            <User className="h-4 w-4 mr-2" />
            <span>Session: Actif</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center items-center h-64 text-brand-text-muted">Chargement des produits...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-brand-text-muted flex flex-col items-center">
              <BadgeAlert className="h-12 w-12 opacity-50 mb-4" />
              <p>Aucun produit trouvé.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 lg:pb-8">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className={`bg-brand-surface border border-transparent rounded-2xl overflow-hidden flex flex-col text-center transition-all relative ${
                    product.stock <= 0 ? 'cursor-not-allowed grayscale' : 'hover:border-brand-accent active:scale-95'
                  }`}
                  style={{ minHeight: '140px' }}
                >
                  <div className={`flex-1 p-4 w-full flex flex-col items-center justify-center ${product.stock <= 0 ? 'opacity-60' : ''}`}>
                    {product.image_url ? (
                      <div className="w-full aspect-square bg-brand-surface-light rounded-xl overflow-hidden mb-3">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full xl:w-[80%] aspect-square bg-brand-surface-light rounded-xl mb-3 flex items-center justify-center">
                         <Camera className="h-8 w-8 text-brand-text-muted opacity-50" />
                      </div>
                    )}
                    <h3 className="font-semibold text-brand-text text-sm mb-1">{product.name}</h3>
                    <div className={`font-bold ${product.stock <= 0 ? 'text-brand-text-muted' : 'text-brand-accent'}`}>R {product.price.toFixed(2)}</div>
                  </div>
                  
                  {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-brand-bg/40 flex items-center justify-center backdrop-blur-[1.5px] z-10">
                      <span className="bg-red-500/90 text-white text-xs font-black px-3 py-1.5 rounded-lg border border-red-500/50 shadow-lg transform -rotate-12 uppercase tracking-wider">
                        Épuisé
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Cart */}
      <aside className="lg:w-[340px] bg-brand-surface border-l border-brand-border flex flex-col h-[60vh] lg:h-[calc(100vh)] fixed bottom-16 lg:static w-full z-40 transform transition-transform lg:transform-none">
        <div className="p-6 border-b border-brand-border flex justify-between items-center">
          <span className="font-bold text-xl text-brand-text">Panier</span>
          <span className="text-brand-text-muted text-sm">{cart.length} articles</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-brand-text-muted opacity-50">
              <ShoppingCart size={48} className="mb-4" />
              <p>Le panier est vide</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-brand-surface-light p-3 rounded-xl border border-transparent">
                <div className="flex-1 pr-3">
                  <div className="font-semibold text-sm text-brand-text mb-1">{item.name}</div>
                  <div className="text-xs text-brand-text-muted">R {item.price.toFixed(2)} x {item.quantity}</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-8 h-8 rounded-md bg-brand-border text-brand-text flex items-center justify-center hover:bg-brand-text-muted active:opacity-80"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="font-medium text-sm w-4 text-center text-brand-text">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.stock}
                    className="w-8 h-8 rounded-md bg-brand-border text-brand-text flex items-center justify-center hover:bg-brand-text-muted disabled:opacity-50 active:opacity-80"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-brand-bg border-t border-brand-border">
          <div className="flex justify-between mb-4">
            <span className="text-brand-text-muted">Sous-total</span>
            <span className="text-brand-text font-medium">R {cartTotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-brand-text-muted">Total</span>
            <span className="text-2xl font-extrabold text-brand-accent">R {cartTotal().toFixed(2)}</span>
          </div>
          
          <button
            onClick={() => setPaymentModalOpen(true)}
            disabled={cart.length === 0}
            className="w-full bg-brand-accent text-white font-bold py-4 rounded-xl disabled:bg-brand-border disabled:text-brand-text-muted disabled:cursor-not-allowed hover:bg-brand-accent-hover transition-colors text-lg"
          >
            PAYER MAINTENANT
          </button>
          
          {cart.length > 0 && (
             <button 
              onClick={shareOnWhatsApp}
              className="w-full mt-3 bg-transparent border border-brand-border text-brand-text font-medium py-3 rounded-xl hover:bg-brand-surface-light transition-colors text-sm"
             >
               Envoyer reçu WhatsApp
             </button>
          )}
        </div>
      </aside>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-brand-surface rounded-t-2xl lg:rounded-2xl w-full max-w-md mx-auto p-6 shadow-2xl relative border border-brand-border">
            <h2 className="text-2xl font-bold text-center mb-6 text-brand-text">Méthode de paiement</h2>
            
            <div className="space-y-3 mb-6">
              {['Espèces', 'Mobile Money', 'Carte'].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method as any)}
                  className={`w-full py-4 px-4 rounded-xl border-2 font-medium text-lg flex justify-between items-center ${
                    paymentMethod === method ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-brand-border text-brand-text hover:bg-brand-surface-light'
                  }`}
                >
                  {method}
                  {paymentMethod === method && <div className="h-4 w-4 rounded-full bg-brand-accent"></div>}
                </button>
              ))}
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleCheckout}
                disabled={processing}
                className="w-full bg-brand-accent text-white font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-brand-accent-hover text-lg shadow-md"
              >
                {processing ? 'Traitement...' : `Confirmer R ${cartTotal().toFixed(2)}`}
              </button>
              <button
                onClick={() => setPaymentModalOpen(false)}
                disabled={processing}
                className="w-full bg-transparent text-brand-text font-medium py-3 rounded-xl border border-brand-border hover:bg-brand-surface-light"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
