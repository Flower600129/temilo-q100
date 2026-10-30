import { z } from 'zod';
import { QlooError } from './adapter.server';

// Development fallback only; the production server applies a durable shared
// budget across both API bundles before forwarding a request.
let requests: number[] = [];
export async function qlooRoute(request: Request, action: (input: unknown) => Promise<unknown>): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  const error = (status: number, reason: string) => Response.json({ status: 'unavailable', reason }, { status, headers });
  const origin = request.headers.get('origin');
  if (origin && origin !== (process.env.TEMILO_PUBLIC_ORIGIN?.trim() || new URL(request.url).origin)) return error(403, 'invalid_origin');
  if (!request.headers.get('content-type')?.includes('application/json')) return error(415, 'invalid_content_type');
  const now = Date.now();
  requests = requests.filter((time) => now - time < 60_000);
  if (requests.length >= 20) return error(429, 'rate_limited');
  requests.push(now);
  try {
    const reader = request.body?.getReader();
    if (!reader) return error(400, 'invalid_input');
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); return error(413, 'input_too_large'); }
      chunks.push(value);
    }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return Response.json(await action(input), { headers });
  } catch (cause) {
    if (cause instanceof z.ZodError || cause instanceof SyntaxError) return error(400, 'invalid_input');
    if (cause instanceof QlooError) return error(cause.httpStatus, cause.reason);
    return error(500, 'internal_error');
  }
}
