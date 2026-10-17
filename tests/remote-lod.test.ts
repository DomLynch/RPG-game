// The near-figure cap (origins/preview/remote-lod.ts): the merged hero-near figure is for at most the nearest `remoteNearCap` remote heroes, however many stand inside the near range; everything else
// is the far figure. Pins: never more than N near across many frames of moving crowds, the range and its slack still behave, and remote-heroes.ts reads the row (no literal) and calls the function.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { previewRule } from '../origins/preview/preview-rules.ts';
import { chooseLod, type Lod } from '../origins/preview/remote-lod.ts';

const farRange = previewRule('remoteFarRangeM'), slack = previewRule('remoteLodSlackM'), nearCap = previewRule('remoteNearCap');
const lodOf = (dist: number, rank: number, current: Lod = 'far') => chooseLod({ dist, rank, current, farRange, slack, nearCap });

test('the nearest nearCap figures inside the range are near, the ones past the cap are far, whatever their distance', () => {
  for (let rank = 0; rank < nearCap; rank++) assert.equal(lodOf(2, rank), 'near', `rank ${rank} at 2 m`);
  for (let rank = nearCap; rank < nearCap + 20; rank++) assert.equal(lodOf(1, rank, 'near'), 'far', `rank ${rank} at 1 m, even one that was near`);
});

test('the range and its slack still decide a figure inside the cap: coming in turns near below range - slack, going out turns far past range + slack', () => {
  assert.equal(lodOf(farRange - slack - 0.01, 0, 'far'), 'near');
  assert.equal(lodOf(farRange - slack + 0.01, 0, 'far'), 'far');
  assert.equal(lodOf(farRange + slack - 0.01, 0, 'near'), 'near');
  assert.equal(lodOf(farRange + slack + 0.01, 0, 'near'), 'far');
});

test('never more than nearCap near figures, in any frame of a crowd that moves (40 figures, 600 frames, all starting inside the near range)', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const figs = Array.from({ length: 40 }, (_, i) => ({ id: i, x: rnd() * 10 - 5, z: rnd() * 10 - 5, vx: rnd() - 0.5, vz: rnd() - 0.5, lod: 'far' as Lod }));
  let worst = 0, sawNear = 0;
  for (let frame = 0; frame < 600; frame++) {
    for (const f of figs) { f.x += f.vx * 0.05; f.z += f.vz * 0.05; if (Math.abs(f.x) > 12) f.vx = -f.vx; if (Math.abs(f.z) > 12) f.vz = -f.vz; }
    figs.map((f) => ({ f, d: Math.hypot(f.x, f.z) })).sort((a, b) => a.d - b.d || a.f.id - b.f.id).forEach(({ f, d }, rank) => { f.lod = chooseLod({ dist: d, rank, current: f.lod, farRange, slack, nearCap }); });
    const near = figs.filter((f) => f.lod === 'near').length; worst = Math.max(worst, near); sawNear += near;
  }
  assert.ok(worst <= nearCap, `at most ${nearCap} near in any frame (worst ${worst})`);
  assert.ok(sawNear > 0, 'the crowd does have near figures (the cap is not simply "none")');
});

test('remote-heroes.ts takes the near count from the remoteNearCap row and decides each LOD with chooseLod', () => {
  const src = readFileSync('origins/preview/remote-heroes.ts', 'utf8');
  assert.match(src, /nearCap = previewRule\('remoteNearCap'\)/);
  assert.match(src, /chooseLod\(\{[^}]*rank[^}]*nearCap/);
  assert.doesNotMatch(src, /dist > farRange \+ lodSlack/, 'the range decision lives in remote-lod.ts only');
});
