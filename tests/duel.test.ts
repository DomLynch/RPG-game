import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, idleIntent, initialDuel, legal, stepDuel, type Action, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, PATHS, PROFILES, RULES, total, type GuardProfile } from '../src/moves.ts';
import { decide, initialAi } from '../src/ai.ts';
import { RADIUS, TARGET } from '../src/sim.ts';

// Both fighters are scripted here; the AI has its own suite. Index 0 stands south of index 1, both facing each other.
const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Action, extra: Partial<Intent> = {}): Intent => ({ ...idle(), action, ...extra });
const hold = (extra: Partial<Intent> = {}): Intent => ({ ...idle(), guard: true, ...extra });
function duel(gap = 1.2, heading = Math.PI, phase: 'ready' | 'sheathed' = 'ready'): Duel {
  return { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading, distance: 0 }, phase), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
}
function run(d: Duel, n: number, a: Intent = idle(), b: Intent = idle(), rules = RULES): Duel { for (let i = 0; i < n; i++) d = stepDuel(d, [a, b], rules); return d; }
const light = MOVES.light_right, heavy = MOVES.heavy_overhead, kick = MOVES.kick, LIGHT = total(light);
const types = (d: Duel) => d.events.map(e => e.type);

test('attack phases: nothing lands before the active window, a hit resolves once, a whiff is reported when the window closes', () => {
  let d = stepDuel(duel(), [act('light'), idle()]);
  assert.equal(d.fighters[0].phase, 'attack'); assert.equal(d.fighters[0].move, 'light_right'); assert.equal(d.fighters[0].stamina, 80);
  assert.deepEqual(types(d), ['AttackStarted']);
  d = run(d, light.windup - 1); assert.equal(d.fighters[1].health, 100);
  d = stepDuel(d, [idle(), idle()]);
  assert.equal(d.fighters[1].health, 100 - light.damage); assert.deepEqual(types(d), ['AttackActive', 'Hit', 'Staggered']);
  assert.equal(d.fighters[1].phase, 'hurt'); assert.equal(d.fighters[1].stun, light.stagger); assert.equal(d.fighters[1].wound, RULES.wound);
  d = run(d, LIGHT - light.windup, act('light'));
  assert.equal(d.fighters[1].health, 100 - light.damage, 'one swing damages once, whatever is pressed during recovery');
  assert.equal(run(d, LIGHT).fighters[1].health, 100 - 2 * light.damage, 'the queued follow-up is a separate swing that lands after its own wind-up');
  let whiff = run(stepDuel(duel(light.reach + 1), [act('light'), idle()]), light.windup + light.active - 2);
  assert.ok(!types(whiff).includes('AttackMissed'));
  whiff = stepDuel(whiff, [idle(), idle()]); assert.deepEqual(types(whiff), ['AttackMissed']); assert.equal(whiff.fighters[1].health, 100);
});

test('drawing takes its full time, cannot damage, and holds the fighter still like every committed action', () => {
  const start = duel(1.2, Math.PI, 'sheathed');
  const d = stepDuel(start, [act('light', { move: { x: 0, z: -1, yaw: 0, run: false } }), idle()]);
  assert.equal(d.fighters[0].phase, 'draw'); assert.deepEqual(d.fighters[0].body, start.fighters[0].body); assert.equal(d.fighters[0].stamina, 100);
  assert.equal(run(d, RULES.draw - 1).fighters[0].phase, 'draw');
  assert.equal(run(d, RULES.draw).fighters[0].phase, 'ready');
  assert.equal(run(d, 200, act('heavy')).fighters[1].health, 100 - 2 * heavy.damage, 'heavy is refused while sheathed, accepted once armed; a second is queued from recovery');
  assert.equal(stepDuel(start, [act('heavy'), idle()]).fighters[0].phase, 'sheathed');
});

test('range and facing produce real misses; lock turns during wind-up but never snaps around', () => {
  for (const d of [duel(light.reach + 1), duel(1.2, 0)]) assert.equal(run(d, LIGHT, act('light')).fighters[1].health, 100);
  let turning = stepDuel(duel(1.2, 0), [act('light', { lock: true }), idle()]);
  assert.ok(Math.abs(turning.fighters[0].body.heading) <= RULES.turnStart + RULES.turnWindup + 1e-9);
  turning = run(turning, light.windup, { ...idle(), lock: true });
  assert.equal(turning.fighters[1].health, 100 - light.damage, 'controlled turning still reaches the opponent');
  assert.equal(run(duel(light.reach), LIGHT, act('light')).fighters[1].health, 100 - light.damage, 'step-in covers the last of the reach');
});

test('enough clean hits kill; death freezes both fighters and rejects every input', () => {
  let d = duel();
  for (let i = 0; i < Math.ceil(100 / light.damage); i++) {
    d = { ...d, fighters: [{ ...d.fighters[0], stamina: 100, exhausted: false, body: { x: d.fighters[1].body.x, z: d.fighters[1].body.z + 1.2, heading: Math.PI, distance: 0 } }, { ...d.fighters[1], phase: 'ready', age: 0 }] };
    d = run(stepDuel(d, [act('light'), idle()]), LIGHT);
  }
  assert.equal(d.fighters[1].health, 0); assert.equal(d.fighters[1].phase, 'dead'); assert.equal(d.finish?.victim, 1); assert.equal(d.finish?.move, Math.ceil(100 / light.damage) % 2 ? 'light_right' : 'light_left', 'the single button alternates sides');
  assert.ok(['head', 'torso', 'legs'].includes(d.finish!.location)); assert.equal(d.finish?.location, d.fighters[1].woundSite);
  const frozen = run(d, 200, act('heavy', { move: { x: 1, z: 1, yaw: 0, run: true }, guard: true }), act('light'));
  assert.deepEqual(frozen.fighters[0].body, d.fighters[0].body); assert.equal(frozen.fighters[0].stamina, d.fighters[0].stamina); assert.equal(frozen.fighters[1].health, 0);
  for (const action of ['light', 'heavy', 'kick', 'dodge', 'parry'] as const) assert.equal(legal(frozen.fighters[1], action), false);
});

test('held guard blocks a facing light for stamina; a guard from behind or without stamina is broken', () => {
  const incoming = (d: Duel) => run(d, light.windup + 1, hold(), act('light'));
  const blocked = incoming(stepDuel(duel(), [hold(), idle()]));
  assert.equal(blocked.fighters[0].health, 100); assert.equal(blocked.fighters[0].stamina, 100 - light.staminaDamage); assert.equal(blocked.fighters[0].wound, 0);
  assert.deepEqual(types(blocked), ['AttackActive', 'Blocked']);
  const behind = incoming(stepDuel(duel(1.2, 0), [hold(), idle()]));
  assert.equal(behind.fighters[0].health, 100 - Math.round(light.damage * RULES.rear.damage), 'a hit from behind also earns the rear bonus'); assert.ok(behind.events.find(e => e.type === 'Hit')?.rear);
  const weak = { ...duel(), fighters: [{ ...duel().fighters[0], stamina: 24 }, duel().fighters[1]] } as Duel;
  const broken = incoming(stepDuel(weak, [hold(), idle()]));
  assert.equal(broken.fighters[0].health, 100 - light.damage); assert.equal(broken.fighters[0].stamina, 0); assert.equal(broken.fighters[0].exhausted, true); assert.equal(broken.fighters[0].phase, 'hurt');
  assert.deepEqual(types(broken), ['AttackActive', 'StaminaExhausted', 'GuardBroken', 'Staggered']);
  const distant = run(stepDuel(duel(4), [hold(), idle()]), 10, hold());
  assert.equal(distant.fighters[0].stamina, 100, 'guarding prevents regeneration and costs nothing without contact');
});

test('perfect block: a guard raised just in time pays half; a settled guard pays full; a parry window never counts', () => {
  const incoming = (guardAge: number, parrying = false) => stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', age: guardAge, parrying }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [hold(), idle()]);
  for (const age of [RULES.parry, RULES.parry + RULES.perfectBlock - 2]) {
    const d = incoming(age);
    assert.equal(d.fighters[0].stamina, 100 - light.staminaDamage * RULES.perfectBlockCost, `guard age ${age}`);
    const blocked = d.events.find(e => e.type === 'Blocked')!;
    assert.equal(blocked.perfect, true); assert.equal(blocked.stamina, light.staminaDamage * RULES.perfectBlockCost);
  }
  const settled = incoming(RULES.parry + RULES.perfectBlock);
  assert.equal(settled.fighters[0].stamina, 100 - light.staminaDamage); assert.equal(settled.events.find(e => e.type === 'Blocked')!.perfect, false);
  // A live parry window parries instead; a fresh press that outlives its window is exposed, never a perfect block.
  assert.ok(types(incoming(RULES.parry - 2, true)).includes('Parried'));
  const fresh = run(stepDuel(duel(), [act('parry', { guard: true }), idle()]), RULES.parry, hold());
  assert.equal(fresh.fighters[0].phase, 'ready'); assert.ok(fresh.fighters[0].exposed > 0);
  // Composes with a guard profile.
  const shielded = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', age: RULES.parry, guardProfile: { costScale: .5 } }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [hold(), idle()]);
  assert.equal(shielded.fighters[0].stamina, 100 - light.staminaDamage * .5 * RULES.perfectBlockCost);
});

test('parry succeeds only inside the fresh-press window, staggers the attacker and opens one stronger riposte', () => {
  const attackerAt = (d: Duel, age: number) => ({ ...d, fighters: [d.fighters[0], { ...d.fighters[1], phase: 'attack' as const, move: 'light_left' as const, age, chained: false, landed: false, lastMove: 'light_left' as const }] } as Duel);
  const contact = light.windup;
  const parried = stepDuel(attackerAt(duel(), contact - 1), [act('parry', { guard: true }), idle()]);
  assert.deepEqual(types(parried), ['ActionStarted', 'AttackActive', 'Parried', 'Staggered']);
  assert.equal(parried.fighters[0].health, 100); assert.equal(parried.fighters[0].stamina, 100); assert.equal(parried.fighters[0].punish, RULES.parryStun);
  assert.equal(parried.fighters[1].phase, 'hurt'); assert.equal(parried.fighters[1].stun, RULES.parryStun); assert.equal(parried.fighters[1].landed, true);
  const late = stepDuel(attackerAt({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', age: RULES.parry, parrying: false }, duel().fighters[1]] }, contact - 1), [hold(), idle()]);
  assert.ok(types(late).includes('Blocked'), 'after the window a held guard only blocks');
  const cooling = stepDuel(attackerAt({ ...duel(), fighters: [{ ...duel().fighters[0], parryCooldown: 2 }, duel().fighters[1]] }, contact - 1), [act('parry', { guard: true }), idle()]);
  assert.ok(types(cooling).includes('Blocked'), 'a press during cooldown opens no window');
  const boundary = stepDuel(attackerAt({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', age: RULES.parry - 2, parrying: true }, duel().fighters[1]] }, contact - 1), [hold(), idle()]);
  assert.ok(types(boundary).includes('Parried'), 'the last tick of the window still parries');
  let counter = run(parried, RULES.parry + 1, hold());
  counter = stepDuel(counter, [idle(), idle()]);   // release the guard, then strike
  counter = stepDuel(counter, [act('light'), idle()]);
  assert.equal(counter.fighters[0].move, 'riposte'); assert.equal(counter.fighters[0].punish, 0);
  counter = run(counter, MOVES.riposte.windup);
  assert.equal(counter.fighters[1].health, 100 - MOVES.riposte.damage); assert.equal(counter.fighters[1].phase, 'hurt');
  assert.equal(stepDuel(run(counter, total(MOVES.riposte)), [act('light'), idle()]).fighters[0].move, 'light_right', 'one riposte per parry');
});

test('a fresh parry that meets nothing leaves the fighter exposed: guard is refused until the exposure ends', () => {
  assert.equal(RULES.parryRecovery, 8);
  let d = stepDuel(duel(), [act('parry', { guard: true }), idle()]);
  d = run(d, RULES.parry - 1, hold());
  assert.equal(d.fighters[0].phase, 'guard');
  d = stepDuel(d, [hold(), idle()]);
  assert.equal(d.fighters[0].phase, 'ready'); assert.equal(d.fighters[0].exposed, RULES.parryRecovery);
  assert.equal(stepDuel(d, [hold(), idle()]).fighters[0].phase, 'ready', 'guard is refused while exposed');
  assert.equal(legal(d.fighters[0], 'parry'), false, 'the control gate agrees with the engine while exposed');
  assert.equal(run(d, RULES.parryRecovery - 1, hold()).fighters[0].phase, 'ready');
  assert.equal(run(d, RULES.parryRecovery + 1, hold()).fighters[0].phase, 'guard', 'exposure ends and the held guard engages');
  const off = { ...RULES, parryRecovery: 0 };
  assert.equal(run(stepDuel(duel(), [act('parry', { guard: true }), idle()], off), RULES.parry + 2, hold(), idle(), off).fighters[0].phase, 'guard', 'with the rule off a held guard simply stays up');
  // A parry that connects is never punished: the punish window proves it.
  const parried = stepDuel({ ...duel(), fighters: [duel().fighters[0], { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [act('parry', { guard: true }), idle()]);
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
  const feinted = stepDuel(d, [act('parry', { guard: true }), idle()]);
  assert.equal(feinted.fighters[0].phase, 'guard'); assert.equal(feinted.fighters[0].age, 0); assert.equal(feinted.fighters[0].parrying, true);
  assert.equal(feinted.fighters[0].stamina, 100 - light.stamina - RULES.feintCost); assert.equal(feinted.fighters[0].parryCooldown, RULES.parryCooldown);
  assert.deepEqual(types(feinted), ['ActionStarted']); assert.equal(feinted.events[0].action, 'feint');
  assert.equal(run(feinted, LIGHT, hold()).fighters[1].health, 100, 'the abandoned swing never lands');
  assert.equal(run(feinted, LIGHT, hold()).fighters[0].chain, 0, 'and opens no chain window');
  // Too late: the swing is committed and the press is neither accepted nor queued.
  const late = run(stepDuel(duel(), [act('light'), idle()]), light.feintUntil);
  assert.equal(legal(late.fighters[0], 'parry'), false);
  const pressed = stepDuel(late, [act('parry', { guard: true }), idle()]);
  assert.equal(pressed.fighters[0].phase, 'attack'); assert.equal(pressed.fighters[0].buffer, null);
  assert.equal(run(pressed, light.windup, hold()).fighters[1].health, 100 - light.damage);
  // Heavy has a longer window; a kick has none; a held guard alone (no fresh press) never feints; exhaustion forbids it.
  assert.equal(stepDuel(run(stepDuel(duel(), [act('heavy'), idle()]), heavy.feintUntil - 1), [act('parry', { guard: true }), idle()]).fighters[0].phase, 'guard');
  assert.equal(stepDuel(run(stepDuel(duel(), [act('heavy'), idle()]), heavy.feintUntil), [act('parry', { guard: true }), idle()]).fighters[0].phase, 'attack');
  assert.equal(stepDuel(run(stepDuel(duel(1.05), [act('kick'), idle()]), 2), [act('parry', { guard: true }), idle()]).fighters[0].move, 'kick');
  assert.equal(stepDuel(run(stepDuel(duel(), [act('light'), idle()]), 2), [hold(), idle()]).fighters[0].phase, 'attack');
  const broke = { ...duel(), fighters: [{ ...duel().fighters[0], stamina: 25 }, duel().fighters[1]] } as Duel;
  const poor = stepDuel(run(stepDuel(broke, [act('light'), idle()]), 2), [act('parry', { guard: true }), idle()]);
  assert.equal(poor.fighters[0].phase, 'attack', 'cannot afford the feint');
  // On cooldown the feint still cancels the swing, but into a plain guard without a window.
  const cooling = { ...duel(), fighters: [{ ...duel().fighters[0], parryCooldown: 20 }, duel().fighters[1]] } as Duel;
  const plain = stepDuel(run(stepDuel(cooling, [act('light'), idle()]), 2), [act('parry', { guard: true }), idle()]);
  assert.equal(plain.fighters[0].phase, 'guard'); assert.equal(plain.fighters[0].parrying, false); assert.equal(plain.fighters[0].age, RULES.parry);
});

test('guard profile: a shield is data — block cost, arc, window and stopping heavies come from the fighter, defaults from RULES', () => {
  const withGuard = (profile: Partial<GuardProfile>) => { const d = duel(); d.fighters[0] = { ...d.fighters[0], guardProfile: profile }; return run(stepDuel(d, [hold(), idle()]), RULES.parry + 1, hold()); };
  const incoming = (d: Duel, move: 'light_left' | 'heavy_overhead' = 'light_left') => run({ ...d, fighters: [d.fighters[0], { ...d.fighters[1], phase: 'attack', move, age: MOVES[move].windup - 1, lastMove: move }] } as Duel, 1, hold(), idle());
  assert.equal(incoming(withGuard({})).fighters[0].stamina, 75);
  assert.equal(incoming(withGuard({ costScale: .5 })).fighters[0].stamina, 87.5);
  assert.ok(types(incoming(withGuard({}), 'heavy_overhead')).includes('GuardBroken'));
  const shield = incoming(withGuard({ stopsHeavy: true }), 'heavy_overhead');
  assert.ok(types(shield).includes('Blocked')); assert.equal(shield.fighters[0].health, 100);
  const behind = withGuard({ arc: Math.PI }); behind.fighters[0] = { ...behind.fighters[0], body: { ...behind.fighters[0].body, heading: 0 } };
  assert.ok(types(incoming(behind)).includes('Blocked'), 'a full-circle arc blocks from behind');
  const wide = duel(); wide.fighters[0] = { ...wide.fighters[0], guardProfile: { window: 16 } };
  const lateParry = run(stepDuel({ ...wide, fighters: [wide.fighters[0], { ...wide.fighters[1], phase: 'attack', move: 'light_left', age: 0, lastMove: 'light_left' }] } as Duel, [act('parry', { guard: true }), idle()]), light.windup - 1, hold());
  assert.ok(types(lateParry).includes('Parried'), 'a 16-tick window still parries at tick 14');
});

test('the feint mind-game: a raised guard answers the feint, and a kick opens it', () => {
  // A blocking opponent (no parry, no roll) raises its guard as soon as it notices the heavy.
  const blocker = { ...PROFILES.hard, parry: 0, dodge: 0 };
  let d = duel(1.1), ai = initialAi(); const seen: string[] = [];
  const step = (intent: Intent) => { const w = decide(d, 1, ai, blocker); ai = w.ai; d = stepDuel(d, [intent, w.intent]); seen.push(...d.events.map(e => `${e.type}:${e.actor}${e.action ? ':' + e.action : ''}${e.move ? ':' + e.move : ''}`)); };
  step(act('heavy'));
  for (let i = 0; i < heavy.feintUntil - 2; i++) step(idle());
  assert.equal(d.fighters[1].phase, 'guard', 'the opponent has raised its guard against the heavy');
  step(act('parry', { guard: true }));
  assert.ok(seen.includes('ActionStarted:0:feint'));
  step(act('kick', { guard: true }));
  for (let i = 0; i < kick.windup; i++) step(idle());
  assert.ok(seen.includes('Hit:0:kick'), seen.join(' '));
  assert.equal(d.fighters[1].stun, kick.vsGuard!.stagger, 'the kick opened a standing guard');
});

test('directional guard, when enabled, only stops cuts from the matching side', () => {
  const rules = { ...RULES, directionalGuard: true };
  for (const [side, attack, blocks] of [['right', 'light_right', true], ['left', 'light_right', false], ['left', 'light_left', true], ['overhead', 'light_left', false]] as const) {
    let d = stepDuel(duel(), [hold({ guardDirection: side }), idle()], rules);
    d = run(d, RULES.parry, hold({ guardDirection: side }), idle(), rules);
    d = stepDuel(d, [hold({ guardDirection: side }), act(attack)], rules);
    d = run(d, light.windup, hold({ guardDirection: side }), idle(), rules);
    assert.equal(d.fighters[0].health, blocks ? 100 : 100 - light.damage, `${side} guard vs ${attack}`);
  }
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
    const expected = safe ? 100 : age + 1 > RULES.safeEnd ? 100 - Math.round(light.damage * RULES.counter.damage) : 100 - light.damage;   // the tail of a roll is a counter-hit
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
  assert.equal(struck.fighters[0].health, 100 - light.damage); assert.ok(!types(struck).includes('Dodged'));
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

test('stamina: costs at commitment, delayed regeneration, no regeneration while guarding, sprint drain, exhaustion and recovery', () => {
  let d = stepDuel(duel(4), [act('light'), idle()]);
  assert.equal(d.fighters[0].stamina, 80); assert.equal(d.fighters[0].rest, RULES.regenDelay);
  d = run(d, LIGHT);
  assert.equal(d.fighters[0].stamina, 80, 'no regeneration until the delay passes');
  d = run(d, RULES.regenDelay - LIGHT);
  assert.ok(Math.abs(d.fighters[0].stamina - 80 - RULES.regen) < 1e-9, 'first regeneration tick lands as the delay ends');
  const guarded = run(stepDuel(duel(4), [act('light'), idle()]), 200, hold());
  assert.equal(guarded.fighters[0].stamina, 80);
  const sprint = run(duel(4), 30, { ...idle(), move: { x: 0, z: 1, yaw: 0, run: true } });
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
  const chainedBreak = run(stepDuel({ ...guarded, fighters: [{ ...guarded.fighters[0], chain: 10, lastMove: 'light_right' }, guarded.fighters[1]] } as Duel, [act('heavy'), hold()]), heavy.chained!.windup, idle(), hold());
  assert.ok(types(chainedBreak).includes('GuardBroken'), 'a chained heavy still breaks a guard');
  // Dodge-attack: from a backstep's tail, or within dodgeAttackWindow ticks after a roll or backstep ends.
  const fromStep = stepDuel(run(stepDuel(duel(1.2), [act('backstep'), idle()]), RULES.backstep.cancelFrom), [act('light'), idle()]);
  assert.equal(fromStep.fighters[0].chained, true); assert.equal(fromStep.fighters[0].move, 'light_right');
  const rolled = run(stepDuel(duel(2.2), [act('dodge'), idle()]), RULES.roll);
  assert.equal(rolled.fighters[0].phase, 'ready'); assert.equal(rolled.fighters[0].evaded, RULES.dodgeAttackWindow);
  assert.equal(stepDuel(rolled, [act('light'), idle()]).fighters[0].chained, true, 'a light straight out of a roll is quick');
  assert.equal(stepDuel(run(rolled, RULES.dodgeAttackWindow), [act('light'), idle()]).fighters[0].chained, false, 'wait longer and it is an ordinary cut');
  assert.equal(stepDuel(rolled, [act('heavy'), idle()]).fighters[0].chained, false, 'only lights come out of an evade quickly');
  // Riposte choice during the punish window: light = thrust (40), heavy = heavy riposte (48, breaks guard).
  const punishing = { ...duel(), fighters: [{ ...duel().fighters[0], punish: 60 }, duel().fighters[1]] } as Duel;
  assert.equal(stepDuel(punishing, [act('light'), idle()]).fighters[0].move, 'riposte');
  const heavyRip = stepDuel(punishing, [act('heavy'), idle()]);
  assert.equal(heavyRip.fighters[0].move, 'heavy_riposte'); assert.equal(heavyRip.fighters[0].stamina, 100 - MOVES.heavy_riposte.stamina); assert.equal(heavyRip.fighters[0].punish, 0);
  assert.equal(run(heavyRip, MOVES.heavy_riposte.windup).fighters[1].health, 100 - MOVES.heavy_riposte.damage);
  const ripGuard = run(stepDuel({ ...guarded, fighters: [{ ...guarded.fighters[0], punish: 60 }, guarded.fighters[1]] } as Duel, [act('heavy'), hold()]), MOVES.heavy_riposte.windup, idle(), hold());
  assert.ok(types(ripGuard).includes('GuardBroken'));
});

test('counter-hit: a clean hit on a committed swing or a roll\'s tail lands harder and staggers longer; never through a guard or parry', () => {
  const light11 = light.damage, counterDmg = Math.round(light11 * RULES.counter.damage), counterStun = Math.round(light.stagger * RULES.counter.stagger);
  // Target mid wind-up (a slower heavy started first), attacker's light lands at its own contact tick.
  let d = stepDuel(duel(), [idle(), act('heavy')]); d = run(stepDuel(d, [act('light'), idle()]), light.windup);
  const hit = d.events.find(e => e.type === 'Hit')!;
  assert.equal(hit.counter, true); assert.equal(hit.damage, counterDmg); assert.equal(d.fighters[1].health, 100 - counterDmg); assert.equal(d.fighters[1].stun, counterStun);
  // Target in recovery (whiff punish) is also a counter; a ready target is not.
  const whiff = run(stepDuel(duel(light.reach + 1), [idle(), act('light')]), light.windup + light.active + 1);   // the swing has whiffed; the punish lands in its recovery
  const punish = run(stepDuel({ ...whiff, fighters: [{ ...whiff.fighters[0], body: { ...whiff.fighters[0].body, z: whiff.fighters[1].body.z + 1.2 } }, whiff.fighters[1]] } as Duel, [act('light'), idle()]), light.windup);
  assert.equal(punish.events.find(e => e.type === 'Hit')?.counter, true);
  const plain = run(stepDuel(duel(), [act('light'), idle()]), light.windup);
  assert.equal(plain.events.find(e => e.type === 'Hit')?.counter, false); assert.equal(plain.fighters[1].health, 100 - light11); assert.equal(plain.fighters[1].stun, light.stagger);
  // Roll tail counts, the invulnerable window does not exist to be countered, and a guard or parry never yields a counter.
  const tail = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'roll', age: RULES.safeEnd + 2 }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [idle(), idle()]);
  assert.equal(tail.events.find(e => e.type === 'Hit')?.counter, true); assert.equal(tail.fighters[0].health, 100 - counterDmg);
  const guarded = stepDuel({ ...duel(), fighters: [{ ...duel().fighters[0], phase: 'guard', age: 12 }, { ...duel().fighters[1], phase: 'attack', move: 'light_left', age: light.windup - 1, lastMove: 'light_left' }] } as Duel, [hold(), idle()]);
  assert.ok(types(guarded).includes('Blocked')); assert.equal(guarded.fighters[0].stamina, 100 - light.staminaDamage);
  // Kicks and heavies use the same rule.
  const kicked = run(stepDuel(duel(1.05), [act('kick'), act('heavy')]), kick.windup);
  assert.equal(kicked.events.find(e => e.type === 'Hit')?.damage, Math.round(kick.damage * RULES.counter.damage));
});

test('rear hit: striking inside the target\'s rear arc earns a modest damage and stagger bonus, stacking with a counter', () => {
  const turned = (heading: number) => run(stepDuel({ ...duel(1.2, heading), fighters: [duel(1.2, heading).fighters[0], duel().fighters[1]] } as Duel, [idle(), act('light')]), light.windup);
  const behind = turned(0), side = turned(Math.PI / 2 + .3), front = turned(Math.PI);
  assert.equal(behind.events.find(e => e.type === 'Hit')?.rear, true); assert.equal(behind.fighters[0].health, 100 - Math.round(light.damage * RULES.rear.damage)); assert.equal(behind.fighters[0].stun, Math.round(light.stagger * RULES.rear.stagger));
  assert.equal(side.events.find(e => e.type === 'Hit')?.rear, false, 'just outside the 90° rear arc is a normal hit');
  assert.equal(front.fighters[0].health, 100 - light.damage);
  const both = run(stepDuel({ ...duel(1.0, 0), fighters: [{ ...duel(1.0, 0).fighters[0], phase: 'attack', move: 'heavy_overhead', age: 2, lastMove: 'heavy_overhead' }, duel().fighters[1]] } as Duel, [{ ...idle(), lock: false }, act('light')]), light.windup);
  assert.equal(both.fighters[0].health, 100 - Math.round(light.damage * RULES.counter.damage * RULES.rear.damage), 'counter and rear multiply');
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
  parry = run(stepDuel(parry, [act('parry', { guard: true }), idle()]), 4, hold());
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
  assert.equal(armoured.fighters[0].health, 100 - Math.round(light.damage * RULES.counter.damage), 'a light on a winding-up heavy is a counter-hit'); assert.equal(armoured.fighters[0].phase, 'attack', 'poise absorbs the stagger, not the damage');
  armoured = run(armoured, heavy.windup - (armoured.fighters[0].age));
  assert.equal(armoured.fighters[1].health, 100 - Math.round(heavy.damage * RULES.counter.damage), 'the heavy still lands, as a counter on the recovering light');
  let soft = stepDuel(duel(), [act('heavy'), idle()]);
  soft = stepDuel(soft, [idle(), act('light')]);
  soft = run(soft, light.windup);
  assert.equal(soft.fighters[0].phase, 'hurt', 'before the poise point a heavy is interrupted like anything else');
});

test('heavy breaks a standing guard; kick opens a guard harder than an unguarded body and never wounds', () => {
  const guarded = run(stepDuel(duel(), [idle(), hold()]), RULES.parry + 2, idle(), hold());
  const broken = run(stepDuel(guarded, [act('heavy'), hold()]), heavy.windup, idle(), hold());
  assert.equal(broken.fighters[1].health, 100 - heavy.damage); assert.equal(broken.fighters[1].stamina, 0); assert.ok(types(broken).includes('GuardBroken'));
  const close = { ...guarded, fighters: [{ ...guarded.fighters[0], body: { ...guarded.fighters[0].body, z: TARGET.z + 1.05 } }, guarded.fighters[1]] } as Duel;
  let kicked = stepDuel(close, [act('kick'), hold()]);
  assert.equal(kicked.fighters[0].stamina, 75); assert.equal(kicked.fighters[0].move, 'kick');
  kicked = run(kicked, kick.windup - 1, idle(), hold()); assert.equal(kicked.fighters[1].health, 100);
  kicked = stepDuel(kicked, [idle(), hold()]);
  assert.equal(kicked.fighters[1].health, 100 - kick.damage); assert.equal(kicked.fighters[1].stamina, 100 - kick.vsGuard!.staminaDamage); assert.equal(kicked.fighters[1].stun, kick.vsGuard!.stagger); assert.equal(kicked.fighters[1].wound, 0);
  assert.ok(kicked.fighters[1].body.z < TARGET.z, 'kick shoves'); assert.equal(run(kicked, total(kick) - kick.windup).fighters[0].phase, 'ready');
  const open = run(stepDuel({ ...duel(1.05), fighters: [duel(1.05).fighters[0], duel(1.05).fighters[1]] }, [act('kick'), idle()]), kick.windup);
  assert.equal(open.fighters[1].health, 100 - kick.damage); assert.equal(open.fighters[1].stamina, 100 - kick.staminaDamage); assert.equal(open.fighters[1].stun, kick.stagger);
  for (const d of [duel(2), duel(1.05, 0)]) assert.equal(run(stepDuel(d, [act('kick'), idle()]), kick.windup).fighters[1].health, 100);
  // The kick cone is a rule of its own: a target off to the side stays in reach through the lunge yet must not be hit.
  const beside = duel(.9, Math.PI / 2);
  beside.fighters[0] = { ...beside.fighters[0], body: { x: 0, z: TARGET.z, heading: Math.PI / 2, distance: 0 } }; beside.fighters[1] = { ...beside.fighters[1], body: { x: 0, z: TARGET.z + .9, heading: Math.PI, distance: 0 } };
  assert.equal(run(stepDuel(beside, [act('kick'), idle()]), kick.windup).fighters[1].health, 100, 'a target 90° off the kick line is not hit');
  // A point-blank kick lunges, so a plain backstep during its wind-up cannot walk out of reach.
  const backing = run(stepDuel(duel(.9), [act('kick'), idle()]), kick.windup, idle(), { ...idle(), move: { x: 0, z: -.4, yaw: 0, run: false }, lock: true });
  assert.equal(backing.fighters[1].health, 100 - kick.damage);
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
  let parried = run(stepDuel(duel(), [act('light'), idle()]), 5);
  parried = run(stepDuel(parried, [idle(), act('parry', { guard: true })]), light.windup - 6, idle(), hold());
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
  for (let i = 0; i < 24000; i++) {
    if (!d.fighters[0].health || !d.fighters[1].health) d = { ...duel(1.2), tick: d.tick };
    // Coverage fuzz, not an economy test: re-centre wanderers without healing them and top up stamina so every outcome keeps occurring.
    if (i % 1500 === 0) d = { ...d, fighters: d.fighters.map((f, k) => ({ ...f, body: duel(1.2).fighters[k].body })) as Duel['fighters'] };
    if (i % 300 === 0) d = { ...d, fighters: d.fighters.map(f => ({ ...f, stamina: 100, exhausted: false })) as Duel['fighters'] };
    const intents: [Intent, Intent] = [0, 1].map(k => { if (random() < .04) held[k] = !held[k]; return { move: { x: (random() - .5) * .6, z: (random() - .5) * .6, yaw: 0, run: random() < .02 }, action: pick(), guard: held[k], lock: true }; }) as [Intent, Intent];
    d = stepDuel(d, intents);
    const hits = d.events.filter(e => ['Hit', 'Blocked', 'Parried', 'GuardBroken', 'Dodged'].includes(e.type));
    for (const actor of [0, 1]) assert.ok(hits.filter(e => (e.type === 'Hit' || e.type === 'GuardBroken' ? e.actor : e.target) === actor).length <= 1, 'at most one contact outcome per attacker per tick');
    for (const e of d.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
    for (const e of d.events) assert.equal(e.tick, d.tick);
  }
  for (const type of ['AttackStarted', 'AttackActive', 'AttackMissed', 'Hit', 'Blocked', 'Parried', 'GuardBroken', 'Dodged', 'Staggered', 'StaminaExhausted', 'Killed', 'ActionStarted']) assert.ok(counts[type] > 0, `${type} never occurred in the fuzz`);
});

test('the same intent sequence replays to the same duel; inputs never mutate the previous state; resources stay bounded', () => {
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
        for (const value of [f.health, f.stamina]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
        assert.ok(Number.isFinite(f.body.heading));
      }
      assert.ok(Math.hypot(next.fighters[0].body.x - next.fighters[1].body.x, next.fighters[0].body.z - next.fighters[1].body.z) >= .85 - 1e-8);
      d = next;
    }
    return d;
  };
  assert.deepEqual(play(), play());
});
