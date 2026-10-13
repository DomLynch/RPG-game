// Stances as rows, and timing is sacred (Strategy's ruling on the external audit, 2026-10-13; RV52): the stance rows (stance-defs.json) move NUMBERS only. No row may carry a window (or any tick count or speed);
// the Defensive stance's old longer parry window and guard-counter window are gone from v52 and kept only for a record BELOW v52, whose replay must be byte for byte what it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, guardOf, stepDuel, withStances, type Duel } from '../src/fight/duel.ts';
import { STANCES, STANCE_KEYS, stanceRows, type StanceId } from '../src/fight/stance.ts';
import { underStanceRows, STANCE_ROWS_ON } from '../src/fight/stance-era.ts';
import { OPPONENTS, RULES, opponentAt, profileAt } from '../src/fight/moves.ts';
import { decide, initialAi } from '../src/fight/ai.ts';
import { act, arena, guard, idle } from './strategies.ts';
import { scenarioDigest } from './stance-scenario.ts';

const IDS = ['aggressive', 'defensive', 'trickster'] as const;
// The digest of stance-scenario.ts taken on #2447's tip, BEFORE the stance rows moved: a v51 Defensive-vs-Defensive fight (parry, guard-counter, punish, light spam) tick by tick.
const V51_DIGEST = 'b056059aca87620dae8043a284c0c400b088cfa63908e567384bb1fa7d2d82d0';

test('guard: no stance row carries a window, a tick count or a speed; the loader refuses one', () => {
  for (const id of IDS) for (const key of Object.keys(STANCES[id])) { assert.ok((STANCE_KEYS as readonly string[]).includes(key), `${id}.${key}`); assert.ok(!/window|tick|speed|timing|counter|duration|reach/i.test(key), `${id}.${key} is a timing`); }
  assert.deepEqual(STANCES.defensive, { damage: -50, block: -150, recover: 250, damageTaken: -100, poise: -100 });
  assert.throws(() => stanceRows([{ id: 'defensive', damage: -50, window: 250 }]), /"window" is not a stance quantity.*never touches a timing/);
  assert.throws(() => stanceRows([{ id: 'x', counter: 250 }]), /"counter" is not a stance quantity/);
  assert.throws(() => stanceRows([{ id: 'x', damage: 1.5 }]), /whole per-mille delta/);
  assert.deepEqual(stanceRows([{ id: 'calm', damageTaken: -50 }]), { calm: { damageTaken: -50 } }, 'a new stance is ONE row of known quantities');
});

test('v52: the parry window and the guard-counter window are identical across every stance', () => {
  assert.equal(STANCE_ROWS_ON, true);
  const f = createFighter({ x: 0, z: 0, heading: 0, distance: 0 } as never, 'ready'), plain = guardOf(f);
  for (const stance of IDS) assert.deepEqual(guardOf({ ...f, stance }), plain, stance);
  const counterAfterBlock = (stance?: StanceId): number => {   // the player holds a perfect-side guard against the Veteran until his first Block opens the counter window
    let d: Duel = withStances(arena(opponentAt(OPPONENTS.veteran, 20)), stance, undefined), ai = initialAi(5);
    for (let i = 0; i < 1500; i++) { const w = decide(d, 1, ai, profileAt(OPPONENTS.veteran, 20)); ai = w.ai; d = stepDuel(d, [guard(d), w.intent]); if (d.events.some((e) => e.type === 'Blocked' && e.actor === 0)) return d.fighters[0].counterWindow; }
    return -1;
  };
  const base = counterAfterBlock();
  for (const stance of IDS) assert.equal(counterAfterBlock(stance), base, `${stance}: the same counter window`);
  assert.equal(base, RULES.guardCounter, 'a block opened the plain guard-counter window (the test saw a real block)');
});

test('v52: the Defensive stance takes 10% less health damage and 10% less posture; the others are untouched', () => {
  const hit = (stance?: StanceId): { health: number; posture: number } => { let x: Duel = withStances(arena(), undefined, stance); x = { ...x, fighters: [{ ...x.fighters[0], phase: 'ready' }, x.fighters[1]] }; for (let i = 0; i < 60; i++) { x = stepDuel(x, [act('light'), idle()]); if (x.events.some((e) => e.type === 'Hit')) break; } return { health: RULES.health - x.fighters[1].health, posture: x.fighters[1].posture }; };
  const plain = hit(), def = hit('defensive');
  assert.ok(plain.health > 0 && def.health < plain.health, `${def.health} < ${plain.health}`);
  assert.equal(def.health, Math.round(plain.health * 0.9));
  assert.ok(def.posture < plain.posture);
  for (const stance of ['aggressive', 'trickster'] as const) assert.equal(hit(stance).health, plain.health, `${stance} takes the plain damage`);
});

test('a record BELOW v52 replays the old Defensive stance byte for byte (era-keyed, like the play circle and the stab); v52 does not', () => {
  assert.equal(underStanceRows(51, () => scenarioDigest()), V51_DIGEST, 'the v51 era: parry and guard-counter windows a quarter longer, exactly as fought');
  assert.equal(underStanceRows(18, () => scenarioDigest()), V51_DIGEST, 'every older version too');
  assert.notEqual(underStanceRows(52, () => scenarioDigest()), V51_DIGEST, 'v52: the rows moved');
  assert.equal(STANCE_ROWS_ON, true, 'the era flag is restored');
});
