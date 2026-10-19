// Kill credit by damage (Dom, 2026-10-19: "it should be based on the damage contribution, that is fair, so no last shot kill steals"). Pure: no clock, no database.
// Rules (every number a row of `worldShare` in server-rules.json; donor sources in Lead's docs/state/donor-spawns-research-2026-10-19.md: ModernUO BaseCreature.cs, TrinityCore CreatureAI.cpp):
//   - a contributor's damage is what the server's replay of ITS record says the hero dealt to the creature (capped at the creature's health), after the replay dropped damage that expired or was healed away;
//   - a contributor qualifies at `qualifyOfTop` of the TOP contributor's damage (ModernUO's minimum-damage rule); a contributor whose last hit is older than `tagExpiryS` is out;
//   - a contributor who dealt the creature's FULL health alone is a solo kill at 100% (interim: each page plays its own copy of the creature until a shared server health bar), whoever else took part;
//   - otherwise the qualifiers split the credit in proportion to damage (they sum to 1);
//   - nothing here reads who hit first, who hit last or who reported first: a last blow earns exactly its share.
export type Contribution = { id: string; damage: number; ageS?: number };
export type ShareRows = { qualifyOfTop: number; tagExpiryS: number };

/** Each contributor's share of the kill's credit (0 for one that does not qualify), keyed by id. */
export function shares(contributions: readonly Contribution[], hp: number, rows: ShareRows): Map<string, number> {
  const out = new Map<string, number>();
  const live = contributions.filter((c) => Number.isFinite(c.damage) && c.damage > 0 && (c.ageS ?? 0) <= rows.tagExpiryS).map((c) => ({ id: c.id, d: Math.min(c.damage, hp) }));
  for (const c of contributions) out.set(c.id, 0);
  if (live.length === 0 || !(hp > 0)) return out;
  const top = Math.max(...live.map((c) => c.d));
  const qualified = live.filter((c) => c.d >= rows.qualifyOfTop * top);
  if (qualified.some((c) => c.d >= hp)) {
    for (const c of qualified) out.set(c.id, c.d / hp);   // a full bar alone pays 100%; a smaller qualifier pays the fraction of the bar it brought
    return out;
  }
  const total = qualified.reduce((n, c) => n + c.d, 0);
  for (const c of qualified) out.set(c.id, c.d / total);
  return out;
}

/** Keep each item with probability `share`, on the kill's seed (loot rolled once, then weighted by share). Deterministic: the same seed and share keep the same items. share >= 1 keeps all. */
export function thin<T>(items: readonly T[], share: number, seed: number): T[] {
  if (share >= 1) return [...items];
  return items.filter((_, i) => (Math.imul((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b) >>> 0) / 2 ** 32 < share);
}

/** A divisible amount (CP, bronze) at a share: floored, never more than the whole. */
export const portion = (amount: number, share: number): number => (share >= 1 ? amount : Math.max(0, Math.floor(amount * share)));
