import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breathe, fatigueLayer } from '../src/fatigue-layer.ts';
import { fatigueRead, fatigueReadFrom, readRate, readWeight } from '../src/fatigue-read.ts';

// The live layer, copied verbatim from before ?look=fatigue-read existed: the flag-off output must equal it for every band.
function liveLayer(f: { level: number; gassed: number; second: number }, phase: number, calm: number, t?: { rate?: number; depth?: number; sag?: number }) {
  const show = Math.max(f.gassed, Math.max(0, Math.min(1, (f.level - .9) / .1)));   // Dom 2026-10-07: the body tires only in the last tenth or exhausted
  const depth = (t?.depth ?? 1) * calm * show, sag = (t?.sag ?? 1) * calm * show, winded = Math.max(0, Math.min(1, (f.level - .25) / .5)), ragged = Math.sin(phase * .37) * .35 * f.gassed;
  const chest = (Math.sin(phase) * (1 + ragged) * .1 * winded + Math.sin(phase * 2) * .02 * f.gassed) * depth, arch = f.second * .14 * depth;
  return { hunch: (f.level * .2 + f.gassed * .3) * depth - arch * .5, chest: chest - arch, arm: (f.level * .26 + f.gassed * .3) * sag };
}
const BANDS = [{ level: 0, gassed: 0, second: 0 }, { level: .5, gassed: 0, second: 0 }, { level: .6, gassed: 0, second: 0 }, { level: .9, gassed: 0, second: 0 }, { level: 1, gassed: 1, second: 0 }, { level: .8, gassed: .4, second: .6 }];

test('flag off: the layer is exactly the live layer for every band, and the read tune key changes nothing in it', () => {
  for (const f of BANDS) for (const phase of [0, 1.3, 7]) for (const t of [undefined, { rate: 1.5, depth: .55, sag: .8 }])
    for (const tuned of [t, t && { ...t, read: true }]) assert.deepEqual(fatigueLayer(f, phase, 1, tuned), liveLayer(f, phase, 1, t));
  assert.equal(breathe(BANDS[3], { read: true }), breathe(BANDS[3]));
});

test('the flag is the ?look=fatigue-read token and nothing else', () => {
  assert.equal(fatigueReadFrom(''), false);
  assert.equal(fatigueReadFrom('?look=fatigue-read'), true);
  assert.equal(fatigueReadFrom('?look=souls,fatigue-read'), true);
  assert.equal(fatigueReadFrom('?look=fatigue'), false);
});

test('the read pose grows with the band: nothing fresh, partial winded, full gassed, lifted by the second wind', () => {
  const at = (f: typeof BANDS[0]) => fatigueRead(f, 0, 1, { arm: 0 });
  assert.equal(readWeight(BANDS[0]), 0);
  assert.deepEqual(at(BANDS[0]).spine1, 0);
  const winded = readWeight(BANDS[1]), tired = readWeight(BANDS[3]);
  assert.ok(winded > 0 && winded < .6 && tired === 1 && readWeight(BANDS[4]) === 1);
  assert.ok(readWeight({ level: 1, gassed: 1, second: 1 }) < .4);
  const pitch = (f: typeof BANDS[0]) => { const r = at(f); return r.spine1 + r.spine2 + r.spine3; };
  assert.ok(pitch(BANDS[1]) < pitch(BANDS[2]) && pitch(BANDS[2]) < pitch(BANDS[3]));
  const deg = (f: typeof BANDS[0]) => pitch(f) * 180 / Math.PI;
  assert.ok(deg(BANDS[1]) > 12 && deg(BANDS[1]) < 20, `winded spine pitch ${deg(BANDS[1])}`);
  assert.ok(deg(BANDS[4]) > 25 && deg(BANDS[4]) < 40, `gassed spine pitch ${deg(BANDS[4])}`);
});

test('calm gates it (no pose change mid-swing) and the sword arm passes through untouched', () => {
  assert.equal(fatigueRead(BANDS[4], 1, 0, { arm: .5 }).spine1, 0);
  assert.equal(fatigueRead(BANDS[4], 1, 1, { arm: .5 }).arm, .5);
});

test('the breath cycle is 1.2-1.6 s, shoulders rise and fall by a visible amount', () => {
  const period = (f: typeof BANDS[0]) => 2 * Math.PI / readRate(f);
  assert.ok(Math.abs(period({ level: .6, gassed: 0, second: 0 }) - 1.6) < .2 && Math.abs(period(BANDS[4]) - 1.2) < .01);
  const hi = fatigueRead(BANDS[4], Math.PI / 2, 1, { arm: 0 }).heave, lo = fatigueRead(BANDS[4], -Math.PI / 2, 1, { arm: 0 }).heave;
  assert.ok(hi - lo > .15, `shoulder swing ${hi - lo} rad`);
});
