import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)); process.chdir(root);
execFileSync(process.execPath, ['scripts/check-secrets.mjs', '--source-only'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-asset-rights.mjs'], { stdio: 'inherit' });
const destination = join('.local/releases', `review-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const roots = ['src/', 'mobile/src/', 'vendor/', 'scripts/', 'tests/', 'netlify/'];
const assetManifest = JSON.parse(readFileSync('mobile/assets/redistribution.json', 'utf8'));
const allowedAssets = new Set(['mobile/assets/redistribution.json', ...assetManifest.files.map(file => 'mobile/assets/' + file.path)]);
for (const file of assetManifest.files) {
  const actual = createHash('sha256').update(readFileSync('mobile/assets/' + file.path)).digest('hex');
  if (actual !== file.sha256) throw new Error(`Asset changed since rights review: ${file.path}`);
}
const exact = ['.env.example', '.gitignore', '.dockerignore', 'AGENTS.md', 'README.md', 'Dockerfile', 'render.yaml', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.shared.json', 'next.config.ts', 'next-env.d.ts', 'eslint.config.mjs', 'vitest.config.ts', 'playwright.config.ts', 'playwright.production.config.ts', 'playwright.legacy.config.ts', 'mobile/package.json', 'mobile/app.json', 'mobile/metro.config.js', 'mobile/tsconfig.json', 'mobile/expo-env.d.ts', 'mobile/eslint.config.cjs', 'mobile/AGENTS.md', 'LICENSE', 'docs/judging-guide.md', 'docs/release-status.md', 'docs/submission-draft.md', 'docs/third-party-notices.md', 'docs/deployment.md', 'docs/security-review-20261031.md', 'docs/evidence/q100-live-20261031.json', 'docs/evidence/q100-home-390.png', 'docs/evidence/q100-editor-390.png'];
const candidates = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
exact.push('netlify.toml', 'playwright.netlify.config.ts', 'docs/netlify-deployment.md');
const selected = [...new Set(candidates.filter(p => roots.some(prefix => p.startsWith(prefix)) || allowedAssets.has(p) || exact.includes(p)))].sort(); const files = [];
for (const path of selected) {
  if (!lstatSync(path).isFile() || /(^|\/)\.env(?!\.example$)/.test(path) || /(^|\/)(?:node_modules|dist|\.local|\.expo)(\/|$)/.test(path) || /\.(db|sqlite|sqlite3)$/i.test(path)) throw new Error('Unexpected entry in release source.');
  const body = readFileSync(path); const target = join(destination, 'source', path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(path, target);
  files.push({ path, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
}
const manifest = { createdAt: new Date().toISOString(), status: 'PRIVATE REVIEW DRAFT — not published or formally submission-ready', sourceLicensePresent: existsSync('LICENSE'), assetRightsPending: false, assetPolicy: 'mobile/assets/redistribution.json (hash-checked allowlist)', excluded: ['credentials', 'personal storage', 'dependencies/builds', '.local diagnostics', 'supplied design reference', 'unverified unused template assets', 'original project brief', 'private handoffs/reports'], files };
writeFileSync(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync('.local/q100-release-latest.json', JSON.stringify({ destination, files: files.length, manifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex') }, null, 2) + '\n');
console.log(JSON.stringify({ destination, files: files.length, sourceLicensePresent: manifest.sourceLicensePresent }));
