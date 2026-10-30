'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires a callable CommonJS compatibility package. */
// Metro 54 calls the 1.x API with either a file path or a Buffer. The 2.x
// parser fixes the JXL/HEIF/ICNS hangs but removed synchronous path reads.
const fs = require('node:fs');
const upstream = require('image-size-upstream');
const fromFile = require('image-size-upstream/fromFile');
let disabledFS = false;
function imageSize(input, callback) {
  if (input instanceof Uint8Array) return upstream.imageSize(input);
  if (typeof input !== 'string' || disabledFS) {
    throw new TypeError('invalid invocation. input should be a Uint8Array');
  }
  if (typeof callback === 'function') {
    fromFile.imageSizeFromFile(input).then(
      size => process.nextTick(callback, null, size),
      error => process.nextTick(callback, error),
    );
    return;
  }
  const fd = fs.openSync(input, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size <= 0) throw new Error('Empty file');
    // Preserve 1.x's bounded read, rather than loading an arbitrary file.
    const bytes = Buffer.alloc(Math.min(size, 512 * 1024));
    const read = fs.readSync(fd, bytes, 0, bytes.length, 0);
    return upstream.imageSize(bytes.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
}
module.exports = imageSize;
module.exports.default = imageSize;
module.exports.imageSize = imageSize;
module.exports.types = upstream.types;
module.exports.disableTypes = upstream.disableTypes;
module.exports.disableFS = value => { disabledFS = value; };
module.exports.setConcurrency = fromFile.setConcurrency;
