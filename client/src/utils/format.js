export const formatDate = (iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString(undefined, opts) : '—';

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAnswer(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object' && !Array.isArray(value)) return value.name ?? '—'; // uploaded file
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export const publicUrl = (slug) => `${window.location.origin}/forms/${slug}`;

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const EXAMPLE_PROMPTS = [
  'Event registration form for a college hackathon. Ask for name, email, phone number, college, team size, and preferred track.',
  'Customer feedback form with name, email, an overall satisfaction rating, what they liked, and comments.',
  'Job application form with name, email, phone, years of experience, preferred role, and a short cover note.',
  'Workshop signup limited to 50 people: name, email, experience level, and dietary preference.',
];
