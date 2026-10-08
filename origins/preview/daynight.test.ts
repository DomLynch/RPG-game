// The day/night clock (daynight.ts): a 100-minute day, noon is day, midnight is night, dusk and dawn blend, and the blend never leaves the two looks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY_NIGHT_SPEED, gameHour, isNight, nightness, skyLook } from './daynight.ts';
import { lookOf, PRESETS } from './look.ts';

test('a 100-minute day: the schema speed is 14.4 and 100 real minutes is exactly one lap', () => {
  assert.equal(DAY_NIGHT_SPEED, 14.4);
  assert.ok(Math.abs(gameHour(100 * 60_000, DAY_NIGHT_SPEED, 12) - 12) < 1e-9);
  assert.ok(Math.abs(gameHour(25 * 60_000, DAY_NIGHT_SPEED, 12) - 18) < 1e-9);
  assert.equal(gameHour(9e9, 0, 7), 7);   // speed 0 = frozen
  assert.ok(gameHour(-5 * 60_000, DAY_NIGHT_SPEED, 1) >= 0 && gameHour(-5 * 60_000, DAY_NIGHT_SPEED, 1) < 24);
});

test('noon is day, midnight is night, dusk and dawn blend monotonically', () => {
  assert.equal(nightness(12), 0); assert.equal(nightness(0), 1); assert.equal(nightness(23), 1);
  assert.ok(!isNight(12) && isNight(0) && isNight(2));
  for (let h = 19; h < 20.5; h += 0.1) assert.ok(nightness(h + 0.1) >= nightness(h), `dusk not monotonic at ${h}`);
  for (let h = 3.5; h < 5; h += 0.1) assert.ok(nightness(h + 0.1) <= nightness(h), `dawn not monotonic at ${h}`);
  assert.ok(nightness(19.75) > 0 && nightness(19.75) < 1);
});

test('skyLook is the day look at noon, the night look at midnight, and in between at dusk', () => {
  const day = lookOf('frontier-haze'), night = PRESETS['frontier-night']!;
  assert.deepEqual(skyLook(day, night, 12), day);
  assert.deepEqual(skyLook(day, night, 0), night);
  const dusk = skyLook(day, night, 19.75);
  assert.ok(dusk.sunIntensity < day.sunIntensity && dusk.sunIntensity > night.sunIntensity);
});
