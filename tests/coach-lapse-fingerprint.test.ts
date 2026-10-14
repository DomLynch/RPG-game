// The coach's lapse bounds (coach-lapse-min / coach-lapse-max, src/present-rows.json) feed the AI profile the coach plays with: every stance x level x foe profile, hashed.
// The digest was computed at the code BEFORE the bounds became rows, so a change to either bound, or to the clamp, fails here. COACH_PRINT=1 prints the digest instead of asserting it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { FOE_LAPSE, FOE_LAPSE_SCALE, coachProfile } from '../src/coach.ts';
import { PROFILES, type Level } from '../src/fight/moves.ts';
import type { PickedStance } from '../src/fight/stance.ts';

const GOLDEN = '5fa9f9cedb62229a76462e29d00cadf05e7973a5278f8132907d6830cce81326';   // computed twice on the VPS at cfc2abd63 (the unchanged bounds)

test('every coach profile is exactly what it was before the lapse bounds became rows', () => {
  const hash = createHash('sha256');
  for (const stance of Object.keys(FOE_LAPSE_SCALE) as PickedStance[]) for (const level of Object.keys(PROFILES) as Level[]) for (const foe of [undefined, ...Object.keys(FOE_LAPSE), 'no-such-foe']) hash.update(JSON.stringify([stance, level, foe ?? null, coachProfile(stance, level, foe)]));
  const digest = hash.digest('hex');
  if (process.env.COACH_PRINT) console.log(`COACH_DIGEST ${digest}`);
  else assert.equal(digest, GOLDEN);
});
