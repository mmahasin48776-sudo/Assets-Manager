import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://bgofttpfyupdnsagkkyd.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnb2Z0dHBmeXVwZG5zYWdra3lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjM4NTAsImV4cCI6MjA5NzUzOTg1MH0.UDJ_-UZBVqBKDpJRcL0bxTV3bG4FL1z1PyTW56WZUCk';

// Support a graceful fallback in-case keys are not yet provided by the user in the UI.
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseAnonKey !== 'YOUR_ANON_KEY_HERE' && supabaseAnonKey !== '');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null as any;
