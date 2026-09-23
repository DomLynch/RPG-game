import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseGuardCounter } from '../scripts/lib/player-bot-policy.mjs';

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
  assert.deepEqual(chooseGuardCounter(observation({ tick: 112, enemyPhase: 'other' }), state, 12), { keys: ['KeyW'], press: 'KeyT' });
  assert.notEqual(chooseGuardCounter(observation({ tick: 113 }), state, 12).press, 'KeyT');
});

test('the player retreats when exhausted and sends no input after death', () => {
  const state = { tell: null, counterUntil: 0 };
  assert.deepEqual(chooseGuardCounter(observation({ stamina: 30 }), state, 12), { keys: [], press: null });
  assert.deepEqual(chooseGuardCounter(observation({ stamina: 30, gap: 1 }), state, 12), { keys: ['KeyS'], press: null });
  assert.deepEqual(chooseGuardCounter(observation({ hp: 0 }), state, 12), { keys: [], press: null });
});
