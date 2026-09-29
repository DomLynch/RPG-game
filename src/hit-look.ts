// Hit-feedback look test (Lead 2026-09-29, for Dom; `?look=hitfx`, `hitfx-edge`, `hitfx-rim`): presentation only, driven by the frame's
// Hit events, no sim change. Without the flag this module is never fetched.
//  edge: the PLAYER is hit -> a red flicker (7 % of the width) on the screen edge the blow came from, 300 ms, a CSS overlay (no GPU pass), off under
//        prefers-reduced-motion. The move's direction is the attacker's side (what a guard mirrors), so it lands on the mirrored screen edge
//        (the camera looks over the player's shoulder): right -> left edge, left -> right, overhead -> top; thrust and low -> bottom.
//  rim:  a HEAVY hit (the heavy class or a charged blow, as the hit-stop reads it) -> the struck fighter's materials flash a pale emissive for
//        six rendered frames (~100 ms at 60 Hz), then every touched material gets back its exact emissive colour and intensity. No material is created.
import type { Object3D } from 'three';
import type { CombatEvent, Duel } from './duel.ts';
import { HEAVY_MOVES } from './hud.ts';
import { weaponOf, type Direction } from './moves.ts';
import type { HitFx } from './look-flag.ts';

export type Edge = 'left' | 'right' | 'top' | 'bottom';
export const EDGE: Record<Direction, Edge> = { right: 'left', left: 'right', overhead: 'top', thrust: 'bottom', low: 'bottom' };
// Calibrated to be SEEN for the look test (Strategy 2026-09-29: a 12 px, 0.2 s strip went unnoticed by Dom; tune down after his verdict).
export const EDGE_MS = 300, RIM_FRAMES = 6, RIM = 0xfff1dc, RIM_INTENSITY = 0.6;
const STRIP = 'rgba(190, 0, 0, 0.95), rgba(150, 0, 0, 0.55) 40%', STRIP_PX = '7vw';   // ~26 px at 375 wide, a soft gradient

type Emissive = { emissive: { getHex(): number; setHex(hex: number): unknown }; emissiveIntensity: number };
const emissive = (m: unknown): m is Emissive => !!m && typeof (m as Emissive).emissive?.getHex === 'function';

export const edgeOf = (e: CombatEvent, duel: Duel): Edge | null => {
  if (e.type !== 'Hit' || e.target !== 0 || !e.move) return null;
  const direction = weaponOf(duel.fighters[e.actor].weapon).moves[e.move]?.direction;
  return direction ? EDGE[direction] : null;
};
export const heavyHit = (e: CombatEvent) => e.type === 'Hit' && e.target !== undefined && (!!e.charged || HEAVY_MOVES.has(e.move ?? ''));

// The rim flash, one for both fighters (they may share a material): each material is saved once per flash, so a second heavy inside the
// flash (either fighter) extends it and never saves a lit value as the one to restore.
export function rimFlash() {
  const saved = new Map<Emissive, [number, number]>();
  let frames = 0;
  return {
    fire(anchor: Object3D) {
      anchor.traverse((o) => {
        const list = (o as { material?: unknown }).material;
        for (const m of Array.isArray(list) ? list : [list]) if (emissive(m) && !saved.has(m)) saved.set(m, [m.emissive.getHex(), m.emissiveIntensity]);
      });
      for (const m of saved.keys()) { m.emissive.setHex(RIM); m.emissiveIntensity = RIM_INTENSITY; }
      frames = RIM_FRAMES;
    },
    frame() {
      if (!frames || --frames) return;
      for (const [m, [hex, intensity]] of saved) { m.emissive.setHex(hex); m.emissiveIntensity = intensity; }
      saved.clear();
    },
    get lit() { return frames > 0; },
  };
}

export function createHitLook(flags: HitFx, canvas: HTMLCanvasElement) {
  const log: { at: number; kind: 'edge' | 'rim'; side: Edge | number }[] = [];
  (globalThis as { __hitfx?: typeof log }).__hitfx = log;   // the clip recorder reads when each effect fired
  let strips: Record<Edge, HTMLDivElement> | undefined;
  if (flags.edge) {
    const box = document.createElement('div');
    box.id = 'hitfx-edge';
    Object.assign(box.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1' });
    const strip = (edge: Edge) => {
      const s = document.createElement('div'), across = edge === 'left' || edge === 'right';
      Object.assign(s.style, { position: 'absolute', [edge]: '0', ...(across ? { top: '0', bottom: '0', width: STRIP_PX } : { left: '0', right: '0', height: STRIP_PX }),
        background: `linear-gradient(to ${{ left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[edge]}, ${STRIP}, transparent)`, opacity: '0' });
      box.append(s); return s;
    };
    strips = { left: strip('left'), right: strip('right'), top: strip('top'), bottom: strip('bottom') };
    canvas.after(box);
  }
  const rim = rimFlash();
  const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    render(events: CombatEvent[], duel: Duel, anchors: [Object3D | undefined, Object3D | undefined]) {
      rim.frame();
      for (const e of events) {
        const edge = strips && edgeOf(e, duel);
        if (edge && !still()) {
          strips![edge].animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: EDGE_MS, easing: 'ease-out' });
          log.push({ at: duel.tick, kind: 'edge', side: edge });
        }
        const anchor = e.target !== undefined ? anchors[e.target] : undefined;
        if (flags.rim && anchor && heavyHit(e)) { rim.fire(anchor); log.push({ at: duel.tick, kind: 'rim', side: e.target! }); }
      }
    },
  };
}
