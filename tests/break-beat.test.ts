import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cuesFor } from '../src/fight/sound/cues.ts';
import type { CombatEvent } from '../src/combat.ts';

// Strategy's ruling 2026-10-07 (Dom delegated): the posture-break beat ships as ?look=breakbeat150 did, flag removed. Re-pinned from 120 ms and no thud.
test('a PostureBroken holds the frame 150 ms (was 120)', () => {
  assert.match(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), /PostureBroken: 150,/);
});

test('the break always has the dry thud: the existing bone_crack, a short room send', () => {
  const thud = cuesFor([{ tick: 10, type: 'PostureBroken', actor: 0, target: 1 } as CombatEvent]).filter((c) => c.name === 'bone_crack');
  assert.equal(thud.length, 1);
  assert.ok(thud[0].gain > 0 && thud[0].room <= 0.1, 'dry: a short room send');
});
