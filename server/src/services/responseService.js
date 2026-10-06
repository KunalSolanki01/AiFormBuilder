import { validateAnswers } from '@afb/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError, conflict, databaseError, notFound } from '../utils/AppError.js';
import { alreadyRespondedError } from './duplicateService.js';
import { checkVerification, isGoogleConfigured } from './emailVerificationService.js';
import { assertFilesBelongToForm } from './fileService.js';
import { getOwnedFormRow, getPublicFormRow, isAcceptingResponses } from './formService.js';

const PAGE = 1000; // PostgREST max rows per request
export const MAX_RESPONSES_LOADED = 20_000;

const RPC_ERRORS = {
  FORM_NOT_FOUND: () => notFound("This form doesn't exist or isn't published yet."),
  FORM_CLOSED: () => conflict('FORM_CLOSED', 'This form is no longer accepting responses.'),
  LIMIT_REACHED: () => conflict('LIMIT_REACHED', 'Sorry — this form has reached its response limit.'),
};

/** Turns DB rows into `{ id, submitted_at, answers: { [fieldKey]: value } }`. */
export function mapResponseRow(row, fieldsById, { includeMetadata = false } = {}) {
  const answers = {};
  for (const a of row.response_answers ?? []) {
    const field = fieldsById.get(a.field_id);
    if (field) answers[field.key] = a.value;
  }
  return {
    id: row.id,
    submitted_at: row.submitted_at,
    answers,
    verified: row.metadata?.verified_emails ?? {},
    ...(includeMetadata && { metadata: row.metadata ?? {} }),
  };
}

const indexFields = (fields) => new Map(fields.map((f) => [f.id, f]));

// ── Public submission ──────────────────────────────────

export async function submitResponse(slug, { answers, submission_id, verifications = {} }, meta = {}) {
  const form = await getPublicFormRow(slug);
  if (form.status !== 'published') throw RPC_ERRORS.FORM_CLOSED();
  if (!isAcceptingResponses(form)) throw RPC_ERRORS.LIMIT_REACHED();

  const fields = form.schema?.fields ?? [];
  const result = validateAnswers(fields, answers);
  if (!result.success) {
    throw new AppError(
      422,
      'INVALID_RESPONSE',
      'Please fix the highlighted fields and try again.',
      Object.entries(result.errors).map(([path, message]) => ({ path, message })),
    );
  }

  // Email questions that require Google verification need a matching, unexpired proof.
  const verified = {};
  const mustVerify = fields.filter((f) => f.type === 'email' && f.verifyEmail && result.data[f.key]);
  if (mustVerify.length && !isGoogleConfigured()) {
    throw new AppError(503, 'EMAIL_VERIFICATION_UNAVAILABLE', 'Email verification is not set up on this server.');
  }
  const unverified = mustVerify.filter((f) => {
    const ok = checkVerification(verifications[f.key], { formId: form.id, fieldKey: f.key, email: result.data[f.key] });
    if (ok) verified[f.key] = 'google';
    return !ok;
  });
  if (unverified.length) {
    throw new AppError(
      422,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email with Google and try again.',
      unverified.map((f) => ({ path: f.key, message: 'Verify this email with Google.' })),
    );
  }

  // "One response per verified email": the verified address becomes the dedupe key (checked atomically in the DB).
  const uniqueField = mustVerify.find((f) => f.uniqueEmail);

  // Uploaded files must live in this form's folder and still exist.
  await assertFilesBelongToForm(
    form.id,
    fields.filter((f) => f.type === 'file' && result.data[f.key]).map((f) => result.data[f.key]),
  );

  const byFieldId = {};
  for (const field of fields) {
    if (result.data[field.key] !== undefined) byFieldId[field.id] = result.data[field.key];
  }

  const { data, error } = await supabaseAdmin.rpc('submit_response', {
    p_form_id: form.id,
    p_answers: byFieldId,
    p_metadata: {
      source: 'web',
      ...(Object.keys(verified).length && { verified_emails: verified }),
      user_agent: meta.userAgent ? String(meta.userAgent).slice(0, 300) : undefined,
    },
    p_submission_id: submission_id ?? null,
    p_dedupe_key: uniqueField ? result.data[uniqueField.key].toLowerCase() : null,
    p_dedupe_field_id: uniqueField ? uniqueField.id : null,
  });
  if (error) {
    if (uniqueField && (error.message === 'ALREADY_RESPONDED' || (error.code === '23505' && /dedupe/i.test(error.message)))) {
      throw alreadyRespondedError(uniqueField.key);
    }
    const mapped = RPC_ERRORS[error.message];
    if (mapped) throw mapped();
    throw databaseError(error, 'submit_response');
  }

  return { response_id: data.response_id, duplicate: data.duplicate === true };
}

// ── Owner reads ────────────────────────────────────────

/** Loads every response (newest first) for analytics/AI. Paginates past the PostgREST row cap. */
export async function fetchAllResponses(formId, fields) {
  const fieldsById = indexFields(fields);
  const rows = [];
  for (let from = 0; from < MAX_RESPONSES_LOADED; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('responses')
      .select('id, submitted_at, metadata, response_answers(field_id, value)')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw databaseError(error, 'fetchAllResponses');
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows.map((r) => mapResponseRow(r, fieldsById));
}

function answerToSearchText(value) {
  if (Array.isArray(value)) return value.join(' ');
  if (value && typeof value === 'object') return String(value.name ?? '');
  if (typeof value === 'boolean') return value ? 'yes true' : 'no false';
  return String(value ?? '');
}

function matchesFilter(answer, value) {
  if (answer === undefined || answer === null) return false;
  if (Array.isArray(answer)) return answer.includes(value);
  if (typeof answer === 'boolean') return String(answer) === value.toLowerCase() || (answer ? 'yes' : 'no') === value.toLowerCase();
  return String(answer).toLowerCase() === value.toLowerCase();
}

/** Pure filter/sort/paginate — exported for tests. */
export function queryResponses(responses, { search, sort, page, pageSize, from, to, field, value }) {
  let items = responses;

  if (from) items = items.filter((r) => r.submitted_at.slice(0, 10) >= from);
  if (to) items = items.filter((r) => r.submitted_at.slice(0, 10) <= to);
  if (field && value !== undefined && value !== '') items = items.filter((r) => matchesFilter(r.answers[field], value));
  if (search) {
    const needle = search.toLowerCase();
    items = items.filter((r) =>
      Object.values(r.answers).some((v) => answerToSearchText(v).toLowerCase().includes(needle)),
    );
  }

  items = [...items].sort((a, b) =>
    sort === 'oldest' ? a.submitted_at.localeCompare(b.submitted_at) : b.submitted_at.localeCompare(a.submitted_at),
  );

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listResponses(userId, formId, query) {
  const form = await getOwnedFormRow(userId, formId);
  const fields = form.schema?.fields ?? [];
  const all = await fetchAllResponses(formId, fields);
  return { ...queryResponses(all, query), fields, response_count: form.response_count };
}

export async function getResponse(userId, formId, responseId) {
  const form = await getOwnedFormRow(userId, formId);
  const { data, error } = await supabaseAdmin
    .from('responses')
    .select('id, submitted_at, metadata, response_answers(field_id, value)')
    .eq('id', responseId)
    .eq('form_id', formId)
    .maybeSingle();
  if (error) throw databaseError(error, 'getResponse');
  if (!data) throw notFound('Response not found.');
  const fields = form.schema?.fields ?? [];
  return { response: mapResponseRow(data, indexFields(fields), { includeMetadata: true }), fields };
}
