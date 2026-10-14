// Where a zone sits on the Region 1 map, as DATA in the zone's own folder (origins/zones/zone<N>/place.ts; Dom 2026-10-09, scalable zones without micromanagement). A zone folder adds its world-data
// zone, the landmark + road it hangs off an EXISTING zone, its waypoints and its spawn groups; region1 reads every folder's place from the generated registry (applyPlaces) and names no zone itself.
// Pure data and pure functions: no DOM, no clock; node-safe (the server reads region1 too).
export type Slot = { u: number; v: number; facing: number };
export type Join = { zone: string; landmark: string; at: Slot; before?: string; link: string; to: string; here: string; there: string };   // landmark `at` + connection `link` added to the EXISTING zone `zone`; `before` keeps the landmark's key order (the plan walks it)
export type SpawnGroup = { id: string; at: string; characters: string[] };
export type Place = { zones: Record<string, Record<string, unknown>>; joins: Join[]; waypoints: string[]; spawns: SpawnGroup[] };
type Zones = Record<string, Record<string, unknown>>;

/** Zones in number order (zone2 before zone10), the order everything below is applied in. */
export const placesInOrder = (registry: Readonly<Record<string, { place?: Place }>>): Place[] =>
  Object.keys(registry).sort((a, b) => Number(a) - Number(b)).flatMap((id) => (registry[id]!.place ? [registry[id]!.place!] : []));

/** `base` (the world-data zones of the region) with every place's zones added and every join attached to its parent zone. Throws on a join to a zone that is not there: a typo must not vanish. */
export function applyZones(base: Zones, places: readonly Place[]): Zones {
  const out: Zones = { ...base };
  for (const p of places) for (const [id, def] of Object.entries(p.zones)) { if (out[id]) throw new Error(`zone ${id} is already on the map`); out[id] = def; }
  for (const p of places) for (const j of p.joins) {
    const parent = out[j.zone]; if (!parent) throw new Error(`join ${j.landmark}: no zone ${j.zone}`);
    const layout = { ...(parent.layout as Record<string, Slot>) }, entries = Object.entries(layout), cut = j.before ? entries.findIndex(([k]) => k === j.before) : -1;
    if (j.before && cut < 0) throw new Error(`join ${j.landmark}: no landmark ${j.before} in ${j.zone}`);
    const next = cut < 0 ? [...entries, [j.landmark, j.at] as const] : [...entries.slice(0, cut), [j.landmark, j.at] as const, ...entries.slice(cut)];
    out[j.zone] = { ...parent, layout: Object.fromEntries(next), connections: { ...(parent.connections as object), [j.link]: { to: j.to, kind: 'road', here: j.here, there: j.there } } };
  }
  return out;
}
export const placedWaypoints = (places: readonly Place[]): string[] => places.flatMap((p) => p.waypoints);
export const placedSpawns = (places: readonly Place[]): SpawnGroup[] => places.flatMap((p) => p.spawns);
/** Every name a place introduces: region1's source must contain none of them (tests/zone-place.test.ts). */
export const placeNames = (p: Place): string[] => [...Object.keys(p.zones), ...p.joins.flatMap((j) => [j.landmark, j.link]), ...p.waypoints, ...p.spawns.map((s) => s.id)];
