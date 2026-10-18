// A zone is a data ROW (origins/zone-rows/zone<N>.row.json): this is the one place a row becomes the Zone the loader checks. The registry (generated, scripts/gen-zones.mjs) calls it once per row, so a zone
// costs its row and nothing else. `id` and `level` are the zone number (Dom 2026-10-08: Zone N = level N); `notes` carries the comments a JSON row cannot hold and is not part of the zone. Pure: no three.js, no DOM.
import type { Zone } from './loader.ts';
import { dungeonParts } from './dungeon.ts';

export const ROW_KEYS = ['dungeon', 'name','defaultKind', 'names', 'world', 'biome', 'id', 'spawns', 'kit', 'looks', 'mobLooks', 'place', 'camera', 'look', 'unlisted', 'presence', 'exits', 'warps', 'level', 'notes'] as const;
export type ZoneRow = { [k: string]: unknown };

/** A zone row that names a dungeon (`"dungeon": "<id>"`, origins/zones/dungeon-rows.json) takes its `place`, `spawns` and `look` from the compiled dungeon, and may not also carry them. */
function withDungeon(n: number, source: ZoneRow): ZoneRow {
  if (source.dungeon === undefined) return source;
  for (const k of ['place', 'spawns', 'look']) if (source[k] !== undefined) throw new Error(`zone ${n} row: "${k}" comes from dungeon "${String(source.dungeon)}", not from the row`);
  const { dungeon, ...rest } = source;
  return { ...rest, ...dungeonParts(String(dungeon)) };
}

export function zoneFromRow(n: number, source: ZoneRow): Zone {
  const row = withDungeon(n, source);
  for (const k of Object.keys(source)) if (!(ROW_KEYS as readonly string[]).includes(k)) throw new Error(`zone ${n} row: unknown key "${k}"`);
  if (row.id !== undefined && String(row.id) !== String(n)) throw new Error(`zone ${n} row: id ${String(row.id)} is not zone ${n}`);
  for (const k of ['name', 'kit', 'looks']) if (row[k] === undefined) throw new Error(`zone ${n} row: "${k}" is required`);
  if (row.level !== undefined && !(row.unlisted === true && Number.isInteger(row.level) && (row.level as number) >= 1)) throw new Error(`zone ${n} row: "level" is only for an unlisted sandbox zone (Zone N = level N for the rest), a whole number >= 1`);
  const head = { id: String(n), level: row.level !== undefined ? (row.level as number) : n, name: row.name, ...(row.defaultKind ? { defaultKind: row.defaultKind } : {}), names: row.names ?? {}, world: row.world ?? [], ...(row.biome ? { biome: row.biome } : {}), ...(row.camera ? { camera: row.camera } : {}), ...(row.look ? { look: row.look } : {}), ...(row.unlisted === true ? { unlisted: true } : {}) };   // key order is the loaded zone's: id, level, name, names, world, biome?, camera?, spawns, kit, looks, mobLooks?, place?
  return { ...head, spawns: row.spawns ?? { openers: {}, rows: [] }, kit: row.kit, looks: row.looks, ...(row.mobLooks ? { mobLooks: row.mobLooks } : {}), ...(row.place ? { place: row.place } : {}), ...(row.presence ? { presence: row.presence } : {}), ...(row.exits ? { exits: row.exits } : {}), ...(row.warps ? { warps: row.warps } : {}),...(row.band ? { band: row.band } : {}) } as unknown as Zone;
}
