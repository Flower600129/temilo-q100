// Original deterministic RGBA paper grain. No reference-image pixels are used.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const size = 128;
let seed = 31817;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 0x100000000; };
function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, checksum]);
}
const rows = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const index = y * (size * 4 + 1) + 1 + x * 4;
  const light = random() > 0.5;
  rows[index] = light ? 255 : 75; rows[index + 1] = light ? 255 : 54; rows[index + 2] = light ? 255 : 52;
  rows[index + 3] = Math.floor(random() * 25);
}
const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
mkdirSync('mobile/assets/textures', { recursive: true });
writeFileSync('mobile/assets/textures/paper-grain.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
console.log('Created original 128px paper-grain tile.');
