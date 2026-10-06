import { randomUUID } from 'node:crypto';
import { FILE_PATH_RE, FILE_UPLOAD, allowedExtensions, cleanFileName, fileExtension } from '@afb/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError, badRequest, conflict, databaseError, notFound } from '../utils/AppError.js';
import { matchesSignature } from '../utils/fileSignature.js';
import { getOwnedFormRow, getPublicFormRow, isAcceptingResponses } from './formService.js';

export const UPLOAD_BUCKET = 'form-uploads';
const bucket = () => supabaseAdmin.storage.from(UPLOAD_BUCKET);

const storageError = (error, context) => {
  const err = new AppError(502, 'STORAGE_ERROR', "We couldn't handle that file right now. Please try again.");
  err.cause = error;
  err.context = `Supabase Storage: ${context}: ${error?.message ?? error}`;
  return err;
};

/**
 * Public upload: validates against the target field, then stores the file privately.
 * Returns the reference the respondent includes in their submission.
 */
export async function uploadFile(slug, fieldKey, filename, buffer) {
  const form = await getPublicFormRow(slug);
  if (form.status !== 'published') throw conflict('FORM_CLOSED', 'This form is no longer accepting responses.');
  if (!isAcceptingResponses(form)) throw conflict('LIMIT_REACHED', 'Sorry — this form has reached its response limit.');

  const field = (form.schema?.fields ?? []).find((f) => f.key === fieldKey && f.type === 'file');
  if (!field) throw badRequest('This form has no file question with that name.');

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw badRequest('The file is empty.');
  if (buffer.length > FILE_UPLOAD.MAX_BYTES) {
    throw new AppError(413, 'FILE_TOO_LARGE', `Files can be up to ${FILE_UPLOAD.MAX_LABEL}.`);
  }

  const name = cleanFileName(filename);
  const ext = fileExtension(name);
  const allowed = allowedExtensions(field);
  if (!allowed.includes(ext)) {
    throw new AppError(
      415,
      'FILE_TYPE_NOT_ALLOWED',
      `That file type isn't allowed. Use: ${allowed.map((e) => `.${e}`).join(', ')}.`,
    );
  }
  if (!matchesSignature(ext, buffer)) {
    throw new AppError(415, 'FILE_CONTENT_MISMATCH', `That doesn't look like a real .${ext} file.`);
  }

  const path = `${form.id}/${randomUUID()}.${ext}`;
  const { error } = await bucket().upload(path, buffer, { contentType: FILE_UPLOAD.MIME[ext], upsert: false });
  if (error) throw storageError(error, 'upload');

  return { path, name, size: buffer.length };
}

/** Throws unless every referenced file lives in this form's folder and still exists. */
export async function assertFilesBelongToForm(formId, refs) {
  for (const { path } of refs) {
    if (!FILE_PATH_RE.test(path) || !path.startsWith(`${formId}/`)) {
      throw new AppError(422, 'INVALID_RESPONSE', 'Please upload the file again.', [
        { path: 'file', message: 'Upload the file again.' },
      ]);
    }
    const objectName = path.slice(formId.length + 1);
    const { data, error } = await bucket().list(formId, { limit: 1, search: objectName });
    if (error) throw storageError(error, 'list');
    if (!data?.some((o) => o.name === objectName)) {
      throw new AppError(422, 'INVALID_RESPONSE', 'Please upload the file again.', [
        { path: 'file', message: 'Upload the file again.' },
      ]);
    }
  }
}

/** Owner-only: short-lived download link for a file that belongs to one of their forms. */
export async function getDownloadUrl(userId, formId, path, name) {
  await getOwnedFormRow(userId, formId);
  if (!FILE_PATH_RE.test(path) || !path.startsWith(`${formId}/`)) throw notFound('File not found.');

  const download = cleanFileName(name) || true;
  const { data, error } = await bucket().createSignedUrl(path, 60, { download });
  if (error || !data?.signedUrl) {
    if (/not found|does not exist/i.test(error?.message ?? '')) throw notFound('File not found.');
    throw error ? storageError(error, 'sign') : databaseError(new Error('no url'), 'sign');
  }
  return { url: data.signedUrl, expires_in: 60 };
}

/** Best-effort cleanup when a form is deleted (the DB cascade doesn't touch Storage). */
export async function removeFormFiles(formId) {
  try {
    for (let i = 0; i < 20; i++) {
      const { data, error } = await bucket().list(formId, { limit: 100 });
      if (error || !data?.length) return;
      const { error: rmError } = await bucket().remove(data.map((o) => `${formId}/${o.name}`));
      if (rmError) return;
      if (data.length < 100) return;
    }
  } catch (err) {
    console.error(`Could not remove files for form ${formId}:`, err?.message ?? err);
  }
}
