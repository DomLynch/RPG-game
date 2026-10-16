import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { readdirSync } from 'node:fs';
import { frontierPlan, FRONTIER } from '../preview/frontier-plan.ts';
import { frontierBuild } from '../preview/frontier-plan.ts';
import { mobSpecs } from '../preview/mobs.ts';
import { JOIN_M } from '../../src/fight/index.ts';
import { AGGRO_M } from '../../src/fight/world.ts';
import { allZoneIds, listedIds, loadZone, pageZoneId, unlistedOpens, zoneFromAddress, zoneIds, zoneProblems, type Zone } from './loader.ts';
import { fieldOf } from '../../src/fight/catalogue-rows.ts';

type Mut<T> = T extends readonly (infer U)[] ? Mut<U>[] : T extends object ? { -readonly [K in keyof T]: Mut<T[K]> } : T;
const clone = (z: Zone): Mut<Zone> => JSON.parse(JSON.stringify(z));

test('Zone 1 loads: level 1, seven rows of [1, 2] and the named Cave Troll at 3 (zone level + namedLevelLift), every opener a row, the kit and looks valid', () => {
  const z = loadZone();
  assert.equal(z.id, '1'); assert.equal(z.level, 1); assert.equal(z.spawns.rows.length, 9);   // seven + the Giant Salamander (a weighted entry in the brood camp) + the Cave Troll
  assert.deepEqual(z.spawns.rows.filter((r) => r.named).map((r) => [r.id, ...r.level]), [['character:cave-troll', 3, 3]]);
  assert.deepEqual(zoneProblems(z), []);
  assert.equal(loadZone('1'), z, 'cached: the same package');
  assert.throws(() => loadZone('99'), /no zone 99/);
});

test('the validator names each way a package can be wrong', () => {
  const z = loadZone(), edit = (f: (c: Mut<Zone>) => void) => { const c = clone(z); f(c); return zoneProblems(c as unknown as Zone).join('|'); };
  assert.match(edit((c) => { c.spawns.rows[1]!.id = c.spawns.rows[0]!.id; }), /duplicate row/);
  assert.match(edit((c) => { c.spawns.rows[0]!.level = [2, 3]; }), /not the zone rule 1-2/);
  assert.equal(edit((c) => { c.spawns.rows[0]!.level = [1, 1]; }), '', 'a row may be narrower than the zone band (the level-1 Pit goblin camp)');
  assert.match(edit((c) => { c.spawns.rows[0]!.level = [1, 3]; }), /not the zone rule 1-2/);
  assert.match(edit((c) => { c.spawns.openers['x'] = 'character:nobody'; }), /not a row/);
  assert.match(edit((c) => { c.kit.kinds[0]!.nodes = ['no_such_node']; }), /not a kit node/);
  assert.match(edit((c) => { c.kit.landmarks.push(c.kit.nodes[0]!); }), /both a node and a landmark/);
  assert.match(edit((c) => { c.kit.url = '/elsewhere.glb'; }), /kit url/);
  assert.match(edit((c) => { c.looks['frontier-haze']!.fog = 'red'; }), /not #rrggbb/);
  assert.match(edit((c) => { c.looks['frontier-haze']!.exposure = 9; }), /out of range/);
});

test('a page address names its zone: /zone/<id>/ or ?zone=<id>, else Zone 1; allZoneIds lists every package, zoneIds every listed one', () => {
  const rows = readdirSync('origins/zone-rows').flatMap((f) => /^zone([1-9][0-9]*)\.row\.json$/.exec(f)?.[1] ?? []).sort((a, b) => Number(a) - Number(b));
  assert.deepEqual(allZoneIds(), rows);   // every row, and no more (a new zone row adds no line here)
  assert.deepEqual(zoneIds(), rows.filter((id) => !loadZone(id, true).unlisted), 'no page: every row but the unlisted ones');
  assert.equal(zoneFromAddress('/zone1/', ''), '1');
  assert.equal(zoneFromAddress('/preview/origins/', '?region=1'), '1');
  assert.equal(zoneFromAddress('/zone/2/', ''), '2');
  assert.equal(zoneFromAddress('/zone/2', '?zone=3'), '2', 'the path wins');
  assert.equal(zoneFromAddress('/zone1/', '?zone=2&x=1'), '2');
  assert.equal(pageZoneId(), '1', 'no page (the server, the tests): Zone 1');
  assert.throws(() => loadZone(zoneFromAddress('/zone/99/', '')), /no zone 99/);
});

test('Zone 2 loads: level 2, six rows of [2, 3], the opener a row, its own looks', () => {
  const z = loadZone('2');
  assert.equal(z.id, '2'); assert.equal(z.level, 2); assert.equal(z.spawns.rows.length, 6);
  assert.deepEqual(zoneProblems(z), []);
  assert.equal(z.spawns.openers['ash-reach'], 'character:ember-wolf');
  assert.notEqual(z.looks['frontier-haze']!.fog, loadZone('1').looks['frontier-haze']!.fog, 'its own haze');
  assert.deepEqual(Object.keys(z.looks), Object.keys(loadZone('1').looks), 'the preset names the page asks for');
});

test('each zone walks its own world zones: Zone 1 is the Frontier as it was, Zone 2 is the Ash Reach alone with its own creatures', () => {
  const frontier = (id: string) => frontierPlan(false, id).zones.filter((q) => q.region === FRONTIER).map((q) => q.zone).sort();
  assert.deepEqual(frontier('1'), [...loadZone('1').world].sort());
  assert.deepEqual(frontier('2'), ['ash-reach']);
  const plan = frontierPlan(false, '2');
  assert.deepEqual(plan.zones.find((q) => q.zone === 'ash-reach')!.links, [], 'its road to the east road is not walked on this page');
  const specs = mobSpecs(plan, frontierBuild(plan), loadZone('2').spawns.rows);
  assert.ok(specs.length >= 4 && specs.every((m) => m.zone === 'ash-reach'), 'creatures stand in the Ash Reach only');
  assert.ok(specs.every((m) => m.level >= 2 && m.level <= 3), 'at the Zone 2 band');
  assert.ok(specs.every((m) => m.id.startsWith('z2:')), 'Zone 2 instance ids carry the z2: prefix (the server keys a creature by its id alone, Backend 10-09)');
  const wolves = specs.filter((m) => m.character === 'character:ember-wolf');
  assert.ok(wolves.length >= 2 && wolves.every((m) => fieldOf(m.body, 'firstSight') && /^z2:(reach-wolves|reach-pack-[ab]|opener-ash-reach)-\d+$/.test(m.id)), 'the Ember Wolves are on the wolf body and their ids are z2:-prefixed (the cairn pair, the ruin camp and the zone opener)');
  assert.ok(mobSpecs(frontierPlan(false, '1'), frontierBuild(frontierPlan(false, '1'))).every((m) => !m.id.includes(':')), 'Zone 1 ids are unchanged');
  assert.equal(mobSpecs(frontierPlan(false, '1'), frontierBuild(frontierPlan(false, '1'))).some((m) => m.zone === 'ash-reach'), false);
});

test('a zone\'s mobLooks are checked: an unknown body, a tint or a scale out of range is named', () => {
  const z = loadZone(), ok = { looks: { 'character:x': { opponent: 'wolf', tint: 0x8a4a32, scale: 1.1, dressing: { soot: .1, burnt: .5 } } }, spread: { 'character:x': { tints: [0x7a4030], scale: .08, soot: .1, burnt: .1 } } };
  const edit = (f: (m: Mut<NonNullable<Zone['mobLooks']>>) => void) => { const c = clone(z), m = JSON.parse(JSON.stringify(ok)); f(m); c.mobLooks = m; return zoneProblems(c as unknown as Zone).join('|'); };
  assert.equal(edit(() => {}), '', 'a valid entry passes');
  assert.match(edit((m) => { m.looks['character:x']!.opponent = 'dragon'; }), /dragon is not a roster body/);
  assert.match(edit((m) => { m.looks['character:x']!.tint = -1; }), /tint is not a 0xrrggbb number/);
  assert.match(edit((m) => { m.looks['character:x']!.scale = 9; }), /scale 9 is out of range/);
  assert.match(edit((m) => { m.looks['character:x']!.dressing.burnt = 2; }), /soot\/burnt must be 0\.\.1/);
  assert.match(edit((m) => { m.spread['character:y'] = m.spread['character:x']!; }), /spread character:y has no mob look/);
  assert.match(edit((m) => { m.spread['character:x']!.tints = []; }), /tints must be/);
  assert.deepEqual(zoneProblems(z), [], 'Zone 1 has no mobLooks and stays valid');
});

// Zone 1 is byte-identical to what it was before Zone 2 existed: hashes recorded from the base (world/zone2-data 5eee9e6), order-free. A link this page does not walk (the Ash Reach turn) leaves no post or collider behind.
// Re-pinned 2026-10-16 (the Cave Troll placement #2877, Lead's ruling: the troll's group moves out of the goblin camp's aggro range): the new `troll-cave` landmark (u 0.75, v 0.85) is drawn like every landmark, one marker piece and one collider (170 -> 171 pieces, 57 -> 58 solids); the sha before it acc9e948fd235ae5 / 70bce4a238048f1c. Nothing else in Zone 1 moved.
test('Zone 1 world is pinned: the same pieces and solids as before Zone 2 (plus the troll-cave landmark)', () => {
  const b = frontierBuild(frontierPlan(false, '1')), h = (x: readonly unknown[]) => createHash('sha256').update(JSON.stringify(x.map((v) => JSON.stringify(v)).sort())).digest('hex').slice(0, 16);
  assert.deepEqual([b.pieces.length, h(b.pieces), b.solids.length, h(b.solids)], [171, 'ef4a08c70f301a90', 58, '4c55a811ef4c2f51']);
});

// Zone 2 is byte-identical to what it was before its map entry moved into the zone 2 row (hashes recorded from trunk 5719c9f36, equal on the place.ts branch): pieces, solids, creature homes, the plan's zones.
test('Zone 2 world is pinned: the same pieces, solids, creature homes and plan zones as before place.ts', () => {
  const plan = frontierPlan(false, '2'), b = frontierBuild(plan), specs = mobSpecs(plan, b, loadZone('2').spawns.rows);
  const h = (x: readonly unknown[]) => createHash('sha256').update(JSON.stringify(x.map((v) => JSON.stringify(v)).sort())).digest('hex').slice(0, 16);
  assert.deepEqual([b.pieces.length, h(b.pieces), b.solids.length, h(b.solids), specs.length, h(specs.map((m) => ({ id: m.id, zone: m.zone, home: m.home, spawn: m.spawn, body: m.body }))), h([plan.zones])],
    [8, 'd508458ff6597cb4', 2, 'a4b3343a082ce465', 10, 'f73c961643987577', '3fc4d31cf1bf4c5e']);   // 10 creatures, creature-homes hash re-pinned 2026-10-10 (pack balance): the cairn pack is two wolves (campSize [2,2]), the ruin gets a four-wolf camp (reach-pack-a/b); pieces, solids and plan zones unchanged
});

// Proof 3 needs a camp where three can really join one player (#1943: up to 3). A creature's home is walkable by construction (mobSpecs places it with stand()), so standing at one is a real spot.
test('Zone 2 has a camp where at least three creatures sit within JOIN_M of a walkable spot, and the ruin pack is four wolves, the cairn pair a fair first fight', () => {
  const plan = frontierPlan(false, '2'), specs = mobSpecs(plan, frontierBuild(plan), loadZone('2').spawns.rows);
  const crowd = Math.max(...specs.map((a) => specs.filter((b) => Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z) <= JOIN_M).length));
  assert.ok(crowd >= 3, `most creatures within JOIN_M of one home: ${crowd}`);
  const hunt = Math.max(...specs.map((a) => specs.filter((b) => Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z) <= AGGRO_M).length));
  assert.ok(hunt >= 4, `a hero at one home has all four wolves inside AGGRO_M (they hunt only inside it, so all can join): ${hunt}`);
  const pack = specs.filter((m) => m.spawn.startsWith('reach-pack-')), cairn = specs.filter((m) => m.spawn === 'reach-wolves');
  assert.equal(pack.length, 4, 'the ruin camp is four wolves (Proof 2 four-wolf row, Proof 3: three bite, the fourth holds at the ring)');
  assert.equal(cairn.length, 2, 'the cairn pair is the fair first fight (scripts/pack-battery.ts: a Recruit wins a pair 14-15 of 24)');
  assert.ok(pack.every((a) => pack.every((b) => Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z) <= AGGRO_M)), 'all four ruin wolves hunt inside one AGGRO_M');
  assert.ok([...pack, ...cairn].every((m) => m.id.startsWith('z2:')));
});

test('a mob look for a character nothing names is a problem once the known ids are given (ids stay strings: no union of creature ids)', () => {
  const z = loadZone('1'), id = 'character:cinder-scavenger', known = new Set(Object.keys(z.mobLooks!.looks));
  assert.deepEqual(zoneProblems(z, known), [], 'Zone 1\'s looks are all known');
  const typo = { ...z, mobLooks: { looks: { ...z.mobLooks!.looks, 'character:cinder-scavanger': z.mobLooks!.looks[id]! }, spread: z.mobLooks!.spread } } as unknown as Zone;
  assert.match(zoneProblems(typo, known).join('; '), /character:cinder-scavanger: no such character/);
  assert.deepEqual(zoneProblems(typo), [], 'without a known set the old check is unchanged');
});

test('an unlisted zone opens only with the explicit VITE_UNLISTED_ZONES=1 opt-in; otherwise its address is the normal "no such place", even on the live /preview/origins/ build', () => {
  assert.equal(unlistedOpens({ VITE_UNLISTED_ZONES: '1' }), true, 'a sandbox preview built with the flag');
  assert.equal(unlistedOpens({}), false, 'default off');
  assert.equal(unlistedOpens(undefined), false, 'no env: off');
  assert.equal(unlistedOpens({ PROD: true, BASE_URL: '/preview/origins/' } as never), false, 'the real live env (production, base /preview/origins/) without the flag refuses it');
  assert.equal(unlistedOpens({ VITE_UNLISTED_ZONES: '0' }), false); assert.equal(unlistedOpens({ VITE_UNLISTED_ZONES: 'true' }), false, 'only the exact value 1 opens it');
  const pk = { '1': {}, '90': { unlisted: true } };
  assert.deepEqual(listedIds(pk, '90', false), ['1'], 'without the flag: the page that names it still does not see it');
  assert.deepEqual(listedIds(pk, '90', true), ['1', '90'], 'with the flag: its own page sees it');
  assert.deepEqual(listedIds(pk, '1', true), ['1'], 'a flagged page of another zone does not see it');
  assert.throws(() => loadZone('90', false), /no zone 90/, 'refused with the same error as an id that is no zone');
  assert.throws(() => loadZone('99', false), /no zone 99/);
  assert.equal(loadZone('90', true).unlisted, true, 'with the flag: opens');
  assert.equal(loadZone('1', false).name, loadZone('1', true).name, 'a listed zone is the same either way');
});
