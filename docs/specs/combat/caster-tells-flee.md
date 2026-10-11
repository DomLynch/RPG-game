# Caster tells and the deterministic flee: cost note

Status: note for Lead, Combat, 2026-10-11. No code written. Everything below was read from trunk 8d58991a8 in this session; items marked UNVERIFIED were not run.

## What is already on trunk
- **Interruptible casts exist in the sim.** `duel.ts` carries `castHurt` and the `SpecialInterrupted` event, `combat.ts` derives the `AttackInterrupted` clarity cue from it. (PR #1548 shows CLOSED; the code is on trunk regardless.) A boss or class special can be cut by `RULES.special.interruptAt`.
- **A boss tell exists, boss-only.** `src/fight/boss-telegraph.ts` `telegraphLook` returns `{ fill, flash }` and returns `null` unless `specialShare === RULES.special.bossDamage`. It is presentation (outside SIM_FILES).
- **A caster mob today is the Witch.** `MOB_STYLE.caster = { opponent: 'witch' }`; `origins/mobs/kits.ts` gives it one opener, `skill` (witchfire, an ordinary 20-22 tick wind-up move). Its only tell is the wind-up pose plus the cut cue. No shipped zone row uses the `caster` role (zone rows today: 10 `beast`, 4 `brute`).
- **The flee engine exists and is deterministic.** `src/fight/twist.ts` `stepTwist` reads the duel and a `flee-at` flag (`percent`, optional `catchSeconds`): outcome `fled` / `caught` / `escaped`, no RNG, outside the sim, so no RECORD_VERSION. `origins/preview/pit-duel.ts` ends the fight with the foe alive on `fled`/`escaped`.
- **The beast flee rule is data with no caller.** `MOB_STYLE.beast.fleeBelow = 0.3` and `fleesNow()` in `origins/mobs/styles.ts` are only called from their own test. Nothing synthesizes a `flee-at` flag for an ordinary wolf or goblin; the twist runs only when an encounter hands in `flags`. So a wolf in Zone 1/2 fights to the death today (`moves.ts` wolf comment says the flee is "the twist layer's flee-at in the world").

## Gap 1: the flee for ordinary beasts (recommended, no RV)
Wire it where flags are built, not in the sim: when a mob row's style has `fleeBelow` and no encounter flag is present, `fightSetup` adds `{ kind: 'flee-at', percent: fleeBelow * 100 }`.
- **Boundary mismatch to fix on purpose:** `stepTwist` flees at `<= percent` (it returns early only when health% `>` percent), while `fleesNow` and mobs.md 5.6 say strictly below 30. Pick one and pin it with a test at 29/30/31 of 100.
- **Outcome:** `fled` = no kill, no loot, no Bounty (mobs.md 5.6). The world needs the run-away state, `fleeTime`, return and the wounded window (`foeHealthFrac`); mobs.md 5.11 says Expansion owns that state machine and Combat owns the number plus the `foeHealthFrac` option. That is the real dependency, not the sim.
- **Packs / shared pool:** the shared-health pool makes every stream read the same health, so the flee fires per stream on the same tick (one tick of `incoming` latency, identical on replay). `pack.ts nextBout(.., fled)` already takes `fled`. UNVERIFIED: how a fled stream releases the pool in `world.ts`; needs a test with 2 and 3 attackers.
- **Server:** UNVERIFIED whether the writer's creature-fight verify (origins/server encounter-verify) accepts a record that ends with both standing; ask Backend before wiring, because a flee that cannot be verified would forfeit the reward path.
- **Cost estimate:** flag synthesis + boundary pin + tests 0.5 d; world run-away and wounded window 1-1.5 d (Expansion/World); battery run on the VPS 0.5 d. No fingerprint or RV movement as long as it stays in twist/world code.

## Gap 2: caster tells
Two different things, both presentation unless we want a new rule:
- **Make the cast readable on a mob (no RV).** Extend `telegraphLook` beyond the boss share so a Witch's witchfire shows the fill/flash bar, and name the cut cue for mobs. 1 d plus before/after stills at 375 wide (visual-pr-stills rule). A visual look is the Characters/World lane's to approve.
- **A caster that keeps range and recasts on a cooldown (RV bump, not recommended yet).** mobs.md describes it, the engine has no ranged state; `skirmisher`/`caster` are names only, "ranged stays out of the duel". Doing it means a new AI knob or move in `ai.ts`/`moves.ts` (SIM files): RV, fingerprint cells, guard digest, 3+ d. Park until a zone actually uses a `caster` row.

## Recommendation
1. Do Gap 1 now: it fixes a real gap (wolves never run) with no RV. Needs Lead to confirm the boundary choice and to name who builds the world run-away state.
2. Do the cheap half of Gap 2 only when a zone ships a caster row; today none does.
3. Do not start the ranged-caster sim work.

## Lead rulings (2026-10-11)
- Boundary: flee at `<= percent`, the engine's (`twist.ts`); `fleesNow` is changed to match (it has no callers). Changing the engine would be an RV.
- The flag synthesis is built as its own PR, no RV, with a fingerprint-unchanged receipt for every fight without a style flee.
- The world run-away and wounded-window state goes to World, Monday after its zone items (mobs.md 5.11).
- Caster tells wait until a zone ships a caster row; no ranged-caster sim work.
