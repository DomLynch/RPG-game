// Wave A1 PR1b: what the player wears reaches the fight. `wornTilt` reads the paperdoll and the rung each piece was won at (the same lookup as the Gear tab's numbers) and gives the worn SET's
// tilt (plate: +armour / -magic resist; robes the reverse); `sheetOfLoot` puts it on the player's build (`buildOf`: the default build until Backend stores the real one), and a live
// career/practice Match takes that from its `sheet` port at EVERY begin(), so a piece swapped since boot counts, the record carries it (v48), and a naked player fights exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOf, gearNumbers, sheetOfLoot } from '../src/fight/gear-numbers.ts';
import { wornTilt } from '../src/fight/gear-stats.ts';
import { GEAR } from '../src/fight/gear-rows.ts';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { validateBuild } from '../src/fight/sheet-rows.ts';
import { TIERS } from '../src/core/grades.ts';
import type { Loot, LootId } from '../src/core/loot.ts';

const took = (tier: number) => ({ opponent: 'veteran' as const, attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier });
const origin = TIERS.length;
const plate: Loot = { owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet', chest: 'veteran.Body' }, taken: { 'veteran.Helmet': took(origin), 'veteran.Body': took(origin) } };
const robes: Loot = { owned: ['witch.Helmet', 'witch.Body'], equipped: { head: 'witch.Helmet', chest: 'witch.Body' }, taken: { 'witch.Helmet': took(origin), 'witch.Body': took(origin) } };

test('the set rows: every opponent named is a real opponent and every tilt a real tilt row', () => {
  for (const [opponent, tilt] of Object.entries(GEAR.sets)) { assert.ok(opponent in ROSTER, opponent); assert.ok(tilt in GEAR.tilts, `${opponent}: ${tilt}`); }
  assert.equal(GEAR.sets.veteran, 'plate'); assert.equal(GEAR.sets.witch, 'robes'); assert.equal(GEAR.sets.goblin, undefined, 'an opponent no row names gives no tilt');
});

test('wornTilt: no piece with a rung is no tilt; a part set tilts in proportion; ONE set is worn, the one with the most points', () => {
  const rung = (loot: Loot) => (id: LootId) => { const l = loot.taken?.[id]?.tier; return l ? TIERS[l - 1] : undefined; };
  assert.deepEqual(wornTilt({}, () => undefined), {});
  assert.deepEqual(wornTilt({ head: 'veteran.Helmet' }, () => undefined), {}, 'a piece with no rung is the identity, never a guess');
  const top = () => TIERS[origin - 1];
  assert.deepEqual(wornTilt(plate.equipped, rung(plate)), { armour: 13, magicResist: -13 }, 'a helmet and a body at the top rung are 450 of the 900 points of a full set: half of the 25');
  const fullSet = Object.fromEntries(['Helmet', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'].map((slot, i) => [`piece${i}`, `veteran.${slot}`])) as never;
  assert.deepEqual(wornTilt(fullSet, top), { armour: 25, magicResist: -25 }, 'a full plate set at the top rung is the whole 25');
  assert.deepEqual(wornTilt({ head: 'veteran.Helmet', chest: 'witch.Body' }, top), { magicResist: 8, armour: -8 }, 'plate helmet (180 points) against robes body (270): the robes are the set worn, at 270 of 900');
});

test('sheetOfLoot: the default build with nothing worn is no sheet; plate raises armour and lowers magic resist, robes the reverse; the build rows validate', () => {
  assert.deepEqual(validateBuild(buildOf()), []);
  assert.equal(sheetOfLoot(undefined), undefined);
  assert.equal(sheetOfLoot({ owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } }), undefined);
  const a = sheetOfLoot(plate)!, b = sheetOfLoot(robes)!;
  assert.ok(a.armour! > 50 && a.magicResist! < 50 && a.attack === undefined, JSON.stringify(a));
  assert.ok(b.magicResist! > 50 && b.armour! < 50, JSON.stringify(b));
  assert.ok(gearNumbers(plate).res > 0, 'the Gear tab reads the same worn pieces');
});

const mk = (sheet?: () => ReturnType<typeof sheetOfLoot>) => {
  const storage = { getItem: () => null, setItem: () => undefined };
  return new Match(OPPONENTS.veteran, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage), ...(sheet ? { sheet } : {}) }, 731, 'longsword', null, 6);
};

test('a live Match takes the sheet from its port at every begin(): the fight and its record carry it (v48), a rematch re-reads it, and no port is the fight it was', () => {
  setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true);   // a live fight
  let loot: Loot | undefined = undefined;
  const m = mk(() => sheetOfLoot(loot));
  m.rematch();
  assert.equal(m.sheet, undefined); assert.equal(m.practice.duel.fighters[0].sheet, undefined); assert.equal(m.recorder?.finish('abandoned').sheet, undefined);
  loot = plate; m.rematch();   // the player put the armour on since the page booted
  const want = sheetOfLoot(plate);
  assert.deepEqual(m.sheet, want); assert.deepEqual(m.practice.duel.fighters[0].sheet, want); assert.equal(m.practice.duel.fighters[1].sheet, undefined, 'the warden is a creature row, off the sheet');
  const rec = m.recorder!.finish('abandoned');
  assert.deepEqual(rec.sheet, want); assert.equal(rec.v, RECORD_VERSION);
  loot = undefined; m.rematch();
  assert.equal(m.sheet, undefined, 'the armour came off: the next fight is naked');
  const plain = mk(); plain.rematch();
  assert.equal(plain.sheet, undefined); assert.deepEqual(plain.practice.duel.fighters[0], m.practice.duel.fighters[0], 'a naked fighter is the one the port-less Match builds');
});

test('a lesson and sparring never take the sheet: only career and practice fights are fought on the player\'s kit', () => {
  const m = mk(() => sheetOfLoot(plate));
  m.startLesson(() => undefined);
  assert.equal(m.sheet, undefined);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 6 });
  assert.equal(m.sheet, undefined);
});
