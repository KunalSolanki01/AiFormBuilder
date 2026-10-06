import { describe, expect, it } from 'vitest';
import { buildTimeline, computeAnalytics } from '../src/services/analyticsService.js';
import { queryResponses } from '../src/services/responseService.js';
import { buildAnalysisPayload, isSensitiveField, redactText } from '../src/utils/sanitize.js';

const f = (key, type, extra = {}) => ({ id: crypto.randomUUID(), key, type, label: extra.label ?? key, position: 0, ...extra });

const form = {
  title: 'Event Feedback',
  type: 'feedback',
  response_limit: 10,
  response_count: 3,
  fields: [
    f('full_name', 'text', { label: 'Full Name' }),
    f('email', 'email'),
    f('track', 'radio', { options: ['AI', 'Web'] }),
    f('langs', 'checkbox', { options: ['JS', 'Py'] }),
    f('rating', 'rating', { scale: 5 }),
    f('team_size', 'number'),
    f('veg', 'boolean'),
    f('comments', 'textarea', { label: 'Comments' }),
  ],
};

const responses = [
  { id: '3', submitted_at: '2026-10-03T10:00:00Z', answers: { full_name: 'Priya', email: 'p@x.io', track: 'AI', langs: ['JS', 'Py'], rating: 5, team_size: 4, veg: true, comments: 'Great! Mail me at priya@x.io' } },
  { id: '2', submitted_at: '2026-10-01T12:00:00Z', answers: { full_name: 'Amit', track: 'Web', langs: ['JS'], rating: 3, team_size: 2, veg: false } },
  { id: '1', submitted_at: '2026-10-01T09:00:00Z', answers: { full_name: 'Rahul', track: 'AI', rating: 4 } },
];

describe('computeAnalytics', () => {
  const a = computeAnalytics(form, responses);
  const byKey = Object.fromEntries(a.fields.map((s) => [s.key, s]));

  it('computes totals and remaining limit', () => {
    expect(a.total).toBe(3);
    expect(a.remaining).toBe(7);
    expect(a.last_submission_at).toBe('2026-10-03T10:00:00Z');
  });

  it('computes option distributions', () => {
    expect(byKey.track.counts).toEqual([
      { label: 'AI', count: 2, percent: 66.7 },
      { label: 'Web', count: 1, percent: 33.3 },
    ]);
    expect(byKey.langs.counts.find((c) => c.label === 'JS').count).toBe(2);
    expect(byKey.veg.counts).toEqual([
      { label: 'Yes', count: 1, percent: 50 },
      { label: 'No', count: 1, percent: 50 },
    ]);
  });

  it('computes rating and numeric averages', () => {
    expect(byKey.rating.average).toBe(4);
    expect(byKey.rating.counts.map((c) => c.count)).toEqual([0, 0, 1, 1, 1]);
    expect(byKey.team_size).toMatchObject({ average: 3, min: 2, max: 4, answered: 2 });
  });

  it('computes completion rate', () => {
    // answered cells: 8 + 6 + 3 = 17 of 24
    expect(a.completion_rate).toBe(70.8);
  });
});

describe('buildTimeline', () => {
  it('fills gaps between days', () => {
    expect(buildTimeline(responses)).toEqual([
      { date: '2026-10-01', count: 2 },
      { date: '2026-10-02', count: 0 },
      { date: '2026-10-03', count: 1 },
    ]);
    expect(buildTimeline([])).toEqual([]);
  });
});

describe('queryResponses', () => {
  const base = { sort: 'newest', page: 1, pageSize: 25 };
  it('searches across answers', () => {
    expect(queryResponses(responses, { ...base, search: 'amit' }).items.map((r) => r.id)).toEqual(['2']);
  });
  it('filters by field value, including arrays and booleans', () => {
    expect(queryResponses(responses, { ...base, field: 'track', value: 'AI' }).total).toBe(2);
    expect(queryResponses(responses, { ...base, field: 'langs', value: 'Py' }).total).toBe(1);
    expect(queryResponses(responses, { ...base, field: 'veg', value: 'no' }).items[0].id).toBe('2');
  });
  it('filters by date and sorts/paginates', () => {
    const r = queryResponses(responses, { ...base, sort: 'oldest', from: '2026-10-01', to: '2026-10-01', pageSize: 1 });
    expect(r.total).toBe(2);
    expect(r.totalPages).toBe(2);
    expect(r.items[0].id).toBe('1');
  });
});

describe('sanitize', () => {
  it('flags personal fields', () => {
    expect(isSensitiveField(form.fields[0])).toBe(true); // full_name
    expect(isSensitiveField(form.fields[1])).toBe(true); // email type
    expect(isSensitiveField(form.fields[2])).toBe(false);
    expect(isSensitiveField(f('first_hackathon', 'boolean', { label: 'Is this your first hackathon?' }))).toBe(false);
  });

  it('redacts PII in free text', () => {
    expect(redactText('Call +91 98765-43210 or mail a@b.co, see https://x.y/z')).toBe(
      'Call [phone] or mail [email], see [link]',
    );
    expect(redactText('Team of 4 in 2026')).toBe('Team of 4 in 2026');
  });

  it('builds a payload without personal data', () => {
    const payload = buildAnalysisPayload(form, responses, computeAnalytics(form, responses));
    const json = JSON.stringify(payload);
    expect(json).not.toContain('Priya');
    expect(json).not.toContain('p@x.io');
    expect(json).not.toContain('priya@x.io');
    expect(payload.excluded_personal_fields).toBe(2);
    expect(payload.total_responses).toBe(3);
    expect(payload.responses[0].Comments).toBe('Great! Mail me at [email]');
  });
});
