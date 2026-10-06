import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomSuffix(length = 6) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function slugify(text, maxLength = 60) {
  const base = String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return base || 'form';
}

/** e.g. "College Hackathon Registration" → "college-hackathon-registration-k3x9qa" */
export const generateFormSlug = (title) => `${slugify(title)}-${randomSuffix()}`;
