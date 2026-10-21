// ?capture=seed (World lane, Lead 2026-10-21): the walk replays identically so two builds can be shot at the same moment. Pure: no three.js, no DOM, no clock.
// The creatures' wander is already seeded (mobs.ts); what differed between two loads was HOW MANY dt steps the sim had taken by the shot (the mob chunk lands on a
// load-dependent frame) and the order the bodies arrived (the dress phase drew Math.random in that order). Under the flag the sim is HELD at tick 0 (every frame
// is drawn with dt 0) and only moves when the harness calls advance(n): n fixed ticks of captureStep seconds. A still is then a pure function of (build, ticks).
// Donor: a fixed-tick simulation stepped by tick number, as 2004Scape's and EQEmu's world loops are (the sim never reads wall time).
import { mixSeed, nextRandom, TUNING } from '../../src/core/server.ts';
import { seedOf } from '../world/relief.ts';
import { previewRule } from './preview-rules.ts';

export const captureOn = (search: string): boolean => /[?&]capture=seed\b/.test(search);

export type CaptureClock = { readonly step: number; ticks(): number; time(): number; advance(n: number, run: (dt: number, time: number) => void): number };
export function createCaptureClock(step: number = previewRule('captureStep')): CaptureClock {
  let ticks = 0;
  return {
    step,
    ticks: () => ticks,
    time: () => ticks * step,
    advance(n, run) { const count = Math.max(0, Math.floor(n)); for (let i = 0; i < count; i++) { ticks++; run(step, ticks * step); } return ticks; },
  };
}

// A creature's idle phase (0..3 s) from its id: the same number whichever body arrived first.
export const dressPhase = (id: string): number => nextRandom(mixSeed(TUNING.seed, seedOf(`dress:${id}`)))[0] * previewRule('dressPhaseSpan');
