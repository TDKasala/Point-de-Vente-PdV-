import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  ShieldAlert, Users, TrendingUp, ShoppingBag, 
  Database, UserPlus, Search, MoreVertical, 
  Lock, Ban, ShieldCheck, Mail, MapPin, Phone,
  LayoutDashboard, Store, X, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminStats {
  total_users: number;
  total_sales: number;
  total_revenue: number;
  total_products: number;
}

interface Merchant {
  id: string;
  email: string;
  shop_name: string;
  phone: string;
  city: string;
  created_at: string;
  is_suspended: boolean;
  total_sales_count: number;
  total_revenue: number;
}

const ADMIN_SQL = `
-- 1. Tables & Profils
CREATE TABLE IF NOT EXISTS merchant_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  shop_name TEXT,
  phone TEXT,
  city TEXT,
  is_suspended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Fonction de création de marchand (Security Definer)
CREATE OR REPLACE FUNCTION admin_create_merchant(
  new_email TEXT, new_password TEXT, new_shop_name TEXT, new_phone TEXT, new_city TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Vérification Admin
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'deniskasala17@gmail.com' THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Création Auth User
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, instance_id)
  VALUES (new_email, crypt(new_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"shop_name":"' || new_shop_name || '"}', now(), now(), 'authenticated', '00000000-0000-0000-0000-000000000000')
  RETURNING id INTO new_user_id;

  -- Création Profile
  INSERT INTO merchant_profiles (id, shop_name, phone, city) 
  VALUES (new_user_id, new_shop_name, new_phone, new_city);

  RETURN json_build_object('id', new_user_id, 'status', 'success');
END; $$;

-- 3. Liste des boutiques avec stats
CREATE OR REPLACE FUNCTION list_all_merchants()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT json_agg(t) FROM (
    SELECT u.id, u.email, p.shop_name, p.phone, p.city, p.created_at, p.is_suspended,
      (SELECT count(*) FROM sales WHERE user_id = u.id) as total_sales_count,
      (SELECT COALESCE(sum(total), 0) FROM sales WHERE user_id = u.id) as total_revenue
    FROM auth.users u
    LEFT JOIN merchant_profiles p ON u.id = p.id
    ORDER BY p.created_at DESC
  ) t);
END; $$;

-- 4. Suspension de compte
CREATE OR REPLACE FUNCTION admin_toggle_suspension(target_user_id UUID, suspension_state BOOLEAN)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE merchant_profiles SET is_suspended = suspension_state WHERE id = target_user_id;
  RETURN json_build_object('status', 'success');
END; $$;

-- 5. Statistiques globales
CREATE OR REPLACE FUNCTION get_superadmin_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
   RETURN json_build_object(
     'total_users', (SELECT count(*) FROM auth.users),
     'total_sales', (SELECT count(*) FROM sales),
     'total_revenue', (SELECT COALESCE(sum(total), 0) FROM sales),
     'total_products', (SELECT count(*) FROM products)
   );
END; $$;
`;

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'merchants'>('overview');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [newMerchant, setNewMerchant] = useState({
    email: '',
    password: '',
    shop_name: '',
    phone: '',
    city: ''
  });

  useEffect(() => {
    if (!user) return;
    if (user.email === 'deniskasala17@gmail.com') {
      fetchAdminData();
    }
  }, [user, activeTab]);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'overview') {
        const { data, error: statsError } = await supabase.rpc('get_superadmin_stats');
        if (statsError) throw statsError;
        setStats(data as AdminStats);
      } else {
        // En prod, ceci devrait être un RPC sécurisé type 'get_admin_merchant_list'
        const { data, error: merchantsError } = await supabase.rpc('list_all_merchants');
        if (merchantsError) throw merchantsError;
        setMerchants(data || []);
      }
    } catch (err: any) {
      console.error('Admin Fetch Error:', err);
      setError("Certaines fonctionnalités admin nécessitent l'exécution du script SQL complet.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      // Appel d'un RPC sécurisé car le client anon ne peut pas créer d'autres users auth directement
      const { data, error } = await supabase.rpc('admin_create_merchant', {
         new_email: newMerchant.email,
         new_password: newMerchant.password,
         new_shop_name: newMerchant.shop_name,
         new_phone: newMerchant.phone,
         new_city: newMerchant.city
      });

      if (error) throw error;

      setSuccessMsg(`Boutique "${newMerchant.shop_name}" créée avec succès !`);
      setNewMerchant({ email: '', password: '', shop_name: '', phone: '', city: '' });
      setTimeout(() => {
        setIsAddModalOpen(false);
        setSuccessMsg('');
        fetchAdminData();
      }, 2000);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la création. Vérifiez que l'e-mail n'est pas déjà utilisé.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSuspension = async (merchantId: string, currentStatus: boolean) => {
    if (!window.confirm(currentStatus ? "Réactiver ce compte ?" : "Suspendre ce compte (accès bloqué) ?")) return;
    
    try {
      const { error } = await supabase.rpc('admin_toggle_suspension', {
        target_user_id: merchantId,
        suspension_state: !currentStatus
      });
      if (error) throw error;
      fetchAdminData();
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  if (user?.email !== 'deniskasala17@gmail.com') {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center bg-red-500/10 p-8 rounded-3xl border border-red-500/20 max-w-md">
          <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-brand-text mb-2">Accès Refusé</h2>
          <p className="text-brand-text-muted">Vous devez être l'administrateur principal pour voir cette page.</p>
        </div>
      </div>
    );
  }

  const filteredMerchants = merchants.filter(m => 
    (m.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto min-h-screen bg-brand-bg/10">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-brand-accent rounded-xl text-white shadow-lg shadow-brand-accent/20">
               <ShieldAlert size={24} />
            </div>
            <h1 className="text-3xl font-black text-brand-text tracking-tight uppercase">Centre de Contrôle</h1>
          </div>
          <p className="text-brand-text-muted font-medium">Gestion globale de la plateforme PdV • {user?.email}</p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-white p-1.5 rounded-2xl border border-brand-border flex shadow-sm">
           <button 
             onClick={() => setActiveTab('overview')}
             className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
               activeTab === 'overview' ? 'bg-brand-text text-white shadow-md' : 'text-brand-text-muted hover:text-brand-text'
             }`}
           >
             <LayoutDashboard size={14} />
             <span>VUE GLOBALE</span>
           </button>
           <button 
             onClick={() => setActiveTab('merchants')}
             className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
               activeTab === 'merchants' ? 'bg-brand-text text-white shadow-md' : 'text-brand-text-muted hover:text-brand-text'
             }`}
           >
             <Store size={14} />
             <span>BOUTIQUES</span>
           </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {error ? (
            <AdminSqlInstructions error={error} />
          ) : loading && !stats ? (
            <LoadingStats />
          ) : (
            <OverviewSection stats={stats!} />
          )}
        </>
      ) : (
        <div className="space-y-6">
           <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-md">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted" size={18} />
                 <input 
                   type="text" 
                   placeholder="Rechercher une boutique, e-mail..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-12 pr-4 py-3.5 bg-white border border-brand-border rounded-2xl focus:outline-none focus:border-brand-accent transition-all text-sm font-bold"
                 />
              </div>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="w-full sm:w-auto bg-brand-accent hover:bg-brand-accent-hover text-white px-8 py-3.5 rounded-2xl font-black text-xs tracking-widest transition-all shadow-xl shadow-brand-accent/20 flex items-center justify-center space-x-2"
              >
                <UserPlus size={18} />
                <span>ONBOARDING BOUTIQUE</span>
              </button>
           </div>

           {loading && merchants.length === 0 ? (
             <div className="h-64 flex flex-col items-center justify-center space-y-4 bg-white border border-brand-border rounded-3xl">
                <div className="w-10 h-10 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Récupération des comptes...</p>
             </div>
           ) : filteredMerchants.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center bg-white border border-brand-border border-dashed rounded-3xl">
                 <Store size={40} className="text-brand-text-muted opacity-20 mb-4" />
                 <p className="text-sm font-bold text-brand-text-muted italic">Aucune boutique trouvée.</p>
              </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {filteredMerchants.map(merchant => (
                   <MerchantCard 
                     key={merchant.id} 
                     merchant={merchant} 
                     onToggleSuspension={toggleSuspension}
                   />
                ))}
             </div>
           )}
        </div>
      )}

      {/* Onboarding Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-text/60 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-brand-border"
             >
                <div className="p-8 border-b border-brand-border bg-brand-bg/30 flex justify-between items-center">
                   <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-brand-accent/10 text-brand-accent rounded-xl">
                        <UserPlus size={20} />
                      </div>
                      <h2 className="text-xl font-black text-brand-text tracking-tight uppercase">Nouveau Commerçant</h2>
                   </div>
                   <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-brand-bg rounded-lg transition-colors text-brand-text-muted">
                      <X size={20} />
                   </button>
                </div>

                {successMsg ? (
                   <div className="p-20 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mb-6 shadow-xl">
                         <Check size={32} />
                      </div>
                      <p className="text-lg font-black text-brand-text mb-2 uppercase tracking-tight">{successMsg}</p>
                      <p className="text-xs text-brand-text-muted">Le compte est actif et prêt à l'emploi.</p>
                   </div>
                ) : (
                  <form onSubmit={handleCreateMerchant} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">E-mail de connexion</label>
                        <input 
                          type="email" required
                          value={newMerchant.email}
                          onChange={(e) => setNewMerchant({...newMerchant, email: e.target.value})}
                          className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border rounded-2xl focus:outline-none focus:border-brand-accent font-bold"
                          placeholder="ex: boutique@test.com"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">Mot de passe provisoire</label>
                        <input 
                          type="password" required minLength={6}
                          value={newMerchant.password}
                          onChange={(e) => setNewMerchant({...newMerchant, password: e.target.value})}
                          className="w-full px-4 py-3.5 bg-brand-bg border border-brand-border rounded-2xl focus:outline-none focus:border-brand-accent font-bold"
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">Nom de la Boutique</label>
                        <input 
                          type="text" required
                          value={newMerchant.shop_name}
                          onChange={(e) => setNewMerchant({...newMerchant, shop_name: e.target.value})}
                          className="w-full px-4 py-3.5 bg-white border border-brand-border rounded-2xl focus:outline-none focus:border-brand-accent font-bold"
                          placeholder="Nom de l'enseigne"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">Téléphone</label>
                        <input 
                          type="text"
                          value={newMerchant.phone}
                          onChange={(e) => setNewMerchant({...newMerchant, phone: e.target.value})}
                          className="w-full px-4 py-3.5 bg-white border border-brand-border rounded-2xl focus:outline-none focus:border-brand-accent font-bold"
                          placeholder="0X XX XX XX XX"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">Ville</label>
                        <input 
                          type="text"
                          value={newMerchant.city}
                          onChange={(e) => setNewMerchant({...newMerchant, city: e.target.value})}
                          className="w-full px-4 py-3.5 bg-white border border-brand-border rounded-2xl focus:outline-none focus:border-brand-accent font-bold"
                          placeholder="Paris, Bamako..."
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-brand-text text-white py-5 rounded-3xl font-black text-xs tracking-[0.2em] hover:bg-black transition-all shadow-xl disabled:opacity-50 mt-4"
                    >
                      {isProcessing ? 'CRÉATION EN COURS...' : 'VALIDER L\'ONBOARDING'}
                    </button>
                  </form>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OverviewSection({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard 
        label="Commerçants Actifs" 
        value={stats.total_users} 
        icon={<Users size={24} />} 
        color="blue" 
      />
      <StatCard 
        label="Revenu Global" 
        value={`${stats.total_revenue.toFixed(2)} R`} 
        icon={<TrendingUp size={24} />} 
        color="brand" 
        featured
      />
      <StatCard 
        label="Transactions" 
        value={stats.total_sales} 
        icon={<ShoppingBag size={24} />} 
        color="purple" 
      />
      <StatCard 
        label="Produits Indexés" 
        value={stats.total_products} 
        icon={<Database size={24} />} 
        color="orange" 
      />
    </div>
  );
}

function StatCard({ label, value, icon, color, featured }: { label: string, value: string | number, icon: React.ReactNode, color: string, featured?: boolean }) {
  const colorClasses: any = {
    blue: "bg-blue-500/10 text-blue-500",
    brand: "bg-brand-accent/10 text-brand-accent",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500"
  };

  return (
    <div className={`bg-white rounded-3xl border border-brand-border p-8 flex flex-col justify-between relative overflow-hidden transition-all hover:border-brand-accent/30 group ${featured ? 'border-brand-accent/20' : ''}`}>
       {featured && <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>}
       <div className="flex items-start justify-between relative z-10">
         <div>
           <p className="text-[10px] font-black text-brand-text-muted mb-3 uppercase tracking-widest opacity-60">{label}</p>
           <h3 className={`text-4xl font-black text-brand-text tracking-tighter ${featured ? 'text-brand-accent' : ''}`}>{value}</h3>
         </div>
         <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${colorClasses[color]}`}>
           {icon}
         </div>
       </div>
    </div>
  );
}

function MerchantCard({ merchant, onToggleSuspension }: { merchant: Merchant, onToggleSuspension: any, key?: string }) {
  return (
    <div className={`bg-white border rounded-[2rem] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all hover:shadow-xl hover:shadow-brand-accent/5 ${merchant.is_suspended ? 'border-red-200 opacity-80' : 'border-brand-border'}`}>
       <div className="flex items-start space-x-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-black ${merchant.is_suspended ? 'bg-red-100 text-red-500' : 'bg-brand-bg text-brand-text'}`}>
             {(merchant.shop_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
             <div className="flex items-center space-x-3">
               <h3 className="text-lg font-black text-brand-text leading-tight">{merchant.shop_name}</h3>
               {merchant.is_suspended && (
                 <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Suspendu</span>
               )}
               {merchant.email === 'deniskasala17@gmail.com' && (
                 <span className="bg-brand-accent text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Admin</span>
               )}
             </div>
             <div className="flex flex-wrap gap-4 text-xs font-bold text-brand-text-muted">
                <span className="flex items-center"><Mail size={12} className="mr-1.5 opacity-50" /> {merchant.email}</span>
                <span className="flex items-center"><Phone size={12} className="mr-1.5 opacity-50" /> {merchant.phone || 'Non renseigné'}</span>
                <span className="flex items-center"><MapPin size={12} className="mr-1.5 opacity-50" /> {merchant.city || 'Non renseigné'}</span>
             </div>
          </div>
       </div>

       <div className="flex flex-wrap items-center gap-6 lg:border-l lg:pl-10 lg:border-brand-border/10">
          <div className="flex flex-col">
             <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest mb-1 opacity-50">Volume Ventes</span>
             <span className="font-black text-brand-text leading-none">{merchant.total_revenue.toFixed(2)} R</span>
             <span className="text-[9px] font-bold text-brand-text-muted mt-1">{merchant.total_sales_count} Transactions</span>
          </div>

          <div className="flex space-x-2">
             <button 
                onClick={() => onToggleSuspension(merchant.id, merchant.is_suspended)}
                className={`p-3 rounded-2xl transition-all ${
                   merchant.is_suspended 
                   ? 'bg-green-50 text-green-500 hover:bg-green-100' 
                   : 'bg-red-50 text-red-500 hover:bg-red-100'
                }`}
                title={merchant.is_suspended ? "Réactiver compte" : "Suspendre compte"}
             >
                {merchant.is_suspended ? <ShieldCheck size={20} /> : <Ban size={20} />}
             </button>
             <button 
               onClick={() => alert("Fonctionnalité : Envoyer email de reset à " + merchant.email)}
               className="p-3 bg-brand-bg text-brand-text-muted hover:text-brand-text hover:bg-brand-border/20 rounded-2xl transition-all"
               title="Réinitialiser MDP"
             >
                <Lock size={20} />
             </button>
             <button className="p-3 bg-brand-bg text-brand-text-muted hover:text-brand-text hover:bg-brand-border/20 rounded-2xl transition-all">
                <MoreVertical size={20} />
             </button>
          </div>
       </div>
    </div>
  );
}

function AdminSqlInstructions({ error }: { error: string }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-3xl p-8 text-center max-w-2xl mx-auto mt-6 shadow-sm">
      <Database size={48} className="mx-auto text-brand-text-muted mb-6 opacity-30" />
      <h3 className="text-2xl font-black text-brand-text mb-4 uppercase tracking-tight">Installation de l'Infrastructure Admin</h3>
      <p className="text-brand-text-muted mb-8 leading-relaxed font-medium">Pour activer la gestion des boutiques et l'onboarding, exécutez le script SQL complet dans votre console Supabase.</p>
      
      <div className="text-left bg-[#0f141e] p-6 rounded-2xl overflow-x-auto text-xs font-mono text-gray-300 border border-brand-border shadow-2xl">
        <pre className="whitespace-pre-wrap">
          {ADMIN_SQL}
        </pre>
      </div>
    </div>
  );
}

function LoadingStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
      {[1,2,3,4].map(i => (
         <div key={i} className="h-40 bg-white rounded-3xl border border-brand-border"></div>
      ))}
    </div>
  );
}
