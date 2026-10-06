import { z } from 'zod';
import { FORM_TYPES, LIMITS, cleanText, formContentSchema, responseLimitSchema } from '@afb/shared';

// ── Auth ───────────────────────────────────────────────
const email = z.string().trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email address.' }));

export const registerBody = z.object({
  name: cleanText(1, 100, 'Name'),
  email,
  password: z
    .string()
    .min(8, { error: 'Password must be at least 8 characters.' })
    .max(72, { error: 'Password must be at most 72 characters.' }),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1, { error: 'Password is required.' }).max(72),
});

export const refreshBody = z.object({
  refresh_token: z.string().min(1, { error: 'refresh_token is required.' }).max(2000),
});

// ── Forms ──────────────────────────────────────────────
export const idParams = z.object({ id: z.uuid({ error: 'Invalid form id.' }) });

export const responseParams = idParams.extend({
  responseId: z.uuid({ error: 'Invalid response id.' }),
});

export const createFormBody = formContentSchema.extend({
  response_limit: responseLimitSchema.optional().default(null),
});

export const updateFormBody = z
  .object({
    title: cleanText(1, LIMITS.TITLE_MAX, 'Title').optional(),
    description: cleanText(0, LIMITS.FORM_DESCRIPTION_MAX, 'Description').optional(),
    type: z.enum(FORM_TYPES).optional(),
    fields: formContentSchema.shape.fields.optional(),
    response_limit: responseLimitSchema.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), { error: 'Nothing to update.' });

// ── Responses ──────────────────────────────────────────
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Dates must be YYYY-MM-DD.' });

export const listResponsesQuery = z.object({
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  from: isoDate.optional(),
  to: isoDate.optional(),
  field: z.string().max(LIMITS.KEY_MAX).optional(),
  value: z.string().max(200).optional(),
});

// ── Public ─────────────────────────────────────────────
export const slugParams = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, { error: 'Invalid form link.' }),
});

export const submitResponseBody = z.object({
  answers: z.record(z.string(), z.unknown()),
  /** question key → verification token from POST …/verify-email */
  verifications: z.record(z.string(), z.string().max(1000)).optional(),
  submission_id: z.uuid().optional(),
});

export const verifyEmailBody = z.object({
  field: z.string().min(1).max(LIMITS.KEY_MAX),
  credential: z.string().min(20).max(4000),
});

export const uploadQuery = z.object({
  field: z.string().min(1).max(LIMITS.KEY_MAX),
  filename: z.string().min(1, { error: 'Missing file name.' }).max(255),
});

export const downloadQuery = z.object({
  path: z.string().min(1).max(200),
  name: z.string().max(255).optional(),
});

// ── AI ─────────────────────────────────────────────────
export const generateFormBody = z.object({
  prompt: z
    .string()
    .trim()
    .min(LIMITS.PROMPT_MIN, { error: `Describe your form in at least ${LIMITS.PROMPT_MIN} characters.` })
    .max(LIMITS.PROMPT_MAX, { error: `Keep your description under ${LIMITS.PROMPT_MAX} characters.` }),
});

export const analyzeResponsesBody = z.object({
  formId: z.uuid({ error: 'Invalid form id.' }),
});
