import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db } from './db.ts';
import { BadRequest, Conflict, Refused } from './errors.ts';
import { encounterOps } from './encounter.ts';
import { ACCOUNT, CHAR, fakeDb, RESOLVED, deps, fight } from './encounter-fixtures.ts';

const ctx = (db: Db) => ({ db, account: ACCOUNT });

test('with no deps every op answers 503 "encounter verify not installed" (flag off, fail closed)', async () => {
  const ops = encounterOps(null);
  for (const op of ['encounter_start', 'encounter_touch', 'encounter_settle']) {
    await assert.rejects(async () => ops[op]!(ctx(fakeDb({ t: 0 }).db), {}), (e: unknown) => e instanceof Refused && e.status === 503 && /verify not installed/.test(e.message));
  }
});

test('start: the server resolves the fight and picks the seed; the body names no foe, level or seed; unknown fights and bad ids are refused', async () => {
  const { db, rows } = fakeDb({ t: 1e6 }), ops = encounterOps(deps());
  const out = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight', enemy: 'dragon', level: 99, seed: 1 }) as Record<string, unknown>;
  assert.equal(out.enemy, 'knight'); assert.equal(out.level, 6); assert.ok(Number.isInteger(out.seed) && (out.seed as number) !== 1);
  assert.match(String(out.token), /^[A-Za-z0-9_-]{32}$/); assert.equal(rows.size, 1);
  await assert.rejects(async () => ops.encounter_start!(ctx(fakeDb({ t: 0 }).db), { character: CHAR, encounter: 'encounter:nope' }), BadRequest);
  await assert.rejects(async () => ops.encounter_start!(ctx(db), { character: 'x', encounter: 'encounter:knight' }), BadRequest);
  await assert.rejects(async () => ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }), Conflict, 'a second open fight is refused: resume the first');
  const layered = encounterOps(deps({ resolve: () => ({ ...RESOLVED, layer: 'wolf' }) }));
  await assert.rejects(async () => layered.encounter_start!(ctx(fakeDb({ t: 0 }).db), { character: CHAR, encounter: 'encounter:knight' }), (e: unknown) => e instanceof Refused && /mob layer/.test(e.message));
});

test('touch inside the grace continues the SAME token and seed; after the expiry it is refused', async () => {
  const clock = { t: 1e6 }, { db } = fakeDb(clock), ops = encounterOps(deps());
  const first = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  clock.t += 100_000;
  const again = await ops.encounter_touch!(ctx(db), { token: first.token, tick: 400 }) as { token: string; seed: number; lastTick: number };
  assert.equal(again.token, first.token); assert.equal(again.seed, first.seed); assert.equal(again.lastTick, 400);
  clock.t += 121_000;
  await assert.rejects(async () => ops.encounter_touch!(ctx(db), { token: first.token, tick: 500 }), Conflict);
  await assert.rejects(async () => ops.encounter_touch!(ctx(db), { token: 'short' }), BadRequest);
});

test('settle: a verified record writes the event enc:<token> and the reward lines once; a replay of the same settle is refused and writes nothing more', async () => {
  const { db, events } = fakeDb({ t: 1e6 }), rewards: string[] = [];
  const ops = encounterOps(deps({ verify: () => ({ ok: true, result: 'won', twist: 'caught', ticks: 321 }), rewards: (f) => { rewards.push(f.token); return [{ op: 'reward-line', token: f.token }]; } }));
  const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  const record = fight(start.seed, 1);
  const out = await ops.encounter_settle!(ctx(db), { token: start.token, record }) as Record<string, unknown>;
  assert.equal(out.result, 'won'); assert.equal(out.verified, true); assert.equal(out.twist, 'caught'); assert.equal(out.event, `enc:${start.token}`);
  assert.equal(events.length, 1); assert.deepEqual(events[0]!.payload, { result: 'won', ticks: 321, enemy: 'knight', level: 6, twist: 'caught', verified: true }); assert.deepEqual(rewards, [start.token]);
  await assert.rejects(async () => ops.encounter_settle!(ctx(db), { token: start.token, record }), Conflict, 'settled once');
  assert.equal(events.length, 1);
});

test('settle with the REAL verifier: a record played on the issued seed settles with the sim\'s result (a loss pays nothing)', async () => {
  const { db, events } = fakeDb({ t: 1e6 }), rewards: string[] = [], ops = encounterOps(deps({ rewards: (f) => { rewards.push(f.token); return []; } }));
  const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  let record = ''; for (let k = 1; k < 120 && !record; k++) record = fight(start.seed, k, 6, 'knight', true);
  assert.ok(record, 'a finished scripted fight exists for the server\'s seed');
  const out = await ops.encounter_settle!(ctx(db), { token: start.token, record }) as Record<string, unknown>;
  assert.equal(out.verified, true, String(out.reason)); assert.equal(events.length, 1);
  assert.equal(rewards.length, out.result === 'won' ? 1 : 0);
});

test('settle: an unverifiable record is a normal loss: the token is consumed, nothing is rewarded, the reason is kept; swaps are refused', async () => {
  const { db, events } = fakeDb({ t: 1e6 }), rewards: string[] = [], ops = encounterOps(deps({ rewards: (f) => { rewards.push(f.token); return []; } }));
  const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  await assert.rejects(async () => ops.encounter_settle!(ctx(db), { token: start.token, record: 'AAAAAAAAAAAA', swaps: [120] }), (e: unknown) => e instanceof Refused && e.status === 501);
  const forged = fight(start.seed + 1, 3);   // played on a seed the server did not issue
  const out = await ops.encounter_settle!(ctx(db), { token: start.token, record: forged }) as Record<string, unknown>;
  assert.equal(out.result, 'lost'); assert.equal(out.verified, false); assert.match(String(out.reason), /seed|record/);
  assert.deepEqual(rewards, []); assert.equal(events.length, 1); assert.equal((events[0]!.payload as Record<string, unknown>).verified, false);
  const second = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string };
  const garbage = await ops.encounter_settle!(ctx(db), { token: second.token, record: 'not-a-record-at-all' }) as Record<string, unknown>;
  assert.equal(garbage.result, 'lost'); assert.match(String(garbage.reason), /unreadable record/);
});

test('settle after the expiry is refused (the sweep settles it as an abandonment); an unknown token is a 400', async () => {
  const clock = { t: 1e6 }, { db } = fakeDb(clock), ops = encounterOps(deps());
  const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  clock.t += 200_000;
  await assert.rejects(async () => ops.encounter_settle!(ctx(db), { token: start.token, record: fight(start.seed, 1) }), Conflict);
  await assert.rejects(async () => ops.encounter_settle!(ctx(db), { token: 'A'.repeat(32), record: fight(1, 1) }), BadRequest);
});
