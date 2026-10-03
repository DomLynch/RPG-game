import test from 'node:test';
import assert from 'node:assert/strict';
import { classSpecialFor } from '../src/class-special-identity.ts';
import { ROSTER, type OpponentId } from '../src/roster.ts';

test('the six approved Weapons identities follow ranks 1–3 and 4–7, never boss ranks', () => {
  const expected = {
    witch: ['wake', 'stirring'],
    plaguedoctor: ['tempo', 'pulse'],
    knight: ['drag', 'swing'],
  } as const;
  for (const opponent of Object.keys(expected) as (keyof typeof expected)[]) {
    for (let level = 1; level <= 46; level++) {
      const id = level <= 15 ? expected[opponent][0] : level <= 35 ? expected[opponent][1] : null;
      assert.equal(classSpecialFor(opponent, level), id, `${opponent} at fight level ${level}`);
    }
  }
});

test('Pale Lunge and Seven Cuts occupy the approved Nightborn class bands', () => {
  for (let level = 1; level <= 46; level++) {
    assert.equal(classSpecialFor('nightborn', level), level <= 15 ? 'lunge' : level <= 35 ? 'cuts' : null);
  }
});

test('Veteran and Goblin identities follow both approved class bands, with no boss fallback', () => {
  for (const [opponent, id, early] of [['veteran', 'standfast', 'setfoot'], ['goblin', 'ratrun', 'knuckledirt']] as const) {
    for (let level = 1; level <= 46; level++) {
      assert.equal(classSpecialFor(opponent, level), level <= 15 ? early : level <= 35 ? id : null, `${opponent}:${level}`);
    }
    for (const level of [15.5, 16.5, 35.5, NaN, Infinity]) assert.equal(classSpecialFor(opponent, level), null);
  }
});

test('unresolved opponents stay unknown in every rank', () => {
  for (const opponent of Object.keys(ROSTER) as OpponentId[]) {
    if (['witch', 'plaguedoctor', 'knight', 'nightborn', 'veteran', 'goblin', 'executioner', 'pitborn', 'dwarf', 'shieldmaiden'].includes(opponent)) continue;
    for (let level = 1; level <= 46; level++) assert.equal(classSpecialFor(opponent, level), null, `${opponent}:${level}`);
  }
});

test('invalid fight levels cannot silently choose an approved identity', () => {
  for (const level of [-1, 0, 1.5, 15.5, NaN, Infinity, -Infinity]) assert.equal(classSpecialFor('witch', level), null);
});

test('each actor uses its own opponent and fight level without retaining the other actor’s choice', () => {
  const actors = [['witch', 15], ['knight', 16]] as const;
  const select = (actors: readonly (readonly [OpponentId, number])[]) => actors.map(([opponent, level]) => classSpecialFor(opponent, level));
  assert.deepEqual(select(actors), ['wake', 'swing']);
  assert.deepEqual(select([...actors].reverse()), ['swing', 'wake']);
  assert.deepEqual(select([['veteran', 16], ['goblin', 35]]), ['standfast', 'ratrun']);
  assert.deepEqual(select([['goblin', 16], ['veteran', 35]]), ['ratrun', 'standfast']);
  assert.deepEqual(select(actors), ['wake', 'swing']);
  assert.deepEqual(select([['witch', 16], ['knight', 15]]), ['stirring', 'drag']);
});
