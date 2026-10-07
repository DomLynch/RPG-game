import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPractice, stepPractice } from '../../src/combat.ts';
import { OPPONENTS, opponentAt, profileAt } from '../../src/moves.ts';
import { gzipSync } from 'node:zlib';
import { createRecorder, packRecord, RECORD_VERSION, toBase64Url } from '../../src/record.ts';
import { recordSpecials } from '../../src/replay.ts';
import { DbError, type Db } from './db.ts';
import { BadRequest, Conflict, Refused } from './errors.ts';
import { encounterOps, type EncounterDeps } from './encounter.ts';
import { liveSpecials, verifyEncounter } from './encounter-verify.ts';
import { kitBuild } from '../mobs/kit-version.ts';

const ACCOUNT = '11111111-1111-4111-8111-111111111111', CHAR = 'pc:one';

// An in-memory stand-in for the 202610080002 functions, with the same rules the SQL has: one open fight per account and per instance, token consumed once, expiry, settle applies the batch.
type Row = { token: string; character: string; seed: number; enemy: string; level: number; start_tick: number; last_tick: number; bar: number | null; flags: unknown[]; layer: string | null; instance: string | null; expires: number; used: boolean; settled: boolean; result: string | null };
let clock = { t: 0 };   // the fake database's clock, also what the handler's expiry pre-check reads
function fakeDb(now: { t: number }) {
  clock = now;
  const rows = new Map<string, Row>(), events: Record<string, unknown>[] = [];
  const live = (r: Row) => !r.used && !r.settled && r.expires > now.t;
  const json = (r: Row) => JSON.stringify({ token: r.token, character: r.character, seed: r.seed, enemy: r.enemy, level: r.level, expires_at: new Date(r.expires).toISOString(), used: r.used, start_tick: r.start_tick, last_tick: r.last_tick, bar: r.bar, flags: r.flags, layer: r.layer, instance: r.instance, grace_s: 120, settled: r.settled, result: r.result });
  const db: Db = {
    async run(sql, v = {}) {
      const call = /public\.(origins_encounter_\w+)\(/.exec(sql.split('\\if :enc')[1] ?? sql)?.[1];   // after the psql "is it installed" guard
      if (call === 'origins_encounter_start') {
        if ([...rows.values()].some((r) => live(r))) throw new DbError('O0014', 'a fight is already open for this account: resume it');
        if (v.i && [...rows.values()].some((r) => live(r) && r.instance === v.i)) throw new DbError('O0014', `creature ${v.i} is in another fight`);
        const r: Row = { token: v.t!, character: v.c!, seed: Number(v.s), enemy: v.e!, level: Number(v.l), start_tick: Number(v.k), last_tick: Number(v.k), bar: v.b ? Number(v.b) : null, flags: JSON.parse(v.f!), layer: v.y || null, instance: v.i || null, expires: now.t + 120_000, used: false, settled: false, result: null };
        rows.set(r.token, r); return json(r);
      }
      const r = rows.get(v.t!);
      if (call === 'origins_encounter_get') return r ? json(r) : 'null';
      if (call === 'origins_encounter_touch') {
        if (!r || !live(r)) throw new DbError('O0009', 'encounter token unknown, used or expired');
        r.last_tick = Math.max(r.last_tick, Number(v.k)); r.expires = now.t + 120_000; return json(r);
      }
      if (call === 'origins_encounter_settle') {
        if (!r || !live(r)) throw new DbError('O0009', 'encounter token unknown, used or expired');
        const batch = JSON.parse(v.b!) as Record<string, unknown>[];
        for (const op of batch) if (op.op === 'event') { if (events.some((e) => e.event_id === op.event_id)) throw new DbError('O0001', 'already settled'); }
        r.used = true; r.settled = true; r.result = v.r!; events.push(...batch.filter((o) => o.op === 'event')); return '[]';
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
  return { db, rows, events };
}

const RESOLVED = { enemy: 'knight', level: 6, bar: null, flags: [], layer: null, instance: null };
const deps = (over: Partial<EncounterDeps> = {}): EncounterDeps => ({ resolve: (_w, id) => (id === 'encounter:knight' ? RESOLVED : null), verify: verifyEncounter, now: () => clock.t, ...over });

// The client: plays the fight with the server's seed, records it as the Pit's recorder does, packs it for the wire.
function fight(seed: number, intentSeed: number, level = 6, enemy: 'knight' = 'knight', onlyFinished = false, build = kitBuild('test')): string {
  let s = intentSeed >>> 0; const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const specials = liveSpecials(level), profile = profileAt(OPPONENTS[enemy], level);
  const rec = createRecorder({ build, opponent: enemy, weapon: 'longsword', level, seed, ...(specials ? { specials: true } : {}) });
  let p = initialPractice(seed, opponentAt(OPPONENTS[enemy], level), 'longsword', null, recordSpecials({ specials, level, opponent: enemy }));
  for (let i = 0; i < 1500 && !p.finish; i++) p = stepPractice(p, rec.push({ move: { x: Math.round(rand() * 2 - 1), z: 1, yaw: 0, run: false }, action: rand() < 0.5 ? 'light' : null, guard: rand() < 0.1, lock: true }), profile);
  if (onlyFinished && !p.finish) return '';   // a scripted fight that never ended has no verifiable record
  const record = rec.finish(p.finish ? (p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned');
  return toBase64Url(gzipSync(packRecord({ ...record, v: RECORD_VERSION })));   // as verify-loot packs a claim: the current version
}
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

test('settle with a record from another mob kit: 422 kit-mismatch, the token is NOT consumed and nothing is written (not a loss)', async () => {
  const clock = { t: 1e6 }, { db, rows, events } = fakeDb(clock), ops = encounterOps(deps({ resolve: () => ({ ...RESOLVED, layer: 'brute' }) }));
  const out = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  await assert.rejects(async () => ops.encounter_settle!(ctx(db), { token: out.token, record: fight(out.seed, 1, 6, 'knight', false, 'test kit:zzz') }), (e: unknown) => e instanceof Refused && e.status === 422 && e.code === 'kit-mismatch' && /kit mismatch/.test(e.message));
  assert.equal(events.length, 0, 'no event, so no loss');
  assert.equal(rows.get(out.token)!.used, false, 'the token stays open for the sweep');
});
