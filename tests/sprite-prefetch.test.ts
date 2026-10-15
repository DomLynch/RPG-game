import assert from 'node:assert/strict';
import test from 'node:test';
import { decodePrefetched, prefetchSprite } from '../src/audio/sprite.ts';

// The sprite is fetched before any gesture (no AudioContext needed) and only DECODED at unlock, so a first blow on a phone network is not silent for the length of a 563 kB download.
const ok = (bytes: number[]): Response => new Response(new Uint8Array(bytes), { status: 200 });
const never = () => false;
const ctx = (decode: (b: ArrayBuffer) => Promise<AudioBuffer>) => ({ decodeAudioData: decode }) as unknown as BaseAudioContext;

test('prefetch fetches once, and the unlock decodes those bytes without a second request', async () => {
  const urls: string[] = []; const fetchImpl: typeof fetch = async (u) => { urls.push(String(u)); return ok([1, 2, 3]); };
  const pre = prefetchSprite(['aac', 'opus'], fetchImpl, never); assert.equal(urls.length, 1);
  const decoded: number[][] = []; const buf = { duration: 1 } as AudioBuffer;
  const out = await decodePrefetched(ctx(async (b) => { decoded.push([...new Uint8Array(b)]); return buf; }), pre, ['aac', 'opus'], fetchImpl, never);
  assert.equal(out, buf); assert.deepEqual(decoded, [[1, 2, 3]]); assert.equal(urls.length, 1, 'decoding at unlock makes no network request');
  await decodePrefetched(ctx(async () => buf), pre, ['aac', 'opus'], fetchImpl, never); assert.equal(urls.length, 1, 'the same prefetch can be decoded on a second context');
});
test('bytes the browser cannot decode fall back to the OTHER format over the network; no bytes fall back to the normal load', async () => {
  const urls: string[] = []; const fetchImpl: typeof fetch = async (u) => { urls.push(String(u)); return ok([9]); };
  const pre = prefetchSprite(['aac', 'opus'], fetchImpl, never); const buf = { duration: 2 } as AudioBuffer; let calls = 0;
  const out = await decodePrefetched(ctx(async () => { if (calls++ === 0) throw new Error('bad aac'); return buf; }), pre, ['aac', 'opus'], fetchImpl, never);
  assert.equal(out, buf); assert.equal(urls.length, 2); assert.match(urls[0]!, /sprite\.m4a/); assert.match(urls[1]!, /sprite\.ogg/);
  const failing: typeof fetch = async () => { throw new TypeError('offline'); }; const none = prefetchSprite(['aac', 'opus'], failing, never); assert.equal(await none, null);
  assert.equal(await decodePrefetched(ctx(async () => buf), none, ['aac', 'opus'], failing, never), null, 'still offline: null, the synth fallback plays');
});
test('prefetch never starts a second codec once the page is unloading', async () => {
  let unloading = false; let n = 0; const fetchImpl: typeof fetch = async () => { n++; unloading = true; throw new TypeError('Load cancelled'); };
  assert.equal(await prefetchSprite(['opus', 'aac'], fetchImpl, () => unloading), null); assert.equal(n, 1);
});
