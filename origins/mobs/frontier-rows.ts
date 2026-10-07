// The Ash Frontier's three common kinds as mob rows (mobs.md 7.3): the numbers mobs.ts used to keep in MOB_PLAN, now content. Moving them here changed
// nothing; the one change is Strategy's camp cap: the scavengers' field of 6 is an ordinary camp, so it is 4 (origins/preview/mobs.golden.json pins the list). The sources are PENDING: Content/Strategy cite them under the legends-rule;
// the generator refuses a pending row. Named creatures (Hrungnir, the Mere-Mother, the bounty foes) stay on their encounters and have no row.
import type { MobRow } from './row.ts';

const pending = { pending: 'Content/Strategy to cite (legends-rule)' };
// A zone that is not safe opens with a fight inside 10 s of its entry (zone-rules.ts). Where the data has no creature near the entry, this names the kind that
// stands there as a lone opener, placed by the same rule the generator uses (openerSpot). Zone id -> row id.
export const FRONTIER_OPENERS: Readonly<Record<string, string>> = { 'ferry-landing': 'character:mere-brood', 'cinder-fields': 'character:cinder-scavenger' };
export const FRONTIER_ROWS: readonly MobRow[] = [
  { id: 'character:cinder-scavenger', source: pending, role: 'beast', loot: 'loottable:cinder-scavenger', level: [11, 12], behaviour: { roam: 8, spread: 16, pull: 0, campSize: [4, 4] } },
  { id: 'character:mere-brood', source: pending, role: 'beast', loot: 'loottable:mere-brood', level: [12, 13], behaviour: { roam: 6, spread: 9, pull: 0, campSize: [4, 4] } },
  { id: 'character:ruin-ghoul', source: pending, role: 'brute', loot: 'loottable:ruin-ghoul', level: [11, 12], behaviour: { roam: 6, spread: 7, pull: 9, campSize: [3, 3] } },
];
