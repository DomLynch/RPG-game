// Shared by encounter.test.ts and origins/preview/encounter-net.test.ts: an in-memory stand-in for the encounter database, and a client that plays a fight on the issued seed.
import { initialPractice, stepPractice } from '../../src/combat.ts';
import { OPPONENTS, opponentAt, profileAt } from '../../src/moves.ts';
import { gzipSync } from 'node:zlib';
import { createRecorder, packRecord, RECORD_VERSION, toBase64Url, type FightRecord } from '../../src/record.ts';
import { recordSpecials } from '../../src/replay.ts';
import { DbError, type Db } from './db.ts';
import type { EncounterDeps } from './encounter.ts';
import { kitBuild } from '../mobs/kit-version.ts';
import type { DuelPose } from '../../src/duel.ts';
import { liveSpecials, verifyEncounter } from './encounter-verify.ts';

export const ACCOUNT = '11111111-1111-4111-8111-111111111111', CHAR = 'pc:one';

// An in-memory stand-in for the 202610080002 functions, with the same rules the SQL has: one open fight per account and per instance, token consumed once, expiry, settle applies the batch.
type Row = { token: string; character: string; seed: number; enemy: string; level: number; start_tick: number; last_tick: number; bar: number | null; flags: unknown[]; layer: string | null; instance: string | null; expires: number; used: boolean; settled: boolean; result: string | null };
let clock = { t: 0 };   // the fake database's clock, also what the handler's expiry pre-check reads
export function fakeDb(now: { t: number }) {
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

export const RESOLVED = { enemy: 'knight', level: 6, bar: null, flags: [], layer: null, instance: null };
export const deps = (over: Partial<EncounterDeps> = {}): EncounterDeps => ({ resolve: (_w, id) => (id === 'encounter:knight' ? RESOLVED : null), verify: verifyEncounter, now: () => clock.t, ...over });

// The client: plays the fight with the server's seed, records it as the Pit's recorder does, packs it for the wire.
export function playFight(seed: number, intentSeed: number, level = 6, enemy: 'knight' = 'knight', onlyFinished = false, build = kitBuild('test'), pose?: DuelPose): FightRecord | null {
  let s = intentSeed >>> 0; const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const specials = liveSpecials(level), profile = profileAt(OPPONENTS[enemy], level);
  const rec = createRecorder({ build, opponent: enemy, weapon: 'longsword', level, seed, ...(specials ? { specials: true } : {}), ...(pose ? { pose } : {}) });
  let p = initialPractice(seed, opponentAt(OPPONENTS[enemy], level), 'longsword', null, recordSpecials({ specials, level, opponent: enemy }), undefined, undefined, pose);   // pose: the server's issued start pose, as match.startPose plays it
  for (let i = 0; i < 1500 && !p.finish; i++) p = stepPractice(p, rec.push({ move: { x: Math.round(rand() * 2 - 1), z: 1, yaw: 0, run: false }, action: rand() < 0.5 ? 'light' : null, guard: rand() < 0.1, lock: true }), profile);
  if (onlyFinished && !p.finish) return null;   // a scripted fight that never ended has no verifiable record
  return { ...rec.finish(p.finish ? (p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned'), v: RECORD_VERSION };   // the current version, as verify-loot packs a claim
}
export function fight(seed: number, intentSeed: number, level = 6, enemy: 'knight' = 'knight', onlyFinished = false, build = kitBuild('test'), pose?: DuelPose): string {
  const record = playFight(seed, intentSeed, level, enemy, onlyFinished, build, pose);
  return record ? toBase64Url(gzipSync(packRecord(record))) : '';
}

// A fight that ENDED on `seed`: the scripted intents of one `intentSeed` can run out the 1500 ticks without a finish, so try the next (deterministic: the same seed always lands on the same one).
export function finishedFight(seed: number, level = 6, enemy: 'knight' = 'knight'): FightRecord {
  for (let intentSeed = 1; intentSeed <= 60; intentSeed++) { const record = playFight(seed, intentSeed, level, enemy, true); if (record) return record; }
  throw new Error(`no scripted fight finished on seed ${seed}`);
}
