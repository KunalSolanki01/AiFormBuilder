import { LIMITS, isEmptyAnswer } from '@afb/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { conflict, databaseError } from '../utils/AppError.js';
import { buildAnalysisPayload } from '../utils/sanitize.js';
import { getOwnedFormRow, toFormDto } from './formService.js';
import { fetchAllResponses } from './responseService.js';

const TIMELINE_MAX_DAYS = 90;
const DAY_MS = 86_400_000;

const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const dayKey = (iso) => iso.slice(0, 10);

/** Daily submission counts with gaps filled, ending on the latest response day. */
export function buildTimeline(responses) {
  if (!responses.length) return [];
  const counts = new Map();
  for (const r of responses) counts.set(dayKey(r.submitted_at), (counts.get(dayKey(r.submitted_at)) ?? 0) + 1);

  const days = [...counts.keys()].sort();
  const last = new Date(`${days.at(-1)}T00:00:00Z`).getTime();
  const first = Math.max(new Date(`${days[0]}T00:00:00Z`).getTime(), last - (TIMELINE_MAX_DAYS - 1) * DAY_MS);

  const timeline = [];
  for (let t = first; t <= last; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    timeline.push({ date, count: counts.get(date) ?? 0 });
  }
  return timeline;
}

function fieldStats(field, responses) {
  const values = responses.map((r) => r.answers[field.key]).filter((v) => !isEmptyAnswer(v));
  const base = {
    key: field.key,
    label: field.label,
    type: field.type,
    answered: values.length,
    response_rate: responses.length ? round((values.length / responses.length) * 100, 1) : 0,
  };

  switch (field.type) {
    case 'select':
    case 'radio':
    case 'checkbox': {
      const tally = new Map((field.options ?? []).map((o) => [o, 0]));
      for (const v of values) {
        for (const option of Array.isArray(v) ? v : [v]) tally.set(option, (tally.get(option) ?? 0) + 1);
      }
      return {
        ...base,
        kind: 'distribution',
        multi: field.type === 'checkbox',
        counts: [...tally].map(([label, count]) => ({
          label,
          count,
          percent: values.length ? round((count / values.length) * 100, 1) : 0,
        })),
      };
    }
    case 'boolean': {
      const yes = values.filter((v) => v === true).length;
      const no = values.length - yes;
      const pct = (n) => (values.length ? round((n / values.length) * 100, 1) : 0);
      return {
        ...base,
        kind: 'distribution',
        counts: [
          { label: 'Yes', count: yes, percent: pct(yes) },
          { label: 'No', count: no, percent: pct(no) },
        ],
      };
    }
    case 'rating': {
      const scale = field.scale ?? LIMITS.RATING_DEFAULT_SCALE;
      const nums = values.map(Number).filter(Number.isFinite);
      const counts = Array.from({ length: scale }, (_, i) => ({
        label: String(i + 1),
        count: nums.filter((n) => n === i + 1).length,
      }));
      return {
        ...base,
        kind: 'rating',
        scale,
        average: nums.length ? round(nums.reduce((a, b) => a + b, 0) / nums.length) : null,
        counts,
      };
    }
    case 'number': {
      const nums = values.map(Number).filter(Number.isFinite);
      return {
        ...base,
        kind: 'numeric',
        average: nums.length ? round(nums.reduce((a, b) => a + b, 0) / nums.length) : null,
        min: nums.length ? Math.min(...nums) : null,
        max: nums.length ? Math.max(...nums) : null,
        sum: round(nums.reduce((a, b) => a + b, 0)),
      };
    }
    case 'text':
    case 'textarea':
      return { ...base, kind: 'text', samples: values.slice(0, 5).map(String) };
    default:
      return { ...base, kind: 'count' };
  }
}

/** Pure aggregation over all responses (newest first). */
export function computeAnalytics(form, responses) {
  const fields = form.fields ?? [];
  const total = responses.length;

  let completion = 0;
  if (total && fields.length) {
    const answeredCells = responses.reduce(
      (sum, r) => sum + fields.filter((f) => !isEmptyAnswer(r.answers[f.key])).length,
      0,
    );
    completion = round((answeredCells / (total * fields.length)) * 100, 1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * DAY_MS).toISOString().slice(0, 10);

  return {
    total,
    submissions_today: responses.filter((r) => dayKey(r.submitted_at) === today).length,
    submissions_last_7_days: responses.filter((r) => dayKey(r.submitted_at) >= weekAgo).length,
    completion_rate: completion,
    last_submission_at: responses[0]?.submitted_at ?? null,
    response_limit: form.response_limit ?? null,
    remaining: form.response_limit != null ? Math.max(0, form.response_limit - (form.response_count ?? total)) : null,
    timeline: buildTimeline(responses),
    fields: fields.map((f) => fieldStats(f, responses)),
  };
}

export async function getLatestAnalysis(formId) {
  const { data, error } = await supabaseAdmin
    .from('ai_analyses')
    .select('id, analysis_type, summary, insights, sentiment, recommendations, response_count, generated_at')
    .eq('form_id', formId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw databaseError(error, 'getLatestAnalysis');
  return data;
}

export async function getAnalytics(userId, formId) {
  const form = toFormDto(await getOwnedFormRow(userId, formId));
  const [responses, latestAnalysis] = await Promise.all([
    fetchAllResponses(formId, form.fields),
    getLatestAnalysis(formId),
  ]);
  return {
    form: { id: form.id, title: form.title, status: form.status, slug: form.slug },
    ...computeAnalytics(form, responses),
    latest_analysis: latestAnalysis,
  };
}

/** Sanitise → Groq → store (PRD §4.3). */
export async function analyzeFormResponses(userId, formId, groqService) {
  const form = toFormDto(await getOwnedFormRow(userId, formId));
  const responses = await fetchAllResponses(formId, form.fields);
  if (!responses.length) {
    throw conflict('NO_RESPONSES', 'Collect at least one response before generating an AI summary.');
  }

  const payload = buildAnalysisPayload(form, responses, computeAnalytics(form, responses));
  if (!payload.questions.length) {
    throw conflict('NO_ANALYZABLE_FIELDS', 'This form only contains personal details, so there is nothing to analyze.');
  }

  const result = await groqService.analyzeResponses(payload);

  const { data, error } = await supabaseAdmin
    .from('ai_analyses')
    .insert({
      form_id: formId,
      analysis_type: 'summary',
      summary: result.summary,
      insights: result.key_insights,
      sentiment: result.sentiment,
      recommendations: result.recommendations,
      response_count: responses.length,
      model: groqService.model,
    })
    .select('id, analysis_type, summary, insights, sentiment, recommendations, response_count, generated_at')
    .single();
  if (error) throw databaseError(error, 'store ai_analysis');
  return data;
}
