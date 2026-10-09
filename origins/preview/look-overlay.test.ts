// The ?look=<field.path>=<value> overlay: parsed against the field registry, refused like a zone file, and laid over the zone's fields so the A2a readers act on it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone } from '../zones/loader.ts';
import { lookOf, withZoneLook, zoneDayNight, zoneHour } from './look.ts';
import { parseOverlay, withOverlay } from './look-overlay.ts';

test('a ?look= value with no "=" is a preset name and is not an overlay', () => {
  assert.deepEqual(parseOverlay('?region=1&look=duel&look=zone1&look=night'), { fields: {}, set: [], problems: [] });
  assert.deepEqual(parseOverlay(''), { fields: {}, set: [], problems: [] });
});

test('numbers, booleans, colours with or without #, lists and the short comma form are typed by the field, not the URL', () => {
  const o = parseOverlay('?look=look.fog.density=0.03&look=look.timeOfDay.follow=false&look=look.fog.colour=7a1f1f&look=look.sun.colour=%233060ff&look=look.sun.pos=-10,20,5');
  assert.deepEqual(o.problems, []);
  assert.deepEqual(o.fields, { 'look.fog.density': 0.03, 'look.timeOfDay.follow': false, 'look.fog.colour': '#7a1f1f', 'look.sun.colour': '#3060ff', 'look.sun.pos': [-10, 20, 5] });
  assert.deepEqual(o.set, Object.keys(o.fields));
});

test('an unknown field or a bad value is refused with the registry\'s words and the rest still apply', () => {
  const o = parseOverlay('?look=look.fog.densty=0.03&look=look.fog.density=9&look=look.exposure=abc&look=look.exposure=1.6&look=look.timeOfDay.follow=maybe&look=look.ambient.sky=%23abc');
  assert.deepEqual(o.fields, { 'look.exposure': 1.6 });
  assert.equal(o.problems.length, 5, 'a 3-digit colour is refused too: the schema wants #rrggbb');
  assert.match(o.problems[0]!, /nearest: "look\.fog\.density"/);
  assert.ok(o.problems.every((p) => p.startsWith('?look=')));
});

test('a repeated key: the last valid one wins, and it is listed once', () => {
  const o = parseOverlay('?look=look.exposure=1.2&look=look.exposure=1.9');
  assert.deepEqual([o.fields['look.exposure'], o.set], [1.9, ['look.exposure']]);
});

test('laid over a zone that sets nothing, the overlay changes only what it names (fog density, exposure), through the same readers as a zone file', () => {
  const z = loadZone('2'), base = lookOf('frontier-haze');
  assert.deepEqual(withZoneLook(base, z), base);
  const merged = withOverlay(z, parseOverlay('?look=look.fog.density=0.05&look=look.exposure=1.6'));
  assert.deepEqual(withZoneLook(base, merged), { ...base, fogDensity: 0.05, exposure: 1.6 });
  assert.deepEqual(z.set?.filter((p) => p === 'look.exposure'), [], 'the zone itself is not mutated');
});

test('time and day/night overlay: a fixed hour and the cycle off', () => {
  const z = loadZone('2');
  assert.equal(zoneHour(withOverlay(z, parseOverlay('?look=look.timeOfDay.follow=false&look=look.timeOfDay.hour=22'))), 22);
  assert.equal(zoneDayNight(withOverlay(z, parseOverlay('?look=dayNight.on=false'))), false);
  assert.equal(zoneHour(withOverlay(z, parseOverlay('?look=look.timeOfDay.hour=22'))), null, 'an hour alone does not stop the clock');
});

test('no overlay returns the zone untouched (the same object)', () => {
  const z = loadZone('1');
  assert.equal(withOverlay(z, parseOverlay('?region=1&look=zones')), z);
});
