// Origins mob generator (mobs.md 7.6): rows + a zone's Params + a seed -> camps of creatures, deterministic and pure. generateZone makes the zone and
// never touches creatures; this reads the zone it made. Zone-frame metres: x across (0..width), z inward from the entry edge (0..depth), the same
// frame a landmark's (u, v) gives. The caller turns that into world metres and supplies `stand` (the ground a creature may stand on).
// Budget: round(density.creatures * footprint / 100 m2), at least 1, 0 in a safe zone. Whole camps are drawn until the budget is met.
import { prng } from '../world/generate.ts';
import type { Params } from '../world/schema.ts';
import { DEFAULTS, validateMobRow, type MobRow, type RowContext, type RowIssue } from './row.ts';

export type Member = { x: number; z: number; level: number };
export type Camp = { row: string; at: string; members: Member[] };
export type Populated = { camps: Camp[]; budget: number; rejected: { row: string; issues: RowIssue[] }[] };

const CAMP_GAP = 6;   // m: two camps' centres stay at least this far apart
const DOOR_CLEAR = 15;   // m: no camp within this of the entry landmark (the hero arrives there)
const MOBS = 0x6d6f6273;   // "mobs": the stream's seed offset

export function populateZone(zone: Params, rows: readonly MobRow[], seed: number, ctx: RowContext, stand: (x: number, z: number) => boolean = () => true): Populated {
  const mpu = zone.scale.metresPerUnit, width = zone.zoneSize.width * mpu, depth = zone.zoneSize.depth * mpu;
  const budget = zone.rules.safe ? 0 : Math.max(1, Math.round((zone.density.creatures * width * depth) / 100));
  const rejected: Populated['rejected'] = [], eligible: MobRow[] = [];
  const zoneCtx: RowContext = { ...ctx, generated: true, zone: { levelMin: zone.difficulty.levelMin, levelMax: zone.difficulty.levelMax } };
  for (const r of rows) {
    if (r.later) continue;
    const issues = validateMobRow(r, zoneCtx);
    if (issues.length) rejected.push({ row: r.id, issues }); else eligible.push(r);
  }
  const camps: Camp[] = [];
  if (!budget || !eligible.length) return { camps, budget, rejected };
  // Where camps may stand: the zone's own landmarks, not its exits (`to-…`) and not the boss anchor.
  const sites = Object.entries(zone.layout).filter(([k]) => !k.startsWith('to-') && k !== 'entry' && k !== zone.spawns.boss);
  if (!sites.length) return { camps, budget, rejected };
  const entry = zone.layout.entry, door = entry && { x: entry.u * width, z: entry.v * depth }, reach = Math.min(width, depth) * 0.3;   // a camp stands within `reach` of its landmark
  const rand = prng((seed ^ MOBS) >>> 0), total = eligible.reduce((n, r) => n + (r.weight ?? DEFAULTS.weight), 0);
  let made = 0;
  for (let guard = 0; made < budget && guard < budget * 8; guard++) {
    let pick = rand() * total, row = eligible[0]!;
    for (const r of eligible) { pick -= r.weight ?? DEFAULTS.weight; if (pick <= 0) { row = r; break; } }
    const [site, l] = sites[Math.floor(rand() * sites.length)]!, r0 = reach * Math.sqrt(rand()), a0 = rand() * Math.PI * 2;
    const centre = { x: l.u * width + Math.sin(a0) * r0, z: l.v * depth + Math.cos(a0) * r0 };
    if (centre.x < 0 || centre.x > width || centre.z < 0 || centre.z > depth || (door && Math.hypot(centre.x - door.x, centre.z - door.z) < DOOR_CLEAR)) continue;
    if (camps.some((c) => Math.hypot(c.members[0]!.x - centre.x, c.members[0]!.z - centre.z) < CAMP_GAP)) continue;
    const [cmin, cmax] = row.behaviour.campSize ?? DEFAULTS.campSize, size = cmin + Math.floor(rand() * (cmax - cmin + 1)), spread = row.behaviour.spread ?? 6;
    const lo = Math.max(row.level[0], zone.difficulty.levelMin), hi = Math.min(row.level[1], zone.difficulty.levelMax), members: Member[] = [];
    for (let i = 0; i < size; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const r = spread * Math.sqrt(rand()), a = rand() * Math.PI * 2, x = centre.x + Math.sin(a) * r, z = centre.z + Math.cos(a) * r;
        if (x >= 0 && x <= width && z >= 0 && z <= depth && stand(x, z)) { members.push({ x, z, level: lo + (i % (hi - lo + 1)) }); break; }
      }
    }
    if (members.length) { camps.push({ row: row.id, at: site, members }); made += members.length; }
  }
  return { camps, budget, rejected };
}
