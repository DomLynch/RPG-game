import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarksSettler, MARKS_CAP, rosterInstances, SETTLE_WAIT_S } from './world-marks.ts';
import { rosterSpawnIds } from './world-spawns.ts';
import { listedZone, listedZoneIds } from '../zones/listed.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { BETA_MAX_LEVEL } from '../../src/core/server.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };
import type { Db } from './db.ts';

// The settler sends the rows to the database and nothing else; the arithmetic, the cap and the per-hour brake are the database's, proven on a real PostgreSQL by scripts/origins-world-marks-check.mjs.
const fake = (opts: { absent?: boolean; marks?: number } = {}): { sent: Record<string, string>[]; db: Db } => {
  const sent: Record<string, string>[] = [];
  return { sent, db: { async run(sql: string, v: Record<string, string> = {}) { if (/origins_world_marks_settle/.test(sql)) { sent.push(v); return opts.absent ? 'absent' : String(opts.marks ?? 0); } return ''; } } as unknown as Db };
};

test('the rows: ofTop 0.5 beside the credit threshold, the wait is the join window plus the grace, the cap is the beta cut on total marks, 6 an hour', () => {
  const r = SERVER_RULES.worldMarks[0]!, s = SERVER_RULES.worldShare[0]!;
  assert.deepEqual([r.ofTop, r.graceS, r.everyS, r.batch, r.perHour], [0.5, 5, 60, 50, 6]);
  assert.ok(r.ofTop > s.qualifyOfTop, 'a mark asks for more than the credit does');
  assert.equal(SETTLE_WAIT_S, s.joinWindowS + r.graceS);
  assert.equal(MARKS_CAP, BETA_MAX_LEVEL - 1, 'level = 1 + marks, so the cut on marks is one below the cut on levels');
});

test('a settle sends the rule and the roster ids and logs what it wrote', async () => {
  const f = fake({ marks: 3 }), logs: string[] = [];
  const n = await createMarksSettler(f.db, () => ['roster-1', 'z2:roster-9'], 1000, (m) => logs.push(m)).settle();
  assert.equal(n, 3);
  assert.deepEqual(f.sent, [{ w: String(SETTLE_WAIT_S), o: '0.5', c: String(MARKS_CAP), h: '6', i: '["roster-1","z2:roster-9"]', n: '50' }]);
  assert.match(logs[0]!, /settled 3 ladder marks/);
});

test('no roster spawn loaded: nothing is sent, nothing is a ladder win', async () => {
  const f = fake({ marks: 9 });
  assert.equal(await createMarksSettler(f.db, () => [], 1000, () => {}).settle(), 0);
  assert.deepEqual(f.sent, []);
});

test('the migration not applied: null and silent; a database error is skipped and logged, never thrown; one settle at a time', async () => {
  const logs: string[] = [];
  assert.equal(await createMarksSettler(fake({ absent: true }).db, () => ['r'], 1000, (m) => logs.push(m)).settle(), null);
  assert.equal(logs.length, 0);
  const boom = { async run() { throw new Error('db down'); } } as unknown as Db;
  assert.equal(await createMarksSettler(boom, () => ['r'], 1000, (m) => logs.push(m)).settle(), null);
  assert.match(logs[0]!, /skipped, nothing settled: db down/);
  let release = (): void => {}; const gate = new Promise<void>((r) => { release = r; });
  const f = fake();
  const held = { async run(sql: string, v: Record<string, string> = {}) { await gate; return f.db.run(sql, v); } } as unknown as Db;
  const j = createMarksSettler(held, () => ['r'], 1000, () => {}), first = j.settle(), second = await j.settle();
  assert.equal(second, null); release(); await first; assert.equal(f.sent.length, 1);
});

test('the roster is the spawn rows flagged roster: true, nothing else', async () => {
  assert.deepEqual(rosterInstances([{ spec: { id: 'a' } }, { spec: { id: 'b' }, roster: true }, { spec: { id: 'c' }, roster: false }]), ['b']);
  const loaded = loadEncounterContent();
  assert.ok(loaded.ok);
  // The shipped rows decide the count (Combat's Dungeon 1 ring roster, origins/dungeon/bowl-roster.ts, writes zone 7's): none of a LISTED zone's rows is a roster fighter = no roster spawn; once a listed zone ships roster rows (zone 7 when World lists it), it has roster spawns.
  const ids = rosterSpawnIds(loaded.value), listedRoster = listedZoneIds().flatMap((z) => listedZone(z).spawns.rows.filter((r) => r.roster === true).map((r) => r.id));
  if (listedRoster.length === 0) assert.deepEqual(ids, [], 'no listed zone ships a roster row yet, so no spawn is a roster fighter');
  else assert.ok(ids.length > 0, `listed zones ship roster rows (${listedRoster.length}), so their instances are roster spawns`);
  assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0), 'every roster spawn id is a spawn key');
});
