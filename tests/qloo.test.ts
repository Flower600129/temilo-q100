import { afterEach, describe, expect, it, vi } from 'vitest';
import { QlooAdapter } from '@/qloo/client';
import { qlooRoute } from '@/qloo/http';
import { qlooConfigStatus } from '@/qloo/config.server';

// Synthetic HTTP fixtures test parsing/error paths only. They are never live evidence.
const fixtureId = '00000000-0000-4000-8000-000000000001';
const fixture = { success: true, results: [{ entity_id: fixtureId, name: 'UNIT TEST ONLY', types: ['urn:entity:artist'] }] };
const options = { apiKey: 'test-only-not-a-real-key', baseUrl: 'https://api.qloo.com' };
afterEach(() => vi.unstubAllEnvs());

describe('server Qloo adapter', () => {
  it('allows the officially documented event host and keeps credentials in request headers', async () => {
    vi.stubEnv('QLOO_API_KEY', options.apiKey);
    vi.stubEnv('QLOO_BASE_URL', 'https://hackathon.api.qloo.com');
    expect(qlooConfigStatus()).toEqual({ status: 'configured_unverified', reason: null });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(fixture));
    const result = await new QlooAdapter({ fetcher }).resolve({ interests: ['Public artist'] });
    const [url, config] = fetcher.mock.calls[0];
    expect(new URL(String(url)).origin).toBe('https://hackathon.api.qloo.com');
    expect(new URL(String(url)).searchParams.has('api_key')).toBe(false);
    expect(config?.headers).toEqual({ 'X-Api-Key': options.apiKey, Accept: 'application/json' });
    expect(JSON.stringify(result)).not.toContain(options.apiKey);
  });
  it('blocks before any network call when the key or host is missing', async () => {
    const fetcher = vi.fn();
    await expect(new QlooAdapter({ ...options, apiKey: '', fetcher }).resolve({ interests: ['Public artist'] })).rejects.toMatchObject({ reason: 'missing_key' });
    await expect(new QlooAdapter({ ...options, baseUrl: '', fetcher }).resolve({ interests: ['Public artist'] })).rejects.toMatchObject({ reason: 'missing_base_url' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('restricts upstream hosts and refuses private fields', async () => {
    const fetcher = vi.fn();
    await expect(new QlooAdapter({ ...options, baseUrl: 'https://attacker.invalid', fetcher }).resolve({ interests: ['Public artist'] })).rejects.toMatchObject({ reason: 'invalid_configuration' });
    const adapter = new QlooAdapter({ ...options, fetcher });
    await expect(adapter.resolve({ interests: ['Public artist'], displayName: 'Private name', birthday: '11-08' })).rejects.toThrow();
    await expect(adapter.explore({ entityIds: [fixtureId], targetCategory: 'urn:entity:book', notes: 'Private note' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses the documented search method and only sends explicit cultural input', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(fixture));
    const result = await new QlooAdapter({ ...options, fetcher }).resolve({ interests: ['Public artist'] });
    const [url, config] = fetcher.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe('/search');
    expect(new URL(String(url)).searchParams.get('query')).toBe('Public artist');
    expect(config?.headers).toEqual({ 'X-Api-Key': options.apiKey, Accept: 'application/json' });
    expect(config?.redirect).toBe('error'); expect(config?.body).toBeUndefined();
    expect(result.matches[0].result.entities[0].entityType).toBe('urn:entity:artist');
    expect(JSON.stringify(result)).not.toContain(options.apiKey);
  });
  it('uses real IDs as insights signals and retains only sourced affinity', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, results: { entities: [{ entity_id: fixtureId, name: 'UNIT TEST BOOK', subtype: 'urn:entity:book', query: { affinity: 0.42, explainability: { inputs: [] } } }] }, query: { explainability: { warning: 'UNIT TEST warning' } } }));
    const result = await new QlooAdapter({ ...options, fetcher }).explore({ entityIds: [fixtureId], targetCategory: 'urn:entity:book' });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe('/v2/insights/'); expect(url.searchParams.get('signal.interests.entities')).toBe(fixtureId);
    expect(url.searchParams.get('filter.type')).toBe('urn:entity:book');
    expect(result.entities[0]).toMatchObject({ score: 0.42, scoreField: 'query.affinity' }); expect(result.warnings).toHaveLength(1);
  });
  it.each([[401, 'unauthorized'], [403, 'unauthorized'], [429, 'rate_limited'], [500, 'upstream_error']])('maps HTTP %s without leaking upstream bodies', async (status, reason) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('private diagnostic that must not be exposed', { status: status as number }));
    await expect(new QlooAdapter({ ...options, fetcher }).resolve({ interests: ['Public artist'] })).rejects.toMatchObject({ reason });
  });
  it('returns no_match for an empty result or search 404', async () => {
    for (const response of [Response.json({ results: [] }), new Response(null, { status: 404 })]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      expect((await new QlooAdapter({ ...options, fetcher }).resolve({ interests: ['Public artist'] })).status).toBe('no_match');
    }
  });
  it('rejects malformed responses rather than inventing entities', async () => {
    for (const body of [{ results: [{ name: 'Missing ID' }] }, { success: false, results: [] }, { arbitrary: true }]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
      await expect(new QlooAdapter({ ...options, fetcher }).resolve({ interests: ['Public artist'] })).rejects.toMatchObject({ reason: 'invalid_response' });
    }
  });
  it('aborts timed-out calls', async () => {
    const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    await expect(new QlooAdapter({ ...options, fetcher, timeoutMs: 5 }).resolve({ interests: ['Public artist'] })).rejects.toMatchObject({ reason: 'timeout' });
  });
});

describe('HTTP boundary', () => {
  const request = (body: unknown, headers = {}) => new Request('http://localhost/api/taste/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  it('returns an honest 503 with missing configuration', async () => {
    const response = await qlooRoute(request({ interests: ['Public artist'] }), (input) => new QlooAdapter({ apiKey: '' }).resolve(input));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ status: 'unavailable', reason: 'missing_key' });
  });
  it('rejects untrusted origins and oversized requests before the adapter', async () => {
    const action = vi.fn();
    expect((await qlooRoute(request({}, { origin: 'https://evil.invalid' }), action)).status).toBe(403);
    expect((await qlooRoute(request({ text: 'a'.repeat(5000) }), action)).status).toBe(413);
    expect(action).not.toHaveBeenCalled();
  });
  it('accepts only the configured public HTTPS origin behind the SDK HTTP adapter', async () => {
    vi.stubEnv('TEMILO_PUBLIC_ORIGIN', 'https://temilo.example');
    const action = vi.fn().mockResolvedValue({ status: 'success' });
    expect((await qlooRoute(request({}, { origin: 'https://temilo.example' }), action)).status).toBe(200);
    expect((await qlooRoute(request({}, { origin: 'http://localhost' }), action)).status).toBe(403);
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('rejects unexpected fields at the HTTP boundary', async () => {
    const response = await qlooRoute(request({ interests: ['Public artist'], personId: fixtureId }), (input) => new QlooAdapter({ apiKey: '' }).resolve(input));
    expect(response.status).toBe(400);
  });
});
