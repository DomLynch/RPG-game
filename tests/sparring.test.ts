// The Sparring dummy (src/sparring.ts): never attacks, guards on a low share, and stays out of the sim files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initialAi } from '../src/ai.ts';
import { project } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import { SPARRING_DUMMY, disarm, stepSparring } from '../src/sparring.ts';
import { STRATEGIES, act, arena, idle } from './strategies.ts';

// The dummy's own digest, beside the sim's SIM_DIGEST: a change to the dummy is a reviewed decision, and it never moves RECORD_VERSION.
const SPARRING_DIGEST = 'abfddc80c4f6cd12eda061e7c96ac9831dac1751d586d1a30d97e3b0af25321a';
test('the Sparring dummy is pinned by its own digest', () => {
  const digest = createHash('sha256').update(readFileSync(new URL('../src/sparring.ts', import.meta.url))).digest('hex');
  assert.equal(digest, SPARRING_DIGEST, `src/sparring.ts changed: review the dummy, then set SPARRING_DIGEST = '${digest}'`);
});

test('the Sparring dummy profile: no aggression, no parry, no roll, a low guard share', () => {
  assert.deepEqual([SPARRING_DUMMY.aggression, SPARRING_DUMMY.parry, SPARRING_DUMMY.dodge, SPARRING_DUMMY.guard], [0, 0, 0, .25]);
});

test('disarm strips every attack and keeps guard, parry and footwork', () => {
  for (const a of ['light', 'light_left', 'light_right', 'heavy', 'thrust', 'kick', 'skill'] as const) assert.equal(disarm(act(a, { held: true })).action, null, a);
  for (const a of ['parry', 'dodge', 'backstep'] as const) assert.equal(disarm(act(a)).action, a);
  assert.equal(disarm({ ...idle(), guard: true }).guard, true);
});

test('the Sparring dummy never swings, against any opponent, idle or attacked', () => {
  for (const o of Object.values(OPPONENTS)) for (const strategy of [() => idle(), STRATEGIES['light spam'], STRATEGIES['heavy only']]) for (let s = 1; s <= 2; s++) {
    let p = project(arena(o, 'longsword'), initialAi((s * 2654435761) >>> 0));
    for (let i = 0; i < 900 && !p.duel.finish; i++) {
      p = stepSparring(p, strategy(p.duel));
      assert.notEqual(p.duel.fighters[1].phase, 'attack', `${o.id} seed ${s} tick ${i}`);
      assert.ok(!p.duel.events.some(e => e.type === 'Hit' && e.target === 0), `${o.id} hit the player`);
    }
  }
});
