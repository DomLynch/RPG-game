# Gothic tactic table: the warden picks from a situation-keyed table (spec)

Combat, 2026-10-14. Item C1 of docs/research/origins-best-in-class.md ("Situation-keyed tactic table with a reaction slot"), approved ADAPT. This is the spec for the build; nothing is built. It is its own RV (the warden's decision layer, `src/fight/ai.ts`, is on the SIM list). A fresh implementer works from this file plus `src/`.

## Donor (reuse-first)

- **OpenGothic** (MIT; on the VPS at `/mnt/frankendom-donors/OpenGothic`): `common/game/fightalgo.cpp` `FightAlgo::fillQueue` (lines 33-89) is the situation ladder. In order: (1) the target is *pre-hit* (winding up) inside our weapon range and facing us: the **reaction** row; (2) inside weapon range, split by *in focus* (facing) and *running or standing*: `my_w_focus` / `my_w_nofocus`; (3) the longer "walking" range, split the same way: `my_g_focus` / `my_g_nofocus`; (4) magic rows; (5) far rows; (6) a default. Each row is a list of moves (`FightAiMove`: TURN, RUN, RUN_BACK, JUMP_BACK, STRAFE, ATTACK, ATTACK_SIDE, ATTACK_FRONT, ATTACK_TRIPLE, ...); one entry is drawn at random. `common/game/definitions/fightaidefinitions.cpp` loads the rows from the game's `Fight.dat` script (a `C_FIGHTAI.MOVE` array per tactic record). `docs/specs/origins/combat-study.md` section 1.2 already summarises it.
- **What we take:** the situation keys and the pre-hit reaction slot. **What we skip:** Gothic's range numbers (Gothic units, weapon lengths; ours come from `reach` in `moves.ts`), whirl and master chains (longer than our stamina budget), magic and ranged rows (no ranged state in the duel).

## What we already have and reuse

- `decide(duel, me, ai, profile)` (`src/fight/ai.ts:66`): the warden already reads the opponent (`readOpponent`, `READ` rows in `ai-read-defs.json`), notices a swing `reaction` ticks after it starts and plans **one response per attack** (`plan`, `next`, `AiMode` approach/circle/retreat/guard), scores offence by utility, and has fight-identity knobs on `AiProfile` (`guard`, `disengage`, `aggression`, `braceHeavy`, ...). The situation split is implicit in that code; the table makes it authored data.
- `AiProfile` rows (`PROFILES`, the tier table) and the archetype tables (`archetype-defs.json`, sim batch A) are the loader pattern to follow: rows through `loadRegistry` / `tableFromFile`, a manifest, a rows module. Sim batch A (#2689) already moved these numbers to rows.
- Row-key hygiene: `scripts/rng-fingerprint.mjs` and `scripts/record-replay-check.mjs` already prove "a profile without the block is byte for byte as before".

## The design

An **optional `tactic` block** on an archetype / profile row. Absent = today's warden, byte for byte (no draw, no branch). Present, it only **weights choices the warden already makes**; it adds no move and no rule.

```
tactic: {
  heroWinding: Reaction[]   // the reaction slot: the hero's swing is winding up inside my reach and I am in its arc
  inReach:     Plan[]       // I am inside striking range, hero not winding
  closing:     Plan[]       // hero is walking/running at me, outside striking range
  afterHit:    Plan[]       // I was just hit (today: the 48-tick retreat, `hurt` age 1)
}
Reaction = 'parry' | 'backstep' | 'sidestep' | 'brace' | 'trade'      // weights, <= 6 entries per list
Plan     = 'press' | 'circle' | 'guard' | 'backstep' | 'sidestep'      // the existing AiMode / plan targets
```

- Each list is `{ choice, weight }[]`, at most 6 entries; one is drawn with the warden's existing `roll()` (the seeded `lcg`). A list that is absent for a situation keeps today's logic for that situation.
- `heroWinding` replaces the choice inside the existing "one response planned per noticed attack" step; it does not change *when* an attack is noticed (`reaction` ticks), so perception stays the same.
- The reaction entries map onto responses the warden already produces: `parry` and `brace` are its guard plans, `backstep` and `sidestep` are its existing step moves. `trade` is "swing into it". No new move or timing; the warden still cannot do anything the player's fighter cannot (the duel's legality check runs unchanged).
- Authoring: `src/fight/tactic-defs.json` (+ manifest, rows module `tactic-rows.ts`, a SIM file and SIM_DATA entry, as sim batch A did). Kinds can share a row by id.

## Cost

| | |
|---|---|
| Sim | `ai.ts` (SIM): a branch per situation that draws from the block when present; plus the rows module. **RECORD_VERSION bump with REACH**: the opponents that carry a block, from the level they carry it (existing records of those opponents replay a different fight). |
| Record / replay | No new field. The seed draws are the same `roll()`; an opponent without a block replays unchanged, which `record-replay-check` and `rng-fingerprint` prove. |
| WSV | The world's creatures run the same `decide()`: WSV bump if a world creature kind gets a block. v1 can ship Pit archetypes only and skip it. |
| Phone | None. One extra table lookup per decision. |
| Server | None; the verifier replays the same `decide()`. |

## Order of work (own PRs)

1. **Spec merge** (this file).
2. **Implementation PR 1, zero behaviour:** the loader, the rows module and the branch reading an empty/absent block. Proof: `rng-fingerprint.mjs` output byte-identical, `record-replay-check` passes, `test:all`. (The loader and the dead branch can ship with the RV bump deferred only if the record guard accepts it; if the SIM digest moves, RV bumps here and the proof is the byte-identical fingerprint apart from the version stamp, as with sim batch B.)
3. **Implementation PR 2, first tactics:** one block per kind, authored from the identities already ruled (Shieldmaiden brace/guard-first, Knight methodical, Plague Doctor parry-first) and the beasts' hop-back / sidestep rows. Each is its own commit so one can be dropped alone. Proof: the win-rate battery (`scripts/own-row-battery.mjs` as used for the RV30 own rows: hero normal vs each kind, 40 seeds, L6/L18/L46) before and after, no kind moving more than the ruled band, plus stills where a reaction is visible (before/after at 375, mid-fight).

## Open questions for Lead / Strategy

1. Pit archetypes only for v1 (no WSV), or world creatures as well?
2. May the `trade` reaction exist, or is "swing into an incoming swing" an AI behaviour we keep out of v1?
3. The identities of record (Shieldmaiden, Knight, Plague Doctor rows) were RV30 profile numbers only; may their tactic blocks also change *how* they react, or keep them number-only?
