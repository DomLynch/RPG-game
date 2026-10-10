// Proof 3: the shared crowd-control ladder in the engine (src/fight/duel.ts stunned(), src/fight/cc-ladder.ts). A fighter that carries a ladder (Fighter.cc) steps full -> half -> quarter -> immune on its
// posture breaks, whoever lands them; a fighter without one is the Pit's fight, unchanged. Both ways: three attackers on the hero (one ladder threaded through three separate duels, as the open world threads
// the hero's), and the hero on a boss.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, idleIntent, stepDuel, type Action, type Duel, type Intent } from '../src/fight/duel.ts';
import { MOVES, RULES } from '../src/fight/moves.ts';
import { CC_LADDER, emptyLadder, type CcLadder } from '../src/fight/cc-ladder.ts';
import { TARGET } from '../src/fight/sim.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Action): Intent => ({ ...idle(), action });
const light = MOVES.light_right, P = RULES.posture;
const duel = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });

// One light cut on a victim whose posture bar is one cut from breaking. `at`: the world's clock when it lands (Duel.ccBase); `cc`: the victim's ladder (undefined = none).
function breakOnce(cc: CcLadder | undefined, at = 0): { ticks: number | null; cc: CcLadder | undefined; stun: number } {
  const base = duel();
  let d: Duel = { ...base, ccBase: at, fighters: [base.fighters[0], { ...base.fighters[1], posture: P.max - light.posture + 1 + light.windup * P.decay, ...(cc ? { cc } : {}) }] };
  d = stepDuel(d, [act('light'), idle()]);
  const events = [...d.events];
  for (let i = 0; i < light.windup; i++) { d = stepDuel(d, [idle(), idle()]); events.push(...d.events); }
  const brk = events.find((e) => e.type === 'PostureBroken');
  return { ticks: brk?.ticks ?? null, cc: d.fighters[1].cc, stun: d.fighters[1].stun };
}

test('no ladder: a posture break is the full stun every time (the Pit is unchanged)', () => {
  for (let i = 0; i < 4; i++) assert.equal(breakOnce(undefined).ticks, P.stun);
  assert.equal(breakOnce(undefined).cc, undefined, 'a fighter without a ladder never grows one');
});

test('the hero on a boss: the boss\'s breaks step full, half, quarter, then it is immune; the window resets it', () => {
  let cc: CcLadder = emptyLadder; const got: (number | null)[] = [];
  for (let n = 0; n < 4; n++) { const r = breakOnce(cc, n * 120); got.push(r.ticks); cc = r.cc!; }
  assert.deepEqual(got, [P.stun, Math.round(P.stun / 2), Math.round(P.stun / 4), null]);
  const immune = breakOnce(cc, 4 * 120);
  assert.equal(immune.ticks, null, 'immune: no PostureBroken'); assert.ok(immune.stun < P.stun, 'immune: only the cut\'s own stagger, not the posture stun');
  assert.equal(breakOnce(cc, 3 * 120 + CC_LADDER.window + 60).ticks, P.stun, 'a quiet window later the ladder is back to full');
});

test('three attackers on the hero: one ladder threaded through three separate duels steps the same ladder', () => {
  let hero: CcLadder = emptyLadder; const got: (number | null)[] = [];
  for (let attacker = 0; attacker < 3; attacker++) { const r = breakOnce(hero, 1000 + attacker * 10); got.push(r.ticks); hero = r.cc!; }
  assert.deepEqual(got, [P.stun, Math.round(P.stun / 2), Math.round(P.stun / 4)], 'the 2nd attacker\'s break is already half: the hero\'s ladder is shared');
  const boss = breakOnce(emptyLadder, 1000); assert.equal(boss.ticks, P.stun, 'a different target keeps its own ladder');
});
