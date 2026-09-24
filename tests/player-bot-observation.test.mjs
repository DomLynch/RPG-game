import assert from 'node:assert/strict';
import test from 'node:test';
import { limitedObservation } from '../scripts/lib/player-bot-observation.mjs';

test('limited observations delay enemy state and events but stop immediately on death', () => {
  const memory = {};
  const first = limitedObservation({ tick: 100, gap: 2.26, radius: 3.1, enemyPhase: 'ready', events: [] , hp: 50 }, memory, 12);
  assert.equal(first.gap, 2.5);
  assert.equal(first.enemyPhase, 'other');
  const tell = limitedObservation({ tick: 108, gap: 1.1, radius: 4, enemyPhase: 'attack', events: [{ tick: 108, type: 'AttackStarted', actor: 1 }], hp: 40 }, memory, 12);
  assert.equal(tell.gap, 2.5);
  assert.deepEqual(tell.events, []);
  const later = limitedObservation({ tick: 120, gap: 0.8, radius: 4, enemyPhase: 'attack', events: [], hp: 0 }, memory, 12);
  assert.equal(later.gap, 1);
  assert.equal(later.hp, 0);
  assert.deepEqual(later.events.map(e => e.type), ['AttackStarted']);
});
