// The Pit's arena stills (Lead 2026-09-30, Dom's phone test item 1): behind the gate the player sees the arena of his next fight. One 496 x 608
// WebP per arena theme (scripts/pit-arena-stills.mjs), so a still with no arena fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ARENA_THEMES } from '../src/arena-themes.ts';

const dir = new URL('../public/pit/arena/', import.meta.url);

test('every arena still is a 496 x 608 lossy WebP still under 60 KB, and nothing else is in the folder', () => {
  const files = readdirSync(dir).sort();
  // Nothing in src loads these any more (the Pit is a live stage, scene.ts pitStage), so arenas 4-11 ship without one (Lead 2026-10-06: no unused assets). The shipped set is pinned
  // exactly: adding or dropping a still is a deliberate change here, and a still with no arena fails.
  assert.deepEqual(files, ['1', '2', '3', 'a', 'b', 'c', 'd'].map((k) => `${k}.webp`), 'the shipped stills');
  assert.deepEqual(files.filter((f) => !(f.slice(0, -5) in ARENA_THEMES)), [], 'a still with no arena');
  for (const file of files) {
    const b = readFileSync(new URL(file, dir));
    assert.equal(b.toString('latin1', 0, 4), 'RIFF', `${file}: RIFF`); assert.equal(b.toString('latin1', 8, 12), 'WEBP', `${file}: WEBP`);
    const chunks: string[] = [];   // Chromium's encoder writes VP8X (canvas size), ICCP (sRGB) and one VP8 chunk; sharp (the crop) writes the bare VP8 chunk: a lossy still, no alpha either way
    for (let p = 12; p < b.length;) { const n = b.readUInt32LE(p + 4); chunks.push(b.toString('latin1', p, p + 4)); p += 8 + n + (n & 1); }
    assert.equal(chunks.at(-1), 'VP8 ', `${file}: a lossy (VP8) still, chunks ${chunks}`); assert.ok(!chunks.includes('ALPH'), `${file}: opaque`);
    const size = chunks[0] === 'VP8X' ? [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)] : [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];   // VP8X canvas size, or the VP8 frame header's 14-bit width and height
    assert.deepEqual(size, [496, 608], `${file}: 496 x 608, the Pit's 2.2 x 2.7 m plane (the gate opening 1.8 x 2.3 m + 0.4)`);
    assert.ok(b.length < 60_000, `${file}: ${b.length} B`);
  }
});
