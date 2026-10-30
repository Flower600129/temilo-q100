import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const metroAssetPath = createRequire(require.resolve('@expo/metro/package.json')).resolve('metro/private/Assets');
const decode = require('decode-uri-component') as (input: unknown) => string;
const query = require('query-string') as { parse: (input: string) => Record<string, unknown>; stringify: (input: Record<string, unknown>) => string };
const size = require('image-size') as {
  (input: Uint8Array | string): { width: number; height: number };
  (input: string, callback: (error: Error | null, result: { width: number; height: number }) => void): void;
  disableFS: (value: boolean) => void;
};
describe('SDK54 dependency security compatibility', () => {
  it('uses the actual patched CJS packages from both parent dependency paths', () => {
    const fromQuery = createRequire(require.resolve('query-string'));
    const fromMetro = createRequire(metroAssetPath);
    expect(fromQuery.resolve('decode-uri-component')).toBe(require.resolve('decode-uri-component'));
    expect(fromMetro.resolve('image-size')).toBe(require.resolve('image-size'));
    expect(JSON.parse(readFileSync(join(dirname(require.resolve('image-size-upstream')), '../../package.json'), 'utf8')).version).toBe('2.0.4');
  });
  it('keeps the verified upstream decoder algorithm unchanged apart from documented compatibility edits', () => {
    const metadata = JSON.parse(readFileSync('vendor/decode-uri-component/upstream.json', 'utf8'));
    const restored = readFileSync('vendor/decode-uri-component/index.cjs', 'utf8')
      .replace('module.exports = function decodeUriComponent(encodedURI) {', 'export default function decodeUriComponent(encodedURI) {')
      .replace("// Keep the 0.2.x CommonJS caller contract for plus signs.\n\t\tencodedURI = encodedURI.replace(/\\+/g, ' ');\n\t\treturn decodeURIComponent(encodedURI);", '// Try the built in decoder first\n\t\treturn decodeURIComponent(encodedURI);');
    expect(createHash('sha256').update(restored).digest('hex')).toBe(metadata.upstreamIndexSha256);
  });
  it('preserves cultural text, repeated keys, plus signs and tolerant malformed query behavior', () => {
    const text = 'Radiohead + 坂本龍一 / Jane Austen';
    expect(query.parse(query.stringify({ interest: text, category: 'urn:entity:book' }))).toEqual({ interest: text, category: 'urn:entity:book' });
    expect(query.parse('name=Studio+Ghibli&name=Radiohead&bad=%zz&mixed=%C3%A5%zz')).toEqual({ name: ['Studio Ghibli', 'Radiohead'], bad: '%zz', mixed: 'å%zz' });
    expect(decode('Studio+Ghibli%zz')).toBe('Studio Ghibli%zz');
    expect(decode('%FE%FF')).toBe('\uFFFD\uFFFD');
    expect(() => decode(1)).toThrow(TypeError);
  });
  it('bounds malformed decoding work in an isolated process (both former DoS paths)', () => {
    // Timeout kills only this synthetic child if a vulnerable decoder returns.
    const code = `const d=require('decode-uri-component');
      const input='%C3%A5'.repeat(20000)+'%zz';
      if(d(input)!=='å'.repeat(20000)+'%zz')process.exit(1);
      const runs=Array.from({length:12000},(_,i)=>encodeURIComponent(String.fromCodePoint(0x400+i))).join('-')+'%zz';
      if(!d(runs).endsWith('%zz'))process.exit(2);`;
    expect(() => execFileSync(process.execPath, ['-e', code], { cwd: process.cwd(), timeout: 3000, stdio: 'pipe' })).not.toThrow();
  });
  it('preserves Metro Buffer/path dimensions and callback/error behavior', async () => {
    const data = readFileSync('mobile/assets/textures/paper-grain.png');
    expect(size(data)).toMatchObject({ width: 128, height: 128 });
    expect(size('mobile/assets/textures/paper-grain.png')).toMatchObject({ width: 128, height: 128 });
    const metro = require(metroAssetPath) as { getAssetSize: (type: string, data: Uint8Array, path: string) => object; getAssetData: (path: string, localPath: string, plugins: string[], platform: string, publicPath: string) => Promise<{ width: number; height: number }> };
    expect(metro.getAssetSize('png', data, 'paper-grain.png')).toEqual({ width: 128, height: 128 });
    const asset = await metro.getAssetData(join(process.cwd(), 'mobile/assets/textures/paper-grain.png'), 'assets/textures/paper-grain.png', [], 'web', '/assets');
    expect(asset).toMatchObject({ width: 128, height: 128 });
    await expect(new Promise((resolve, reject) => size('mobile/assets/textures/paper-grain.png', (error, result) => error ? reject(error) : resolve(result)))).resolves.toMatchObject({ width: 128, height: 128 });
    expect(() => size('not-an-existing-image.png')).toThrow();
    size.disableFS(true); try { expect(() => size('mobile/assets/textures/paper-grain.png')).toThrow(TypeError); expect(size(data).width).toBe(128); } finally { size.disableFS(false); }
    const dir = mkdtempSync(join(tmpdir(), 'temilo-size-'));
    try { const empty = join(dir, 'empty.png'); writeFileSync(empty, ''); expect(() => size(empty)).toThrow('Empty file'); } finally { rmSync(dir, { recursive: true }); }
  });
  it('rejects zero-size ICNS/JXL/HEIF chunks without looping in an isolated process', () => {
    const code = `const size=require('image-size');
      function box(type,payload){const header=Buffer.alloc(8);header.writeUInt32BE(payload.length+8);header.write(type,4);return Buffer.concat([header,payload])}
      const zeroIspe=Buffer.from('0000000069737065000000000000000200000003','hex');
      const cases=[
        Buffer.from('69636e73000000106963303800000000','hex'),
        Buffer.from('0000000c4a584c200d0a870a00000014667479706a786c20000000006a786c20000000006a786c70','hex'),
        Buffer.concat([box('ftyp',Buffer.from('686569630000000068656963','hex')),box('meta',Buffer.concat([Buffer.alloc(4),box('iprp',box('ipco',zeroIspe))]))])
      ];for(const data of cases){let threw=false;try{size(data)}catch{threw=true}if(!threw)process.exit(1)}`;
    expect(() => execFileSync(process.execPath, ['-e', code], { cwd: process.cwd(), timeout: 3000, stdio: 'pipe' })).not.toThrow();
  });
});
