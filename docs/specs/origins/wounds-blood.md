# Wounds and blood as data (Release K5 schema) — World, 2026-10-09

For Combat to implement against. No code here. Goal: ~700 zones, zero per-creature wound or blood code; a new creature is a row, a new body is one table entry.

**Donor:** Cataclysm-DDA (CC BY-SA 3.0, SHAPE ONLY, nothing copied): `data/json/body_parts.json` (a part table per body: connected_to, is_vital, hit_size, hit_difficulty), `bodytype` string on a monster, `bleed_rate` on the monster plus the species row naming the blood (`src/mtype.cpp get_bleed_type`). Veloren (GPL-3) keeps this in Rust per species: shape confirms, not used. OpenBOR (BSD): no wound model, nothing to take. Read from /mnt/frankendom-donors on the VPS.

## Engine code this drives (Lead, 2026-10-09)
The Pit already draws blood and gore for goblins and men. `src/gore.ts`, `blood-edge.ts`, `blood-style.ts`, `finisher-blood.ts`, `finishers.ts` and `severed-head.ts` move into `src/fight/` in K5, and this schema only feeds them per creature: **no new renderer**. Humanoid rows (goblin, men) MUST reproduce today's Pit look exactly, so the Pit golden is unchanged: the `humanoid` species is today's `BLOOD` (`blood-style.ts`: start `#690f0d`, end `#200504`, hit 15 / kill 25 particles) with `spray` 1 and `size` 1, and the goblin does NOT take #1967's guessed `#5a1410` / 0.6. The new value is the wolf, boar and bear rows (the beast numbers below are #1967's starting point for Dom's eye).

## What exists (Characters' #1967, `src/creature-gore.ts`, stacked on #1966; check its head at merge)
One `CREATURE_GORE` row per roster id (`wolf`, `boar`, `bear`, `goblin`): `shape`, `glb`, `cut {head, neck, limbs}` (bone names), `blood {start, end, amount}`, `finishers`. It works, but body, blood and finishers are fused in one row, so a second goblin-shaped creature copies the bones. This schema splits it into three tables and keeps its test (the test re-reads each GLB's skin joints, so a renamed bone fails in CI, not in a cut).

## The three tables
**1. `bodytypes`** — what can be hurt, by body. Key = bodytype id (`quadruped`, `biped-small`, later `biped-large`, `serpent`, `flyer`; the families of `body-families.md`).
| field | type | meaning |
|---|---|---|
| `parts` | `Part[]` | the hurtable regions |
| `Part.id` | string | `head`, `neck`, `torso`, `foreL`, `armR`… unique in the bodytype |
| `Part.bones` | string[] | skin-joint names a cut or a decal anchors to (from #1967 `cut`) |
| `Part.parent` | string? | the part it hangs from (CDDA `connected_to`); roots have none; no cycles |
| `Part.vital` | boolean | a wound here can end the creature (head, neck, torso) |
| `Part.weight` | number >0 | share of hits landing here (CDDA `hit_size`); the engine normalises |
| `Part.cuttable` | boolean | a finisher may sever here (#1967 `cut.head/neck/limbs`) |
Bone names are per rig, so a bodytype is keyed by what shares a skeleton: `quadruped` is wolf, boar and bear (they share `BEAST_BONES` today); `biped-small` is the goblin rig.

**2. `species`** — how it bleeds. Key = species id (`humanoid`, `beast`, `undead`, `construct`).
| field | type | meaning |
|---|---|---|
| `blood` | `{start, end}` \| null | colour over a drop's life (#1967 `blood.start/end`); null = no blood (stone, bone, spirit) |
| `decal` | `{id, sizeM}` \| null | the mark left on ground or body; null = none |
| `spray` | number 0..2 | multiple of the Pit's BLOOD particle counts for a man = 1 (replaces the species half of #1967 `amount`) |

**3. creature row** — NOT a separate table (Lead's ruling, 2026-10-09: one catalogue). It is an optional `wounds` field on the character catalogue row (Characters' #1981, `src/fight/catalogue-rows.ts`), keyed by the catalogue `character:` id (e.g. `character:ash-wolf`), the same id `MobRow.id` uses. The roster id is not a key anywhere in this schema:
| field | type | meaning |
|---|---|---|
| `body` | bodytype id | table 1 |
| `species` | species id | table 2 |
| `rig` | string | the roster/rig id #1967 uses (`wolf`, `boar`, `goblin`) so its GLB and finisher row are found |
| `size` | number >0 | multiple of `spray` for this creature (#1967 `amount` per creature; bear 1.4) |
| `bleedRate` | number 0..1 | 0 = never bleeds; else drips per second as a fraction of `spray` while below the first tier (CDDA `bleed_rate`) |
| `tiers` | `{below, decals, drip}[]` | severity by hp fraction, `below` strictly descending (e.g. 0.66, 0.33, 0.1); `decals` = marks on the body at that tier, `drip` = multiple of `bleedRate` |
| `finishers` | FinisherId[] | unchanged from #1967 (preference order, last = safe fallback) |
Flee-at stays Expansion's rule (`body-families.md`); `tiers` only changes how it looks.

## Where it lives (Lead's rulings, 2026-10-09)
`bodytypes` and `species` are data files with the engine in `src/fight/` (next to `catalogue.ts` and `stats.ts`). `wounds` is a field on each catalogue row. Key everywhere = the `character:` id. `rig` (the roster/rig id #1967 uses for its GLB and finisher row) stays only as a field on `wounds` until #1967 is retargeted onto the catalogue.

## Rules a validator enforces (same pattern as `zoneProblems` / `validateMobRow`)
`body` and `species` exist; every `Part.parent` exists, no cycles, at least one vital part; `weight` > 0; `tiers.below` in (0,1) and strictly descending; `bleedRate` and `drip` in range; `bleedRate` > 0 with a null `species.blood` is an error; every bone in a bodytype is a skin joint of the GLB of each creature that uses it (the existing #1967 test, per `rig`).

## Mapping from #1967
`shape` → pick the bodytype; `glb` → stays on the rig (looked up via `rig`); `cut.head`/`cut.neck` → parts `head` and `neck` (`bones`, `cuttable`, vital); `cut.limbs[id]` → one part per limb id (`foreL`… `legR`), not vital; `blood.start/end` → `species.blood`; `blood.amount` → `species.spray` × the creature's `size`, chosen so the product equals #1967's `amount` for the beasts; for humanoids (the goblin) the Pit's current values win over #1967's guess (see the top section); `finishers` → unchanged.

## Example rows (bones are #1967's; numbers are a starting point for Dom's eye at 375 wide)
```
bodytypes.quadruped = { parts: [
  { id: 'head', bones: ['head','jaw'], vital: true,  weight: 2, cuttable: true, parent: 'neck' },
  { id: 'neck', bones: ['neck'],        vital: true,  weight: 1, cuttable: true, parent: 'torso' },
  { id: 'torso', bones: [],             vital: true,  weight: 5 },
  { id: 'foreL', bones: ['front_up_L'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
  { id: 'foreR', bones: ['front_up_R'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
  { id: 'hindL', bones: ['hind_up_L'],  vital: false, weight: 1, cuttable: true, parent: 'torso' },
  { id: 'hindR', bones: ['hind_up_R'],  vital: false, weight: 1, cuttable: true, parent: 'torso' } ] }
bodytypes['biped-small'] = { parts: [
  { id: 'head', bones: ['Head'], vital: true, weight: 2, cuttable: true, parent: 'neck' },
  { id: 'neck', bones: ['neck_01'], vital: true, weight: 1, cuttable: true, parent: 'torso' },
  { id: 'torso', bones: [], vital: true, weight: 5 },
  { id: 'armL', bones: ['upperarm_l'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
  { id: 'armR', bones: ['upperarm_r'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
  { id: 'legL', bones: ['thigh_l'], vital: false, weight: 1, cuttable: true, parent: 'torso' },
  { id: 'legR', bones: ['thigh_r'], vital: false, weight: 1, cuttable: true, parent: 'torso' } ] }
species.beast   = { blood: { start: '#5a0b0a', end: '#1c0403' }, decal: { id: 'blood-splat', sizeM: 0.5 }, spray: 1 }
species.humanoid = { blood: { start: '#690f0d', end: '#200504' }, decal: { id: 'blood-splat', sizeM: 0.35 }, spray: 1 }   // = today's Pit BLOOD, unchanged

'character:cinder-scavenger' (goblin): wounds { body: 'biped-small', species: 'humanoid', rig: 'goblin', size: 1, bleedRate: 0.5,
   tiers: [{ below: 0.66, decals: 1, drip: 0.5 }, { below: 0.33, decals: 2, drip: 1 }, { below: 0.1, decals: 3, drip: 2 }],
   finishers: ['splitCrown','decapitation','runThrough','opened','plainDeath'] }
'character:ash-wolf' (wolf): wounds { body: 'quadruped', species: 'beast', rig: 'wolf', size: 0.7, bleedRate: 0.4,
   tiers: [{ below: 0.5, decals: 1, drip: 0.6 }, { below: 0.2, decals: 2, drip: 1.2 }], finishers: ['decapitation','plainDeath'] }
'character:ash-boar' (boar): wounds { body: 'quadruped', species: 'beast', rig: 'boar', size: 1, bleedRate: 0.6,
   tiers: [{ below: 0.6, decals: 1, drip: 0.6 }, { below: 0.25, decals: 3, drip: 1.4 }], finishers: ['decapitation','plainDeath'] }
```
(Goblin: `spray` 1 × `size` 1 = what the Pit draws today, NOT #1967's 0.6; wolf: 1 × 0.7 = 0.7; boar: 1 × 1 = 1. Bear would be `size` 1.4.)

## Open
1. **Combat:** part `weight` is inert data until the engine picks a part per hit (K5); say how it will pick. 2. **Characters:** where a decal anchors when `Part.bones` is empty (torso), and the wound-mark art for creatures (the Pit's marks are the Pit's; can they be reused?). 3. **Characters:** #1967 sat on closed #1966 and needs retargeting to trunk; re-read the bone names from the GLBs when it lands (the bones above are copied from its old head, not verified).
Settled by Lead 2026-10-09: tables live in `src/fight/`; `wounds` on the catalogue row; key = `character:` id.
