// Where a ground item stands, in world metres (ground loot, Backend's #2775): the writer's take and the page's pickup prompt must read the same point, so it is ONE pure function that neither side owns (the writer imports it from here; the page cannot import origins/server, which pulls node:crypto).
import { frontierPlan, type Frontier } from '../preview/frontier-plan.ts';
import { toWorld } from './derive.ts';
import type { GroundItem } from './ground-items.ts';

// frontierPlan(true, zone) lays out the WHOLE Frontier (2 ms on a fast CPU, ~80 ms on a phone) and the pickup poll asked for it once per ground row every 3 s, for the whole session (LoAF trace on a
// phone profile, Web 2026-10-21: an 80 ms setInterval task every 3.000 s). It is pure, so it is built once per zone and kept for the life of the module, never cleared. Checked in frontier-plan.ts and what it
// calls: its inputs are (flat, zoneId), the static Region 1 data (loadRegion1), concordMounts(), loadZone(zoneId) and the exits table; it reads no location, window, Date, random or storage. The one ambient input
// is the build-time VITE_UNLISTED_ZONES flag (zones/loader.ts opensNow), constant for a built page and for a server process.
const plans = new Map<string, Frontier>();
export function groundPlanOf(zone: string): Frontier {
  let plan = plans.get(zone);
  if (!plan) { plan = frontierPlan(true, zone); plans.set(zone, plan); }   // set after the build: a zone that throws is not cached
  return plan;
}

/** The centre of the row's place (a zone of the zone package) plus the row's offset. null = the row names a zone or place this build does not have. */
export function groundPointOf(row: Pick<GroundItem, 'zone' | 'place' | 'offsetX' | 'offsetZ'>): { x: number; z: number } | null {
  const zone = /^zone(0|[1-9][0-9]*)$/.exec(row.zone)?.[1];   // zone0 is the town; the id is a STRING, so "0" is a zone (never test it for truth)
  let plan: Frontier['zones'][number] | undefined;
  if (zone !== undefined) {
    try { plan = groundPlanOf(zone).zones.find((z) => z.zone === row.place); }
    catch (e) { if (!(e instanceof Error && /^no zone /.test(e.message))) throw e; }   // a zone number this build has no row for (loadZone: "no zone N") is a row this build does not have: null, as before
  }
  if (!plan) return null;
  const c = toWorld({ x: 0, d: plan.depth / 2 }, plan.mount);
  return { x: c.x + (row.offsetX ?? 0), z: c.z + (row.offsetZ ?? 0) };
}
