import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitFxFrom } from '../src/look-flag.ts';
import { EDGE, RIM, RIM_FRAMES, heavyHit, rimFlash } from '../src/hit-look.ts';
import type { CombatEvent } from '../src/duel.ts';

test('no hitfx flag builds nothing; the three tokens pick edge, rim or both', () => {
  for (const search of ['', '?look=', '?look=souls', '?look=hitfxx', '?opponent=knight']) assert.equal(hitFxFrom(search), undefined, search);
  assert.deepEqual(hitFxFrom('?look=hitfx'), { edge: true, rim: true });
  assert.deepEqual(hitFxFrom('?look=hitfx-edge'), { edge: true, rim: false });
  assert.deepEqual(hitFxFrom('?look=souls,hitfx-rim'), { edge: false, rim: true });
});

test('the edge is the mirror of the side the blow came from', () => {
  assert.deepEqual(EDGE, { right: 'left', left: 'right', overhead: 'top', thrust: 'bottom', low: 'bottom' });
});

test('only heavy-class or charged hits flash', () => {
  const hit = (e: Partial<CombatEvent>) => ({ tick: 1, type: 'Hit', actor: 1, target: 0, ...e }) as CombatEvent;
  assert.equal(heavyHit(hit({ move: 'light_right' })), false);
  assert.equal(heavyHit(hit({ move: 'heavy_overhead' })), true);
  assert.equal(heavyHit(hit({ move: 'light_left', charged: true })), true);
  assert.equal(heavyHit(hit({ move: 'heavy_overhead', type: 'Blocked' })), false);
});

// Stand-in materials and anchors: the flash touches only emissive + emissiveIntensity, so a plain object with those is enough.
const material = (hex: number, intensity: number) => { const m = { hex, emissiveIntensity: intensity, emissive: { getHex: () => m.hex, setHex: (h: number) => { m.hex = h; } } }; return m; };
const anchor = (...ms: unknown[]) => ({ traverse: (fn: (o: unknown) => void) => { fn({}); for (const m of ms) fn({ material: m }); fn({ material: [ms[0]] }); } });

test('the rim flash lights for RIM_FRAMES frames, then restores every material exactly, even when a second heavy lands inside it on a shared material', () => {
  const a = material(0x112233, 0.4), b = material(0, 1), shared = material(0x0a0b0c, 0.25), basic = { color: 1 };
  const rim = rimFlash(), before = JSON.stringify([a, b, shared, basic]);
  rim.fire(anchor(a, shared, basic) as never);
  assert.equal(a.hex, RIM); assert.equal(shared.hex, RIM);
  rim.frame();   // the next frame: still lit
  rim.fire(anchor(b, shared) as never);   // a heavy on the other fighter, sharing a material, inside the flash
  for (let i = 0; i < RIM_FRAMES - 1; i++) { rim.frame(); assert.equal(b.hex, RIM); }
  rim.frame();
  assert.equal(rim.lit, false);
  assert.equal(JSON.stringify([a, b, shared, basic]), before);
});
