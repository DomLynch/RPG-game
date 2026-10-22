import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarksSettler, SETTLE_WAIT_S, MARKS_CAP } from './world-marks.ts';
import { rosterSpawnIds, zoneOfKey } from './world-spawns.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { listedZoneIds } from '../zones/listed.ts';
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
