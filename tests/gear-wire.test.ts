// Wave A1 PR1b: what the player wears reaches the fight. `sheetOfLoot` reads the paperdoll and the rung each piece was won at (the same lookup as the Gear tab's numbers), and a live
// career/practice Match takes it from its `sheet` port at EVERY begin(), so a piece swapped since boot counts, the record carries it (v48), and a naked player fights exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gearNumbers, sheetOfLoot } from '../src/fight/gear-numbers.ts';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/fight/play-radius.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import type { Loot } from '../src/core/loot.ts';

const took = (tier: number) => ({ opponent: 'veteran' as const, attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier });
const worn: Loot = { owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet', chest: 'veteran.Body' }, taken: { 'veteran.Helmet': took(10), 'veteran.Body': took(10) } };

test('sheetOfLoot: nothing worn, or worn with no recorded rung, is no sheet; worn pieces fill the gear layer from the same lookup as the Gear tab', () => {
  assert.equal(sheetOfLoot(undefined), undefined);
  assert.equal(sheetOfLoot({ owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } }), undefined, 'a piece with no rung is the identity, never a guess');
  const sheet = sheetOfLoot(worn)!;
  assert.ok(sheet.armour! > 100 && sheet.armour! <= 125, `two top-rung armour pieces raise armour inside the gear layer: ${sheet.armour}`);
  assert.equal(sheet.attack, undefined, 'armour carries no attack');
  assert.ok(gearNumbers(worn).res > 0, 'the Gear tab reads the same loadout');
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
  loot = worn; m.rematch();   // the player put the armour on since the page booted
  const want = sheetOfLoot(worn);
  assert.deepEqual(m.sheet, want); assert.deepEqual(m.practice.duel.fighters[0].sheet, want); assert.equal(m.practice.duel.fighters[1].sheet, undefined, 'the warden is a creature row, off the sheet');
  const rec = m.recorder!.finish('abandoned');
  assert.deepEqual(rec.sheet, want); assert.equal(rec.v, RECORD_VERSION);
  loot = undefined; m.rematch();
  assert.equal(m.sheet, undefined, 'the armour came off: the next fight is naked');
  const plain = mk(); plain.rematch();
  assert.equal(plain.sheet, undefined); assert.deepEqual(plain.practice.duel.fighters[0], m.practice.duel.fighters[0], 'a naked fighter is the one the port-less Match builds');
});

test('a lesson and sparring never take the sheet: only career and practice fights are fought on the player\'s kit', () => {
  const m = mk(() => sheetOfLoot(worn));
  m.startLesson(() => undefined);
  assert.equal(m.sheet, undefined);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 6 });
  assert.equal(m.sheet, undefined);
});
