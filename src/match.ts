// The match session (Lead (b) 2026-09-22, the GPT audit's one structural gap): the single owner of the fight's state and of every
// start, end and reset. main.ts wires the DOM, the renderer and the frame loop to this; nothing here touches the document, the
// network, a timer or the renderer, so tests/match.test.ts drives every mode through this same code.
// Four modes, explicit:
//   career   — the ladder fight: the trial line, the scorecard row, one career mark and the loot offer on a win.
//   practice — a rematch after a daily, or a kill link's PLAY NOW: recorded, replayable, nothing awarded (avenged, not scored).
//   replay   — a kill link playing back: the record's own intents, no recorder, no AFK mark, nothing awarded.
//   daily    — today's duel (src/daily.ts): practice rules, and its record is posted once.
// Every reset goes through begin(): adding a piece of match state means clearing it in one place, not six.
import { initialPractice, stepPractice, PROFILES, type CombatEvent, type Intent, type Opponent, type Practice } from './combat.ts';
import { createRecorder, quantizeIntent, type FightRecord } from './record.ts';
import type { SkillId, WeaponId } from './moves.ts';
import { recordPractice, recordRematch, saveTrial, type Trial } from './trial.ts';
import { recordResult, saveScorecard, type Scorecard } from './scorecard.ts';
import { awardMark } from './career.ts';
import { saveDaily, type DailyFight, type DailyState } from './daily.ts';
import { autopsy } from './autopsy.ts';
import { blowsTaken } from './events.ts';
import { readOpponent } from './ai.ts';
import { nextAfter, won } from './ladder.ts';
import type { LootId } from './loot.ts';
import type { Profile, StoragePort } from './profile.ts';

export type Mode = 'career' | 'practice' | 'replay' | 'daily';
export type Difficulty = keyof typeof PROFILES;
type Recorder = ReturnType<typeof createRecorder>;
// What the page keeps and the match writes: the device's trial tally, scorecard and fighter profile, and the storage they save to.
export type MatchPorts = { storage: StoragePort; trial: Trial; scorecard: Scorecard; profile: Profile };
// The end of a fight, for the page to show: the record (null in a replay, or when a mid-fight difficulty change dropped the
// recorder), the autopsy lines, whether the player won, whether the fight counted (career only) and the daily post still owed
// to the network (daily only; the device already knows the day is spent).
export type Ended = {
  record: FightRecord | null; lines: string[]; won: boolean; rewarded: boolean;
  post: { daily: DailyFight; record: FightRecord; taken: number; done: DailyState } | null;
};
// The rematch seed: a different warden every rematch, deterministic from the last (the browser gate times the fixed 731 opener).
export const nextSeed = (seed: number): number => (Math.imul(seed, 1664525) + 1013904223) >>> 0;

export class Match {
  mode: Mode = 'career';
  seed: number;
  skill: SkillId | null = null;   // the player's equipped skill (moves.ts SkillId), set as `weapon` is; the profile's (loot.skill, main.ts) through the constructor; a replay takes the record's, the daily's fixed kit has none
  weapon: WeaponId;   // the player's weapon (moves.ts PLAYER_WEAPONS): the equipped one (loot.ts fightWeapon) the page booted with; a replay takes the record's, the daily the fixed kit's longsword
  difficulty: Difficulty = 'normal';
  practice: Practice;
  recorder: Recorder | null = null;
  recorded = false;
  private ended: Ended | null = null;   // end() once: a second call hands back the same result with nothing to post and nothing re-awarded
  activeMs = 0;   // real unpaused wall-clock of the current fight (hit-stop included), beside the simulation's tick count
  frameEvents: CombatEvent[] = [];   // this frame's events, for the renderer; main.ts empties it after each draw
  fightLog: CombatEvent[] = [];   // every event of the current fight, for the death-screen autopsy (src/autopsy.ts reads the whole fight)
  lastRecord: FightRecord | null = null;
  lastDrop: LootId | null = null;   // the piece this fight dropped, so a Share can fill its record id once (src/loot.ts Provenance)
  lastSkill: SkillId | null = null;   // the move this fight's take stored instead of a piece: the one take per win covers both
  replay: { record: FightRecord; cursor: number } | null = null;
  stalled = false;   // a viewer page that cannot go on: the record ran out before its finish, or the link never decoded
  daily: DailyFight | null = null;   // today's duel when this page is the day's attempt
  // Counts every start. A loader that was asked before a start (a kill link's fetch, the daily's request) hands its epoch back
  // with the record; a stale epoch is refused, so a late response never overwrites a newer match.
  epoch = 0;
  readonly opponent: Opponent;
  private readonly build: string;
  private readonly ports: MatchPorts;
  constructor(opponent: Opponent, build: string, ports: MatchPorts, seed = 731, weapon: WeaponId = 'longsword', skill: SkillId | null = null) {
    this.opponent = opponent; this.build = build; this.ports = ports;
    this.seed = seed; this.weapon = weapon; this.skill = skill;
    this.practice = initialPractice(seed, opponent, this.weapon, this.skill);
    this.begin('career');
  }
  get practiceOnly(): boolean { return this.mode !== 'career'; }
  // The one reset. Everything a fight owns starts here; `daily`, `seed`, `weapon` and `difficulty` are set by the caller first.
  private begin(mode: Mode) {
    this.mode = mode;
    this.epoch++;
    this.practice = initialPractice(this.seed, this.opponent, this.weapon, this.skill);
    this.recorder = mode === 'replay' ? null : createRecorder({ build: this.build, opponent: this.opponent.id, weapon: this.weapon, ...(this.skill ? { skill: this.skill } : {}), profile: this.difficulty, seed: this.seed });
    this.recorded = false; this.ended = null; this.activeMs = 0;
    this.frameEvents = []; this.fightLog = [];
    this.lastRecord = null; this.lastDrop = null; this.lastSkill = null;
    this.replay = null; this.stalled = false;
  }
  // Rematch: the same warden, differently seeded. A career fight stays career; a daily's rematch is practice (the day's one
  // attempt is over and never posts again); a practice fight stays practice.
  rematch() {
    recordRematch(this.ports.trial); saveTrial(this.ports.storage, this.ports.trial);
    this.daily = null;
    this.seed = nextSeed(this.seed);
    this.begin(this.mode === 'career' ? 'career' : 'practice');
  }
  // PLAY NOW on a viewer page: the same warden and the record's seed (a stalled page keeps the seed it has), live, practice only.
  playNow() {
    if (this.replay) this.seed = this.replay.record.seed;
    this.daily = null;
    this.begin('practice');
  }
  // After a career win the ladder moves on; the next fighter is another rig, so the page reloads on that rung (main.ts).
  nextRung(): { id: Opponent['id']; name: string } | undefined { return this.mode === 'career' && won(this.practice.finish) ? nextAfter(this.opponent.id) : undefined; }
  // A kill link: the fight on the record's seed, weapon and warden profile, stepped silently to fromTick and played from there.
  // Refused (false) when a start happened after the link was asked for: the fight now in play stays.
  startReplay(record: FightRecord, fromTick: number, epoch: number): boolean {
    if (epoch !== this.epoch) return false;
    this.seed = record.seed; this.weapon = record.weapon; this.skill = record.skill ?? null; this.difficulty = record.profile;
    this.daily = null;
    this.begin('replay');
    for (let tick = 0; tick < fromTick; tick++) this.practice = stepPractice(this.practice, record.intents[tick], this.opponent.profiles[this.difficulty]);
    this.replay = { record, cursor: fromTick };
    return true;
  }
  // The rig could not carry the weapon (its equip file failed): the fight is fought with the one it does carry, so drawn = simulated.
  // A live fight starts over on it (the rigs land before the controls wake: nothing the player did is lost); a replay cannot change
  // weapon, so it becomes the unreadable-link page and PLAY NOW fights on the carried one. False when the weapon was already the carried one.
  rearm(weapon: WeaponId): boolean {
    if (weapon === this.weapon) return false;
    this.weapon = weapon;
    const replay = this.mode === 'replay';
    this.begin(replay ? 'practice' : this.mode);
    this.stalled = replay;   // the unreadable-link page: one line, PLAY NOW under it
    return true;
  }
  // Today's duel: its seed on the normal profile, and the day's one attempt is spent the moment the fight starts (a reload
  // mid-fight is the attempt). Refused (false) after a later start, as startReplay.
  startDaily(fight: DailyFight, epoch: number): boolean {
    if (epoch !== this.epoch) return false;
    this.daily = fight; this.seed = fight.seed; this.difficulty = 'normal'; this.weapon = 'longsword'; this.skill = null;   // the daily is fought in a fixed kit (docs/SCOPE.md, Brief 19)
    saveDaily(this.ports.storage, { day: fight.day, started: true, submitted: false });
    this.begin('daily');
    return true;
  }
  // The journal's difficulty cycle: a fight that changed warden mid-way is no longer replayable from one profile, so its recorder drops.
  setDifficulty(level: Difficulty) {
    this.difficulty = level;
    if (this.recorder && this.recorder.ticks > 0 && !this.practice.finish) this.recorder = null;
  }
  // One simulation tick. A replay steps the record's next intent; a live fight steps the quantized live one (the recorder keeps it),
  // so live and replay see the same bits. 'stalled': the record ran out without its finish (this build steps it differently).
  // 'ended': this tick finished the fight, and end() is owed once.
  step(live: () => Intent): 'stepped' | 'ended' | 'stalled' {
    if (this.replay && this.replay.cursor >= this.replay.record.ticks) { this.stalled = true; return 'stalled'; }
    const stepped = this.replay ? this.replay.record.intents[this.replay.cursor++]! : this.recorder ? this.recorder.push(live()) : quantizeIntent(live());
    this.practice = stepPractice(this.practice, stepped, this.opponent.profiles[this.difficulty]);
    this.frameEvents.push(...this.practice.events); this.fightLog.push(...this.practice.events);
    return this.practice.finish && !this.recorded ? 'ended' : 'stepped';
  }
  // The end of the fight, once: the record is finished, the autopsy read, and the reward rule applied — a career fight writes the trial
  // line, the scorecard row and (on a win) the career mark; a daily fight marks the day done on the device and hands back the post;
  // practice and replay write nothing. `afk`: the fight ended while the player was away (a loss flagged left on the scorecard).
  // Once per fight, enforced here and not only by the caller (GPT audit 2026-09-24, finding D): before the finish it throws (there is
  // no result to record); after the first call it returns that result with `post` cleared and `rewarded` false, so a repeat can neither
  // award again nor hand the page a second daily submission.
  end(afk: boolean): Ended {
    const { practice, opponent, ports } = this, finish = practice.finish;
    if (!finish) throw new Error('Match.end() before the fight finished');
    if (this.ended) return { ...this.ended, rewarded: false, post: null };
    this.recorded = true;
    if (this.mode === 'replay') return this.ended = { record: null, lines: [], won: false, rewarded: false, post: null };
    const record = this.recorder ? this.recorder.finish(finish.draw ? 'draw' : finish.victim === 1 ? 'killed' : 'died') : null;
    this.lastRecord = record;
    const lines = autopsy(practice.ai.habits, readOpponent(practice.ai.habits), this.fightLog, practice.duel);
    let post: Ended['post'] = null;
    if (this.mode === 'daily' && this.daily && record) {
      const taken = blowsTaken(this.fightLog, 0);   // hits, broken guards and chip through the player's OWN block (events.ts: a block's actor is the defender)
      const done: DailyState = { day: this.daily.day, started: true, submitted: false, outcome: record.outcome, ticks: record.ticks };
      saveDaily(ports.storage, done);
      post = { daily: this.daily, record, taken, done };
    }
    const rewarded = this.mode === 'career', victory = won(finish);
    if (rewarded) {   // an avenged fight is practice: it never touches the card, the scorecard or the marks
      recordPractice(ports.trial, practice, Math.round(this.activeMs));
      saveTrial(ports.storage, ports.trial);
      recordResult(ports.scorecard, opponent.id, victory ? 'win' : finish.draw ? 'draw' : 'loss', afk, lines);   // a fight lost while away is a loss, flagged left
      saveScorecard(ports.storage, ports.scorecard);
      if (victory) { awardMark(ports.profile); this.lastDrop = null; }   // one career mark per won duel (owner beta policy 2026-09-20); the loot offer is the page's
    }
    return this.ended = { record, lines, won: victory, rewarded, post };
  }
}
