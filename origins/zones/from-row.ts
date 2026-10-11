// A zone is a data ROW (origins/zone-rows/zone<N>.row.json): this is the one place a row becomes the Zone the loader checks. The registry (generated, scripts/gen-zones.mjs) calls it once per row, so a zone
// costs its row and nothing else. `id` and `level` are the zone number (Dom 2026-10-08: Zone N = level N); `notes` carries the comments a JSON row cannot hold and is not part of the zone. Pure: no three.js, no DOM.
import type { Zone } from './loader.ts';

export const ROW_KEYS = ['name', 'names', 'world', 'biome', 'id', 'spawns', 'kit', 'looks', 'mobLooks', 'place', 'camera', 'notes'] as const;
export type ZoneRow = { [k: string]: unknown };

export function zoneFromRow(n: number, row: ZoneRow): Zone {
  for (const k of Object.keys(row)) if (!(ROW_KEYS as readonly string[]).includes(k)) throw new Error(`zone ${n} row: unknown key "${k}"`);
  if (row.id !== undefined && String(row.id) !== String(n)) throw new Error(`zone ${n} row: id ${String(row.id)} is not zone ${n}`);
  for (const k of ['name', 'kit', 'looks']) if (row[k] === undefined) throw new Error(`zone ${n} row: "${k}" is required`);
  const { notes: _notes, id: _id, spawns, biome, camera, mobLooks, place, ...rest } = row;   // key order is the loaded zone's: id, level, name, names, world, biome?, camera?, spawns, kit, looks, mobLooks?, place?
  const head = { id: String(n), level: n, name: rest.name, names: rest.names ?? {}, world: rest.world ?? [], ...(biome ? { biome } : {}), ...(camera ? { camera } : {}) };
  return { ...head, spawns: spawns ?? { openers: {}, rows: [] }, kit: rest.kit, looks: rest.looks, ...(mobLooks ? { mobLooks } : {}), ...(place ? { place } : {}) } as unknown as Zone;
}
