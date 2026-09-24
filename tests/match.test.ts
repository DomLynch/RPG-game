// The match session (src/match.ts): every mode driven through the production start / step / end code, no browser. The reward rule
// the journey test could not reach while it lived in main.ts (Lead, 2026-09-22): only a career fight touches the trial line, the
// scorecard and the career mark; a daily fight posts once; practice and replay write nothing; a late loader cannot overwrite a newer match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, nextSeed } from '../src/match.ts';
import { OPPONENTS, PLAYER_WEAPONS } from '../src/moves.ts';
import { WEAPON_SLOTS, fightWeapon, type Loot } from '../src/loot.ts';
import { initialPractice } from '../src/combat.ts';
import { createRecorder, decodeRecord, encodeRecord } from '../src/record.ts';
import { LADDER } from '../src/ladder.ts';
import { loadDaily, type DailyFight } from '../src/daily.ts';
import { loadProfile, type Profile } from '../src/profile.ts';
import { loadScorecard, type Scorecard } from '../src/scorecard.ts';
import { loadTrial, type Trial } from '../src/trial.ts';
import type { FightRecord } from '../src/record.ts';
import { STRATEGIES, act, idle } from './strategies.ts';
import type { Duel } from '../src/duel.ts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
type Table = { storage: ReturnType<typeof memory>; trial: Trial; scorecard: Scorecard; profile: Profile };
const table = (): Table => { const storage = memory(); return { storage, trial: loadTrial(storage), scorecard: loadScorecard(storage), profile: loadProfile(storage, () => 'device').profile }; };
const snapshot = (t: Table) => JSON.stringify({ card: t.trial.card, rows: t.scorecard.rows, marks: t.profile.career?.victoryMarks ?? 0 });
// The live thumb: draw (a light press while sheathed), walk at the warden, and cut when in reach — the battery's light spam from the
// page's own start (initialPractice: sheathed, four metres out), so the fight is what a first tap and a held stick produce.
const spam = (d: Duel) => {
  const p = d.fighters[0], w = d.fighters[1].body, dx = w.x - p.body.x, dz = w.z - p.body.z, gap = Math.hypot(dx, dz);
  return p.phase === 'sheathed' ? act('light') : gap > 1.9 ? { ...idle(), move: { x: dx / gap, z: dz / gap, yaw: 0, run: false } } : STRATEGIES['light spam']!(d);
};
const never = (): never => { throw new Error('a replay must step the record, never the live intent'); };
// Step a live fight to its end with the battery's light-spam script; the deterministic sim makes each seed's outcome a fact.
function play(match: Match, ticks = 7200) {
  for (let i = 0; i < ticks; i++) {
    const result = match.step(() => spam(match.practice.duel));
    if (result !== 'stepped') return result;
  }
  throw new Error(`no finish in ${ticks} ticks`);
}
const veteran = OPPONENTS.veteran;
// One seed the player wins on and one he dies on, found once; both must exist for the table below to cover a win and a loss.
const outcomes = (() => {
  let win: number | undefined, loss: number | undefined;
  for (let seed = 1; seed < 200 && (win === undefined || loss === undefined); seed++) {
    const t = table(), m = new Match(veteran, 'dev', t, seed);
    assert.equal(play(m), 'ended');
    const ended = m.end(false);
    if (ended.won) win ??= seed; else if (!m.practice.finish!.draw) loss ??= seed;
  }
  assert.ok(win !== undefined && loss !== undefined, `light spam needs a winning and a losing seed (win ${win}, loss ${loss})`);
  return { win, loss };
})();

test('match: the reward rule by mode — career scores, daily posts once, practice and replay award nothing', () => {
  const daily: DailyFight = { day: '2026-09-22', number: 12, seed: outcomes.win };
  const cases: { name: string; enter: (m: Match, t: Table) => void; mode: Match['mode']; rewarded: boolean; posts: boolean; recorded: boolean; scores: boolean }[] = [
    { name: 'career (the boot fight)', enter: () => {}, mode: 'career', rewarded: true, posts: false, recorded: true, scores: true },
    { name: 'career rematch', enter: (m) => m.rematch(), mode: 'career', rewarded: true, posts: false, recorded: true, scores: true },
    { name: 'daily', enter: (m) => assert.ok(m.startDaily(daily, m.epoch)), mode: 'daily', rewarded: false, posts: true, recorded: true, scores: false },
    { name: 'rematch after a daily = practice', enter: (m) => { assert.ok(m.startDaily(daily, m.epoch)); m.rematch(); }, mode: 'practice', rewarded: false, posts: false, recorded: true, scores: false },
    { name: 'PLAY NOW after a replay = practice', enter: (m, t) => { assert.ok(m.startReplay(recordOf(t), 0, m.epoch)); m.playNow(); }, mode: 'practice', rewarded: false, posts: false, recorded: true, scores: false },
    { name: 'rematch after PLAY NOW stays practice', enter: (m, t) => { assert.ok(m.startReplay(recordOf(t), 0, m.epoch)); m.playNow(); m.rematch(); }, mode: 'practice', rewarded: false, posts: false, recorded: true, scores: false },
    { name: 'replay', enter: (m, t) => assert.ok(m.startReplay(recordOf(t), 0, m.epoch)), mode: 'replay', rewarded: false, posts: false, recorded: false, scores: false },
  ];
  // A career record of the winning seed, for the replay cases (recorded on a throwaway table so it scores nothing here).
  const recordOf = (t: Table): FightRecord => { const m = new Match(veteran, 'dev', { ...t, storage: memory(), trial: loadTrial(memory()), scorecard: loadScorecard(memory()), profile: loadProfile(memory(), () => 'x').profile }, outcomes.win); play(m); return m.end(false).record!; };
  for (const c of cases) {
    for (const [outcome, seed] of [['win', outcomes.win], ['loss', outcomes.loss]] as const) {
      const t = table(), m = new Match(veteran, 'dev', t, seed);
      c.enter(m, t);
      const before = snapshot(t), rematches = t.trial.card.rematches;
      assert.equal(m.mode, c.mode, `${c.name}: mode`);
      assert.equal(m.practiceOnly, c.mode !== 'career', `${c.name}: practiceOnly follows the mode`);
      assert.equal(m.recorder !== null, c.recorded, `${c.name}: recorder`);
      const result = m.mode === 'replay' ? (() => { let r; do r = m.step(never); while (r === 'stepped'); return r; })() : play(m);
      assert.equal(result, 'ended', `${c.name} (${outcome}): the fight ends`);
      const ended = m.end(false);
      assert.equal(m.recorded, true);
      assert.equal(ended.rewarded, c.rewarded, `${c.name}: rewarded`);
      assert.equal(ended.record !== null, c.recorded, `${c.name}: a record`);
      assert.equal(ended.post !== null, c.posts, `${c.name}: a daily post`);
      if (c.mode === 'replay') { assert.equal(ended.won, false); assert.deepEqual(ended.lines, []); }
      else assert.equal(ended.won, m.practice.finish!.victim === 1 && !m.practice.finish!.draw, `${c.name}: won follows the finish`);
      if (c.scores) {
        assert.notEqual(snapshot(t), before, `${c.name} (${outcome}): the card, the scorecard or the marks moved`);
        assert.equal(t.trial.card.fights, 1); assert.equal(t.trial.card.rematches, rematches);
        assert.equal(t.scorecard.rows.veteran?.fights, 1);
        assert.equal(t.scorecard.rows.veteran?.wins, ended.won ? 1 : 0);
        assert.equal(t.profile.career?.victoryMarks ?? 0, ended.won ? 1 : 0, `${c.name} (${outcome}): one mark per won duel`);
        assert.equal(loadTrial(t.storage).card.fights, 1, 'the trial line is saved'); assert.equal(loadScorecard(t.storage).rows.veteran?.fights, 1, 'the scorecard is saved');
      } else {
        assert.equal(snapshot(t), before, `${c.name} (${outcome}): no trial line, no scorecard row, no mark`);
        assert.equal(loadTrial(t.storage).card.fights, 0); assert.deepEqual(loadScorecard(t.storage).rows, {});
      }
      if (c.posts) {
        assert.equal(ended.post!.daily, daily); assert.equal(ended.post!.record, ended.record);
        assert.deepEqual(loadDaily(t.storage, daily.day), { ...ended.post!.done, submitted: false }, 'the device knows the day is spent and not yet posted');
        assert.equal(ended.post!.done.outcome, ended.record!.outcome); assert.equal(ended.post!.done.ticks, ended.record!.ticks);
      }
    }
  }
});

test('match: a rematch reseeds and counts; a daily rematch drops the daily; PLAY NOW keeps the record seed; nextRung only after a career win', () => {
  const t = table(), m = new Match(veteran, 'dev', t, outcomes.win);
  assert.equal(m.seed, outcomes.win); assert.equal(m.epoch, 1);
  play(m); const first = m.end(false);
  assert.ok(first.won); assert.equal(m.nextRung()?.id, LADDER[1]!.id, 'a career win moves the ladder on');
  m.rematch();
  assert.equal(m.seed, nextSeed(outcomes.win)); assert.equal(m.epoch, 2); assert.equal(t.trial.card.rematches, 1); assert.equal(loadTrial(t.storage).card.rematches, 1);
  assert.equal(m.recorded, false); assert.equal(m.activeMs, 0); assert.deepEqual(m.fightLog, []); assert.equal(m.lastRecord, null); assert.equal(m.practice.duel.tick, 0);
  assert.equal(m.nextRung(), undefined, 'no rung before the fight ends');
  const daily: DailyFight = { day: '2026-09-22', number: 1, seed: 5 };
  assert.ok(m.startDaily(daily, m.epoch)); assert.equal(m.daily, daily); assert.equal(m.seed, 5); assert.equal(m.difficulty, 'normal');
  assert.deepEqual(loadDaily(t.storage, daily.day), { day: daily.day, started: true, submitted: false }, 'the attempt is spent the moment the fight starts');
  play(m); m.end(false);
  assert.equal(m.nextRung(), undefined, 'a daily win never moves the ladder');
  m.rematch();
  assert.equal(m.daily, null); assert.equal(m.mode, 'practice'); assert.equal(m.seed, nextSeed(5));
  play(m); const practiced = m.end(false);
  assert.equal(practiced.rewarded, false); assert.equal(practiced.post, null); assert.equal(m.nextRung(), undefined, 'a practice win never moves the ladder');
  // PLAY NOW after a replay: the record's seed, weapon and profile, live.
  const record = first.record!;
  assert.ok(m.startReplay({ ...record, profile: 'hard' }, 3, m.epoch));
  assert.equal(m.practice.duel.tick, 3, 'stepped silently to fromTick'); assert.equal(m.replay?.cursor, 3); assert.equal(m.difficulty, 'hard'); assert.equal(m.recorder, null);
  m.playNow();
  assert.equal(m.mode, 'practice'); assert.equal(m.seed, record.seed); assert.equal(m.difficulty, 'hard'); assert.equal(m.replay, null); assert.ok(m.recorder);
});

test('match: a late loader response cannot overwrite a newer match', () => {
  const t = table(), m = new Match(veteran, 'dev', t, outcomes.win);
  const asked = m.epoch;   // the kill link's fetch and the daily's request capture this before they await
  play(m); const record = m.end(false).record!;
  m.rematch();   // the player pressed Rematch while the link was loading
  const seed = m.seed, epoch = m.epoch;
  assert.equal(m.startReplay(record, 0, asked), false, 'the replay is refused');
  assert.equal(m.startDaily({ day: '2026-09-22', number: 1, seed: 9 }, asked), false, 'the daily is refused');
  assert.equal(m.mode, 'career'); assert.equal(m.seed, seed); assert.equal(m.epoch, epoch); assert.equal(m.replay, null); assert.equal(m.daily, null);
  assert.deepEqual(loadDaily(t.storage, '2026-09-22'), { day: '2026-09-22', started: false, submitted: false }, 'a refused daily spends nothing');
  assert.ok(m.startReplay(record, 0, m.epoch), 'the current epoch is accepted');
});

test('match: a replay steps the record and stalls when it runs out before its finish; a mid-fight difficulty change drops the recorder', () => {
  const t = table(), m = new Match(veteran, 'dev', t, outcomes.win);
  play(m); const record = m.end(false).record!;
  const short: FightRecord = { ...record, ticks: record.ticks - 5, intents: record.intents.slice(0, -5) };
  assert.ok(m.startReplay(short, 0, m.epoch));
  let result; do result = m.step(never); while (result === 'stepped');
  assert.equal(result, 'stalled'); assert.equal(m.stalled, true); assert.equal(m.practice.finish, null); assert.equal(m.practice.duel.tick, short.ticks);
  m.playNow();
  assert.equal(m.stalled, false); assert.equal(m.seed, record.seed);
  m.step(() => spam(m.practice.duel));
  m.setDifficulty('easy');
  assert.equal(m.recorder, null, 'a fight that changed warden mid-way is not replayable'); assert.equal(m.difficulty, 'easy');
  assert.equal(play(m), 'ended'); assert.equal(m.end(false).record, null, 'no record to share');
  m.setDifficulty('normal'); m.rematch();
  assert.ok(m.recorder, 'the next fight records again');
});

// The weapon take (Dom's phone, live e37a74c7: a taken weapon never reached the hand). main.ts builds the Match on fightWeapon(equipped)
// and the scene draws initialPractice(731, opponent, match.weapon)'s player weapon: for every weapon slot both must be the taken weapon.
test('an equipped weapon is the weapon the player fights with and the rig draws, for every weapon slot; the daily keeps the fixed kit', () => {
  for (const slot of WEAPON_SLOTS) {
    const loot: Loot = { owned: [`veteran.${slot}`], equipped: { main: `veteran.${slot}` } }, weapon = slot.toLowerCase();
    assert.ok(PLAYER_WEAPONS.includes(fightWeapon(loot)), `${slot}: a hero-rig weapon`);
    assert.equal(fightWeapon(loot), weapon, `${slot}: the equipped main hand`);
    const m = new Match(veteran, 'dev', table(), 731, fightWeapon(loot));
    const drawn = initialPractice(731, veteran, m.weapon).duel.fighters[0].weapon;   // scene.ts: what the player's rig holds
    assert.equal(m.practice.duel.fighters[0].weapon, weapon, `${slot}: the simulation swings it`);
    assert.equal(drawn, weapon, `${slot}: the rig draws it`);
    m.rematch(); assert.equal(m.practice.duel.fighters[0].weapon, weapon, `${slot}: a same-page rematch keeps it`);
    assert.ok(m.startDaily({ day: '2026-09-25', number: 1, seed: 5 } as DailyFight, m.epoch));
    assert.equal(m.practice.duel.fighters[0].weapon, 'longsword', `${slot}: the daily is fought in a fixed kit`);
  }
  assert.equal(fightWeapon(undefined), 'longsword'); assert.equal(fightWeapon({ owned: [], equipped: {} }), 'longsword');
});

test('a kill link fights and draws the record\'s weapon, not the viewer\'s equipped one', () => {
  const rec = createRecorder({ build: 'dev', opponent: 'veteran', weapon: 'trident', profile: 'normal', seed: 3 });
  rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const m = new Match(veteran, 'dev', table(), 731, 'knife');
  assert.ok(m.startReplay(rec.finish('abandoned'), 0, m.epoch));
  assert.equal(m.weapon, 'trident'); assert.equal(m.practice.duel.fighters[0].weapon, 'trident');
  m.playNow(); assert.equal(m.practice.duel.fighters[0].weapon, 'trident', 'PLAY NOW under the link keeps the drawn weapon');
});

test('a career fight with the equipped knife records the knife, and its kill link replays and draws the knife', async () => {
  const m = new Match(veteran, 'dev', table(), 731, fightWeapon({ owned: ['goblin.Knife'], equipped: { main: 'goblin.Knife' } }));
  play(m);
  const saved = m.end(false).record!;
  assert.equal(saved.weapon, 'knife', 'FightRecord.weapon carries match.weapon (createRecorder in Match.begin)');
  const record = await decodeRecord(await encodeRecord(saved)), viewer = new Match(veteran, 'dev', table(), 731, 'trident');
  assert.ok(viewer.startReplay(record, 0, viewer.epoch));
  assert.equal(viewer.practice.duel.fighters[0].weapon, 'knife', 'the replay sims the knife');
  assert.equal(initialPractice(731, veteran, viewer.weapon).duel.fighters[0].weapon, 'knife', 'the replay page draws the knife');
});
