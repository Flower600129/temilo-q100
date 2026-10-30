import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { loadEnvConfig } = createRequire(import.meta.url)('@next/env');
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
loadEnvConfig(root);
const flags = process.argv.slice(2);
if (flags.some((flag) => !['--source-only', '--all-exports'].includes(flag))) throw new Error('Use --source-only or --all-exports.');
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
const key = process.env.QLOO_API_KEY?.trim();
const failures = [];
for (const path of paths) {
  if (/(^|\/)\.env(\..*)?$/.test(path) && !path.endsWith('.env.example')) failures.push(`${path}: environment file is not ignored`);
  if (!existsSync(path)) continue;
  const body = readFileSync(path, 'utf8');
  if (key && body.includes(key)) failures.push(`${path}: configured credential found`);
  if (/(?:NEXT_PUBLIC_|EXPO_PUBLIC_)[A-Z_]*QLOO[A-Z_]*\s*[=:]\s*["']?[^\s"']+/i.test(body)) failures.push(`${path}: public Qloo configuration found`);
}
execFileSync('git', ['check-ignore', '.env.local'], { stdio: 'pipe' });
let bundles = 0;
function inspect(directory) {
  if (!existsSync(directory)) throw new Error(`Missing ${directory}. Run the applicable build first, or use --source-only for a source baseline.`);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else if (/\.(js|map|hbc|json)$/.test(path)) {
      bundles++;
      const body = readFileSync(path, 'utf8');
      if (body.includes('QLOO_API_KEY') || (key && body.includes(key))) failures.push(`${path}: server credential reference in client bundle`);
    }
  }
}
if (!flags.includes('--source-only')) inspect('mobile/dist/web/client');
if (flags.includes('--all-exports')) {
  inspect('.next/static');
  inspect('mobile/dist/ios');
  inspect('mobile/dist/android');
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${paths.length} tracked/unignored files and ${bundles} client bundles scanned; .env.local is ignored. ${key ? 'Configured key checked without printing it.' : 'No real key configured; checked server-only boundary and ignores.'}`);
