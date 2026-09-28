// Rank looks on the opponent (docs/briefs/tier-looks-runtime.md, Strategy's streaming ruling): the fight opens on his base look (his
// fighter GLB + his carriers cut), and the rank look streams in only after first playable, then swaps on at the first idle beat, as one
// change, never mid-exchange, never in a finisher or the kill-cam. A look that lands late waits for the next idle beat; one that lands after
// the fight ends waits for the next fight (the swap stays armed). A look that fails to load leaves him in his base look, not the fight.
//
// Shipping looks (Lead, 2026-09-28): the Goblin met at rank level 2–10 wears L2–L10 (public/looks/goblin-L<n>.glb, Armour's packed4 files,
// each through the stream gate's rules); at level 1 he is his rig as shipped. The Plague Doctor the same, L2–L10 (Dom via Strategy/Lead,
// 2026-09-28: GPT's rank pack, packed by Armour to the look caps). The Knight the same, L2–L10 (Dom 18:2x via Strategy/Lead, 2026-09-28:
// GPT's pack at Strategy's 70k armour tris, Armour's packed files; two skinned draws, armour + gauntlets, on his rig's own joints).
// The Nightborn the same, L2–L10 (Dom 19:0x via Strategy/Lead): his built rig's 14 draws all go off (keep = []), the file is his whole
// fitted figure with its own head (L8–L10: the closed helm), his estoc stays.
// The Plague Doctor's costume is fused into CreatureBody, so his files keep nothing of his (extras.keep = []): the look is the whole fitted figure. No other opponent has one until his files pass the gate. The
// dev flag `?ranklook=/looks/<name>.glb` streams a same-origin file directly under /looks/ onto whichever opponent the page fights (a file
// built for another rig simply does not fit), over the table.
import type { Practice } from './combat.ts';
import type { Phase } from './duel.ts';
import type { FinisherId } from './finishers.ts';

const FLAG = /^\/looks\/[A-Za-z0-9_@.-]+\.glb$/;
export function rankLookFlag(search: string): string | undefined {
  const value = new URLSearchParams(search).get('ranklook');
  return value && FLAG.test(value) && !value.includes('..') ? value : undefined;
}
// The rank levels (grades.ts levelOf: Recruit 1 … Origin 10) each opponent has a shipping look for.
export const SHIPPING_LOOKS: Readonly<Record<string, readonly number[]>> = { goblin: [2, 3, 4, 5, 6, 7, 8, 9, 10], plaguedoctor: [2, 3, 4, 5, 6, 7, 8, 9, 10], knight: [2, 3, 4, 5, 6, 7, 8, 9, 10], nightborn: [2, 3, 4, 5, 6, 7, 8, 9, 10] };
// Phone-tier LODs (Lead 2026-09-28, Dom's iPhone jitter at the Plague Doctor's L8–L10: GPU vertex/skinning bound): a set listed here also
// ships <opponent>-L<n>-phone.glb, the same look with its armour mesh simplified (meshopt) to ≤ 60k skinned vertices whole; textures,
// materials, skin and bones are the desktop file's own, except a draw the file names in extras.rebaked (too seam-dense to simplify in place:
// the Knight's L2–L6/L9/L10 armour, the Nightborn's armour and closed helm; one new atlas per file). The phone tier streams it; desktop keeps the full file.
export const PHONE_LOOKS: ReadonlySet<string> = new Set(['plaguedoctor', 'knight', 'nightborn']);
// His look file at the rank level he is met at, or none (his rig as shipped).
export const rankLookFor = (opponent: string, level: number, phone = false): string | undefined =>
  SHIPPING_LOOKS[opponent]?.includes(level) ? `/looks/${opponent}-L${level}${phone && PHONE_LOOKS.has(opponent) ? '-phone' : ''}.glb` : undefined;
// A rung change that changes his look file: the look streams once per page, so the rematch takes a fresh page (main.ts, Auditer #961).
export const rankLookMoves = (opponent: string, from: number, to: number): boolean => rankLookFor(opponent, from) !== rankLookFor(opponent, to);

// The idle beat: neither fighter is in an exchange (attack, riposte, parry, stagger, a roll) and no finish is playing. Ready, sheathed, the
// draw and a held guard are the quiet phases (a guard with its parry window open is not); a backstep is footwork out of an exchange, so it
// waits. A guard counts because a fighter who holds it all fight (the AI hero, measured: no beat in a whole replay without it) would
// otherwise never see his look.
const QUIET: readonly Phase[] = ['ready', 'sheathed', 'draw', 'guard'];
export const idleBeat = (practice: Practice): boolean =>
  !practice.finish && practice.duel.fighters.every((f) => QUIET.includes(f.phase) && !f.parrying);   // a stagger is the 'hurt' phase (`stun` is its length, left stale after it)

// 'none': this fight has no look (his rank has none); nothing is fetched and nothing is reported.
export type RankLookState = 'waiting' | 'none' | 'loading' | 'ready' | 'on' | 'failed';
// One look for one fight's opponent. `tick` is called every rendered frame with the practice on screen: the first frame the fight clock has
// moved (tick > 0, which only happens once the fight is playable) starts the fetch, and the first idle beat after it lands applies it.
// `load` decides then (the rung he is met at is known by then); undefined = no look for this fight.
export function rankLookStream<T>(load: () => Promise<T> | undefined, apply: (look: T) => void, failed: (error: unknown) => void = () => {}) {
  let state: RankLookState = 'waiting', look: T | undefined, loadedAt = NaN, onAt = NaN, applyMs = NaN;
  const waited: Record<string, number> = {};   // frames spent ready but off-beat, by what kept the beat away (the gate reads it)
  const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
  return {
    state: (): RankLookState => state,
    // performance.now() stamps (NaN until they happen): the gate reads stream-in and swap times from these.
    stamps: () => ({ loaded: loadedAt, on: onAt, applyMs, waited }),
    tick(practice: Practice) {
      if (state === 'waiting' && practice.duel.tick > 0) {
        const pending = load();
        state = pending ? 'loading' : 'none';
        pending?.then((l) => { look = l; loadedAt = now(); state = 'ready'; }, (error: unknown) => { state = 'failed'; failed(error); });
      }
      if (state === 'ready' && !idleBeat(practice)) {
        const key = practice.finish ? 'finish' : practice.duel.fighters.map((f) => `${f.phase}${f.parrying ? '+parry' : ''}`).join('/');
        waited[key] = (waited[key] ?? 0) + 1;
      }
      if (state === 'ready' && idleBeat(practice)) {
        state = 'on'; onAt = now();
        try { apply(look!); } catch (error) { state = 'failed'; failed(error); }
        applyMs = now() - onAt;
      }
    },
  };
}

// The safety net under the pre-swap bake (Strategy/Lead on #1025 row C, condition 3): an opened kill on him while a waist-cut bake is still
// pending plays a finisher that reads no bake, for that fight, and is logged; never a stall, never a cut through an unbaked helm.
// Finishers' pick (22:4x, Lead confirmed): runThrough, a pose and the blade through spine_02, nothing cut; plainDeath where he does not allow it.
export const bakeSafeFinisher = (finisher: FinisherId | null, victim: number, pending: boolean, allows: (f: FinisherId) => boolean = () => true): FinisherId | null =>
  finisher === 'opened' && victim === 1 && pending ? (allows('runThrough') ? 'runThrough' : 'plainDeath') : finisher;
