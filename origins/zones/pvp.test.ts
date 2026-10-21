// Dungeon slice A (docs/specs/origins/pit-live-zone.md): the zone row's `pvp` and `safeAreas` decide Fighter.pvp by where a player stands. pvpAt/applyPvp are pure; the loader refuses a bad safeAreas row.
import '../../tests/lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { player, creature } from '../../src/fight/world.ts';
import { zoneFromRow } from './from-row.ts';
import { loadZone, zoneProblems, type Zone } from './loader.ts';
import { FIELDS } from './schema.ts';
import { applyPvp, areasAt, pvpAt, safeAreaProblems, type SafeArea } from './pvp.ts';

const yard: SafeArea = { id: 'pit-yard', name: 'Pit yard', shape: 'rect', min: [0, 0], max: [10, 10], pvp: 'off', spawnsAllowed: true };
const dungeon = { pvp: 'on', safeAreas: [yard] };

test('inside the safe area PvP is off, outside it the zone default (on) applies', () => {
  assert.equal(pvpAt(dungeon, 5, 5), false, 'inside the yard');
  assert.equal(pvpAt(dungeon, 15, 5), true, 'outside, in the duel room');
  assert.equal(pvpAt(dungeon, -0.01, 5), true, 'just outside on x');
  assert.equal(pvpAt(dungeon, 5, 10.01), true, 'just outside on z');
});

test('the border counts as inside, every edge and corner', () => {
  for (const [x, z] of [[0, 5], [10, 5], [5, 0], [5, 10], [0, 0], [10, 10], [0, 10], [10, 0]] as const) assert.equal(pvpAt(dungeon, x, z), false, `(${x}, ${z})`);
  assert.deepEqual(areasAt([yard], 10, 10).map((a) => a.id), ['pit-yard']);
  assert.deepEqual(areasAt(undefined, 1, 1), []);
});

test('a town (the world zone is safe) is always off, whatever the zone or the areas say', () => {
  const allOn = { pvp: 'on', safeAreas: [{ ...yard, pvp: 'on' as const }] };
  assert.equal(pvpAt(allOn, 5, 5, true), false);
  assert.equal(pvpAt(allOn, 50, 50, true), false);
  assert.equal(pvpAt(allOn, 5, 5, false), true, 'the same spot is on when it is not a town');
});

test('the zone default: off and opt-in read as off here (opt-in is a per-player flag in a later slice); a missing pvp is off', () => {
  assert.equal(pvpAt({ pvp: 'off' }, 1, 1), false);
  assert.equal(pvpAt({ pvp: 'opt-in' }, 1, 1), false);
  assert.equal(pvpAt({}, 1, 1), false);
  assert.equal(pvpAt({ pvp: 'on' }, 1, 1), true);
});

test('an "on" area inside an "off" zone carves out a PvP volume; overlaps: the most restrictive wins', () => {
  const duel: SafeArea = { ...yard, id: 'duel-pit', name: 'Duel pit', min: [20, 0], max: [30, 10], pvp: 'on' };
  const arena = { pvp: 'off', safeAreas: [duel] };
  assert.equal(pvpAt(arena, 25, 5), true); assert.equal(pvpAt(arena, 5, 5), false);
  const both = { pvp: 'on', safeAreas: [{ ...yard, pvp: 'on' as const, id: 'a' }, { ...yard, pvp: 'off' as const, id: 'b', min: [4, 4] as const, max: [6, 6] as const }] };
  assert.equal(pvpAt(both, 5, 5), false, 'one off area is enough');
  assert.equal(pvpAt(both, 1, 1), true, 'only the on area contains this spot');
});

test('applyPvp sets the flag on each PLAYER from where he stands, leaves creatures alone, and never mutates its input', () => {
  const inYard = player('a', 5, 5), inRoom = player('b', 15, 5), mob = creature('m', 'goblin', 5, 5);
  const before = JSON.stringify([inYard, inRoom, mob]);
  const out = applyPvp([inYard, inRoom, mob], dungeon);
  assert.deepEqual(out.map((f) => f.pvp), [false, true, false]);
  assert.equal(JSON.stringify([inYard, inRoom, mob]), before, 'input untouched');
  assert.equal(out[2], mob, 'a creature comes back as the same object');
  assert.equal(applyPvp([inRoom], dungeon, () => true)[0]!.pvp, false, 'a town spot forces off');
  assert.equal(applyPvp([out[1]!], dungeon)[0], out[1], 'unchanged = the same object');
});

test('safeAreas rows are checked at load: shape, corner order, a repeated id, an unknown pvp, spawnsAllowed', () => {
  assert.deepEqual(safeAreaProblems(undefined), []); assert.deepEqual(safeAreaProblems([yard]), []);
  assert.match(safeAreaProblems({})[0]!, /is a list/);
  const bad = (patch: Record<string, unknown>) => safeAreaProblems([{ ...yard, ...patch }]).join('|');
  assert.match(bad({ id: 'Bad Id' }), /not a lowercase id/);
  assert.match(bad({ name: ' ' }), /display name/);
  assert.match(bad({ shape: 'circle' }), /not "rect"/);
  assert.match(bad({ min: [0] }), /\[x, z\] numbers/);
  assert.match(bad({ max: [Number.NaN, 1] }), /\[x, z\] numbers/);
  assert.match(bad({ min: [11, 0] }), /min is not at or below max/);
  assert.match(bad({ pvp: 'opt-in' }), /not "off" or "on"/);
  assert.match(bad({ spawnsAllowed: 'yes' }), /spawnsAllowed is true or false/);
  assert.match(safeAreaProblems([yard, yard]).join('|'), /id pit-yard is repeated/);
  assert.match(safeAreaProblems([null])[0]!, /an object/);
});

test('a zone row carries pvp and safeAreas through to the loaded zone, and the loader refuses a bad one', () => {
  const base = loadZone('1');
  const row = { name: base.name, names: base.names, world: base.world, kit: base.kit, looks: base.looks, spawns: base.spawns, pvp: 'on', safeAreas: [yard] };
  const z = zoneFromRow(1, row);
  assert.equal(z.pvp, 'on'); assert.deepEqual(z.safeAreas, [yard]);
  assert.equal(pvpAt(z, 5, 5), false);
  const own = (zn: Zone) => zoneProblems(zn).filter((p) => /safeAreas|pvp/.test(p));   // the rest of this synthetic row (Zone 1's creatures without its height exception) is not what is under test
  assert.deepEqual(own(z), [], 'a good row has no safeAreas or pvp problem');
  const broken = { ...z, safeAreas: [{ ...yard, min: [11, 0] }] } as unknown as Zone;
  assert.match(zoneProblems(broken).join('|'), /safeAreas\[0\]: min is not at or below max/);
  assert.match(zoneProblems({ ...z, pvp: 'always' } as unknown as Zone).join('|'), /schema: .*pvp/);
  assert.equal(loadZone('1').pvp, undefined, 'Zone 1 sets neither: unchanged');
  assert.equal(zoneFromRow(1, { name: base.name, names: base.names, world: base.world, kit: base.kit, looks: base.looks, spawns: base.spawns }).safeAreas, undefined);
});

test('the two fields are wired: pvp.ts reads them', () => {
  for (const path of ['pvp', 'safeAreas']) assert.equal(FIELDS.find((f) => f.path === path)?.wired, true, path);
});
