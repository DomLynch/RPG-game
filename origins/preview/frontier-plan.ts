// Origins slice 1 (?region=1): the walk on from the Concord Exchange into the Ash Frontier, laid out from the Region 1 data. Pure: no
// three.js, no DOM. frontier.ts builds the meshes; frontier.test.ts pins the layout.
//
// Placement. The world data says which landmark of one zone meets which landmark of the next (`connections`, and across the two regions
// the contracts' portal pair Exchange `west-gate` ↔ Frontier `exchange-gate`); it never says where a zone sits in the world. So the
// preview mounts them: the Exchange where concordMounts() puts it, the Frontier's east road at the far end of the Exchange's `west-road`
// passage, and every further zone, walking the road connections outward, with its `there` landmark on the known zone's `here` landmark,
// facing back at it. Portals (the night boat) are not walked: they get a signpost only.
import type { CharacterId, EncounterId, RegionId } from '../../src/core/server.ts';
import { loadRegion1, type Bounty, type Region1, type Town } from '../region1/load.ts';
import { CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { toMetres, toWorld, type Mount, type Point } from '../world/derive.ts';
import { openExits, exitSpots } from '../zones/exits.ts';
import type { Params } from '../world/schema.ts';
import { seedOf, type ReliefParams } from '../world/relief.ts';
import type { Figure, Piece } from './exchange-plan.ts';
import { DEFAULT_ZONE, loadZone, zoneNames } from '../zones/loader.ts';
import { frontierBlock, frontierRule } from './frontier-plan-rules.ts';
import { off } from './frontier-geom.ts';
import type { BuildingSkin, ModelPlacement } from './frontier-skin.ts';
import { drawBank, drawBlock, drawCentre, drawDock, drawGround, drawMarker, drawMilestone, drawRoad, drawRuinGate, drawScorch, drawShrine, drawSignpost, drawTownPost, drawWayOn, townBoards, townPeople, type Put } from './frontier-greybox.ts';

export type At = { x: number; z: number; facing: number }; // world metres; facing is a world heading (direction sin, cos)
export type ZonePlan = {
  region: RegionId; zone: string; name: string; mount: Mount; width: number; depth: number;
  preset: string; ground: string; landmarks: Record<string, At>; spots?: Record<string, At>;   // spots (absent when a zone has none): spawn-only places (a layout name ending -spot): creatures stand there, nothing is drawn or avoided, so adding one never moves the dressing, kit or relief
  relief: ReliefParams; // terrain.relief / hillScale / seed (seed 0 = the zone id): the hills frontier-relief.ts lays over the flat plan
  links: { here: string; to: string; kind: string }[]; // this zone's connections, by the landmark on this side
  town: Town | null;
};
export type Sign = { at: At; lines: string[]; back: boolean }; // back: this sign is the way back to the Exchange
export type Giver = { character: CharacterId; name: string; at: At; bounty: Bounty; foe: string; where: string };
export type Frontier = {
  zone: string;   // the zone package this plan is for (frontierPlan's zoneId)
  zones: ZonePlan[];
  road: { from: Point & { z: number }; to: { x: number; z: number }; width: number; facing: number; inward: number }; // the west road, world metres
  signs: Sign[];
  giver: Giver;
  data: Region1;
};

// Display names for the zones: the Exchange's own here; every Frontier zone's name lives in its zone package (origins/zones/zone<N>/zone.ts `names`), so a new zone adds none here.
export const ZONE_NAMES: Record<string, string> = { 'pit-yard': 'The Pit', exchange: 'The Concord Exchange', 'exchange-quarter': 'The Exchange Quarter', ...zoneNames() };
export const FRONTIER = 'region:ash-frontier' as RegionId;   // the branded id: compare against this, never the plain literal (TS2367)
const EXCHANGE = CONCORD_REGION as RegionId;
// The Bounty this slice offers, and who posts it: the warden of the town beside the Bounty's ground.
export const SLICE_BOUNTY = 'bounty:hrungnir';
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function mountAt(p: Params, landmark: string, world: { x: number; z: number }, faceWorld: number): Mount {
  const m = toMetres(p), l = m.landmarks[landmark]!, heading = wrap(faceWorld - l.facing), o = toWorld(l, { x: 0, z: 0, heading });
  return { x: world.x - o.x, z: world.z - o.z, heading };
}
function zonePlan(region: RegionId, zone: string, p: Params, mount: Mount, town: Town | null): ZonePlan {
  const m = toMetres(p);
  const placed = Object.entries(m.landmarks).map(([k, l]) => [k, { ...toWorld(l, mount), facing: wrap(mount.heading + l.facing) }] as const), landmarks = Object.fromEntries(placed.filter(([k]) => !k.endsWith('-spot'))), spots = Object.fromEntries(placed.filter(([k]) => k.endsWith('-spot')));
  return { region, zone, name: ZONE_NAMES[zone] ?? zone, mount, width: m.width, depth: m.depth, preset: p.ambience.preset, ground: p.terrain.ground, landmarks, ...(Object.keys(spots).length ? { spots } : {}),
    relief: { relief: p.terrain.relief, hillScale: p.terrain.hillScale, seed: p.terrain.seed || seedOf(zone) },
    links: Object.values(p.connections).map((c) => ({ here: c.here, to: c.to, kind: c.kind })), town };
}

// flat: the hills off (?relief=0), every zone's relief 0 so the plan is the flat greybox again. zoneId: which zone package's world zones the page walks (zone.world); the Frontier is laid out whole so every zone keeps
// its place, then only that zone's own are kept, with their links, signs and creatures (mobSpecs skips a spawn whose landmark is not in the plan). Zone 1 is the whole of what it was.
export function frontierPlan(flat = false, zoneId: string = DEFAULT_ZONE): Frontier {
  const loaded = loadRegion1();
  if (!loaded.ok) throw new Error(`Region 1 does not load: ${JSON.stringify(loaded.issues)}`);
  const data = loaded.value, mounts = concordMounts();
  if (!mounts.ok) throw new Error('the Exchange mounts do not resolve');
  const exZones = data.zones.get(EXCHANGE)!, frZones = data.zones.get(FRONTIER)!;
  const townOf = (region: RegionId, zone: string) => data.towns.find((t) => t.region === region && t.zone === zone) ?? null;
  const zones: ZonePlan[] = [
    zonePlan(EXCHANGE, 'pit-yard', exZones.get('pit-yard')!, mounts.value.pit, null),
    zonePlan(EXCHANGE, 'exchange', exZones.get('exchange')!, mounts.value.exchange, null),
  ];
  // The west road: the Exchange's passage out of its west gate, along the gate's facing.
  const ex = exZones.get('exchange')!, exM = toMetres(ex), road = exM.passages['west-road']!, gate = zones[1]!.landmarks['west-gate']!;
  const end = toWorld(road.to, mounts.value.exchange), start = toWorld(road.from, mounts.value.exchange);
  // Across the portal pair: the east road's exchange gate stands at the road's end, facing back down it.
  const portal = data.registry.regions.get(EXCHANGE)!.portals.find((q) => q.to === FRONTIER)!, back = data.registry.regions.get(FRONTIER)!.portals.find((q) => q.id === portal.toPortal)!;
  if (portal.at !== 'west-gate') throw new Error(`the Frontier portal is at ${portal.at}, not the west gate`);
  const firstZone = [...frZones].find(([, p]) => Object.hasOwn(p.layout, back.at))![0];
  const placed = new Map<string, ZonePlan>();
  const first = zonePlan(FRONTIER, firstZone, frZones.get(firstZone)!, mountAt(frZones.get(firstZone)!, back.at, end, gate.facing + Math.PI), townOf(FRONTIER, firstZone));
  placed.set(firstZone, first);
  const queue = [first];
  while (queue.length) {
    const z = queue.shift()!, p = frZones.get(z.zone)!;
    for (const c of Object.values(p.connections)) {
      if (c.kind === 'portal' || placed.has(c.to)) continue;
      const here = z.landmarks[c.here]!, q = frZones.get(c.to)!;
      const next = zonePlan(FRONTIER, c.to, q, mountAt(q, c.there, here, here.facing + Math.PI), townOf(FRONTIER, c.to));
      placed.set(c.to, next); queue.push(next);
    }
  }
  const owned = new Set(loadZone(zoneId).world), kept = [...placed.values()].filter((q) => owned.has(q.zone));
  // A link this page does not walk leaves nothing behind: its landmark (the post and collider it would draw) goes too, unless a kept link or a spawn stands on it.
  const spawnAt = new Set(data.registry.regions.get(FRONTIER)!.spawns.map((s) => s.at));
  const doors = exitSpots(zoneId, [...owned], openExits());   // a door to another zone page (zones/exits.ts) keeps its landmark: the page draws the way in and the player lands on it
  for (const q of kept) {
    q.links = q.links.filter((l) => owned.has(l.to));
    const used = new Set(q.links.map((l) => l.here));
    for (const c of Object.values(frZones.get(q.zone)!.connections)) if (!owned.has(c.to) && !used.has(c.here) && !spawnAt.has(c.here) && !doors.has(c.here)) delete q.landmarks[c.here];
  }
  zones.push(...kept);

  // Signposts: one at every link a walker can reach, naming where it goes; the two ends of the west road name the crossing.
  const signs: Sign[] = owned.has(firstZone) ? [
    { at: gate, lines: ['West: the Ash Frontier', ZONE_NAMES[firstZone]!], back: false },
    { at: first.landmarks[back.at]!, lines: ['East: the Concord Exchange'], back: true },
  ] : [];
  for (const z of kept) for (const c of Object.values(frZones.get(z.zone)!.connections)) {
    if (!owned.has(c.to)) continue;
    const at = z.landmarks[c.here]!, to = ZONE_NAMES[c.to] ?? c.to;
    signs.push({ at, lines: [c.kind === 'portal' ? `${to} (the night boat: not in this slice)` : to], back: false });
  }

  for (const r of openExits()) { const at = kept.find((q) => q.zone === r.zone)?.landmarks[r.landmark]; if (at) signs.push({ at, lines: [r.label], back: false }); }   // a door to another zone page is signposted like a link
  // The Bounty: the slice's one, posted by the ruler of the town whose zone links to the Bounty's ground.
  const bounty = data.bounties.find((b) => b.id === SLICE_BOUNTY)!, reg = data.registry.regions.get(FRONTIER)!;
  const spawn = reg.spawns.find((s) => s.encounter === bounty.encounter)!;
  const ground = [...placed.values()].find((z) => Object.hasOwn(z.landmarks, spawn.at))!;
  const town = data.towns.find((t) => t.region === FRONTIER && Object.values(frZones.get(t.zone)!.connections).some((c) => c.to === ground.zone))!;
  const hall = reg.spawns.find((s) => s.characters.includes(town.ruler.character))!.at, tz = placed.get(town.zone)!;
  const foe = data.registry.encounters.get(bounty.encounter as EncounterId)!.boss.character;
  const giver: Giver = {
    character: town.ruler.character, name: data.registry.characters.get(town.ruler.character)!.name,
    at: standBefore(tz.landmarks[hall]!, tz.landmarks[town.centre]!, frontierRule('giverStand')), bounty, foe: data.registry.characters.get(foe)!.name, where: `the ${spawn.at} in ${ground.name.replace(/^The /, "the ")}`,
  };
  if (flat) for (const z of zones) z.relief = { ...z.relief, relief: 0 };
  return { zone: zoneId, zones, road: { from: { ...start, d: 0 }, to: end, width: road.width, facing: gate.facing, inward: gate.facing + Math.PI }, signs, giver, data };
}
// A spot `metres` from a building toward the town centre, facing the centre: where its keeper stands.
function standBefore(building: At, centre: { x: number; z: number }, metres: number): At {
  const dx = centre.x - building.x, dz = centre.z - building.z, l = Math.hypot(dx, dz) || 1;
  return { x: building.x + (dx / l) * metres, z: building.z + (dz / l) * metres, facing: Math.atan2(dx, dz) };
}

// World point → a zone's frame (x across, d inward), the inverse of derive.ts toWorld.
export function toZone(z: ZonePlan, x: number, wz: number): Point {
  const s = Math.sin(z.mount.heading), c = Math.cos(z.mount.heading), dx = x - z.mount.x, dz = wz - z.mount.z;
  return { x: -dx * c + dz * s, d: dx * s + dz * c };
}
export const inZone = (z: ZonePlan, x: number, wz: number, margin = 0) => {
  const p = toZone(z, x, wz);
  return Math.abs(p.x) <= z.width / 2 - margin && p.d >= margin && p.d <= z.depth - margin;
};
/** Metres from a world point to the nearest edge of the zone (negative = outside it). The `/ 2` is the half-extent, genuine math not tuning: the one counted +1 in inline-number-baseline.json (Test Zone port: rim slowdown, z.width / 2, Lead 10-18). */
export const edgeDistance = (z: ZonePlan, x: number, wz: number): number => { const p = toZone(z, x, wz); return Math.min(z.width / 2 - Math.abs(p.x), p.d, z.depth - p.d); };
/** The speed scale of the soft rim: 1 beyond `margin` m of the edge, easing linearly down to `slow` at the edge itself. */
export const rimScale = (distance: number, margin: number, slow: number): number => (margin > 0 && distance < margin ? slow + (1 - slow) * Math.max(0, distance) / margin : 1);
// The Frontier zone you stand in (the Exchange's own two are the greybox's, so they are not looked up here).
export const frontierZoneAt = (f: Frontier, x: number, z: number) => f.zones.find((q) => q.region === FRONTIER && inZone(q, x, z)) ?? null;
// A point in the west road's frame: `along` the road from its start (metres, + = on out the way it faces) and `across` its centreline (absolute).
export function roadFrame(f: Frontier, x: number, z: number): { along: number; across: number } {
  const r = f.road, ux = Math.sin(r.facing), uz = Math.cos(r.facing);
  return { along: (x - r.from.x) * ux + (z - r.from.z) * uz, across: Math.abs(-(x - r.from.x) * uz + (z - r.from.z) * ux) };
}
// On the west road: from roadInset inside the Exchange's west wall to roadEnd past the road's end, the road's width less a body (roadBody each side). The numbers are rows (frontier-plan-defs.json).
export function onRoad(f: Frontier, x: number, z: number): boolean {
  const len = Math.hypot(f.road.to.x - f.road.from.x, f.road.to.z - f.road.from.z), { along, across } = roadFrame(f, x, z);
  return along >= -frontierRule('roadInset') && along <= len + frontierRule('roadEnd') && across < f.road.width / 2 - frontierRule('roadBody');
}

// The walker's first view: the west road's line carried viewAhead on (road width + `r` + viewSide either side, viewBehind back) and a ring of r + viewRing round where it ends. Tall dressing keeps out of it (frontier-dress.ts, frontier-camp.ts).
export function inFirstView(f: Frontier, x: number, z: number, r: number): boolean {
  const { along, across } = roadFrame(f, x, z);
  return (along > -frontierRule('viewBehind') && along < frontierRule('viewAhead') && across < f.road.width / 2 + r + frontierRule('viewSide')) || Math.hypot(f.road.to.x - x, f.road.to.z - z) < r + frontierRule('viewRing');
}

// ---- the greybox: blocks, signposts, solids ------------------------------------------------------------------------------------

export type Solid = { x: number; z: number; r: number }; // the walker keeps out of these circles (buildings, towers)
export type Board = { x: number; y: number; z: number; facing: number; lines: string[] }; // a sign's face, readable from `facing`
export type Build = { pieces: Piece[]; solids: Solid[]; people: Figure[]; boards: Board[]; models: ModelPlacement[] };   // models: the skin's model nodes stood on the ground (none without a skin)
export type { BuildingSkin, ModelPlacement } from './frontier-skin.ts';

// The plan decides every position and size that sets a solid (rows: frontier-plan-defs.json); the drawing of each piece is frontier-greybox.ts, which is handed those and owns no collision.
// A building stands behind its landmark, its front on it; its footprint (a `blocks` row) sets the solid's radius.
const kindOf = (name: string) => name.split('-').at(-1)!;

// `skin`: a building skin (frontier-skin.ts; World's buildingSkin(id)): the town's blocks, the ways on, the ruin's gate and the plain landmarks are drawn through it; null = the brick blocks as they were. Collision never depends on it.
export function frontierBuild(f: Frontier, skin: BuildingSkin | null = null): Build {
  const pieces: Piece[] = [], solids: Solid[] = [], people: Figure[] = [], boards: Board[] = [], models: ModelPlacement[] = [];
  const put: Put = (layer, shape, x, y, z, tint, rotY = 0, foot = y - 10) => { pieces.push({ layer, shape, x, y, z, tint, rotY, foot }); };
  const block = (a: At, kind: string, solid = true) => {
    const { w, d } = frontierBlock(kind)!, c = off(a, a.facing, -d / 2);
    drawBlock(put, a, kind, c, w, d, skin, models);
    if (solid) solids.push({ ...c, r: Math.max(w, d) / 2 + frontierRule('blockPad') });
    return c;
  };

  // The west road: a paved causeway from the Exchange's west gate, kerbed, on a skirt of rock.
  const r = f.road, len = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z), mid = { x: (r.from.x + r.to.x) / 2, z: (r.from.z + r.to.z) / 2 };
  drawRoad(put, r, len, mid);

  f.zones.forEach((z, i) => {
    if (z.region !== FRONTIER) return;
    drawGround(put, z, i);   // the zone's footprint on a skirt of rock
    const links = new Set(z.links.map((l) => l.here));
    for (const [name, a] of Object.entries(z.landmarks)) {
      if (links.has(name)) { // a way on: two gate posts either side of it
        const posts = [-1, 1].map((side) => off(a, a.facing, -frontierRule('gatePostBack'), side * frontierRule('gatePostSide')));
        drawWayOn(put, a, posts, skin, models);
        for (const p of posts) solids.push({ ...p, r: frontierRule('gatePostR') });
        continue;
      }
      const k = kindOf(name), c = z.town && z.landmarks[z.town.centre];
      // In a town every building opens onto the town's centre (greybox reading of the plan; the data's facings are not about doors).
      const door = c && name !== z.town!.centre ? { ...a, facing: Math.atan2(c.x - a.x, c.z - a.z) } : a;
      if (frontierBlock(k)) block(door, k);
      else if (name === 'ferry-house') block(door, 'house');
      else if (k === 'centre') { drawCentre(put, a); solids.push({ x: a.x, z: a.z, r: frontierRule('centreR') }); }
      else if (k === 'milestone') { drawMilestone(put, a); solids.push({ x: a.x, z: a.z, r: frontierRule('milestoneR') }); }
      else if (k === 'shrine') { drawShrine(put, a); solids.push({ x: a.x, z: a.z, r: frontierRule('shrineR') }); }
      else if (k === 'pits' || k === 'hollow') drawScorch(put, a, k === 'pits');
      else if (k === 'dock' || k === 'jetty') drawDock(put, a);
      else if (k === 'bank') drawBank(put, a);
      else if (k === 'gate') { // the ruin's gate: its posts are solid whatever draws them (stone posts and a lintel, or a skin's gate)
        const posts = [-1, 1].map((side) => off(a, a.facing, 0, side * frontierRule('ruinPostSide')));
        drawRuinGate(put, a, posts, skin, models);
        for (const p of posts) solids.push({ ...p, r: frontierRule('ruinPostR') });
      } else if (drawMarker(put, a, skin)) solids.push({ x: a.x, z: a.z, r: frontierRule('cairnR') }); // a cairn, or a skin's marker; a skin that leaves the landmark bare leaves nothing to bump into
    }
    if (!z.town) return;
    // A town: its named buildings (above), a ring of houses round its centre, its name on a board at the centre, people about.
    const c = z.landmarks[z.town.centre]!, keep = [...Object.values(z.landmarks), f.giver.at];
    const houses = frontierRule('ringHouses'), radius = frontierRule('ringRadius');
    for (let j = 0; j < houses; j++) {
      const ang = (j / houses) * Math.PI * 2 + frontierRule('ringPhase'), p = { x: c.x + Math.sin(ang) * radius, z: c.z + Math.cos(ang) * radius, facing: ang + Math.PI };
      if (!inZone(z, p.x, p.z, frontierRule('ringMargin')) || keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < frontierRule('ringKeepClear'))) continue;
      block(p, 'house');
    }
    boards.push(...townBoards(c, z.town.name));
    drawTownPost(put, c);
    people.push(...townPeople(c, i));
  });
  for (const s of f.signs) boards.push(drawSignpost(put, s));
  return { pieces, solids, people, boards, models };
}

// Where the walker may stand beyond the Exchange: on the west road or on a Frontier zone's ground, clear of every solid.
export function frontierWalkable(f: Frontier, b: Build, x: number, z: number): boolean {
  if (!onRoad(f, x, z) && !f.zones.some((q) => q.region === FRONTIER && inZone(q, x, z))) return false; // no margin: neighbouring zones share an edge
  return !b.solids.some((s) => Math.hypot(x - s.x, z - s.z) < s.r);
}
