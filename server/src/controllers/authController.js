import { createAuthClient, supabaseAdmin } from '../config/supabase.js';
import { AppError, conflict, unauthorized } from '../utils/AppError.js';

const toSession = (session) =>
  session
    ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      }
    : null;

async function loadProfile(user) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, avatar_url, created_at')
    .eq('id', user.id)
    .maybeSingle();
  return (
    data ?? {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.metadata?.name ?? null,
      avatar_url: null,
    }
  );
}

function authServiceError(error) {
  const err = new AppError(502, 'AUTH_SERVICE_ERROR', 'Authentication service is unavailable. Please try again.');
  err.cause = error;
  err.context = `Supabase auth: ${error.message}`;
  return err;
}

export async function register(req, res) {
  const { name, email, password } = req.validated.body;
  const { data, error } = await createAuthClient().auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    if (error.code === 'weak_password') throw new AppError(400, 'WEAK_PASSWORD', error.message);
    if (error.status === 429) throw new AppError(429, 'RATE_LIMITED', 'Too many sign-up attempts. Please try again later.');
    throw authServiceError(error);
  }

  // With "Confirm email" enabled in Supabase, signUp returns no session.
  res.status(201).json({
    success: true,
    data: {
      user: await loadProfile(data.user),
      session: toSession(data.session),
      requires_confirmation: !data.session,
    },
  });
}

export async function login(req, res) {
  const { email, password } = req.validated.body;
  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === 'email_not_confirmed') {
      throw new AppError(403, 'EMAIL_NOT_CONFIRMED', 'Please confirm your email address before logging in.');
    }
    if (error.status === 400 || error.code === 'invalid_credentials') {
      throw unauthorized('Invalid email or password.');
    }
    throw authServiceError(error);
  }

  res.json({ success: true, data: { user: await loadProfile(data.user), session: toSession(data.session) } });
}

export async function refresh(req, res) {
  const { data, error } = await createAuthClient().auth.refreshSession({
    refresh_token: req.validated.body.refresh_token,
  });
  if (error || !data.session) throw unauthorized('Your session has expired. Please log in again.');
  res.json({ success: true, data: { user: await loadProfile(data.user), session: toSession(data.session) } });
}

export async function logout(req, res) {
  // Revokes the refresh tokens for this session. Best effort: the client clears its tokens regardless.
  await supabaseAdmin.auth.admin.signOut(req.accessToken, 'local').catch(() => {});
  res.json({ success: true, data: null });
}

export async function me(req, res) {
  res.json({ success: true, data: { user: await loadProfile(req.user) } });
}
