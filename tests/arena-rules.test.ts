// The pit's geometry and the arena themes are data (src/arena-rules-defs.json, src/arena-themes.json): every value equals the literal it replaced.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ARENA_RULES, arenaRule, loadArenaRules } from '../src/arena-rules.ts';
import { LAYOUT, PLAY_RADIUS, CAMERA_CLAMP, SAND_TILE } from '../src/arena.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import DEFS from '../src/arena-rules-defs.json' with { type: 'json' };

test('the pit geometry equals the literals it replaced', () => {
  assert.deepEqual([PLAY_RADIUS, CAMERA_CLAMP, SAND_TILE], [8.55, 11.5, 3]);
  assert.deepEqual(LAYOUT, { wall: { inner: 11.7, outer: 12.5, top: 2.6 }, tiers: [3.4, 4.2, 5.0, 5.8, 6.6], tierDepth: 1.6, gate: Math.PI, gateWidth: 3.2, colonnade: 21.4, parapet: { inner: 22.4, outer: 23.2, top: 8.6 }, segments: 96 });
  assert.deepEqual([arenaRule('propTextureFull'), arenaRule('propTexturePhone')], [512, 256]);
  assert.equal(arenaRule('rungsPerArena'), 2, 'two ladder rungs per arena band (arenaBand)');
  assert.deepEqual([arenaRule('rubbleTiers'), arenaRule('moteFloor')], [3, 0.15], 'rubble tiers and the mote floor');
  assert.equal(ARENA_RULES.length, 23);
});
test('the fifteen themes are byte-identical to the ones the code had before they became rows', () => {
  assert.deepEqual(Object.keys(ARENA_THEMES), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'a', 'b', 'c', 'd']);
  assert.equal(createHash('sha256').update(JSON.stringify(ARENA_THEMES)).digest('hex'), '2bfcf5ed28a832d2d6074856ec056fb0dbdef28c77c002d18693b310107fbe3c');
  assert.equal(ARENA_THEMES['5']!.backdrop, '/arena/backdrop-5.webp');
  assert.equal(ARENA_THEMES['a']!.name, 'The Night Pit');
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadArenaRules({ rules: rows.filter((r) => r.id !== 'playRadius') }), /"playRadius" rule by name/);
  assert.throws(() => loadArenaRules({ rules: rows.map((r) => (r.id === 'segments' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadArenaRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadArenaRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 24);
});
