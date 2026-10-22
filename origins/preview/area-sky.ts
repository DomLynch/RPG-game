// The generic area-sky hook (World lane, Lead + Strategy GO 2026-10-22): any frontier-plan zone (an "area": the Exchange, the Pit yard...) may name a dome in the goblin-field `names` table (`<area>:sky` -> palette id, areaSky() in goblin-field-rules.ts).
// Entering that area shows its dome and eases the light to the palette's `haze` look; leaving restores the zone's own dome and light. No area is named in code, and an area with no row is no swap.
import type * as THREE from 'three';
import type { GoblinPalette } from '../world/goblin-field-rules.ts';

export type SkyDome = { setVisible(v: boolean): void; follow(camera: THREE.Camera): void };

/** `skyOf` reads the row, `make` builds a dome for a palette (once, on first entry), `own` is the zone's own dome (null until it is built, or when the zone has none), `blendS` is the light's blend time in seconds. */
export function createAreaSky<D extends SkyDome>(opts: { skyOf: (area: string | null) => GoblinPalette | null; make: (p: GoblinPalette) => D; own: () => D | null; blendS: number }) {
  const made = new Map<string, D>();
  let active: GoblinPalette | null = null, preset: string | null = null, k = 0;   // preset: the look being blended to (or, while k falls, from)
  const apply = () => { opts.own()?.setVisible(!active); for (const [id, d] of made) d.setVisible(id === active?.id); };
  return {
    /** The walker is now in `area` (null = in no named area): show its dome, or restore the zone's own. Returns the active palette. */
    enter(area: string | null): GoblinPalette | null {
      const p = opts.skyOf(area);
      if (p && !made.has(p.id)) made.set(p.id, opts.make(p));
      active = p; if (p) preset = p.haze;
      apply(); return active;
    },
    /** The own dome has just been built: hide it again if the walker is already in an area. */
    refresh: apply,
    /** Steps the light blend by dt seconds; returns the look to blend the zone's light toward, and how far (0 = the zone's own light, 1 = the area's). */
    look(dt: number): { preset: string; k: number } | null {
      k = Math.min(1, Math.max(0, k + (active ? dt : -dt) / opts.blendS));
      return preset && k > 0 ? { preset, k } : null;
    },
    follow(camera: THREE.Camera) { for (const d of made.values()) d.follow(camera); },
    active: (): GoblinPalette | null => active,
  };
}
