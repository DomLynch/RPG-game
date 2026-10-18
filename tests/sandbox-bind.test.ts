// sandbox-mech: bind and disarm. A block with a bind-row weapon (trident, estoc) binds the attacker's blade: no swings, a kick breaks it; unbroken it becomes a disarm (kick and guard only) that runs down.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { bind: { weapon: string; window: number; hold: number; react: number }[] };
const shipped = d.bind.length;
d.bind.push({ weapon: 'trident', window: 45, hold: 300, react: 28 });
const { createFighter, stepDuel, idleIntent, legal } = await import('../src/fight/duel.ts');
const idle = () => ({ ...idleIntent(), lock: false });
type F = { bound?: number; disarmed?: number; phase: string };
type D = { fighters: F[] };
const start = () => ({ tick: 0, fighters: [createFighter({ x: 0, z: 1.4, heading: Math.PI, distance: 0 }, 'ready', 'longsword'), createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'guard', 'trident')], finish: null, events: [] }) as never as D;
const step = (duel: D, a: object = {}) => stepDuel(duel as never, [{ ...idle(), ...a }, { ...idle(), guard: true, guardDirection: 'left' }]) as never as D;
function untilBound() { let duel = start(); for (let i = 0; i < 80; i++) { duel = step(duel, i === 0 ? { action: 'light' } : {}); if (duel.fighters[0]!.bound) return { duel, at: i }; } return undefined; }

test('trunk ships no bind', () => assert.equal(shipped, 0));
test('a trident block binds the swinging blade: no swing is legal, a kick is', () => {
  const r = untilBound(); assert.ok(r, 'the attacker was bound');
  assert.equal(r.duel.fighters[0]!.bound! > 0, true);
  assert.equal(legal(r.duel.fighters[0] as never, 'light'), false);
  assert.equal(legal(r.duel.fighters[0] as never, 'heavy'), false);
});
test('a kick inside the window breaks the bind', () => {
  let { duel } = untilBound()!;   // the swing's own recovery runs first, so the kick is pressed every tick until it is legal
  for (let i = 0; i < 44 && duel.fighters[0]!.bound; i++) duel = step(duel, { action: 'kick' });
  assert.equal(duel.fighters[0]!.bound, undefined, 'broken');
  assert.equal(duel.fighters[0]!.disarmed, undefined, 'not disarmed');
});
test('an unbroken bind becomes a disarm for 300 ticks, then the hand is full again', () => {
  let { duel } = untilBound()!;
  for (let i = 0; i < 60; i++) duel = step(duel);
  assert.ok(duel.fighters[0]!.disarmed! > 200, `disarmed: ${duel.fighters[0]!.disarmed}`);
  assert.equal(legal(duel.fighters[0] as never, 'light'), false);
  for (let i = 0; i < 320; i++) duel = step(duel);
  assert.equal(duel.fighters[0]!.disarmed, undefined);
});
test('a weapon with no bind row binds nothing', () => {
  let duel = start(); duel.fighters[1] = createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'guard', 'longsword') as never;
  for (let i = 0; i < 80; i++) { duel = step(duel, i === 0 ? { action: 'light' } : {}); assert.equal(duel.fighters[0]!.bound, undefined); }
});
