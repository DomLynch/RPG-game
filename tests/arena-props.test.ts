import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { PROPS, extent } from '../src/arena-props.ts';
import { PLAY_RADIUS, CAMERA_CLAMP } from '../src/arena.ts';

// Authored props hold the arena contract by their placement table alone (no GLB is loaded here): nothing above the floor inside the play
// circle, nothing 0.5–6 m high inside the camera clamp, every file present and the set inside its download allowance.
test('every authored prop stays out of the play circle and the camera clamp at fighter height', () => {
  for (const p of PROPS) {
    const { rMin, yMin, yMax } = extent(p);
    assert.ok(rMin >= PLAY_RADIUS, `${p.id} reaches ${rMin.toFixed(2)} m, inside the play circle`);
    if (rMin < CAMERA_CLAMP) assert.ok(yMax <= 0.5 || yMin > 6, `${p.id} stands ${yMax.toFixed(2)} m high at ${rMin.toFixed(2)} m, inside the camera clamp`);
    assert.ok(yMin >= -0.05, `${p.id} sinks ${yMin.toFixed(2)} m under the sand`);
  }
});

test('the portcullis fills the gate and replaces the procedural bars; the set is five files under 1.5 MB', () => {
  const gate = PROPS.find(p => p.id === 'portcullis')!;
  assert.equal(gate.replaces, 'gateBars'); assert.ok(Math.abs(gate.size[0] * gate.scale - 3.2) < 0.05, 'the lattice is the gate width');
  assert.equal(PROPS.filter(p => p.replaces).length, 1);
  const bytes = PROPS.reduce((n, p) => n + statSync(new URL(`../src/assets/arena/props/${p.id}.glb`, import.meta.url)).size, 0);
  assert.equal(PROPS.length, 5); assert.ok(bytes <= 1_500_000, `${bytes} bytes of props`);
});
