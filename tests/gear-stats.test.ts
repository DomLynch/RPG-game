// Brief 19 deliverable 1: the tier stat table. Every tier × slot resolves to four multipliers, a full Origin set lands EXACTLY on the
// caps, and BOTH ends of the ladder are exactly the identity — no gear, and a full Recruit set of rag and scrap. The bar the whole
// brief is judged against — gear tilts, skill decides — is one assertion here: no single stat moves by more than 25% between naked
// and full Origin.
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

test('gear stats: a full set of either pool is exactly 900 points, so a cap is a whole set and not a fitted constant', () => {
  const armour = ARMOUR_SLOTS.reduce((sum, slot) => sum + SLOT_WEIGHT[slot], 0);
  assert.equal(armour, 100, 'the six armour weights sum to 100');
  assert.equal(armour * (levelOf('Origin') - 1), FULL_POINTS, 'times the nine rungs above Recruit');
  for (const weapon of WEAPON_SLOTS) assert.equal(SLOT_WEIGHT[weapon] * (levelOf('Origin') - 1), FULL_POINTS, `an Origin ${weapon} alone fills the Attack pool`);
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

test('gear stats: a full Recruit set carries nothing — the bottom rung IS the zero point', () => {
  // A design claim, not arithmetic (Strategy, 2026-09-22, overturning this lane's first cut and the lead's first reading of it).
  // Brief 14's Recruit is rag & scrap on 2 of 6 slots — salvage, not armour — and the naked bracket is only a real guarantee if the
  // new player actually standing in rags is inside it. So the ramp is (level - 1) / 9 and Legionary leather is the first tilt in the
  // game. If rags should ever carry something, it is this test that has to change.
  for (const weapon of WEAPON_SLOTS) assert.deepEqual(loadoutFor(fullSet('Recruit', weapon)), NAKED, `a whole Recruit kit with a ${weapon} is still bare skin`);
  for (const slot of LOOT_SLOTS) assert.equal(pointsFor('Recruit', slot), 0, `${slot} at Recruit`);
  // And the rung above it is the first that moves anything at all.
  const legionary = loadoutFor(fullSet('Legionary', 'Knife'));
  assert.notDeepEqual(legionary, NAKED);
  assert.ok(legionary.attack > 1 && legionary.defence < 1 && legionary.poise < 1 && legionary.stamina > 100);
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
      const loadout = loadoutFor({ [slot]: tier } as Kit), worth = pointsFor(tier, slot) > 0;
      if (!worth) { assert.deepEqual(loadout, NAKED, `${tier} ${slot} is worth nothing and must be the identity`); continue; }
      if (isWeaponSlot(slot)) assert.ok(loadout.attack > 1 && loadout.defence === 1 && loadout.poise === 1 && loadout.stamina === 100, `${tier} ${slot} moved an armour stat`);
      else assert.ok(loadout.attack === 1 && loadout.defence < 1 && loadout.poise < 1 && loadout.stamina > 100, `${tier} ${slot} did not behave as armour`);
    }
  }
});

test('gear stats: the paperdoll holds one main hand — a malformed two-weapon kit does not depend on key order', () => {
  const a = loadoutFor({ Knife: 'Legionary', Estoc: 'Origin' }), b = loadoutFor({ Estoc: 'Origin', Knife: 'Legionary' });
  assert.deepEqual(a, b);
  assert.equal(a.attack, CAPS.attack, 'the better weapon wins');
});

test('gear stats: mixed kit — a piece is worth its own tier, not the set\'s', () => {
  // The Praetorian-helmet case from brief 19's pass condition: one good piece on an otherwise poor kit.
  const kit = { ...fullSet('Legionary'), Helmet: 'Praetorian' } as Kit;
  const armour = (Object.entries(kit) as [LootSlot, Tier][]).reduce((sum, [slot, tier]) => sum + pointsFor(tier, slot), 0);
  assert.equal(armour, (100 - SLOT_WEIGHT.Helmet) * (levelOf('Legionary') - 1) + SLOT_WEIGHT.Helmet * (levelOf('Praetorian') - 1));
  assert.equal(armour, 180);
  assert.deepEqual(loadoutFor(kit), { attack: 1, defence: 0.96, poise: 0.95, stamina: 105 });
});

test('gear stats: the integer form is not decoration — the obvious float expression is already wrong at 390 points', () => {
  // This assertion earned its place by failing: the mixed-kit case above was first written with the naive expression and disagreed
  // with the module. A Veteran set with a Master body is 390 points, where `1 - 0.25 * 390 / 900` is 0.8916666666666666 and
  // `(90000 - 25 * 390) / 90000` is 0.8916666666666667. One kit in a paperdoll rounds that away; the same drift inside a 1500-tick
  // fight does not, which is what the arm64/x64 digest rule exists to prevent. So every multiplier is exact integers divided once.
  const kit = { ...fullSet('Veteran'), Body: 'Master' } as Kit;
  const armour = (Object.entries(kit) as [LootSlot, Tier][]).reduce((sum, [slot, tier]) => sum + pointsFor(tier, slot), 0);
  assert.equal(armour, 390);
  assert.notEqual(1 - 0.25 * armour / FULL_POINTS, loadoutFor(kit).poise);
  assert.equal(loadoutFor(kit).poise, 0.8916666666666667);
  // 74 of the 900 reachable armour totals drift this way; the point is that none of them can, through this module.
  let drifting = 0;
  for (let a = 0; a <= FULL_POINTS; a++) if (1 - 0.25 * a / FULL_POINTS !== (90000 - 25 * a) / 90000) drifting++;
  assert.equal(drifting, 74);
});

// The grid itself. 10 tiers × 7 loot-bearing slot kinds, one cell per cell, so a weight cannot be nudged without this snapshot saying
// which cells moved. Points rather than multipliers: a multiplier is a fact about a whole kit, a point value is the table's own number.
test('gear stats: the full tier × slot grid', () => {
  const grid = Object.fromEntries(TIERS.map(tier => [tier, Object.fromEntries(LOOT_SLOTS.map(slot => [slot, pointsFor(tier, slot)]))]));
  assert.deepEqual(grid, {
    Recruit:    { Helmet:   0, Crest: 0, Body:   0, Arms:   0, Gloves:  0, Greaves:   0, Boots:   0, Trident:   0, Cleaver:   0, Knife:   0, Estoc:   0, Scythe:   0, Warhammer:   0 },
    Legionary:  { Helmet:  20, Crest: 0, Body:  30, Arms:  12, Gloves:  8, Greaves:  18, Boots:  12, Trident: 100, Cleaver: 100, Knife: 100, Estoc: 100, Scythe: 100, Warhammer: 100 },
    Gladiator:  { Helmet:  40, Crest: 0, Body:  60, Arms:  24, Gloves: 16, Greaves:  36, Boots:  24, Trident: 200, Cleaver: 200, Knife: 200, Estoc: 200, Scythe: 200, Warhammer: 200 },
    Veteran:    { Helmet:  60, Crest: 0, Body:  90, Arms:  36, Gloves: 24, Greaves:  54, Boots:  36, Trident: 300, Cleaver: 300, Knife: 300, Estoc: 300, Scythe: 300, Warhammer: 300 },
    Champion:   { Helmet:  80, Crest: 0, Body: 120, Arms:  48, Gloves: 32, Greaves:  72, Boots:  48, Trident: 400, Cleaver: 400, Knife: 400, Estoc: 400, Scythe: 400, Warhammer: 400 },
    Praetorian: { Helmet: 100, Crest: 0, Body: 150, Arms:  60, Gloves: 40, Greaves:  90, Boots:  60, Trident: 500, Cleaver: 500, Knife: 500, Estoc: 500, Scythe: 500, Warhammer: 500 },
    Master:     { Helmet: 120, Crest: 0, Body: 180, Arms:  72, Gloves: 48, Greaves: 108, Boots:  72, Trident: 600, Cleaver: 600, Knife: 600, Estoc: 600, Scythe: 600, Warhammer: 600 },
    Primus:     { Helmet: 140, Crest: 0, Body: 210, Arms:  84, Gloves: 56, Greaves: 126, Boots:  84, Trident: 700, Cleaver: 700, Knife: 700, Estoc: 700, Scythe: 700, Warhammer: 700 },
    Invictus:   { Helmet: 160, Crest: 0, Body: 240, Arms:  96, Gloves: 64, Greaves: 144, Boots:  96, Trident: 800, Cleaver: 800, Knife: 800, Estoc: 800, Scythe: 800, Warhammer: 800 },
    Origin:     { Helmet: 180, Crest: 0, Body: 270, Arms: 108, Gloves: 72, Greaves: 162, Boots: 108, Trident: 900, Cleaver: 900, Knife: 900, Estoc: 900, Scythe: 900, Warhammer: 900 },
  });
});

// The multipliers a player will actually see per whole set, so a change to the derivation shows up as numbers and not just as points.
test('gear stats: a full set at every rung, as the paperdoll will show it', () => {
  const rows = TIERS.map(tier => { const l = loadoutFor(fullSet(tier, 'Estoc')); return `${tier}\t${l.attack}\t${l.defence}\t${l.poise}\t${l.stamina}`; });
  assert.deepEqual(rows, [
    'Recruit\t1\t1\t1\t100',
    'Legionary\t1.0166666666666666\t0.9777777777777777\t0.9722222222222222\t102.77777777777777',
    'Gladiator\t1.0333333333333334\t0.9555555555555556\t0.9444444444444444\t105.55555555555556',
    'Veteran\t1.05\t0.9333333333333333\t0.9166666666666666\t108.33333333333333',
    'Champion\t1.0666666666666667\t0.9111111111111111\t0.8888888888888888\t111.11111111111111',
    'Praetorian\t1.0833333333333333\t0.8888888888888888\t0.8611111111111112\t113.88888888888889',
    'Master\t1.1\t0.8666666666666667\t0.8333333333333334\t116.66666666666667',
    'Primus\t1.1166666666666667\t0.8444444444444444\t0.8055555555555556\t119.44444444444444',
    'Invictus\t1.1333333333333333\t0.8222222222222222\t0.7777777777777778\t122.22222222222223',
    'Origin\t1.15\t0.8\t0.75\t125',
  ]);
});
