import type { SharedQuota } from './quota';

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless',
};
export function createGuardedHandler<Context>(handler: (request: Request, context: Context) => Promise<Response>, options: { origin: string; quota: () => SharedQuota }) {
  const origin = new URL(options.origin);
  if (origin.protocol !== 'https:' || origin.origin !== options.origin) throw new Error('Use an exact HTTPS public origin.');
  const error = (status: number, reason: string) => Response.json({ status: 'unavailable', reason }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
  return async (incoming: Request, context: Context): Promise<Response> => {
    let token: string | undefined; let quota: SharedQuota | undefined;
    async function respond(): Promise<Response> {
      const url = new URL(incoming.url);
      if (incoming.url.length > 2048 + origin.origin.length) return error(414, 'url_too_long');
      let decoded: string;
      try { decoded = decodeURIComponent(url.pathname + url.search); } catch { return error(400, 'invalid_url'); }
      if (url.origin !== origin.origin || incoming.headers.has('host') && incoming.headers.get('host') !== origin.host) return error(400, 'invalid_host');
      if (decoded.split('/').some(part => part.startsWith('.') || part === 'server') || url.pathname.endsWith('.map')) return error(404, 'not_found');
      if (url.pathname === '/healthz') return new Response('ok', { headers: { 'Cache-Control': 'no-store' } });
      if (url.pathname.startsWith('/api/')) {
        if (!['/api/taste/status', '/api/taste/resolve', '/api/taste/explore'].includes(url.pathname)) return error(404, 'not_found');
        if (url.pathname === '/api/taste/status') {
          if (incoming.method !== 'GET') return error(405, 'method_not_allowed');
        } else {
          if (incoming.method !== 'POST') return error(405, 'method_not_allowed');
          if (incoming.headers.has('origin') && incoming.headers.get('origin') !== origin.origin) return error(403, 'invalid_origin');
          if (!incoming.headers.get('content-type')?.includes('application/json')) return error(415, 'invalid_content_type');
          if (Number(incoming.headers.get('content-length')) > 4096) return error(413, 'input_too_large');
          const reader = incoming.body?.getReader();
          if (!reader) return error(400, 'invalid_input');
          let size = 0; const chunks: Uint8Array[] = [];
          for (;;) {
            const { value, done } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 4096) { await reader.cancel(); return error(413, 'input_too_large'); }
            chunks.push(value);
          }
          const request = new Request(incoming, { body: Buffer.concat(chunks) });
          quota = options.quota();
          const reservation = await quota.reserve(url.pathname.endsWith('/resolve') ? 3 : 1);
          if (reservation.state !== 'allowed') return error(429, reservation.state === 'daily' ? 'quota_exhausted' : 'rate_limited');
          token = reservation.token;
          return handler(request, context);
        }
      } else if (!['GET', 'HEAD'].includes(incoming.method)) return error(405, 'method_not_allowed');
      return handler(incoming, context);
    }
    let response: Response;
    try { response = await respond(); } catch { response = error(503, 'server_unavailable'); }
    finally {
      if (token && quota) {
        // No retry/refund. If release fails, the bounded lease expires on its own.
        try { await quota.release(token); } catch { /* Do not log credentials or request payloads. */ }
      }
    }
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(securityHeaders)) headers.set(key, value);
    if (new URL(incoming.url).pathname.startsWith('/api/')) headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
