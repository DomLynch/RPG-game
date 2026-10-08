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
  assert.match(source, /peerKit\?: Promise<[^\n]*\n {2}world\?: WorldMount,\n\) \{/);
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

// A world-mounted fight builds one scene per creature on the page's ONE renderer: the old scene must let go of its GPU memory and its resize listener (Auditor MEDIUM, 2026-10-07).
// createScene needs WebGL, so the memory itself is checked in a browser (renderer.info.memory over three creatures); this pins the shape.
test('a mounted scene is disposed before the next one is built, without touching the shared renderer', () => {
  const dispose = source.slice(source.indexOf('    dispose() {'), source.indexOf('    // Load the rigs again'));
  assert.match(dispose, /window\.removeEventListener\('resize', resize\)/);
  assert.match(dispose, /m\.geometry\?\.dispose\(\)/);
  assert.match(dispose, /value instanceof THREE\.Texture/);
  assert.match(dispose, /environmentTarget\?\.dispose\(\)/);
  assert.doesNotMatch(dispose, /renderer\./, 'the page\'s renderer is never disposed here');
  const duel = readFileSync(new URL('../origins/preview/pit-duel.ts', import.meta.url), 'utf8');
  const stageFor = duel.slice(duel.indexOf('function stageFor'), duel.indexOf('// The holder carries the world'));
  assert.ok(stageFor.indexOf('stage.view.dispose()') > 0 && stageFor.indexOf('stage.view.dispose()') < stageFor.indexOf('stage = null;'), 'the old scene is disposed before stage = null');
});

// Auditor HIGH (2026-10-07): the next fight against the same body and level reuses the stage, whose scene got the holder once at creation. One holder per page, so every mount hands
// createScene the holder that is already in the scene.
test('main.ts hands every world mount the same holder (a reused stage keeps it in its scene)', () => {
  const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
  const fn = main.slice(main.indexOf('function worldMount('), main.indexOf('async function startMobFight'));
  assert.doesNotMatch(fn, /new THREE\.Group\(\)/, 'worldMount makes no holder of its own');
  assert.match(fn, /const holder = worldHolder;/);
  assert.equal(main.match(/const worldHolder = new THREE\.Group\(\)/g)?.length, 1, 'one holder per page');
});
