// Time of day as rows (origins/world/clock.json): the shipped rows load against the real vocabularies, the sky's night clock picks the part, the alignment bonus swaps between day and night,
// a night camp and a weather table are one row each, and the weather draw is seeded (same seed, biome and day = same kind) and follows its weights.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOCK, clockBonusFor, loadClockDefs, partOf, spawnsFor, weatherFor, type ClockDefs } from './clock.ts';
import { isNight } from '../preview/daynight.ts';
import { WEATHER_ROWS } from '../../src/arena-rows.ts';
import { BIOMES } from '../zones/biomes.ts';

const KNOWN = { weatherKinds: Object.keys(WEATHER_ROWS), biomes: Object.keys(BIOMES), zones: ['cinder-fields', 'ash-reach'], characters: ['character:ash-wolf', 'character:ember-wolf'] };
const copy = (): ClockDefs => JSON.parse(JSON.stringify(CLOCK));

test('the shipped rows load against the real weather kinds and biomes; the night spawn table ships empty (no content invented)', () => {
  loadClockDefs(copy(), KNOWN);
  assert.deepEqual(Object.keys(CLOCK.nightSpawns), []);
  assert.deepEqual(Object.keys(CLOCK.weather).every((b) => b in BIOMES), true);
});

test('the sky clock picks the part: night hours are the night row, the rest the day row', () => {
  for (let h = 0; h < 24; h += 0.25) assert.equal(partOf(isNight(h)), isNight(h) ? 'night' : 'day', `hour ${h}`);
});

test('the clock bonus: lawful gains by day and loses by night, chaotic the reverse, an alignment with no row gets nothing', () => {
  assert.deepEqual([clockBonusFor('lawful', false), clockBonusFor('lawful', true), clockBonusFor('chaotic', false), clockBonusFor('chaotic', true), clockBonusFor('neutral', true)], [3, -3, -3, 3, 0]);
  const d = copy(); (d.clockBonus as Record<string, unknown>).neutral = { order: 3, day: 1, night: 1 };
  assert.equal(clockBonusFor('neutral', true, d), 1, 'a new alignment is one row');
});

test('a night camp is one row: it is live at night in its zone and nowhere else; the loader refuses a bad part, zone, creature and count', () => {
  const d = copy();
  (d.nightSpawns as Record<string, unknown>)['cinder-night-wolves'] = { order: 1, part: 'night', zone: 'cinder-fields', character: 'character:ash-wolf', count: 2 };
  loadClockDefs(d, KNOWN);
  assert.deepEqual(spawnsFor('cinder-fields', true, d).map((s) => s.count), [2]);
  assert.deepEqual(spawnsFor('cinder-fields', false, d), [], 'not by day');
  assert.deepEqual(spawnsFor('ash-reach', true, d), [], 'not in another zone');
  const bad = (patch: object) => { const x = copy(); (x.nightSpawns as Record<string, unknown>).x = { order: 1, part: 'night', zone: 'cinder-fields', character: 'character:ash-wolf', count: 2, ...patch }; return () => loadClockDefs(x, KNOWN); };
  assert.throws(bad({ part: 'dusk' }), /day part/); assert.throws(bad({ zone: 'nowhere' }), /zone/); assert.throws(bad({ character: 'character:ghost' }), /creature/); assert.throws(bad({ count: 0 }), /count/);
});

test('the weather draw is seeded and weighted; the loader refuses an unknown kind, a non-positive weight and an unknown biome', () => {
  const draw = (biome: string, seed: number) => Array.from({ length: 400 }, (_, day) => weatherFor(biome, day, seed));
  assert.deepEqual(draw('ash-wastes', 7), draw('ash-wastes', 7), 'same seed = same weather, day by day');
  assert.notDeepEqual(draw('ash-wastes', 7), draw('ash-wastes', 8), 'another seed, another year');
  const n = (k: string) => draw('ash-wastes', 7).filter((x) => x === k).length;
  assert.ok(n('dust') > n('ash') && n('ash') > n('embers') && n('embers') > 0, `weights 6:3:1 order the draw (${n('dust')}/${n('ash')}/${n('embers')})`);
  assert.ok(draw('drowned-marsh', 7).every((k) => k && ['rain', 'drips', 'dust'].includes(k)), 'only the biome\'s own picks');
  assert.equal(weatherFor('no-such-biome', 3, 7), null, 'a biome with no row has no weather');
  const w = (picks: object, biome = 'ash-wastes') => { const x = copy(); (x.weather as Record<string, unknown>)[biome] = { order: 1, picks }; return () => loadClockDefs(x, KNOWN); };
  assert.throws(w({ hail: 1 }), /weather kind/); assert.throws(w({ dust: 0 }), /weight/); assert.throws(w({ dust: 1 }, 'moon'), /biome/); assert.throws(w({}), /no picks/);
  const x = copy(); (x.weather as Record<string, unknown>)['ash-wastes'] = { order: 1, picks: { rain: 1 } };
  assert.equal(weatherFor('ash-wastes', 0, 1, x), 'rain', 'a one-pick biome is that kind: a new weather table is one row');
});
