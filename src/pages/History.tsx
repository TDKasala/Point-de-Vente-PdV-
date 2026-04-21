import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ReceiptText, CreditCard, Banknote, Smartphone, FileText, Undo2, X, AlertCircle, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SaleItem {
  id: string;
  quantity: number;
  price: number;
  product_id: string;
  // Fallback for product name if joined
  products?: { name: string }; 
}

interface Sale {
  id: string;
  total: number;
  payment_method: string;
  created_at: string;
  status?: string;
  sale_items?: SaleItem[];
}

export default function History() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);
  const [currency, setCurrency] = useState('R');

  useEffect(() => {
    fetchSales();
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_settings').select('currency_symbol').eq('user_id', user.id).single();
    if (data?.currency_symbol) setCurrency(data.currency_symbol);
  };

  const fetchSales = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*, products(name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch sales error:', error);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

  const getChartData = () => {
    // Generate last 7 days
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0); // Normalize to midnight
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const dataMap = sales.reduce((acc: Record<string, number>, sale) => {
      if (sale.status === 'refunded') return acc;
      const date = sale.created_at.split('T')[0];
      acc[date] = (acc[date] || 0) + sale.total;
      return acc;
    }, {});

    return last7Days.map(date => ({
      name: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      total: dataMap[date] || 0
    }));
  };

  const chartData = getChartData();
  const totalLast7Days = chartData.reduce((sum, day) => sum + day.total, 0);

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'Espèces': return <Banknote size={20} className="text-brand-text-muted" />;
      case 'Mobile Money': return <Smartphone size={20} className="text-brand-text-muted" />;
      case 'Carte': return <CreditCard size={20} className="text-brand-text-muted" />;
      default: return <ReceiptText size={20} className="text-brand-text-muted" />;
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRefund = async (sale: Sale) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler cette vente et recréditer les stocks ?")) return;
    setIsRefunding(true);

    try {
      // 1. Mark sale as refunded
      const { error: saleError } = await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('id', sale.id);
      
      if (saleError) throw saleError;

      // 2. Add stock back
      if (sale.sale_items) {
        for (const item of sale.sale_items) {
           // Get current stock
           const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
           if (prodData) {
              await supabase.from('products').update({ stock: prodData.stock + item.quantity }).eq('id', item.product_id);
           }
        }
      }

      // Refresh
      await fetchSales();
      setSelectedSale(null);
      alert("Vente annulée avec succès. Les stocks ont été recrédités.");
    } catch (error) {
      console.error("Erreur annulation:", error);
      alert("Une erreur est survenue lors de l'annulation.");
    } finally {
      setIsRefunding(false);
    }
  };

  const reprintReceipt = (sale: Sale) => {
     let text = `*Ticket de Caisse*\nReçu: ${sale.id.slice(0, 8).toUpperCase()}\nDate: ${formatDateTime(sale.created_at)}\nStatut: ${sale.status === 'refunded' ? 'ANNULÉ' : 'COMPLÉTÉ'}\n\n`;
     
     if (sale.sale_items) {
        sale.sale_items.forEach(i => {
           let pName = i.products?.name || 'Produit Inconnu';
           text += `${i.quantity}x ${pName} - ${(i.price * i.quantity).toFixed(2)} ${currency}\n`;
        });
     }
     text += `\n*Total: ${sale.total.toFixed(2)} ${currency}*\nMéthode: ${sale.payment_method}\n\nMerci pour votre visite !`;
     
     const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
     window.open(url, '_blank');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Historique des ventes</h1>
        <p className="text-brand-text-muted">Consultez vos dernières transactions</p>
      </div>

      {/* Sales Evolution Chart */}
      {!loading && sales.length > 0 && (
        <div className="mb-8 bg-brand-surface rounded-2xl border border-brand-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-brand-text-muted uppercase tracking-widest mb-1">Évolution des ventes (7j)</h2>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-brand-accent">{totalLast7Days.toFixed(2)} {currency}</span>
                <span className="text-xs text-brand-text-muted font-medium">total sur la période</span>
              </div>
            </div>
            <div className="bg-brand-accent/10 p-3 rounded-xl text-brand-accent">
              <TrendingUp size={24} />
            </div>
          </div>
          
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FB8C00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FB8C00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  hide={true} 
                  domain={[0, 'auto']} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)} ${currency}`, 'Ventes']}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#FB8C00" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-brand-text-muted">Chargement de l'historique...</div>
        ) : sales.length === 0 ? (
          <div className="p-16 text-center text-brand-text-muted flex flex-col items-center">
             <div className="bg-brand-surface-light p-6 rounded-2xl mb-6">
                <ReceiptText size={40} className="text-brand-text-muted opacity-50" />
             </div>
             <p className="text-xl font-bold text-brand-text">Aucune vente enregistrée.</p>
             <p className="text-brand-text-muted mt-2">Passez votre première commande depuis la caisse.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-surface-light hidden sm:table-header-group">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-brand-text-muted uppercase tracking-wider">Date & Heure</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-brand-text-muted uppercase tracking-wider">Paiement</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-brand-text-muted uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-brand-surface divide-y divide-brand-border flex sm:table-row-group flex-col">
                {sales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    onClick={() => setSelectedSale(sale)}
                    className={`flex sm:table-row flex-col sm:flex-row p-5 sm:p-0 hover:bg-brand-surface-light/50 transition-colors cursor-pointer ${sale.status === 'refunded' ? 'opacity-50' : ''}`}
                  >
                    <td className="px-2 sm:px-6 py-2 sm:py-5 whitespace-nowrap">
                      <div className="flex items-center">
                         <div className={`p-3 rounded-xl mr-4 hidden sm:block ${sale.status === 'refunded' ? 'bg-red-500/10' : 'bg-brand-surface-light'}`}>
                           {sale.status === 'refunded' ? <Undo2 size={20} className="text-red-500" /> : <ReceiptText size={20} className="text-brand-accent" />}
                         </div>
                         <div>
                           <div className="flex items-center space-x-2">
                             <span className="text-sm font-bold text-brand-text">{formatDateTime(sale.created_at)}</span>
                             {sale.status === 'refunded' && <span className="text-[10px] uppercase font-bold bg-red-500/20 text-red-500 px-2 py-0.5 rounded-md">Annulée</span>}
                           </div>
                           <div className="text-xs text-brand-text-muted mt-1 font-mono">ID: {sale.id.slice(0, 8).toUpperCase()}</div>
                         </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 py-1 sm:py-5 whitespace-nowrap text-center">
                      <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-brand-surface-light border border-brand-border">
                         {getPaymentIcon(sale.payment_method)}
                         <span className="ml-2 text-sm font-medium text-brand-text">{sale.payment_method}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 mt-3 sm:mt-0 py-2 sm:py-5 whitespace-nowrap text-right border-t sm:border-0 border-brand-border pt-4 sm:pt-5">
                      <span className="sm:hidden text-xs text-brand-text-muted mr-2">Montant total:</span>
                      <span className={`text-base font-bold ${sale.status === 'refunded' ? 'text-brand-text-muted line-through' : 'text-brand-accent'}`}>{sale.total.toFixed(2)} {currency}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-brand-surface rounded-2xl w-full max-w-lg mx-auto overflow-hidden shadow-2xl border border-brand-border flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-brand-border bg-brand-surface-light">
              <div>
                <h2 className="text-xl font-bold flex items-center space-x-2">
                   <span>Détails de la vente</span>
                   {selectedSale.status === 'refunded' && <span className="text-xs uppercase font-bold bg-red-500/20 text-red-500 px-2 py-1 rounded-md">Annulée</span>}
                </h2>
                <p className="text-xs text-brand-text-muted mt-1 font-mono">{selectedSale.id.toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedSale(null)} className="p-2 bg-brand-bg rounded-full text-brand-text hover:text-red-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 text-sm bg-brand-bg space-y-6">
               <div>
                 <p className="text-brand-text-muted mb-1">Date et heure</p>
                 <p className="font-medium text-base text-brand-text">{formatDateTime(selectedSale.created_at)}</p>
               </div>
               
               <div>
                 <p className="text-brand-text-muted mb-3 border-b border-brand-border pb-2">Articles</p>
                 <div className="space-y-3">
                   {selectedSale.sale_items?.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center">
                       <span className="font-medium text-brand-text">
                         {item.quantity}x {item.products?.name || 'Produit inconnu'}
                       </span>
                       <span className="text-brand-text-muted text-right">
                         {(item.price * item.quantity).toFixed(2)} {currency}
                       </span>
                     </div>
                   ))}
                   {(!selectedSale.sale_items || selectedSale.sale_items.length === 0) && (
                      <p className="text-brand-text-muted italic">Détails des articles indisponibles.</p>
                   )}
                 </div>
               </div>

               <div className="border-t border-brand-border pt-4">
                 <div className="flex justify-between items-center font-bold text-lg mb-2">
                   <span>Total</span>
                   <span className={selectedSale.status === 'refunded' ? 'line-through text-brand-text-muted' : 'text-brand-accent'}>{selectedSale.total.toFixed(2)} {currency}</span>
                 </div>
                 <div className="flex justify-between items-center text-brand-text-muted">
                   <span>Moyen de paiement</span>
                   <span className="bg-brand-surface px-2 py-1 rounded border border-brand-border">{selectedSale.payment_method}</span>
                 </div>
               </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-brand-surface border-t border-brand-border flex gap-3 flex-col sm:flex-row">
               <button 
                 onClick={() => reprintReceipt(selectedSale)}
                 className="flex-1 bg-brand-surface-light text-brand-text py-3 rounded-xl font-medium border border-brand-border hover:bg-brand-border transition-colors flex items-center justify-center"
               >
                 <FileText size={18} className="mr-2"/> Ré-imprimer (WhatsApp)
               </button>
               {selectedSale.status !== 'refunded' && (
                 <button 
                   onClick={() => handleRefund(selectedSale)}
                   disabled={isRefunding}
                   className="flex-1 bg-red-500/10 text-red-500 py-3 rounded-xl font-bold border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
                 >
                   <Undo2 size={18} className="mr-2"/> 
                   {isRefunding ? 'Annulation...' : 'Annuler & Rembourser'}
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
