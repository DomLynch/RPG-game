# Positioning gates: bands, the AI band row, the marker (spec, sandbox first)

Status: **spec, Combat, 2026-10-15, from Strategy's answers (a)-(d) the same day.** No code or row yet. Strategy's ruling: bow step 2 (`docs/specs/combat/bows.md`) does not start until these gates ship and prove out in the sandbox ("a bow without bands is just a ranged tap"). Lead's v1 ruling: Pit archetypes only. Anything that changes a blow's damage in the Pit is an RV bump, so it ships behind `?bands=1` first and nothing in the default path moves.

## What exists today (read on trunk, 2026-10-15)
- A move has `reach` and an optional `minReach` (`src/fight/moves.ts:54-55`): "a blow started inside this gap meets nothing" (a pole's point: the tines drive past the target).
- The duel already treats a blow started inside `minReach` as a hard miss (`src/fight/duel.ts:455`: `a.attackFrom.gap < (def.minReach ?? 0)` gives no impact).
- The AI already reasons with both: `inReach = gap <= reach - .1 && gap >= minReach + .1` and steps back out from inside a pole's point (`src/fight/ai.ts:79, 236-240, 295, 361`). `reach` is "the AI range estimate" for swords and the real cone for kicks (`moves.ts:54`).
- So the geometry exists. What does not exist: a *quality of distance* that changes damage, a weapon's preferred band, an AI that tries to stand in it, and any player-readable marker.

## The design (Strategy, 2026-10-15)
**(a) Bands.** Three distance rings round the foe: **inner / mid / outer**. Their edges are *derived from each weapon's existing `reach` and `minReach`*, not new metres per weapon. The one new per-weapon row field is **`bestBand`** (`inner | mid | outer`). In its band a blow lands at **x1.0**; off-band at a soft **x0.6** (a row). An existing hard miss (a pole's thrust inside `minReach`, a blow out of reach) **stays a miss, never softened**. Starting assignment: knife and gladius inner; longsword, cleaver, maul mid; trident, scythe, estoc outer. The bow is simply the weapon whose band is outer and whose inner band is helpless (it cannot draw inside the engage ring, `bows.md`).

**(b) The AI band row.** One tactic field, **`holdBand`**, in the tactic block (#2758, `docs/specs/combat/gothic-tactic-table.md`, open PR, not on trunk yet): the archetype tries to stand in its weapon's band and steps in or back to get there, so the AI makes the same choice the player makes. Pit archetypes only (Lead's v1 ruling); creatures and the open world are untouched.

**(c) The marker.** Both, and readable for both fighters: (1) a **tint on the ground-ring segment between the fighters** that changes with the band (a constant tint per band, a row each); (2) a **one-word coach-channel label on every band change**, about 1 s: `TOO CLOSE` / `IN REACH` / `OUT OF REACH`. Not a HUD-only tell.

**(d) Weapons.** Melee too, from day one (the list in (a)); the bow is the weapon whose band is outer.

**Flags.** `?bands=1` first (bands, the damage factor, `holdBand`, the marker); `?side=1` second (flank at half guard plus a posture bonus; out of scope here, listed so the order is on record).

## Proposed mechanics (Combat's proposal for the open items; all numbers are rows)
1. **Edges.** For weapon `w`, let `R(w)` = its longest move `reach` and `m(w)` = its smallest `minReach` (0 if none). Ring edges are fractions of `R(w)`: inner is `gap < R * innerFrac`, mid is `< R * midFrac`, outer is the rest up to `R`. The two fractions are the only new numbers (rows, one pair for all weapons; a per-weapon override is a later row if the batch asks). Inside `m(w)` the band is "too close" and the existing hard miss applies unchanged. This keeps Strategy's rule "no new metres per weapon".
2. **Damage.** `damage x bandFactor(w, gap)` where `bandFactor` is `1.0` in `bestBand` and `offBandMult` (0.6) elsewhere, applied at the same place the hit's damage is computed (before blocks/chip), never to a hard miss, never to posture or timing (TIMING IS SACRED: no window moves).
3. **AI `holdBand`.** The AI's existing "step in / step back" decision (ai.ts reach checks) gains one preference: when the planned move would land off-band and a step reaches the weapon's band within the move's own timing, step. It adds no new move, no new timing and no randomness; the seeded stream is untouched.
4. **Marker.** Presentation only: reads the duel's gap and the two fighters' weapons each frame. The band label fires on a change and holds about 1 s (a row); no sim state. Both fighters' bands are readable (the player sees theirs and the foe's).
5. **Sandbox.** The page (`bow-preview.html` pattern, its own vite build, `/preview/...`) runs the band function, the marker and a scripted two-fighter gap sweep; the Pit is not touched until the batch passes.

## Gate before Dom sees it (Strategy)
An **AI-vs-AI batch** (`scripts/` sim harness, run on HF CPU or the VPS) shows bands **do not re-rank any weapon class outside the ruled tier band**. Concretely: per weapon class, win rate vs every other class with `?bands=1` off and on, same seeds; the class order must not change beyond the ruled tolerance. A failing class means retune `offBandMult` or the two fractions (rows), never a code change. Evidence goes in the PR (tables, not claims).

## What it touches
- **Sim:** the damage factor and `holdBand` change fights, so the shipped version is an **RV bump** (and a WSV bump, the world digest hashes the Pit RV); the sandbox and the flag-off default move nothing. Record era-gating follows `cast-penalty-era.ts` / `costCapFrom` (a record below the bump replays without bands).
- **Rows:** `bestBand` per weapon row (`weapon-defs`), `innerFrac`, `midFrac`, `offBandMult`, band tint rows, label rows and the hold time; `holdBand` in the tactic block. None are literals in code (as-data gate).
- **Presentation:** ground-ring segment tint (World/Combat scene), coach-channel label (Web). Visual PR stills apply.
- **Not in v1:** creatures and the open world, the `?side=1` flank rule, a moving bow target.

## Open questions (Strategy to confirm; defaults in brackets)
1. **Edge fractions.** Is "fractions of `R(w)`" the right derivation, or should inner/mid/outer come from the weapon's own moves' reaches (e.g. the knife's thrust reach is the inner edge)? [fractions of `R`; revisit if the batch re-ranks a class]
2. **`offBandMult` 0.6 for every off-band direction**, or harsher for the wrong *side* (a maul at outer range is further from best than at inner)? [flat 0.6]
3. **Chip through a block** at off-band: scaled by the same factor? [yes, the factor is on the blow's damage]
4. **Marker for the foe's band**: tint shows the *player's* band by default, and the label names both when they differ? [player tint; label per fighter]
5. **Who owns the scene tint and the coach label** (World / Web): Combat provides the band function and rows only. [Combat: function + rows; World: tint; Web: label]
6. **Gate tolerance**: what "outside the ruled tier band" allows, as a number. [Strategy's ruled tier table]

Donors: Gothic (weapon reach and distance as a read of the fight; not a repo read), AzerothCore melee range and `GetMeleeRange` (`Entities/Unit/Unit.cpp`, used by the ranged min-range check at `Spells/Spell.cpp:7399`, read for the bows spec), Morrowind/OpenMW weapon reach (`docs/specs/combat/openmw-weapon-timing.md`). Shape only; no code copied.
