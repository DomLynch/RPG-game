// Creature loadouts as data (promoted from the Test Zone, zone/goblin-field-dome @7aedd8615; Dom 2026-10-16/17: "goblins must not be naked; light, medium and heavy armour, the weapon types as rows; the killed goblin's worn piece is the loot").
// A LOADOUT is one row: which armour pieces a creature wears (loot piece ids, `<opponent>.<slot>`, the carriers the engine already has), the weapon it carries (a weapon row id), and a tier (light, medium, heavy). A zone's mob look
// asks for loadouts by id (`look.loadout`, `spread.loadouts`), so any number of zones reuse the same rows. Donor: Ultima Online / ModernUO's equipment "templates" (a creature is a template of worn items, the corpse holds what it wore)
// and EQEmu's npc_types loadout, rewritten as rows. Presentation data: nothing here is read by the sim. Pure (no three, no DOM, no clock, no storage): the page and the server import this file as it is, so the loadout a creature
// WEARS on the page and the one the server rolls loot for are one function (pickLoadout), by construction.
import { loadRegistry, tableFromFile, TITLES as RUNGS, type Manifest } from '../../src/core/server.ts';
import DEFS from './loadouts.json' with { type: 'json' };
import MANIFEST from './loadouts.manifest.json' with { type: 'json' };
import { creatureHash, variantIndex } from './creature-hash.ts';

export const TIERS = ['light', 'medium', 'heavy'] as const;
export type LoadoutTier = (typeof TIERS)[number];
export type Loadout = { readonly id: string; readonly label: string; readonly tier: LoadoutTier; readonly weapon: string; readonly pieces: readonly string[]; readonly rung?: string; readonly look?: string };   // look: the main game's whole fitted rank look the creature is drawn in (a site-root file such as /looks/goblin-L5.glb)
export type LoadoutPiece = { readonly id: string; readonly label: string };
type Raw = { pieces?: readonly unknown[]; loadouts?: readonly unknown[] };

/** The one loader: the shared registry checks ids and field types; this adds what a type cannot say (a tier is light, medium or heavy; a loadout wears at least one piece, each a known piece, once; a rung is a career-ladder title). */
export function loadLoadouts(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'loadouts.json')));
  const pieces = (raw.pieces ?? []) as readonly LoadoutPiece[], loadouts = (raw.loadouts ?? []) as readonly Loadout[];
  for (const l of loadouts) {
    if (!(TIERS as readonly string[]).includes(l.tier)) throw Error(`loadout "${l.id}": tier is light, medium or heavy`);
    if (!l.weapon) throw Error(`loadout "${l.id}": a weapon row id`);
    if (l.look !== undefined && !/^\/looks\/[\w-]+\.glb$/.test(l.look)) throw Error(`loadout "${l.id}": look is a /looks/<name>.glb file`);
    if (l.rung !== undefined && !(RUNGS as readonly string[]).includes(l.rung)) throw Error(`loadout "${l.id}": rung is a career-ladder title (${RUNGS.join(', ')})`);
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

/**
 * The loadout id one creature wears: its zone-instance id and character pick a variant (variantIndex), and variant v takes `[base, ...spread][v % length]`, so variant 0 is the look's own loadout and a camp with no
 * spread list wears the base on every creature. Deterministic and pure: the page (mob-looks.ts variantLook) and the server (the loadout-drops table) call this with the same arguments and get the same row.
 * `base` is the zone look's own `loadout`, `spread` the camp's `spread.loadouts`; either may be absent (undefined = the body as it is).
 */
export function pickLoadout(id: string, creature: string, base: string | undefined, spread: readonly string[] | undefined): string | undefined {
  if (!spread?.length) return base;
  const list = [base, ...spread];
  return list[variantIndex(id, creature) % list.length];
}

/** The one worn piece a kill drops, chosen from the creature's own id so the same goblin always drops the same piece (Dom: one worn item per kill). undefined for a loadout that wears nothing. */
export function droppedPiece(loadout: Loadout | undefined, creatureId: string): string | undefined {
  if (!loadout?.pieces.length) return undefined;
  return loadout.pieces[creatureHash(creatureId) % loadout.pieces.length];
}
