import { z } from 'zod';
import { FIELD_TYPES, FILE_UPLOAD, FORM_TYPES, LIMITS, isOptionType } from './fieldTypes.js';

export const FIELD_KEY_RE = /^[a-z][a-z0-9_]*$/;

/** Removes HTML tags and control characters. Forms are plain text only. */
export function stripTags(value) {
  return String(value)
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** A trimmed, tag-free plain-text string with length bounds. */
export const cleanText = (min, max, label = 'Value') =>
  z
    .string()
    .transform((s) => stripTags(s).trim())
    .pipe(
      z
        .string()
        .min(min, { error: min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.` })
        .max(max, { error: `${label} must be at most ${max} characters.` }),
    );

export const fieldSchema = z
  .object({
    id: z.uuid({ error: 'Field id must be a UUID.' }),
    key: z
      .string()
      .max(LIMITS.KEY_MAX)
      .regex(FIELD_KEY_RE, { error: 'Field key must be snake_case and start with a letter.' }),
    type: z.enum(FIELD_TYPES, { error: 'Unsupported field type.' }),
    label: cleanText(1, LIMITS.LABEL_MAX, 'Label'),
    description: cleanText(0, LIMITS.FIELD_DESCRIPTION_MAX, 'Description').optional(),
    placeholder: cleanText(0, LIMITS.PLACEHOLDER_MAX, 'Placeholder').optional(),
    required: z.boolean().default(false),
    position: z.number().int().min(0),
    options: z.array(cleanText(1, LIMITS.OPTION_MAX, 'Option')).max(LIMITS.MAX_OPTIONS).optional(),
    scale: z.number().int().min(LIMITS.RATING_MIN_SCALE).max(LIMITS.RATING_MAX_SCALE).optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    minLength: z.number().int().min(0).max(LIMITS.TEXTAREA_ANSWER_MAX).optional(),
    maxLength: z.number().int().min(1).max(LIMITS.TEXTAREA_ANSWER_MAX).optional(),
    /** File fields only: allowed extensions (a subset of FILE_UPLOAD.EXTENSIONS). Empty/absent = all. */
    fileTypes: z.array(z.enum(FILE_UPLOAD.EXTENSIONS)).max(FILE_UPLOAD.EXTENSIONS.length).optional(),
    /** Email fields only: respondents must confirm the address by signing in with Google. */
    verifyEmail: z.boolean().optional(),
    /** Verified email questions only: each verified address may respond once. */
    uniqueEmail: z.boolean().optional(),
  })
  .strip()
  .superRefine((field, ctx) => {
    if (field.uniqueEmail && !(field.type === 'email' && field.verifyEmail)) {
      ctx.addIssue({ code: 'custom', path: ['uniqueEmail'], message: 'One response per email needs email verification to be on.' });
    }
    if (field.verifyEmail && field.type !== 'email') {
      ctx.addIssue({ code: 'custom', path: ['verifyEmail'], message: 'Only email questions can verify the address.' });
    }
    if (field.type === 'file' && new Set(field.fileTypes ?? []).size !== (field.fileTypes ?? []).length) {
      ctx.addIssue({ code: 'custom', path: ['fileTypes'], message: `"${field.label}" lists a file type twice.` });
    }
    if (isOptionType(field.type)) {
      const options = field.options ?? [];
      if (options.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: `"${field.label}" needs at least one option.` });
      }
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: `"${field.label}" has duplicate options.` });
      }
    }
    if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
      ctx.addIssue({ code: 'custom', path: ['min'], message: 'Minimum cannot be greater than maximum.' });
    }
    if (field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) {
      ctx.addIssue({ code: 'custom', path: ['minLength'], message: 'Minimum length cannot exceed maximum length.' });
    }
  });

const fieldsArray = z
  .array(fieldSchema)
  .max(LIMITS.MAX_FIELDS, { error: `A form can have at most ${LIMITS.MAX_FIELDS} fields.` })
  .superRefine((fields, ctx) => {
    const keys = new Set();
    const ids = new Set();
    fields.forEach((f, i) => {
      if (keys.has(f.key)) ctx.addIssue({ code: 'custom', path: [i, 'key'], message: `Duplicate field key "${f.key}".` });
      if (ids.has(f.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate field id.' });
      if (f.verifyEmail && fields.findIndex((x) => x.verifyEmail) !== i) {
        ctx.addIssue({ code: 'custom', path: [i, 'verifyEmail'], message: 'Only one email question per form can verify with Google.' });
      }
      keys.add(f.key);
      ids.add(f.id);
    });
  })
  // Positions are always re-derived from array order so they stay contiguous.
  .transform((fields) => fields.map((f, i) => ({ ...f, position: i })));

export const formContentSchema = z.object({
  title: cleanText(1, LIMITS.TITLE_MAX, 'Title'),
  description: cleanText(0, LIMITS.FORM_DESCRIPTION_MAX, 'Description').optional().default(''),
  type: z.enum(FORM_TYPES).default('survey'),
  fields: fieldsArray,
});

export const responseLimitSchema = z
  .number()
  .int()
  .min(1, { error: 'Response limit must be at least 1.' })
  .max(LIMITS.RESPONSE_LIMIT_MAX)
  .nullable();

/** Turns a ZodError into a flat list of readable messages. */
export function formatZodError(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
