import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equipSpell, equippedSpell, equippedSpells, onSpellsChanged, ownedSpells, setOwnedSpells, useSpellStore } from '../src/core/spell-equip.ts';
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

test('two slots: a pick per slot, the old one-spell key reads into slot a, a spell moves rather than doubles, a clear empties its own slot', () => {
  const m = new Map<string, string>(); const mem = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
  useSpellStore(mem); setOwnedSpells(['alvis', 'andvari', 'redcap']);
  m.set('frankendom.spell.equipped.v1', 'alvis');
  assert.deepEqual(equippedSpells(), ['alvis', undefined], 'the old key is slot a');
  equipSpell('andvari', 1); assert.deepEqual(equippedSpells(), ['alvis', 'andvari']); assert.equal(m.get('frankendom.spell.slots.v1'), '["alvis","andvari"]');
  equipSpell('alvis', 1); assert.deepEqual(equippedSpells(), [undefined, 'alvis'], 'the same spell is not in both slots: it moved');
  equipSpell(undefined, 1); assert.deepEqual(equippedSpells(), [undefined, undefined]); assert.equal(m.has('frankendom.spell.slots.v1'), false); assert.equal(m.has('frankendom.spell.equipped.v1'), false, 'an empty book clears the old key too');
  equipSpell('redcap', 5); assert.deepEqual(equippedSpells(), [undefined, undefined], 'a slot the rows do not have is ignored');
  let calls = 0; onSpellsChanged(() => { calls++; }); equipSpell('redcap', 0); assert.equal(calls, 1); assert.equal(equippedSpell(), 'redcap'); assert.equal(equippedSpell(1), undefined);
  setOwnedSpells(['andvari']); assert.deepEqual(equippedSpells(), [undefined, undefined], 'a book that shrank drops the pick');
});
