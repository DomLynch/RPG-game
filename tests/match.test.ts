// The match session (src/match.ts): every mode driven through the production start / step / end code, no browser. The reward rule
// the journey test could not reach while it lived in main.ts (Lead, 2026-09-22): only a career fight touches the trial line, the
// scorecard and the career mark; practice and replay write nothing; a late loader cannot overwrite a newer match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, equipNotice, nextSeed } from '../src/match.ts';
import { OPPONENTS, PLAYER_WEAPONS } from '../src/moves.ts';
import { WEAPON_SLOTS, equippedSkill, fightWeapon, type Loot } from '../src/loot.ts';
import { initialPractice } from '../src/combat.ts';
import { createRecorder, decodeRecord, encodeRecord } from '../src/record.ts';
import { LADDER } from '../src/ladder.ts';
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

// Re-pinned (Daily removed, Dom 2026-09-29): the daily and rematch-after-a-daily cases and the post column are gone with the mode.
test('match: the reward rule by mode — career scores, practice and replay award nothing', () => {
  const cases: { name: string; enter: (m: Match, t: Table) => void; mode: Match['mode']; rewarded: boolean; recorded: boolean; scores: boolean }[] = [
    { name: 'career (the boot fight)', enter: () => {}, mode: 'career', rewarded: true, recorded: true, scores: true },
    { name: 'career rematch', enter: (m) => m.rematch(), mode: 'career', rewarded: true, recorded: true, scores: true },
    { name: 'PLAY NOW after a replay = practice', enter: (m, t) => { assert.ok(m.startReplay(recordOf(t), 0, m.epoch)); m.playNow(); }, mode: 'practice', rewarded: false, recorded: true, scores: false },
    { name: 'rematch after PLAY NOW stays practice', enter: (m, t) => { assert.ok(m.startReplay(recordOf(t), 0, m.epoch)); m.playNow(); m.rematch(); }, mode: 'practice', rewarded: false, recorded: true, scores: false },
    { name: 'replay', enter: (m, t) => assert.ok(m.startReplay(recordOf(t), 0, m.epoch)), mode: 'replay', rewarded: false, recorded: false, scores: false },
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
    }
  }
});

// Re-pinned (Daily removed, Dom 2026-09-29): the daily rematch leg is gone.
test('match: a rematch reseeds and counts; PLAY NOW keeps the record seed; nextRung only after a career win', () => {
  const t = table(), m = new Match(veteran, 'dev', t, outcomes.win);
  assert.equal(m.seed, outcomes.win); assert.equal(m.epoch, 1);
  play(m); const first = m.end(false);
  assert.ok(first.won); const next = m.nextRung(); assert.ok(next && next.id !== veteran.id && LADDER.some(o => o.id === next.id), 'a career win moves the ladder on: a pick from the pass\'s unbeaten (ladder.ts nextOpponent)'); assert.deepEqual(next!.pass, [veteran.id], 'the pass records the Centurion beaten');
  m.rematch();
  assert.equal(m.seed, nextSeed(outcomes.win)); assert.equal(m.epoch, 2); assert.equal(t.trial.card.rematches, 1); assert.equal(loadTrial(t.storage).card.rematches, 1);
  assert.equal(m.recorded, false); assert.equal(m.activeMs, 0); assert.deepEqual(m.fightLog, []); assert.equal(m.lastRecord, null); assert.equal(m.practice.duel.tick, 0);
  assert.equal(m.nextRung(), undefined, 'no rung before the fight ends');
  // PLAY NOW after a replay: the record's seed, weapon and profile, live.
  const record = first.record!;
  assert.ok(m.startReplay({ ...record, level: 46 }, 3, m.epoch));
  assert.equal(m.practice.duel.tick, 3, 'stepped silently to fromTick'); assert.equal(m.replay?.cursor, 3); assert.equal(m.level, 46); assert.equal(m.recorder, null);
  m.playNow();
  assert.equal(m.mode, 'practice'); assert.equal(m.seed, record.seed); assert.equal(m.level, 46); assert.equal(m.replay, null); assert.ok(m.recorder);
});

test('match: a late loader response cannot overwrite a newer match', () => {
  const t = table(), m = new Match(veteran, 'dev', t, outcomes.win);
  const asked = m.epoch;   // the kill link's fetch captures this before it awaits
  play(m); const record = m.end(false).record!;
  m.rematch();   // the player pressed Rematch while the link was loading
  const seed = m.seed, epoch = m.epoch;
  assert.equal(m.startReplay(record, 0, asked), false, 'the replay is refused');
  assert.equal(m.mode, 'career'); assert.equal(m.seed, seed); assert.equal(m.epoch, epoch); assert.equal(m.replay, null);
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
  m.setLevel(6);
  assert.equal(m.recorder, null, 'a fight that changed warden mid-way is not replayable'); assert.equal(m.level, 6);
  assert.equal(play(m), 'ended'); assert.equal(m.end(false).record, null, 'no record to share');
  m.setLevel(18); m.rematch();
  assert.ok(m.recorder, 'the next fight records again');
});

// Share was hidden on any fight whose difficulty was touched before the draw (web, 2026-09-25): the recorder counts the idle ticks from boot,
// so a change on the welcome screen dropped it. Before the draw the fight starts over on the new warden and keeps its record (and Share);
// a change once the fight is under way still drops it, as that fight is no longer replayable from one profile.
test('match: a difficulty change before the draw keeps the record (Share); one at tick 400 drops it', () => {
  const before = new Match(veteran, 'dev', table(), outcomes.win);
  for (let i = 0; i < 30; i++) before.step(idle);
  assert.ok(before.recorder!.ticks > 0 && before.practice.duel.fighters[0].phase === 'sheathed');
  const epoch = before.epoch;
  before.setLevel(6);
  assert.equal(before.epoch, epoch, 'a kill link asked for before the change still lands');
  assert.ok(before.recorder, 'the fight starts over on the new warden, still recorded');
  assert.equal(before.practice.duel.tick, 0);
  assert.equal(play(before), 'ended');
  const record = before.end(false).record;
  assert.ok(record, 'a record to share'); assert.equal(record!.level, 6);
  // Before the FIRST tick (the welcome screen pauses the sim): the header was written at the start and must follow (web, 2026-09-26:
  // it stayed 'normal' for a fight on 'easy', so a kill link or clip re-played on the wrong warden and never reached the kill).
  const first = new Match(veteran, 'dev', table(), outcomes.win);
  first.setLevel(6);
  assert.equal(play(first), 'ended');
  const firstRecord = first.end(false).record!;
  assert.equal(firstRecord.level, 6, 'the record names the profile the fight was fought on');
  const again = new Match(veteran, 'dev', table(), outcomes.win);
  assert.ok(again.startReplay(firstRecord, 0, again.epoch));
  again.setLevel(46);   // refused on a re-play: the record's profile plays
  assert.equal(again.level, 6);
  let replayed; do replayed = again.step(never); while (replayed === 'stepped');
  assert.equal(replayed, 'ended', 'the re-play reaches the kill'); assert.equal(again.practice.duel.tick, firstRecord.ticks);
  assert.equal(again.practice.finish?.victim, firstRecord.outcome === 'killed' ? 1 : 0, 'with the same outcome');
  const mid = new Match(veteran, 'dev', table(), outcomes.win);
  let ticks = 0, result: string = 'stepped';
  while (result !== 'ended' && ticks < 7200) { if (++ticks === 400) mid.setLevel(6); result = mid.step(() => spam(mid.practice.duel)); }
  assert.equal(result, 'ended'); assert.equal(mid.end(false).record, null, 'changed mid-fight: no record, no Share');
});

// (Daily removed, Dom 2026-09-29: the "a daily ends with a record, so Share shows" test went with the mode.)

test('match: end() is once — before the finish it throws; a second call hands back the same result with nothing re-awarded (GPT audit 2026-09-24, D)', () => {
  const t = table(), m = new Match(veteran, 'dev', t, outcomes.win);
  assert.throws(() => m.end(false), /before the fight finished/);
  play(m);
  const first = m.end(false), before = snapshot(t);
  assert.ok(first.won && first.rewarded);
  const again = m.end(false);
  assert.equal(snapshot(t), before, 'no second trial line, scorecard row or mark');
  assert.equal(again.record, first.record); assert.deepEqual(again.lines, first.lines); assert.equal(again.won, true);
  assert.equal(again.rewarded, false);
});

// (Daily removed, Dom 2026-09-29: the daily's hits-taken test went with the post it fed; events.test.ts still pins blowsTaken.)

// The weapon take (Dom's phone, live e37a74c7: a taken weapon never reached the hand). main.ts builds the Match on fightWeapon(equipped)
// and the scene draws initialPractice(731, opponent, match.weapon)'s player weapon: for every weapon slot both must be the taken weapon.
test('an equipped weapon is the weapon the player fights with and the rig draws, for every weapon slot', () => {
  for (const slot of WEAPON_SLOTS) {
    const loot: Loot = { owned: [`veteran.${slot}`], equipped: { main: `veteran.${slot}` } }, weapon = slot.toLowerCase();
    assert.ok(PLAYER_WEAPONS.includes(fightWeapon(loot)), `${slot}: a hero-rig weapon`);
    assert.equal(fightWeapon(loot), weapon, `${slot}: the equipped main hand`);
    const m = new Match(veteran, 'dev', table(), 731, fightWeapon(loot));
    const drawn = initialPractice(731, veteran, m.weapon).duel.fighters[0].weapon;   // scene.ts: what the player's rig holds
    assert.equal(m.practice.duel.fighters[0].weapon, weapon, `${slot}: the simulation swings it`);
    assert.equal(drawn, weapon, `${slot}: the rig draws it`);
    m.rematch(); assert.equal(m.practice.duel.fighters[0].weapon, weapon, `${slot}: a same-page rematch keeps it`);
  }
  assert.equal(fightWeapon(undefined), 'longsword'); assert.equal(fightWeapon({ owned: [], equipped: {} }), 'longsword');
});

// The fight draws the equipped kit: the record names that kit, and a kill link of it fights it again. Re-pinned (Daily removed, Dom 2026-09-29): was the daily's
// version of this test; the career fight carries the same kit.
test('a fight with an equipped estoc and move fights, records and re-plays them; no equipped main hand is the longsword', () => {
  const loot: Loot = { owned: ['nightborn.Estoc'], equipped: { main: 'nightborn.Estoc' }, skill: 'witchfire' };
  const m = new Match(veteran, 'dev', table(), 731, fightWeapon(loot), equippedSkill(loot));
  assert.equal(m.weapon, 'estoc'); assert.equal(m.practice.duel.fighters[0].weapon, 'estoc', 'the fight swings the equipped estoc');
  assert.equal(m.practice.duel.fighters[0].skill, 'witchfire', 'and carries the equipped move');
  assert.equal(play(m), 'ended');
  const ended = m.end(false), record = ended.record!;
  assert.equal(record.weapon, 'estoc'); assert.equal(record.skill, 'witchfire');
  const again = new Match(veteran, 'dev', table(), 731, 'longsword');
  assert.ok(again.startReplay(record, 0, again.epoch));
  assert.equal(again.practice.duel.fighters[0].weapon, 'estoc', 'the re-play fights the record\'s estoc, not the viewer\'s longsword');
  let replayed; do replayed = again.step(never); while (replayed === 'stepped');
  assert.equal(replayed, 'ended'); assert.equal(again.practice.duel.tick, record.ticks);
  assert.equal(again.practice.finish?.victim, record.outcome === 'killed' ? 1 : 0, 'with the same outcome');
  const bare = new Match(veteran, 'dev', table(), 731, fightWeapon(undefined), equippedSkill(undefined));
  assert.equal(bare.practice.duel.fighters[0].weapon, 'longsword', 'no equipped main hand: the longsword');
  assert.equal(bare.practice.duel.fighters[0].skill, 'pommel', 'and the day-one move');
});

test('a kill link fights and draws the record\'s weapon, not the viewer\'s equipped one', () => {
  const rec = createRecorder({ build: 'dev', opponent: 'veteran', weapon: 'trident', level: 18, seed: 3 });
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

test('a weapon without an equip file in the build, or whose file fails at load, is fought and drawn as the longsword', async () => {
  const loot: Loot = { owned: ['veteran.Trident'], equipped: { main: 'veteran.Trident' } };
  assert.equal(fightWeapon(loot, ['longsword', 'knife']), 'longsword', 'no trident file in the build: the longsword before the Match exists');
  assert.equal(fightWeapon(loot, PLAYER_WEAPONS), 'trident');
  // The file failed at runtime (characters.ts armWarriors carries the longsword): the live fight starts over on it before the controls wake.
  const m = new Match(veteran, 'dev', table(), 731, 'trident');
  assert.equal(m.rearm('trident'), false, 'the rig carries what was asked: nothing changes');
  assert.ok(m.rearm('longsword')); assert.equal(m.weapon, 'longsword'); assert.equal(m.mode, 'career');
  assert.equal(m.practice.duel.fighters[0].weapon, 'longsword'); assert.equal(m.recorder?.ticks, 0);
  play(m); assert.equal(m.end(false).record!.weapon, 'longsword', 'the record carries what was fought');
  // A kill link whose weapon could not be drawn becomes the unreadable-link page; PLAY NOW fights on the longsword.
  const rec = createRecorder({ build: 'dev', opponent: 'veteran', weapon: 'trident', level: 18, seed: 3 });
  rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const v = new Match(veteran, 'dev', table(), 731, 'knife');
  assert.ok(v.startReplay(rec.finish('abandoned'), 0, v.epoch)); assert.ok(v.rearm('longsword'));
  assert.equal(v.replay, null); assert.equal(v.stalled, true); assert.equal(v.mode, 'practice');
  v.playNow(); assert.equal(v.practice.duel.fighters[0].weapon, 'longsword');
});

// The player's stored difficulty (main.ts DIFFICULTY_KEY, Dom via Strategy 2026-09-26): the Match is BUILT on it, so the very first
// fight's recorder names it — a setDifficulty() after construction is not the same thing (the header was written by begin()).
test('match: a Match built on the stored difficulty records its first fight on that profile', () => {
  const m = new Match(veteran, 'dev', table(), outcomes.win, 'longsword', null, 46);
  assert.equal(m.level, 46);
  assert.equal(play(m), 'ended');
  const record = m.end(false).record;
  assert.ok(record, 'a record to share'); assert.equal(record!.level, 46, 'the first fight is recorded on the stored pick, not on normal');
  assert.equal(new Match(veteran, 'dev', table(), outcomes.win).level, 18, 'the default is unchanged');
});

test('an equip file that fails in a live fight: a visible line, and nothing is unequipped, so the next page load asks for the file again (Lead P1, 2026-09-26)', () => {
  const loot: Loot = { owned: ['nightborn.Estoc'], equipped: { main: 'nightborn.Estoc' } }, t = table();
  const m = new Match(veteran, 'dev', t, 731, fightWeapon(loot, PLAYER_WEAPONS));
  assert.equal(m.weapon, 'estoc');
  const before = JSON.stringify(loot), weaponWrites = () => JSON.stringify(t.profile).includes('longsword');
  assert.ok(m.rearm('longsword'));
  assert.equal(equipNotice('estoc', 'longsword'), 'Your estoc could not load; fighting with the longsword');
  assert.equal(JSON.stringify(loot), before, 'the loot keeps the estoc equipped');
  assert.ok(!weaponWrites(), 'the profile never records the fallback weapon');
  assert.equal(new Match(veteran, 'dev', table(), 731, fightWeapon(loot, PLAYER_WEAPONS)).weapon, 'estoc', 'the next boot asks for the estoc again');
});

test('the dial turns on the rank the page shows: a signed-in rank of 11 over a device count of 0 steps the dial to 10 after two losses, not to the floor (Lead 2026-09-27)', () => {
  const t = table(), rank = () => 11;
  for (let i = 0; i < 2; i++) { const m = new Match(veteran, 'dev', { ...t, rank }, outcomes.loss); assert.equal(play(m), 'ended'); assert.equal(m.end(false).won, false); }
  assert.equal(t.profile.dial?.level, 10, 'two losses at rank 11: dial 10');
  const d = table();
  for (let i = 0; i < 2; i++) { const m = new Match(veteran, 'dev', d, outcomes.loss); play(m); m.end(false); }
  assert.equal(d.profile.dial?.level, 1, 'no rank port: the device count\'s rank (level 1), as before');
});
