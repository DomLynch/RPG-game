// CS31 styles (Combat sandbox @93b1138c7): the ready and hurt pose styles and plainPosture are rows, all OFF by default.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HURT_STYLES, PLAIN_POSTURE, READY_STYLES, pickStyle } from '../src/fight/character-style-rows.ts';

test('the sandbox rows are here with their values, and plainPosture is on (RV79 rows, as the sandbox had it)', () => {
  assert.deepEqual(READY_STYLES.map((r) => [r.id, r.s1, r.s2, r.s3, r.neck]), [['1', -120, -120, -80, -100], ['2', -220, -200, -140, -160], ['3', -320, -280, -200, -220]]);
  assert.deepEqual(HURT_STYLES.map((r) => [r.id, r.weight, r.s1, r.s2, r.twist]), [['1', 350, -160, -140, 0], ['2', 450, -50, -60, 350], ['3', 250, -220, -200, -120]]);
  assert.equal(PLAIN_POSTURE, true, 'the sandbox shipped plainPosture 1: no procedural posture on top of the recorded clips');
});

test('?ready= and ?hurt= pick a row; no query, another key or an unknown id is today\'s pose', () => {
  assert.equal(pickStyle(READY_STYLES, 'ready', '?ready=2')?.s1, -220);
  assert.equal(pickStyle(HURT_STYLES, 'hurt', '?zone=90&hurt=3')?.twist, -120);
  assert.equal(pickStyle(READY_STYLES, 'ready', ''), undefined);
  assert.equal(pickStyle(READY_STYLES, 'ready', '?hurt=1'), undefined, 'the other style\'s key does not pick');
  assert.equal(pickStyle(HURT_STYLES, 'hurt', '?hurt=9'), undefined);
});

test('every style is a bounded lean (radians per mille, under half a radian)', () => {
  for (const r of READY_STYLES) for (const v of [r.s1, r.s2, r.s3, r.neck]) assert.ok(Math.abs(v) <= 500, `ready ${r.id}`);
  for (const r of HURT_STYLES) { assert.ok(r.weight >= 0 && r.weight <= 1000, `hurt ${r.id} weight is a per-mille share`); for (const v of [r.s1, r.s2, r.twist]) assert.ok(Math.abs(v) <= 500, `hurt ${r.id}`); }
});
