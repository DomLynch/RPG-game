import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { budgetTextures, canvasResize, debugFlag, detectPhoneTier, DPR_CHOICES, DPR_OVERRIDE, exposeDebugView, FIGHTER_TEXTURE_CAP, phoneTier, pixelCap, rafCadence, resetPhoneTierForTests, urlDpr, withoutDpr } from '../src/quality.ts';

// The phone-tier graphics budget (the owner's live iPhone defect, 2026-09-18: fighters render black under
// GPU memory pressure). Detection: a mobile UA AND a coarse pointer, overridable both ways by ?gfx= for QA.
test('tier detection: mobile UA plus coarse pointer is a phone, either alone is not', () => {
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', maxTouchPoints: 5, coarse: true };
  assert.equal(detectPhoneTier(iphone), true, 'an iPhone is the tier this defect shipped on');
  assert.equal(detectPhoneTier({ ...iphone, coarse: false }), false, 'a fine pointer keeps full tier even with a mobile UA');
  assert.equal(detectPhoneTier({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', coarse: true }), false, 'a desktop UA with touch (kiosk, devtools) is not a phone');
  assert.equal(detectPhoneTier({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', coarse: true }), true, 'iPad reports itself');
  assert.equal(detectPhoneTier({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15', maxTouchPoints: 5, coarse: true }), true, 'iPadOS 13+ betrays its iPad via touch points on a Macintosh UA');
});

test('tier detection: ?gfx= overrides both ways and wins over every signal', () => {
  const iphone = { userAgent: 'iPhone', coarse: true, locationSearch: '?gfx=full' };
  assert.equal(detectPhoneTier(iphone), false, 'gfx=full forces the tier off on a real phone');
  assert.equal(detectPhoneTier({ userAgent: 'Macintosh', coarse: false, locationSearch: '?opponent=veteran&gfx=phone' }), true, 'gfx=phone forces the tier on for desktop QA');
  assert.equal(detectPhoneTier({ userAgent: 'iPhone', coarse: true, locationSearch: '?gfx=phone' }), true);
});

test('tier detection: a bare environment (node, tests) is full tier and never throws', () => {
  assert.equal(detectPhoneTier({}), false);
  assert.doesNotThrow(() => phoneTier());
  resetPhoneTierForTests();
});

// The budget policy: walk a loaded fighter, resize each unique texture over the cap exactly once, pre-render.
function fighterLike() {
  const big = new Texture(); big.image = { width: 2048, height: 2048 };
  const mid = new Texture(); mid.image = { width: 1024, height: 1024 };
  const small = new Texture(); small.image = { width: 512, height: 512 };
  const root = new Group();
  const a = new Mesh(undefined, new MeshStandardMaterial({ map: big, normalMap: mid }));
  const b = new Mesh(undefined, new MeshStandardMaterial({ map: big, roughnessMap: small }));   // shares `big` with a
  const c = new Mesh(undefined, [new MeshStandardMaterial({ normalMap: mid }), undefined as never]);      // mid shared; array materials
  root.add(a, b, c);
  return { root, big, mid, small };
}

test('budgetTextures resizes only the oversized unique textures, once each', () => {
  const { root, big, mid } = fighterLike();
  const calls: [Texture, number][] = [];
  const resize = (t: Texture, max: number) => { calls.push([t, max]); return Math.max((t.image as { width: number; height: number }).width, (t.image as { width: number; height: number }).height) > max; };
  const result = budgetTextures(root, FIGHTER_TEXTURE_CAP, resize);
  assert.deepEqual(result, { textures: 3, resized: 1 }, 'three unique textures, only the 2K one over the cap');
  assert.equal(calls.length, 3, 'every unique texture is consulted once — the resizer declines the at-cap ones');
  assert.equal(calls.filter(([t]) => t === big).length, 1, 'the shared 2K texture is consulted once, not per material');
  assert.ok(calls.every(([, max]) => max === FIGHTER_TEXTURE_CAP));
  assert.equal(mid.image && (mid.image as { width: number }).width, 1024, 'at-cap textures keep their pixels');
});

test('budgetTextures leaves a fighter with no oversized textures untouched', () => {
  const { root, big } = fighterLike();
  big.image = { width: 1024, height: 1024 };
  const resize = (t: Texture, max: number) => Math.max((t.image as { width: number; height: number }).width, (t.image as { width: number; height: number }).height) > max;
  assert.deepEqual(budgetTextures(root, FIGHTER_TEXTURE_CAP, resize), { textures: 3, resized: 0 });
});

test('canvasResize no-ops outside a browser and on at-cap textures', () => {
  const t = new Texture(); t.image = { width: 2048, height: 2048 };
  assert.equal(canvasResize(t, 1024), false, 'node has no document: the app-tier call is a no-op in tests');
  const atCap = new Texture(); atCap.image = { width: 1024, height: 1024 };
  assert.equal(canvasResize(atCap, 1024), false);
});

// ?dpr= (Strategy 2026-09-28, the instrument for Dom's iPhone A/B): only 1, 1.5, 2 and 3 are an override; the ceiling is the override, else
// the tier's; the address loses it after one read. The device's own ratio still caps it (scene.ts Math.min(devicePixelRatio, PIXEL_CAP)).
test('?dpr=: only 1, 1.5, 2 or 3 is an override; anything else, or none, is the default', () => {
  assert.deepEqual(DPR_CHOICES, [1, 1.5, 2, 3]);
  assert.equal(urlDpr('?dpr=2&perf=1'), 2);
  assert.equal(urlDpr('?perf=1&dpr=1.5'), 1.5);
  assert.equal(urlDpr('?dpr=1'), 1);
  assert.equal(urlDpr('?dpr=3'), 3);
  assert.equal(urlDpr('?dpr=1.50'), 1.5, 'the same number written longer');
  for (const bad of ['?dpr=', '?dpr=0', '?dpr=2.5', '?dpr=4', '?dpr=-2', '?dpr=2x', '?dpr=abc', '?dpr= ', '?DPR=2', '?perf=1', ''])
    assert.equal(urlDpr(bad), undefined, `${JSON.stringify(bad)} is no override`);
  assert.equal(DPR_OVERRIDE, undefined, 'the test process has no ?dpr= in its address');
});

test('?dpr=: the pixel-ratio ceiling is the override, else the tier cap (phone 1.25, desktop 1.5)', () => {
  assert.equal(pixelCap(true, undefined), 1.25);
  assert.equal(pixelCap(false, undefined), 1.5);
  assert.equal(pixelCap(true, 2), 2, 'the A/B: ?dpr=2 lifts a phone above its 1.25 cap');
  assert.equal(pixelCap(false, 1), 1, 'and can lower a desktop too');
  assert.equal(pixelCap(true), 1.25, 'the default argument is this load\'s override (none here)');
});

test('?dpr=: stripped from the address after one read, every other parameter kept, no bare "?"', () => {
  assert.equal(withoutDpr('?dpr=2&perf=1'), '?perf=1');
  assert.equal(withoutDpr('?opponent=goblin&dpr=1.5&debug=1'), '?opponent=goblin&debug=1');
  assert.equal(withoutDpr('?dpr=3'), '');
  assert.equal(withoutDpr('?perf=1'), '?perf=1');
  assert.equal(urlDpr(withoutDpr('?dpr=2&perf=1')), undefined, 'a reload boots the default');
});

// ?debug view hook (Lead 2026-09-28): the harnesses' read-only handle on the live view. Inert without the flag: no property at all.
test('?debug view getter: defined only when the page loaded with ?debug, reads the live value, adds nothing otherwise', () => {
  const target: Record<string, unknown> = {}; let view: unknown;
  assert.equal(exposeDebugView(() => view, '?opponent=goblin&perf=1', target), false, 'no flag: not defined');
  assert.equal(exposeDebugView(() => view, '?opponent=goblin&debugger=1', target), false, 'a different word is not the flag');
  assert.equal('__view' in target, false, 'inert: no property, not even undefined');
  assert.equal(debugFlag('?debug'), true); assert.equal(debugFlag('?a=1&debug=1'), true); assert.equal(debugFlag(''), false);
  assert.equal(exposeDebugView(() => view, '?debug&perf=1', target), true, 'with the flag: defined');
  view = { renderer: 'r' };
  assert.deepEqual(target.__view, { renderer: 'r' }, 'a getter on the live binding: a value assigned after the call is what reads');
  assert.equal(Object.keys(target).includes('__view'), false, 'not enumerable');
  assert.equal(Object.getOwnPropertyDescriptor(target, '__view')?.set, undefined, 'read-only');
});

// Low Power Mode (Strategy 2026-09-28): iOS caps rAF at 30 Hz. Only a WHOLE fight at ~30 Hz with no fast frame reads as capped; a heavy
// scene on a 60 Hz screen still delivers 16.7 ms frames among its slow ones.
test('rafCadence: a whole fight at ~30 Hz reads capped; 60 Hz, 120 Hz, a slow scene with fast frames, or a short sample do not', () => {
  assert.deepEqual(rafCadence(Array(120).fill(33.4)), { medianMs: 33.4, capped30: true }, 'Low Power Mode');
  assert.deepEqual(rafCadence(Array(120).fill(16.7)), { medianMs: 16.7, capped30: false }, '60 Hz');
  assert.deepEqual(rafCadence(Array(240).fill(8.3)), { medianMs: 8.3, capped30: false }, '120 Hz ProMotion');
  assert.equal(rafCadence([...Array(70).fill(33.4), ...Array(50).fill(16.7)]).capped30, false, 'a slow scene on a 60 Hz screen: fast frames show it is not the cap');
  assert.equal(rafCadence([...Array(114).fill(33.3), ...Array(6).fill(66.7)]).capped30, true, 'a capped fight with a few long frames is still capped');
  assert.equal(rafCadence(Array(30).fill(33.4)).capped30, false, 'too few frames to call it');
  assert.deepEqual(rafCadence([]), { medianMs: null, capped30: false });
  assert.equal(rafCadence([NaN, -1, 33.4]).medianMs, 33.4, 'non-finite or negative intervals are ignored');
});
