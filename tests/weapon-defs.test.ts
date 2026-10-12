// Weapons as data (RV44): the resolved table is byte-identical to the code tables it replaced, a weapon is one row, and the loader refuses a broken table at load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GRIPS, GUARDS, MATERIALS, MOVES, PATHS, PLAYER_WEAPONS, PLAYER_WEAPONS_OFFERED, WEAPONS, isWeaponId, weaponOf } from '../src/fight/moves.ts';
import { loadWeaponDefs } from '../src/fight/weapons.ts';

const raw = JSON.parse(readFileSync(new URL('../src/fight/weapon-defs.json', import.meta.url), 'utf8')) as { weapons: Record<string, unknown>[] };
const base = { moves: MOVES, paths: PATHS }, enums = { materials: MATERIALS, guards: GUARDS, grips: GRIPS };
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
const digest = (weapons: unknown, order: unknown, player: unknown, offered: unknown) => createHash('sha256').update(JSON.stringify(canon({ weapons, order, player, offered }))).digest('hex');

// The sha256 of the fully resolved table as the CODE built it before slice 4 (the 11 Weapon objects, their order, and both player lists), computed on trunk before any of this moved.
const BEFORE = 'b45aecd8b6e6cb3843e0e63b9a82ee259457829e4be1caa4b290f9d2600a58b9';

test('the loaded weapons are byte-identical to the code tables they replaced (sha256 of the resolved table, order and both player lists)', () => {
  assert.equal(digest(WEAPONS, Object.keys(WEAPONS), PLAYER_WEAPONS, PLAYER_WEAPONS_OFFERED), BEFORE);
  assert.deepEqual(Object.keys(WEAPONS), ['longsword', 'trident', 'cleaver', 'estoc', 'knife', 'gladius', 'scythe', 'maul', 'reaper', 'warhammer', 'bite']);
  assert.deepEqual([...PLAYER_WEAPONS], ['longsword', 'cleaver', 'knife', 'estoc', 'gladius', 'warhammer', 'trident', 'scythe', 'maul']);
});
test('a 12th weapon is ONE row extending an existing one, through the real loader, with no code edit', () => {
  const row = { id: 'club', extends: 'cleaver', material: 'wood', reach: 1.6, moves: { heavy_overhead: { damage: 19 } } };
  const t = loadWeaponDefs({ weapons: [...raw.weapons, row] }, base, enums);
  assert.equal(Object.keys(t.weapons).length, 12);
  assert.equal(t.weapons.club!.material, 'wood');
  assert.equal(t.weapons.club!.moves.heavy_overhead.damage, 19);
  assert.equal(t.weapons.club!.moves.heavy_overhead.reach, WEAPONS.cleaver!.moves.heavy_overhead.reach, 'the fields it does not name come from the weapon it extends');
  assert.equal(t.weapons.club!.guard, WEAPONS.cleaver!.guard);
  assert.deepEqual(t.player, [...PLAYER_WEAPONS], 'a new row is not a player weapon until it says so');
});
test('weaponOf and isWeaponId: an unknown id is refused, an inherited property name is not a weapon', () => {
  assert.equal(weaponOf('trident').id, 'trident');
  assert.throws(() => weaponOf('sling'), /unknown weapon "sling"/);
  assert.equal(isWeaponId('knife'), true);
  assert.equal(isWeaponId('constructor'), false);
  assert.equal(isWeaponId(7), false);
});
test('the loader refuses a duplicate id, an extends cycle, an unknown parent, a missing move, a bad enum and a bad number, at load', () => {
  const ok = raw.weapons, load = (rows: unknown[]) => loadWeaponDefs({ weapons: rows }, base, enums);
  assert.doesNotThrow(() => load(ok));
  assert.throws(() => load([...ok, { id: 'knife' }]), /duplicate-id/);
  assert.throws(() => load([...ok, { id: 'a', extends: 'b' }, { id: 'b', extends: 'a' }]), /extends itself/);
  assert.throws(() => load([...ok, { id: 'a', extends: 'nothing' }]), /unknown-ref: extends = "nothing" is not a weapon id/);
  assert.throws(() => load([{ id: 'bare', guard: 'blade', material: 'iron', grip: 'two-hand', reach: 2, fight: { thrustShare: .2, close: 1 }, moves: { thrust: null }, paths: {} }]), /moves has no "thrust"|moves has no/);
  assert.throws(() => load([...ok, { id: 'a', extends: 'knife', material: 'glass' }]), /material "glass"/);
  assert.throws(() => load([...ok, { id: 'a', extends: 'knife', guard: 'cloth' }]), /guard "cloth"/);
  assert.throws(() => load([...ok, { id: 'a', extends: 'knife', grip: 'three-hand' }]), /grip "three-hand"/);
  assert.throws(() => load([...ok, { id: 'a', extends: 'knife', reach: 'long' }]), /reach is a number/);
  assert.throws(() => load([...ok, { id: 'a', extends: 'knife', fight: 5 }]), /fight needs/);
  assert.throws(() => load([{ guard: 'blade' }]), /bad-key/);
});
