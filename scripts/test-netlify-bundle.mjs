import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'temilo-netlify-bundle-'));
try {
  execFileSync('unzip', ['-q', resolve('.local/q100-netlify/functions/temilo.zip'), '-d', directory]);
  const child = spawn(process.execPath, ['scripts/test-netlify-server.mjs'], { stdio: 'inherit', env: { ...process.env, TEMILO_TEST_BUNDLE_ROOT: directory } });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => child.kill(signal));
  process.exitCode = await new Promise(resolve => { child.once('exit', code => resolve(code ?? 1)); child.once('error', () => resolve(1)); });
} finally { rmSync(directory, { recursive: true, force: true }); }
