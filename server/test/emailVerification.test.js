import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const formId = '11111111-1111-4111-8111-111111111111';
const emailFieldId = '22222222-2222-4222-8222-222222222222';
const nameFieldId = '33333333-3333-4333-8333-333333333333';

const state = { forms: [], rpc: vi.fn() };

function builder(table) {
  const filters = [];
  const run = () => {
    if (table !== 'forms') return { data: [], error: null };
    return { data: state.forms.filter((r) => filters.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v))), error: null };
  };
  const b = {
    select: () => b,
    eq: (k, v) => (filters.push([k, v]), b),
    in: (k, v) => (filters.push([k, v]), b),
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    single: async () => ({ data: run().data[0] ?? null, error: null }),
    then: (res, rej) => Promise.resolve(run()).then(res, rej),
  };
  return b;
}

vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: { from: (t) => builder(t), rpc: (...a) => state.rpc(...a), storage: { from: () => ({}) }, auth: {} },
  createAuthClient: () => ({}),
}));

// Google's signature check is mocked: the "credential" string decides the outcome.
const googleClaims = vi.hoisted(() => ({ current: null }));
vi.mock('jose', () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: vi.fn(async (token, _keys, opts) => {
    if (token === 'x'.repeat(30)) throw new Error('signature verification failed');
    expect(opts.audience).toBe('test-client.apps.googleusercontent.com');
    expect(opts.issuer).toContain('https://accounts.google.com');
    return { payload: googleClaims.current };
  }),
}));

const { createApp } = await import('../src/app.js');
const { checkVerification, signVerification } = await import('../src/services/emailVerificationService.js');
const app = createApp();

const makeForm = (verify = true, over = {}) => ({
  id: formId,
  user_id: 'user-a',
  title: 'Members only',
  description: '',
  slug: 'members-abc123',
  status: 'published',
  type: 'registration',
  schema: {
    version: 1,
    fields: [
      { id: nameFieldId, key: 'name', type: 'text', label: 'Name', required: true, position: 0 },
      { id: emailFieldId, key: 'email', type: 'email', label: 'Email', required: true, position: 1, verifyEmail: verify },
    ],
  },
  response_limit: null,
  response_count: 0,
  ...over,
});

const verifyEmail = (body) => request(app).post('/api/public/forms/members-abc123/verify-email').send(body);
const submit = (answers, verifications) =>
  request(app).post('/api/public/forms/members-abc123/responses').send({ answers, ...(verifications && { verifications }) });
const good = { iss: 'https://accounts.google.com', email: 'Rahul@Example.com', email_verified: true, name: 'Rahul' };
const CRED = 'g'.repeat(40);

beforeEach(() => {
  state.forms = [makeForm()];
  state.rpc = vi.fn().mockResolvedValue({ data: { response_id: 'r1', duplicate: false }, error: null });
  googleClaims.current = { ...good };
});

describe('POST /api/public/forms/:slug/verify-email', () => {
  it('turns a valid Google credential into a lowercase email and a signed proof', async () => {
    const res = await verifyEmail({ field: 'email', credential: CRED });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('rahul@example.com');
    expect(res.body.data.expires_in).toBe(1800);
    expect(checkVerification(res.body.data.verification, { formId, fieldKey: 'email', email: 'rahul@example.com' })).toBe(true);
  });

  it('rejects an invalid token without leaking details', async () => {
    const res = await verifyEmail({ field: 'email', credential: 'x'.repeat(30) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_VERIFICATION_FAILED');
    expect(JSON.stringify(res.body)).not.toMatch(/signature verification/);
  });

  it('rejects accounts whose email Google has not verified', async () => {
    googleClaims.current = { ...good, email_verified: false };
    expect((await verifyEmail({ field: 'email', credential: CRED })).status).toBe(401);
    googleClaims.current = { ...good, email: undefined };
    expect((await verifyEmail({ field: 'email', credential: CRED })).status).toBe(401);
  });

  it('only works for email questions that ask for verification', async () => {
    expect((await verifyEmail({ field: 'name', credential: CRED })).status).toBe(400);
    state.forms = [makeForm(false)];
    expect((await verifyEmail({ field: 'email', credential: CRED })).status).toBe(400);
  });

  it('is unavailable for closed forms and validates input', async () => {
    state.forms = [makeForm(true, { status: 'closed' })];
    expect((await verifyEmail({ field: 'email', credential: CRED })).status).toBe(400);
    expect((await verifyEmail({ field: 'email', credential: 'short' })).status).toBe(400);
  });
});

describe('submitting a form that requires verified email', () => {
  const proofFor = async (email = 'rahul@example.com') =>
    (await verifyEmail({ field: 'email', credential: CRED })).body.data.verification ?? signVerification({ formId, fieldKey: 'email', email });

  it('accepts a matching proof and records that the email was verified', async () => {
    const verification = await proofFor();
    const res = await submit({ name: 'Rahul', email: 'rahul@example.com' }, { email: verification });
    expect(res.status).toBe(201);
    expect(state.rpc).toHaveBeenCalledWith(
      'submit_response',
      expect.objectContaining({ p_metadata: expect.objectContaining({ verified_emails: { email: 'google' } }) }),
    );
  });

  it('is case-insensitive about the address', async () => {
    const verification = await proofFor();
    expect((await submit({ name: 'R', email: 'RAHUL@example.com' }, { email: verification })).status).toBe(201);
  });

  it('rejects a submission with no proof', async () => {
    const res = await submit({ name: 'Rahul', email: 'rahul@example.com' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.error.details).toEqual([{ path: 'email', message: 'Verify this email with Google.' }]);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('rejects a proof issued for a different email address', async () => {
    const verification = await proofFor();
    const res = await submit({ name: 'Mallory', email: 'someone.else@example.com' }, { email: verification });
    expect(res.status).toBe(422);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('rejects proofs for another form or question, forged, or expired proofs', async () => {
    const answers = { name: 'Rahul', email: 'rahul@example.com' };
    const otherForm = signVerification({ formId: crypto.randomUUID(), fieldKey: 'email', email: 'rahul@example.com' });
    const otherField = signVerification({ formId, fieldKey: 'name', email: 'rahul@example.com' });
    const expired = signVerification({ formId, fieldKey: 'email', email: 'rahul@example.com' }, Date.now() - 60 * 60 * 1000);
    const valid = await proofFor();
    const [payload] = valid.split('.');
    const forged = `${payload}.${'A'.repeat(43)}`;
    const tamperedPayload = `${Buffer.from(JSON.stringify({ f: formId, k: 'email', e: 'rahul@example.com', x: 9999999999 })).toString('base64url')}.${valid.split('.')[1]}`;

    for (const token of [otherForm, otherField, expired, forged, tamperedPayload, 'garbage', '', `${valid}.extra`]) {
      const res = await submit(answers, { email: token });
      expect(res.status, token.slice(0, 20)).toBe(422);
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('does not require proof for an optional verified email that was left blank', async () => {
    const form = makeForm();
    form.schema.fields[1].required = false;
    state.forms = [form];
    expect((await submit({ name: 'Rahul' })).status).toBe(201);
  });

  it('does not ask for proof when verification is off', async () => {
    state.forms = [makeForm(false)];
    expect((await submit({ name: 'Rahul', email: 'rahul@example.com' })).status).toBe(201);
  });
});

describe('public form payload', () => {
  it('includes the Google client id only when a question needs verification', async () => {
    let res = await request(app).get('/api/public/forms/members-abc123');
    expect(res.body.data.google_client_id).toBe('test-client.apps.googleusercontent.com');
    expect(res.body.data.fields[1].verifyEmail).toBe(true);
    state.forms = [makeForm(false)];
    res = await request(app).get('/api/public/forms/members-abc123');
    expect(res.body.data.google_client_id).toBeUndefined();
  });
});

describe('checkVerification', () => {
  it('rejects non-strings and malformed tokens', () => {
    const args = { formId, fieldKey: 'email', email: 'a@b.co' };
    expect(checkVerification(undefined, args)).toBe(false);
    expect(checkVerification(null, args)).toBe(false);
    expect(checkVerification('nodot', args)).toBe(false);
    expect(checkVerification(signVerification(args), args)).toBe(true);
  });
});

describe('one response per verified email', () => {
  const uniqueForm = () => {
    const form = makeForm();
    form.schema.fields[1].uniqueEmail = true;
    return form;
  };
  /** rpc mock: email_has_responded → `responded`, anything else → a normal successful submit */
  const mockRpc = ({ responded = false, submitError = null } = {}) => {
    state.rpc = vi.fn(async (name) => {
      if (name === 'email_has_responded') return { data: responded, error: null };
      return submitError ? { data: null, error: submitError } : { data: { response_id: 'r1', duplicate: false }, error: null };
    });
  };
  const proof = async () => (await verifyEmail({ field: 'email', credential: CRED })).body.data?.verification;
  const answers = { name: 'Rahul', email: 'rahul@example.com' };

  beforeEach(() => {
    state.forms = [uniqueForm()];
    mockRpc();
  });

  it('lets a new email sign in, and asks the database with the lower-cased address', async () => {
    const res = await verifyEmail({ field: 'email', credential: CRED });
    expect(res.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('email_has_responded', {
      p_form_id: formId,
      p_field_id: emailFieldId,
      p_email: 'rahul@example.com',
    });
  });

  it('tells an email that already responded right after Google sign-in, with no proof issued', async () => {
    mockRpc({ responded: true });
    const res = await verifyEmail({ field: 'email', credential: CRED });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'ALREADY_RESPONDED',
      message: 'This email has already responded to this form.',
      details: [{ path: 'email', message: 'This email has already responded to this form.' }],
    });
    expect(res.body.data).toBeUndefined();
  });

  it('does not check for duplicates when the setting is off', async () => {
    state.forms = [makeForm()]; // verified, but not unique
    await verifyEmail({ field: 'email', credential: CRED });
    expect(state.rpc).not.toHaveBeenCalledWith('email_has_responded', expect.anything());
  });

  it('submits with the verified address as the dedupe key', async () => {
    const verification = await proof();
    state.rpc.mockClear();
    const res = await submit({ name: 'Rahul', email: 'Rahul@Example.com' }, { email: verification });
    expect(res.status).toBe(201);
    expect(state.rpc).toHaveBeenCalledWith(
      'submit_response',
      expect.objectContaining({ p_dedupe_key: 'rahul@example.com', p_dedupe_field_id: emailFieldId }),
    );
  });

  it('sends no dedupe key when the setting is off', async () => {
    state.forms = [makeForm()];
    const verification = await proof();
    state.rpc.mockClear();
    await submit(answers, { email: verification });
    expect(state.rpc).toHaveBeenCalledWith('submit_response', expect.objectContaining({ p_dedupe_key: null, p_dedupe_field_id: null }));
  });

  it('turns the database "already responded" rejection into a 409 on the email question', async () => {
    const verification = await proof();
    mockRpc({ submitError: { message: 'ALREADY_RESPONDED' } });
    const res = await submit(answers, { email: verification });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'ALREADY_RESPONDED', details: [{ path: 'email' }] });
  });

  it('also handles a unique-index collision from two simultaneous submissions', async () => {
    const verification = await proof();
    mockRpc({ submitError: { code: '23505', message: 'duplicate key value violates unique constraint "responses_form_dedupe_key_unique"' } });
    const res = await submit(answers, { email: verification });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_RESPONDED');
  });

  it('still requires a valid proof (uniqueness does not weaken verification)', async () => {
    const res = await submit(answers);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
});
