// Time of day as rows (World, top-30 row 18; donors: EQEmu spawn conditions (a spawn group is live in a day part) and weather-by-zone, UO's per-region weather; nothing copied). Four tables in
// clock.json, loaded through the shared registry loader:
//   dayParts   - the parts of the game day and whether each is night (the sky's own clock, origins/preview/daynight.ts nightness, decides WHICH part it is; the row says what the part IS);
//   clockBonus - per alignment, a percent bonus by day and by night (lawful stronger by day, chaotic by night; a percent the damage and defence rules may add, the same shape as the patrons'
//                clock-half templates). Rows only: no sim file reads it yet;
//   nightSpawns - spawn rows live in one day part: {part, zone, character (a creature row id), count}. A night camp is one row; the table ships empty (no content invented);
//   weather    - per biome, weighted picks of arena weather kinds (src/fight/arena-defs.json weather rows); `weatherFor` draws one per game day from the zone's seed, same day = same weather.
// Pure: no DOM, no clock, no storage. Wiring the page (spawn the night rows when `night`, set the weather preset for the day) reads these functions and is a separate step.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/registry.ts';
import { mixSeed, nextRandom } from '../../src/core/server.ts';
import DEFS from './clock.json' with { type: 'json' };
import MANIFEST from './clock.manifest.json' with { type: 'json' };

export type DayPartRow = { readonly order: number; readonly night: boolean };
export type ClockBonusRow = { readonly order: number; readonly day: number; readonly night: number };
export type NightSpawnRow = { readonly order: number; readonly part: string; readonly zone: string; readonly character: string; readonly count: number };
export type WeatherPickRow = { readonly order: number; readonly picks: Readonly<Record<string, number>> };
export type ClockDefs = { dayParts: Readonly<Record<string, DayPartRow>>; clockBonus: Readonly<Record<string, ClockBonusRow>>; nightSpawns: Readonly<Record<string, NightSpawnRow>>; weather: Readonly<Record<string, WeatherPickRow>> };
export type ClockKnown = { weatherKinds: Iterable<string>; biomes: Iterable<string>; zones: Iterable<string>; characters: Iterable<string> };

/** The one loader: the registry's duplicate/missing/mistyped checks, then the cross-table rules (a spawn names a real day part, zone and creature; a weather pick names a real weather kind with a positive weight; the day needs a night part and a day part). */
export function loadClockDefs(raw: unknown, known: ClockKnown): ClockDefs {
  loadRegistry(MANIFEST.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, 'clock.json')));
  const d = raw as ClockDefs, kinds = new Set(known.weatherKinds), biomes = new Set(known.biomes), zones = new Set(known.zones), characters = new Set(known.characters);
  if (!Object.values(d.dayParts).some((p) => p.night) || !Object.values(d.dayParts).some((p) => !p.night)) throw Error('clock.json: dayParts needs a night part and a day part');
  for (const [id, s] of Object.entries(d.nightSpawns)) {
    if (!d.dayParts[s.part]) throw Error(`clock.json nightSpawn "${id}": ${s.part} is not a day part`);
    if (!zones.has(s.zone)) throw Error(`clock.json nightSpawn "${id}": ${s.zone} is not a zone`);
    if (!characters.has(s.character)) throw Error(`clock.json nightSpawn "${id}": ${s.character} is not a creature row`);
    if (!(s.count >= 1 && s.count <= 8)) throw Error(`clock.json nightSpawn "${id}": count is 1..8`);
  }
  for (const [id, w] of Object.entries(d.weather)) {
    if (!biomes.has(id)) throw Error(`clock.json weather "${id}": not a biome`);
    const picks = Object.entries(w.picks);
    if (!picks.length) throw Error(`clock.json weather "${id}": no picks`);
    for (const [kind, weight] of picks) {
      if (!kinds.has(kind)) throw Error(`clock.json weather "${id}": ${kind} is not a weather kind (src/fight/arena-defs.json)`);
      if (!(typeof weight === 'number' && Number.isFinite(weight) && weight > 0)) throw Error(`clock.json weather "${id}": ${kind} needs a weight > 0`);
    }
  }
  return d;
}
export const CLOCK: ClockDefs = DEFS as unknown as ClockDefs;   // validated against the real vocabularies by origins/world/clock.test.ts

const byOrder = <T extends { order: number }>(t: Readonly<Record<string, T>>): [string, T][] => Object.entries(t).sort((a, b) => a[1].order - b[1].order);
/** The day part a moment is in: the first (lowest order) part whose `night` flag matches. `night` comes from the sky clock (origins/preview/daynight.ts isNight). */
export const partOf = (night: boolean, defs: ClockDefs = CLOCK): string => byOrder(defs.dayParts).find(([, p]) => p.night === night)![0];
/** The percent bonus an alignment gets at this moment (0 for an alignment with no row: neutral). */
export const clockBonusFor = (alignment: string, night: boolean, defs: ClockDefs = CLOCK): number => { const r = defs.clockBonus[alignment]; return r ? (night ? r.night : r.day) : 0; };
/** The night (or day) spawn rows live in a zone right now, in table order. */
export const spawnsFor = (zone: string, night: boolean, defs: ClockDefs = CLOCK): NightSpawnRow[] => byOrder(defs.nightSpawns).map(([, s]) => s).filter((s) => s.zone === zone && s.part === partOf(night, defs));
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** The weather kind for a biome on a game day: a seeded weighted draw over the biome's picks (same seed, biome and day = same weather; a biome with no row is 'clear', i.e. none). */
export function weatherFor(biome: string, day: number, seed: number, defs: ClockDefs = CLOCK): string | null {
  const row = defs.weather[biome];
  if (!row) return null;
  const picks = Object.entries(row.picks).sort((a, b) => a[0] < b[0] ? -1 : 1), total = picks.reduce((n, [, w]) => n + w, 0);
  let roll = nextRandom(mixSeed(seed, hash(biome) + day * 7919))[0] * total;
  for (const [kind, weight] of picks) { if (roll < weight) return kind; roll -= weight; }
  return picks[picks.length - 1]![0];
}
