import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
execFileSync(process.execPath, ['scripts/check-secrets.mjs', '--source-only'], { stdio: 'inherit' });
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))].sort();
const destination = join('.local/baselines', `source-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const files = [];
for (const path of paths) {
  if (!lstatSync(path).isFile() || /(^|\/)\.env(\.|$)/.test(path) && path !== '.env.example' || /\.(sqlite|sqlite3|db)$/i.test(path)) {
    throw new Error('A non-source entry was found. Review the ignored-file rules before creating a baseline.');
  }
  const data = readFileSync(path);
  const target = join(destination, 'source', path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(path, target);
  files.push({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
const sha256 = createHash('sha256').update(JSON.stringify(files)).digest('hex');
writeFileSync(join(destination, 'manifest.json'), `${JSON.stringify({ createdAt: new Date().toISOString(), files, sha256 }, null, 2)}\n`);
console.log(JSON.stringify({ baseline: destination, files: files.length, sha256, gitCommitCreated: false }));
