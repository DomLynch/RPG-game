import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarksSettler, SETTLE_WAIT_S, MARKS_CAP } from './world-marks.ts';
import { rosterSpawnIds, spawnAt, zoneOfKey, zoneSpawns } from './world-spawns.ts';
import { legendAt } from '../dungeon/legend-at.ts';
import ROSTER from '../dungeon/bowl-roster.json' with { type: 'json' };
import { fightSetup, loadEncounterContent } from '../encounters/encounters.ts';
import { listedZone, listedZoneIds } from '../zones/listed.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };
import type { Db } from './db.ts';

// The roster -> ladder join, end to end (Lead 2026-10-22: the first Dungeon 1 ladder win settles without a code change). The settler's own rules are pinned in world-marks.test.ts; this file pins what the WRITER feeds it:
// Dungeon 1 (zone 7) is a LISTED zone (the writer sees only listed zones: an unlisted zone's kills are refused as sandbox kills), its roster spawn rows reach rosterSpawnIds, every id is a `z7:` database key, and
// the settle sends exactly those ids with the rows' numbers. Fails until World lists zone 7 and Combat's join puts the roster rows into zone 7's spawns.
const DUNGEON = '7';

test('Dungeon 1 is a listed zone, so its kills reach the ledger and the settle', () => {
  assert.ok(listedZoneIds().includes(DUNGEON), 'zone 7 is unlisted: a Dungeon 1 kill is a sandbox kill and never settles');
});

test('the roster ids are zone 7 database keys, and only roster rows are in the list', () => {
  const loaded = loadEncounterContent();
  assert.ok(loaded.ok);
  const ids = rosterSpawnIds(loaded.value);
  assert.ok(ids.length > 0, 'no roster spawn row reaches the writer: Combat\'s join of bowl-roster.json into zone 7\'s spawns is missing');
  assert.equal(new Set(ids).size, ids.length, 'a spawn id twice');
  for (const id of ids) assert.equal(zoneOfKey(id), DUNGEON, `${id} is not a z${DUNGEON}: key`);
});

// Every roster fighter is priced by the writer: zoneSpawns drops (fails closed on) any creature fightSetup or healthOf cannot price, and a dropped legend would simply never settle. So name each missing piece.
test('every zone 7 roster row survives zoneSpawns, and every roster spawn is fightable, priced, paid and looted from rows', () => {
  const loaded = loadEncounterContent();
  assert.ok(loaded.ok);
  const spawns = [...zoneSpawns(loaded.value, DUNGEON).values()], rows = listedZone(DUNGEON).spawns.rows.filter((r) => r.roster === true);
  assert.ok(rows.length > 0, 'zone 7 has no roster:true spawn row');
  const standing = spawns.flatMap((s) => (s.pool ? [...s.pool.values()] : [s]));   // a rotating camp stands as every legend of its pool
  for (const row of rows) assert.ok(standing.some((s) => s.spec.character === row.id), `${row.id}: a roster row zoneSpawns dropped (fightSetup or healthOf refused it: its creatureLoot row, form, body or level)`);
  for (const s of standing.filter((x) => x.roster === true)) {
    const at = `${s.spec.id} (${s.spec.character})`, setup = fightSetup(s.fight, loaded.value);
    assert.ok(setup.ok, `${at}: fightSetup refused ${s.fight}`);
    assert.ok(s.hp >= 1, `${at}: no health`);
    assert.ok(Object.hasOwn(loaded.value.local.killRows, s.spec.character), `${at}: no kill row`);
    assert.ok(Object.hasOwn(loaded.value.local.creatureLoot, s.fight) || s.loot, `${at}: no loot table (creatureLoot or the row's own)`);
    const row = rows.find((r) => r.id === s.spec.character)!;
    assert.equal(s.respawnS, row.respawnSeconds, `${at}: respawn is not the row's respawnSeconds`);
  }
});

test('the settle sends those ids with the worldMarks / worldShare rows and the beta cap', async () => {
  const loaded = loadEncounterContent();
  assert.ok(loaded.ok);
  const ids = rosterSpawnIds(loaded.value), sent: Record<string, string>[] = [];
  const db = { async run(sql: string, v: Record<string, string> = {}) { if (/origins_world_marks_settle/.test(sql)) { sent.push(v); return '1'; } return ''; } } as unknown as Db;
  const logs: string[] = [];
  assert.equal(await createMarksSettler(db, () => ids, 1000, (m) => logs.push(m)).settle(), 1);
  const r = SERVER_RULES.worldMarks[0]!;
  assert.deepEqual(sent, [{ w: String(SETTLE_WAIT_S), o: String(r.ofTop), c: String(MARKS_CAP), h: String(r.perHour), i: JSON.stringify(ids), n: String(r.batch) }]);
  assert.match(logs[0]!, /settled 1 ladder mark /);
});

// Zone 7's camps ROTATE (docs/specs/origins/dungeon-legend-rotation.md): three camps per ring, each walking the ring's whole pool, one legend per respawn generation. The ledger and settle are keyed (instance, generation), so
// they never see the legend; what must hold is that every camp is a roster spawn, every pool member is priced, and each generation resolves one legend of the camp's own ring band.
// A ring's pool is its roster groups (origins/dungeon/bowl-roster.json): the tests read the size from the table, so widening a pool never edits them.
const POOL = (ring: string): number => (ROSTER.rings as Record<string, { groups: unknown[] }>)[ring]!.groups.length;
const ringOf = (spec: { spawn: string }): string => spec.spawn.split('-')[0]!;

test('zone 7 is nine rotating roster camps, three per ring, and every pool member is priced, paid and looted at its own rank', () => {
  const loaded = loadEncounterContent();
  assert.ok(loaded.ok);
  const camps = [...zoneSpawns(loaded.value, DUNGEON).values()];
  assert.equal(camps.length, 9, 'three camps in each of the three rings');
  assert.deepEqual(rosterSpawnIds(loaded.value).filter((id) => zoneOfKey(id) === DUNGEON).sort(), camps.map((c) => c.spec.id).sort(), 'the settle is sent the camps, one id per camp');
  for (const c of camps) {
    const at = c.spec.id;
    assert.equal(c.roster, true, `${at}: a camp is a ladder win only when every legend of its pool is`);
    assert.ok(c.pool && c.pool.size === POOL(ringOf(c.spec)) && c.spec.pool?.length === POOL(ringOf(c.spec)), `${at}: a pool of the ring's ${POOL(ringOf(c.spec))} legends`);
    assert.match(c.poolKind!, /^pool:(outer|middle|floor)-camp-[0-2]$/, `${at}: the database's kind is the camp's, never a legend`);
    for (const [id, m] of c.pool!) {
      const setup = fightSetup(m.fight, loaded.value);
      assert.ok(setup.ok, `${at}/${id}: fightSetup refused ${m.fight}`);
      assert.ok(m.hp >= 1 && m.roster === true, `${at}/${id}: priced and a roster fighter`);
      assert.ok(Object.hasOwn(loaded.value.local.killRows, id), `${at}/${id}: no kill row`);
      assert.ok(Object.hasOwn(loaded.value.local.creatureLoot, m.fight) || m.loot, `${at}/${id}: no loot table`);
    }
  }
});

test('a zone 7 camp shows a different legend each generation, always of its own ring band, and the whole pool in as many generations as it has legends', () => {
  const loaded = loadEncounterContent();
  assert.ok(loaded.ok);
  const rows = listedZone(DUNGEON).spawns.rows;
  for (const c of zoneSpawns(loaded.value, DUNGEON).values()) {
    const seen = new Set<string>(), ring = c.spec.spawn.split('-')[0]!;
    const band = { outer: [1, 3], middle: [4, 6], floor: [7, 10] }[ring as 'outer' | 'middle' | 'floor']!;
    for (let g = 0; g <= POOL(ring); g++) {
      const now = spawnAt(c, g), next = spawnAt(c, g + 1);
      assert.equal(now.spec.character, legendAt(c.spec.pool!, c.spec.id, g), `${c.spec.id} g${g}: the writer and the page's function agree`);
      assert.notEqual(now.spec.character, next.spec.character, `${c.spec.id}: the same legend twice running at g${g}`);
      const lvl = rows.find((r) => r.id === now.spec.character)!.level[0];
      assert.ok(lvl >= band[0]! && lvl <= band[1]!, `${c.spec.id} g${g}: ${now.spec.character} rank ${lvl} is outside the ${ring} band ${band}`);
      assert.equal(now.spec.level, lvl, `${c.spec.id} g${g}: priced at the legend's rank`);
      if (g < POOL(ring)) seen.add(now.spec.character);
    }
    assert.equal(seen.size, POOL(ring), `${c.spec.id}: ${POOL(ring)} generations show the whole pool`);
  }
});
