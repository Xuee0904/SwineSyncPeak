import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.error(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in your .env file.\n' +
    'Add them to D:/Cedric/SwineSync/.env and restart Vite.'
  );
}

export const supabase = createClient(
  supabaseUrl  ?? 'http://localhost',
  supabaseAnon ?? 'missing-key'
);