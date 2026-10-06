import { z } from 'zod';
import { FILE_UPLOAD, LIMITS, allowedExtensions, fileExtension } from './fieldTypes.js';
import { stripTags } from './formSchema.js';

/** `<formId>/<uuid>.<ext>` — what the upload endpoint hands back and the submit endpoint accepts. */
export const FILE_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|doc|docx|jpg|jpeg|png)$/;

/** Removes path parts and control characters from a user-supplied file name. */
export const cleanFileName = (name) =>
  stripTags(String(name ?? ''))
    .split(/[\\/]/)
    .pop()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-120);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-().]*$/;

export function isEmptyAnswer(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

const toNumber = (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
const toBoolean = (v) => (v === 'true' ? true : v === 'false' ? false : v);

function isRealDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function textSchema(field, defaultMax) {
  const max = Math.min(field.maxLength ?? defaultMax, defaultMax);
  let s = z.string({ error: 'Enter text.' }).trim();
  if (field.minLength) s = s.min(field.minLength, { error: `Enter at least ${field.minLength} characters.` });
  return s.max(max, { error: `Keep it under ${max} characters.` });
}

/** Zod schema for a single (non-empty) answer to the given field. */
export function valueSchema(field) {
  switch (field.type) {
    case 'text':
      return textSchema(field, LIMITS.TEXT_ANSWER_MAX);
    case 'textarea':
      return textSchema(field, LIMITS.TEXTAREA_ANSWER_MAX);
    case 'email':
      return z
        .string({ error: 'Enter a valid email address.' })
        .trim()
        .toLowerCase()
        .max(254)
        .pipe(z.email({ error: 'Enter a valid email address.' }));
    case 'phone':
      return z
        .string({ error: 'Enter a valid phone number.' })
        .trim()
        .max(25, { error: 'Enter a valid phone number.' })
        .regex(PHONE_RE, { error: 'Enter a valid phone number.' })
        .refine((v) => {
          const digits = v.replace(/\D/g, '').length;
          return digits >= 7 && digits <= 15;
        }, { error: 'Enter a valid phone number.' });
    case 'number': {
      let n = z.number({ error: 'Enter a valid number.' }).finite({ error: 'Enter a valid number.' });
      if (field.min !== undefined) n = n.min(field.min, { error: `Must be at least ${field.min}.` });
      if (field.max !== undefined) n = n.max(field.max, { error: `Must be at most ${field.max}.` });
      return z.preprocess(toNumber, n);
    }
    case 'select':
    case 'radio': {
      const options = field.options ?? [];
      return z
        .string({ error: 'Select an option.' })
        .refine((v) => options.includes(v), { error: 'Select one of the available options.' });
    }
    case 'checkbox': {
      const options = field.options ?? [];
      return z
        .array(z.string(), { error: 'Select at least one option.' })
        .refine((arr) => arr.every((v) => options.includes(v)), { error: 'Select only the available options.' })
        .transform((arr) => [...new Set(arr)]);
    }
    case 'rating': {
      const scale = field.scale ?? LIMITS.RATING_DEFAULT_SCALE;
      return z.preprocess(
        toNumber,
        z
          .number({ error: 'Choose a rating.' })
          .int({ error: 'Choose a rating.' })
          .min(1, { error: 'Choose a rating.' })
          .max(scale, { error: `Rating must be between 1 and ${scale}.` }),
      );
    }
    case 'date':
      return z
        .string({ error: 'Enter a valid date.' })
        .regex(DATE_RE, { error: 'Enter a valid date.' })
        .refine(isRealDate, { error: 'Enter a valid date.' });
    case 'boolean':
      return z.preprocess(toBoolean, z.boolean({ error: 'Choose yes or no.' }));
    case 'file': {
      const allowed = allowedExtensions(field);
      const listed = allowed.map((e) => `.${e}`).join(', ');
      return z
        .object(
          {
            path: z.string().regex(FILE_PATH_RE, { error: 'Upload the file again.' }),
            name: z
              .string()
              .transform(cleanFileName)
              .pipe(z.string().min(1, { error: 'Upload the file again.' })),
            size: z
              .number()
              .int()
              .min(1, { error: 'The file is empty.' })
              .max(FILE_UPLOAD.MAX_BYTES, { error: `Files can be up to ${FILE_UPLOAD.MAX_LABEL}.` }),
          },
          { error: 'Upload a file.' },
        )
        .refine((v) => allowed.includes(fileExtension(v.path)), { error: `Allowed file types: ${listed}.` });
    }
    default:
      return z.never({ error: 'Unsupported field.' });
  }
}

/**
 * Validates a submission against the form's fields.
 * Unknown keys are dropped; empty optional answers are omitted.
 * @returns {{ success: boolean, data: Record<string, unknown>, errors: Record<string, string> }}
 */
export function validateAnswers(fields, answers) {
  const errors = {};
  const data = {};
  const input = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};

  for (const field of fields) {
    const raw = input[field.key];
    if (isEmptyAnswer(raw)) {
      if (field.required) errors[field.key] = 'This field is required.';
      continue;
    }
    const result = valueSchema(field).safeParse(raw);
    if (result.success) data[field.key] = result.data;
    else errors[field.key] = result.error.issues[0]?.message ?? 'Invalid value.';
  }

  return { success: Object.keys(errors).length === 0, data, errors };
}

/** Validates one field only — used for inline validation in the UI. */
export function validateAnswer(field, value) {
  if (isEmptyAnswer(value)) return field.required ? 'This field is required.' : null;
  const result = valueSchema(field).safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid value.');
}
