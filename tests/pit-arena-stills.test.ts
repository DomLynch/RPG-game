// The Pit's arena stills (Lead 2026-09-30, Dom's phone test item 1): behind the gate the player sees the arena of his next fight. One 512 x 608
// WebP per arena theme (scripts/pit-arena-stills.mjs), so a new arena without its still, or a still with no arena, fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ARENA_THEMES } from '../src/arena-themes.ts';

const dir = new URL('../public/pit/arena/', import.meta.url);

test('every arena theme has exactly one 512 x 608 lossy WebP still under 60 KB, and nothing else is in the folder', () => {
  const files = readdirSync(dir).sort();
  assert.deepEqual(files, Object.keys(ARENA_THEMES).map((k) => `${k}.webp`).sort(), 'one still per arena key');
  for (const file of files) {
    const b = readFileSync(new URL(file, dir));
    assert.equal(b.toString('latin1', 0, 4), 'RIFF', `${file}: RIFF`); assert.equal(b.toString('latin1', 8, 12), 'WEBP', `${file}: WEBP`);
    const chunks: string[] = [];   // Chromium's encoder writes VP8X (canvas size), ICCP (sRGB) and one VP8 chunk: a lossy still, no alpha
    for (let p = 12; p < b.length;) { const n = b.readUInt32LE(p + 4); chunks.push(b.toString('latin1', p, p + 4)); p += 8 + n + (n & 1); }
    assert.equal(chunks.at(-1), 'VP8 ', `${file}: a lossy (VP8) still, chunks ${chunks}`); assert.ok(!chunks.includes('ALPH'), `${file}: opaque`);
    assert.deepEqual([1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)], [512, 608], `${file}: 512 x 608, the Pit's 2.6 x 3.1 m plane`);
    assert.ok(b.length < 60_000, `${file}: ${b.length} B`);
  }
});
