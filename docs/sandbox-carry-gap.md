# Sandbox carry gap: where each tuning difference stands (Combat, 2026-10-19)

The Auditor's list (sandbox `rows.json` @93b1138c7 against the rows at cd9d91ca0, #3257 comment 6260351682) and what is on trunk now. Trunk at 2b89c3f0e (JM, RV 79, WSV 57). **Nothing here is DROPPED-BY-DOM**: only Dom marks a row dropped, and he has not.

| # | Difference | Status on trunk | Where |
|---|---|---|---|
| 1 | Stances 2x (aggressive damage/posture/block, defensive, trickster; feint held at -75%) | **PORTED** in RV79 (#3279, live JM) | `src/fight/rows79-defs.json` `stances`, feint cap as its own `stanceCaps` row (floor -750) |
| 2 | Hit-stop 0 in live zones (Dom: "no time change in a live zone"): `hit-stop-rules.json` ms and `hit-stop-defs.json` frames to 0 | **ALREADY TRUE where it is meant, nothing to port.** Lead's scope ruling (2026-10-19): live zone = the OPEN-WORLD zones only; the Pit, the arena and PvP keep today's hit-stop (stop ms Hit 50, Blocked 30, Parried 70, GuardBroken 90, PostureBroken 150, Killed 220; heavy Hit 90, Blocked 50). The hold is a presentation-only wall-clock freeze owned by `src/main.ts` (`stopFor` in `src/hit-stop.ts`: "the sim never reads this"), which only the Pit page draws with. The open-world preview (`origins/`) imports none of it, so a world hit already changes no clock: the sandbox's 0 is what trunk does. No row change, no RV, no digest. `tests/hit-stop-world.test.ts` pins both halves (no `origins/` file reads the hold; the Pit rows keep today's values) | `src/hit-stop.ts`, `src/hit-stop-rules.json`, `src/main.ts` (Pit only) |
| 3 | `ARENA_ONE_SCALE` 0.36 to 0.468 | **PORTED** in RV79 | `rows79-defs.json` `dials` (ARENA_ONE_SCALE 0.468), read through `playScaleFor(opponent, version)` for records at 79 or later; older records keep 0.36 |
| 4 | Gear: plate shape magicResist -25 to -15 and stamina -10; presets light = robes, medium = leathers | **PORTED** in RV79 | `src/fight/gear-defs.json` plate `eras` (fromRecordVersion 79), preset `set` rows; `gearDeltas` reads the shape through `rows79Version` |
| 5a | Seven single `specialSound` rows, `spellCue` far, `readyStyles` / `hurtStyles` | **SUPERSEDED** by trunk's 24 per-skill sound rows, `specialCue` far, and `character-style-defs.json` | not a gap |
| 5b | `oneButton` 1, `heavyHold` 220, `stabHalfAngle` 50, `stabSlide` 18 | rows on trunk (`input.one-button` 0 = off, `input.heavy-hold-ms` 220, `input.stab-slide-px` 18, `input.stab-half-angle` 50). **oneButton stays 0**: Dom flips it himself after playing `?onebutton=1`. CS36b (#3283) adds the counter-window heavy hold row and the 44 px kick | `src/fight/input-rows.json`, `touch-layout-defs.json` |
| 5c | `plainPosture` 1 | **PORTED** in RV79 (view only): `character-style-defs.json` `posture[0].plain` true | `character-style-rows.ts` `PLAIN_POSTURE` |
| 5d | `dodgeCounter` `{window: 20}` vs `{value: 20}` | same number, renamed key | nothing to port |

Also carried by RV79 beyond the list: reach bands live (Dom's cm edges, off-band x0.4; the PvP duel too, Lead's ruling 2026-10-19), plainPosture, heavyHold 220, the era-keyed audio rig (`wardenHealth` 32 era on, `wardenHealthEraOff` 80).

Open items: the `oneButton` flip (Lead and Strategy, after a Mac WebKit check at 375, with Dom able to veto) and the STRIKE tap-duration measure behind it (`?taplog=1`, see the PR that adds it).
