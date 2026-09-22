// Brief 19 deliverable 1: the tier stat table. Every tier × slot resolves to four multipliers, a full Origin set lands EXACTLY on the
// caps, and no gear is exactly the identity. The bar the whole brief is judged against — gear tilts, skill decides — is one assertion
// here: no single stat moves by more than 25% between naked and full Origin.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPS, FULL_POINTS, NAKED, SLOT_WEIGHT, fullSet, loadoutFor, pointsFor, type Kit, type Loadout } from '../src/gear-stats.ts';
import { TIERS, levelOf, type Tier } from '../src/grades.ts';
import { ARMOUR_SLOTS, LOOT_SLOTS, WEAPON_SLOTS, isWeaponSlot, type LootSlot } from '../src/loot.ts';

const STATS = ['attack', 'defence', 'poise', 'stamina'] as const;

test('gear stats: the table covers every slot the game has, and only those', () => {
  assert.deepEqual(Object.keys(SLOT_WEIGHT).sort(), [...LOOT_SLOTS].sort(), 'a new loot slot must be given a weight, not silently fall through as undefined');
  for (const slot of LOOT_SLOTS) assert.ok(Number.isInteger(SLOT_WEIGHT[slot]) && SLOT_WEIGHT[slot] >= 0, `${slot} weight is a non-negative integer`);
});

test('gear stats: the Crest is zero on purpose — a row someone must change, not an omission', () => {
  assert.equal(SLOT_WEIGHT.Crest, 0, 'brief 19: the Crest is a mark of rank, not armour');
  assert.ok(ARMOUR_SLOTS.includes('Crest'), 'and it is still an armour slot in loot.ts, which is why it has to be in the table at all');
  // The point of the explicit zero: wearing a Crest changes nothing, at any tier. An omitted key would read as undefined and poison
  // the sum instead of saying so.
  for (const tier of TIERS) assert.deepEqual(loadoutFor({ Crest: tier }), NAKED, `a ${tier} Crest is worth exactly nothing`);
});

test('gear stats: a full set of either pool is exactly 1000 points, so a cap is a whole set and not a fitted constant', () => {
  const armour = ARMOUR_SLOTS.reduce((sum, slot) => sum + SLOT_WEIGHT[slot], 0);
  assert.equal(armour * levelOf('Origin'), FULL_POINTS, 'the six armour weights sum to 100 and Origin is level 10');
  for (const weapon of WEAPON_SLOTS) assert.equal(SLOT_WEIGHT[weapon] * levelOf('Origin'), FULL_POINTS, `an Origin ${weapon} alone fills the Attack pool`);
});

test('gear stats: no gear is the exact identity — the seam must be a no-op for a naked fighter', () => {
  assert.deepEqual(loadoutFor({}), NAKED);
  assert.deepEqual(NAKED, { attack: 1, defence: 1, poise: 1, stamina: 100 }, 'what the game does today');
});

test('gear stats: a full Origin set lands exactly on the caps', () => {
  for (const weapon of WEAPON_SLOTS) {
    const loadout = loadoutFor(fullSet('Origin', weapon));
    for (const stat of STATS) assert.equal(loadout[stat], CAPS[stat], `Origin + ${weapon}: ${stat} is ${loadout[stat]}, cap is ${CAPS[stat]}`);
  }
  // Exactly, not nearly: these are the doubles the literals denote, so a strict equality above is not luck.
  assert.equal(CAPS.defence, 0.8); assert.equal(CAPS.poise, 0.75); assert.equal(CAPS.attack, 1.15); assert.equal(CAPS.stamina, 125);
});

test('gear stats: THE BAR — a full Origin set moves no single stat by more than 25% against naked', () => {
  const full = loadoutFor(fullSet('Origin', 'Estoc'));
  for (const stat of STATS) {
    const tilt = Math.abs(full[stat] - NAKED[stat]) / NAKED[stat];
    assert.ok(tilt <= 0.25 + 1e-12, `${stat} tilts ${(tilt * 100).toFixed(2)}% — brief 19's ceiling is 25%`);
  }
  // And the intended ordering of how much each stat is allowed to move: raw damage least, because the fight-length pins and finisher
  // windows are measured against it.
  const tilt = (stat: typeof STATS[number]) => Math.abs(full[stat] - NAKED[stat]) / NAKED[stat];
  assert.ok(tilt('attack') < tilt('defence') && tilt('defence') < tilt('poise'), 'attack 15% < defence 20% < poise 25%');
  assert.equal(tilt('stamina'), 0.25);
});

test('gear stats: rags are not bare skin — a full Recruit set is a tenth of the way to the cap', () => {
  // A design claim, not arithmetic (lead, 2026-09-22): levelOf is 1-based, so the lowest rung on the ladder already carries a tenth of
  // a full set. Rags should beat no armour at all; if that is ever wrong, it is this test that has to change.
  const recruit = loadoutFor(fullSet('Recruit'));
  assert.notDeepEqual(recruit, NAKED);
  assert.equal(recruit.defence, 0.98); assert.equal(recruit.poise, 0.975); assert.equal(recruit.stamina, 102.5);
  assert.equal(recruit.attack, 1, 'armour carries no Attack');
  assert.equal(loadoutFor(fullSet('Recruit', 'Knife')).attack, 1.015);
});

test('gear stats: the ladder is monotonic — a better tier is never worth less in any slot', () => {
  for (const slot of LOOT_SLOTS) {
    const points = TIERS.map(tier => pointsFor(tier, slot));
    for (let i = 1; i < points.length; i++) assert.ok(points[i] >= points[i - 1], `${slot}: ${TIERS[i]} is worth less than ${TIERS[i - 1]}`);
  }
  // And a whole set climbs every rung without ever crossing its cap.
  let previous: Loadout = NAKED;
  for (const tier of TIERS) {
    const set = loadoutFor(fullSet(tier, 'Estoc'));
    assert.ok(set.attack >= previous.attack && set.defence <= previous.defence && set.poise <= previous.poise && set.stamina >= previous.stamina, `${tier} is not an improvement on the rung below`);
    assert.ok(set.attack <= CAPS.attack && set.defence >= CAPS.defence && set.poise >= CAPS.poise && set.stamina <= CAPS.stamina, `${tier} crosses a cap`);
    previous = set;
  }
});

test('gear stats: only the weapon carries Attack, only armour carries the other three', () => {
  for (const tier of TIERS) {
    for (const slot of LOOT_SLOTS) {
      const loadout = loadoutFor({ [slot]: tier } as Kit), armour = SLOT_WEIGHT[slot] > 0 && !isWeaponSlot(slot);
      if (isWeaponSlot(slot)) assert.ok(loadout.attack > 1 && loadout.defence === 1 && loadout.poise === 1 && loadout.stamina === 100, `${tier} ${slot} moved an armour stat`);
      else if (armour) assert.ok(loadout.attack === 1 && loadout.defence < 1 && loadout.poise < 1 && loadout.stamina > 100, `${tier} ${slot} did not behave as armour`);
    }
  }
});

test('gear stats: the paperdoll holds one main hand — a malformed two-weapon kit does not depend on key order', () => {
  const a = loadoutFor({ Knife: 'Recruit', Estoc: 'Origin' }), b = loadoutFor({ Estoc: 'Origin', Knife: 'Recruit' });
  assert.deepEqual(a, b);
  assert.equal(a.attack, CAPS.attack, 'the better weapon wins');
});

test('gear stats: mixed kit — a piece is worth its own tier, not the set\'s', () => {
  // The Praetorian-helmet case from brief 19's pass condition: one good piece on an otherwise poor kit.
  const kit = { ...fullSet('Legionary'), Helmet: 'Praetorian' } as Kit;
  const armour = (Object.entries(kit) as [LootSlot, Tier][]).reduce((sum, [slot, tier]) => sum + pointsFor(tier, slot), 0);
  assert.equal(armour, (100 - SLOT_WEIGHT.Helmet) * levelOf('Legionary') + SLOT_WEIGHT.Helmet * levelOf('Praetorian'));
  assert.equal(armour, 280);
  assert.deepEqual(loadoutFor(kit), { attack: 1, defence: 0.944, poise: 0.93, stamina: 107 });
});

test('gear stats: the integer form is not decoration — the obvious float expression is already wrong at 280 points', () => {
  // This assertion earned its place by failing the first time it was written the naive way. `1 - 0.25 * 280 / 1000` is
  // 0.9299999999999999, not 0.93; `(100000 - 25 * 280) / 100000` is 0.93 exactly. One kit in a paperdoll is cosmetic, but the same
  // drift inside a 1500-tick fight is what the arm64/x64 digest rule exists to prevent, so the multipliers are built from exact
  // integers and divided once.
  assert.notEqual(1 - 0.25 * 280 / FULL_POINTS, 0.93);
  assert.equal(loadoutFor({ ...fullSet('Legionary'), Helmet: 'Praetorian' } as Kit).poise, 0.93);
});

// The grid itself. 10 tiers × 7 loot-bearing slot kinds, one cell per cell, so a weight cannot be nudged without this snapshot saying
// which cells moved. Points rather than multipliers: a multiplier is a fact about a whole kit, a point value is the table's own number.
test('gear stats: the full tier × slot grid', () => {
  const grid = Object.fromEntries(TIERS.map(tier => [tier, Object.fromEntries(LOOT_SLOTS.map(slot => [slot, pointsFor(tier, slot)]))]));
  assert.deepEqual(grid, {
    Recruit:    { Helmet:  20, Crest: 0, Body:  30, Arms:  12, Gloves:  8, Greaves:  18, Boots:  12, Trident:  100, Cleaver:  100, Knife:  100, Estoc:  100, Scythe:  100, Warhammer:  100 },
    Legionary:  { Helmet:  40, Crest: 0, Body:  60, Arms:  24, Gloves: 16, Greaves:  36, Boots:  24, Trident:  200, Cleaver:  200, Knife:  200, Estoc:  200, Scythe:  200, Warhammer:  200 },
    Gladiator:  { Helmet:  60, Crest: 0, Body:  90, Arms:  36, Gloves: 24, Greaves:  54, Boots:  36, Trident:  300, Cleaver:  300, Knife:  300, Estoc:  300, Scythe:  300, Warhammer:  300 },
    Veteran:    { Helmet:  80, Crest: 0, Body: 120, Arms:  48, Gloves: 32, Greaves:  72, Boots:  48, Trident:  400, Cleaver:  400, Knife:  400, Estoc:  400, Scythe:  400, Warhammer:  400 },
    Champion:   { Helmet: 100, Crest: 0, Body: 150, Arms:  60, Gloves: 40, Greaves:  90, Boots:  60, Trident:  500, Cleaver:  500, Knife:  500, Estoc:  500, Scythe:  500, Warhammer:  500 },
    Praetorian: { Helmet: 120, Crest: 0, Body: 180, Arms:  72, Gloves: 48, Greaves: 108, Boots:  72, Trident:  600, Cleaver:  600, Knife:  600, Estoc:  600, Scythe:  600, Warhammer:  600 },
    Master:     { Helmet: 140, Crest: 0, Body: 210, Arms:  84, Gloves: 56, Greaves: 126, Boots:  84, Trident:  700, Cleaver:  700, Knife:  700, Estoc:  700, Scythe:  700, Warhammer:  700 },
    Primus:     { Helmet: 160, Crest: 0, Body: 240, Arms:  96, Gloves: 64, Greaves: 144, Boots:  96, Trident:  800, Cleaver:  800, Knife:  800, Estoc:  800, Scythe:  800, Warhammer:  800 },
    Invictus:   { Helmet: 180, Crest: 0, Body: 270, Arms: 108, Gloves: 72, Greaves: 162, Boots: 108, Trident:  900, Cleaver:  900, Knife:  900, Estoc:  900, Scythe:  900, Warhammer:  900 },
    Origin:     { Helmet: 200, Crest: 0, Body: 300, Arms: 120, Gloves:  80, Greaves: 180, Boots: 120, Trident: 1000, Cleaver: 1000, Knife: 1000, Estoc: 1000, Scythe: 1000, Warhammer: 1000 },
  });
});

// The multipliers a player will actually see per whole set, so a change to the derivation shows up as numbers and not just as points.
test('gear stats: a full set at every rung, as the paperdoll will show it', () => {
  const rows = TIERS.map(tier => { const l = loadoutFor(fullSet(tier, 'Estoc')); return `${tier}\t${l.attack}\t${l.defence}\t${l.poise}\t${l.stamina}`; });
  assert.deepEqual(rows, [
    'Recruit\t1.015\t0.98\t0.975\t102.5',
    'Legionary\t1.03\t0.96\t0.95\t105',
    'Gladiator\t1.045\t0.94\t0.925\t107.5',
    'Veteran\t1.06\t0.92\t0.9\t110',
    'Champion\t1.075\t0.9\t0.875\t112.5',
    'Praetorian\t1.09\t0.88\t0.85\t115',
    'Master\t1.105\t0.86\t0.825\t117.5',
    'Primus\t1.12\t0.84\t0.8\t120',
    'Invictus\t1.135\t0.82\t0.775\t122.5',
    'Origin\t1.15\t0.8\t0.75\t125',
  ]);
});
