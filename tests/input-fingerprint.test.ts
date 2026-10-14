// What the control layer maps its inputs to, fingerprinted: every cut push, slash slide and guard slide (with each held side) over a fine grid, plus the timing and sprint thresholds.
// The digest is pinned BEFORE the thresholds (src/fight/input.ts) became rows (src/fight/input-rows.json), so a change to any of them, or to the mapping, fails here. INPUT_PRINT=1 prints the digest instead of asserting it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { CUT_PUSH, GUARD_DEAD_BAND_DEG, GUARD_SLIDE_PX, HOLD_MS, SLASH_DECIDE_MS, SLASH_SLIDE_PX, SPRINT_PUSH, cutAction, cutSideOf, guardSide, slashSlide } from '../src/fight/input.ts';
import type { Direction } from '../src/fight/moves.ts';

const GOLDEN = '5ace91b82b3b56d660c9681ea479b587b7162628b1e70737cd0caddde3b9eb7c';   // computed twice on HF at f07537365 (the unchanged thresholds)

test('every input maps to the same intent as before the thresholds became rows', () => {
  const hash = createHash('sha256');
  hash.update(JSON.stringify([CUT_PUSH, GUARD_DEAD_BAND_DEG, GUARD_SLIDE_PX, HOLD_MS, SLASH_DECIDE_MS, SLASH_SLIDE_PX, SPRINT_PUSH]));
  for (let i = -100; i <= 100; i++) { const lateral = i / 100, a = cutAction(lateral); hash.update(`${lateral}:${a}:${cutSideOf(a)};`); }
  for (let dx = -60; dx <= 60; dx += 0.5) hash.update(`${dx}:${slashSlide(dx)};`);
  const held: (Direction | null)[] = [null, 'left', 'right', 'overhead', 'low'];
  for (const h of held) for (let dx = -60; dx <= 60; dx++) for (let dy = -60; dy <= 60; dy++) hash.update(`${h}:${dx}:${dy}:${guardSide(dx, dy, h)};`);
  const digest = hash.digest('hex');
  if (process.env.INPUT_PRINT) console.log(`INPUT_DIGEST ${digest}`);
  else assert.equal(digest, GOLDEN);
});
