import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, FolderTree, Tag, Check, History, ArrowRight, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';

interface Category {
  id: string;
  name: string;
  user_id: string;
}

interface ProductHistory {
  id: string;
  created_at: string;
  change_type: 'price' | 'stock' | 'initial';
  old_value: number | null;
  new_value: number;
  notes: string | null;
  user_id: string;
}

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [productHistory, setProductHistory] = useState<ProductHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currency, setCurrency] = useState('R');

  const [categoryFormData, setCategoryFormData] = useState({ name: '' });
  const [categorySuccess, setCategorySuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    barcode: '',
    image_url: '',
    category: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_settings').select('currency_symbol').eq('user_id', user.id).single();
    if (data?.currency_symbol) setCurrency(data.currency_symbol);
  };

  const fetchProducts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    
    if (error) {
      console.error('Fetch products error:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) {
        // Fallback or handle error if table doesn't exist
        console.warn('Note: La table product_categories n\'existe peut-être pas encore.');
        setCategories([]);
      } else {
        setCategories(data || []);
      }
    } catch (err) {
      console.error('Fetch categories catch:', err);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        price: product.price.toString(),
        stock: product.stock.toString(),
        barcode: product.barcode || '',
        image_url: product.image_url || '',
        category: product.category || ''
      });
    } else {
      setEditingProduct(null);
      // Default to "Général" or the first category available
      const defaultCat = categories.length > 0 ? categories[0].name : 'Général';
      setFormData({ name: '', price: '', stock: '', barcode: '', image_url: '', category: defaultCat });
    }
    setModalOpen(true);
  };

  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({ name: category.name });
    } else {
      setEditingCategory(null);
      setCategoryFormData({ name: '' });
    }
    setCategoryModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const catData = {
      name: categoryFormData.name,
      user_id: user.id
    };

    try {
      if (editingCategory) {
        // If renaming, we should also update existing products using this category name
        if (editingCategory.name !== categoryFormData.name) {
          await supabase
            .from('products')
            .update({ category: categoryFormData.name })
            .eq('user_id', user.id)
            .eq('category', editingCategory.name);
        }

        const { error } = await supabase
          .from('product_categories')
          .update(catData)
          .eq('id', editingCategory.id);
        if (error) throw error;
        setCategorySuccess('Catégorie mise à jour !');
      } else {
        const { error } = await supabase
          .from('product_categories')
          .insert([catData]);
        if (error) throw error;
        setCategorySuccess('Catégorie ajoutée !');
      }
      
      setCategoryFormData({ name: '' });
      setEditingCategory(null);
      fetchCategories();
      fetchProducts(); // Refresh products in case names changed
      
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (error: any) {
      alert("Erreur lors de l'enregistrement de la catégorie.");
      console.error(error);
    }
  };

  const handleCategoryDelete = async (id: string, name: string) => {
    if (window.confirm(`Supprimer la catégorie "${name}" ? Les produits associés seront réinitialisés en catégorie "Général".`)) {
      try {
        // Reset products to 'Général'
        await supabase
          .from('products')
          .update({ category: 'Général' })
          .eq('user_id', user.id)
          .eq('category', name);

        const { error } = await supabase
          .from('product_categories')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        fetchCategories();
        fetchProducts();
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0 || !user) return;
      const file = e.target.files[0];
      
      // Check file size (max 1MB = 1048576 bytes)
      if (file.size > 1048576) {
        alert("L'image est trop grande. La taille maximale est de 1 Mo.");
        return;
      }
      
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product_images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('product_images')
        .getPublicUrl(filePath);

      if (data.publicUrl) {
          setFormData({ ...formData, image_url: data.publicUrl });
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'upload:', error);
      alert("Erreur lors de l'envoi de l'image. Assurez-vous d'avoir exécuté la requête SQL de création du bucket de stockage (product_images).");
    } finally {
      setUploadingImage(false);
    }
  };

  const fetchProductHistory = async (product: Product) => {
    if (!user) return;
    setLoadingHistory(true);
    setHistoryProduct(product);
    setHistoryModalOpen(true);
    
    try {
      const { data, error } = await supabase
        .from('product_history')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProductHistory(data || []);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const logProductHistory = async (productId: string, type: 'price' | 'stock' | 'initial', oldValue: number | null, newValue: number, notes?: string) => {
    if (!user) return;
    const { error } = await supabase.from('product_history').insert([{
      product_id: productId,
      user_id: user.id,
      change_type: type,
      old_value: oldValue,
      new_value: newValue,
      notes: notes || null
    }]);
    if (error) console.error('History logging error:', error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let finalImageUrl = formData.image_url.trim();

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock, 10);

    const productData = {
      name: formData.name,
      price: price,
      stock: stock,
      barcode: formData.barcode || null,
      image_url: finalImageUrl || null,
      category: formData.category || 'Général',
      user_id: user.id
    };

    try {
      if (editingProduct) {
        // Track changes
        const priceChanged = editingProduct.price !== price;
        const stockChanged = editingProduct.stock !== stock;

        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        
        if (error) throw error;

        if (priceChanged) {
          await logProductHistory(editingProduct.id, 'price', editingProduct.price, price, 'Mise à jour manuelle');
        }
        if (stockChanged) {
          await logProductHistory(editingProduct.id, 'stock', editingProduct.stock, stock, 'Mise à jour manuelle');
        }
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();
          
        if (error) throw error;

        // Log initial creation
        if (data) {
          await logProductHistory(data.id, 'initial', null, stock, 'Création du produit');
          if (price > 0) {
            await logProductHistory(data.id, 'price', null, price, 'Prix initial');
          }
        }
      }

      closeModal();
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce produit ?')) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) {
        alert(error.message);
      } else {
        fetchProducts();
      }
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-brand-text mb-2">Catalogue Articles</h1>
          <p className="text-brand-text-muted">Gérez vos produits et vos catégories</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="bg-brand-surface border border-brand-border hover:bg-brand-surface-light text-brand-text px-6 py-3 rounded-xl flex items-center justify-center font-bold transition-all shadow-sm group"
          >
            <FolderTree size={18} className="mr-2 text-brand-text-muted group-hover:text-brand-accent transition-colors" />
            Catégories
          </button>
          <button
            onClick={() => openModal()}
            className="bg-brand-accent hover:bg-brand-accent-hover text-white px-6 py-3 rounded-xl flex items-center justify-center font-bold shadow-lg shadow-brand-accent/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={20} className="mr-2" />
            Nouveau Produit
          </button>
        </div>
      </div>

      <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-brand-text-muted">Chargement...</div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center text-brand-text-muted flex flex-col items-center">
             <div className="bg-brand-surface-light p-6 rounded-2xl mb-6">
                <Plus size={40} className="text-brand-text-muted opacity-50" />
             </div>
             <p className="text-xl font-bold text-brand-text">Aucun produit.</p>
             <p className="text-brand-text-muted mt-2">Commencez par ajouter votre premier article.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-surface-light hidden sm:table-header-group">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-brand-text-muted uppercase tracking-wider">Produit</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-brand-text-muted uppercase tracking-wider">Prix</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-brand-text-muted uppercase tracking-wider">Stock</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-brand-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-brand-surface divide-y divide-brand-border flex sm:table-row-group flex-col">
                {products.map((product) => (
                  <tr key={product.id} className="flex sm:table-row flex-col sm:flex-row p-6 sm:p-0 hover:bg-brand-surface-light/50 transition-colors">
                    <td className="px-2 sm:px-6 py-2 sm:py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        {product.image_url ? (
                          <img className="h-14 w-14 rounded-xl bg-brand-surface-light object-cover" src={product.image_url} alt="" />
                        ) : (
                          <div className="h-14 w-14 rounded-xl bg-brand-surface-light border border-brand-border flex items-center justify-center text-brand-text-muted">
                            <ImageIcon size={24} className="opacity-50" />
                          </div>
                        )}
                        <div className="ml-5">
                          <div className="text-base font-bold text-brand-text">{product.name}</div>
                          {product.barcode && <div className="text-sm text-brand-text-muted mt-1">Code: {product.barcode}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 py-1 sm:py-5 whitespace-nowrap">
                      <span className="sm:hidden text-xs text-brand-text-muted mr-2">Prix:</span>
                      <span className="text-base font-bold text-brand-accent">{product.price.toFixed(2)} {currency}</span>
                    </td>
                    <td className="px-2 sm:px-6 py-1 sm:py-5 whitespace-nowrap">
                      <span className="sm:hidden text-xs text-brand-text-muted mr-2">Stock:</span>
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-lg ${
                        product.stock > 10 ? 'bg-brand-accent/20 text-brand-accent' : product.stock > 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'
                      }`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-2 sm:px-6 mt-4 sm:mt-0 py-2 sm:py-5 whitespace-nowrap text-right text-sm font-medium flex justify-end space-x-2 border-t sm:border-0 border-brand-border pt-4 sm:pt-4">
                      <button 
                        onClick={() => fetchProductHistory(product)} 
                        className="text-brand-text-muted hover:text-brand-accent bg-brand-surface-light p-2 rounded-lg transition-colors"
                        title="Historique des changements"
                      >
                        <History size={20} />
                      </button>
                      <button onClick={() => openModal(product)} className="text-brand-text-muted hover:text-white bg-brand-surface-light p-2 rounded-lg transition-colors">
                        <Edit2 size={20} />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 p-2 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface rounded-2xl border border-brand-border w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-brand-border">
              <h2 className="text-xl font-bold text-brand-text">{editingProduct ? 'Modifier produit' : 'Nouveau produit'}</h2>
              <button onClick={closeModal} className="text-brand-text-muted hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-brand-text-muted mb-2">Nom du produit</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text-muted mb-2">Prix ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text-muted mb-2">Stock initial</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text-muted mb-2">Code barre (optionnel)</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text-muted mb-2">Catégorie</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors appearance-none"
                    >
                      {categories.length === 0 ? (
                        <option value="Général">Général</option>
                      ) : (
                        <>
                          <option value="Général">Général</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-brand-text-muted mb-2 flex justify-between">
                    <span>Photo du produit</span>
                    <span className="font-normal opacity-70">Max 1MB</span>
                  </label>
                  
                  {formData.image_url ? (
                    <div className="bg-brand-bg border border-brand-border rounded-xl p-4 flex items-center space-x-4">
                       <div className="relative group">
                         <img src={formData.image_url} alt="Preview" className="h-20 w-20 object-cover rounded-xl border border-brand-border bg-brand-surface-light shadow-sm" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                            <span className="text-[10px] text-white font-bold uppercase tracking-wider">Aperçu</span>
                         </div>
                       </div>
                       <div className="flex-1 space-y-2">
                          <p className="text-xs text-brand-text-muted truncate max-w-[180px]">Image configurée</p>
                          <div className="flex space-x-2">
                            <label className="cursor-pointer flex-1 bg-white hover:bg-brand-surface-light border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-center">
                              Changer
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploadingImage}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, image_url: ''})}
                              className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                               Supprimer
                            </button>
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <label className={`cursor-pointer bg-brand-bg hover:bg-brand-surface-light border-2 border-dashed border-brand-border text-brand-text-muted flex flex-col items-center justify-center p-8 rounded-xl transition-all ${uploadingImage ? 'opacity-50 cursor-wait' : 'hover:border-brand-accent/50'}`}>
                        <div className="p-3 bg-brand-surface rounded-full mb-3 shadow-sm">
                          <ImageIcon size={28} className="text-brand-text-muted" />
                        </div>
                        <span className="text-sm font-bold text-brand-text">Ajouter une photo</span>
                        <span className="text-xs mt-1 text-brand-text-muted">JPG, PNG ou WebP</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center">
                           <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-2"></div>
                           <p className="text-xs font-bold text-brand-accent">Téléversement...</p>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-brand-text-muted italic">
                    Assurez-vous que le bucket <code className="bg-brand-surface-light px-1 rounded">product_images</code> est créé dans Supabase.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex space-x-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-transparent py-4 px-4 border border-brand-border rounded-xl text-base font-bold text-brand-text hover:bg-brand-surface-light focus:outline-none transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-accent py-4 px-4 rounded-xl text-base font-bold text-white hover:bg-brand-accent-hover focus:outline-none transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Category Management Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-brand-surface rounded-3xl border border-brand-border w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-brand-border bg-brand-surface-light/50">
              <div className="flex items-center space-x-3">
                 <div className="p-2 bg-brand-accent/10 rounded-xl text-brand-accent">
                    <FolderTree size={20} />
                 </div>
                 <h2 className="text-xl font-bold text-brand-text tracking-tight uppercase">Gestion des Catégories</h2>
              </div>
              <button 
                onClick={() => setCategoryModalOpen(false)} 
                className="text-brand-text-muted hover:text-white transition-colors bg-brand-surface p-2 rounded-xl border border-brand-border"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
               {categorySuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-green-50 border border-green-100 text-green-600 rounded-xl text-xs font-bold flex items-center"
                  >
                    <Check size={14} className="mr-2" />
                    {categorySuccess}
                  </motion.div>
               )}
               {/* Quick Add Form */}
               <form onSubmit={handleCategorySubmit} className="mb-8 p-4 bg-brand-bg rounded-2xl border border-brand-border/50">
                  <label className="block text-xs font-black text-brand-text-muted uppercase tracking-widest mb-3">
                     {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie rapide'}
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Nom de la catégorie..."
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ name: e.target.value })}
                      className="flex-1 px-4 py-3 bg-white border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-all"
                    />
                    <button
                      type="submit"
                      className="bg-brand-accent hover:bg-brand-accent-hover text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-brand-accent/10 whitespace-nowrap"
                    >
                      {editingCategory ? 'Mettre à jour' : 'Ajouter'}
                    </button>
                    {editingCategory && (
                       <button
                         type="button"
                         onClick={() => { setEditingCategory(null); setCategoryFormData({ name: '' }); }}
                         className="px-4 py-3 text-brand-text-muted hover:text-brand-text font-bold"
                       >
                         Annuler
                       </button>
                    )}
                  </div>
               </form>

               {/* Categories List */}
               <div className="space-y-3">
                  <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest mb-2 px-1">Liste des catégories</h3>
                  {categories.length === 0 ? (
                     <div className="text-center py-12 border border-dashed border-brand-border rounded-2xl bg-brand-bg/30">
                        <Tag size={32} className="mx-auto text-brand-text-muted opacity-20 mb-3" />
                        <p className="text-sm font-bold text-brand-text-muted italic">Aucune catégorie personnalisée créée.</p>
                     </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {categories.map((cat) => (
                          <div key={cat.id} className="p-4 bg-white border border-brand-border rounded-2xl flex items-center justify-between group hover:border-brand-accent/30 transition-all hover:shadow-md">
                             <div className="flex items-center space-x-3">
                                <div className="p-2 bg-brand-bg rounded-lg text-brand-text-muted">
                                   <Tag size={14} />
                                </div>
                                <span className="font-bold text-brand-text">{cat.name}</span>
                             </div>
                             <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setEditingCategory(cat); setCategoryFormData({ name: cat.name }); }}
                                  className="p-2 text-brand-text-muted hover:text-brand-accent rounded-lg hover:bg-brand-accent/5"
                                  title="Modifier"
                                >
                                   <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleCategoryDelete(cat.id, cat.name)}
                                  className="p-2 text-red-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                                  title="Supprimer"
                                >
                                   <Trash2 size={16} />
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>

            <div className="p-6 border-t border-brand-border bg-brand-bg/50">
               <p className="text-[10px] text-brand-text-muted italic text-center">
                  Les catégories vous aident à organiser vos produits sur le terminal de vente.
               </p>
            </div>
          </div>
        </div>
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface rounded-2xl border border-brand-border w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-brand-border shrink-0">
              <div className="flex items-center">
                <div className="bg-brand-accent/10 p-2 rounded-lg mr-3">
                  <History className="text-brand-accent" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-brand-text">Historique de l'article</h2>
                  <p className="text-xs text-brand-text-muted">{historyProduct?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setHistoryModalOpen(false)} 
                className="text-brand-text-muted hover:text-white transition-colors p-2 bg-brand-surface-light rounded-xl"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-brand-bg/20">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12">
                   <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                   <p className="text-brand-text-muted">Chargement de l'historique...</p>
                </div>
              ) : productHistory.length === 0 ? (
                <div className="text-center py-12 px-6">
                   <div className="bg-brand-surface-light w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-border">
                      <History size={32} className="text-brand-text-muted opacity-30" />
                   </div>
                   <h3 className="text-lg font-bold text-brand-text mb-1">Aucun historique disponible</h3>
                   <p className="text-brand-text-muted text-sm">Les changements de prix et de stock seront enregistrés ici à l'avenir.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-brand-border -z-10" />
                  <div className="space-y-6">
                    {productHistory.map((item) => (
                      <div key={item.id} className="relative pl-12">
                        <div className={`absolute left-[13px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-brand-surface ${
                          item.change_type === 'price' ? 'bg-brand-accent' : 
                          item.change_type === 'initial' ? 'bg-purple-500' : 'bg-blue-500'
                        }`} />
                        
                        <div className="bg-brand-surface border border-brand-border rounded-xl p-4 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                             <div className="flex items-center space-x-2">
                               <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-md ${
                                 item.change_type === 'price' ? 'bg-brand-accent/10 text-brand-accent' : 
                                 item.change_type === 'initial' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                               }`}>
                                 {item.change_type === 'price' ? 'Prix' : item.change_type === 'stock' ? 'Stock' : 'Création'}
                               </span>
                               <span className="text-xs text-brand-text-muted">
                                 {new Date(item.created_at).toLocaleString('fr-FR', {
                                   day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                 })}
                               </span>
                             </div>
                             <div className="flex items-center text-[10px] text-brand-text-muted bg-brand-bg px-2 py-1 rounded-lg border border-brand-border">
                               <UserIcon size={12} className="mr-1.5 opacity-50" />
                               {item.user_id.substring(0, 8)}
                             </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            {item.old_value !== null ? (
                              <div className="flex items-center space-x-3">
                                <span className="text-sm line-through text-brand-text-muted decoration-red-400/50">
                                  {item.change_type === 'price' ? `${item.old_value.toFixed(2)} ${currency}` : item.old_value}
                                </span>
                                <ArrowRight size={14} className="text-brand-text-muted" />
                                <span className="text-lg font-bold text-brand-text">
                                  {item.change_type === 'price' ? `${item.new_value.toFixed(2)} ${currency}` : item.new_value}
                                </span>
                              </div>
                            ) : (
                              <span className="text-lg font-bold text-brand-text">
                                {item.change_type === 'price' ? `${item.new_value.toFixed(2)} ${currency}` : item.new_value}
                              </span>
                            )}
                          </div>

                          {item.notes && (
                            <p className="mt-3 text-[11px] text-brand-text-muted italic bg-brand-bg/50 p-2 rounded-lg">
                              Note : {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-brand-border bg-brand-bg shrink-0">
               <button 
                 onClick={() => setHistoryModalOpen(false)}
                 className="w-full bg-brand-surface border border-brand-border text-brand-text py-3 rounded-xl font-bold hover:bg-brand-surface-light transition-colors"
               >
                 Fermer
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
