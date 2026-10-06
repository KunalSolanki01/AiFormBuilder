import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const serverAuthOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/**
 * Service-role client. Bypasses RLS — every query made with it MUST be scoped
 * to the authenticated user in the service layer.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, serverAuthOptions);

/** Anon-key client for Supabase Auth flows (sign up / sign in / refresh). One per request. */
export const createAuthClient = () => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, serverAuthOptions);
