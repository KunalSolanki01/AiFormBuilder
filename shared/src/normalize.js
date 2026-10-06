import { FIELD_TYPES, FIELD_TYPE_META, FILE_UPLOAD, FORM_TYPES, LIMITS, fileExtension, isOptionType } from './fieldTypes.js';
import { formContentSchema, formatZodError, stripTags } from './formSchema.js';

/** Maps common synonyms (often produced by LLMs) onto V1 field types. */
const TYPE_ALIASES = {
  string: 'text',
  short_text: 'text',
  shorttext: 'text',
  input: 'text',
  name: 'text',
  url: 'text',
  long_text: 'textarea',
  longtext: 'textarea',
  paragraph: 'textarea',
  multiline: 'textarea',
  address: 'textarea',
  mail: 'email',
  tel: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  phone_number: 'phone',
  integer: 'number',
  int: 'number',
  float: 'number',
  numeric: 'number',
  dropdown: 'select',
  single_select: 'select',
  choice: 'radio',
  single_choice: 'radio',
  multiple_choice: 'radio',
  radio_group: 'radio',
  checkboxes: 'checkbox',
  multi_select: 'checkbox',
  multiselect: 'checkbox',
  multiple_select: 'checkbox',
  stars: 'rating',
  star_rating: 'rating',
  scale: 'rating',
  datetime: 'date',
  date_picker: 'date',
  bool: 'boolean',
  yes_no: 'boolean',
  yesno: 'boolean',
  toggle: 'boolean',
  switch: 'boolean',
  file_upload: 'file',
  fileupload: 'file',
  upload: 'file',
  attachment: 'file',
  document: 'file',
  resume: 'file',
  cv: 'file',
  image: 'file',
  photo: 'file',
};

export class SchemaNormalizationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'SchemaNormalizationError';
    this.details = details;
  }
}

const newId = () => globalThis.crypto.randomUUID();

export function toFieldKey(label) {
  let key = String(label ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.KEY_MAX);
  if (!key) key = 'field';
  if (!/^[a-z]/.test(key)) key = `f_${key}`.slice(0, LIMITS.KEY_MAX);
  return key;
}

export function uniqueKey(base, taken) {
  let key = base;
  let n = 2;
  while (taken.has(key)) {
    const suffix = `_${n++}`;
    key = `${base.slice(0, LIMITS.KEY_MAX - suffix.length)}${suffix}`;
  }
  taken.add(key);
  return key;
}

export function resolveFieldType(rawType) {
  const t = String(rawType ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (FIELD_TYPES.includes(t)) return t;
  return TYPE_ALIASES[t] ?? null;
}

const str = (v) => (typeof v === 'string' ? stripTags(v).trim() : typeof v === 'number' ? String(v) : '');
const num = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function normalizeOptions(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const o of raw) {
    const text = str(typeof o === 'object' && o !== null ? (o.label ?? o.value ?? o.text) : o).slice(0, LIMITS.OPTION_MAX);
    const k = text.toLowerCase();
    if (text && !seen.has(k)) {
      seen.add(k);
      out.push(text);
    }
    if (out.length >= LIMITS.MAX_OPTIONS) break;
  }
  return out;
}

/** Default config for a brand-new field of the given type (used by the builder). */
export function createField(type, takenKeys = new Set(), overrides = {}) {
  const label = overrides.label ?? `Untitled ${FIELD_TYPE_META[type]?.label ?? 'Question'}`;
  const field = {
    id: newId(),
    key: uniqueKey(toFieldKey(overrides.key ?? label), new Set(takenKeys)),
    type,
    label,
    description: '',
    placeholder: '',
    required: false,
    position: 0,
  };
  if (isOptionType(type)) field.options = ['Option 1', 'Option 2', 'Option 3'];
  if (type === 'rating') field.scale = LIMITS.RATING_DEFAULT_SCALE;
  return { ...field, ...overrides, key: field.key, id: field.id };
}

/**
 * Converts untrusted AI output into a validated form definition.
 * Unsupported fields are dropped with a warning; structurally broken output throws.
 * @returns {{ form: object, warnings: string[] }}
 */
export function normalizeAiForm(raw) {
  const root = raw && typeof raw === 'object' ? (raw.form && typeof raw.form === 'object' ? raw.form : raw) : null;
  if (!root || !Array.isArray(root.fields)) {
    throw new SchemaNormalizationError('AI response did not contain a fields array.');
  }

  const warnings = [];
  const taken = new Set();
  const fields = [];

  for (const rawField of root.fields) {
    if (fields.length >= LIMITS.MAX_FIELDS) {
      warnings.push(`Only the first ${LIMITS.MAX_FIELDS} fields were kept.`);
      break;
    }
    if (!rawField || typeof rawField !== 'object') continue;

    const label = str(rawField.label ?? rawField.question ?? rawField.title ?? rawField.name).slice(0, LIMITS.LABEL_MAX);
    if (!label) {
      warnings.push('Skipped a field without a label.');
      continue;
    }

    let type = resolveFieldType(rawField.type);
    if (!type) {
      warnings.push(`Skipped "${label}" — field type "${str(rawField.type) || 'unknown'}" is not supported yet.`);
      continue;
    }

    const field = {
      id: newId(),
      key: uniqueKey(toFieldKey(rawField.key || rawField.name || label), taken),
      type,
      label,
      required: rawField.required === true || rawField.required === 'true',
      position: fields.length,
    };

    const description = str(rawField.description ?? rawField.helpText).slice(0, LIMITS.FIELD_DESCRIPTION_MAX);
    if (description) field.description = description;
    const placeholder = str(rawField.placeholder).slice(0, LIMITS.PLACEHOLDER_MAX);
    if (placeholder) field.placeholder = placeholder;

    if (isOptionType(type)) {
      const options = normalizeOptions(rawField.options ?? rawField.choices);
      if (options.length < 2) {
        warnings.push(`"${label}" had no usable options and was converted to short text.`);
        field.type = type = 'text';
      } else {
        field.options = options;
      }
    }

    if (type === 'rating') {
      const scale = num(rawField.scale) ?? num(rawField.max) ?? LIMITS.RATING_DEFAULT_SCALE;
      field.scale = clamp(Math.round(scale), LIMITS.RATING_MIN_SCALE, LIMITS.RATING_MAX_SCALE);
    }

    if (type === 'file') {
      const wanted = (Array.isArray(rawField.fileTypes) ? rawField.fileTypes : Array.isArray(rawField.accept) ? rawField.accept : [])
        .map((e) => fileExtension(`x.${String(e).replace(/^\./, '')}`))
        .filter((e) => FILE_UPLOAD.EXTENSIONS.includes(e));
      const unique = [...new Set(wanted)];
      if (unique.length) field.fileTypes = unique;
    }

    if (type === 'number') {
      const min = num(rawField.min ?? rawField.validation?.min);
      const max = num(rawField.max ?? rawField.validation?.max);
      if (min !== undefined) field.min = min;
      if (max !== undefined && (min === undefined || max >= min)) field.max = max;
    }

    fields.push(field);
  }

  if (fields.length === 0) {
    throw new SchemaNormalizationError('AI response did not contain any supported fields.');
  }

  const rawType = str(root.type).toLowerCase();
  const candidate = {
    title: str(root.title).slice(0, LIMITS.TITLE_MAX) || 'Untitled Form',
    description: str(root.description).slice(0, LIMITS.FORM_DESCRIPTION_MAX),
    type: FORM_TYPES.includes(rawType) ? rawType : 'survey',
    fields,
  };

  const parsed = formContentSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new SchemaNormalizationError('AI response failed schema validation.', formatZodError(parsed.error));
  }
  return { form: parsed.data, warnings: [...new Set(warnings)] };
}
