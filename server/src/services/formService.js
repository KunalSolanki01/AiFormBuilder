import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError, conflict, databaseError, notFound } from '../utils/AppError.js';
import { generateFormSlug } from '../utils/slug.js';

const DETAIL_COLUMNS =
  'id, user_id, title, description, slug, status, type, schema, response_limit, response_count, created_at, updated_at';
const LIST_COLUMNS =
  'id, title, description, slug, status, type, response_limit, response_count, created_at, updated_at';

const UNIQUE_VIOLATION = '23505';

/** DB row → API shape. `schema.fields` is the source of truth for rendering. */
export function toFormDto(row) {
  const { schema, user_id: _userId, ...rest } = row;
  return { ...rest, fields: schema?.fields ?? [] };
}

export function isAcceptingResponses(form) {
  return (
    form.status === 'published' && (form.response_limit == null || form.response_count < form.response_limit)
  );
}

async function syncFields(formId, fields) {
  const { error } = await supabaseAdmin.rpc('sync_form_fields', { p_form_id: formId, p_fields: fields });
  if (error) throw databaseError(error, 'sync_form_fields failed');
}

export async function listForms(userId) {
  const { data, error } = await supabaseAdmin
    .from('forms')
    .select(LIST_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw databaseError(error, 'listForms');
  return data;
}

/** Loads a form owned by `userId`. Returns 404 (not 403) for other users' forms to avoid leaking existence. */
export async function getOwnedFormRow(userId, formId) {
  const { data, error } = await supabaseAdmin
    .from('forms')
    .select(DETAIL_COLUMNS)
    .eq('id', formId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw databaseError(error, 'getOwnedForm');
  if (!data) throw notFound('Form not found.');
  return data;
}

export async function getOwnedForm(userId, formId) {
  return toFormDto(await getOwnedFormRow(userId, formId));
}

export async function createForm(userId, { title, description, type, fields, response_limit }) {
  let row;
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    const { data, error } = await supabaseAdmin
      .from('forms')
      .insert({
        user_id: userId,
        title,
        description,
        type,
        slug: generateFormSlug(title),
        status: 'draft',
        schema: { version: 1, fields },
        response_limit,
      })
      .select(DETAIL_COLUMNS)
      .single();
    if (error?.code === UNIQUE_VIOLATION) continue; // slug collision — retry with a new suffix
    if (error) throw databaseError(error, 'createForm');
    row = data;
  }
  if (!row) throw new AppError(500, 'SLUG_GENERATION_FAILED', 'Could not create the form. Please try again.');

  try {
    await syncFields(row.id, fields);
  } catch (err) {
    await supabaseAdmin.from('forms').delete().eq('id', row.id);
    throw err;
  }
  return toFormDto(row);
}

/**
 * Safeguards for editing a form that already has responses:
 * an existing field's type cannot change, because stored answers would no longer match it.
 */
function assertSafeFieldChanges(existing, nextFields) {
  if (!existing.response_count) return;
  const previous = new Map((existing.schema?.fields ?? []).map((f) => [f.id, f]));
  const changed = nextFields.filter((f) => previous.has(f.id) && previous.get(f.id).type !== f.type);
  if (changed.length) {
    throw conflict(
      'FIELD_TYPE_LOCKED',
      `"${changed[0].label}" already has responses, so its type can't be changed. Add a new question instead.`,
      changed.map((f) => ({ path: f.key, message: 'Field type is locked because responses exist.' })),
    );
  }
}

export async function updateForm(userId, formId, patch) {
  const existing = await getOwnedFormRow(userId, formId);

  const update = {};
  for (const key of ['title', 'description', 'type', 'response_limit']) {
    if (patch[key] !== undefined) update[key] = patch[key];
  }
  if (patch.fields) {
    assertSafeFieldChanges(existing, patch.fields);
    await syncFields(formId, patch.fields);
    update.schema = { ...(existing.schema ?? {}), version: 1, fields: patch.fields };
  }

  const { data, error } = await supabaseAdmin
    .from('forms')
    .update(update)
    .eq('id', formId)
    .eq('user_id', userId)
    .select(DETAIL_COLUMNS)
    .single();
  if (error) throw databaseError(error, 'updateForm');
  return toFormDto(data);
}

export async function deleteForm(userId, formId) {
  const { data, error } = await supabaseAdmin
    .from('forms')
    .delete()
    .eq('id', formId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw databaseError(error, 'deleteForm');
  if (!data?.length) throw notFound('Form not found.');
}

async function setStatus(userId, formId, status) {
  const { data, error } = await supabaseAdmin
    .from('forms')
    .update({ status })
    .eq('id', formId)
    .eq('user_id', userId)
    .select(DETAIL_COLUMNS)
    .single();
  if (error) throw databaseError(error, 'setStatus');
  return toFormDto(data);
}

export async function publishForm(userId, formId) {
  const form = await getOwnedFormRow(userId, formId);
  if (!(form.schema?.fields ?? []).length) {
    throw conflict('FORM_EMPTY', 'Add at least one question before publishing.');
  }
  if ((form.schema?.fields ?? []).some((f) => f.type === 'email' && f.verifyEmail) && !env.GOOGLE_CLIENT_ID) {
    throw conflict(
      'GOOGLE_NOT_CONFIGURED',
      'This form verifies emails with Google, but GOOGLE_CLIENT_ID is not set on the server. Add it, or turn the option off.',
    );
  }
  if (form.status === 'published') return toFormDto(form);
  return setStatus(userId, formId, 'published');
}

export async function closeForm(userId, formId) {
  const form = await getOwnedFormRow(userId, formId);
  if (form.status === 'draft') throw conflict('FORM_NOT_PUBLISHED', 'Only published forms can be closed.');
  if (form.status === 'closed') return toFormDto(form);
  return setStatus(userId, formId, 'closed');
}

/** Public lookup — drafts are invisible. */
export async function getPublicFormRow(slug) {
  const { data, error } = await supabaseAdmin
    .from('forms')
    .select('id, title, description, slug, status, type, schema, response_limit, response_count')
    .eq('slug', slug)
    .in('status', ['published', 'closed'])
    .maybeSingle();
  if (error) throw databaseError(error, 'getPublicForm');
  if (!data) throw notFound("This form doesn't exist or isn't published yet.");
  return data;
}

export function toPublicFormDto(row) {
  const needsGoogle = (row.schema?.fields ?? []).some((f) => f.type === 'email' && f.verifyEmail);
  const accepting = isAcceptingResponses(row);
  return {
    title: row.title,
    description: row.description,
    slug: row.slug,
    type: row.type,
    status: row.status,
    fields: row.schema?.fields ?? [],
    accepting_responses: accepting,
    ...(needsGoogle && env.GOOGLE_CLIENT_ID && { google_client_id: env.GOOGLE_CLIENT_ID }),
    closed_reason: accepting ? null : row.status !== 'published' ? 'closed' : 'limit_reached',
    ...(row.response_limit != null && {
      remaining: Math.max(0, row.response_limit - row.response_count),
      response_limit: row.response_limit,
    }),
  };
}
