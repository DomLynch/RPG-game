import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice, SWORD, ATTACKS, DEFENCE, canDefend, canStrike, type Practice } from '../src/combat.ts';
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

test('range and facing cause real misses beyond the step-in; lock turns during wind-up', () => {
  for (const state of [ready(SWORD.reach + 1), ready(1.2, 0)]) {
    const result = tick(stepPractice(state, idle, true, false), SWORD.contact);
    assert.equal(result.health, 100); assert.equal(result.result, 'miss');
  }
  let turning = stepPractice(ready(1.2, 0), idle, true, true);
  for (let i = 0; i < SWORD.contact; i++) turning = stepPractice(turning, idle, false, true);
  assert.equal(turning.health, 75);
  assert.equal(tick(stepPractice(ready(SWORD.reach), idle, true, false), SWORD.contact).health, 75);
});

test('four confirmed hits defeat the warden; later inputs cannot deal extra damage', () => {
  let state = ready();
  for (let i = 0; i < 4; i++) {
    // Keep each damage sample in range; the live warden now recoils and retreats.
    state = { ...state, fighter: { ...state.fighter, x: state.enemy.x, z: state.enemy.z + 1.2, heading: Math.PI } };
    state = tick(stepPractice(state, idle, true, false), SWORD.recovery);
  }
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
    const before = structuredClone(state); Object.freeze(state); Object.freeze(state.fighter); Object.freeze(state.enemy);
    const next = stepPractice(state, frame.input, frame.strike, true, frame.defence);
    assert.deepEqual(state, before);
    for (const value of [next.health, next.playerHealth, next.stamina]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
    assert.ok(Math.hypot(next.fighter.x, next.fighter.z) <= RADIUS + 1e-8);
    return next;
  }, ready());
  assert.deepEqual(run(), run());
});


test('two light attacks chain once, then reset; step-in is bounded and heavy has a real cost', () => {
  let first = stepPractice(ready(2), idle, true, true);
  const start = first.fighter.z; first = tick(first, SWORD.recovery);
  assert.ok(first.fighter.z < start && first.fighter.z >= start - .31);
  assert.ok(first.chain > 0);
  let second = stepPractice(first, idle, true, true); assert.equal(second.attack, 'return');
  second = tick(second, ATTACKS.return.recovery);
  assert.equal(second.chain, 0); assert.equal(stepPractice(second, idle, true, true).attack, 'light');
  const heavy = stepPractice(ready(), idle, false, true, { heavy: true });
  assert.equal(heavy.attack, 'heavy'); assert.equal(heavy.stamina, 65);
  assert.equal(tick(heavy, ATTACKS.heavy.contact - 1).health, 100);
  assert.equal(tick(heavy, ATTACKS.heavy.contact).health, 62);
  assert.equal(stepPractice({...ready(), stamina: 34}, idle, false, true, {heavy:true}).phase, 'ready');
});
test('parry opens one stronger riposte and attack turning cannot snap 180 degrees', () => {
  const parried = stepPractice(incoming(), idle, false, true, {parry:true,guard:true});
  const released = stepPractice({...parried,age:DEFENCE.parry},idle,false,true);
  const counter = stepPractice(released,idle,true,true);
  assert.equal(counter.attack,'riposte'); assert.equal(tick(counter,ATTACKS.riposte.contact).health,60);
  const turning = stepPractice(ready(1.2,0),idle,true,true);
  assert.ok(Math.abs(turning.fighter.heading) <= .56);
});


test('warden closes distance, circles, retreats and varies waits without reading hidden input', () => {
  let s = {...initialPractice(), phase:'ready' as const} as Practice;
  const waits = new Set<number>(), modes = new Set<string>(); let strikes = 0;
  for (let i = 0; i < 2400; i++) {
    const before = s; s = stepPractice(s,idle,false,true);
    // Keep this observation fight alive without affecting opponent choices.
    s = {...s,playerHealth:100,phase:s.phase === 'dead' ? 'ready' : s.phase};
    waits.add(s.enemyWait); modes.add(s.enemyMode);
    if (s.playerHealth < before.playerHealth || s.result === 'hurt') strikes++;
  }
  assert.ok(s.enemy.distance > 4); assert.ok(waits.size > 3); assert.ok(modes.has('circle') && modes.has('guard'));
  assert.ok(strikes > 0);
  const passive = tick(initialPractice(),600); assert.deepEqual(passive.enemy,initialPractice().enemy);
});
test('warden never idles out of reach: a stationary fighter is attacked at least every eight seconds', () => {
  // Regression: retreat left the warden at 1.8–2.2 m, beyond its 1.8 m strike range yet below its 2.2 m approach trigger, for 20+ seconds.
  let s = {...initialPractice(), phase:'ready' as const} as Practice, last = 0, longest = 0;
  for (let i = 1; i <= 3600; i++) {
    const before = s; s = stepPractice(s,idle,false,true,{guard:true});
    s = {...s,playerHealth:100,stamina:100,phase:s.phase === 'dead' || s.phase === 'hurt' ? 'ready' : s.phase};
    if (s.enemyAttacking && !before.enemyAttacking) { longest = Math.max(longest,i - last); last = i; }
  }
  longest = Math.max(longest,3600 - last);
  assert.ok(longest <= 480, `warden idled ${longest} ticks`);
});
test('visible directional warden guard blocks light, heavy breaks it, and recovery cannot block', () => {
  const guarded: Practice = {...ready(), enemyMode:'guard', enemyGuardAge:20,decision:100};
  const light = tick(stepPractice(guarded,idle,true,true),SWORD.contact);
  assert.equal(light.health,100); assert.equal(light.result,'enemyBlocked'); assert.equal(light.enemyStamina,80);
  const heavy = tick(stepPractice(guarded,idle,false,true,{heavy:true}),ATTACKS.heavy.contact);
  assert.equal(heavy.health,62); assert.equal(heavy.result,'enemyBroken'); assert.equal(heavy.enemyStamina,0);
  const recovering = tick(stepPractice({...guarded,reaction:50},idle,true,true),SWORD.contact);
  assert.equal(recovering.health,75);
  const startup = stepPractice({...guarded,enemyGuardAge:0,phase:'attack',age:SWORD.contact-1},idle,false,true);
  assert.equal(startup.health,75);
});
test('moving target collision, heavy attacks and all resources remain bounded in deterministic replays', () => {
  const run = () => {
    let seed=444,s=initialPractice();
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
    for(let i=0;i<16000;i++) {
      if(!s.health||!s.playerHealth)s={...initialPractice(),phase:'ready',seed};
      const before=structuredClone(s);Object.freeze(s.fighter);Object.freeze(s.enemy);Object.freeze(s);
      const next=stepPractice(s,{...idle,x:random()*2-1,z:random()*2-1},random()<.1,true,{heavy:random()<.06,dodge:random()<.04,guard:random()<.2,parry:random()<.03});
      assert.deepEqual(s,before);
      for(const actor of [next.enemy,next.fighter])assert.ok(Math.hypot(actor.x,actor.z)<=RADIUS+1e-8);
      assert.ok(Math.hypot(next.enemy.x-next.fighter.x,next.enemy.z-next.fighter.z)>=.85-1e-8);
      for(const value of [next.health,next.playerHealth,next.stamina,next.enemyStamina])assert.ok(Number.isFinite(value)&&value>=0&&value<=100);
      s=next;
    }
    return s;
  };
  assert.deepEqual(run(),run());
});
