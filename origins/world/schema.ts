// Origins O2: the world parameter schema — every number that sets the scale, layout and feel of a zone, as data.
//
// One table (SCHEMA) is the whole contract: each group lists its fields with a kind, a unit, a range and a DEFAULT. Validation, layering,
// defaults and seeded generation are all read off this table, so adding group #16 is one entry here and nothing else changes (README).
// Lengths have two units on purpose:
//   - `u` (world units) for the PLACE: zone size, passages. They go through scale.metresPerUnit, so one knob rescales a whole world.
//   - `m` (metres) for the BODY and the CAMERA: walking, reach, view, terrain height. The hero stays 1.8 m whatever the world's scale.
// Layout is never authored in metres: a landmark is (u, v) in 0..1 of its zone, so a resized zone keeps its plan.
import { TITLES } from '../../src/career.ts';

export type Field =
  | { t: 'num' | 'int'; unit: string; min: number; max: number; def: number; doc: string }
  | { t: 'bool'; def: boolean; doc: string }
  | { t: 'key'; def?: string; doc: string } // a lowercase id looked up elsewhere (a preset, a biome, a far landmark); no def = required
  | { t: 'ref'; def?: string | null; doc: string } // a landmark in this zone's layout; def null = optional, no def = required
  | { t: 'zone'; doc: string } // a zone id in the same region (required)
  | { t: 'enum'; values: readonly string[]; def: string; doc: string };
// A group is either a fixed set of fields, or a keyed list of entries that all share one field set (landmarks, passages, connections).
export type Group = { doc: string; fields: Record<string, Field> } | { doc: string; entries: Record<string, Field> };
export type Schema = Record<string, Group>;

const num = (unit: string, min: number, max: number, def: number, doc: string) => ({ t: 'num', unit, min, max, def, doc }) as const;
const int = (unit: string, min: number, max: number, def: number, doc: string) => ({ t: 'int', unit, min, max, def, doc }) as const;
const bool = (def: boolean, doc: string) => ({ t: 'bool', def, doc }) as const;
const key = (def: string, doc: string) => ({ t: 'key', def, doc }) as const;

// The frozen camera (Dom froze the framing): read-only facts the view group is bounded by, never a parameter. Values are today's
// src/scene.ts PerspectiveCamera(51, …, 0.1, 180), src/camera.ts GATE_CAM (back 3.4, height 2.1) and the greybox walker's follow camera.
export const CAMERA = Object.freeze({
  fovDeg: 51, near: 0.1, far: 180,
  follow: Object.freeze({ back: 5.2, height: 2.7, ahead: 3, lookY: 1.5, settlePerSecond: 4 }),
  passage: Object.freeze({ back: 3.4, height: 2.1 }),
});

export const SCHEMA = {
  scale: { doc: 'metres per world unit', fields: { metresPerUnit: num('m/u', 0.25, 4, 1, 'every place length: zone size, layout, passages') } },
  movement: {
    doc: 'how the hero moves',
    fields: {
      walkSpeed: num('m/s', 0.5, 6, 2.3, 'walk speed'),
      runSpeed: num('m/s', 1, 12, 4.6, 'run speed (>= walk)'),
      turnRate: num('rad/s', 0.5, 6, 1.9, 'turn rate'),
    },
  },
  reach: {
    doc: 'interaction distances',
    fields: { interactRadius: num('m', 0.5, 10, 3, 'talk / open prompt'), pickupRadius: num('m', 0.25, 5, 1.5, 'loot pickup') },
  },
  zoneSize: { doc: 'the zone footprint', fields: { width: num('u', 10, 2000, 50, 'across (x)'), depth: num('u', 10, 2000, 50, 'from the entry edge inward') } },
  layout: {
    doc: 'named landmarks, relative to the zone',
    entries: {
      u: num('0..1', 0, 1, 0.5, 'across: 0 left edge, 1 right edge'),
      v: num('0..1', 0, 1, 0.5, 'inward: 0 entry edge, 1 far edge'),
      facing: num('deg', -180, 180, 0, '0 faces inward, +90 faces left'),
    },
  },
  passages: {
    doc: 'gates and corridors leading out from a landmark along its facing',
    entries: { from: { t: 'ref', doc: 'the landmark it starts at' }, width: num('u', 1, 50, 2.5, 'clear width'), length: num('u', 0, 500, 10, 'length') },
  },
  view: {
    doc: 'how far the world is seen',
    fields: {
      drawDistance: num('m', 20, CAMERA.far, CAMERA.far, 'cull / LOD distance (the frozen camera far plane caps it)'),
      fogNear: num('m', 0, 500, 5, 'fog starts'),
      fogFar: num('m', 1, 1000, 107, 'fog opaque'),
      backdropRadius: num('m', 10, CAMERA.far, 40, 'painted far-world ring'),
    },
  },
  density: {
    doc: 'how full the zone is, per 100 m² of real ground',
    fields: { npcs: num('/100m²', 0, 10, 0.5, 'people'), props: num('/100m²', 0, 20, 0.5, 'set dressing'), creatures: num('/100m²', 0, 10, 0.2, 'hostiles') },
  },
  spawns: {
    doc: 'creature spawning',
    fields: { respawnSeconds: num('s', 5, 86_400, 300, 'respawn delay'), boss: { t: 'ref', def: null, doc: 'boss anchor landmark (none by default)' } },
  },
  ambience: {
    doc: 'look and sound only, never rules',
    fields: {
      preset: key('ash-pit', 'lighting / time-of-day preset'),
      weather: key('dust', 'weather preset'),
      sound: key('wind', 'ambient sound bed'),
      dayNightSpeed: num('×', 0, 1000, 0, 'day/night clock speed vs real time (0 = frozen)'),
    },
  },
  connections: {
    doc: 'links to other zones in the region',
    entries: {
      to: { t: 'zone', doc: 'target zone' },
      kind: { t: 'enum', values: ['gate', 'road', 'portal'], def: 'gate', doc: 'link kind' },
      here: { t: 'ref', doc: 'landmark on this side' },
      there: { t: 'key', doc: 'landmark on the target side (checked against the target zone)' },
      twoWay: bool(true, 'the target must link back'),
    },
  },
  terrain: {
    doc: 'the ground',
    fields: {
      biome: key('ash-waste', 'biome'),
      ground: key('sand', 'ground surface'),
      heightMin: num('m', -500, 2000, 0, 'lowest ground'),
      heightMax: num('m', -500, 2000, 0, 'highest ground (>= min)'),
    },
  },
  rules: {
    doc: 'what the zone allows',
    fields: {
      safe: bool(false, 'no PvP, no hostile spawns'),
      pvp: bool(false, 'open PvP (never with safe)'),
      restAllowed: bool(true, 'rest / rested credit'),
      tradeAllowed: bool(true, 'player trade'),
      mountsAllowed: bool(false, 'mounts'),
    },
  },
  difficulty: {
    doc: 'how hard the zone is (the one creature level band)',
    fields: {
      levelMin: int('level', 1, 100, 1, 'creature level band low'),
      levelMax: int('level', 1, 100, 1, 'creature level band high (>= low)'),
      lootTier: int('tier', 1, TITLES.length, 1, 'loot tier, 1..10 as the title tiers'),
    },
  },
  economy: {
    doc: 'vendors',
    fields: {
      vendorTier: int('tier', 1, TITLES.length, 1, 'vendor stock tier'),
      buyMultiplier: num('×', 0.1, 10, 1, 'price the player pays'),
      sellMultiplier: num('×', 0, 10, 0.5, 'price the player gets (<= buy)'),
    },
  },
} as const satisfies Schema;

// The typed result of resolving a zone against a schema.
type Value<F> = F extends { t: 'num' | 'int' } ? number
  : F extends { t: 'bool' } ? boolean
  : F extends { t: 'enum'; values: readonly (infer V)[] } ? V
  : F extends { t: 'ref'; def: null } ? string | null
  : string;
type Shape<F> = { [K in keyof F]: Value<F[K]> };
export type Resolved<S extends Schema> = {
  [G in keyof S]: S[G] extends { entries: infer E } ? Record<string, Shape<E>> : S[G] extends { fields: infer F } ? Shape<F> : never;
};
export type Params = Resolved<typeof SCHEMA>;

// Cross-field rules a single field's range cannot say. Landmark refs are checked generically (kind 'ref'), not here.
export const CHECKS: ((p: Params) => [string, string] | null)[] = [
  (p) => (p.movement.runSpeed < p.movement.walkSpeed ? ['movement.runSpeed', 'run speed is below walk speed'] : null),
  (p) => (p.view.fogNear >= p.view.fogFar ? ['view.fogNear', 'fog must start before it is opaque'] : null),
  (p) => (p.view.backdropRadius > p.view.drawDistance ? ['view.backdropRadius', 'the backdrop ring sits beyond the draw distance'] : null),
  (p) => (p.terrain.heightMin > p.terrain.heightMax ? ['terrain.heightMin', 'lowest ground is above highest'] : null),
  (p) => (p.rules.safe && p.rules.pvp ? ['rules.pvp', 'a safe zone cannot be PvP'] : null),
  (p) => (p.difficulty.levelMin > p.difficulty.levelMax ? ['difficulty.levelMin', 'level band is upside down'] : null),
  (p) => (p.economy.sellMultiplier > p.economy.buyMultiplier ? ['economy.sellMultiplier', 'selling pays more than buying costs'] : null),
  (p) => {
    const wide = Object.entries(p.passages).find(([, x]) => x.width > p.zoneSize.width);
    return wide ? [`passages.${wide[0]}.width`, 'passage is wider than its zone'] : null;
  },
];
