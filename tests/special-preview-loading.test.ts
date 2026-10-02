import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { disposeSpecialGroup } from '../src/special-presentation.ts';
import { createNightfallFx } from '../src/nightfall-fx.ts';
import { createSpecialFx } from '../src/special-fx.ts';
import type { SpecialFx } from '../src/special-modes.ts';

// The actual scene's loading/reset blocks with real scene containers and effect resources.
const source = readFileSync('src/scene.ts', 'utf8');
const reset = source.slice(source.indexOf('      if (specialId && (previewEpoch'), source.indexOf('      const blow = events.find'));
const load = source.slice(source.indexOf('      if (specialId && !previewBlocked'), source.indexOf('      if (specialFx)'));
function harness() {
  const scene = new THREE.Scene(), pending: Array<{ group: THREE.Scene; resolve(fx: SpecialFx): void; reject(error: Error): void }> = [], errors: unknown[] = [];
  const context = { scene, THREE, pending, errors, disposeSpecialGroup, specialId: 'hades', specialEpoch: 1, previewEpoch: -1, previewTick: -1, previewGeneration: 0, previewBlocked: false, previewGroup: undefined, previewBackground: new THREE.Color('#777777'), specialFx: undefined, specialFxLoading: false, opponentId: 'nightborn', theme: { exposure: 1 }, camera: new THREE.PerspectiveCamera(), events: [] as Array<{ type: string; actor: number }>, practice: { duel: { tick: 100, fighters: [{ specialShare: .15 }] } }, captureException: (error: unknown) => errors.push(error), mode: { load: (group: THREE.Scene) => new Promise<SpecialFx>((resolve, reject) => pending.push({ group, resolve, reject })) } };
  const code = ts.transpileModule(`globalThis.reset = () => {${reset}}; globalThis.load = () => {${load}};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, context);
  return Object.assign(context, context as unknown as { reset(): void; load(): void });
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
for (const reason of ['rematch', 'rewind', 'fizzle'] as const) test(`actual preview load discards stale ${reason} resources`, async () => {
  const h = harness(); h.reset(); h.load(); assert.equal(h.pending.length, 1);
  if (reason === 'rematch') h.specialEpoch++;
  if (reason === 'rewind') h.practice.duel.tick = 0;
  if (reason === 'fizzle') h.events = [{ type: 'SpecialFizzled', actor: 1 }];
  h.reset();
  const fx = createSpecialFx(h.pending[0].group, 'nightborn');
  const sprite = h.pending[0].group.getObjectByName('cloud 0') as THREE.Sprite; let disposed = 0;
  sprite.material.addEventListener('dispose', () => disposed++);
  h.pending[0].resolve(fx); await flush();
  assert.equal(h.specialFx, undefined); assert.equal(disposed, 1); assert.equal(h.pending[0].group.children.length, 0); assert.equal(h.scene.children.length, 0);
  if (reason === 'fizzle') { h.load(); assert.equal(h.pending.length, 1, 'a fizzle cannot start another old load'); }
});
test('actual preview load failure cleans up and retries only for a newly accepted cast', async () => {
  const h = harness(); h.reset(); h.load(); h.pending[0].reject(new Error('load failed')); await flush();
  assert.equal(h.scene.children.length, 0); assert.equal(h.specialFxLoading, false); assert.equal(h.errors.length, 1);
  h.load(); assert.equal(h.pending.length, 1, 'no frame-rate retry loop');
  h.events = [{ type: 'SpecialStarted', actor: 1 }]; h.reset(); h.load(); assert.equal(h.pending.length, 2);
});

test('stale real Nightfall load removes its veil, rim light and target from the scene', async () => {
  const h = harness(); h.reset(); h.load(); h.specialEpoch++; h.reset();
  const fx = createNightfallFx(h.pending[0].group, h.camera, 'nightborn');
  assert.equal(h.pending[0].group.children.length, 3, 'veil, rim light and target were allocated');
  h.pending[0].resolve(fx); await flush();
  assert.equal(h.scene.children.length, 0); assert.equal(h.pending[0].group.children.length, 0); assert.equal(h.specialFx, undefined);
});
