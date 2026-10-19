// The zone's painted horizon dome (origins/preview/horizon-dome.ts): the pure parts. The canvas painting and the mesh are browser-only (stills check them).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { ridgeProfile, smokeColumns } from '../origins/preview/horizon-dome.ts';
import { goblinRule, zoneSky } from '../origins/world/goblin-field-rules.ts';

test('the ridge profile is the same line for the same seed, spans 0..1, and closes at the seam', () => {
  const seed = goblinRule('ridgeSeed'), a = ridgeProfile(seed, 256);
  assert.deepEqual(ridgeProfile(seed, 256), a);
  assert.equal(Math.min(...a), 0);
  assert.equal(Math.max(...a), 1);
  assert.notDeepEqual(ridgeProfile(seed + 1, 256), a, 'the far ridge is another line');
  assert.ok(Math.abs(a[0]! - a[255]!) < 0.05, 'whole periods per turn: the last sample is next to the first');
  assert.deepEqual([a[0], a[128], a[255]].map((v) => Math.round(v! * 1e6) / 1e6), [0.574415, 0.545927, 0.532321], 'the skyline is pinned: every dome in this seed paints this line');
});

test('the smoke columns are the row count of fractions in [0, 1), the same for the same seed', () => {
  const seed = goblinRule('ridgeSeed'), n = goblinRule('smokeColumns'), c = smokeColumns(seed, n);
  assert.equal(c.length, n);
  assert.ok(c.every((x) => x >= 0 && x < 1));
  assert.deepEqual(smokeColumns(seed, n), c);
});

test('a zone that names no sky has no dome (Zone 1 builds nothing); a zone that names the fortress sky gets its palette row', () => {
  assert.equal(zoneSky({ world: [], fields: {} }), null);
  const sky = zoneSky({ world: [], fields: { 'look.sky': 'fortress' }, set: ['look.sky'] });
  assert.equal(sky?.id, 'fortress');
  assert.equal(sky?.haze, 'goblin-fortress');
});
