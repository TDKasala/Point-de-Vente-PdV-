import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ReceiptText, CreditCard, Banknote, Smartphone } from 'lucide-react';

interface Sale {
  id: string;
  total: number;
  payment_method: string;
  created_at: string;
}

export default function History() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, [user]);

  const fetchSales = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch sales error:', error);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

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

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Historique des ventes</h1>
        <p className="text-brand-text-muted">Consultez vos dernières transactions</p>
      </div>

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
                  <tr key={sale.id} className="flex sm:table-row flex-col sm:flex-row p-5 sm:p-0 hover:bg-brand-surface-light/50 transition-colors">
                    <td className="px-2 sm:px-6 py-2 sm:py-5 whitespace-nowrap">
                      <div className="flex items-center">
                         <div className="bg-brand-surface-light p-3 rounded-xl mr-4 hidden sm:block">
                           <ReceiptText size={20} className="text-brand-accent" />
                         </div>
                         <div>
                           <div className="text-sm font-bold text-brand-text">{formatDateTime(sale.created_at)}</div>
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
                      <span className="text-base font-bold text-brand-accent">R {sale.total.toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
