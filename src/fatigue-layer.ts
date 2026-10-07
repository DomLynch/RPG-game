import type { Fatigue } from './fatigue.ts';

// ── The tired body (view layer): additive bone offsets in radians, applied by characters.ts after the mixer on spine_01 (hunch), spine_02
// (breathing chest) and the sword arm (sag), only while the pose is calm. Sign convention is the rig's own (GUARD_TILT: +x on the arm drops the
// tip, +x on the spine leans forward). Per-body tuning: `rate` scales breathing speed, `depth` its amplitude and the posture, `sag` the arm.
export type FatigueTune = { rate?: number; depth?: number; sag?: number; read?: boolean; subtle?: boolean };   // read: ?look=fatigue-read (fatigue-read.ts), the hero-camera-legible pose
// Breaths per second as a phase rate (rad/s): slow and deep when winded (~.4 Hz), fast and heavy when tired (~1.1 Hz), ragged gasps when gassed (~1.5 Hz).
// `subtle` (set by ?look=fatigue-preview, fatigue-preview.ts; Dom 2026-10-07: "more subtle"): see below. Absent = today's layer.
export const breathe = (f: Pick<Fatigue, 'level' | 'gassed'>, t?: FatigueTune): number => 2 * Math.PI * (.2 + 1.1 * f.level + .5 * f.gassed) * (t?.rate ?? 1);
export function fatigueLayer(f: Pick<Fatigue, 'level' | 'gassed' | 'second'>, phase: number, calm: number, t?: FatigueTune): { hunch: number; chest: number; arm: number } {
  // Dom 2026-10-07: the body only tires in the last tenth of stamina (level >= .9) or when exhausted; before that it stays upright (breath audio
  // carries the earlier bands). The gate eases in over that last tenth so the pose never snaps.
  const show = Math.max(f.gassed, Math.max(0, Math.min(1, (f.level - .9) / .1)));
  const depth = (t?.depth ?? 1) * calm * show, sag = (t?.sag ?? 1) * calm * show;
  if (t?.subtle) {   // heave (chest on every breath, a little stronger than the live layer so it reads from behind) + a small tip dip that deepens on the exhale; nothing else moves
    const chest = Math.sin(phase) * (1 + Math.sin(phase * .37) * .35 * f.gassed) * .13 * depth;
    return { hunch: 0, chest, arm: (.09 + .03 * Math.sin(phase - 1.2)) * sag };
  }
  const winded = Math.max(0, Math.min(1, (f.level - .25) / .5));   // breathing shows from a quarter, saturates by three quarters
  const ragged = Math.sin(phase * .37) * .35 * f.gassed;           // a gasp is never the same twice
  const chest = (Math.sin(phase) * (1 + ragged) * .1 * winded + Math.sin(phase * 2) * .02 * f.gassed) * depth;   // a visible heave on every breath at phone size (Strategy's look verdict: x1.6)
  const arch = f.second * .14 * depth;                              // the second wind: a deep lift of the chest as he straightens
  const hunch = (f.level * .2 + f.gassed * .3) * depth - arch * .5;   // grows with the band
  const arm = (f.level * .26 + f.gassed * .3) * sag;
  return { hunch, chest: chest - arch, arm };
}
