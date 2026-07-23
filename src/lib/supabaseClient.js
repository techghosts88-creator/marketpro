import { createClient } from "@supabase/supabase-js";

// MarketPro runs in two modes:
//
// 1. LOCAL DEMO MODE (default, zero setup): if no Supabase env vars are
//    present, the app falls back to the built-in demo accounts and stores
//    everything in the browser's localStorage. This is what you get out of
//    the box, and what a Claude.ai artifact preview will always use.
//
// 2. SUPABASE MODE: once VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are
//    set (see .env.example), the app switches to real accounts (Supabase
//    Auth) and a real Postgres database, with an offline-write queue that
//    syncs automatically when connectivity returns.
//
// Nothing else in the app needs to know which mode is active except by
// checking `isSupabaseConfigured`.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

// MarketPro's login screen uses simple usernames (no email) to match how
// commerçants actually think about their account. Supabase Auth requires
// an email address, so we deterministically derive one from the username.
// This means real password-reset emails won't work out of the box — see
// README.md for how to move to real emails later if you need that.
export function usernameToEmail(username) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "")}@marketpro.local`;
}
