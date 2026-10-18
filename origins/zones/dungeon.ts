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

/** A room's roof (Dom 2026-10-18): `open` is the stone approach under the sky, `closed` an underground hall with ceiling, floor, joined walls and torchlight. The entrance room is always open; a room with no `roof` is open. */
export type Roof = 'open' | 'closed';
export const ROOFS: readonly Roof[] = ['open', 'closed'];
const MIN_CELLS = 3;   // a closed room's fewest cells a side: a wall is left standing each side of a doorway (the wall's structure, not a tuning value)
type At = { readonly u: number; readonly v: number; readonly facing: number };
export type DungeonRoom = { readonly id: string; readonly at: At; readonly piece: string; readonly links: readonly string[]; readonly size?: { readonly w: number; readonly d: number }; readonly roof?: Roof };   // size (m): the room's walled footprint across (w) and deep (d), centred on its landmark; absent = the theme's default room
export type DungeonCreature = { readonly id: string; readonly level: readonly [number, number]; readonly loot: string; readonly named?: boolean; readonly [k: string]: unknown };
export type DungeonEncounter = { readonly id: string; readonly room: string; readonly creature: string };
export type Dungeon = {
  readonly id: string; readonly name: string; readonly theme: string; readonly level: readonly [number, number]; readonly world: string; readonly size: { readonly width: number; readonly depth: number };
  readonly entrance: { readonly room: string; readonly exit?: string }; readonly rooms: readonly DungeonRoom[]; readonly openers?: Readonly<Record<string, string>>;
  readonly creatures: readonly DungeonCreature[]; readonly encounters: readonly DungeonEncounter[]; readonly boss: { readonly encounter: string };
  readonly mount?: { readonly waypointsBefore?: readonly string[]; readonly connections?: unknown; readonly density?: unknown; readonly ambience?: unknown; readonly joins?: unknown };
};
/** How a theme ENCLOSES a room (theme row `enclosure`): the kit file and its nodes, the wall piece (`length` m of wall one piece covers at `scale`, `solid` its walk-blocking radius per unit scale), the doorway piece set into the wall facing each linked room
 *  (`gap` m of opening), and the default room size. Every piece choice is a row, so a restyle is a data change (Dom 2026-10-18). */
export type Enclosure = {
  readonly kit: { readonly url: string; readonly nodes: readonly string[] };
  readonly wall: { readonly node: string; readonly scale: number; readonly length: number; readonly solid: number };
  readonly doorway: { readonly node: string; readonly scale: number; readonly gap: number };
  readonly room: { readonly w: number; readonly d: number };
};
/** How a theme builds a CLOSED room (`enclosure.hall`, Characters' halls kit): a grid of `cell` m cells, each with a floor and a ceiling piece, a wall piece on every perimeter edge (`corner` where two meet), `doorCells` cells left open
 *  where a link leaves, a `sconce` on every `sconceEvery`th wall cell at `wallFace` m from the cell centre (the wall's inner face), and two invisible walk-blocking circles (`block.r` m, `block.along` m either side of the cell's middle) on each wall's outer edge. */
export type Hall = {
  readonly cell: number; readonly floor: string; readonly ceiling: string; readonly wall: string; readonly corner: string; readonly sconce: string; readonly sconceEvery: number; readonly wallFace: number; readonly doorCells: number;
  readonly block: { readonly r: number; readonly along: number };
};
export type DungeonTheme = { readonly id: string; readonly look: Readonly<Record<string, unknown>>; readonly pieces: Readonly<Record<string, string>>; readonly enclosure?: Enclosure & { readonly hall?: Hall } };

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
    if (r.roof !== undefined && !ROOFS.includes(r.roof)) fail(d, `room "${r.id}": roof "${String(r.roof)}" is not one of ${ROOFS.join(', ')}`);
    if (r.roof === 'closed' && r.id === d.entrance.room) fail(d, `entrance room "${r.id}" must be open (the approach stays under the sky)`);
    if (r.roof === 'closed') {
      const enc = theme.enclosure;
      if (!enc?.hall) fail(d, `room "${r.id}" is closed but theme "${theme.id}" has no enclosure.hall`);
      else { const { nx, nd } = hallCells(r, enc); if (!Number.isInteger(nx) || !Number.isInteger(nd) || nx < MIN_CELLS || nd < MIN_CELLS) fail(d, `room "${r.id}": a closed room is a whole number of ${enc.hall.cell} m cells, at least ${MIN_CELLS} a side (it is ${nx} x ${nd})`); }
    }
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

export type FixedPiece = { node: string; at: string; dx: number; dz: number; rotDeg: number; scale: number; solid: number; inZoneFrame: true; blockOnly?: true };   // blockOnly: nothing is drawn, only the walk-blocking circle (a hall's wall)
const HALF = 0.5, MILLI = 1000, EPS = 1e-9, HALF_TURN_DEG = 180;   // one half; metres to millimetres (the pieces' offsets are rounded to a millimetre); a float guard on a ceiling; degrees in half a turn (exempt: scripts/as-data/allow/origins-zones.json)
export const radians = (deg: number): number => (deg * Math.PI) / HALF_TURN_DEG, degrees = (rad: number): number => (rad * HALF_TURN_DEG) / Math.PI, r3 = (n: number): number => Math.round(n * MILLI) / MILLI;
/** A closed room's cell counts (across, deep): its footprint over the hall's cell. A footprint that is not a whole number of cells, or under three cells a side (no wall left beside a doorway), is refused by checkDungeon. */
export function hallCells(room: DungeonRoom, enc: Enclosure & { readonly hall?: Hall }): { readonly nx: number; readonly nd: number } {
  const cell = enc.hall!.cell;
  return { nx: (room.size?.w ?? enc.room.w) / cell, nd: (room.size?.d ?? enc.room.d) / cell };
}
type V2 = { readonly x: number; readonly d: number };
/** One CLOSED room (theme `enclosure.hall`): a floor and a ceiling piece in every cell of its grid, a wall piece on every perimeter edge facing in (a corner piece where two walls meet), the doorway cells left open on the sides
 *  that face a linked room, sconces along the walls, and the invisible circles that make the walls solid. Frames as encloseRooms: the zone's, offsets from the room's landmark. A piece's local +z (its inner face) points into the room:
 *  rotDeg = atan2(-n.x, n.d) for a wall whose outward normal is n; a corner's second wall is its local -x. Pure. */
function encloseHall(d: Dungeon, room: DungeonRoom, enc: Enclosure & { readonly hall?: Hall }, local: ReadonlyMap<string, V2>): FixedPiece[] {
  const h = enc.hall!, { nx, nd } = hallCells(room, enc), w = nx * h.cell, depth = nd * h.cell, th = radians(room.at.facing), c = local.get(room.id)!, out: FixedPiece[] = [];
  const fwd: V2 = { x: -Math.sin(th), d: Math.cos(th) }, rgt: V2 = { x: Math.cos(th), d: Math.sin(th) }, neg = (v: V2): V2 => ({ x: -v.x, d: -v.d });
  const sides = [{ n: fwd, run: rgt, len: nx }, { n: neg(fwd), run: rgt, len: nx }, { n: rgt, run: fwd, len: nd }, { n: neg(rgt), run: fwd, len: nd }];
  const onEdge = (s: number, i: number, j: number): boolean => (s === 0 ? j === nd - 1 : s === 1 ? j === 0 : s === 2 ? i === nx - 1 : i === 0), runIndex = (s: number, i: number, j: number): number => (s < 2 ? i : j);
  const pos = (i: number, j: number): V2 => { const a = (i + HALF) * h.cell - w * HALF, b = (j + HALF) * h.cell - depth * HALF; return { x: rgt.x * a + fwd.x * b, d: rgt.d * a + fwd.d * b }; };
  const doorSides = new Set<number>();
  for (const l of room.links) { const to = local.get(l)!, dx = to.x - c.x, dd = to.d - c.d; let best = 0, bestDot = -Infinity; sides.forEach((s, i) => { const dot = s.n.x * dx + s.n.d * dd; if (dot > bestDot) { bestDot = dot; best = i; } }); doorSides.add(best); }
  const isDoor = (s: number, idx: number): boolean => { const n = sides[s]!.len, k = (n - h.doorCells) % 2 === 0 ? h.doorCells : h.doorCells + 1, from = (n - k) * HALF; return doorSides.has(s) && idx >= from && idx < from + k; };
  const put = (node: string, p: V2, ang: number, solid: number, blockOnly = false): void => {
    if (Math.abs(c.x + p.x) > d.size.width * HALF || c.d + p.d < 0 || c.d + p.d > d.size.depth) throw new Error(`dungeon "${d.id}": room "${room.id}" has a ${node} at (${r3(c.x + p.x)}, ${r3(c.d + p.d)}) outside the ${d.size.width} x ${d.size.depth} zone: shrink the room or move it in`);
    out.push({ node, at: room.id, dx: r3(p.x), dz: r3(p.d), rotDeg: r3(ang), scale: 1, solid, inZoneFrame: true, ...(blockOnly ? { blockOnly: true as const } : {}) });
  };
  const faceDeg = (n: V2): number => degrees(Math.atan2(-n.x, n.d));
  const block = (p: V2, s: { n: V2; run: V2 }): void => { for (const sign of [-1, 1]) put(h.wall, { x: p.x + s.n.x * h.cell * HALF + s.run.x * h.block.along * sign, d: p.d + s.n.d * h.cell * HALF + s.run.d * h.block.along * sign }, 0, h.block.r, true); };
  for (let j = 0; j < nd; j++) for (let i = 0; i < nx; i++) {
    const p = pos(i, j); put(h.floor, p, room.at.facing, 0); put(h.ceiling, p, room.at.facing, 0);
    const touched = [0, 1, 2, 3].filter((s) => onEdge(s, i, j));
    if (touched.length === 2) {   // a corner: back wall plus its left (local -x) wall
      const [a, b] = [sides[touched[0]!]!, sides[touched[1]!]!], thA = faceDeg(a.n), rad = radians(thA), leftIsB = -Math.cos(rad) * b.n.x - Math.sin(rad) * b.n.d > HALF;
      put(h.corner, p, leftIsB ? thA : faceDeg(b.n), 0); block(p, a); block(p, b); continue;
    }
    for (const s of touched) {
      const idx = runIndex(s, i, j); if (isDoor(s, idx)) continue;
      const side = sides[s]!; put(h.wall, p, faceDeg(side.n), 0); block(p, side);
      if ((idx - 1) % h.sconceEvery === 0) put(h.sconce, { x: p.x + side.n.x * h.wallFace, d: p.d + side.n.d * h.wallFace }, faceDeg(side.n), 0);
    }
  }
  return out;
}
/** The pieces that ENCLOSE every room of a dungeon (theme `enclosure`): four walls round the room's footprint, and a doorway set into the wall that faces each linked room (and, on the entrance room, the way out). Offsets are in the ZONE's frame
 *  (`inZoneFrame`: x across, d deep, relative to the room's landmark; rotDeg from the zone's +x axis), so they follow the zone's mount in the world. A room whose walls would leave the zone is refused. Pure. */
export function encloseRooms(d: Dungeon, enc: Enclosure): readonly FixedPiece[] {
  const local = new Map(d.rooms.map((r) => [r.id, { x: (r.at.u - HALF) * d.size.width, d: r.at.v * d.size.depth }]));
  const out: FixedPiece[] = [];
  for (const room of d.rooms) {
    if (room.roof === 'closed') { out.push(...encloseHall(d, room, enc, local)); continue; }
    const w = room.size?.w ?? enc.room.w, depth = room.size?.d ?? enc.room.d, th = radians(room.at.facing), c = local.get(room.id)!;
    const fwd = { x: -Math.sin(th), d: Math.cos(th) }, rgt = { x: Math.cos(th), d: Math.sin(th) };
    // side i: its outward normal, its direction of run and its length: +forward, -forward, +right, -right
    const sides = [{ n: fwd, run: rgt, len: w, off: depth * HALF }, { n: { x: -fwd.x, d: -fwd.d }, run: rgt, len: w, off: depth * HALF }, { n: rgt, run: fwd, len: depth, off: w * HALF }, { n: { x: -rgt.x, d: -rgt.d }, run: fwd, len: depth, off: w * HALF }];
    const open = new Set<number>(), face = (to: { x: number; d: number }) => { const dx = to.x - c.x, dd = to.d - c.d; let best = 0, bestDot = -Infinity; sides.forEach((s, i) => { const dot = s.n.x * dx + s.n.d * dd; if (dot > bestDot) { bestDot = dot; best = i; } }); return best; };
    for (const l of room.links) open.add(face(local.get(l)!));
    if (room.id === d.entrance.room) open.add(0);   // the way out: the room's own facing is out of the zone
    const put = (node: string, x: number, dd: number, ang: number, scale: number, solid: number): void => {
      const px = c.x + x, pd = c.d + dd;
      if (Math.abs(px) > d.size.width * HALF || pd < 0 || pd > d.size.depth) throw new Error(`dungeon "${d.id}": room "${room.id}" has a ${node} at (${r3(px)}, ${r3(pd)}) outside the ${d.size.width} x ${d.size.depth} zone: shrink the room or move it in`);
      out.push({ node, at: room.id, dx: r3(x), dz: r3(dd), rotDeg: r3(ang), scale: r3(scale), solid, inZoneFrame: true });
    };
    sides.forEach((s, i) => {
      const ang = degrees(Math.atan2(s.run.d, s.run.x)), gap = open.has(i) ? enc.doorway.gap : 0, cx = s.n.x * s.off, cd = s.n.d * s.off, edge = s.len * HALF;
      for (const [from, to] of gap ? [[-edge, -gap * HALF], [gap * HALF, edge]] : [[-edge, edge]]) {
        const span = to! - from!, n = Math.max(1, Math.ceil(span / enc.wall.length - EPS)), step = span / n;
        for (let k = 0; k < n; k++) { const t = from! + (k + HALF) * step; put(enc.wall.node, cx + s.run.x * t, cd + s.run.d * t, ang, (enc.wall.scale * step) / enc.wall.length, enc.wall.solid); }
      }
      if (gap) put(enc.doorway.node, cx, cd, ang, enc.doorway.scale, 0);
    });
  }
  return out;
}

/** The zone-row parts a dungeon compiles to: what a zone row would otherwise carry as `place`, `spawns` and `look` (and `kit`, when the theme encloses its rooms). */
export function compileDungeon(d: Dungeon, theme: DungeonTheme): { place: unknown; spawns: unknown; look: unknown; band: readonly [number, number]; kit?: unknown } {
  const layout = Object.fromEntries(d.rooms.map((r) => [r.id, r.at])), m = d.mount ?? {};
  const world = { zoneSize: d.size, layout, ...(m.connections !== undefined ? { connections: m.connections } : {}), ...(m.density !== undefined ? { density: m.density } : {}), ...(m.ambience !== undefined ? { ambience: m.ambience } : {}) };
  const place = { zones: { [d.world]: world }, ...(m.joins !== undefined ? { joins: m.joins } : {}), waypoints: [...(m.waypointsBefore ?? []), ...d.rooms.map((r) => r.id)], spawns: d.encounters.map((e) => ({ id: e.id, at: e.room, characters: [e.creature] })) };
  const enc = theme.enclosure;
  return { place, spawns: { openers: d.openers ?? {}, rows: d.creatures }, look: theme.look, band: d.level, ...(enc ? { kit: { url: enc.kit.url, nodes: enc.kit.nodes, landmarks: [], kinds: [], fixed: encloseRooms(d, enc) } } : {}) };
}

export const DUNGEONS: readonly Dungeon[] = loadDungeons(DEFS);
const THEME_ROWS = THEMES.themes as readonly DungeonTheme[];
/** The dungeon `id`, compiled; throws when no row has that id. */
export function dungeonParts(id: string): ReturnType<typeof compileDungeon> {
  const d = DUNGEONS.find((x) => x.id === id);
  if (!d) throw new Error(`no dungeon row "${id}"`);
  return compileDungeon(d, THEME_ROWS.find((t) => t.id === d.theme)!);
}
