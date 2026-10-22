// PROOF (Dom 2026-10-11, "zones as data"): Zone 3 is ONE data row, origins/zone-rows/zone3.row.json, and no TypeScript. It reuses the Ash Reach's biome (the default), kit and looks, has one spawn (an Ember Wolf at its
// cairn) and hangs off the Reach's far edge. These tests show it is a zone like any other: it loads, its wolf stands on the map, the server prices and engages it, and a fight against it runs through src/fight.
import './lib/page-zone3.ts';   // FIRST: beta (Dom 10-22) leaves zones 3-5 unlisted; this test reads Zone 3 as its own page does (the explicit opt-in and the /zone3/ address)
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';
import { mobSpecs } from '../origins/preview/mobs.ts';
import { defaultZoneSpawns, minHits, minKillMs, zoneKeyProblems, zoneSpawns } from '../origins/server/world-spawns.ts';
import { DEFAULT_ZONE, loadZone, zoneOpen, zoneProblems } from '../origins/zones/loader.ts';
import { OPPONENTS, opponentAt } from '../src/fight/moves.ts';
import { createFighter, idleIntent, opponentFighter, stepDuel, type Duel } from '../src/fight/duel.ts';
import { OPEN_RADIUS } from '../src/fight/play-radius.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value;

test('Zone 3 is a row and nothing else: no zone3 TypeScript anywhere, one file in git', () => {
  assert.ok(!existsSync('origins/zones/zone3'), 'no origins/zones/zone3 folder');
  assert.deepEqual(readdirSync('origins/zones', { withFileTypes: true }).filter((e) => e.isDirectory()), [], 'origins/zones holds the loader and its helpers, no zone folders');
  const tracked = execFileSync('git', ['ls-files', '--', 'origins', 'src', 'scripts'], { encoding: 'utf8' }).split('\n').filter((f) => /zone-?3\b|zone3/.test(f));
  assert.deepEqual(tracked, ['origins/zone-rows/zone3.row.json'], 'the row is the whole zone');
});

test('Zone 3 loads through the loader like any zone: its own name, level, one spawn row, and no problems', () => {
  assert.ok(zoneOpen('3') && DEFAULT_ZONE === '1');   // beta (Dom 10-22): Zone 3 is unlisted, so zoneIds() has no page-less view of it; it is OPEN here (the opt-in is set first), the same row
  const z = loadZone('3');
  assert.deepEqual([z.id, z.level, z.name, z.world], ['3', 3, 'The Salt Flats', ['salt-flats']]);
  assert.deepEqual(zoneProblems(z), []);
  assert.deepEqual(zoneKeyProblems(), [], 'the key rule the database column reads holds for every zone, Zone 3 included');
  assert.equal(z.spawns.rows.length, 1); assert.deepEqual(z.spawns.rows[0]!.level, [3, 4]);
});

test('its wolf stands on the map: one creature, keyed z3:, level 3, on the wolf body, inside its own world zone', () => {
  const f = frontierPlan(false, '3'), specs = mobSpecs(f, frontierBuild(f), loadZone('3').spawns.rows);
  const own = specs.filter((s) => !s.id.startsWith('z3:opener-'));   // as its own page (the /zone3/ address this test sets, beta 10-22) the zone also draws its entry opener; the row's one creature is the rest
  assert.deepEqual(own.map((s) => [s.id, s.character, s.body, s.level, s.zone]), [['z3:flats-wolf-1', 'character:ember-wolf', 'wolf', 3, 'salt-flats']]);
  assert.ok(Number.isFinite(specs[0]!.home.x) && Number.isFinite(specs[0]!.home.z));
  const one = frontierPlan(false, DEFAULT_ZONE), ids = new Set(mobSpecs(one, frontierBuild(one), loadZone(DEFAULT_ZONE).spawns.rows).map((s) => s.id));
  assert.ok(!ids.has('z3:flats-wolf-1'), 'and Zone 1 never sees it');
});

test('the server does not serve Zone 3 on a normal build (beta 10-22: zones 3-5 are unlisted): no zone, no spawns, none in the default world', () => {
  assert.throws(() => zoneSpawns(content, '3'), /no zone 3/);   // the server passes opens=false and never sees an unlisted zone; before the beta gate it priced the wolf from Zone 3's rows and engaged it by zoneId
  assert.ok([...defaultZoneSpawns(content).keys()].every((id) => !id.startsWith('z3:')), 'and no Zone 3 creature is in the world the server runs');
});

test('a fight against it runs through src/fight: the open-world duel kills the level-3 wolf, and not under the floors the server enforces', () => {
  const o = opponentAt((OPPONENTS as Record<string, Parameters<typeof opponentAt>[0]>)['wolf']!, 3);   // the zone row's creature: the wolf body at level 3 (the row is read above)
  const hero = createFighter({ x: 0, z: -0.8, heading: 0, distance: 0 }, 'ready', 'longsword'), foe = opponentFighter(o, { x: 0, z: 0.8, heading: Math.PI, distance: 0 }, 'ready');
  let duel: Duel = { tick: 0, fighters: [hero, foe], finish: null, events: [], radius: OPEN_RADIUS }, hits = 0;
  for (let t = 0; t < 60 * 120 && duel.finish === null && duel.fighters[1].health > 0; t++) {
    duel = stepDuel(duel, [{ ...idleIntent(), action: 'light' }, idleIntent()]);
    hits += duel.events.filter((e) => e.actor === 0 && e.target === 1 && (e.type === 'Hit' || e.type === 'GuardBroken')).length;
  }
  assert.ok(duel.fighters[1].health <= 0, 'the wolf dies');
  assert.ok(hits >= minHits(o.health) && duel.tick * 1000 / 60 >= minKillMs(o.health), `${hits} hits in ${duel.tick} ticks clear the floors`);
});
