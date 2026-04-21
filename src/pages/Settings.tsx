import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Settings as SettingsIcon, Save, KeyRound, Globe, Wallet, Trash2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    store_name: '',
    pin_code: '',
    currency_symbol: 'R'
  });

  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (data) {
          setFormData({
            store_name: data.store_name || '',
            pin_code: data.pin_code || '',
            currency_symbol: data.currency_symbol || 'R'
          });
        }
        
        const queue = JSON.parse(localStorage.getItem('offline_sales_queue') || '[]');
        setOfflineCount(queue.length);
      } catch (e) {
        console.error("Error fetching settings", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccess('');
    
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...formData
        });
        
      if (error) throw error;
      setSuccess('Paramètres enregistrés avec succès !');
      setTimeout(() => setSuccess(''), 3000);
      
      // Update local storage if needed
      if (formData.pin_code) {
         // This helps immediate UI feedback
      }
    } catch (e: any) {
      alert("Erreur lors de l'enregistrement: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const clearQueue = () => {
    if (window.confirm("Voulez-vous vraiment supprimer toutes les ventes en attente localement ? Cette action est irréversible.")) {
      localStorage.removeItem('offline_sales_queue');
      setOfflineCount(0);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-brand-text-muted">Chargement des paramètres...</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text mb-2 flex items-center">
          <SettingsIcon className="mr-3 text-brand-accent" size={32} />
          Paramètres
        </h1>
        <p className="text-brand-text-muted">Gérez les préférences de votre boutique et la sécurité.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Form */}
        <div className="md:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-brand-text mb-6 flex items-center border-b border-brand-border pb-4">
              <Globe className="mr-2 text-brand-accent" size={20} />
              Général
            </h2>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-brand-text-muted mb-2">Nom de la boutique</label>
                <input
                  type="text"
                  value={formData.store_name}
                  onChange={(e) => setFormData({...formData, store_name: e.target.value})}
                  placeholder="Ma Boutique de Luxe"
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-text-muted mb-2">Symbole monétaire</label>
                <input
                  type="text"
                  value={formData.currency_symbol}
                  onChange={(e) => setFormData({...formData, currency_symbol: e.target.value})}
                  placeholder="R, $, €, FCFA..."
                  className="w-24 px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors"
                />
              </div>

              <div className="pt-4">
                <h2 className="text-lg font-bold text-brand-text mb-6 flex items-center border-b border-brand-border pb-4">
                  <KeyRound className="mr-2 text-brand-accent" size={20} />
                  Sécurité
                </h2>
                <div>
                  <label className="block text-sm font-semibold text-brand-text-muted mb-2">Code PIN Gérant (min 4 chiffres)</label>
                  <input
                    type="password"
                    pattern="\d*"
                    value={formData.pin_code}
                    onChange={(e) => setFormData({...formData, pin_code: e.target.value})}
                    placeholder="****"
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text transition-colors font-mono tracking-widest"
                  />
                  <p className="mt-2 text-xs text-brand-text-muted">Ce code permet de basculer du Mode Caissier au Mode Gérant.</p>
                </div>
              </div>

              {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-600 px-4 py-3 rounded-xl text-sm font-medium animate-pulse">
                  {success}
                </div>
              )}

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full md:w-auto px-10 py-4 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-xl font-bold flex items-center justify-center transition-all disabled:opacity-50"
                >
                  <Save className="mr-2" size={20} />
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Right Column: Maintenance / Info */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-brand-text mb-4 flex items-center">
              <Wallet className="mr-2 text-blue-500" size={20} />
              Stockage Local
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-brand-text-muted">Ventes hors-ligne :</span>
                <span className={`font-bold ${offlineCount > 0 ? 'text-orange-500' : 'text-brand-text'}`}>
                  {offlineCount}
                </span>
              </div>
              <button 
                onClick={clearQueue}
                disabled={offlineCount === 0}
                className="w-full flex items-center justify-center px-4 py-2 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 py-3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={16} className="mr-2" />
                Vider la file d'attente
              </button>
              <p className="text-[10px] text-brand-text-muted mt-2">
                Utilisez cette option si vous avez des données corrompues qui ne peuvent pas être synchronisées.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-brand-text mb-4 flex items-center">
              <RefreshCw className="mr-2 text-brand-accent" size={20} />
              Info Système
            </h2>
            <div className="text-xs space-y-2 text-brand-text-muted">
              <p>Email : <span className="text-brand-text">{user?.email}</span></p>
              <p>Rôle : <span className="text-brand-text">Gérant / Propriétaire</span></p>
              <p>PWA : <span className="text-green-500 font-bold">Activée</span></p>
              <p>Vite : <span className="text-brand-text">v6.x</span></p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
