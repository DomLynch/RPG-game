// Independent JavaScript pixel decoder; it does not use the native build encoder.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const cache = new Map();
export function jpegFingerprint(bytes) {
  const key = hash(bytes);
  if (cache.has(key)) return cache.get(key);
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  const metadata = [];
  // Keep EXIF/orientation, ICC profiles, Adobe colour information, XMP and comments.
  // JFIF density is not a texture coordinate or pixel property.
  for (let i = 2; i < bytes.length;) {
    if (bytes[i++] !== 0xff) continue;
    while (bytes[i] === 0xff) i++;
    const marker = bytes[i++];
    if (marker === 0xd9) break;
    if (marker === 0 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(i);
    assert.ok(length >= 2 && i + length <= bytes.length, 'Invalid JPEG marker length');
    if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) metadata.push([marker, hash(bytes.subarray(i + 2, i + length))]);
    i += length;
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 64, maxMemoryUsageInMB: 512 });
  const result = { width: decoded.width, height: decoded.height, pixels: hash(decoded.data), metadata };
  cache.set(key, result);
  return result;
}
