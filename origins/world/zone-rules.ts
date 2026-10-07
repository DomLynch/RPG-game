// Origins zone rules (Dom, 2026-10-07, via Strategy): how a zone must feel to cross it at the Run speed. Pure checks over a sketch of a zone, so a
// generated zone (populate.ts) and a hand-authored one (Region 1, in a test) are held to the same three rules, and a failure names the zone:
//   zone-too-wide  no zone takes more than 45 s to run across (so at most 234 m on a side at the 5.2 m/s Run knot)
//   dead-stretch   something every 15 s of travel along the paths: a landmark, a camp or a creature (so no hop above 78 m)
//   late-fight     the first fight within 10 s of entering a zone that is not safe (so a creature within 52 m of the entry)
// The fourth rule (turn-ins next to the action) belongs to the quest templates, and "no auto-run, ever" is a rule of the input, not of a zone.
import type { Params } from './schema.ts';

export const RUN_SPEED = 5.2;   // m/s: the gait table's Run knot (src/characters.ts gaitWeights)
export const ACROSS_SECONDS = 45, HOP_SECONDS = 15, FIRST_FIGHT_SECONDS = 10;
export const MAX_ACROSS_M = RUN_SPEED * ACROSS_SECONDS;           // 234
export const MAX_HOP_M = RUN_SPEED * HOP_SECONDS;                 // 78
export const MAX_FIRST_FIGHT_M = RUN_SPEED * FIRST_FIGHT_SECONDS; // 52

export type Pt = { x: number; z: number };
// Metres in one frame (x across, z inward from the entry edge). `stops` are the landmarks and quest steps; `creatures` every creature's home.
export type ZoneSketch = { name: string; width: number; depth: number; entry: Pt; stops: Pt[]; creatures: Pt[]; safe: boolean };
export type ZoneIssue = { code: 'zone-too-wide' | 'dead-stretch' | 'late-fight'; zone: string; message: string };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);

// The widest gap a player can be left in. Points within MAX_HOP_M of each other are one chain; starting from the entry we reach every point
// the chain reaches, and if some points are left over, the gap is the shortest bridge from the reached ones to the rest (null = nothing is cut off).
export function worstHop(entry: Pt, points: readonly Pt[]): { from: Pt; to: Pt; d: number } | null {
  const reached: Pt[] = [entry], left = [...points];
  for (let grew = true; grew && left.length;) {
    grew = false;
    for (let i = left.length - 1; i >= 0; i--) if (reached.some((r) => dist(r, left[i]!) <= MAX_HOP_M)) { reached.push(left.splice(i, 1)[0]!); grew = true; }
  }
  let best: { from: Pt; to: Pt; d: number } | null = null;
  for (const l of left) for (const r of reached) { const d = dist(r, l); if (!best || d < best.d) best = { from: r, to: l, d }; }
  return best;
}

// The opener rule, one function for the generator and for hand zones: where the first fight stands. A spot `clear` (15) to `far` (40) m from the entry,
// on the inward side (`inward` is the heading the zone runs in, 0 = +z), that `ok` accepts. `rand` is any [0, 1) source; null when nothing fits.
export const OPENER_CLEAR = 15, OPENER_FAR = 40;
export function openerSpot(entry: Pt, inward: number, rand: () => number, ok: (x: number, z: number) => boolean, clear = OPENER_CLEAR, far = OPENER_FAR): Pt | null {
  for (let t = 0; t < 60; t++) {
    const r = clear + 4 + rand() * (far - clear - 12), a = inward + rand() * Math.PI - Math.PI / 2, x = entry.x + Math.sin(a) * r, z = entry.z + Math.cos(a) * r;
    if (ok(x, z)) return { x, z };
  }
  return null;
}

export function checkZone(z: ZoneSketch): ZoneIssue[] {
  const out: ZoneIssue[] = [], add = (code: ZoneIssue['code'], message: string) => out.push({ code, zone: z.name, message: `${z.name}: ${message}` });
  const across = Math.max(z.width, z.depth);
  if (across > MAX_ACROSS_M) add('zone-too-wide', `${across.toFixed(0)} m across is ${(across / RUN_SPEED).toFixed(0)} s at the Run speed (limit ${ACROSS_SECONDS} s, ${MAX_ACROSS_M.toFixed(0)} m)`);
  const points = [...z.stops, ...z.creatures], hop = worstHop(z.entry, points);
  if (!points.length && across > MAX_HOP_M) add('dead-stretch', `nothing to meet in a ${across.toFixed(0)} m zone (limit ${HOP_SECONDS} s, ${MAX_HOP_M.toFixed(0)} m between things)`);
  else if (hop) add('dead-stretch', `${hop.d.toFixed(0)} m (${(hop.d / RUN_SPEED).toFixed(0)} s) with nothing to meet, from (${hop.from.x.toFixed(0)}, ${hop.from.z.toFixed(0)}) to (${hop.to.x.toFixed(0)}, ${hop.to.z.toFixed(0)}) (limit ${HOP_SECONDS} s, ${MAX_HOP_M.toFixed(0)} m)`);
  if (!z.safe) {
    const near = z.creatures.length ? Math.min(...z.creatures.map((c) => dist(z.entry, c))) : Infinity;
    if (near > MAX_FIRST_FIGHT_M) add('late-fight', near === Infinity ? 'no creature at all in a zone that is not safe' : `the nearest creature is ${near.toFixed(0)} m (${(near / RUN_SPEED).toFixed(0)} s) from the entry (limit ${FIRST_FIGHT_SECONDS} s, ${MAX_FIRST_FIGHT_M.toFixed(0)} m)`);
  }
  return out;
}

// A generated zone's sketch: the entry landmark (else the middle of the entry edge), every landmark but the entry, and the creatures the generator placed.
export function sketchOf(name: string, zone: Params, creatures: readonly Pt[]): ZoneSketch {
  const mpu = zone.scale.metresPerUnit, width = zone.zoneSize.width * mpu, depth = zone.zoneSize.depth * mpu, e = zone.layout.entry;
  const at = (l: { u: number; v: number }): Pt => ({ x: l.u * width, z: l.v * depth });
  return {
    name, width, depth, entry: e ? at(e) : { x: width / 2, z: 0 },
    stops: Object.entries(zone.layout).filter(([k]) => k !== 'entry').map(([, l]) => at(l)), creatures: [...creatures], safe: zone.rules.safe,
  };
}
