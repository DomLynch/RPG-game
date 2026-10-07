// Scaled camera kick (research #18, Strategy): look tests, absent = today's game. The kick and the roll's shift are metres, so the same 4 cm moves the
// frame more pixels when the camera sits near and fewer when it sits far. `?look=kickscale` holds their SCREEN size by scaling with the camera's distance
// to the fight over the median distance at the approved framing (x1.0 there). `?look=kickscale-sep` is a different design that changes feel, not
// compensation: the scale follows how far apart the fighters stand over the median separation (x1.0 at the median; a close hit softer, a wide one harder).
// The roll's angle is a rotation about the view axis (distance-free) and the hit-stop is untouched. Presentation only; no tick or record changes.
import type { Shove } from './camera-kick.ts';
export const KICK_REF_CAM = 5.37;  // m: camera to the fight, median over 1094 frames of a scripted Veteran fight (VPS harness 2026-10-07; min 5.07, max 7.20)
export const KICK_REF_SEP = 1.25;  // m: median fighter separation over 17 logged hits (VPS capture 2026-10-07)
export type KickScaleMode = 'cam' | 'sep';
export function kickScaleFlag(search: string): KickScaleMode | null {
  const m = /[?&]look=([^&]*,)?kickscale(-sep)?(?=[,&]|$)/i.exec(search);
  return m ? (m[2] ? 'sep' : 'cam') : null;
}
const clamp = (v: number) => Math.min(1.6, Math.max(0.7, v));
export const kickScale = (mode: KickScaleMode, camDist: number, separation: number) => clamp(mode === 'cam' ? camDist / KICK_REF_CAM : separation / KICK_REF_SEP);
export function scaleShove(s: Shove, k: number): Shove {
  return { ...s, along: s.along * k, drop: s.drop * k, side: s.side * k, screen: s.screen && s.screen * k, push: s.push && s.push * k };
}
