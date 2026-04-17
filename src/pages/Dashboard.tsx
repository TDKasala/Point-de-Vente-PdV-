import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface DashboardStats {
  todaySalesCount: number;
  todayRevenue: number;
  lowStockItems: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todaySalesCount: 0,
    todayRevenue: 0,
    lowStockItems: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: sales, error: salesError } = await supabase
          .from('sales')
          .select('total')
          .gte('created_at', today.toISOString())
          .eq('user_id', user.id);

        if (salesError) throw salesError;

        const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;

        const { count: lowStockCount, error: stockError } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .lt('stock', 5)
          .eq('user_id', user.id);

        if (stockError) throw stockError;

        setStats({
          todaySalesCount: sales?.length || 0,
          todayRevenue: totalRevenue,
          lowStockItems: lowStockCount || 0,
        });

      } catch (error) {
        console.error("Erreur lors de la récupération des statistiques", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Tableau de bord</h1>
        <p className="text-brand-text-muted">Aperçu de vos activités aujourd'hui.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-brand-surface rounded-2xl border border-transparent hover:border-brand-border transition-colors p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-text-muted mb-1">Ventes du jour</p>
              <h3 className="text-3xl font-bold text-brand-text">
                {loading ? '-' : stats.todaySalesCount}
              </h3>
            </div>
            <div className="p-3 bg-brand-surface-light text-brand-text-muted rounded-xl">
              <Activity size={24} />
            </div>
          </div>
        </div>

        <div className="bg-brand-surface rounded-2xl border border-transparent hover:border-brand-accent/50 transition-colors p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-text-muted mb-1">Revenus</p>
              <h3 className="text-3xl font-bold text-brand-accent">
                {loading ? '-' : `R ${stats.todayRevenue.toFixed(2)}`}
              </h3>
            </div>
            <div className="p-3 bg-brand-accent/10 text-brand-accent rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="bg-brand-surface rounded-2xl border border-transparent hover:border-red-500/50 transition-colors p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-text-muted mb-1">Produits faibles en stock</p>
              <h3 className="text-3xl font-bold text-brand-text">
                {loading ? '-' : stats.lowStockItems}
              </h3>
              <p className="text-xs text-red-400 mt-2">&lt; 5 unités restantes</p>
            </div>
            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-brand-surface p-8 rounded-2xl border border-brand-border text-center text-brand-text-muted">
        <div className="bg-brand-surface-light w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4">
          <CreditCard size={32} className="text-brand-text-muted" />
        </div>
        <h3 className="text-xl font-bold text-brand-text mb-2">Prêt à vendre ?</h3>
        <p className="mb-4">Allez à la page de caisse pour commencer à encaisser vos clients.</p>
      </div>
    </div>
  );
}
