# Sandbox carry gap: where each tuning difference stands (Combat, 2026-10-19)

The Auditor's list (sandbox `rows.json` @93b1138c7 against the rows at cd9d91ca0, #3257 comment 6260351682) and what is on trunk now. Trunk at 2b89c3f0e (JM, RV 79, WSV 57). **Nothing here is DROPPED-BY-DOM**: only Dom marks a row dropped, and he has not.

| # | Difference | Status on trunk | Where |
|---|---|---|---|
| 1 | Stances 2x (aggressive damage/posture/block, defensive, trickster; feint held at -75%) | **PORTED** in RV79 (#3279, live JM) | `src/fight/rows79-defs.json` `stances`, feint cap as its own `stanceCaps` row (floor -750) |
| 2 | Hit-stop 0 in live zones (Dom: "no time change in a live zone"): `hit-stop-rules.json` ms and `hit-stop-defs.json` frames to 0 | **NOT PORTED. Still open.** Trunk still has the shipped values (stop ms Hit 50, Blocked 30, Parried 70, GuardBroken 90, PostureBroken 150, Killed 220; heavy Hit 90, Blocked 50; contact frames hitLight 3, hitHeavy 5, ...). RV79 did not carry it | `src/hit-stop-rules.json`, `src/fight/hit-stop-defs.json`. Needs Dom/Lead to say where "live zone" applies (the Pit and PvP too, or only the open world) before a port; it changes the fight clock, so it is a sim change under an RV bump if it reaches the Pit |
| 3 | `ARENA_ONE_SCALE` 0.36 to 0.468 | **PORTED** in RV79 | `rows79-defs.json` `dials` (ARENA_ONE_SCALE 0.468), read through `playScaleFor(opponent, version)` for records at 79 or later; older records keep 0.36 |
| 4 | Gear: plate shape magicResist -25 to -15 and stamina -10; presets light = robes, medium = leathers | **PORTED** in RV79 | `src/fight/gear-defs.json` plate `eras` (fromRecordVersion 79), preset `set` rows; `gearDeltas` reads the shape through `rows79Version` |
| 5a | Seven single `specialSound` rows, `spellCue` far, `readyStyles` / `hurtStyles` | **SUPERSEDED** by trunk's 24 per-skill sound rows, `specialCue` far, and `character-style-defs.json` | not a gap |
| 5b | `oneButton` 1, `heavyHold` 220, `stabHalfAngle` 50, `stabSlide` 18 | rows on trunk (`input.one-button` 0 = off, `input.heavy-hold-ms` 220, `input.stab-slide-px` 18, `input.stab-half-angle` 50). **oneButton stays 0**: Dom flips it himself after playing `?onebutton=1`. CS36b (#3283) adds the counter-window heavy hold row and the 44 px kick | `src/fight/input-rows.json`, `touch-layout-defs.json` |
| 5c | `plainPosture` 1 | **PORTED** in RV79 (view only): `character-style-defs.json` `posture[0].plain` true | `character-style-rows.ts` `PLAIN_POSTURE` |
| 5d | `dodgeCounter` `{window: 20}` vs `{value: 20}` | same number, renamed key | nothing to port |

Also carried by RV79 beyond the list: reach bands live (Dom's cm edges, off-band x0.4; the PvP duel too, Lead's ruling 2026-10-19), plainPosture, heavyHold 220, the era-keyed audio rig (`wardenHealth` 32 era on, `wardenHealthEraOff` 80).

Open items, in order: (2) hit-stop, waits for Dom's scope answer; the `oneButton` flip (Lead and Strategy, after a Mac WebKit check at 375, with Dom able to veto) and the STRIKE tap-duration measure behind it (`?taplog=1`, see the PR that adds it).
