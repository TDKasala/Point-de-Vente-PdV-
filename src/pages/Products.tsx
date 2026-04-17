import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Product } from '../store/useStore';

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    barcode: '',
    image_url: ''
  });

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
      console.error('Fetch products error:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        price: product.price.toString(),
        stock: product.stock.toString(),
        barcode: product.barcode || '',
        image_url: product.image_url || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', price: '', stock: '', barcode: '', image_url: '' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let finalImageUrl = formData.image_url.trim();

    if (!finalImageUrl && formData.name.trim()) {
      // Génère une icône abstraite unique en fonction du nom du produit via DiceBear
      // et l'intègre parfaitement avec notre thème "Elegant Dark" (Fond: #1F2937, Accent: #10B981 etc.)
      const seedName = encodeURIComponent(formData.name.trim());
      finalImageUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${seedName}&backgroundColor=1F2937&shape1Color=10b981&shape2Color=4b5563&shape3Color=9ca3af`;
    }

    const productData = {
      name: formData.name,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock, 10),
      barcode: formData.barcode,
      image_url: finalImageUrl,
      user_id: user.id
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);
      
      if (error) alert(error.message);
    } else {
      const { error } = await supabase
        .from('products')
        .insert([productData]);
        
      if (error) alert(error.message);
    }

    closeModal();
    fetchProducts();
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
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-brand-text mb-2">Gestion des produits</h1>
          <p className="text-brand-text-muted">Ajoutez et modifiez vos articles</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-brand-accent hover:bg-brand-accent-hover text-white px-6 py-3 rounded-xl flex items-center w-full sm:w-auto justify-center font-bold transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Ajouter un produit
        </button>
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
                      <span className="text-base font-bold text-brand-accent">R {product.price.toFixed(2)}</span>
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
                    <label className="block text-sm font-semibold text-brand-text-muted mb-2">Prix (R)</label>
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
                  <label className="block text-sm font-semibold text-brand-text-muted mb-2">URL de l'image (optionnel)</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors"
                    placeholder="https://..."
                  />
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
    </div>
  );
}
