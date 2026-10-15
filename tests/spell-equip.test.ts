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

test('player saves: an old one-spell save loads as A = X, B = empty; the next save writes the new form without dropping X; junk leaves both slots empty and never throws', () => {
  const fresh = (init: Record<string, string>) => { const m = new Map(Object.entries(init)); const mem = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; useSpellStore(mem); return m; };
  // X survives a save into the other slot, even before the book has loaded (owned is empty, so X is hidden but kept)
  let m = fresh({ 'frankendom.spell.equipped.v1': 'alvis' }); setOwnedSpells([]);
  assert.deepEqual(equippedSpells(), [undefined, undefined], 'not yet in the book: hidden, not lost');
  setOwnedSpells(['alvis', 'andvari']); assert.deepEqual(equippedSpells(), ['alvis', undefined], 'A = X, B = empty');
  equipSpell('andvari', 1); assert.equal(m.get('frankendom.spell.slots.v1'), '["alvis","andvari"]', 'the new form keeps X in slot a');
  // equipping B before the book loaded must not drop X either
  m = fresh({ 'frankendom.spell.equipped.v1': 'alvis' }); setOwnedSpells(['andvari']);
  equipSpell('andvari', 1); assert.equal(m.get('frankendom.spell.slots.v1'), '["alvis","andvari"]', 'X is not owned yet but is not overwritten');
  // a corrupt new-form value falls back to the old key
  m = fresh({ 'frankendom.spell.slots.v1': '{not json', 'frankendom.spell.equipped.v1': 'alvis' }); setOwnedSpells(['alvis']);
  assert.deepEqual(equippedSpells(), ['alvis', undefined], 'corrupt new key, valid old key: X still loads');
  // junk and unknown values: both slots empty, no throw
  for (const [k, v] of [['frankendom.spell.equipped.v1', 'not-a-spell-id'], ['frankendom.spell.equipped.v1', ''], ['frankendom.spell.slots.v1', '{not json'], ['frankendom.spell.slots.v1', '42'], ['frankendom.spell.slots.v1', '[1,{"a":1},null]']] as const) {
    fresh({ [k]: v }); setOwnedSpells(['alvis', 'andvari']);
    assert.doesNotThrow(() => equippedSpells(), `${k}=${v}`); assert.deepEqual(equippedSpells(), [undefined, undefined], `${k}=${v}`);
  }
});
