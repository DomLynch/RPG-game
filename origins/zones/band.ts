// A zone's level band, for a mint that no creature made (a ground pickup, shop stock, a quest reward; Lead 2026-10-17): the lowest and highest level of the zone package's spawn rows, and the
// MIDPOINT of them, which origins/encounters mintRung turns into a rung. Read from the zone rows, so a retuned creature moves the band with no edit here. Pure. Server code reaches zones
// through listed.ts only, so this reads the LISTED zones.
import { listedZone } from './listed.ts';

/** A zone name as the data spells it ('zone1', 'zone5') or a package id ('1'), as the package id. */
export const packageOf = (zone: string): string => zone.replace(/^zone/, '');

/** The zone's [lowest, highest] creature level over its spawn rows, or null when the zone is unknown or has no spawn row. */
export function zoneBand(zone: string): readonly [number, number] | null {
  let z;
  try { z = listedZone(packageOf(zone)); } catch { return null; }
  const rows = z.spawns.rows;
  if (rows.length === 0) return null;
  return [Math.min(...rows.map((r) => r.level[0])), Math.max(...rows.map((r) => r.level[1]))];
}

/** The level a no-creature mint in this zone is priced at: the band's midpoint (rounded down), or null for a zone with no band. */
export function zoneMintLevel(zone: string): number | null {
  const b = zoneBand(zone);
  return b === null ? null : Math.floor((b[0] + b[1]) / 2);
}
