// Seamless step 3 (RV38), the server half: a world fight STARTS where the hero and the creature stand, and the WRITER decides that pose, never the record.
// encounter_start takes the client's proposal (hero and foe, arena-local metres: the caller subtracts the fight circle's centre) and issues a legal pose from it:
//   - the gap between the two is clamped to [MIN_GAP, 6.5 m x the foe's spawn scale] (the sim refuses <= 0.85 m; 6.5 m is the pit marks' own gap at scale 1);
//   - both fighters lie inside the foe's circle (play-radius.ts: 8.55 m, Arena 1 foes 11.7 x 0.36 - 0.425), keeping the direction and the midpoint where possible;
//   - heroFacing is derived (the hero faces the foe, aim = atan2(dx, dz) as sim headings are), and every number is float32-rounded (duel.ts roundPose) BEFORE it is issued,
//     so the client's fight, the record (v38) and the server's re-simulation start from the same bits.
// The issued pose rides in the token (encounter.ts tokenFor): the database holds the token, so settle reads the server's own pose back and a client cannot change it.
import { roundPose, type DuelPose } from '../../src/duel.ts';
import { FIRST_POSE_VERSION } from '../../src/record.ts';
import { BASE_RADIUS, BODY_RADIUS, playScaleFor, WALL_INNER } from '../../src/play-radius.ts';
import { BadRequest } from './errors.ts';

export const MIN_GAP = 2, MARK_GAP = 6.5, POSE_BYTES = 20;
const EDGE = 0.01;   // stay this far inside the wall so float32 rounding can never push a fighter onto it
const TOL = 1e-4;   // float32 rounding of a clamped pair moves it by ~1e-6 m: within this of a bound still fits, so the clamp's own output is a fixed point

// The circle and the widest start gap for this foe, as a posed (v38) record of it replays (detmath.ts underRecord -> play-radius.ts underPlayScale).
export function poseBounds(enemy: string): { radius: number; maxGap: number } {
  const k = playScaleFor(enemy, FIRST_POSE_VERSION);
  return { radius: k === 1 ? BASE_RADIUS : WALL_INNER * k - BODY_RADIUS, maxGap: MARK_GAP * Math.max(k, 0.5) };
}

const point = (v: unknown, name: string): { x: number; z: number } => {
  const p = v as { x?: unknown; z?: unknown } | null;
  if (typeof p !== 'object' || p === null || typeof p.x !== 'number' || typeof p.z !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x) > 1e3 || Math.abs(p.z) > 1e3) throw new BadRequest(`pose.${name}: {x, z} in metres`);
  return { x: p.x, z: p.z };
};

// The client's proposal -> the pose the server issues (undefined: no pose asked, today's pit-mark fight).
export function issuePose(enemy: string, proposal: unknown): DuelPose | undefined {
  if (proposal === undefined) return undefined;
  if (typeof proposal !== 'object' || proposal === null) throw new BadRequest('pose: {hero: {x, z}, foe: {x, z}}');
  const hero = point((proposal as { hero?: unknown }).hero, 'hero'), foe = point((proposal as { foe?: unknown }).foe, 'foe');
  const { radius, maxGap } = poseBounds(enemy), r = radius - EDGE;
  const dx = foe.x - hero.x, dz = foe.z - hero.z, len = Math.hypot(dx, dz);
  let h = hero, f = foe;
  // A pair that already fits (within TOL of the bounds, so a clamped and float32-rounded pair fits too) is kept as it is: issuePose is then a fixed point on its own output, bit for bit,
  // and a client may compute it locally (a prefetched, poseless token: the record's pose is checked with isLegalPose at settle).
  if (!(len >= MIN_GAP - TOL && len <= Math.min(maxGap, 2 * r) + TOL && Math.hypot(hero.x, hero.z) <= r + TOL && Math.hypot(foe.x, foe.z) <= r + TOL)) {
    const [ux, uz] = len > 1e-6 ? [dx / len, dz / len] : [0, 1];   // on top of each other: the hero faces +z, as at the marks
    const gap = Math.min(Math.max(len, MIN_GAP), maxGap, 2 * r);
    let mx = (hero.x + foe.x) / 2, mz = (hero.z + foe.z) / 2;
    const room = r - gap / 2, m = Math.hypot(mx, mz);
    if (m > room) { mx *= room / m; mz *= room / m; }   // pull the pair in toward the centre until both ends are inside
    h = { x: mx - ux * gap / 2, z: mz - uz * gap / 2 }; f = { x: mx + ux * gap / 2, z: mz + uz * gap / 2 };
  }
  const placed = roundPose({ hero: h, foe: f, heroFacing: 0 });   // the points first: the facing is derived from the bits the fight starts from
  return roundPose({ ...placed, heroFacing: Math.atan2(placed.foe.x - placed.hero.x, placed.foe.z - placed.hero.z) });
}

// S3 legal-pose settle (Strategy 2026-10-08, accepted knowingly): a POSELESS world token (prefetched before the tap) may settle a record that starts from a pose, if that pose is one
// the server would issue itself: a strict fixed point of issuePose for this foe (inside its circle, gap within [MIN_GAP, the foe's max], the hero facing the foe, float32), bit for bit.
// The clamp was always the only guarantee a server-issued pose gave; a token issued WITH a pose still needs those exact bytes (encounter-verify.ts).
export function isLegalPose(enemy: string, pose: DuelPose): boolean {
  let again: DuelPose | undefined;
  try { again = issuePose(enemy, { hero: pose.hero, foe: pose.foe }); } catch { return false; }
  return !!again && [[again.hero.x, pose.hero.x], [again.hero.z, pose.hero.z], [again.foe.x, pose.foe.x], [again.foe.z, pose.foe.z], [again.heroFacing, pose.heroFacing]].every(([a, b]) => Object.is(a, b));
}

// Five float32 LE, the record's own order (record.ts v38): hero x, z, foe x, z, heroFacing.
export function packPose(pose: DuelPose): Buffer {
  const b = Buffer.alloc(POSE_BYTES);
  [pose.hero.x, pose.hero.z, pose.foe.x, pose.foe.z, pose.heroFacing].forEach((v, i) => b.writeFloatLE(v, i * 4));
  return b;
}
export function unpackPose(b: Buffer): DuelPose | null {
  if (b.length !== POSE_BYTES) return null;
  const v = [0, 1, 2, 3, 4].map((i) => b.readFloatLE(i * 4));
  return v.every(Number.isFinite) ? { hero: { x: v[0]!, z: v[1]! }, foe: { x: v[2]!, z: v[3]! }, heroFacing: v[4]! } : null;
}
