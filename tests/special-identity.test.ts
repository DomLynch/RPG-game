import test from 'node:test';
import assert from 'node:assert/strict';
import { bossSpecialFor, bossSpecialId } from '../src/special-identity.ts';
import { specialOf, type SpecialName } from '../src/moves.ts';
import { ROSTER, type OpponentId } from '../src/roster.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';

const EXPECTED = {
  veteran: ['shield', 'centurion', 'tithe'],
  nightborn: ['set', 'hades', 'nyx'],
  goblin: ['reynard', 'hermes', 'loki'],
  pitborn: ['antaeus', 'surtr', 'typhon'],
  executioner: ['arawn', 'thanatos', 'reaper'],
  dwarf: ['dwarf8', 'dwarf9', 'dwarf10'],
  shieldmaiden: ['shield8', 'shield9', 'shield10'],
  witch: ['mist', 'echo', 'price'],
  plaguedoctor: ['flies', 'stain', 'breath'],
  knight: ['sling', 'haze', 'storm'],
} as const;

test('all ten opponents select their approved identities across every rank boundary', () => {
  for (const opponent of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    for (let level = 1; level <= 46; level++) {
      const expected = level < 36 ? null : EXPECTED[opponent][level < 41 ? 0 : level < 46 ? 1 : 2];
      assert.equal(bossSpecialFor(opponent, level), expected, `${opponent}:${level}`);
    }
  }
});

test('each of the 30 named boss identities resolves to its own registered opponent and level', () => {
  const ids = new Set<string>(), names = new Set<string>();
  for (const opponent of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
    for (const [index, level] of [36, 41, 46].entries()) {
      const name = specialOf(opponent, level)!, id = bossSpecialId(name)!;
      assert.equal(id, EXPECTED[opponent][index]);
      assert.deepEqual([SPECIAL_TESTS[id].opponent, SPECIAL_TESTS[id].level], [opponent, level]);
      names.add(name); ids.add(id);
    }
  }
  assert.equal(names.size, 30); assert.equal(ids.size, 30);
});

test('unmapped names, opponents and invalid levels never fall back to another boss', () => {
  for (const name of [null, 'unknown', 'constructor', 'toString']) assert.equal(bossSpecialId(name as SpecialName | null), null);
  for (const opponent of Object.keys(ROSTER) as OpponentId[]) {
    if (!Object.hasOwn(EXPECTED, opponent)) for (const level of [1, 16, 36, 41, 46]) assert.equal(bossSpecialFor(opponent, level), null);
  }
  for (const level of [0, -1, 35.5, 36.5, 47, NaN, Infinity]) assert.equal(bossSpecialFor('veteran', level), null);
});

test('actor order and later selections cannot change the accepted cast identity', () => {
  const name = specialOf('knight', 41)!;
  assert.deepEqual([bossSpecialFor('knight', 41), bossSpecialFor('veteran', 46)], ['haze', 'tithe']);
  assert.deepEqual([bossSpecialFor('veteran', 46), bossSpecialFor('knight', 41)], ['tithe', 'haze']);
  bossSpecialFor('knight', 46);
  assert.equal(bossSpecialId(name), 'haze');
});
