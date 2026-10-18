# Sandbox porting notes (for Combat, written 2026-10-18 at the freeze)

One entry per promotion-list line that is still TODO. The branch `sandbox/page` is never merged wholesale: port each slice from the commit named, as its own PR. Anything that touches `duel.ts` or `ai.ts` is a sim change: RV bump, WSV, melee-digest (`scripts/melee-digest.mjs --seeds 8`, trunk digest must stay identical with the rows OFF), then the trunk full suite. Every new row family is declared in `src/fight/sandbox-rules-defs.json` with a neutral default (0 or empty = trunk behaviour) and a manifest entry. Sandbox values live in `sandbox/rows.json`.

Already in trunk PRs: slice a (#3220), b (#3222), c melee families (#3198 merged), d windup/react (#3205), digest tool (#3206, merged).

## d. Melee special reach (3b118938e) — port with #3205, same `duel.ts` lines
- Why: Dom found a melee special landing from across the arena. The press was gated at `R.special.reach` (3 m) but the release (`// 4. Special Moves`, the `releasing` loop) had no distance check, so a special pressed in reach landed wherever the foe was. Spells were never gated by the melee reach (a spell's own `spellRange` band applies).
- Rows: `specialMeleeReach` 220 (cm), `specialMeleeSlack` 40 (cm). Declare both in `sandbox-rules-defs.json` with value 0 (0 = trunk: the special's 3 m reach and no release check).
- Code: `sandbox-rules.ts` `SPECIAL_MELEE_REACH`, `SPECIAL_MELEE_SLACK`, `meleeSpecialReach(trunk)` (metres). `duel.ts`: the press cue (`'far'` when `!picked && !bowRow` and gap beyond reach, pushes `SpellRefused` with `cue: 'far'`, nothing spent), the cast gate uses `meleeSpecialReach(R.special.reach)`, and a new release check before the cone branch pushes `SpecialFizzled` when `distance*100 > reach + slack` and `!A.spell`. `ai.ts` casts inside the same reach (non-spell branch).
- View: the existing `hud.ts` `floatSpell` already renders the `far` cue for actor 0 (row `spellCue`: `{"id":"far","text":"too far"}`); it must be on trunk with the cue row.
- Gotchas: a bow special inside the missile gap falls back to the melee special and gets this reach; a cone special (`cone-rules.ts`) is covered by the same release check because it runs before the cone branch; `SpecialFizzled` without `spell` is already used by the bow path, so no new event type. Release whiff leaves the cooldown spent (spent at release start), as a spell fizzle does.
- Tests: `tests/sandbox-*.test.ts` + `match-specials-boundary` + `class-special-identity`: 231 green on the VPS at 3b118938e. A porter should add a unit test: press at 2.3 m refused with cue `far`; press at 2.0 m then foe moved to 3.0 m before release = `SpecialFizzled`, no damage; reach 0 = unchanged digest.
- Not checked: on-screen play of the cue (the Mac screenshot attempt stalled on "Loading warriors" in headless Chromium); Dom has not yet played it.

## d. `hit-impact.ts` `special` tier and `specialSound` cues
- Rows: `specialSound` (one per skill: `whoosh_*`, impact, `guard_break` with gain/room/delay/on), `specialReactFloor` (min stagger ticks per special: `lunge` 36), `specialReactStagger` 160, `specialReactKnock` 450, `specialReactPosture` 150 (percent of the move row).
- Code: `src/fight/hit-impact.ts` (the `special` tier), `src/fight/sound/cues.ts` (row reader). Tests: `tests/sandbox-special-sound.test.ts`, `sandbox-special-look.test.ts`.
- Gotcha: the sound rows reference cue names that must exist in trunk's cue table; check before porting.

## d. KNOWN BUG on the branch (do not copy)
- `duel.ts` ~line 360 on `sandbox/page`: a trailing `//` comment swallows `delete next.castHurt; delete next.castPush; next.phase = 'ready'; next.age = 0; next.parrying = false; next.guardDirection = null;` after `next.special = castWindup(...)`. Melee specials were approved with this in place, so after restoring the statements re-check the look.

## d. Four melee specials on every melee weapon; special-shards
- Rows: `specialPick` (cleave Skull Crack heavy, reaping Whirlwind sweep, stomp Ground Slam posture break, lunge Lunge opener, each with `unlockAfterBossKills` 0/0/1/2, DATA ONLY: nothing reads the unlock, Combat wires the gate), `specialMeleeWindup` 32 ticks, `specialReact`. `src/fight/special-shards.ts` is an MIT port of World of Claudecraft chips, rows empty by default, plus `specialTrail` rows.
- Tests: `tests/sandbox-special-weapons.test.ts` (36).

## e. SPECIAL 1 / SPECIAL 2 slots
- Code: `sandbox/entry.ts` picker (`?skill=`, `?special2=`), `hud.ts`, `match.ts`, `input.ts` (action `skill2` in the record codes: needs a record-code bump and a replay-fixture update). Heal off via `healOff` row. Slot 2 defaults from the `specialPick` row marked `slot2Default`, else `slot2Alt`, so the two buttons never start identical.
- Gotcha: the two slots keep separate cooldowns (`skillCooldown2`); a melee special in slot 2 parks the slot-1 spell (`spellHome`) during the cast.

## f. `pin` crowd control
- Rows/code: `src/fight/cc-defs.json` kind `pin` (source `pinShot`, also in tier `unstoppable`), `cc-ladder.ts` `CcSource`; `tests/cc-swarm-rows.test.ts` expectation changes. Used by the Pinning Shot (`pin` 90 ticks).

## g. Missile model, `missileAnswer`, staff bolts
- Code: `duel.ts` missile fire/arrival (`A.missile`, lanes, `missileTicks`), quiver (`ammoOf`), bands; `missile-fx.ts` (3-arrow fan view); `ai.ts` `missileAnswer` (warden rolls / guards / answers an arrow). FINAL values: `missileAnswer` 15 / 15 / run 0; `missileGuardPosture` 18; bow row `pierce` 350, `chipKills` 1.
- Proofs held: melee digest `07b44daab172637c` identical with no sandbox rows loaded. A bow-vs-warden battery (`tests/sandbox-bow-battery.test.ts`, [slow], 16 seeds) shows a kiting archer wins ~4/16 vs the level-12 warden at normal.
- Staff bolts: `missile` rows kind `staff` (Dom: stays as is). Crossbow DROPPED-BY-DOM (inert row kept only for `tests/sandbox-quiver.test.ts`).

## h. Four bow specials (Power / Fan / Pinning / Quick Shot)
- Rows: `bowSpecial` (skill, clip `Special_Bow*`, arrows, lanes, mult, windup, speed, react, pin, posture, tint). Current: Power mult 2000 windup 40 speed 700 react posture 70; Fan 3 arrows lanes -1/0/1 mult 600 windup 36 speed 900; Pin mult 1000 windup 36 pin 90 posture 90; Quick Shot mult 1500 windup 7 speed 2600.
- Code: `duel.ts` cast gate (`bowSpecialOf`, beyond `missileMinGap` a bow's special is arrows; inside it the melee special stays), release, arrival; `characters.ts` clip roles + `specialRoleOf` prefetch (an armed archer asks for its bow clips while ready, else the first Quick Shot plays the stand-in swing).
- Open: all four multipliers untuned; Quick Shot new numbers (windup 14 -> 7, speed 1400 -> 2600, mult 1200 -> 1500) were never played by Dom and had no battery. If it still feels dull the fix is a new clip, not numbers. `sandbox/painted/bow-v1.glb` hold row `[-1.9, 34.6, 114.3]` (Characters and Art).

## i. Tools and tests
- `scripts/special-weapon-sheet.mjs` (`--bow 1`, `--orbit`), `special-look-clip.mjs`, `sandbox/bow-sheet.sh`, `sandbox/vps-run.sh`, `sandbox/publish.sh` (stamps `preview/sandbox/release.json`). Tests listed in the promotion list, line i.
- VPS recipe: `capture --prio 3 <lane> bash -c '<clone, npm ci in the clone, node --test ...>'`; never link `node_modules` into bn-trunk; the repo's runner is `node --test`, not vitest.

## Not ported unless Dom names it
Older sandbox-mech (mana, reach bands, bind/disarm, poison clock, flank, ward, commit, armour, dodge counter, pushback, execution, boss-phase enrage, wounds, swarm rows, ready/hurt styles, touch layout A, crowd) and the DROP list at the bottom of `promotion-list.md`.
