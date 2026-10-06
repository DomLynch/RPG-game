import { createInput } from './input.ts';
import { walk, walkerFrom, type Walker } from './post-walk.ts';
import { PLAYER_WEAPONS, RULES, opponentAt, weaponOf, type SkillId, type WeaponId } from './moves.ts';
import type { Fighter } from './duel.ts';
import { formatCard, loadTrial, recordFight, saveTrial } from './trial.ts';
import { decodeRecord, encodeRecord, type FightRecord } from './record.ts';
import { peekRecordHeader } from './record-header.ts';
import { api, revision } from './api.ts';
import { automated, beaconPayload, screenOf, sendPerfBeacon } from './perf-beacon.ts';
import { session } from './session.ts';
import { bankClaim, CLAIM_HELD, CLAIM_WAIT_MS, claimOnHide, finaliseClaim, flushThenStanding, loadStanding, saveStanding, outbox, pendingClaims, settleOutbox } from './loot-claims.ts';
import { dressFor, fetchSharedRecord, mintShare, sharedIdFrom, shortLink } from './share-store.ts';
import { recordSpecials, replayParam, verifyRecord } from './replay.ts';
import './monitoring.ts';
import { captureException } from '@sentry/browser';
import './style.css';
import { STEP, wrapAngle } from './sim.ts';
import { cleanName, holdLoot, loadProfile, releaseHold, saveProfile, type StoragePort } from './profile.ts';
import { fightLevel, levelOf as careerLevel, marksOf, rankFor, shownMarks, RANK_STEPS, type Rank } from './career.ts';
import { TIERS, TIER_PIN_KEY, levelOf, tierAt, tierPin, withoutTier, type Tier } from './grades.ts';
import { idleBeat, rankLookFlag, rankLookMoves } from './rank-look.ts';
import { LEGEND_OPPONENTS, isLegendOpponent, legendAt, legendForLevel, portraitKey, portraitPath, rungTopLevel } from './legends.ts';
import { LOOT, PACK, PAPERDOLL, SKILLS, decline, dropFor, killAt, emptyLoot, equippedSkill, fightWeapon, isLootId, isSkillId, lootName, ownedName, paperdollOf, packFull, recordTaken, skillOf, slotOf, stow, store, takeWouldDrop, displacedBy, unwear, wear, wearFromPack, wearTaken, type Loot, type LootId, type Paperdoll } from './loot.ts';
import { createLootPanel } from './loot-panel.ts';
import { loadScorecard, recordResult, saveScorecard, scorecardRows, totals } from './scorecard.ts';
import { beatLegend, describe, initialPractice, type CombatEvent, type Practice } from './combat.ts';
import { CLIP_SECONDS, clipEnded, clipFileName, clipStartTick, clipSupported, recordClip, type ClipRecording } from './clip.ts';
import { Match, equipNotice } from './match.ts';
import { bareName, ROSTER, isOpponentId, resolveFinisher } from './roster.ts';
import { createFeedback } from './feedback.ts';
import { SPECIAL_CUE_OF } from './audio/special.ts';
import { bossSpecialFor, bossSpecialId } from './special-identity.ts';
import { classSpecialFor } from './class-special-identity.ts';
import { CARRIED_WEAPONS, createScene } from './scene.ts';
import { SPECIAL_TESTS, specialStage, type SpecialTest } from './special-look.ts';
import { SPECIAL_LABELS, defaultSparringSpecial, resolveSparringPreview, sparringSpecialOptions, specialBand, SPECIAL_BANDS, playerSparringChoice } from './sparring-specials.ts';
import { RISE_MS } from './gate-rise.ts';
import { atGateLine, disposePit, doorHidden, loadPit, loadSkulls, openPit, prefetchPit, type Pit, type SkullsModule, type Champion, type Kills, type PitRecord, type Stage } from './pit-coordinator.ts';
import { LAYOUT } from './arena.ts';
import { pitGlowFrom, pitLookFrom, pitOpenLook, pitStoneFrom, skullsDemoFrom } from './look-flag.ts';
import { enterGearRoom, type GearRoom } from './gear-room.ts';
import { GATE_LIGHT_IN_MS, GATE_LIGHT_MAX_MS, armGateLight, clearGateLight, prefetchFiles } from './gate-light.ts';
import { SUPPORTED_PLAYER_SPECIALS, specialCueFor } from './sparring-special-runtime.ts';
import { DEV_KIT_KEY, SPARRING_FOR_ALL, SPARRING_SKILLS, devKit, sparringAsked, sparringLink, sparringParam, type SparringKit } from './sparring.ts';
import { exposeDebugView, phoneTier, rafCadence, urlDpr, withoutDpr } from './quality.ts';
import { LADDER, opponentFor, won as wonFight } from './ladder.ts';
import type { FinisherId } from './finishers.ts';

import { HEAVY_MOVES, createHud } from './hud.ts';
import { KICK, impactStopMs, landedKick } from './hit-impact.ts';
import { underRecord } from './detmath.ts';
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
// A double tap still zoomed the whole fight ~2x on iPhone (owner, 2026-09-26 22:47, on/near an attack button): iOS Safari does not
// honour user-scalable=no or touch-action for its double-tap zoom. On the fight surface only (the arena canvas, the page under the
// see-through HUD, the stick and the action cluster) the second single-finger touchend within 350 ms is refused: those controls act on
// pointerdown, so nothing is lost. Everything click-driven keeps both taps: the journal and its Options, the header, Next, camera and
// recenter, SHARE/CLIP and the Sparring pair (.share-button), and the loot panel's buttons (Lead, 2026-09-26).
const DOUBLE_TAP_SURFACE = '#world, #joystick, #actions', CLICK_DRIVEN = '.share-button, #reset-button, #camera-button, #recenter-button, .loot-panel-actions, #loot-undo, .loot-panel';
let lastTouchEnd = -Infinity;
document.addEventListener('touchend', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const fight = target === document.body || target === document.documentElement || (!!target?.closest(DOUBLE_TAP_SURFACE) && !target.closest(CLICK_DRIVEN));
  if (event.touches.length === 0 && event.timeStamp - lastTouchEnd < 350 && fight) event.preventDefault();
  lastTouchEnd = event.timeStamp;
}, { passive: false });
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
// The fight HUD's rank row (Dom 2026-09-24: permanent, with the health bars): start, fight and end. Rank + pips + next rank only, no
// player name (Dom 2026-09-25: "better without"). Redrawn on every persist and after match.end, so a win shows its gain.
const fightRank = element('fight-rank');
// The career count every fight-facing number reads: the account's server figure once it has one, else the device's (career.ts shownMarks).
// One number, so the rank shown, the rung the opponent is dressed at and the ladder level never disagree (Lead 2026-09-27: a forged
// 100000-mark cache must not fight at Origin while showing Recruit). A Match built before the server figure arrives uses the device count.
// Signed in, the server count adds the account's pending claims and this device's unposted outbox (loot-claims.ts), so a win shows at once.
// Until account.ts answers, the last standing this device cached for its account stands in (loot-claims.ts loadStanding), so a signed-in
// player's Match is built at the level the HUD shows.
function careerMarks(): number { const standing = session.standing ?? bootStanding?.standing ?? null; return shownMarks(standing?.marks ?? null, profile, (standing?.pending ?? 0) + claimsPending().length); }
// A tab pinned to a ?tier= look (grades.ts tierPin, Strategy 2026-09-28) says so here, "<Rank> · test look", in place of his career rank,
// so a pinned tab is visible at a glance; ?tier=off clears it. The pin is cosmetic (never in a take), and the journal keeps his real rank.
let watchedLevel: number | null = null;   // a kill link's record level while its fight is on screen (startReplay); PLAY NOW clears it
function renderFightRank() {
  if (lookTier) { fightRank.setAttribute('aria-label', `${lookTier} · test look`); fightRank.replaceChildren(Object.assign(document.createElement('span'), { className: 'rank-now', textContent: `${lookTier} · test look` })); return; }
  renderRank(fightRank, rankFor(watchedLevel === null ? careerMarks() : watchedLevel - 1));   // a kill link shows the fight's rank, not the viewer's (Lead 2026-09-30, B3)
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
// A take is provisional while its Undo line is up: the device saves at once, but the account is told only when the window closes
// (the line's timer, the next fight, a dismissed panel). The cloud merge unions ownership from both sides and never deletes, so a
// take that had already reached the account came back on the next merge whatever Undo did (GPT audit 2026-09-25, A). A page
// closed inside the window loses nothing: the device holds the piece and the next profile beat or sign-in sends it.
let cloudHeld = false;
// The hold is also STORED (profile.ts holdLoot): account.ts reads the device profile when a queued write runs, not when the beat fires, so a
// write queued before the take would otherwise carry it up mid-window (GPT recheck 2026-09-26, 1). Undo and every release clear it.
const holdCloud = (before: Loot | undefined) => { cloudHeld = true; holdLoot(storage, before); };
const unholdCloud = () => { cloudHeld = false; releaseHold(storage); };
const releaseCloud = () => { if (!cloudHeld) return; unholdCloud(); window.dispatchEvent(new Event('frankendom:profile')); };
const hideLoot = () => { clearTimeout(lootLineTimer); lootPanel.hide(); releaseCloud(); };   // every reset path drops the line's timer with the panel
function offerLoot(healthLeft: number) {
  const owned: string[] = session.standing ? [...session.standing.owned, ...session.standing.pendingOwned, ...claimsPending().flatMap((c) => (c.piece ? [c.piece] : []))] : profile.loot?.owned ?? [];
  const attempt = scorecard.rows[opponent.id]?.fights ?? 1;
  const skill = skillOf(opponent.id);   // her move is offered beside her armour (SCOPE #729 item 8): the one take is one or the other
  // One skill slot (Dom 2026-09-25): the held move (the day-one move when none is stored) shows beside hers as what the take gives
  // up, read from SKILLS so any move works.
  const held = equippedSkill(profile.loot), gives = held !== skill ? { name: SKILLS[held].name, image: skillThumb(held) } : undefined;
  // E2 (Dom 2026-09-26): one tile per Profile slot in the Profile's own order (PAPERDOLL, so a new slot needs no edit here), his move last.
  const order = (Object.values(PAPERDOLL) as readonly (readonly string[])[]).flat(), rank = (id: LootId) => order.indexOf(slotOf(id));
  const pieces = [...[...(LOOT[opponent.id] ?? [])].sort((a, b) => rank(a) - rank(b)).map((id) => ({ id, name: takeName(id), owned: owned.includes(id), image: lootThumb(id) })),
    ...(skill ? [{ id: skill, name: SKILLS[skill].name, owned: held === skill, image: skillThumb(skill), gives }] : [])];
  if (!pieces.some((piece) => !piece.owned)) { void settleClaim(null); return; }   // everything of his is already yours: nothing to take
  // The card's default offer, what Take takes: the rung's fixed drop (loot.ts dropFor), else the first piece not yet yours, in slot order.
  const marks = marksOf(profile), offer = dropFor(opponent.id, marks, owned) ?? pieces.find((piece) => !piece.owned)!.id;
  const shown = pieces.find((piece) => piece.id === offer)!, won = rankFor(careerMarks());   // the rank the HUD shows (server + pending when signed in)
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
    holdCloud(before);
    profile.loot = store(profile.loot, id, killAt(opponent.id, match.level, attempt, healthLeft, new Date().toISOString().slice(0, 10)));
    match.lastDrop = id; setLoot(wearTaken(profile.loot, id));   // the piece it replaces goes into the pack when there is room
    clearTimeout(lootLineTimer);
    lootPanel.confirm(`${takeName(id)[0]!.toUpperCase()}${takeName(id).slice(1)} is on you.`, () => {
      clearTimeout(lootLineTimer);
      match.lastDrop = null; unholdCloud(); profile.loot = before; persist(); view.wear(wornIds(), wornTiers()); renderLoot();   // the account never heard of the take; not setLoot, as `before` may be undefined: a first take must not leave an empty loot object behind
      offerLoot(healthLeft);   // the panel comes back with nothing taken and nothing selected
    });
    lootLineTimer = setTimeout(() => { lootPanel.hide(); releaseCloud(); void settleClaim(id); }, LOOT_LINE_MS);   // the Undo line gone: the take is final
  };
  // The move is stored on the loot like a piece and equipped at once (one per duel): the next fight's fighter carries it. Undo puts the
  // ledger back as this take found it, exactly as a piece's Undo does.
  const takeSkill = (id: SkillId): void => {
    if (match.lastDrop || match.lastSkill) return;   // one take per win
    const before = profile.loot;
    holdCloud(before);
    setLoot({ ...(profile.loot ?? emptyLoot()), skill: id }); match.lastSkill = id; match.skill = id;
    clearTimeout(lootLineTimer);
    lootPanel.confirm(`${SKILLS[id].name} is yours.`, () => {
      clearTimeout(lootLineTimer);
      match.lastSkill = null; match.skill = equippedSkill(before); unholdCloud(); profile.loot = before; persist(); renderLoot();
      offerLoot(healthLeft);
    });
    lootLineTimer = setTimeout(() => { lootPanel.hide(); releaseCloud(); void settleClaim(null); }, LOOT_LINE_MS);   // a move is not a loot_claims piece: the win is claimed alone
  };
  lootPanel.show({ eyebrow: `Won at ${won.title} ${won.numeral}`.trim(), offer, name: shown.name, image: shown.image }, pieces, {
    onTake: (id: string) => take(id),
    // A refused kill records the tier a take records (loot.ts killAt: the fight's rung), so it still backfills its skull (loot.ts defeats).
    onDecline: () => { clearTimeout(lootLineTimer); profile.loot = decline(profile.loot, killAt(opponent.id, match.level, attempt, healthLeft, new Date().toISOString().slice(0, 10))); persist(); lootPanel.hide(); void settleClaim(null); },
  });
}
// Loot on the rig and in the journal (brief 5): the equipped set is the profile's word (src/loot.ts); the scene wears it (view.wear), the
// journal's paperdoll and rack show it, and every change persists (the cloud follows on the profile beat). Rack rows are Web design's
// shape: name, the provenance caption (brief 9, with a Watch link once the fight is published), and the Wear / Worn button.
// Every surface names the legend (Dom 2026-09-28): an owned piece by the legend of the rung it was taken at (loot.ts ownedName, from its
// Provenance.tier; the class only for a piece with no tier), and the take card by the legend just beaten ("Mars's boots"), the one this
// fight's "You beat <legend>" line names.
const pieceName = (id: LootId) => ownedName(id, profile.loot?.taken?.[id]?.tier);
const takeName = (id: LootId) => { const legend = legendNow(); return legend ? lootName(id, legend.name) : ownedName(id); };
const wornIds = (): LootId[] => Object.values(profile.loot?.equipped ?? {});
// The rung each worn piece was taken at (Provenance.tier, a level 1..10), which its finish shows (rank-tint.ts); a piece without one shows Recruit.
const wornTiers = (): Record<string, Tier> => Object.fromEntries(wornIds().flatMap((id) => { const level = profile.loot?.taken?.[id]?.tier; return level ? [[id, TIERS[level - 1] ?? 'Recruit']] : []; }));
// The rung this fight meets the opponent at (grades.ts tierAt, the server's awardFor formula): read at load and at each rematch, before the
// fight's marks land, so a take records the tier he was actually met at and his kit never regrades mid-finisher.
let metAt: Tier = 'Recruit';   // set from the profile's marks at boot, below
// Stills and dev look (like ?arena=): ?tier=<Rank> (any case) dresses the OPPONENT's kit at that rung. It is never written to a take (metAt
// is), so it cannot change what a piece records, and nothing reads it but the rig. It is stripped from the address at once (Dom 2026-09-28,
// stuck on the gold Origin), so no copied or shared link carries it, while lookTier keeps pinning this tab: this page, its reloads and its
// Next pages (below), until ?tier=off or a new ?tier= (the rematch no-reload guard below still holds for it).
// It is kept for the tab across reloads (grades.ts tierPin, Strategy 2026-09-28): iOS reloads a heavy tab, and the stripped address alone
// booted his career rank. Storage blocked (private mode): the URL tier still pins this page, a reload boots his rank.
const lookTier = typeof location === 'undefined' ? undefined : (() => {
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(TIER_PIN_KEY); } catch { /* storage blocked */ }
  const pin = tierPin(location.search, stored);
  try { if (pin.store === null) sessionStorage.removeItem(TIER_PIN_KEY); else if (pin.store) sessionStorage.setItem(TIER_PIN_KEY, pin.store); } catch { /* storage blocked */ }
  return pin.tier;
})();
if (typeof location !== 'undefined' && /[?&]tier=/i.test(location.search)) { try { history.replaceState(history.state, '', `${location.pathname}${withoutTier(location.search)}${location.hash}`); } catch { /* no history API: the tier stays in the address */ } }
// ?dpr= (quality.ts DPR_OVERRIDE, read before this line runs) is the same: this page load only, gone from the address at once. dprOverride is
// the same value read here, before the strip: the readout tags it, and it turns off the frame-time auto-drop below for this load.
const dprOverride = typeof location === 'undefined' ? undefined : urlDpr(location.search);
if (typeof location !== 'undefined' && /[?&]dpr=/i.test(location.search)) { try { history.replaceState(history.state, '', `${location.pathname}${withoutDpr(location.search)}${location.hash}`); } catch { /* no history API: the dpr stays in the address */ } }
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
function setLoot(loot: Loot) { profile.loot = loot; persist(); view.wear(wornIds(), wornTiers()); renderLoot(); }
// One rack row: the piece's name, who it was taken from, and Wear/Worn on the journal's own wear path. The journal's rack and the Pit's
// rack (src/pit/sheet.ts, through the Stage) draw the same rows.
function rackRow(id: LootId): HTMLLIElement {
  const loot = profile.loot ?? emptyLoot(), worn = wornIds();
  const li = document.createElement('li'), name = document.createElement('span'), button = document.createElement('button'), taken = loot.taken?.[id], isWorn = worn.includes(id);
  li.setAttribute('data-loot', id); li.setAttribute('data-worn', String(isWorn)); li.setAttribute('tabindex', '0');
  name.textContent = pieceName(id);
  button.setAttribute('data-wear', id); button.textContent = isWorn ? 'Worn' : 'Wear';
  button.addEventListener('click', () => setLoot(isWorn ? unwear(profile.loot ?? emptyLoot(), paperdollOf(slotOf(id))) : wear(profile.loot ?? emptyLoot(), id)));
  li.append(name);
  if (taken) {
    const small = document.createElement('small'), bold = document.createElement('b');
    // Legends (2026-09-27): a piece keeps who it was taken from, by the legend of the rung it was taken at (Provenance.tier); a
    // piece with no rung, or off the legend roster, keeps its own name as before.
    const from = id.split('.')[0]!, legend = taken.tier && isLegendOpponent(from) ? legendAt(from, taken.tier) : null;
    small.setAttribute('data-taken', ''); bold.textContent = legend ? `From ${legend.name}` : pieceName(id); bold.textContent = bold.textContent[0]!.toUpperCase() + bold.textContent.slice(1);
    small.append(bold, document.createTextNode(` · your ${ordinal(taken.attempt)} attempt, ${taken.healthLeft} health left`));
    // The Watch link names the fight's opponent (share-store shortLink): the loader refuses a record for another opponent than the page booted.
    if (taken.recordId) { const watch = document.createElement('a'); watch.setAttribute('data-watch', ''); watch.setAttribute('href', shortLink(location.origin, taken.recordId)); watch.textContent = 'Watch'; small.append(document.createTextNode(' '), watch); }
    li.append(small);
  }
  li.append(button);
  return li;
}
function renderLoot() {
  const loot = profile.loot ?? emptyLoot();
  for (const key of Object.keys(PAPERDOLL) as Paperdoll[]) {
    const id = loot.equipped[key];
    element(`slot-${key}-name`).textContent = id ? pieceName(id) : key === 'main' ? match.weapon[0]!.toUpperCase() + match.weapon.slice(1) : 'Empty';
    element(`slot-${key}`).classList.toggle('on', !!id || key === 'main');
    element(`slot-${key}`).setAttribute('data-loot', id ?? '');   // the worn id, for the paperdoll's image layers (style.css loot-layers block)
    element(`slot-${key}`).hidden = key === 'crest' && !id;   // the rail shows the crest only while one is worn (Strategy 2026-10-01)
    thumbFor(element(`slot-${key}`), id);
    const off = element<HTMLButtonElement>(`slot-${key}-off`);
    off.hidden = !id; off.disabled = packFull(loot);   // Store moves the piece into the pack; a full pack says why beneath it (#pack-full)
    off.setAttribute('aria-describedby', off.disabled ? 'pack-full' : '');
  }
  // The pack (loot.ts PACK): the open slots hold what Store put there, each with Wear; the rest are drawn locked, a placeholder only.
  const pack = Array.from({ length: PACK.total }, (_, i) => {
    const li = document.createElement('li'), id = loot.pack?.[i];
    if (i >= PACK.open) { li.className = 'pack-locked'; li.setAttribute('aria-label', 'Locked pack slot'); return li; }
    if (!id) { li.className = 'pack-empty'; li.setAttribute('aria-label', 'Empty pack slot'); if (i === 0 && !loot.pack?.length) li.textContent = 'Nothing stored. Win gear in the arena.'; return li; }
    const text = document.createElement('div'), name = document.createElement('strong'), rank = document.createElement('small'), button = document.createElement('button');
    li.setAttribute('data-loot', id); name.textContent = sentence(pieceName(id)); rank.textContent = rankText(id); rank.dataset.rank = String(Math.min(10, Math.max(1, profile.loot?.taken?.[id]?.tier ?? 1))).padStart(2, '0');
    button.type = 'button'; button.setAttribute('data-fit', id); button.setAttribute('aria-label', `Try on ${pieceName(id)}`); button.textContent = '›';
    button.addEventListener('click', () => tryOn(id));
    text.append(name, rank); li.append(text, button); thumbFor(li, id, 'pack-thumb');
    return li;
  });
  element('pack').replaceChildren(...pack);
  element('pack-full').hidden = !(packFull(loot) && Object.keys(loot.equipped).length);
  const rows = loot.owned.map(rackRow);
  while (rows.length < 5) { const li = document.createElement('li'); li.className = 'rack-empty'; rows.push(li); }
  element('loot-rack').replaceChildren(...rows);
  if (fitId && !loot.pack?.includes(fitId)) fitId = null;   // the piece was worn or the pack changed under the fitting
  if (fitKey && !loot.equipped[fitKey]) fitKey = null;
  renderFitting();
}
// The gear sheet (Fitting rail, Strategy 2026-10-01). The rail is the slots; tapping a worn one shows it with Store, tapping a stored row
// tries it on: the live rig wears it (in memory only: view.wear, never the profile) with Cancel and Wear this. Wear this is the pack's own
// swap (loot.ts wearFromPack: the piece it replaces takes its pack place); Cancel and closing the sheet dress the rig as the profile says.
let fitId: LootId | null = null, fitKey: Paperdoll | null = null, gear: GearRoom | undefined;
const sentence = (text: string) => text[0]!.toUpperCase() + text.slice(1);
const rankText = (id: LootId) => TIERS[(profile.loot?.taken?.[id]?.tier ?? 1) - 1] ?? 'Recruit';   // a piece with no tier reads Recruit
// A piece's picture inside `host` (one img, made once); a piece with no thumbnail (a weapon, today) shows its name instead.
const thumbs = new WeakMap<HTMLElement, { img: HTMLImageElement; src: string }>();
function thumbFor(host: HTMLElement, id: LootId | undefined, cls = 'slot-thumb') {
  let t = thumbs.get(host);
  if (!t) {
    const img = document.createElement('img'); img.className = cls; img.alt = ''; img.width = img.height = 48;
    img.addEventListener('error', () => { img.hidden = true; host.classList.toggle('noart', true); });
    host.append(img); t = { img, src: '' }; thumbs.set(host, t);
  }
  host.classList.toggle('noart', !id); t.img.hidden = !id;
  if (id) { const src = lootThumb(id); if (t.src !== src) { t.src = src; host.classList.toggle('noart', false); t.img.src = src; } }
}
function dressed() {
  const tiers = wornTiers();
  if (!fitId) return view.wear(wornIds(), tiers);
  const key = paperdollOf(slotOf(fitId)), level = profile.loot?.taken?.[fitId]?.tier;
  view.wear([...wornIds().filter((id) => paperdollOf(slotOf(id)) !== key), fitId], level ? { ...tiers, [fitId]: TIERS[level - 1] ?? 'Recruit' } : tiers);
}
const tryOn = (id: LootId | null) => { fitId = id; fitKey = null; dressed(); renderFitting(); };
function renderFitting() {
  const loot = profile.loot ?? emptyLoot(), shown = fitId ?? (fitKey ? loot.equipped[fitKey] : undefined);
  const selected = fitId ? paperdollOf(slotOf(fitId)) : fitKey;
  for (const key of Object.keys(PAPERDOLL) as Paperdoll[]) { const slot = element(`slot-${key}`); slot.classList.toggle('sel', key === selected); slot.classList.toggle('try', !!fitId && key === selected); }
  Array.from(element('pack').children).forEach((li, i) => li.classList.toggle('sel', !!fitId && loot.pack?.[i] === fitId));
  element('fitting').hidden = !shown;
  if (!shown) return;
  const replaced = fitId ? loot.equipped[paperdollOf(slotOf(fitId))] : undefined, full = packFull(loot);
  const holder = element('fitting'), thumb = element<HTMLImageElement>('fitting-thumb');
  thumb.hidden = false; thumb.src = lootThumb(shown);
  element('fitting-name').textContent = sentence(pieceName(shown));
  element('fitting-rank').textContent = fitId ? `${rankText(fitId)} · ${replaced ? `replaces ${pieceName(replaced)}, ${rankText(replaced)}` : 'fills an empty slot'}` : `${rankText(shown)} · worn`;
  element('fitting-note').textContent = !fitId && full ? 'Pack full: wear a packed piece to free a slot.' : '';
  element('fitting-cancel').hidden = element('fitting-wear').hidden = !fitId;
  const store = element<HTMLButtonElement>('fitting-store'); store.hidden = !!fitId; store.disabled = full;
  holder.dataset.mode = fitId ? 'try' : 'worn';
}
element('fitting-thumb').addEventListener('error', () => { element('fitting-thumb').hidden = true; });
element('fitting-cancel').addEventListener('click', () => tryOn(null));
element('fitting-wear').addEventListener('click', () => { const id = fitId; fitId = fitKey = null; if (id) setLoot(wearFromPack(profile.loot ?? emptyLoot(), id)); });
element('fitting-store').addEventListener('click', () => { const key = fitKey; fitId = fitKey = null; if (key) setLoot(stow(profile.loot ?? emptyLoot(), key)); });
for (const key of Object.keys(PAPERDOLL) as Paperdoll[]) element(`slot-${key}`).addEventListener('click', (event) => {
  if ((event.target as Element).closest('.slot-off') || !profile.loot?.equipped[key]) return;   // an empty slot has nothing to show; the hidden per-slot Store is the old path
  const again = !fitId && fitKey === key; fitId = null; fitKey = again ? null : key; dressed(); renderFitting();
});
// The live mannequin: entered when the sheet opens (the arena hidden, the rig idle in the stage window), left when it closes.
function enterGear() {
  if (pit && !gear) {   // over the Pit: the hero standing in the room is the mannequin (pit.ts fitting); the room's own frame keeps drawing
    pit.fitting(element('gear-window'), { width: () => canvas.clientWidth, height: () => canvas.clientHeight }); journal.dataset.gear = 'live'; document.body.dataset.gear = 'live'; return;
  }
  if (gear || pit || pitOpening || typeof view.pitStage !== 'function') return;
  try { gear = enterGearRoom(view.pitStage(pitLoot), element('gear-window'), { width: () => canvas.clientWidth, height: () => canvas.clientHeight }); journal.dataset.gear = 'live'; document.body.dataset.gear = 'live'; requestAnimationFrame(() => gear?.fit()); }
  catch (error) { gear = undefined; captureException(error, { tags: { gear: 'enter' } }); }
}
function leaveGear() {
  fitId = fitKey = null;
  if (gear) { gear.leave(); gear = undefined; }
  pit?.fitting(null);
  delete journal.dataset.gear; if (document.body) delete document.body.dataset.gear;
  view.wear(wornIds(), wornTiers()); renderFitting();
}
for (const key of Object.keys(PAPERDOLL) as Paperdoll[]) element(`slot-${key}-off`).addEventListener('click', () => setLoot(stow(profile.loot ?? emptyLoot(), key)));
lootPanel.wire();
const cameraButton = element<HTMLButtonElement>('camera-button');
const attackButton = element<HTMLButtonElement>('attack-button');
const resetButton = element<HTMLButtonElement>('reset-button');
const hud = createHud(element);
const runButton = element<HTMLButtonElement>('run-button');
const input = element<HTMLInputElement>('fighter-name');
// A browser that refuses storage (Safari with site data blocked throws on `localStorage` itself) reads as empty: every setting
// takes its default and the game boots; writes still throw, so saveProfile can report 'Storage unavailable'.
const storage: StoragePort = {
  getItem: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: (key, value) => localStorage.setItem(key, value),
};
const loaded = loadProfile(storage, () => crypto.randomUUID());
releaseHold(storage);   // a hold a page closed inside its Undo window left behind: the take stands, the device has it
const profile = loaded.profile;
input.value = profile.name === 'Wanderer' ? '' : profile.name;
welcome.hidden = true;   // no name card on a first visit (Dom 2026-09-30): straight into the arena as Wanderer; the name is edited in the Profile. Only the kill-link screen and Rename show it now.
// The rank on the HUD and the journal: the account's server marks when signed in and the server has them (account.ts), else the
// device's count, which only ever rises (GAME_SPEC ladder). A win reaches the server figure once the loot sweep verifies its claim.
// The claims outbox (loot-claims.ts): a signed-in account's wins this device has not posted yet count on the rank and the loot offer on
// top of my_standing()'s verified figures and its pending (posted, not yet swept) claims. Entries a closed tab left unfinished are finished now, with no piece (Backend's contract).
if (!settleOutbox(storage)) captureException(new Error('loot-claims: the settled outbox could not be written; held in memory'));   // a full device: the entries still post this load
let bootStanding = loadStanding(storage);   // cleared once account.ts has answered: session.standing is then the figure (null for a guest)
const claimsPending = () => pendingClaims(outbox(storage), session.userId ?? bootStanding?.userId ?? null);
function showRank() {
  const rank = rankFor(careerMarks());
  for (const id of ['rank-sigil', 'journal-sigil']) element(id).textContent = rank.numeral || '✦';
  for (const id of ['rank', 'journal-rank']) renderRank(element(id), rank);
  renderFightRank();
}
window.addEventListener('frankendom:standing', () => { bootStanding = null; showRank(); });
function persist() {
  showRank();
  const saved = saveProfile(storage, profile) ? (session?.userId ? 'Signed in · saving…' : 'Guest · saved on this device') : 'Storage unavailable · name will not be saved';   // account.ts settles 'saving…' once the cloud answers
  if (!cloudHeld) window.dispatchEvent(new Event('frankendom:profile'));   // a signed-in account sends the change up (account.ts); a provisional take waits
  // The HUD identity and the journal's fighter card show the same three facts.
  for (const [id, text] of [['name-button', profile.name], ['journal-name', profile.name], ['save-status', saved], ['journal-save', saved]]) element(id).textContent = text;
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
const sparPreview = resolveSparringPreview(window.location?.search ?? '', CARRIED_WEAPONS);
const invalidSparringPreview = !replayText && !sharedId && sparPreview.invalid;
const specialTest = sparPreview.special;   // standalone previews keep their warden; combined Sparring links validate the explicit opponent/kit
const specialCue = specialCueFor(specialTest);   // this preview's sound, if it has one
const urlOpponent = specialTest ? SPECIAL_TESTS[specialTest].opponent : /[?&]opponent=(\w+)/.exec(window.location?.search ?? '')?.[1]?.toLowerCase();   // ?opponent=PlagueDoctor names the same man (Dom 2026-09-28)
const opponent = opponentFor(profile.encounter, urlOpponent);
// The Sparring tab (Dom 2026-09-29, via Strategy): admins only (account.ts), ?debug, and a page a sparring link booted. Its Opponent picker,
// Difficulty (the Opponent's ten legends and the dummy), Stage, Move, Weapon and Finisher start nothing on their own: Start sparring carries
// them. Players have no picker: the ladder's Next picks the next unbeaten rung. The Opponent picker lists the beta legend opponents in
// LEGEND_OPPONENTS order (Dom's layout A), live rungs only: held recipes (Season 2 creatures) never appear (owner 2026-09-20).
const opponentSelect = element<HTMLSelectElement>('opponent-select');
const SPAR_OPPONENTS = LEGEND_OPPONENTS.filter((id) => LADDER.some((rung) => rung.id === id));
for (const id of SPAR_OPPONENTS) {
  const option = document.createElement('option') as HTMLOptionElement;
  option.value = id;
  option.textContent = bareName(id);
  opponentSelect.append(option);
}
opponentSelect.value = opponent.id;
// Dev/test tool (owner 2026-09-19): force which finisher plays on the next ceremonial kill, to art-direct and learn each
// kill shot. 'Auto (spec)' is the spec's pick. The override only swaps WHICH finisher plays — draws, kicks and the
// player's own death still get no ceremony (v1 rules), and unshipped finishers fall back to the plain Death clip as always.
// Only the clips that exist today (owner 2026-09-19): Split Crown, Decapitation, Run Through, Opened — plus Plain death as the
// no-finisher control. The rest of the spec table (hamstrung/execution) has no clip yet and would silently
// play the plain Death, which reads as a bug in a test menu. Add each back the day its clip ships.
const FINISHER_OPTIONS: [string, string][] = [
  ['splitCrown', 'Split Crown'],
  ['decapitation', 'Decapitation'],
  ['runThrough', 'Run Through'],
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
const sparParams = new URLSearchParams(window.location?.search ?? '');
const requestedFinisher = sparParams.get('finisher');
const sparFinisher = !replayText && !sharedId && sparPreview.kit && FINISHER_OPTIONS.some(([id]) => id === requestedFinisher) ? requestedFinisher as FinisherId : null;
finisherSelect.value = sparFinisher ?? 'auto';   // only supported existing clips, for this combined Sparring fight
// The arena test override (Options tab beside Opponent, gated with the admin test tools): which arena the NEXT fight builds in. The arena is built at load and
// Next reloads the page, so the pick is stored and read at load; `?arena=` in the URL still wins. Unset = the ladder band decides.
// Test tool only: no ladder or progress change, and nothing is read or built when it is unset.
const ARENA_PICK_KEY = 'frankendom.arena-override';
const storedArena = (() => { try { return sessionStorage.getItem(ARENA_PICK_KEY) ?? ''; } catch { return ''; } })();
const arenaSelect = element<HTMLSelectElement>('arena-select');
const rawArena = sparParams.get('arena');
const requestedArena = sparPreview.kit && rawArena !== null
  ? ['1', 'a', 'b', 'c', 'd', 'ladder'].includes(rawArena) ? rawArena : 'ladder'
  : /[?&]arena=(\w+)/.exec(window.location?.search ?? '')?.[1];   // preserve standalone legacy parsing; combined picks use exact decoded values
const sparArena = sparPreview.kit ? requestedArena : undefined;
arenaSelect.value = sparArena === 'ladder' ? '' : sparArena ?? storedArena;
if (arenaSelect.selectedIndex < 0) arenaSelect.value = '';   // unknown stored keys still read as Ladder
// Stage and Finisher are form picks: neither writes nor changes the current fight before Start.
// The stored Dev kit (sparring.ts devKit): its pickers are retired with the admin ladder overrides (Dom 2026-09-29), but a kit already in the
// tab's storage is still read at boot, so the release rows that seed one (arena-audio, clip-send-tour, player-bot) keep their fight.
const kit = devKit((() => { try { return sessionStorage.getItem(DEV_KIT_KEY); } catch { return null; } })(), CARRIED_WEAPONS);
// The weapon a ladder fight is fought with: the Dev kit's, else the equipped one (loot.ts fightWeapon).
const ladderWeapon = () => kit.weapon ?? fightWeapon(profile.loot, CARRIED_WEAPONS);
const applySignature = () => view?.setSignature?.(window.location?.search ?? '', null, !element('test-tools').hidden);
// The bars name whoever is in the arena (Dom via Strategy, 2026-09-22): no rung is exempt any more — the first one used to keep
// index.html's "ARENA WARDEN", which is now the no-opponent fallback "OPPONENT". The meters' labels follow for a screen reader.
// A legend (Dom via Strategy 2026-09-28) is named as the versus card names him: the legend's name large, the class small beside it
// (style.css .opponent-class). The legend moves with match.level, so every fight start names him again (began()), not only the boot.
function nameOpponent() {
  const label = element('opponent-name'), name = bareName(opponent.id), legend = legendNow()?.name;
  const small = document.createElement('small');
  small.className = 'opponent-class'; small.textContent = `the ${name}`;
  if (legend) label.replaceChildren(`${legend.toUpperCase()} `, small); else label.textContent = `THE ${name.toUpperCase()}`;
  label.dataset.mobile = legend ?? name;
  const spoken = legend ? `${legend}, the ${name},` : name;
  element('target-health').setAttribute('aria-label', `${spoken} health`);
  element('target-posture').setAttribute('aria-label', `${spoken} posture`);
}
// The match (src/match.ts): the fight's state and every start / end / reset, in explicit modes — career, practice, replay, sparring.
// Every fight is recorded in memory (beta plan brief 3: kill links): the seed, the warden profile and every quantized intent the
// simulation stepped, so the fight can be replayed elsewhere. The build id is <html data-release>, 'dev' until the deploy stamps the
// revision there (a replay must run on the same rules; the harness has no document element).
const BUILD = document.documentElement?.dataset?.release || 'dev';
// A local build (the release gates and the bot serve dist on localhost): the one place ?debug acts on its own.
const localBuild = /^(localhost|127\.0\.0\.1)$/.test(window.location?.hostname ?? '');
// Local browser QA may select a seed without changing any combat rule or a public fight.
const botSeed = localBuild && /[?&]debug\b/.test(window.location?.search ?? '')
  ? /[?&]botSeed=(\d+)/.exec(window.location?.search ?? '')?.[1] : undefined;
// The ladder's difficulty is the career's LEVEL (career.ts levelOf: 1 + wins, capped at 46; moves.ts profileAt; Dom via Strategy, 2026-09-27), read before the Match is built so the
// first fight's recorder is born on it; Next and Rematch reload, so a new rank's level lands on the next fight. The old stored pick
// (frankendom.difficulty.v1) is no longer read. A replay fights at its record's level (match.ts).
const rankLevel = () => fightLevel(profile.dial, careerMarks());
const match = new Match(opponent, BUILD, { storage, trial, scorecard, profile, rank: () => careerLevel(careerMarks()) }, botSeed === undefined ? undefined : Number(botSeed) >>> 0, ladderWeapon(), kit.skill ?? equippedSkill(profile.loot), kit.level ?? rankLevel());   // the opponent fights at the dial (career.ts), not the rank
// Any Dev-kit pick that differs from what the career would fight makes the fight practice only (match.ts `tested`; Lead 2026-09-27).
const kitTested = () => (kit.level !== undefined && kit.level !== rankLevel()) || (!!kit.weapon && kit.weapon !== fightWeapon(profile.loot, CARRIED_WEAPONS)) || (!!kit.skill && kit.skill !== equippedSkill(profile.loot));
match.tested = kitTested();
// The name this fight's opponent fights under (legends.ts, Dom via Strategy 2026-09-27): read through the fight's own level, so a
// dial-down fight and a re-play each show the legend of the level they are fought at. Text only; null off the legend roster.
const legendNow = () => (isLegendOpponent(opponent.id) ? legendForLevel(opponent.id, match.level) : null);
// The rung his look, kit and weapon grade are dressed at (scene.ts setTier). ?tier= wins; then a sparring fight's level, then a stored Dev-kit level, at the rung the
// versus card prints for it (tierAt(kit.level - 1); Dom 2026-09-29: level 6 named Bedivere but wore the gold Origin Knight); else the rung
// he is met at. Only the look: a take still records metAt, and a Dev level off the dial never takes anything (#917).
const shownTier = (met: Tier = metAt): Tier => lookTier ?? (match.mode === 'sparring' ? tierAt(match.level - 1) : kit.level !== undefined ? tierAt(kit.level - 1) : met);
// The Next button names who the next page meets: that opponent's legend at the level the next page boots at (kit.level ?? rankLevel,
// read after this win's mark), the class only off the legend roster (Dom 2026-09-28).
const nextLegend = () => { const next = match.nextRung(); return next && isLegendOpponent(next.id) ? { ...next, name: legendForLevel(next.id, kit.level ?? rankLevel()).name } : next; };
nameOpponent();
// The Sparring tab's Difficulty: any of the 46 levels, or the dummy. It names the level Start sparring asks for and changes nothing live
// (the admin ladder level pick is retired, Dom 2026-09-29); the sparring fight's look follows its level's rung (shownTier).
const difficultySelect = element<HTMLSelectElement>('difficulty-select');
// Difficulty is the Opponent's ten legends, one per rank, "6 – Hannibal" (Dom 2026-09-29, layout A: rank number – legendAt), then the
// dummy. Picking rank r fights at the rung's top level (legends.ts rungTopLevel: rank 6 → 30, rank 10 → 46); the line of the rank the
// current level sits in carries that level as its value (its text stays "2 – Ragnar Lothbrok"; Strategy 2026-09-29), so the control still
// names the fight's level (the release rows read it) and Start sparring without a new pick fights where it stands. Any pick rebuilds the
// list on the picked top, so every fresh pick fights at its rank's top. A new Opponent refills the list and keeps the rank (Centurion 6 → Witch 6).
const option = (value: string, label: string) => { const o = document.createElement('option') as HTMLOptionElement; o.value = value; o.textContent = label; return o; };
function showDifficulty(value = match.dummy ? 'dummy' : String(match.level)): void {
  const id = opponentSelect.value, current = Number(value), currentRank = current >= 1 ? levelOf(tierAt(current - 1)) : 0;
  const ranks = Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => option(String(rank === currentRank ? current : rungTopLevel(rank)), `${rank} – ${isLegendOpponent(id) ? legendAt(id, rank).name : TIERS[rank - 1]}`));
  difficultySelect.replaceChildren(...ranks, option('dummy', 'Dummy'));
  difficultySelect.value = value;
}
const specialSelect = element<HTMLSelectElement>('spar-special');
const playerSpecialSelect = element<HTMLSelectElement>('spar-skill');
function showPlayerSpecialSummary(): void {
  const choice = playerSparringChoice(playerSpecialSelect.value);
  element('spar-player-status').textContent = !choice ? 'Your fighter: unsupported choice. Choose an available move before Start.'
    : choice.special ? `Your fighter: ${SPECIAL_LABELS[choice.special]} · ${ROSTER[SPECIAL_TESTS[choice.special].opponent].name} ${SPECIAL_BANDS[specialBand(SPECIAL_TESTS[choice.special].level)!]}. Cast with SKILL; your body and weapon stay the same.`
    : choice.skill ? `Your fighter: ${SKILLS[choice.skill].name}. Cast with SKILL.` : 'Your fighter: special move off.';
}
function showPlayerSpecial(): void {
  const legacy = document.createElement('optgroup'); legacy.label = 'Legacy player moves';
  for (const id of SPARRING_SKILLS) legacy.append(option(id, SKILLS[id].name));
  const classes = [...new Set(Object.values(SPECIAL_TESTS).map(test => test.opponent))];
  const groups = classes.flatMap(id => sparringSpecialOptions(id).map(({ band, ids, unavailable }, i) => {
    const group = document.createElement('optgroup'); group.label = `${ROSTER[id].name} · ${band}`;
    if (ids.length) for (const preset of ids) {
      const supported = SUPPORTED_PLAYER_SPECIALS.includes(preset), row = option(`special:${preset}`, `${SPECIAL_LABELS[preset]}${supported ? '' : ' · player cast unavailable'}`);
      row.disabled = !supported; group.append(row);
    } else { const row = option(`unavailable:${id}:${i}`, unavailable); row.disabled = true; group.append(row); }
    return group;
  }));
  playerSpecialSelect.replaceChildren(option('none', 'None'), legacy, ...groups);
  playerSpecialSelect.value = sparPreview.yourSpecial ? `special:${sparPreview.yourSpecial}` : match.skill ?? 'none';
  showPlayerSpecialSummary();
}
playerSpecialSelect.addEventListener('change', showPlayerSpecialSummary);
function showSpecialSummary(): void {
  const selected = specialSelect.value as SpecialTest, difficulty = Number(difficultySelect.value);
  const test = Object.hasOwn(SPECIAL_TESTS, selected) ? SPECIAL_TESTS[selected] : null;
  const band = test ? specialBand(test.level) : null;
  element('spar-special-status').textContent = difficultySelect.value === 'dummy'
    ? 'Opponent: Dummy does not cast special moves.'
    : test && band !== null ? `Opponent: ${SPECIAL_LABELS[selected]} · ${SPECIAL_BANDS[band]} special; opponent difficulty ${difficultySelect.selectedOptions?.[0]?.textContent ?? difficulty}.${band === 0 ? ' Explicit preview only; career A stays off.' : ''}${selected === 'drag' ? ' Ground Drag night readability remains on hold.' : ''}`
    : specialSelect.value === 'none' ? 'Opponent: special move off.' : 'Opponent: unsupported choice. Choose an available move before Start.';
}
function showSparringSpecial(selected?: SpecialTest | null): void {
  const groups = sparringSpecialOptions(opponentSelect.value);
  specialSelect.replaceChildren(option('none', 'None'), ...groups.map(({ band, ids, unavailable }, i) => {
    const group = document.createElement('optgroup'); group.label = band;
    if (ids.length) for (const id of ids) group.append(option(id, SPECIAL_LABELS[id]));
    else { const missing = option(`unavailable-${i}`, unavailable); missing.disabled = true; group.append(missing); }
    return group;
  }));
  const dummy = difficultySelect.value === 'dummy', difficulty = Number(difficultySelect.value);
  const validSelected = selected && SPECIAL_TESTS[selected].opponent === opponentSelect.value ? selected : null;
  const id = dummy || selected === null ? null : validSelected ?? defaultSparringSpecial(opponentSelect.value, difficulty);
  specialSelect.value = id ?? 'none';
  specialSelect.disabled = dummy;
  showSpecialSummary();
}
opponentSelect.addEventListener('change', () => { showDifficulty(difficultySelect.value); showSparringSpecial(); });
difficultySelect.addEventListener('change', () => { showDifficulty(difficultySelect.value); showSparringSpecial(); });
specialSelect.addEventListener('change', showSpecialSummary);
// A kill link decides the weapon after boot (the record's): the scene's rigs wait on this, then draw match.weapon.
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
// What ?debug SHOWS (the combat-debug overlay, the scorecard table, the clip size line) follows the test tools: a local build or the admins
// roster (Strategy 2026-09-29). The #debug element's data the release checks read is written whenever `debug` is on, shown or not.
const testTools = element('test-tools'), debugShown = () => debug && !testTools.hidden;
// The loot offer waits for the kill to FINISH PLAYING (Lead brief 2026-09-22; Dom on the phone: "I have never seen the
// decapitation land" — the panel used to open on the Killed event, over the ceremony). This holds the win's health-left until
// view.finishPhase().complete latches in updateHud; null = nothing pending. Page timing, not match state: began() clears it with the panel.
let pendingLoot: number | null = null;
// The Pit's switch and door (declared before updateHud first reads them; the wiring is by showPitLook below).
const pitLook = pitLookFrom(window.location?.search ?? '');
const pitButton = element<HTMLButtonElement>('pit-button');
// The walk to the gate after a win (docs/pit-design.md §9, D2): once the loot pick is over the stick walks the winner (post-walk.ts), not
// the fight; null until then and again from the next fight (began). What the gate does when he reaches it is the Pit's.
let walker: Walker | null = null;
// D2 (docs/pit-design.md §9): the gate opens on foot. `gateAuto`: a tap or the shortcut walks him the last metres; `gateHold`: he stands at
// the line while the chunk lands; `lastMoveAt`: the door hides while he walks (doorHidden); `crossed`: one open per crossing of the line.
let gateAuto = false, gateHold = false, lastMoveAt: number | null = null, crossed = false;
const lootActions = element('loot-panel-actions');
// The gate's light (gate-light.ts). gateLit: up since this document's first paint (src/gate-light-boot.js), down at the arena's first frame.
// gateLeaving: up on this page from the gate's press until the reload; the frames drawn between the Pit closing and the reload (the reset
// settles a take first) must NOT take it down, or the flag goes with it and the fresh page starts black (pit-exit-check caught this).
let gateLeaving = false;
let gateLit = typeof document !== 'undefined' && !!document.documentElement?.classList?.contains('gate-light');
const dropGateLight = () => { if (!gateLit) return; gateLit = false; clearGateLight(document.documentElement, () => sessionStorage); };
let nextRungWarmed = false;   // the next fighter's files are fetched once per page, from the Pit (prefetchNextRung)
let pitLooking: Promise<void> | undefined;   // the `?look=pit` room opening (showPitLook); the debug handle's ready() waits on it
let pit: Pit | undefined, pitOpening = false, pitOp = 0;   // pitOp: the tap a landing chunk answers; a new fight or pagehide bumps it
// ?perf=1 shows the .perf readout (style.css): the device measures its own frames. Also unhides the element once, here.
// Read without URLSearchParams and without assuming `location`: tests/graphics.test.ts boots this module in a node VM where
// neither exists, and 49 tests failed on it.
const perf = /[?&]perf=1(?:&|$)/.test(typeof location === 'undefined' ? '' : location.search);
if (perf) element('perf').hidden = false;
// The playtest lines (SCOPE #729 item 3, one mid-range Android run): frame times over the WHOLE current fight (reset at every start), the
// moment the first fight went live, what the page fetched, and what device says so. A tester sends one screenshot; nothing else to type.
let fightFrames: number[] = [], firstFightAt = NaN, fightStartAt = NaN, firstExchangeAt = NaN;   // NaN until the first playable frame: the readout must never show a stamp it has not taken
// renderRatio: the renderer's EFFECTIVE pixel ratio (a ?dpr= override, the tier cap, or 1 after a context loss), so a screenshot proves what ran.
// The ratio the page ran at before its first automatic drop (the frame-time drop below, or a context restore), for the readout: "render 1x
// (auto-lowered from 1.25)" says the device fell back, so a screenshot is never read as the tier's own ratio (Dom's iPhone, 2026-09-28).
let loweredFrom: number | undefined;
const lowered = (drop: () => void) => { const was = view.renderer.getPixelRatio(); drop(); if (loweredFrom === undefined && view.renderer.getPixelRatio() < was) loweredFrom = was; };
const deviceLine = (renderRatio: number, loweredFrom: number | undefined) => {
  const nav = typeof navigator === 'undefined' ? null : navigator, ua = nav?.userAgent ?? '';
  const platform = ua.match(/\(([^)]+)\)/)?.[1] ?? 'unknown device', browser = ua.match(/(?:CriOS|Chrome|Firefox|FxiOS|Version)\/[\d.]+/)?.[0] ?? '';
  const screenSize = typeof screen === 'undefined' ? '' : ` ${screen.width}×${screen.height}@${typeof devicePixelRatio === 'number' ? devicePixelRatio : 1}x`;
  const cores = nav?.hardwareConcurrency ? ` ${nav.hardwareConcurrency} cores` : '', memory = (nav as { deviceMemory?: number } | null)?.deviceMemory ? ` ${(nav as { deviceMemory?: number }).deviceMemory} GB` : '';
  const render = ` render ${renderRatio}x${loweredFrom === undefined ? '' : ` (auto-lowered from ${loweredFrom})`}${dprOverride === undefined ? '' : ' (?dpr)'}`;
  return `${`${platform} ${browser}`.trim()}${screenSize}${render}${cores}${memory}`;
};
const rankLookNow = () => (globalThis as { __rankLook?: { stamps(): { on: number }; state(): string } }).__rankLook;   // scene.ts sets it when this fight has a look stream
// The perf beacon (perf-beacon.ts): once per fight, at its end or on pagehide mid-fight, never from a frame. beaconSent is the once.
let beaconSent = false;
function sendBeacon() {
  if (beaconSent || match.replay || specialTest || match.mode === 'pvp' || !fightFrames.length || !api || typeof fetch !== 'function') return;   // no service in this build: nothing to send
  const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & { deviceMemory?: number }), info = view.renderer.info.render;
  if (automated(nav, window.location?.search ?? '')) return;
  beaconSent = true;
  const body = beaconPayload({
    fightFrames, firstFightAt, renderRatio: view.renderer.getPixelRatio(), loweredFrom, dprOverride, tris: info.triangles, draws: info.calls,
    phone: phoneTier(), lookOn: (globalThis as { __rankLookOn?: unknown }).__rankLookOn !== undefined, revision: revision ?? null,
    userAgent: nav?.userAgent ?? '', screen: (typeof screen === 'undefined' ? null : screenOf(screen.width, screen.height, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)) ?? '0x0@1',
    cores: nav?.hardwareConcurrency, memoryGb: nav?.deviceMemory,
    fightStartAt, firstExchangeAt, lookOnAt: rankLookNow()?.stamps().on, lookState: rankLookNow()?.state(),
  });
  void sendPerfBeacon(api, body, fetch);
}
// Bytes over the wire for everything the page fetched so far (transferSize is 0 for a cache hit; the count says how many files that was).
const loadedLine = () => {
  const entries = (performance as { getEntriesByType?: (type: string) => { transferSize?: number }[] }).getEntriesByType?.('resource');
  if (!entries) return 'loaded: no resource timing';
  const bytes = entries.reduce((sum, e) => sum + (e.transferSize ?? 0), 0);
  return `loaded ${(bytes / 1048576).toFixed(1)} MB over the wire in ${entries.length} files`;
};
const replayBanner = element('replay-banner'), shareStatus = element('share-status');
const duelButton = element<HTMLButtonElement>('duel-button'), shareLink = element<HTMLButtonElement>('share-link'), clipButton = element<HTMLButtonElement>('clip-button');
const clipLabel = element('clip-label'), clipSub = element('clip-sub');
// The clip in progress (Export clip B, below the share handler) and a made clip waiting for its share sheet.
let clip: { recording: ClipRecording; saved: ReturnType<Match['startClip']>; fresh: Practice | null; finisher: FinisherId | null; started: number; killedAt: number | null; completeAt: number | null; title: string } | null = null;
let clipFile: File | null = null, clipTitle = 'Frankendom';
// Bumped by every fight start (dropClip) and every new recording: a recorder still making its file checks it, so a late file never lands
// on the next fight, or over a newer clip of the same fight, as SEND or a share sheet (GPT recheck 2026-09-29, C; at 303af39, F).
let clipEpoch = 0;
// `stale`: the link itself is the message (expired record, older build) rather than a status about a fight that is playing — that
// line leaves the header band for the slot right above PLAY NOW, in the house serif (style.css `.replay-banner[data-stale='1']`).
const replayStill = element<HTMLImageElement>('replay-still');   // a retired kill link's warden still; any start takes it down (began)
const banner = (text: string | null, stale = false) => { replayBanner.textContent = text ?? ''; replayBanner.hidden = !text; replayBanner.dataset.stale = text && stale ? '1' : '0'; };
// Phones: the HUD is a grid whose height moves with the rank row and a wrapping status line, so a fixed top put "SPARRING THE DUMMY,
// NO REWARDS" over the HEALTH / STAMINA labels (Lead 2026-09-28). The banner reads just under the status line instead (--hud-bottom,
// style.css); the loot panel below the status line is not counted, so a win never pushes the banner down the screen.
const hudStatus = element('combat-status');
if (typeof ResizeObserver === 'function') {
  const hudBottom = new ResizeObserver(() => document.documentElement.style.setProperty('--hud-bottom', `${Math.round(hudStatus.getBoundingClientRect().bottom)}px`));
  hudBottom.observe(hudStatus); if (hudStatus.parentElement) hudBottom.observe(hudStatus.parentElement);   // the rows above move it too
}
// The Dev panel says, in one line, that a Dev-kit fight moves nothing (Strategy's words, 2026-09-27).
function sayTested(): void { element('dev-kit-line').hidden = !(match.mode === 'career' && match.tested); }
sayTested();
// The equip fallback's line (Lead P1, 2026-09-26: it was silent outside a replay). Shown for 6 s over whatever line the header band holds,
// which then comes back.
let equipLine: string | null = null;
const sayEquip = () => {
  const line = equipLine, back = replayBanner.hidden ? null : replayBanner.textContent;
  if (!line || back === line) return;
  banner(line); setTimeout(() => { if (replayBanner.textContent === line) banner(back); }, 6000);
};
// The status takes the share link's place (style.css .share-status): a confirmation clears after 2 s and the label returns;
// everything else — an error to act on, a raw link to copy, a sign-in prompt — stays until the next fight. Named, not measured:
// "Couldn't make a link, try again." is 32 characters and must persist (lead review).
const CONFIRMATIONS = new Set(['Shared.', 'Clip saved.', 'Link copied.', 'Result copied.', 'Posted to today\'s board.']);
let sayTimer: ReturnType<typeof setTimeout> | undefined;
const say = (text: string | null) => { clearTimeout(sayTimer); shareStatus.textContent = text ?? ''; shareStatus.hidden = !text; if (text && CONFIRMATIONS.has(text)) sayTimer = setTimeout(() => say(null), 2000); };
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
// Hit-stop: a contact freezes the simulation for a few frames while the frame keeps rendering, so the pose at impact reads. Wall-clock
// pacing only — the simulation, its tick count and determinism are untouched. Heavier contacts stop longer; a kill stops longest.
// This is the one owner of the impact pause: the renderer is told the sim is frozen and holds its combat animation (effects run on),
// the contact tick's own bodies are what the frozen frames show, and the part of a frame that outlives the pause goes on to the next tick.
// A kick's lunge carries its short cone forward: it lands on a standing target from 1.58 m (tests/duel 'kick lands'); the HUD flags 1.5.
const HIT_STOP: Partial<Record<CombatEvent['type'], number>> = {
  SpecialLanded: 50,   // a Special Move's strike holds like a clean hit
  Blocked: 30,
  Hit: 50,
  Parried: 70,
  GuardBroken: 90,
  PostureBroken: 120,
  Killed: 220,
};
const HEAVY_HIT = 90,
  HEAVY_BLOCK = 50; // a heavy-class contact stops longer whether it lands or is blocked
const TEMPO_KEY = 'frankendom.tempo.v1',
  DAMAGE_KEY = 'frankendom.damage-numbers.v1';
// Damage numbers: off by default (owner 2026-09-20), a journal setting for those who want them; the HUD floats them.
let damageNumbersOn = storage.getItem(DAMAGE_KEY) !== 'off';   // owner 2026-09-20: ON by default, greyed (style.css .dmg) — #219 read "greyed out" as "off"; the toggle stays for those who want them gone
// Tempo: the simulation is written in ticks; stepping it at 50 Hz instead of 60 plays the same fight a fifth slower in wall-clock (wind-ups,
// windows, reactions, movement alike — hit-stop is in ms and unchanged). A journal toggle so the owner can feel the slower tempo before any
// re-timing of the moves (which needs the blade paths re-baked).
let tempoHz: 60 | 50 = storage.getItem(TEMPO_KEY) === '50' ? 50 : 60;
const step = () => match.mode === 'pvp' ? STEP : 1 / tempoHz;   // online input/network cadence never inherits the solo preference
let hitStop = 0;
// Hit impact (hit-impact.ts, Dom 2026-09-29): a landed blow holds 3 or 5 frames longer, a block 2, a parry 11, always (reduced motion included, owner ruling 2026-09-29). The pause delays only the
// presentation clock; every tick still runs, in order. NOT in a live duel: there the hit-stop would
// hold back local ticks the peer is waiting on, so a duel keeps the camera knock only.
function stopFor(events: CombatEvent[]): number {
  if (match.mode === 'pvp') return 0;   // all contact pauses are offline-only, not just the added impact tier
  if (events.some(landedKick)) return KICK.stopMs;   // a landed kick's beat is 2 frames in all (hit-impact.ts KICK)
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
  return ms + impactStopMs(events);
}
// The fallen legend's face beside "You beat <legend>" (Dom via Strategy 2026-09-28, the portrait handover): the versus card's medallion,
// drawn by style.css #combat-status[data-face]::before from --face once the file has loaded, for the same level the line names. No face
// file (or no legend) keeps the plain line, as on the card. Any other line (a new fight, a loss, a draw) clears it.
let faceWanted: string | null = null;
function winFace(src: string | null) {
  if (src === faceWanted) return;
  faceWanted = src; delete hudStatus.dataset.face; hudStatus.style.setProperty('--face', '');
  if (!src || typeof Image !== 'function') return;
  const img = new Image();
  // Absolute: a relative url() inside a custom property resolves against the stylesheet (/assets/), not the page.
  img.onload = () => { if (faceWanted !== src) return; hudStatus.style.setProperty('--face', `url("${img.src}")`); hudStatus.dataset.face = 'true'; };
  img.src = src;
}
function updateHud() {
  winFace(isLegendOpponent(opponent.id) && beatLegend(match.practice, legendNow()?.name) ? portraitPath(opponent.id, match.level) : null);
  hud.update(match.practice, { legend: legendNow()?.name, controlsReady: assetsReady && !graphicsLost && !versusUp && !match.replay, debug: debugShown(), opponentId: opponent.id, next: nextLegend(), replay: !!match.replay, practiceOnly: match.practiceOnly, stalled: match.stalled, dummy: match.dummy });   // buttons wake when the card lifts (never during a replay), so a press is never swallowed
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
  // The Pit's door, on a career kill screen only (never a replay, a viewer page, sparring or the look test).
  const finish = match.practice.finish, door = !!finish && !match.replay && !match.stalled && match.mode === 'career' && !pitLook;
  // While he walks, the door hides as soon as the stick moves him and returns after 3 s still (Strategy). Decided HERE, the one place
  // that sets hidden: the frame loop used to set it too, and this line, run later in the same frame, put the door straight back.
  pitButton.hidden = !door || (walker !== null && doorHidden(lastMoveAt, performance.now()));
  // The walk starts once a win's loot pick is over: the finish has played out and the offer's row is gone (a take's Undo line may still show).
  if (!walker && door && finish.victim === 1 && !finish.draw && !pit && pendingLoot === null && phase?.complete && lootActions.hidden) {
    walker = walkerFrom(match.practice.fighter); view.walkToGate(true); feedback.warmGate(); document.documentElement.classList.toggle('walking', true);
  }
  if (door) {
    const label = pitOpening ? 'Opening the gate…' : finish.victim === 1 && !finish.draw ? 'Enter the Pit' : 'Recover';
    if (pitButton.textContent !== label) pitButton.textContent = label;
    pitButton.setAttribute('aria-disabled', String(pitOpening));
  }
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
    // Legends (Dom 2026-09-28, as the HUD names him): the label is the legend waiting there now, the one the player's next ladder fight at
    // that opponent meets (rankLevel), and the class sits small under it. The counts stay per class.
    const name = cell('td', ''), label = document.createElement('span'); name.append(label);
    if (row.id && isLegendOpponent(row.id)) { const cls = document.createElement('small'); cls.setAttribute('data-class', ''); label.textContent = legendForLevel(row.id, rankLevel()).name; cls.textContent = row.name; name.append(cls); }
    else label.textContent = row.name;
    const tr = document.createElement('tr'); tr.append(name, cell('td', row.fights), cell('td', row.wins), cell('td', row.losses)); table.append(tr);
  }
  element('scorecard').textContent = formatCard(trial);
  element('scorecard').hidden = !debugShown();
  element('menu-performance').hidden = !debugShown();   // the fps readout is a test instrument, not for players (Strategy 2026-10-01: it showed under the Stats screen)
  renderStats();
}
// The Stats screen (concept 04, Dom via Strategy 2026-10-01): the three career tiles, one card per opponent (his face, name, class and your
// W·L, or "Unfought"), and the gear you wear, all from the same scorecard and loot the table above reads.
function renderStats() {
  const all = totals(scorecard);
  element('stat-fights').textContent = String(all.fights); element('stat-wins').textContent = String(all.wins); element('stat-losses').textContent = String(all.losses);
  element('opponent-list').replaceChildren(...LADDER.map(({ id, name: title }) => {
    const line = scorecard.rows[id], fights = line?.fights ?? 0, li = document.createElement('li'), face = document.createElement('img'), text = document.createElement('div'), nm = document.createElement('strong'), cls = document.createElement('small'), tally = document.createElement('span');
    face.src = isLegendOpponent(id) ? `/${portraitPath(id, rankLevel())}` : `/game/img/${id}.webp`; face.alt = ''; face.width = face.height = 56; face.loading = 'lazy'; face.decoding = 'async';
    nm.textContent = isLegendOpponent(id) ? legendForLevel(id, rankLevel()).name : title; cls.textContent = title;
    tally.textContent = fights ? `${line?.wins ?? 0}\u00a0W · ${line?.losses ?? 0}\u00a0L` : 'Unfought'; tally.dataset.fought = String(fights > 0);
    text.append(nm, cls); li.append(face, text, tally); li.dataset.opponent = id; return li;
  }));
  const main = profile.loot?.equipped.main, shown = main ?? wornIds()[0];
  thumbFor(element('stats-gear-icon'), shown, 'stats-thumb');
  element('stats-gear-name').textContent = shown ? sentence(pieceName(shown)) : sentence(match.weapon);
  element('stats-gear-sub').textContent = shown ? `${rankText(shown)} · ${wornIds().length} worn` : 'Nothing worn yet';
}
// The journal's test tools (finisher override, damage numbers, tempo, combat debug) and the Sparring tab are for admins: on the live
// site only account.ts's admins roster reveals them, ?debug or not (Strategy 2026-09-29, before public beta); ?debug alone reveals them
// on a local build, where the release checks run.
const debugTools = debug && localBuild;
if (debugTools) { testTools.dataset.debug = 'true'; document.documentElement.dataset.duelTools = 'true'; }   // DUEL (the end-screen share row) follows the admin tools: shown for the roster and for ?debug on a local build, hidden for every other player until Dom opens duels
testTools.hidden = !debugTools;
element('sparring-tab').hidden = !debugTools && !SPARRING_FOR_ALL && !sparringParam(window.location?.search ?? '', CARRIED_WEAPONS);   // Sparring: admins (account.ts), ?debug on a local build, and a page a sparring link booted, until the flag opens it to everyone
function openJournal() {
  clearInput();
  renderScorecard(); renderLoot();
  syncPitNav();
  journal.showModal();
  enterGear();
}
element('journal-button').addEventListener('click', openJournal);
element('mobile-name').addEventListener('click', () => {
  journal.close();
  element('name-button').click();
});
element('close-journal').addEventListener('click', () => journal.close());
// The sheet's app nav (Fitting rail, Strategy 2026-10-01): Gear & pack is this sheet, Arena closes it back to the fight, The Pit has only
// the kill-screen door today (openGate), so it is live while that door is up and dimmed otherwise (a tap says "Win a fight to open the gate"); no screen of its own was invented.
function syncPitNav() {   // the Pit door is live only while the kill-screen door is up (pitButton); Stats' foot button says where it will go
  element('nav-pit').setAttribute('aria-disabled', String(pitButton.hidden));
  element('stats-return').textContent = pitButton.hidden ? 'Back to the arena' : 'Return to the Pit';
}
element('nav-gear').addEventListener('click', () => { element<HTMLInputElement>('journal-tab-profile').checked = true; });
element('stats-gear-view').addEventListener('click', () => { element<HTMLInputElement>('journal-tab-profile').checked = true; journal.scrollTop = 0; });
element('stats-return').addEventListener('click', () => element(pitButton.hidden ? 'nav-arena' : 'nav-pit').click());
element('nav-arena').addEventListener('click', () => journal.close());
let navNoteTimer: ReturnType<typeof setTimeout> | undefined;
element('nav-pit').addEventListener('click', () => {
  if (pitButton.hidden) { const note = element('nav-note'); note.hidden = false; clearTimeout(navNoteTimer); navNoteTimer = setTimeout(() => { note.hidden = true; }, 2000); return; }   // dimmed: say why, once, for 2 s
  journal.close(); openGate(true);
});
journal.addEventListener('close', clearInput);
journal.addEventListener('close', leaveGear);
window.addEventListener('resize', () => gear?.fit());
journal.addEventListener('scroll', () => gear?.fit());
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
let versusUp = false;   // the versus card is on screen: the fight waits behind it (declared here so paused() can read it before the card wires up)
const paused = () => invalidSparringPreview || !assetsReady || graphicsLost || !welcome.hidden || journal.open || document.hidden || versusUp;
const controls = createInput({
  element, window, paused,
  now: () => performance.now(),
  matchMedia: (query) => matchMedia(query),
  innerWidth: () => innerWidth,
  ready: () => assetsReady,
  practice: () => match.practice,
  quiet: () => feedback.quiet(),
});
// This fight's claim (loot-claims.ts): its encoded record, written to the outbox at the kill, and settled once by the player's last word
// on the loot (a take once the Undo line is gone, Leave it, nothing to offer) or by leaving the fight. Share waits on the post, at most
// CLAIM_WAIT_MS. The promise it returns resolves once the entry is final in storage, before the post, so a reload can wait on it.
let claim: Promise<string | null> | null = null, fightToken = 0;
function settleClaim(piece: string | null): Promise<void> {
  const pending = claim, token = fightToken;
  claim = null;
  if (!pending) return Promise.resolve();
  return pending.then((record) => {
    if (record && !finaliseClaim(storage, record, piece)) say(CLAIM_HELD);   // unwritten: held in memory, posted below and sent by claimOnHide
    const { db, userId } = session;
    // After a post the standing is read again before the rank redraws (flushThenStanding): the win moves from the outbox into pending.
    const posted = record && db && userId
      ? flushThenStanding(db, userId, storage, (error) => captureException(error), session.standing).then((next) => { if (session.userId === userId) { session.standing = next; saveStanding(storage, userId, next); } showRank(); })
      : Promise.resolve();
    void Promise.race([posted, new Promise((done) => setTimeout(done, CLAIM_WAIT_MS))]).then(() => { if (token === fightToken) showShare(); });
  });
}
// Closing or leaving the page is the last word too (loot-claims.ts claimOnHide): the win is sent now, not only if he comes back. A page
// kept in the back/forward cache may return to its loot choice, so it sends nothing; a tab merely hidden is not left.
window.addEventListener('pagehide', (event) => { if (!event.persisted && session.userId) claimOnHide(storage, session.userId, match.lastDrop, api, fetch); });
// A fight left mid-way still reports its frames (perf-beacon.ts): keepalive carries the request past the page.
window.addEventListener('pagehide', (event) => { feedback.dispose(); if (!event.persisted) sendBeacon(); });
// After any start (src/match.ts): the render pair on the new fighter, the death screen's panels away, the share line cleared.
function began() {
  nameOpponent();   // a rematch or a new rung can move the legend
  void settleClaim(null); fightToken++;   // a claim nothing settled yet ends here with no piece; its Share never shows on this fight
  clearInput(); state = previous = match.practice.fighter;
  if (walker) { walker = null; view.walkToGate(false); view.raiseGate(false); document.documentElement.classList.toggle('walking', false); }   // began() first runs before the view exists; no walk then
  gateAuto = gateHold = crossed = false; lastMoveAt = null; document.documentElement.classList.toggle('gate-fade', false);
  fightFrames = []; fightStartAt = firstExchangeAt = NaN; beaconSent = false;   // the fight-wide figures (readout and beacon) start over with the fight
  replayStill.hidden = true; hideLoot(); pendingLoot = null; match.frameEvents = []; sparEnd(false); dropClip(); pitOp++; say(null); updateHud();
}
function sparEnd(shown: boolean) {
  element('spar-change').hidden = element('spar-leave').hidden = !shown;
  if (shown) { opponentSelect.value = opponent.id; showDifficulty(); }   // CHANGE opens the tab on the fight just fought, whatever pick was left unstarted
}
// The next-fight command: the kill screen's Next / Rematch button and the Pit's gate (pitStage().gate) both run it. The gate used to
// press the button (resetButton.click(): GPT audit of e65a6d8, F6), tying the Pit's leave to a DOM element the HUD owns.
function nextFight(): void {
  if (invalidSparringPreview) { element<HTMLInputElement>('journal-tab-arena').checked = true; journal.showModal(); return; }
  if (clip) endClip(false);   // a clip re-plays the ended fight in place: put the kill screen back before Next/Rematch reads it
  watching = false;   // the player chose to fight: from here the AFK rule applies as in any live fight
  if (watchedLevel !== null) { watchedLevel = null; renderFightRank(); }   // his own rank again: the fight is his now
  if (match.replay || match.stalled) {   // PLAY NOW: the same warden (and the record's seed when there is one), live, practice only
    match.playNow(); banner(null); began(); view.recenter(); canvas.focus();
    return;
  }
  const settled = settleClaim(match.lastDrop);   // leaving the kill screen is the last word: a take still in its Undo line stands
  const next = match.nextRung();
  if (next) {
    profile.encounter = next.id; profile.pass = next.pass;
    persist();
    void settled.then(() => location.reload());
    return;
  } // the next fighter is another rig: a fresh page loads it
  // A career rematch fights the weapon equipped NOW. The rig holds one weapon's art for the page (scene.ts loads the equip file
  // once, from the weapon the page booted with), so a journal swap since boot takes the next-rung path: a fresh page, where the
  // simulation, the recorder and the rig agree by construction (GPT audit 2026-09-25, B: sim and record kept the boot weapon).
  if (!match.practiceOnly && ladderWeapon() !== match.weapon) { location.reload(); return; }
  // A rank look streams once per page (rank-look.ts): a win that moved the rung onto a different look file takes a fresh page, which
  // streams the new one (Auditer, #961), as the weapon swap above does. The dev flag and ?tier= pin the look, so they never reload.
  if (!rankLookFlag(location.search) && rankLookMoves(opponent.id, levelOf(shownTier()), levelOf(shownTier(tierAt(careerMarks()))))) { void settled.then(() => location.reload()); return; }
  // The ladder level follows the career count as the rung does: at boot the account's server figure may not have arrived (account.ts
  // refresh runs after load), so a signed-in page can boot on the device count; a career rematch re-reads it, before begin() gives the
  // recorder its level, so the fight never disagrees with the rank shown (Nightborn 2026-09-27), and never skips the dial (Lead, #901).
  if (match.mode === 'career' && !match.dummy) match.level = kit.level ?? rankLevel();
  // A rung that changes his loadout (moves.ts LOADOUT_FROM) needs his rig re-armed, as a new ladder weapon does above: reload.
  if (loadoutMoved()) { location.reload(); return; }
  match.tested = kitTested(); sayTested();   // a win may have moved the rank off a kept Dev level
  match.rematch();   // a career fight stays career
  metAt = tierAt(careerMarks()); view.setTier(shownTier());   // a win may have moved the rung: he comes back dressed for it
  view.setPlayerTier(tierAt(careerMarks()));   // his own weapon's shape at his own rung (the HUD's), whatever ?tier= pins on the opponent
  began();
  view.recenter();
  canvas.focus();
}
resetButton.addEventListener('click', nextFight);
// One tap (Dom 2026-09-28, from his phone: "2 clicks instead of 1"): the end screen shows SHARE (the kill link) and CLIP at once, in
// the two slots left of Rematch. A browser that cannot record a canvas shows SHARE alone.
function showShare() { duelButton.hidden = false; shareLink.hidden = false; clipButton.hidden = !clipSupported(); clipState('idle'); }
shareLink.addEventListener('click', () => { void shareFight(); });
// DUEL (Strategy 2026-10-02): the same page with ?duel=new, where the lobby mints the room and the challenger's wait offers the guest's link to the share sheet.
duelButton.addEventListener('click', () => { const u = new URL(location.href); u.search = ''; u.hash = ''; if (u.pathname.startsWith('/s/')) u.pathname = '/'; u.searchParams.set('duel', 'new'); location.assign(u.href); });
// The clip: the record's last CLIP_LEAD seconds and its finish re-played on the arena canvas (match.startClip: the kill screen's state is kept and put
// back), each rendered frame copied into a 720x1280 recording with the game audio (src/clip.ts), then the phone's share sheet.
// One scene frame on a fresh fighter first: scene.ts clears the kill's wounds, blood and severed head on a return to full health.
function clipState(state: 'idle' | 'recording' | 'ready', seconds = CLIP_SECONDS) {
  clipButton.dataset.state = state; clipSub.hidden = state !== 'recording';
  document.documentElement.classList.toggle('clip-ready', state === 'ready');   // a made clip waiting for SEND: LINK + SEND stay live through the tour (style.css)
  clipLabel.textContent = state === 'recording' ? `${seconds} s` : state === 'ready' ? 'SEND' : 'CLIP';
  clipButton.setAttribute('aria-label', state === 'recording' ? 'Stop the clip' : state === 'ready' ? 'Send the clip' : 'Share a clip of this fight');
}
clipButton.addEventListener('click', () => {
  if (clip) { endClip(false); say(null); return; }   // a second tap while it records stops it, and nothing is kept
  if (clipFile) { void sendClip(); return; }
  const record = match.lastRecord;
  if (!record || match.replay) return;
  feedback.unlock();
  let recording: ClipRecording;
  try { recording = recordClip(canvas, feedback.stream()); } catch { feedback.untap(); say("This browser can't record a clip; LINK sends the link."); return; }
  const finisher = view.previousFinisher();
  clipEpoch++;   // a file still being made for an earlier clip is dropped: this one replaces it
  const saved = match.startClip(record, clipStartTick(record.ticks));
  const fresh = underRecord(record, () => initialPractice(record.seed, opponentAt(opponent, record.level), record.weapon, record.skill ?? null, recordSpecials(record)));   // the level's body, as match.startClip replays it (on the record's math)
  clip = { recording, saved, fresh, finisher, started: performance.now(), killedAt: null, completeAt: null, title: shareTitle('Frankendom') };   // the title of the fight it records
  state = previous = fresh.fighter; hitStop = 0; accumulator = 0;   // the loot panel stays: it is DOM, never in the clip, and the offer must outlive it
  clipState('recording'); say(null); updateHud();
});
// After each render: the frame into the recording, the countdown, and the stop once the finish has played (clip.ts clipEnded).
function clipFrame(now: number) {
  if (!clip) return;
  if (clip.fresh) { clip.fresh = null; view.setPreviousFinisher(clip.finisher); state = previous = match.practice.fighter; return; }   // the finisher resolves as the fight's own did
  clip.recording.draw();
  clipState('recording', Math.max(1, Math.ceil(CLIP_SECONDS - (now - clip.started) / 1000)));
  if (clip.killedAt !== null && clip.completeAt === null && view.finishPhase().complete) clip.completeAt = now;   // read after the render that latched it
  if (clipEnded(clip.killedAt, clip.completeAt, now)) endClip(true);
}
function endClip(keep: boolean) {
  const current = clip;
  if (!current) return;
  clip = null; feedback.untap();
  match.endClip(current.saved);
  state = previous = match.practice.fighter; hitStop = 0; accumulator = 0;
  clipState('idle'); updateHud();
  if (!keep) { current.recording.cancel(); return; }
  say('Making the clip…');
  const epoch = clipEpoch;
  void current.recording.stop().then((blob) => {
    if (epoch !== clipEpoch) return;   // the next fight began while the file was made: it is dropped with the ended fight
    if (!blob) { say("Couldn't make the clip, try again."); return; }
    clipFile = new File([blob], clipFileName(current.recording.type, opponent.id), { type: blob.type }); clipTitle = current.title;
    element('debug').dataset.clip = `${current.recording.type} ${blob.size}`;   // the phone test's receipt (?debug=1 shows it in the status line)
    clipState('ready'); say(debugShown() ? `Clip: ${current.recording.type}, ${(blob.size / 1e6).toFixed(1)} MB` : null);
    void sendClip();
  });
}
// A fight start drops a clip mid-recording without putting anything back (the new fight has replaced it) and forgets a made one.
function dropClip() {
  clipEpoch++;
  if (clip) { clip.recording.cancel(); feedback.untap(); clip = null; }
  clipFile = null; duelButton.hidden = shareLink.hidden = clipButton.hidden = true; clipState('idle');
}
// The share sheet needs a fresh tap on most phones (transient activation lapses during the ~10 s): tried at once, and on refusal
// the slot reads SEND until the player taps it. No share sheet for files: the clip downloads.
// The shared fight is the ended one (match.lastRecord), never whatever runs now: a won record's share says who fell at ITS level
// ("I beat Grendel · Frankendom"); any other outcome keeps the plain title.
const shareTitle = (plain: string) => {
  const record = match.lastRecord;
  return record?.outcome === 'killed' && isLegendOpponent(record.opponent) ? `I beat ${legendForLevel(record.opponent, record.level).name} · Frankendom` : plain;
};
async function sendClip() {
  const file = clipFile;
  if (!file) return;
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: clipTitle }); clipFile = null; clipState('idle'); say('Shared.'); }
    catch (error) { if ((error as { name?: string })?.name !== 'NotAllowedError') { clipFile = null; clipState('idle'); } }   // dismissed: done; refused for want of a tap: SEND stays
    return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file); link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  clipFile = null; clipState('idle'); say('Clip saved.');
}
async function shareFight() {
  // Read the fight at the press, once: a Rematch or a kill link that lands during the awaits below runs `begin()`, which nulls
  // match.lastRecord and match.lastDrop, so the share is of the fight that was pressed and its record id
  // goes onto the piece THAT fight dropped, never onto a later fight's take (GPT audit 2026-09-24, finding B).
  const record = match.lastRecord, drop = match.lastDrop, userId = session?.userId ?? null;
  if (!record || match.replay) return;
  shareLink.disabled = true; say('Checking the fight…');
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
      url = shortLink(location.origin, id, isLegendOpponent(record.opponent) ? portraitKey(record.opponent, record.level) : undefined);
      if (userId && session?.userId === userId && drop && profile.loot) { profile.loot = recordTaken(profile.loot, drop, id); persist(); }   // the same account still signed in: the take keeps its link
    } catch { say("Couldn't make a link, try again."); return; }
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav?.share) { try { await nav.share({ url, title: shareTitle('Frankendom: watch this fight') }); say('Shared.'); return; } catch { /* the sheet was dismissed: fall through to the clipboard */ } }
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(url); say('Link copied.'); return; }
    say(url);
  } catch (error) { say(`Could not share: ${error instanceof Error ? error.message : String(error)}`); }
  finally { shareLink.disabled = false; }
}
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
  watchedLevel = record.level; renderFightRank();
  showDifficulty();
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
// The daily warden was removed (Dom 2026-09-29, "way over-complicated"): an old `?daily=1` link boots the ladder like any page. The server's
// daily endpoint and tables are left in place, unused by this client.
// Sparring (src/sparring.ts, Dom 2026-09-26): `?spar=1` boots the picked kit on the `?opponent=` rig for this fight only. The match's
// 'sparring' mode keeps no recorder and awards nothing; the page skips the AFK mark and the loot offer, and never saves the kit.
// `?special=hades` (special-look.ts) is a sparring page too: its warden at his rank's level, the longsword, no move, Special Moves on.
const sparKit = replayText || sharedId || invalidSparringPreview ? null : sparPreview.kit ?? (specialTest ? { weapon: CARRIED_WEAPONS.includes('longsword') ? 'longsword' as const : CARRIED_WEAPONS[0], difficulty: SPECIAL_TESTS[specialTest].level, skill: null } : null);
if (sparKit) {
  welcome.hidden = true; watching = false;
  match.startSparring(sparKit, specialTest ? { first: SPECIAL_TESTS[specialTest].first, level: SPECIAL_TESTS[specialTest].level } : sparPreview.off ? { first: 0, enabled: false } : null, sparPreview.selection);
  if (!sparPreview.selection && specialCue) feedback.want(specialCue);
  for (const id of match.specialIdentity.presets ?? []) { const cue = specialCueFor(id); if (cue) feedback.want(cue); }
  // The stills harness reads where each side stands in its special (special-look.ts specialStage); this test page only.
  if (specialTest || sparPreview.selection) Object.assign(globalThis, { __special: () => ({
    tick: match.practice.duel.tick, mode: match.mode, recorder: !!match.recorder, practiceOnly: match.practiceOnly, stages: match.practice.duel.fighters.map((f) => specialStage(f)), presets: match.specialIdentity.presets,
    fighters: match.practice.duel.fighters.map(f => ({ skill: f.skill, weapon: f.weapon, rig: f.rig, scale: f.scale, specialName: f.specialName, specialShare: f.specialShare, skillCooldown: f.skillCooldown, phase: f.phase, health: f.health, maxHealth: f.maxHealth, x: f.body.x, z: f.body.z })),
    events: match.fightLog.map(event => ({ ...event })),
  }) });
  banner(specialTest ? 'Special move test, no rewards' : match.dummy ? 'Sparring the dummy, no rewards' : 'Sparring, no rewards'); began();
}
// A `?spar=1` link whose weapon, level or skill this build does not know boots the ordinary fight, and says so (Lead sweep [4], 2026-09-26):
// it used to start a career fight in silence, which read as a sparring fight that awarded marks. No kit changes; the banner is the whole of it.
else if (invalidSparringPreview) banner('That special move test link is invalid. Choose valid Sparring picks and press Start sparring.', true);   // paused until a corrected link starts; never silently becomes a career fight
else if (!replayText && !sharedId && sparringAsked(window.location?.search ?? '')) banner("That sparring link isn't valid; this is a normal fight", true);   // legacy ordinary Sparring link behavior
// Live PvP (src/net/, docs/duel-architecture.md §7), the one switch: `?duel=new` opens a challenge and shows the link to send; `?duel=<token>`
// joins one. The net code loads only here, by dynamic import. Match's 'pvp' mode records nothing and awards nothing (src/net/rewards.ts);
// the page skips the AFK mark, the perf beacon and the loot offer. The peer is drawn on this page's opponent rig for now.
const duelAsked = !invalidSparringPreview && !replayText && !sharedId && !sparKit ? /[?&]duel=([\w.-]{3,200})/.exec(window.location?.search ?? '')?.[1] : undefined;
// The peer is drawn on the hero's rig with the kit his handshake names (scene.ts `peerKit`), so the rigs load behind the loading card until
// the lobby has that kit (or null: the duel ended first and the page loads the ordinary rigs). A page with no `?duel=` has none of this.
const duelWait = element('duel-wait'), duelLink = element('duel-link') as unknown as HTMLInputElement, duelCopy = element('duel-copy'), duelSend = element('duel-send');
const DUEL_TEXT = '1v1 me in Frankendom ⚔️';   // the challenge's share text; deploy/frankendom.com.conf gives a duel link the same og:title
// Cancel leaves the duel for the ordinary game: the same page with no ?duel= (the room lapses on the relay by itself).
element('duel-cancel').addEventListener('click', () => { location.assign(location.pathname || '/'); });
duelCopy.addEventListener('click', () => {
  const done = () => { duelCopy.textContent = 'Copied'; };
  if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(duelLink.value).then(done, () => duelLink.select());   // refused (no permission, an old webview): the link is selected to copy by hand
  else duelLink.select();
});
let giveKit: (kit: { weapon: WeaponId; gear?: readonly string[] } | null) => void = () => {};
const peerKit = duelAsked ? new Promise<{ weapon: WeaponId; gear?: readonly string[] } | null>((resolve) => { giveKit = resolve; }) : undefined;
if (duelAsked) {
  welcome.hidden = true; watching = false;
  for (const cue of ['joined', 'go', 'win', 'loss'] as const) feedback.wantDuel(cue);   // fetched after the first tap makes the audio context
  banner('Setting up the duel');
  void import('./net/lobby.ts').then(({ openDuel }) => openDuel(duelAsked, { weapon: match.weapon, skill: match.skill, gear: wornIds() }, {
    say: (text, stale) => banner(text, stale),
    link: (url) => {
      say(url); void (typeof navigator === 'undefined' ? undefined : navigator.clipboard?.writeText(url))?.then(() => banner('Challenge link copied: send it to your opponent'), () => undefined);
      duelLink.value = url; duelWait.hidden = false;
      if (typeof navigator !== 'undefined' && navigator.share) { duelSend.hidden = false; duelSend.onclick = () => { void navigator.share({ text: DUEL_TEXT, url }).catch(() => undefined); }; void navigator.share({ text: DUEL_TEXT, url }).catch(() => undefined); }   // the sheet may be refused here (no fresh tap after the page load): the wait panel's Send is the tap   // the challenger's wait: what is happening, the link again, copy, and a way out
    },
    start: (driver) => { match.startPvp(driver); began(); feedback.duel('go'); },   // go only: there is no 3-2-1 window (Strategy 2026-10-02)
    ended: (result) => {   // the lobby cues (Audio #1288): a settled finish by the fight's winner, a forfeit by who stayed, no contest silent
      if (result === 'no-contest') return;
      feedback.duel(result === 'forfeit-win' || (result === 'finished' && wonFight(match.practice.finish)) ? 'win' : 'loss');
    },
    peerKit: (kit) => { duelWait.hidden = true; if (kit && duelAsked === 'new') feedback.duel('joined'); giveKit(kit); },   // the guest is here: the wait panel goes, the challenger hears him arrive   // the guest is here: the wait panel goes
    ready: () => assetsReady,
    me: () => ({ name: profile.name, level: rankLevel() }),
    api, revision,
    // The account mounts on idle for a device that signed in before (account-entry.ts): wait for it up to ten seconds, then ask it.
    session: async () => {
      for (let i = 0; i < 40 && api && !session.db; i++) await new Promise((r) => setTimeout(r, 250));
      return (await session.db?.auth.getSession())?.data.session?.access_token ?? null;
    },
  }), () => banner('The duel could not load; reload the page', true));
}
{
  const fill = (id: string, rows: [string, string][], value: string) => {
    const select = element<HTMLSelectElement>(id);
    for (const [v, label] of rows) { const option = document.createElement('option') as HTMLOptionElement; option.value = v; option.textContent = label; select.append(option); }
    select.value = value;
  };
  fill('spar-weapon', CARRIED_WEAPONS.map((w): [string, string] => [w, w]), match.weapon);
  showPlayerSpecial();
  // Start sparring carries exactly what the tab shows: the one Opponent picker, the one Difficulty control, and the kit (path C, 2026-09-26).
  element('spar-start').addEventListener('click', () => {
    const value = (id: string) => element<HTMLSelectElement>(id).value;
    const player = playerSparringChoice(playerSpecialSelect.value);
    const special = specialSelect.value === 'none' ? null : Object.hasOwn(SPECIAL_TESTS, specialSelect.value) ? specialSelect.value as SpecialTest : undefined;
    const kit: SparringKit = { weapon: value('spar-weapon') as typeof match.weapon, difficulty: difficultySelect.value as SparringKit['difficulty'], skill: player?.skill ?? null };
    if (!player || special === undefined || (special && (kit.difficulty === 'dummy' || SPECIAL_TESTS[special].opponent !== opponentSelect.value))) {
      banner('Choose valid special moves for each fighter before Start sparring.', true); return;
    }
    const link = new URL(sparringLink(opponentSelect.value, kit, special, player.special), location.origin);
    if (resolveSparringPreview(link.search, CARRIED_WEAPONS).invalid || !sparringParam(link.search, CARRIED_WEAPONS)) {
      banner('Choose a valid Sparring kit before Start sparring.', true); return;
    }
    link.searchParams.set('arena', ['1', 'a', 'b', 'c', 'd'].includes(arenaSelect.value) ? arenaSelect.value : 'ladder');   // explicit Ladder beats a stale stored override without saving a pick
    if (FINISHER_OPTIONS.some(([id]) => id === finisherSelect.value)) link.searchParams.set('finisher', finisherSelect.value);
    location.assign(link.pathname + link.search);
  });
  // The sparring kill screen: Rematch (the reset button, same kit), Change (the picker) and Leave (back to the career fight).
  element('spar-change').addEventListener('click', () => { element<HTMLInputElement>('journal-tab-arena').checked = true; showDifficulty(); clearInput(); journal.showModal(); });
  element('spar-leave').addEventListener('click', () => { location.assign('/'); });
}
showDifficulty();   // the Sparring tab opens on the fight's own level (a sparring link's, or the ladder's)
showSparringSpecial(sparPreview.off ? null : specialTest ?? undefined);
element('debug-mode').addEventListener('click', () => {
  debug = !debug; showDifficulty();
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
// The legend's painted face (versus card B4, Dom via Strategy 2026-09-28): a medallion beside the name, the name block at the top and the
// backstory raised (style.css .versus[data-portrait]). No face file (most rungs until Character's set lands) keeps today's card. The card
// waits for the face to settle either way, so the layout never jumps under the player; it only shows while the rigs are still downloading
// (not ready, not failed), so a late still or face never covers the retry notice.
const versusPortrait = element<HTMLImageElement>('versus-portrait');
let stillIn = false, faceSettled = true;
const showVersus = () => { if (stillIn && faceSettled && !assetsReady && !artFailed) { versus.hidden = false; versusUp = true; updateHud(); } };
versusStill.addEventListener('error', () => { versus.hidden = true; versusUp = false; });
// A face that neither loads nor fails (a stalled request) never holds the card: 2 s after the still (Lead, on the Auditer's N1), it shows without one, and a
// face arriving after that is left out (no layout jump under the player).
const FACE_WAIT_MS = 2000;
versusStill.addEventListener('load', () => { stillIn = true; if (!faceSettled) setTimeout(() => { faceSettled = true; showVersus(); }, FACE_WAIT_MS); showVersus(); });
versusPortrait.addEventListener('load', () => { if (faceSettled) return; versusPortrait.hidden = false; versus.dataset.portrait = 'true'; faceSettled = true; showVersus(); });
versusPortrait.addEventListener('error', () => { faceSettled = true; showVersus(); });
{
  // Legend name large, "the Pitborn · Champion" small, then the one-line source and backstory (a 'generic' source is not shown).
  const legend = legendNow();
  if (legend && isLegendOpponent(opponent.id)) { faceSettled = false; versusPortrait.src = portraitPath(opponent.id, match.level); }   // before the still, so it starts first
  element('versus-foe').textContent = legend?.name ?? bareName(opponent.id);
  element('versus-kind').textContent = legend ? `the ${bareName(opponent.id)} · ${tierAt(match.level - 1)}` : '';
  element('versus-lore').textContent = legend ? (legend.source === 'generic' ? legend.backstory : `${legend.source}. ${legend.backstory}`) : '';
}
versusStill.src = `versus/${opponent.id}.webp`;   // document-relative: the page is served at the site root (public/versus/)
let view: ReturnType<typeof createScene>, artFailed = false;
// The Pit (docs/pit-design.md, src/pit-coordinator.ts): after a career fight the kill screen offers Enter the Pit (a win) or Recover (a
// defeat). `pit` is the one switch frame() reads: while it is set the Pit draws the frame and nothing of the fight runs. `?look=pit` is the
// look test: once the art is in, the room replaces the fight on a fixed camera and no fight runs on the page.
const pitLoot = () => profile.loot ?? emptyLoot();
// The skull wall's kills and the record board (src/pit/skulls.ts, loaded with the Pit's chunk): the last known data, refreshed from Supabase on each
// Pit visit; the `&skulls=demo` look never touches the network. skullsNow / recordNow are undefined until the module is in.
let skullMod: SkullsModule | null = null, feed: ReturnType<SkullsModule['createFeed']> | null = null, championCache: Champion[] | null = null;   // set by a fetch; until one has answered the fallback is recomputed from the loot each time, so a fresh win shows
function pitSkulls() {
  const demo = skullsDemoFrom(window.location?.search ?? '');
  void loadSkulls().then((m) => { skullMod = m; }, () => undefined);
  // The legend's own name for a kill (legends.ts), else the opponent's class name; this file may read legends.ts, src/pit/ may not.
  const nameOf = (id: string, rank: number | null): string => { try { return isLegendOpponent(id) ? (rank ? legendAt(id, rank).name : ROSTER[id].name) : (isOpponentId(id) ? ROSTER[id].name : id); } catch { return id; } };
  const theFeed = (m: SkullsModule) => feed ??= m.createFeed({ db: () => session.db, userId: () => session.userId, loot: pitLoot, marks: careerMarks, nameOf });
  return {
    skullsNow: (): Kills | undefined => (!skullMod ? undefined : demo ? skullMod.demoKills(nameOf) : theFeed(skullMod).killsNow()),
    skulls: async (): Promise<Kills> => {
      const m = skullMod ??= await loadSkulls();
      return demo ? m.demoKills(nameOf) : theFeed(m).kills();
    },
    recordNow: (): PitRecord | undefined => (!skullMod ? undefined : demo ? skullMod.demoRecord() : theFeed(skullMod).recordNow()),
    record: async (): Promise<PitRecord> => {
      const m = skullMod ??= await loadSkulls();
      return demo ? m.demoRecord() : theFeed(m).record();
    },
    championsNow: (): Champion[] | undefined => (!skullMod ? undefined : demo ? skullMod.demoChampions() : (championCache ?? [])),
    champions: async (): Promise<Champion[]> => {
      const m = skullMod ??= await loadSkulls();
      if (demo) return m.demoChampions();
      championCache = await m.fetchChampions(session.db);
      return championCache;
    },
  };
}
function pitStage(): Stage {
  const look = pitStoneFrom(window.location?.search ?? '');   // the Pit's stone: the full set by default (look-flag.ts)
  return {
    ...view.pitStage(pitLoot),
    ...(look ? { look } : {}),
    ...pitOpenLook(window.location?.search ?? ''),   // the cage by default (look-flag.ts)
    ...pitSkulls(),
    pieceName: (id) => { try { return pieceName(id as LootId); } catch { return id; } },
    readMove: () => { const intent = controls.intent(); return { x: intent.x, z: intent.z }; },
    readLook: () => { const drag = { ...pitDrag }; pitDrag.dx = pitDrag.dy = 0; return drag; },
    readTap: () => { const tap = pitTap; pitTap = null; return tap; },
    gateSound: () => feedback.gate(),
    crowdSound: (cue) => feedback.crowd(cue),
    openJournal: () => { if (journal.open) return; element<HTMLInputElement>('journal-tab-profile').checked = true; openJournal(); },   // the rack: the loadout sheet, on Gear & pack
    rackRows: (ids) => (ids ?? pitLoot().owned).map(rackRow),
    trophyLine: (id) => {
      const taken = pitLoot().taken?.[id], from = id.split('.')[0]!, legend = taken?.tier && isLegendOpponent(from) ? legendAt(from, taken.tier) : null;
      const name = pieceName(id);
      return legend ? `${name[0]!.toUpperCase()}${name.slice(1)} · taken from ${legend.name}, rank ${taken!.tier}` : `${name[0]!.toUpperCase()}${name.slice(1)}`;
    },
    // The gate is the kill screen's own Next / Rematch: leave the Pit, then run the next-fight command (it settles a take, reloads for a
    // new rung or rematches here). Its label is the one the kill screen showed.
    // After a win the press loads the next fighter's page: this page fades to the gate's light first and the fresh one starts on it
    // (gate-light.ts), so no black shows between them. Any other press (a rematch in place), or a store that refuses the flag: as before.
    gate: () => ({ label: resetButton.textContent || 'Rematch', go: () => {
      const leave = () => { closePit(); nextFight(); };
      if (gateLeaving) return;   // the light is already up: one press, one reload
      if (!match.nextRung() || !armGateLight(document.documentElement, () => sessionStorage)) return leave();
      gateLeaving = true;
      setTimeout(leave, GATE_LIGHT_IN_MS);
      // a reload that never came does not leave him in the light
      setTimeout(() => { gateLeaving = false; clearGateLight(document.documentElement, () => sessionStorage); }, GATE_LIGHT_MAX_MS);
    } }),
    // The skull wall's card for a slot key `<opponent>-<rank>` (legends.ts): the legend, its source and story, the portrait the kill
    // screen shows, and whether this fighter has beaten it (loot.defeats, Backend #1156; absent = unbeaten).
    legend: (key) => {
      const at = key.lastIndexOf('-'), id = key.slice(0, at), rank = Number(key.slice(at + 1));
      if (!isLegendOpponent(id) || !Number.isInteger(rank) || rank < 1 || rank > 10) return null;
      const l = legendAt(id, rank), beaten = ((pitLoot() as Loot & { defeats?: string[] }).defeats ?? []).includes(key);
      return { name: l.name, opponent: ROSTER[id].name, rank, source: l.source, backstory: l.backstory, portrait: `legends/${key}.webp`, beaten };
    },
  };
}
// While he is in the Pit after a win, the next fighter's rig (and, off the phone tier, his rank look) is fetched into the HTTP cache at low
// priority, so the fresh page behind the gate finds them there. Bytes only; nothing is decoded here.
function prefetchNextRung() {
  const next = match.nextRung();
  if (!next || nextRungWarmed) return;
  nextRungWarmed = true;
  void prefetchFiles(view.rungFiles(next.id, shownTier(tierAt(careerMarks()))));
}
function closePit() {
  pit?.leave(); pit = undefined;
  delete document.body.dataset.pit;
  canvas.focus();
}
// `?look=pit-glow` (the Pit look test, Dom 2026-10-04: "1 room I can move around"): the page opens straight into the walkable Pit, no fight first.
function walkPitGlow() {
  if (pitLook || pit || !pitGlowFrom(window.location.search) || document.body.dataset.pit) return;
  void openPit(pitStage(), 'win').then((opened) => { pit = opened; if (opened) document.body.dataset.pit = 'on'; }, (error: unknown) => captureException(error, { tags: { pit: 'glow' } }));
}
function showPitLook() {
  if (!pitLook || document.body.dataset.pit) return;   // once: a retried load reports ready again
  document.body.dataset.pit = 'look';   // style.css: the fight's HUD steps aside
  const stage: Stage = { ...view.pitStage(pitLoot), ...(pitStoneFrom(window.location.search) ? { look: pitStoneFrom(window.location.search) } : {}), ...pitOpenLook(window.location.search), ...(skullsDemoFrom(window.location.search) ? pitSkulls() : {}) };   // Web's stone look test
  const lift = Number(/[?&]lift=([\d.]+)/.exec(location.search)?.[1] ?? 0);   // `?look=pit&lift=0.5`: the gate's bars held half way up (the look stills)
  pitLooking = openPit(stage, 'win', pitLook, () => true, 0, lift).then((opened) => { pit = opened; }, (error: unknown) => {
    delete document.body.dataset.pit;
    captureException(error, { tags: { pit: 'look' } });
  });
}
// Honest loading (docs/pit-design.md §4): the chunk was prefetched at the kill; a tap before it lands says so on the button and the kill
// screen stays live. A failure says so where the share status sits and changes nothing; the next tap tries again.
// Opening the gate (docs/pit-design.md §9). On foot after a win: the chunk first (he holds at the line, the button says so), then a fade
// to black while he keeps walking, then the room, where he arrives at the pace he had. `auto`: a tap on the gate or the shortcut walks him
// the last metres himself. A defeat's Recover, and a win before the walk starts, open as before: no walk, no fade.
const GATE_FADE_MS = 1000;
function openGate(auto: boolean) {
  const finish = match.practice.finish;
  if (pit || pitOpening || !finish) return;
  if (clip) endClip(false);
  pitOpening = true; say(null); updateHud();
  const op = ++pitOp;   // a fight that starts before the chunk lands (Rematch is live meanwhile) bumps it: the Pit then never opens
  const entry = finish.victim === 1 && !finish.draw ? 'win' : 'defeat', onFoot = !!walker && entry === 'win';
  if (onFoot) { gateAuto = auto; gateHold = !auto; }
  const winch = onFoot ? (view.raiseGate(true), feedback.gate()) : undefined;   // the bars rise on the winch; the fade waits for them, the chunk or both, whichever is later
  const barsUp = onFoot ? new Promise<void>((done) => setTimeout(done, RISE_MS)) : undefined;
  const fade = () => new Promise<void>((done) => { if (!onFoot || op !== pitOp) return done(); gateHold = false; gateAuto = true; document.documentElement.classList.toggle('gate-fade', true); setTimeout(done, GATE_FADE_MS); });
  feedback.warmGate();   // the gate winch's file, fetched as the Pit opens (the context exists: he has played)
  Promise.all([loadPit(), barsUp]).then(fade).then(() => openPit(pitStage(), entry, undefined, () => op === pitOp, walker?.speed ?? 0)).then((opened) => {
    if (!opened) return;
    pit = opened; document.body.dataset.pit = 'on';
    void opened.ready.then(prefetchNextRung, () => undefined);   // once the room has what it needs, never ahead of it
    if (walker) { walker = null; view.walkToGate(false); document.documentElement.classList.toggle('walking', false); }
    document.documentElement.classList.toggle('gate-fade', false);   // the room fades in over the same second
  }, (error: unknown) => {
    if (op === pitOp) say('The Pit could not open, fight on.');
    view.raiseGate(false);
    document.documentElement.classList.toggle('gate-fade', false);
    captureException(error, { tags: { pit: 'open' } });
  }).finally(() => { winch?.stop(); pitOpening = false; gateAuto = gateHold = false; updateHud(); });
}
pitButton.addEventListener('click', () => openGate(true));
// A tap on the gate itself while he walks (a tap, not a drag): the gate's mouth on screen, within a thumb of it.
let tapX = 0, tapY = 0;
canvas.addEventListener('pointerdown', (event) => { tapX = event.clientX; tapY = event.clientY; });
canvas.addEventListener('pointerup', (event) => {
  if (!walker || pit || Math.hypot(event.clientX - tapX, event.clientY - tapY) > 8) return;
  const at = view.project([Math.sin(LAYOUT.gate) * LAYOUT.wall.inner, 1.3, Math.cos(LAYOUT.gate) * LAYOUT.wall.inner]);
  if (at && Math.hypot(at[0] - event.clientX, at[1] - event.clientY) < 70) openGate(true);
});
window.addEventListener('pagehide', (event) => { if (!event.persisted) { pitOp++; disposePit(); } });
// ?debug only (scripts/pit-browser-check.mjs): open and close the Pit without a fight first, and read the GPU's live counts, so the
// memory row can prove repeated visits allocate nothing (docs/pit-design.md §5).
if (debug) Object.defineProperty(globalThis, '__pit', { configurable: true, value: {
  // open() settles once the room's pieces are placed (Pit.ready), so a memory sample after it has drawn every geometry the visit will
  // draw: loot.glb lands late on a slow box, and a sample before it counted its pieces at whichever visit they first drew (a +9 step).
  open: (entry: 'win' | 'defeat') => openPit(pitStage(), entry).then(async (opened) => { pit = opened; if (opened) { document.body.dataset.pit = 'on'; await opened.ready; await opened.extras; } }),
  close: closePit,
  // The open room's latest stock and props are placed (the look stills wait on it: GPT's GLBs decode slowly on a cold SwiftShader page).
  ready: async () => { await pitLooking; await pit?.ready; await pit?.extras; },
  // The browser tap test: the same function a landed tap runs for that pick id (pit.ts choose), false with no Pit open; sheet() is the bottom sheet's visible text.
  tap: (id: string) => pit?.pick(id) ?? false,
  sheet: () => { const el = document.getElementById('pit-ui'); return el && !el.hidden ? el.innerText : ''; },
  memory: () => ({ ...view.renderer.info.memory, programs: view.renderer.info.programs?.length ?? 0 }),
} });
exposeDebugView(() => view);   // ?debug only: globalThis.__view for the measurement harnesses (quality.ts); inert otherwise
// His rig carries one loadout per page (scene.ts: the Centurion's gladius + scutum from Legionary). A level that moves it, a rematch's rung
// or a Dev level pick (row 22, 2026-09-28: a live pick to 46 fought the gladius with the trident drawn), reloads, as a weapon pick does.
function loadoutMoved() { const armedWith = view?.opponentWeapon(); return !!armedWith && opponentAt(opponent, match.level).weapon !== armedWith; }
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
      if (kind === 'ready') { showPitLook(); walkPitGlow(); }
    },
    opponent.id,
    requestedArena ?? (storedArena || undefined),   // explicit 'ladder' is arenaFor's default band, overriding any stale session pick; standalone precedence unchanged
    weaponSettled.then(() => match.weapon, () => match.weapon),
    (drawn) => {   // an equip file that failed: fight on the longsword the rig carries, and say so (Sentry has the report, tag equip)
      const replay = !!match.replay, asked = match.weapon;
      if (!match.rearm(drawn)) return;
      began();
      if (replay) { banner('This fight cannot be played here', true); return; }
      equipLine = equipNotice(asked, drawn); sayEquip();
    },
    weaponSettled.then(() => match.level, () => match.level),   // his loadout at the level he is met at (the Centurion's gladius from Legionary)
    peerKit,
  );
  // His kit at the rung he is met at (or the Dev level's, shownTier); the player's weapon shape at his own rung (the HUD's), whatever ?tier=
  // pins on the opponent; the worn loot goes on the rig when the pieces land, and the fight never waits for them. A kill link dresses from
  // its record instead (share-store.ts dressFor), once the record has settled, so the viewer's own rank and loot never show on it.
  const dress = () => {
    metAt = tierAt(careerMarks());
    const look = dressFor(match.replay ? match.level : null, { tier: shownTier(), playerTier: tierAt(careerMarks()), worn: wornIds(), wornTiers: wornTiers() });
    view.setTier(lookTier ?? look.tier); view.setPlayerTier(look.playerTier); view.wear(look.worn, look.wornTiers);
  };
  if (watching) void weaponSettled.then(dress, dress); else dress();
  applySignature();   // the signature preview's pick (off unless the test tools are open)
  if (sparFinisher) view.setFinisherOverride(sparFinisher);
  // The admins roster opens the tools after load (account.ts): apply the pick again whenever they open or close.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { applySignature(); showDifficulty(); }).observe(element('test-tools'), { attributes: true, attributeFilter: ['hidden'] });
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
    lowered(() => view.restoreGraphics());
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
  orbitX = pressX = event.clientX;
  orbitY = pressY = event.clientY;
  canvas.setPointerCapture(orbitId);
});
// While the Pit shows, the same drag turns the Pit's camera instead (Stage.readLook, drained once a frame): the arena's yaw stays put.
// A press that never became a drag (under TAP_PX from where it landed) and lifts on the canvas is a tap for the Pit's picker
// (Stage.readTap, in NDC, drained once a frame); the fight has no use for one.
const pitDrag = { dx: 0, dy: 0 }, TAP_PX = 8;
let pressX = 0, pressY = 0, pitTap: { x: number; y: number } | null = null;
canvas.addEventListener('pointermove', (event) => {
  if (orbitId === event.pointerId && pit) {
    pitDrag.dx += event.clientX - orbitX; pitDrag.dy += event.clientY - orbitY;
    orbitX = event.clientX; orbitY = event.clientY;
  } else if (orbitId === event.pointerId && !locked && !paused()) {
    view.orbit(event.clientX - orbitX, event.clientY - orbitY);
    orbitX = event.clientX;
    orbitY = event.clientY;
  }
});
canvas.addEventListener('pointerup', (event) => {
  if (event.pointerId !== orbitId || !pit || Math.hypot(event.clientX - pressX, event.clientY - pressY) >= TAP_PX) return;
  const rect = canvas.getBoundingClientRect();
  pitTap = { x: ((event.clientX - rect.left) / rect.width) * 2 - 1, y: 1 - ((event.clientY - rect.top) / rect.height) * 2 };
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
// Time away from a fight that was playable when the page was hidden (fightPlayable: rigs in, versus card gone, graphics up; GPT audit F4 —
// fightLive() alone owed a returning player the time the fight waited behind the loading card) is owed to it: the browser cannot run the fight while hidden, so the missed time is simulated on return with
// no input — the fight goes on as if the player stood still (owner 2026-09-20, "nothing more, nothing less"). Both clocks are read because a
// suspended phone browser may not advance performance.now(); the cap only bounds the work, an idle fighter is long dead before it.
const AFK_CAP = 300;
let hiddenPerf = 0, hiddenWall = 0, hiddenPlayable = false, owed = 0, marked = false;
const fightLive = () => !invalidSparringPreview && welcome.hidden && !journal.open && !match.practice.finish;
// The ?perf=1 fight figures count playable frames only: rigs in, versus card gone, graphics up. fightLive() alone is true for a
// returning player the whole time the fight waits behind the card, which stamped "first fight" during the download (audit 2026-09-25, E).
const fightPlayable = () => fightLive() && assetsReady && !versusUp && !graphicsLost;
// A failed rig load retries on its own when the page comes back (a sleeping phone aborts the download) or the network returns, and on a tap.
const retryArt = () => { if (artFailed) void view.retryArt(); };
window.addEventListener('online', retryArt);
element('art-status').addEventListener('click', retryArt);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) retryArt();
  if (document.hidden) { hiddenPerf = performance.now(); hiddenWall = Date.now(); hiddenPlayable = fightPlayable(); }   // read at hide: a context lost while away is restored after this event, so at return the fight reads as not playable
  else if (hiddenPerf && hiddenPlayable && fightLive() && match.mode !== 'pvp') owed += Math.min(Math.max(performance.now() - hiddenPerf, Date.now() - hiddenWall) / 1000, AFK_CAP);   // a duel has no catch-up: hidden time was silence to the peer (src/net/pvp.ts SILENCE)
  if (!document.hidden) hiddenPerf = hiddenWall = 0;
  last = performance.now();
  frames = [];
  reportAt = last;
});
// Cast identity survives quiet/mute: a missed start is never replayed after decode or resume.
let specialAudioEpoch = -1, specialAudioTick = -1, specialAudioClipping = false;
const specialAudioCasts = [-1, -1];
function syncSpecialAudio() {
  const tick = clip?.fresh?.duel.tick ?? match.practice.duel.tick;
  if (match.epoch !== specialAudioEpoch || tick < specialAudioTick || !!clip !== specialAudioClipping) {
    if (specialAudioEpoch !== -1) feedback.cutSpecial();
    specialAudioCasts.fill(-1);
    specialAudioEpoch = match.epoch;
  }
  specialAudioTick = tick; specialAudioClipping = !!clip;
  if (match.specials && match.mode !== 'pvp' && (!specialTest || match.specialIdentity.presets)) {
    const { opponent, level, presets } = match.specialIdentity;
    if (presets) { for (const id of presets) { const cue = specialCueFor(id); if (cue) feedback.want(cue); } return; }
    const id = bossSpecialFor(opponent, level) ?? classSpecialFor(opponent, level);
    const cue = id ? SPECIAL_CUE_OF[id] : undefined;
    if (cue) feedback.want(cue);
  }
}
function frame(now: number) {
  syncSpecialAudio();
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
  // The Pit shows: it draws the frame, and nothing of the fight runs (no sim step, no fight render, no effect update that could un-hide
  // what the Pit hid). Lead 2026-09-29.
  if (gear) { gear.frame(dt); if (debug) element('debug').dataset.worn = JSON.stringify(view.wornDraws?.() ?? { worn: [], covered: [] }); frameId = requestAnimationFrame(frame); return; }   // the gear sheet is open: it draws the rig, the fight waits
  if (pit) { pit.frame(dt); frameId = requestAnimationFrame(frame); return; }
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
      if (!marked && !match.practice.finish && !match.replay && !watching && match.mode !== 'sparring' && match.mode !== 'pvp') { marked = true; try { storage.setItem(AFK_KEY, JSON.stringify({ opponent: opponent.id })); } catch { /* unsaved: a closed page then scores nothing */ } }
      const result = match.step(() => {
        const intent = controls.intent();
        return {
          move: walker ? { x: 0, z: 0, yaw: view.yaw, run: false } : { x: intent.x, z: intent.z, yaw: view.yaw, run: intent.run },   // the walk's stick is the walker's, never the fight's
          action: intent.action,
          guard: intent.guard,
          guardDirection: intent.guardDirection ?? undefined,
          held: intent.held,
          lock: locked,
          cancel: intent.cancel,
        };
      });
      if (result === 'stalled' && clip) { clip.killedAt ??= now; accumulator = 0; break; }   // a clip whose record ran out before its finish: it stops at the cap
      if (clip && clip.killedAt === null && match.practice.finish) clip.killedAt = now;   // the re-play's killing tick: it plays on through the finisher
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
      if (!quiet) {
        if (specialCue && !match.specialIdentity.presets) for (const e of practice.events) {   // the move's cue (audio/special.ts SPECIAL_CUE_OF): it starts with the wind-up and is cut on a fizzle
          if (e.type === 'SpecialStarted' && e.actor === 1) feedback.special(specialCue);
          else if (e.type === 'SpecialFizzled' && e.actor === 1) feedback.cutSpecial();
        }
      }
      if (match.specials && match.mode !== 'pvp' && (!specialTest || match.specialIdentity.presets)) for (const e of practice.events) {
        if (e.type === 'SpecialStarted' && e.tick > specialAudioCasts[e.actor]) {
          specialAudioCasts[e.actor] = e.tick;   // accepted once per actor/cast tick, even if silent
          const { opponent, level, presets } = match.specialIdentity;
          const id = presets ? presets[e.actor] : e.name ? bossSpecialId(e.name) : e.actor === 1 ? classSpecialFor(opponent, level) : null;
          const cue = specialCueFor(id);
          if (!quiet && cue) feedback.special(cue, 1, e.actor);
        } else if (e.type === 'SpecialFizzled') feedback.cutSpecial(e.actor);
      }
      if (quiet) feedback.cutSpecial();
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
        match.tested ||= kitTested();   // the rank may have moved since boot (the account's server count): a kept Dev level off it never counts
        const ended = match.end(afk);   // the reward rule lives there: only a career fight touches the card, the scorecard or the marks
        if (!match.replay) setTimeout(sendBeacon, 0);   // the perf beacon, off the frame (a watched replay is not a fight)
        if (match.replay) {   // a watched fight is never a walk-away
          banner(`Replay over · ${practice.finish?.victim === 1 ? `${legendNow()?.name ?? ROSTER[opponent.id].name} fell` : 'the fighter fell'}`); updateHud();
          element('debug').dataset.replay = `${practice.duel.tick}/${practice.finish?.victim ?? ''}/${practice.finish?.draw ? 1 : 0}`;   // the browser-vs-Node replay row reads the end state here (scripts/browser-replay-check.mjs), as the gates read data-record
        }
        else {
          if (match.mode === 'sparring') sparEnd(true);   // Change / Leave beside Rematch; the banner already says no rewards
          if (ended.rewarded && session.db && session.userId) void import('./fight-results.ts').then(({ fightResultRow, postFightResult }) => postFightResult(session.db!, fightResultRow(opponent.id, match.level, ended.won ? 'win' : practice.finish?.draw ? 'draw' : 'loss'))).catch(() => {});   // the Pit wall's mirror (cosmetic; a failed chunk load is not an error)
          if (ended.record) {
            element('debug').dataset.record = `${ended.record.ticks}/${ended.record.outcome}/${ended.record.seed}`;
            say(null);
            const encoded = encodeRecord(ended.record), userId = session.userId, won = opponent.id;
            void encoded.then((text) => { element('debug').dataset.share = text; }, () => {});   // the gates read the encoded record here
            // A signed-in ladder win is claimed at the kill (loot-claims.ts) and Share waits for its post; practice and guest fights
            // post nothing and share at once.
            if (ended.rewarded && ended.won && userId) {
              claim = encoded.then((record) => {
                bankClaim(storage, { userId, opponent: won, record, piece: null, final: false }, say);
                showRank(); return record;
              }, () => null);
            } else showShare();
          }
          // Redraw the rank row with the marks this fight earned. The autopsy lines are shown nowhere now (Dom 2026-09-23); match.end still
          // writes them to the scorecard's `last`, kept so the Combat lane can fix the parker count and bring them back without a data gap.
          renderFightRank();
          if (match.mode === 'career') prefetchPit();   // the Pit's chunk, at idle; nothing is built until the player taps
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
  if (walker && !paused()) {
    const intent = gateHold ? { x: 0, z: 0 } : gateAuto ? { x: 0, z: -1 } : controls.intent();   // held at the line; walked the last metres; or the stick
    walker = walk(walker, intent, view.yaw, dt);
    if (walker.speed > 0.05) lastMoveAt = now;   // the door's hide/return reads this in updateHud (doorHidden)
    if (atGateLine(walker.x, walker.z)) { if (!crossed) { crossed = true; openGate(false); } } else crossed = false;   // one open per crossing
  }
  const alpha = accumulator / step();
  try {
    view.render(
      walker ? { ...state, x: walker.x, z: walker.z, heading: walker.heading } : {
        ...state,
        x: previous.x + (state.x - previous.x) * alpha,
        z: previous.z + (state.z - previous.z) * alpha,
        heading: previous.heading + wrapAngle(state.heading - previous.heading) * alpha,
      },
      locked,
      paused() ? 0 : dt,
      clip?.fresh ?? match.practice,
      match.frameEvents,
      hitStop > 0,
      match.epoch,
      match.specialIdentity,
    );
    match.frameEvents = [];
    if (gateLit && !pit) dropGateLight();   // the arena's first frame is drawn: the gate's light fades out over it
    clipFrame(now);
  } catch (error) {
    // Loss can happen inside a draw, before the browser delivers its context-lost event.
    if (!view.renderer.getContext().isContextLost()) throw error;
    pauseGraphics();
    return;
  }
  updateHud();
  if (debug) {
    const d = element('debug');
    d.textContent = describe(match.practice, `level ${match.level}`);
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
  }
  // The fight figures feed the ?perf=1 readout and the perf beacon (every fight, flag or not): playable frames only.
  if (elapsed > 0 && fightPlayable()) {
    if (Number.isNaN(firstFightAt)) firstFightAt = now;
    if (Number.isNaN(fightStartAt)) fightStartAt = performance.now();   // the beacon's look_swap_s counts from here, on the look's own clock
    if (Number.isNaN(firstExchangeAt) && !idleBeat(match.practice)) firstExchangeAt = performance.now();
    fightFrames.push(elapsed * 1000);
  }   // performance.now() counts from navigation start: the first playable frame IS the time to first fight
  if (now - reportAt >= 2000 && frames.length) {
    const sorted = frames.sort((a, b) => a - b),
      median = sorted[Math.floor(sorted.length / 2)],
      p95 = sorted[Math.floor(sorted.length * 0.95)];
    element('performance').textContent = `${Math.round(1000 / median)} fps · p95 ${Math.round(p95)} ms`;
    element('menu-performance').textContent = element('performance').textContent;
    // A slow window drops the pixel ratio to 1 for the page (scene.ts lowerResolution), except under an explicit ?dpr= (Lead 2026-09-28): that
    // load is an A/B instrument and must render at the ratio it asked for, or the readout would compare two drops.
    if (median > 22 && dprOverride === undefined) lowered(() => view.lowerResolution());
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
        `guards ${guards.built}/${guards.of}  draws ${info.calls}  tris ${info.triangles.toLocaleString()}  programs ${view.renderer.info.programs?.length ?? 0}`,
        `fight: ${fps(fightAt(0.5))} fps p50 · ${fps(fightAt(0.95))} fps p5 · ${fight.length} frames / ${fightSeconds.toFixed(0)} s`,
        ...(rafCadence(fightFrames).capped30 ? ['rAF capped 30 (low power?)'] : []),   // iOS Low Power Mode caps rAF at 30 Hz (quality.ts rafCadence)
        Number.isNaN(firstFightAt) ? 'first fight: not yet' : `first fight at ${(firstFightAt / 1000).toFixed(1)} s`,
        loadedLine(),
        deviceLine(view.renderer.getPixelRatio(), loweredFrom),
      ].join('\n');
    }
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
