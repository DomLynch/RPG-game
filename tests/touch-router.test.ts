import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTERACTIVE_SELECTORS, getTouchOwner, isInteractiveHud, type TouchTarget } from '../src/touch-router.ts';

// A fake element: it matches the selectors it (or an ancestor) carries.
const el = (...selectors: string[]): TouchTarget => ({ closest: (s: string) => (selectors.includes(s) ? el(...selectors) : null) });
const canvas = el('canvas'), ctx = (over = {}) => ({ menuOpen: false, isMovementZone: (t: TouchTarget | null) => !!t?.closest('#joystick'), isCameraSurface: (t: TouchTarget | null) => t === canvas, ...over });

test('owners in priority order: menu, movement, HUD control, camera, ignored', () => {
  assert.equal(getTouchOwner(canvas, ctx({ menuOpen: true })), 'menu', 'an open layer takes every touch, the arena included');
  assert.equal(getTouchOwner(el('#joystick'), ctx()), 'movement');
  assert.equal(getTouchOwner(el('#actions'), ctx()), 'combatButton');
  assert.equal(getTouchOwner(el('.loot-panel'), ctx()), 'combatButton');
  assert.equal(getTouchOwner(canvas, ctx()), 'camera');
  assert.equal(getTouchOwner(el('p'), ctx()), 'ignored');
  assert.equal(getTouchOwner(null, ctx()), 'ignored');
});

test('every HUD control the page has counts as interactive, and a descendant counts through closest()', () => {
  for (const selector of INTERACTIVE_SELECTORS) assert.equal(isInteractiveHud(el(selector)), true, selector);
  assert.equal(isInteractiveHud(el('canvas')), false); assert.equal(isInteractiveHud(null), false);
});

test('a button touch is never the camera, an arena touch is: the owner is decided from where the finger lands', () => {
  assert.notEqual(getTouchOwner(el('#actions'), ctx()), 'camera'); assert.equal(getTouchOwner(canvas, ctx()), 'camera');
});

test('main.ts keeps the zoom guards and routes only the camera drag; input.ts is untouched by the router', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8') + readFileSync(new URL('../src/zoom-guard.ts', import.meta.url), 'utf8'), input = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
  for (const guard of ["'gesturestart'", 'event.touches.length > 1', 'DOUBLE_TAP_SURFACE']) assert.ok(main.includes(guard), `zoom guard kept: ${guard}`);
  assert.match(main, /if \(owner !== 'camera' \|\| orbitId !== null \|\| event\.button !== 0\) return;/, 'only an arena touch starts the orbit');
  assert.doesNotMatch(input, /touch-router|TouchOwner/, 'combat input timing and its handlers do not know the router');
});

test('the file header keeps the MIT notice and the @f46f30f provenance', () => {
  const head = readFileSync(new URL('../src/touch-router.ts', import.meta.url), 'utf8').slice(0, 1200);
  assert.match(head, /MIT/); assert.match(head, /f46f30f/); assert.match(head, /Levy Street/);
});
