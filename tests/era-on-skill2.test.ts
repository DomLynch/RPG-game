// The LIVE era's SPECIAL 2 case on the money paths (the #3452 class). On 2026-10-20 three real wins that pressed SPECIAL 2 were refused by prod because the server replays dropped `record.skill2` (the 13th
// `initialPractice` argument): the replay never armed slot b, so the 'skill2' press did nothing and the fight diverged. Every unit test was era-off or never pressed SPECIAL 2, so nothing failed first.
// This file imports ./lib/era-on.ts FIRST (the rules the game plays today) and records a win that PRESSES SPECIAL 2, then checks it on the three replays #3452 fixed: src/fight/replay.ts
// verifyRecord (the loot sweep, scripts/verify-loot.mjs refusal), origins/server/encounter-verify.ts, and the same record with `skill2` stripped (what the server replay used to see) is refused.
// The hero MOVES, as in tests/era-on-verify-loot.test.ts: a stand-and-swing script loses under the live reach bands.
import './lib/era-on.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPractice, stepPractice } from '../src/fight/combat.ts';
import { DEFAULT_WEAPON, OPPONENTS, opponentAt, profileAt } from '../src/fight/moves.ts';
import { distance, type Intent } from '../src/fight/duel.ts';
import { bestRange } from '../src/fight/bands.ts';
import { sandboxFor } from '../src/fight/sandbox-era.ts';
import { decodeRecord, encodeRecord, RECORD_VERSION, type FightRecord } from '../src/fight/record.ts';
import { recordSpecials, verifyRecord } from '../src/fight/replay.ts';
import { verifyEncounter, liveSpecials } from '../origins/server/encounter-verify.ts';
import { liveRecorder } from './lib/live-recorder.ts';
import { refusal } from '../scripts/verify-loot.mjs';

const LEVEL = 6, ENEMY = 'goblin' as const, SKILL2 = 'stomp' as const;   // test-local: the pick the era fixtures use for SPECIAL 2 (scripts/record-era-fixtures.mjs `skill2`)
const SEED = 1;   // test-local, PINNED: the moving script wins the level-6 goblin on seed 1 and uses SPECIAL 2 on the way (asserted below, so a sim change that breaks either fails loudly)
const MAX_TICKS = 20_000;   // test-local: how long the script fights before it gives up

/** The moving press script with a SPECIAL 2 pick. Returns the record as the Pit's recorder writes it, whether it won, and how many SPECIAL 2 presses the engine took (the cooldown was spent). */
function mover(seed: number): { record: FightRecord; won: boolean; taken: number } {
  const [lo, hi] = bestRange(DEFAULT_WEAPON)!, out = hi - lo, profile = profileAt(OPPONENTS[ENEMY], LEVEL), specials = liveSpecials(LEVEL);
  const rec = liveRecorder({ build: 'test', opponent: ENEMY, weapon: DEFAULT_WEAPON, level: LEVEL, seed, skill2: SKILL2, ...(specials ? { specials: true } : {}) });
  let p = initialPractice(seed, opponentAt(OPPONENTS[ENEMY], LEVEL), DEFAULT_WEAPON, null, recordSpecials({ specials: !!specials, level: LEVEL, opponent: ENEMY }), undefined, undefined, undefined, undefined, undefined, undefined, undefined, SKILL2);
  let taken = 0, was = p.duel.fighters[0].skillCooldown2 ?? 0;   // slot b starts on a cooldown: only a RISE after that is a press the engine took
  for (let t = 0; t < MAX_TICKS && !p.finish; t++) {
    const [h, f] = p.duel.fighters, gap = distance(h.body, f.body);
    const back = (f.phase === 'attack' && gap < hi + out) || gap < lo, fwd = !back && gap > hi, inBand = !back && !fwd && h.phase === 'ready';
    const action: Intent['action'] = inBand ? (!h.skillCooldown2 ? 'skill2' : 'light') : null;
    const intent: Intent = { move: { x: 0, z: back ? -1 : fwd ? 1 : 0, yaw: 0, run: false }, action, guard: false, lock: true };
    p = stepPractice(p, rec.push(intent), profile);
    const cd = p.duel.fighters[0].skillCooldown2 ?? 0; if (cd > was) taken++; was = cd;
  }
  const won = p.finish?.victim === 1 && !p.finish.draw;
  return { record: { ...rec.finish(won ? 'killed' : 'died'), v: RECORD_VERSION }, won, taken };
}

test('the file runs under the LIVE era: the current record version is the sandbox era\'s', () => {
  assert.equal(sandboxFor(RECORD_VERSION), true, 'era-on.ts is in force (an era-off import would make this false)');
});

test('live era: a win that PRESSED SPECIAL 2 verifies on the Pit replay, the loot sweep and the encounter verifier; the same record without its skill2 pick is refused', async () => {
  const { record, won, taken } = mover(SEED);
  assert.equal(won, true, `the moving script beats the level ${LEVEL} ${ENEMY} on seed ${SEED}`);
  assert.ok(taken >= 1, `the engine took at least one SPECIAL 2 press in the fight (took ${taken}): without one this test proves nothing about slot b`);
  assert.equal(record.skill2, SKILL2, 'the recorder stamped the pick'); assert.ok(record.intents.some((i) => i.action === 'skill2'));
  const text = await encodeRecord(record), decoded = await decodeRecord(text);
  assert.equal(decoded.skill2, SKILL2, 'the pick survives the wire');

  assert.equal(verifyRecord(decoded).ok, true, 'src/fight/replay.ts verifyRecord arms slot b from record.skill2');
  assert.equal(await refusal({ opponent: ENEMY, record: text }, { marks: 0, owned: [] }), null, 'the loot sweep (scripts/verify-loot.mjs) verifies the SPECIAL 2 win: claims 15, 17 and 19 on prod were refused here before #3452');
  const enc = verifyEncounter(decoded, { seed: SEED, enemy: ENEMY, level: LEVEL, bar: null, flags: [], layer: null });
  assert.ok(enc.ok, `origins/server/encounter-verify.ts verifies it: ${enc.ok ? '' : enc.reason}`);

  const { skill2: _dropped, ...bare } = decoded;   // what the server replays saw before #3452: the same intents, the pick dropped
  const stripped = bare as FightRecord;
  assert.equal(verifyRecord(stripped).ok, false, 'without the pick slot b is never armed, the presses do nothing, the fight diverges (the hero dies at tick 1771 of 3718): refused');
  assert.notEqual(await refusal({ opponent: ENEMY, record: await encodeRecord(stripped) }, { marks: 0, owned: [] }), null, 'the loot sweep refuses the stripped record');
});
