// The creature card reads the cheap `seen()` list every 0.2 s; the mobs view's debug() (a skinned bounding box and vertex scans per creature, the browser checks' diagnostic) was called there until 2026-10-20 and was ~40% of the
// Zone 1 main thread in a T4 CPU profile (SkinnedMesh.getVertexPosition under debug() under the walk loop's step). This pins that the page never calls debug() on its own clock; only the originsPreview hook (browser checks) does.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');

test('the Zone 1 page never calls the mobs view\'s debug() except through the originsPreview hook', () => {
  const calls = [...main.matchAll(/mobs\??\.debug\(\)/g)];
  assert.equal(calls.length, 1, 'one call: the browser-check hook');
  const at = calls[0]!.index!;
  assert.match(main.slice(Math.max(0, at - 40), at), /mobs: \(\) => $/, 'it is the `mobs: () =>` hook of originsPreview, not a frame-clock read');
});

test('the creature card is fed from seen()', () => {
  assert.match(main, /const seen = mobs\.seen\(\)/);
});
