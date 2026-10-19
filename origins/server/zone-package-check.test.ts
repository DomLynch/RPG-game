import './zone-package-env.ts';   // FIRST: unlisted packages are visible to this process
import assert from 'node:assert/strict';
import test from 'node:test';
import DEFS from '../presence/warp-landmarks.json' with { type: 'json' };
import { allZoneIds, loadZone, type Zone } from '../zones/loader.ts';
import { EXITS, type ExitRow } from '../zones/exits.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { loadoutDropProblems, packageProblems, type PackageCtx } from './zone-package-check.ts';
import { keyProblemsOf } from './world-spawns.ts';

// The server-side package check (zone package gap 2). It runs over EVERY zone package in the registry, listed or not, so a package imported into origins/zone-rows/ is checked in CI before it can stop the writer or presence at module load.
const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const zones = (): Record<string, Zone> => Object.fromEntries(allZoneIds().map((id) => [id, loadZone(id, true)]));
const ctx = (z: Record<string, Zone>, exits: readonly ExitRow[] = EXITS): PackageCtx => ({ content: loaded.value, zones: z, exits, tableWarps: new Set(DEFS.landmarks.map((r) => r.id)) });

test('every zone package in the registry passes the server check (listed or not)', () => {
  const z = zones();
  assert.ok(Object.keys(z).length >= 4, 'the registry has its packages');
  for (const id of Object.keys(z)) assert.deepEqual(packageProblems(z[id]!, ctx(z)), [], `zone ${id}`);
});

test('a spawn row whose loot table does not exist is a problem', () => {
  const z = zones(), z1 = z['1']!, row = z1.spawns.rows[0]!;
  const noLoot = { ...z1, spawns: { ...z1.spawns, rows: [{ ...row, loot: 'loottable:no-such-table' }, ...z1.spawns.rows.slice(1)] } } as Zone;
  assert.ok(packageProblems(noLoot, ctx(z)).some((p) => p.includes(`spawn row ${row.id}: loot loottable:no-such-table is not a loot table`)));
});

test('an UNLISTED package: every piece a creature\'s loadouts can wear is in its spawn row\'s table (derived from loadouts.json, no hand list); a listed zone is not held to it', () => {
  const z = zones(), tz = z['90']!;
  assert.equal(tz.unlisted, true, 'zone 90 is the unlisted Test Zone');
  assert.deepEqual(loadoutDropProblems(tz, loaded.value), [], 'zone 90 as shipped drops everything it can be seen wearing');
  const troll = tz.spawns.rows.find((r) => r.id === 'character:cave-troll')!;
  const back = { ...tz, spawns: { ...tz.spawns, rows: tz.spawns.rows.map((r) => (r === troll ? { ...r, loot: 'loottable:cave-troll' } : r)) } } as Zone;
  const bad = packageProblems(back, ctx(z));
  assert.ok(bad.some((p) => p.includes('wears pitborn.Greaves, which loottable:cave-troll does not drop')), bad.join('\n'));
  assert.ok(bad.some((p) => p.includes('wears pitborn.Boots, which loottable:cave-troll does not drop')));
  const ghost = { ...tz, mobLooks: { ...tz.mobLooks!, looks: { ...tz.mobLooks!.looks, 'character:pit-goblin': { ...tz.mobLooks!.looks['character:pit-goblin']!, loadout: 'no.such.loadout' } } } } as Zone;
  assert.ok(packageProblems(ghost, ctx(z)).some((p) => p.includes('loadout "no.such.loadout" is not a loadouts.json row')));
  const listedWithGear = { ...back, unlisted: false } as Zone;   // the same gap on a LISTED zone is not this check's business (its drops are frozen)
  assert.ok(!packageProblems(listedWithGear, ctx(z)).some((p) => p.includes('does not drop')));
});

test('the key rule is per zone: a key that reads as another zone, does not fit the table or repeats is named', () => {
  assert.deepEqual(keyProblemsOf('2', ['z2:wolf-1', 'z2:wolf-2']), []);
  assert.deepEqual(keyProblemsOf('1', ['wolf-1']), []);
  assert.match(keyProblemsOf('2', ['wolf-1'])[0]!, /reads as zone 1, not 2/);
  assert.match(keyProblemsOf('1', ['z2:wolf-1'])[0]!, /reads as zone 2, not 1/);
  assert.match(keyProblemsOf('2', ['z2:Wolf 1']).join(), /does not fit the table's key check/);
  const seen = new Map<string, string>(); keyProblemsOf('1', ['wolf-1'], seen);
  assert.match(keyProblemsOf('1', ['wolf-1'], seen)[0]!, /is in zone 1 and zone 1/);
});

test('a door to a zone that is not a package, a door with no landing, and a warp id that is already taken are problems', () => {
  const z = zones(), z1 = z['1']!, door = EXITS.find((e) => z1.world.includes(e.zone))!;
  const run = (exits: readonly ExitRow[], zone: Zone = z1): string[] => packageProblems(zone, ctx(z, exits));
  assert.ok(run([{ ...door, to: '77' }]).some((p) => /"77" is not a zone package/.test(p)));
  assert.ok(run([{ ...door, arrive: 'no-such-landmark' }]).some((p) => /has no landing \(arrive landmark "no-such-landmark"\)/.test(p)));
  assert.ok(run([{ ...door, warp: DEFS.landmarks[0]!.id }]).some((p) => /also a warp-landmarks\.json row/.test(p)));
  assert.ok(run([door, { ...door, id: 'twin' }]).some((p) => /is also exit/.test(p)));
  const own = { ...z1, warps: [{ id: DEFS.landmarks[0]!.id, x: 0, z: 3, unit: 'm' }, { id: door.warp, x: 0, z: 3, unit: 'm' }] } as Zone;
  const bad = run(EXITS, own);
  assert.ok(bad.some((p) => p.includes(`warp ${DEFS.landmarks[0]!.id}: already a warp-landmarks.json row`)));
  assert.ok(bad.some((p) => p.includes(`warp ${door.warp}: already an exit's warp`)));
});

test('a LISTED package\'s warp must stand inside a presence zone row; an UNLISTED one is not placed yet', () => {
  const z = zones(), z1 = z['1']!;
  const far = { ...z1, warps: [{ id: 'far-away', x: 9e5, z: 9e5, unit: 'm' }] } as Zone;
  assert.ok(packageProblems(far, ctx(z)).some((p) => /warp far-away: not inside any zone row/.test(p)));
  const quiet = { ...far, unlisted: true } as Zone;
  assert.deepEqual(packageProblems(quiet, ctx(z)).filter((p) => p.startsWith('warp far-away')), []);
});
