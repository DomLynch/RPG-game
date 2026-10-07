// The zone rules (zone-rules.ts): each has a failing sketch that yields exactly its code and names the zone; a good zone passes; a generated zone is held to
// the same rules by the schema (zone size) and by populateZone (opener, no dead stretch).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateZone, type Template } from './generate.ts';
import { MAX_ACROSS_M, MAX_FIRST_FIGHT_M, MAX_HOP_M, RUN_SPEED, checkZone, worstHop, type ZoneSketch } from './zone-rules.ts';

const ok: ZoneSketch = { name: 'ash-yard', width: 100, depth: 120, entry: { x: 50, z: 0 }, stops: [{ x: 50, z: 60 }, { x: 80, z: 110 }], creatures: [{ x: 50, z: 30 }, { x: 70, z: 85 }], safe: false };
const codes = (z: ZoneSketch) => checkZone(z).map((i) => i.code);

test('the numbers are the Run knot times the seconds: 234 m across, 78 m between things, 52 m to the first fight', () => {
  assert.equal(RUN_SPEED, 5.2);
  assert.ok(Math.abs(MAX_ACROSS_M - 234) < 1e-9 && Math.abs(MAX_HOP_M - 78) < 1e-9 && Math.abs(MAX_FIRST_FIGHT_M - 52) < 1e-9);
});

test('a good zone passes; each rule has a failing zone that names itself', () => {
  assert.deepEqual(checkZone(ok), []);
  const wide = { ...ok, name: 'the-long-waste', width: 240, stops: [{ x: 100, z: 60 }, { x: 150, z: 120 }, { x: 200, z: 180 }], creatures: [{ x: 50, z: 30 }, { x: 120, z: 90 }, { x: 170, z: 150 }, { x: 220, z: 200 }] };
  assert.deepEqual(codes(wide), ['zone-too-wide']);
  assert.match(checkZone(wide)[0]!.message, /^the-long-waste: /, 'the message names the zone');
  const dead = { ...ok, name: 'the-empty-mile', depth: 200, stops: [{ x: 50, z: 60 }], creatures: [{ x: 50, z: 30 }] };   // the next thing is 140 m on
  dead.stops.push({ x: 50, z: 200 });
  assert.deepEqual(codes(dead), ['dead-stretch']);
  assert.equal(checkZone(dead)[0]!.zone, 'the-empty-mile');
  const late = { ...ok, name: 'the-quiet-gate', creatures: [{ x: 50, z: 70 }, { x: 70, z: 95 }] };   // first creature 70 m from the entry
  assert.deepEqual(codes(late), ['late-fight']);
  assert.deepEqual(codes({ ...late, creatures: [] , stops: ok.stops }), ['late-fight'], 'no creature at all in an unsafe zone');
});

test('a safe zone (a town) needs no fight, but is still held to size and dead stretches', () => {
  const town = { ...ok, name: 'cinder-hold', safe: true, creatures: [] };
  assert.deepEqual(codes(town), []);
  assert.deepEqual(codes({ ...town, width: 300, stops: [{ x: 100, z: 30 }, { x: 150, z: 60 }, { x: 200, z: 90 }, { x: 250, z: 100 }, { x: 290, z: 100 }] }), ['zone-too-wide']);
});

test('worstHop: points within 78 m of one another are one chain from the entry; the gap is the shortest bridge to what is cut off', () => {
  const hop = worstHop({ x: 0, z: 0 }, [{ x: 0, z: 10 }, { x: 0, z: 100 }, { x: 0, z: 20 }, { x: 0, z: 300 }])!;
  assert.deepEqual([hop.d, hop.to.z], [80, 100], '0, 10 and 20 are one chain; 20 to 100 is 80 m, over the limit, so 100 and 300 are cut off and the shortest bridge is 80');
  assert.equal(worstHop({ x: 0, z: 0 }, [{ x: 0, z: 70 }, { x: 0, z: 140 }]), null, 'two 70 m hops are fine');
  assert.equal(worstHop({ x: 0, z: 0 }, []), null);
});

test('the schema refuses a zone over 45 s across, in metres (so a rescale cannot sneak one through)', () => {
  const T: Template = { base: { layout: { entry: { u: 0.5, v: 0.05, facing: 180 } } }, vary: {}, jitter: 0 };
  assert.ok(generateZone(T, 1, { zoneSize: { width: 230, depth: 200 } }).ok, '230 m is fine');
  const wide = generateZone(T, 1, { zoneSize: { width: 240, depth: 200 } });
  assert.ok(!wide.ok);
  assert.ok(!wide.ok && wide.issues.some((i) => i.path === 'zoneSize.width' && /45 s/.test(i.message)));
  const scaled = generateZone(T, 1, { scale: { metresPerUnit: 2 }, zoneSize: { width: 120, depth: 100 } });
  assert.ok(!scaled.ok, '120 u at 2 m a unit is 240 m');
});
