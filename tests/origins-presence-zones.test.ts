// Which Concord zone a presence position is in (origins/presence/zones.ts): computed from x, z in the one Concord frame, never from a client.
// Presence is centimetres in the 300 m town square; Concord is metres with the Pit yard's centre at the origin, so world (0, 0) is presence (15000, 15000).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CENTRE_CM, worldMetres, zoneAt } from '../origins/presence/zones.ts';
import { landmarkAt } from '../origins/presence/fixtures.ts';
import { CONCORD, CONCORD_REGION } from '../origins/world/concord.ts';

const cm = (wx: number, wz: number): [number, number] => [CENTRE_CM + wx * 100, CENTRE_CM + wz * 100];   // world metres to a presence position

test('zones: the Pit yard is 50 x 50 m around the origin, the Exchange 40 x 50 m beyond its far edge, and everything else is null', () => {
  assert.deepEqual(worldMetres(15000, 15000), { x: 0, z: 0 }, 'the frame offset: presence centre is world origin');
  assert.equal(zoneAt(...cm(0, 0)), 'pit-yard', 'the Pit yard centre');
  assert.equal(zoneAt(...cm(24.9, 24.9)), 'pit-yard', 'inside a corner of the yard');
  assert.equal(zoneAt(...cm(-24.9, -24.9)), 'pit-yard');
  assert.equal(zoneAt(...cm(25.2, 0)), null, 'just past the yard\'s side');
  assert.equal(zoneAt(...cm(0, 25.2)), null, 'just past the yard\'s back edge');
  assert.equal(zoneAt(...cm(0, -40)), 'exchange', 'the Exchange, the covenant stone is near here');
  assert.equal(zoneAt(...cm(19.9, -74.9)), 'exchange', 'inside a far corner of the Exchange');
  assert.equal(zoneAt(...cm(-19.9, -25.1)), 'exchange', 'just inside its entry edge');
  assert.equal(zoneAt(...cm(20.2, -50)), null, 'past the Exchange\'s side (it is 40 m wide, the Pit 50)');
  assert.equal(zoneAt(...cm(0, -75.2)), null, 'past the Exchange\'s far edge');
  assert.equal(zoneAt(...cm(23, -26)), null, 'beside the Exchange\'s entry: the yard is wider than the Exchange');
  assert.equal(zoneAt(100, 100), null, 'a far corner of the town square');
});

test('zones: the shared edge belongs to the Pit yard and a position can never be in two zones', () => {
  assert.equal(zoneAt(...cm(0, -25)), 'pit-yard', 'on the yard\'s far edge, which is also the Exchange\'s entry edge: the first zone wins');
  let both = 0;
  for (let x = -40; x <= 40; x += 0.5) for (let z = -90; z <= 40; z += 0.5) if (zoneAt(...cm(x, z)) === 'pit-yard' && x > -20 && x < 20 && z < -25.01) both++;
  assert.equal(both, 0, 'no point past the shared edge is in the yard');
});

// X1 (Lead, 2026-10-07): the trade area IS the whole exchange zone, so every Exchange service must stand inside it and the Pit-yard spawn outside it.
test('zones: every Exchange service landmark lies in zone exchange; the Pit-yard spawn (its centre) does not', () => {
  const layout = Object.keys(CONCORD.regions[CONCORD_REGION]?.zones.exchange?.layout ?? {});
  const services = layout.filter(name => name !== 'outer-gate');   // the gate is the way in, not a service: it sits ON the shared edge, which the yard owns
  assert.deepEqual(services.sort(), ['bank', 'contract-board', 'covenant-stone', 'forge'], 'the Exchange services this test covers (a new landmark must be added here)');
  for (const name of services) assert.equal(zoneAt(...landmarkAt('exchange', name)), 'exchange', `the ${name} is inside the Exchange zone`);
  assert.equal(zoneAt(...landmarkAt('exchange', 'outer-gate')), 'pit-yard', 'the outer gate is on the shared edge, which belongs to the yard: standing in the gateway is not the Exchange');
  assert.equal(zoneAt(...landmarkAt('pit-yard', 'centre')), 'pit-yard', 'the Pit-yard spawn is outside the Exchange');
  assert.equal(zoneAt(...landmarkAt('pit-yard', 'pit-gate')), 'pit-yard', 'so is the yard end of the gladiator gate');
});
