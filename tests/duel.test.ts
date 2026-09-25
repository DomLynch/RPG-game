import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, elapsed, lorariusGuard, idleIntent, initialDuel, legal, mirror, opponentFighter, stepDuel, type Action, type CombatEvent, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, OPPONENTS, PATHS, PLAYER_WEAPONS, PROFILES, RULES, total, type GuardProfile } from '../src/moves.ts';
import { decide, initialAi } from '../src/ai.ts';
import { RADIUS, TARGET } from '../src/sim.ts';

const HP = RULES.health;   // fighters start at RULES.health; the numbers below are written against it
// Both fighters are scripted here; the AI has its own suite. Index 0 stands south of index 1, both facing each other.
const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Action, extra: Partial<Intent> = {}): Intent => ({ ...idle(), action, ...extra });
// hold(): a guard held on the defender's LEFT — the side that meets these tests' default cut, a light_right (directional guard, on by default).
// Pass guardDirection for anything else: 'right' vs a light_left, 'overhead' vs a heavy, 'thrust' vs a thrust, 'low' to brace a kick.
const hold = (extra: Partial<Intent> = {}): Intent => ({ ...idle(), guard: true, guardDirection: 'left', ...extra });
const vs = (attack: 'light_left' | 'light_right' | 'heavy_overhead' | 'thrust' | 'kick' | 'heavy'): Intent => hold({ guardDirection: attack === 'light_left' ? 'right' : attack === 'light_right' ? 'left' : attack === 'thrust' ? 'thrust' : attack === 'kick' ? 'low' : 'overhead' });
function duel(gap = 1.2, heading = Math.PI, phase: 'ready' | 'sheathed' = 'ready'): Duel {
  return { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading, distance: 0 }, phase), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
}
function run(d: Duel, n: number, a: Intent = idle(), b: Intent = idle(), rules = RULES): Duel { for (let i = 0; i < n; i++) d = stepDuel(d, [a, b], rules); return d; }
const light = MOVES.light_right, heavy = MOVES.heavy_overhead, kick = MOVES.kick, LIGHT = total(light);
const types = (d: Duel) => d.events.map(e => e.type);

test('attack phases: nothing lands before the active window, a hit resolves once, a whiff is reported when the window closes', () => {
  let d = stepDuel(duel(), [act('light'), idle()]);
  assert.equal(d.fighters[0].phase, 'attack'); assert.equal(d.fighters[0].move, 'light_right'); assert.equal(d.fighters[0].stamina, 100 - light.stamina);
  assert.deepEqual(types(d), ['AttackStarted']);
  d = run(d, light.windup - 1); assert.equal(d.fighters[1].health, HP);
  d = stepDuel(d, [idle(), idle()]);
  assert.equal(d.fighters[1].health, HP - light.damage); assert.deepEqual(types(d), ['AttackActive', 'Hit', 'Staggered']);
  assert.equal(d.fighters[1].phase, 'hurt'); assert.equal(d.fighters[1].stun, light.stagger); assert.equal(d.fighters[1].wound, RULES.wound);
  d = run(d, LIGHT - light.windup, act('light'));
  assert.equal(d.fighters[1].health, HP - light.damage, 'one swing damages once, whatever is pressed during recovery');
  assert.equal(run(d, LIGHT).fighters[1].health, HP - 2 * light.damage, 'the queued follow-up is a separate swing that lands after its own wind-up');
  let whiff = run(stepDuel(duel(light.reach + 1), [act('light'), idle()]), light.windup + light.active - 2);
  assert.ok(!types(whiff).includes('AttackMissed'));
  whiff = stepDuel(whiff, [idle(), idle()]); assert.deepEqual(types(whiff), ['AttackMissed']); assert.equal(whiff.fighters[1].health, HP);
});

test('drawing takes its full time, cannot damage, and holds the fighter still like every committed action', () => {
  const start = duel(1.2, Math.PI, 'sheathed');
  const d = stepDuel(start, [act('light', { move: { x: 0, z: -1, yaw: 0, run: false } }), idle()]);
  assert.equal(d.fighters[0].phase, 'draw'); assert.deepEqual(d.fighters[0].body, start.fighters[0].body); assert.equal(d.fighters[0].stamina, 100);
  assert.equal(run(d, RULES.draw - 1).fighters[0].phase, 'draw');
  assert.equal(run(d, RULES.draw).fighters[0].phase, 'ready');
  assert.equal(run(d, 200, act('heavy')).fighters[1].health, HP - 2 * heavy.damage, 'heavy is refused while sheathed, accepted once armed; a second is queued from recovery');
  assert.equal(stepDuel(start, [act('heavy'), idle()]).fighters[0].phase, 'sheathed');
});

test('range and facing produce real misses; lock turns during wind-up but never snaps around', () => {
  for (const d of [duel(light.reach + 1), duel(1.2, 0)]) assert.equal(run(d, LIGHT, act('light')).fighters[1].health, HP);
  let turning = stepDuel(duel(1.2, 0), [act('light', { lock: true }), idle()]);
  assert.ok(Math.abs(turning.fighters[0].body.heading) <= RULES.turnStart + RULES.turnWindup + 1e-9);
  turning = run(turning, light.windup, { ...idle(), lock: true });
  assert.equal(turning.fighters[1].health, HP - light.damage, 'controlled turning still reaches the opponent');
  assert.equal(run(duel(light.reach), LIGHT, act('light')).fighters[1].health, HP - light.damage, 'step-in covers the last of the reach');
});

test('enough clean hits kill; death freezes both fighters and rejects every input', () => {
  let d = duel();
  for (let i = 0; i < Math.ceil(HP / light.damage); i++) {
    // Clean lights only: the warden's posture is reset each swing so a posture break never turns the lights into ripostes.
    d = { ...d, fighters: [{ ...d.fighters[0], stamina: 100, exhausted: false, punish: 0, critical: 0, body: { x: d.fighters[1].body.x, z: d.fighters[1].body.z + 1.2, heading: Math.PI, distance: 0 } }, { ...d.fighters[1], phase: 'ready', age: 0, posture: 0 }] };
    d = run(stepDuel(d, [act('light'), idle()]), LIGHT);
  }
  assert.equal(d.fighters[1].health, 0); assert.equal(d.fighters[1].phase, 'dead'); assert.equal(d.finish?.victim, 1); assert.equal(d.finish?.move, Math.ceil(HP / light.damage) % 2 ? 'light_right' : 'light_left', 'the single button alternates sides');
  assert.ok(['head', 'torso', 'legs'].includes(d.finish!.location)); assert.equal(d.finish?.location, d.fighters[1].woundSite);
  const frozen = run(d, 200, act('heavy', { move: { x: 1, z: 1, yaw: 0, run: true }, guard: true }), act('light'));
  assert.deepEqual(frozen.fighters[0].body, d.fighters[0].body); assert.equal(frozen.fighters[0].stamina, d.fighters[0].stamina); assert.equal(frozen.fighters[1].health, 0);
  for (const action of ['light', 'heavy', 'kick', 'dodge', 'parry'] as const) assert.equal(legal(frozen.fighters[1], action), false);
});

test('held guard blocks a facing light for stamina; a guard from behind or without stamina is broken', () => {
  const incoming = (d: Duel) => run(d, light.windup + 1, hold(), act('light'));
  const blocked = incoming(stepDuel(duel(), [hold(), idle()]));
  assert.equal(blocked.fighters[0].health, HP); assert.equal(blocked.fighters[0].stamina, 100 - light.staminaDamage); assert.equal(blocked.fighters[0].wound, 0);
  assert.deepEqual(types(blocked), ['AttackActive', 'Blocked']);
  const behind = incoming(stepDuel(duel(1.2, 0), [hold(), idle()]));
  assert.equal(behind.fighters[0].health, HP - Math.round(light.damage * RULES.rear.damage), 'a hit from behind also earns the rear bonus'); assert.ok(behind.events.find(e => e.type === 'Hit')?.rear);
  const weak = { ...duel(), fighters: [{ ...duel().fighters[0], stamina: 5 }, duel().fighters[1]] } as Duel;   // even with a guard's half-rate regeneration it cannot reach the block's price by contact
  const broken = incoming(stepDuel(weak, [hold(), idle()]));
  assert.equal(broken.fighters[0].health, HP - light.damage); assert.equal(broken.fighters[0].stamina, 0); assert.equal(broken.fighters[0].exhausted, true); assert.equal(broken.fighters[0].phase, 'hurt');
  assert.deepEqual(types(broken), ['AttackActive', 'StaminaExhausted', 'GuardBroken', 'Staggered']);
  const distant = run(stepDuel(duel(4), [hold(), idle()]), 10, hold());
  assert.equal(distant.fighters[0].stamina, 100, 'guarding costs nothing without contact');
});

test('perfect block: a guard raised just in time pays half; a settled guard pays full; a parry window never counts', () => {
  const incoming = (guardAge: number, parrying = false) => stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', guardDirection: 'right', age: guardAge, parrying }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [vs('light_left'), idle()]);
  for (const age of [RULES.parry, RULES.parry + RULES.perfectBlock - 2]) {
    const d = incoming(age);
    assert.equal(d.fighters[0].stamina, 100 - light.staminaDamage * RULES.perfectBlockCost, `guard age ${age}`);
    const blocked = d.events.find(e => e.type === 'Blocked')!;
    assert.equal(blocked.perfect, true); assert.equal(blocked.stamina, light.staminaDamage * RULES.perfectBlockCost);
  }
  const settled = incoming(RULES.parry + RULES.perfectBlock);
  assert.equal(settled.fighters[0].stamina, 100 - light.staminaDamage); assert.equal(settled.events.find(e => e.type === 'Blocked')!.perfect, false);
  // A live parry window parries instead. A fresh press still *held* when its window closes becomes the standing guard — and its first
  // perfectBlock ticks are the perfect block, so 'hold Guard a little early' is the natural way to find it. A *released* tap is exposed.
  assert.ok(types(incoming(RULES.parry - 2, true)).includes('Parried'));
  const heldOn = run(stepDuel(duel(), [act('parry', { guard: true, guardDirection: 'left' }), idle()]), RULES.parry, hold());
  assert.equal(heldOn.fighters[0].phase, 'guard'); assert.equal(heldOn.fighters[0].exposed, 0); assert.equal(heldOn.fighters[0].parrying, false);
  const viaHold = run({ ...heldOn, fighters: [heldOn.fighters[0], { ...heldOn.fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, 1, vs('light_left'), idle());
  assert.equal(viaHold.events.find(e => e.type === 'Blocked')?.perfect, true, 'the tick after the window closes is a perfect block when held');
  const released = run(stepDuel(duel(), [act('parry', { guard: true, guardDirection: 'left' }), idle()]), RULES.parry, idle());
  assert.equal(released.fighters[0].phase, 'ready'); assert.ok(released.fighters[0].exposed > 0, 'a released tap that met nothing is exposed');
  // Composes with a guard profile.
  const shielded = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', guardDirection: 'right', age: RULES.parry, guardProfile: { costScale: .5 } }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [vs('light_left'), idle()]);
  assert.equal(shielded.fighters[0].stamina, 100 - light.staminaDamage * .5 * RULES.perfectBlockCost);
});

test('parry succeeds only inside the fresh-press window, staggers the attacker and opens one stronger riposte', () => {
  const attackerAt = (d: Duel, age: number) => ({ ...d, fighters: [d.fighters[0], { ...d.fighters[1], phase: 'attack' as const, move: 'light_left' as const, age, chained: false, landed: false, lastMove: 'light_left' as const }] } as Duel);
  const contact = light.windup;
  const parried = stepDuel(attackerAt(duel(), contact - 1), [act('parry', { guard: true, guardDirection: 'right' }), idle()]);
  assert.deepEqual(types(parried), ['ActionStarted', 'AttackActive', 'Parried', 'Staggered']);
  assert.equal(parried.fighters[0].health, HP); assert.equal(parried.fighters[0].stamina, 100); assert.equal(parried.fighters[0].punish, RULES.parryStun);
  assert.equal(parried.fighters[1].phase, 'hurt'); assert.equal(parried.fighters[1].stun, RULES.parryStun); assert.equal(parried.fighters[1].landed, true);
  for (const [action, expected] of [['light', 'slash_riposte'], ['light_left', 'slash_riposte'], ['light_right', 'slash_riposte'], ['thrust', 'riposte'], ['heavy', 'heavy_riposte']] as const) {
    const answer = stepDuel(parried, [act(action), idle()]);
    assert.equal(answer.fighters[0].move, expected, `parry then ${action}`);
    assert.equal(answer.fighters[0].stamina, 100 - MOVES[expected].stamina);
    assert.equal(answer.fighters[0].punish, 0, 'the reward is consumed once');
    assert.equal(run(answer, MOVES[expected].windup).fighters[1].health, HP - MOVES[expected].damage);
  }
  const late = stepDuel(attackerAt({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', guardDirection: 'right', age: RULES.parry, parrying: false }, duel().fighters[1]] }, contact - 1), [vs('light_left'), idle()]);
  assert.ok(types(late).includes('Blocked'), 'after the window a held guard only blocks');
  for (const [action, expected] of [['light', 'light_right'], ['thrust', 'thrust'], ['heavy', 'heavy_counter']] as const) {
    assert.equal(stepDuel(late, [act(action), idle()]).fighters[0].move, expected, `ordinary block then ${action}`);
  }
  const cooling = stepDuel(attackerAt({ ...duel(), fighters: [{ ...duel().fighters[0], parryCooldown: 2 }, duel().fighters[1]] }, contact - 1), [act('parry', { guard: true, guardDirection: 'right' }), idle()]);
  assert.ok(types(cooling).includes('Blocked'), 'a press during cooldown opens no window');
  const boundary = stepDuel(attackerAt({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', guardDirection: 'right', age: RULES.parry - 2, parrying: true }, duel().fighters[1]] }, contact - 1), [vs('light_left'), idle()]);
  assert.ok(types(boundary).includes('Parried'), 'the last tick of the window still parries');
  let counter = run(parried, RULES.parry + 1, hold());
  counter = stepDuel(counter, [idle(), idle()]);   // release the guard, then strike
  counter = stepDuel(counter, [act('light'), idle()]);
  assert.equal(counter.fighters[0].move, 'slash_riposte'); assert.equal(counter.fighters[0].punish, 0);
  counter = run(counter, MOVES.slash_riposte.windup);
  assert.equal(counter.fighters[1].health, HP - MOVES.slash_riposte.damage); assert.equal(counter.fighters[1].phase, 'hurt');
  assert.equal(stepDuel(run(counter, total(MOVES.slash_riposte)), [act('light'), idle()]).fighters[0].move, 'light_right', 'one riposte per parry');
});

test('a fresh parry tap that meets nothing leaves the fighter exposed: guard is refused until the exposure ends; a held press never is', () => {
  assert.equal(RULES.parryRecovery, 8);
  let d = stepDuel(duel(), [act('parry', { guard: true, guardDirection: 'left' }), idle()]);
  d = run(d, RULES.parry - 1, hold());
  assert.equal(d.fighters[0].phase, 'guard');
  const kept = stepDuel(d, [hold(), idle()]); assert.equal(kept.fighters[0].phase, 'guard', 'still held: the standing guard, no hole'); assert.equal(kept.fighters[0].exposed, 0);
  d = stepDuel(d, [idle(), idle()]);   // released as the window closes
  assert.equal(d.fighters[0].phase, 'ready'); assert.equal(d.fighters[0].exposed, RULES.parryRecovery);
  assert.equal(stepDuel(d, [hold(), idle()]).fighters[0].phase, 'ready', 'guard is refused while exposed');
  assert.equal(legal(d.fighters[0], 'parry'), false, 'the control gate agrees with the engine while exposed');
  assert.equal(run(d, RULES.parryRecovery - 1, hold()).fighters[0].phase, 'ready');
  assert.equal(run(d, RULES.parryRecovery + 1, hold()).fighters[0].phase, 'guard', 'exposure ends and the held guard engages');
  const off = { ...RULES, parryRecovery: 0 } as unknown as typeof RULES;   // RULES is `as const`; an override is the same shape with one literal widened
  assert.equal(run(stepDuel(duel(), [act('parry', { guard: true, guardDirection: 'left' }), idle()], off), RULES.parry + 2, hold(), idle(), off).fighters[0].phase, 'guard', 'with the rule off a held guard simply stays up');
  // A parry that connects is never punished: the punish window proves it.
  const parried = stepDuel({ ...duel(), fighters: [duel().fighters[0], { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [act('parry', { guard: true, guardDirection: 'right' }), idle()]);
  assert.ok(types(parried).includes('Parried'));
  assert.equal(run(parried, RULES.parry + 1, hold()).fighters[0].exposed, 0);
});

test('a guard yields to any action: attacks start the same tick from a held guard', () => {
  const guarding = run(stepDuel(duel(), [hold(), idle()]), 12, hold());
  assert.equal(guarding.fighters[0].phase, 'guard');
  for (const [action, move] of [['light', 'light_right'], ['heavy', 'heavy_overhead'], ['kick', 'kick']] as const) {
    const out = stepDuel(guarding, [act(action, { guard: true }), idle()]);
    assert.equal(out.fighters[0].phase, 'attack', action); assert.equal(out.fighters[0].move, move); assert.equal(out.fighters[0].parrying, false);
  }
  assert.equal(stepDuel(guarding, [act('dodge', { guard: true }), idle()]).fighters[0].phase, 'roll');
  // Guard held while ready and a light pressed on the same tick: the attack wins, the guard resumes after it.
  let both = stepDuel(duel(), [act('light', { guard: true }), idle()]);
  assert.equal(both.fighters[0].phase, 'attack');
  both = run(both, LIGHT + 1, hold());
  assert.equal(both.fighters[0].phase, 'guard'); assert.equal(both.fighters[0].parrying, false, 'a resumed hold is a block, not a parry');
});

test('feint: a fresh guard press early in a wind-up abandons the swing into a parry window for a price', () => {
  const d = run(stepDuel(duel(), [act('light'), idle()]), 3);
  assert.equal(legal(d.fighters[0], 'parry'), true);
  const feinted = stepDuel(d, [act('parry', { guard: true, guardDirection: 'left' }), idle()]);
  assert.equal(feinted.fighters[0].phase, 'guard'); assert.equal(feinted.fighters[0].age, 0); assert.equal(feinted.fighters[0].parrying, true);
  assert.equal(feinted.fighters[0].stamina, 100 - light.stamina - RULES.feintCost); assert.equal(feinted.fighters[0].parryCooldown, RULES.parryCooldown);
  assert.deepEqual(types(feinted), ['ActionStarted']); assert.equal(feinted.events[0].action, 'feint');
  assert.equal(run(feinted, LIGHT, hold()).fighters[1].health, HP, 'the abandoned swing never lands');
  assert.equal(run(feinted, LIGHT, hold()).fighters[0].chain, 0, 'and opens no chain window');
  // Too late: the swing is committed and the press is neither accepted nor queued.
  const late = run(stepDuel(duel(), [act('light'), idle()]), light.feintUntil);
  assert.equal(legal(late.fighters[0], 'parry'), false);
  const pressed = stepDuel(late, [act('parry', { guard: true, guardDirection: 'left' }), idle()]);
  assert.equal(pressed.fighters[0].phase, 'attack'); assert.equal(pressed.fighters[0].buffer, null);
  assert.equal(run(pressed, light.windup, hold()).fighters[1].health, HP - light.damage);
  // Heavy has a longer window; a kick has none; a held guard alone (no fresh press) never feints; exhaustion forbids it.
  assert.equal(stepDuel(run(stepDuel(duel(), [act('heavy'), idle()]), heavy.feintUntil - 1), [act('parry', { guard: true, guardDirection: 'overhead' }), idle()]).fighters[0].phase, 'guard');
  assert.equal(stepDuel(run(stepDuel(duel(), [act('heavy'), idle()]), heavy.feintUntil), [act('parry', { guard: true, guardDirection: 'overhead' }), idle()]).fighters[0].phase, 'attack');
  assert.equal(stepDuel(run(stepDuel(duel(1.05), [act('kick'), idle()]), 2), [act('parry', { guard: true, guardDirection: 'left' }), idle()]).fighters[0].move, 'kick');
  assert.equal(stepDuel(run(stepDuel(duel(), [act('light'), idle()]), 2), [hold(), idle()]).fighters[0].phase, 'attack');
  const broke = { ...duel(), fighters: [{ ...duel().fighters[0], stamina: 25 }, duel().fighters[1]] } as Duel;
  const poor = stepDuel(run(stepDuel(broke, [act('light'), idle()]), 2), [act('parry', { guard: true, guardDirection: 'left' }), idle()]);
  assert.equal(poor.fighters[0].phase, 'attack', 'cannot afford the feint');
  // On cooldown the feint still cancels the swing, but into a plain guard without a window.
  const cooling = { ...duel(), fighters: [{ ...duel().fighters[0], parryCooldown: 20 }, duel().fighters[1]] } as Duel;
  const plain = stepDuel(run(stepDuel(cooling, [act('light'), idle()]), 2), [act('parry', { guard: true, guardDirection: 'left' }), idle()]);
  assert.equal(plain.fighters[0].phase, 'guard'); assert.equal(plain.fighters[0].parrying, false); assert.equal(plain.fighters[0].age, RULES.parry);
});

test('guard profile: a shield is data — block cost, arc, window and stopping heavies come from the fighter, defaults from RULES', () => {
  const withGuard = (profile: Partial<GuardProfile>) => { const d = duel(); d.fighters[0] = { ...d.fighters[0], guardProfile: profile }; return run(stepDuel(d, [hold(), idle()]), RULES.parry + 1, hold()); };
  const incoming = (d: Duel, move: 'light_left' | 'heavy_overhead' = 'light_left') => run({ ...d, fighters: [d.fighters[0], { ...d.fighters[1], phase: 'attack', move, age: MOVES[move].windup - 1, lastMove: move }] } as Duel, 1, vs(move), idle());
  assert.equal(incoming(withGuard({})).fighters[0].stamina, 100 - MOVES.light_left.staminaDamage);
  assert.equal(incoming(withGuard({ costScale: .5 })).fighters[0].stamina, 100 - MOVES.light_left.staminaDamage * .5);
  const chipped = incoming(withGuard({}), 'heavy_overhead');
  assert.ok(types(chipped).includes('Blocked')); assert.equal(chipped.fighters[0].health, HP - Math.round(heavy.damage * heavy.chip), 'a plain heavy is blocked for chip');
  const shield = incoming(withGuard({ stopsHeavy: true }), 'heavy_overhead');
  assert.ok(types(shield).includes('Blocked')); assert.equal(shield.fighters[0].health, HP - Math.round(heavy.damage * heavy.chip), 'stopsHeavy is about the break, chip is the move\'s');
  const behind = withGuard({ arc: Math.PI }); behind.fighters[0] = { ...behind.fighters[0], body: { ...behind.fighters[0].body, heading: 0 } };
  assert.ok(types(incoming(behind)).includes('Blocked'), 'a full-circle arc blocks from behind');
  const wide = duel(); wide.fighters[0] = { ...wide.fighters[0], guardProfile: { window: 16 } };
  // Press so that contact falls on the window's 15th tick: inside a 16-tick window, outside the default 10.
  let lateParry = { ...wide, fighters: [wide.fighters[0], { ...wide.fighters[1], phase: 'attack', move: 'light_left', age: 0, lastMove: 'light_left' }] } as Duel;
  lateParry = run(lateParry, light.windup - 15, idle(), idle()); lateParry = stepDuel(lateParry, [act('parry', { guard: true, guardDirection: 'right' }), idle()]); lateParry = run(lateParry, 14, vs('light_left'), idle());
  assert.ok(types(lateParry).includes('Parried'), 'a 16-tick window still parries at its tick 15');
});

test('the feint mind-game: a raised guard answers the feint; the kick that opens it is taken through the guard by a blocker and rolled by a dodger — never blocked or parried', () => {
  // A blocking opponent (no parry, no roll) raises its guard as soon as it notices the heavy; a dodger has the roll.
  const play = (dodge: number, read = 0) => {
    const profile = { ...PROFILES.hard, reaction: 7, parry: 0, dodge, read };   // a quick blocker: the feint must land inside the heavy's feint window. read 0: he never guards low, so the kick shoves (directional guard)
    let d = duel(1.1), ai = initialAi(); const seen: string[] = [];
    const step = (intent: Intent) => { const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [intent, w.intent]); seen.push(...d.events.map(e => `${e.type}:${e.actor}${e.action ? ':' + e.action : ''}${e.move ? ':' + e.move : ''}`)); };
    step(act('heavy'));
    for (let i = 0; i < heavy.feintUntil - 2; i++) step(idle());
    assert.equal(d.fighters[1].phase, 'guard', 'the opponent has raised its guard against the heavy');
    step(act('parry', { guard: true, guardDirection: 'left' }));
    assert.ok(seen.includes('ActionStarted:0:feint'));
    // The kick is the answer to a raised guard. The warden never guards or parries it; with its dodge share it rolls, otherwise the guard is opened.
    step(act('kick', { guard: true }));
    for (let i = 0; i < kick.windup; i++) step(idle());
    return { seen, d };
  };
  const blocker = play(0);
  assert.ok(blocker.seen.includes('Hit:0:kick'), `the kick opens the blocker's guard: ${blocker.seen.join(' ')}`); assert.equal(blocker.d.fighters[1].phase, 'hurt', 'and staggers it');
  assert.ok(!blocker.seen.includes('ActionStarted:1:parry'), 'no parry press at a kick');
  const dodger = play(1);
  assert.ok(dodger.seen.includes('ActionStarted:1:roll'), `the dodger rolls the kick: ${dodger.seen.join(' ')}`); assert.ok(!dodger.seen.includes('Hit:0:kick'), 'and it does not land');
  // Directional guard: a blocker who READS the kick drops his guard low and braces it — a block, no stagger (owner 2026-09-20: low is a read, not a wall).
  const reader = play(0, 1);
  assert.ok(reader.seen.includes('Blocked:1:kick'), `the reading blocker braces the kick: ${reader.seen.join(' ')}`); assert.ok(!reader.seen.includes('Hit:0:kick')); assert.equal(reader.d.fighters[1].phase, 'guard', 'and is not staggered');
});

// Runs n ticks and collects every event type seen along the way (d.events holds only the last tick's).
const runSeen = (d: Duel, n: number, a: Intent, b: Intent, seen: string[]): Duel => { for (let i = 0; i < n; i++) { d = stepDuel(d, [a, b]); seen.push(...d.events.map(e => e.type)); } return d; };

test('directional guard (on by default): a held guard covers one side, mirrored — a LEFT guard meets a RIGHT cut; no side is the straight guard (thrust), never everything', () => {
  assert.equal(RULES.directionalGuard, true, 'owner 2026-09-20: on by default');
  const block = (side: Intent['guardDirection'] | undefined, attack: 'light_right' | 'light_left' | 'heavy_overhead' | 'thrust') => {
    const g = side === undefined ? { ...idle(), guard: true } : hold({ guardDirection: side });
    let d = stepDuel(duel(), [g, idle()]); d = run(d, RULES.parry, g, idle());   // past the parry window: a standing guard
    const seen: string[] = [];
    d = stepDuel(d, [g, act(attack === 'heavy_overhead' ? 'heavy' : attack)]); d = runSeen(d, MOVES[attack].windup + 1, g, idle(), seen);
    return seen.includes('Blocked');   // a blocked heavy still chips, so the event is the judge, not full health
  };
  assert.equal(block('left', 'light_right'), true, 'a left guard blocks the right cut arriving on the defender\'s left');
  assert.equal(block('right', 'light_right'), false, 'a right guard is on the wrong side of a right cut'); assert.equal(block('right', 'light_left'), true, 'and meets a left cut');
  assert.equal(block('overhead', 'light_right'), false); assert.equal(block('low', 'light_right'), false);
  assert.equal(block('overhead', 'heavy_overhead'), true); assert.equal(block('left', 'heavy_overhead'), false);
  assert.equal(block('thrust', 'thrust'), true); assert.equal(block('overhead', 'thrust'), false);
  assert.equal(block(undefined, 'thrust'), true, 'no side = the straight guard: it stops a thrust');
  assert.equal(block(undefined, 'light_right'), false, '…and nothing else (the old null clause blocked everything)');
});

test('a blow through a guard held on the wrong side is a Hit marked guarded; an unguarded Hit carries no mark (presentation tells a failed block from no guard)', () => {
  const landed = (g: Intent, attack: 'light_right' | 'kick') => {
    let d = stepDuel(duel(), [g, idle()]); d = run(d, RULES.parry, g, idle());
    d = stepDuel(d, [g, act(attack)]); const hits: CombatEvent[] = [];
    for (let i = 0; i < MOVES[attack].windup + 12 && !hits.length; i++) { d = stepDuel(d, [g, idle()]); hits.push(...d.events.filter(e => e.type === 'Hit')); }
    return hits[0];
  };
  assert.equal(landed(hold({ guardDirection: 'right' }), 'light_right')?.guarded, true, 'a right guard against a right cut: the guard was up, on the wrong side');
  assert.equal(landed(hold({ guardDirection: 'left' }), 'kick')?.guarded, true, 'a kick into a raised guard other than low shoves through it');
  const bare = landed(idle(), 'light_right');
  assert.ok(bare, 'the unguarded cut lands'); assert.equal(bare.guarded, undefined, 'no guard up: no mark');
});

test('directional parry: a fresh press turns the blade only on the matching (mirrored) side; the wrong side meets nothing and the cut lands', () => {
  const parry = (side: Intent['guardDirection']) => {
    const seen: string[] = [];
    let d = stepDuel(duel(), [idle(), act('light_right')]);   // the foe's right cut: windup 20
    d = run(d, light.windup - RULES.parry + 2, idle(), idle());
    d = stepDuel(d, [act('parry', { guard: true, guardDirection: side }), idle()]); seen.push(...d.events.map(e => e.type));   // pressed so the window covers contact
    d = runSeen(d, RULES.parry + 2, hold({ guardDirection: side }), idle(), seen);
    return { parried: seen.includes('Parried'), hp: d.fighters[0].health };
  };
  assert.deepEqual(parry('left'), { parried: true, hp: HP });
  assert.equal(parry('right').parried, false); assert.equal(parry('right').hp, HP - light.damage);
  assert.equal(parry('thrust').parried, false, 'the straight parry does not turn a cut');
});

test('a kick into a LOW guard is braced — an ordinary block: the kick\'s block cost, no stagger, no damage, the guard-counter window opens; into any other held side it shoves as before', () => {
  const kicked = (side: Intent['guardDirection'] | undefined) => {
    const g = side === undefined ? { ...idle(), guard: true } : hold({ guardDirection: side });
    let d = stepDuel(duel(1.0), [g, idle()]); d = run(d, RULES.parry, g, idle());
    const stamina = d.fighters[0].stamina;
    const seen: string[] = [];
    d = stepDuel(d, [g, act('kick')]); d = runSeen(d, kick.windup + 1, g, idle(), seen);
    const me = d.fighters[0];
    return { blocked: seen.includes('Blocked'), staggered: me.phase === 'hurt', hp: me.health, spent: Math.round(stamina - me.stamina), counter: me.counterWindow > 0 };
  };
  const low = kicked('low');
  assert.deepEqual(low, { blocked: true, staggered: false, hp: HP, spent: kick.staminaDamage, counter: true });
  for (const side of ['left', 'overhead', undefined] as const) {
    const other = kicked(side);
    assert.equal(other.blocked, false, `${side ?? 'straight'} guard: the kick is not blocked`); assert.equal(other.staggered, true, 'the shove lands'); assert.equal(other.spent, kick.vsGuard!.staminaDamage, 'and drains the guard as before');
  }
});

test('a held guard follows the thumb: the side changes mid-hold without a new press, and the block is judged on the side held at contact', () => {
  let d = stepDuel(duel(), [hold({ guardDirection: 'overhead' }), idle()]); d = run(d, RULES.parry, hold({ guardDirection: 'overhead' }), idle());
  d = stepDuel(d, [hold({ guardDirection: 'overhead' }), act('light_right')]);   // a right cut is coming; the guard is up overhead
  d = run(d, 6, hold({ guardDirection: 'overhead' }), idle());
  assert.equal(d.fighters[0].guardDirection, 'overhead');
  const seen: string[] = [];
  d = runSeen(d, light.windup - 6, hold({ guardDirection: 'left' }), idle(), seen);   // slide left before contact
  assert.equal(d.fighters[0].guardDirection, 'left', 'the held guard took the slide');
  assert.equal(d.fighters[0].health, HP, 'and the cut was blocked on the new side'); assert.ok(seen.includes('Blocked'));
  assert.equal(d.fighters[0].phase, 'guard', 'still guarding: no re-press was needed');
});

test('roll: bounded invulnerability, one cost, locked direction, no cancel from an attack, cannot be spammed', () => {
  let rolling = stepDuel(duel(), [act('dodge', { move: { x: 1, z: 0, yaw: 0, run: false } }), idle()]);
  assert.equal(rolling.fighters[0].phase, 'roll'); assert.equal(rolling.fighters[0].stamina, 70);
  const heading = rolling.fighters[0].body.heading;
  rolling = stepDuel(rolling, [act('dodge', { move: { x: -1, z: 0, yaw: 0, run: false } }), idle()]);
  assert.equal(rolling.fighters[0].stamina, 70); assert.equal(rolling.fighters[0].body.heading, heading);
  for (const [age, safe] of [[RULES.safeStart - 2, false], [RULES.safeStart - 1, true], [RULES.safeEnd - 1, true], [RULES.safeEnd, false]] as const) {
    const d = { ...duel(), fighters: [{ ...duel().fighters[0], phase: 'roll' as const, age }, { ...duel().fighters[1], phase: 'attack' as const, move: 'light_left' as const, age: light.windup - 1, lastMove: 'light_left' as const }] } as Duel;
    const after = stepDuel(d, [idle(), idle()]);
    const expected = safe ? HP : age + 1 > RULES.safeEnd ? HP - Math.round(light.damage * RULES.counter.damage) : HP - light.damage;   // the tail of a roll is a counter-hit
    assert.equal(after.fighters[0].health, expected, `roll age ${age + 1}`);
    if (safe) assert.ok(types(after).includes('Dodged'));
  }
  assert.equal(stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], stamina: 29 }, duel().fighters[1]] }, [act('dodge'), idle()]).fighters[0].phase, 'ready');
  assert.equal(stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'attack', move: 'light_right', age: 3 }, duel().fighters[1]] }, [act('dodge'), idle()]).fighters[0].phase, 'attack');
  const away = run(stepDuel(duel(2), [act('dodge'), idle()]), RULES.roll);
  assert.ok(away.fighters[0].body.z > TARGET.z + 2.5, 'default roll retreats'); assert.ok(Math.hypot(away.fighters[0].body.x, away.fighters[0].body.z) <= RADIUS + 1e-9);
});

test('backstep: 0.6 m straight back, still facing, 10 stamina, no invulnerability, cancels into a swing late, holds into a roll', () => {
  const start = duel(1.2), before = start.fighters[0].body;
  let d = stepDuel(start, [act('backstep', { lock: true }), idle()]);
  assert.equal(d.fighters[0].phase, 'backstep'); assert.equal(d.fighters[0].stamina, 100 - RULES.backstep.cost); assert.deepEqual(types(d), ['ActionStarted']); assert.equal(d.events[0].action, 'backstep');
  d = run(d, RULES.backstep.ticks - 1, { ...idle(), lock: true });
  assert.equal(d.fighters[0].phase, 'backstep');
  d = stepDuel(d, [{ ...idle(), lock: true }, idle()]);
  assert.equal(d.fighters[0].phase, 'ready');
  assert.ok(Math.abs(d.fighters[0].body.z - before.z - .6) < 1e-6, `travelled ${(d.fighters[0].body.z - before.z).toFixed(3)} m`); assert.ok(Math.abs(d.fighters[0].body.x - before.x) < 1e-9);
  assert.equal(d.fighters[0].body.heading, before.heading, 'still facing the opponent');
  assert.equal(d.fighters[0].stamina, 100 - RULES.backstep.cost, 'paid once');
  // No invulnerability: a blade reaching the body during a backstep lands.
  const struck = stepDuel({ ...duel(1.0), fighters: [{ ...duel().fighters[0], phase: 'backstep', age: RULES.safeStart + 1 }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [idle(), idle()]);
  assert.equal(struck.fighters[0].health, HP - light.damage); assert.ok(!types(struck).includes('Dodged'));
  // Cannot spam without stamina; stays inside the arena.
  assert.equal(stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], stamina: 9 }, duel().fighters[1]] }, [act('backstep'), idle()]).fighters[0].phase, 'ready');
  const edge = { ...duel(), fighters: [{ ...duel().fighters[0], body: { x: 0, z: RADIUS - .2, heading: Math.PI, distance: 0 } }, duel().fighters[1]] } as Duel;
  assert.ok(Math.hypot(0, run(stepDuel(edge, [act('backstep'), idle()]), RULES.backstep.ticks).fighters[0].body.z) <= RADIUS + 1e-9);
  // The tail cancels into a swing; earlier presses are queued and fire at the cancel point.
  const tail = run(stepDuel(duel(1.2), [act('backstep'), idle()]), RULES.backstep.cancelFrom - 1);
  assert.equal(legal(tail.fighters[0], 'light'), false);
  const queued = stepDuel(tail, [act('light'), idle()]);
  assert.equal(queued.fighters[0].phase, 'backstep'); assert.equal(queued.fighters[0].buffer?.action, 'light');
  const swung = stepDuel(queued, [idle(), idle()]);
  assert.equal(swung.fighters[0].phase, 'attack', 'the queued light fires the first tick the tail allows it');
  assert.equal(stepDuel(run(stepDuel(duel(1.2), [act('backstep'), idle()]), RULES.backstep.cancelFrom), [act('heavy'), idle()]).fighters[0].move, 'heavy_overhead');
  // Holding the control: the step grows into a roll for the price difference, facing away like any roll.
  const held = stepDuel(run(stepDuel(duel(1.2), [act('backstep'), idle()]), 8), [act('dodge'), idle()]);
  assert.equal(held.fighters[0].phase, 'roll'); assert.equal(held.fighters[0].stamina, 100 - RULES.rollCost);
  assert.equal(stepDuel(run(stepDuel({ ...duel(1.2), fighters: [{ ...duel().fighters[0], stamina: 30 }, duel().fighters[1]] }, [act('backstep'), idle()]), 8), [act('dodge'), idle()]).fighters[0].phase, 'roll', 'the conversion needs only the difference');
  assert.equal(stepDuel(run(stepDuel({ ...duel(1.2), fighters: [{ ...duel().fighters[0], stamina: 25 }, duel().fighters[1]] }, [act('backstep'), idle()]), 8), [act('dodge'), idle()]).fighters[0].phase, 'backstep', 'and is refused without it');
});

test('stamina: costs at commitment, delayed regeneration, half-rate regeneration while guarding, sprint drain without the delay, exhaustion and recovery', () => {
  let d = stepDuel(duel(4), [act('light'), idle()]);
  assert.equal(d.fighters[0].stamina, 100 - light.stamina); assert.equal(d.fighters[0].rest, RULES.regenDelay);
  d = run(d, LIGHT - 1);
  assert.equal(d.fighters[0].stamina, 100 - light.stamina, 'no regeneration during the action (the delay is shorter than the cut now, but a swinging fighter never regenerates)');
  d = run(d, 1);
  assert.ok(Math.abs(d.fighters[0].stamina - (100 - light.stamina) - RULES.regen) < 1e-9, 'the first tick back in ready regenerates: the delay has passed');
  // A raised guard regenerates at half rate once the delay has passed (it used to stop regeneration): after 200 ticks of guarding, 80 + (200 − LIGHT − delay) × regen / 2, capped.
  const guarded = run(stepDuel(duel(4), [act('light'), idle()]), 100, hold());
  const guardTicks = 100 - Math.max(RULES.regenDelay, LIGHT - 1);   // no regeneration while the cut runs; the guard is up (and the delay over) from the tick it ends
  assert.ok(Math.abs(guarded.fighters[0].stamina - ((100 - light.stamina) + guardTicks * RULES.regen * RULES.guardRegen)) <= RULES.regen, `guard regenerates at half rate: ${guarded.fighters[0].stamina}`);
  assert.ok(guarded.fighters[0].stamina > 80 && guarded.fighters[0].stamina < 100, 'slower than standing, faster than nothing');
  const sprint = run(duel(4), 30, { ...idle(), move: { x: 0, z: 1, yaw: 0, run: true } });
  assert.equal(sprint.fighters[0].rest, 1, 'a sprint never sets the action delay: only the sprinting tick itself goes without regeneration');
  const afterSprint = run(sprint, 3);
  assert.ok(afterSprint.fighters[0].stamina > sprint.fighters[0].stamina, 'regeneration resumes the tick the sprint stops');
  assert.ok(sprint.fighters[0].stamina < 100 && sprint.fighters[0].stamina > 90);
  let spent = { ...duel(), fighters: [{ ...duel().fighters[0], stamina: 30 }, duel().fighters[1]] } as Duel;
  spent = stepDuel(spent, [act('dodge'), idle()]);
  assert.equal(spent.fighters[0].stamina, 0); assert.equal(spent.fighters[0].exhausted, true); assert.deepEqual(types(spent), ['StaminaExhausted', 'ActionStarted']);
  spent = run(spent, RULES.roll);
  for (const action of ['light', 'heavy', 'kick', 'dodge', 'parry'] as const) assert.equal(legal(spent.fighters[0], action), false, action);
  assert.equal(stepDuel(spent, [hold(), idle()]).fighters[0].phase, 'ready', 'guard is refused while exhausted');
  const walking = stepDuel(spent, [{ ...idle(), move: { x: 0, z: 1, yaw: 0, run: true } }, idle()]);
  assert.ok(Math.abs((walking.fighters[0].body.z - spent.fighters[0].body.z) - 3 * RULES.exhaustedSpeed / 60) < 1e-9, 'exhausted fighters walk slowly and cannot sprint');
  const recovered = run(spent, RULES.regenDelay + Math.ceil(RULES.exhaustRecover / RULES.regen) + 1);
  assert.equal(recovered.fighters[0].exhausted, false); assert.ok(legal(recovered.fighters[0], 'light'));
});

test('chain: the opposite cut follows fast inside the window; same side, expired window or a chained cut start fresh', () => {
  const d = run(stepDuel(duel(2.2), [act('light'), idle()]), LIGHT);
  assert.equal(d.fighters[0].phase, 'ready'); assert.equal(d.fighters[0].chain, light.chain!.window);
  const follow = stepDuel(d, [act('light'), idle()]);
  assert.equal(follow.fighters[0].move, 'light_left'); assert.equal(follow.fighters[0].chained, true);
  const done = run(follow, total(light.chained!));
  assert.equal(done.fighters[0].phase, 'ready'); assert.equal(done.fighters[0].chain, 0);
  assert.equal(stepDuel(done, [act('light'), idle()]).fighters[0].chained, false, 'a chained cut opens no further window');
  assert.equal(stepDuel(d, [act('light_right'), idle()]).fighters[0].chained, false, 'same side is a fresh cut');
  assert.equal(stepDuel(d, [act('heavy'), idle()]).fighters[0].move, 'heavy_overhead');
  assert.equal(stepDuel(run(d, light.chain!.window), [act('light'), idle()]).fighters[0].chained, false, 'window expires');
  assert.equal(stepDuel(duel(), [act('light_left'), idle()]).fighters[0].move, 'light_left');
  assert.equal(total(light.chained!), total(PATHS.light_left_chain));
});

test('chain grammar: a heavy inside a light\'s window winds up faster; a light out of an evade is a fast dodge-attack', () => {
  const afterLight = run(stepDuel(duel(2.2), [act('light'), idle()]), LIGHT);
  assert.ok(afterLight.fighters[0].chain > 0);
  const finisher = stepDuel(afterLight, [act('heavy'), idle()]);
  assert.equal(finisher.fighters[0].move, 'heavy_overhead'); assert.equal(finisher.fighters[0].chained, true);
  assert.equal(total(heavy.chained!), total(PATHS.heavy_overhead_chain)); assert.equal(heavy.chained!.windup, 22);
  const late = stepDuel(run(afterLight, light.chain!.window), [act('heavy'), idle()]);
  assert.equal(late.fighters[0].chained, false, 'outside the window a heavy is the full wind-up');
  assert.ok(types(run(finisher, heavy.chained!.windup)).includes('Hit'), 'the chained heavy lands at its own contact tick');
  const guarded = run(stepDuel(duel(), [idle(), hold()]), RULES.parry + 2, idle(), hold());
  const chainedBreak = run(stepDuel({ ...guarded, fighters: [{ ...guarded.fighters[0], chain: 10, lastMove: 'light_right' }, guarded.fighters[1]] } as Duel, [act('heavy'), vs('heavy')]), heavy.chained!.windup, idle(), vs('heavy'));
  assert.ok(types(chainedBreak).includes('Blocked') && chainedBreak.fighters[1].health === HP - Math.round(heavy.damage * heavy.chip), 'a chained heavy cannot charge, so a guard takes it for chip');
  // Dodge-attack: from a backstep's tail, or within dodgeAttackWindow ticks after a roll or backstep ends.
  const fromStep = stepDuel(run(stepDuel(duel(1.2), [act('backstep'), idle()]), RULES.backstep.cancelFrom), [act('light'), idle()]);
  assert.equal(fromStep.fighters[0].chained, true); assert.equal(fromStep.fighters[0].move, 'light_right');
  const rolled = run(stepDuel(duel(2.2), [act('dodge'), idle()]), RULES.roll);
  assert.equal(rolled.fighters[0].phase, 'ready'); assert.equal(rolled.fighters[0].evaded, RULES.dodgeAttackWindow);
  assert.equal(stepDuel(rolled, [act('light'), idle()]).fighters[0].chained, true, 'a light straight out of a roll is quick');
  assert.equal(stepDuel(run(rolled, RULES.dodgeAttackWindow), [act('light'), idle()]).fighters[0].chained, false, 'wait longer and it is an ordinary cut');
  assert.equal(stepDuel(rolled, [act('heavy'), idle()]).fighters[0].chained, false, 'only lights come out of an evade quickly');
  // Riposte choice during the punish window: light = counter cut (24), heavy = heavy riposte (30, breaks guard).
  const punishing = { ...duel(), fighters: [{ ...duel().fighters[0], punish: 60 }, duel().fighters[1]] } as Duel;
  assert.equal(stepDuel(punishing, [act('light'), idle()]).fighters[0].move, 'slash_riposte');
  const heavyRip = stepDuel(punishing, [act('heavy'), idle()]);
  assert.equal(heavyRip.fighters[0].move, 'heavy_riposte'); assert.equal(heavyRip.fighters[0].stamina, 100 - MOVES.heavy_riposte.stamina); assert.equal(heavyRip.fighters[0].punish, 0);
  assert.equal(run(heavyRip, MOVES.heavy_riposte.windup).fighters[1].health, HP - MOVES.heavy_riposte.damage);
  const ripGuard = run(stepDuel({ ...guarded, fighters: [{ ...guarded.fighters[0], punish: 60 }, guarded.fighters[1]] } as Duel, [act('heavy'), vs('heavy')]), MOVES.heavy_riposte.windup, idle(), vs('heavy'));
  assert.ok(types(ripGuard).includes('GuardBroken'));
});

test('counter-hit: a clean hit on a committed swing or a roll\'s tail lands harder and staggers longer; never through a guard or parry', () => {
  const light11 = light.damage, counterDmg = Math.round(light11 * RULES.counter.damage), counterStun = Math.round(light.stagger * RULES.counter.stagger);
  // Target mid wind-up (a slower heavy started first), attacker's light lands at its own contact tick.
  let d = stepDuel(duel(), [idle(), act('heavy')]); d = run(stepDuel(d, [act('light'), idle()]), light.windup);
  const hit = d.events.find(e => e.type === 'Hit')!;
  assert.equal(hit.counter, true); assert.equal(hit.damage, counterDmg); assert.equal(d.fighters[1].health, HP - counterDmg); assert.equal(d.fighters[1].stun, counterStun);
  // Target in recovery (whiff punish) is also a counter; a ready target is not.
  const whiff = run(stepDuel(duel(light.reach + 1), [idle(), act('light')]), light.windup + light.active - 1);   // the swing has just whiffed; the punish lands inside its recovery
  const punish = run(stepDuel({ ...whiff, fighters: [{ ...whiff.fighters[0], body: { ...whiff.fighters[0].body, z: whiff.fighters[1].body.z + 1.2 } }, whiff.fighters[1]] } as Duel, [act('light'), idle()]), light.windup);
  assert.equal(punish.events.find(e => e.type === 'Hit')?.counter, true);
  const plain = run(stepDuel(duel(), [act('light'), idle()]), light.windup);
  assert.equal(plain.events.find(e => e.type === 'Hit')?.counter, false); assert.equal(plain.fighters[1].health, HP - light11); assert.equal(plain.fighters[1].stun, light.stagger);
  // Roll tail counts, the invulnerable window does not exist to be countered, and a guard or parry never yields a counter.
  const tail = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'roll', age: RULES.safeEnd + 2 }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [idle(), idle()]);
  assert.equal(tail.events.find(e => e.type === 'Hit')?.counter, true); assert.equal(tail.fighters[0].health, HP - counterDmg);
  const guarded = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', guardDirection: 'right', age: 12 }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [vs('light_left'), idle()]);
  assert.ok(types(guarded).includes('Blocked')); assert.equal(guarded.fighters[0].stamina, 100 - light.staminaDamage);
  // Kicks and heavies use the same rule.
  const kicked = run(stepDuel(duel(1.05), [act('kick'), act('heavy')]), kick.windup);
  assert.equal(kicked.events.find(e => e.type === 'Hit')?.damage, Math.round(kick.damage * RULES.counter.damage));
});

test('rear hit: striking inside the target\'s rear arc earns a modest damage and stagger bonus, stacking with a counter', () => {
  const turned = (heading: number) => run(stepDuel({ ...duel(1.2, heading), fighters: [duel(1.2, heading).fighters[0], duel().fighters[1]] } as Duel, [idle(), act('light')]), light.windup);
  const behind = turned(0), side = turned(Math.PI / 2 + .3), front = turned(Math.PI);
  assert.equal(behind.events.find(e => e.type === 'Hit')?.rear, true); assert.equal(behind.fighters[0].health, HP - Math.round(light.damage * RULES.rear.damage)); assert.equal(behind.fighters[0].stun, Math.round(light.stagger * RULES.rear.stagger));
  assert.equal(side.events.find(e => e.type === 'Hit')?.rear, false, 'just outside the 90° rear arc is a normal hit');
  assert.equal(front.fighters[0].health, HP - light.damage);
  const both = run(stepDuel({ ...duel(1.0, 0), fighters: [{ ...duel(1.0, 0).fighters[0], phase: 'attack', move: 'heavy_overhead', age: 2, lastMove: 'heavy_overhead' }, duel().fighters[1]] } as Duel, [{ ...idle(), lock: false }, act('light')]), light.windup);
  assert.equal(both.fighters[0].health, HP - Math.round(light.damage * RULES.counter.damage * RULES.rear.damage), 'counter and rear multiply');
});

test('guard counter: a heavy thrown straight out of a block is fast and armoured; any attack or a stagger closes the window; a parry punish outranks it', () => {
  const blocked = run(stepDuel(duel(), [hold(), idle()]), RULES.perfectBlock + 1, hold());   // a settled guard: an ordinary block
  const after = run({ ...blocked, fighters: [blocked.fighters[0], { ...blocked.fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, 1, vs('light_left'), idle());
  assert.ok(types(after).includes('Blocked')); assert.equal(after.fighters[0].counterWindow, RULES.guardCounter);
  const counter = stepDuel(after, [act('heavy', { guard: true }), idle()]);
  assert.equal(counter.fighters[0].move, 'heavy_counter'); assert.equal(counter.fighters[0].counterWindow, 0); assert.equal(counter.fighters[0].stamina, 100 - light.staminaDamage - MOVES.heavy_counter.stamina);
  assert.equal(MOVES.heavy_counter.windup, MOVES.heavy_riposte.windup, 'shares the fast heavy path');
  // Armoured against a fast attack from its early wind-up, and that attack still lands (a thrust: 16 ticks, inside the counter's 20; a cut is 20 now and would trade after).
  let trade = { ...counter, fighters: [counter.fighters[0], { ...counter.fighters[1], phase: 'ready' as const, age: 0, move: null }] } as Duel;
  trade = stepDuel(trade, [idle(), idle()]); trade = run(stepDuel(trade, [idle(), act('thrust')]), MOVES.thrust.windup);
  assert.ok(types(trade).includes('Hit') && trade.fighters[0].health < HP, 'the thrust connects');
  assert.equal(trade.fighters[0].phase, 'attack', 'but does not interrupt the guard counter');
  trade = run(trade, MOVES.heavy_counter.windup - trade.fighters[0].age);
  assert.ok(types(trade).includes('Hit') && trade.fighters[1].health < HP - MOVES.heavy_counter.damage + 1, 'the counter lands');
  // The window expires; a light in the window is an ordinary light; a stagger or any attack consumes it.
  assert.equal(stepDuel(run(after, RULES.guardCounter, vs('heavy')), [act('heavy', { guard: true }), idle()]).fighters[0].move, 'heavy_overhead');
  assert.equal(stepDuel(after, [act('light', { guard: true }), idle()]).fighters[0].move, 'light_right');
  assert.equal(stepDuel(after, [act('light', { guard: true }), idle()]).fighters[0].counterWindow, 0);
  const struck = stepDuel({ ...after, fighters: [{ ...after.fighters[0], phase: 'ready' }, { ...after.fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left', landed: false }] } as Duel, [idle(), idle()]);
  assert.equal(struck.fighters[0].counterWindow, 0, 'being staggered closes the window');
  // A parry's punish window outranks it, and a perfect block opens it too.
  const parried = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], counterWindow: 10, punish: 30 }, duel().fighters[1]] } as Duel, [act('heavy'), idle()]);
  assert.equal(parried.fighters[0].move, 'heavy_riposte');
  const perfect = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', guardDirection: 'right', age: RULES.parry }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [vs('light_left'), idle()]);
  assert.equal(perfect.events.find(e => e.type === 'Blocked')?.perfect, true); assert.equal(perfect.fighters[0].counterWindow, RULES.guardCounter);
});

test('charged heavy: holding Heavy pauses the wind-up with hyper-armour; a long enough hold multiplies the swing; early release is a plain heavy', () => {
  const C = RULES.charge, heldIntent = { ...idle(), held: true };
  const d = run(stepDuel(duel(), [act('heavy', { held: true }), idle()]), heavy.chamber! + 3, heldIntent);
  assert.equal(d.fighters[0].age, heavy.chamber!, 'the wind-up holds at the charge point'); assert.equal(d.fighters[0].charge, 3); assert.equal(d.fighters[0].charged, false);
  assert.ok(run(stepDuel(duel(), [act('heavy', { held: true }), idle()]), heavy.chamber! + 1, heldIntent).events.some(e => e.type === 'Charging'));
  // Early release: an ordinary heavy from the charge point.
  const early = run(d, heavy.windup - heavy.chamber! + 1);
  assert.equal(early.fighters[0].charged, false); assert.equal(early.fighters[1].health, HP - heavy.damage); assert.equal(early.fighters[1].stun, heavy.stagger);
  // Long hold: charged. Damage and stagger multiplied; guard break also multiplied.
  let held = run(stepDuel(duel(), [act('heavy', { held: true }), idle()]), heavy.chamber! + C.min, heldIntent);
  assert.equal(held.fighters[0].charged, true); assert.equal(held.fighters[0].age, heavy.chamber!);
  held = run(held, heavy.windup - heavy.chamber!);   // exactly to the contact tick
  const hit = held.events.find(e => e.type === 'Hit')!;
  assert.equal(hit.charged, true); assert.equal(held.fighters[1].health, HP - Math.round(heavy.damage * C.damage)); assert.equal(held.fighters[1].stun, Math.round(heavy.stagger * C.stagger));
  // Maximum charge releases by itself.
  const maxed = run(stepDuel(duel(), [act('heavy', { held: true }), idle()]), heavy.chamber! + C.max + 2, heldIntent);
  assert.equal(maxed.fighters[0].charge, C.max); assert.equal(maxed.fighters[0].age, heavy.chamber! + 2, 'the swing continues at maximum charge even while held');
  // Hyper-armour while charging: a light lands (as a counter-hit) but does not interrupt; a feint is still possible from the charge.
  let armour = run(stepDuel(duel(), [act('heavy', { held: true }), idle()]), heavy.chamber! + 2, heldIntent);
  armour = run(stepDuel(armour, [heldIntent, act('light')]), light.windup, heldIntent);
  assert.ok(types(armour).includes('Hit')); assert.equal(armour.fighters[0].phase, 'attack'); assert.equal(armour.fighters[0].age, heavy.chamber!, 'still charging');
  assert.equal(armour.fighters[0].health, HP - Math.round(light.damage * RULES.counter.damage), 'but the light was a counter-hit');
  const feint = stepDuel(run(stepDuel(duel(), [act('heavy', { held: true }), idle()]), heavy.chamber! + 5, heldIntent), [act('parry', { guard: true, guardDirection: 'overhead' }), idle()]);
  assert.equal(feint.fighters[0].phase, 'guard'); assert.equal(feint.fighters[0].parrying, true);
  // Only the plain heavy charges: chained, riposte and guard-counter heavies ignore the hold.
  const chainedHeavy = run(stepDuel(run(stepDuel(duel(2.2), [act('light'), idle()]), LIGHT), [act('heavy', { held: true }), idle()]), heavy.chamber! + 3, heldIntent);
  assert.equal(chainedHeavy.fighters[0].charge, 0); assert.equal(chainedHeavy.fighters[0].age, heavy.chamber! + 3);
  const rip = run(stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], punish: 30 }, duel().fighters[1]] } as Duel, [act('heavy', { held: true }), idle()]), heavy.chamber! + 3, heldIntent);
  assert.equal(rip.fighters[0].move, 'heavy_riposte'); assert.equal(rip.fighters[0].charge, 0);
});

test('buffered input: one action queued in the last ticks of a committed move fires when ready, expires, and clears on cancellation', () => {
  let d = run(stepDuel(duel(2.2), [act('light'), idle()]), LIGHT - RULES.bufferWindow);
  d = stepDuel(d, [act('heavy'), idle()]);
  assert.deepEqual(d.fighters[0].buffer, { action: 'heavy', ttl: RULES.bufferTtl });
  d = stepDuel(d, [act('dodge'), idle()]);
  assert.equal(d.fighters[0].buffer?.action, 'dodge', 'the latest request replaces the queued one');
  d = run(d, RULES.bufferWindow - 2);
  assert.equal(d.fighters[0].phase, 'ready'); assert.equal(d.fighters[0].buffer?.action, 'dodge', 'ready for one tick before the queued action fires');
  d = stepDuel(d, [idle(), idle()]);
  assert.equal(d.fighters[0].phase, 'roll'); assert.equal(d.fighters[0].buffer, null);
  let early = run(stepDuel(duel(2.2), [act('light'), idle()]), LIGHT - RULES.bufferWindow - 1);
  early = stepDuel(early, [act('heavy'), idle()]);
  assert.equal(early.fighters[0].buffer, null, 'too early to queue');
  let cancelled = run(stepDuel(duel(2.2), [act('light'), idle()]), LIGHT - RULES.bufferWindow);
  cancelled = stepDuel(cancelled, [act('heavy'), idle()]);
  cancelled = stepDuel(cancelled, [{ ...idle(), cancel: true }, idle()]);
  assert.equal(cancelled.fighters[0].buffer, null);
  assert.equal(run(cancelled, RULES.bufferWindow).fighters[0].phase, 'ready');
  let starved = run(stepDuel({ ...duel(2.2), fighters: [{ ...duel().fighters[0], stamina: 40 }, duel().fighters[1]] }, [act('light'), idle()]), LIGHT - RULES.bufferWindow);
  starved = stepDuel(starved, [act('heavy'), idle()]);
  starved = run(starved, RULES.bufferTtl + 1);
  assert.equal(starved.fighters[0].phase, 'ready'); assert.equal(starved.fighters[0].buffer, null, 'an unaffordable queued action expires');
  // Roll and stagger tails queue too: a press as you come out of an evade or a hit is never lost.
  let rolling = run(stepDuel(duel(2.2), [act('dodge'), idle()]), RULES.roll - 3);
  rolling = stepDuel(rolling, [act('light'), idle()]);
  assert.equal(rolling.fighters[0].buffer?.action, 'light');
  rolling = run(rolling, 3);
  assert.equal(rolling.fighters[0].phase, 'attack', 'the queued light fires on the first ready tick after the roll');
  let hurt = { ...duel(2.2), fighters: [{ ...duel().fighters[0], phase: 'hurt' as const, age: 20, stun: 24 }, duel().fighters[1]] } as Duel;
  hurt = stepDuel(hurt, [act('heavy'), idle()]);
  assert.equal(hurt.fighters[0].buffer?.action, 'heavy');
  assert.equal(run(hurt, 4).fighters[0].move, 'heavy_overhead', 'the queued heavy fires as the stagger ends');
  const freshStagger = stepDuel({ ...duel(2.2), fighters: [{ ...duel().fighters[0], phase: 'hurt' as const, age: 2, stun: 24 }, duel().fighters[1]] } as Duel, [act('heavy'), idle()]);
  assert.equal(freshStagger.fighters[0].buffer, null, 'too early in the stagger to queue');
  let parry = run(stepDuel(duel(2.2), [act('light'), idle()]), LIGHT - 4);
  parry = run(stepDuel(parry, [act('parry', { guard: true, guardDirection: 'left' }), idle()]), 4, hold());
  assert.equal(parry.fighters[0].phase, 'guard'); assert.equal(parry.fighters[0].parrying, true, 'a queued parry opens its window on the first ready tick');
});

test('interrupts: a hit stops a wind-up; a heavy past its poise point trades through a light and still lands', () => {
  let d = stepDuel(duel(), [act('light'), act('light')]);
  d = run(d, light.windup);
  assert.deepEqual(types(d).filter(t => t === 'Hit'), ['Hit', 'Hit'], 'equal lights trade on the same tick');
  assert.equal(d.fighters[0].phase, 'hurt'); assert.equal(d.fighters[1].phase, 'hurt');
  let early = stepDuel(duel(), [act('light'), idle()]);
  early = stepDuel(early, [idle(), act('light')]);
  early = run(early, light.windup - 1);
  assert.equal(early.fighters[1].phase, 'hurt'); assert.equal(early.fighters[1].landed, false, 'a one-tick-later light is interrupted in its wind-up');
  let armoured = stepDuel(duel(), [act('heavy'), idle()]);
  armoured = run(armoured, heavy.poiseFrom - light.windup - 1);
  armoured = stepDuel(armoured, [idle(), act('light')]);
  armoured = run(armoured, light.windup);
  assert.equal(armoured.fighters[0].health, HP - Math.round(light.damage * RULES.counter.damage), 'a light on a winding-up heavy is a counter-hit'); assert.equal(armoured.fighters[0].phase, 'attack', 'poise absorbs the stagger, not the damage');
  armoured = run(armoured, heavy.windup - (armoured.fighters[0].age));
  assert.equal(armoured.fighters[1].health, HP - Math.round(heavy.damage * RULES.counter.damage), 'the heavy still lands, as a counter on the recovering light');
  let soft = stepDuel(duel(), [act('heavy'), idle()]);
  soft = stepDuel(soft, [idle(), act('light')]);
  soft = run(soft, light.windup);
  assert.equal(soft.fighters[0].phase, 'hurt', 'before the poise point a heavy is interrupted like anything else');
});

test('a guard takes a plain heavy for chip and stamina without staggering; a charged heavy, an empty stamina bar or a kick breaks it; a perfect block stops the chip', () => {
  const guarded = run(stepDuel(duel(), [idle(), hold()]), RULES.parry + 2, idle(), hold());
  const chip = Math.round(heavy.damage * heavy.chip);
  const blocked = run(stepDuel(guarded, [act('heavy'), vs('heavy')]), heavy.windup, idle(), vs('heavy'));
  assert.equal(blocked.fighters[1].health, HP - chip); assert.equal(blocked.fighters[1].stamina, 100 - heavy.staminaDamage); assert.equal(blocked.fighters[1].phase, 'guard', 'no stagger'); assert.equal(blocked.fighters[1].wound, 0, 'chip never marks a wound');
  const event = blocked.events.find(e => e.type === 'Blocked')!; assert.equal(event.damage, chip); assert.equal(event.stamina, heavy.staminaDamage); assert.equal(blocked.fighters[1].counterWindow, RULES.guardCounter, 'a blocked heavy opens the guard counter');
  const heldIntent = { ...idle(), held: true };
  const charged = run(run(stepDuel(guarded, [act('heavy', { held: true }), vs('heavy')]), heavy.chamber! + RULES.charge.min, heldIntent, vs('heavy')), heavy.windup - heavy.chamber!, idle(), vs('heavy'));
  assert.equal(charged.fighters[1].health, HP - Math.round(heavy.damage * RULES.charge.damage)); assert.equal(charged.fighters[1].stamina, 100 - RULES.breakCost, 'a break costs breakCost, not the whole bar'); assert.equal(charged.fighters[1].exhausted, false); assert.ok(charged.fighters[1].stamina >= RULES.rollCost, 'enough left to roll clear'); assert.equal(charged.fighters[1].stun, Math.round(heavy.stagger * RULES.charge.stagger));
  const broke = charged.events.find(e => e.type === 'GuardBroken')!;
  assert.ok(broke.charged, 'a charged heavy breaks a standing guard');
  // A guard break is a landed blow: like Hit and Killed it names the attacker as actor and the one struck as target (Blocked/Parried name the defender).
  assert.equal(broke.actor, 0); assert.equal(broke.target, 1); assert.equal(broke.damage, Math.round(heavy.damage * RULES.charge.damage));
  const landed = run(stepDuel(duel(), [act('light'), idle()]), light.windup).events.find(e => e.type === 'Hit')!, stopped = run(stepDuel(duel(), [act('light'), hold()]), light.windup, idle(), hold()).events.find(e => e.type === 'Blocked')!;
  assert.deepEqual([landed.actor, landed.target, stopped.actor, stopped.target], [0, 1, 1, 0], 'blows name the attacker first, defences the defender');
  const starved = run(stepDuel({ ...guarded, fighters: [guarded.fighters[0], { ...guarded.fighters[1], stamina: heavy.staminaDamage - 15 }] } as Duel, [act('heavy'), vs('heavy')]), heavy.windup, idle(), vs('heavy'));   // 15 short: a guard's half-rate regeneration over the wind-up cannot close it
  assert.equal(starved.fighters[1].health, HP - heavy.damage); assert.ok(types(starved).includes('GuardBroken'), 'without the stamina to pay, the guard breaks');
  const perfect = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'attack', move: 'heavy_overhead', age: heavy.windup - 1, lastMove: 'heavy_overhead' }, { ...duel().fighters[1], phase: 'guard', guardDirection: 'overhead', age: RULES.parry }] } as Duel, [idle(), vs('heavy')]);
  assert.equal(perfect.fighters[1].health, HP, 'a perfect block stops the chip'); assert.equal(perfect.events.find(e => e.type === 'Blocked')?.damage, undefined);
  const dying = run(stepDuel({ ...guarded, fighters: [guarded.fighters[0], { ...guarded.fighters[1], health: chip }] } as Duel, [act('heavy'), vs('heavy')]), heavy.windup, idle(), vs('heavy'));
  assert.equal(dying.fighters[1].health, 0); assert.equal(dying.fighters[1].phase, 'dead'); assert.equal(dying.finish?.victim, 1); assert.ok(types(dying).includes('Killed'), 'chip can kill, through the normal death path');
  const close = { ...guarded, fighters: [{ ...guarded.fighters[0], body: { ...guarded.fighters[0].body, z: TARGET.z + 1.05 } }, guarded.fighters[1]] } as Duel;
  let kicked = stepDuel(close, [act('kick'), hold()]);
  assert.equal(kicked.fighters[0].stamina, 75); assert.equal(kicked.fighters[0].move, 'kick');
  kicked = run(kicked, kick.windup - 1, idle(), hold()); assert.equal(kicked.fighters[1].health, HP);
  kicked = stepDuel(kicked, [idle(), hold()]);
  assert.equal(kicked.fighters[1].health, HP - kick.damage); assert.equal(kicked.fighters[1].stamina, 100 - kick.vsGuard!.staminaDamage); assert.equal(kicked.fighters[1].stun, kick.vsGuard!.stagger); assert.equal(kicked.fighters[1].wound, 0);
  assert.ok(kicked.fighters[1].body.z < TARGET.z, 'kick shoves'); assert.equal(run(kicked, total(kick) - kick.windup).fighters[0].phase, 'ready');
  const open = run(stepDuel({ ...duel(1.05), fighters: [duel(1.05).fighters[0], duel(1.05).fighters[1]] }, [act('kick'), idle()]), kick.windup);
  assert.equal(open.fighters[1].health, HP - kick.damage); assert.equal(open.fighters[1].stamina, 100 - kick.staminaDamage); assert.equal(open.fighters[1].stun, kick.stagger);
  for (const d of [duel(2), duel(1.05, 0)]) assert.equal(run(stepDuel(d, [act('kick'), idle()]), kick.windup).fighters[1].health, HP);
  // The kick cone is a rule of its own: a target off to the side stays in reach through the lunge yet must not be hit.
  const beside = duel(.9, Math.PI / 2);
  beside.fighters[0] = { ...beside.fighters[0], body: { x: 0, z: TARGET.z, heading: Math.PI / 2, distance: 0 } }; beside.fighters[1] = { ...beside.fighters[1], body: { x: 0, z: TARGET.z + .9, heading: Math.PI, distance: 0 } };
  assert.equal(run(stepDuel(beside, [act('kick'), idle()]), kick.windup).fighters[1].health, HP, 'a target 90° off the kick line is not hit');
  // A point-blank kick lunges, so a plain backstep during its wind-up cannot walk out of reach.
  const backing = run(stepDuel(duel(.9), [act('kick'), idle()]), kick.windup, idle(), { ...idle(), move: { x: 0, z: -.4, yaw: 0, run: false }, lock: true });
  assert.equal(backing.fighters[1].health, HP - kick.damage);
  assert.equal(stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], stamina: 24 }, duel().fighters[1]] }, [act('kick'), idle()]).fighters[0].move, null);
  const fromGuard = stepDuel(run(stepDuel(duel(1.05), [hold(), idle()]), 12, hold()), [act('kick', { guard: true }), idle()]);
  assert.equal(fromGuard.fighters[0].move, 'kick');
});

test('wounds slow regeneration for a while, refresh without stacking, and only come from unblocked cuts', () => {
  const d = run(stepDuel(duel(), [act('light'), idle()]), light.windup);
  assert.equal(d.fighters[1].wound, RULES.wound);
  const woundedRest = { ...d, fighters: [d.fighters[0], { ...d.fighters[1], phase: 'ready' as const, rest: 0, stamina: 40 }] } as Duel;
  const regen = stepDuel(woundedRest, [idle(), idle()]);
  assert.ok(Math.abs(regen.fighters[1].stamina - 40 - RULES.regen * RULES.woundRegen) < 1e-9);
  const expired = stepDuel({ ...woundedRest, fighters: [woundedRest.fighters[0], { ...woundedRest.fighters[1], wound: 1 }] }, [idle(), idle()]);
  assert.equal(expired.fighters[1].wound, 0); assert.ok(Math.abs(expired.fighters[1].stamina - 40 - RULES.regen) < 1e-9);
  const again = run(stepDuel({ ...d, fighters: [{ ...d.fighters[0], phase: 'ready', age: 0 }, { ...d.fighters[1], phase: 'ready', wound: 100 }] }, [act('light'), idle()]), light.windup);
  assert.equal(again.fighters[1].wound, RULES.wound, 'refreshes to the full duration, no stacking');
  let parried = run(stepDuel(duel(), [act('light'), idle()]), light.windup - 9);
  parried = run(stepDuel(parried, [idle(), act('parry', { guard: true, guardDirection: 'left' })]), 8, idle(), hold());   // pressed 9 ticks before contact: inside the 10-tick window
  assert.ok(types(parried).includes('Parried')); assert.equal(parried.fighters[1].wound, 0);
  const blocked = run(stepDuel(duel(), [act('light'), hold()]), light.windup, idle(), hold());
  assert.ok(types(blocked).includes('Blocked')); assert.equal(blocked.fighters[1].wound, 0);
});

test('events: every outcome is reported exactly once per contact and the stream is deterministic', () => {
  const counts: Record<string, number> = {};
  let seed = 909, d = initialDuel();
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const pick = (): Action | null => { const r = random(); return r < .04 ? 'light' : r < .05 ? 'heavy' : r < .06 ? 'kick' : r < .07 ? 'dodge' : r < .08 ? 'backstep' : r < .12 ? 'parry' : null; };
  const held = [false, false];   // guard is a held input: it toggles occasionally rather than flickering every tick
  // The guard's side (directional guard) comes from its own stream so the walk above is unchanged: half the time the side that meets the
  // foe's current swing (so blocks, breaks and parries keep happening), otherwise any of the six (five sides or none).
  let sideSeed = 4242; const sideRoll = () => ((sideSeed = (Math.imul(sideSeed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const sideOf = (k: number): Intent['guardDirection'] => { const foe = d.fighters[1 - k]; const r = sideRoll(); if (foe.phase === 'attack' && foe.move && r < .5) return mirror(MOVES[foe.move].direction) ?? undefined; return ([undefined, 'left', 'right', 'overhead', 'thrust', 'low'] as const)[Math.floor(sideRoll() * 6)] ?? undefined; };
  for (let i = 0; i < 24000; i++) {
    if (!d.fighters[0].health || !d.fighters[1].health) d = { ...duel(1.2), tick: d.tick };
    // Coverage fuzz, not an economy test: re-centre wanderers without healing them and top up stamina so every outcome keeps occurring.
    if (i % 1500 === 0) d = { ...d, fighters: d.fighters.map((f, k) => ({ ...f, body: duel(1.2).fighters[k].body })) as Duel['fighters'] };
    if (i % 300 === 0) d = { ...d, fighters: d.fighters.map(f => ({ ...f, stamina: 100, exhausted: false })) as Duel['fighters'] };
    const intents: [Intent, Intent] = [0, 1].map(k => { if (random() < .04) held[k] = !held[k]; return { move: { x: (random() - .5) * .6, z: (random() - .5) * .6, yaw: 0, run: random() < .02 }, action: pick(), guard: held[k], guardDirection: sideOf(k), lock: true }; }) as [Intent, Intent];
    d = stepDuel(d, intents);
    const hits = d.events.filter(e => ['Hit', 'Blocked', 'Parried', 'GuardBroken', 'Dodged'].includes(e.type));
    for (const actor of [0, 1]) assert.ok(hits.filter(e => (e.type === 'Hit' || e.type === 'GuardBroken' ? e.actor : e.target) === actor).length <= 1, 'at most one contact outcome per attacker per tick');
    for (const e of d.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
    for (const e of d.events) assert.equal(e.tick, d.tick);
  }
  for (const type of ['AttackStarted', 'AttackActive', 'AttackMissed', 'Hit', 'Blocked', 'Parried', 'GuardBroken', 'Dodged', 'Staggered', 'StaminaExhausted', 'Killed', 'ActionStarted']) assert.ok(counts[type] > 0, `${type} never occurred in the fuzz`);
});

test('the same intent sequence replays to the same duel; inputs never mutate the previous state; resources stay bounded [slow]', () => {
  const play = () => {
    let seed = 4242, d = initialDuel();
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const pick = (): Action | null => { const r = random(); return r < .08 ? 'light' : r < .11 ? 'heavy' : r < .13 ? 'kick' : r < .16 ? 'dodge' : r < .18 ? 'backstep' : r < .21 ? 'parry' : null; };
    for (let i = 0; i < 12000; i++) {
      if (!d.fighters[0].health || !d.fighters[1].health) d = { ...initialDuel(), fighters: [{ ...initialDuel().fighters[0], phase: 'ready' }, initialDuel().fighters[1]] };
      const before = structuredClone(d); Object.freeze(d); Object.freeze(d.fighters); d.fighters.forEach(f => { Object.freeze(f); Object.freeze(f.body); });
      const next = stepDuel(d, [0, 1].map(() => ({ move: { x: random() * 2 - 1, z: random() * 2 - 1, yaw: random() * 6, run: random() < .2 }, action: pick(), guard: random() < .4, lock: random() < .7 })) as [Intent, Intent]);
      assert.deepEqual(d, before);
      for (const f of next.fighters) {
        assert.ok(Math.hypot(f.body.x, f.body.z) <= RADIUS + 1e-8);
        assert.ok(Number.isFinite(f.health) && f.health >= 0 && f.health <= HP); assert.ok(Number.isFinite(f.stamina) && f.stamina >= 0 && f.stamina <= 100);
        assert.ok(Number.isFinite(f.body.heading));
      }
      assert.ok(Math.hypot(next.fighters[0].body.x - next.fighters[1].body.x, next.fighters[0].body.z - next.fighters[1].body.z) >= .85 - 1e-8);
      d = next;
    }
    return d;
  };
  assert.deepEqual(play(), play());
});

test('thrust: longest reach, fully blockable, a riposte in the punish window; a held thrust or light chambers without ever charging', () => {
  const thrust = MOVES.thrust;
  assert.equal(legal(duel().fighters[0], 'thrust'), true); assert.equal(stepDuel(duel(), [act('thrust'), idle()]).fighters[0].move, 'thrust');
  const far = run(stepDuel(duel(1.95), [act('thrust'), idle()]), thrust.windup);
  assert.equal(far.fighters[1].health, HP - thrust.damage, 'a thrust reaches where a cut cannot'); assert.equal(far.fighters[0].stamina, 100 - thrust.stamina);
  assert.equal(run(stepDuel(duel(1.95), [act('light'), idle()]), light.windup).fighters[1].health, HP, 'a light whiffs from the same distance');
  const guarded = run(stepDuel(duel(), [idle(), hold()]), RULES.parry + 2, idle(), hold());
  const blocked = run(stepDuel(guarded, [act('thrust'), vs('thrust')]), thrust.windup, idle(), vs('thrust'));
  assert.ok(types(blocked).includes('Blocked')); assert.equal(blocked.fighters[1].health, HP, 'no chip'); assert.equal(blocked.fighters[1].stamina, 100 - thrust.staminaDamage);
  const parried = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'attack', move: 'thrust', age: thrust.windup - 1, lastMove: 'thrust' }, { ...duel().fighters[1], phase: 'guard', guardDirection: 'thrust', age: 2 }] } as Duel, [idle(), vs('thrust')]);
  assert.ok(types(parried).includes('Parried'));
  assert.equal(stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], punish: 30 }, duel().fighters[1]] } as Duel, [act('thrust'), idle()]).fighters[0].move, 'riposte');
  // Chamber: a held thrust waits at its chamber tick; it is feintable there; it never charges and has no hyper-armour; the hold releases itself at the maximum.
  const heldIntent = { ...idle(), held: true };
  const chambered = run(stepDuel(duel(), [act('thrust', { held: true }), idle()]), thrust.chamber! + 4, heldIntent);
  assert.equal(chambered.fighters[0].age, thrust.chamber!); assert.equal(chambered.fighters[0].charge, 4); assert.equal(chambered.fighters[0].charged, false);
  assert.equal(stepDuel(chambered, [act('parry', { guard: true, guardDirection: 'left' }), idle()]).fighters[0].phase, 'guard', 'feint from the chamber');
  const long = run(stepDuel(duel(), [act('thrust', { held: true }), idle()]), thrust.chamber! + RULES.charge.max + 2, heldIntent);
  assert.equal(long.fighters[0].charged, false); assert.equal(long.fighters[0].charge, RULES.charge.max); assert.ok(long.fighters[0].age > thrust.chamber!, 'released by itself'); assert.ok(!long.events.some(e => e.type === 'Charged'));
  const struck = run(stepDuel(chambered, [heldIntent, act('light')]), light.windup, heldIntent);
  assert.equal(struck.fighters[0].phase, 'hurt', 'no hyper-armour on a chambered thrust'); assert.ok(struck.events.find(e => e.type === 'Hit')?.counter, 'and it is a counter-hit');
  const lightChamber = run(stepDuel(duel(), [act('light', { held: true }), idle()]), light.chamber! + 3, heldIntent);
  assert.equal(lightChamber.fighters[0].move, 'light_right'); assert.equal(lightChamber.fighters[0].age, light.chamber!); assert.ok(lightChamber.events.length >= 0);
  assert.equal(stepDuel(lightChamber, [act('parry', { guard: true, guardDirection: 'left' }), idle()]).fighters[0].phase, 'guard', 'a chambered light is feintable');
  assert.equal(run(lightChamber, light.windup - light.chamber!).fighters[1].health, HP - light.damage, 'released, it lands as a plain light');
  for (const id of ['slash_riposte', 'riposte', 'heavy_riposte', 'heavy_counter', 'kick'] as const) assert.equal(MOVES[id].chamber, null, `${id} never chambers`);
});

test('posture: blocks, clean hits and being parried fill it; it drains while standing; full = a break with a long stagger and a critical window', () => {
  const P = RULES.posture;
  // A block puts the move's posture on the blocker; a perfect block takes half; a clean hit puts it on the victim.
  const guarded = run(stepDuel(duel(), [idle(), hold()]), RULES.parry + 2, idle(), hold());
  const blocked = run(stepDuel(guarded, [act('heavy'), vs('heavy')]), heavy.windup, idle(), vs('heavy'));
  assert.equal(blocked.fighters[1].posture, heavy.posture, 'a blocked heavy puts its full posture on the blocker');
  const perfect = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'attack', move: 'light_right', age: light.windup - 1, lastMove: 'light_right' }, { ...duel().fighters[1], phase: 'guard', guardDirection: 'left', age: RULES.parry }] } as Duel, [idle(), hold()]);
  assert.ok(Math.abs(perfect.fighters[1].posture - light.posture * P.perfect) < 1e-9, 'a perfect block takes half the posture');
  const hit = run(stepDuel(duel(), [act('light'), idle()]), light.windup);
  assert.ok(Math.abs(hit.fighters[1].posture - light.posture) < 1e-9, 'a clean hit puts the move\'s posture on the victim');
  // Being parried shakes the attacker.
  const parried = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'attack', move: 'light_right', age: light.windup - 1, lastMove: 'light_right' }, { ...duel().fighters[1], phase: 'guard', guardDirection: 'left', age: 2 }] } as Duel, [idle(), hold()]);
  assert.ok(types(parried).includes('Parried')); assert.equal(parried.fighters[0].posture, P.parry);
  // Drain: standing fighters lose decay per tick; a staggered one does not.
  const standing = run({ ...duel(), fighters: [{ ...duel().fighters[0], posture: 50 }, duel().fighters[1]] } as Duel, 10);
  assert.ok(Math.abs(standing.fighters[0].posture - (50 - 10 * P.decay)) < 1e-9);
  const stunned = run({ ...duel(), fighters: [{ ...duel().fighters[0], posture: 50, phase: 'hurt', stun: 30 }, duel().fighters[1]] } as Duel, 10);
  assert.equal(stunned.fighters[0].posture, 50, 'no drain while staggered');
  // Break: the hit that fills the bar staggers for posture.stun, resets the bar and opens the other side's critical window.
  const nearly = { ...duel(), fighters: [duel().fighters[0], { ...duel().fighters[1], posture: P.max - light.posture + 1 + light.windup * P.decay }] } as Duel;   // the bar drains through the wind-up
  const broken = run(stepDuel(nearly, [act('light'), idle()]), light.windup);
  const brk = broken.events.find(e => e.type === 'PostureBroken')!;
  assert.ok(brk, 'PostureBroken fires'); assert.equal(brk.actor, 0); assert.equal(brk.target, 1); assert.equal(brk.ticks, P.stun);
  assert.equal(broken.fighters[1].posture, 0); assert.equal(broken.fighters[1].phase, 'hurt'); assert.equal(broken.fighters[1].stun, P.stun, 'the posture stagger outlasts the hit stagger');
  assert.equal(broken.fighters[0].critical, P.stun); assert.equal(broken.fighters[0].punish, P.stun);
  // In the window Heavy is the critical: unparryable, 40 damage, armoured; Light is the ordinary riposte. Starting any attack consumes the window.
  const ready = { ...broken, fighters: [{ ...broken.fighters[0], phase: 'ready', age: 0, stamina: 100 }, broken.fighters[1]] } as Duel;
  const crit = stepDuel(ready, [act('heavy'), idle()]);
  assert.equal(crit.fighters[0].move, 'critical'); assert.equal(crit.fighters[0].critical, 0); assert.equal(crit.fighters[0].punish, 0);
  const landed = run(crit, MOVES.critical.windup);
  assert.equal(landed.fighters[1].health, HP - light.damage - MOVES.critical.damage, 'the critical lands for twice a heavy (after the light that broke the posture)'); assert.equal(MOVES.critical.parryable, false); assert.ok(MOVES.critical.poise > 0);
  assert.equal(stepDuel(ready, [act('light'), idle()]).fighters[0].move, 'slash_riposte');
  const expired = run(ready, P.stun + 1);
  assert.equal(stepDuel(expired, [act('heavy'), idle()]).fighters[0].move, 'heavy_overhead', 'after the window a heavy is a heavy');
  // A guard break resets the victim's posture: that break was the payoff.
  const held = { ...guarded, fighters: [guarded.fighters[0], { ...guarded.fighters[1], posture: 60 }] } as Duel;
  const gb = run(run(stepDuel(held, [act('heavy', { held: true }), vs('heavy')]), heavy.chamber! + RULES.charge.min, { ...idle(), held: true }, vs('heavy')), heavy.windup - heavy.chamber!, idle(), vs('heavy'));
  assert.ok(types(gb).includes('GuardBroken')); assert.equal(gb.fighters[1].posture, 0);
  // Posture never shakes the dead, and the critical itself puts no posture on its victim. The ripostes carry none either: the parry that earned
  // them already put RULES.posture.parry on the attacker, and two parries must not add up to a break plus a critical (a kill).
  assert.equal(MOVES.critical.posture, 0);
  for (const id of ['slash_riposte', 'riposte', 'heavy_riposte'] as const) assert.equal(MOVES[id].posture, 0, `${id} is the parry's payoff, not a second one`);
  assert.ok(RULES.posture.parry * 2 < RULES.posture.max, 'two parries alone never break posture');
  for (const id of ['light_right', 'thrust', 'heavy_overhead', 'kick', 'heavy_counter'] as const) assert.ok(MOVES[id].posture > 0, `${id} carries posture`);
});

test('kick lands: the lunge carries the short cone to a standing target 1.5 m away, which is what the HUD reach flag promises', () => {
  const lands = (gap: number) => run(stepDuel(duel(gap), [act('kick'), { ...idle(), lock: true }]), kick.windup + kick.active).fighters[1].health < HP;
  assert.ok(lands(1.5), 'lands from 1.5 m'); assert.ok(!lands(1.7), 'not from 1.7 m');
});

test('correctness pass: elapsed perception, bounded chamber lunge, attack-start reset, discounted block affordability, armour scope, draws', () => {
  const heldIntent = { ...idle(), held: true };
  // elapsed(): the animation clock rewinds at the chamber, elapsed time does not.
  const parked = run(stepDuel(duel(6), [act('heavy', { held: true }), idle()]), heavy.chamber! + 20, heldIntent);
  assert.equal(parked.fighters[0].age, heavy.chamber!); assert.equal(elapsed(parked.fighters[0]), heavy.chamber! + 20);
  // A parked swing does not keep lunging: holding to the maximum travels no further than a tap does.
  const travel = (held: boolean) => { let d = stepDuel(duel(6), [act('heavy', { held }), idle()]); const z0 = d.fighters[0].body.z; d = run(d, heavy.windup + (held ? RULES.charge.max : 0), { ...idle(), held }); return z0 - d.fighters[0].body.z; };
  assert.ok(Math.abs(travel(true) - travel(false)) < 1e-9, `lunge tap ${travel(false).toFixed(3)} m vs max hold ${travel(true).toFixed(3)} m`);
  // Every attack starts clean: a kick after a charged heavy is a plain 4-damage kick; a light after a parry window is the riposte but the next light is plain.
  let k = run(stepDuel(duel(6), [act('heavy', { held: true }), idle()]), RULES.charge.max + total(heavy) + 2, heldIntent);
  k = { ...k, fighters: [{ ...k.fighters[0], body: { ...k.fighters[1].body, z: k.fighters[1].body.z + 1.05, heading: Math.PI } }, { ...k.fighters[1], phase: 'ready', age: 0 }] } as Duel;
  assert.equal(k.fighters[0].phase, 'ready'); k = run(stepDuel(k, [act('kick'), idle()]), kick.windup);
  const kh = k.events.find(e => e.type === 'Hit')!; assert.equal(kh.damage, kick.damage); assert.ok(!kh.charged, 'a kick never inherits the charge');
  for (const id of ['punish', 'critical', 'counterWindow', 'charge'] as const) assert.equal(stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], punish: 30, critical: 30, counterWindow: 10, charge: 5, charged: true }, duel().fighters[1]] } as Duel, [act('kick'), idle()]).fighters[0][id], 0, `${id} reset by a kick start`);
  // Perfect block: the discounted price is what must be affordable.
  const perfectAt = (stamina: number) => stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'attack', move: 'light_right', age: light.windup - 1, lastMove: 'light_right' }, { ...duel().fighters[1], phase: 'guard', guardDirection: 'left', age: RULES.parry, stamina }] } as Duel, [idle(), hold()]);
  const cost = light.staminaDamage * RULES.perfectBlockCost;   // 7.5
  assert.ok(types(perfectAt(cost + 2)).includes('Blocked'), `a perfect block costing ${cost} is affordable at ${cost + 2}`); assert.ok(Math.abs(perfectAt(cost + 2).fighters[1].stamina - 2) <= RULES.regen, 'the price is paid (the guard tick may regenerate a little first)');
  assert.ok(types(perfectAt(cost - 1)).includes('GuardBroken'), 'not one below'); assert.ok(types(perfectAt(cost)).includes('Blocked'), 'exactly affordable');
  // Hyper-armour: while parked at the chamber and when charged, not after a short uncharged hold has been released.
  // The warden's light starts while the heavy is parked; the heavy is released `h` ticks later. Still parked at contact → armoured; released uncharged and
  // met before its poise tick → interrupted; released charged → armoured.
  const metWhile = (h: number, preHold = 2) => { let d = run(stepDuel(duel(), [act('heavy', { held: true }), idle()]), heavy.chamber! + preHold, heldIntent); d = stepDuel(d, [heldIntent, act('light')]); for (let i = 1; i <= light.windup; i++) d = stepDuel(d, [i <= h ? heldIntent : idle(), idle()]); return d.fighters[0].phase; };   // through the light's contact tick
  assert.equal(metWhile(light.windup), 'attack', 'armoured while parked'); assert.equal(metWhile(8), 'hurt', 'a short hold released uncharged is a plain heavy: interruptible before its poise tick (released 8 ticks in, the cut meets it at age 22 < 24)');
  assert.equal(metWhile(6, RULES.charge.min), 'attack', 'armoured when charged, even after release');
  // Draw: both fall on the same tick.
  const trade = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], health: 5, phase: 'attack', move: 'light_right', age: light.windup - 1, lastMove: 'light_right' }, { ...duel().fighters[1], health: 5, phase: 'attack', move: 'light_right', age: light.windup - 1, lastMove: 'light_right' }] } as Duel, [idle(), idle()]);
  assert.equal(trade.fighters[0].health, 0); assert.equal(trade.fighters[1].health, 0); assert.equal(trade.finish?.draw, true); assert.equal(trade.events.filter(e => e.type === 'Killed').length, 2);
});

test('side symmetry: movement resolves against the start-of-tick bodies, so swapping the fighters swaps the result exactly', () => {
  // Both advance into contact from 0.9 m; the mirrored duel (fighters and inputs swapped) must end in the mirrored positions.
  const mirror = (d: Duel): Duel => ({ ...d, fighters: [d.fighters[1], d.fighters[0]], events: [] });
  const towards = (d: Duel, i: 0 | 1): Intent => { const f = d.fighters[i], o = d.fighters[1 - i]; const dx = o.body.x - f.body.x, dz = o.body.z - f.body.z, n = Math.hypot(dx, dz); return { ...idle(), lock: false, move: { x: dx / n, z: dz / n, yaw: 0, run: false } }; };
  let a = duel(.9), b = mirror(duel(.9));
  for (let i = 0; i < 20; i++) { a = stepDuel(a, [towards(a, 0), towards(a, 1)]); b = stepDuel(b, [towards(b, 0), towards(b, 1)]); }
  for (const k of ['x', 'z'] as const) { assert.ok(Math.abs(a.fighters[0].body[k] - b.fighters[1].body[k]) < 1e-9, `fighter 0 ${k}: ${a.fighters[0].body[k]} vs mirrored ${b.fighters[1].body[k]}`); assert.ok(Math.abs(a.fighters[1].body[k] - b.fighters[0].body[k]) < 1e-9, `fighter 1 ${k}`); }
  assert.ok(Math.hypot(a.fighters[0].body.x - a.fighters[1].body.x, a.fighters[0].body.z - a.fighters[1].body.z) >= .85 - 1e-6, 'bodies never overlap after separation');
});

test('holding Guard always guards: press-and-hold at any moment of an incoming heavy is a parry, a perfect block or a block — never a hit through the guard', () => {
  const outcomes: Record<number, string> = {};
  for (let t = 4; t <= 30; t += 2) {
    let g = stepDuel(duel(), [idle(), act('heavy')]); let seen = '';
    for (let i = 1; i <= heavy.windup + 2 && !seen; i++) { g = stepDuel(g, [i === t ? act('parry', { guard: true, guardDirection: 'overhead' }) : i > t ? vs('heavy') : idle(), idle()]); const e = g.events.find(x => ['Parried', 'Blocked', 'GuardBroken', 'Hit'].includes(x.type)); if (e) seen = e.type + (e.type === 'Blocked' && e.perfect ? '*' : ''); }
    outcomes[t] = seen;
  }
  const hits = Object.entries(outcomes).filter(([, o]) => o === 'Hit' || o === 'GuardBroken' || !o).map(([t]) => t);
  assert.deepEqual(hits, [], `hit through a held guard at ticks ${hits.join(',')}: ${JSON.stringify(outcomes)}`);
  assert.ok(Object.values(outcomes).includes('Parried') && Object.values(outcomes).includes('Blocked*') && Object.values(outcomes).includes('Blocked'), `all three defensive outcomes occur across the timeline: ${JSON.stringify(outcomes)}`);
  // The same timeline with a released tap: the exposed ticks after a missed window are where the heavy lands.
  let tapped = stepDuel(duel(), [idle(), act('heavy')]); let seenTap = '';
  for (let i = 1; i <= heavy.windup + 2 && !seenTap; i++) { tapped = stepDuel(tapped, [i === 14 ? act('parry', { guard: true, guardDirection: 'overhead' }) : idle(), idle()]); const e = tapped.events.find(x => ['Parried', 'Blocked', 'GuardBroken', 'Hit'].includes(x.type)); if (e) seenTap = e.type; }
  assert.equal(seenTap, 'Hit', 'a released tap at 14 is exposed when the heavy lands');
});

test('slice P tuning pins: 40 stamina/s after .75 s, a guard at half rate, block costs 15/30/20, 150 health (8–15 blows a duel), sprint drains without the delay', () => {
  assert.equal(Math.round(RULES.regen * 60), 40); assert.equal(RULES.regenDelay, 45); assert.equal(RULES.guardRegen, .5);
  assert.deepEqual([MOVES.light_right.staminaDamage, MOVES.heavy_overhead.staminaDamage, MOVES.thrust.staminaDamage], [15, 30, 20], 'block costs: a light block must not out-price the cut it stops');
  assert.equal(RULES.health, 150, 'measured AI-vs-AI at normal: 12 hits / 24 s median (the 8–15 target); at 100 it was 7–8 hits / 16 s');
  assert.ok(MOVES.light_right.staminaDamage < MOVES.light_right.stamina, 'blocking a cut costs the blocker less than the cut cost the attacker');
});

test('gladiator identity (slice Q): the ring wall hits back — knockback that meets the wall adds stagger and posture, and a cornered fighter cannot backstep (a roll still works)', () => {
  // Two fighters on the ring's north edge: the victim (index 0) stands 0.1 m inside the wall with the wall at its back; the attacker faces it from inside.
  const edge = (gapFromWall: number): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: RADIUS - gapFromWall, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ x: 0, z: RADIUS - gapFromWall - 1.2, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
  const swing = (d: Duel) => run(stepDuel(d, [idle(), act('light')]), light.windup, idle(), idle());
  const walled = swing(edge(.1)), open = swing(duel());
  const wh = walled.events.find(e => e.type === 'Hit')!, oh = open.events.find(e => e.type === 'Hit')!;
  assert.ok(wh && oh && wh.target === 0 && oh.target === 0);
  const ws = walled.events.find(e => e.type === 'Staggered')!, os = open.events.find(e => e.type === 'Staggered')!;
  assert.equal(ws.walled, true); assert.equal(os.walled, undefined);
  assert.equal(ws.ticks, os.ticks! + RULES.wall.stagger, 'the wall adds its stagger');
  assert.equal(walled.fighters[0].posture, open.fighters[0].posture + RULES.wall.posture, 'and its posture');
  assert.ok(Math.hypot(walled.fighters[0].body.x, walled.fighters[0].body.z) >= RADIUS - RULES.wall.edge, 'pinned on the wall');
  // Cornered: with the wall at the back a backstep is refused; a roll is not; with the wall in front (back to the centre) the backstep is free.
  const cornered = edge(.1);
  assert.equal(stepDuel(cornered, [act('backstep'), idle()]).fighters[0].phase, 'ready', 'no backstep into the wall');
  assert.equal(stepDuel(cornered, [act('dodge'), idle()]).fighters[0].phase, 'roll', 'a roll is still an answer');
  const facingWall = { ...cornered, fighters: [{ ...cornered.fighters[0], body: { ...cornered.fighters[0].body, heading: 0 } }, cornered.fighters[1]] } as Duel;
  assert.equal(stepDuel(facingWall, [act('backstep'), idle()]).fighters[0].phase, 'backstep', 'away from the wall the backstep is free');
  assert.equal(stepDuel(duel(), [act('backstep'), idle()]).fighters[0].phase, 'backstep', 'mid-ring too');
});

test('gladiator identity (slice Q): attrition — every blade wound takes stamina off the ceiling for the duel (floor 40), a kick does not, and a leg wound slows the walk', () => {
  const cut = run(stepDuel(duel(), [act('light'), idle()]), light.windup);
  assert.equal(cut.fighters[1].maxStamina, 100 - RULES.attrition.stamina); assert.equal(cut.fighters[1].wound, RULES.wound);
  // The bar never regenerates past the new ceiling.
  const rested = run({ ...cut, fighters: [cut.fighters[0], { ...cut.fighters[1], phase: 'ready', stamina: 90, rest: 0 }] } as Duel, 200, idle(), idle());
  assert.equal(rested.fighters[1].stamina, 100 - RULES.attrition.stamina, 'regeneration stops at the ceiling');
  let d = duel(); for (let i = 0; i < 12; i++) { d = run(stepDuel({ ...d, fighters: [{ ...d.fighters[0], phase: 'ready', stamina: 100 }, { ...d.fighters[1], phase: 'ready', health: HP, posture: 0 }] } as Duel, [act('light'), idle()]), LIGHT); }
  assert.equal(d.fighters[1].maxStamina, RULES.attrition.floor, 'the ceiling has a floor');
  const kicked = run(stepDuel(duel(1.1), [act('kick'), idle()]), kick.windup);
  assert.ok(kicked.events.some(e => e.type === 'Hit' && e.move === 'kick')); assert.equal(kicked.fighters[1].maxStamina, 100, 'a kick leaves no wound');
  // A leg wound: the walk slows to legSpeed.
  const legged = { ...duel(3), fighters: [duel(3).fighters[0], { ...duel(3).fighters[1], legWound: true }] } as Duel, sound = duel(3);
  const walk = (dd: Duel) => run(dd, 20, idle(), { ...idle(), move: { x: 1, z: 0, yaw: 0, run: false } }).fighters[1].body.distance;
  assert.ok(Math.abs(walk(legged) / walk(sound) - RULES.attrition.legSpeed) < .02, `leg wound slows the walk: ${walk(legged).toFixed(3)} vs ${walk(sound).toFixed(3)}`);
});

test('gladiator identity (slice Q): the thrust is the stop-hit — into a swing or an opponent walking onto the point it lands at stopHit rates (a cut only counters), and a thrust that meets nothing overextends', () => {
  const thrust = MOVES.thrust;
  // Into a swing: the target has started a heavy; the thrust lands during its wind-up (before the heavy's poise tick).
  const intoSwing = (attack: 'thrust' | 'light') => { let d = stepDuel(duel(1.5), [idle(), act('heavy')]); d = stepDuel(d, [act(attack), idle()]); return run(d, MOVES[attack === 'thrust' ? 'thrust' : 'light_right'].windup, idle(), idle()); };
  const ts = intoSwing('thrust').events.find(e => e.type === 'Hit')!, ls = intoSwing('light').events.find(e => e.type === 'Hit')!;
  assert.ok(ts && ls, 'both land');
  assert.equal(ts.stop, true); assert.equal(ts.damage, Math.round(thrust.damage * RULES.stopHit.damage)); assert.equal(intoSwing('thrust').events.find(e => e.type === 'Staggered')!.ticks, Math.round(thrust.stagger * RULES.stopHit.stagger));
  assert.equal(ls.stop, undefined); assert.equal(ls.counter, true); assert.equal(ls.damage, Math.round(light.damage * RULES.counter.damage), 'a cut is the ordinary counter-hit');
  // Onto the point: the target walks in through the wind-up (from 1.9 m; the thrust reaches 2.0).
  const walker: Intent = { ...idle(), move: { x: 0, z: -1, yaw: 0, run: false } };
  const onto = run(stepDuel(duel(1.9), [idle(), act('thrust')]), thrust.windup, walker, idle());
  const oh = onto.events.find(e => e.type === 'Hit')!; assert.ok(oh, 'lands on the walker'); assert.equal(oh.stop, true, 'the walker is stop-hit');
  const standing = run(stepDuel(duel(1.9), [idle(), act('thrust')]), thrust.windup, idle(), idle());
  assert.equal(standing.events.find(e => e.type === 'Hit')!.stop, undefined, 'a standing target is not');
  // Overextension: a whiffed thrust is back in `ready` stopHit.whiff ticks later than its own timing says.
  const whiff = (id: 'thrust' | 'light') => { let d = stepDuel(duel(4), [act(id), idle()]); let ticks = 1; while (d.fighters[0].phase === 'attack' && ticks < 200) { d = stepDuel(d, [idle(), idle()]); ticks++; } return { ticks, missed: types(d).includes('AttackMissed') || true }; };
  assert.equal(whiff('light').ticks, total(light) + 1, 'a cut whiffs on its own timing (the count includes the starting tick)'); assert.equal(whiff('thrust').ticks, total(thrust) + 1 + RULES.stopHit.whiff, 'a whiffed thrust hangs `whiff` ticks longer');
});

test('gladiator identity (slice Q): posture pins — a gain pauses the drain for posture.hold ticks, then it drains at .2, a parry puts 25 on the attacker, cut 20 / heavy 32 / thrust 16 (swept to ~one break per two duels at normal)', () => {
  assert.deepEqual([RULES.posture.decay, RULES.posture.hold, RULES.posture.parry], [.2, 45, 25]);
  assert.deepEqual([MOVES.light_right.posture, MOVES.heavy_overhead.posture, MOVES.thrust.posture], [20, 32, 16]);
  const blocked = run(stepDuel(duel(), [act('light'), hold()]), light.windup, idle(), hold());
  const gained = blocked.fighters[1].posture; assert.ok(gained > 0);
  const held = run(blocked, RULES.posture.hold - 1, idle(), idle());
  assert.equal(held.fighters[1].posture, gained, 'no drain while the hold runs');
  const draining = run(held, 20, idle(), idle());
  assert.ok(Math.abs(draining.fighters[1].posture - (gained - 20 * RULES.posture.decay)) < 1e-9 + RULES.posture.decay, `then it drains at .2 a tick: ${draining.fighters[1].posture}`);
});

// Anti-turtling (owner 2026-09-21, "both 1 and 2"): the lorarii whip a wall-loiterer; no stamina regenerates while backing away.
const atWall = (gap = 1.2): Duel => {   // index 0 stands inside the wall band with the foe `gap` toward the centre, both on the z axis
  const z0 = RADIUS - RULES.wall.loiter.band + .3;
  return { tick: 0, fighters: [createFighter({ x: 0, z: z0, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ x: 0, z: z0 - gap, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
};
test('anti-turtling 1b: the whip tell — one WhipRaised per lash, `raise` ticks before the first and the shorter `raiseAgain` before a repeat, both naming the lorarius\'s sixth of the wall', () => {
  const L = RULES.wall.loiter;
  // The first lash. The raise lands exactly `raise` ticks earlier and exactly once: a tell that fires twice would have presentation
  // restart its raise animation mid-lift (the world lane scales the clip by `lead`, so a second event with a different lead is a visible stutter).
  const hugging = () => { const h = atWall(); h.fighters[0].body = { ...h.fighters[0].body, z: RADIUS - .05 }; return h; };
  let d = run(hugging(), L.ticks - L.raise - 1); assert.ok(!types(d).includes('WhipRaised'), 'no tell before its tick');
  d = stepDuel(d, [idle(), idle()]);
  const raises = d.events.filter(e => e.type === 'WhipRaised');
  assert.equal(raises.length, 1, 'exactly one tell'); assert.equal(raises[0].actor, 0); assert.equal(raises[0].target, 0);
  assert.equal(raises[0].lead, L.raise, 'the first lash is announced `raise` ticks ahead');
  assert.equal(raises[0].guard, lorariusGuard(d.fighters[0].body), 'the tell names the guard the lash will name');
  // ... and the lash it announced arrives exactly `lead` ticks later.
  d = run(d, L.raise - 1); assert.ok(!types(d).includes('Whipped'), 'not yet');
  d = stepDuel(d, [idle(), idle()]);
  const first = d.events.find(e => e.type === 'Whipped')!;
  assert.ok(first, 'the lash lands `lead` ticks after its tell'); assert.equal(first.guard, raises[0].guard, 'the same lorarius swings');
  // The repeat. It is announced later — `raiseAgain`, not `raise` — and still exactly once. The two thresholds cannot collide: a lash
  // resets the clock to `ticks - again`, which is the first-raise threshold, so a naive check would re-announce on the lash tick itself.
  let after = d, tells = 0, lashes = 0;
  for (let t = 0; t < L.again; t++) {
    after = stepDuel(after, [idle(), idle()]);
    for (const e of after.events) {
      if (e.type === 'WhipRaised') { tells++; assert.equal(e.lead, L.raiseAgain, 'a repeat is announced `raiseAgain` ticks ahead'); assert.equal(after.fighters[0].loiter, L.ticks - L.raiseAgain, 'at its own threshold'); }
      if (e.type === 'Whipped') lashes++;
    }
  }
  assert.deepEqual([tells, lashes], [1, 1], 'one tell, one lash, over one repeat cycle');
  // Leaving the wall ends the spell: the next lash is a first one again, so its tell is the long one.
  let gone = run(hugging(), L.ticks + 5);   // lashed once, so `lashed` is set
  gone.fighters[0] = { ...gone.fighters[0], body: { ...gone.fighters[0].body, x: 0, z: 0 } };   // walks to the centre
  gone = stepDuel(gone, [idle(), idle()]);
  assert.equal(gone.fighters[0].loiter, 0); assert.equal(gone.fighters[0].lashed, false, 'out of the band: the spell is over');
  // The guard is the sixth of the ring the loiterer stands in, from the sim, so the world and audio lanes never compute their own.
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(k => lorariusGuard({ x: Math.cos((k + .5) * Math.PI / 3) * RADIUS, z: Math.sin((k + .5) * Math.PI / 3) * RADIUS })), [0, 1, 2, 3, 4, 5]);
});

test('anti-turtling 1: the lorarii — idling in the wall band for loiter.ticks without attacking is whipped (chip, posture, a shove inward) and the clock restarts', () => {
  const L = RULES.wall.loiter, hp = RULES.health;
  let d = run(atWall(), L.ticks - 1); assert.equal(d.fighters[0].loiter, L.ticks - 1); assert.equal(d.fighters[0].health, hp); assert.ok(!types(d).includes('Whipped'));
  const rBefore = Math.hypot(d.fighters[0].body.x, d.fighters[0].body.z);
  d = stepDuel(d, [idle(), idle()]);
  const w = d.events.find(e => e.type === 'Whipped')!; assert.ok(w, 'whipped on the tick the clock fills'); assert.equal(w.actor, 0); assert.equal(w.target, 0); assert.equal(w.damage, L.chip);
  assert.equal(w.x, 0); assert.ok(Math.abs(w.z! - rBefore) < 1e-9, 'x, z = where the lash landed, before the shove');
  assert.equal(d.fighters[0].health, hp - L.chip); assert.equal(d.fighters[0].posture, L.posture);
  assert.ok(Math.abs(Math.hypot(d.fighters[0].body.x, d.fighters[0].body.z) - (rBefore - L.shove)) < 1e-9, 'shoved `shove` toward the foe, who stands 1.2 m inward: the same line as the centre here');
  assert.equal(d.fighters[0].loiter, L.ticks - L.again, 'the next lash is `again` ticks away while he stays');
  assert.equal(d.fighters[1].loiter, 0, 'the foe, inside the band? no — 1.2 m further in is outside it');
  // shove direction: an opponent within `into` metres draws the shove toward him (never out of his reach); a far opponent, toward the centre
  const side = atWall(1.2); side.fighters[1].body = { ...side.fighters[1].body, x: 1.2, z: side.fighters[0].body.z };   // foe 1.2 m to the east, same distance from the wall
  const s1 = run(side, L.ticks); assert.ok(s1.fighters[0].body.x > .5, `shoved toward the foe at his side (x ${s1.fighters[0].body.x.toFixed(2)})`);
  const far = atWall(1.2); far.fighters[1].body = { ...far.fighters[1].body, z: 0 };   // foe 7+ m away
  const s2 = run(far, L.ticks); assert.ok(Math.abs(Math.hypot(s2.fighters[0].body.x, s2.fighters[0].body.z) - (RADIUS - L.band + .3 - L.shove)) < 1e-9, 'a far foe: toward the centre');
  // the shove put him out of the band: no second lash
  d = run(d, L.ticks); assert.equal(d.events.filter(e => e.type === 'Whipped').length, 0);
  // a fighter hugging the wall (still in the band after the shove) is lashed again `again` ticks after the first, not a full clock later
  const hugging = atWall(); hugging.fighters[0].body = { ...hugging.fighters[0].body, z: RADIUS - .05 };
  let e = run(hugging, L.ticks); assert.equal(e.events.filter(x => x.type === 'Whipped').length, 1);
  let lashes = 0; for (let i = 0; i < L.again; i++) { e = stepDuel(e, [idle(), idle()]); lashes += e.events.filter(x => x.type === 'Whipped').length; }
  assert.equal(lashes, 1, 'the lorarii keep at a man who stays'); assert.ok(e.fighters[0].posture > L.posture, `posture stacks toward a break (${e.fighters[0].posture})`);
});
test('anti-turtling 1: attacking or leaving the band resets the loiter clock; the lash never takes the last point of health; a dead fighter is left alone', () => {
  const L = RULES.wall.loiter;
  let d = run(atWall(), L.ticks - 10);
  d = stepDuel(d, [act('light'), idle()]); assert.equal(d.fighters[0].phase, 'attack'); assert.equal(d.fighters[0].loiter, 0, 'an attack resets it');
  d = run(d, L.ticks - 1); assert.ok(!types(d).includes('Whipped'), 'no whip inside the next window');
  d = run(atWall(), L.ticks - 10);
  d = run(d, 20, { ...idle(), move: { x: 0, z: -1, yaw: 0, run: false } });   // walk inward: out of the band
  assert.equal(d.fighters[0].loiter, 0); assert.ok(!types(d).includes('Whipped'));
  const low = atWall(); low.fighters[0].health = 2;
  d = run(low, L.ticks); assert.equal(d.fighters[0].health, 1, 'the lash stings, it never kills');
  const dead = atWall(); dead.fighters[0].health = 0; dead.fighters[0].phase = 'dead';
  d = run(dead, L.ticks); assert.equal(d.fighters[0].loiter, 0); assert.ok(!types(d).includes('Whipped'));
});
test('anti-turtling 1: both fighters — the second index is whipped by the same rule', () => {
  const L = RULES.wall.loiter, z1 = RADIUS - L.band + .3;
  let d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: z1 - 1.2, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ x: 0, z: z1, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
  d = run(d, L.ticks); const w = d.events.find(e => e.type === 'Whipped')!; assert.ok(w); assert.equal(w.target, 1); assert.equal(d.fighters[1].health, RULES.health - L.chip);
});
test('anti-turtling 2: no rest at the wall — inside the wall band a tick that opens the gap by more than retreat.away regenerates nothing; strafing, advancing and standing do, and so does backing off in open ground', () => {
  const L = RULES.wall.loiter;
  const start = (wall: boolean): Duel => {   // index 0 faces north toward the foe; +z walks away from him. At the wall he stands inside the band with the wall at his back.
    const z0 = wall ? RADIUS - L.band + .1 : TARGET.z + 2, d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: z0, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ x: 0, z: z0 - 2, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
    d.fighters[0].stamina = 40; d.fighters[0].rest = 0; return d;
  };
  const back = { ...idle(), move: { x: 0, z: 1, yaw: 0, run: false } };
  let d = run(start(true), 15, back); assert.equal(d.fighters[0].stamina, 40, 'backpedalling at the wall: no regeneration (15 ticks: the wall stops him after 18)');
  d = run(start(true), 10, { ...idle(), move: { x: 0, z: 1, yaw: 0, run: true } }); assert.ok(d.fighters[0].stamina < 40, 'sprinting away at the wall drains and regenerates nothing (10 ticks: the wall stops him after ~11)');
  d = run(start(true), 30, { ...idle(), move: { x: 1, z: 0, yaw: 0, run: false } }); assert.ok(d.fighters[0].stamina > 40, 'strafing along the wall still regenerates');
  d = run(start(true), 30, { ...idle(), move: { x: 0, z: -1, yaw: 0, run: false } }); assert.ok(d.fighters[0].stamina > 40, 'advancing regenerates');
  d = run(start(true), 30); assert.ok(d.fighters[0].stamina > 40, 'standing regenerates');
  d = run(run(start(true), 30, back), 2); assert.ok(d.fighters[0].stamina > 40, 'it resumes the tick after the retreat stops');
  d = run(start(false), 30, back); assert.ok(d.fighters[0].stamina > 40, 'in open ground backing off still regenerates (owner: the band form, wallOnly)');
  d = run(start(false), 30, back, idle(), { ...RULES, retreat: { ...RULES.retreat, wallOnly: false } } as unknown as typeof RULES); assert.equal(d.fighters[0].stamina, 40, 'wallOnly off: the everywhere form');
});

// Dom, 2026-09-24: the kick that opens a guard must be punishable. With the opponent holding a guard (not the low brace), the
// player kicks. Then, from the first tick an attack is legal, the player's fastest follow-up that LANDS must connect at least
// 3 ticks before the stagger ends, for every player weapon against every opponent. At vsGuard.stagger 36 the stagger ended 2–9
// ticks too early (first legal 45, window end 54, fastest contact 57–63 in this frame). The same rule stuns the player as long.
test('the kick that opens a guard is punishable: every weapon\'s fastest landing follow-up connects 3+ ticks inside the stagger, against every opponent', () => {
  const guard = (): Intent => hold({ lock: true });
  const setup = (weapon: typeof PLAYER_WEAPONS[number], opponent: typeof OPPONENTS[keyof typeof OPPONENTS]) => {
    let d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1, heading: Math.PI, distance: 0 }, 'ready', weapon), opponentFighter(opponent, { ...TARGET, heading: 0, distance: 0 })], finish: null, events: [] };
    d = run(d, 12, idle(), guard());
    return stepDuel(d, [act('kick', { lock: true }), guard()]);
  };
  for (const opponent of Object.values(OPPONENTS)) for (const weapon of PLAYER_WEAPONS) {
    // The window: the tick the opponent leaves 'hurt' when nothing follows the kick.
    let d = setup(weapon, opponent), end = -1;
    const t0 = d.tick;
    for (let i = 0; i < 120 && end < 0; i++) { d = stepDuel(d, [idle(), guard()]); if (d.events.some(e => e.type === 'Staggered' && e.actor === 1) && d.fighters[1].stun !== kick.vsGuard!.stagger) assert.fail('guarded kick staggers by vsGuard'); if (d.tick - t0 > kick.windup && d.fighters[1].phase !== 'hurt') end = d.tick - t0; }
    // The punish: each of the quick follow-ups pressed on the first legal tick; the earliest one that hits.
    let best = Infinity, first = -1;
    for (const action of ['thrust', 'kick', 'light_right', 'light_left'] as Action[]) {
      let p = setup(weapon, opponent), pressed = -1;
      for (let i = 0; i < 120; i++) {
        const now = p.tick - t0, press = pressed < 0 && now > kick.windup && legal(p.fighters[0], action);
        p = stepDuel(p, [press ? act(action, { lock: true }) : idle(), guard()]);
        if (press) { pressed = now; first = now; }
        if (pressed >= 0 && p.events.some(e => e.actor === 0 && e.type === 'Hit')) { best = Math.min(best, p.tick - t0); break; }
        if (pressed >= 0 && p.events.some(e => e.actor === 0 && e.type === 'AttackMissed')) break;
      }
    }
    assert.ok(best <= end - 3, `${opponent.id} / ${weapon}: first legal ${first}, window end ${end}, fastest landing contact ${best}`);
  }
});

