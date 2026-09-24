import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseChargedAttack, chooseGuardCounter, chooseTacticalAttack, fightSeeds } from '../scripts/lib/player-bot-policy.mjs';

const observation = (rest = {}) => ({ tick: 100, hp: 150, enemyHp: 190, stamina: 100, gap: 2, phase: 'ready', enemyPhase: 'attack', heavy: true, events: [], ...rest });

test('test player holds guard, then changes side only after its reaction delay', () => {
  const state = { tell: null, counterUntil: 0 };
  assert.deepEqual(chooseGuardCounter(observation({ events: [{ tick: 100, type: 'AttackStarted', actor: 1, direction: 'right' }] }), state, 12), { keys: ['KeyW', 'KeyQ'], press: null });
  assert.deepEqual(chooseGuardCounter(observation({ tick: 111 }), state, 12).keys, ['KeyW', 'KeyQ']);
  assert.deepEqual(chooseGuardCounter(observation({ tick: 112 }), state, 12).keys, ['KeyW', 'KeyQ', 'ArrowLeft']);
});

test('a confirmed block triggers a legal heavy counter and releases guard', () => {
  const state = { tell: null, counterUntil: 0 };
  const blocked = observation({ events: [{ tick: 100, type: 'Blocked', actor: 0 }] });
  assert.notEqual(chooseGuardCounter(blocked, state, 12).press, 'KeyG');
  assert.deepEqual(chooseGuardCounter(observation({ tick: 112 }), state, 12), { keys: [], press: 'KeyG' });
  assert.equal(state.counterUntil, 0);
  assert.equal(chooseGuardCounter(observation({ tick: 113, phase: 'attack' }), state, 12).press, null);
});

test('a heavy tell earns a delayed roll once, with movement held at the press', () => {
  const state = { tell: null, counterUntil: 0 };
  const tell = { tick: 100, type: 'AttackStarted', actor: 1, direction: 'overhead', move: 'heavy_overhead' };
  assert.equal(chooseGuardCounter(observation({ events: [tell] }), state, 12).press, null);
  assert.deepEqual(chooseGuardCounter(observation({ tick: 112 }), state, 12), { keys: ['KeyS'], press: 'KeyE' });
  assert.equal(chooseGuardCounter(observation({ tick: 113 }), state, 12).press, null);
});

test('a missed overhead may be punished once from reach', () => {
  const state = { tell: null, counterUntil: 0 };
  const missed = { tick: 100, type: 'AttackMissed', actor: 1, move: 'heavy_overhead' };
  assert.notEqual(chooseGuardCounter(observation({ events: [missed], enemyPhase: 'other' }), state, 12).press, 'KeyT');
  assert.deepEqual(chooseGuardCounter(observation({ tick: 112, gap: 1.8, enemyPhase: 'other' }), state, 12), { keys: ['KeyW'], press: 'KeyT' });
  assert.notEqual(chooseGuardCounter(observation({ tick: 113 }), state, 12).press, 'KeyT');
});

test('a distant miss is chased without throwing an out-of-range stab', () => {
  const state = {};
  chooseGuardCounter(observation({ events: [{ tick: 100, type: 'AttackMissed', actor: 1 }] }), state, 12);
  assert.deepEqual(chooseGuardCounter(observation({ tick: 112, gap: 3.1 }), state, 12), { keys: ['KeyW'], press: null });
  assert.deepEqual(chooseGuardCounter(observation({ tick: 120, gap: 1.8 }), state, 12), { keys: ['KeyW'], press: 'KeyT' });
});

test('near the wall the player advances or attacks instead of retreating', () => {
  const wall = { wallRadius: 7.15 };
  assert.deepEqual(chooseGuardCounter(observation({ radius: 7.5, stamina: 30, gap: 1 }), {}, 12, wall), { keys: [], press: null });
  assert.deepEqual(chooseGuardCounter(observation({ radius: 7.5, gap: 1 }), {}, 12, wall), { keys: [], press: 'KeyG' });
  const state = {};
  chooseGuardCounter(observation({ radius: 7.5, events: [{ tick: 100, type: 'AttackStarted', actor: 1, move: 'heavy_overhead' }] }), state, 12, wall);
  assert.deepEqual(chooseGuardCounter(observation({ radius: 7.5, tick: 112 }), state, 12, wall), { keys: ['KeyW'], press: 'KeyE' });
});

test('the player retreats when exhausted and sends no input after death', () => {
  const state = { tell: null, counterUntil: 0 };
  assert.deepEqual(chooseGuardCounter(observation({ stamina: 30 }), state, 12), { keys: [], press: null });
  assert.deepEqual(chooseGuardCounter(observation({ stamina: 30, gap: 1 }), state, 12), { keys: ['KeyS'], press: null });
  assert.deepEqual(chooseGuardCounter(observation({ hp: 0 }), state, 12), { keys: [], press: null });
});

const charged = { range: 2.1, defense: 'dodge', windup: { heavy_overhead: 32 }, parryTicks: 12 };
test('charged policy holds Heavy until the charged event, then releases it', () => {
  const state = {};
  assert.deepEqual(chooseChargedAttack(observation({ gap: 1.8, enemyPhase: 'ready' }), state, 12, charged), { keys: ['KeyG'], press: null });
  assert.deepEqual(chooseChargedAttack(observation({ tick: 102, phase: 'attack' }), state, 12, charged).keys, ['KeyG']);
  assert.deepEqual(chooseChargedAttack(observation({ tick: 140, phase: 'attack', events: [{ tick: 140, type: 'Charged', actor: 0 }] }), state, 12, charged).keys, []);
});

test('charged policy waits before rolling an overhead and parrying a readable tell', () => {
  const tell = { tick: 100, type: 'AttackStarted', actor: 1, move: 'heavy_overhead', direction: 'overhead' };
  const roll = {}, parry = {};
  chooseChargedAttack(observation({ gap: 3, events: [tell] }), roll, 12, charged);
  assert.equal(chooseChargedAttack(observation({ tick: 111, gap: 3 }), roll, 12, charged).press, null);
  assert.deepEqual(chooseChargedAttack(observation({ tick: 112, gap: 3 }), roll, 12, charged), { keys: ['KeyS'], press: 'KeyE' });
  const parryConfig = { ...charged, defense: 'parry' };
  chooseChargedAttack(observation({ gap: 3, events: [tell] }), parry, 12, parryConfig);
  assert.deepEqual(chooseChargedAttack(observation({ tick: 122, gap: 3 }), parry, 12, parryConfig), { keys: ['KeyQ', 'ArrowUp'], press: null });
});

test('charged policy moves inward rather than retreating at the wall', () => {
  const state = {};
  const config = { ...charged, wallRadius: 7.15 };
  chooseChargedAttack(observation({ radius: 7.5, events: [{ tick: 100, type: 'AttackStarted', actor: 1, move: 'heavy_overhead' }] }), state, 12, config);
  assert.deepEqual(chooseChargedAttack(observation({ radius: 7.5, tick: 112 }), state, 12, config), { keys: ['KeyW'], press: 'KeyE' });
  assert.deepEqual(chooseChargedAttack(observation({ radius: 7.5, stamina: 20, gap: 1.8, enemyPhase: 'ready' }), {}, 12, config), { keys: ['KeyW'], press: null });
});

test('tactical player waits for a real missed swing then chooses a reachable quick punish', () => {
  const state = {}, config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  const miss = { tick: 100, type: 'AttackMissed', actor: 1, move: 'heavy_overhead' };
  assert.equal(chooseTacticalAttack(observation({ events: [miss], gap: 1.4, enemyPhase: 'other', light: true }), state, 12, config).reason, 'wait for missed-swing punish');
  assert.deepEqual(chooseTacticalAttack(observation({ tick: 112, gap: 1.4, enemyPhase: 'other', light: true }), state, 12, config).press, 'KeyF');
  const distant = {};
  chooseTacticalAttack(observation({ events: [miss], gap: 1.8, enemyPhase: 'other', thrust: true }), distant, 12, config);
  assert.equal(chooseTacticalAttack(observation({ tick: 112, gap: 1.8, enemyPhase: 'other', thrust: true }), distant, 12, config).press, 'KeyT');
});

test('tactical player answers a confirmed block with a quick counter before heavy is earned', () => {
  const state = {}, config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  chooseTacticalAttack(observation({ events: [{ tick: 100, type: 'Blocked', actor: 0 }], gap: 1.5, light: true }), state, 12, config);
  const action = chooseTacticalAttack(observation({ tick: 112, gap: 1.5, light: true }), state, 12, config);
  assert.equal(action.press, 'KeyF');
  assert.equal(action.reason, 'slash after defence');
});

test('tactical heavy counter requires four actual quick attack starts', () => {
  const state = {}, config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  const quicks = [0, 1, 2, 3].map(i => ({ tick: 100 + i, type: 'AttackStarted', actor: 0, move: 'thrust' }));
  chooseTacticalAttack(observation({ tick: 200, events: [...quicks, { tick: 200, type: 'Blocked', actor: 0 }], gap: 1.5 }), state, 12, config);
  const counter = chooseTacticalAttack(observation({ tick: 212, gap: 1.5 }), state, 12, config);
  assert.equal(counter.press, 'KeyG');
  assert.notEqual(chooseTacticalAttack(observation({ tick: 212, gap: 1.5 }), state, 12, config).press, 'KeyG');
});

test('tactical policy guards a tell after its reaction delay', () => {
  const state = {}, config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  const tell = { tick: 100, type: 'AttackStarted', actor: 1, move: 'heavy_overhead', direction: 'overhead' };
  chooseTacticalAttack(observation({ tick: 100, events: [tell], gap: 3 }), state, 12, config);
  assert.equal(chooseTacticalAttack(observation({ tick: 111, gap: 3 }), state, 12, config).press, null);
  assert.deepEqual(chooseTacticalAttack(observation({ tick: 112, gap: 3 }), state, 12, config).keys, ['KeyQ', 'ArrowUp']);
});

test('tactical policy rolls sideways once after an observed charged overhead', () => {
  const state = {}, config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  const charge = { tick: 100, type: 'Charged', actor: 1, move: 'heavy_overhead' };
  chooseTacticalAttack(observation({ tick: 100, events: [charge], gap: 1.2, stamina: 40 }), state, 12, config);
  const roll = chooseTacticalAttack(observation({ tick: 112, gap: 1.2, stamina: 40 }), state, 12, config);
  assert.deepEqual({ keys: roll.keys, press: roll.press }, { keys: ['KeyA'], press: 'KeyE' });
  assert.notEqual(chooseTacticalAttack(observation({ tick: 113, gap: 1.2, stamina: 40 }), state, 12, config).press, 'KeyE');
});

test('tactical player does not repeat quick attacks into a ready opponent at low stamina', () => {
  const config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  assert.equal(chooseTacticalAttack(observation({ gap: 1.4, stamina: 42, enemyPhase: 'ready', light: true }), {}, 12, config).press, null);
  assert.equal(chooseTacticalAttack(observation({ gap: 1.8, stamina: 42, enemyPhase: 'ready', thrust: true }), {}, 12, config).press, null);
  assert.equal(chooseTacticalAttack(observation({ gap: 1.4, stamina: 34, enemyPhase: 'ready', light: true }), {}, 12, config).press, null);
});

test('limited: a charge is read from the charge sound (not on our own hold) or from the hold time, never a hidden fact', () => {
  const config = { wallRadius: 99, thrustRange: 1.8, windup: { heavy_overhead: 40 } };
  const base = { hp: 100, enemyHp: 100, phase: 'ready', ownState: 'ready', enemyPhase: 'attack', stamina: 80, gap: 1.5, radius: 1, heavy: true, light: true, thrust: true };
  const swing = { tick: 100, type: 'AttackStarted', actor: 1, move: 'heavy_overhead', direction: 'overhead' };
  // Our own hold: the cue is ours, so no roll.
  const holding = { ...base, phase: 'attack', ownState: 'attack' };
  let state = { charging: true };
  chooseTacticalAttack({ ...holding, tick: 101, events: [swing] }, state, 11, config);
  chooseTacticalAttack({ ...holding, tick: 110, events: [{ tick: 110, type: 'ChargeCue' }] }, state, 11, config);
  assert.equal(state.chargedThreat, undefined);
  assert.equal(state.charged, true, 'the cue on our own hold is our own charge');
  // Not holding: the cue during a seen heavy windup is his charge; the roll names the sound.
  state = {};
  chooseTacticalAttack({ ...base, tick: 101, events: [swing] }, state, 11, config);
  chooseTacticalAttack({ ...base, tick: 110, events: [{ tick: 110, type: 'ChargeCue' }] }, state, 11, config);
  assert.match(chooseTacticalAttack({ ...base, tick: 121, events: [] }, state, 11, config).reason, /charged overhead \(sound\)/);
  // No sound at all: a heavy still winding up past its plain windup + margin reads as held.
  state = {};
  chooseTacticalAttack({ ...base, tick: 101, events: [swing] }, state, 11, config);
  assert.doesNotMatch(chooseTacticalAttack({ ...base, tick: 140, events: [] }, state, 11, config).reason, /charged/);
  assert.match(chooseTacticalAttack({ ...base, tick: 148, events: [] }, state, 11, config).reason, /charged overhead \(hold time\)/);
});

test('fight seeds start at the given seed and never step the AI\'s own lcg', () => {
  const lcg = s => (Math.imul(s, 1664525) + 1013904223) >>> 0, seeds = fightSeeds(731, 6);
  assert.equal(seeds[0], 731);
  assert.equal(new Set(seeds).size, 6);
  for (const a of seeds) for (const b of seeds) assert.notEqual(lcg(a), b);
  assert.deepEqual(fightSeeds(731, 3), seeds.slice(0, 3));
});

test('worn down (posture high, stamina low), the tactical bot rolls out of a seen swing and walks out between swings', () => {
  const config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  const swing = { tick: 100, type: 'AttackStarted', actor: 1, move: 'light_right', direction: 'right' };
  const state = {};
  chooseTacticalAttack(observation({ events: [swing], gap: 1.2, stamina: 40, posture: 70, radius: 3 }), state, 12, config);
  const out = chooseTacticalAttack(observation({ tick: 112, gap: 1.2, stamina: 40, posture: 70, radius: 3 }), state, 12, config);
  assert.deepEqual([out.keys, out.press, out.reason], [['KeyS'], 'KeyE', 'roll out: posture high, stamina low']);
  const wall = chooseTacticalAttack(observation({ tick: 112, gap: 1.2, stamina: 40, posture: 70, radius: 7.5 }), { tell: swing }, 12, config);
  assert.deepEqual(wall.keys, ['KeyA']);
  const between = chooseTacticalAttack(observation({ gap: 1.4, stamina: 40, posture: 70, radius: 3, enemyPhase: 'ready' }), {}, 12, config);
  assert.deepEqual([between.keys, between.press], [['KeyS'], null]);
  const fresh = chooseTacticalAttack(observation({ tick: 112, gap: 1.2, stamina: 40, posture: 20, radius: 3 }), { tell: swing }, 12, config);
  assert.equal(fresh.reason, 'guard the observed attack');
});

test('the tactical bot does not block a heavy its stamina cannot pay for', () => {
  const config = { ...charged, thrustRange: 1.9, wallRadius: 7.15 };
  const heavy = { tick: 100, type: 'AttackStarted', actor: 1, move: 'heavy_overhead', direction: 'overhead' };
  const roll = chooseTacticalAttack(observation({ tick: 112, gap: 1.4, stamina: 40, posture: 0, radius: 3 }), { tell: heavy }, 12, config);
  assert.deepEqual([roll.keys, roll.press], [['KeyS'], 'KeyE']);
  const walk = chooseTacticalAttack(observation({ tick: 112, gap: 1.4, stamina: 20, posture: 0, radius: 3 }), { tell: heavy }, 12, config);
  assert.deepEqual([walk.keys, walk.press], [['KeyS'], null]);
  const block = chooseTacticalAttack(observation({ tick: 112, gap: 1.4, stamina: 80, posture: 0, radius: 3 }), { tell: heavy }, 12, config);
  assert.equal(block.reason, 'guard the observed attack');
});
