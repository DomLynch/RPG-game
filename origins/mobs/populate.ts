// Origins mob generator (mobs.md 7.6): rows + a zone's Params + a seed -> camps of creatures, deterministic and pure. generateZone makes the zone and
// never touches creatures; this reads the zone it made. Zone-frame metres: x across (0..width), z inward from the entry edge (0..depth), the same
// frame a landmark's (u, v) gives. The caller turns that into world metres and supplies `stand` (the ground a creature may stand on).
// Budget: round(density.creatures * footprint / 100 m2), at least 1, 0 in a safe zone. Whole camps are drawn until the budget is met. The zone rules
// (origins/world/zone-rules.ts) then come first: an OPENER camp stands within 40 m of the entry (first fight within 10 s), and a camp is added
// wherever the walk would be left more than 15 s with nothing to meet, even past the budget. `issues` is what is still broken, named by zone.
import { prng } from '../world/generate.ts';
import type { Params } from '../world/schema.ts';
import { MAX_HOP_M, OPENER_CLEAR, checkZone, openerSpot, sketchOf, worstHop, type ZoneIssue } from '../world/zone-rules.ts';
import { DEFAULTS, RARE_DEFAULT, rungWeights, validateMobRow, type MobRow, type RowContext, type RowIssue } from './row.ts';

export type Member = { x: number; z: number; level: number };
export type Camp = { row: string; at: string; members: Member[] };
export type Populated = { camps: Camp[]; budget: number; rejected: { row: string; issues: RowIssue[] }[]; issues: ZoneIssue[] };

const CAMP_GAP = 6;      // m: two camps' centres stay at least this far apart
const DOOR_CLEAR = OPENER_CLEAR;   // m: no camp within this of the entry landmark (the hero arrives there)
const MOBS = 0x6d6f6273; // "mobs": the stream's seed offset

export function populateZone(zone: Params, rows: readonly MobRow[], seed: number, ctx: RowContext, stand: (x: number, z: number) => boolean = () => true, name = 'zone'): Populated {
  const mpu = zone.scale.metresPerUnit, width = zone.zoneSize.width * mpu, depth = zone.zoneSize.depth * mpu;
  const budget = zone.rules.safe ? 0 : Math.max(1, Math.round((zone.density.creatures * width * depth) / 100));
  const rejected: Populated['rejected'] = [], eligible: MobRow[] = [];
  const zoneCtx: RowContext = { ...ctx, generated: true, zone: { levelMin: zone.difficulty.levelMin, levelMax: zone.difficulty.levelMax } };
  for (const r of rows) {
    if (r.later) continue;
    const issues = validateMobRow(r, zoneCtx);
    if (!issues.length) eligible.push(r);
    else if (issues.some((i) => i.code !== 'level-band')) rejected.push({ row: r.id, issues });   // a band that misses this zone is just not eligible here
  }
  const camps: Camp[] = [], finish = (): Populated => ({ camps, budget, rejected, issues: checkZone(sketchOf(name, zone, camps.flatMap((c) => c.members))) });
  if (!budget || !eligible.length) return finish();
  // Where camps may stand: the zone's own landmarks, not its exits (`to-…`), not the entry and not the boss anchor.
  const sites = Object.entries(zone.layout).filter(([k]) => !k.startsWith('to-') && k !== 'entry' && k !== zone.spawns.boss);
  const entry = zone.layout.entry, door = entry ? { x: entry.u * width, z: entry.v * depth } : { x: width / 2, z: 0 }, reach = Math.min(width, depth) * 0.3;
  const rand = prng((seed ^ MOBS) >>> 0), weights = rungWeights(eligible, zone.difficulty), total = weights.reduce((n, w) => n + w, 0);
  if (!(total > 0)) return finish();   // only rares (or nothing drawable): a rare never stands alone
  const inside = (x: number, z: number) => x >= 0 && x <= width && z >= 0 && z <= depth;
  const pickRow = () => { let p = rand() * total, row = eligible[weights.findIndex((w) => w > 0)]!; for (const [i, r] of eligible.entries()) { if (weights[i]! > 0 && (p -= weights[i]!) <= 0) { row = r; break; } }
    const rare = eligible.find((r) => r.replaces === row.id);   // a placeholder's camp may be its rare's instead (the stream is only touched when a rare exists)
    return rare && rand() < (rare.chance ?? RARE_DEFAULT) ? rare : row; };
  const apart = (c: { x: number; z: number }) => !camps.some((k) => Math.hypot(k.members[0]!.x - c.x, k.members[0]!.z - c.z) < CAMP_GAP);
  // One camp of `row` round `centre`, `size` members (default: the row's own draw); null when no member found room.
  const camp = (row: MobRow, at: string, centre: { x: number; z: number }, size?: number): Camp | null => {
    const [cmin, cmax] = row.behaviour.campSize ?? DEFAULTS.campSize, n = size ?? cmin + Math.floor(rand() * (cmax - cmin + 1)), spread = row.behaviour.spread ?? 6;
    const lo = Math.max(row.level[0], zone.difficulty.levelMin), hi = Math.min(row.level[1], zone.difficulty.levelMax), members: Member[] = [];
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const r = spread * Math.sqrt(rand()), a = rand() * Math.PI * 2, x = centre.x + Math.sin(a) * r, z = centre.z + Math.cos(a) * r;
        if (inside(x, z) && stand(x, z)) { members.push({ x, z, level: lo + (i % (hi - lo + 1)) }); break; }
      }
    }
    return members.length ? { row: row.id, at, members } : null;
  };
  // The opener (zone-rules.ts openerSpot, the same rule the hand zones use): the first fight stands inside the 10 s window.
  for (let t = 0; t < 6 && !camps.length; t++) {
    const spot = openerSpot(door, 0, rand, inside);
    const c = spot && camp(pickRow(), 'opener', spot); if (c) camps.push(c);
  }
  let made = camps.reduce((n, c) => n + c.members.length, 0);
  for (let guard = 0; sites.length && made < budget && guard < budget * 8; guard++) {
    const row = pickRow(), [site, l] = sites[Math.floor(rand() * sites.length)]!, r0 = reach * Math.sqrt(rand()), a0 = rand() * Math.PI * 2;
    const centre = { x: l.u * width + Math.sin(a0) * r0, z: l.v * depth + Math.cos(a0) * r0 };
    if (!inside(centre.x, centre.z) || Math.hypot(centre.x - door.x, centre.z - door.z) < DOOR_CLEAR || !apart(centre)) continue;
    const c = camp(row, site, centre);
    if (c) { camps.push(c); made += c.members.length; }
  }
  // Dead stretches: wherever the walk is left more than 15 s with nothing, a camp goes in the middle of the gap (bounded; the rule may beat the budget).
  const stops = Object.entries(zone.layout).filter(([k]) => k !== 'entry').map(([, l]) => ({ x: l.u * width, z: l.v * depth }));
  for (let fill = 0; fill < 40; fill++) {
    const hop = worstHop(door, [...stops, ...camps.flatMap((c) => c.members)]);
    if (!hop || hop.d <= MAX_HOP_M) break;
    const mid = { x: (hop.from.x + hop.to.x) / 2, z: (hop.from.z + hop.to.z) / 2 }, c = camp(pickRow(), 'fill', mid, 1);
    if (!c) break;
    camps.push(c);
  }
  return finish();
}
