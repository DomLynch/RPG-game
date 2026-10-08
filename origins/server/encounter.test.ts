import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DbError, type Db } from './db.ts';
import { BadRequest, Conflict, Refused } from './errors.ts';
import { derivedSeed, encounterOps, fightOfToken, poseOfToken, POSED_FIGHT_MAX, tokenFor } from './encounter.ts';
import { issuePose, isLegalPose, MARK_GAP, MIN_GAP, poseBounds } from './encounter-pose.ts';
import { verifyEncounter } from './encounter-verify.ts';
import { decodeRecord } from '../../src/record.ts';
import { roundPose, type DuelPose } from '../../src/duel.ts';
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
  assert.match(String(out.token), /^[A-Za-z0-9_-]{16,128}$/); assert.equal(rows.size, 1);
  assert.equal(fightOfToken(String(out.token)), 'encounter:knight', 'the token carries the fight the server resolved, so settle can price it');
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
  const ops = encounterOps(deps({ verify: () => ({ ok: true, result: 'won', twist: 'caught', ticks: 321 }), rewards: (f, rdb) => { rewards.push(f.token); assert.equal(f.fight, 'encounter:knight', 'the hook is told the fight the server resolved'); assert.equal(f.seed, start.seed, 'and the server seed'); assert.equal(rdb, db); return [{ op: 'reward-line', token: f.token }]; } }));
  let start = { token: '', seed: 0 };
  start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  const record = fight(start.seed, 1);
  const out = await ops.encounter_settle!(ctx(db), { token: start.token, record }) as Record<string, unknown>;
  assert.equal(out.result, 'won'); assert.equal(out.verified, true); assert.equal(out.twist, 'caught'); assert.equal(out.event, `enc:${start.token}`);
  assert.equal(events.length, 1); assert.deepEqual(events[0]!.payload, { result: 'won', ticks: 321, enemy: 'knight', level: 6, twist: 'caught', verified: true, fight: 'encounter:knight', paid: true }); assert.deepEqual(rewards, [start.token]);
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

test('fightOfToken: the server-made prefix reads back; an old 32-character token, a forged prefix and a non-fight id read as null', () => {
  for (const fight of ['encounter:knight', 'character:cinder-scavenger', 'a'.repeat(64)]) { const t = tokenFor(fight); assert.match(t, /^[A-Za-z0-9_-]{16,128}$/); assert.equal(fightOfToken(t), fight); }
  assert.equal(fightOfToken('A'.repeat(32)), null, 'a token issued before the prefix');
  assert.equal(fightOfToken(`${Buffer.from('Not A Fight!').toString('base64url')}_${'B'.repeat(32)}`), null, 'decodes to something that is not a fight id');
  assert.equal(fightOfToken(`x${'_'.repeat(1)}${'C'.repeat(31)}`), null, 'too short for a prefix');
});

test('a stale reward line (O0002 at settle) is a retryable 503 code "stale", never a 409; nothing is written, and the same token settles on the retry', async () => {
  const { db, events } = fakeDb({ t: 1e6 });
  let stale = true;
  const flaky = { run: async (sql: string, v?: Record<string, string>) => { if (stale && /origins_encounter_settle/.test(sql)) { stale = false; throw new DbError('O0002', 'career write is stale'); } return db.run(sql, v); } } as Db;
  const ops = encounterOps(deps({ verify: () => ({ ok: true, result: 'won', twist: null, ticks: 200 }), rewards: () => [{ op: 'reward-line' }] }));
  const start = await ops.encounter_start!(ctx(flaky), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  const record = fight(start.seed, 1);
  await assert.rejects(async () => ops.encounter_settle!(ctx(flaky), { token: start.token, record }), (e: unknown) => e instanceof Refused && e.status === 503 && e.code === 'stale');
  assert.equal(events.length, 0, 'nothing written');
  const out = await ops.encounter_settle!(ctx(flaky), { token: start.token, record }) as Record<string, unknown>;
  assert.equal(out.verified, true); assert.equal(events.length, 1, 'the retry on the very same token settles it');
});

test('settle with a record from another mob kit: 422 kit-mismatch, the token is NOT consumed and nothing is written (not a loss)', async () => {
  const clock = { t: 1e6 }, { db, rows, events } = fakeDb(clock), ops = encounterOps(deps({ resolve: () => ({ ...RESOLVED, layer: 'brute' }) }));
  const out = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  await assert.rejects(async () => ops.encounter_settle!(ctx(db), { token: out.token, record: fight(out.seed, 1, 6, 'knight', false, 'test kit:zzz') }), (e: unknown) => e instanceof Refused && e.status === 422 && e.code === 'kit-mismatch' && /kit mismatch/.test(e.message));
  assert.equal(events.length, 0, 'no event, so no loss');
  assert.equal(rows.get(out.token)!.used, false, 'the token stays open for the sweep');
});

// Seamless step 3 (RV38): the server issues the start pose, the token carries it, settle re-simulates from it and refuses any other.
test('start with a pose: the server issues a legal, float32 pose (gap clamped, inside the circle, the hero facing the foe); touch hands the same pose back', async () => {
  const { db } = fakeDb({ t: 0 }), ops = encounterOps(deps());
  const out = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight', pose: { hero: { x: 8, z: 0 }, foe: { x: 8.3, z: 0 } } }) as { token: string; pose: DuelPose };
  const { radius } = poseBounds('knight'), p = out.pose;
  assert.deepEqual(p, roundPose(p), 'float32 bits');
  const gap = Math.hypot(p.foe.x - p.hero.x, p.foe.z - p.hero.z);
  assert.ok(gap >= MIN_GAP - 1e-5, `gap ${gap} widened to the minimum`);
  for (const q of [p.hero, p.foe]) assert.ok(Math.hypot(q.x, q.z) < radius, 'inside the wall');
  assert.ok(Math.abs(p.heroFacing - Math.fround(Math.atan2(p.foe.x - p.hero.x, p.foe.z - p.hero.z))) < 1e-6, 'the hero faces the foe');
  assert.deepEqual(poseOfToken(out.token), p, 'the token carries it');
  const again = await ops.encounter_touch!(ctx(db), { token: out.token, tick: 5 }) as { pose: DuelPose };
  assert.deepEqual(again.pose, p);
  await assert.rejects(async () => ops.encounter_start!(ctx(fakeDb({ t: 0 }).db), { character: CHAR, encounter: 'encounter:knight', pose: { hero: { x: 'a', z: 0 }, foe: { x: 1, z: 1 } } }), BadRequest);
});

test('issuePose: a far pair is pulled to the widest gap, an Arena 1 foe gets its small circle, a pose a few metres apart keeps its places', () => {
  const far = issuePose('knight', { hero: { x: -30, z: 0 }, foe: { x: 30, z: 0 } })!;
  assert.ok(Math.abs(Math.hypot(far.foe.x - far.hero.x, far.foe.z - far.hero.z) - MARK_GAP) < 1e-5);
  const small = poseBounds('veteran');
  assert.ok(small.radius < 4 && small.maxGap === MARK_GAP * 0.5);
  const v = issuePose('veteran', { hero: { x: 5, z: 5 }, foe: { x: 9, z: 9 } })!;
  for (const q of [v.hero, v.foe]) assert.ok(Math.hypot(q.x, q.z) < small.radius);
  const kept = issuePose('knight', { hero: { x: 1, z: -1 }, foe: { x: 1, z: 2 } })!;
  assert.deepEqual([kept.hero, kept.foe], [{ x: 1, z: -1 }, { x: 1, z: 2 }]);
  assert.equal(issuePose('knight', undefined), undefined);
});

test('settle a posed fight with the REAL verifier: the issued pose verifies; another pose, no pose, or a pose on an unposed token is refused (a loss, nothing paid)', async () => {
  const { db, events } = fakeDb({ t: 1e6 }), paid: string[] = [], ops = encounterOps(deps({ rewards: (f) => { paid.push(f.token); return []; } }));
  const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight', pose: { hero: { x: -2, z: 1 }, foe: { x: 2, z: -1 } } }) as { token: string; seed: number; pose: DuelPose };
  const run = (pose?: DuelPose) => { let r = ''; for (let k = 1; k < 120 && !r; k++) r = fight(start.seed, k, 6, 'knight', true, undefined, pose); return r; };
  const record = run(start.pose); assert.ok(record);
  const moved = { ...start.pose, hero: { ...start.pose.hero, x: Math.fround(start.pose.hero.x + 0.5) } };
  for (const bad of [run(moved), run(undefined)]) {
    const v = verifyEncounter(await decodeRecord(bad), { seed: start.seed, enemy: 'knight', level: 6, bar: null, flags: [], layer: null, pose: start.pose });
    assert.equal(v.ok, false); assert.match(!v.ok ? v.reason : '', /pose/);
  }
  const unposed = verifyEncounter(await decodeRecord(record), { seed: start.seed, enemy: 'knight', level: 6, bar: null, flags: [], layer: null, pose: null });
  assert.equal(unposed.ok, false, 'a posed record on a token issued without a pose');
  const out = await ops.encounter_settle!(ctx(db), { token: start.token, record }) as Record<string, unknown>;
  assert.equal(out.verified, true, String(out.reason)); assert.equal(events.length, 1);
  assert.equal(paid.length, out.result === 'won' ? 1 : 0);
});

test('a fight with no pose is today\'s: the token has no pose block, the answer has no pose key, and a pose-free record verifies as before', async () => {
  const { db } = fakeDb({ t: 0 }), ops = encounterOps(deps());
  const out = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as Record<string, unknown>;
  assert.equal('pose' in out, false); assert.equal(poseOfToken(out.token as string), null);
  assert.equal(Buffer.from((out.token as string).slice(0, -33), 'base64url').toString(), 'encounter:knight', 'the prefix is the fight id alone, as before');
  const posed = tokenFor('encounter:knight', issuePose('knight', { hero: { x: 0, z: -3 }, foe: { x: 0, z: 3 } }));
  assert.match(posed, /^[A-Za-z0-9_-]{16,128}$/); assert.equal(fightOfToken(posed), 'encounter:knight');
  assert.match(tokenFor('a'.repeat(POSED_FIGHT_MAX), issuePose('knight', { hero: { x: 0, z: 0 }, foe: { x: 0, z: 3 } })), /^[A-Za-z0-9_-]{16,128}$/, 'the longest posed fight id still fits the token cap');
});

// S3 legal-pose settle (Strategy 2026-10-08, accepted knowingly; the Auditor's tamper list): a POSELESS world token may settle a record whose pose is a strict fixed point of issuePose.
test('issuePose is a fixed point of its own output, bit for bit (an honest client is never refused on an ulp), and every issued pose is legal', () => {
  let s = 0x2545f491; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (const enemy of ['knight', 'veteran', 'wolf']) for (let i = 0; i < 3000; i++) {
    const span = [0.5, 4, 12, 40][i % 4]!, p = { hero: { x: (rnd() * 2 - 1) * span, z: (rnd() * 2 - 1) * span }, foe: { x: (rnd() * 2 - 1) * span, z: (rnd() * 2 - 1) * span } };
    const once = issuePose(enemy, p)!, twice = issuePose(enemy, once)!;
    for (const [a, b] of [[once.hero.x, twice.hero.x], [once.hero.z, twice.hero.z], [once.foe.x, twice.foe.x], [once.foe.z, twice.foe.z], [once.heroFacing, twice.heroFacing]]) assert.ok(Object.is(a, b), `${enemy} #${i}: ${a} !== ${b}`);
    assert.ok(isLegalPose(enemy, once), `${enemy} #${i}: the issued pose is legal`);
  }
});

test('isLegalPose refuses: a gap under 2 m or over the foe\'s max, a fighter outside the circle, a facing not derived from the points, a value that is not float32', () => {
  const ok = issuePose('knight', { hero: { x: 0, z: -2 }, foe: { x: 0, z: 2 } })!;
  assert.equal(isLegalPose('knight', ok), true);
  const at = (hero: { x: number; z: number }, foe: { x: number; z: number }) => roundPose({ hero, foe, heroFacing: Math.atan2(foe.x - hero.x, foe.z - hero.z) });
  assert.equal(isLegalPose('knight', at({ x: 0, z: -0.75 }, { x: 0, z: 0.75 })), false, 'gap 1.5 m < 2');
  assert.equal(isLegalPose('knight', at({ x: 0, z: -4 }, { x: 0, z: 4 })), false, 'gap 8 m > 6.5');
  assert.equal(isLegalPose('veteran', at({ x: 0, z: -2 }, { x: 0, z: 2 })), false, 'gap 4 m > an Arena 1 foe\'s 3.25');
  assert.equal(isLegalPose('knight', at({ x: 8.6, z: 0 }, { x: 8.6, z: 3 })), false, 'outside the 8.55 m circle');
  assert.equal(isLegalPose('veteran', at({ x: 3.5, z: 0 }, { x: 3.5, z: 2.5 })), false, 'outside an Arena 1 foe\'s 3.79 m circle');
  assert.equal(isLegalPose('knight', { ...ok, heroFacing: Math.fround(ok.heroFacing + 0.25) }), false, 'a facing the points do not give');
  assert.equal(isLegalPose('knight', { ...ok, hero: { x: 0.1, z: -2 } }), false, 'not float32 (0.1)');
});

test('settle a poseless WORLD token with a legal pose: verified (the fight starts from that pose); an illegal pose is a loss; a replay is 409; a non-world fight refuses any pose', async () => {
  const { db, events } = fakeDb({ t: 1e6 }), ops = encounterOps(deps());
  const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number; pose?: DuelPose };
  assert.equal(start.pose, undefined, 'poseless (a prefetched token)');
  const legal = issuePose('knight', { hero: { x: -1.5, z: 2 }, foe: { x: 1.5, z: -1 } })!;
  const run = (pose: DuelPose) => { let r = ''; for (let k = 1; k < 120 && !r; k++) r = fight(start.seed, k, 6, 'knight', true, undefined, pose); return r; };
  const params = { seed: start.seed, enemy: 'knight', level: 6, bar: null, flags: [], layer: null, pose: null, freePose: true };
  const tooClose = roundPose({ hero: { x: 0, z: -0.6 }, foe: { x: 0, z: 0.6 }, heroFacing: 0 });
  const bad = verifyEncounter(await decodeRecord(run(tooClose)), params);
  assert.equal(bad.ok, false); assert.match(!bad.ok ? bad.reason : '', /pose the server would not issue/);
  const record = run(legal); assert.ok(record);
  assert.equal(verifyEncounter(await decodeRecord(record), { ...params, freePose: false }).ok, false, 'freePose off: a pose on a poseless token is refused, as before');
  const out = await ops.encounter_settle!(ctx(db), { token: start.token, record }) as Record<string, unknown>;
  assert.equal(out.verified, true, String(out.reason)); assert.equal(events.length, 1);
  await assert.rejects(async () => ops.encounter_settle!(ctx(db), { token: start.token, record }), Conflict, 'a replay of the same settle is 409');
  const pit = encounterOps(deps({ resolve: (_w, id) => (id === 'encounter:knight' ? { ...RESOLVED, world: false } : null) })), db2 = fakeDb({ t: 1e6 }).db;
  const s2 = await pit.encounter_start!(ctx(db2), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
  let r2 = ''; for (let k = 1; k < 120 && !r2; k++) r2 = fight(s2.seed, k, 6, 'knight', true, undefined, legal);
  const out2 = await pit.encounter_settle!(ctx(db2), { token: s2.token, record: r2 }) as Record<string, unknown>;
  assert.equal(out2.verified, false); assert.match(String(out2.reason), /not issued/);
});

// Dom's world-fight rule (migration 202610080013): the creature keeps its fight (a derived seed), and a world stalemate or unverified record records nothing.
test('seed with 0013: derived from the key, account, fight and last paid kill; the same across restarts; a kill, another account or another fight changes it; no key = 503; without 0013 random', async () => {
  const key = 'k'.repeat(64), two = (_w: unknown, id: string) => (id === 'encounter:knight' || id === 'encounter:knight-b' ? RESOLVED : null);
  const startOn = async (killAt: string | null | undefined, account = ACCOUNT, encounter = 'encounter:knight', over: Partial<Parameters<typeof deps>[0]> = { seedKey: key }) => {
    const ops = encounterOps(deps({ resolve: two, ...over }));
    return (await ops.encounter_start!({ db: fakeDb({ t: 0 }, killAt).db, account }, { character: CHAR, encounter }) as { seed: number }).seed;
  };
  const s0 = await startOn(null);
  assert.equal(await startOn(null), s0, 'walk away / expire / restart: the same seed (no paid kill in between)');
  assert.equal(s0, derivedSeed(key, ACCOUNT, 'encounter:knight', null));
  assert.notEqual(await startOn('1760000000123'), s0, 'a paid kill (its respawn) brings a new seed');
  assert.equal(await startOn('1760000000123'), await startOn('1760000000123'), 'and that one is stable too');
  assert.notEqual(await startOn(null, '22222222-2222-4222-8222-222222222222'), s0, 'another account: another seed');
  assert.notEqual(await startOn(null, ACCOUNT, 'encounter:knight-b'), s0, 'another fight kind: another seed');
  assert.ok(s0 >= 1 && s0 < 2 ** 31);
  await assert.rejects(async () => startOn(null, ACCOUNT, 'encounter:knight', {}), (e: unknown) => e instanceof Refused && e.status === 503 && /seed key/.test(e.message), '0013 applied but no key: 503, never a random fallback');
  const r1 = await startOn(undefined, ACCOUNT, 'encounter:knight', {}), r2 = await startOn(undefined, ACCOUNT, 'encounter:knight', {});
  assert.ok(r1 >= 1 && r2 >= 1 && (r1 !== r2 || r1 !== (await startOn(undefined, ACCOUNT, 'encounter:knight', {}))), 'without 0013: random seeds, no key needed (a walk-away still costs a loss there)');
});

test('settle with 0013: an unverified WORLD record records nothing (no loss, event null); a non-world fight or a database without 0013 records it as before', async () => {
  const bad = (seed: number) => fight(seed + 1, 1, 6, 'knight', false);   // played on another seed: never verifies
  const run = async (killAt: string | null | undefined, world: boolean) => {
    const { db, events } = fakeDb({ t: 1e6 }, killAt), ops = encounterOps(deps({ seedKey: 'k'.repeat(64), resolve: (_w, id) => (id === 'encounter:knight' ? { ...RESOLVED, world } : null) }));
    const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: 'encounter:knight' }) as { token: string; seed: number };
    const out = await ops.encounter_settle!(ctx(db), { token: start.token, record: bad(start.seed) }) as Record<string, unknown>;
    return { out, events: events.length };
  };
  const quiet = await run(null, true);
  assert.deepEqual([quiet.out.verified, quiet.out.event, quiet.events], [false, null, 0], 'world + 0013: nothing recorded');
  const pit = await run(null, false);
  assert.deepEqual([pit.out.verified, pit.events], [false, 1], 'a non-world fight: the loss is recorded as today');
  const before = await run(undefined, true);
  assert.deepEqual([before.out.verified, before.events], [false, 1], 'without 0013: recorded as today (a free outcome would re-roll a random seed)');
});
