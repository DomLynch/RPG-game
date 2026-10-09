// Merge-order pin (Auditor, #1710 PASS condition): #1749/#1756 made the walking Ash Wolf WOLF_RENDER_SCALE (src/beast-scale.ts); this branch's look says 1.
// Whichever lands second must keep WOLF_RENDER_SCALE or the walking wolf silently goes back to 1x. Until that file exists the walking wolf is 1x.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { MOB_LOOKS } from './mob-looks.ts';

test('the walking Ash Wolf look is WOLF_RENDER_SCALE when that constant exists (1x before it does)', async () => {
  const file = new URL('../../src/beast-scale.ts', import.meta.url), scale = MOB_LOOKS['character:ash-wolf']!.scale;
  if (!existsSync(file)) return assert.equal(scale, 1, 'no beast-scale.ts yet: the walking wolf is 1x');
  const { WOLF_RENDER_SCALE } = (await import(file.href)) as { WOLF_RENDER_SCALE: number };
  assert.equal(scale, WOLF_RENDER_SCALE, 'the walking wolf must be drawn at the size the duel draws it');
});

test('walking == fighting: the walking Cinder Bear look is BEAR_RENDER_SCALE, the size the duel draws it at (src/beast-scale.ts)', async () => {
  const file = new URL('../../src/beast-scale.ts', import.meta.url), { BEAR_RENDER_SCALE, BEAST_RENDER_SCALE } = (await import(file.href)) as { BEAR_RENDER_SCALE: number; BEAST_RENDER_SCALE: Record<string, number> };
  assert.equal(MOB_LOOKS['character:cinder-bear']!.scale, BEAR_RENDER_SCALE);
  assert.equal(MOB_LOOKS['character:cinder-bear']!.scale, BEAST_RENDER_SCALE.bear, 'the by-roster-id table the duel reads agrees');
});
