import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutfit, dropSet, weaponPiece } from './outfit.ts';
import type { Loadout } from '../world/loadouts-rules.ts';

const row = { id: 'x', label: 'X', tier: 'medium', weapon: 'gladius', pieces: ['goblin.Helmet', 'goblin.Body', 'goblin.Boots'] } as unknown as Loadout;
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test('weaponPiece names the weapon as a loot id by the body the pieces belong to', () => {
  assert.equal(weaponPiece(row), 'goblin.Gladius');
  assert.equal(weaponPiece({ ...row, weapon: undefined } as unknown as Loadout), undefined);
  assert.equal(weaponPiece(undefined), undefined);
});

test('dropSet: limit 0 drops everything worn and carried; limit n drops n starting at the normal kill piece; no row drops nothing', () => {
  assert.deepEqual(dropSet(row, 'a', 0), ['goblin.Helmet', 'goblin.Body', 'goblin.Boots', 'goblin.Gladius']);
  assert.equal(dropSet(row, 'a', 1).length, 1);
  assert.equal(dropSet(row, 'a', 2).length, 2);
  assert.equal(new Set(dropSet(row, 'a', 3)).size, 3);
  assert.deepEqual(dropSet(undefined, 'a', 0), []);
});

test('outfit: one piece per slot (a new take replaces the old, keeping its own rung), weapons are kept apart from worn armour, and it survives a reload', () => {
  const store = mem(), o = createOutfit(store);
  assert.deepEqual(o.take('goblin.Helmet', 'Veteran'), {});
  assert.deepEqual(o.take('goblin.Body', 'Master'), {});
  assert.deepEqual(o.take('goblin.Helmet', 'Champion'), {});   // the same piece again is not a replacement, it is taken at the new rung
  assert.deepEqual(o.take('knight.Helmet', 'Praetorian'), { replaced: 'goblin.Helmet' });   // another body's helmet takes the head slot
  assert.deepEqual(o.ids().sort(), ['goblin.Body', 'knight.Helmet']);
  assert.equal(o.tierOf('knight.Helmet'), 'Praetorian');
  assert.equal(o.tierOf('goblin.Body'), 'Master');
  o.take('goblin.Gladius', 'Veteran');
  assert.equal(o.weapon()?.id, 'goblin.Gladius');
  assert.ok(!o.ids().includes('goblin.Gladius'));
  assert.deepEqual(createOutfit(store).ids().sort(), ['goblin.Body', 'knight.Helmet']);
});

test('outfit: a broken or missing store is an empty outfit, never an error', () => {
  assert.deepEqual(createOutfit(null).ids(), []);
  const bad = { getItem: () => '{not json', setItem: () => { throw new Error('full'); } };
  const o = createOutfit(bad); o.take('goblin.Body', 'Veteran'); assert.deepEqual(o.ids(), ['goblin.Body']);
});
