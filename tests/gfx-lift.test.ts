// The `?gfx=1` graphics lift (Test Zone C16 / R09): the flag, the rows with the sandbox's values, and the height-fog patch (strings only, no GL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { gfxOn } from '../origins/preview/gfx-flag.ts';
import { patchHeightFog } from '../origins/preview/gfx-lift.ts';
import { fxNum } from '../src/fight/fx-rows.ts';

test('the flag: ?gfx=1 forces on; with no default row it is off', () => {
  assert.equal(gfxOn(''), false);
  assert.equal(gfxOn('?gfx=0'), false);
  assert.equal(gfxOn('?gfx=10'), false);
  assert.equal(gfxOn('?gfx=1'), true);
  assert.equal(gfxOn('?zone=90&gfx=1'), true);
});

test('the gfx.default row turns it on for everyone and ?gfx=0 opts out', () => {
  assert.equal(fxNum('gfx.default'), 1);
  assert.equal(gfxOn('', true), true);
  assert.equal(gfxOn('?zone=1', true), true);
  assert.equal(gfxOn('?gfx=0', true), false);
  assert.equal(gfxOn('?zone=1&gfx=0', true), false);
  assert.equal(gfxOn('?gfx=10', true), true);
  assert.equal(gfxOn('?gfx=1', true), true);
});

test('the gfx rows hold the sandbox values', () => {
  const want: Record<string, number> = {
    'gfx.bloom.strength': 0.4, 'gfx.bloom.radius': 0.55, 'gfx.bloom.threshold': 0.92,   // bloom lowered from the sandbox's 0.5 / 0.82: the foot-dust discs read as smudges at 375 (Lead's verdict on #3436) 'gfx.grade.contrast': 1.1, 'gfx.grade.saturation': 1.14,
    'gfx.grade.shadow-teal': 0.045, 'gfx.grade.highlight-warm': 0.05, 'gfx.grade.vignette': 0.42, 'gfx.fog.ground-boost': 1.9, 'gfx.fog.height-falloff': 0.11, 'gfx.fog.sky-keep': 0.45,
    'gfx.fog.digits': 3, 'gfx.fog.digits-fine': 4, 'gfx.msaa-samples': 4,
  };
  for (const [id, v] of Object.entries(want)) assert.equal(fxNum(id), v, id);
});

test('the fog patch writes the rows into the fragment chunk and gives every fog vertex a height', () => {
  const chunks = THREE.ShaderChunk as Record<string, string>;
  const before = chunks.fog_fragment!;
  assert.match(before, /float fogFactor = 1\.0 - exp\( - fogDensity \* fogDensity/);
  patchHeightFog();
  assert.match(chunks.fog_fragment!, /float fogH = 0\.450 \+ 1\.900 \* exp\( - max\( vFogY, 0\.0 \) \* 0\.1100 \);/);
  assert.match(chunks.fog_vertex!, /vFogY = /);
  assert.match(chunks.fog_pars_vertex!, /varying float vFogY;/);
  assert.match(chunks.fog_pars_fragment!, /varying float vFogY;/);
});
