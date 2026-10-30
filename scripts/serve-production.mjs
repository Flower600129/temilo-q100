import { createServer } from 'node:http';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { openQuota } from '../src/qloo/quota.server.ts';
const require = createRequire(import.meta.url); const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2); const testing = args.includes('--test-server');
if (args.some(arg => !['--test-server', '--local-env'].includes(arg)) || testing && args.includes('--local-env')) throw new Error('Use --test-server or --local-env, never both.');
if (testing) { Object.assign(process.env, { QLOO_API_KEY: '', QLOO_BASE_URL: '', EXPO_NO_DOTENV: '1' }); delete process.env.TEMILO_PUBLIC_ORIGIN; }
else if (args.includes('--local-env')) require('@next/env').loadEnvConfig(root, false);
const host = process.env.TEMILO_BIND ?? '127.0.0.1'; const port = Number(process.env.PORT ?? 8084);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use an unprivileged PORT from 1024 to 65535.');
const publicOrigin = process.env.TEMILO_PUBLIC_ORIGIN;
if (publicOrigin) { const url = new URL(publicOrigin); if (url.origin !== publicOrigin || url.protocol !== 'https:') throw new Error('TEMILO_PUBLIC_ORIGIN must be an HTTPS origin without a path.'); }
if (!['127.0.0.1', '::1', 'localhost'].includes(host) && !publicOrigin) throw new Error('Public binding requires TEMILO_PUBLIC_ORIGIN.');
const client = realpathSync(resolve(root, 'mobile/dist/web/client')); const build = resolve(root, 'mobile/dist/web/server');
if (!existsSync(resolve(build, '_expo/routes.json'))) throw new Error('Build the Web server export first.');
const handler = require('expo-server/adapter/http').createRequestHandler({ build, environment: 'production' });
const quota = openQuota(resolve(root, process.env.TEMILO_QUOTA_FILE ?? '.local/runtime/qloo-quota.json'), { daily: Number(process.env.TEMILO_QLOO_DAILY_UNITS ?? 60), minute: Number(process.env.TEMILO_QLOO_MINUTE_UNITS ?? 12) });
const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.html': 'text/html' };
let inFlight = 0;
function error(res, code, reason) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(code === 429 ? { 'Retry-After': '60' } : {}) }); res.end(JSON.stringify({ status: 'unavailable', reason })); }
const server = createServer({ requestTimeout: 10_000, headersTimeout: 10_000, maxHeaderSize: 8192 }, async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin'); res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  let charged = false;
  try {
    if (req.url.length > 2048) return error(res, 414, 'url_too_long');
    try { decodeURIComponent(req.url); } catch { return error(res, 400, 'invalid_url'); }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (publicOrigin && req.headers.host !== new URL(publicOrigin).host) return error(res, 400, 'invalid_host');
    if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); return; }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (!['/api/taste/status', '/api/taste/resolve', '/api/taste/explore'].includes(url.pathname)) return error(res, 404, 'not_found');
      if (url.pathname !== '/api/taste/status') {
        if (req.method !== 'POST') return error(res, 405, 'method_not_allowed');
        if (req.headers.origin && req.headers.origin !== (publicOrigin ?? url.origin)) return error(res, 403, 'invalid_origin');
        if (!req.headers['content-type']?.includes('application/json')) return error(res, 415, 'invalid_content_type');
        if (Number(req.headers['content-length']) > 4096) return error(res, 413, 'input_too_large');
        if (inFlight >= 2) return error(res, 429, 'rate_limited');
        const state = quota.reserve(url.pathname.endsWith('/resolve') ? 3 : 1);
        if (state !== 'allowed') return error(res, 429, state === 'daily' ? 'quota_exhausted' : 'rate_limited');
        inFlight++; charged = true;
      }
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.split('/').some(part => part.startsWith('.') || part === 'server') || decoded.endsWith('.map')) return error(res, 404, 'not_found');
      const path = resolve(client, `.${decoded}`);
      if (path.startsWith(client + sep) && existsSync(path) && statSync(path).isFile() && realpathSync(path).startsWith(client + sep)) {
        res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', decoded.startsWith('/_expo/') || decoded.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
        if (req.method === 'HEAD') res.end(); else createReadStream(path).on('error', () => res.destroy()).pipe(res); return;
      }
    }
    await handler(req, res, (cause) => { if (!res.headersSent) error(res, cause ? 503 : 404, cause ? 'server_unavailable' : 'not_found'); });
  } catch { if (!res.headersSent) error(res, 503, 'server_unavailable'); else res.destroy(); }
  finally { if (charged) inFlight--; }
});
server.on('error', errorValue => { quota.close(); console.error(errorValue.code === 'EADDRINUSE' ? `Port ${port} is occupied; no process was stopped.` : 'Production server could not start.'); process.exitCode = 1; });
server.listen(port, host, () => console.log(`TEMILO production ${testing ? '(isolated, blank key)' : ''}: http://${host}:${port}`));
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { if (stopping) return; stopping = true; server.close(() => { quota.close(); process.exit(0); }); server.closeIdleConnections(); });
