// The LIVE era's twin of tests/verify-loot.test.ts (the loot-claim sweep that settles a Pit win and pays its award): the rest of the unit suite imports ./lib/era-off.ts and so never
// settles a claim under the rules the game plays today (the sandbox era, RV79..RV86 rows). This file imports ./lib/era-on.ts FIRST instead; `node --test` runs each file in its own
// process, so it cannot leak.
// The hero MOVES: under the live reach bands verify-loot.test.ts's walk-in-and-cut goblinKill() loses, so he walks in to the far edge of his weapon's best band, cuts while inside it, and
// walks back out when the goblin swings (the hit-and-run shape of scripts/kite-farm.ts `hitrun` and tests/world-evade.test.ts `kite`, at the band edges of src/fight/bands.ts).
import './lib/era-on.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/fight/combat.ts';
import { DEFAULT_WEAPON, OPPONENTS, opponentAt, profileAt } from '../src/fight/moves.ts';
import { distance, type Intent } from '../src/fight/duel.ts';
import { bestRange } from '../src/fight/bands.ts';
import { sandboxFor } from '../src/fight/sandbox-era.ts';
import { decodeRecord, encodeRecord, RECORD_VERSION } from '../src/fight/record.ts';
import { liveRecorder } from './lib/live-recorder.ts';
import { refusal, verifyClaims } from '../scripts/verify-loot.mjs';

const LEVEL = 6, SEED = 1;   // test-local, PINNED: verify-loot.test.ts's goblin fight (level 6, seed 1); the moving script wins it under RV86
const MAX_TICKS = 20_000;   // test-local: how long the script fights before it gives up

/** The press script against the goblin: returns the claim's record text and whether he won. `build` is only a label, as in verify-loot.test.ts. */
async function goblinMover(build = 'test'): Promise<{ record: string; won: boolean }> {
  const [lo, hi] = bestRange(DEFAULT_WEAPON)!, out = hi - lo;   // step-out room: the best band's own width
  const rec = liveRecorder({ build, opponent: 'goblin', weapon: DEFAULT_WEAPON, level: LEVEL, seed: SEED });
  let p = initialPractice(SEED, opponentAt(OPPONENTS.goblin, LEVEL));   // the level's body, as the game builds it (verify-loot.test.ts goblinKill)
  for (let t = 0; t < MAX_TICKS && !p.finish; t++) {
    const [h, f] = p.duel.fighters, gap = distance(h.body, f.body);
    const back = (f.phase === 'attack' && gap < hi + out) || gap < lo, fwd = !back && gap > hi;
    const intent: Intent = { move: { x: 0, z: back ? -1 : fwd ? 1 : 0, yaw: 0, run: false }, action: !back && !fwd && h.phase === 'ready' ? 'light' : null, guard: false, lock: true };
    p = stepPractice(p, rec.push(intent), profileAt(OPPONENTS.goblin, LEVEL));
  }
  const won = p.finish?.victim === 1 && !p.finish.draw;
  return { record: await encodeRecord(rec.finish(won ? 'killed' : 'died')), won };
}

const FRESH = { marks: 0, owned: [] as string[] };   // a fresh account's standing: rank level 1, floor 1
type Row = { id: number; user_id: string; opponent: string; piece: string | null; record: string };
const U = '11111111-1111-4111-8111-111111111111';
function fakeDb(rows: Row[], standing = { marks: 4, owned: [] as string[] }) {   // verify-loot.test.ts's sweep view, without shared fights
  const settled = new Map<number, { verified: boolean; note: string | null; award: { piece: string; tier: number } | null }>();
  const fights = new Map<string, string>();
  return {
    settled,
    unhashed: async (limit: number) => rows.map((r) => ({ kind: 'claim', id: String(r.id), record: r.record })).filter((r) => !fights.has(`${r.kind}:${r.id}`)).slice(0, limit),
    hash: async (kind: string, id: string, fight: string) => { fights.set(`${kind}:${id}`, fight); },
    twin: async (claim: number, fight: string) => {
      const won = rows.find((r) => r.id !== claim && fights.get(`claim:${r.id}`) === fight && settled.get(r.id)?.verified);
      return { claim: won?.id ?? null, shared: null };
    },
    pending: async () => rows.filter((row) => !settled.has(row.id)),
    waiting: async (id: number) => rows.some((row) => row.id < id && row.user_id === rows.find((r) => r.id === id)!.user_id && !settled.has(row.id)),
    standing: async () => standing,
    settle: async (id: number, outcome: { verified: boolean; note: string | null; award: { piece: string; tier: number } | null }) => { settled.set(id, outcome); },
  };
}

test('the file runs under the LIVE era: the current record version is the sandbox era\'s', () => {
  assert.equal(sandboxFor(RECORD_VERSION), true, 'era-on.ts is in force (an era-off import would make this false)');
});

test('live era: the win is proven from an honest MOVING record; a cut-short, de-fanged or flipped one is refused', async () => {
  const { record, won } = await goblinMover();
  assert.equal(won, true, `the moving script beats the goblin at level ${LEVEL} on seed ${SEED}`);
  assert.equal((await decodeRecord(record)).v, RECORD_VERSION);
  assert.equal(await refusal({ opponent: 'goblin', record }, FRESH), null, 'an honest live-era win must verify');
  assert.match(String(await refusal({ opponent: 'veteran', record }, FRESH)), /record is against goblin/);
  const r = await decodeRecord(record);
  assert.match(String(await refusal({ opponent: 'goblin', record: await encodeRecord({ ...r, intents: r.intents.slice(0, 400), ticks: 400 }) }, FRESH)), /does not reach its finish/);
  assert.notEqual(await refusal({ opponent: 'goblin', record: await encodeRecord({ ...r, intents: r.intents.map((i) => ({ ...i, action: null })) }) }, FRESH), null, 'the cuts taken out: no win');
  assert.match(String(await refusal({ opponent: 'goblin', record: await encodeRecord({ ...r, outcome: 'died' }) }, FRESH)), /outcome is died, not a win/);
});

test('live era: the sweep settles an honest moving win as verified and PAYS its award; a forged claim is refused and pays nothing', async () => {
  const { record } = await goblinMover('a'), r = await decodeRecord(record);
  const forged = await encodeRecord({ ...r, build: 'b', intents: r.intents.map((i) => ({ ...i, action: null })) });   // a won header over a fight with no cuts in it
  const db = fakeDb([
    { id: 1, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record },
    { id: 2, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record: forged },
  ]);
  const receipt = await verifyClaims(db);
  assert.deepEqual([receipt.checked, receipt.verified, receipt.awarded, receipt.refused.length], [2, 1, 1, 1], JSON.stringify(receipt));
  assert.deepEqual(db.settled.get(1), { verified: true, note: null, award: { piece: 'goblin.Knife', tier: 1 } }, 'the honest live-era win pays its piece');
  assert.equal(db.settled.get(2)!.verified, false); assert.equal(db.settled.get(2)!.award, null, 'the forged one pays nothing');
});
