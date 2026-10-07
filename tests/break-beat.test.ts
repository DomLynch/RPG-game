import test from 'node:test';
import assert from 'node:assert/strict';
import { BREAK_HOLD_MS, breakBeatFrom } from '../src/break-beat.ts';
import { cuesFor } from '../src/audio/cues.ts';
import type { CombatEvent } from '../src/combat.ts';

test('the break beat is a look test: absent = today (120 ms, no thud)', () => {
  assert.equal(BREAK_HOLD_MS, 120);
  assert.equal(breakBeatFrom(''), null);
  assert.equal(breakBeatFrom('?look=armfeel'), null);
  assert.equal(breakBeatFrom('?look=breakbeatx'), null);
});

test('?look=breakbeat holds 150 ms, ?look=breakbeat120|150|180 pick it, every variant has the thud', () => {
  assert.deepEqual(breakBeatFrom('?look=breakbeat'), { holdMs: 150, thud: true });
  assert.deepEqual(breakBeatFrom('?x=1&look=breakbeat180&y=2'), { holdMs: 180, thud: true });
  assert.deepEqual(breakBeatFrom('?look=breakbeat120'), { holdMs: 120, thud: true });
  assert.equal(breakBeatFrom('?look=breakbeat200'), null);
});

test('the thud is the existing bone_crack on a PostureBroken, only with the flag', () => {
  const broken = [{ tick: 10, type: 'PostureBroken', actor: 0, target: 1 } as CombatEvent];
  assert.deepEqual(cuesFor(broken).filter((c) => c.name === 'bone_crack'), []);
  const thud = cuesFor(broken, undefined, undefined, [], undefined, true).filter((c) => c.name === 'bone_crack');
  assert.equal(thud.length, 1);
  assert.ok(thud[0].gain > 0 && thud[0].room <= 0.1, 'dry: a short room send');
});
