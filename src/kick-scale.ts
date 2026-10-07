// Distance-scaled camera kick (research #18, Strategy): a look test, absent = today's game: `?look=kickscale`. The kick and the roll's shift are
// metres, so the same 4 cm moves the frame more pixels when the camera sits close and fewer when the duel is wide. Scaling them by the
// camera's distance to the fight holds their SCREEN size at what Dom approved at the ~3.5 m duel framing. The roll's angle is already
// distance-free (a rotation about the view axis) and the hit-stop is untouched. Presentation only; no tick or record changes.
import type { Shove } from './camera-kick.ts';
export const KICK_REF_DIST = 3.5;   // m: the framing the kick and roll values were judged at (hit-impact.ts)
export const kickScaleFlag = (search: string) => /[?&]look=([^&]*,)?kickscale(?=[,&]|$)/i.test(search);
export const kickScale = (dist: number) => Math.min(1.6, Math.max(0.7, dist / KICK_REF_DIST));
export function scaleShove(s: Shove, k: number): Shove {
  return { ...s, along: s.along * k, drop: s.drop * k, side: s.side * k, screen: s.screen && s.screen * k, push: s.push && s.push * k };
}
