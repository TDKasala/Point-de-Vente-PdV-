import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ShoppingCart } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-bg text-brand-text">Chargement...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    if (isSignUp) {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("Compte créé avec succès ! Si vous n'êtes pas redirigé, veuillez vous connecter ou vérifier votre email (si imposé par Supabase).");
        // Basculer automatique sur le login après création réussie pour faciliter
        if (data.session) {
          // La redirection se fera toute seule via l'état "user" si sign in automatique
        } else {
          setIsSignUp(false);
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-brand-accent">
          <ShoppingCart size={56} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-brand-text">
          {isSignUp ? 'Créer un compte' : 'Connectez-vous'}
        </h2>
        <p className="mt-2 text-center text-sm text-brand-text-muted">
          Application POS Mobile
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-brand-surface py-8 px-4 sm:rounded-2xl sm:px-10 border border-brand-border shadow-2xl">
          <form className="space-y-6" onSubmit={handleAuth}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-brand-accent/10 border border-brand-accent/20 text-brand-accent px-4 py-3 rounded-xl text-sm">
                {message}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-brand-text-muted mb-2">
                Adresse email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent sm:text-base transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-brand-text-muted mb-2">
                Mot de passe
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent sm:text-base transition-colors"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-base font-bold text-white bg-brand-accent hover:bg-brand-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent disabled:opacity-50 transition-colors"
              >
                {loading ? 'Traitement...' : (isSignUp ? "S'inscrire" : 'Se connecter')}
              </button>
            </div>
            <div className="text-sm mt-6 text-center">
              <button 
                type="button" 
                onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
                className="text-brand-accent hover:text-brand-accent-hover font-medium transition-colors"
              >
                {isSignUp 
                  ? "Vous avez déjà un compte ? Se connecter" 
                  : "Pas encore de compte d'essai ? S'inscrire"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
