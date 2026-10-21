// The LIVE era's twin of origins/server/encounter-verify.test.ts and the settle tests of origins/server/encounter.test.ts (a legend duel's money path): the rest of the unit suite imports
// ./lib/era-off.ts and so never verifies a duel record under the rules the game plays today (the sandbox era, RV79..RV86 rows). This file imports ./lib/era-on.ts FIRST instead;
// `node --test` runs each file in its own process, so it cannot leak.
// The hero MOVES: under the live reach bands a stand-and-swing script loses (every seed tried), so he walks in to the far edge of his weapon's best band, cuts while inside it, and walks
// back out when the foe swings (the hit-and-run shape of scripts/kite-farm.ts `hitrun` and tests/world-evade.test.ts `kite`, at the band edges of src/fight/bands.ts).
import './lib/era-on.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPractice, stepPractice } from '../src/fight/combat.ts';
import { DEFAULT_WEAPON, OPPONENTS, opponentAt, profileAt, type OpponentId } from '../src/fight/moves.ts';
import { RECORD_VERSION, packRecord, toBase64Url, type FightRecord } from '../src/fight/record.ts';
import { recordSpecials } from '../src/fight/replay.ts';
import { distance, type Intent } from '../src/fight/duel.ts';
import { bestRange } from '../src/fight/bands.ts';
import { sandboxFor } from '../src/fight/sandbox-era.ts';
import { kitBuild } from '../src/core/server.ts';
import { gzipSync } from 'node:zlib';
import { liveRecorder } from './lib/live-recorder.ts';
import { liveSpecials, verifyEncounter, type EncounterParams } from '../origins/server/encounter-verify.ts';
import { encounterOps } from '../origins/server/encounter.ts';
import { ACCOUNT, CHAR, RESOLVED, deps, fakeDb } from '../origins/server/encounter-fixtures.ts';
import type { Db } from '../origins/server/db.ts';

const ENEMY: OpponentId = 'goblin', LEVEL = 6;   // test-local: the legend and rung the moving script beats (the knight at 1, 3 and 6 still beats it: a harder fight than this file needs)
const SEED = 1;   // test-local, PINNED: the moving script wins on seed 1 under RV86 (85 of 100 seeds in all); 1 is the one verify-loot.test.ts fights too
const MAX_TICKS = 20_000;   // test-local: how long the script fights before it gives up

/** The press script, `margin` metres of extra step-out room (the band's own width by default). Returns the record as the Pit's recorder writes it, stamped with this build's version. */
function moving(seed: number, margin?: number): { record: FightRecord; hp: readonly [number, number] } {
  const [lo, hi] = bestRange(DEFAULT_WEAPON)!, out = margin ?? hi - lo, specials = liveSpecials(LEVEL), profile = profileAt(OPPONENTS[ENEMY], LEVEL);
  const rec = liveRecorder({ build: kitBuild('test'), opponent: ENEMY, weapon: DEFAULT_WEAPON, level: LEVEL, seed, ...(specials ? { specials: true } : {}) });
  let p = initialPractice(seed, opponentAt(OPPONENTS[ENEMY], LEVEL), DEFAULT_WEAPON, null, recordSpecials({ specials, level: LEVEL, opponent: ENEMY }));
  for (let t = 0; t < MAX_TICKS && !p.finish; t++) {
    const [h, f] = p.duel.fighters, gap = distance(h.body, f.body);
    const back = (f.phase === 'attack' && gap < hi + out) || gap < lo, fwd = !back && gap > hi;
    const intent: Intent = { move: { x: 0, z: back ? -1 : fwd ? 1 : 0, yaw: 0, run: false }, action: !back && !fwd && h.phase === 'ready' ? 'light' : null, guard: false, lock: true };
    p = stepPractice(p, rec.push(intent), profile);
  }
  const outcome = p.finish ? (p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned';
  return { record: { ...rec.finish(outcome), v: RECORD_VERSION }, hp: [p.duel.fighters[0].health, p.duel.fighters[1].health] };
}
const STARTS = 25;   // test-local: the server picks the seed at random (encounter.ts randomInt) and the script wins ~4 in 5 of them (measured: 85 of 100 seeds under RV86), so settle opens up to this many fresh fights until one is a win
const params = (seed: number, over: Partial<EncounterParams> = {}): EncounterParams => ({ seed, enemy: ENEMY, level: LEVEL, bar: null, flags: [], layer: null, ...over });
const wire = (r: FightRecord) => toBase64Url(gzipSync(packRecord(r)));
const ctx = (db: Db) => ({ db, account: ACCOUNT });
const goblinDeps = (rewards: string[]) => deps({ resolve: (_w, id) => (id === `encounter:${ENEMY}` ? { ...RESOLVED, enemy: ENEMY, level: LEVEL } : null), rewards: (f) => { rewards.push(f.token); return [{ op: 'reward-line', token: f.token }]; } });   // one reward line per paid win, as encounter.test.ts's settle test

test('the file runs under the LIVE era: the current record version is the sandbox era\'s', () => {
  assert.equal(sandboxFor(RECORD_VERSION), true, 'era-on.ts is in force (an era-off import would make this false)');
});

test('live era: an honest MOVING win verifies as won, ticks and all, stamped with this build\'s RECORD_VERSION', () => {
  const { record, hp } = moving(SEED);
  assert.equal(record.outcome, 'killed', `the moving script beats the ${ENEMY} on seed ${SEED} (hero ${hp[0]}, foe ${hp[1]})`);
  assert.ok(hp[0] > 0 && hp[1] <= 0);
  assert.equal(record.v, RECORD_VERSION);
  const v = verifyEncounter(record, params(SEED));
  assert.ok(v.ok, `an honest live-era record must verify: ${v.ok ? '' : v.reason} (ticks ${record.ticks}, outcome ${record.outcome})`);
  if (v.ok) { assert.equal(v.result, 'won'); assert.equal(v.ticks, record.ticks); assert.equal(v.twist, null); }
});

test('live era: a forged duel record is refused: a flipped outcome, a cut-short or padded intent list, the cuts taken out, another seed or level', () => {
  const { record } = moving(SEED), p = params(SEED);
  const no = (r: FightRecord, why: string, q: EncounterParams = p) => assert.equal(verifyEncounter(r, q).ok, false, why);
  no({ ...record, outcome: 'died' }, 'flipped outcome');
  no({ ...record, ticks: record.ticks - 1, intents: record.intents.slice(0, -1) }, 'cut short: it does not reach its end');
  no({ ...record, ticks: record.ticks + 5, intents: [...record.intents, ...record.intents.slice(-5)] }, 'padded past the finish');
  no({ ...record, intents: record.intents.map((i) => ({ ...i, action: null })) }, 'the cuts taken out: the replay is no win');
  no(record, 'another seed', params(SEED + 1));
  no(record, 'another level', params(SEED, { level: LEVEL + 1 }));
});

test('live era: settle with the REAL verifier pays an honest moving win on the server\'s seed once; a forged outcome is a loss that pays nothing', async () => {
  let found: { db: Db; events: Record<string, unknown>[]; rewards: string[]; ops: ReturnType<typeof encounterOps>; start: { token: string; seed: number }; record: FightRecord } | null = null;
  for (let k = 0; k < STARTS && !found; k++) {   // a fresh database each time: an unplayed fight stays open, and nothing of it is settled or paid
    const { db, events } = fakeDb({ t: 1e6 }), rewards: string[] = [], ops = encounterOps(goblinDeps(rewards));
    const start = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: `encounter:${ENEMY}` }) as { token: string; seed: number };
    const { record } = moving(start.seed); if (record.outcome === 'killed') found = { db, events, rewards, ops, start, record };
  }
  assert.ok(found, `the moving script won one of ${STARTS} server-picked seeds`);
  const { db, events, rewards, ops, start, record } = found;
  const out = await ops.encounter_settle!(ctx(db), { token: start.token, record: wire(record) }) as Record<string, unknown>;
  assert.equal(out.verified, true, String(out.reason)); assert.equal(out.result, 'won');
  assert.deepEqual(rewards, [start.token], 'the reward hook is asked once, for this token');
  assert.equal((events[0]!.payload as { paid: boolean }).paid, true);

  const second = await ops.encounter_start!(ctx(db), { character: CHAR, encounter: `encounter:${ENEMY}` }) as { token: string; seed: number };
  const lie = moving(second.seed).record, forged: FightRecord = { ...lie, outcome: 'killed', intents: lie.intents.map((i) => ({ ...i, action: null })) };   // a won header over a fight with no cuts in it
  const bad = await ops.encounter_settle!(ctx(db), { token: second.token, record: wire(forged) }) as Record<string, unknown>;
  assert.equal(bad.verified, false); assert.equal(bad.result, 'lost');
  assert.deepEqual(rewards, [start.token], 'the forged one asks for no reward');
  assert.equal(events.length, 2); assert.equal((events[1]!.payload as { verified: boolean }).verified, false);
});
