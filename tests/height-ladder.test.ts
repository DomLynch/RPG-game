// The creature height ladder (origins/zones/height-ladder.ts): a creature's DRAWN height (body height x drawn scale) may not exceed its zone tier's cap, unless a named exception row lets it through.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { allZoneIds, loadZone, zoneProblems } from '../origins/zones/loader.ts';
import { drawnHeight, heightCap, heightProblems, HEIGHT_LADDER, loadHeightLadder } from '../origins/zones/height-ladder.ts';
import DEFS from '../origins/zones/height-ladder.json' with { type: 'json' };

const zone = (level: number, rows: { id: string; opponent: string; scale?: number }[], id = '1') => ({ id, level, mobLooks: { looks: Object.fromEntries(rows.map((r) => [r.id, { opponent: r.opponent, scale: r.scale }])) }, spawns: { rows: rows.map((r) => ({ id: r.id })) } });

test('Zone 1\'s cap is the cave troll drawn at 1.52, and size is body height x drawn scale', () => {
  assert.deepEqual(heightCap(1), { tier: 'tier-1', capM: 2.644 });
  assert.deepEqual(heightCap(90), { tier: 'tier-1', capM: 2.644 }, 'a level above the last tier keeps the last tier\'s cap');
  assert.ok(Math.abs(drawnHeight('cave-troll', 1.52)! - 2.643) < 0.001);
  assert.ok(drawnHeight('cave-troll', 1.52)! <= heightCap(1).capM, 'the cap is the troll at 1.52 rounded up to the millimetre');
  assert.equal(drawnHeight('nobody'), null, 'a body no row measures has no drawn height');
  assert.ok(Math.abs(drawnHeight('cave-troll')! - 1.739 * 1.9) < 1e-9, 'an omitted scale is the catalogue\'s render.scale (1.9 for the troll today)');
});

test('a creature over its zone\'s cap is refused with a message that says what to do; a named exception lets it through', () => {
  const over = zone(1, [{ id: 'character:big', opponent: 'cave-troll', scale: 2 }]);
  assert.match(heightProblems(over).join(';'), /creature character:big: drawn 3\.47\d* m, over zone 1's cap of 2\.644 m \(tier-1\)/);
  assert.deepEqual(heightProblems(zone(1, [{ id: 'character:troll', opponent: 'cave-troll', scale: 1.52 }])), []);
  const named = { ...HEIGHT_LADDER, exceptions: [{ id: 'x', zone: '1', character: 'character:big', reason: 'test' }] };
  assert.deepEqual(heightProblems(over, named), []);
  assert.match(heightProblems(zone(1, [{ id: 'character:big', opponent: 'cave-troll', scale: 2 }], '2'), named).join(';'), /over zone 1's cap/, 'an exception is for its own zone only');
  assert.deepEqual(heightProblems(zone(1, [{ id: 'character:mystery', opponent: 'unmeasured', scale: 9 }])), [], 'an unmeasured body is not checked');
});

test('every zone on trunk passes the validator with no exception row: Zone 1\'s troll is drawn at 1.52 (the cap) and nothing needs a named exception', () => {
  for (const id of allZoneIds()) assert.deepEqual(zoneProblems(loadZone(id, true)), [], id);
  assert.deepEqual(HEIGHT_LADDER.exceptions, [], 'the troll\'s zone1-troll-catalogue row is gone: #3266 draws the Zone 1 troll at 1.52');
  const z1 = loadZone('1');
  assert.ok(z1.spawns.rows.some((r) => r.id === 'character:cave-troll'), 'the troll is in Zone 1');
  assert.deepEqual(heightProblems(z1), [], 'Zone 1 is within the tier-1 cap');
});

test('the body rows are pinned to their GLBs by hash (run node scripts/body-heights.mjs when a body changes), and length is recorded beside height', () => {
  for (const b of HEIGHT_LADDER.bodies) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../public${b.glb}`, import.meta.url))).digest('hex'), b.sha256, `${b.id}: the GLB changed: re-measure with scripts/body-heights.mjs`);
    assert.ok(b.heightM > 0 && b.lengthM > 0, b.id);
  }
  const sal = HEIGHT_LADDER.bodies.find((b) => b.id === 'giant-salamander')!;
  assert.ok(sal.lengthM > sal.heightM * 3, 'the salamander is long and low: 1.002 m long, 0.319 m high at scale 1');
});

test('the ladder loader refuses a missing Zone 1 tier, a repeated start, a tier that caps lower than the one before, and a body of no height', () => {
  const ok = JSON.parse(JSON.stringify(DEFS)) as { ladder: { id: string; fromZone: number; capM: number }[]; bodies: { id: string; heightM: number; lengthM: number }[]; exceptions: unknown[] };
  assert.doesNotThrow(() => loadHeightLadder(ok));
  assert.throws(() => loadHeightLadder({ ...ok, ladder: [{ id: 't', fromZone: 2, capM: 3 }] }), /first tier starts at Zone 1/);
  assert.throws(() => loadHeightLadder({ ...ok, ladder: [...ok.ladder, { id: 'again', fromZone: 1, capM: 5 }] }), /same zone/);
  assert.throws(() => loadHeightLadder({ ...ok, ladder: [...ok.ladder, { id: 'lower', fromZone: 5, capM: 1 }] }), /may not cap lower/);
  assert.throws(() => loadHeightLadder({ ...ok, ladder: [{ ...ok.ladder[0]!, capM: 0 }] }), /capM is a number > 0/);
  assert.throws(() => loadHeightLadder({ ...ok, bodies: [{ ...ok.bodies[0]!, heightM: 0 }] }), /heightM and lengthM are numbers > 0/);
  assert.equal(loadHeightLadder({ ...ok, ladder: [...ok.ladder, { id: 'tier-2', fromZone: 10, capM: 4 }] }).ladder.length, 2, 'a higher tier is one more row');
});
