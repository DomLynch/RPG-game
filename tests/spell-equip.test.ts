import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equipSpell, equippedSpell, ownedSpells, setOwnedSpells, useSpellStore } from '../src/core/spell-equip.ts';
import { entriesOf } from '../src/core/grimoire-model.ts';
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';
import { isSpellId } from '../src/fight/spell-cast.ts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
const bricks = { root: 'longShadow', modifiers: [], suffix: null };

test('the equipped spell is a pick from the book: none before a pick, the pick once owned, none again when the book no longer holds it', () => {
  useSpellStore(memory()); setOwnedSpells([]);
  assert.deepEqual(ownedSpells(), []); assert.equal(equippedSpell(), undefined);
  setOwnedSpells(['alvis', 'alvis', 'andvari']); assert.deepEqual(ownedSpells(), ['alvis', 'andvari'], 'ids once each');
  equipSpell('andvari'); assert.equal(equippedSpell(), 'andvari');
  equipSpell('not-in-the-book'); assert.equal(equippedSpell(), undefined, 'an id outside the book clears the pick');
  equipSpell('alvis'); setOwnedSpells(['andvari']); assert.equal(equippedSpell(), undefined, 'a book that shrank drops the pick');
  equipSpell(undefined); setOwnedSpells(['alvis']); assert.equal(equippedSpell(), undefined, 'cleared stays cleared');
});

test('a viewer without storage never keeps a pick and never throws', () => {
  useSpellStore(undefined); setOwnedSpells(['alvis']); equipSpell('alvis'); assert.equal(equippedSpell(), undefined);
  useSpellStore({ getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); }, removeItem: () => { throw Error('blocked'); } });
  equipSpell('alvis'); assert.equal(equippedSpell(), undefined);
});

test('an entry carries its school colour and level from the rows, and every grimoire id the catalogue holds is a spell the fight can resolve', () => {
  const [e] = entriesOf([{ legend: 'alvis', bricks }], SPELL_INFO);
  assert.match(e!.color, /^#[0-9a-f]{6}$/i); assert.ok(Number.isInteger(e!.level) && e!.level >= 1 && e!.level <= 10, `level ${e!.level}`);
  assert.equal(entriesOf([{ legend: 'zed-the-new', bricks }], SPELL_INFO)[0]!.color, '', 'an unknown legend has no colour, not a made-up one');
  for (const id of Object.keys(SPELL_INFO)) assert.ok(isSpellId(id), `${id} is a spell id`);
});
