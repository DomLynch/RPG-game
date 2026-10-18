import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutfit, dressedSet, dropSet, groundItemOf, weaponPiece } from './outfit.ts';
import { dropLook } from './ground-looks.ts';
import type { Loadout } from '../world/loadouts-rules.ts';

const row = { id: 'x', label: 'X', tier: 'medium', weapon: 'gladius', pieces: ['goblin.Helmet', 'goblin.Body', 'goblin.Boots'] } as unknown as Loadout;

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

test('outfit: one piece per slot (a new take replaces the old, keeping its own rung), weapons are kept apart from worn armour, and it is page memory only (a new outfit is empty)', () => {
  const o = createOutfit();
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
  assert.deepEqual(createOutfit().ids(), [], 'a reload starts empty: nothing is stored');
});

test('dressedSet (Lead 2026-10-18): a LISTED zone wears the account gear unchanged; an UNLISTED zone replaces the account piece in each slot a piece was taken for and keeps the rest; leaving restores the account gear', () => {
  const account = { ids: ['knight.Helmet', 'knight.Body', 'knight.Boots'], tiers: { 'knight.Helmet': 'Master', 'knight.Body': 'Master', 'knight.Boots': 'Veteran' } };
  const o = createOutfit(); o.take('goblin.Helmet', 'Champion');
  // 1. listed zone: no change, whatever was taken
  assert.deepEqual(dressedSet(account, o, false), { ids: account.ids, tiers: account.tiers });
  // 2. unlisted zone: the helmet slot is the taken goblin helmet at the rung it was won at; body and boots keep the account gear and its rungs
  const sandbox = dressedSet(account, o, true);
  assert.deepEqual([...sandbox.ids].sort(), ['goblin.Helmet', 'knight.Body', 'knight.Boots']);
  assert.deepEqual(sandbox.tiers, { 'knight.Body': 'Master', 'knight.Boots': 'Veteran', 'goblin.Helmet': 'Champion' });
  assert.ok(!sandbox.ids.includes('knight.Helmet'), 'the account helmet is replaced, not stacked');
  // 3. exit: the outfit is page memory; once it is gone (a reload, or leaving the zone) the account gear comes back untouched
  o.clear();
  assert.deepEqual(dressedSet(account, o, true), { ids: account.ids, tiers: account.tiers });
  assert.deepEqual(dressedSet(account, createOutfit(), true), { ids: account.ids, tiers: account.tiers }, 'a new page: empty outfit');
});

test('every piece the loadouts can drop has a ground look row (armour by its id, a weapon by its slot)', async () => {
  const { loadoutIds, loadoutRow } = await import('../world/loadouts-rules.ts');
  assert.equal(groundItemOf('goblin.Helmet'), 'loot:goblin.Helmet');
  assert.equal(groundItemOf('goblin.Warhammer'), 'loot:weapon.Warhammer');
  assert.equal(groundItemOf('executioner.Maul'), 'loot:weapon.Maul');
  const missing: string[] = [];
  for (const id of loadoutIds()) for (const piece of dropSet(loadoutRow(id), 'x', 0)) { try { dropLook(groundItemOf(piece)); } catch { missing.push(piece); } }
  assert.deepEqual([...new Set(missing)], [], 'every droppable piece lies as itself (the gloves are the kit-wide ~kit.Gloves draws)');
});

