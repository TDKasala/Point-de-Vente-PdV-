import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, CreditCard, AlertTriangle, TrendingUp, Package, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface DashboardStats {
  todaySalesCount: number;
  todayRevenue: number;
  weeklyRevenue: number;
  lowStockItems: number;
  topProducts: { name: string; sold: number; revenue: number }[];
  lowStockList: { name: string; stock: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todaySalesCount: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    lowStockItems: 0,
    topProducts: [],
    lowStockList: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);

        // 1. Fetch Sales completed
        const { data: sales, error: salesError } = await supabase
          .from('sales')
          .select('id, total, created_at')
          .gte('created_at', lastWeek.toISOString())
          .neq('status', 'refunded')
          .eq('user_id', user.id);

        if (salesError) throw salesError;

        let todayCount = 0;
        let todayRev = 0;
        let weekRev = 0;

        const saleIds: string[] = [];

        sales?.forEach(sale => {
          const saleDate = new Date(sale.created_at);
          if (saleDate >= today) {
            todayCount++;
            todayRev += sale.total;
          }
          weekRev += sale.total;
          saleIds.push(sale.id);
        });

        // 2. Fetch Best Sellers
        let bestSellers: { name: string; sold: number; revenue: number }[] = [];
        if (saleIds.length > 0) {
          const { data: items } = await supabase
            .from('sale_items')
            .select('quantity, price, products(name)')
            .in('sale_id', saleIds);
            
          if (items) {
            const productAgg: Record<string, {sold: number, rev: number}> = {};
            items.forEach(item => {
              const prod = item.products as any;
              const pName = prod?.name || 'Inconnu';
              if (!productAgg[pName]) productAgg[pName] = { sold: 0, rev: 0 };
              productAgg[pName].sold += item.quantity;
              productAgg[pName].rev += item.price * item.quantity;
            });
            bestSellers = Object.keys(productAgg).map(name => ({
              name,
              sold: productAgg[name].sold,
              revenue: productAgg[name].rev
            })).sort((a, b) => b.sold - a.sold).slice(0, 5);
          }
        }

        // 3. Low Stock Items
        const { data: stockData } = await supabase
          .from('products')
          .select('name, stock')
          .lt('stock', 5)
          .eq('user_id', user.id);

        setStats({
          todaySalesCount: todayCount,
          todayRevenue: todayRev,
          weeklyRevenue: weekRev,
          lowStockItems: stockData?.length || 0,
          lowStockList: stockData || [],
          topProducts: bestSellers
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
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Tableau de bord</h1>
        <p className="text-brand-text-muted">Aperçu de vos activités de la semaine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-text-muted mb-1">Ventes (Aujourd'hui)</p>
              <h3 className="text-3xl font-bold text-brand-text">
                {loading ? '-' : stats.todaySalesCount}
              </h3>
            </div>
            <div className="p-3 bg-brand-surface-light text-brand-text-muted rounded-xl">
              <Activity size={24} />
            </div>
          </div>
        </div>

        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 flex flex-col justify-between hover:border-brand-accent/50 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-text-muted mb-1">Revenus (Ajourd'hui)</p>
              <h3 className="text-3xl font-bold text-brand-accent">
                {loading ? '-' : `R ${stats.todayRevenue.toFixed(0)}`}
              </h3>
            </div>
            <div className="p-3 bg-brand-accent/10 text-brand-accent rounded-xl">
              <CreditCard size={24} />
            </div>
          </div>
        </div>

        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-text-muted mb-1">Revenus (7 jours)</p>
              <h3 className="text-3xl font-bold text-brand-text">
                {loading ? '-' : `R ${stats.weeklyRevenue.toFixed(0)}`}
              </h3>
            </div>
            <div className="p-3 bg-brand-surface-light text-brand-text-muted rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className={`bg-brand-surface rounded-2xl border transition-colors p-6 flex flex-col justify-between ${stats.lowStockItems > 0 ? 'border-red-500/50' : 'border-brand-border'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-brand-text-muted mb-1">Alertes de Stock</p>
              <h3 className={`text-3xl font-bold ${stats.lowStockItems > 0 ? 'text-red-500' : 'text-brand-text'}`}>
                {loading ? '-' : stats.lowStockItems}
              </h3>
              <p className={`text-xs mt-2 ${stats.lowStockItems > 0 ? 'text-red-400' : 'text-brand-text-muted'}`}>&lt; 5 unités restantes</p>
            </div>
            <div className={`p-3 rounded-xl ${stats.lowStockItems > 0 ? 'bg-red-500/10 text-red-500' : 'bg-brand-surface-light text-brand-text-muted'}`}>
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Top Products */}
         <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border">
           <div className="flex items-center mb-6">
              <Star className="text-yellow-500 mr-2" size={24} />
              <h3 className="text-xl font-bold text-brand-text">Meilleures ventes (7 jours)</h3>
           </div>
           
           {loading ? (
             <p className="text-brand-text-muted">Chargement...</p>
           ) : stats.topProducts.length === 0 ? (
             <p className="text-brand-text-muted italic">Aucune donnée disponible.</p>
           ) : (
             <div className="space-y-4">
               {stats.topProducts.map((p, i) => (
                 <div key={i} className="flex justify-between items-center border-b border-brand-border pb-3 last:border-0 last:pb-0">
                   <div>
                     <p className="font-bold text-brand-text">{p.name}</p>
                     <p className="text-xs text-brand-text-muted">{p.sold} unités vendues</p>
                   </div>
                   <div className="font-bold text-brand-accent">R {p.revenue.toFixed(2)}</div>
                 </div>
               ))}
             </div>
           )}
         </div>

         {/* Low Stock Watchlist */}
         <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border">
           <div className="flex items-center mb-6">
              <Package className="text-red-400 mr-2" size={24} />
              <h3 className="text-xl font-bold text-brand-text">À réapprovisionner</h3>
           </div>
           
           {loading ? (
             <p className="text-brand-text-muted">Chargement...</p>
           ) : stats.lowStockList.length === 0 ? (
             <div className="text-center p-8 text-brand-text-muted">
               <Package size={48} className="mx-auto mb-4 opacity-30" />
               <p>Tous vos stocks sont au-dessus de 5 unités.</p>
             </div>
           ) : (
             <div className="space-y-4">
               {stats.lowStockList.map((p, i) => (
                 <div key={i} className="flex justify-between items-center border-b border-brand-border pb-3 last:border-0 last:pb-0">
                   <p className="font-bold text-brand-text">{p.name}</p>
                   <div className="font-bold bg-red-500/10 text-red-500 px-3 py-1 rounded-lg">
                      {p.stock} restant{p.stock > 1 ? 's' : ''}
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
      </div>
    </div>
  );
}
