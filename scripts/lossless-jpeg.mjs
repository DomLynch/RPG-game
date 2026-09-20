// Recode JPEG entropy/scans without changing DCT coefficients or source files.
// jpegtran is a build tool only; the browser receives ordinary JPEG textures.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const cache = new Map();
export function losslessJpeg(bytes) {
  const key = createHash('sha256').update(bytes).digest('hex');
  if (cache.has(key)) return cache.get(key);
  let best = bytes, size = gzipSync(bytes).length;
  for (const flags of [[], ['-progressive']]) {
    let candidate;
    try {
      candidate = execFileSync('jpegtran', ['-copy', 'all', '-optimize', ...flags], { input: bytes, maxBuffer: 32e6 });
    } catch (cause) {
      throw new Error('Lossless texture packing requires jpegtran: brew install jpeg-turbo, or apt install libjpeg-turbo-progs', { cause });
    }
    const packed = gzipSync(candidate).length;
    if (packed < size) { best = candidate; size = packed; }
  }
  cache.set(key, best);
  return best;
}
