// The Witch-fire take (SCOPE #729 item 8): a Witch kill offers her move beside her armour, the take is stored on the loot like a piece,
// survives a reload and a cloud round trip, and the next duel's fighter carries it (the daily's fixed kit carries none).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, cleanLoot, isSkillId, mergeLoot, skillOf, type Loot } from '../src/loot.ts';
import { loadProfile, saveProfile } from '../src/profile.ts';
import { absorbCloud, profileDiffers, type CloudProfile } from '../src/cloud-profile.ts';
import { Match } from '../src/match.ts';
import { OPPONENTS } from '../src/moves.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test('the Witch offers Witch-fire; no other opponent offers a move; the label is the plain name', () => {
  assert.equal(skillOf('witch'), 'witchfire');
  assert.equal(skillOf('veteran'), null);
  assert.equal(SKILLS.witchfire.name, 'Witch-fire');
  assert.doesNotMatch(SKILLS.witchfire.name, /special/i);
  assert.ok(isSkillId('witchfire') && !isSkillId('fireball') && !isSkillId(undefined));
});

test('the take is kept on the loot, and a junk skill is dropped', () => {
  assert.equal(cleanLoot({ owned: [], equipped: {}, skill: 'witchfire' }).skill, 'witchfire');
  assert.equal('skill' in cleanLoot({ owned: [], equipped: {}, skill: 'fireball' }), false);
});

test('a skill-only loot survives a reload (a guest whose one take was the move)', () => {
  const storage = memory();
  saveProfile(storage, { version: 1, id: 'device-1234', name: 'Aldren', loot: { owned: [], equipped: {}, skill: 'witchfire' } });
  assert.equal(loadProfile(storage, () => 'new').profile.loot?.skill, 'witchfire');
});

test('the cloud: a new move is a change to save, the device keeps its own, a fresh device takes the account\'s', () => {
  const cloud: CloudProfile = { display_name: 'Aldren', encounter: null, revision: 1, victory_marks: 0, loot: { owned: [], equipped: {} } };
  const mine = { version: 1 as const, id: 'device-1234', name: 'Aldren', loot: { owned: [], equipped: {}, skill: 'witchfire' } as Loot };
  assert.ok(profileDiffers(mine, cloud));
  assert.equal(absorbCloud(mine, cloud).loot?.skill, 'witchfire');
  assert.equal(mergeLoot(undefined, { owned: [], equipped: {}, skill: 'witchfire' }).skill, 'witchfire');
  assert.ok(!profileDiffers(mine, { ...cloud, loot: { owned: [], equipped: {}, skill: 'witchfire' } }));
});

test('the duel hands the equipped move to the player\'s fighter; the daily\'s fixed kit has none', () => {
  const storage = memory(), ports = { storage, trial: loadTrial(storage), scorecard: loadScorecard(storage), profile: loadProfile(storage, () => 'device').profile };
  const m = new Match(OPPONENTS.veteran, 'dev', ports, 731, 'longsword', 'witchfire');
  const skillOfFighter = () => (m.practice.duel.fighters[0] as { skill?: string | null }).skill;
  assert.equal(skillOfFighter(), 'witchfire');
  assert.equal((m.practice.duel.fighters[1] as { skill?: string | null }).skill, undefined, 'the opponent carries no player move');
  m.rematch();
  assert.equal(skillOfFighter(), 'witchfire', 'a rematch keeps it');
  assert.ok(m.startDaily({ day: '2026-09-25', number: 1, seed: 5 }, m.epoch));
  assert.equal(skillOfFighter(), null);
});
