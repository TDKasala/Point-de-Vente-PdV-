import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, Plus, Minus, Trash2, Camera, User, 
  BadgeAlert, ShoppingCart, X, Check, FileText, Wallet 
} from 'lucide-react';
import { usePosStore, Product, CartItem } from '../store/useStore';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface ReceiptData {
  saleId: string;
  date: Date;
  items: CartItem[];
  total: number;
  paymentMethod: string;
}

export default function Pos() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Toutes']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Mobile Money' | 'Carte'>('Espèces');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false); // New state for mobile cart toggle
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const [currency, setCurrency] = useState('R');

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
    const fetchSettings = async () => {
       if (!user) return;
       const { data } = await supabase.from('user_settings').select('currency_symbol').eq('user_id', user.id).single();
       if (data?.currency_symbol) setCurrency(data.currency_symbol);
    };
    fetchSettings();

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
      
      // Fetch Products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (productsError) throw productsError;

      // Fetch Categories
      const { data: categoriesData } = await supabase
        .from('product_categories')
        .select('name')
        .eq('user_id', user.id)
        .order('name');

      setProducts(productsData || []);
      
      const uniqueCategories = ['Toutes', 'Général'];
      if (categoriesData) {
        categoriesData.forEach(cat => {
          if (!uniqueCategories.includes(cat.name)) {
            uniqueCategories.push(cat.name);
          }
        });
      }
      // Also add categories from products that might not be in product_categories table yet
      productsData?.forEach(p => {
        if (p.category && !uniqueCategories.includes(p.category)) {
          uniqueCategories.push(p.category);
        }
      });
      setCategories(uniqueCategories);

      localStorage.setItem('pos_products_cache', JSON.stringify(productsData || []));
      localStorage.setItem('pos_categories_cache', JSON.stringify(uniqueCategories));
      
    } catch (e) {
      console.log("Loading from cache");
      const cachedProducts = localStorage.getItem('pos_products_cache');
      const cachedCategories = localStorage.getItem('pos_categories_cache');
      if (cachedProducts) setProducts(JSON.parse(cachedProducts));
      if (cachedCategories) setCategories(JSON.parse(cachedCategories));
    }
    setLoading(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
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

  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

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
    <div className="flex flex-col lg:flex-row h-screen bg-[#FDFDFD] overflow-hidden">
      {/* Left side - Products Catalog */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-brand-border/40">
        
        {/* Modern Minimal Header */}
        <header className="px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-brand-border/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
             <div className="bg-brand-accent/10 p-2 rounded-xl text-brand-accent">
                <ShoppingCart size={24} />
             </div>
             <div>
               <h1 className="text-lg font-extrabold text-brand-text tracking-tight uppercase">Terminal Vente</h1>
               {isOnline ? (
                 <span className="text-[10px] text-green-500 font-bold tracking-widest flex items-center">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></div>
                   SYSTÈME EN LIGNE
                 </span>
               ) : (
                 <span className="text-[10px] text-orange-500 font-bold tracking-widest flex items-center">
                   <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5 animate-pulse"></div>
                   MODE HORS-LIGNE
                 </span>
               )}
             </div>
          </div>

          <div className="relative w-full sm:max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-brand-text-muted group-focus-within:text-brand-accent transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full px-4 py-2.5 bg-brand-bg/50 border border-brand-border/50 rounded-2xl text-sm text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/10 focus:border-brand-accent/50 transition-all"
              placeholder="Rechercher des produits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        {/* Global Feedback Banner */}
        <AnimatePresence>
          {(successMessage || syncError || lowStockCount > 0 || outOfStockCount > 0) && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 overflow-hidden"
            >
              <div className="mt-4 space-y-2">
                {(successMessage || syncError) && (
                  <div className={`p-2.5 rounded-xl border flex items-center ${
                    syncError 
                      ? 'bg-red-50 border-red-100 text-red-600' 
                      : 'bg-green-50 border-green-100 text-green-600'
                  } text-[10px] font-bold uppercase tracking-tight`}>
                    <div className={`w-1.5 h-1.5 rounded-full mr-2.5 ${syncError ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    {successMessage || syncError}
                  </div>
                )}
                
                {(outOfStockCount > 0 || lowStockCount > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {outOfStockCount > 0 && (
                      <div className="flex-1 min-w-[180px] p-2 bg-red-50/50 border border-red-100/50 rounded-xl flex items-center justify-between group">
                        <div className="flex items-center">
                           <BadgeAlert size={12} className="text-red-500 mr-2" />
                           <span className="text-[9px] font-bold text-red-600 uppercase tracking-tight">
                             {outOfStockCount} {outOfStockCount === 1 ? 'épuisé' : 'épuisés'}
                           </span>
                        </div>
                        <Link to="/inventory" className="text-[9px] font-black text-red-700 underline uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                          Gérer
                        </Link>
                      </div>
                    )}

                    {lowStockCount > 0 && (
                      <div className="flex-1 min-w-[180px] p-2 bg-orange-50/50 border border-orange-100/50 rounded-xl flex items-center justify-between group">
                        <div className="flex items-center">
                           <BadgeAlert size={12} className="text-orange-500 mr-2" />
                           <span className="text-[9px] font-bold text-orange-600 uppercase tracking-tight">
                             {lowStockCount} {lowStockCount === 1 ? 'stock faible' : 'stocks faibles'}
                           </span>
                        </div>
                        <Link to="/inventory" className="text-[9px] font-black text-orange-700 underline uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
                          Voir
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories Bar */}
        <div className="px-6 py-4 flex items-center space-x-3 overflow-x-auto scrollbar-hide bg-white/40 border-b border-brand-border/10">
          <div className="flex-shrink-0 text-[10px] font-black text-brand-text-muted uppercase tracking-[0.2em] px-1 opacity-40">Filtrage</div>
          <div className="flex space-x-3 pr-6">
            {categories.map((cat, idx) => (
               <button
                  key={idx}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 uppercase border ${
                     selectedCategory === cat 
                     ? 'bg-brand-text text-white border-brand-text shadow-lg shadow-brand-text/10 scale-105 z-10' 
                     : 'bg-white/60 text-brand-text-muted border-brand-border/30 hover:border-brand-accent/40 hover:text-brand-text hover:bg-white'
                  }`}
               >
                  {cat}
               </button>
            ))}
          </div>
        </div>

        {/* Products Display Section */}
        <main className="flex-1 overflow-y-auto px-6 pb-24 lg:pb-8">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
              <p className="text-xs font-medium text-brand-text-muted font-mono">CHARGEMENT CATALOGUE...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <div className="bg-brand-bg p-6 rounded-full mb-4">
                <BadgeAlert className="h-10 w-10 text-brand-text-muted opacity-30" />
              </div>
              <h3 className="text-sm font-bold text-brand-text uppercase tracking-tight">Aucun article trouvé</h3>
              <p className="text-xs text-brand-text-muted mt-1 uppercase tracking-tighter opacity-70 italic">Essayez un autre terme de recherche</p>
            </div>
          ) : (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.03 } }
              }}
              className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5"
            >
              {filteredProducts.map((product) => (
                <motion.button
                  variants={{
                    hidden: { opacity: 0, scale: 0.95 },
                    visible: { opacity: 1, scale: 1 }
                  }}
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className={`group relative bg-white border border-brand-border/30 rounded-3xl overflow-hidden flex flex-col transition-all duration-300 ${
                    product.stock <= 0 
                      ? 'opacity-60 cursor-not-allowed grayscale' 
                      : 'hover:shadow-xl hover:shadow-brand-accent/5 hover:-translate-y-1 active:scale-95'
                  }`}
                >
                  <div className="relative aspect-square w-full bg-brand-bg flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      />
                    ) : (
                      <div className="p-8 bg-brand-surface-light rounded-2xl">
                         <Camera className="h-8 w-8 text-brand-text-muted opacity-20" />
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    {product.stock > 0 && (
                      <div className="absolute inset-0 bg-brand-accent/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <div className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                            <Plus size={20} className="text-brand-accent" />
                         </div>
                      </div>
                    )}

                    {/* Stock Badge */}
                    <div className={`absolute top-3 left-3 px-2 py-1 rounded-lg text-[10px] font-black tracking-tighter uppercase ${
                      product.stock > 10 ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'
                    }`}>
                       STOCK: {product.stock}
                    </div>
                  </div>

                  <div className="p-4 text-left flex flex-col justify-between flex-1">
                    <div className="mb-2">
                       <p className="text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-1 opacity-60">
                          {product.category || 'Général'}
                       </p>
                       <h3 className="font-bold text-brand-text text-sm leading-tight line-clamp-2">{product.name}</h3>
                    </div>
                    <div className="flex items-baseline justify-between mt-auto pt-2 border-t border-brand-border/30">
                       <p className="text-xs font-medium text-brand-text-muted opacity-70 uppercase tracking-tighter">Prix</p>
                       <p className={`text-lg font-black ${product.stock <= 0 ? 'text-brand-text-muted' : 'text-brand-accent'}`}>
                          {currency} {product.price.toFixed(2)}
                       </p>
                    </div>
                  </div>

                  {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-white/40 flex items-center justify-center backdrop-blur-[1px] z-10 transition-all group-hover:backdrop-blur-[2px]">
                      <span className="bg-brand-text text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-2xl transform tracking-widest uppercase border border-white/20">
                        RUPTURE
                      </span>
                    </div>
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}
        </main>
      </div>

      {/* Right side - Modern Cart Sidebar */}
      {/* Mobile Cart Floating Summary */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
         <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCartOpen(true)}
          className="w-full bg-brand-text text-white p-4 rounded-2xl font-black text-sm tracking-widest shadow-2xl flex justify-between items-center"
        >
          <div className="flex items-center">
            <div className="bg-white/10 p-2 rounded-xl mr-3">
               <ShoppingCart size={18} />
            </div>
            <span>PANIER ({cart.length})</span>
          </div>
          <span className="text-lg">{currency} {cartTotal().toFixed(2)}</span>
        </motion.button>
      </div>

      <aside className={`bg-white border-l border-brand-border/40 fixed inset-0 lg:static z-50 lg:w-[420px] 2xl:w-[480px] flex flex-col transform transition-all duration-500 ease-in-out ${
        isCartOpen ? 'translate-y-0 opacity-100' : 'translate-y-full lg:translate-y-0 opacity-0 lg:opacity-100'
      }`}>
        
        {/* Cart Header */}
        <header className="px-8 py-6 border-b border-brand-border/30 flex items-center justify-between">
           <div className="flex items-center">
              <div className="hidden lg:flex bg-brand-bg p-2.5 rounded-2xl border border-brand-border/20 mr-4">
                 <ShoppingCart size={22} className="text-brand-text" />
              </div>
              <div>
                <h2 className="text-xl font-black text-brand-text tracking-tight uppercase">Commande</h2>
                <p className="text-[10px] font-bold text-brand-text-muted tracking-wide mt-0.5">
                   {cart.length > 0 ? `${cart.length} ARTICLES SÉLECTIONNÉS` : 'SÉLECTIONNEZ DES ARTICLES'}
                </p>
              </div>
           </div>
           
           <div className="flex space-x-2">
              <button 
                onClick={clearCart}
                disabled={cart.length === 0}
                className="p-2.5 text-brand-text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-0"
                title="Vider le panier"
              >
                <Trash2 size={20} />
              </button>
              <button 
                className="lg:hidden p-2.5 bg-brand-bg rounded-xl text-brand-text hover:bg-brand-border/50 transition-colors" 
                onClick={() => setIsCartOpen(false)}
              >
                <X size={20} />
              </button>
           </div>
        </header>

        {/* Cart Body - List Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <AnimatePresence mode="popLayout">
            {cart.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col items-center justify-center text-center px-10"
              >
                <div className="w-20 h-20 bg-brand-bg rounded-full flex items-center justify-center mb-6 border border-brand-border/10">
                   <ShoppingCart size={32} className="text-brand-text-muted opacity-20" />
                </div>
                <h3 className="text-lg font-black text-brand-text/40 tracking-tight uppercase">Le panier est vide</h3>
                <p className="text-xs text-brand-text-muted mt-3 uppercase tracking-tighter leading-relaxed">Sélectionnez des produits ou utilisez la recherche pour commencer la vente.</p>
              </motion.div>
            ) : (
              cart.map((item) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key={item.id} 
                  className="group bg-[#F9FAFB]/60 border border-brand-border/20 p-4 rounded-[2rem] hover:bg-white hover:border-brand-accent/20 hover:shadow-lg hover:shadow-brand-accent/5 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-white rounded-2xl border border-brand-border/10 overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-bg">
                           <ShoppingCart size={18} className="text-brand-text-muted opacity-20" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                         <h4 className="text-sm font-bold text-brand-text truncate pr-2 uppercase tracking-wide">{item.name}</h4>
                         <p className="text-sm font-black text-brand-text">{currency} {(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <p className="text-[10px] font-bold text-brand-text-muted mt-0.5 tracking-tighter">{currency} {item.price.toFixed(2)} / unité</p>
                      
                      <div className="flex items-center justify-between mt-4">
                         <div className="flex items-center space-x-1 bg-white p-1 rounded-2xl border border-brand-border/20 shadow-sm">
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-10 h-10 rounded-xl bg-brand-bg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-light active:scale-90 transition-all flex items-center justify-center font-bold"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="font-black text-sm w-10 text-center text-brand-text leading-none">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.stock}
                              className="w-10 h-10 rounded-xl bg-brand-bg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-light active:scale-90 transition-all disabled:opacity-30 flex items-center justify-center font-bold"
                            >
                              <Plus size={16} />
                            </button>
                         </div>
                         <button 
                          onClick={() => removeFromCart(item.id)}
                          className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                         >
                          <Trash2 size={18} />
                         </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Cart Checkout Footer */}
        <section className="bg-white p-8 border-t border-brand-border/40 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between group">
              <div className="flex items-center space-x-2">
                 <div className="p-1.5 bg-brand-bg rounded-lg">
                    <User size={14} className="text-brand-text-muted" />
                 </div>
                 <span className="text-[10px] font-extrabold text-brand-text-muted uppercase tracking-widest">Client Comptoir</span>
              </div>
              <button className="text-[10px] font-black text-brand-accent uppercase tracking-widest hover:underline">Modifier</button>
            </div>

            {cart.length > 0 && (
              <div className="flex items-center justify-between p-2 bg-brand-bg rounded-2xl border border-brand-border/10">
                <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-3">Remise Appliquée</span>
                <div className="flex items-center bg-white rounded-xl border border-brand-border/20 shadow-sm overflow-hidden">
                   <button onClick={() => setDiscountPercent(Math.max(0, discountPercent - 5))} className="px-3 py-2 flex items-center justify-center text-brand-text-muted hover:bg-brand-surface-light transition-colors">-</button>
                   <span className="px-3 py-2 font-black text-xs text-brand-accent min-w-[3rem] text-center border-x border-brand-border/10">{discountPercent}%</span>
                   <button onClick={() => setDiscountPercent(Math.min(100, discountPercent + 5))} className="px-3 py-2 flex items-center justify-center text-brand-text-muted hover:bg-brand-surface-light transition-colors">+</button>
                </div>
              </div>
            )}
             
            <div className="space-y-2 pt-2">
              <div className="flex justify-between px-1">
                <span className="text-xs font-bold text-brand-text-muted uppercase tracking-tighter">Sous-total</span>
                <span className="text-xs font-bold text-brand-text">{currency} {cartTotal().toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between px-1">
                  <span className="text-xs font-bold text-red-500 uppercase tracking-tighter">Remise</span>
                  <span className="text-xs font-bold text-red-500">- {currency} {(cartTotal() * (discountPercent / 100)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-brand-border/30">
                <span className="text-sm font-black text-brand-text uppercase tracking-tight">Net à payer</span>
                <span className="text-3xl font-black text-brand-text tracking-tight animate-in fade-in transition-all">
                   {currency} {getDiscountedTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <button
               onClick={() => setPaymentModalOpen(true)}
               disabled={cart.length === 0}
               className="col-span-2 relative group bg-brand-accent text-white font-black py-5 rounded-[2rem] disabled:bg-brand-text-muted disabled:opacity-20 disabled:cursor-not-allowed hover:bg-brand-accent-hover transition-all duration-500 overflow-hidden flex items-center justify-center shadow-xl shadow-brand-accent/20 active:scale-[0.98]"
             >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-700"></div>
                <span className="text-lg tracking-tight">ENCAISSER</span>
                <Check size={22} className="ml-3 opacity-80 group-hover:translate-x-1 transition-transform" />
             </button>
             
             {cart.length > 0 && (
                <button 
                  onClick={shareOnWhatsApp}
                  className="col-span-2 flex items-center justify-center space-x-2 py-3.5 bg-white border border-brand-border/40 text-[10px] font-black text-brand-text-muted rounded-2xl uppercase tracking-widest hover:border-brand-text/20 hover:text-brand-text transition-all"
                >
                  <FileText size={14} />
                  <span>Extraire un Devis PDF / WA</span>
                </button>
             )}
          </div>
        </section>
      </aside>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModalOpen && (
          <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:justify-center bg-brand-text/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[3rem] lg:rounded-[3rem] w-full max-w-lg mx-auto p-8 shadow-2xl relative border border-brand-border/20"
            >
              <div className="w-12 h-1.5 bg-brand-border/40 rounded-full mx-auto mb-8 lg:hidden"></div>
              
              <h2 className="text-2xl font-black text-center mb-2 text-brand-text tracking-tight uppercase">Confirmer la Vente</h2>
              <p className="text-center text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-8 opacity-60">Paiement uniquement en espèces</p>
              
              <div className="bg-brand-bg rounded-[2rem] p-8 mb-10 flex flex-col items-center">
                 <div className="bg-brand-accent/10 p-4 rounded-3xl text-brand-accent mb-4">
                    <Wallet size={48} />
                 </div>
                 <p className="text-sm font-bold text-brand-text-muted uppercase tracking-widest mb-1">Total à encaisser</p>
                 <p className="text-4xl font-black text-brand-text tracking-tighter">
                    {currency} {getDiscountedTotal().toFixed(2)}
                 </p>
              </div>

              <div className="flex flex-col space-y-4">
                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  className="w-full bg-brand-accent text-white font-black py-5 rounded-[2.5rem] disabled:opacity-30 hover:bg-brand-accent-hover text-lg shadow-xl shadow-brand-accent/20 transition-all active:scale-95"
                >
                  {processing ? 'TRAITEMENT EN COURS...' : `CONFIRMER ${currency} ${getDiscountedTotal().toFixed(2)}`}
                </button>
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  disabled={processing}
                  className="w-full bg-transparent text-brand-text-muted font-bold py-3 rounded-2xl hover:text-brand-text transition-all uppercase tracking-widest text-[10px]"
                >
                  Annuler la transaction
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {receiptData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-white/90 backdrop-blur-xl p-4 print:bg-white print:p-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              className="bg-white rounded-[3rem] w-full max-w-lg mx-auto overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.1)] relative border border-brand-border/30 flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none"
            >
              <div className="p-10 text-center bg-[#FDFDFD] border-b border-brand-border/30">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                   <Check size={40} strokeWidth={3} />
                </motion.div>
                <h2 className="text-3xl font-black text-brand-text tracking-tighter uppercase mb-2">Transation Approuvée</h2>
                <div className="text-[10px] font-black text-brand-text-muted tracking-[.2em] uppercase opacity-60">
                   Réçu #{receiptData.saleId.slice(0, 8).toUpperCase()} • {receiptData.date.toLocaleDateString('fr-FR')} {receiptData.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              
              <div className="p-10 flex-1 overflow-y-auto max-h-[40vh] print:max-h-none print:overflow-visible">
                <div className="space-y-4 mb-8">
                  {receiptData.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center group">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-brand-text uppercase tracking-tight">{item.name}</span>
                        <span className="text-[10px] font-bold text-brand-text-muted uppercase opacity-60">{item.quantity} x {currency} {item.price.toFixed(2)}</span>
                      </div>
                      <span className="font-black text-brand-text">
                        {currency} {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-brand-border/40 border-dashed pt-8 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-brand-text-muted uppercase tracking-widest">
                    <span>Total Net</span>
                    <span className="text-2xl font-black text-brand-accent tracking-tighter">{currency} {receiptData.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest opacity-60">Mode de paiement</span>
                    <span className="text-[10px] font-black text-brand-text uppercase tracking-widest bg-brand-bg px-3 py-1 rounded-lg">{receiptData.paymentMethod}</span>
                  </div>
                </div>
              </div>

              <div className="p-10 bg-brand-bg/50 border-t border-brand-border/30 flex flex-col space-y-4 print:hidden">
                 <button 
                   onClick={() => {
                     const text = `*Ticket de Caisse*\nReçu: ${receiptData.saleId.slice(0, 8).toUpperCase()}\nDate: ${receiptData.date.toLocaleString('fr-FR')}\n\n` +
                                  receiptData.items.map(i => `${i.quantity}x ${i.name} - ${currency} ${(i.price * i.quantity).toFixed(2)}`).join('\n') +
                                  `\n\n*Total: ${currency} ${receiptData.total.toFixed(2)}*\nMéthode: ${receiptData.paymentMethod}\n\nMerci pour votre visite !`;
                     const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                     window.open(url, '_blank');
                   }}
                   className="w-full bg-[#111827] text-white py-5 rounded-[2.5rem] font-black text-xs tracking-widest hover:bg-black transition-all flex items-center justify-center shadow-2xl"
                 >
                   ARTAGÉ SUR WHATSAPP
                 </button>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center justify-center space-x-2 py-4 bg-white border border-brand-border/40 text-[10px] font-black text-brand-text-muted rounded-2xl uppercase tracking-widest hover:border-brand-text/20 hover:text-brand-text transition-all"
                    >
                      <FileText size={16}/> 
                      <span>Imprimer</span>
                    </button>
                    <button 
                      onClick={() => {
                         setReceiptData(null);
                         setIsCartOpen(false);
                      }}
                      className="flex items-center justify-center space-x-2 py-4 bg-brand-accent text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-accent-hover transition-all shadow-lg shadow-brand-accent/20"
                    >
                       <span>Nouvelle vente</span>
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
