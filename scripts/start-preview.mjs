import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const project = join(root, 'mobile');
const cli = join(dirname(require.resolve('expo/package.json', { paths: [project] })), 'bin/cli');
const args = process.argv.slice(2);
const testing = args.includes('--test-server');
const production = args.includes('--production');
const extra = args.filter((arg) => !['--test-server', '--production'].includes(arg));
const port = testing ? 8083 : 8082;

if (testing && production || extra.some((arg) => arg !== '--clear')) {
  console.error('Use npm run dev [-- --clear], npm start, or the isolated test runner. The preview port is fixed at 8082.');
  process.exit(1);
}
if (production && extra.length) {
  console.error('--clear is only supported by the development server.');
  process.exit(1);
}

// Test servers never load the real root credentials. Also disable Expo's own
// dotenv loader so mobile/.env files cannot accidentally re-enable live calls.
if (!testing) require('@next/env').loadEnvConfig(root, !production);
const env = { ...process.env, EXPO_NO_TELEMETRY: '1' };
if (testing) Object.assign(env, {
  CI: '1', EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1',
  QLOO_API_KEY: '', QLOO_BASE_URL: '', EXPO_PUBLIC_API_URL: '',
});

try {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    // Probe the wildcard socket as Expo does. On macOS an IPv4-only probe can
    // miss an already-listening IPv6 server and trigger Expo's alternate-port prompt.
    probe.listen({ port, exclusive: true }, () => probe.close(resolve));
  });
} catch (error) {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Run npm run preview:status. Reuse the existing preview, or stop its original terminal with Ctrl+C before restarting. No process was stopped and no alternate port was selected.`
    : `Could not bind localhost:${port} (${error.code ?? 'unknown error'}).`);
  process.exit(1);
}

console.log(`TEMILO ${testing ? 'isolated tests (Qloo disabled)' : production ? 'production preview' : 'development preview'}: http://127.0.0.1:${port}/`);
const command = production ? ['serve', join(project, 'dist/web'), '--port', String(port)] : ['start', '--web', '--localhost', '--port', String(port), ...extra];
const child = spawn(process.execPath, [cli, ...command], { cwd: project, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.on('error', () => { console.error('Could not start the installed Expo CLI. Run npm ci and retry.'); process.exitCode = 1; });
child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1)));
