import { createHmac, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { AppError, badRequest } from '../utils/AppError.js';
import { alreadyRespondedError, emailAlreadyResponded } from './duplicateService.js';
import { getPublicFormRow, isAcceptingResponses } from './formService.js';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const TOKEN_TTL_SECONDS = 30 * 60;

let jwks;
const googleKeys = () => (jwks ??= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')));

/** HMAC key derived from a server-only secret, so verification tokens can't be forged by clients. */
const signingKey = () =>
  createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY).update('afb-email-verification-v1').digest();

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload) => b64(createHmac('sha256', signingKey()).update(payload).digest());

export const isGoogleConfigured = () => Boolean(env.GOOGLE_CLIENT_ID);

/** Checks a Google ID token (signature, issuer, audience, expiry) and returns the verified email. */
export async function verifyGoogleCredential(credential) {
  if (!isGoogleConfigured()) {
    throw new AppError(503, 'EMAIL_VERIFICATION_UNAVAILABLE', 'Email verification is not set up on this server.');
  }
  try {
    const { payload } = await jwtVerify(credential, googleKeys(), {
      issuer: GOOGLE_ISSUERS,
      audience: env.GOOGLE_CLIENT_ID,
      clockTolerance: 30,
    });
    if (payload.email_verified !== true || typeof payload.email !== 'string') {
      throw new Error('email not verified by Google');
    }
    return { email: payload.email.toLowerCase(), name: typeof payload.name === 'string' ? payload.name : undefined };
  } catch (err) {
    const appErr = new AppError(401, 'GOOGLE_VERIFICATION_FAILED', "We couldn't verify that Google account. Please try again.");
    appErr.cause = err;
    appErr.context = `Google token rejected: ${err?.message ?? err}`;
    throw appErr;
  }
}

/** Short-lived proof that `email` was verified for this form and question. */
export function signVerification({ formId, fieldKey, email }, now = Date.now()) {
  const payload = b64(JSON.stringify({ f: formId, k: fieldKey, e: email, x: Math.floor(now / 1000) + TOKEN_TTL_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

export function checkVerification(token, { formId, fieldKey, email }, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return false;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;

  try {
    const { f, k, e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return f === formId && k === fieldKey && e === String(email).toLowerCase() && x > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

/** POST /public/forms/:slug/verify-email — exchanges a Google credential for a verification token. */
export async function verifyEmailForForm(slug, fieldKey, credential) {
  const form = await getPublicFormRow(slug);
  if (!isAcceptingResponses(form)) throw badRequest('This form is not accepting responses.');

  const field = (form.schema?.fields ?? []).find((f) => f.key === fieldKey && f.type === 'email' && f.verifyEmail);
  if (!field) throw badRequest('This question does not require email verification.');

  const { email } = await verifyGoogleCredential(credential);
  // Tell people straight away, not after they have filled in the whole form.
  if (field.uniqueEmail && (await emailAlreadyResponded(form.id, field.id, email))) {
    throw alreadyRespondedError(fieldKey);
  }
  return {
    email,
    verification: signVerification({ formId: form.id, fieldKey, email }),
    expires_in: TOKEN_TTL_SECONDS,
  };
}
