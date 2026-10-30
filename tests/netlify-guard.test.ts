import { describe, expect, it, vi } from 'vitest';
import { createGuardedHandler } from '../netlify/lib/guard';
import type { SharedQuota } from '../netlify/lib/quota';
const origin = 'https://temilo-test.example';
const input = { interests: ['Radiohead'] };
const request = (path: string, init?: RequestInit) => new Request(origin + path, init);
const post = (body: unknown = input) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
function setup(quota?: SharedQuota) {
  const reserve = vi.fn<SharedQuota['reserve']>().mockResolvedValue({ state: 'allowed', token: 'synthetic-lease' });
  const release = vi.fn<SharedQuota['release']>().mockResolvedValue(undefined);
  const upstream = vi.fn(async (req: Request) => Response.json({ body: await req.json() }));
  const handler = createGuardedHandler(upstream, { origin, quota: () => quota ?? { reserve, release } });
  return { handler: (req: Request) => handler(req, undefined), reserve, release, upstream };
}
describe('Functions ingress guards (injected responses, no Qloo network)', () => {
  it('blocks origin, host, content type, method, hidden paths and unknown APIs before spending', async () => {
    const { handler, reserve } = setup();
    expect((await handler(request('/api/taste/resolve', { ...post(), headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' } }))).status).toBe(403);
    expect((await handler(new Request('https://other.example/api/taste/resolve', post()))).status).toBe(400);
    expect((await handler(request('/api/taste/resolve', { ...post(), headers: { 'Content-Type': 'application/json', Host: 'other.example' } }))).status).toBe(400);
    expect((await handler(request('/api/taste/resolve', { ...post(), headers: { 'Content-Type': 'text/plain' } }))).status).toBe(415);
    expect((await handler(request('/api/taste/resolve'))).status).toBe(405);
    for (const path of ['/.env.local', '/server/_expo/routes.json', '/_expo/functions/api/test.js.map', '/api/not-real']) expect((await handler(request(path))).status).toBe(404);
    expect((await handler(request('/?bad=%E0%A4%A'))).status).toBe(400);
    expect((await handler(request('/?bad=' + 'x'.repeat(2100)))).status).toBe(414);
    expect(reserve).not.toHaveBeenCalled();
  });
  it('bounds streamed bodies even without Content-Length and never forwards private oversized input', async () => {
    const { handler, reserve, upstream } = setup();
    expect((await handler(request('/api/taste/resolve', post({ interests: ['x'.repeat(5000)] })))).status).toBe(413);
    expect(reserve).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
  });
  it('preserves the body, reserves resolve=3/explore=1 and always releases leases', async () => {
    const { handler, reserve, release } = setup();
    const response = await handler(request('/api/taste/resolve', post()));
    expect(await response.json()).toEqual({ body: input }); expect(reserve).toHaveBeenCalledWith(3);
    expect(release).toHaveBeenCalledWith('synthetic-lease');
    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('credentialless');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await handler(request('/api/taste/explore', post({ entityIds: ['public-id'], targetCategory: 'urn:entity:book' })));
    expect(reserve).toHaveBeenLastCalledWith(1);
  });
  it('fails closed on quota outages/exhaustion and does not call the API', async () => {
    for (const state of ['daily', 'minute', 'busy'] as const) {
      const { handler, upstream } = setup({ reserve: async () => ({ state }), release: async () => {} });
      const response = await handler(request('/api/taste/resolve', post()));
      expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('60'); expect(upstream).not.toHaveBeenCalled();
    }
    const { handler, upstream } = setup({ reserve: async () => { throw new Error('Unavailable local fixture'); }, release: async () => {} });
    expect((await handler(request('/api/taste/resolve', post()))).status).toBe(503); expect(upstream).not.toHaveBeenCalled();
  });
  it('keeps static health usable without a database and rejects an insecure configured origin', async () => {
    const { handler, reserve } = setup(); const response = await handler(request('/healthz'));
    expect(response.status).toBe(200); expect(await response.text()).toBe('ok'); expect(reserve).not.toHaveBeenCalled();
    expect(() => createGuardedHandler(async () => new Response(), { origin: 'http://insecure.example', quota: () => { throw new Error(); } })).toThrow();
  });
});
