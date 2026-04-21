import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Minus, Trash2, Camera, User, BadgeAlert, ShoppingCart, ScanLine, X, Check, FileText } from 'lucide-react';
import { usePosStore, Product, CartItem } from '../store/useStore';
import { useAuth } from '../hooks/useAuth';
import { Html5Qrcode } from 'html5-qrcode';

interface ReceiptData {
  saleId: string;
  date: Date;
  items: CartItem[];
  total: number;
  paymentMethod: string;
}

function BarcodeScannerModal({ onClose, onScan }: { onClose: () => void, onScan: (code: string) => void }) {
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    let isComponentMounted = true;

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (isComponentMounted) {
           onScan(decodedText);
        }
      },
      () => {
        // Ignorer les erreurs frame par frame
      }
    ).catch(err => {
      if (isComponentMounted) {
        if (err?.name === 'NotAllowedError' || String(err).includes('Permission denied')) {
          setErrorMsg("Accès à la caméra refusé. Veuillez autoriser l'utilisation de l'appareil photo dans votre navigateur.");
        } else {
          setErrorMsg("Erreur d'accès à la caméra. Vérifiez que votre appareil possède une caméra disponible.");
        }
      }
    });

    return () => {
      isComponentMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
           html5QrCode.clear();
        }).catch(err => {
           console.error("Erreur lors de l'arrêt du scanner", err);
        });
      }
    };
  }, [onClose, onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-brand-surface rounded-2xl w-full max-w-md mx-auto overflow-hidden shadow-2xl relative border border-brand-border flex flex-col">
        <div className="p-4 border-b border-brand-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-brand-text">Scanner un code-barres</h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-white">
             <X size={24} />
          </button>
        </div>
        <div className="p-6">
           {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-4 text-center text-sm font-medium">
                 {errorMsg}
              </div>
           )}
           <div id="reader" className="w-full bg-black rounded-xl overflow-hidden shadow-inner min-h-[250px]"></div>
           <p className="text-center text-brand-text-muted text-sm mt-6">Placez le code-barres ou le QR code au centre du cadre.</p>
        </div>
      </div>
    </div>
  );
}

export default function Pos() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Mobile Money' | 'Carte'>('Espèces');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false); // New state for mobile cart toggle
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const cart = usePosStore((state) => state.cart);
  const addToCart = usePosStore((state) => state.addToCart);
  const removeFromCart = usePosStore((state) => state.removeFromCart);
  const updateQuantity = usePosStore((state) => state.updateQuantity);
  const clearCart = usePosStore((state) => state.clearCart);
  const cartTotal = usePosStore((state) => state.cartTotal);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineSalesCount, setOfflineSalesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  const updateQueueCount = () => {
     const queue = JSON.parse(localStorage.getItem('offline_sales_queue') || '[]');
     setOfflineSalesCount(queue.length);
  };

  useEffect(() => {
    updateQueueCount();
    const handleOnline = () => { setIsOnline(true); syncOfflineSales(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
    }
  }, [user]);

  useEffect(() => {
    fetchProducts();
  }, [user, isOnline]);

  const syncOfflineSales = async () => {
     if (isSyncing) return;
     const queue = JSON.parse(localStorage.getItem('offline_sales_queue') || '[]');
     if (queue.length === 0 || !user) return;
     
     setIsSyncing(true);
     setSyncError('');
     
     let remainingQueue = [...queue];
     let successCount = 0;

     for (const sale of queue) {
        try {
          const { data: saleData, error: saleError } = await supabase.from('sales').insert({
             total: sale.total,
             payment_method: sale.payment_method,
             user_id: sale.user_id,
             created_at: sale.created_at
          }).select().single();

          if (saleError) throw saleError;

          const itemsToInsert = sale.items.map((item:any) => ({
             sale_id: saleData.id,
             product_id: item.product_id,
             quantity: item.quantity,
             price: item.price
          }));

          const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;

          for (const item of sale.items) {
             const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
             if (p) {
                await supabase.from('products').update({ stock: p.stock - item.quantity }).eq('id', item.product_id);
             }
          }
          
          remainingQueue = remainingQueue.filter(s => s.id !== sale.id);
          successCount++;
          localStorage.setItem('offline_sales_queue', JSON.stringify(remainingQueue));
          setOfflineSalesCount(remainingQueue.length);
          
        } catch (e) {
           console.error("Failed to sync offline sale", e);
           setSyncError("Certaines ventes n'ont pas pu être synchronisées. Elles restent en attente.");
        }
     }
     
     if (successCount > 0 && remainingQueue.length === 0) {
        setSuccessMessage(`${successCount} vente(s) hors-ligne synchronisée(s) avec succès !`);
        setTimeout(() => setSuccessMessage(''), 4000);
     }
     fetchProducts();
     setIsSyncing(false);
  }

  const fetchProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (!isOnline) {
         throw new Error("Offline");
      }
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) {
        throw error;
      } else {
        setProducts(data || []);
        localStorage.setItem('pos_products_cache', JSON.stringify(data || []));
      }
    } catch (e) {
      console.log("Loading products from cache");
      const cached = localStorage.getItem('pos_products_cache');
      if (cached) {
         setProducts(JSON.parse(cached));
      }
    }
    setLoading(false);
  };

  const categories = ['Toutes', ...Array.from(new Set(products.map(p => p.category || 'Général')))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = selectedCategory === 'Toutes' || (p.category || 'Général') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getDiscountedTotal = () => {
    let total = cartTotal();
    if (discountPercent > 0) {
      total = total - (total * (discountPercent / 100));
    }
    return total;
  };

  const handleScanSuccess = (decodedText: string) => {
    setIsScannerOpen(false);
    const matchedProduct = products.find(p => p.barcode === decodedText);
    
    if (matchedProduct) {
      if (matchedProduct.stock > 0) {
        addToCart(matchedProduct);
        setSuccessMessage(`Produit ajouté : ${matchedProduct.name}`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        alert(`Le produit "${matchedProduct.name}" est épuisé et ne peut pas être ajouté au panier.`);
      }
    } else {
      alert(`Code-barres non reconnu : ${decodedText}`);
    }
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    setProcessing(true);

    try {
      if (!isOnline) {
         // Save offline
         const offlineSale = {
            id: crypto.randomUUID(),
            total: getDiscountedTotal(),
            payment_method: paymentMethod,
            user_id: user.id,
            created_at: new Date().toISOString(),
            items: cart.map(item => ({
               product_id: item.id,
               quantity: item.quantity,
               price: item.price
            }))
         };
         
         const existingQueue = JSON.parse(localStorage.getItem('offline_sales_queue') || '[]');
         existingQueue.push(offlineSale);
         localStorage.setItem('offline_sales_queue', JSON.stringify(existingQueue));
         setOfflineSalesCount(existingQueue.length);

         // Update local stock cache roughly
         const cachedProducts = JSON.parse(localStorage.getItem('pos_products_cache') || '[]');
         cart.forEach(item => {
            const p = cachedProducts.find((cp:any) => cp.id === item.id);
            if (p) p.stock -= item.quantity;
         });
         localStorage.setItem('pos_products_cache', JSON.stringify(cachedProducts));
         setProducts(cachedProducts);

         setReceiptData({
            saleId: offlineSale.id,
            date: new Date(offlineSale.created_at),
            items: [...cart],
            total: offlineSale.total,
            paymentMethod: paymentMethod
         });

         setPaymentModalOpen(false);
         clearCart();
         setDiscountPercent(0);
         setSuccessMessage("Vente enregistrée HORS-LIGNE. Elle sera synchronisée lors du retour de la connexion.");
         setTimeout(() => setSuccessMessage(''), 5000);
         setProcessing(false);
         return;
      }

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          total: getDiscountedTotal(),
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
        price: item.price // we save the list price. Can handle a discount col per item later if needed.
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

      setReceiptData({
        saleId: saleData.id,
        date: new Date(saleData.created_at || Date.now()),
        items: [...cart],
        total: getDiscountedTotal(), // <-- Corrected
        paymentMethod: paymentMethod
      });

      setPaymentModalOpen(false);
      clearCart();
      setDiscountPercent(0); // Reset discount
      fetchProducts();

    } catch (error) {
      console.error("Erreur lors du paiement:", error);
      alert("Une erreur est survenue lors de l'enregistrement de la vente.");
    } finally {
      setProcessing(false);
    }
  };

  const shareOnWhatsApp = () => {
    let text = `Merci pour votre achat.\n`;
    if (discountPercent > 0) {
      text += `Remise appliquée: ${discountPercent}%\n`;
    }
    text += `Total: R ${getDiscountedTotal().toFixed(2)}\n\nÀ bientôt !`;
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
        {syncError && (
          <div className="bg-red-500/20 border border-red-500 text-red-500 px-4 py-3 rounded-xl relative mb-6">
            <span className="block sm:inline">{syncError}</span>
          </div>
        )}
        
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
             <h1 className="text-2xl font-bold hidden lg:block text-brand-text">Vente</h1>
             {!isOnline ? (
                <span className="bg-orange-500/20 text-orange-500 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/50 flex items-center">
                   <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse mr-2"></div>
                   Mode Hors-ligne
                </span>
             ) : offlineSalesCount > 0 ? (
                <div className="flex items-center space-x-2">
                   <span className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/50">
                      {offlineSalesCount} vente(s) en attente
                   </span>
                   <button 
                      onClick={syncOfflineSales} 
                      disabled={isSyncing}
                      className="bg-brand-surface hover:bg-brand-surface-light text-brand-text px-3 py-1 text-xs font-bold rounded-lg border border-brand-border disabled:opacity-50"
                    >
                      {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
                   </button>
                </div>
             ) : null}
          </div>
          <div className="relative flex-1 lg:w-96 lg:flex-none">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-brand-text-muted" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-14 py-3 border border-brand-border rounded-xl bg-brand-surface text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent text-base"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
               onClick={() => setIsScannerOpen(true)}
               className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-text-muted hover:text-brand-accent transition-colors"
               title="Scanner un code-barres"
            >
               <ScanLine className="h-6 w-6" />
            </button>
          </div>
          <div className="hidden ml-4 bg-brand-surface px-4 py-3 border border-brand-border rounded-xl text-brand-text-muted text-sm lg:flex items-center">
            <User className="h-4 w-4 mr-2" />
            <span>Session: Actif</span>
          </div>
        </header>

        {/* Categories row */}
        <div className="flex space-x-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          {categories.map((cat, idx) => (
             <button
                key={idx}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full font-medium transition-colors border ${
                   selectedCategory === cat 
                   ? 'bg-brand-accent text-white border-brand-accent' 
                   : 'bg-brand-surface text-brand-text border-brand-border hover:bg-brand-surface-light'
                }`}
             >
                {cat}
             </button>
          ))}
        </div>

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
      {/* Mobile Cart Summary (Sticky Bottom) */}
      <div className="lg:hidden fixed bottom-[72px] md:bottom-20 left-0 right-0 p-4 bg-brand-surface border-t border-brand-border z-30 flex justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-brand-text-muted">{cart.length} article(s)</span>
          <span className="text-lg font-bold text-brand-accent">R {cartTotal().toFixed(2)}</span>
        </div>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="bg-brand-accent text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-accent-hover active:scale-95 transition-all shadow-lg flex items-center"
        >
          <ShoppingCart size={20} className="mr-2" />
          Panier
        </button>
      </div>

      {/* Cart Drawer / Sidebar */}
      <aside className={`bg-brand-surface flex flex-col fixed inset-0 z-50 lg:static lg:w-[360px] xl:w-[400px] lg:h-[calc(100vh)] lg:border-l border-brand-border transform transition-transform duration-300 ease-in-out ${isCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
        {/* Cart Header */}
        <div className="p-4 md:p-6 border-b border-brand-border flex justify-between items-center bg-brand-surface pt-8 md:pt-6">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-2 bg-brand-surface-light rounded-xl text-brand-text-muted hover:text-white transition-colors" 
              onClick={() => setIsCartOpen(false)}
            >
              <X size={24} />
            </button>
            <span className="font-bold text-xl text-brand-text">Panier</span>
          </div>
          <span className="text-brand-text-muted text-sm bg-brand-surface-light px-3 py-1.5 rounded-lg">{cart.length} articles</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-brand-text-muted opacity-50">
              <ShoppingCart size={48} className="mb-4" />
              <p>Le panier est vide</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex flex-col bg-brand-surface-light p-4 rounded-xl border border-transparent">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-3">
                    <div className="font-semibold text-base text-brand-text mb-1">{item.name}</div>
                    <div className="text-sm text-brand-text-muted">R {item.price.toFixed(2)} / unité</div>
                  </div>
                  <div className="font-bold text-brand-accent">
                    R {(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-3 border-t border-brand-border/50">
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="p-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors flex items-center justify-center"
                    title="Retirer du panier"
                  >
                    <Trash2 size={22} />
                  </button>
                  <div className="flex items-center space-x-4 bg-brand-bg rounded-xl p-1 border border-brand-border">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-12 h-10 rounded-lg bg-brand-surface text-brand-text flex items-center justify-center hover:bg-brand-text-muted active:scale-95 transition-all shadow-sm"
                    >
                      <Minus size={20} />
                    </button>
                    <span className="font-bold text-lg w-8 text-center text-brand-text">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-12 h-10 rounded-lg bg-brand-surface text-brand-text flex items-center justify-center hover:bg-brand-text-muted disabled:opacity-40 active:scale-95 transition-all shadow-sm"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-brand-bg border-t border-brand-border">
          {/* Discount input */}
          {cart.length > 0 && (
            <div className="flex items-center justify-between mb-4 border-b border-brand-border pb-4">
              <span className="text-brand-text-muted text-sm flex items-center gap-2">Remise (%)</span>
              <div className="flex items-center space-x-2">
                 <button onClick={() => setDiscountPercent(Math.max(0, discountPercent - 5))} className="p-2 bg-brand-surface border border-brand-border rounded-lg">-</button>
                 <span className="font-bold w-8 text-center">{discountPercent}%</span>
                 <button onClick={() => setDiscountPercent(Math.min(100, discountPercent + 5))} className="p-2 bg-brand-surface border border-brand-border rounded-lg">+</button>
              </div>
            </div>
          )}
          
          <div className="flex justify-between mb-4">
            <span className="text-brand-text-muted">Sous-total</span>
            <span className="text-brand-text font-medium">R {cartTotal().toFixed(2)}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex justify-between mb-4">
              <span className="text-red-400">Remise ({discountPercent}%)</span>
              <span className="text-red-400 font-medium">- R {(cartTotal() * (discountPercent / 100)).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <span className="text-brand-text-muted">Total</span>
            <span className="text-2xl font-extrabold text-brand-accent">R {getDiscountedTotal().toFixed(2)}</span>
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
                {processing ? 'Traitement...' : `Confirmer R ${getDiscountedTotal().toFixed(2)}`}
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

      {/* Scanner Modal */}
      {isScannerOpen && (
         <BarcodeScannerModal
            onClose={() => setIsScannerOpen(false)}
            onScan={handleScanSuccess}
         />
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:bg-white print:p-0">
          <div className="bg-brand-surface rounded-2xl w-full max-w-md mx-auto overflow-hidden shadow-2xl relative border border-brand-border flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none">
            <div className="p-6 text-center border-b border-brand-border bg-brand-surface-light print:bg-white print:border-black">
              <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 print:hidden">
                 <Check size={32} />
              </div>
              <h2 className="text-2xl font-bold text-brand-text print:text-black">Paiement Réussi</h2>
              <p className="text-brand-text-muted mt-1 print:text-black">Reçu n° {receiptData.saleId.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-brand-text-muted mt-1 print:text-black">{receiptData.date.toLocaleString('fr-FR')}</p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto max-h-[50vh] print:max-h-none print:overflow-visible text-brand-text print:text-black">
              <div className="space-y-3 mb-6">
                {receiptData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span className="text-brand-text-muted print:text-black">
                      R {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-brand-border border-dashed pt-4 mb-4 print:border-black">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Payé</span>
                  <span className="text-brand-accent print:text-black">R {receiptData.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-brand-text-muted print:text-black">Méthode</span>
                  <span>{receiptData.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-brand-bg border-t border-brand-border flex flex-col space-y-3 print:hidden">
               <button 
                 onClick={() => {
                   const text = `*Ticket de Caisse*\nReçu: ${receiptData.saleId.slice(0, 8).toUpperCase()}\nDate: ${receiptData.date.toLocaleString('fr-FR')}\n\n` +
                                receiptData.items.map(i => `${i.quantity}x ${i.name} - R ${(i.price * i.quantity).toFixed(2)}`).join('\n') +
                                `\n\n*Total: R ${receiptData.total.toFixed(2)}*\nMéthode: ${receiptData.paymentMethod}\n\nMerci pour votre visite !`;
                   const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                   window.open(url, '_blank');
                 }}
                 className="w-full bg-[#25D366] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#20b858] transition-colors flex items-center justify-center"
               >
                 Envoyer par WhatsApp
               </button>
               <button 
                 onClick={() => window.print()}
                 className="w-full bg-brand-surface-light text-brand-text px-6 py-3 rounded-xl font-medium border border-brand-border hover:bg-brand-border transition-colors flex items-center justify-center"
               >
                 <FileText size={20} className="mr-2"/> Imprimer le reçu
               </button>
               <button 
                 onClick={() => {
                    setReceiptData(null);
                    setIsCartOpen(false); // Close cart drawer on mobile when starting new sale
                 }}
                 className="w-full bg-brand-accent text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-accent-hover transition-colors flex items-center justify-center"
               >
                 Nouvelle Vente
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
