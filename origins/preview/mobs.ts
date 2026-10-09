// Origins slice 1, bite 1 (?region=1): the Ash Frontier's creatures, VISIBLE and WANDERING. Pure: no three.js, no DOM, no clock, so the
// placement, the wander, the aggro test and the facing are tested in node (mobs.test.ts). mobs-view.ts draws them.
//
// Who stands where comes from the Region 1 data: every Frontier spawn that names creatures (a `mob` encounter form: scavengers at the ash
// pits, brood at the reed bank, ghouls at the causeway's end) or an encounter (a Bounty's foe or the matriarch: one named creature at its
// landmark). The data says WHERE (the landmark) and WHO (the character, its body and level); it does not say how many, so the counts and the
// roam radii below are this preview's (MOB_PLAN). Nothing fights, drops or saves here: a mob that sees you stops and faces you.
import { SPEEDS } from './speeds.ts';
import type { CharacterId, EncounterId } from '../contracts/ids.ts';
import type { MobRow } from '../mobs/row.ts';
import { loadZone } from '../zones/loader.ts';
const ZONE = loadZone(), ZONE_LEVEL = ZONE.level, FRONTIER_OPENERS = ZONE.spawns.openers, FRONTIER_ROWS = ZONE.spawns.rows;   // Zone 1's creature data (origins/zones/zone1/spawns.ts), through the loader
import { MAX_FIRST_FIGHT_M, openerSpot } from '../world/zone-rules.ts';
import { FRONTIER, inZone, type Build, type Frontier, type ZonePlan } from './frontier-plan.ts';

export type Pos = { x: number; z: number };
export type MobSpec = {
  id: string; character: string; name: string; encounter: EncounterId | null; body: string; level: number;
  zone: string; spawn: string; home: Pos; roam: number; aggro: number; named: boolean;
};
export type Mode = 'idle' | 'wander' | 'aggro';
export type Mob = { x: number; z: number; facing: number; mode: Mode; wait: number; tx: number; tz: number; rng: number };

// The common kinds' numbers (count, spread, pull, roam, level band) are mob rows now: origins/zones/zone1/spawns.ts. Named creatures keep these:
// A world duel is up (?worldfight): only the engaged creature is hidden (the duel draws it); every other creature stays in view and alive, packmates and far ones included
// (Dom, 2026-10-08: "it can be 2 vs 1, that is fine"; one always-on world, nothing freezes or hides at engage).
export const hiddenInFight = (id: string, foe: string | null): boolean => id === foe;
export const NAMED = { spread: 0, pull: 5, roam: 2.5 };
export const TUNING = {
  walk: SPEEDS.creature.amble,   // m/s: a creature's amble, well under the hero's walk (the one speed table, speeds.ts)
  turn: 3.2,            // rad/s the body swings toward where it is going or looking
  aggro: 7,             // m: the ring a creature notices the hero inside (named ones 9)
  aggroNamed: 9,
  hold: 1.5,            // m: it keeps looking until the hero is this much beyond the ring (no flicker on the rim)
  idle: [1.5, 4.5] as const,   // s: how long it stands between amblings
  arrive: 0.35,         // m: close enough to the spot
  clear: 0.7,           // m: how far from a solid a creature keeps
  edge: 2,              // m: and from its zone's edge
  cap: 12,              // creatures drawn at once
  range: 45,            // m: none are drawn beyond this
  seed: 0x0f1e2d3c,
};

// ---- the seeded random: mulberry32, state in, [0..1) and the next state out ---------------------------------------------------

export function nextRandom(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
export const mixSeed = (seed: number, n: number) => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n + 1, 0xc2b2ae35)) >>> 0;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- placement ------------------------------------------------------------------------------------------------------------------

// Where a creature of `zone` may stand: inside the zone with a margin, and clear of every solid (buildings, posts, towers, cairns).
export const mobStand = (b: Build, zone: ZonePlan) => (x: number, z: number): boolean =>
  inZone(zone, x, z, TUNING.edge) && !b.solids.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + TUNING.clear);

// The Ash Wolf is a live row (zones/zone1/spawns.ts); `?wolf` is accepted and does nothing. The signature stays for the page and the tests.
export const previewRows = (_search: string): readonly MobRow[] => FRONTIER_ROWS;

export function mobSpecs(f: Frontier, b: Build, rows: readonly MobRow[] = FRONTIER_ROWS): MobSpec[] {
  const ID_PREFIX = f.zone === '1' ? '' : `z${f.zone}:`;   // instance ids: Zone 1's unchanged, every other zone z<id>: (the server keys a creature by its id alone)
  const reg = f.data.registry.regions.get(FRONTIER)!, out: MobSpec[] = [];
  for (const sp of reg.spawns) {
    const zone = f.zones.find((z) => z.region === FRONTIER && Object.hasOwn(z.landmarks, sp.at));
    if (!zone) continue;
    // Who: the spawn's creatures (their `mob` form), or the boss of its encounter (the form that names that encounter).
    const who: { id: CharacterId; form: { id: string; opponent: string | null; level: number | null } }[] = [];
    for (const c of sp.characters) {
      const def = f.data.registry.characters.get(c), form = def?.encounterForms.find((x) => x.id === 'mob');
      if (def && form) who.push({ id: c, form });
    }
    if (sp.encounter) {
      const boss = f.data.registry.encounters.get(sp.encounter)?.boss.character, def = boss && f.data.registry.characters.get(boss);
      const form = def && def.encounterForms.find((x) => x.encounter === sp.encounter);
      if (def && form) who.push({ id: def.id, form });
    }
    const at = zone.landmarks[sp.at]!, stand = mobStand(b, zone), mid = zoneCentre(zone);
    for (const w of who) {
      const named = !!sp.encounter, row = named ? undefined : rows.find((r) => r.id === w.id);
      if (!named && !row) continue;   // a kind with no row stands nowhere
      const bh = row?.behaviour, p = named ? NAMED : { spread: bh!.spread ?? 6, pull: bh!.pull ?? 0, roam: bh!.roam ?? 6 };
      const count = named ? 1 : bh!.campSize![1], def = f.data.registry.characters.get(w.id)!;
      const dx = mid.x - at.x, dz = mid.z - at.z, l = Math.hypot(dx, dz) || 1, base = { x: at.x + (dx / l) * p.pull, z: at.z + (dz / l) * p.pull };
      for (let i = 0; i < count; i++) {
        const id = `${ID_PREFIX}${sp.id}-${i + 1}`;
        let rng = mixSeed(TUNING.seed, out.length), home: Pos | null = null;
        for (let tries = 0; tries < 60 && !home; tries++) {
          let u: number, v: number;
          [u, rng] = nextRandom(rng); [v, rng] = nextRandom(rng);
          const r = p.spread * Math.sqrt(u), a = v * Math.PI * 2, x = base.x + Math.sin(a) * r, z = base.z + Math.cos(a) * r;
          if (stand(x, z)) home = { x, z };
        }
        if (!home) continue;   // no room found (never true on the shipped data; the test pins it)
        out.push({
          id, character: w.id, name: def.name, encounter: sp.encounter, body: w.form.opponent ?? 'goblin', level: named ? (w.form.level ?? NAMED_LEVEL) : row!.level[0],
          zone: zone.zone, spawn: sp.id, home, roam: p.roam, aggro: named ? TUNING.aggroNamed : (bh!.aggro ?? TUNING.aggro), named,
        });
      }
    }
  }
  // The openers: a zone the data leaves without a creature inside the first-fight window gets one lone opener (zone-rules.ts openerSpot), appended last.
  for (const [zoneId, rowId] of Object.entries(FRONTIER_OPENERS)) {
    const zone = f.zones.find((z) => z.zone === zoneId), row = rows.find((r) => r.id === rowId), def = f.data.registry.characters.get(rowId as CharacterId);
    const form = def?.encounterForms.find((x) => x.id === 'mob');
    if (!zone || !row || !def || !form) continue;
    const near = out.some((m) => m.zone === zoneId && Math.hypot(m.home.x - zone.mount.x, m.home.z - zone.mount.z) <= MAX_FIRST_FIGHT_M);
    if (near) continue;
    let rng = mixSeed(TUNING.seed, 5000 + out.length);
    const stand = mobStand(b, zone), spot = openerSpot({ x: zone.mount.x, z: zone.mount.z }, zone.mount.heading, () => { let u: number; [u, rng] = nextRandom(rng); return u; }, stand);
    if (!spot) continue;
    out.push({ id: `${ID_PREFIX}opener-${zoneId}-1`, character: rowId, name: def.name, encounter: null, body: form.opponent ?? 'goblin', level: row.level[0], zone: zoneId, spawn: 'opener', home: spot, roam: row.behaviour.roam ?? 6, aggro: row.behaviour.aggro ?? TUNING.aggro, named: false });
  }
  return levelByDistance(f, b, out, rows);
}
// Risk = reward by depth (Dom 2026-10-08): a common creature is its zone's level near the hero's spawn (Zone 1 = L1) and one more at the zone's edge, a
// row's band [N, N+1] ramped by the distance of its home from the spawn; the named rares are N+2. The origin is the Zone 1 spawn (spawnAmong) until the bank
// town is placed: then it is this one function to change. Rewards and loot already follow the resulting spec.level.
export const LEVEL_NEAR_M = 30, LEVEL_FAR_M = 150, NAMED_LEVEL = ZONE_LEVEL + 2;
export const levelAt = (d: number, band: readonly [number, number]): number => band[0] + Math.round(Math.max(0, Math.min(1, (d - LEVEL_NEAR_M) / (LEVEL_FAR_M - LEVEL_NEAR_M))) * (band[1] - band[0]));
const levelByDistance = (f: Frontier, b: Build, specs: MobSpec[], rows: readonly MobRow[]): MobSpec[] => {
  const origin = spawnAmong(f, b, specs);
  return origin ? specs.map((s) => { const row = s.named ? undefined : rows.find((r) => r.id === s.character); return row ? { ...s, level: levelAt(Math.hypot(s.home.x - origin.x, s.home.z - origin.z), row.level) } : s; }) : specs;
};
// Which world bodies a zone spawns (the bodies the phone downloads for it): the unique `body` of its specs, sorted. check-budget reads this, so a world body
// counts against a zone's set only once a row spawns it there (Dom/Lead 2026-10-08: the WORLD budget is per zone, not one global cap).
export const zoneBodies = (specs: readonly MobSpec[]): Record<string, string[]> => {
  const out: Record<string, Set<string>> = {};
  for (const s of specs) (out[s.zone] ??= new Set()).add(s.body);
  return Object.fromEntries(Object.entries(out).map(([zone, set]) => [zone, [...set].sort()]));
};
export const regionBodies = (specs: readonly MobSpec[]): string[] => [...new Set(specs.map((s) => s.body))].sort();

// The middle of a zone's footprint, world metres (zone frame: across 0, inward depth/2).
function zoneCentre(z: ZonePlan): Pos {
  const s = Math.sin(z.mount.heading), c = Math.cos(z.mount.heading), d = z.depth / 2;
  return { x: z.mount.x + d * s, z: z.mount.z + d * c };
}

// ---- behaviour ------------------------------------------------------------------------------------------------------------------

export function newMob(spec: MobSpec, index: number): Mob {
  const [a, r1] = nextRandom(mixSeed(TUNING.seed, 1000 + index)), [w, rng] = nextRandom(r1);
  return { x: spec.home.x, z: spec.home.z, facing: a * Math.PI * 2 - Math.PI, mode: 'idle', wait: TUNING.idle[0] + w * (TUNING.idle[1] - TUNING.idle[0]), tx: spec.home.x, tz: spec.home.z, rng };
}

// The aggro test, with hysteresis: it notices the hero inside `aggro`, and keeps watching until the hero is `hold` beyond it.
export const aggroTest = (m: Mob, s: Pick<MobSpec, 'aggro'>, hero: Pos | null): boolean => {
  if (!hero) return false;
  const d = Math.hypot(hero.x - m.x, hero.z - m.z);
  return m.mode === 'aggro' ? d <= s.aggro + TUNING.hold : d < s.aggro;
};
// Swing a heading toward a target by at most `step` radians, the short way round.
export const turnToward = (facing: number, target: number, step: number): number => {
  const d = wrap(target - facing);
  return Math.abs(d) <= step ? wrap(target) : wrap(facing + Math.sign(d) * step);
};
export const headingTo = (from: Pos, to: Pos): number => Math.atan2(to.x - from.x, to.z - from.z);

// One wander target: a seeded point within `roam` of home that the creature may stand on, or null (it stays put a while longer).
export function wanderTarget(s: MobSpec, rng: number, stand: (x: number, z: number) => boolean): { to: Pos | null; rng: number } {
  let u: number, v: number;
  [u, rng] = nextRandom(rng); [v, rng] = nextRandom(rng);
  const r = s.roam * Math.sqrt(u), a = v * Math.PI * 2, x = s.home.x + Math.sin(a) * r, z = s.home.z + Math.cos(a) * r;
  return { to: stand(x, z) ? { x, z } : null, rng };
}

export function stepMob(m: Mob, s: MobSpec, hero: Pos | null, dt: number, stand: (x: number, z: number) => boolean): Mob {
  if (aggroTest(m, s, hero)) return { ...m, mode: 'aggro', facing: turnToward(m.facing, headingTo(m, hero!), TUNING.turn * 2 * dt) };
  if (m.mode === 'aggro') m = { ...m, mode: 'idle', wait: 1.2 };   // the hero left: a breath, then back to its round
  if (m.mode === 'idle') {
    const wait = m.wait - dt;
    if (wait > 0) return { ...m, wait };
    const [w, r1] = nextRandom(m.rng), t = wanderTarget(s, r1, stand), pause = TUNING.idle[0] + w * (TUNING.idle[1] - TUNING.idle[0]);
    return t.to ? { ...m, mode: 'wander', tx: t.to.x, tz: t.to.z, wait: pause, rng: t.rng } : { ...m, wait: pause, rng: t.rng };
  }
  // wander: swing toward the spot, then amble; stop at the spot, or the moment the next step would leave the walkable ground
  const want = headingTo(m, { x: m.tx, z: m.tz }), facing = turnToward(m.facing, want, TUNING.turn * dt);
  if (Math.hypot(m.tx - m.x, m.tz - m.z) < TUNING.arrive) return { ...m, facing, mode: 'idle' };
  if (Math.abs(wrap(want - facing)) > 0.6) return { ...m, facing };
  const nx = m.x + Math.sin(facing) * TUNING.walk * dt, nz = m.z + Math.cos(facing) * TUNING.walk * dt;
  return stand(nx, nz) ? { ...m, x: nx, z: nz, facing } : { ...m, facing, mode: 'idle' };
}

// Who is drawn: the nearest `cap` creatures within `range` of the hero, nearest first (indexes into `at`).
export function pickVisible(at: readonly Pos[], hero: Pos, cap = TUNING.cap, range = TUNING.range): number[] {
  return at.map((p, i) => ({ i, d: Math.hypot(p.x - hero.x, p.z - hero.z) })).filter((e) => e.d <= range).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, cap).map((e) => e.i);
}

// Where the preview drops the hero: in sight of the biggest group of creatures but outside their reach, on the first free spot (scanning outward
// from 25 m, so nearest the group) that stands 25-35 m from the nearest creature (wolves aside) (clear of the 14 m tap reach and the notice rings, close enough to
// see them). When wolves are placed (?wolf) it stands 15-25 m from the nearest wolf instead and faces the wolf camp: the first thing in front of him is
// the wolf. Falls back to any spot clear of every notice ring. Deterministic.
const SPAWN_NEAR = 25, SPAWN_FAR = 35, SPAWN_WOLF: readonly [number, number] = [15, 25];
export function spawnAmong(f: Frontier, b: Build, specs: readonly MobSpec[]): { x: number; z: number; facing: number } | null {
  const groups = new Map<string, MobSpec[]>();
  for (const s of specs) { const g = groups.get(s.zone + '/' + s.spawn); if (g) g.push(s); else groups.set(s.zone + '/' + s.spawn, [s]); }
  const crowd = [...groups.values()].sort((a, c) => c.length - a.length)[0];
  const zone = crowd && f.zones.find((z) => z.zone === crowd[0]!.zone);
  if (!crowd || !zone) return null;
  const centre = (g: readonly MobSpec[]) => ({ x: g.reduce((n, s) => n + s.home.x, 0) / g.length, z: g.reduce((n, s) => n + s.home.z, 0) / g.length });
  const wolves = specs.filter((s) => s.body === 'wolf' && s.zone === zone.zone), c = centre(crowd), look = wolves.length ? centre(wolves) : c;
  const others = wolves.length ? specs.filter((s) => s.body !== 'wolf') : specs, stand = mobStand(b, zone), clear = TUNING.aggro + 1, near = (x: number, z: number, of: readonly MobSpec[]) => Math.min(...of.map((s) => Math.hypot(s.home.x - x, s.home.z - z)));
  for (const strict of [true, false]) for (let r = 0; r <= 44; r += 2) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
    if (!stand(x, z) || near(x, z, specs) < clear) continue;
    const d = near(x, z, others), w = wolves.length ? near(x, z, wolves) : null;
    if (strict && (d < SPAWN_NEAR || d > SPAWN_FAR || (w !== null && (w < SPAWN_WOLF[0] || w > SPAWN_WOLF[1])))) continue;
    return { x, z, facing: headingTo({ x, z }, look) };
  }
  return null;
}
