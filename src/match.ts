// The match session (Lead (b) 2026-09-22, the GPT audit's one structural gap): the single owner of the fight's state and of every
// start, end and reset. main.ts wires the DOM, the renderer and the frame loop to this; nothing here touches the document, the
// network, a timer or the renderer, so tests/match.test.ts drives every mode through this same code.
// Five modes, explicit:
//   career   — the ladder fight: the trial line, the scorecard row, one career mark and the loot offer on a win.
//   practice — a rematch after a daily, or a kill link's PLAY NOW: recorded, replayable, nothing awarded (avenged, not scored).
//   replay   — a kill link playing back: the record's own intents, no recorder, no AFK mark, nothing awarded.
//   daily    — today's duel (src/daily.ts): practice rules, and its record is posted once.
//   sparring — an admin's test fight (src/sparring.ts, Dom 2026-09-26): any warden, level, weapon and move for this fight only; no recorder,
//              so no record, no share and no post, and nothing awarded or written (no trial line, no scorecard row, no mark).
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
import { type LootId } from './loot.ts';
import { stepSparring, type SparringKit } from './sparring.ts';
import type { Profile, StoragePort } from './profile.ts';

export type Mode = 'career' | 'practice' | 'replay' | 'daily' | 'sparring';
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
  skill: SkillId | null = null;   // the player's equipped skill (moves.ts SkillId), set as `weapon` is; the profile's (loot.skill, main.ts) through the constructor; a replay takes the record's; the daily keeps it
  weapon: WeaponId;   // the player's weapon (moves.ts PLAYER_WEAPONS): the equipped one (loot.ts fightWeapon) the page booted with; a replay takes the record's; the daily keeps it
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
  private clipProfile: Difficulty | null = null;   // an export clip's re-play steps on its record's profile (startClip); any start clears it
  stalled = false;   // a viewer page that cannot go on: the record ran out before its finish, or the link never decoded
  daily: DailyFight | null = null;   // today's duel when this page is the day's attempt
  dummy = false;   // a sparring fight against the no-attack dummy (src/sparring.ts stepSparring); `difficulty` then holds easy, the dummy's base
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
    if (mode !== 'sparring') this.dummy = false;
    this.epoch++;
    this.practice = initialPractice(this.seed, this.opponent, this.weapon, this.skill);
    this.recorder = mode === 'replay' || mode === 'sparring' ? null : createRecorder({ build: this.build, opponent: this.opponent.id, weapon: this.weapon, ...(this.skill ? { skill: this.skill } : {}), profile: this.difficulty, seed: this.seed });
    this.recorded = false; this.ended = null; this.activeMs = 0;
    this.frameEvents = []; this.fightLog = [];
    this.lastRecord = null; this.lastDrop = null; this.lastSkill = null;
    this.replay = null; this.stalled = false; this.clipProfile = null;
  }
  // Rematch: the same warden, differently seeded. A career fight stays career; a daily's rematch is practice (the day's one
  // attempt is over and never posts again); a practice fight stays practice.
  rematch() {
    if (this.mode === 'sparring') { this.seed = nextSeed(this.seed); this.begin('sparring'); return; }   // sparring writes nothing, rematches included
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
  // Export clip (src/clip.ts): the ended fight's own record re-played from fromTick on the page as it stands, without a start: the
  // mode, the result, the record, the drop and the epoch stay, so the kill screen (Next, the loot offer, Share) is the same after it.
  // end() was already called (`recorded`), so the re-play's killing tick is never 'ended' again; its last tick is 'stalled'.
  // Returns what endClip() puts back.
  startClip(record: FightRecord, fromTick: number) {
    const saved = { practice: this.practice, replay: this.replay, stalled: this.stalled, fightLog: this.fightLog };
    this.clipProfile = record.profile;   // the record's own warden; `difficulty` is untouched, so any start mid-clip fights on the player's own (Auditer review)
    let practice = initialPractice(record.seed, this.opponent, record.weapon, record.skill ?? null);
    for (let tick = 0; tick < fromTick; tick++) practice = stepPractice(practice, record.intents[tick], this.opponent.profiles[record.profile]);
    this.practice = practice; this.replay = { record, cursor: fromTick }; this.fightLog = []; this.frameEvents = [];
    return saved;
  }
  endClip(saved: ReturnType<Match['startClip']>) {
    this.practice = saved.practice; this.replay = saved.replay; this.stalled = saved.stalled; this.clipProfile = null; this.fightLog = saved.fightLog;
    this.frameEvents = [];
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
    this.daily = fight; this.seed = fight.seed; this.difficulty = 'normal';   // the daily is fought in the EQUIPPED kit, as the ladder is (Strategy 2026-09-26, Dom delegated; was the fixed longsword + day-one move): the Match keeps the weapon and skill main.ts booted it with (loot.ts fightWeapon + equippedSkill), or the carried longsword after a rearm
    saveDaily(this.ports.storage, { day: fight.day, started: true, submitted: false });
    this.begin('daily');
    return true;
  }
  // Sparring: the picked kit for this fight only. The profile (equipped weapon, skill, loot) is never touched; a rematch keeps the kit.
  startSparring(kit: SparringKit): void {
    this.weapon = kit.weapon; this.skill = kit.skill;
    this.dummy = kit.difficulty === 'dummy'; this.difficulty = kit.difficulty === 'dummy' ? 'easy' : kit.difficulty;
    this.daily = null;
    this.begin('sparring');
  }
  // The journal's difficulty cycle: a fight that changed warden mid-way is no longer replayable from one profile, so its recorder drops.
  // Before the draw nothing has happened yet (the player is still sheathed; the idle ticks since boot are all the recorder holds), so the
  // fight starts over on the new warden and keeps its record, and Share: dropping it there hid Share for any fight whose difficulty
  // was touched on the welcome screen (web, 2026-09-25). The epoch stays: a kill link or a daily asked for before the change still lands.
  setDifficulty(level: Difficulty) {
    // A re-play steps its record on the record's profile, and a daily is fought on normal (startDaily): a change there would make another
    // fight (a kill link's wrong outcome or 'stalled'; a daily posted on easy). Refused before the assignment; the label reads it back (Combat review, 2026-09-26).
    if (this.replay || this.mode === 'daily') return;
    this.difficulty = level;
    // Before the first tick too (the welcome screen pauses the sim): the recorder's header was written at the start, so it restarts on
    // the new profile. Returning early there left a record on 'normal' for a fight on 'easy', which no link or clip could re-play (web, 2026-09-26).
    if (!this.recorder || this.practice.finish) return;
    if (this.recorder.ticks === 0 || this.practice.duel.fighters[0].phase === 'sheathed') { const epoch = this.epoch; this.begin(this.mode); this.epoch = epoch; }
    else this.recorder = null;
  }
  // One simulation tick. A replay steps the record's next intent; a live fight steps the quantized live one (the recorder keeps it),
  // so live and replay see the same bits. 'stalled': the record ran out without its finish (this build steps it differently).
  // 'ended': this tick finished the fight, and end() is owed once.
  step(live: () => Intent): 'stepped' | 'ended' | 'stalled' {
    if (this.replay && this.replay.cursor >= this.replay.record.ticks) { this.stalled = true; return 'stalled'; }
    const stepped = this.replay ? this.replay.record.intents[this.replay.cursor++]! : this.recorder ? this.recorder.push(live()) : quantizeIntent(live());
    this.practice = this.dummy ? stepSparring(this.practice, stepped) : stepPractice(this.practice, stepped, this.opponent.profiles[this.clipProfile ?? this.difficulty]);
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
    if (this.mode === 'sparring') return this.ended = { record: null, lines: [], won: won(finish), rewarded: false, post: null };   // no record, no mark, no row: nothing leaves the fight
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
