import { describe, expect, it, vi } from 'vitest';
import { createGroqService, normalizeSentiment } from '../src/services/groqService.js';

const reply = (content) => ({ choices: [{ message: { content } }] });

function fakeClient(...outputs) {
  const create = vi.fn();
  for (const out of outputs) {
    if (out instanceof Error) create.mockRejectedValueOnce(out);
    else create.mockResolvedValueOnce(reply(typeof out === 'string' ? out : JSON.stringify(out)));
  }
  return { client: { chat: { completions: { create } } }, create };
}

const validForm = {
  title: 'Customer Feedback',
  description: 'Share your experience with us.',
  type: 'feedback',
  fields: [
    { key: 'name', type: 'text', label: 'Name', required: true },
    { key: 'rating', type: 'rating', label: 'Overall rating', scale: 5, required: true },
    { key: 'comments', type: 'textarea', label: 'Comments' },
  ],
};

describe('groqService.generateForm', () => {
  it('requests JSON mode and returns a validated form', async () => {
    const { client, create } = fakeClient(validForm);
    const svc = createGroqService(client, 'test-model');
    const { form, warnings } = await svc.generateForm('A customer feedback form with rating and comments');

    expect(form.title).toBe('Customer Feedback');
    expect(form.fields).toHaveLength(3);
    expect(form.fields.every((f) => typeof f.id === 'string')).toBe(true);
    expect(warnings).toEqual([]);

    const args = create.mock.calls[0][0];
    expect(args.model).toBe('test-model');
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages[1].content).toContain('customer feedback form');
  });

  it('retries once after malformed output', async () => {
    const { client, create } = fakeClient('not json {', validForm);
    const { form } = await createGroqService(client, 'm').generateForm('feedback form please');
    expect(create).toHaveBeenCalledTimes(2);
    expect(form.fields).toHaveLength(3);
  });

  it('fails safely when output stays invalid', async () => {
    const { client } = fakeClient({ nope: true }, { fields: [{ type: 'signature', label: 'Sign' }] });
    await expect(createGroqService(client, 'm').generateForm('signature form')).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_AI_SCHEMA',
      message: "We couldn't generate your form right now. Please try again.",
    });
  });

  it('maps Groq rate limits and does not retry API errors', async () => {
    const { client, create } = fakeClient(Object.assign(new Error('rate limited'), { status: 429 }));
    await expect(createGroqService(client, 'm').generateForm('anything at all')).rejects.toMatchObject({
      status: 503,
      code: 'AI_RATE_LIMITED',
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('never echoes provider error details to the client', async () => {
    const { client } = fakeClient(Object.assign(new Error('Invalid API Key gsk_secret'), { status: 401 }));
    const err = await createGroqService(client, 'm').generateForm('anything at all').catch((e) => e);
    expect(err.message).not.toContain('gsk_secret');
  });
});

describe('groqService.analyzeResponses', () => {
  it('validates output and normalizes sentiment', async () => {
    const { client } = fakeClient({
      summary: 'Mostly positive.',
      key_insights: ['People liked the food.'],
      sentiment: { positive: 7, neutral: 2, negative: 1 },
      recommendations: ['Keep the caterer.'],
    });
    const result = await createGroqService(client, 'm').analyzeResponses({ responses: [] });
    expect(result.sentiment).toEqual({ positive: 70, neutral: 20, negative: 10 });
    expect(result.key_insights).toEqual(['People liked the food.']);
  });

  it('rejects output without a summary', async () => {
    const { client } = fakeClient({ key_insights: [] }, { summary: '' });
    await expect(createGroqService(client, 'm').analyzeResponses({})).rejects.toMatchObject({
      code: 'INVALID_AI_SCHEMA',
    });
  });
});

describe('normalizeSentiment', () => {
  it('always sums to 100', () => {
    for (const s of [
      { positive: 1, neutral: 1, negative: 1 },
      { positive: 68, neutral: 22, negative: 10 },
      { positive: 0, neutral: 0, negative: 0 },
      { positive: 33.3, neutral: 33.3, negative: 33.4 },
    ]) {
      const n = normalizeSentiment(s);
      expect(n.positive + n.neutral + n.negative).toBe(100);
    }
  });
});
