import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ulgufqliwypotxwqbwsa.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DUoJKRwyBvjdt3HjrQLaJg_STa5fcPc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
