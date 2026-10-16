// The warm-up's proxy material is ONE shared, never-disposed material, linked once before [zone ready] (origins/preview/warm-proxy.ts). Made and disposed at each use, its program was alive at one of the
// seamless row's readings and gone at the other (71 -> 72, "no scene material uses it"). The behaviour is the browser row (scripts/origins-seamless-check.mjs: 0 new programs after ready); these pin the
// shape: one instance, one link, the renderer's own target restored, and neither warm-up site making or disposing a proxy of its own.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { drawProxy, linkProxy, warmProxy } from '../origins/preview/warm-proxy.ts';

const fake = () => {
  const calls = { render: 0, targets: [] as unknown[] }; let current: unknown = 'canvas';
  const renderer = { getRenderTarget: () => current, setRenderTarget: (t: unknown) => { current = t; calls.targets.push(t); }, render: () => { calls.render++; } };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, calls, current: () => current };
};

test('the proxy is one shared material, scene and target', () => {
  assert.equal(warmProxy(), warmProxy());
  assert.ok(warmProxy().material instanceof THREE.MeshBasicMaterial);
});

test('linkProxy draws once into the proxy target, only the first time, and puts the renderer\'s own target back', () => {
  const f = fake(), camera = new THREE.PerspectiveCamera();
  linkProxy(f.renderer, camera); linkProxy(f.renderer, camera);
  assert.equal(f.calls.render, 1);
  assert.equal(f.calls.targets[0], warmProxy().target);
  assert.equal(f.current(), 'canvas');
  assert.equal(warmProxy().scene.children.length, 0, 'the proxy scene is left empty');
});

test('drawProxy restores the target and empties the scene even when the draw throws', () => {
  const f = fake(), camera = new THREE.PerspectiveCamera();
  (f.renderer as unknown as { render: () => void }).render = () => { throw new Error('lost context'); };
  assert.throws(() => drawProxy(f.renderer, camera, new THREE.BufferGeometry()), /lost context/);
  assert.equal(f.current(), 'canvas');
  assert.equal(warmProxy().scene.children.length, 0);
});

test('neither warm-up site makes or disposes a proxy of its own', () => {
  for (const file of ['origins/preview/main.ts', 'origins/preview/mobs-view.ts']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /warm-proxy\.ts/, `${file} uses the shared proxy`);
    assert.doesNotMatch(src, /proxy\.dispose\(\)/, `${file} must not dispose the proxy`);
    assert.doesNotMatch(src, /const proxy = new THREE\.MeshBasicMaterial/, `${file} must not make its own proxy`);
  }
  assert.match(readFileSync('origins/preview/main.ts', 'utf8'), /linkProxy\(renderer, camera\)[^\n]*\n[^\n]*const queue/, 'planUpload links the proxy before it queues');
});
