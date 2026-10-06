// ?look=armfeel (Dom 2026-10-06, via Strategy and Lead): the melee-relevant hit feel of his Armagedom prototype (docs/COMBAT_HANDOFF.md, "Universal
// impact effects"), as a LOOK TEST. Presentation only: nothing here is read by the simulation, so a fight's records and replays are byte-identical
// with the flag on or off (tests/armfeel.test.ts pins both). `&feel=high|low|off` scales every effect; `off` is the game as it is.
// Combat's half: the victim's flinch (a lean and a nudge on a visual pivot; the root and the collider never move) and the weapon's hit hold
// (a short extra freeze at contact, capped so a hit never freezes longer than the heaviest hit already does). World adds the white flash, the
// burst pool and the layered sounds on top of this branch.
import type { CombatEvent } from './duel.ts';

export type Feel = 'high' | 'low' | 'off';
export const FEELS: readonly Feel[] = ['high', 'low', 'off'];
// `?look=armfeel` turns it on (High unless `&feel=` says otherwise; reduced motion starts at Low, as the prototype does); without the look, undefined.
export function armfeelFrom(search: string, reducedMotion = false): Feel | undefined {
  const params = new URLSearchParams(search);
  if (!(params.get('look') ?? '').split(',').includes('armfeel')) return undefined;
  const feel = params.get('feel');
  return feel === 'high' || feel === 'low' || feel === 'off' ? feel : reducedMotion ? 'low' : 'high';
}

// The handoff's numbers. Low: energy 0.4, no holds. Off: nothing added.
export const ARMFEEL = {
  lean: 0.45, leanKill: 0.9,            // rad at energy 1
  nudge: 0.16,                          // metres along the blow
  decay: 12, decayKill: 10,             // per second
  hold: 0.045, holdKill: 0.08,          // seconds the victim's reaction waits before it decays
  lowEnergy: 0.4,
  // The weapon's hit hold (40–80 ms, handoff: 40 light, 80 kill): by the blow's tier.
  weaponHoldMs: { half: 40, full: 60, kill: 80 },
} as const;
export const energyOf = (feel: Feel): number => (feel === 'high' ? 1 : feel === 'low' ? ARMFEEL.lowEnergy : 0);

// The heaviest stop a hit gets today (main.ts HEAVY_HIT 90 ms + hit-impact.ts full tier 5 frames): no armfeel hold may take a frame past it.
export const FULL_TIER_STOP_MS = 90 + (5 * 1000) / 60;
// Extra milliseconds the blade holds at contact, on top of the stop the frame already has (`stopMs`): the hold, but never past the full-tier
// stop. A frame that already stops that long (a heavy, a kill) gets none. High only (Low and Off have no holds).
export function weaponHoldMs(feel: Feel, stopMs: number, events: readonly CombatEvent[], tier: 'half' | 'full' | null): number {
  if (feel !== 'high' || stopMs <= 0 || !tier) return 0;
  const want = events.some((e) => e.type === 'Killed') ? ARMFEEL.weaponHoldMs.kill : ARMFEEL.weaponHoldMs[tier];
  return Math.max(0, Math.min(want, FULL_TIER_STOP_MS - stopMs));
}

// One victim's flinch: a lean about the pivot and a nudge along the blow, both scaled by an energy that starts at 1 per landed blow and decays
// exponentially after a short hold. `update` returns the pose of the visual pivot for this frame.
export type Pose = { lean: number; dx: number; dz: number };
export class Flinch {
  private energy = 0; private hold = 0; private kill = false; private dirX = 0; private dirZ = 0;
  feel: Feel;
  constructor(feel: Feel) { this.feel = feel; }
  // `heading`: the blow's heading (the attacker's facing, radians); the victim leans and is nudged the way it travels.
  hit(heading: number, kill: boolean): void {
    if (this.feel === 'off') return;
    this.energy = 1; this.kill = kill; this.dirX = Math.sin(heading); this.dirZ = Math.cos(heading);
    this.hold = this.feel === 'high' ? (kill ? ARMFEEL.holdKill : ARMFEEL.hold) : 0;   // Low has no holds
  }
  // dt seconds of the frame; the hold is spent first, and only what is left decays the energy (`visualDt = max(0, dt - hold)`).
  update(dt: number): Pose {
    if (this.energy <= 0) return { lean: 0, dx: 0, dz: 0 };
    const spent = Math.min(this.hold, dt); this.hold -= spent;
    this.energy *= Math.exp(-(this.kill ? ARMFEEL.decayKill : ARMFEEL.decay) * Math.max(0, dt - spent));
    if (this.energy < 0.001) { this.energy = 0; return { lean: 0, dx: 0, dz: 0 }; }
    const k = energyOf(this.feel) * this.energy;
    return { lean: (this.kill ? ARMFEEL.leanKill : ARMFEEL.lean) * k, dx: this.dirX * ARMFEEL.nudge * k, dz: this.dirZ * ARMFEEL.nudge * k };
  }
  clear(): void { this.energy = 0; this.hold = 0; }
  get active(): boolean { return this.energy > 0; }
}
