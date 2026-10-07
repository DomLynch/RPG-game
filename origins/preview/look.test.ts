import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_THEMES } from '../../src/arena-themes.ts';
import { blendLook, DEFAULT_FOG_FAR, lookAlong, lookOf, PRESETS, zoneLook } from './look.ts';

test('ash-pit is Arena 1 exactly (today\'s Pit does not change)', () => {
  const t = ARENA_THEMES['1'], l = PRESETS['ash-pit']!;
  assert.equal(l.fog, t.fog); assert.equal(l.fogDensity, t.fogDensity); assert.equal(l.exposure, t.exposure);
  assert.deepEqual([l.hemiSky, l.hemiGround, l.hemiIntensity], t.hemisphere); assert.deepEqual([l.sunColor, l.sunIntensity], t.sun);
  assert.deepEqual(l.ground, [1, 1, 1]);
});

test('an unknown preset falls back to the Pit; every preset is well formed', () => {
  assert.equal(lookOf('no-such-preset'), PRESETS['ash-pit']);
  for (const [id, l] of Object.entries(PRESETS)) {
    for (const hex of [l.fog, l.hemiSky, l.hemiGround, l.sunColor]) assert.match(hex, /^#[0-9a-f]{6}$/i, id);
    assert.ok(l.fogDensity > 0 && l.fogDensity < 0.1 && l.sunIntensity > 0 && l.exposure > 0.5 && l.exposure < 2.5, id);
  }
});

test('the Exchange is a darker, warmer dusk than the Pit, the frontier a thinner, brighter haze', () => {
  const pit = PRESETS['ash-pit']!, ex = PRESETS['exchange-dusk']!, fr = PRESETS['frontier-haze']!;
  assert.ok(ex.sunIntensity < pit.sunIntensity && ex.sunPos[1] < pit.sunPos[1] && ex.fogDensity > pit.fogDensity);
  assert.ok(fr.fogDensity < pit.fogDensity && fr.sunIntensity > pit.sunIntensity);
});

test('blend: endpoints are exact, the middle is between, t is clamped', () => {
  const a = PRESETS['ash-pit']!, b = PRESETS['exchange-dusk']!;
  assert.equal(blendLook(a, b, 0), a); assert.equal(blendLook(a, b, 1), b); assert.equal(blendLook(a, b, -3), a); assert.equal(blendLook(a, b, 9), b);
  const m = blendLook(a, b, 0.5);
  assert.equal(m.fogDensity, (a.fogDensity + b.fogDensity) / 2); assert.equal(m.exposure, (a.exposure + b.exposure) / 2);
  assert.equal(blendLook(a, a, 0.5).fog, a.fog); assert.match(m.fog, /^#[0-9a-f]{6}$/);
});

test('lookAlong holds beyond the ends and blends between zone centres, in any stop order', () => {
  const stops = [{ at: -40, preset: 'exchange-dusk' }, { at: 0, preset: 'ash-pit' }];
  assert.equal(lookAlong(5, stops), PRESETS['ash-pit']); assert.equal(lookAlong(-60, stops), PRESETS['exchange-dusk']);
  assert.equal(lookAlong(0, stops), PRESETS['ash-pit']);
  const mid = lookAlong(-20, stops);
  assert.ok(mid.sunIntensity < PRESETS['ash-pit']!.sunIntensity && mid.sunIntensity > PRESETS['exchange-dusk']!.sunIntensity);
  assert.equal(lookAlong(3, []), PRESETS['ash-pit']);
});

test('zoneLook scales fog density to the zone\'s view.fogFar; the default distance leaves the preset unchanged', () => {
  assert.equal(zoneLook({ ambience: { preset: 'ash-pit' }, view: { fogFar: DEFAULT_FOG_FAR } }).fogDensity, PRESETS['ash-pit']!.fogDensity);
  assert.ok(zoneLook({ ambience: { preset: 'ash-pit' }, view: { fogFar: 214 } }).fogDensity < PRESETS['ash-pit']!.fogDensity);
});
