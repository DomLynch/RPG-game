// Origins luck contract: the flag is off unless set, rolls stay in band and replay exactly, only world monsters roll, the Gambit's caps hold.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GAMBIT_KILL_FLOOR, GAMBIT_ODDS, LUCK_OFF, gambitMean, hitDamage, luckHud, oddsLabel, parseLuckFlags, resolveGambit, rollDamage, rollLabel,
  rollsApply, stubSource, type FightKind,
} from './luck.ts';

const ON = { monsterRolls: true, gambit: true };

test('the flag is off by default and only an exact true turns a part on', () => {
  assert.deepEqual(parseLuckFlags(undefined), LUCK_OFF);
  assert.deepEqual(parseLuckFlags({ monsterRolls: 'true', gambit: 1 }), LUCK_OFF);
  assert.deepEqual(parseLuckFlags({ monsterRolls: true }), { monsterRolls: true, gambit: false });
  assert.deepEqual(luckHud('monster', LUCK_OFF, rollDamage(20, 0.99)), { roll: null, gambit: null }, 'flag off: the HUD shows nothing');
});

test('rolls are whole percents in ±10, never below 1 damage, and cover the whole band', () => {
  const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) {
    const r = rollDamage(14, stubSource(731, i));
    assert.ok(r.percent >= -10 && r.percent <= 10 && Number.isInteger(r.percent));
    assert.equal(r.damage, Math.round(14 * (1 + r.percent / 100)));
    seen.add(r.percent);
  }
  assert.equal(seen.size, 21, 'every whole percent from −10 to +10 occurs');
  assert.deepEqual([rollDamage(24, 0).percent, rollDamage(24, 0.999999).percent], [-10, 10]);
  assert.equal(rollDamage(1, 0).damage, 1);
  assert.throws(() => rollDamage(10, 1), RangeError);
});

test('the same seed and hit give the same roll (replay/re-sim exact, C5); another seed gives another sequence', () => {
  const a = Array.from({ length: 50 }, (_, i) => hitDamage('monster', ON, 18, 42, i, stubSource).damage);
  assert.deepEqual(a, Array.from({ length: 50 }, (_, i) => hitDamage('monster', ON, 18, 42, i, stubSource).damage));
  assert.notDeepEqual(a, Array.from({ length: 50 }, (_, i) => hitDamage('monster', ON, 18, 43, i, stubSource).damage));
});

test('only world monsters roll: the Pit legends and PvP never do, flag or not', () => {
  for (const kind of ['pit-legend', 'pvp'] as FightKind[]) {
    assert.equal(rollsApply(kind, ON), false);
    assert.deepEqual(hitDamage(kind, ON, 24, 1, 0, () => 0.999), { base: 24, percent: 0, damage: 24 });
    assert.equal(luckHud(kind, ON, rollDamage(24, 0.9)).roll, null);
  }
  assert.equal(hitDamage('monster', LUCK_OFF, 24, 1, 0, () => 0.999).damage, 24, 'monsters with the flag off: no roll');
  assert.equal(luckHud('monster', ON, rollDamage(24, 0.999999)).roll, '+10%');
});

test('Gambit: mean landed damage never beats the heavy (C1), for the shipped odds and for 1-in-3 at x2.75', () => {
  for (const heavy of [18, 27]) {
    assert.ok(gambitMean(heavy) <= heavy, `1 in 2: ${gambitMean(heavy)} vs ${heavy}`);
    assert.ok(gambitMean(heavy, { chance: 1 / 3, multiplier: 2.75 }) <= heavy);
  }
  assert.equal(oddsLabel(), '1 in 2');
  assert.equal(oddsLabel({ chance: 1 / 3, multiplier: 2.75 }), '1 in 3');
  assert.equal(luckHud('pvp', ON, null).gambit, 'Gambit 1 in 2', 'the Gambit is everywhere, PvP included');
});

test('Gambit: a miss does no damage; a hit never kills from above 40% of max health (C1)', () => {
  assert.deepEqual(resolveGambit(18, GAMBIT_ODDS.chance, 150, 150), { landed: false, damage: 0 });
  assert.deepEqual(resolveGambit(18, 0, 150, 150), { landed: true, damage: 36 });
  const odds = { chance: 1 / 3, multiplier: 4 };   // a big multiplier so the cap is what decides
  assert.equal(resolveGambit(18, 0, 61, 150, odds).damage, 60, 'from above the floor it leaves 1');
  assert.equal(resolveGambit(18, 0, 60, 150, odds).damage, 72, `at or below ${GAMBIT_KILL_FLOOR * 100}% it may kill`);
});

test('HUD labels', () => {
  assert.deepEqual([rollLabel(rollDamage(20, 0)), rollLabel(rollDamage(20, 0.5)), rollLabel(rollDamage(20, 0.999999))], ['−10%', '±0%', '+10%']);
});
