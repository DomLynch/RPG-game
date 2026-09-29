// Hit-feedback look test (Lead 2026-09-29, for Dom; `?look=hitfx` or `hitfx-edge`): presentation only, driven by the frame's Hit events,
// no sim change. Without the flag this module is never fetched. (The heavy-hit rim flash was tried and ruled out by Dom: "cheap, 2005".)
// When the PLAYER is hit, a red flicker (7 % of the width) on the screen edge the blow came from, 300 ms, a CSS overlay (no GPU pass), off
// under prefers-reduced-motion. The move's direction is the attacker's side (what a guard mirrors), so it lands on the mirrored screen edge
// (the camera looks over the player's shoulder): right -> left edge, left -> right, overhead -> top; thrust and low -> bottom.
import type { CombatEvent, Duel } from './duel.ts';
import { weaponOf, type Direction } from './moves.ts';

export type Edge = 'left' | 'right' | 'top' | 'bottom';
export const EDGE: Record<Direction, Edge> = { right: 'left', left: 'right', overhead: 'top', thrust: 'bottom', low: 'bottom' };
// Calibrated to be SEEN for the look test (Strategy 2026-09-29: a 12 px, 0.2 s strip went unnoticed by Dom; tune down after his verdict).
export const EDGE_MS = 300;
const STRIP = 'rgba(190, 0, 0, 0.95), rgba(150, 0, 0, 0.55) 40%', STRIP_PX = '7vw';   // ~26 px at 375 wide, a soft gradient

export const edgeOf = (e: CombatEvent, duel: Duel): Edge | null => {
  if (e.type !== 'Hit' || e.target !== 0 || !e.move) return null;
  const direction = weaponOf(duel.fighters[e.actor].weapon).moves[e.move]?.direction;
  return direction ? EDGE[direction] : null;
};

export function createHitLook(canvas: HTMLCanvasElement) {
  const log: { at: number; side: Edge }[] = [];
  (globalThis as { __hitfx?: typeof log }).__hitfx = log;   // the clip recorder reads when each pulse fired
  const box = document.createElement('div');
  box.id = 'hitfx-edge';
  Object.assign(box.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1' });
  const strip = (edge: Edge) => {
    const s = document.createElement('div'), across = edge === 'left' || edge === 'right';
    Object.assign(s.style, { position: 'absolute', [edge]: '0', ...(across ? { top: '0', bottom: '0', width: STRIP_PX } : { left: '0', right: '0', height: STRIP_PX }),
      background: `linear-gradient(to ${{ left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[edge]}, ${STRIP}, transparent)`, opacity: '0' });
    box.append(s); return s;
  };
  const strips: Record<Edge, HTMLDivElement> = { left: strip('left'), right: strip('right'), top: strip('top'), bottom: strip('bottom') };
  canvas.after(box);
  const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    render(events: CombatEvent[], duel: Duel) {
      for (const e of events) {
        const edge = edgeOf(e, duel);
        if (!edge || still()) continue;
        strips[edge].animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: EDGE_MS, easing: 'ease-out' });
        log.push({ at: duel.tick, side: edge });
      }
    },
  };
}
