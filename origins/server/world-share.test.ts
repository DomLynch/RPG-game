import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { PC } from '../../src/core/server.ts';
import { worldSpawnOps, defaultZoneSpawns, type Spawn } from './world-spawns.ts';
import { portion } from './damage-share.ts';
import type { Verdict, VerifyJob } from './world-verify.ts';
import type { CareerRow, Json } from './store.ts';
import type { Db } from './db.ts';
import { Refused } from './errors.ts';

// Kill credit by damage at the writer (damageShare on): the check first (winner-first), the replay's damage, the share, the share-scaled payout, the join. A fake database; the real functions are
// proven on a disposable cluster by scripts/origins-damage-share-check.mjs.
const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const content = loaded.value;
const base = [...defaultZoneSpawns(content).values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };
const spawns = new Map([[wolf.spec.id, wolf]]);
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', TOKEN = 'T'.repeat(32);
const row = (): CareerRow => ({ seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 });
const open = { token: TOKEN, character: PC, instance: wolf.spec.id, generation: 0, issuedAt: '2026-10-08T10:00:00Z', expiresAt: '2026-10-08T10:02:00Z' };

type Stub = { kills: { fn: string; b: Json[]; d?: string }[]; checks: number; db: Db };
function stub(opts: { mode?: 'first' | 'join'; refused?: string; prior?: { token: string; damage: number; joined: boolean }[]; absent?: boolean } = {}): Stub {
  const s: Stub = { kills: [], checks: 0, db: null as unknown as Db };
  s.db = { async run(sql, v = {}) {
    const call = sql.includes('\\if :') ? sql.slice(sql.indexOf('\\if :')) : sql;   // the call, not the has-function probe above it
    if (/origins_spawn_check\(/.test(call)) { s.checks++; return opts.absent ? 'absent' : JSON.stringify(opts.refused ? { refused: opts.refused } : { ok: true, mode: opts.mode ?? 'first', instance: wolf.spec.id, generation: 0 }); }
    if (/origins_spawn_damage_read\(/.test(call)) return opts.absent ? 'absent' : JSON.stringify(opts.prior ?? []);
    if (/origins_spawn_kill_v2\(/.test(call)) { s.kills.push({ fn: 'v2', b: JSON.parse(v.b!), d: v.d }); return JSON.stringify({ result: 'killed', instance: wolf.spec.id, respawnAt: 'R', joined: opts.mode === 'join' }); }
    if (/origins_spawn_kill\(/.test(call)) { s.kills.push({ fn: 'v1', b: JSON.parse(v.b!) }); return JSON.stringify({ result: 'killed', instance: wolf.spec.id, respawnAt: 'R' }); }
    if (/origins_spawn_engage_get\(/.test(call)) return JSON.stringify(open);
    if (/origins_spawn_/.test(call)) return 'null';
    if (/origins_metal_of/.test(sql)) return 'absent';
    return JSON.stringify({ marks: 0, career: row(), characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: [], quests: [], journal: [], talk: [] });
  } };
  return s;
}
const ctx = (db: Db) => ({ db, account: UID });
const verdict = (damage: number): Verdict => ({ ok: true, ticks: 100, damage });
const mk = (verifyRecord: (j: VerifyJob) => Promise<Verdict>, extra: object = {}) => worldSpawnOps({ content, damageShare: true, verifyRecord, spawns, seed: () => 7, now: () => new Date('2026-10-08T10:01:00Z'), log: () => {}, ...extra });
const cpOf = (b: Json[]): number => (b[0]!.payload as { cp: number }).cp;
const payload = (b: Json[]): Record<string, unknown> => b[0]!.payload as Record<string, unknown>;

test('a solo kill pays 100% and records its damage; the kill goes through the v2 function', async () => {
  const s = stub(), full = await mk(async () => verdict(wolf.hp)).kill_report!(ctx(s.db), { token: TOKEN, hits: 50, record: 'r' }) as { share: number; joined: boolean };
  assert.equal(full.share, 1); assert.equal(full.joined, false);
  assert.equal(s.kills.length, 1); assert.equal(s.kills[0]!.fn, 'v2'); assert.equal(Number(s.kills[0]!.d), wolf.hp);
  assert.equal(payload(s.kills[0]!.b).share, 1); assert.equal(payload(s.kills[0]!.b).record, 'verified');
});

test('kill steal: a report whose verified damage is 20% of the top share gets 20% of the CP, and loot only on the share', async () => {
  const whole = stub(); await mk(async () => verdict(wolf.hp)).kill_report!(ctx(whole.db), { token: TOKEN, hits: 50, record: 'r' });
  const steal = stub({ prior: [{ token: 'top-contributor-token-xx', damage: wolf.hp * 0.8, joined: false }] });
  const got = await mk(async () => verdict(wolf.hp * 0.2)).kill_report!(ctx(steal.db), { token: TOKEN, hits: 50, record: 'r' }) as { share: number };
  assert.ok(Math.abs(got.share - 0.2) < 1e-9, `share ${got.share}`);   // 20 of (80 + 20): the last blow earns its share, nothing more
  assert.ok(cpOf(whole.kills[0]!.b) >= 5, 'a whole kill pays enough CP for a 20% share to be told apart from nothing');
  assert.equal(cpOf(steal.kills[0]!.b), portion(cpOf(whole.kills[0]!.b), 0.2), 'the CP is the share of the whole kill\'s');
  const lootOf = (k: Stub): number => k.kills[0]!.b.filter((o) => o.op === 'mint').length;
  assert.ok(lootOf(steal) <= lootOf(whole), 'loot is thinned by the share, never added to');
});

test('a report under 25% of the top share earns nothing (the event only), and the spawn is still consumed', async () => {
  const s = stub({ prior: [{ token: 'top-contributor-token-xx', damage: wolf.hp * 0.9, joined: false }] });
  const got = await mk(async () => verdict(wolf.hp * 0.1)).kill_report!(ctx(s.db), { token: TOKEN, hits: 50, record: 'r' }) as { share: number };
  assert.equal(got.share, 0);
  assert.deepEqual(s.kills[0]!.b.map((o) => o.op), ['event']);
});

test('interim: a full bar alone is a solo kill at 100% even when another contributor also dealt a full bar', async () => {
  const s = stub({ mode: 'join', prior: [{ token: 'first-reporter-token-xxx', damage: wolf.hp, joined: false }] });
  const got = await mk(async () => verdict(wolf.hp)).kill_report!(ctx(s.db), { token: TOKEN, hits: 50, record: 'r' }) as { share: number; joined: boolean };
  assert.equal(got.share, 1); assert.equal(got.joined, true);
  assert.ok(s.kills[0]!.b.some((o) => o.op === 'career_set') || cpOf(s.kills[0]!.b) === 0, 'it is paid like a whole kill');
});

test('winner-first: a report the database would refuse costs no replay and writes nothing', async () => {
  let replays = 0; const s = stub({ refused: 'dead' });
  await assert.rejects(() => Promise.resolve(mk(async () => { replays++; return verdict(wolf.hp); }).kill_report!(ctx(s.db), { token: TOKEN, hits: 50, record: 'r' })), (e: unknown) => e instanceof Refused && e.status === 409);
  assert.equal(replays, 0); assert.equal(s.kills.length, 0); assert.equal(s.checks, 1);
});

test('the per-account queued-replay cap: a third concurrent report is not replayed (it pays as an unreplayed kill)', async () => {
  let replays = 0; const release: (() => void)[] = [];
  const ops = mk(() => { replays++; return new Promise<Verdict>((res) => release.push(() => res(verdict(wolf.hp)))); });
  const a = ops.kill_report!(ctx(stub().db), { token: TOKEN, hits: 50, record: 'r' }), b = ops.kill_report!(ctx(stub().db), { token: TOKEN, hits: 50, record: 'r' });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(replays, 2, 'both first reports are in the replay queue');
  const s3 = stub(), c = await ops.kill_report!(ctx(s3.db), { token: TOKEN, hits: 50, record: 'r' }) as { share: number };
  assert.equal(replays, 2, 'two replays queued, the third skipped');
  assert.equal(c.share, 1); assert.equal(payload(s3.kills[0]!.b).record, 'replay-capped');
  release.forEach((f) => f()); await Promise.all([a, b]);
});

test('the migration not applied: the old way (v1 kill, no share fields), nothing breaks', async () => {
  const s = stub({ absent: true });
  const got = await mk(async () => verdict(wolf.hp)).kill_report!(ctx(s.db), { token: TOKEN, hits: 50, record: 'r' }) as Record<string, unknown>;
  assert.equal(s.kills[0]!.fn, 'v1'); assert.equal(got.share, undefined);
});

test('damageShare off: byte-for-byte the old path (no check, v1 kill)', async () => {
  const s = stub();
  await mk(async () => verdict(wolf.hp), { damageShare: false }).kill_report!(ctx(s.db), { token: TOKEN, hits: 50 });
  assert.equal(s.checks, 0); assert.equal(s.kills[0]!.fn, 'v1');
});
