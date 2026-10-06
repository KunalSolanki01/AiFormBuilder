import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const formId = '11111111-1111-4111-8111-111111111111';
const fieldId = '22222222-2222-4222-8222-222222222222';

const state = { forms: [], rpc: vi.fn() };

// Minimal chainable Supabase query-builder stub backed by `state.forms`.
function builder(table) {
  const filters = [];
  let op = 'select';
  let patch;
  const run = () => {
    if (table !== 'forms') return { data: [], error: null };
    let rows = state.forms.filter((r) => filters.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)));
    if (op === 'update') rows.forEach((r) => Object.assign(r, patch));
    if (op === 'delete') state.forms = state.forms.filter((r) => !rows.includes(r));
    return { data: rows, error: null };
  };
  const b = {
    select: () => b,
    update: (p) => ((op = 'update'), (patch = p), b),
    delete: () => ((op = 'delete'), b),
    eq: (k, v) => (filters.push([k, v]), b),
    in: (k, v) => (filters.push([k, v]), b),
    order: () => b,
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    single: async () => ({ data: run().data[0] ?? null, error: null }),
    then: (res, rej) => Promise.resolve(run()).then(res, rej),
  };
  return b;
}

vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: {
    from: (t) => builder(t),
    rpc: (...a) => state.rpc(...a),
    auth: {
      getUser: async (token) =>
        token === 'tok-a'
          ? { data: { user: { id: 'user-a', email: 'a@x.io' } }, error: null }
          : token === 'tok-b'
            ? { data: { user: { id: 'user-b', email: 'b@x.io' } }, error: null }
            : { data: null, error: { message: 'bad jwt' } },
    },
  },
  createAuthClient: () => ({}),
}));

const { createApp } = await import('../src/app.js');
const app = createApp();
const asA = (r) => r.set('Authorization', 'Bearer tok-a');
const asB = (r) => r.set('Authorization', 'Bearer tok-b');

const field = { id: fieldId, key: 'name', type: 'text', label: 'Name', required: true, position: 0 };
const makeForm = (over = {}) => ({
  id: formId,
  user_id: 'user-a',
  title: 'Hackathon',
  description: '',
  slug: 'hackathon-abc123',
  status: 'published',
  type: 'event',
  schema: { version: 1, fields: [field] },
  response_limit: null,
  response_count: 0,
  ...over,
});

beforeEach(() => {
  state.forms = [makeForm()];
  state.rpc = vi.fn().mockResolvedValue({ data: { response_id: 'r1', duplicate: false }, error: null });
});

describe('auth & ownership', () => {
  it('rejects missing or invalid tokens', async () => {
    expect((await request(app).get('/api/forms')).status).toBe(401);
    const bad = await request(app).get('/api/forms').set('Authorization', 'Bearer nope');
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });

  it("hides other users' forms (404) and blocks edits/deletes", async () => {
    expect((await asB(request(app).get(`/api/forms/${formId}`))).status).toBe(404);
    expect((await asB(request(app).put(`/api/forms/${formId}`).send({ title: 'Hacked' }))).status).toBe(404);
    expect((await asB(request(app).delete(`/api/forms/${formId}`))).status).toBe(404);
    expect((await asB(request(app).get(`/api/forms/${formId}/responses`))).status).toBe(404);
    expect(state.forms[0].title).toBe('Hackathon');
    expect((await asA(request(app).get(`/api/forms/${formId}`))).status).toBe(200);
  });

  it('validates ids and bodies', async () => {
    expect((await asA(request(app).get('/api/forms/not-a-uuid'))).status).toBe(400);
    const res = await asA(request(app).post('/api/ai/generate-form').send({ prompt: 'short' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('public forms', () => {
  it('serves published forms without leaking owner data', async () => {
    const res = await request(app).get('/api/public/forms/hackathon-abc123');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'Hackathon', accepting_responses: true });
    expect(JSON.stringify(res.body)).not.toContain('user-a');
  });

  it('hides drafts', async () => {
    state.forms = [makeForm({ status: 'draft' })];
    expect((await request(app).get('/api/public/forms/hackathon-abc123')).status).toBe(404);
  });

  it('reports a closed form and a reached limit', async () => {
    state.forms = [makeForm({ status: 'closed' })];
    let res = await request(app).get('/api/public/forms/hackathon-abc123');
    expect(res.body.data).toMatchObject({ accepting_responses: false, closed_reason: 'closed' });
    state.forms = [makeForm({ response_limit: 5, response_count: 5 })];
    res = await request(app).get('/api/public/forms/hackathon-abc123');
    expect(res.body.data).toMatchObject({ accepting_responses: false, closed_reason: 'limit_reached', remaining: 0 });
  });
});

describe('response submission', () => {
  const post = (body) => request(app).post('/api/public/forms/hackathon-abc123/responses').send(body);

  it('stores valid answers keyed by field id', async () => {
    const res = await post({ answers: { name: '  Rahul ', junk: 'x' } });
    expect(res.status).toBe(201);
    expect(state.rpc).toHaveBeenCalledWith(
      'submit_response',
      expect.objectContaining({ p_form_id: formId, p_answers: { [fieldId]: 'Rahul' } }),
    );
  });

  it('rejects invalid answers with field errors and never hits the database', async () => {
    const res = await post({ answers: {} });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([{ path: 'name', message: 'This field is required.' }]);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('enforces the limit and closed state server-side', async () => {
    state.forms = [makeForm({ response_limit: 1, response_count: 1 })];
    let res = await post({ answers: { name: 'A' } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LIMIT_REACHED');
    state.forms = [makeForm({ status: 'closed' })];
    res = await post({ answers: { name: 'A' } });
    expect(res.body.error.code).toBe('FORM_CLOSED');
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('maps a race-lost limit error from the database transaction', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: 'LIMIT_REACHED' } });
    const res = await post({ answers: { name: 'A' } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LIMIT_REACHED');
  });
});

describe('forms lifecycle & errors', () => {
  it('cannot publish an empty form or close a draft', async () => {
    state.forms = [makeForm({ status: 'draft', schema: { fields: [] } })];
    let res = await asA(request(app).post(`/api/forms/${formId}/publish`));
    expect(res.body.error.code).toBe('FORM_EMPTY');
    state.forms = [makeForm({ status: 'draft' })];
    res = await asA(request(app).post(`/api/forms/${formId}/close`));
    expect(res.body.error.code).toBe('FORM_NOT_PUBLISHED');
  });

  it('locks field types once responses exist', async () => {
    state.forms = [makeForm({ response_count: 3 })];
    const res = await asA(
      request(app)
        .put(`/api/forms/${formId}`)
        .send({ fields: [{ ...field, type: 'number' }] }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FIELD_TYPE_LOCKED');
  });

  it('returns JSON errors without stack traces for unknown routes and bad JSON', async () => {
    const nf = await request(app).get('/api/nope');
    expect(nf.status).toBe(404);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).not.toMatch(/at .*\.js/);
  });
});
