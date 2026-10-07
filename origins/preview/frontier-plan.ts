// Origins slice 1 (?region=1): the walk on from the Concord Exchange into the Ash Frontier, laid out from the Region 1 data. Pure: no
// three.js, no DOM. frontier.ts builds the meshes; frontier.test.ts pins the layout.
//
// Placement. The world data says which landmark of one zone meets which landmark of the next (`connections`, and across the two regions
// the contracts' portal pair Exchange `west-gate` ↔ Frontier `exchange-gate`); it never says where a zone sits in the world. So the
// preview mounts them: the Exchange where concordMounts() puts it, the Frontier's east road at the far end of the Exchange's `west-road`
// passage, and every further zone, walking the road connections outward, with its `there` landmark on the known zone's `here` landmark,
// facing back at it. Portals (the night boat) are not walked: they get a signpost only.
import type { CharacterId, EncounterId, RegionId } from '../contracts/ids.ts';
import { loadRegion1, type Bounty, type Region1, type Town } from '../region1/load.ts';
import { CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { toMetres, toWorld, type Mount, type Point } from '../world/derive.ts';
import type { Params } from '../world/schema.ts';
import type { Figure, Layer, Piece, Shape, Tint } from './exchange-plan.ts';

export type At = { x: number; z: number; facing: number }; // world metres; facing is a world heading (direction sin, cos)
export type ZonePlan = {
  region: RegionId; zone: string; name: string; mount: Mount; width: number; depth: number;
  preset: string; ground: string; landmarks: Record<string, At>;
  links: { here: string; to: string; kind: string }[]; // this zone's connections, by the landmark on this side
  town: Town | null;
};
export type Sign = { at: At; lines: string[]; back: boolean }; // back: this sign is the way back to the Exchange
export type Giver = { character: CharacterId; name: string; at: At; bounty: Bounty; foe: string; where: string };
export type Frontier = {
  zones: ZonePlan[];
  road: { from: Point & { z: number }; to: { x: number; z: number }; width: number; facing: number; inward: number }; // the west road, world metres
  signs: Sign[];
  giver: Giver;
  data: Region1;
};

// Display names for the zones: the region data names towns and a few landmarks, not zones (open: a zone `name` field).
export const ZONE_NAMES: Record<string, string> = {
  'pit-yard': 'The Pit', exchange: 'The Concord Exchange', 'exchange-quarter': 'The Exchange Quarter',
  'east-road': 'The East Road', 'ferry-landing': 'The Grey Ferry', 'cinder-fields': 'The Cinder Fields', 'black-mere': 'The Black Mere',
  'blood-ruin': 'The Blood Ruin', 'cinder-hold': 'Cinder Hold', 'mere-end': 'Mere End',
};
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
  const landmarks = Object.fromEntries(Object.entries(m.landmarks).map(([k, l]) => [k, { ...toWorld(l, mount), facing: wrap(mount.heading + l.facing) }]));
  return { region, zone, name: ZONE_NAMES[zone] ?? zone, mount, width: m.width, depth: m.depth, preset: p.ambience.preset, ground: p.terrain.ground, landmarks,
    links: Object.values(p.connections).map((c) => ({ here: c.here, to: c.to, kind: c.kind })), town };
}

export function frontierPlan(): Frontier {
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
  zones.push(...placed.values());

  // Signposts: one at every link a walker can reach, naming where it goes; the two ends of the west road name the crossing.
  const signs: Sign[] = [
    { at: gate, lines: ['West: the Ash Frontier', ZONE_NAMES[firstZone]!], back: false },
    { at: first.landmarks[back.at]!, lines: ['East: the Concord Exchange'], back: true },
  ];
  for (const z of placed.values()) for (const c of Object.values(frZones.get(z.zone)!.connections)) {
    const at = z.landmarks[c.here]!, to = ZONE_NAMES[c.to] ?? c.to;
    signs.push({ at, lines: [c.kind === 'portal' ? `${to} (the night boat: not in this slice)` : to], back: false });
  }

  // The Bounty: the slice's one, posted by the ruler of the town whose zone links to the Bounty's ground.
  const bounty = data.bounties.find((b) => b.id === SLICE_BOUNTY)!, reg = data.registry.regions.get(FRONTIER)!;
  const spawn = reg.spawns.find((s) => s.encounter === bounty.encounter)!;
  const ground = [...placed.values()].find((z) => Object.hasOwn(z.landmarks, spawn.at))!;
  const town = data.towns.find((t) => t.region === FRONTIER && Object.values(frZones.get(t.zone)!.connections).some((c) => c.to === ground.zone))!;
  const hall = reg.spawns.find((s) => s.characters.includes(town.ruler.character))!.at, tz = placed.get(town.zone)!;
  const foe = data.registry.encounters.get(bounty.encounter as EncounterId)!.boss.character;
  const giver: Giver = {
    character: town.ruler.character, name: data.registry.characters.get(town.ruler.character)!.name,
    at: standBefore(tz.landmarks[hall]!, tz.landmarks[town.centre]!, 4.5), bounty, foe: data.registry.characters.get(foe)!.name, where: `the ${spawn.at} in ${ground.name.replace(/^The /, "the ")}`,
  };
  return { zones, road: { from: { ...start, d: 0 }, to: end, width: road.width, facing: gate.facing, inward: gate.facing + Math.PI }, signs, giver, data };
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
// The Frontier zone you stand in (the Exchange's own two are the greybox's, so they are not looked up here).
export const frontierZoneAt = (f: Frontier, x: number, z: number) => f.zones.find((q) => q.region === FRONTIER && inZone(q, x, z)) ?? null;
// A point in the west road's frame: `along` the road from its start (metres, + = on out the way it faces) and `across` its centreline (absolute).
export function roadFrame(f: Frontier, x: number, z: number): { along: number; across: number } {
  const r = f.road, ux = Math.sin(r.facing), uz = Math.cos(r.facing);
  return { along: (x - r.from.x) * ux + (z - r.from.z) * uz, across: Math.abs(-(x - r.from.x) * uz + (z - r.from.z) * ux) };
}
// On the west road: from 2.5 m inside the Exchange's west wall to the road's end, the road's width less a body.
export function onRoad(f: Frontier, x: number, z: number): boolean {
  const len = Math.hypot(f.road.to.x - f.road.from.x, f.road.to.z - f.road.from.z), { along, across } = roadFrame(f, x, z);
  return along >= -2.5 && along <= len + 0.5 && across < f.road.width / 2 - 0.35;
}

// The walker's first view: the west road's line carried 60 m on (road width + `r` + 10 m either side) and a ring round where it ends. Tall dressing keeps out of it (frontier-dress.ts, frontier-camp.ts).
export function inFirstView(f: Frontier, x: number, z: number, r: number): boolean {
  const { along, across } = roadFrame(f, x, z);
  return (along > -10 && along < 60 && across < f.road.width / 2 + r + 10) || Math.hypot(f.road.to.x - x, f.road.to.z - z) < r + 14;
}

// ---- the greybox: blocks, signposts, solids ------------------------------------------------------------------------------------

export type Solid = { x: number; z: number; r: number }; // the walker keeps out of these circles (buildings, towers)
export type Board = { x: number; y: number; z: number; facing: number; lines: string[] }; // a sign's face, readable from `facing`
export type Build = { pieces: Piece[]; solids: Solid[]; people: Figure[]; boards: Board[] };

const ASH: Tint = [0.5, 0.47, 0.44], DARK: Tint = [0.62, 0.6, 0.57], SAND: Tint = [1.05, 1, 0.92], TIMBER: Tint = [0.42, 0.3, 0.2], SOOT: Tint = [0.1, 0.09, 0.08];
const GROUND: Record<string, Tint> = { ash: ASH, paving: [0.86, 0.83, 0.78], sand: [0.95, 0.82, 0.62] };
const CLOTH = ['#5a4a3a', '#3a3a44', '#6e5a40', '#4a2a24', '#2e3640'];
// A building per landmark kind (by the name's last word): width, height, depth, tint. The block stands behind its landmark, its front on it.
const BLOCKS: Record<string, [number, number, number, Tint]> = {
  hall: [10, 6, 8, DARK], forge: [6, 4, 6, DARK], jail: [5, 3.5, 5, [0.4, 0.38, 0.36]], healer: [6, 4.2, 5, SAND], fence: [3, 1.1, 1.4, TIMBER],
  house: [8, 4.5, 6, SAND], boathouse: [9, 4, 7, TIMBER], watchtower: [3.5, 12, 3.5, DARK], crypt: [8, 3, 8, [0.35, 0.33, 0.32]],
};
const kindOf = (name: string) => name.split('-').at(-1)!;

export function frontierBuild(f: Frontier): Build {
  const pieces: Piece[] = [], solids: Solid[] = [], people: Figure[] = [], boards: Board[] = [];
  const put = (layer: Layer, shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0, foot = y - 10) => { pieces.push({ layer, shape, x, y, z, tint, rotY, foot }); };
  // A point `ahead` metres along a facing and `right` metres across it (right of a walker looking along it).
  const off = (a: { x: number; z: number }, facing: number, ahead: number, right = 0) => ({ x: a.x + Math.sin(facing) * ahead - Math.cos(facing) * right, z: a.z + Math.cos(facing) * ahead + Math.sin(facing) * right });
  const block = (a: At, [w, h, d, tint]: [number, number, number, Tint], solid = true) => {
    const c = off(a, a.facing, -d / 2);
    put('stone', ['box', w, h, d], c.x, h / 2, c.z, tint, a.facing, 0);
    put('stone', ['box', w + 0.6, 0.35, d + 0.6], c.x, h + 0.17, c.z, TIMBER, a.facing); // eaves
    if (w > 2) put('soot', ['box', Math.min(1.6, w / 3), Math.min(2.4, h - 0.5), 0.12], off(a, a.facing, 0.02).x, Math.min(1.2, (h - 0.5) / 2), off(a, a.facing, 0.02).z, SOOT, a.facing);
    if (solid) solids.push({ ...c, r: Math.max(w, d) / 2 + 0.3 });
    return c;
  };
  const sign = (s: Sign) => {
    // The post stands 2 m in from the link and 2.6 m to its right as you walk out, its face toward whoever walks up to it.
    const face = s.at.facing + Math.PI, p = off(s.at, s.at.facing, -2, -2.6);
    put('soot', ['box', 0.14, 2.6, 0.14], p.x, 1.3, p.z, SOOT, face, 0);
    put('stone', ['box', 1.9, 0.18 + 0.32 * s.lines.length, 0.08], p.x, 2.25, p.z, TIMBER, face);
    const front = off(p, face, 0.05);
    boards.push({ x: front.x, y: 2.25, z: front.z, facing: face, lines: s.lines });
  };

  // The west road: a paved causeway from the Exchange's west gate, kerbed, on a skirt of rock.
  const r = f.road, len = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z), mid = { x: (r.from.x + r.to.x) / 2, z: (r.from.z + r.to.z) / 2 };
  put('stone', ['box', r.width + 1, 0.4, len + 1], mid.x, -0.2, mid.z, GROUND.paving!, r.facing);
  put('stone', ['box', r.width + 2, 14, len], mid.x, -7.4, mid.z, DARK, r.facing, -14);
  for (const side of [-1, 1]) { const k = off(mid, r.facing, 0, side * (r.width / 2 + 0.4)); put('stone', ['box', 0.4, 0.8, len], k.x, 0.4, k.z, SAND, r.facing, 0); }

  f.zones.forEach((z, i) => {
    if (z.region !== FRONTIER) return;
    // The ground: the zone's footprint, a hair lower per zone so overlapping footprints do not fight, on a skirt of rock.
    const centre = toWorld({ x: 0, d: z.depth / 2 }, z.mount), top = -0.004 * i;
    put('stone', ['box', z.width, 0.4, z.depth], centre.x, top - 0.2, centre.z, GROUND[z.ground] ?? ASH, z.mount.heading);
    put('stone', ['box', z.width + 1, 12, z.depth + 1], centre.x, top - 6.4, centre.z, DARK, z.mount.heading, top - 12);
    const links = new Set(z.links.map((l) => l.here));
    for (const [name, a] of Object.entries(z.landmarks)) {
      if (links.has(name)) { // a way on: two gate posts either side of it
        for (const side of [-1, 1]) { const p = off(a, a.facing, -0.4, side * 2.4); put('stone', ['box', 0.6, 3, 0.6], p.x, 1.5, p.z, DARK, a.facing, 0); solids.push({ ...p, r: 0.5 }); }
        continue;
      }
      const k = kindOf(name), c = z.town && z.landmarks[z.town.centre];
      // In a town every building opens onto the town's centre (greybox reading of the plan; the data's facings are not about doors).
      const door = c && name !== z.town!.centre ? { ...a, facing: Math.atan2(c.x - a.x, c.z - a.z) } : a;
      if (BLOCKS[k]) block(door, BLOCKS[k]!);
      else if (name === 'ferry-house') block(door, BLOCKS.house!);
      else if (k === 'centre') { put('stone', ['cylinder', 1.2, 1.3, 0.8, 16], a.x, 0.4, a.z, DARK, 0, 0); solids.push({ x: a.x, z: a.z, r: 1.5 }); }
      else if (k === 'milestone') { put('stone', ['box', 0.5, 1.4, 0.35], a.x, 0.7, a.z, SAND, a.facing, 0); solids.push({ x: a.x, z: a.z, r: 0.5 }); }
      else if (k === 'shrine') {
        put('stone', ['cylinder', 3, 3.2, 0.5, 20], a.x, 0.25, a.z, DARK, 0, 0);
        put('stone', ['box', 1.6, 2.8, 1.2], a.x, 1.9, a.z, [0.42, 0.4, 0.4], a.facing, 0.5); solids.push({ x: a.x, z: a.z, r: 1.3 });
      } else if (k === 'pits' || k === 'hollow') put('soot', ['cylinder', k === 'pits' ? 6 : 10, k === 'pits' ? 6 : 10, 0.06, 24], a.x, 0.03, a.z, SOOT);
      else if (k === 'dock' || k === 'jetty') { const c = off(a, a.facing, 3); put('stone', ['box', 3.5, 0.3, 7], c.x, 0.15, c.z, TIMBER, a.facing, 0); }
      else if (k === 'bank') for (let j = 0; j < 14; j++) { const p = off(a, a.facing, (j % 4) * 1.3 - 2, Math.floor(j / 4) * 1.4 - 2); put('stone', ['box', 0.08, 1.6 + (j % 3) * 0.3, 0.08], p.x, 0.9, p.z, [0.5, 0.48, 0.3], 0, 0); }
      else if (k === 'gate') { // the ruin's gate: posts and a lintel across the way
        for (const side of [-1, 1]) { const p = off(a, a.facing, 0, side * 2.6); put('stone', ['box', 1, 4.5, 1], p.x, 2.25, p.z, DARK, a.facing, 0); solids.push({ ...p, r: 0.8 }); }
        put('stone', ['box', 6.4, 0.9, 1.2], a.x, 4.9, a.z, DARK, a.facing);
      } else { put('stone', ['box', 0.8, 1, 0.8], a.x, 0.5, a.z, DARK, a.facing, 0); solids.push({ x: a.x, z: a.z, r: 0.6 }); } // a cairn
    }
    if (!z.town) return;
    // A town: its named buildings (above), a ring of houses round its centre, its name on a board at the centre, people about.
    const c = z.landmarks[z.town.centre]!, keep = [...Object.values(z.landmarks), f.giver.at];
    for (let j = 0; j < 8; j++) {
      const ang = (j / 8) * Math.PI * 2 + 0.3, p = { x: c.x + Math.sin(ang) * 15, z: c.z + Math.cos(ang) * 15, facing: ang + Math.PI };
      if (!inZone(z, p.x, p.z, 6) || keep.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < 9)) continue;
      block(p, BLOCKS.house!);
    }
    boards.push({ x: c.x, y: 2.6, z: c.z + 0.01, facing: 0, lines: [z.town.name] }, { x: c.x, y: 2.6, z: c.z - 0.01, facing: Math.PI, lines: [z.town.name] });
    put('soot', ['box', 0.14, 2.2, 0.14], c.x, 1.9, c.z, SOOT, 0, 0.8);
    for (let j = 0; j < 4; j++) { const p = off(c, j * 1.7, 4 + j); people.push({ x: p.x, z: p.z, color: CLOTH[(i + j) % CLOTH.length]! }); }
  });
  for (const s of f.signs) sign(s);
  return { pieces, solids, people, boards };
}

// Where the walker may stand beyond the Exchange: on the west road or on a Frontier zone's ground, clear of every solid.
export function frontierWalkable(f: Frontier, b: Build, x: number, z: number): boolean {
  if (!onRoad(f, x, z) && !f.zones.some((q) => q.region === FRONTIER && inZone(q, x, z))) return false; // no margin: neighbouring zones share an edge
  return !b.solids.some((s) => Math.hypot(x - s.x, z - s.z) < s.r);
}
