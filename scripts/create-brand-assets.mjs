// Original TEMILO gift/light geometry. No reference art, fonts or network input.
// Both SVG and PNG derive from these same primitives; Node's zlib is sufficient.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../mobile/assets/', import.meta.url));
const ink = '#4B3634', paper = '#FAF7F2', gold = '#AE814A';
const shapes = [
  { kind: 'box', x: 61, y: 119, w: 134, h: 91, r: 9, stroke: 7 },
  { kind: 'box', x: 49, y: 96, w: 158, h: 25, r: 5, stroke: 7 },
  { kind: 'line', x: 128, y: 98, x2: 128, y2: 209, stroke: 7 },
  { kind: 'ellipse', x: 105, y: 79, rx: 26, ry: 12, angle: 0.55, stroke: 7 },
  { kind: 'ellipse', x: 151, y: 79, rx: 26, ry: 12, angle: -0.55, stroke: 7 },
  { kind: 'circle', x: 202, y: 46, r: 8, accent: true },
  { kind: 'line', x: 215, y: 61, x2: 215, y2: 77, stroke: 4, accent: true },
  { kind: 'line', x: 207, y: 69, x2: 223, y2: 69, stroke: 4, accent: true },
];
function geometry(s, color) {
  const attr = `fill="none" stroke="${color}" stroke-width="${s.stroke}" stroke-linecap="round"`;
  if (s.kind === 'box') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ${attr}/>`;
  if (s.kind === 'line') return `<path d="M${s.x} ${s.y}L${s.x2} ${s.y2}" ${attr}/>`;
  if (s.kind === 'ellipse') return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" transform="rotate(${s.angle * 180 / Math.PI} ${s.x} ${s.y})" ${attr}/>`;
  return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${color}"/>`;
}
function svg(background, foreground) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 256 256">\n${background ? `<rect width="256" height="256" fill="${background}"/>` : ''}\n${shapes.map(s => geometry(s, s.accent ? gold : foreground)).join('\n')}\n</svg>\n`;
}
function contains(s, x, y) {
  if (s.kind === 'circle') return Math.hypot(x - s.x, y - s.y) <= s.r;
  if (s.kind === 'line') {
    const dx = s.x2 - s.x, dy = s.y2 - s.y;
    const t = Math.max(0, Math.min(1, ((x - s.x) * dx + (y - s.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - s.x - t * dx, y - s.y - t * dy) <= s.stroke / 2;
  }
  if (s.kind === 'box') {
    const qx = Math.abs(x - s.x - s.w / 2) - (s.w / 2 - s.r);
    const qy = Math.abs(y - s.y - s.h / 2) - (s.h / 2 - s.r);
    const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.r;
    return Math.abs(distance) <= s.stroke / 2;
  }
  const dx = x - s.x, dy = y - s.y, c = Math.cos(s.angle), a = Math.sin(s.angle);
  const u = dx * c + dy * a, v = -dx * a + dy * c;
  const outer = (u / (s.rx + s.stroke / 2)) ** 2 + (v / (s.ry + s.stroke / 2)) ** 2 <= 1;
  const inner = (u / (s.rx - s.stroke / 2)) ** 2 + (v / (s.ry - s.stroke / 2)) ** 2 < 1;
  return outer && !inner;
}
const rgb = hex => [1, 3, 5].map(n => parseInt(hex.slice(n, n + 2), 16));
function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, checksum]);
}
function png(size, background, foreground, scale = 1) {
  const rows = Buffer.alloc((size * 4 + 1) * size), bg = background ? rgb(background) : [0, 0, 0];
  const colors = shapes.map(s => rgb(s.accent ? gold : foreground));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      let color = bg, alpha = background ? 255 : 0;
      for (let i = 0; i < shapes.length; i++) if (contains(shapes[i], ((x + (sx + 0.5) / 2) * 256 / size - 128) / scale + 128, ((y + (sy + 0.5) / 2) * 256 / size - 128) / scale + 128)) { color = colors[i]; alpha = 255; }
      for (let k = 0; k < 3; k++) sum[k] += color[k] * alpha / 255;
      sum[3] += alpha;
    }
    const at = y * (size * 4 + 1) + 1 + x * 4;
    for (let k = 0; k < 3; k++) rows[at + k] = sum[3] ? Math.round(sum[k] * 255 / sum[3]) : 0;
    rows[at + 3] = Math.round(sum[3] / 4);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync(root + 'images', { recursive: true });
writeFileSync(root + 'gift-memory-icon.svg', svg(ink, paper));
writeFileSync(root + 'gift-memory-mark.svg', svg(null, ink));
for (const [name, size, background, foreground] of [
  ['icon.png', 1024, ink, paper], ['favicon.png', 64, ink, paper],
  ['splash-icon.png', 1024, null, ink], ['android-icon-foreground.png', 1024, null, ink],
]) writeFileSync(root + 'images/' + name, png(size, background, foreground, name === 'android-icon-foreground.png' ? 0.8 : 1));
console.log('Generated original gift/light SVG and four PNG assets from local geometry.');
