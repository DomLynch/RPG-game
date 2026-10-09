// The first wired zone fields (A2a): look.fog / sun / ambient / exposure / ground.tint, look.timeOfDay, dayNight.on and look.props.density take effect ONLY when the zone or its biome SETS them; a zone that
// sets none renders exactly as before (Zone 1 and Zone 2 today).
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone } from '../zones/loader.ts';
import { resolveZone } from '../zones/resolve.ts';
import { lookOf, withZoneLook, zoneDayNight, zoneHour, type ZoneFields } from './look.ts';

const of = (spec: Record<string, unknown>): ZoneFields => { const r = resolveZone('999', { name: 'T', level: 999, ...spec }); assert.deepEqual(r.problems, []); return { fields: r.values, set: r.explicit }; };

test('Zone 1 and Zone 2 set no look, time or day/night field: every preset look comes back untouched', () => {
  for (const id of ['1', '2']) {
    const z = loadZone(id);
    assert.deepEqual((z.set ?? []).filter((p) => /^(look\.(fog|sun|ambient|exposure|ground\.tint|timeOfDay|props)|dayNight)/.test(p)), [], `zone ${id}`);
    for (const preset of ['zone1', 'frontier-haze', 'cinder-haze', 'frontier-night', 'ash-pit']) assert.deepEqual(withZoneLook(lookOf(preset), z), lookOf(preset), `${id}/${preset}`);
    assert.equal(zoneHour(z), null); assert.equal(zoneDayNight(z), true);
  }
});

test('each wired look field changes the look it is laid over, and only that field', () => {
  const base = lookOf('frontier-haze');
  const cases: [Record<string, unknown>, Partial<typeof base>][] = [
    [{ look: { fog: { colour: '#112233' } } }, { fog: '#112233' }],
    [{ look: { fog: { density: 0.05 } } }, { fogDensity: 0.05 }],
    [{ look: { fog: { far: 214 } } }, { fogDensity: base.fogDensity * 0.5 }],
    [{ look: { sun: { colour: '#ff0000' } } }, { sunColor: '#ff0000' }],
    [{ look: { sun: { intensity: 2 } } }, { sunIntensity: 2 }],
    [{ look: { sun: { pos: [1, 2, 3] } } }, { sunPos: [1, 2, 3] }],
    [{ look: { ambient: { sky: '#010203' } } }, { hemiSky: '#010203' }],
    [{ look: { ambient: { ground: '#040506' } } }, { hemiGround: '#040506' }],
    [{ look: { ambient: { intensity: 0.4 } } }, { hemiIntensity: 0.4 }],
    [{ look: { exposure: 2 } }, { exposure: 2 }],
    [{ look: { ground: { tint: [0.5, 0.6, 0.7] } } }, { ground: [0.5, 0.6, 0.7] }],
  ];
  for (const [spec, change] of cases) assert.deepEqual(withZoneLook(base, of(spec)), { ...base, ...change }, JSON.stringify(spec));
});

test('time of day: follow:false pins the hour; dayNight.on:false turns the cycle off; absent changes nothing', () => {
  assert.equal(zoneHour(of({ look: { timeOfDay: { follow: false, hour: 22 } } })), 22);
  assert.equal(zoneHour(of({ look: { timeOfDay: { hour: 22 } } })), null, 'an hour without follow:false does nothing');
  assert.equal(zoneDayNight(of({ dayNight: { on: false } })), false); assert.equal(zoneDayNight(of({})), true);
});
