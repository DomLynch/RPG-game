import { createInput } from './input.ts';
import { PLAYER_WEAPONS, RULES, weaponOf, type SkillId } from './moves.ts';
import type { Fighter } from './duel.ts';
import { formatCard, loadTrial, recordFight, saveTrial } from './trial.ts';
import { decodeRecord, encodeRecord, type FightRecord } from './record.ts';
import { peekRecordHeader } from './record-header.ts';
import { api } from './api.ts';
import { session } from './session.ts';
import { fetchSharedRecord, mintShare, sharedIdFrom, shortLink } from './share-store.ts';
import { replayParam, verifyRecord } from './replay.ts';
import './monitoring.ts';
import { captureException } from '@sentry/browser';
import './style.css';
import { STEP, wrapAngle } from './sim.ts';
import { cleanName, loadProfile, saveProfile, type StoragePort } from './profile.ts';
import { marksOf, rankFor, RANK_STEPS, type Rank } from './career.ts';
import { LOOT, PACK, PAPERDOLL, SKILLS, decline, emptyLoot, equippedSkill, fightWeapon, isLootId, isSkillId, lootName, paperdollOf, packFull, recordTaken, skillOf, slotOf, stow, store, takeWouldDrop, displacedBy, unwear, wear, wearFromPack, wearTaken, type Loot, type LootId, type Paperdoll } from './loot.ts';
import { createLootPanel } from './loot-panel.ts';
import { loadScorecard, recordResult, saveScorecard, scorecardRows } from './scorecard.ts';
import { dailyBoard, dailyOpponent, dailyParam, dailyShareText, fetchDaily, fetchDailySummary, loadDaily, postDaily, saveDaily } from './daily.ts';
import { describe, PROFILES, type CombatEvent } from './combat.ts';
import { Match } from './match.ts';
import { bareName, ROSTER, isOpponentId, resolveFinisher, type OpponentId } from './roster.ts';
import { createFeedback } from './feedback.ts';
import { CARRIED_WEAPONS, createScene } from './scene.ts';
import { phoneTier } from './quality.ts';
import { LADDER, opponentFor } from './ladder.ts';
import type { FinisherId } from './finishers.ts';

import { HEAVY_MOVES, createHud } from './hud.ts';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
// The opponent's swing is parked in its chamber: the hold her rising charge cue climbs through. Release, a feint or a stagger ends it.
const foeHolding = (f: Fighter) => f.phase === 'attack' && f.charge > 0 && f.move !== null && f.age <= (weaponOf(f.weapon).moves[f.move].chamber ?? -1);
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
// The rank row (Dom 2026-09-23: "a progress bar, with future visibility to what's next"): ONE component for the account panel, the
// journal's fighter card and the fight-end panel, so they never drift. Left the class + numeral, then one segment per numeral of the
// class (done numerals full, the current one filled by its pips), then the class it climbs toward. The bar is the information: no counts
// in prose; the full label (with the pips) stays as the row's accessible name. Origin has no bar.
function renderRank(host: HTMLElement, rank: Rank) {
  const make = (tag: string, className: string, text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
  host.setAttribute('aria-label', rank.label);
  if (!rank.next) { host.replaceChildren(make('span', 'rank-now', rank.title)); return; }
  const bar = make('span', 'rank-bar');
  bar.replaceChildren(...Array.from({ length: RANK_STEPS }, (_, i) => {
    const segment = make('i', 'rank-seg');
    segment.style.setProperty('--fill', `${i < rank.step ? 100 : i === rank.step ? Math.round(rank.fill * 100) : 0}%`);
    return segment;
  }));
  host.replaceChildren(make('span', 'rank-now', `${rank.title} ${rank.numeral}`), bar, make('span', 'rank-next', rank.next));
}
// The fight HUD's rank row (Dom 2026-09-24: permanent, with the health bars, the player's name small at its left): start, fight and end.
// Redrawn on every persist (a rename) and after match.end, so a win shows its gain.
const fightRank = element('fight-rank');
function renderFightRank() {
  renderRank(fightRank, rankFor(marksOf(profile)));
  const name = document.createElement('span'); name.className = 'rank-name'; name.textContent = profile.name;
  fightRank.append(name);   // last child, drawn first (CSS order): the rank component's own children keep their positions
}
// The kill screen's Take-one panel (src/loot-panel.ts, Strategy brief 2026-09-22; replaces the drop line + Wear/Store row, which the
// arena-cam tour faded out ~5 s after settle): offered = LOOT[opponent] minus owned, in slot order; one take per win; Take = store with
// provenance + wear (the journal's Wear path, view.wear included); Leave it = hide. Every reset path hides it.
// A piece's kill-screen thumbnail (scripts/loot-layers.mjs); a weapon has none until its equip file renders, so its tile is its name.
const lootThumb = (id: LootId) => `/game/img/loot/${id}.thumb.webp`;   // armour: scripts/loot-layers.mjs; weapons: scripts/weapon-thumbs.mjs
const skillThumb = (id: SkillId) => `/game/img/loot/${id}.thumb.svg`;   // a move has no mesh to render: its tile shows a drawn glyph, same 48 px slot (Strategy 09-25: text-only read as a placeholder)
const lootPanel = createLootPanel(element, document, () => performance.now());   // the clock is injected: the panel's tap guard must be steppable by the harness
let lootLineTimer: ReturnType<typeof setTimeout> | undefined;   // the Undo line's ~4 s on screen
const LOOT_LINE_MS = 4000;
const hideLoot = () => { clearTimeout(lootLineTimer); lootPanel.hide(); };   // every reset path drops the line's timer with the panel
function offerLoot(healthLeft: number) {
  const owned = profile.loot?.owned ?? [], attempt = scorecard.rows[opponent.id]?.fights ?? 1, name = ROSTER[opponent.id].name;
  const skill = skillOf(opponent.id);   // her move is offered beside her armour (SCOPE #729 item 8): the one take is one or the other
  // One skill slot (Dom 2026-09-25): the held move (the day-one move when none is stored) shows beside hers as what the take gives
  // up, read from SKILLS so any move works.
  const held = equippedSkill(profile.loot), gives = held !== skill ? { name: SKILLS[held].name, image: skillThumb(held) } : undefined;
  const pieces = [...(skill ? [{ id: skill, name: SKILLS[skill].name, owned: held === skill, image: skillThumb(skill), gives }] : []),
    ...(LOOT[opponent.id] ?? []).map((id) => ({ id, name: pieceName(id), owned: owned.includes(id), image: lootThumb(id) }))];
  if (!pieces.some((piece) => !piece.owned)) return;   // everything of his is already yours: nothing to take
  const take = (id: string, sure = false): void => {
    if (isSkillId(id)) { takeSkill(id); return; }
    if (!isLootId(id) || match.lastDrop || match.lastSkill) return;   // one take per win: a piece or the move, never both
    // The slot is taken and the pack is full: the piece there would leave the Profile tab, so ask before replacing it (Lead, #673).
    const held = profile.loot && displacedBy(profile.loot, id);
    if (!sure && held && takeWouldDrop(profile.loot!, id)) {
      lootPanel.ask(`Your pack is full: ${pieceName(held)} would be lost from your Profile.`, 'Replace', () => take(id, true));
      return;
    }
    // Undo restores the ledger this take found, not a computed inverse: `store` writes provenance into `taken` and `wear` moves
    // the paperdoll slot, so putting the object back is the only thing that leaves owned, taken and equipped exactly as they were
    // (the lead's caution, 2026-09-22). The decline list is untouched by a take, so an undone take leaves no trace at all.
    const before = profile.loot;
    profile.loot = store(profile.loot, id, { opponent: opponent.id, attempt, healthLeft, recordId: null, day: new Date().toISOString().slice(0, 10) });
    match.lastDrop = id; setLoot(wearTaken(profile.loot, id));   // the piece it replaces goes into the pack when there is room
    clearTimeout(lootLineTimer);
    lootPanel.confirm(`${pieceName(id)[0]!.toUpperCase()}${pieceName(id).slice(1)} is on you.`, () => {
      clearTimeout(lootLineTimer);
      match.lastDrop = null; profile.loot = before; persist(); view.wear(wornIds()); renderLoot();   // setLoot, but `before` may be undefined: a first take must not leave an empty loot object behind
      offerLoot(healthLeft);   // the panel comes back with nothing taken and nothing selected
    });
    lootLineTimer = setTimeout(() => lootPanel.hide(), LOOT_LINE_MS);
  };
  // The move is stored on the loot like a piece and equipped at once (one per duel): the next fight's fighter carries it. Undo puts the
  // ledger back as this take found it, exactly as a piece's Undo does.
  const takeSkill = (id: SkillId): void => {
    if (match.lastDrop || match.lastSkill) return;   // one take per win
    const before = profile.loot;
    setLoot({ ...(profile.loot ?? emptyLoot()), skill: id }); match.lastSkill = id; match.skill = id;
    clearTimeout(lootLineTimer);
    lootPanel.confirm(`${SKILLS[id].name} is yours.`, () => {
      clearTimeout(lootLineTimer);
      match.lastSkill = null; match.skill = equippedSkill(before); profile.loot = before; persist(); renderLoot();
      offerLoot(healthLeft);
    });
    lootLineTimer = setTimeout(() => lootPanel.hide(), LOOT_LINE_MS);
  };
  lootPanel.show(`Take one from ${name}`, pieces, {
    onTake: (id: string) => take(id),
    onDecline: () => { clearTimeout(lootLineTimer); profile.loot = decline(profile.loot, { opponent: opponent.id, attempt, healthLeft, recordId: null, day: new Date().toISOString().slice(0, 10) }); persist(); lootPanel.hide(); },
  });
}
// Loot on the rig and in the journal (brief 5): the equipped set is the profile's word (src/loot.ts); the scene wears it (view.wear), the
// journal's paperdoll and rack show it, and every change persists (the cloud follows on the profile beat). Rack rows are Web design's
// shape: name, the provenance caption (brief 9, with a Watch link once the fight is published), and the Wear / Worn button.
const pieceName = (id: LootId) => lootName(id, ROSTER[id.split('.')[0] as OpponentId].name);
const wornIds = (): LootId[] => Object.values(profile.loot?.equipped ?? {});
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
function setLoot(loot: Loot) { profile.loot = loot; persist(); view.wear(wornIds()); renderLoot(); }
function renderLoot() {
  const loot = profile.loot ?? emptyLoot(), worn = wornIds();
  for (const key of Object.keys(PAPERDOLL) as Paperdoll[]) {
    const id = loot.equipped[key];
    element(`slot-${key}-name`).textContent = id ? pieceName(id) : key === 'main' ? match.weapon[0]!.toUpperCase() + match.weapon.slice(1) : 'Empty';
    element(`slot-${key}`).classList.toggle('on', !!id || key === 'main');
    element(`slot-${key}`).setAttribute('data-loot', id ?? '');   // the worn id, for the paperdoll's image layers (style.css loot-layers block)
    const off = element<HTMLButtonElement>(`slot-${key}-off`);
    off.hidden = !id; off.disabled = packFull(loot);   // Store moves the piece into the pack; a full pack says why beneath it (#pack-full)
    off.setAttribute('aria-describedby', off.disabled ? 'pack-full' : '');
  }
  // The pack (loot.ts PACK): the open slots hold what Store put there, each with Wear; the rest are drawn locked, a placeholder only.
  const pack = Array.from({ length: PACK.total }, (_, i) => {
    const li = document.createElement('li'), id = loot.pack?.[i];
    if (i >= PACK.open) { li.className = 'pack-locked'; li.setAttribute('aria-label', 'Locked pack slot'); return li; }
    if (!id) { li.className = 'pack-empty'; li.setAttribute('aria-label', 'Empty pack slot'); return li; }
    const name = document.createElement('span'), button = document.createElement('button');
    li.setAttribute('data-loot', id); name.textContent = pieceName(id);
    button.type = 'button'; button.setAttribute('data-wear', id); button.textContent = 'Wear';
    button.addEventListener('click', () => setLoot(wearFromPack(profile.loot ?? emptyLoot(), id)));
    li.append(name, button);
    return li;
  });
  element('pack').replaceChildren(...pack);
  element('pack-full').hidden = !(packFull(loot) && Object.keys(loot.equipped).length);
  const rows = loot.owned.map((id) => {
    const li = document.createElement('li'), name = document.createElement('span'), button = document.createElement('button'), taken = loot.taken?.[id], isWorn = worn.includes(id);
    li.setAttribute('data-loot', id); li.setAttribute('data-worn', String(isWorn)); li.setAttribute('tabindex', '0');
    name.textContent = pieceName(id);
    button.setAttribute('data-wear', id); button.textContent = isWorn ? 'Worn' : 'Wear';
    button.addEventListener('click', () => setLoot(isWorn ? unwear(profile.loot ?? emptyLoot(), paperdollOf(slotOf(id))) : wear(profile.loot ?? emptyLoot(), id)));
    li.append(name);
    if (taken) {
      const small = document.createElement('small'), bold = document.createElement('b');
      small.setAttribute('data-taken', ''); bold.textContent = pieceName(id); bold.textContent = bold.textContent[0]!.toUpperCase() + bold.textContent.slice(1);
      small.append(bold, document.createTextNode(` · your ${ordinal(taken.attempt)} attempt, ${taken.healthLeft} health left`));
      // The Watch link names the fight's opponent (share-store shortLink): the loader refuses a record for another opponent than the page booted.
      if (taken.recordId) { const watch = document.createElement('a'); watch.setAttribute('data-watch', ''); watch.setAttribute('href', shortLink(location.origin, taken.recordId)); watch.textContent = 'Watch'; small.append(document.createTextNode(' '), watch); }
      li.append(small);
    }
    li.append(button);
    return li;
  });
  while (rows.length < 5) { const li = document.createElement('li'); li.className = 'rack-empty'; rows.push(li); }
  element('loot-rack').replaceChildren(...rows);
}
for (const key of Object.keys(PAPERDOLL) as Paperdoll[]) element(`slot-${key}-off`).addEventListener('click', () => setLoot(stow(profile.loot ?? emptyLoot(), key)));
lootPanel.wire();
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
  const saved = saveProfile(storage, profile) ? (session?.userId ? 'Signed in · saving…' : 'Guest · saved on this device') : 'Storage unavailable · name will not be saved';   // account.ts settles 'saving…' once the cloud answers
  window.dispatchEvent(new Event('frankendom:profile'));   // a signed-in account sends the change up (account.ts)
  // The HUD identity and the journal's fighter card show the same three facts.
  for (const [id, text] of [['name-button', profile.name], ['journal-name', profile.name], ['rank-sigil', rank.numeral || '✦'], ['journal-sigil', rank.numeral || '✦'],
    ['save-status', saved], ['journal-save', saved]]) element(id).textContent = text;
  for (const id of ['rank', 'journal-rank']) renderRank(element(id), rank);
  renderFightRank();
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
// The first match is the fixed 731 warden (the browser gate times its opener); every rematch meets a differently seeded one.
// Who stands opposite: the rung this device has reached (profile.encounter), unless the URL names another (`?opponent=pitborn` — the harness and a dev look).
// A kill link (`/s/<id>`, or the `?r=` / `?replay=` forms shared before 2026-09-22, kept until 2026-10-22) names its own opponent
// in the stored record, not the URL; when the record's warden is not the one this page booted, the page is re-opened once with
// `?opponent=` set from the record (the rig is chosen here, before any asset loads), so one short link works for every warden.
const replayText = replayParam(window.location?.search ?? ''), sharedId = sharedIdFrom(window.location?.pathname ?? '', window.location?.search ?? '');
const urlOpponent = /[?&]opponent=(\w+)/.exec(window.location?.search ?? '')?.[1];
const opponent = opponentFor(profile.encounter, urlOpponent);
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
// The arena test override (Options tab beside Opponent, gated with the admin test tools): which arena the NEXT fight builds in. The arena is built at load and
// Next reloads the page, so the pick is stored and read at load; `?arena=` in the URL still wins. Unset = the ladder band decides.
// Test tool only: no ladder or progress change, and nothing is read or built when it is unset.
const ARENA_PICK_KEY = 'frankendom.arena-override';
const storedArena = (() => { try { return sessionStorage.getItem(ARENA_PICK_KEY) ?? ''; } catch { return ''; } })();
const arenaSelect = element<HTMLSelectElement>('arena-select');
arenaSelect.value = storedArena; if (arenaSelect.selectedIndex < 0) arenaSelect.value = '';   // the options are index.html's (ArenaKey values); an unknown stored key reads as Ladder and arenaFor() ignores it
arenaSelect.addEventListener('change', () => {
  try { if (arenaSelect.value) sessionStorage.setItem(ARENA_PICK_KEY, arenaSelect.value); else sessionStorage.removeItem(ARENA_PICK_KEY); } catch { /* storage blocked: the pick lasts this page only */ }
  // The arena is built at load, so a pick only shows after one (Dom on his phone, 2026-09-24: an arena-only change did nothing until he also
  // changed Opponent). Reload the way the opponent pick does, dropping `?arena=`, which would otherwise win over the stored pick.
  const url = new URL(location.href);
  url.searchParams.delete('arena');
  location.replace(url.href);
});
// The signature-effect preview (docs/briefs/signature-effects.md): Shipped / Off / On / A–C for the opponent's signature, beside the Arena pick
// and gated with it. It applies live and is kept for the session; `?signature=` wins. It counts only while the test tools are open (admin or
// ?debug); otherwise it is Shipped (signature.ts SHIPPED), so players see only the variant Dom ruled.
const SIGNATURE_PICK_KEY = 'frankendom.signature-override';
const signatureSelect = element<HTMLSelectElement>('signature-select');
const applySignature = () => view?.setSignature?.(window.location?.search ?? '', signatureSelect.value, !element('test-tools').hidden);
signatureSelect.value = (() => { try { return sessionStorage.getItem(SIGNATURE_PICK_KEY) ?? 'ship'; } catch { return 'ship'; } })();
if (signatureSelect.selectedIndex < 0) signatureSelect.value = 'ship';
signatureSelect.addEventListener('change', () => {
  try { if (signatureSelect.value !== 'ship') sessionStorage.setItem(SIGNATURE_PICK_KEY, signatureSelect.value); else sessionStorage.removeItem(SIGNATURE_PICK_KEY); } catch { /* storage blocked: the pick lasts this page only */ }
  applySignature();
});
{
  // The bars name whoever is in the arena (Dom via Strategy, 2026-09-22): no rung is exempt any more — the first one used to keep
  // index.html's "ARENA WARDEN", which is now the no-opponent fallback "OPPONENT". The meters' labels follow for a screen reader.
  const label = element('opponent-name'),
    name = bareName(opponent.id);
  label.textContent = `THE ${name.toUpperCase()}`;
  label.dataset.mobile = name;
  element('target-health').setAttribute('aria-label', `${name} health`);
  element('target-posture').setAttribute('aria-label', `${name} posture`);
}
// The match (src/match.ts): the fight's state and every start / end / reset, in four explicit modes — career, practice, replay, daily.
// Every fight is recorded in memory (beta plan brief 3: kill links): the seed, the warden profile and every quantized intent the
// simulation stepped, so the fight can be replayed elsewhere. The build id is <html data-release>, 'dev' until the deploy stamps the
// revision there (a replay must run on the same rules; the harness has no document element).
const BUILD = document.documentElement?.dataset?.release || 'dev';
const match = new Match(opponent, BUILD, { storage, trial, scorecard, profile }, undefined, fightWeapon(profile.loot, CARRIED_WEAPONS), equippedSkill(profile.loot));
// A kill link or the daily decides the weapon after boot (the record's, the fixed kit's): the scene's rigs wait on this, then draw match.weapon.
let weaponSettled: Promise<unknown> = Promise.resolve();
// The render pair (state → previous, interpolated by the frame's leftover time) and the fixed-step accumulator.
let state = match.practice.fighter,
  previous = state,
  accumulator = 0,
  locked = true;
// Input layer: at most one edge-triggered action per tick plus the held guard level. The simulation owns legality and buffering.
let assetsReady = false,
  graphicsLost = false;
let debug = /[?&]debug\b/.test(window.location?.search ?? '');
// The loot offer waits for the kill to FINISH PLAYING (Lead brief 2026-09-22; Dom on the phone: "I have never seen the
// decapitation land" — the panel used to open on the Killed event, over the ceremony). This holds the win's health-left until
// view.finishPhase().complete latches in updateHud; null = nothing pending. Page timing, not match state: began() clears it with the panel.
let pendingLoot: number | null = null;
// ?perf=1 shows the .perf readout (style.css): the device measures its own frames. Also unhides the element once, here.
// Read without URLSearchParams and without assuming `location`: tests/graphics.test.ts boots this module in a node VM where
// neither exists, and 49 tests failed on it.
const perf = /[?&]perf=1(?:&|$)/.test(typeof location === 'undefined' ? '' : location.search);
if (perf) element('perf').hidden = false;
// The playtest lines (SCOPE #729 item 3, one mid-range Android run): frame times over the WHOLE current fight (reset at every start), the
// moment the first fight went live, what the page fetched, and what device says so. A tester sends one screenshot; nothing else to type.
let fightFrames: number[] = [], firstFightAt = 0;
const deviceLine = () => {
  const nav = typeof navigator === 'undefined' ? null : navigator, ua = nav?.userAgent ?? '';
  const platform = ua.match(/\(([^)]+)\)/)?.[1] ?? 'unknown device', browser = ua.match(/(?:CriOS|Chrome|Firefox|FxiOS|Version)\/[\d.]+/)?.[0] ?? '';
  const screenSize = typeof screen === 'undefined' ? '' : ` ${screen.width}×${screen.height}@${typeof devicePixelRatio === 'number' ? devicePixelRatio : 1}x`;
  const cores = nav?.hardwareConcurrency ? ` ${nav.hardwareConcurrency} cores` : '', memory = (nav as { deviceMemory?: number } | null)?.deviceMemory ? ` ${(nav as { deviceMemory?: number }).deviceMemory} GB` : '';
  return `${platform} ${browser}${screenSize}${cores}${memory}`.trim();
};
// Bytes over the wire for everything the page fetched so far (transferSize is 0 for a cache hit; the count says how many files that was).
const loadedLine = () => {
  const entries = (performance as { getEntriesByType?: (type: string) => { transferSize?: number }[] }).getEntriesByType?.('resource');
  if (!entries) return 'loaded: no resource timing';
  const bytes = entries.reduce((sum, e) => sum + (e.transferSize ?? 0), 0);
  return `loaded ${(bytes / 1048576).toFixed(1)} MB over the wire in ${entries.length} files`;
};
const replayBanner = element('replay-banner'), shareButton = element<HTMLButtonElement>('share-button'), shareStatus = element('share-status');
// `stale`: the link itself is the message (expired record, older build) rather than a status about a fight that is playing — that
// line leaves the header band for the slot right above PLAY NOW, in the house serif (style.css `.replay-banner[data-stale='1']`).
const replayStill = element<HTMLImageElement>('replay-still');   // a retired kill link's warden still; any start takes it down (began)
const banner = (text: string | null, stale = false) => { replayBanner.textContent = text ?? ''; replayBanner.hidden = !text; replayBanner.dataset.stale = text && stale ? '1' : '0'; };
// The status takes the share link's place (style.css .share-status): a confirmation clears after 2 s and the label returns;
// everything else — an error to act on, a raw link to copy, a sign-in prompt — stays until the next fight. Named, not measured:
// "Couldn't make a link, try again." is 32 characters and must persist (lead review).
const CONFIRMATIONS = new Set(['Shared.', 'Link copied.', 'Result copied.', 'Posted to today\'s board.']);
let sayTimer: ReturnType<typeof setTimeout> | undefined;
const say = (text: string | null) => { clearTimeout(sayTimer); shareStatus.textContent = text ?? ''; shareStatus.hidden = !text; if (text && CONFIRMATIONS.has(text)) sayTimer = setTimeout(() => say(null), 2000); };
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
  hud.update(match.practice, { controlsReady: assetsReady && !graphicsLost && !versusUp && !match.replay, debug, opponentId: opponent.id, replay: !!match.replay, practiceOnly: match.practiceOnly, stalled: match.stalled });   // buttons wake when the card lifts (never during a replay), so a press is never swallowed
  // End-of-fight text and buttons (owner 2026-09-22): nothing over the body until the finisher camera has settled, and it fades
  // again during the arena-cam tour — view.finishPhase() is the rig's own clock, no timer of ours to keep in step with it.
  const phase = match.practice.finish ? view.finishPhase() : null;
  // On a viewer page PLAY NOW stays up while the arena-cam tour rolls (owner 2026-09-22: "it should stay as the camera rolls");
  // the pre-settle hush still applies there — nothing over the body while the finisher plays.
  // While a loot offer is pending the hush holds to `complete` instead of `settled`. The faded row is inert (style.css sets
  // pointer-events:none), and between the camera settling and the ceremony ending a Rematch press would otherwise throw away
  // the win's one loot offer. Timing only — nothing moves, and the loot panel is outside the fade group as before.
  const hushed = pendingLoot !== null ? !phase?.complete : !phase?.settled;
  document.documentElement.classList.toggle('endgame-fade', !!phase && (hushed || (phase.touring && !watching)));
  // The rank row keeps only the hush, not the tour (Dom 2026-09-24, phone: the strip was "missing" at fight end — it showed for ~3 s
  // between settle and the tour, then faded until a touch). Text in the top band, no pointer: it stays up while the camera rolls.
  document.documentElement.classList.toggle('endgame-hush', !!phase && hushed);
  // The loot panel opens on the finisher-complete event, not a delay of ours: `complete` is the scene's own latch (the victim's
  // clip has run out, the camera has settled, a severed head has come to rest), so a long ceremony is never cut short and a
  // short one never leaves the player waiting. src/finishers.ts FINISHER_SECONDS holds the measured per-finisher figure Web
  // budgets its layout against; nothing here reads it. The panel's own geometry is untouched — this is timing only.
  if (pendingLoot !== null && phase?.complete) { const healthLeft = pendingLoot; pendingLoot = null; offerLoot(healthLeft); }
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
// The beta scorecard: one row per offered opponent, most-fought first, plus the total; the control trial tally stays for the debug view only.
function renderScorecard() {
  const cell = (tag: 'th' | 'td', text: string | number) => { const el = document.createElement(tag); el.textContent = String(text); return el; };
  const table = element('scorecard-table');
  table.replaceChildren();
  const head = document.createElement('tr'); for (const label of ['Opponent', 'Fights', 'Wins', 'Losses']) head.append(cell('th', label)); table.append(head);
  for (const row of scorecardRows(scorecard, LADDER)) {
    // Opponent | fights | wins | losses (N left). The last fight's autopsy line under each row is gone (Dom 2026-09-23); the scorecard keeps `last`.
    const tr = document.createElement('tr'); tr.append(cell('td', row.name), cell('td', row.fights), cell('td', row.wins), cell('td', row.losses)); table.append(tr);
  }
  element('scorecard').textContent = formatCard(trial);
  element('scorecard').hidden = !debug;
}
// The journal's test tools (finisher override, damage numbers, tempo, combat debug) are for admins: ?debug reveals them for the
// release checks, and account.ts reveals them for a signed-in account on the admins roster. Opponent choice stays for everyone.
const testTools = element('test-tools');
if (debug) testTools.dataset.debug = 'true';
testTools.hidden = !debug;
element('arena-row').hidden = !debug;   // the Arena pick (Options tab) is a test tool: shown with them, hidden from players
element('signature-row').hidden = !debug;   // so is the signature-effect preview beside it
element('journal-button').addEventListener('click', () => {
  clearInput();
  renderScorecard(); renderLoot();
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
  practice: () => match.practice,
  quiet: () => feedback.quiet(),
});
// After any start (src/match.ts): the render pair on the new fighter, the death screen's panels away, the share line cleared.
function began() {
  clearInput(); state = previous = match.practice.fighter;
  if (perf) fightFrames = [];   // the readout's fight-wide figures start over with the fight
  replayStill.hidden = true; hideLoot(); pendingLoot = null; match.frameEvents = []; shareButton.hidden = true; say(null); updateHud();
}
resetButton.addEventListener('click', () => {
  watching = false;   // the player chose to fight: from here the AFK rule applies as in any live fight
  if (match.replay || match.stalled) {   // PLAY NOW: the same warden (and the record's seed when there is one), live, practice only
    match.playNow(); banner(null); began(); view.recenter(); canvas.focus();
    return;
  }
  const next = match.nextRung();
  if (next) {
    profile.encounter = next.id;
    persist();
    location.reload();
    return;
  } // the next fighter is another rig: a fresh page loads it
  match.rematch();   // a daily's rematch is practice and never posts; a career fight stays career
  began();
  view.recenter();
  canvas.focus();
});
shareButton.addEventListener('click', async () => {
  // Read the fight at the press, once: a Rematch or a kill link that lands during the awaits below runs `begin()`, which nulls
  // match.lastRecord and match.lastDrop and drops match.daily, so the share is of the fight that was pressed and its record id
  // goes onto the piece THAT fight dropped, never onto a later fight's take (GPT audit 2026-09-24, finding B).
  const record = match.lastRecord, drop = match.lastDrop, daily = match.daily, userId = session?.userId ?? null;
  if (!record || match.replay) return;
  shareButton.disabled = true; say('Checking the fight…');
  try {
    const check = verifyRecord(record);
    if (!check.ok) { say(`This fight cannot be shared: ${check.reason}.`); return; }
    // Everyone's link carries a short id (owner 2026-09-22): the store mints one for guests too. No record-in-the-link fallback —
    // a store that refuses means no link, said plainly, never a URL that runs to several screens.
    if (!api) { say('Sharing needs the fight store; try again later.'); return; }
    let url: string;
    try {
      const token = session?.db ? (await session.db.auth.getSession()).data.session?.access_token ?? null : null;
      const id = await mintShare(api, record, token);
      url = shortLink(location.origin, id);
      if (userId && session?.userId === userId && drop && profile.loot) { profile.loot = recordTaken(profile.loot, drop, id); persist(); }   // the same account still signed in: the take keeps its link
    } catch { say("Couldn't make a link, try again."); return; }
    // A daily fight shares its Wordle-style text with the link; any other fight shares the link alone.
    const text = daily ? dailyShareText(daily, ROSTER[opponent.id].name, record.outcome, record.ticks, url) : url;
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav?.share) { try { await nav.share(daily ? { text, title: 'Frankendom: the daily duel' } : { url, title: 'Frankendom: watch this fight' }); say('Shared.'); return; } catch { /* the sheet was dismissed: fall through to the clipboard */ } }
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(text); say(daily ? 'Result copied.' : 'Link copied.'); return; }
    say(text);
  } catch (error) { say(`Could not share: ${error instanceof Error ? error.message : String(error)}`); }
  finally { shareButton.disabled = false; }
});
// A shared link: decode the record, put the fight on its seed and warden profile, hide the welcome (a viewer needs no name) and
// let the frame loop feed the recorded intents. A link for another opponent than the page booted is refused rather than mis-played.
// The link carries a short id (`/s/<id>`; `?r=` until 2026-10-22) read from the fight store, or the record itself (`?replay=`, until 2026-10-22).
// A kill link makes this page a viewer: set before the welcome screen drops so the frame loop never marks an AFK fight (fight.v1)
// for a fight nobody is fighting. A refused link keeps the page a viewer; the reset button (PLAY NOW / Rematch) is the player
// choosing to fight, and clears it.
let watching = Boolean(replayText || sharedId);
// A replay opens on its ending (owner 2026-09-22: "the playback is the full match? way too long and boring, last 7 seconds only"):
// the deterministic sim is stepped silently to REPLAY_TAIL seconds before the record's end, then rendered from there. Blows before
// the window leave no wound marks (they were never drawn). "Watch the whole fight" is gone (owner 2026-09-22: "boring, huge memory
// and bandwidth") — the ending is the whole viewer page, and PLAY NOW under it is the only thing to press.
const REPLAY_TAIL = 7;
// A response that arrives after a later start (the player pressed Rematch while the link loaded) is refused by the match and the
// fight in play stays; only its loading line goes.
function startReplay(record: FightRecord, fromTick: number, epoch: number) {
  if (!match.startReplay(record, fromTick, epoch)) { banner(null); return; }
  element('difficulty').textContent = `Difficulty: ${match.difficulty}`;
  banner(record.build !== BUILD && record.build !== 'dev' && BUILD !== 'dev' ? `Replay · recorded on another build (${record.build.slice(0, 7)})` : 'Replay');
  began();
}
if (replayText || sharedId) {
  welcome.hidden = true; banner('Loading the fight…');
  const epoch = match.epoch;
  const text = replayText ? Promise.resolve(replayText) : api ? fetchSharedRecord(api, sharedId!) : Promise.reject(Error('this build has no fight store'));
  weaponSettled = text.then(decodeRecord).then((record) => {
    if (epoch !== match.epoch) { banner(null); return; }   // a fight started while the link loaded: neither re-open the page on the record's rig nor replace the fight (audit 2026-09-23)
    if (record.opponent !== opponent.id) {
      if (urlOpponent) throw Error('the link names another opponent');
      const target = new URL(location.href); target.searchParams.set('opponent', record.opponent); location.replace(target.href); return;   // once: the re-opened page boots that rig
    }
    startReplay(record, Math.max(0, record.ticks - Math.round(REPLAY_TAIL / STEP)), epoch);
  }).catch((error: unknown) => {
    if (epoch !== match.epoch) { banner(null); return; }   // a fight started while the link loaded: the failure is not its
    const message = typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : String(error);
    if (message === 'no such fight') {   // unknown or expired id (guest links live 90 days, Strategy 2026-09-22): a plain page, the fight button under it, no jargon
      banner(null); watching = false; welcome.hidden = false;
      element('welcome-eyebrow').textContent = 'THIS FIGHT HAS FADED'; element('welcome-title').textContent = 'Sign in and your kills are kept forever.'; element('welcome-lead').hidden = true;
      return;
    }
    if (message.startsWith('Fight record: version')) {   // a retired version (the rules changed): the link converts into a fight against the same warden, never a dead page
      void text.then(peekRecordHeader).then((header) => {
        const foe = header && isOpponentId(header.opponent) && (PLAYER_WEAPONS as readonly string[]).includes(header.weapon) ? header.opponent : null;   // a link is public input: name only an opponent and weapon this game knows
        if (!header || !foe) { match.stalled = true; banner('Recorded on an older build', true); updateHud(); return; }
        if (epoch !== match.epoch) { banner(null); return; }
        if (foe !== opponent.id && !urlOpponent) {   // once, as a readable link does: the re-opened page boots that warden's rig, so PLAY NOW fights them
          const target = new URL(location.href); target.searchParams.set('opponent', foe); location.replace(target.href); return;
        }
        // Dom 2026-09-24 ("dead links must convert"): the warden's still, who fell to what, and PLAY NOW under it — the same stalled
        // viewer page as any unreadable link (practice rules, no AFK mark), with the fight it names one tap away. No per-fight still
        // exists anywhere, so the still is the warden's roster portrait (public/game/img, scripts/opponent-portraits.mjs).
        const name = ROSTER[foe].name, title = `${name[0].toUpperCase()}${name.slice(1)}`, weapon = `a ${header.weapon}`;
        replayStill.src = `/game/img/${foe}.webp`; replayStill.alt = title; replayStill.hidden = false;
        match.stalled = true; updateHud();
        banner(header.outcome === 'killed' ? `${title} fell to ${weapon}. Your turn.` : header.outcome === 'died' ? `${title} won, against ${weapon}. Your turn.` : `${title} against ${weapon}. Nobody fell. Your turn.`, true);
      });
      return;
    }
    match.stalled = true; banner('This fight cannot be played here', true); updateHud();   // one small line, PLAY NOW under it
  });
}
// The daily warden (brief 4): `?daily=1` asks the server for today's fight, moves to the day's opponent when the page booted another,
// spends the day's one attempt the moment the fight starts (a reload mid-fight is the attempt) and posts the record when it ends.
// Practice rules: no marks, no scorecard; the daily has its own board. A build without a store, or a spent day, fights as usual.
if (dailyParam(window.location?.search ?? '') && !replayText && !sharedId) {
  welcome.hidden = true; banner('Asking for today\'s duel…');
  const epoch = match.epoch;
  weaponSettled = (api ? fetchDaily(api) : Promise.reject(Error('this build has no daily duel'))).then((fight) => {
    if (epoch !== match.epoch) { banner(null); return; }   // a fight started while the server answered: it stays, on its own rung
    const rung = dailyOpponent(fight, LADDER);
    if (rung.id !== opponent.id) { location.replace(`/?opponent=${rung.id}&daily=1`); return; }
    const spent = loadDaily(storage, fight.day);
    if (spent.started) { banner(spent.submitted ? `Daily #${fight.number} · posted today` : `Daily #${fight.number} · today's attempt is spent`); return; }
    if (!match.startDaily(fight, epoch)) { banner(null); return; }
    element('difficulty').textContent = 'Difficulty: normal';
    banner(`Daily #${fight.number} · ${ROSTER[opponent.id].name}`); began();
  }).catch((error: unknown) => { banner(`No daily duel: ${error instanceof Error ? error.message : String(error)}`); });
}
element('daily-button').addEventListener('click', () => { location.assign('/?daily=1'); });
// The journal's daily line and board, fetched when the journal opens (never at startup): today's number and opponent, this device's
// standing, and the five board lines with unverified rows greyed.
async function showDailyBoard() {
  const status = element('daily-status'), board = element<HTMLUListElement>('daily-board');
  if (!api) { status.textContent = 'The daily duel needs the account service.'; board.hidden = true; return; }
  try {
    const fight = await fetchDaily(api), rung = dailyOpponent(fight, LADDER), mine = loadDaily(storage, fight.day);
    status.textContent = `Daily #${fight.number} · ${rung.name} · ${mine.submitted ? 'posted' : mine.started ? 'attempt spent' : 'not fought yet'}`;
    const summary = await fetchDailySummary(api, fight.day);
    board.replaceChildren(...dailyBoard(summary).map(({ title, row }) => {
      // Web design's two hooks (#331): the title in <b> so the columns split, and this device's own posted row marked (the public view carries no
      // user ids, so the match is the posted result itself: outcome, ticks and the fighter's display name).
      const li = document.createElement('li'), b = document.createElement('b'); b.textContent = title; li.dataset.verified = String(row ? row.verified : true);
      li.append(b, row ? ` ${row.display_name ?? 'a fighter'} · ${(row.ticks / 60).toFixed(1)} s${row.verified ? '' : ' (unverified)'}` : ' —');
      if (row && mine.submitted && row.outcome === mine.outcome && row.ticks === mine.ticks && row.display_name === profile.name) li.dataset.you = 'true';
      return li;
    }));
    board.hidden = false;
  } catch (error) { status.textContent = `No daily duel: ${error instanceof Error ? error.message : String(error)}`; }
}
element('journal-button').addEventListener('click', () => { void showDailyBoard(); });
element('difficulty').addEventListener('click', () => {
  const levels = Object.keys(PROFILES) as (keyof typeof PROFILES)[];
  match.setDifficulty(levels[(levels.indexOf(match.difficulty) + 1) % levels.length]!);   // a fight that changed warden mid-way is not replayable: the recorder drops
  element('difficulty').textContent = `Difficulty: ${match.difficulty}`;
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
element('versus-foe').textContent = bareName(opponent.id);
versusStill.src = `versus/${opponent.id}.webp`;   // document-relative: the page is served at the site root (public/versus/)
let view: ReturnType<typeof createScene>, artFailed = false;
try {
  view = createScene(
    canvas,
    (status, kind) => {
      element('art-status').textContent = status;
      assetsReady = kind === 'ready';
      artFailed = kind === 'failed';   // the notice becomes a tap target; the next foreground return retries
      element('art-status').dataset.retry = String(artFailed);
      // Keyed on the machine-readable kind, never on the display string: a future in-progress status line (a download-stage
      // line, a retry notice) must not lift the card early and reveal the capsule stand-ins (audit 2026-09-22).
      if (kind !== 'loading') hideVersus();
    },
    opponent.id,
    /[?&]arena=(\w+)/.exec(window.location?.search ?? '')?.[1] ?? (storedArena || undefined),   // dev look / stills: ?arena=d, else the test tools' Arena pick (arena-themes.ts)
    weaponSettled.then(() => match.weapon, () => match.weapon),
    (drawn) => { const replay = !!match.replay; if (match.rearm(drawn)) { began(); if (replay) banner('This fight cannot be played here', true); } },   // an equip file that failed: fight on the longsword the rig carries
  );
  view.wear(wornIds());   // the worn loot goes on the rig when the pieces land; the fight never waits for them
  applySignature();   // the signature preview's pick (off unless the test tools are open)
  // The admins roster opens the tools after load (account.ts): apply the pick again whenever they open or close.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(applySignature).observe(element('test-tools'), { attributes: true, attributeFilter: ['hidden'] });
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
// After the kill, ANY touch hands the camera back, not only one on the canvas (lead review 2026-09-22): while the arena-cam
// tour has the HUD faded, Rematch/Share/Wear-Store are inert (pointer-events: none), so a thumb landing where Rematch was hits
// the #actions cluster box — which is not the canvas — and without this the tour would never stop and the HUD never return.
// Listening on the document catches that tap (and one on the joystick, the header, anywhere); the HUD is back at 250 ms.
// Gated on the tour actually running: stopTour() only sets a flag, so a tap in the death animation or the settle window (mashing
// after the kill, tapping Share) must not cancel a tour that has not started yet. A canvas drag below stays an explicit takeover.
document.addEventListener('pointerdown', () => { if (match.practice.finish && view.finishPhase().touring) view.stopTour(); });
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
  // ?perf=1: a phone-readable readout of the last 5 s (.perf in style.css). The buffer only fills when the flag is on, so a
  // normal session pays nothing. Owner 2026-09-22: every frame-time figure we had was measured on an unthrottled Mac, which
  // cannot see his iPhone's GPU - this lets the device measure itself.
  // eslint-disable-next-line prefer-const -- grouped in this let-list with the counters beside it
  perfFrames: [number, number][] = [],
  perfWorst = 0,   // the worst frame SINCE LOAD: one big hitch and steady stutter look the same in a rolling window, and a first-pose/shader-compile spike (Multi Chars measured 1,037 ms at six guards against 187 ms at one) only shows in this number
  frameId = 0;
// Time away from a live fight is owed to it: the browser cannot run the fight while hidden, so the missed time is simulated on return with
// no input — the fight goes on as if the player stood still (owner 2026-09-20, "nothing more, nothing less"). Both clocks are read because a
// suspended phone browser may not advance performance.now(); the cap only bounds the work, an idle fighter is long dead before it.
const AFK_CAP = 300;
let hiddenPerf = 0, hiddenWall = 0, owed = 0, marked = false;
const fightLive = () => welcome.hidden && !journal.open && !match.practice.finish;
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
    if (afk) { hitStop = 0; accumulator += owed; match.activeMs += owed * 1000; owed = 0; }
    // The pause spends the frame's time first; whatever the frame has left after the pause ends goes on to the simulation (no discarded time).
    if (hitStop > 0) {
      const spent = Math.min(hitStop, elapsed * 1000);
      hitStop -= spent;
      if (!hitStop) accumulator += Math.max(0, dt - spent / 1000);
    } else accumulator += dt;
    match.activeMs += elapsed * 1000;
    while (accumulator >= step()) {
      previous = state;
      if (!marked && !match.practice.finish && !match.replay && !watching) { marked = true; try { storage.setItem(AFK_KEY, JSON.stringify({ opponent: opponent.id })); } catch { /* unsaved: a closed page then scores nothing */ } }
      const result = match.step(() => {
        const intent = controls.intent();
        return {
          move: { x: intent.x, z: intent.z, yaw: view.yaw, run: intent.run },
          action: intent.action,
          guard: intent.guard,
          guardDirection: intent.guardDirection ?? undefined,
          held: intent.held,
          lock: locked,
          cancel: intent.cancel,
        };
      });
      if (result === 'stalled') {   // the record ran out without its finish: this build stepped it differently
        banner('Recorded on an older build', true); accumulator = 0; updateHud();
        break;
      }
      const practice = match.practice;
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
        match: match.seed,
        ended: !!practice.finish,
        tick: practice.duel.tick,
        drawing: practice.duel.fighters[0].phase === 'draw',
        holding: foeHolding(practice.duel.fighters[1]),
        opponent: opponent.id,
        loiter: Math.max(practice.duel.fighters[0].loiter, practice.duel.fighters[1].loiter) / RULES.wall.loiter.ticks,   // Brief 13: the crowd turns on a wall-hugger (audio lane; one line, lead to review)
      });
      if (!quiet && damageNumbersOn) hud.floatDamage(practice.events, practice.duel.fighters, view.project);
      controls.consumed(practice.events);
      state = practice.fighter;
      accumulator -= step();
      if (result === 'ended') {
        const ended = match.end(afk);   // the reward rule lives there: only a career fight touches the card, the scorecard or the marks
        if (match.replay) { banner(`Replay over · ${practice.finish?.victim === 1 ? `${ROSTER[opponent.id].name} fell` : 'the fighter fell'}`); updateHud(); }   // a watched fight is never a walk-away
        else {
          if (ended.record) {
            element('debug').dataset.record = `${ended.record.ticks}/${ended.record.outcome}/${ended.record.seed}`;
            shareButton.hidden = false; say(null);
            void encodeRecord(ended.record).then((text) => { element('debug').dataset.share = text; }, () => {});   // the gates read the encoded record here
          }
          // Redraw the rank row with the marks this fight earned. The autopsy lines are shown nowhere now (Dom 2026-09-23); match.end still
          // writes them to the scorecard's `last`, kept so the Combat lane can fix the parker count and bring them back without a data gap.
          renderFightRank();
          // The daily warden's one post (brief 4): the record, where the killing blow landed and the blows taken; guests are told to sign in.
          if (ended.post) {
            const { daily, record, taken, done } = ended.post;
            if (session?.db && session.userId) void postDaily(session.db, session.userId, daily, record, practice.finish?.location ?? null, taken).then(() => { saveDaily(storage, { ...done, submitted: true }); say('Posted to today\'s board.'); }, (error: unknown) => { say(`Not posted: ${error instanceof Error ? error.message : String(error)}`); });
            else say('Sign in to post to today\'s board.');
          }
          // Loot (Strategy brief 2026-09-22): the kill screen offers the fallen warden's pieces (offerLoot above); nothing is stored
          // until the player takes one. match.lastDrop holds the take, so a Share can fill its record id once (src/loot.ts Provenance).
          if (ended.rewarded && ended.won) { pendingLoot = Math.max(0, Math.round(practice.playerHealth)); persist(); }   // offered once the finisher has finished playing (updateHud)
          if (afk) accumulator = 0;   // the death is the picture the player comes back to; whatever time was left is not spent
        }
        marked = false; try { storage.setItem(AFK_KEY, ''); } catch { /* the result is already on the card */ }
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
      match.practice,
      match.frameEvents,
      hitStop > 0,
    );
    match.frameEvents = [];
  } catch (error) {
    // Loss can happen inside a draw, before the browser delivers its context-lost event.
    if (!view.renderer.getContext().isContextLost()) throw error;
    pauseGraphics();
    return;
  }
  updateHud();
  if (debug) {
    const d = element('debug');
    d.textContent = describe(match.practice, match.difficulty);
    d.dataset.frozen = String(hitStop > 0);
    d.dataset.tick = String(match.practice.duel.tick);
    d.dataset.clock = `${raw.toFixed(4)}/${accumulator.toFixed(4)}/${paused() ? 'paused' : 'live'}`;   // last frame's raw elapsed s, the sim accumulator, whether the sim steps
    d.dataset.tip = (view.bladeTip?.() ?? []).map((v) => v.toFixed(4)).join(',');
    d.dataset.clips = view.playing?.() ?? '';
    d.dataset.blood = JSON.stringify(view.bloodState());
    d.dataset.finishPhase = match.practice.finish ? JSON.stringify(view.finishPhase()) : '';
    d.dataset.fallenRect = JSON.stringify(view.fallenRect());   // the release check's gate (brief 5): no HUD element may intersect this at settle time
    d.dataset.worn = JSON.stringify(view.wornDraws?.() ?? { worn: [], covered: [] });   // the loot meshes on the player's rig (scripts/worn-loot-check.mjs)
  } // frame probe: frozen flag, tick, drawn blade tip, the clip each rig plays, the finish clock, the fallen body's screen rect
  if (!document.hidden && elapsed > 0) frames.push(elapsed * 1000);
  if (perf && elapsed > 0) {
    const ms = elapsed * 1000; perfFrames.push([now, ms]); if (ms > perfWorst) perfWorst = ms; while (perfFrames.length && now - perfFrames[0][0] > 5000) perfFrames.shift();
    if (fightLive()) { if (!firstFightAt) firstFightAt = now; fightFrames.push(ms); }   // performance.now() counts from navigation start: the first live frame IS the time to first fight
  }
  if (now - reportAt >= 2000 && frames.length) {
    const sorted = frames.sort((a, b) => a - b),
      median = sorted[Math.floor(sorted.length / 2)],
      p95 = sorted[Math.floor(sorted.length * 0.95)];
    element('performance').textContent = `${Math.round(1000 / median)} fps · p95 ${Math.round(p95)} ms`;
    element('menu-performance').textContent = element('performance').textContent;
    if (median > 22) view.lowerResolution();
    frames = [];
    reportAt = now;
    // A dropped frame is one longer than 16.7 ms - the 60 fps budget - COUNTED, not averaged, because an average hides them.
    if (perf) {
      const ms = perfFrames.map(([, v]) => v).sort((a, b) => a - b), at = (f: number) => ms[Math.min(ms.length - 1, Math.floor(ms.length * f))] ?? 0;
      const dropped = ms.filter((v) => v > 16.7).length, info = view.renderer.info.render, guards = view.arena.guards;
      // fps p50 / p5 over the fight: the frame-time p50 and p95 turned into frame rates (p5 fps = the rate the slowest 5 % of frames ran at).
      const fight = [...fightFrames].sort((a, b) => a - b), fightAt = (f: number) => fight[Math.min(fight.length - 1, Math.floor(fight.length * f))] ?? 0;
      const fps = (frameMs: number) => (frameMs > 0 ? Math.round(1000 / frameMs) : 0), fightSeconds = fightFrames.reduce((sum, v) => sum + v, 0) / 1000;
      element('perf').textContent = [
        `p50 ${at(0.5).toFixed(1)}  p95 ${at(0.95).toFixed(1)}  max ${(ms.at(-1) ?? 0).toFixed(1)} ms`,
        `dropped ${dropped}/${ms.length} over 16.7 ms`,
        `worst since load ${perfWorst.toFixed(0)} ms`,
        `guards ${guards.built}/${guards.of}  draws ${info.calls}  tris ${info.triangles.toLocaleString()}`,
        `fight: ${fps(fightAt(0.5))} fps p50 · ${fps(fightAt(0.95))} fps p5 · ${fight.length} frames / ${fightSeconds.toFixed(0)} s`,
        `first fight at ${(firstFightAt / 1000).toFixed(1)} s`,
        loadedLine(),
        deviceLine(),
      ].join('\n');
    }
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
