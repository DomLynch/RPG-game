// Dungeon 1's legend rotation, the pick (docs/specs/origins/dungeon-legend-rotation.md, #3620, Lead's rulings 2026-10-22): a camp owns a POOL of legends and each respawn generation shows the next one.
// Pure and page-safe ON PURPOSE: this file imports nothing, so the writer (origins/server) and the page (origins/preview, the guest/offline fallback with its own defeat count) share ONE rule and cannot disagree.
// The rule `cycle` walks the pool in order from a start that depends only on the camp's key: a camp never shows the same legend twice running, every legend of the pool appears equally often, and two camps of a
// ring start on different legends (their keys hash apart). It depends on nothing but (pool, campKey, generation), so a restart mid-generation resolves the same legend. Donor: ModernUO's champion spawn
// (a spawn walks its type list as its level advances) and EQEmu's spawngroup (a spawn point owns a list; each respawn takes one).

const HASH_SEED = 0x811c9dc5;   // FNV-1a 32-bit offset basis (exempt: scripts/as-data/allow/origins-dungeon.json)
const HASH_PRIME = 0x01000193;   // FNV-1a 32-bit prime (exempt: the same file)

/** The rotation rules. A closed list of one today; a new rule is a new member and a new branch in `legendAt`, named in the rotation row (`bowl-roster.json` ring `rotation`). */
export type RotationRule = 'cycle';

/** FNV-1a over the camp key's UTF-16 code units, as an unsigned 32-bit integer. A stable engine detail (no tuning): the same key hashes the same on every platform and after every restart. */
export function campOffset(campKey: string): number {
  let h = HASH_SEED;
  for (let i = 0; i < campKey.length; i++) h = Math.imul(h ^ campKey.charCodeAt(i), HASH_PRIME);
  return h >>> 0;   // the unsigned reading of the 32-bit word
}

/** The legend of `pool` standing at `campKey` in respawn `generation` (the database's generation: 0 for the first life, +1 per defeat). Throws on an empty pool or a generation that is not a whole number >= 0: a
 *  camp cannot skip a generation, so a bad input is a load error, never a quiet fallback. */
export function legendAt<T>(pool: readonly T[], campKey: string, generation: number, rule: RotationRule = 'cycle'): T {
  if (pool.length === 0) throw Error(`legendAt: the pool of ${campKey} is empty`);
  if (!Number.isSafeInteger(generation) || generation < 0) throw Error(`legendAt: generation must be a whole number >= 0 (got ${generation})`);
  if (rule !== 'cycle') throw Error(`legendAt: unknown rotation rule "${String(rule)}"`);
  return pool[(campOffset(campKey) + generation) % pool.length]!;
}
