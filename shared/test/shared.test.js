import { describe, expect, it } from 'vitest';
import {
  createField,
  formContentSchema,
  normalizeAiForm,
  SchemaNormalizationError,
  toFieldKey,
  validateAnswer,
  validateAnswers,
} from '../src/index.js';

const field = (type, extra = {}) => ({ ...createField(type), key: extra.key ?? type, ...extra });

describe('normalizeAiForm', () => {
  it('accepts the PRD hackathon example', () => {
    const { form, warnings } = normalizeAiForm({
      title: 'College Hackathon Registration',
      description: 'Register for the college hackathon.',
      type: 'event',
      fields: [
        { key: 'full_name', type: 'text', label: 'Full Name', required: true, position: 1 },
        { key: 'email', type: 'email', label: 'Email Address', required: true, position: 2 },
        { key: 'phone', type: 'phone', label: 'Phone Number', required: true, position: 3 },
        { key: 'track', type: 'select', label: 'Preferred Track', options: ['AI', 'Web', 'Web'] },
      ],
    });
    expect(warnings).toEqual([]);
    expect(form.type).toBe('event');
    expect(form.fields.map((f) => f.key)).toEqual(['full_name', 'email', 'phone', 'track']);
    expect(form.fields.map((f) => f.position)).toEqual([0, 1, 2, 3]);
    expect(form.fields[3].options).toEqual(['AI', 'Web']);
  });

  it('maps type aliases and drops unsupported types with a warning', () => {
    const { form, warnings } = normalizeAiForm({
      title: 'X',
      fields: [
        { label: 'Mobile', type: 'tel' },
        { label: 'Signature', type: 'signature' },
        { label: 'Happy?', type: 'yes_no' },
      ],
    });
    expect(form.fields.map((f) => f.type)).toEqual(['phone', 'boolean']);
    expect(warnings[0]).toMatch(/Signature/);
  });

  it('maps upload-style types to file and keeps only supported extensions', () => {
    const { form } = normalizeAiForm({
      title: 'Apply',
      fields: [
        { label: 'Resume', type: 'file_upload', fileTypes: ['PDF', '.docx', 'exe', 'pdf'] },
        { label: 'Photo', type: 'image' },
      ],
    });
    expect(form.fields.map((f) => f.type)).toEqual(['file', 'file']);
    expect(form.fields[0].fileTypes).toEqual(['pdf', 'docx']);
    expect(form.fields[1].fileTypes).toBeUndefined();
  });

  it('converts option fields without options to text', () => {
    const { form, warnings } = normalizeAiForm({ title: 'X', fields: [{ label: 'Pick', type: 'select' }] });
    expect(form.fields[0].type).toBe('text');
    expect(warnings).toHaveLength(1);
  });

  it('dedupes keys, strips HTML and clamps rating scale', () => {
    const { form } = normalizeAiForm({
      title: '<script>alert(1)</script>Survey',
      fields: [
        { label: 'Name', type: 'text' },
        { label: 'Name', type: 'text' },
        { label: '<b>Rate</b> us', type: 'rating', scale: 50 },
      ],
    });
    expect(form.title).toBe('alert(1)Survey');
    expect(form.fields.map((f) => f.key)).toEqual(['name', 'name_2', 'rate_us']);
    expect(form.fields[2].label).toBe('Rate us');
    expect(form.fields[2].scale).toBe(10);
  });

  it('rejects malformed or empty output', () => {
    expect(() => normalizeAiForm(null)).toThrow(SchemaNormalizationError);
    expect(() => normalizeAiForm({ title: 'X' })).toThrow(SchemaNormalizationError);
    expect(() => normalizeAiForm({ title: 'X', fields: [{ type: 'signature', label: 'Sign' }] })).toThrow(
      /supported fields/,
    );
  });
});

describe('formContentSchema', () => {
  it('rejects duplicate keys and empty option lists', () => {
    const a = field('text', { key: 'dup' });
    const b = field('text', { key: 'dup' });
    expect(formContentSchema.safeParse({ title: 'T', fields: [a, b] }).success).toBe(false);
    const sel = field('select', { options: [] });
    expect(formContentSchema.safeParse({ title: 'T', fields: [sel] }).success).toBe(false);
  });

  it('rejects unknown field types', () => {
    const bad = { ...field('text'), type: 'signature' };
    expect(formContentSchema.safeParse({ title: 'T', fields: [bad] }).success).toBe(false);
  });
});

describe('validateAnswers', () => {
  const fields = [
    field('text', { key: 'name', required: true }),
    field('email', { key: 'email', required: true }),
    field('number', { key: 'team_size', min: 1, max: 4 }),
    field('phone', { key: 'phone' }),
    field('select', { key: 'track', options: ['AI', 'Web'] }),
    field('checkbox', { key: 'langs', options: ['JS', 'Py'] }),
    field('rating', { key: 'rating', scale: 5 }),
    field('date', { key: 'dob' }),
    field('boolean', { key: 'veg' }),
  ];

  it('accepts a valid submission and coerces values', () => {
    const r = validateAnswers(fields, {
      name: '  Rahul ',
      email: 'Rahul@Example.com',
      team_size: '4',
      phone: '+91 98765 43210',
      track: 'AI',
      langs: ['JS', 'JS'],
      rating: 5,
      dob: '2001-02-28',
      veg: false,
      injected: 'ignored',
    });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      name: 'Rahul',
      email: 'rahul@example.com',
      team_size: 4,
      phone: '+91 98765 43210',
      track: 'AI',
      langs: ['JS'],
      rating: 5,
      dob: '2001-02-28',
      veg: false,
    });
  });

  it('reports required and invalid values', () => {
    const r = validateAnswers(fields, {
      email: 'nope',
      team_size: 9,
      phone: '12',
      track: 'Blockchain',
      langs: ['Go'],
      rating: 6,
      dob: '2001-02-30',
    });
    expect(r.success).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(
      ['dob', 'email', 'langs', 'name', 'phone', 'rating', 'team_size', 'track'].sort(),
    );
    expect(r.errors.name).toBe('This field is required.');
  });

  it('validateAnswer handles optional empties', () => {
    expect(validateAnswer(fields[3], '')).toBeNull();
    expect(validateAnswer(fields[0], '')).toBe('This field is required.');
  });
});

describe('file answers', () => {
  const formId = crypto.randomUUID();
  const ref = (ext, over = {}) => ({ path: `${formId}/${crypto.randomUUID()}.${ext}`, name: `my file.${ext}`, size: 1000, ...over });
  const f = field('file', { key: 'resume', fileTypes: ['pdf', 'docx'] });

  it('accepts an uploaded file reference of an allowed type', () => {
    const r = validateAnswers([f], { resume: ref('pdf', { name: 'C:\\fakepath\\<b>cv</b>.pdf' }) });
    expect(r.success).toBe(true);
    expect(r.data.resume.name).toBe('cv.pdf');
  });

  it('rejects disallowed types, oversize, bad paths and non-objects', () => {
    expect(validateAnswers([f], { resume: ref('png') }).errors.resume).toMatch(/Allowed file types: \.pdf, \.docx/);
    expect(validateAnswers([f], { resume: ref('pdf', { size: 1024 * 1024 + 1 }) }).errors.resume).toMatch(/1 MB/);
    expect(validateAnswers([f], { resume: ref('pdf', { path: '../../etc/passwd.pdf' }) }).success).toBe(false);
    expect(validateAnswers([f], { resume: 'cv.pdf' }).success).toBe(false);
  });

  it('defaults to all six supported types and honours required', () => {
    const open = field('file', { key: 'doc', required: true });
    for (const ext of ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']) {
      expect(validateAnswers([open], { doc: ref(ext) }).success).toBe(true);
    }
    expect(validateAnswers([open], {}).errors.doc).toBe('This field is required.');
  });

  it('rejects unknown fileTypes in the form schema', () => {
    const bad = { ...f, fileTypes: ['exe'] };
    expect(formContentSchema.safeParse({ title: 'T', fields: [bad] }).success).toBe(false);
    expect(formContentSchema.safeParse({ title: 'T', fields: [f] }).success).toBe(true);
  });
});

describe('toFieldKey', () => {
  it('produces snake_case keys starting with a letter', () => {
    expect(toFieldKey('Full Name!')).toBe('full_name');
    expect(toFieldKey('2nd choice')).toBe('f_2nd_choice');
    expect(toFieldKey('***')).toBe('field');
  });
});
