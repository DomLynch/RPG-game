// Rank looks on the opponent (docs/briefs/tier-looks-runtime.md, Strategy's streaming ruling): the fight opens on his base look (his
// fighter GLB + his carriers cut), and the rank look streams in only after first playable, then swaps on at the first idle beat, as one
// change, never mid-exchange, never in a finisher or the kill-cam. A look that lands late waits for the next idle beat; one that lands after
// the fight ends waits for the next fight (the swap stays armed). A look that fails to load leaves him in his base look, not the fight.
//
// Default off: no opponent has a shipping look until one passes the stream gate. The dev flag `?ranklook=/looks/<name>.glb` streams a
// same-origin file directly under /looks/ onto whichever opponent the page fights (a file built for another rig simply does not fit).
import type { Practice } from './combat.ts';
import type { Phase } from './duel.ts';

const FLAG = /^\/looks\/[A-Za-z0-9_@.-]+\.glb$/;
export function rankLookFlag(search: string): string | undefined {
  const value = new URLSearchParams(search).get('ranklook');
  return value && FLAG.test(value) && !value.includes('..') ? value : undefined;
}

// The idle beat: neither fighter is in an exchange (attack, riposte, parry, stagger, a roll) and no finish is playing. Ready, sheathed, the
// draw and a held guard are the quiet phases (a guard with its parry window open is not); a backstep is footwork out of an exchange, so it
// waits. A guard counts because a fighter who holds it all fight (the AI hero, measured: no beat in a whole replay without it) would
// otherwise never see his look.
const QUIET: readonly Phase[] = ['ready', 'sheathed', 'draw', 'guard'];
export const idleBeat = (practice: Practice): boolean =>
  !practice.finish && practice.duel.fighters.every((f) => QUIET.includes(f.phase) && !f.parrying && f.stun === 0);

export type RankLookState = 'waiting' | 'loading' | 'ready' | 'on' | 'failed';
// One look for one fight's opponent. `tick` is called every rendered frame with the practice on screen: the first frame the fight clock has
// moved (tick > 0, which only happens once the fight is playable) starts the fetch, and the first idle beat after it lands applies it.
export function rankLookStream<T>(load: () => Promise<T>, apply: (look: T) => void, failed: (error: unknown) => void = () => {}) {
  let state: RankLookState = 'waiting', look: T | undefined, loadedAt = NaN, onAt = NaN, applyMs = NaN;
  const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
  return {
    state: (): RankLookState => state,
    // performance.now() stamps (NaN until they happen): the gate reads stream-in and swap times from these.
    stamps: () => ({ loaded: loadedAt, on: onAt, applyMs }),
    tick(practice: Practice) {
      if (state === 'waiting' && practice.duel.tick > 0) {
        state = 'loading';
        load().then((l) => { look = l; loadedAt = now(); state = 'ready'; }, (error: unknown) => { state = 'failed'; failed(error); });
      }
      if (state === 'ready' && idleBeat(practice)) {
        state = 'on'; onAt = now();
        try { apply(look!); } catch (error) { state = 'failed'; failed(error); }
        applyMs = now() - onAt;
      }
    },
  };
}
