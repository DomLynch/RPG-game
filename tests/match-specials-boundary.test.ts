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

const match = (level = 46) => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  return new Match(OPPONENTS.knight, 'test', {
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
  assert.equal(m.specials, true);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.specialShare), [RULES.special.damage, level >= RULES.special.bossFrom ? RULES.special.bossDamage : RULES.special.damage]);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.skillCooldown), [RULES.special.first, RULES.special.first]);
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
  assert.equal(m.practice.duel.fighters[1].specialName, undefined, 'class casts keep existing unnamed record identity');
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
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 'dummy' });
  assert.equal(m.specials, false, 'dummy training is outside ordinary PvE activation');
  assert.ok(m.practice.duel.fighters.every(f => f.specialShare === undefined));
  m.rematch(); assert.equal(m.specials, false);
  m.startSparring({ weapon: 'longsword', skill: null, difficulty: 'dummy' }, { first: 7 });
  assert.equal(m.specials, true, 'explicit preview still owns its flag');
  m.playNow(); assertPve(m, 6);
});
