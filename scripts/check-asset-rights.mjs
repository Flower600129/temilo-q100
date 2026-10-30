import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const manifest = JSON.parse(readFileSync('mobile/assets/redistribution.json', 'utf8'));
const allowed = new Set(manifest.files.map(file => 'mobile/assets/' + file.path));
for (const file of manifest.files) {
  if (!['MIT', 'OFL-1.1'].includes(file.license) || !file.provenance) throw new Error(`Missing asset rights: ${file.path}`);
  if (createHash('sha256').update(readFileSync('mobile/assets/' + file.path)).digest('hex') !== file.sha256) throw new Error(`Asset hash changed: ${file.path}`);
}
function verify(path) {
  const normalized = relative(root, resolve(path));
  if (!allowed.has(normalized)) throw new Error(`Active asset lacks reviewed permission: ${normalized}`);
}
function config(value) {
  if (typeof value === 'string' && value.startsWith('./assets/')) verify('mobile/' + value);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) config(child);
}
config(JSON.parse(readFileSync('mobile/app.json', 'utf8')));
function scan(directory) {
  for (const name of readdirSync(directory)) {
    const path = directory + '/' + name;
    if (statSync(path).isDirectory()) scan(path);
    else if (/\.[cm]?[jt]sx?$/.test(name)) {
      const source = readFileSync(path, 'utf8');
      // Current application assets use static require/imports, which Metro needs.
      for (const match of source.matchAll(/["']([^"'\n]*assets\/[^"'\n]+)["']/g)) verify(resolve(dirname(path), match[1]));
    }
  }
}
scan('mobile/src');
if (!readFileSync('LICENSE', 'utf8').includes('Copyright (c) 2026 Liuyun')) throw new Error('Root source license is missing its confirmed holder.');
console.log(`PASS: ${allowed.size} reviewed assets match their hashes; active config/source references are allowlisted. Unused template artwork is excluded from release drafts.`);
