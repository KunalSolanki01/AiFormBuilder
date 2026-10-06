import { supabaseAdmin } from '../config/supabase.js';
import { unauthorized } from '../utils/AppError.js';

export function getBearerToken(req) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

/** Verifies the Supabase JWT and attaches `req.user = { id, email }`. */
export async function requireAuth(req, _res, next) {
  const token = getBearerToken(req);
  if (!token) throw unauthorized();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw unauthorized('Your session has expired. Please log in again.');

  req.user = { id: data.user.id, email: data.user.email, metadata: data.user.user_metadata ?? {} };
  req.accessToken = token;
  next();
}
