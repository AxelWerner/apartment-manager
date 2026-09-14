import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';
const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

const defaultUrl = 'https://placeholder.supabase.co';
const defaultKey = 'placeholder';

export const supabase = createClient(supabaseUrl || defaultUrl, supabaseAnonKey || defaultKey);

export const DEFAULT_PROPERTY_ID = 'a0000000-0000-0000-0000-000000000001';
