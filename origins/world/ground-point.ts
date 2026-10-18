// Where a ground item stands, in world metres (ground loot, Backend's #2775): the writer's take and the page's pickup prompt must read the same point, so it is ONE pure function that neither side owns (the writer imports it from here; the page cannot import origins/server, which pulls node:crypto).
import { frontierPlan } from '../preview/frontier-plan.ts';
import { toWorld } from './derive.ts';
import type { GroundItem } from './ground-items.ts';

/** The centre of the row's place (a zone of the zone package) plus the row's offset. null = the row names a zone or place this build does not have. */
export function groundPointOf(row: Pick<GroundItem, 'zone' | 'place' | 'offsetX' | 'offsetZ'>): { x: number; z: number } | null {
  const zone = /^zone([1-9][0-9]*)$/.exec(row.zone)?.[1];
  const plan = zone ? frontierPlan(true, zone).zones.find((z) => z.zone === row.place) : undefined;
  if (!plan) return null;
  const c = toWorld({ x: 0, d: plan.depth / 2 }, plan.mount);
  return { x: c.x + (row.offsetX ?? 0), z: c.z + (row.offsetZ ?? 0) };
}
