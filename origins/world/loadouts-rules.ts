// Creature loadouts as data (zone sandbox, Dom 2026-10-16/17: "goblins must not be naked; light, medium and heavy armour, the weapon types as rows; the killed goblin's worn piece is the loot").
// A LOADOUT is one row: which armour pieces a creature wears (loot piece ids, `<opponent>.<slot>`, the carriers the engine already has), the weapon it carries (a weapon row id), and a tier
// (light, medium, heavy). A zone's mob look asks for loadouts by id (`look.loadout`, `spread.loadouts`), so any number of zones reuse the same rows. Donor: Ultima Online / ModernUO's equipment
// "templates" (a creature is a template of worn items, the corpse holds what it wore) and EQEmu's npc_types loadout, rewritten as rows. Presentation only: nothing here is read by the sim, and the
// server's loot tables are untouched (the Test Zone is invisible to the server).
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './loadouts.json' with { type: 'json' };
import MANIFEST from './loadouts.manifest.json' with { type: 'json' };

export const TIERS = ['light', 'medium', 'heavy'] as const;
export type LoadoutTier = (typeof TIERS)[number];
export type Loadout = { readonly id: string; readonly label: string; readonly tier: LoadoutTier; readonly weapon: string; readonly pieces: readonly string[] };
export type LoadoutPiece = { readonly id: string; readonly label: string };
type Raw = { pieces?: readonly unknown[]; loadouts?: readonly unknown[] };

/** The one loader: the shared registry checks ids and required fields; this adds what a type cannot say (a tier is light, medium or heavy; a loadout wears at least one piece, each a known piece, once). */
export function loadLoadouts(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'loadouts.json')));
  const pieces = (raw.pieces ?? []) as readonly LoadoutPiece[], loadouts = (raw.loadouts ?? []) as readonly Loadout[];
  for (const l of loadouts) {
    if (!(TIERS as readonly string[]).includes(l.tier)) throw Error(`loadout "${l.id}": tier is light, medium or heavy`);
    if (!l.weapon) throw Error(`loadout "${l.id}": a weapon row id`);
    if (!l.pieces.length || new Set(l.pieces).size !== l.pieces.length) throw Error(`loadout "${l.id}": at least one piece, each once`);
    for (const p of l.pieces) if (!pieces.some((q) => q.id === p)) throw Error(`loadout "${l.id}": piece "${p}" is not a loadout-piece row`);
  }
  return { pieces, loadouts };
}
const LOADED = loadLoadouts(DEFS);

/** The loadout row by id, or undefined. */
export const loadoutRow = (id: string | undefined): Loadout | undefined => (id ? LOADED.loadouts.find((l) => l.id === id) : undefined);
/** A piece's player-facing name (its row), the id itself when it has no row. */
export const pieceLabel = (id: string): string => LOADED.pieces.find((p) => p.id === id)?.label ?? id;
export const loadoutIds = (): readonly string[] => LOADED.loadouts.map((l) => l.id);

/** The one worn piece a kill drops, chosen from the creature's own id so the same goblin always drops the same piece (Dom: one worn item per kill). undefined for a loadout that wears nothing. */
export function droppedPiece(loadout: Loadout | undefined, creatureId: string): string | undefined {
  if (!loadout?.pieces.length) return undefined;
  let h = 2166136261; for (const c of creatureId) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return loadout.pieces[h % loadout.pieces.length];
}
