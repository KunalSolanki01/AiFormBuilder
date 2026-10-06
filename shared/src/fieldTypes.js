/**
 * V1 field system. Intentionally small — see PRD §6.
 * Adding a type: add it here, in answers.js (valueSchema) and in the client FieldRenderer.
 */
export const FIELD_TYPES = Object.freeze([
  'text',
  'textarea',
  'email',
  'number',
  'phone',
  'select',
  'radio',
  'checkbox',
  'rating',
  'date',
  'boolean',
  'file',
]);

export const OPTION_FIELD_TYPES = Object.freeze(['select', 'radio', 'checkbox']);
export const TEXT_FIELD_TYPES = Object.freeze(['text', 'textarea']);

export const FIELD_TYPE_META = Object.freeze({
  text: { label: 'Short Text', description: 'Single line answer' },
  textarea: { label: 'Long Text', description: 'Paragraph answer' },
  email: { label: 'Email', description: 'Validated email address' },
  number: { label: 'Number', description: 'Numeric answer' },
  phone: { label: 'Phone', description: 'Phone number' },
  select: { label: 'Dropdown', description: 'Pick one from a list' },
  radio: { label: 'Multiple Choice', description: 'Pick one option' },
  checkbox: { label: 'Checkboxes', description: 'Pick one or more' },
  rating: { label: 'Rating', description: 'Star rating scale' },
  date: { label: 'Date', description: 'Calendar date' },
  boolean: { label: 'Yes / No', description: 'Yes or no answer' },
  file: { label: 'File upload', description: 'PDF, Word or image, up to 1 MB' },
});

/** File uploads: the only formats respondents may send, and the size cap. */
export const FILE_UPLOAD = Object.freeze({
  MAX_BYTES: 1024 * 1024, // 1 MB
  MAX_LABEL: '1 MB',
  EXTENSIONS: Object.freeze(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']),
  /** Content types used when storing and serving files (never taken from the client). */
  MIME: Object.freeze({
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  }),
});

export const fileExtension = (name) => {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name ?? ''));
  return m ? m[1].toLowerCase() : '';
};

/** Extensions this field accepts (the owner can narrow the default list). */
export const allowedExtensions = (field) => {
  const picked = (field?.fileTypes ?? []).filter((e) => FILE_UPLOAD.EXTENSIONS.includes(e));
  return picked.length ? picked : [...FILE_UPLOAD.EXTENSIONS];
};

export const FORM_TYPES = Object.freeze([
  'survey',
  'feedback',
  'event',
  'registration',
  'application',
  'contact',
  'quiz',
  'order',
  'other',
]);

export const FORM_STATUSES = Object.freeze(['draft', 'published', 'closed']);

export const LIMITS = Object.freeze({
  MAX_FIELDS: 50,
  MAX_OPTIONS: 25,
  TITLE_MAX: 150,
  FORM_DESCRIPTION_MAX: 1000,
  LABEL_MAX: 200,
  FIELD_DESCRIPTION_MAX: 500,
  PLACEHOLDER_MAX: 150,
  OPTION_MAX: 100,
  KEY_MAX: 50,
  TEXT_ANSWER_MAX: 500,
  TEXTAREA_ANSWER_MAX: 5000,
  RATING_MIN_SCALE: 3,
  RATING_MAX_SCALE: 10,
  RATING_DEFAULT_SCALE: 5,
  PROMPT_MIN: 10,
  PROMPT_MAX: 2000,
  RESPONSE_LIMIT_MAX: 1_000_000,
});

export const isOptionType = (type) => OPTION_FIELD_TYPES.includes(type);
