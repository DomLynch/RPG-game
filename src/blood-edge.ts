// Blood edge (Dom 2026-09-29, pick C of the hitfx look test): when the PLAYER is hit, a cracked streak of deep crimson flickers on
// the screen edge the blow came from, ~480 ms with the peak held ~120 ms. Retuned 2026-09-30 after Dom could not see it on an iPhone: the
// PAINTED band is now >= 7 vw deep at peak (it was ~9 px, the ragged line sat at 10-26 % of a 9 vw strip) and sits inside the safe area. Presentation only, driven by the frame's Hit events (no sim change); a CSS/SVG overlay above
// the canvas (no GPU pass); always on, prefers-reduced-motion included (owner ruling 2026-09-29: hit feedback is on for everyone). Nothing is added to the page until the first time the player is hit.
// The move's direction is the attacker's side (what a guard mirrors), so it lands on the mirrored screen edge (the camera looks over the
// player's shoulder): right -> left edge, left -> right, overhead -> top; thrust and low -> bottom.
// The streak covers the middle 65 % of the edge and tapers out at both ends; its ragged line and cracks are seeded from the hit (tick and
// side), so every blow draws a different streak and a replay draws the same ones.
import type { CombatEvent, Duel } from './duel.ts';
import { weaponOf, type Direction } from './moves.ts';

export type Edge = 'left' | 'right' | 'top' | 'bottom';
export const EDGE: Record<Direction, Edge> = { right: 'left', left: 'right', overhead: 'top', thrust: 'bottom', low: 'bottom' };
export const EDGE_MS = 480;
export const PEAK = [0.16, 0.41];   // opacity is 1 from 77 ms to 197 ms of EDGE_MS
const SIDES = ['left', 'right', 'top', 'bottom'] as const;
export const DEPTH_VW = 12, LINE_MIN = 60, SPAN = 65;   // the strip is 12 vw deep (45 px at 375); the painted band is its inner 60-100 % (>= 7.2 vw, 27 px); the middle 65 % of the edge

export const edgeOf = (e: CombatEvent, duel: Duel): Edge | null => {
  if (e.type !== 'Hit' || e.target !== 0 || !e.move) return null;
  const direction = weaponOf(duel.fighters[e.actor].weapon).moves[e.move]?.direction;
  return direction ? EDGE[direction] : null;
};

// The streak in a 100 (depth, 0 = the screen edge) x 1000 (length) box, exactly the frame Dom picked (edge-v3 style C): a thin band hugging
// the edge whose ragged inner line wanders between LINE_MIN and 100 of the depth, and dark branching cracks running inward from it.
export function streak(seed: number): string {
  let s = (seed * 9301 + 49297) % 233280;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const phase = [r(), r(), r()].map((x) => x * 6.283), line: string[] = [];
  for (let y = 0; y <= 1000; y += 20) {
    const w = 0.5 + 0.2 * Math.sin(y / 70 + phase[0]) + 0.13 * Math.sin(y / 23 + phase[1]) + 0.08 * Math.sin(y / 9 + phase[2]) + (r() - 0.5) * 0.5;
    line.push(`${(LINE_MIN + (100 - LINE_MIN) * Math.min(1, Math.max(0, w))).toFixed(1)},${y}`);
  }
  let cracks = '';
  for (let i = 0; i < 9; i++) {
    let x = LINE_MIN - 5, y = 60 + r() * 880, d = `M${x},${y.toFixed(0)}`;
    for (let k = 0; k < 4; k++) { x = Math.min(100, x + 8 + r() * 8); y += (r() - 0.5) * 60; d += ` L${x.toFixed(1)},${y.toFixed(0)}`; }
    cracks += `<path d="${d}" fill="none" stroke="#3a0505" stroke-width="${(2 + r() * 3).toFixed(1)}"/>`;
  }
  return `<path d="M0,0 L${line.join(' L')} L0,1000Z"/>${cracks}`;
}

// What the overlay needs from the page (the real document in the game; a stand-in in the tests).
export type Page = { document: Pick<Document, 'createElement' | 'createElementNS'> };
const browserPage = (): Page => ({ document });

const SVG_NS = 'http://www.w3.org/2000/svg';
function strip(page: Page, edge: Edge) {
  const across = edge === 'left' || edge === 'right', gap = `${(100 - SPAN) / 2}%`, id = `blood-${edge}`;
  const svg = page.document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', across ? '0 0 100 1000' : '0 0 1000 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  Object.assign(svg.style, { position: 'absolute', [edge]: `env(safe-area-inset-${edge})`, ...(across ? { top: gap, height: `${SPAN}%`, width: `${DEPTH_VW}vw` } : { left: gap, width: `${SPAN}%`, height: `${DEPTH_VW}vw` }), opacity: '0', overflow: 'visible' });
  // The shape is drawn once for the left edge and turned so its depth runs inward from this edge.
  const turn = { left: '', right: 'translate(100 0) scale(-1 1)', top: 'matrix(0 1 1 0 0 0)', bottom: 'matrix(0 -1 1 0 0 100)' }[edge];
  const inward = { left: [0, 0, 1, 0], right: [1, 0, 0, 0], top: [0, 0, 0, 1], bottom: [0, 1, 0, 0] }[edge], along = across ? [0, 0, 0, 1] : [0, 0, 1, 0];
  svg.innerHTML = `<defs><linearGradient id="${id}-c" x1="${inward[0]}" y1="${inward[1]}" x2="${inward[2]}" y2="${inward[3]}">` +
    `<stop offset="0" stop-color="#6b0a0a" stop-opacity=".97"/><stop offset=".6" stop-color="#3a0505" stop-opacity=".92"/><stop offset="1" stop-color="#3a0505" stop-opacity=".8"/></linearGradient>` +
    `<linearGradient id="${id}-t" x1="${along[0]}" y1="${along[1]}" x2="${along[2]}" y2="${along[3]}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="${id}-m" maskContentUnits="userSpaceOnUse"><rect width="${across ? 100 : 1000}" height="${across ? 1000 : 100}" fill="url(#${id}-t)"/></mask></defs>` +
    `<g mask="url(#${id}-m)" fill="url(#${id}-c)"><g transform="${turn}"></g></g>`;
  return { svg, body: svg.querySelector('g g')! };
}

export function createBloodEdge(canvas: HTMLElement, page: Page = browserPage()) {
  let strips: Record<Edge, ReturnType<typeof strip>> | undefined;
  const lay = () => {   // built on the first hit the player takes, never before
    const box = page.document.createElement('div');
    box.id = 'blood-edge';
    Object.assign(box.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1' });
    const made = Object.fromEntries(SIDES.map((edge) => { const s = strip(page, edge); box.append(s.svg); return [edge, s]; })) as Record<Edge, ReturnType<typeof strip>>;
    canvas.after(box);
    return made;
  };
  return {
    render(events: readonly CombatEvent[], duel: Duel) {
      for (const e of events) {
        const edge = edgeOf(e, duel);
        if (!edge) continue;
        const s = (strips ??= lay())[edge];
        s.body.innerHTML = streak(e.tick * 4 + SIDES.indexOf(edge));
        s.svg.animate([{ opacity: 0 }, { opacity: 1, offset: PEAK[0] }, { opacity: 1, offset: PEAK[1] }, { opacity: 0 }], { duration: EDGE_MS, easing: 'ease-out' });
      }
    },
  };
}
