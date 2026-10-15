// The ground-looks rows load, and the loader refuses a bad one (the Auditor on #2824): a bad colour, a radius or height at or below 0, an opacity outside (0, 1], a missing tilt.
import test from 'node:test';
import assert from 'node:assert/strict';
import LOOKS from '../origins/preview/ground-looks.json' with { type: 'json' };
import { groundLook, loadGroundLooks } from '../origins/preview/ground-looks.ts';

const ITEM = 'item:starter.rusty-sword';
const raw = (edit: (fields: Record<string, any>) => void) => { const r = JSON.parse(JSON.stringify(LOOKS)); edit(r.groundLooks[0].fields); return r; };

test('the shipped row loads, with ring and beam rows carrying every number the view draws with', () => {
  const look = groundLook(ITEM);
  assert.deepEqual([look.asset, look.finish], ['longsword', 'rust']);
  assert.ok(look.ring && look.ring.bands.length >= 1 && look.ring.segments >= 3 && look.ring.liftM >= 0);
  assert.ok(look.beam && look.beam.topRatio > 0 && look.beam.segments >= 3);
  assert.deepEqual([...loadGroundLooks(LOOKS).keys()], [ITEM]);
});

test('the loader refuses a bad colour, a radius or height at or below 0, an opacity outside (0, 1], and a missing tilt', () => {
  const bad: [string, (f: Record<string, any>) => void, RegExp][] = [
    ['ring colour not hex', (f) => { f.ring.color = 'gold'; }, /ring\.color/], ['ring colour short hex', (f) => { f.ring.color = '#fff'; }, /ring\.color/],
    ['beam colour not hex', (f) => { f.beam.color = 'ffe2a0'; }, /beam\.color/],
    ['ring radius 0', (f) => { f.ring.radiusM = 0; }, /ring\.radiusM/], ['ring radius negative', (f) => { f.ring.radiusM = -1; }, /ring\.radiusM/],
    ['beam radius 0', (f) => { f.beam.radiusM = 0; }, /beam\.radiusM/], ['beam height 0', (f) => { f.beam.heightM = 0; }, /beam\.heightM/], ['beam height negative', (f) => { f.beam.heightM = -2; }, /beam\.heightM/],
    ['ring opacity 0', (f) => { f.ring.opacity = 0; }, /ring\.opacity/], ['ring opacity above 1', (f) => { f.ring.opacity = 1.2; }, /ring\.opacity/], ['ring opacity negative', (f) => { f.ring.opacity = -0.1; }, /ring\.opacity/],
    ['beam opacity 0', (f) => { f.beam.opacity = 0; }, /beam\.opacity/], ['beam opacity above 1', (f) => { f.beam.opacity = 2; }, /beam\.opacity/],
    ['missing tiltDeg', (f) => { delete f.tiltDeg; }, /tiltDeg/], ['tiltDeg not a number', (f) => { f.tiltDeg = '25'; }, /tiltDeg/],
    ['ring band outer past 1', (f) => { f.ring.bands = [[0.5, 1.5, 1]]; }, /outer/], ['ring bands empty', (f) => { f.ring.bands = []; }, /bands/], ['beam topRatio 0', (f) => { f.beam.topRatio = 0; }, /topRatio/],
    ['scale 0', (f) => { f.scale = 0; }, /scale/],
  ];
  for (const [why, edit, rule] of bad) assert.throws(() => loadGroundLooks(raw(edit)), rule, why);
  assert.deepEqual([...loadGroundLooks(raw((f) => { f.ring.opacity = 1; f.beam.opacity = 1; f.tiltDeg = 0; })).keys()], [ITEM], 'opacity 1 and a tilt of 0 are fine');
  assert.deepEqual([...loadGroundLooks(raw((f) => { delete f.ring; delete f.beam; })).keys()], [ITEM], 'ring and beam are optional');
});
