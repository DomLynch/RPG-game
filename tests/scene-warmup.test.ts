import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The shaders compile behind the welcome card (2026-09-25): scene.ts reports 'ready' only after renderer.compile() has walked the
// scene, so the Enter tap (main.ts enables it on that status) never lands on a fight whose first blow compiles sparks and blood.
// createScene needs a WebGL context, so this pins the order in the source: one compile call, in the rig load callback, after the
// rigs are dressed (their materials are in the scene) and immediately before the ready status.
test('scene.ts compiles every shader before it reports ready, in the rig load callback', () => {
  const scene = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
  const compiles = [...scene.matchAll(/renderer\.compile\(scene, camera\);/g)].map((m) => m.index!);
  assert.equal(compiles.length, 1, 'one warm-up compile');
  const ready = scene.indexOf("assetStatus('', 'ready');");
  assert.ok(ready > compiles[0]!, 'the compile precedes the ready status');
  const between = scene.slice(compiles[0]! + 'renderer.compile(scene, camera);'.length, ready);
  assert.match(between, /^\s*$/, 'nothing runs between the compile and the ready status');
  const before = scene.slice(0, compiles[0]!);
  assert.ok(before.lastIndexOf('dress();') > before.lastIndexOf('function dress'), 'the compile runs after the rigs are dressed');
});
