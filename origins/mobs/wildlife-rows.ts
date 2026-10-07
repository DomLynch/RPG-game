// The wildlife batch (Dom GO 2026-10-07: beasts first): the quadruped family's kinds as mob rows, held as `later` until their bodies land. A `later` row needs no
// look, source or registered loot table and is never generated (row.ts), so this file ships nothing the player sees. To switch a kind on: Characters lands its
// body and MOB_LOOKS entry (the ash wolf needs Combat's roster row and `bite` weapon too), Content cites it and registers its loot table, and the row loses
// `later`. Ids and bands are placeholders until then: the designs are docs/character-references/mob-families (beast-ash-wolf, beast-boar); the hound is
// named in docs/specs/origins/body-families.md. Beast behaviour is Combat's MOB_STYLE (flees at low health). Placeholder loot ids are not registered anywhere.
import type { MobRow } from './row.ts';

const pending = { pending: 'Content/Strategy to cite (legends-rule)' };
export const WILDLIFE_ROWS: readonly MobRow[] = [
  { id: 'character:ash-wolf', later: true, source: pending, role: 'beast', loot: 'loottable:ash-wolf', level: [11, 13], behaviour: { aggro: 9, roam: 7, spread: 10, campSize: [2, 3] } },
  { id: 'character:ash-boar', later: true, source: pending, role: 'beast', rarity: 'uncommon', loot: 'loottable:ash-boar', level: [12, 14], behaviour: { aggro: 6, roam: 5, spread: 8, campSize: [1, 2] } },
  { id: 'character:cinder-hound', later: true, source: pending, role: 'beast', loot: 'loottable:cinder-hound', level: [12, 14], behaviour: { aggro: 9, roam: 7, spread: 10, campSize: [2, 3] } },
];
