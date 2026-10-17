// ?region=1: how each Frontier foe LOOKS, keyed by character id (origins/region1/content.ts FOES). Preview only, presentation only: the body is the roster
// `opponent` in content.ts; this table only says how that body is dressed so two figures on one body (the two witches, the three goblin mobs) read as
// different people at 375 wide. Pure data: no three.js, no DOM. The mob view reads it; Characters owns it (Expansion owns content.ts, which is not edited).
//   tint     the colour the body's CLOTH is multiplied toward (0xRRGGBB, 0xffffff = untouched); metal keeps its grade
//   scale    the body's height multiplier on top of the roster's own (1 = the roster body as it is)
//   gear     the weapon the figure carries when it is not the body's own (a roster weapon id from src/fight/moves.ts); absent = the body's own
//   dressing the Ash Frontier on him: soot = dark ash worked into the cloth and low on the body, 0..1; burnt = scorched, ragged cloth edges, 0..1
import { catalogueRow, type WeaponId } from '../../src/fight/index.ts';
import { loadZone, type Zone } from '../zones/loader.ts';
import MOB_LOOK_RULES from './mob-looks-rules.json' with { type: 'json' };

/** A body's draw scale, from its catalogue row (render.scale): the duel and the walking figure share it. A rig with no row is drawn as built. */
const bodyScale = (opponent: string): number => catalogueRow(opponent)?.render.scale ?? 1;

export type MobLook = { opponent: string; tint: number; scale: number; gear?: WeaponId; dressing: { soot: number; burnt: number }; later?: true };
/** A look as a table or a zone row writes it: `scale` is optional, and an omitted scale means the body's own (its catalogue row's render.scale), resolved in mobLook(). A literal scale wins. */
export type MobLookRow = Omit<MobLook, 'scale'> & { scale?: number };

/** The central table is EMPTY: every Frontier look now lives in its zone's row (origins/zone-rows/zone<N>.row.json, `mobLooks`), Zone 1's included. Kept as the fallback `mobLook` reads after a zone's own table. */
export const MOB_LOOKS: Readonly<Record<string, MobLookRow>> = {};

/** The look for a character id, or null for a figure with no entry (a friendly NPC): the caller draws the roster body as it is. */
const resolved = new WeakMap<MobLookRow, MobLook>();   // one resolved object per row, so the cloth-clone cache and the variant memo see the same look every call
function resolve(row: MobLookRow): MobLook { if (row.scale !== undefined) return row as MobLook; let r = resolved.get(row); if (!r) { r = { ...row, scale: bodyScale(row.opponent) }; resolved.set(row, r); } return r; }
export const mobLook = (id: string, zone: Zone = loadZone()): MobLook | null => { const row = zone.mobLooks?.looks[id] ?? MOB_LOOKS[id]; return row ? resolve(row) : null; };   // the zone's own table first (origins/zones/<id>/mob-looks.ts), else the central one

// Free visual spread: the common kinds come in a few variants so a camp of four is four different creatures, not four copies. Presentation only, no sim
// state: a variant is a MobLook, so it goes through the same dressMob. Variant 0 is the table's own look (nothing changes for a single figure); the others
// swap the tint from a small pool, step the height within +-`scale` of the kind's, and nudge the soot and scorch within +-`soot` / `burnt`. Named foes and
// friendly figures have no spread. Gear is NOT varied here: `MobLook.gear` has no reader yet, and a weapon change belongs to the roster, not to a look.
export type MobSpread = { tints: readonly number[]; scale: number; soot: number; burnt: number };
export const MOB_SPREAD: Readonly<Record<string, MobSpread>> = {};   // empty for the same reason: the spreads are in the zone rows
export const VARIANTS = MOB_LOOK_RULES.mobLookRule[0]!.variants;   // the mobLookRule row (mob-looks-rules.json)
export const WHOLE_SOOT_CAP = MOB_LOOK_RULES.mobLookRule[0]!.wholeSootCap, CLOTH_SOOT_CAP = MOB_LOOK_RULES.mobLookRule[0]!.clothSootCap;   // the most ash a baked whole-body surface / a cloth draw takes (mob-dress.ts)
const memo = new Map<string, MobLook>();
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Variant `v` (0..VARIANTS-1) of a kind: the same object every call, so the cloth-clone cache is one entry per (kind, v), at most VARIANTS a kind. */
export function variantLook(id: string, v: number, zone: Zone = loadZone()): MobLook | null {
  const base = mobLook(id, zone), spread = zone.mobLooks?.spread[id] ?? MOB_SPREAD[id];
  if (!base || !spread || v % VARIANTS === 0) return base;
  v = ((v % VARIANTS) + VARIANTS) % VARIANTS;
  const key = `${zone.id}:${id}#${v}`, known = memo.get(key); if (known) return known;
  const pool = [base.tint, ...spread.tints], unit = (n: number) => ((v * n) % VARIANTS) / (VARIANTS - 1) * 2 - 1;   // -1..1, a different walk per field
  const look: MobLook = { ...base, tint: pool[v % pool.length]!, scale: Math.round(base.scale * (1 + unit(3) * spread.scale) * 1000) / 1000,
    dressing: { soot: clamp01(base.dressing.soot + unit(5) * spread.soot), burnt: clamp01(base.dressing.burnt + unit(7) * spread.burnt) } };
  memo.set(key, look); return look;
}
/** The look one creature wears: its kind's variant picked by a stable hash of the creature's own id (FNV-1a), so it is the same on the map and in its duel. */
export function mobVariant(id: string, creature: string, zone: Zone = loadZone()): MobLook | null {
  let h = 2166136261; for (const c of `${id}|${creature}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return variantLook(id, h % VARIANTS, zone);
}
