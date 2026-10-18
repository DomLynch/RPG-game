// The dungeon framework (origins/zones/dungeon.ts): the Bone Hollow is row #1 and the zone it compiles to is the zone the loader serves; a second, three-room row walks end to end; a broken graph is refused at load. Pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEONS, compileDungeon, dungeonParts, loadDungeons, reachable, walkRoute, type Dungeon, type DungeonTheme } from './dungeon.ts';
import { loadZone, zoneIds, zoneOpen, zonePlaces, zoneProblems, type Zone } from './loader.ts';
import { applyZones } from './place.ts';
import { EXITS, openExits } from './exits.ts';
import THEMES from './dungeon-themes.json' with { type: 'json' };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const bone = DUNGEONS.find((d) => d.id === 'bone-hollow')!, sample = DUNGEONS.find((d) => d.id === 'crypt-sample')!;
const load = (d: Dungeon) => loadDungeons({ dungeons: [d] });

test('the Bone Hollow zone is its dungeon row, compiled: place, spawns and look come from the row, nothing is left in the zone row', () => {
  const z = loadZone('5'), p = dungeonParts('bone-hollow');
  assert.deepEqual(z.place, p.place); assert.deepEqual(z.spawns, p.spawns); assert.deepEqual((z as unknown as { look: unknown }).look, p.look);
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

test('the sample row compiles to the zone-row parts, in its band L4-6 (its own row, not the zone number), with the theme slot', () => {
  assert.deepEqual(sample.level, [4, 6]);
  const c = compileDungeon(sample, (THEMES.themes as DungeonTheme[])[0]!) as { place: { zones: Record<string, { layout: object }>; waypoints: string[]; spawns: { at: string }[] }; spawns: { rows: unknown[] } };
  assert.deepEqual(Object.keys(c.place.zones['crypt-sample']!.layout), ['crypt-door', 'crypt-nave', 'crypt-vault']);
  assert.deepEqual(c.place.waypoints, ['reach-crypt', 'crypt-mouth', 'crypt-door', 'crypt-nave', 'crypt-vault']);
  assert.deepEqual(c.place.spawns.map((s) => s.at), ['crypt-nave', 'crypt-vault']); assert.equal(c.spawns.rows.length, 2);
});

test('a broken row is refused at load, naming the dungeon and the fault', () => {
  type Row = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any -- a test edits a copy of a row freely
  const bad = (edit: (d: Row) => void, why: RegExp) => { const d = clone(sample) as unknown as Row; edit(d); assert.throws(() => load(d as unknown as Dungeon), why); };
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

test('the dungeon row\'s level band WINS over the zone-number rule, which is only the fallback for a zone without a band', () => {
  const z = loadZone('6', true), rows = z.spawns.rows.map((r) => [r.id, ...r.level]);
  assert.deepEqual(z.band, sample.level); assert.deepEqual(z.band, [4, 6]);
  assert.deepEqual(rows, [['character:cinder-scavenger', 4, 5], ['character:giant-salamander', 6, 6]], 'the game shows the row\'s own levels, not Zone 6\'s 6-7 / 8');
  assert.deepEqual(zoneProblems(z), [], 'inside the band: no problem');
  assert.ok(zoneProblems({ ...z, band: undefined } as Zone).some((p) => /not the zone rule/.test(p)), 'without a band the zone-number rule applies and refuses these levels');
  assert.ok(zoneProblems({ ...z, band: [5, 6] } as Zone).some((p) => /outside the zone's band 5-6/.test(p)), 'a creature below the band is refused');
  assert.deepEqual(loadZone('5').band, [5, 7], 'the Bone Hollow carries its band too');
});

test('the sample crypt is UNLISTED: closed on a normal build (no zone, no door, no warp), open only with the explicit opt-in', () => {
  assert.ok(!zoneIds(false).includes('6') && zoneIds(false).includes('5') && !zoneOpen('6', false) && zoneOpen('6', true) && zoneOpen('5', false));
  assert.throws(() => loadZone('6', false), /no zone 6/);
  const crypt = (rows: readonly { id: string }[]) => rows.map((r) => r.id).filter((id) => id.startsWith('crypt-'));
  assert.deepEqual(crypt(openExits()), [], 'a beta page draws no crypt door');
  assert.deepEqual(crypt(openExits(EXITS, false)), [], 'and presence derives no zone6 warp (the server passes false)');
  assert.deepEqual(crypt(openExits(EXITS, true)), ['crypt-mouth', 'crypt-door'], 'a preview built with the opt-in has both doors');
  assert.ok(openExits().some((r) => r.id === 'cave-mouth') && openExits().some((r) => r.id === 'hollow-gate'), 'the Bone Hollow doors are unaffected');
});

test('the crypt-mouth landmark comes from the zone-6 package: a normal build adds nothing to Zone 1, an opted-in build adds the landmark and its waypoint', () => {
  const has = (places: ReturnType<typeof zonePlaces>) => places.flatMap((p) => p.joins).some((j) => j.landmark === 'crypt-mouth');
  const was = process.env.VITE_UNLISTED_ZONES;
  try {
    delete process.env.VITE_UNLISTED_ZONES;
    assert.equal(has(zonePlaces()), false, 'normal build: no crypt-mouth join anywhere');
    assert.ok(!zonePlaces().flatMap((p) => p.waypoints).includes('crypt-mouth'));
    process.env.VITE_UNLISTED_ZONES = '1';
    const p = zonePlaces();
    assert.equal(has(p), true, 'opt-in build: the bare join applies on a page that is not the crypt\'s');
    assert.ok(p.flatMap((x) => x.waypoints).includes('crypt-mouth'), 'and it is a waypoint, as the region loader needs');
    assert.ok(!p.flatMap((x) => x.joins).some((j) => j.landmark === 'reach-crypt'), 'but the crypt\'s own placement join (a road to the Ash Reach) is only seen on its own page');
    const world = applyZones({ 'cinder-fields': { layout: { a: { u: 0, v: 0, facing: 0 } }, connections: {} } }, p.filter((x) => !Object.keys(x.zones).length));   // the stub place alone: the zone-less place that carries only the bare joins
    assert.deepEqual(Object.keys(world['cinder-fields']!.layout as object), ['a', 'crypt-mouth']);
    assert.deepEqual(world['cinder-fields']!.connections, {}, 'a bare join adds no road');
  } finally { if (was === undefined) delete process.env.VITE_UNLISTED_ZONES; else process.env.VITE_UNLISTED_ZONES = was; }
});

test('a theme with an enclosure walls every room: pieces stay inside the zone, a doorway faces each link (and the way out), a theme without one adds no kit', () => {
  const parts = dungeonParts('crypt-sample') as { kit?: { url: string; nodes: string[]; fixed: { node: string; at: string; dx: number; dz: number; solid: number; inZoneFrame: boolean }[] } };
  const fixed = parts.kit!.fixed;
  assert.equal(parts.kit!.url, '/world/kit/dungeon-kit.glb');
  assert.ok(fixed.every((p) => p.inZoneFrame && parts.kit!.nodes.includes(p.node)));
  const doors = (room: string) => fixed.filter((p) => p.at === room && p.node === 'cave_doorway').length;
  assert.deepEqual(['crypt-door', 'crypt-nave', 'crypt-vault'].map(doors), [2, 0, 0], 'the open entrance room has its way out and its link; the closed halls leave cells open instead');
  assert.ok(fixed.filter((p) => p.at === 'crypt-door' && p.node === 'cave_wall').length >= 8, 'the open room is walled with the cave wall');
  for (const r of sample.rooms.filter((x) => x.roof === 'closed')) assert.equal(fixed.filter((p) => p.at === r.id && p.node === 'cave_wall' && !p.blockOnly).length, 0, `${r.id} is a hall, not cave wall`);
  const local = new Map(sample.rooms.map((r) => [r.id, { x: (r.at.u - 0.5) * sample.size.width, d: r.at.v * sample.size.depth }]));
  for (const p of fixed) { const c = local.get(p.at)!; assert.ok(Math.abs(c.x + p.dx) <= sample.size.width / 2 && c.d + p.dz >= 0 && c.d + p.dz <= sample.size.depth, `${p.at} ${p.node} inside the zone`); }
  assert.equal((dungeonParts('bone-hollow') as { kit?: unknown }).kit, undefined, 'the Bone Hollow carries its own kit rows');
});
test('a room whose walls would leave the zone is refused, and a zone row may not carry the kit a dungeon theme compiles', () => {
  const wide: Dungeon = { ...sample, rooms: sample.rooms.map((r, i) => (i === 0 ? { ...r, size: { w: 12, d: 60 } } : r)) };
  const theme = (THEMES.themes as DungeonTheme[]).find((t) => t.id === sample.theme)!;
  assert.throws(() => compileDungeon(wide, theme), /outside the 60 x 40 zone/);
});

test('a closed room is a hall: a floor and a ceiling per cell, joined walls facing in, four corners, doorway cells open, sconces on the walls, solid walls', () => {
  type P = { node: string; at: string; dx: number; dz: number; rotDeg: number; solid: number; blockOnly?: boolean };
  const theme = (THEMES.themes as DungeonTheme[]).find((t) => t.id === sample.theme)!, hall = theme.enclosure!.hall!;
  const fixed = (dungeonParts('crypt-sample') as { kit: { fixed: P[] } }).kit.fixed;
  const lookup = new Map(sample.rooms.map((r) => [r.id, r]));
  for (const id of ['crypt-nave', 'crypt-vault']) {
    const r = lookup.get(id)!, nx = r.size!.w / hall.cell, nd = r.size!.d / hall.cell, mine = fixed.filter((p) => p.at === id), of = (node: string) => mine.filter((p) => p.node === node && !p.blockOnly);
    assert.equal(of(hall.floor).length, nx * nd, `${id} floor`); assert.equal(of(hall.ceiling).length, nx * nd, `${id} ceiling`); assert.equal(of(hall.corner).length, 4, `${id} corners`);
    const doorCells = (n: number) => ((n - hall.doorCells) % 2 === 0 ? hall.doorCells : hall.doorCells + 1), links = r.links.length;
    const perimeter = 2 * (nx + nd) - 4, doors = links * doorCells(nx);   // both rooms are square: one doorway on each side that faces a link
    assert.equal(of(hall.wall).length, perimeter - 4 - doors, `${id} has a wall on every perimeter cell but the corners and the doorway cells`);
    // every wall and corner stands on the perimeter with its inner face (local +z = (sin t, -cos t) in the zone's frame) toward the room's middle
    for (const p of [...of(hall.wall), ...of(hall.corner), ...of(hall.sconce)]) {
      const t = (p.rotDeg * Math.PI) / 180, inner = { x: Math.sin(t), d: -Math.cos(t) }; assert.ok(inner.x * -p.dx + inner.d * -p.dz > 0, `${id} ${p.node} faces into the room`);
    }
    assert.ok(mine.filter((p) => p.blockOnly).every((p) => p.solid === hall.block.r) && mine.some((p) => p.blockOnly), `${id} walls are solid`);
    assert.ok(of(hall.sconce).length > 0, `${id} has torches`);
  }
});
test('a closed room needs a theme hall and whole cells; a hall theme row is data', () => {
  const closed = (id: string, size: { w: number; d: number }): unknown => ({ dungeons: [{ ...clone(sample), rooms: sample.rooms.map((r) => (r.id === id ? { ...r, size } : r)) }] });
  assert.throws(() => loadDungeons(closed('crypt-nave', { w: 14, d: 16 }) as never), /whole number of 4 m cells/);
  assert.throws(() => loadDungeons(closed('crypt-nave', { w: 8, d: 16 }) as never), /at least 3 a side/);
  const bare = { themes: (THEMES.themes as DungeonTheme[]).map((t) => ({ ...t, enclosure: t.enclosure && { ...t.enclosure, hall: undefined } })) };
  assert.throws(() => loadDungeons({ dungeons: [clone(sample)] }, bare as never), /has no enclosure.hall/);
});
test('a room roof is open or closed: the entrance stays open, the sample crypt closes its inner halls, a bad value is refused', () => {
  const roofs = Object.fromEntries(sample.rooms.map((r) => [r.id, r.roof]));
  assert.deepEqual(roofs, { 'crypt-door': 'open', 'crypt-nave': 'closed', 'crypt-vault': 'closed' });
  const withRoof = (id: string, roof: unknown): unknown => ({ dungeons: [{ ...clone(sample), rooms: sample.rooms.map((r) => (r.id === id ? { ...r, roof } : r)) }] });
  assert.throws(() => loadDungeons(withRoof('crypt-nave', 'vaulted') as never), /roof "vaulted" is not one of open, closed/);
  assert.throws(() => loadDungeons(withRoof('crypt-door', 'closed') as never), /entrance room "crypt-door" must be open/);
  assert.equal(loadDungeons(withRoof('crypt-nave', undefined) as never).length, 1, 'no roof reads as open');
});
test('a dungeon entrance exit must stand on the entrance room', () => {
  assert.throws(() => loadDungeons({ dungeons: [{ ...clone(bone), entrance: { room: 'hollow-hall', exit: 'hollow-gate' } }] }), /stands on landmark "hollow-gate", not on the entrance room/);
});
