import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookOf } from '../src/core/grimoire-net.ts';
import { EMPTY, bricksOf, entriesOf } from '../src/core/grimoire-model.ts';
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';

const bricks = { root: 'longShadow', modifiers: [], suffix: null };

test('grimoire_get answers are read by shape: a good book, an empty one, and anything malformed is null (never a half book)', () => {
  assert.deepEqual(bookOf({ spells: [{ legend: 'alvis', bricks }] }), [{ legend: 'alvis', bricks }]);
  assert.deepEqual(bookOf({ spells: [] }), []);
  for (const bad of [null, {}, { spells: 'x' }, { spells: [{ legend: 'a' }] }, { spells: [{ legend: '', bricks }] }, { spells: [{ legend: 'a', bricks: { root: 'r', modifiers: [3], suffix: null } }] }, { spells: [{ legend: 'a', bricks: { root: 'r', modifiers: [], suffix: 4 } }] }, { spells: [{ legend: 'a', bricks }, { nope: 1 }] }]) assert.equal(bookOf(bad), null, JSON.stringify(bad));
});

test('an entry names the legend, its family and its spell from the catalogue, and the bricks root, modifiers, suffix in order', () => {
  const [e] = entriesOf([{ legend: 'alvis', bricks: { root: 'longShadow', modifiers: ['crack', 'mend-wounds'], suffix: 'echo' } }], SPELL_INFO);
  assert.equal(e!.name, 'Alvis'); assert.equal(e!.family, 'Dwarf'); assert.equal(e!.spell, "All-Wise's Riddles"); assert.equal(e!.school, 'Wind');
  assert.deepEqual(e!.bricks, ['Long Shadow', 'Crack', 'Mend Wounds', 'Echo']);
  assert.deepEqual(bricksOf(bricks), ['Long Shadow'], 'no modifiers and no suffix: the root alone');
});

test('a legend the catalogue does not know (added server-side first) still lists, by a readable form of its id, and the list is sorted by name', () => {
  const list = entriesOf([{ legend: 'zed-the-new', bricks }, { legend: 'alvis', bricks }], SPELL_INFO);
  assert.deepEqual(list.map((x) => x.name), ['Alvis', 'Zed The New']);
  assert.equal(list[1]!.family, ''); assert.equal(list[1]!.spell, '');
});

test('a legend that is its own family shows no family line (most of the book), a kind-family does (Alvis is a dwarf)', () => {
  const own = Object.entries(SPELL_INFO).find(([, i]) => i.family && i.family.toLowerCase().replace(/[^a-z0-9]/g, '') === i.legend.toLowerCase().replace(/[^a-z0-9]/g, ''));
  assert.ok(own, 'the catalogue has a self-family legend'); assert.equal(entriesOf([{ legend: own![0], bricks }], SPELL_INFO)[0]!.family, '');
  assert.equal(entriesOf([{ legend: 'alvis', bricks }], SPELL_INFO)[0]!.family, 'Dwarf');
});

test('the catalogue knows a spell for every id the server can grant, and the empty-book sentence is the one Lead asked for', () => {
  assert.equal(Object.keys(SPELL_INFO).length > 600, true, `${Object.keys(SPELL_INFO).length} spells`);
  assert.equal(EMPTY, 'Beat a legend to take their spell');
});
