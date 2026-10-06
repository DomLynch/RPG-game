import type { Fatigue } from './fatigue.ts';

// ── The tired body (view layer): additive bone offsets in radians, applied by characters.ts after the mixer on spine_01 (hunch), spine_02
// (breathing chest) and the sword arm (sag), only while the pose is calm. Sign convention is the rig's own (GUARD_TILT: +x on the arm drops the
// tip, +x on the spine leans forward). Per-body tuning: `rate` scales breathing speed, `depth` its amplitude and the posture, `sag` the arm.
export type FatigueTune = { rate?: number; depth?: number; sag?: number };
// Breaths per second as a phase rate (rad/s): slow and deep when winded (~.4 Hz), fast and heavy when tired (~1.1 Hz), ragged gasps when gassed (~1.5 Hz).
export const breathe = (f: Pick<Fatigue, 'level' | 'gassed'>, t?: FatigueTune): number => 2 * Math.PI * (.2 + 1.1 * f.level + .5 * f.gassed) * (t?.rate ?? 1);
export function fatigueLayer(f: Pick<Fatigue, 'level' | 'gassed' | 'second'>, phase: number, calm: number, t?: FatigueTune): { hunch: number; chest: number; arm: number } {
  const depth = (t?.depth ?? 1) * calm, sag = (t?.sag ?? 1) * calm;
  const winded = Math.max(0, Math.min(1, (f.level - .25) / .5));   // breathing shows from a quarter, saturates by three quarters
  const ragged = Math.sin(phase * .37) * .35 * f.gassed;           // a gasp is never the same twice
  const chest = (Math.sin(phase) * (1 + ragged) * .06 * winded + Math.sin(phase * 2) * .015 * f.gassed) * depth;
  const arch = f.second * .14 * depth;                              // the second wind: a deep lift of the chest as he straightens
  const hunch = (f.level * .12 + f.gassed * .3) * depth - arch * .5;
  const arm = (f.level * .16 + f.gassed * .3) * sag;
  return { hunch, chest: chest - arch, arm };
}
