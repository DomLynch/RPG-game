# Special sets and ranks: notes

The values are rows in `src/fight/special-set-defs.json` (built into `SPECIAL_SETS` and the rank levels by `src/fight/special-set-rows.ts`). These are the comments that sat beside the old literal in `src/fight/moves.ts`; the code is the PRE-ROWS source, read it for meaning. Identity hash of `{SPECIAL_SETS, specialOf(opponent, level) for every opponent at levels 0..50}` = `89cccac0b4373a856b500b1d3f78cc4df3fc20180c591e83d6418dd3804d8c0c`, pinned in `tests/special-set-rows.test.ts`.

```ts
// The named special an opponent casts at a ladder level (Strategy 2026-10-01, docs/briefs/specials/): ranks 8 / 9 / 10 (career.ts: five levels a rank, so 36 / 41 / 46).
// Identity only: windup, share, cooldown and the unblockable release are RULES.special for every special. Null = the opponent's class skill names it (below rank 8, or no set).
// The Centurion's id is 'veteran'. The picks are the briefs' starred ones.
export const SPECIAL_SETS = {
  veteran: ['quake', 'charge', 'tithe'],   // Shield Quake, The Charge, Blood Tithe
  nightborn: ['redwind', 'hadesshadow', 'nyxnightfall'],   // Red Wind, Hades' Shadow, Nyx Nightfall
  executioner: ['bayingcircle', 'longshadow', 'harvestsweep'],   // Arawn, Thanatos, The Reaper
  goblin: ['dirtyfistful', 'gone', 'threeliars'],   // Reynard, Hermes, Loki
  pitborn: ['crackingground', 'ashfall', 'windwall'],   // Antaeus, Surtr, Typhon
  dwarf: ['theword', 'threeblows', 'rimshake'],   // Ptah, Goibniu, Hephaestus
  shieldmaiden: ['baredface', 'thering', 'aegissweep'],   // Penthesilea, Brynhildr, Athena
  witch: ['avalonmist', 'foretoldstep', 'theprice'],   // Morgan le Fay, Merlin, Odin
  plaguedoctor: ['plagueflies', 'poisonstain', 'lastbreath'],   // Apollo, Hecate, Resheph
  knight: ['thesling', 'wrath', 'stormfollowshim'],   // Hector, Achilles, Thor
} as const;
```
