// The Pit path is unchanged without a world mount (?worldfight, origins/preview/pit-duel.ts). createScene's `world` argument is optional and last, and every place that reads it
// is one of the guarded forms below: the page's renderer in place of a new one, the world's background and fog, no arena and no arena lights, the holder mounted, no resize of the
// page's renderer. A new use of `world` in scene.ts is a new difference between the Pit and a mounted fight: review it, then add it here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
const lines = source.split('\n').map((l) => l.replace(/\s*\/\/.*$/, '')).filter((l) => l.trim());   // code only, comments dropped
const reads = lines.filter((l) => /\bworld\b/.test(l) && !/const world = new THREE\.Vector3|take = \(world: THREE\.Vector3\)|v\.copy\(world\)|take\(o\.getWorldPosition\(world\)\)|take\(world\.set|, world\)/.test(l));

test('createScene takes the world mount last and optional', () => {
  assert.match(source, /peerKit\?: Promise<[^\n]*\n  world\?: WorldMount,\n\) \{/);
});

test('every read of the world mount is a guarded form, so no mount means the Pit exactly', () => {
  const expected = [
    "  world?: WorldMount,",
    "  const renderer = world?.renderer ?? new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });",
    "  if (!world) {",
    "  scene.background = world ? world.background : new THREE.Color(theme.fog);",
    "  scene.fog = world ? world.fog : new THREE.FogExp2(theme.fog, theme.fogDensity);",
    "      scene.environmentIntensity = world ? 0.15 : environment ? 0.45 : 1.0;",
    "  if (!world) scene.add(hemisphere);",
    "  if (!world) scene.add(sun);",
    "  const arena = world ? worldArena() : buildArena(scene, theme),",
    "  if (world) scene.add(world.holder);",
    "    if (!world) renderer.setSize(width, height, false);",
    "        if (!world) renderer.setPixelRatio(ratio);",
  ];
  assert.deepEqual(reads.map((l) => l.trimEnd()), expected);
});
