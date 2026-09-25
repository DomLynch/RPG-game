import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { SIGNATURES } from '../src/signature.ts';
import { rivetBurstA } from '../src/signature-knight.ts';

const fighters = [{}, {}] as unknown as readonly [Fighter, Fighter];
const hit = (target: 0 | 1, move: string, damage: number): CombatEvent => ({ tick: 1, type: 'Hit', actor: target ? 0 : 1, target, move: move as CombatEvent['move'], damage, location: 'torso', heading: 0 });

test('the Rivet Burst answers a substantial blow landed on the Knight, and nothing lighter, his own blows or a miss', () => {
  const burst = SIGNATURES.knight?.find((e) => e.variant === 'B');
  assert.equal(burst?.name, 'Rivet Burst (dark dent)');
  const when = (e: CombatEvent) => burst!.when(e, fighters);
  assert.equal(when(hit(1, 'heavy_overhead', 18)), true, 'a heavy on him');
  assert.equal(when(hit(1, 'light_right', 16)), true, 'a cut past the light cut 14');
  assert.equal(when(hit(1, 'light_right', 14)), false, 'a light cut');
  assert.equal(when(hit(1, 'thrust', 11)), false, 'a light stab');
  assert.equal(when(hit(1, 'kick', 30)), false, 'a kick is not a blade');
  assert.equal(when(hit(0, 'heavy_overhead', 18)), false, 'his own heavy on the player');
  assert.equal(when({ tick: 1, type: 'AttackMissed', actor: 0, move: 'heavy_overhead' }), false, 'a miss');
  assert.equal(when({ tick: 1, type: 'Blocked', actor: 1, target: 0, move: 'heavy_overhead' }), false, 'a blocked heavy');
});

test('B (dark dent) is the Knight\'s shipped signature: On resolves to it; A is built but unregistered, on the same trigger', async () => {
  const { pickSignature } = await import('../src/signature.ts');
  assert.deepEqual(SIGNATURES.knight?.map((e) => e.variant), ['B']);
  assert.equal(pickSignature(SIGNATURES.knight, 'on')?.name, 'Rivet Burst (dark dent)');
  assert.equal(pickSignature(SIGNATURES.knight, 'A'), null);
  assert.equal(rivetBurstA.when(hit(1, 'heavy_overhead', 18), fighters), true);
  assert.equal(rivetBurstA.when(hit(1, 'light_right', 14), fighters), false);
});

test('B\'s dent is a soft bruise, not a black disc or a spinner (Strategy ruling on live cc27cce5): .25 of the body, core alpha ≤ .8, no stroked rim or arc', () => {
  const stops: number[] = [], strokes: string[] = [];
  const gradient = { addColorStop: (_: number, color: string) => { stops.push(Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(color)?.[1])); } };
  const context = { createRadialGradient: () => gradient, fillRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, stroke: () => { strokes.push('stroke'); }, set fillStyle(_: unknown) {}, set strokeStyle(_: unknown) {}, set lineWidth(_: unknown) {} };
  const previous = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  try {
    const burst = SIGNATURES.knight!.find((e) => e.variant === 'B')!;
    const drawn: { width: number; height: number }[] = [];
    const frame = { roots: [null, {}], fighters: [{ weapon: 'longsword', body: { heading: 0 } }, { weapon: 'warhammer', body: { heading: 0 } }], scale: [1, 1], marks: { body: (_side: number, _root: unknown, _hit: unknown, options: { width: number; height: number }) => { drawn.push(options); return false; } } };
    burst.fire(hit(1, 'heavy_overhead', 18), frame as never);
    assert.equal(drawn.length, 1, 'the dent is drawn on the body');
    assert.equal(drawn[0].width, 0.25); assert.equal(drawn[0].height, 0.25);
    assert.ok(stops.length > 0 && Math.max(...stops) <= 0.8, `the darkest stop is at most .8 alpha (${stops})`);
    assert.equal(stops.at(-1), 0, 'the edge fades to nothing: no hard rim');
    assert.equal(strokes.length, 0, 'no stroked rim, wall or lit arc: nothing left to read as spinning under the per-hit tilt');
  } finally { (globalThis as { document?: unknown }).document = previous; }
});
