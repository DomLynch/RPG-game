// The fatigue driver (Lead's brief B, Dom: "make it realistic"; Bot report 2026-10-06): ONE read-only number per fighter that every
// presentation layer reads, so a man who has gone hard shows it on his body and in the mix. View layer only: this file is not in
// the record digest, reads the sim's stamina and writes nothing back (no cost, regen, threshold, speed, AI or camera change).
//   level  0..1  smoothed tiredness. Raw = 1 - stamina/100, raised by a shrunk ceiling (a wound) and by a leg wound. Rises over ~.75 s, falls over
//                ~2 s, so the breathing slows down after a rest and never snaps off.
//   band   0 fresh · 1 winded (level >= .5: stamina under half, or the ceiling cut hard) · 2 tired (>= .75: stamina under a quarter) · 3 gassed (exhausted)
//   gassed 0..1  smoothed `exhausted` (hands on thighs / tip down); second  1..0 for ~1.5 s after he recovers: the visible second-wind straighten.
// Bodies tune their own look (Goblin quick and shallow, Executioner slow and deep) from these; the thresholds live here, once.
import type { Fighter } from './duel.ts';

export type Fatigue = { level: number; band: 0 | 1 | 2 | 3; gassed: number; second: number };
export const FRESH: Fatigue = { level: 0, band: 0, gassed: 0, second: 0 };
const FULL = 100, RISE = 1 / 45, FALL = 1 / 120, GAS_RISE = 1 / 20, GAS_FALL = 1 / 90, SECOND = 1 / 90;   // per sim tick (60 Hz)
export const WINDED = .5, TIRED = .75;
const toward = (v: number, to: number, up: number, down: number) => to > v ? Math.min(to, v + up) : Math.max(to, v - down);

export const fatigueTarget = (f: Pick<Fighter, 'stamina' | 'maxStamina' | 'legWound'>): number =>
  Math.min(1, Math.max(0, 1 - f.stamina / FULL + (1 - f.maxStamina / FULL) * .5 + (f.legWound ? .1 : 0)));
const HYST = .06;   // a band is left only HYST below the line that entered it, so regen at a threshold cannot flicker the pose or repeat the lesson
export const bandOf = (level: number, gassed: number, was: Fatigue['band'] = 0): Fatigue['band'] =>
  gassed > .5 || (was === 3 && gassed > .3) ? 3 : level >= TIRED - (was === 2 ? HYST : 0) ? 2 : level >= WINDED - (was === 1 ? HYST : 0) ? 1 : 0;

// One tick: `previous` is last tick's value (undefined on the first: start where the body is, no ramp from fresh).
export function stepFatigue(f: Pick<Fighter, 'stamina' | 'maxStamina' | 'legWound' | 'exhausted'>, previous?: Fatigue): Fatigue {
  const target = fatigueTarget(f), was = previous ?? { level: target, band: 0 as const, gassed: +f.exhausted, second: 0 };
  const level = previous ? toward(was.level, target, RISE, FALL) : target, gassed = toward(was.gassed, +f.exhausted, GAS_RISE, GAS_FALL);
  const second = was.gassed > .5 && gassed <= .5 ? 1 : Math.max(0, was.second - SECOND);   // the tick he comes off exhaustion: the straighten starts
  return { level, band: bandOf(level, gassed, was.band), gassed, second };
}

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
