import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, Users, TrendingUp, ShoppingBag, Database } from 'lucide-react';

interface AdminStats {
  total_users: number;
  total_sales: number;
  total_revenue: number;
  total_products: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchAdminStats();
  }, [user]);

  const fetchAdminStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Appel de la fonction RPC (Remote Procedure Call) configurée dans Supabase.
      // Cette fonction est exécutée côté serveur avec des privilèges étendus (SECURITY DEFINER)
      // pour permettre de compter dynamiquement toutes les données de la plateforme globale.
      const { data, error } = await supabase.rpc('get_superadmin_stats');
      
      if (error) {
        throw error;
      }

      setStats(data as AdminStats);
    } catch (err: any) {
      console.error('Admin Fetch Error:', err);
      // Fallback si la migration SQL n'a pas encore été passée
      setError("Synchronisation administrateur échouée. Assurez-vous d'avoir exécuté la migration SQL Superadmin.");
    } finally {
      setLoading(false);
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

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold inline-flex items-center text-brand-text mb-2">
            Superadmin <ShieldAlert className="ml-3 text-brand-accent" size={28} />
          </h1>
          <p className="text-brand-text-muted">Vue d'ensemble mondiale de la plateforme POS.</p>
        </div>
        <div className="hidden md:block px-4 py-2 bg-brand-surface border border-brand-border rounded-xl">
          <span className="text-xs text-brand-text-muted block">Connecté en tant que</span>
          <span className="text-sm font-bold text-brand-text">{user?.email}</span>
        </div>
      </div>

      {error ? (
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 text-center max-w-2xl mx-auto mt-12">
          <Database size={48} className="mx-auto text-brand-text-muted mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-brand-text mb-4">Configuration Requise</h3>
          <p className="text-brand-text-muted mb-6">{error}</p>
          <div className="text-left bg-[#0f141e] p-4 rounded-xl overflow-x-auto text-xs font-mono text-gray-300 border border-brand-border">
            <p className="text-brand-accent mb-2">-- Exécutez ce SQL dans Supabase pour corriger :</p>
            <code>
              CREATE OR REPLACE FUNCTION get_superadmin_stats()<br/>
              RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$<br/>
              DECLARE<br/>
                &nbsp;&nbsp;total_users INT;<br/>
                &nbsp;&nbsp;total_sales INT;<br/>
                &nbsp;&nbsp;total_revenue NUMERIC;<br/>
                &nbsp;&nbsp;total_products INT;<br/>
              BEGIN<br/>
                &nbsp;&nbsp;IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'deniskasala17@gmail.com' THEN<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;RAISE EXCEPTION 'Non autorisé';<br/>
                &nbsp;&nbsp;END IF;<br/>
                &nbsp;&nbsp;SELECT COUNT(*) INTO total_users FROM auth.users;<br/>
                &nbsp;&nbsp;SELECT COUNT(*) INTO total_sales FROM sales;<br/>
                &nbsp;&nbsp;SELECT COALESCE(SUM(total), 0) INTO total_revenue FROM sales;<br/>
                &nbsp;&nbsp;SELECT COUNT(*) INTO total_products FROM products;<br/>
                &nbsp;&nbsp;RETURN json_build_object('total_users', total_users, 'total_sales', total_sales, 'total_revenue', total_revenue, 'total_products', total_products);<br/>
              END;<br/>
              $$;
            </code>
          </div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[1,2,3,4].map(i => (
             <div key={i} className="h-32 bg-brand-surface rounded-2xl border border-brand-border"></div>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card: Users */}
          <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text-muted mb-1">Commerçants (Utilisateurs)</p>
                <h3 className="text-3xl font-bold text-brand-text">{stats.total_users}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                <Users size={24} />
              </div>
            </div>
          </div>

          {/* Card: Revenue */}
          <div className="bg-brand-surface rounded-2xl border border-brand-accent/30 p-6 flex flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full -mr-16 -mt-16 blur-xl"></div>
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-sm font-medium text-brand-text-muted mb-1">Revenu Global (Platforme)</p>
                <h3 className="text-3xl font-bold text-brand-accent">R {stats.total_revenue.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-brand-accent/10 text-brand-accent rounded-xl">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>

          {/* Card: Sales */}
          <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text-muted mb-1">Transactions Totales</p>
                <h3 className="text-3xl font-bold text-brand-text">{stats.total_sales}</h3>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                <ShoppingBag size={24} />
              </div>
            </div>
          </div>

          {/* Card: Products */}
          <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text-muted mb-1">Produits en base</p>
                <h3 className="text-3xl font-bold text-brand-text">{stats.total_products}</h3>
              </div>
              <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl">
                <Database size={24} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
