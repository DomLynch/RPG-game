// The goblin field's ground recipes and a zone's ambient bed (Test Zone B2a): the ground rows load and are refused when broken; a zone asks for a ground or an ambience by field; the wind and crackle maths is pinned.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import DEFS from '../origins/world/goblin-field-defs.json' with { type: 'json' };
import { loadGoblinField, zoneAmbience, zoneGround } from '../origins/world/goblin-field-rules.ts';
import { ambienceRow } from '../origins/world/props-rules.ts';
import { fireGain, windAt } from '../origins/preview/ambience.ts';

type Ground = Record<string, unknown> & { id: string };
const d = DEFS as unknown as { grounds: Ground[] } & Record<string, unknown>;
const zone = (fields: Record<string, unknown>) => ({ fields, set: Object.keys(fields), world: ['a'] });

test('the ground rows load; a zone names one by look.ground.material; an id with no row, or an unset field, leaves the Frontier dirt', () => {
  assert.deepEqual(d.grounds.map((g) => g.id), ['fortress-ground', 'cinder-ash', 'meadow']);
  assert.equal(zoneGround(zone({ 'look.ground.material': 'fortress-ground' }))!.tileM, 4);
  assert.equal(zoneGround(zone({ 'look.ground.material': 'ash' })), null); assert.equal(zoneGround({ world: [] }), null);
  assert.equal(zoneGround({ fields: { 'look.ground.material': 'meadow' }, set: [], world: [] }), null, 'a field the zone did not SET is not read');
});
test('the loader refuses a bad ground colour, a non-positive number and a tile over the size bound', () => {
  const bad = (patch: Record<string, unknown>, re: RegExp) => assert.throws(() => loadGoblinField({ ...d, grounds: d.grounds.map((g, i) => (i ? g : { ...g, ...patch })) } as never), re);
  bad({ base: 'brown' }, /hex is #rrggbb/); bad({ bump: 0 }, /a number > 0/); bad({ texN: 4096 }, /texN is a whole number up to 2048/); bad({ texN: 100.5 }, /texN is a whole number/);
});
test('a zone names its ambience row by sound.ambience; an id with no row stays silent', () => {
  assert.equal(zoneAmbience(zone({ 'sound.ambience': 'fortress-wind' })), ambienceRow('fortress-wind'));
  assert.equal(zoneAmbience(zone({ 'sound.ambience': 'wind' })), null); assert.equal(zoneAmbience({ world: [] }), null);
});
test('the wind drifts around its centre and the crackle falls off squared to zero at fireRange', () => {
  const a = ambienceRow('fortress-wind')!;
  for (let t = 0; t < 30; t += 0.7) { const w = windAt(t, a); assert.ok(Math.abs(w.freq - a.windFreq) <= a.windSweepDepth + 1e-9 && w.gain > 0 && w.gain <= a.windGain + 1e-9); }
  assert.equal(fireGain(0, a), a.crackleGain); assert.equal(fireGain(a.fireRange, a), 0); assert.equal(fireGain(a.fireRange * 3, a), 0); assert.ok(fireGain(a.fireRange / 2, a) < fireGain(a.fireRange / 4, a));
});
