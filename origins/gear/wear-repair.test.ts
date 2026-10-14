import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPAIR_RULES, WEAR_SLOTS, WEAR_TIERS, checkWearRelations, freshPiece, loadWearRepair, qualityPct, repairCost, repairRule,
  repairedPiece, slotWears, wearAfter, wearTier, wornSlot,
} from './wear-repair.ts';
import DATA from './wear-repair.json' with { type: 'json' };

const tier = (id: string) => wearTier(id)!;

test('the rows load and the relations hold', () => {
  loadWearRepair();
  assert.deepEqual(WEAR_TIERS.map((t) => t.id), ['light', 'medium', 'heavy']);
});

test('tiers match gear-defs and the slots are live armour slots', () => {
  const defs = JSON.parse(readFileSync(new URL('../../src/fight/gear-defs.json', import.meta.url), 'utf8'));
  const text = JSON.stringify(defs);
  for (const t of WEAR_TIERS) assert.ok(text.includes(`"${t.id}"`), `gear-defs has no ${t.id} preset`);
  const loot = readFileSync(new URL('../../src/core/loot.ts', import.meta.url), 'utf8');
  for (const s of WEAR_SLOTS.filter((x) => x.share > 0)) assert.ok(loot.includes(`'${s.id}'`), `${s.id} is not an armour slot`);
});

test('the metal is a live item', () => {
  const loot = readFileSync(new URL('../region1/loot-tables.json', import.meta.url), 'utf8');
  for (const t of WEAR_TIERS) assert.ok(loot.includes(`"${t.metalItem}"`), `${t.metalItem} is not a live item`);
});

test('heavier gear wears slower per event and costs more to mend', () => {
  const [l, m, h] = ['light', 'medium', 'heavy'].map(tier) as [ReturnType<typeof tier>, ReturnType<typeof tier>, ReturnType<typeof tier>];
  assert.ok(l.hitWear > m.hitWear && m.hitWear > h.hitWear);
  assert.ok(l.bronzePerPoint < m.bronzePerPoint && m.bronzePerPoint < h.bronzePerPoint);
});

test('wearAfter: a hit wears only on a roll under the chance, a kill always wears, never past max', () => {
  const p = freshPiece(60);
  assert.equal(wearAfter(tier('light'), p, 'hit', 0.1).worn, 3);
  assert.equal(wearAfter(tier('light'), p, 'hit', 0.25).worn, 0);
  assert.equal(wearAfter(tier('light'), p, 'kill', 0.99).worn, 6);
  assert.equal(wearAfter(tier('light'), { ...p, worn: 58 }, 'kill', 0).worn, 60);
  assert.equal(wearAfter(tier('light'), p, 'nope', 0), p);
});

test('wornSlot walks the shares in order', () => {
  assert.equal(wornSlot(0), 'Body');
  assert.equal(wornSlot(0.36), 'Greaves');
  assert.equal(wornSlot(0.999), 'Boots');
});

test('durability floor: a worn-out piece still gives its floor, never nothing', () => {
  const rule = repairRule()!;
  assert.equal(qualityPct(freshPiece(90)), 100);
  assert.equal(qualityPct({ worn: 90, max: 90, baseMax: 90 }), rule.qualityFloorPct);
  assert.equal(qualityPct({ worn: 500, max: 90, baseMax: 90 }), rule.qualityFloorPct);
  assert.ok(qualityPct({ worn: 0, max: 0, baseMax: 90 }) >= rule.qualityFloorPct);
});

test('repairCost rises with wear, is free when nothing is worn, and is never zero otherwise', () => {
  const t = tier('medium');
  assert.deepEqual(repairCost(t, freshPiece(90)), { points: 0, gold: 0, metal: 0, metalItem: 'item:grave-iron' });
  const light = repairCost(t, { worn: 10, max: 90, baseMax: 90 }, 1);
  const deep = repairCost(t, { worn: 80, max: 90, baseMax: 90 }, 1);
  assert.ok(light.gold >= 1 && light.metal >= 1);
  assert.ok(deep.gold > light.gold);
  assert.equal(repairCost(t, { worn: 10, max: 90, baseMax: 90 }, 99).points, 10);
});

test('repairedPiece clears the wear but shaves max down to a floor', () => {
  let p = { worn: 90, max: 90, baseMax: 90 };
  p = repairedPiece(p);
  assert.equal(p.worn, 0);
  assert.equal(p.max, 88);
  for (let i = 0; i < 200; i++) p = repairedPiece({ ...p, worn: p.max });
  assert.equal(p.max, Math.ceil(90 * repairRule()!.wearMaxFloorPct / 100));
  assert.equal(repairedPiece(freshPiece(90)).max, 90);
});

test('relation typos are refused at load', () => {
  const clone = () => JSON.parse(JSON.stringify(DATA));
  const cases: Array<[string, (d: Record<string, Array<Record<string, number>>>) => void]> = [
    ['chancePct', (d) => { d.wearEvents[0].chancePct = 0; }],
    ['shares', (d) => { d.wearSlots[0].share = 36; }],
    ['killWear', (d) => { d.wearTiers[0].killWear = 1; }],
    ['qualityFloorPct', (d) => { d.repairRules[0].qualityFloorPct = 0; }],
    ['wearMaxFloorPct', (d) => { d.repairRules[0].wearMaxFloorPct = 101; }],
  ];
  for (const [name, mut] of cases) {
    const d = clone();
    mut(d);
    assert.throws(() => checkWearRelations(d), new RegExp(name), name);
  }
  assert.ok(REPAIR_RULES.length >= 1);
});

test('jewellery: the neck row is 0, never bitten, never repaired, and boots keep their own slot', () => {
  const neck = WEAR_SLOTS.find((s) => s.id === 'Neck')!;
  assert.equal(neck.share, 0);
  assert.equal(WEAR_SLOTS.find((s) => s.id === 'Boots')!.share, 7);
  assert.equal(slotWears('Neck'), false);
  assert.equal(slotWears('Boots'), true);
  for (let r = 0; r < 1; r += 0.001) assert.notEqual(wornSlot(r), 'Neck');
  const worn = { worn: 10, max: 90, baseMax: 90 };
  assert.equal(repairCost(tier('heavy'), worn, undefined, undefined, 'Neck').gold, 0);
  assert.equal(repairCost(tier('heavy'), worn, undefined, undefined, 'Neck').metal, 0);
  assert.ok(repairCost(tier('heavy'), worn, undefined, undefined, 'Boots').gold > 0);
});
