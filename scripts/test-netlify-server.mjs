// Isolated local hosting simulation: real Expo adapter and SQL quota, blank key.
// Never used by the deployed function. No personal browser or remote DB.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, realpathSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { pathToFileURL } from 'node:url';
import { NetlifyDB } from '@netlify/database-dev';
import { getDatabase } from '@netlify/database';
import { createSharedQuota } from '../netlify/lib/quota.ts';
import { createGuardedHandler, securityHeaders } from '../netlify/lib/guard.ts';

Object.assign(process.env, { QLOO_API_KEY: '', QLOO_BASE_URL: '', EXPO_NO_DOTENV: '1' });
delete process.env.TEMILO_PUBLIC_ORIGIN;
const scope = new AsyncLocalStorage();
const simulatedOrigin = 'https://temilo-test.example'; const localOrigin = 'http://127.0.0.1:8084';
const engine = new NetlifyDB({ logger: () => {} }); const connectionString = await engine.start();
await engine.applyMigrations('netlify/database/migrations');
const environment = { TEMILO_PUBLIC_ORIGIN: simulatedOrigin, NETLIFY_DB_URL: connectionString, TEMILO_QLOO_DAILY_UNITS: '1000', TEMILO_QLOO_MINUTE_UNITS: '1000' };
Object.defineProperty(globalThis, 'Netlify', { value: { get context() { return scope.getStore(); }, env: { get: key => environment[key] } }, configurable: true });
const database = getDatabase({ connectionString });
const quota = createSharedQuota(database.pool, { daily: 1000, minute: 1000 });
const require = createRequire(import.meta.url);
const expo = require('expo-server/adapter/netlify').createRequestHandler({ build: resolve('mobile/dist/web/server') });
const guarded = createGuardedHandler(expo, { origin: simulatedOrigin, quota: () => quota });
const client = realpathSync('mobile/dist/web/client');
let invoke = guarded;
if (process.env.TEMILO_TEST_BUNDLE_ROOT) {
  const root = realpathSync(process.env.TEMILO_TEST_BUNDLE_ROOT);
  const previous = process.cwd();
  try {
    process.chdir(root);
    invoke = (await import(pathToFileURL(resolve(root, 'netlify/functions/temilo.mjs')).href)).default;
  } finally { process.chdir(previous); }
}
const types = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
    const pathname = new URL(req.url, localOrigin).pathname;
    const file = resolve(client, '.' + decodeURIComponent(pathname));
    if (['GET', 'HEAD'].includes(req.method) && file.startsWith(client + sep) && existsSync(file) && statSync(file).isFile() && realpathSync(file).startsWith(client + sep)) {
      res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
      if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res); return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, String(value));
    headers.set('host', new URL(simulatedOrigin).host);
    if (headers.get('origin') === localOrigin) headers.set('origin', simulatedOrigin);
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(simulatedOrigin + req.url, { method: req.method, headers, body });
    const context = { site: { url: simulatedOrigin }, deploy: { context: 'production' }, waitUntil() {} };
    const response = await scope.run(context, () => invoke(request, context));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(503); res.end('Local adapter simulation unavailable'); }
});
server.on('error', async error => { await database.pool.end(); await engine.stop(); console.error(error.code === 'EADDRINUSE' ? 'Owned 8084 unavailable; no unknown process stopped.' : 'Local Netlify simulation failed.'); process.exitCode = 1; });
server.listen(8084, '127.0.0.1', () => console.log('Isolated Netlify adapter + SQL simulation: ' + localOrigin));
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  if (stopping) return; stopping = true;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await database.pool.end(); await engine.stop(); process.exit(0);
});
