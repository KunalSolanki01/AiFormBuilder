const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;
const STORAGE_KEY = 'afb.session';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Session persistence ────────────────────────────────
export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null;
    } catch {
      return null;
    }
  },
  set(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch { /* storage unavailable */ }
  },
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage unavailable */ }
  },
};

let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => (onSessionExpired = fn);

let refreshing = null;
async function refreshSession() {
  const current = session.get();
  if (!current?.refresh_token) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const body = await res.json();
      session.set(body.data.session);
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `idempotent` requests are safe to send twice, so a dropped connection (a proxy hiccup, a server restart)
 * is retried once, silently. Defaults to true for GET; opt in for POST/PUT that are safe to repeat.
 */
async function request(method, path, opts = {}) {
  const { body, query, auth = true, retry = true, raw, idempotent = method === 'GET', attempt = 0 } = opts;
  const again = (extra) => request(method, path, { ...opts, ...extra });
  // Two quiet retries (0.7s, then 1.4s) outlast a dev-server or deploy restart.
  const canRetryNetwork = idempotent && attempt < 2;
  const backoff = () => sleep(700 * (attempt + 1));

  const qs = query
    ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '' && v !== null))}`
    : '';
  const headers = {};
  if (raw !== undefined) headers['Content-Type'] = 'application/octet-stream';
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? session.get()?.access_token : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers,
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    if (canRetryNetwork) {
      await backoff();
      return again({ attempt: attempt + 1 });
    }
    throw new ApiError("Can't reach the server. Check your connection and try again.", { code: 'NETWORK' });
  }

  if (res.status === 401 && auth && token && retry && (await refreshSession())) {
    return again({ retry: false });
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch { /* non-JSON response */ }

  // A 5xx with no JSON body didn't come from our API: it's the proxy/gateway failing (connection reset, restart).
  const gatewayFailure = !res.ok && payload === null && res.status >= 500;
  if (gatewayFailure && canRetryNetwork) {
    await backoff();
    return again({ attempt: attempt + 1 });
  }
  if (gatewayFailure) {
    throw new ApiError("The server didn't respond just now. Please try again in a moment.", { status: res.status, code: 'GATEWAY' });
  }

  if (!res.ok || payload?.success === false) {
    if (res.status === 401 && auth && token) onSessionExpired();
    const err = payload?.error ?? {};
    throw new ApiError(err.message ?? 'Something went wrong. Please try again.', {
      status: res.status,
      code: err.code ?? 'ERROR',
      details: err.details,
    });
  }
  return payload;
}

const get = (path, opts) => request('GET', path, opts);
const post = (path, body, opts) => request('POST', path, { body, ...opts });

export const api = {
  auth: {
    register: (data) => post('/auth/register', data, { auth: false }).then((r) => r.data),
    login: (data) => post('/auth/login', data, { auth: false }).then((r) => r.data),
    logout: () => post('/auth/logout').catch(() => {}),
    me: () => get('/auth/me').then((r) => r.data.user),
  },
  forms: {
    list: () => get('/forms').then((r) => r.data),
    get: (id) => get(`/forms/${id}`).then((r) => r.data),
    create: (data) => post('/forms', data).then((r) => r.data),
    update: (id, data) => request('PUT', `/forms/${id}`, { body: data, idempotent: true }).then((r) => r.data),
    remove: (id) => request('DELETE', `/forms/${id}`),
    publish: (id) => post(`/forms/${id}/publish`, undefined, { idempotent: true }).then((r) => r.data),
    close: (id) => post(`/forms/${id}/close`, undefined, { idempotent: true }).then((r) => r.data),
    responses: (id, query) => get(`/forms/${id}/responses`, { query }).then((r) => r.data),
    response: (id, responseId) => get(`/forms/${id}/responses/${responseId}`).then((r) => r.data),
    analytics: (id) => get(`/forms/${id}/analytics`).then((r) => r.data),
    /** Short-lived signed URL for an uploaded file (owner only). */
    fileUrl: (id, path, name) => get(`/forms/${id}/files`, { query: { path, name } }).then((r) => r.data),
  },
  ai: {
    generateForm: (prompt) => post('/ai/generate-form', { prompt }, { idempotent: true }).then((r) => ({ form: r.data, warnings: r.warnings ?? [] })),
    analyze: (formId) => post('/ai/analyze-responses', { formId }).then((r) => r.data),
  },
  public: {
    getForm: (slug) => get(`/public/forms/${slug}`, { auth: false }).then((r) => r.data),
    /** Uploads one file (raw bytes). Resolves to the { path, name, size } reference to submit. */
    upload: (slug, field, file) =>
      request('POST', `/public/forms/${slug}/uploads`, {
        raw: file,
        query: { field, filename: file.name },
        auth: false,
      }).then((r) => r.data),
    /** Exchanges a Google credential for a signed proof that the email belongs to the respondent. */
    verifyEmail: (slug, field, credential) =>
      post(`/public/forms/${slug}/verify-email`, { field, credential }, { auth: false, idempotent: true }).then((r) => r.data),
    submit: (slug, answers, submissionId, verifications) =>
      post(
        `/public/forms/${slug}/responses`,
        { answers, submission_id: submissionId, ...(verifications && Object.keys(verifications).length && { verifications }) },
        { auth: false, idempotent: true }, // submission_id makes a repeated submit harmless
      ).then((r) => r.data),
  },
};
