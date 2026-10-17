// A dropped item on the sheet (Web, Lead 2026-10-17, the client side of Strategy's #3 loot + gear; Backend #3052: a piece's `tier` IS the minted rung's name, `level` is the upgrade level):
// each pack cell carries its OWN rung (two copies of one id at different rungs are what the mint's rarity shift makes common), the backpack row shows what THAT piece gives, trying it on and wearing it
// use that cell, and equipping changes the sheet's numbers. The numbers are a pure function of (lootId, rung) from the Attack/RES table, so there is no server field to agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lootOfView, rungOf, stepsFor, stepsToWear, type GearPiece, type GearView } from '../src/core/gear-ledger.ts';
import { pieceLine } from '../src/core/gear-strip.ts';
import { TIERS } from '../src/core/grades.ts';
import { wear, type Loot, type LootId } from '../src/core/loot.ts';
import { gearNumbers, pieceNumbers } from '../src/fight/gear-numbers.ts';

const piece = (id: string, lootId: string, where: GearPiece['where'], over: Partial<GearPiece> = {}): GearPiece =>
  ({ id, item: `item:loot.${lootId}`, lootId, slot: null, where, index: where === 'equipped' ? null : 0, paperdoll: null, tier: null, version: 1, level: 0, ...over });
const view = (pieces: GearPiece[], worn: Record<string, string> = {}): GearView => ({ pieces, stock: [], worn, packSize: 8, bankSize: 100 });
const HELMET = 'goblin.Helmet' as LootId, LOW = TIERS[1]!, HIGH = TIERS[3]!;   // a fine-ish and a high rung; the ladder is data (grades.ts), never spelled here
// two packed goblin helmets from different drops, the later one in cell 1
const twin = view([piece('a', HELMET, 'pack', { index: 0, tier: LOW }), piece('b', HELMET, 'pack', { index: 1, tier: HIGH })]);

test('the rung is the tier NAME the server minted (level is the upgrade level, never the rung)', () => {
  TIERS.forEach((t, i) => assert.equal(rungOf(t), i + 1));
  assert.equal(rungOf(null), 0); assert.equal(rungOf('Nonsense'), 0);
  const loot = lootOfView(view([piece('a', HELMET, 'pack', { index: 0, tier: HIGH, level: 7 })]));
  assert.equal(loot.packInfo?.[0]?.tier, rungOf(HIGH), 'level 7 is an upgrade, the rung still comes from the tier');
});
test('each pack cell keeps its own rung and server piece id: two copies of one id are told apart', () => {
  const loot = lootOfView(twin);
  assert.deepEqual(loot.pack, [HELMET, HELMET]);
  assert.deepEqual(loot.packInfo, [{ tier: rungOf(LOW), piece: 'a' }, { tier: rungOf(HIGH), piece: 'b' }]);
});
test('wearing a cell equips THAT copy; no cell, or a stale one, equips the first copy', () => {
  assert.deepEqual(stepsToWear(twin, HELMET, 1), [{ op: 'gear_equip', id: 'b' }]);
  assert.deepEqual(stepsFor(twin, { kind: 'wearFromPack', id: HELMET, at: 1 }), [{ op: 'gear_equip', id: 'b' }]);
  assert.deepEqual(stepsToWear(twin, HELMET), [{ op: 'gear_equip', id: 'a' }]);
  assert.deepEqual(stepsToWear(twin, HELMET, 9), [{ op: 'gear_equip', id: 'a' }], 'a cell that is gone falls back to the first copy');
  assert.deepEqual(stepsToWear(twin, 'goblin.Greaves' as LootId, 1), [], 'a cell holding another id never equips the wrong piece');
});
test('a piece shows what it gives at its rung: a higher rung gives more, Recruit is the identity and reads "No bonus"', () => {
  assert.equal(pieceLine(pieceNumbers(HELMET, 1)), 'No bonus');
  assert.deepEqual(pieceNumbers(HELMET, 99), {}, 'a rung off the ladder gives nothing');
  const [low, high] = [pieceNumbers(HELMET, rungOf(LOW)), pieceNumbers(HELMET, rungOf(HIGH))];
  assert.ok(high.attack! > low.attack! && high.res! >= low.res!, `${HIGH} ${JSON.stringify(high)} beats ${LOW} ${JSON.stringify(low)}`);
  assert.match(pieceLine(high), /^(ATK \d+|RES \d+)( · RES \d+)?$/, 'the paperdoll\'s "ATK 15 · RES 20" reading, a stat that is 0 left out');
});
test('equipping the dropped piece changes the sheet numbers by exactly what its row said (the strip reads the worn rung)', () => {
  const bare: Loot = { owned: [HELMET], equipped: {}, pack: [HELMET], taken: { [HELMET]: { tier: rungOf(HIGH) } as never } };
  const before = gearNumbers(bare), after = gearNumbers(wear(bare, HELMET)), own = pieceNumbers(HELMET, rungOf(HIGH));
  assert.equal(after.attack! - before.attack!, own.attack, 'the strip moves by the piece line');
  assert.equal(after.res! - before.res!, own.res);
  assert.ok(after.attack! > before.attack!, `a ${HIGH} helmet is a real bonus`);
});
