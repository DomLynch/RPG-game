// The page side of a zone exit (zones/exits.ts rows): the doors this page stands on, the arrival after a crossing, and the walk-onto-it trigger. Pure, so zone-exit.test.ts can fire it; main.ts only
// supplies the fade and the navigation. A crossing is the page-to-page door Lead ruled for the beta dungeon: walk onto the landmark, fade, save (the page's pagehide closes the presence socket, which saves),
// load the other zone page standing just inside its landmark. No streaming. A door only fires after the walker has been outside its radius once, so an arrival never bounces straight back.
import type { ExitRow } from '../zones/exits.ts';
import { toWorld } from '../world/derive.ts';
import type { Frontier } from './frontier-plan.ts';

type Pt = { x: number; z: number };
const where = (f: Frontier, zone: string, landmark: string): { at: Pt; centre: Pt } | null => {
  const z = f.zones.find((q) => q.zone === zone && q.landmarks[landmark]); if (!z) return null;
  return { at: z.landmarks[landmark]!, centre: toWorld({ x: 0, d: z.depth / 2 }, z.mount) };   // the zone's middle, as groundPointOf reads it
};

/** The doors this page shows: each exit row whose landmark stands in the page's plan. */
export const doorsOf = (f: Frontier, rows: readonly ExitRow[]): { row: ExitRow; x: number; z: number }[] =>
  rows.flatMap((row) => { const w = where(f, row.zone, row.landmark); return w ? [{ row, x: w.at.x, z: w.at.z }] : []; });

/** Where a crossing through exit `via` lands on this page: the row's arriveM (past the door's radius; warp-landmarks.json holds the same points for presence, zone-exit.test.ts pins them) inside the `arrive` landmark, towards the zone's middle, facing it. Null when `via` names no exit that leads to this page. */
export function arrival(f: Frontier, pkg: string, via: string | null, rows: readonly ExitRow[]): { row: ExitRow; x: number; z: number; heading: number } | null {
  const row = rows.find((r) => r.id === via && r.to === pkg); if (!row) return null;
  const zone = f.zones.find((q) => q.landmarks[row.arrive]); if (!zone) return null;
  const w = where(f, zone.zone, row.arrive)!, dx = w.centre.x - w.at.x, dz = w.centre.z - w.at.z, len = Math.hypot(dx, dz) || 1;
  return { row, x: w.at.x + (dx / len) * row.arriveM, z: w.at.z + (dz / len) * row.arriveM, heading: Math.atan2(dx, dz) };
}

/** The address of the page a crossing loads: the same page with ?zone= the target and ?via= the exit taken (every other flag rides along; a /zone/<id>/ path is rewritten). */
export function exitHref(href: string, row: ExitRow): string {
  const u = new URL(href);
  u.pathname = u.pathname.replace(/^\/zone\/[^/]+/, `/zone/${row.to}`);
  u.searchParams.set('zone', row.to); u.searchParams.set('via', row.id);
  return u.toString();
}

/** The trigger: `update` each frame with the walker's place; `go` runs once when he steps inside a door he has already been outside of. */
export function createZoneExit(doors: readonly { row: ExitRow; x: number; z: number }[], go: (row: ExitRow) => void): { update(x: number, z: number): void } {
  const armed = new Set<string>(); let gone = false;
  return {
    update(x, z) {
      if (gone) return;
      for (const d of doors) {
        const inside = Math.hypot(x - d.x, z - d.z) <= d.row.radiusM;
        if (!inside) armed.add(d.row.id);
        else if (armed.has(d.row.id)) { gone = true; go(d.row); return; }
      }
    },
  };
}
