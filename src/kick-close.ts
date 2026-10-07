// LOOK TEST behind `?look=kickclose` (default OFF; Lead + Combat 2026-10-07, on #1582's audit): the KICK light also goes out while the foe is opening the
// gap. Presentation only: the HUD keeps a short rolling gap history; no sim input, no record change. The rule (Combat's probe table is in the PR body):
// lit = gap <= KICK_LANDS (hud.ts) AND gap now minus the gap 4 ticks ago <= 0.03 m. With no sample that old yet the foe is not called retreating.
export const kickCloseFlag = (search: string) => (new URLSearchParams(search).get('look') ?? '').split(',').includes('kickclose');

export const KICK_CLOSE_TICKS = 4;
export const KICK_CLOSE_GROWTH = 0.03;   // metres the gap may grow over the window before the light goes out

export function createGapHistory() {
  let samples: { tick: number; gap: number }[] = [];
  return {
    // One sample per sim tick (a repeated tick overwrites); a tick that goes backwards is a new fight or a replay seek: start over.
    record(tick: number, gap: number) {
      const last = samples[samples.length - 1];
      if (last && tick < last.tick) samples = [];
      if (last && tick === last.tick) samples[samples.length - 1] = { tick, gap };
      else samples.push({ tick, gap });
      if (samples.length > 16) samples.shift();
    },
    // The newest sample at least KICK_CLOSE_TICKS old is the "4 ticks ago" gap (a frame that carried several ticks skips samples; the older one stands in).
    retreating(tick: number, gap: number): boolean {
      for (let i = samples.length - 1; i >= 0; i--) if (samples[i].tick <= tick - KICK_CLOSE_TICKS) return gap - samples[i].gap > KICK_CLOSE_GROWTH + 1e-9;   // the epsilon: 1.03 - 1.0 is 0.030000000000000027 in floats, and exactly 3 cm is not more than 3 cm
      return false;
    },
  };
}
