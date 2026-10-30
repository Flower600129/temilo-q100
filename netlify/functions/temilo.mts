import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { getDatabase } from '@netlify/database';
import type { Config, Context } from '@netlify/functions';
import { createSharedQuota, type SharedQuota } from '../lib/quota';
import { createGuardedHandler, securityHeaders } from '../lib/guard';

// SDK54's installed CJS adapter avoids Node's extensionless ESM imports.
const require = createRequire(import.meta.url);
const expo = require('expo-server/adapter/netlify').createRequestHandler({ build: resolve(process.cwd(), 'mobile/dist/web/server') }) as (request: Request, context: Context) => Promise<Response>;
let shared: SharedQuota | undefined;
export default async function temilo(request: Request, context: Context): Promise<Response> {
  try {
    const origin = Netlify.env.get('TEMILO_PUBLIC_ORIGIN') ?? '';
    const handler = createGuardedHandler(expo, {
      origin,
      quota: () => shared ??= createSharedQuota(getDatabase().pool, {
        daily: Number(Netlify.env.get('TEMILO_QLOO_DAILY_UNITS') ?? 60),
        minute: Number(Netlify.env.get('TEMILO_QLOO_MINUTE_UNITS') ?? 12),
      }),
    });
    return await handler(request, context);
  } catch {
    return Response.json({ status: 'unavailable', reason: 'server_unavailable' }, { status: 503, headers: { ...securityHeaders, 'Cache-Control': 'no-store' } });
  }
}
export const config: Config = {
  path: '/*', preferStatic: true,
  // Free supports two code rules. This per-IP edge layer reduces invocations;
  // the SQL ledger remains the strict, weighted, global provider budget.
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowSize: 60, windowLimit: 120 },
};
