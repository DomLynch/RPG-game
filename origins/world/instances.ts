// Private instances as a slot pool (World, top-30 row 24: solo instance slot pool; donor: World of Claudecraft's instanceOrigin(dungeon, slot), one private copy of a map per slot band, the
// slot index picking the band; shape only, nothing copied). An instance KIND is a ROW in instances.json: how many slots it has (24), how far apart the slot bands sit (stride, m), how long a slot is
// kept after its owner leaves (graceS, 300) and the longest a slot lives from the moment it opened (maxS, 900), and how many creatures its spawn draws for a headcount (spawnBase + spawnPerPlayer per
// extra player; solo = 1). The pool is a pure value: acquire/leave/expire take `now` (seconds) and return a new pool, so no clock, no storage, no DOM. The OWNER KEY is any string (a character id):
// one slot per owner, and an owner who comes back inside the grace gets the same slot. Rows and the pure pool only: nothing reads this yet (the instance entry and the server's slot book are wiring).
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './instances.json' with { type: 'json' };
import MANIFEST from './instances.manifest.json' with { type: 'json' };

export type InstanceKind = { readonly order: number; readonly slots: number; readonly stride: number; readonly graceS: number; readonly maxS: number; readonly spawnBase: number; readonly spawnPerPlayer: number };
export type InstanceKinds = Readonly<Record<string, InstanceKind>>;
export type Slot = { readonly owner: string; readonly openedAt: number; readonly leftAt: number | null };
export type Pool = { readonly kind: string; readonly slots: readonly (Slot | null)[] };

/** The one loader: the registry's duplicate/missing/mistyped checks, then the row rules (1-256 slots, a positive stride and maxS, a grace that is not longer than maxS, whole non-negative spawn numbers). */
export function loadInstanceKinds(raw: { kinds?: unknown }): InstanceKinds {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'instances.json')]);
  const rows = raw.kinds as InstanceKinds;
  for (const [id, r] of Object.entries(rows)) {
    if (!(r.slots >= 1 && r.slots <= 256)) throw Error(`instances "${id}": slots is 1 to 256`);
    if (!(Number.isFinite(r.stride) && r.stride > 0)) throw Error(`instances "${id}": stride is a number > 0`);
    if (!(Number.isFinite(r.maxS) && r.maxS > 0) || !(Number.isFinite(r.graceS) && r.graceS >= 0 && r.graceS <= r.maxS)) throw Error(`instances "${id}": maxS > 0 and 0 <= graceS <= maxS`);
    if (!(r.spawnBase >= 0) || !(Number.isFinite(r.spawnPerPlayer) && r.spawnPerPlayer >= 0)) throw Error(`instances "${id}": spawnBase is a whole number >= 0, spawnPerPlayer a number >= 0`);
  }
  return rows;
}
export const INSTANCE_KINDS: InstanceKinds = DEFS.kinds as unknown as InstanceKinds;   // validated by origins/world/instances.test.ts

export const newPool = (kind: string, table: InstanceKinds = INSTANCE_KINDS): Pool => ({ kind, slots: Array.from({ length: table[kind]!.slots }, () => null) });
const expired = (s: Slot, k: InstanceKind, now: number): boolean => now - s.openedAt >= k.maxS || (s.leftAt !== null && now - s.leftAt >= k.graceS);
/** Frees every slot past its maxS, or past its graceS since the owner left. */
export const expire = (pool: Pool, now: number, table: InstanceKinds = INSTANCE_KINDS): Pool => ({ ...pool, slots: pool.slots.map((s) => (s && expired(s, table[pool.kind]!, now) ? null : s)) });
export type Acquired = { readonly ok: true; readonly slot: number; readonly pool: Pool; readonly fresh: boolean } | { readonly ok: false; readonly reason: 'full'; readonly pool: Pool };
/** The owner's slot: the one they already hold (a returning owner inside the grace keeps it, and is no longer "left"), else the lowest free slot, else `full`. Expired slots are freed first. */
export function acquire(pool: Pool, owner: string, now: number, table: InstanceKinds = INSTANCE_KINDS): Acquired {
  const live = expire(pool, now, table), held = live.slots.findIndex((s) => s?.owner === owner);
  if (held >= 0) return { ok: true, slot: held, fresh: false, pool: { ...live, slots: live.slots.map((s, i) => (i === held ? { ...s!, leftAt: null } : s)) } };
  const free = live.slots.indexOf(null);
  if (free < 0) return { ok: false, reason: 'full', pool: live };
  return { ok: true, slot: free, fresh: true, pool: { ...live, slots: live.slots.map((s, i) => (i === free ? { owner, openedAt: now, leftAt: null } : s)) } };
}
/** The owner leaves (or disconnects): their slot is kept for graceS, then freed by `expire`. Leaving twice keeps the first time; an owner with no slot changes nothing. */
export const leave = (pool: Pool, owner: string, now: number): Pool => ({ ...pool, slots: pool.slots.map((s) => (s?.owner === owner && s.leftAt === null ? { ...s, leftAt: now } : s)) });
/** Where a slot's band sits in the world: the base point of the kind's map, moved `stride` m along z per slot, so every slot is its own private copy. */
export const slotOrigin = (kind: InstanceKind, slot: number, base: { x: number; z: number }): { x: number; z: number } => ({ x: base.x, z: base.z + slot * kind.stride });
/** How many creatures the instance's spawn draws for a headcount (at least 1 player counts): spawnBase plus spawnPerPlayer for each player past the first, rounded down. */
export const spawnCount = (kind: InstanceKind, headcount: number): number => kind.spawnBase + Math.floor(kind.spawnPerPlayer * (Math.max(1, Math.floor(headcount)) - 1));
