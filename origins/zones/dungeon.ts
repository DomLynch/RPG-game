// A dungeon is a data ROW (origins/zones/dungeon-rows.json) with a THEME row (dungeon-themes.json): a room graph, creature rows, encounters (a creature at a room), one boss encounter, a level band and a look.
// This file is the only code that reads them. It checks the row at load (the graph is connected, every link comes back, every ref resolves) and compiles it into the three zone-row parts the loader already reads:
// `place` (the rooms as landmarks, the waypoints, the camps), `spawns` (the creature rows) and `look` (the theme's). A zone row names its dungeon (`"dungeon": "<id>"`, from-row.ts) instead of carrying those parts, so the
// Bone Hollow and any later dungeon run the same framework (Donors: EQEmu spawngroup/spawn2 for encounters = a creature group at a point; AzerothCore instance + creature_template + loot_template for boss and loot refs). Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './dungeon-rows.json' with { type: 'json' };
import MANIFEST from './dungeon-rows.manifest.json' with { type: 'json' };
import THEMES from './dungeon-themes.json' with { type: 'json' };
import THEMES_MANIFEST from './dungeon-themes.manifest.json' with { type: 'json' };
import EXITS_DEFS from './exit-rows.json' with { type: 'json' };
import LOOT from '../region1/loot-tables.json' with { type: 'json' };

type At = { readonly u: number; readonly v: number; readonly facing: number };
export type DungeonRoom = { readonly id: string; readonly at: At; readonly piece: string; readonly links: readonly string[] };
export type DungeonCreature = { readonly id: string; readonly level: readonly [number, number]; readonly loot: string; readonly named?: boolean; readonly [k: string]: unknown };
export type DungeonEncounter = { readonly id: string; readonly room: string; readonly creature: string };
export type Dungeon = {
  readonly id: string; readonly name: string; readonly theme: string; readonly level: readonly [number, number]; readonly world: string; readonly size: { readonly width: number; readonly depth: number };
  readonly entrance: { readonly room: string; readonly exit?: string }; readonly rooms: readonly DungeonRoom[]; readonly openers?: Readonly<Record<string, string>>;
  readonly creatures: readonly DungeonCreature[]; readonly encounters: readonly DungeonEncounter[]; readonly boss: { readonly encounter: string };
  readonly mount?: { readonly waypointsBefore?: readonly string[]; readonly connections?: unknown; readonly density?: unknown; readonly ambience?: unknown; readonly joins?: unknown };
};
export type DungeonTheme = { readonly id: string; readonly look: Readonly<Record<string, unknown>>; readonly pieces: Readonly<Record<string, string>> };

type ExitLite = { readonly id: string; readonly landmark: string };

/** The dungeons of a rows file, checked: a table problem (a missing field, an unknown theme, loot or exit id) and every graph rule below throws with the dungeon's id. */
export function loadDungeons(raw: { dungeons?: readonly unknown[] }, themes: { themes?: readonly unknown[] } = THEMES, exits: readonly ExitLite[] = EXITS_DEFS.exits, lootIds: Iterable<string> = (LOOT as readonly { id: string }[]).map((t) => t.id)): readonly Dungeon[] {
  loadRegistry([tableFromFile(THEMES_MANIFEST.tables[0] as unknown as Manifest, themes, 'dungeon-themes.json'), tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'dungeon-rows.json')], { loottable: lootIds, 'zone-exit': exits.map((e) => e.id) });   // the same table names the repo-wide gate (scripts/registry-check.mjs) registers: loottable (region1/loot-tables.manifest.json) and zone-exit (exit-rows.manifest.json); standing alone at runtime, this call supplies their ids itself
  const byTheme = new Map((themes.themes as readonly DungeonTheme[]).map((t) => [t.id, t]));
  const rows = (raw.dungeons ?? []) as readonly Dungeon[];
  for (const d of rows) checkDungeon(d, byTheme.get(d.theme)!, exits);
  return rows;
}

const fail = (d: Dungeon, why: string): never => { throw new Error(`dungeon "${d.id}": ${why}`); };
const unique = (d: Dungeon, what: string, ids: readonly string[]): void => { const seen = new Set<string>(); for (const i of ids) { if (seen.has(i)) fail(d, `${what} id "${i}" is used twice`); seen.add(i); } };

function checkDungeon(d: Dungeon, theme: DungeonTheme, exits: readonly ExitLite[]): void {
  if (!(d.level[0] <= d.level[1])) fail(d, `level band [${d.level.join(', ')}] is not lo <= hi`);
  unique(d, 'room', d.rooms.map((r) => r.id)); unique(d, 'creature', d.creatures.map((c) => c.id)); unique(d, 'encounter', d.encounters.map((e) => e.id));
  const rooms = new Map(d.rooms.map((r) => [r.id, r]));
  for (const r of d.rooms) {
    if (!(r.at.u >= 0 && r.at.u <= 1 && r.at.v >= 0 && r.at.v <= 1)) fail(d, `room "${r.id}" lies outside the zone (u, v must be 0..1)`);
    if (!Object.hasOwn(theme.pieces, r.piece)) fail(d, `room "${r.id}": piece "${r.piece}" is not in theme "${theme.id}"`);
    for (const l of r.links) { const o = rooms.get(l); if (!o) fail(d, `room "${r.id}" links to "${l}", which is not a room`); else if (!o.links.includes(r.id)) fail(d, `room "${r.id}" links to "${l}" but "${l}" does not link back`); }
  }
  if (!rooms.has(d.entrance.room)) fail(d, `entrance room "${d.entrance.room}" is not a room`);
  if (d.entrance.exit !== undefined) { const e = exits.find((x) => x.id === d.entrance.exit); if (e && e.landmark !== d.entrance.room) fail(d, `entrance exit "${e.id}" stands on landmark "${e.landmark}", not on the entrance room "${d.entrance.room}"`); }
  const reach = reachable(d);
  for (const r of d.rooms) if (!reach.has(r.id)) fail(d, `room "${r.id}" cannot be reached from the entrance`);
  const creatures = new Map(d.creatures.map((c) => [c.id, c]));
  for (const c of d.creatures) if (!(c.level[0] >= d.level[0] && c.level[1] <= d.level[1] && c.level[0] <= c.level[1])) fail(d, `creature "${c.id}" level [${c.level.join(', ')}] is outside the band [${d.level.join(', ')}]`);
  for (const e of d.encounters) { if (!rooms.has(e.room)) fail(d, `encounter "${e.id}" stands in "${e.room}", which is not a room`); if (!creatures.has(e.creature)) fail(d, `encounter "${e.id}": "${e.creature}" is not one of the dungeon's creature rows`); }
  for (const v of Object.values(d.openers ?? {})) if (!creatures.has(v)) fail(d, `opener "${v}" is not one of the dungeon's creature rows`);
  const boss = d.encounters.find((e) => e.id === d.boss.encounter);
  if (!boss) fail(d, `boss encounter "${d.boss.encounter}" does not exist`);
  else if (creatures.get(boss.creature)?.named !== true) fail(d, `boss encounter "${boss.id}": its creature "${boss.creature}" must be a named row`);
}

function neighbours(d: Dungeon, id: string): readonly string[] { return d.rooms.find((r) => r.id === id)?.links ?? []; }
/** The rooms a player can reach from the entrance by walking the links. */
export function reachable(d: Dungeon): ReadonlySet<string> {
  const seen = new Set<string>([d.entrance.room]), queue = [d.entrance.room];
  for (let i = 0; i < queue.length; i++) for (const n of neighbours(d, queue[i]!)) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  return seen;
}
/** The shortest walk in (entrance room to the boss's room) and the way back out. Throws when the boss is not reachable (checkDungeon already refuses that). */
export function walkRoute(d: Dungeon): { readonly in: readonly string[]; readonly out: readonly string[] } {
  const goal = d.encounters.find((e) => e.id === d.boss.encounter)!.room, prev = new Map<string, string | null>([[d.entrance.room, null]]), queue = [d.entrance.room];
  for (let i = 0; i < queue.length; i++) for (const n of neighbours(d, queue[i]!)) if (!prev.has(n)) { prev.set(n, queue[i]!); queue.push(n); }
  if (!prev.has(goal)) throw new Error(`dungeon "${d.id}": the boss room "${goal}" is not reachable`);
  const path: string[] = [];
  for (let at: string | null | undefined = goal; at; at = prev.get(at)) path.unshift(at);
  return { in: path, out: [...path].reverse() };
}

/** The zone-row parts a dungeon compiles to: what a zone row would otherwise carry as `place`, `spawns` and `look`. */
export function compileDungeon(d: Dungeon, theme: DungeonTheme): { place: unknown; spawns: unknown; look: unknown; band: readonly [number, number] } {
  const layout = Object.fromEntries(d.rooms.map((r) => [r.id, r.at])), m = d.mount ?? {};
  const world = { zoneSize: d.size, layout, ...(m.connections !== undefined ? { connections: m.connections } : {}), ...(m.density !== undefined ? { density: m.density } : {}), ...(m.ambience !== undefined ? { ambience: m.ambience } : {}) };
  const place = { zones: { [d.world]: world }, ...(m.joins !== undefined ? { joins: m.joins } : {}), waypoints: [...(m.waypointsBefore ?? []), ...d.rooms.map((r) => r.id)], spawns: d.encounters.map((e) => ({ id: e.id, at: e.room, characters: [e.creature] })) };
  return { place, spawns: { openers: d.openers ?? {}, rows: d.creatures }, look: theme.look, band: d.level };
}

export const DUNGEONS: readonly Dungeon[] = loadDungeons(DEFS);
const THEME_ROWS = THEMES.themes as readonly DungeonTheme[];
/** The dungeon `id`, compiled; throws when no row has that id. */
export function dungeonParts(id: string): ReturnType<typeof compileDungeon> {
  const d = DUNGEONS.find((x) => x.id === id);
  if (!d) throw new Error(`no dungeon row "${id}"`);
  return compileDungeon(d, THEME_ROWS.find((t) => t.id === d.theme)!);
}
