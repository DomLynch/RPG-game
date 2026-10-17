// Where a zone sits on the Region 1 map, as DATA in the zone's own folder (origins/zones/zone<N>/place.ts; Dom 2026-10-09, scalable zones without micromanagement). A zone folder adds its world-data
// zone, the landmark + road it hangs off an EXISTING zone, its waypoints and its spawn groups; region1 reads every folder's place from the generated registry (applyPlaces) and names no zone itself.
// Pure data and pure functions: no DOM, no clock; node-safe (the server reads region1 too).
export type Slot = { u: number; v: number; facing: number };
export type Join = { zone: string; landmark: string; at: Slot; before?: string; link: string; to: string; here: string; there: string };   // landmark `at` + connection `link` added to the EXISTING zone `zone`; `before` keeps the landmark's key order (the plan walks it)
/** A spawn group's creature: a bare id (weight 1) or `{ id, weight, max? }` (docs/specs/origins/weighted-spawns.md; donor EQEmu spawnentry.chance / spawn_limit, shape only). */
export type SpawnEntry = string | { id: string; weight: number; max?: number };
export type SpawnGroup = { id: string; at: string; characters: SpawnEntry[] };
export type Entry = { id: string; weight: number; max?: number };
export const entryOf = (e: SpawnEntry): Entry => (typeof e === 'string' ? { id: e, weight: 1 } : e);
/** The ids a group names, in order, each once: what the registry (and every reader that only asks WHO) sees. */
export const spawnIds = (g: Pick<SpawnGroup, 'characters'>): string[] => [...new Set(g.characters.map((e) => entryOf(e).id))];
/** Whether a group is the one-kind camp every row was before weights: a single bare id. Such a group never touches a roll stream, so its creatures are exactly what they were. */
export const isPlainGroup = (g: Pick<SpawnGroup, 'characters'>): boolean => g.characters.length <= 1 && g.characters.every((e) => typeof e === 'string');
/** What a weighted camp is made of: slot i takes an entry in proportion to its weight, at most `max` of one id per camp. `roll(i)` is the slot's own draw in [0,1) (the caller keys it by zone, group and slot, so a new group never reshuffles another). */
export function rollCamp(entries: readonly Entry[], size: number, roll: (slot: number) => number): string[] {
  const out: string[] = [], taken = new Map<string, number>();
  for (let i = 0; i < size; i++) {
    const open = entries.filter((e) => (taken.get(e.id) ?? 0) < (e.max ?? Infinity)), total = open.reduce((n, e) => n + e.weight, 0);
    if (!open.length) break;   // every entry is at its max: validation (spawnProblems) makes this unreachable, a short camp is the safe answer
    let p = roll(i) * total, pick = open[open.length - 1]!;
    for (const e of open) { if ((p -= e.weight) < 0) { pick = e; break; } }
    taken.set(pick.id, (taken.get(pick.id) ?? 0) + 1); out.push(pick.id);
  }
  return out;
}
/** The problems in one group's entries (empty = valid): positive weights, whole `max` >= 1, no id twice, and a camp of `campMax` can always be filled (some entry has no max, or a max >= campMax). */
export function spawnProblems(g: SpawnGroup, campMax: number): string[] {
  const bad: string[] = [], seen = new Set<string>(), es = g.characters.map(entryOf);
  for (const e of es) {
    if (typeof e.id !== 'string' || !e.id) bad.push(`group ${g.id}: an entry has no id`);
    if (seen.has(e.id)) bad.push(`group ${g.id}: ${e.id} is listed twice`); seen.add(e.id);
    if (!(typeof e.weight === 'number' && Number.isFinite(e.weight) && e.weight > 0)) bad.push(`group ${g.id}: ${e.id} weight ${String(e.weight)} is not a number > 0`);
    if (e.max !== undefined && !(Number.isInteger(e.max) && e.max >= 1)) bad.push(`group ${g.id}: ${e.id} max ${String(e.max)} is not a whole number >= 1`);
  }
  if (es.length && !es.some((e) => e.max === undefined || e.max >= campMax)) bad.push(`group ${g.id}: every entry has a max below the camp size ${campMax}`);
  return bad;
}
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
