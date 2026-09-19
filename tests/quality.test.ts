import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { budgetTextures, canvasResize, detectPhoneTier, FIGHTER_TEXTURE_CAP, phoneTier, resetPhoneTierForTests } from '../src/quality.ts';

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
  const c = new Mesh(undefined, [new MeshStandardMaterial({ normalMap: mid }), undefined]);      // mid shared; array materials
  root.add(a, b, c);
  return { root, big, mid, small };
}

test('budgetTextures resizes only the oversized unique textures, once each', () => {
  const { root, big, mid, small } = fighterLike();
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
