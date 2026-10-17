import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi, type AiState } from '../src/fight/ai.ts';
import { createFighter, type Duel } from '../src/fight/duel.ts';
import { PROFILES, type AiProfile } from '../src/fight/moves.ts';
import { TACTIC_ROWS, checkTactic, pickWeighted, type TacticBlock } from '../src/fight/tactic-rows.ts';
import { TARGET } from '../src/fight/sim.ts';

// The tactic table (spec docs/specs/combat/gothic-tactic-table.md), PR 1: the loader and the reaction slot's branch, no row used by any profile yet.
const winding = (profile: AiProfile): { duel: Duel; ai: AiState } => {
  const duel = { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] } as unknown as Duel;
  duel.fighters[0] = { ...duel.fighters[0], phase: 'attack', move: 'light_right', age: profile.reaction, lastMove: 'light_right' };
  return { duel, ai: { ...initialAi(), mode: 'circle', decision: 500, wait: 500 } };
};
const planAt = (profile: AiProfile) => { const { duel, ai } = winding(profile); return decide(duel, 1, ai, profile).ai; };
const withRow = (id: string, block: TacticBlock, run: () => void) => {
  (TACTIC_ROWS as Record<string, TacticBlock>)[id] = block;
  try { run(); } finally { delete (TACTIC_ROWS as Record<string, TacticBlock>)[id]; }
};

test('a profile with no tactic, or one naming no row, steps exactly as before: same plan, same seed (no draw)', () => {
  assert.deepEqual(planAt({ ...PROFILES.normal, tactic: 'no-such-row' }), planAt(PROFILES.normal));
});

test('every shipped row passes the load check', () => {
  for (const [id, block] of Object.entries(TACTIC_ROWS)) assert.doesNotThrow(() => checkTactic(id, block.heroWinding), id);
});

test('the load check rejects an empty list, more than six entries, an unknown reaction (sidestep and trade are out of v1) and a non-positive weight', () => {
  const e = (choice: string, weight = 1) => ({ choice, weight });
  assert.throws(() => checkTactic('t', []));
  assert.throws(() => checkTactic('t', Array.from({ length: 7 }, () => e('parry'))));
  assert.throws(() => checkTactic('t', [e('sidestep')]));
  assert.throws(() => checkTactic('t', [e('trade')]));
  assert.throws(() => checkTactic('t', [e('parry', 0)]));
  assert.doesNotThrow(() => checkTactic('t', [e('parry'), e('brace', 2), e('backstep', .5)]));
  assert.doesNotThrow(() => checkTactic('t', undefined));
});

test('pickWeighted draws over the weights in row order and never leaves the list', () => {
  const list = [{ choice: 'parry' as const, weight: 1 }, { choice: 'brace' as const, weight: 3 }];
  assert.equal(pickWeighted(list, 0), 'parry'); assert.equal(pickWeighted(list, .24), 'parry');
  assert.equal(pickWeighted(list, .25), 'brace'); assert.equal(pickWeighted(list, .999999), 'brace');
});

test('a row on the profile decides the answer to the noticed swing, and the same row twice gives the same plan', () => {
  withRow('only-backstep', { heroWinding: [{ choice: 'backstep', weight: 1 }] }, () => {
    const p = { ...PROFILES.normal, tactic: 'only-backstep', lapse: 0 };
    assert.equal(planAt(p).plan, 'evade');
    assert.deepEqual(planAt(p), planAt(p));
  });
  withRow('only-brace', { heroWinding: [{ choice: 'brace', weight: 1 }] }, () => {
    assert.equal(planAt({ ...PROFILES.normal, tactic: 'only-brace', lapse: 0 }).plan, 'block');
  });
});
