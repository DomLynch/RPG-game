// The engine's gear screen over the ONE item ledger (src/core/gear-ledger.ts): a gear_open reply reads into the Loot the sheet draws, and wear / stow become the server's calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyLocal, lootOfView, stepsFor, stepsToStow, stepsToWear, viewOf, type GearPiece, type GearView } from '../src/core/gear-ledger.ts';
import { emptyLoot, stow, unwear, wear, wearFromPack, type LootId } from '../src/core/loot.ts';
import { TIERS } from '../src/core/grades.ts';
import { wornGear } from '../src/fight/gear-stats.ts';
import { sheetFor } from '../src/fight/gear-numbers.ts';
import { sheetOf } from '../src/fight/sheet-rows.ts';

const piece = (id: string, lootId: string | null, where: GearPiece['where'], over: Partial<GearPiece> = {}): GearPiece =>
  ({ id, item: lootId ? `item:loot.${lootId}` : 'item:grave-iron', lootId, slot: null, where, index: where === 'equipped' ? null : 0, paperdoll: null, tier: null, version: 1, level: 0, ...over });
const view = (pieces: GearPiece[], worn: Record<string, string> = {}): GearView => ({ pieces, stock: [], worn, packSize: 8, bankSize: 100 });
// goblin rank-1 pieces (Strategy 2026-10-09: the first drop): a helmet in the pack, a body worn
const pack = view([piece('i1', 'goblin.Helmet', 'pack', { index: 1, tier: 'Veteran' }), piece('i2', 'goblin.Body', 'equipped', { paperdoll: 'chest' }), piece('i3', 'dwarf.Greaves', 'pack', { index: 0 }), piece('i4', null, 'pack', { index: 2 })], { chest: 'i2' });

test('a gear_open reply reads into the Loot the sheet draws: owned, the pack in grid order, worn by slot key, the rung as the tier; a non-loot item is not gear on the sheet', () => {
  const loot = lootOfView(pack);
  assert.deepEqual([...loot.owned].sort(), ['dwarf.Greaves', 'goblin.Body', 'goblin.Helmet']);
  assert.deepEqual(loot.pack, ['dwarf.Greaves', 'goblin.Helmet'], 'grid order, not reply order');
  assert.deepEqual(loot.equipped, { chest: 'goblin.Body' });
  assert.equal(loot.taken?.['goblin.Helmet' as keyof typeof loot.taken]?.tier, 4, 'Veteran is rung 4');
});
test('a reply that is not the documented shape is no reply', () => {
  assert.equal(viewOf(null), null); assert.equal(viewOf({}), null); assert.equal(viewOf({ pieces: [{ id: 1 }], worn: {}, packSize: 8, bankSize: 1 }), null);
  assert.deepEqual(viewOf(pack), pack);
});
test('wearing: an empty slot is one equip; an occupied slot comes off into the pack first (the server has no silent swap); worn or unknown is nothing', () => {
  assert.deepEqual(stepsToWear(pack, 'goblin.Helmet'), [{ op: 'gear_equip', id: 'i1' }]);
  const other = view([piece('i2', 'goblin.Body', 'equipped', { paperdoll: 'chest' }), piece('i6', 'veteran.Body', 'pack')], { chest: 'i2' });
  assert.deepEqual(stepsToWear(other, 'veteran.Body'), [{ op: 'gear_unequip', id: 'i2' }, { op: 'gear_equip', id: 'i6' }]);
  assert.deepEqual(stepsToWear(pack, 'nobody.Helmet' as never), []);
});
test('stowing a worn slot is one unequip; an empty slot is nothing', () => {
  assert.deepEqual(stepsToStow(pack, 'chest'), [{ op: 'gear_unequip', id: 'i2' }]);
  assert.deepEqual(stepsToStow(pack, 'head'), []);
});

test('one decision point: a local op is exactly the ledger function it names; a server op is the calls stepsFor names', () => {
  const loot = { ...emptyLoot(), owned: ['goblin.Helmet', 'goblin.Body'] as never[], pack: ['goblin.Helmet'] as never[] };
  assert.deepEqual(applyLocal(loot, { kind: 'wear', id: 'goblin.Body' as never }), wear(loot, 'goblin.Body' as never));
  assert.deepEqual(applyLocal(loot, { kind: 'wearFromPack', id: 'goblin.Helmet' as never }), wearFromPack(loot, 'goblin.Helmet' as never));
  const worn = wear(loot, 'goblin.Body' as never);
  assert.deepEqual(applyLocal(worn, { kind: 'unwear', key: 'chest' }), unwear(worn, 'chest'));
  assert.deepEqual(applyLocal(worn, { kind: 'stow', key: 'chest' }), stow(worn, 'chest'));
  assert.deepEqual(stepsFor(pack, { kind: 'wear', id: 'goblin.Helmet' as never }), stepsToWear(pack, 'goblin.Helmet' as never));
  assert.deepEqual(stepsFor(pack, { kind: 'wearFromPack', id: 'goblin.Helmet' as never }), stepsToWear(pack, 'goblin.Helmet' as never));
  assert.deepEqual(stepsFor(pack, { kind: 'unwear', key: 'chest' }), stepsToStow(pack, 'chest')); assert.deepEqual(stepsFor(pack, { kind: 'stow', key: 'chest' }), stepsToStow(pack, 'chest'));
});
test('the gear sheet decides nothing itself: every wear / stow click goes through its one `act`, and the sheet imports no ledger function that could bypass it', () => {
  const sheet = readFileSync(new URL('../src/core/gear-sheet.ts', import.meta.url), 'utf8');
  assert.equal((sheet.match(/\bact\(\{ kind:|\bact\(isWorn/g) ?? []).length >= 4, true, 'the rack button, Wear this, Store, and each slot\'s Store go through act'); assert.match(sheet, /d\.act\?\.\(op\)/, 'a signed-in character\'s op goes to the server first');
  assert.doesNotMatch(sheet, /import \{[^}]*\b(wear|unwear|stow|wearFromPack)\b[^}]*\} from '\.\/loot\.ts'/, 'no direct ledger call in the sheet');
  assert.match(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), /createGearSheet\(/, 'the Pit mounts the sheet');
});

test('inventory.equip: "is not in the backpack" - a banked piece is never offered, so no unequip commits before an equip the server would refuse', () => {
  const v = view([piece('i1', 'goblin.Body', 'equipped', { paperdoll: 'chest' }), piece('i2', 'veteran.Body', 'bank', { index: 3 })], { chest: 'i1' });
  assert.deepEqual(stepsToWear(v, 'veteran.Body' as never), []);
});
test('a duplicate lootId resolves to its PACK instance, never the worn or banked one (inventory.equip takes from the pack only)', () => {
  const v = view([piece('i1', 'goblin.Helmet', 'equipped', { paperdoll: 'head' }), piece('i2', 'goblin.Helmet', 'bank'), piece('i3', 'goblin.Helmet', 'pack', { index: 2 })], { head: 'i1' });
  assert.deepEqual(stepsToWear(v, 'goblin.Helmet' as never), [{ op: 'gear_unequip', id: 'i1' }, { op: 'gear_equip', id: 'i3' }]);
  const worn = view([piece('i1', 'goblin.Helmet', 'equipped', { paperdoll: 'head' })], { head: 'i1' });
  assert.deepEqual(stepsToWear(worn, 'goblin.Helmet' as never), [], 'worn and nowhere in the pack: nothing to put on');
});
test('inventory.unequip needs a free pack cell: swapping over an occupied slot with a full pack is refused up front (no unequip that would fail), an empty slot still equips', () => {
  const full = { ...view([piece('i1', 'goblin.Body', 'equipped', { paperdoll: 'chest' }), piece('i2', 'veteran.Body', 'pack'), piece('i3', 'goblin.Helmet', 'pack', { index: 1 })], { chest: 'i1' }), packSize: 2 };
  assert.deepEqual(stepsToWear(full, 'veteran.Body' as never), []);
  assert.deepEqual(stepsToWear(full, 'goblin.Helmet' as never), [{ op: 'gear_equip', id: 'i3' }], 'the head slot is empty: no swap, no free cell needed');
});

// Auditor 2026-10-13: the same loot id held twice (a worn Origin Helmet and a packed Recruit Helmet). The server's frozen worn gear reads the WORN instance's tier; lootOfView used to keep the LAST row's, so the client's
// sheet depended on row order (armour 5 on the client, 7 + health 2 + poise 1 on the server). The worn instance decides, in both orders.
test('a duplicate loot id, worn at one rung and packed at another: the worn instance\'s tier wins in both row orders, and the sheet is the server\'s', () => {
  const origin = TIERS[TIERS.length - 1]!, recruit = TIERS[0]!;
  const worn = piece('w1', 'veteran.Helmet', 'equipped', { paperdoll: 'head', tier: origin }), packed = piece('p1', 'veteran.Helmet', 'pack', { tier: recruit });
  const own = { level: 0, placed: {} as Record<string, number> };
  const HELMET = 'veteran.Helmet' as LootId;
  for (const [name, pieces] of [['worn row first', [worn, packed]], ['pack row first', [packed, worn]]] as const) {
    const loot = lootOfView(view([...pieces], { head: 'w1' }));
    assert.equal(loot.taken![HELMET]!.tier, TIERS.length, `${name}: the tier is the worn Origin piece's`);
    assert.deepEqual(sheetFor(loot, own), sheetOf(own, wornGear({ head: HELMET }, (id) => (id === HELMET ? origin : undefined))), `${name}: the client sheet is what the server computes from the worn piece`);
  }
  const flipped = lootOfView(view([piece('w1', 'veteran.Helmet', 'equipped', { paperdoll: 'head', tier: recruit }), piece('p1', 'veteran.Helmet', 'pack', { tier: origin })], { head: 'w1' }));
  assert.equal(flipped.taken![HELMET]!.tier, 1, 'worn Recruit + packed Origin: the worn Recruit rung wins');
  const bare = lootOfView(view([piece('w1', 'veteran.Helmet', 'equipped', { paperdoll: 'head', tier: null }), piece('p1', 'veteran.Helmet', 'pack', { tier: origin })], { head: 'w1' }));
  assert.equal(bare.taken![HELMET], undefined, 'a worn piece with no rung is identity on the server: the packed copy\'s rung must not leak into the sheet');
});
