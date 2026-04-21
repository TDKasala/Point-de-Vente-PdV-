import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, Archive, LogOut, 
  History, ShieldAlert, Lock, Unlock, KeyRound, X, Settings 
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [dbPin, setDbPin] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('PdV Mobile');
  const [isCashierMode, setIsCashierMode] = useState<boolean>(() => {
    return localStorage.getItem('pos_mode') === 'cashier';
  });
  
  const [pinModal, setPinModal] = useState<{isOpen: boolean, mode: 'unlock' | 'set'}>({isOpen: false, mode: 'unlock'});
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
       const { data } = await supabase.from('user_settings').select('pin_code, store_name').eq('user_id', user.id).single();
       if (data) {
          if (data.pin_code) setDbPin(data.pin_code);
          if (data.store_name) setStoreName(data.store_name);
       }
    };
    fetchSettings();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-bg text-brand-text">Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    
    if (pinModal.mode === 'unlock') {
      if (pinInput === dbPin) {
        localStorage.setItem('pos_mode', 'manager');
        setIsCashierMode(false);
        setPinModal({isOpen: false, mode: 'unlock'});
        setPinInput('');
      } else {
        setPinError('Code PIN incorrect.');
      }
    } else {
      if (pinInput.length < 4) {
        setPinError('Le code doit contenir au moins 4 caractères.');
        return;
      }
      const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, pin_code: pinInput });
      if (!error) {
        setDbPin(pinInput);
        setPinModal({isOpen: false, mode: 'unlock'});
        setPinInput('');
      } else {
        setPinError('Erreur de sauvegarde.');
      }
    }
  };

  let navItems = [
    { path: '/pos', icon: <ShoppingCart size={24} />, label: 'Caisse' }
  ];

  if (!isCashierMode) {
    navItems = [
      { path: '/dashboard', icon: <LayoutDashboard size={24} />, label: 'Tableau de bord' },
      { path: '/pos', icon: <ShoppingCart size={24} />, label: 'Caisse' },
      { path: '/produits', icon: <Package size={24} />, label: 'Produits' },
      { path: '/stock', icon: <Archive size={24} />, label: 'Stock' },
      { path: '/historique', icon: <History size={24} />, label: 'Historique' },
      { path: '/parametres', icon: <Settings size={24} />, label: 'Paramètres' },
    ];
    if (user?.email === 'deniskasala17@gmail.com') {
      navItems.push({ path: '/admin', icon: <ShieldAlert size={24} />, label: 'Superadmin' });
    }
  }

  // Enforce cashier constraints
  if (isCashierMode && location.pathname !== '/pos') {
     return <Navigate to="/pos" replace />;
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col md:flex-row">
      {/* Sidebar for Desktop, Bottom Nav for Mobile */}
      <nav className="fixed bottom-0 w-full bg-brand-surface border-t border-brand-border md:relative md:w-64 md:border-t-0 md:border-r md:flex md:flex-col z-50">
        <div className="hidden md:flex p-6 items-center justify-center border-b border-brand-border">
          <h1 className="text-2xl font-bold text-brand-text truncate px-2">{storeName}</h1>
        </div>
        <div className="flex w-full md:flex-col md:flex-1 md:py-6 md:px-2 gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 min-w-[70px] md:flex-none flex flex-col md:flex-row items-center justify-center md:justify-start py-3 md:py-4 md:px-6 md:rounded-xl transition-colors ${
                  isActive ? 'bg-brand-accent text-white' : 'text-brand-text-muted hover:bg-brand-surface-light'
                }`}
              >
                {item.icon}
                <span className="text-xs md:text-sm font-medium mt-1 md:mt-0 md:ml-4">{item.label}</span>
              </Link>
            );
          })}
        </div>
        
        {/* Auth / Settings controls */}
        <div className="hidden md:block p-4 border-t border-brand-border space-y-2">
          {isCashierMode ? (
            <button onClick={() => setPinModal({isOpen: true, mode: 'unlock'})} className="flex w-full items-center space-x-3 px-4 py-3 text-brand-text hover:bg-brand-surface-light rounded-xl transition-colors">
              <Unlock size={20} />
              <span className="font-medium">Mode Gérant</span>
            </button>
          ) : (
            <>
              {dbPin ? (
                  <button onClick={() => {
                     localStorage.setItem('pos_mode', 'cashier');
                     setIsCashierMode(true);
                  }} className="flex w-full items-center space-x-3 px-4 py-3 text-brand-text hover:bg-brand-surface-light rounded-xl transition-colors">
                    <Lock size={20} />
                    <span className="font-medium">Mode Caissier</span>
                  </button>
              ) : (
                  <button onClick={() => setPinModal({isOpen: true, mode: 'set'})} className="flex w-full items-center space-x-3 px-4 py-3 text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-colors">
                    <KeyRound size={20} />
                    <span className="font-medium">Créer PIN (Gérant)</span>
                  </button>
              )}
              <button 
                onClick={handleLogout}
                className="flex w-full items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <LogOut size={20} />
                <span className="font-medium">Déconnexion</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto w-full">
        <Outlet />
      </main>

      {/* Mobile Lock Action (absolute/floating) */}
      <div className="md:hidden fixed top-4 right-4 z-50">
         {isCashierMode ? (
            <button onClick={() => setPinModal({isOpen: true, mode: 'unlock'})} className="p-3 bg-brand-surface border border-brand-border rounded-full shadow-lg text-brand-text">
               <Unlock size={20} />
            </button>
         ) : (
            dbPin ? (
               <button onClick={() => { localStorage.setItem('pos_mode', 'cashier'); setIsCashierMode(true); }} className="p-3 bg-brand-surface border border-brand-border rounded-full shadow-lg text-brand-text">
                  <Lock size={20} />
               </button>
            ) : (
               <button onClick={() => setPinModal({isOpen: true, mode: 'set'})} className="p-3 bg-brand-accent rounded-full shadow-lg text-white">
                  <KeyRound size={20} />
               </button>
            )
         )}
      </div>

      {pinModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-brand-surface rounded-2xl w-full max-w-sm p-6 relative shadow-2xl border border-brand-border">
            <button onClick={() => setPinModal({isOpen: false, mode: 'unlock'})} className="absolute top-4 right-4 text-brand-text-muted hover:text-brand-text">
               <X size={24} />
            </button>
            <h2 className="text-xl font-bold text-center mb-6 text-brand-text">
               {pinModal.mode === 'unlock' ? 'Déverrouiller Mode Gérant' : 'Définir un code PIN'}
            </h2>
            <form onSubmit={handlePinSubmit}>
               <input
                 type="password"
                 pattern="\d*"
                 value={pinInput}
                 onChange={(e) => setPinInput(e.target.value)}
                 autoFocus
                 placeholder="Entrez le code PIN..."
                 className="w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:border-brand-accent text-brand-text mb-4"
               />
               {pinError && <p className="text-red-500 text-sm text-center mb-4">{pinError}</p>}
               <button type="submit" className="w-full bg-brand-accent text-white font-bold py-3 rounded-xl hover:bg-brand-accent-hover transition-colors">
                 {pinModal.mode === 'unlock' ? 'Valider' : 'Enregistrer'}
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
