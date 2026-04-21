import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn("Variables d'environnement Supabase manquantes. Veuillez configurer VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
  // We use placeholder to avoid crashing immediately, but alert the developer
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
