import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
/** What the dev proxy / a gateway returns when the connection to the API drops: a bare 500, no JSON. */
const gatewayError = () => new Response('', { status: 500 });
const generated = { success: true, data: { title: 'T', fields: [] }, warnings: [] };

let fetchMock;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Runs a call while advancing the retry timers, and returns its settled result. */
async function settle(promise) {
  const outcome = promise.then((value) => ({ value }), (error) => ({ error }));
  await vi.advanceTimersByTimeAsync(5000);
  return outcome;
}

describe('API client resilience', () => {
  it('quietly retries a safe request once when the connection drops (the "Create form" bug)', async () => {
    fetchMock.mockResolvedValueOnce(gatewayError()).mockResolvedValueOnce(json(generated));
    const { value, error } = await settle(api.ai.generateForm('A feedback form please'));
    expect(error).toBeUndefined();
    expect(value.form.title).toBe('T');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('also retries when fetch itself fails (server restarting), up to two retries', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json(generated));
    const { value } = await settle(api.ai.generateForm('A feedback form please'));
    expect(value.form.title).toBe('T');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives a clear message, not "Something went wrong", when the server stays unreachable', async () => {
    fetchMock.mockImplementation(async () => gatewayError());
    const { error } = await settle(api.ai.generateForm('A feedback form please'));
    expect(error).toMatchObject({ code: 'GATEWAY', status: 500 });
    expect(error.message).toBe("The server didn't respond just now. Please try again in a moment.");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const net = await settle(api.forms.list());
    expect(net.error).toMatchObject({ code: 'NETWORK' });
  });

  it('never repeats a request that is not safe to repeat (creating a form)', async () => {
    fetchMock.mockResolvedValue(gatewayError());
    const { error } = await settle(api.forms.create({ title: 'T', fields: [] }));
    expect(error.code).toBe('GATEWAY');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry real API errors, and keeps their message', async () => {
    fetchMock.mockResolvedValue(
      json({ success: false, error: { code: 'AI_GENERATION_FAILED', message: "We couldn't generate your form right now. Please try again." } }, 502),
    );
    const { error } = await settle(api.ai.generateForm('A feedback form please'));
    expect(error).toMatchObject({ code: 'AI_GENERATION_FAILED', status: 502 });
    expect(error.message).toMatch(/couldn't generate your form/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('makes repeated public submissions harmless by sending the same submission id', async () => {
    fetchMock.mockResolvedValueOnce(gatewayError()).mockResolvedValueOnce(json({ success: true, data: { response_id: 'r1' } }, 201));
    const { value } = await settle(api.public.submit('my-form', { name: 'A' }, 'sub-123'));
    expect(value.response_id).toBe('r1');
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).submission_id);
    expect(bodies).toEqual(['sub-123', 'sub-123']);
  });
});
