import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchesSignature } from '../src/utils/fileSignature.js';

const formId = '11111111-1111-4111-8111-111111111111';
const fieldId = '22222222-2222-4222-8222-222222222222';
const fileFieldId = '33333333-3333-4333-8333-333333333333';

const state = { forms: [], stored: new Set(), uploads: [], rpc: vi.fn(), removed: [] };

function builder(table) {
  const filters = [];
  let op = 'select';
  const run = () => {
    if (table !== 'forms') return { data: [], error: null };
    const rows = state.forms.filter((r) => filters.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)));
    if (op === 'delete') state.forms = state.forms.filter((r) => !rows.includes(r));
    return { data: rows, error: null };
  };
  const b = {
    select: () => b,
    update: () => ((op = 'update'), b),
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

const storage = {
  upload: vi.fn(async (path, buffer, opts) => {
    state.uploads.push({ path, size: buffer.length, opts });
    state.stored.add(path);
    return { error: null };
  }),
  list: vi.fn(async (folder, { search }) => ({
    data: [...state.stored].filter((p) => p === `${folder}/${search}`).map((p) => ({ name: p.split('/')[1] })),
    error: null,
  })),
  createSignedUrl: vi.fn(async (path, ttl, opts) => ({ data: { signedUrl: `https://signed.test/${path}?ttl=${ttl}` }, error: null, opts })),
  remove: vi.fn(async (paths) => ((state.removed = paths), { error: null })),
};

vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: {
    from: (t) => builder(t),
    rpc: (...a) => state.rpc(...a),
    storage: { from: () => storage },
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

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200, 0x20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....word/document.xml....')]);

const makeForm = (over = {}) => ({
  id: formId,
  user_id: 'user-a',
  title: 'Apply',
  description: '',
  slug: 'apply-abc123',
  status: 'published',
  type: 'application',
  schema: {
    version: 1,
    fields: [
      { id: fieldId, key: 'name', type: 'text', label: 'Name', required: true, position: 0 },
      { id: fileFieldId, key: 'resume', type: 'file', label: 'Resume', required: false, position: 1, fileTypes: ['pdf', 'docx'] },
    ],
  },
  response_limit: null,
  response_count: 0,
  ...over,
});

const upload = (body, { field = 'resume', filename = 'cv.pdf', slug = 'apply-abc123', type = 'application/octet-stream' } = {}) =>
  request(app)
    .post(`/api/public/forms/${slug}/uploads`)
    .query({ field, filename })
    .set('Content-Type', type)
    .send(body);

beforeEach(() => {
  state.forms = [makeForm()];
  state.stored = new Set();
  state.uploads = [];
  state.removed = [];
  state.rpc = vi.fn().mockResolvedValue({ data: { response_id: 'r1', duplicate: false }, error: null });
  vi.clearAllMocks();
});

describe('matchesSignature', () => {
  it('accepts real headers and rejects mismatches', () => {
    expect(matchesSignature('pdf', PDF)).toBe(true);
    expect(matchesSignature('png', PNG)).toBe(true);
    expect(matchesSignature('jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(true);
    expect(matchesSignature('doc', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]))).toBe(true);
    expect(matchesSignature('docx', DOCX)).toBe(true);
    expect(matchesSignature('pdf', PNG)).toBe(false);
    expect(matchesSignature('docx', Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('xl/workbook.xml')]))).toBe(false);
    expect(matchesSignature('pdf', Buffer.from('MZ\x90\x00 an exe'))).toBe(false);
    expect(matchesSignature('exe', PDF)).toBe(false);
    expect(matchesSignature('pdf', Buffer.alloc(0))).toBe(false);
  });
});

describe('POST /api/public/forms/:slug/uploads', () => {
  it('stores a valid file privately and returns a reference', async () => {
    const res = await upload(PDF);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'cv.pdf', size: PDF.length });
    expect(res.body.data.path).toMatch(new RegExp(`^${formId}/[0-9a-f-]{36}\\.pdf$`));
    expect(state.uploads[0].opts).toMatchObject({ contentType: 'application/pdf', upsert: false });
  });

  it('uses a server-chosen storage name, never the client filename', async () => {
    const res = await upload(PDF, { filename: '../../evil name.pdf' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('evil name.pdf');
    expect(res.body.data.path).not.toContain('evil');
  });

  it('rejects types the field does not allow, even if the bytes are valid', async () => {
    const res = await upload(PNG, { filename: 'photo.png' });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    expect(res.body.error.message).toMatch(/\.pdf, \.docx/);
    expect(state.uploads).toHaveLength(0);
  });

  it('rejects unsupported extensions outright', async () => {
    for (const filename of ['run.exe', 'page.html', 'x.pdf.exe', 'noext', 'archive.zip']) {
      const res = await upload(PDF, { filename });
      expect(res.status, filename).toBe(415);
    }
  });

  it('rejects a file whose contents do not match its extension', async () => {
    const res = await upload(Buffer.from('MZ this is a program'), { filename: 'cv.pdf' });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('FILE_CONTENT_MISMATCH');
  });

  it('enforces the 1 MB limit', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(1024 * 1024)]);
    const res = await upload(big);
    expect(res.status).toBe(413);
    expect(state.uploads).toHaveLength(0);
    // exactly 1 MB is fine
    const exact = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(1024 * 1024 - 5)]);
    expect((await upload(exact)).status).toBe(201);
  });

  it('rejects empty bodies, wrong content type, unknown fields and non-file fields', async () => {
    expect((await upload(Buffer.alloc(0))).status).toBe(400);
    expect((await upload(PDF, { type: 'application/json' })).status).toBe(400);
    expect((await upload(PDF, { field: 'nope' })).status).toBe(400);
    expect((await upload(PDF, { field: 'name' })).status).toBe(400);
  });

  it('refuses uploads to drafts, closed forms and full forms', async () => {
    state.forms = [makeForm({ status: 'draft' })];
    expect((await upload(PDF)).status).toBe(404);
    state.forms = [makeForm({ status: 'closed' })];
    expect((await upload(PDF)).body.error.code).toBe('FORM_CLOSED');
    state.forms = [makeForm({ response_limit: 1, response_count: 1 })];
    expect((await upload(PDF)).body.error.code).toBe('LIMIT_REACHED');
  });
});

describe('submitting a response with a file', () => {
  const post = (answers) => request(app).post('/api/public/forms/apply-abc123/responses').send({ answers });

  it('accepts a file uploaded to this form and stores it by field id', async () => {
    const ref = (await upload(PDF)).body.data;
    const res = await post({ name: 'Rahul', resume: ref });
    expect(res.status).toBe(201);
    expect(state.rpc).toHaveBeenCalledWith(
      'submit_response',
      expect.objectContaining({ p_answers: { [fieldId]: 'Rahul', [fileFieldId]: ref } }),
    );
  });

  it('rejects references to files that were never uploaded or belong to another form', async () => {
    const other = `${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`;
    let res = await post({ name: 'A', resume: { path: other, name: 'x.pdf', size: 10 } });
    expect(res.status).toBe(422);
    const ghost = `${formId}/${crypto.randomUUID()}.pdf`; // right folder, never uploaded
    res = await post({ name: 'A', resume: { path: ghost, name: 'x.pdf', size: 10 } });
    expect(res.status).toBe(422);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('rejects a path-traversal reference and non-object values', async () => {
    expect((await post({ name: 'A', resume: { path: `${formId}/../secret.pdf`, name: 'x.pdf', size: 10 } })).status).toBe(422);
    expect((await post({ name: 'A', resume: 'cv.pdf' })).status).toBe(422);
  });

  it('keeps the file optional when the field is not required', async () => {
    expect((await post({ name: 'A' })).status).toBe(201);
  });
});

describe('GET /api/forms/:id/files (owner download)', () => {
  const path = `${formId}/${crypto.randomUUID()}.pdf`;
  const get = (p, token = 'tok-a', extra = {}) =>
    request(app).get(`/api/forms/${formId}/files`).query({ path: p, ...extra }).set('Authorization', `Bearer ${token}`);

  it('returns a short-lived signed URL to the owner', async () => {
    const res = await get(path, 'tok-a', { name: 'cv.pdf' });
    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain(path);
    expect(res.body.data.expires_in).toBe(60);
    expect(storage.createSignedUrl).toHaveBeenCalledWith(path, 60, { download: 'cv.pdf' });
  });

  it('requires login and hides other users’ files', async () => {
    expect((await request(app).get(`/api/forms/${formId}/files`).query({ path })).status).toBe(401);
    expect((await get(path, 'tok-b')).status).toBe(404);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses paths outside the form folder', async () => {
    const res = await get(`${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`);
    expect(res.status).toBe(404);
    expect((await get('../../etc/passwd')).status).toBe(404);
  });
});

describe('deleting a form', () => {
  it('removes its stored files', async () => {
    state.stored.add(`${formId}/aaa.pdf`);
    storage.list.mockResolvedValueOnce({ data: [{ name: 'aaa.pdf' }], error: null });
    const res = await request(app).delete(`/api/forms/${formId}`).set('Authorization', 'Bearer tok-a');
    expect(res.status).toBe(200);
    expect(state.removed).toEqual([`${formId}/aaa.pdf`]);
  });
});
