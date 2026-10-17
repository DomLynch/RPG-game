// The per-zone presence fields are rows: the town's (town-zones.json) and each zone package's `presence` block, by world-zone name. Today's launch values hold: 1.0 everywhere, the Pit quiet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONE_ROWS, zoneFields } from './zones.ts';

test('launch values: speed 1 everywhere and the Pit the only quiet zone', () => {
  for (const z of ZONE_ROWS) assert.deepEqual([z.id, z.speed, z.quiet], [z.id, 1, z.id === 'pit-yard']);
});

test('zoneFields: a package block sets its world zones, the town rows come first, and a name given twice is refused', () => {
  const f = zoneFields([{ id: 'pit-yard', quiet: true }], [{ presence: { 'cinder-fields': { speed: 1.2 }, 'east-road': { quiet: true } } }, {}]);
  assert.deepEqual(f.get('cinder-fields'), { speed: 1.2, quiet: undefined });
  assert.equal(f.get('east-road')?.quiet, true);
  assert.equal(f.get('pit-yard')?.quiet, true);
  assert.equal(f.get('nowhere'), undefined, 'a zone with no row keeps the defaults');
  assert.throws(() => zoneFields([{ id: 'pit-yard', quiet: true }], [{ presence: { 'pit-yard': { speed: 2 } } }]), /given twice/);
  assert.throws(() => zoneFields([], [{ presence: { a: {} } }, { presence: { a: {} } }]), /given twice/);
});
