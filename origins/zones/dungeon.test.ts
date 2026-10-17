// The dungeon framework (origins/zones/dungeon.ts): the Bone Hollow is row #1 and the zone it compiles to is the zone the loader serves; a second, three-room row walks end to end; a broken graph is refused at load. Pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, compileDungeon, dungeonParts, loadDungeons, reachable, walkRoute, type Dungeon } from './dungeon.ts';
import { loadZone } from './loader.ts';
import THEMES from './dungeon-themes.json' with { type: 'json' };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const bone = DUNGEONS.find((d) => d.id === 'bone-hollow')!, sample = DUNGEONS.find((d) => d.id === 'crypt-sample')!;
const load = (d: Dungeon) => loadDungeons({ dungeons: [d] });

test('the Bone Hollow zone is its dungeon row, compiled: place, spawns and look come from the row, nothing is left in the zone row', () => {
  const z = loadZone('5'), p = dungeonParts('bone-hollow');
  assert.deepEqual(z.place, p.place); assert.deepEqual(z.spawns, p.spawns); assert.deepEqual(z.look, p.look);
  assert.equal((z.place as { waypoints: string[] }).waypoints.join(), 'marsh-hollow,hollow-gate,hollow-hall,hollow-patrol,hollow-den,hollow-cache');
  assert.equal((z.place as { spawns: unknown[] }).spawns.length, bone.encounters.length);
});

test('walk in, room to room, to the boss and out again: both rows', () => {
  for (const d of DUNGEONS) {
    const w = walkRoute(d), boss = d.encounters.find((e) => e.id === d.boss.encounter)!;
    assert.equal(w.in[0], d.entrance.room); assert.equal(w.in.at(-1), boss.room); assert.deepEqual(w.out, [...w.in].reverse());
    for (let i = 1; i < w.in.length; i++) assert.ok(d.rooms.find((r) => r.id === w.in[i - 1])!.links.includes(w.in[i]!), `${w.in[i - 1]} to ${w.in[i]} is a link`);
    assert.equal(reachable(d).size, d.rooms.length, 'every room is reachable');
  }
  assert.deepEqual(walkRoute(sample).in, ['crypt-door', 'crypt-nave', 'crypt-vault']);
});

test('the sample row compiles to the zone-row parts, in its band L4-6, with the theme slot', () => {
  assert.deepEqual(sample.level, [4, 6]);
  const c = compileDungeon(sample, (THEMES.themes as { id: string; look: object; pieces: Record<string, string> }[])[0]!) as { place: { zones: Record<string, { layout: object }>; waypoints: string[]; spawns: { at: string }[] }; spawns: { rows: unknown[] } };
  assert.deepEqual(Object.keys(c.place.zones['crypt-sample']!.layout), ['crypt-door', 'crypt-nave', 'crypt-vault']);
  assert.deepEqual(c.place.waypoints, ['crypt-door', 'crypt-nave', 'crypt-vault']);
  assert.deepEqual(c.place.spawns.map((s) => s.at), ['crypt-nave', 'crypt-vault']); assert.equal(c.spawns.rows.length, 2);
});

test('a broken row is refused at load, naming the dungeon and the fault', () => {
  const bad = (edit: (d: Dungeon & { [k: string]: any }) => void, why: RegExp) => { const d = clone(sample) as Dungeon & { [k: string]: any }; edit(d); assert.throws(() => load(d), why); };
  bad((d) => { d.rooms[1].links = ['crypt-door']; d.rooms[2].links = []; }, /"crypt-vault" cannot be reached/);
  bad((d) => { d.rooms[2].links = []; }, /does not link back/);
  bad((d) => { d.rooms[2].id = 'crypt-door'; }, /room id "crypt-door" is used twice/);
  bad((d) => { d.entrance.room = 'nowhere'; }, /entrance room "nowhere"/);
  bad((d) => { d.rooms[0].piece = 'throne'; }, /piece "throne" is not in theme/);
  bad((d) => { d.creatures[0].level = [9, 10]; }, /outside the band/);
  bad((d) => { d.creatures[0].loot = 'loottable:nothing'; }, /loottable:nothing/);
  bad((d) => { d.encounters[0].creature = 'character:ghost'; }, /not one of the dungeon's creature rows/);
  bad((d) => { d.boss.encounter = 'crypt-guard'; }, /must be a named row/);
  bad((d) => { d.boss.encounter = 'nobody'; }, /does not exist/);
  bad((d) => { d.theme = 'no-theme'; }, /no-theme/);
  bad((d) => { d.level = [6, 4]; }, /not lo <= hi/);
});

test('a dungeon entrance exit must stand on the entrance room', () => {
  assert.throws(() => loadDungeons({ dungeons: [{ ...clone(bone), entrance: { room: 'hollow-hall', exit: 'hollow-gate' } }] }), /stands on landmark "hollow-gate", not on the entrance room/);
});
