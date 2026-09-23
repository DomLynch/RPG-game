// Brief 19 deliverable 1: the tier stat table. Every tier × slot resolves to four multipliers, a full Origin set lands EXACTLY on the
// caps, and BOTH ends of the ladder are exactly the identity — no gear, and a full Recruit set of rag and scrap. The bar the whole
// brief is judged against — gear tilts, skill decides — is one assertion here: neither stat moves by more than 20% between naked and
// full Origin. Gear carries Attack and RES only; POISE, health and stamina are the Origin character layer's
// (docs/progression-direction.md), and there is a test below that says so, because a later hand adding a third column here would be
// crossing a layer boundary rather than extending a table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPS, FULL_POINTS, NAKED, SLOT_WEIGHT, fullSet, kitFrom, loadoutFor, opponentOf, pointsFor, wholePoints, type Kit, type Loadout, type TierOf } from '../src/gear-stats.ts';
import { TIERS, levelOf, type Tier } from '../src/grades.ts';
import { ARMOUR_SLOTS, LOOT_SLOTS, WEAPON_SLOTS, isWeaponSlot, type LootSlot } from '../src/loot.ts';

const STATS = ['attack', 'res'] as const;

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

test('gear stats: gear carries Attack and RES only — POISE, health and stamina belong to the character layer', () => {
  // docs/progression-direction.md (owner, 2026-09-19): POISE is one of the five Origin character stats and the armour line says in as
  // many words that armour does not add POISE; stamina is END/DEX, and the heavy armour classes COST stamina economy rather than
  // granting it. This lane's first cut had gear granting both. The assertion is here so that adding a third key is a failing test
  // rather than a quiet extension — it is a layer boundary, not a table with room in it.
  assert.deepEqual(Object.keys(NAKED).sort(), ['attack', 'res']);
  assert.deepEqual(Object.keys(CAPS).sort(), ['attack', 'res']);
  assert.deepEqual(Object.keys(loadoutFor(fullSet('Origin', 'Estoc'))).sort(), ['attack', 'res']);
});

test('gear stats: a full set of either pool is exactly 900 points, so a cap is a whole set and not a fitted constant', () => {
  const armour = ARMOUR_SLOTS.reduce((sum, slot) => sum + SLOT_WEIGHT[slot], 0);
  assert.equal(armour, 100, 'the six armour weights sum to 100');
  assert.equal(armour * (levelOf('Origin') - 1), FULL_POINTS, 'times the nine rungs above Recruit');
  for (const weapon of WEAPON_SLOTS) assert.equal(SLOT_WEIGHT[weapon] * (levelOf('Origin') - 1), FULL_POINTS, `an Origin ${weapon} alone fills the Attack pool`);
});

test('gear stats: no gear is the exact identity — the seam must be a no-op for a naked fighter', () => {
  assert.deepEqual(loadoutFor({}), NAKED);
  assert.deepEqual(NAKED, { attack: 1, res: 1 }, 'what the game does today');
});

test('gear stats: a full Origin set lands exactly on the caps', () => {
  for (const weapon of WEAPON_SLOTS) {
    const loadout = loadoutFor(fullSet('Origin', weapon));
    for (const stat of STATS) assert.equal(loadout[stat], CAPS[stat], `Origin + ${weapon}: ${stat} is ${loadout[stat]}, cap is ${CAPS[stat]}`);
  }
  // Exactly, not nearly: these are the doubles the literals denote, so a strict equality above is not luck.
  assert.equal(CAPS.res, 0.8); assert.equal(CAPS.attack, 1.15);
});

test('gear stats: changing a cap is TWO edits, and this test is the one that says so', () => {
  // Brief 19 Addendum C says changing a cap is "one number in CAPS". That is NOT true of the implementation, and the difference
  // matters to whoever does it: `multipliers()` carries the integer coefficients 15 and 20 as literals, because deriving them
  // from CAPS in floats gives 14.999999999999991 and 19.999999999999996 — the exact drift this module exists to avoid. So the
  // coefficients cannot be derived at runtime; CAPS and the coefficients are two facts that must agree.
  //
  // They cannot silently disagree: editing CAPS alone fails four tests (mutation-proved with Dom's floated +10/+10). This test
  // states the relationship so the next person reads an instruction instead of inferring one from four failures.
  for (const [stat, coefficient] of [['attack', 15], ['res', 20]] as const) {
    const distance = Math.abs(CAPS[stat] - 1);
    assert.equal(Math.round(distance * 90000 / FULL_POINTS), coefficient, `CAPS.${stat} implies coefficient ${coefficient} in multipliers(); change both or neither`);
  }
});

test('gear stats: THE BAR — a full Origin set moves neither stat by more than 20% against naked', () => {
  const full = loadoutFor(fullSet('Origin', 'Estoc'));
  const tilt = (stat: typeof STATS[number]) => Math.abs(full[stat] - NAKED[stat]) / NAKED[stat];
  for (const stat of STATS) assert.ok(tilt(stat) <= 0.20 + 1e-12, `${stat} tilts ${(tilt(stat) * 100).toFixed(2)}% — brief 19's ceiling is 20%`);
  // And the intended ordering: raw damage moves least, because the fight-length pins and finisher windows are measured against it.
  assert.ok(tilt('attack') < tilt('res'), 'attack 15% < res 20%');
  // Note what is NOT asserted here: `tilt('res') === 0.2`. It is 0.19999999999999996, because `Math.abs(0.8 - 1) / 1` is the naive
  // float form this whole module exists to avoid, and the test is not exempt from its own lesson. The exact claim is on the
  // multiplier itself, which is exact; a tilt is a derived, displayed quantity and is only ever compared against the ceiling.
  assert.equal(full.res, CAPS.res);
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
  assert.ok(legionary.attack > 1 && legionary.res < 1);
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
    assert.ok(set.attack >= previous.attack && set.res <= previous.res, `${tier} is not an improvement on the rung below`);
    assert.ok(set.attack <= CAPS.attack && set.res >= CAPS.res, `${tier} crosses a cap`);
    previous = set;
  }
});

test('gear stats: only the weapon carries Attack, only armour carries RES', () => {
  for (const tier of TIERS) {
    for (const slot of LOOT_SLOTS) {
      const loadout = loadoutFor({ [slot]: tier } as Kit), worth = pointsFor(tier, slot) > 0;
      if (!worth) { assert.deepEqual(loadout, NAKED, `${tier} ${slot} is worth nothing and must be the identity`); continue; }
      if (isWeaponSlot(slot)) assert.ok(loadout.attack > 1 && loadout.res === 1, `${tier} ${slot} moved RES`);
      else assert.ok(loadout.attack === 1 && loadout.res < 1, `${tier} ${slot} did not behave as armour`);
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
  assert.deepEqual(loadoutFor(kit), { attack: 1, res: 0.96 });
});

test('gear stats: the integer form is not decoration — the obvious float expression drifts on real kits', () => {
  // This assertion earned its place by failing: the mixed-kit case above was first written with the naive expression and disagreed
  // with the module, which was right. One kit in a paperdoll rounds that away; the same drift inside a 1500-tick fight does not,
  // which is what the arm64/x64 digest rule exists to prevent. So every multiplier is exact integers divided once.
  //
  // The count is asserted so the hazard is a number rather than an anecdote.
  //
  // `naive` is written as the literal 0.2 on purpose, and that detail cost a round: the first version derived it as `1 - CAPS.res`,
  // which is 0.19999999999999996 and therefore a THIRD expression rather than the natural one. It made the test pass against a
  // module that used the naive form, because the two wrong answers disagreed with each other. The mutation proof caught it — swapping
  // the module to `1 - 0.2 * armour / 900` failed nothing. A test about float drift is not exempt from float drift.
  const naive = (a: number) => 1 - 0.2 * a / FULL_POINTS, exact = (a: number) => (90000 - 20 * a) / 90000;
  const drifting = [];
  for (let a = 0; a <= FULL_POINTS; a++) if (naive(a) !== exact(a)) drifting.push(a);
  assert.ok(drifting.length > 0, 'if this is ever empty the test has stopped proving anything');
  assert.equal(drifting.length, 68);
  // And one of them reached by an actual kit, so this is not a synthetic hazard.
  // A Veteran set with Gladiator arms: 288 points, where the naive expression gives 0.9359999999999999 and the exact one 0.936.
  const kit = { ...fullSet('Veteran'), Arms: 'Gladiator' } as Kit;
  const armour = (Object.entries(kit) as [LootSlot, Tier][]).reduce((sum, [slot, tier]) => sum + pointsFor(tier, slot), 0);
  assert.equal(armour, 288);
  assert.ok(drifting.includes(armour), 'a Veteran set with Gladiator arms lands on a drifting total');
  assert.equal(naive(armour), 0.9359999999999999);
  assert.equal(exact(armour), 0.936);
  assert.notEqual(naive(armour), loadoutFor(kit).res);
  assert.equal(loadoutFor(kit).res, exact(armour));
});

// The grid itself. 10 tiers × every loot-bearing slot kind, one cell per cell, so a weight cannot be nudged without this snapshot saying
// which cells moved. Points rather than multipliers: a multiplier is a fact about a whole kit, a point value is the table's own number.
test('gear stats: the full tier × slot grid', () => {
  const grid = Object.fromEntries(TIERS.map(tier => [tier, Object.fromEntries(LOOT_SLOTS.map(slot => [slot, pointsFor(tier, slot)]))]));
  assert.deepEqual(grid, {
    Recruit:    { Helmet:   0, Crest: 0, Body:   0, Arms:   0, Gloves:  0, Greaves:   0, Boots:   0, Shield: 0, Trident:   0, Cleaver:   0, Knife:   0, Estoc:   0, Gladius:   0, Scythe:   0, Warhammer:   0, Maul:   0 },
    Legionary:  { Helmet:  20, Crest: 0, Body:  30, Arms:  12, Gloves:  8, Greaves:  18, Boots:  12, Shield: 0, Trident: 100, Cleaver: 100, Knife: 100, Estoc: 100, Gladius: 100, Scythe: 100, Warhammer: 100, Maul: 100 },
    Gladiator:  { Helmet:  40, Crest: 0, Body:  60, Arms:  24, Gloves: 16, Greaves:  36, Boots:  24, Shield: 0, Trident: 200, Cleaver: 200, Knife: 200, Estoc: 200, Gladius: 200, Scythe: 200, Warhammer: 200, Maul: 200 },
    Veteran:    { Helmet:  60, Crest: 0, Body:  90, Arms:  36, Gloves: 24, Greaves:  54, Boots:  36, Shield: 0, Trident: 300, Cleaver: 300, Knife: 300, Estoc: 300, Gladius: 300, Scythe: 300, Warhammer: 300, Maul: 300 },
    Champion:   { Helmet:  80, Crest: 0, Body: 120, Arms:  48, Gloves: 32, Greaves:  72, Boots:  48, Shield: 0, Trident: 400, Cleaver: 400, Knife: 400, Estoc: 400, Gladius: 400, Scythe: 400, Warhammer: 400, Maul: 400 },
    Praetorian: { Helmet: 100, Crest: 0, Body: 150, Arms:  60, Gloves: 40, Greaves:  90, Boots:  60, Shield: 0, Trident: 500, Cleaver: 500, Knife: 500, Estoc: 500, Gladius: 500, Scythe: 500, Warhammer: 500, Maul: 500 },
    Master:     { Helmet: 120, Crest: 0, Body: 180, Arms:  72, Gloves: 48, Greaves: 108, Boots:  72, Shield: 0, Trident: 600, Cleaver: 600, Knife: 600, Estoc: 600, Gladius: 600, Scythe: 600, Warhammer: 600, Maul: 600 },
    Primus:     { Helmet: 140, Crest: 0, Body: 210, Arms:  84, Gloves: 56, Greaves: 126, Boots:  84, Shield: 0, Trident: 700, Cleaver: 700, Knife: 700, Estoc: 700, Gladius: 700, Scythe: 700, Warhammer: 700, Maul: 700 },
    Invictus:   { Helmet: 160, Crest: 0, Body: 240, Arms:  96, Gloves: 64, Greaves: 144, Boots:  96, Shield: 0, Trident: 800, Cleaver: 800, Knife: 800, Estoc: 800, Gladius: 800, Scythe: 800, Warhammer: 800, Maul: 800 },
    Origin:     { Helmet: 180, Crest: 0, Body: 270, Arms: 108, Gloves: 72, Greaves: 162, Boots: 108, Shield: 0, Trident: 900, Cleaver: 900, Knife: 900, Estoc: 900, Gladius: 900, Scythe: 900, Warhammer: 900, Maul: 900 },
  });
});

// The multipliers a player will actually see per whole set, so a change to the derivation shows up as numbers and not just as points.
test('gear stats: a full set at every rung, as the paperdoll will show it', () => {
  const rows = TIERS.map(tier => { const l = loadoutFor(fullSet(tier, 'Estoc')); return `${tier}\t${l.attack}\t${l.res}`; });
  assert.deepEqual(rows, [
    'Recruit\t1\t1',
    'Legionary\t1.0166666666666666\t0.9777777777777777',
    'Gladiator\t1.0333333333333334\t0.9555555555555556',
    'Veteran\t1.05\t0.9333333333333333',
    'Champion\t1.0666666666666667\t0.9111111111111111',
    'Praetorian\t1.0833333333333333\t0.8888888888888888',
    'Master\t1.1\t0.8666666666666667',
    'Primus\t1.1166666666666667\t0.8444444444444444',
    'Invictus\t1.1333333333333333\t0.8222222222222222',
    'Origin\t1.15\t0.8',
  ]);
});

// The Shield's 0 is a DECISION and gets its own test, because a 0 that is a decision and a 0 that is an oversight look identical in a
// table. Brief 19 Addendum C item 3: the shield is the guard profile only, with "no flat incoming reduction" — Dom's earlier
// "−20 % incoming" was withdrawn because one shield at Recruit would equal the whole Origin armour cap. A weight here would reinstate
// exactly that, on top of the guard profile the shield already gets in the duel.
test('gear stats: a shield is worth no RES at any tier — it pays out in the guard profile, not the table', () => {
  assert.equal(SLOT_WEIGHT.Shield, 0, 'brief 19 Addendum C item 3: no flat incoming reduction, the -20% was withdrawn');
  for (const tier of TIERS) {
    assert.equal(pointsFor(tier, 'Shield'), 0, `a ${tier} shield must still be worth nothing in this table`);
    assert.deepEqual(loadoutFor({ Shield: tier }), NAKED, `a ${tier} shield alone must fight exactly naked`);
  }
  // And it does not quietly join a full set: fullSet() takes the armour slots with weight, so the caps are unmoved by the new slot.
  assert.equal(loadoutFor(fullSet('Origin')).res, CAPS.res, 'a full Origin set still lands exactly on the RES cap');
  assert.equal(ARMOUR_SLOTS.filter(slot => SLOT_WEIGHT[slot] > 0).reduce((sum, slot) => sum + SLOT_WEIGHT[slot], 0), 100,
    'the weights that count still sum to 100: no constant is fitted and the cap is still a whole set');
});

// ---- the paperdoll seam ---------------------------------------------------------------------------------------------------------
// A LootId carries no tier (src/loot.ts:22 is `<opponent>.<slot>`) and there is no per-opponent table to find one in: a tier belongs to
// the FIGHT (`tierAt(marks)` in src/grades.ts). So the lookup is keyed on the piece and these hold the behaviour while it does not exist
// yet: no tier must resolve to the identity, not to a default rung.
const TIERLESS: TierOf = () => null;

test('gear stats: an untiered piece resolves to exactly the identity, never a guessed rung', () => {
  const worn = { head: 'veteran.Helmet', chest: 'veteran.Body', main: 'veteran.Trident' } as const;
  assert.deepEqual(kitFrom(worn, TIERLESS), {}, 'no tier anywhere means no kit, not a kit at some default');
  assert.deepEqual(loadoutFor(kitFrom(worn, TIERLESS)), NAKED, 'and a full paperdoll of untiered pieces fights exactly naked');
  assert.equal(loadoutFor(kitFrom(worn, TIERLESS)).attack, 1, 'strict 1, not 0.999…');
  assert.equal(loadoutFor(kitFrom(worn, TIERLESS)).res, 1);
});

test('gear stats: a kit is resolved per piece, so a partly-tiered roster tilts only by what it knows', () => {
  const worn = { head: 'veteran.Helmet', chest: 'executioner.Body', main: 'veteran.Trident' } as const;
  const half: TierOf = piece => (opponentOf(piece) === 'veteran' ? 'Origin' : null);
  assert.deepEqual(kitFrom(worn, half), { Helmet: 'Origin', Trident: 'Origin' }, 'the untiered body is absent, not zero-tiered');
  // The same two pieces named directly: the seam adds no arithmetic of its own.
  assert.deepEqual(loadoutFor(kitFrom(worn, half)), loadoutFor({ Helmet: 'Origin', Trident: 'Origin' } as Kit));
  assert.equal(opponentOf('executioner.Body'), 'executioner');
});

test('gear stats: whole points are integers, unsigned, and land on the caps for a full Origin set', () => {
  assert.deepEqual(wholePoints(NAKED), { atk: 0, res: 0 }, 'no gear reads as nothing, not as +0/-0 of something');
  assert.deepEqual(wholePoints(loadoutFor(fullSet('Origin', 'Trident'))), { atk: 15, res: 20 },
    'brief 19 Addendum C: ATK 15 · RES 20 as integers, RES unsigned — the paperdoll pair, not the kill-screen delta');
  for (const tier of TIERS) {
    const p = wholePoints(loadoutFor(fullSet(tier, 'Trident')));
    assert.ok(Number.isInteger(p.atk) && Number.isInteger(p.res), `${tier} must read as whole points`);
    assert.ok(p.atk >= 0 && p.res >= 0, `${tier} must read unsigned: the sign rule is the kill-screen take's (brief 19 line 49)`);
  }
});
