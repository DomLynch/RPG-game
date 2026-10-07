// The Ash Frontier's three common kinds as mob rows (mobs.md 7.3): the numbers mobs.ts used to keep in MOB_PLAN, now content. Moving them here changed
// nothing; the one change is Strategy's camp cap: the scavengers' field of 6 is an ordinary camp, so it is 4 (origins/preview/mobs.golden.json pins the list). Their sources are cited below under the legends-rule (Characters, 2026-10-07; Strategy
// rules if one is disputed), so the generator accepts them. Named creatures (Hrungnir, the Mere-Mother, the bounty foes) stay on their encounters and have no row.
import type { MobRow, Source } from './row.ts';

// Every source is public-domain folklore, chronicle or literature, no living-religion scripture. Each names the tradition the kind is drawn from, not a
// film or game. The creature's own look and name are original; the citation says where the idea comes from.
const GOBLIN: Source = { kind: 'chronicle', work: 'Historia Ecclesiastica (the spirit "Gobelinus" haunting Evreux)', author: 'Orderic Vitalis', year: 1141, authorDied: 1142, locator: 'the Evreux passage' };
const BEOWULF: Source = { kind: 'literature', work: 'Beowulf (the mere and its nicors)', author: 'anonymous, Old English', year: 1000, locator: 'll. 1357-1441, Hrothgar\'s mere and the water-monsters round it' };
const GHOUL: Source = { kind: 'folklore', work: 'Les Mille et une nuits (the graveyard ghouls, Histoire de Sidi-Nouman)', author: 'Antoine Galland (translator)', year: 1704, authorDied: 1715, locator: 'Histoire de Sidi-Nouman' };
export const FRONTIER_ROWS: readonly MobRow[] = [
  { id: 'character:cinder-scavenger', source: GOBLIN, role: 'beast', loot: 'loottable:cinder-scavenger', level: [11, 12], behaviour: { roam: 8, spread: 16, pull: 0, campSize: [4, 4] } },
  { id: 'character:mere-brood', source: BEOWULF, role: 'beast', loot: 'loottable:mere-brood', level: [12, 13], behaviour: { roam: 6, spread: 9, pull: 0, campSize: [4, 4] } },
  { id: 'character:ruin-ghoul', source: GHOUL, role: 'brute', loot: 'loottable:ruin-ghoul', level: [11, 12], behaviour: { roam: 6, spread: 7, pull: 9, campSize: [3, 3] } },
];
