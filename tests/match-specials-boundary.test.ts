import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/match.ts';
import { initialPractice } from '../src/combat.ts';
import { OPPONENTS, RULES } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { verifyRecord } from '../src/replay.ts';
import { createRecorder } from '../src/record.ts';
import { idleIntent } from '../src/duel.ts';

const match = (level = 46, opponent = OPPONENTS.knight) => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  return new Match(opponent, 'test', {
    storage, profile: loadProfile(storage, () => 'test').profile,
    trial: loadTrial(storage), scorecard: loadScorecard(storage),
  }, 731, 'longsword', null, level);
};
const record = (specials: boolean) => {
  const recorder = createRecorder({ build: 'test', opponent: 'knight', weapon: 'longsword', level: 46, seed: 731, ...(specials ? { specials: true } : {}) });
  for (let i = 0; i < 8; i++) recorder.push(idleIntent());
  return recorder.finish('abandoned');
};
const assertPve = (m: Match, level = 46) => {
  const active = level >= 16, boss = level >= 36;
  assert.equal(m.specials, active);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.specialShare), active ? [RULES.special.damage, boss ? RULES.special.bossDamage : RULES.special.damage] : [undefined, undefined]);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.skillCooldown), active ? [RULES.special.first, RULES.special.first] : [0, 0]);
  assert.equal(m.practice.duel.fighters[0].specialName, undefined, 'no invented player class');
};

test('ordinary PvE activates specials and records the accepted boss identity across resets', () => {
  const m = match(); assertPve(m);
  assert.equal(m.practice.duel.fighters[1].specialName, 'stormfollowshim');
  for (let i = 0; i < 8; i++) m.step(idleIntent);
  const saved = m.recorder!.finish('abandoned');
  assert.equal(saved.specials, true);
  const checked = verifyRecord(saved); assert.equal(checked.ok, true);
  assert.deepEqual(checked.practice!.duel, m.practice.duel, 'record flag replays the real stepped fight');
  m.rematch(); assertPve(m);
  assert.ok(m.rearm('knife')); assertPve(m);
  const epoch = m.epoch; m.setLevel(16); assertPve(m, 16);
  assert.equal(m.epoch, epoch, 'loading difficulty reset preserves the loader epoch');
  assert.equal(m.practice.duel.fighters[1].specialName, undefined, 'class B retains its existing unnamed record identity');
});

test('PvP turns specials off even after an enabled preview or replay', () => {
  for (const from of ['preview', 'replay'] as const) {
    const m = match();
    if (from === 'preview') m.startSparring({ weapon: 'longsword', skill: null, difficulty: 46 }, { first: 7 });
    else assert.ok(m.startReplay(record(true), 0, m.epoch));
    const practice = initialPractice(731, OPPONENTS.knight);
    const driver = { practice, settled: false, frame: () => practice };
    m.startPvp(driver);
    assert.equal(m.specials, false); assert.equal(m.recorder, null);
    assert.ok(m.practice.duel.fighters.every(f => f.specialShare === undefined));
    m.step(idleIntent); m.rematch(); assert.equal(m.specials, false);
    assert.equal(m.rearm('knife'), false);
    m.playNow(); assert.equal(m.mode, 'practice'); assertPve(m);
  }
});

test('replays and export clips retain their own flags while PLAY NOW restores the PvE default', () => {
  for (const specials of [false, true]) {
    const m = match(), saved = record(specials);
    assert.ok(m.startReplay(saved, 0, m.epoch));
    assert.equal(m.specials, specials);
    for (let i = 0; i < saved.ticks; i++) m.step(() => { throw new Error('replay used live input'); });
    assert.deepEqual(m.practice.duel, verifyRecord(saved).practice!.duel);
    assert.equal(m.practice.duel.fighters[1].specialName, specials ? 'stormfollowshim' : undefined);
    m.playNow(); assertPve(m);
    const live = m.practice, epoch = m.epoch, clip = m.startClip(saved, 0);
    assert.equal(m.specials, specials, 'clip presentation follows its recorded flag');
    assert.equal(m.practice.duel.fighters[1].specialShare !== undefined, specials);
    assert.equal(m.epoch, epoch);
    m.endClip(clip); assert.equal(m.practice, live); assertPve(m);
  }
});

test('explicit special previews retain early casts only inside sparring and its rematch', () => {
  const m = match();
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 46 }, { first: 7 });
  for (let i = 0; i < 2; i++) {
    assert.equal(m.specials, true); assert.equal(m.recorder, null);
    assert.deepEqual(m.practice.duel.fighters.map(f => f.skillCooldown), [7, 7]);
    m.rematch();
  }
  m.playNow(); assertPve(m);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 16 }); assertPve(m, 16);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 15 }, { first: 7 });
  assert.equal(m.specials, true, 'explicit class-A preview still runs during the phase-two B-and-boss gate');
  m.rematch(); assert.equal(m.specials, true);
  m.playNow(); assertPve(m, 15);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 'dummy' });
  assert.equal(m.specials, false, 'dummy training is outside ordinary PvE activation');
  assert.ok(m.practice.duel.fighters.every(f => f.specialShare === undefined));
  m.rematch(); assert.equal(m.specials, false);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 'dummy' }, { first: 7 });
  assert.equal(m.specials, true, 'explicit preview still owns its flag');
  m.playNow(); assertPve(m, 6);
});

test('presentation identity follows the built fight, not a mid-fight level picker', () => {
  const m = match(15);
  assert.deepEqual(m.specialIdentity, { opponent: 'knight', level: 15 });
  m.step(() => ({ ...idleIntent(), action: 'light' }));
  assert.notEqual(m.practice.duel.fighters[0].phase, 'sheathed');
  const practice = m.practice;
  m.setLevel(41);
  assert.equal(m.level, 41); assert.equal(m.practice, practice); assert.equal(m.recorder, null);
  assert.deepEqual(m.specialIdentity, { opponent: 'knight', level: 15 });
  assert.equal(m.specials, false, 'mid-fight picker cannot enable the class fight');
  const exposed = m.specialIdentity as { level: number }; exposed.level = 46;
  assert.equal(m.specialIdentity.level, 15, 'a returned object cannot mutate the private snapshot');
  m.rematch(); assert.deepEqual(m.specialIdentity, { opponent: 'knight', level: 41 });
  assert.equal(m.specials, true);
  m.setLevel(15); assert.equal(m.specialIdentity.level, 15, 'a before-draw reset captures its actual new level');
});

test('presentation identity uses replay and clip records and restores the original fight after a clip', () => {
  const m = match(15), saved = record(true);
  const before = m.specialIdentity, clip = m.startClip(saved, 0);
  assert.equal(m.specials, true, 'a boss record enables its clip presentation inside a class-A-off fight');
  assert.equal(m.level, 15);
  assert.deepEqual(m.specialIdentity, { opponent: saved.opponent, level: saved.level });
  m.endClip(clip); assert.deepEqual(m.specialIdentity, before);
  assert.equal(m.specials, false, 'ending a boss clip restores the class-A-off fight');
  assert.ok(m.startReplay(saved, 0, m.epoch));
  assert.deepEqual(m.specialIdentity, { opponent: saved.opponent, level: saved.level });
  m.setLevel(15); assert.equal(m.specialIdentity.level, saved.level, 'the replay refuses a picker change');
  const nested = m.startClip({ ...saved, level: 41 }, 0);
  assert.equal(m.specialIdentity.level, 41);
  m.endClip(nested); assert.equal(m.specialIdentity.level, saved.level, 'ending a clip restores the watched record');
  m.playNow(); assert.deepEqual(m.specialIdentity, { opponent: 'knight', level: saved.level });
});


test('phase-two B-and-boss gate accepts exactly integer levels 16–50 and records the phase at every rung', () => {
  for (let level = 1; level <= 50; level++) {
    const m = match(level); assertPve(m, level);
    assert.equal(!!m.recorder!.finish('abandoned').specials, level >= 16, `record level ${level}`);
  }
  for (const level of [0, -1, 15.5, 16.5, 35.5, 36.5, 50.5, 51, NaN, Infinity]) {
    assert.equal(match(level).specials, false, `invalid level ${level} cannot activate`);
  }
});

test('recorded class-A specials remain replayable without enabling fresh class-A fights', () => {
  const saved = { ...record(true), level: 15 };
  const m = match(15); assertPve(m, 15);
  assert.ok(m.startReplay(saved, 0, m.epoch));
  assert.equal(m.specials, true);
  for (let i = 0; i < saved.ticks; i++) m.step(() => { throw new Error('replay used live input'); });
  assert.deepEqual(m.practice.duel, verifyRecord(saved).practice!.duel);
  m.playNow(); assertPve(m, 15);
  const live = m.practice, clip = m.startClip(saved, 0);
  assert.equal(m.specials, true, 'recorded class clip carries its own presentation flag');
  assert.equal(m.practice.duel.fighters[1].specialShare, RULES.special.damage);
  m.endClip(clip); assert.equal(m.practice, live); assertPve(m, 15);
});


test('phase-two eligibility follows each opponent built profile without borrowing the other actor identity', () => {
  for (const id of ['veteran', 'goblin', 'nightborn', 'pitborn', 'executioner', 'dwarf', 'shieldmaiden', 'witch', 'plaguedoctor', 'knight'] as const) {
    for (const level of [15, 16, 35, 36, 46]) {
      const m = match(level, OPPONENTS[id]); assertPve(m, level);
      assert.deepEqual(m.specialIdentity, { opponent: id, level });
      assert.equal(m.practice.duel.fighters[0].specialName, undefined);
    }
  }
});

test('class-B records reproduce real stepped fights and a reset across 15/16 captures the new phase', () => {
  const m = match(16);
  for (let i = 0; i < 8; i++) m.step(idleIntent);
  const saved = m.recorder!.finish('abandoned');
  assert.equal(saved.specials, true);
  assert.deepEqual(verifyRecord(saved).practice!.duel, m.practice.duel);
  assert.ok(m.rearm('knife')); assertPve(m, 16);
  m.setLevel(15); assertPve(m, 15);
  m.setLevel(16); assertPve(m, 16);
  m.rematch(); assertPve(m, 16);
});
