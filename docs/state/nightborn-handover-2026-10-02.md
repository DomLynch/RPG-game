# Nightborn lane: full handover, 2026-10-02 (night)

Written before a /clear. Read this, then `docs/state/nightborn.md` (top entry) and memory files `frankendom_nightborn_class_specials.md`,
`frankendom_red_wind_l8.md`, `feedback_special_films_to_lead.md` in `~/.claude/projects/-Users-domininclynch-Developer-frankendom-nightborn/memory/`.
Lane: Nightborn (`~/Developer/frankendom-nightborn`, session "Frankendom - Nightborn"). Trunk `codex/01a09a76/task-1`. One deployer: never run scripts/deploy.sh.

## 1. State at a glance (all verified with git/gh at the time of writing)

| Item | Branch / PR | Head | Status |
|---|---|---|---|
| Red Wind (L8 Set's special, ground burst A) | PR #1220, base `finishers/hades-shadow-claw-fx` | d77558d1 | MERGED 2026-10-01 12:39Z into #1120's branch, NOT trunk. Pit look stays as merged (Strategy: Dom's "leave as is" beats the no-pale bar). Dom sees the Pit still in the morning: keep, or darken the Pit sheets. |
| Seven Cuts (Nightborn ranks 4-7) | PR #1293, head `nightborn/seven-cuts`, base `finishers/hades-shadow-claw-fx` | 6e1b167b | OPEN, CLEAN, held. 7 files +160/-9. Strategy: Pit PASS. Not merged into the base until Lead's batch ends, then Auditer, then Lead. Pale Lunge is NOT in it. |
| Pale Lunge (Nightborn ranks 1-3) | branch `nightborn/class-specials` only, no PR | 43d422a8 | HELD. Strategy: Pit v2 PASS, "no more passes". Survival depends on Dom's ranks 4-7 answer (Nightborn's own move, or the look for Estoc Lunge). |
| This handover + state doc | branch `nightborn/state-1002` (no PR) | see git log | pushed; the state doc has always lived on state branches, not trunk. |
| Specials base | `finishers/hades-shadow-claw-fx` (#1120, OPEN) | 5575424f | merge order after Sat 3 Oct: #1114 -> #1121 -> #1120 (-> #1293). |

## 2. What was built

**Common seam (do not re-derive):** every special is presentation only, driven off the sim's SpecialStarted / SpecialLanded / SpecialFizzled events and the
120-tick windup (`src/special-timing.ts`: `LAND_AT = RULES.special.windup - 1`, `advanceCast`, `castPhase`). One registry entry per special in
`src/special-modes.ts` (`SPECIAL_MODES`; `load` gets `(scene, opponent, exposure)`), one page id in `src/special-look.ts` (`SPECIAL_TESTS`, `?special=<id>`),
one lazy-chunk effect file. The mode's `held()` poses the caster; `at: 'feet'|'head'` picks the bones the effect gets; `hideTrail` hides the pale weapon trail.

**Seven Cuts** (`src/special-fx-nightborn.ts` on PR #1293, `createSevenCuts`): seven painted near-black strokes (`paintSheet` from special-fx-wind.ts, `inkLook()`)
hang across the target's chest in the vertical plane across the caster-to-target axis; six cuts at seeded angles then a short thrust, one every `CUT_GAP`=4 ticks
(`cutAt(i)` in special-timing.ts), the 7th complete on the strike tick. Faint ghosts before the flurry (the tell). depthTest OFF, renderOrder 9: the fight camera is behind
the player, so otherwise his body hides them. The caster's blade plays them in special-modes.ts (`CUT_MOVES` light/return/heavy/return/light/riposte/thrust; each sweeps
windup->contact over CUT_GAP ticks; before the flurry and after it the estoc is held at thrust contact, `heldThrust`).
**Pale Lunge** (`nightborn/class-specials`, same file with `kind: 'lunge'`): three bent ground ribbons (bulge -0.95/-0.7/-0.5 m to the target's LEFT, widths .2/.11/.07 m, 7 cm above the sand)
drawn from the caster's feet to the target's through the windup, then six flat flare stubs fan out at his feet and thin by ~40 ticks. Pit variant (`pit` = exposure > 1.5):
widths x2.4, flare 1.7x longer / 2.2x wider, longer life, cap 0.97. Never lighter.

**Dom's rule for every special (2026-10-01 night):** nothing pale or glowing washes over the fighters; dark ink only; a light streak breaks it. Rules from Dom: 20% max
health, 20 s cooldown, unblockable, ~2 s tell, grounded, smaller than Red Wind.

## 3. Evidence (all local; `artifacts/` is gitignored)

`~/Developer/frankendom-nightborn/artifacts/class-specials/`: `lunge/` and `cuts/` (day: v2-*, v3-* = clip.mp4, build/payoff/peak jpgs, v3-thrust-sheet.jpg = 16
consecutive frames of the 7th thrust), `night-set/` (Red Wind Pit), `night-lunge/` (the FAILED Pit read), `night-cuts/` (Pit PASS), `pit2-lunge/` (the PASSED Pit variant).
Hosted PR stills: branch `nightborn/seven-cuts-stills` (and `nightborn/red-wind-stills` for #1220). Tests: `tests/special-fx-nightborn.test.ts` (4 on #1293; 5 incl. the Pit
variant on class-specials); on the VPS 25/25 (PR) and 19/19 (class-specials subset) with tsc (src + tests) and eslint clean. NOT done: real-phone `?perf=1`, a Mac quality-gate
run (deploys held the Mac), 3-D bone-distance proof that the 7th thrust does not touch the hero (judged on 16 frames of screen overlap only).

## 4. Verdicts so far (so nobody re-litigates)

Seven Cuts: day read = inky scribble across the torso, frayed brush edges; Pit = weaker, greyish, legible; Strategy PASS. 7th thrust: no clip in 16 frames.
Pale Lunge: day PASS-ish (Lead forwarded); Pit v1 FAIL (only a small mark at the feet); Pit v2 PASS ("thick dark curve that reads on shadowed clay; payoff quiet at night").
Lead's note: the flare blades read a little like upright tufts; they are in fact flat planes (feathered edges at a grazing angle). A real fix = fewer, longer hard-edged slash strokes; only if Strategy asks.
Red Wind: Dom's trail v1 too light, v2 orange "cheesy" -> grey semi-transparent, v3/v6 "plastic cylinder", picked A (ground burst), "build-up too slow", "too regular a star" -> randomised, "fine, get it live, no Pit tone-down".

## 5. Routing and process rules in force

- Films and strips go to **Lead** ("Frankendom - Lead Developer"), who forwards to Strategy for PASS/FAIL. Day films immediately; NIGHT films only in the batch Lead calls (it has been called and finished; Lead said no more night work).
- Pale Lunge / any Nightborn special must stack on nothing else; base = `finishers/hades-shadow-claw-fx`. After opening a PR, check its base and file count with gh (a wrong base would drag the specials base into trunk).
- Never merge to trunk; only Deploy merges. No local browser gates / test:all / builds while a Deploy holds the Mac: use the VPS.
- Strategy's name no longer resolves by its bracket tag; go through Lead.

## 6. Mechanics that cost time

- **VPS** (`ssh frankvps`): work dir `/opt/frankendom-shadow/work/nightborn/repo` (shallow clone; `git fetch -q --depth 1 origin <branch> && git checkout -qf FETCH_HEAD`), outputs in `../out/`. Capture: `CAPTURE_WAIT_S=7200 capture nightborn node scripts/special-clip.mjs --dist <dir> --special <id> --arena a|1 --out ../out/<name>` (`a` = Night Pit, `1` = light sand arena); FIFO across 3 slots; `capture --status`. Non-interactive node prints TAP: use `--test-reporter=spec`. scp drops under rapid use: one file at a time, retries 15 s apart. ffmpeg tiling works there (`-update 1` for a single image).
- Helper scripts left on the VPS: `run-cs.sh` (build dist-cs + day clips lunge/cuts), `run-night.sh` (Pit clips set/lunge/cuts from dist-cs), `run-pit2.sh` (checks + build dist-pit2 + Pit lunge clip). Reuse by editing the branch name.
- The Mac's PreToolUse hook blocks builds/tests/tsc while a Deploy is in flight (even single-file tests); `git`, `gh`, `ssh`, edits are fine.
- The Stop quality gate is deferred whenever a deploy or another lane's gate runs; it is not a failure, CI covers PRs.
- zsh: quote heredocs carefully when piping into `ssh '...'`; a nested quoted heredoc caused a parse error once (use `cat <<'EOF' | ssh host 'cat > file'`).
- Lessons from the first films (each cost a re-film): a 3 cm ribbon is invisible (use 7 cm); a straight line along the camera axis hides behind the player (bend it); camera-side planes need depthTest off or the hero hides them; look at every frame before sending and say what is wrong in the same message.
- Memory + state doc: lane memory is at `~/.claude/projects/-Users-domininclynch-Developer-frankendom-nightborn/memory/` (NOT the system-prompt path); do not copy into the shared pre-rehome root.

## 7. NEXT (in order)

1. Wait for Lead/Strategy to relay Dom's morning answers: (a) Red Wind Pit sheets keep/darken, (b) ranks 4-7 / Pale Lunge fate. Do nothing before that.
2. If Pale Lunge survives: open its own PR from a fresh branch off the then-current specials base (strip nothing; it is `nightborn/class-specials` minus the Seven Cuts duplicates, or rebase it onto #1293 once that merges, because both live in `special-fx-nightborn.ts`). Check base and file count with gh. If it dies: delete the branch after Lead says so.
3. If Dom asks to darken Red Wind's Pit sheets: it is one `sandLook()` colour change in `src/special-fx-wind.ts` (the `dim` branch), preview via the same VPS recipe.
4. When the batch ends and the specials base merges: re-check #1293 is still based correctly (rebase if the base moved), answer Auditer's review, never merge it yourself.
5. Optional, only if Strategy asks: the hard-edged slash flare variant, and a real-phone `?perf=1` read once Dom has a phone on /preview/.
