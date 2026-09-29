// Hit-feedback look test (Lead 2026-09-29, for Dom; `?look=hitfx` or `hitfx-edge`): presentation only, driven by the frame's Hit events,
// no sim change. Without the flag this module is never fetched. (The heavy-hit rim flash was tried and ruled out by Dom: "cheap, 2005".)
// When the PLAYER is hit, a deep-crimson blood smear on the screen edge the blow came from, 300 ms, a CSS overlay (no GPU pass), off under
// prefers-reduced-motion. v3 (Dom): centred on 65 % of the edge with soft tapered ends, a jagged splattery inner edge from a baked SVG
// mask, one of three variants per hit so it never draws the same line twice. The move's direction is the attacker's side (what a guard mirrors), so it lands on the mirrored screen edge
// (the camera looks over the player's shoulder): right -> left edge, left -> right, overhead -> top; thrust and low -> bottom.
import type { CombatEvent, Duel } from './duel.ts';
import { weaponOf, type Direction } from './moves.ts';

export type Edge = 'left' | 'right' | 'top' | 'bottom';
export const EDGE: Record<Direction, Edge> = { right: 'left', left: 'right', overhead: 'top', thrust: 'bottom', low: 'bottom' };
// Calibrated to be SEEN for the look test (Strategy 2026-09-29: a 12 px, 0.2 s strip went unnoticed by Dom; tune down after his verdict).
export const EDGE_MS = 300;
const DEPTH = '9vw', SPAN = 65;   // ~34 px deep at 375 wide; 65 % of the edge, centred, the ends tapering to nothing
// Three styles for Dom to pick from (Strategy 2026-09-29), cycled every four hits and labelled on screen: A a jagged smear, B a spray of
// drops, C a thin cracked streak. Deep crimson, #6b0a0a at the screen edge to #3a0505 inward.
export const STYLES = ['A', 'B', 'C'] as const;
const PER_STYLE = 4;

// Seeded shapes in a 100 (depth, 0 = screen edge) x 1000 (length) box. Pure, so each variant is fixed for the page.
function rng(seed: number) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
const profile = (r: () => number, lo: number, hi: number, fine = 0.14) => {
  const p = [r(), r(), r()].map((x) => x * 6.283), pts: string[] = [];
  for (let y = 0; y <= 1000; y += 20) {
    const w = 0.5 + 0.2 * Math.sin(y / 70 + p[0]) + 0.13 * Math.sin(y / 23 + p[1]) + 0.08 * Math.sin(y / 9 + p[2]) + (r() - 0.5) * fine;
    pts.push(`${(lo + (hi - lo) * Math.min(1, Math.max(0, w))).toFixed(1)},${y}`);
  }
  return pts;
};
export function shape(style: (typeof STYLES)[number], seed: number): string {
  const r = rng(seed);
  if (style === 'A') {   // the smear: a jagged inner edge between 35 and 95 of the depth, with a few drops past it
    let drops = '';
    for (let i = 0; i < 7; i++) drops += `<circle cx="${(70 + r() * 28).toFixed(1)}" cy="${(80 + r() * 840).toFixed(0)}" r="${(2 + r() * 5).toFixed(1)}"/>`;
    return `<path d="M0,0 L${profile(r, 35, 95).join(' L')} L0,1000Z"/>${drops}`;
  }
  if (style === 'B') {   // the spray: drops, big and dense at the screen edge, small and sparse inward
    let drops = '';
    for (let i = 0; i < 70; i++) { const d = r() ** 1.8 * 100; drops += `<ellipse cx="${d.toFixed(1)}" cy="${(r() * 1000).toFixed(0)}" rx="${(9 - d * 0.07 + r() * 4).toFixed(1)}" ry="${(12 - d * 0.08 + r() * 8).toFixed(1)}"/>`; }
    return `<path d="M0,0 L${profile(r, 8, 22).join(' L')} L0,1000Z"/>${drops}`;
  }
  // C, the streak: a thin band hugging the edge with a ragged inner line and hairline cracks running inward
  let cracks = '';
  for (let i = 0; i < 9; i++) {
    let x = 18, y = 60 + r() * 880; let d = `M${x},${y.toFixed(0)}`;
    for (let k = 0; k < 4; k++) { x += 8 + r() * 14; y += (r() - 0.5) * 60; d += ` L${x.toFixed(1)},${y.toFixed(0)}`; }
    cracks += `<path d="${d}" fill="none" stroke="#3a0505" stroke-width="${(2 + r() * 3).toFixed(1)}"/>`;
  }
  return `<path d="M0,0 L${profile(r, 10, 26, 0.5).join(' L')} L0,1000Z"/>${cracks}`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
// One strip: an inline SVG (no CSS mask) whose group is turned so depth runs inward from its edge; the crimson gradient runs inward and a
// mask gradient tapers both ends along the length.
function strip(edge: Edge, id: string) {
  const across = edge === 'left' || edge === 'right', gap = `${(100 - SPAN) / 2}%`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', across ? '0 0 100 1000' : '0 0 1000 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  Object.assign(svg.style, { position: 'absolute', [edge]: '0', ...(across ? { top: gap, height: `${SPAN}%`, width: DEPTH } : { left: gap, width: `${SPAN}%`, height: DEPTH }), opacity: '0', overflow: 'visible' });
  const turn = { left: '', right: 'translate(100 0) scale(-1 1)', top: 'matrix(0 1 1 0 0 0)', bottom: 'matrix(0 -1 1 0 0 100)' }[edge];
  const inward = { left: ['0', '0', '1', '0'], right: ['1', '0', '0', '0'], top: ['0', '0', '0', '1'], bottom: ['0', '1', '0', '0'] }[edge];
  const along = across ? ['0', '0', '0', '1'] : ['0', '0', '1', '0'];
  svg.innerHTML = `<defs><linearGradient id="${id}-c" x1="${inward[0]}" y1="${inward[1]}" x2="${inward[2]}" y2="${inward[3]}"><stop offset="0" stop-color="#6b0a0a" stop-opacity=".97"/><stop offset=".6" stop-color="#3a0505" stop-opacity=".92"/><stop offset="1" stop-color="#3a0505" stop-opacity=".8"/></linearGradient>` +
    `<linearGradient id="${id}-t" x1="${along[0]}" y1="${along[1]}" x2="${along[2]}" y2="${along[3]}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="${id}-m" maskContentUnits="userSpaceOnUse"><rect x="0" y="0" width="${across ? 100 : 1000}" height="${across ? 1000 : 100}" fill="url(#${id}-t)"/></mask></defs>` +
    `<g mask="url(#${id}-m)" fill="url(#${id}-c)"><g transform="${turn}"></g></g>`;
  return { svg, body: svg.querySelector('g g')! };
}

export const edgeOf = (e: CombatEvent, duel: Duel): Edge | null => {
  if (e.type !== 'Hit' || e.target !== 0 || !e.move) return null;
  const direction = weaponOf(duel.fighters[e.actor].weapon).moves[e.move]?.direction;
  return direction ? EDGE[direction] : null;
};

export function createHitLook(canvas: HTMLCanvasElement) {
  const log: { at: number; side: Edge; style: string }[] = [];
  (globalThis as { __hitfx?: typeof log }).__hitfx = log;   // the clip recorder reads when each pulse fired
  const box = document.createElement('div');
  box.id = 'hitfx-edge';
  Object.assign(box.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1' });
  const strips = Object.fromEntries((['left', 'right', 'top', 'bottom'] as const).map((edge) => { const s = strip(edge, `hitfx-${edge}`); box.append(s.svg); return [edge, s]; })) as Record<Edge, ReturnType<typeof strip>>;
  const label = document.createElement('div');   // which style is on screen, for Dom's pick
  Object.assign(label.style, { position: 'absolute', left: '50%', top: '22%', transform: 'translateX(-50%)', font: '700 28px system-ui, sans-serif', color: '#fff', textShadow: '0 1px 4px #000', letterSpacing: '0.1em' });
  box.append(label);
  canvas.after(box);
  let hits = 0;
  const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    render(events: CombatEvent[], duel: Duel) {
      for (const e of events) {
        const edge = edgeOf(e, duel);
        if (!edge || still()) continue;
        const style = STYLES[Math.floor(hits / PER_STYLE) % STYLES.length], s = strips[edge];
        s.body.innerHTML = shape(style, 1 + (hits++ % 3));   // three seeded variants per style, so no two hits in a row draw the same shape
        label.textContent = style;
        s.svg.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: EDGE_MS, easing: 'ease-out' });
        log.push({ at: duel.tick, side: edge, style });
      }
    },
  };
}
