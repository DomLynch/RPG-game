import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice, SWORD, DEFENCE, canDefend, canStrike, type Practice } from '../src/combat.ts';
import { TARGET, RADIUS } from '../src/sim.ts';
const idle = { x: 0, z: 0, yaw: 0, run: false };
function tick(state: Practice, count: number) { for (let i = 0; i < count; i++) state = stepPractice(state, idle, false, false); return state; }
function ready(distance = 1.2, heading = Math.PI): Practice {
  return { ...initialPractice(), phase: 'ready', fighter: { x: 0, z: TARGET.z + distance, heading, distance: 0 } };
}

test('drawing cannot damage and movement stops during committed actions', () => {
  const start = initialPractice();
  const drawing = stepPractice(start, { ...idle, z: -1 }, true, true);
  assert.equal(drawing.phase, 'draw'); assert.deepEqual(drawing.fighter, start.fighter);
  assert.equal(tick(drawing, SWORD.draw - 1).phase, 'draw');
  assert.equal(tick(drawing, SWORD.draw).phase, 'ready');
  assert.equal(tick(drawing, 200).health, 100);
  const before = ready(), attacking = stepPractice(before, { ...idle, x: 1 }, true, false);
  assert.deepEqual(attacking.fighter, before.fighter);
});

test('one strike damages exactly once on contact, never on input or repeated requests during recovery', () => {
  const attacking = stepPractice(ready(), idle, true, false);
  assert.equal(attacking.health, 100);
  const before = tick(attacking, SWORD.contact - 1); assert.equal(before.health, 100);
  const hit = stepPractice(before, idle, true, false);
  assert.equal(hit.health, 75); assert.equal(hit.hits, 1); assert.equal(hit.result, 'hit');
  let state = hit;
  while (state.phase === 'attack') state = stepPractice(state, idle, true, false);
  assert.equal(state.health, 75); assert.equal(state.hits, 1);
});

test('range and facing cause real misses; lock fixes aim only when a strike begins', () => {
  for (const state of [ready(SWORD.reach + .001), ready(1.2, 0)]) {
    const result = tick(stepPractice(state, idle, true, false), SWORD.contact);
    assert.equal(result.health, 100); assert.equal(result.result, 'miss');
  }
  assert.equal(tick(stepPractice(ready(1.2, 0), idle, true, true), SWORD.contact).health, 75);
  assert.equal(tick(stepPractice(ready(SWORD.reach), idle, true, false), SWORD.contact).health, 75);
});

test('four confirmed hits defeat the warden; later inputs cannot deal extra damage', () => {
  let state = ready();
  for (let i = 0; i < 4; i++) state = tick(stepPractice(state, idle, true, false), SWORD.recovery);
  assert.equal(state.health, 0); assert.equal(state.hits, 4);
  for (let i = 0; i < 200; i++) state = stepPractice(state, idle, true, true);
  assert.equal(state.health, 0); assert.equal(state.hits, 4);
});

test('seeded movement and strike sequences replay identically without mutating previous state', () => {
  let seed = 71;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const inputs = Array.from({ length: 10000 }, () => ({ input: { x: random() * 2 - 1, z: random() * 2 - 1, yaw: random() * 6, run: random() < .2 }, strike: random() < .1, locked: random() < .5 }));
  const run = () => inputs.reduce((state, frame) => {
    const before = structuredClone(state); Object.freeze(state.fighter); Object.freeze(state);
    const next = stepPractice(state, frame.input, frame.strike, frame.locked);
    assert.deepEqual(state, before); assert.ok(next.health >= 0 && next.health <= 100);
    return next;
  }, initialPractice());
  assert.deepEqual(run(), run());
});


test('repeated input cannot queue an attack during drawing or recovery', () => {
  let state = stepPractice(initialPractice(), idle, true, false);
  for (let tick = 0; tick < SWORD.draw; tick++) {
    assert.equal(canStrike(state), false);
    state = stepPractice(state, idle, true, false);
  }
  assert.equal(canStrike(state), true); assert.equal(state.phase, 'ready');
  state = stepPractice(state, idle, true, false);
  for (let tick = 0; tick < SWORD.recovery; tick++) {
    assert.equal(canStrike(state), false);
    state = stepPractice(state, idle, true, false);
  }
  assert.equal(state.phase, 'ready'); assert.equal(state.health, 100);
  assert.equal(canStrike({ ...state, health: 0 }), false);
});

const incoming = (state = ready()): Practice => ({ ...state, enemyAttacking: true, enemyAge: DEFENCE.enemyContact - 1, enemyHeading: 0 });
test('warden telegraphs, commits its facing, hits only once and leaves time to recover', () => {
  const winding = tick(ready(), DEFENCE.enemyWait);
  assert.equal(winding.enemyAttacking, true); assert.equal(winding.playerHealth, 100);
  assert.equal(tick(winding, DEFENCE.enemyContact - 1).playerHealth, 100);
  const struck = tick(winding, DEFENCE.enemyContact);
  assert.equal(struck.playerHealth, 80); assert.equal(struck.phase, 'hurt');
  assert.equal(tick(struck, DEFENCE.enemyRecovery - DEFENCE.enemyContact).playerHealth, 80);
  assert.equal(stepPractice({ ...incoming(), fighter: { ...ready().fighter, z: TARGET.z - 1.2 } }, idle, false, false).playerHealth, 100);
});
test('timed guard parries; held guard blocks and pays stamina, never refreshes parry', () => {
  const parried = stepPractice(incoming(), idle, false, true, { parry: true, guard: true });
  assert.equal(parried.result, 'parried'); assert.equal(parried.playerHealth, 100); assert.equal(parried.stamina, 100); assert.equal(parried.reaction, DEFENCE.stun);
  assert.equal(parried.enemyAttacking, false);
  const blocked = stepPractice(incoming({ ...ready(), phase: 'guard', age: 30 }), idle, false, true, { parry: true, guard: true });
  assert.equal(blocked.result, 'blocked'); assert.equal(blocked.stamina, 75); assert.equal(blocked.playerHealth, 100);
  const cooldown = stepPractice(incoming({ ...ready(), parryCooldown: 2 }), idle, false, true, { parry: true });
  assert.equal(cooldown.result, 'hurt'); // A released tap during cooldown cannot create another window.
});
test('guard is directional, breaks when exhausted, and release permits regeneration', () => {
  const backward = stepPractice(incoming({ ...ready(1.2, 0), phase: 'guard', age: 20 }), idle, false, false, { guard: true });
  assert.equal(backward.result, 'hurt'); assert.equal(backward.playerHealth, 80);
  const broken = stepPractice(incoming({ ...ready(), phase: 'guard', age: 20, stamina: 24 }), idle, false, true, { guard: true });
  assert.equal(broken.result, 'broken'); assert.equal(broken.stamina, 0); assert.equal(broken.phase, 'hurt');
  const distant = { ...ready(4), phase: 'guard' as const, age: 20, stamina: 50 };
  assert.equal(stepPractice(distant, idle, false, false, { guard: true }).stamina, 50);
  assert.ok(tick(distant, 10).stamina > 50);
});
test('roll has bounded invulnerability, costs once, cannot cancel an attack and cannot be spammed', () => {
  let rolling = stepPractice(ready(), { ...idle, x: 1 }, false, false, { dodge: true });
  assert.equal(rolling.phase, 'roll'); assert.equal(rolling.stamina, 70);
  const heading = rolling.fighter.heading;
  rolling = stepPractice(rolling, { ...idle, x: -1 }, false, false, { dodge: true });
  assert.equal(rolling.stamina, 70); assert.equal(rolling.fighter.heading, heading);
  for (const [age, safe] of [[DEFENCE.safeStart - 2, false], [DEFENCE.safeStart - 1, true], [DEFENCE.safeEnd - 1, true], [DEFENCE.safeEnd, false]] as const) {
    const sample = incoming({ ...ready(), phase: 'roll', age });
    const after = stepPractice(sample, idle, false, false);
    assert.equal(after.playerHealth, safe ? 100 : 80, `roll age ${age + 1}`);
  }
  assert.equal(stepPractice({ ...ready(), stamina: 29 }, idle, false, false, { dodge: true }).phase, 'ready');
  assert.equal(stepPractice({ ...ready(), phase: 'attack', age: 3 }, idle, false, false, { dodge: true }).phase, 'attack');
});
test('default roll retreats; arena boundary and target collision still constrain its travel', () => {
  const start = ready(), rolling = stepPractice(start, idle, false, false, { dodge: true });
  assert.ok(rolling.fighter.z > start.fighter.z);
  let edge = stepPractice({ ...ready(), fighter: { x: RADIUS - .01, z: 0, heading: 0, distance: 0 } }, { ...idle, x: 1 }, false, false, { dodge: true });
  edge = tick(edge, DEFENCE.roll);
  assert.ok(Math.hypot(edge.fighter.x, edge.fighter.z) <= RADIUS + 1e-8);
  let toward = stepPractice(start, { ...idle, z: -1 }, false, false, { dodge: true });
  toward = tick(toward, DEFENCE.roll - 1);
  assert.ok(Math.hypot(toward.fighter.x - TARGET.x, toward.fighter.z - TARGET.z) >= .85 - 1e-8);
});
test('defeat freezes combat and movement; a fresh rematch restores all resources', () => {
  const fallen = stepPractice(incoming({ ...ready(), playerHealth: 20 }), idle, false, false);
  assert.equal(fallen.phase, 'dead'); assert.equal(fallen.playerHealth, 0); assert.equal(canStrike(fallen), false); assert.equal(canDefend(fallen), false);
  const later = stepPractice(fallen, { ...idle, x: 1 }, true, true, { dodge: true, guard: true, parry: true });
  assert.deepEqual(later.fighter, fallen.fighter); assert.equal(later.health, fallen.health); assert.equal(later.playerHealth, 0);
  const reset = initialPractice(); assert.equal(reset.playerHealth, 100); assert.equal(reset.stamina, 100); assert.equal(reset.health, 100); assert.equal(reset.phase, 'sheathed');
});
test('defence state/order fuzz replays, stays immutable and keeps finite bounded resources', () => {
  let seed = 303; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const frames = Array.from({ length: 12000 }, () => ({ strike: random() < .04, defence: { guard: random() < .6, parry: random() < .08, dodge: random() < .03 }, input: { ...idle, x: random() * 2 - 1, z: random() * 2 - 1 } }));
  const run = () => frames.reduce((state, frame, i) => {
    if (i % 300 === 0) state = ready();
    const before = structuredClone(state); Object.freeze(state); Object.freeze(state.fighter);
    const next = stepPractice(state, frame.input, frame.strike, true, frame.defence);
    assert.deepEqual(state, before);
    for (const value of [next.health, next.playerHealth, next.stamina]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
    assert.ok(Math.hypot(next.fighter.x, next.fighter.z) <= RADIUS + 1e-8);
    return next;
  }, ready());
  assert.deepEqual(run(), run());
});
