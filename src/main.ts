import { createInput } from './input.ts';
import type { WeaponId } from './moves.ts';
import { formatCard, loadTrial, recordFight, recordPractice, recordRematch, saveTrial } from './trial.ts';
import { createRecorder, decodeRecord, encodeRecord, quantizeIntent, type FightRecord } from './record.ts';
import { api } from './api.ts';
import { session } from './session.ts';
import { fetchSharedRecord, publishRecord, shortLink, shortParam } from './share-store.ts';
import { replayParam, shareUrl, verifyRecord } from './replay.ts';
import './monitoring.ts';
import { captureException } from '@sentry/browser';
import './style.css';
import { wrapAngle } from './sim.ts';
import { cleanName, loadProfile, saveProfile, type StoragePort } from './profile.ts';
import { awardMark, marksOf, rankFor } from './career.ts';
import { dropFor, lootName, store } from './loot.ts';
import { loadScorecard, recordResult, saveScorecard, scorecardRows } from './scorecard.ts';
import { readOpponent } from './ai.ts';
import { dailyBoard, dailyOpponent, dailyParam, dailyShareText, fetchDaily, fetchDailyBoard, loadDaily, postDaily, saveDaily, type DailyFight } from './daily.ts';
import { autopsy } from './autopsy.ts';
import {
  initialPractice,
  stepPractice,
  describe,
  PROFILES,
  type CombatEvent,
} from './combat.ts';
import { ROSTER, isOpponentId, resolveFinisher } from './roster.ts';
import { createFeedback } from './feedback.ts';
import { createScene } from './scene.ts';
import { phoneTier } from './quality.ts';
import { LADDER, opponentFor, won, nextAfter } from './ladder.ts';
import type { FinisherId } from './finishers.ts';

import { HEAVY_MOVES, createHud } from './hud.ts';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('world');
// Page zoom is locked (owner, 2026-09-17: an accidental pinch cost the HUD mid-fight; the accessibility trade is recorded in
// tests/input.test.ts). iOS Safari ignores the viewport meta in the browser, so the pinch gesture itself is blocked here.
for (const type of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(type, (event) => event.preventDefault());
// Not enough on its own: with the camera free, a second finger landing while the first orbits the arena still zoomed the
// whole page on iPhone (owner, 2026-09-21). Refuse every two-finger move at the document, non-passive, so the pinch never
// starts. A single finger keeps every tap, drag and stick move: only moves with two or more touches are refused.
document.addEventListener('touchmove', (event) => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });
document.addEventListener('touchstart', (event) => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });   // a pinch whose first move slips through can still start Safari's zoom: refuse the second finger at touchstart too
const feedback = createFeedback();
// WebKit grants audio activation on touchend/click/keydown, not the touch-start phase; the combat buttons also
// preventDefault on pointerdown, which suppresses click. Listen to the whole family so the first tap unlocks on iOS.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
  window.addEventListener(type, () => feedback.unlock(), { passive: true });
for (const id of ['sound-button', 'mobile-sound'])
  element(id).addEventListener('click', () => {
    const enabled = feedback.toggle();
    for (const target of ['sound-button', 'mobile-sound']) {
      element(target).textContent = enabled ? 'Sound on' : 'Sound off';
      element(target).setAttribute('aria-pressed', String(enabled));
    }
  });
const welcome = element('welcome');
const journal = element<HTMLDialogElement>('journal');
const message = element('message');
const autopsyLines = element('autopsy');
// The death-screen autopsy: at most two lines between the kill and the rematch button; hidden when there is nothing confident to say.
function showAutopsy(lines: string[]) { autopsyLines.hidden = !lines.length; autopsyLines.replaceChildren(...lines.map((line) => { const span = document.createElement('span'); span.textContent = line; return span; })); }
const lootDrop = element('loot-drop');
function showLootDrop(text: string | null) { lootDrop.hidden = !text; lootDrop.textContent = text ?? ''; }
const cameraButton = element<HTMLButtonElement>('camera-button');
const attackButton = element<HTMLButtonElement>('attack-button');
const resetButton = element<HTMLButtonElement>('reset-button');
const hud = createHud(element);
const runButton = element<HTMLButtonElement>('run-button');
const input = element<HTMLInputElement>('fighter-name');
const storage: StoragePort = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
const loaded = loadProfile(storage, () => crypto.randomUUID());
const profile = loaded.profile;
input.value = profile.name === 'Wanderer' ? '' : profile.name;
welcome.hidden = loaded.returning;
function persist() {
  const rank = rankFor(marksOf(profile));   // career rank: marks only ever rise (GAME_SPEC ladder), so this never shows a demotion
  const saved = saveProfile(storage, profile) ? 'Guest · saved on this device' : 'Storage unavailable · name will not be saved';
  // The HUD identity and the journal's fighter card show the same three facts.
  for (const [id, text] of [['name-button', profile.name], ['journal-name', profile.name], ['rank-sigil', rank.numeral || '✦'], ['journal-sigil', rank.numeral || '✦'],
    ['rank', rank.label], ['journal-rank', rank.label], ['save-status', saved], ['journal-save', saved]]) element(id).textContent = text;
}
persist();
// The right thumb is the button cluster (the v8 strike circle was retired 2026-09-20: one grammar, built and tested once).
const trial = loadTrial(storage);
// AFK is not an escape (owner 2026-09-20): a fight that never reached its end because the page was closed is a loss on the card.
// The marker is written on the first tick of a live fight and cleared when its result is recorded.
const AFK_KEY = 'frankendom.fight.v1';
const scorecard = loadScorecard(storage);
try {
  const left = JSON.parse(storage.getItem(AFK_KEY) || 'null');
  if (left && typeof left === 'object') {
    recordFight(trial, false, 0, 0, 0); saveTrial(storage, trial);
    if (isOpponentId(left.opponent)) { recordResult(scorecard, left.opponent, 'loss', true); saveScorecard(storage, scorecard); }
    storage.setItem(AFK_KEY, '');
  }
} catch { /* unreadable storage: nothing to score */ }
let recorded = false,
  activeMs = 0; // activeMs: real unpaused wall-clock of the current fight (hit-stop included), beside the simulation's tick count
// The first match is the fixed 731 warden (the browser gate times its opener); every rematch meets a differently seeded one.
// Who stands opposite: the rung this device has reached (profile.encounter), unless the URL names another (`?opponent=pitborn` — the harness and a dev look).
const opponent = opponentFor(
  profile.encounter,
  /[?&]opponent=(\w+)/.exec(window.location?.search ?? '')?.[1],
);
// Owner/test tool: pick any rung from the journal. Saving the rung and reloading is the same path the ladder's "Next" takes; the
// URL override is dropped so the pick wins. Picking the Veteran is a reset.
const opponentSelect = element<HTMLSelectElement>('opponent-select');
for (const rung of LADDER) {   // live rungs only: held recipes (Season 2 creatures) do not appear in the beta menu (owner 2026-09-20)
  const option = document.createElement('option') as HTMLOptionElement;
  option.value = rung.id;
  option.textContent = rung.name;
  opponentSelect.append(option);
}
opponentSelect.value = opponent.id;
opponentSelect.addEventListener('change', () => {
  const pick = LADDER.find((rung) => rung.id === opponentSelect.value);
  if (!pick) return;
  profile.encounter = pick.id;
  persist();
  const url = new URL(location.href);
  url.searchParams.delete('opponent');
  location.replace(url.href);
});
// Dev/test tool (owner 2026-09-19): force which finisher plays on the next ceremonial kill, to art-direct and learn each
// kill shot. 'Auto (spec)' is the spec's pick. The override only swaps WHICH finisher plays — draws, kicks and the
// player's own death still get no ceremony (v1 rules), and unshipped finishers fall back to the plain Death clip as always.
// Only the clips that exist today (owner 2026-09-19): Split Crown, Decapitation, Run Through, The Quiet One, Opened — plus Plain death as the
// no-finisher control. The rest of the spec table (hamstrung/execution) has no clip yet and would silently
// play the plain Death, which reads as a bug in a test menu. Add each back the day its clip ships.
const FINISHER_OPTIONS: [string, string][] = [
  ['splitCrown', 'Split Crown'],
  ['decapitation', 'Decapitation'],
  ['runThrough', 'Run Through'],
  ['quietOne', 'The Quiet One (test only)'],   // out of the beta rotation (owner 2026-09-20); still forceable here
  ['opened', 'Opened'],
  ['plainDeath', 'Plain death'],
];
const finisherSelect = element<HTMLSelectElement>('finisher-select');
{
  const auto = document.createElement('option') as HTMLOptionElement;
  auto.value = 'auto';
  auto.textContent = 'Auto (spec)';
  finisherSelect.append(auto);
}
for (const [id, label] of FINISHER_OPTIONS) {
  const option = document.createElement('option') as HTMLOptionElement;
  option.value = id;
  option.textContent = label;
  finisherSelect.append(option);
}
finisherSelect.addEventListener('change', () => {
  const value = finisherSelect.value;
  view.setFinisherOverride(value === 'auto' ? null : (value as FinisherId));
});
if (opponent.id !== 'veteran') {
  const label = element('opponent-name'),
    name = ROSTER[opponent.id].name.replace(/^the /, '');
  label.textContent = `THE ${name.toUpperCase()}`;
  label.dataset.mobile = name;
}
let playerWeapon: WeaponId = 'longsword';   // the player's weapon (moves.ts PLAYER_WEAPONS): the longsword until the loot slice wires the equipped set; a replay takes the record's
let matchSeed = 731,
  practice = initialPractice(matchSeed, opponent, playerWeapon),
  state = practice.fighter,
  previous = state,
  accumulator = 0,
  locked = true;
// Input layer: at most one edge-triggered action per tick plus the held guard level. The simulation owns legality and buffering.
let assetsReady = false,
  graphicsLost = false;
let difficulty: keyof typeof PROFILES = 'normal',
  debug = /[?&]debug\b/.test(window.location?.search ?? ''),
  frameEvents: CombatEvent[] = [],
  fightLog: CombatEvent[] = [];   // every event of the current fight, for the death-screen autopsy (src/autopsy.ts reads the whole fight)
// Every fight is recorded in memory (beta plan brief 3: kill links): the seed, the warden profile and every quantized intent the
// simulation stepped, so the fight can be replayed elsewhere. Nothing leaves the device here; a later slice adds Share. The
// build id is <html data-release>, 'dev' until the deploy stamps the revision there (a replay must run on the same rules; the
// harness has no document element). A difficulty change mid-fight drops the recorder: that fight is no longer replayable from one profile.
const BUILD = document.documentElement?.dataset?.release || 'dev';
const startRecorder = () => createRecorder({ build: BUILD, opponent: opponent.id, weapon: playerWeapon, profile: difficulty, seed: matchSeed });
let recorder: ReturnType<typeof createRecorder> | null = startRecorder(), lastRecord: FightRecord | null = null;
// Kill links (brief 3, second slice): `?replay=<record>` plays a shared fight back — the same seed, warden profile and intents, so
// the viewer watches exactly what happened — with the buttons asleep; afterwards "Avenge him" starts a live fight against the
// same warden and seed, practice only (practiceOnly: no ladder step, no mark, no scorecard or trial line). Share on the death
// screen encodes the last record, replays it headless first, and only then hands the link to the share sheet or clipboard.
let replay: { record: FightRecord; cursor: number } | null = null, practiceOnly = false;
let daily: DailyFight | null = null;   // the daily warden's fight when this page is today's attempt (src/daily.ts): practice rules, its result posted once
const replayBanner = element('replay-banner'), shareButton = element<HTMLButtonElement>('share-button'), shareStatus = element('share-status');
const banner = (text: string | null) => { replayBanner.textContent = text ?? ''; replayBanner.hidden = !text; };
const say = (text: string | null) => { shareStatus.textContent = text ?? ''; shareStatus.hidden = !text; };
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
// Hit-stop: a contact freezes the simulation for a few frames while the frame keeps rendering, so the pose at impact reads. Wall-clock
// pacing only — the simulation, its tick count and determinism are untouched. Heavier contacts stop longer; a kill stops longest.
// This is the one owner of the impact pause: the renderer is told the sim is frozen and holds its combat animation (effects run on),
// the contact tick's own bodies are what the frozen frames show, and the part of a frame that outlives the pause goes on to the next tick.
// A kick's lunge carries its short cone forward: it lands on a standing target from 1.58 m (tests/duel 'kick lands'); the HUD flags 1.5.
const HIT_STOP: Partial<Record<CombatEvent['type'], number>> = {
  Blocked: 30,
  Hit: 50,
  Parried: 70,
  GuardBroken: 90,
  PostureBroken: 120,
  Killed: 220,
};
const HEAVY_HIT = 90,
  HEAVY_BLOCK = 50; // a heavy-class contact stops longer whether it lands or is blocked
const HITSTOP_KEY = 'frankendom.hitstop.v1',
  TEMPO_KEY = 'frankendom.tempo.v1',
  DAMAGE_KEY = 'frankendom.damage-numbers.v1';
// Damage numbers: off by default (owner 2026-09-20), a journal setting for those who want them; the HUD floats them.
let damageNumbersOn = storage.getItem(DAMAGE_KEY) !== 'off';   // owner 2026-09-20: ON by default, greyed (style.css .dmg) — #219 read "greyed out" as "off"; the toggle stays for those who want them gone
// Tempo: the simulation is written in ticks; stepping it at 50 Hz instead of 60 plays the same fight a fifth slower in wall-clock (wind-ups,
// windows, reactions, movement alike — hit-stop is in ms and unchanged). A journal toggle so the owner can feel the slower tempo before any
// re-timing of the moves (which needs the blade paths re-baked).
let tempoHz: 60 | 50 = storage.getItem(TEMPO_KEY) === '50' ? 50 : 60;
const step = () => 1 / tempoHz;
let hitStop = 0,
  hitStopOn = storage.getItem(HITSTOP_KEY) !== 'off';
function stopFor(events: CombatEvent[]): number {
  if (!hitStopOn) return 0;
  let ms = 0;
  for (const e of events) {
    const base = HIT_STOP[e.type] ?? 0;
    if (!base) continue;
    const heavy = !!e.charged || HEAVY_MOVES.has(e.move ?? '');
    ms = Math.max(
      ms,
      e.type === 'Hit' && heavy ? HEAVY_HIT : e.type === 'Blocked' && heavy ? HEAVY_BLOCK : base,
    );
  }
  return ms;
}
function updateHud() {
  hud.update(practice, { controlsReady: assetsReady && !graphicsLost && !versusUp && !replay, debug, opponentId: opponent.id, replay: !!replay, practiceOnly });   // buttons wake when the card lifts (never during a replay), so a press is never swallowed
}
let orbitId: number | null = null;
let orbitX = 0,
  orbitY = 0;
function clearInput() {
  controls.clear();
  hitStop = 0;
  orbitId = null;
  accumulator = 0;
}
element('name-form').addEventListener('submit', (event) => {
  event.preventDefault();
  profile.name = cleanName(input.value);
  persist();
  welcome.hidden = true;
  clearInput();
  feedback.unlock();
  canvas.focus();
});
element('name-button').addEventListener('click', () => {
  clearInput();
  input.value = profile.name;
  welcome.hidden = false;
  input.focus();
});
// The beta scorecard: one row per offered opponent plus the total; the control trial tally stays for the debug view only.
function renderScorecard() {
  const cell = (tag: 'th' | 'td', text: string | number) => { const el = document.createElement(tag); el.textContent = String(text); return el; };
  const table = element('scorecard-table');
  table.replaceChildren();
  const head = document.createElement('tr'); for (const label of ['Opponent', 'Fights', 'Wins', 'Losses']) head.append(cell('th', label)); table.append(head);
  for (const row of scorecardRows(scorecard, LADDER)) {
    const tr = document.createElement('tr'); tr.append(cell('td', row.name), cell('td', row.fights), cell('td', row.wins), cell('td', row.losses)); table.append(tr);
    // The last fight's autopsy under the opponent's row (beta plan brief 2): one line, nothing after a win.
    if (row.last.length) { const note = document.createElement('tr'); note.className = 'autopsy-row'; const td = cell('td', row.last.join(' ')); td.setAttribute('colspan', '4'); note.append(td); table.append(note); }
  }
  element('scorecard').textContent = formatCard(trial);
  element('scorecard').hidden = !debug;
}
// The journal's test tools (finisher override, damage numbers, tempo, combat debug) are for admins: ?debug reveals them for the
// release checks, and account.ts reveals them for a signed-in account on the admins roster. Opponent choice stays for everyone.
const testTools = element('test-tools');
if (debug) testTools.dataset.debug = 'true';
testTools.hidden = !debug;
element('journal-button').addEventListener('click', () => {
  clearInput();
  renderScorecard();
  journal.showModal();
});
element('mobile-name').addEventListener('click', () => {
  journal.close();
  element('name-button').click();
});
element('close-journal').addEventListener('click', () => journal.close());
journal.addEventListener('close', clearInput);
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
let versusUp = false;   // the versus card is on screen: the fight waits behind it (declared here so paused() can read it before the card wires up)
const paused = () => graphicsLost || !welcome.hidden || journal.open || document.hidden || versusUp;
const controls = createInput({
  element, window, paused,
  now: () => performance.now(),
  matchMedia: (query) => matchMedia(query),
  innerWidth: () => innerWidth,
  ready: () => assetsReady,
  practice: () => practice,
  quiet: () => feedback.quiet(),
});
resetButton.addEventListener('click', () => {
  if (replay) {   // Avenge him: the same warden and seed, live, practice only
    practiceOnly = true; matchSeed = replay.record.seed; replay = null; banner(null);
    clearInput(); recorded = false; activeMs = 0;
    practice = initialPractice(matchSeed, opponent, playerWeapon); recorder = startRecorder(); frameEvents = []; fightLog = []; showAutopsy([]); showLootDrop(null); state = previous = practice.fighter;
    shareButton.hidden = true; say(null); view.recenter(); canvas.focus(); updateHud();
    return;
  }
  const next = !practiceOnly && won(practice.finish) ? nextAfter(opponent.id) : undefined;
  if (next) {
    profile.encounter = next.id;
    persist();
    location.reload();
    return;
  } // the next fighter is another rig: a fresh page loads it
  daily = null;   // the daily's one attempt is over: the rematch is practice and never posts
  clearInput();
  recordRematch(trial);
  saveTrial(storage, trial);
  recorded = false;
  activeMs = 0;
  matchSeed = (Math.imul(matchSeed, 1664525) + 1013904223) >>> 0;
  practice = initialPractice(matchSeed, opponent, playerWeapon);
  recorder = startRecorder();
  shareButton.hidden = true; say(null);
  frameEvents = []; fightLog = []; showAutopsy([]); showLootDrop(null);
  state = previous = practice.fighter;
  view.recenter();
  canvas.focus();
});
shareButton.addEventListener('click', async () => {
  if (!lastRecord || replay) return;
  shareButton.disabled = true; say('Checking the fight…');
  try {
    const check = verifyRecord(lastRecord);
    if (!check.ok) { say(`This fight cannot be shared: ${check.reason}.`); return; }
    // A signed-in fighter's link carries a short id (the record is stored); a guest's, or a store that refused, carries the record itself.
    let url: string | null = null;
    if (session?.db && session.userId) { try { url = shortLink(location.origin, lastRecord.opponent, await publishRecord(session.db, session.userId, lastRecord)); } catch { url = null; } }
    if (!url) {
      const link = await shareUrl(lastRecord, location.origin);
      if ('tooLong' in link) { say('This fight is too long to share as a link; sign in to share it by id.'); return; }
      url = link.url;
    }
    // A daily fight shares its Wordle-style text with the link; any other fight shares the link alone.
    const text = daily ? dailyShareText(daily, ROSTER[opponent.id].name, lastRecord.outcome, lastRecord.ticks, url) : url;
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav?.share) { try { await nav.share(daily ? { text, title: 'Frankendom: the daily warden' } : { url, title: 'Frankendom: watch this fight' }); say('Shared.'); return; } catch { /* the sheet was dismissed: fall through to the clipboard */ } }
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(text); say(daily ? 'Result copied.' : 'Link copied.'); return; }
    say(text);
  } catch (error) { say(`Could not share: ${error instanceof Error ? error.message : String(error)}`); }
  finally { shareButton.disabled = false; }
});
// A shared link: decode the record, put the fight on its seed and warden profile, hide the welcome (a viewer needs no name) and
// let the frame loop feed the recorded intents. A link for another opponent than the page booted is refused rather than mis-played.
// The link carries the record (`replay=`, a guest's share) or a short id (`r=`, a signed-in fighter's share, read from the fight store).
const replayText = replayParam(window.location?.search ?? ''), sharedId = shortParam(window.location?.search ?? '');
if (replayText || sharedId) {
  welcome.hidden = true; banner('Loading the fight…');
  const text = replayText ? Promise.resolve(replayText) : api ? fetchSharedRecord(api, sharedId!) : Promise.reject(Error('this build has no fight store'));
  void text.then(decodeRecord).then((record) => {
    if (record.opponent !== opponent.id) throw Error('the link names another opponent');
    matchSeed = record.seed; playerWeapon = record.weapon; difficulty = record.profile; element('difficulty').textContent = `Warden: ${difficulty}`;
    recorder = null; recorded = false; activeMs = 0; clearInput();
    practice = initialPractice(matchSeed, opponent, playerWeapon); frameEvents = []; fightLog = []; showAutopsy([]); showLootDrop(null); state = previous = practice.fighter;
    replay = { record, cursor: 0 }; shareButton.hidden = true; say(null);
    banner(record.build !== BUILD && record.build !== 'dev' && BUILD !== 'dev' ? `Replay · recorded on another build (${record.build.slice(0, 7)})` : 'Replay');
    updateHud();
  }).catch((error: unknown) => { banner(`This link cannot be played: ${error instanceof Error ? error.message : String(error)}`); });
}
// The daily warden (brief 4): `?daily=1` asks the server for today's fight, moves to the day's opponent when the page booted another,
// spends the day's one attempt the moment the fight starts (a reload mid-fight is the attempt) and posts the record when it ends.
// Practice rules: no marks, no scorecard; the daily has its own board. A build without a store, or a spent day, fights as usual.
if (dailyParam(window.location?.search ?? '') && !replayText && !sharedId) {
  welcome.hidden = true; banner('Asking for today\'s warden…');
  void (api ? fetchDaily(api) : Promise.reject(Error('this build has no daily warden'))).then((fight) => {
    const rung = dailyOpponent(fight, LADDER);
    if (rung.id !== opponent.id) { location.replace(`/?opponent=${rung.id}&daily=1`); return; }
    const spent = loadDaily(storage, fight.day);
    if (spent.started) { banner(spent.submitted ? `Daily #${fight.number} · posted today` : `Daily #${fight.number} · today's attempt is spent`); return; }
    daily = fight; practiceOnly = true; matchSeed = fight.seed; difficulty = 'normal'; element('difficulty').textContent = 'Warden: normal';
    saveDaily(storage, { day: fight.day, started: true, submitted: false });
    recorded = false; activeMs = 0; clearInput();
    practice = initialPractice(matchSeed, opponent, playerWeapon); recorder = startRecorder(); frameEvents = []; fightLog = []; showAutopsy([]); showLootDrop(null); state = previous = practice.fighter;
    banner(`Daily #${fight.number} · ${ROSTER[opponent.id].name}`); updateHud();
  }).catch((error: unknown) => { banner(`No daily warden: ${error instanceof Error ? error.message : String(error)}`); });
}
element('daily-button').addEventListener('click', () => { location.assign('/?daily=1'); });
// The journal's daily line and board, fetched when the journal opens (never at startup): today's number and opponent, this device's
// standing, and the five board lines with unverified rows greyed.
async function showDailyBoard() {
  const status = element('daily-status'), board = element<HTMLUListElement>('daily-board');
  if (!api) { status.textContent = 'The daily warden needs the account service.'; board.hidden = true; return; }
  try {
    const fight = await fetchDaily(api), rung = dailyOpponent(fight, LADDER), mine = loadDaily(storage, fight.day);
    status.textContent = `Daily #${fight.number} · ${rung.name} · ${mine.submitted ? 'posted' : mine.started ? 'attempt spent' : 'not fought yet'}`;
    const rows = await fetchDailyBoard(api, fight.day);
    board.replaceChildren(...dailyBoard(rows).map(({ title, row }) => {
      // Web design's two hooks (#331): the title in <b> so the columns split, and this device's own posted row marked (the public view carries no
      // user ids, so the match is the posted result itself: outcome, ticks and the fighter's display name).
      const li = document.createElement('li'), b = document.createElement('b'); b.textContent = title; li.dataset.verified = String(row ? row.verified : true);
      li.append(b, row ? ` ${row.display_name ?? 'a fighter'} · ${(row.ticks / 60).toFixed(1)} s${row.verified ? '' : ' (unverified)'}` : ' —');
      if (row && mine.submitted && row.outcome === mine.outcome && row.ticks === mine.ticks && row.display_name === profile.name) li.dataset.you = 'true';
      return li;
    }));
    board.hidden = false;
  } catch (error) { status.textContent = `No daily warden: ${error instanceof Error ? error.message : String(error)}`; }
}
element('journal-button').addEventListener('click', () => { void showDailyBoard(); });
element('difficulty').addEventListener('click', () => {
  const levels = Object.keys(PROFILES) as (keyof typeof PROFILES)[];
  difficulty = levels[(levels.indexOf(difficulty) + 1) % levels.length];
  element('difficulty').textContent = `Warden: ${difficulty}`;
  if (recorder && recorder.ticks > 0 && !practice.finish) recorder = null;   // a fight that changed warden mid-way is not replayable
});
element('debug-mode').addEventListener('click', () => {
  debug = !debug;
  element('debug-mode').textContent = `Combat debug: ${debug ? 'on' : 'off'}`;
  element('debug-mode').setAttribute('aria-pressed', String(debug));
  hud.invalidate();
});
if (typeof document !== 'undefined' && document.body)
  document.body.dataset.gfxTier = phoneTier() ? 'phone' : 'full'; // support surface: which graphics budget the session is on (the iPhone black-fighters defect)
// The versus card: a still of this fight from the real models (public/versus/<id>.webp) while the rigs download. No card for an
// opponent (a fresh rung without one yet) just means the arena shows through as before; a card that fails to fetch hides itself.
const versus = element('versus'), versusStill = element<HTMLImageElement>('versus-still');
// The fight waits behind the card (versusUp: buttons asleep, no ticks); the card lifts the moment the rigs are in. Owner 2026-09-21:
// a plain still — no drift, no opening camera move ("lets remove it and simplify things").
const hideVersus = () => { versusUp = false; updateHud(); if (versus.hidden || versus.dataset.out) return; versus.dataset.out = 'true'; versus.addEventListener('transitionend', () => { versus.hidden = true; }, { once: true }); };
versusStill.addEventListener('error', () => { versus.hidden = true; versusUp = false; });
versusStill.addEventListener('load', () => { if (!assetsReady) { versus.hidden = false; versusUp = true; updateHud(); } });
element('versus-foe').textContent = ROSTER[opponent.id].name.replace(/^the /, '');
versusStill.src = `versus/${opponent.id}.webp`;   // document-relative: the page is served at the site root (public/versus/)
let view: ReturnType<typeof createScene>, artFailed = false;
try {
  view = createScene(
    canvas,
    (status) => {
      element('art-status').textContent = status;
      assetsReady = status === '';
      artFailed = status !== '' && status !== 'Loading warriors…';   // the notice becomes a tap target; the next foreground return retries
      element('art-status').dataset.retry = String(artFailed);
      if (status !== 'Loading warriors…') hideVersus();   // the rigs are in (or failed: the banner must be readable)
    },
    opponent.id,
  );
} catch (error) {
  element('performance').textContent = '3D unavailable';
  message.hidden = false;
  message.textContent =
    'The arena needs WebGL 2. Try an up-to-date browser with hardware acceleration enabled.';
  cameraButton.disabled = runButton.disabled = true;
  attackButton.setAttribute('aria-disabled', 'true');
  throw error; // Preserve the GPU/renderer cause and stack for monitoring.
}
// Blood is red, always (owner 2026-09-20: the dark/off toggle leaves the journal; the renderer keeps the modes for a later setting).
const showTempo = () => {
  element('tempo-mode').textContent = `Tempo: ${tempoHz} Hz`;
  element('tempo-mode').setAttribute('aria-pressed', String(tempoHz === 50));
};
element('tempo-mode').addEventListener('click', () => {
  tempoHz = tempoHz === 60 ? 50 : 60;
  accumulator = 0;
  try {
    storage.setItem(TEMPO_KEY, String(tempoHz));
  } catch {
    /* a full store just loses the preference */
  }
  showTempo();
});
showTempo();
const showHitStop = () => {
  element('hitstop-mode').textContent = `Hit-stop: ${hitStopOn ? 'on' : 'off'}`;
  element('hitstop-mode').setAttribute('aria-pressed', String(hitStopOn));
};
element('hitstop-mode').addEventListener('click', () => {
  hitStopOn = !hitStopOn;
  hitStop = 0;
  try {
    storage.setItem(HITSTOP_KEY, hitStopOn ? 'on' : 'off');
  } catch {
    /* a full store just loses the preference */
  }
  showHitStop();
});
showHitStop();
const showDamageNumbers = () => {
  element('damage-mode').textContent = `Damage numbers: ${damageNumbersOn ? 'on' : 'off'}`;
  element('damage-mode').setAttribute('aria-pressed', String(damageNumbersOn));
};
element('damage-mode').addEventListener('click', () => {
  damageNumbersOn = !damageNumbersOn;
  if (!damageNumbersOn) hud.hideDamage();
  try {
    storage.setItem(DAMAGE_KEY, damageNumbersOn ? 'on' : 'off');
  } catch {
    /* a full store just loses the preference */
  }
  showDamageNumbers();
});
showDamageNumbers();
function graphicsFailure() {
  message.hidden = false;
  message.textContent = 'Graphics could not recover. Reload to return to the arena. ';
  const reload = document.createElement('button');
  reload.textContent = 'Reload game';
  reload.addEventListener('click', () => location.reload());
  message.append(reload);
}
function pauseGraphics() {
  if (graphicsLost) return;
  graphicsLost = true;
  clearInput();
  previous = state;
  cancelAnimationFrame(frameId);
  updateHud();
  message.hidden = false;
  message.textContent = 'Restoring graphics… Your fight is paused.';
  recoveryTimer = setTimeout(graphicsFailure, 10000);
}
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  pauseGraphics();
});
canvas.addEventListener('webglcontextrestored', () => {
  if (!graphicsLost) return;
  // Three.js restores its renderer first; generated environment pixels must be rebuilt too.
  try {
    view.restoreGraphics();
  } catch (error) {
    if (!view.renderer.getContext().isContextLost()) {
      captureException(error);
      graphicsFailure();
    }
    return;
  }
  if (view.renderer.getContext().isContextLost()) return;
  clearTimeout(recoveryTimer);
  clearInput();
  previous = state;
  last = reportAt = performance.now();
  frames = [];
  graphicsLost = false;
  message.hidden = true;
  updateHud();
  frameId = requestAnimationFrame(frame);
});
for (const id of ['camera-button', 'mobile-camera'])
  element(id).addEventListener('click', () => {
    locked = !locked;
    for (const target of ['camera-button', 'mobile-camera']) {
      element(target).setAttribute('aria-pressed', String(locked));
      element(target).textContent = locked ? 'Camera locked' : 'Lock camera';
    }
  });
element('recenter-button').addEventListener('click', () => view.recenter());
canvas.addEventListener('pointerdown', (event) => {
  if (paused() || orbitId !== null || event.button !== 0) return;
  canvas.focus();
  view.stopTour();   // after the kill the arena cam drifts on its own; a touch on the arena hands the camera back
  orbitId = event.pointerId;
  orbitX = event.clientX;
  orbitY = event.clientY;
  canvas.setPointerCapture(orbitId);
});
canvas.addEventListener('pointermove', (event) => {
  if (orbitId === event.pointerId && !locked && !paused()) {
    view.orbit(event.clientX - orbitX, event.clientY - orbitY);
    orbitX = event.clientX;
    orbitY = event.clientY;
  }
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
  canvas.addEventListener(name, (event) => {
    if ((event as PointerEvent).pointerId === orbitId) orbitId = null;
  });
let last = performance.now(),
  reportAt = last,
  frames: number[] = [],
  frameId = 0;
// Time away from a live fight is owed to it: the browser cannot run the fight while hidden, so the missed time is simulated on return with
// no input — the fight goes on as if the player stood still (owner 2026-09-20, "nothing more, nothing less"). Both clocks are read because a
// suspended phone browser may not advance performance.now(); the cap only bounds the work, an idle fighter is long dead before it.
const AFK_CAP = 300;
let hiddenPerf = 0, hiddenWall = 0, owed = 0, marked = false;
const fightLive = () => welcome.hidden && !journal.open && !practice.finish;
// A failed rig load retries on its own when the page comes back (a sleeping phone aborts the download) or the network returns, and on a tap.
const retryArt = () => { if (artFailed) void view.retryArt(); };
window.addEventListener('online', retryArt);
element('art-status').addEventListener('click', retryArt);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) retryArt();
  if (document.hidden) { hiddenPerf = performance.now(); hiddenWall = Date.now(); }
  else if (hiddenPerf && fightLive()) owed += Math.min(Math.max(performance.now() - hiddenPerf, Date.now() - hiddenWall) / 1000, AFK_CAP);
  if (!document.hidden) hiddenPerf = hiddenWall = 0;
  last = performance.now();
  frames = [];
  reportAt = last;
});
function frame(now: number) {
  if (view.renderer.getContext().isContextLost()) {
    pauseGraphics();
    return;
  }
  // A frame's elapsed time is bounded both ways. Forward: a tab thaw or a long stall injects at most 0.1 s of fight (the AFK path owes
  // real absence separately). Backward or absurd: a clock that jumped — a frozen timeline, a test harness installing a fake clock — is a
  // resync, not fight time. Unbounded, a backward jump drove the accumulator negative and froze the simulation for as long as the
  // jump (every release check under page.clock on the Linux runner: frames ran, page time advanced, the tick never moved).
  const raw = (now - last) / 1000, elapsed = raw >= 0 && raw < 60 ? raw : 0;
  last = now;
  const dt = Math.min(elapsed, 0.1);
  if (!paused()) {
    controls.promoteDodge(now);
    const afk = owed > 0;   // the fight the player missed runs before this frame draws: no hit-stop, no per-hit sound or number, one final picture
    if (afk) { hitStop = 0; accumulator += owed; activeMs += owed * 1000; owed = 0; }
    // The pause spends the frame's time first; whatever the frame has left after the pause ends goes on to the simulation (no discarded time).
    if (hitStop > 0) {
      const spent = Math.min(hitStop, elapsed * 1000);
      hitStop -= spent;
      if (!hitStop) accumulator += Math.max(0, dt - spent / 1000);
    } else accumulator += dt;
    activeMs += elapsed * 1000;
    while (accumulator >= step()) {
      previous = state;
      if (!marked && !practice.finish && !replay) { marked = true; try { storage.setItem(AFK_KEY, JSON.stringify({ opponent: opponent.id })); } catch { /* unsaved: a closed page then scores nothing */ } }
      if (replay && replay.cursor >= replay.record.ticks) {   // the record ran out without its finish: this build stepped it differently
        banner('This replay could not be played back on this build.'); replay = { record: replay.record, cursor: replay.cursor }; accumulator = 0; updateHud();
        break;
      }
      const stepped = replay ? replay.record.intents[replay.cursor++] : (() => {
        const intent = controls.intent();
        const duelIntent = {
          move: { x: intent.x, z: intent.z, yaw: view.yaw, run: intent.run },
          action: intent.action,
          guard: intent.guard,
          guardDirection: intent.guardDirection ?? undefined,
          held: intent.held,
          lock: locked,
          cancel: intent.cancel,
        };
        return recorder ? recorder.push(duelIntent) : quantizeIntent(duelIntent);   // the sim always steps the quantized intent: live and replay see the same bits
      })();
      practice = stepPractice(
        practice,
        stepped,
        opponent.profiles[difficulty],
      );
      if (debug && practice.events.length)
        window.dispatchEvent(
          new CustomEvent('frankendom:combat', {
            detail: { events: practice.events, health: practice.playerHealth, enemy: practice.health },
          }),
        );
      // Audio uses the same finish, weapon pair and visual override as the renderer; it never guesses a sever from a hit location.
      const deathAudio =
        practice.finish && practice.events.some((e) => e.type === 'Killed')
          ? {
              finish: practice.finish,
              weapons: [practice.duel.fighters[0].weapon, practice.duel.fighters[1].weapon] as const,
              override:
                resolveFinisher(
                  opponent.id,
                  practice.finish,
                  [practice.duel.fighters[0].weapon, practice.duel.fighters[1].weapon],
                  finisherSelect.value === 'auto' ? null : (finisherSelect.value as FinisherId),
                  view.previousFinisher(),
                ) ?? 'plainDeath',
              gore: true,
            }
          : undefined;
      const quiet = afk && !practice.finish;   // skipped time makes no sound and floats no numbers; the killing tick still does
      feedback.update(quiet ? [] : practice.events, deathAudio, {
        match: matchSeed,
        ended: !!practice.finish,
        tick: practice.duel.tick,
        drawing: practice.duel.fighters[0].phase === 'draw',
        opponent: opponent.id,
      });
      frameEvents.push(...practice.events); fightLog.push(...practice.events);
      if (!quiet && damageNumbersOn) hud.floatDamage(practice.events, practice.duel.fighters, view.project);
      controls.consumed(practice.events);
      state = practice.fighter;
      accumulator -= step();
      if (practice.finish && !recorded) {
        recorded = true;
        if (replay) { banner(`Replay over · ${practice.finish.victim === 1 ? 'the warden fell' : 'the fighter fell'}`); updateHud(); }
        else {
          if (recorder) {
            lastRecord = recorder.finish(practice.finish.draw ? 'draw' : practice.finish.victim === 1 ? 'killed' : 'died');
            element('debug').dataset.record = `${lastRecord.ticks}/${lastRecord.outcome}/${lastRecord.seed}`;
            shareButton.hidden = false; say(null);
            void encodeRecord(lastRecord).then((text) => { element('debug').dataset.share = text; }, () => {});   // the gates read the encoded record here
          }
          // The autopsy (brief 2): two plain lines on the death screen, and the same lines under the opponent's journal row for the last fight.
          const lines = autopsy(practice.ai.habits, readOpponent(practice.ai.habits), fightLog, practice.duel);
          showAutopsy(lines);
          // The daily warden's one post (brief 4): the record, where the killing blow landed and the blows taken; guests are told to sign in.
          if (daily && lastRecord) {
            const taken = fightLog.filter((e) => e.target === 0 && (e.type === 'Hit' || e.type === 'GuardBroken' || (e.type === 'Blocked' && (e.damage ?? 0) > 0))).length;
            const done = { day: daily.day, started: true, submitted: false, outcome: lastRecord.outcome, ticks: lastRecord.ticks };
            saveDaily(storage, done);
            if (session?.db && session.userId) void postDaily(session.db, session.userId, daily, lastRecord, practice.finish.location ?? null, taken).then(() => { saveDaily(storage, { ...done, submitted: true }); say('Posted to today\'s board.'); }, (error: unknown) => { say(`Not posted: ${error instanceof Error ? error.message : String(error)}`); });
            else say('Sign in to post to today\'s board.');
          }
          if (!practiceOnly) {   // an avenged fight is practice: it never touches the card, the scorecard or the marks
            recordPractice(trial, practice, Math.round(activeMs));
            saveTrial(storage, trial);
            recordResult(scorecard, opponent.id, won(practice.finish) ? 'win' : practice.finish.draw ? 'draw' : 'loss', afk, lines);   // a fight lost while away is a loss, flagged left
            saveScorecard(storage, scorecard);
            if (won(practice.finish)) {
              // The drop (brief 5): one fixed piece per opponent per the sub-rank the fight was fought at, never a duplicate; it goes straight to the
              // trophy rack (nothing is lost) and the journal wears it. Web design's Wear / Store / Leave selector replaces this line when it lands.
              const drop = dropFor(opponent.id, marksOf(profile), profile.loot?.owned ?? []);
              awardMark(profile);   // one career mark per won duel (owner beta policy 2026-09-20), saved on this device
              if (drop) { profile.loot = store(profile.loot, drop); showLootDrop(`Taken: ${lootName(drop, ROSTER[opponent.id].name)}. Wear it from the journal.`); }
              persist();
            }
          }
          marked = false; try { storage.setItem(AFK_KEY, ''); } catch { /* the result is already on the card */ }
          if (afk) accumulator = 0;   // the death is the picture the player comes back to; whatever time was left is not spent
        }
      }
      // Freeze on the contact tick: the frame ends here and the leftover time is dropped, so no catch-up jump follows. The frozen frames show the
      // contact tick's bodies (previous = state), not a blend back toward the tick before it.
      const stop = quiet ? 0 : stopFor(practice.events);
      if (stop) {
        hitStop = stop;
        accumulator = 0;
        previous = state;
      }
    }
  } else {
    accumulator = 0;
    previous = state;
  }
  const alpha = accumulator / step();
  try {
    view.render(
      {
        ...state,
        x: previous.x + (state.x - previous.x) * alpha,
        z: previous.z + (state.z - previous.z) * alpha,
        heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha,
      },
      locked,
      paused() ? 0 : dt,
      practice,
      frameEvents,
      hitStop > 0,
    );
    frameEvents = [];
  } catch (error) {
    // Loss can happen inside a draw, before the browser delivers its context-lost event.
    if (!view.renderer.getContext().isContextLost()) throw error;
    pauseGraphics();
    return;
  }
  updateHud();
  if (debug) {
    const d = element('debug');
    d.textContent = describe(practice, difficulty);
    d.dataset.frozen = String(hitStop > 0);
    d.dataset.tick = String(practice.duel.tick);
    d.dataset.clock = `${raw.toFixed(4)}/${accumulator.toFixed(4)}/${paused() ? 'paused' : 'live'}`;   // last frame's raw elapsed s, the sim accumulator, whether the sim steps
    d.dataset.tip = (view.bladeTip?.() ?? []).map((v) => v.toFixed(4)).join(',');
    d.dataset.clips = view.playing?.() ?? '';
    d.dataset.blood = JSON.stringify(view.bloodState());
  } // frame probe: frozen flag, tick, drawn blade tip, the clip each rig plays
  if (!document.hidden && elapsed > 0) frames.push(elapsed * 1000);
  if (now - reportAt >= 2000 && frames.length) {
    const sorted = frames.sort((a, b) => a - b),
      median = sorted[Math.floor(sorted.length / 2)],
      p95 = sorted[Math.floor(sorted.length * 0.95)];
    element('performance').textContent = `${Math.round(1000 / median)} fps · p95 ${Math.round(p95)} ms`;
    element('menu-performance').textContent = element('performance').textContent;
    if (median > 22) view.lowerResolution();
    frames = [];
    reportAt = now;
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
