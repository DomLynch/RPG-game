import assert from 'node:assert/strict';
import test from 'node:test';
import { limitedObservation, perceivable } from '../scripts/lib/player-bot-observation.mjs';

test('limited observations delay the HUD threat and events but stop immediately on death', () => {
  const memory = {};
  const first = limitedObservation({ tick: 100, gap: 2.26, radius: 3.1, threat: false, events: [], hp: 50, stamina: 80, meterStamina: 79 }, memory, 12);
  assert.equal(first.gap, 2.5);
  assert.equal(first.enemyPhase, 'other');
  assert.equal(first.stamina, 79, 'stamina comes from the meter, not the debug line');
  const tell = limitedObservation({ tick: 108, gap: 1.1, radius: 4, threat: true, events: [{ tick: 108, type: 'AttackStarted', actor: 1, move: 'heavy_overhead' }], hp: 40 }, memory, 12);
  assert.equal(tell.gap, 2.5);
  assert.equal(tell.enemyPhase, 'other', 'the threat is not seen before the reaction time');
  assert.deepEqual(tell.events, []);
  const later = limitedObservation({ tick: 120, gap: 0.8, radius: 4, threat: true, events: [], hp: 0 }, memory, 12);
  assert.equal(later.gap, 1);
  assert.equal(later.hp, 0);
  assert.equal(later.enemyPhase, 'attack');
  assert.deepEqual(later.events.map(e => e.type), ['AttackStarted']);
});

test('only perceivable events and fields reach the bot', () => {
  const seen = perceivable([
    { tick: 1, type: 'Charging', actor: 1, move: 'heavy_overhead' },
    { tick: 2, type: 'Charged', actor: 1, move: 'heavy_overhead' },
    { tick: 3, type: 'AttackActive', actor: 1, move: 'heavy_overhead' },
    { tick: 4, type: 'Hit', actor: 1, target: 0, move: 'heavy_overhead', damage: 30, charged: true, location: 'torso' },
    { tick: 5, type: 'ActionStarted', actor: 1, action: 'feint' },
    { tick: 6, type: 'ActionStarted', actor: 0, action: 'roll' },
    { tick: 7, type: 'StaminaExhausted', actor: 1 },
  ]);
  assert.deepEqual(seen, [
    { tick: 2, type: 'Charged', actor: 1, move: 'heavy_overhead' },
    { tick: 4, type: 'Hit', actor: 1, target: 0, move: 'heavy_overhead' },
    { tick: 6, type: 'ActionStarted', actor: 0, action: 'roll' },
  ]);
});
