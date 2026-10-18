// The stable hash of a creature's own id (FNV-1a, 32-bit over the string's code points), the one place it lives: the page picks a creature's look and loadout from it and the server must pick the same
// (origins/preview/mob-looks.ts mobVariant, origins/world/loadouts-rules.ts pickLoadout). Pure: no three, no DOM, no clock, no storage, so the server imports it as it is.
import MOB_LOOK_RULES from '../preview/mob-looks-rules.json' with { type: 'json' };   // the mobLookRule row: how many variants a kind has (pure data)

/** FNV-1a over `text`'s code points, as an unsigned 32-bit integer. The same value on every call, page and server. The two hex literals are the algorithm's offset basis and prime: a hash salt, not a tuning, kept inline (never a row: changing one re-rolls every creature). */
export function creatureHash(text: string): number {
  let h = 0x811c9dc5;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

// VERSIONED (Combat's read of #3216): the `variants` count and the length of any camp's spread list are inputs of every creature's look, loadout and dropped piece, so changing either re-rolls them all; a change states the
// drops table's version, never a silent row edit. And the loop keeps one UTF-16 unit per code point (`charCodeAt(0)`), deterministic but different from a per-unit FNV for a non-BMP character: zone-instance ids are ASCII.
/** The variant (0..variants-1) one creature wears: the hash of its zone-instance id and its character, mod the mobLookRule row's `variants`. The page's look pick (mobVariant) and the loadout pick both start here, so a creature is the same on the map, in its duel and on the server. */
export const variantIndex = (id: string, creature: string): number => creatureHash(`${id}|${creature}`) % MOB_LOOK_RULES.mobLookRule[0]!.variants;
