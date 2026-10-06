/**
 * Prepares response data before it is sent to Groq (PRD §4.3):
 * normalize → drop personally identifying fields → redact PII inside free text → cap size.
 */

const SENSITIVE_TYPES = new Set(['email', 'phone', 'file']);

const SENSITIVE_WORDS = [
  'name', 'surname', 'email', 'mail', 'phone', 'mobile', 'contact', 'whatsapp',
  'address', 'street', 'zip', 'postal', 'pincode', 'aadhaar', 'aadhar', 'ssn',
  'passport', 'dob', 'birth', 'birthday', 'password', 'iban', 'enrollment',
  'linkedin', 'github', 'instagram', 'twitter', 'username',
];
const SENSITIVE_RE = new RegExp(`(^|[^a-z])(${SENSITIVE_WORDS.join('|')})([^a-z]|$)`, 'i');

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g;

export const MAX_TEXT_LENGTH = 400;
export const MAX_SAMPLE_RESPONSES = 150;
export const MAX_PAYLOAD_CHARS = 28_000;

export function isSensitiveField(field) {
  if (SENSITIVE_TYPES.has(field.type)) return true;
  return SENSITIVE_RE.test(field.key.replace(/_/g, ' ')) || SENSITIVE_RE.test(field.label);
}

export function redactText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value)
    .replace(EMAIL_RE, '[email]')
    .replace(URL_RE, '[link]')
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[phone]' : m))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function sanitizeValue(field, value) {
  if (value === null || value === undefined) return undefined;
  switch (field.type) {
    case 'text':
    case 'textarea':
      return redactText(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'checkbox':
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return value;
  }
}

/**
 * @param {object} form       Form DTO ({ title, description, type, fields })
 * @param {Array}  responses  [{ submitted_at, answers: { [key]: value } }] newest first
 * @param {object} analytics  Output of computeAnalytics (aggregates over ALL responses)
 */
export function buildAnalysisPayload(form, responses, analytics) {
  const included = form.fields.filter((f) => !isSensitiveField(f));
  const excludedCount = form.fields.length - included.length;

  const statistics = analytics.fields
    .filter((s) => included.some((f) => f.key === s.key) && s.kind !== 'text' && s.kind !== 'count')
    .map(({ label, kind, answered, average, scale, counts, min, max }) => ({
      question: label,
      kind,
      answered,
      ...(average !== undefined && { average }),
      ...(scale !== undefined && { scale }),
      ...(min !== undefined && { min, max }),
      ...(counts && { counts: counts.map((c) => ({ [c.label]: c.count })) }),
    }));

  const rows = responses.slice(0, MAX_SAMPLE_RESPONSES).map((r) => {
    const row = {};
    for (const f of included) {
      const v = sanitizeValue(f, r.answers[f.key]);
      if (v !== undefined && v !== '') row[f.label] = v;
    }
    return row;
  }).filter((row) => Object.keys(row).length > 0);

  const payload = {
    form: { title: form.title, description: form.description || undefined, type: form.type },
    total_responses: analytics.total,
    questions: included.map((f) => ({ question: f.label, type: f.type })),
    excluded_personal_fields: excludedCount,
    statistics,
    sample_size: rows.length,
    responses: rows,
  };

  // Shrink the sample until the payload fits the prompt budget.
  while (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS && payload.responses.length > 10) {
    payload.responses = payload.responses.slice(0, Math.floor(payload.responses.length * 0.75));
    payload.sample_size = payload.responses.length;
  }
  return payload;
}
