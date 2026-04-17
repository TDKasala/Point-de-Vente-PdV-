import React from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Archive, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-bg text-brand-text">Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { path: '/dashboard', icon: <LayoutDashboard size={24} />, label: 'Tableau de bord' },
    { path: '/pos', icon: <ShoppingCart size={24} />, label: 'Caisse' },
    { path: '/produits', icon: <Package size={24} />, label: 'Produits' },
    { path: '/stock', icon: <Archive size={24} />, label: 'Stock' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col md:flex-row">
      {/* Sidebar for Desktop, Bottom Nav for Mobile */}
      <nav className="fixed bottom-0 w-full bg-brand-surface border-t border-brand-border md:relative md:w-64 md:border-t-0 md:border-r md:flex md:flex-col z-50">
        <div className="hidden md:flex p-6 items-center justify-center border-b border-brand-border">
          <h1 className="text-2xl font-bold text-brand-text">POS Mobile</h1>
        </div>
        <div className="flex w-full md:flex-col md:flex-1 md:py-6 md:px-2 gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center md:justify-start py-3 md:py-4 md:px-6 md:rounded-xl transition-colors ${
                  isActive ? 'bg-brand-accent text-white' : 'text-brand-text-muted hover:bg-brand-surface-light'
                }`}
              >
                {item.icon}
                <span className="text-xs md:text-sm font-medium mt-1 md:mt-0 md:ml-4">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="hidden md:block p-4 border-t border-brand-border">
          <button 
            onClick={handleLogout}
            className="flex w-full items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
