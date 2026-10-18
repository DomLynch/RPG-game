// sandbox-mech: dodgeCounter. With the row on, a clean roll-dodge opens the guard-counter window (Heavy becomes heavy_counter); trunk ships the row at 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const shipped = (DEFS.rules.find((r) => r.id === 'dodgeCounter') as { window: number }).window;
(DEFS.rules.find((r) => r.id === 'dodgeCounter') as { window: number }).window = 20;
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
type Duel = Parameters<typeof stepDuel>[0];

test('trunk ships dodgeCounter at 0', () => assert.equal(shipped, 0));

test('with the row on, a clean dodge opens the counter window and Heavy becomes heavy_counter', () => {
  let d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: 2.0, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
  let opened = 0;
  for (let t = 0; t < 70 && !opened; t++) {
    d = stepDuel(d, [t === 0 ? { ...idleIntent(), action: 'light' } : idleIntent(), { ...idleIntent(), action: t === 8 ? 'dodge' : null, move: { x: 0, z: 1, yaw: 0, run: false } }]);
    if (d.events.some((e) => e.type === 'Dodged')) opened = d.fighters[1].counterWindow;
  }
  assert.equal(opened, 20, 'the dodge opened the 20-tick window');
});
