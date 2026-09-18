# Brief — finishers & gore milestone (hand-off to a new lane)

> Status 2026-09-17: authorized by the owner today, spec written, nothing built yet. The binding spec is
> `GAME_SPEC.md` → "Deaths" and "Owner-authorized finishers & gore — 2026-09-17" — read those first; this brief is the
> how, not the what. Read `AGENTS.md`, `src/assets/README.md` and `artifacts/character/README.md` (harness) before
> touching anything.

Owner (2026-09-17): kills deserve closers — Mortal Kombat ceremony, but gritty and realistic to match the game
("when defeating the opponent it just falls backwards"). Budget is NOT the constraint: per-fight cap raised 9 → 10 MB
gzip (`scripts/check-budget.mjs`), 11 MB only with the owner; mesh compression (~half) is approved for later and does
not gate this work.

## The one rule that shapes everything

The simulation decided the kill already. Your work begins at the `Killed` event and is **presentation only**: the
finisher is a pure function of that event plus the fighters' weapons. No new sim state, no timing change, no damage
change. `RULES.death` (144 ticks), the 220 ms Killed hit-stop (`HIT_STOP` in `main.ts` — the frame loop is its one
owner), and "death has no tail" all stand. The same duel must replay the same finisher: selection takes the event's
`victim, location, move, heading` (+ weapon) and nothing wall-clock or random.

## What exists on disk (checked 2026-09-17, trunk `codex/01a09a76/task-1`)

- `duel.ts` emits `Killed` as `{ tick, type: 'Killed', actor, target, move, location, heading }` and sets
  `duel.finish = { victim, location, move, heading }`. `location` is the coarse wound site (`'head' | 'torso' | 'legs'`).
- Death today: victim phase `dead` for `RULES.death` ticks → the shared `Death` clip plays through `characters.ts`
  (`pose 'death'` → role `Death`; trident maps to `Trident_Death`) → `main.ts` swaps the attack buttons for
  Rematch/Next when `practice.finish` is set (`won()` gates the ladder advance).
- Blood today (`scene.ts`): 12-point spray re-tinted per surface (steel sparks / blunt dust / blood), pool of 12 floor
  splashes fading over 20 s, cleared on rematch; `bloodMode: 'red' | 'dark' | 'off'` from the shared menu
  (`setBloodMode`). Wound data (`woundSite`) already positions the spray at head 1.55 / torso 1.15 / legs 0.6 m.
- Clip inventory is frozen: the 21 shipped names/durations (`COMBAT_CLIPS` + `CLIPS` in `characters.ts`). Finisher
  clips are **additive only** — new `Death_*` variants, existing clips untouched. Killer beats reuse existing attack
  clips wherever they read (Heavy as the Split Crown strike, etc.).
- The rig pipeline: `scripts/character/*.py` (Blender) → `node scripts/build-warrior.mjs` →
  `node scripts/bake-blades.mjs` after ANY GLB/clip change (contact paths are sim data) →
  `node scripts/character-preview.mjs --label finishers-vN` for the review folder.

## The v1 set (spec is binding; names are working names)

Victim is the opponent; the player's own death keeps the plain fall (v2 review).

| Killing blow | Finisher | Beat |
|---|---|---|
| Heavy overhead → head | Split Crown | skull gives, blade bites deep, body drops straight down, no bounce |
| Thrust → torso | Run Through | through the body, held beat, victim grips the blade, slides off |
| Light/return cut → neck | The Quiet One | underplayed: stagger, hand to throat, collapse |
| Heavy → torso | Opened | upright a beat, folds at the waist |
| Low killing blow → legs | Hamstrung | knees first, then down |
| Critical (posture-break) kill | Execution | the one ceremonial beat: held half-second before the blow |

Camera: a slow push-in (dolly, not a cut) over the death window is authorized. No cuts, no FOV punch, no lens
overlay, no sim slow motion. Respect `prefers-reduced-motion` (the camera kick already does — follow that pattern).

Gore upgrades (all on the existing pooled systems; all three blood modes must cover them so clips stay shareable):
directional spray as a cone along the strike heading; wound-site mark + drips for the 4 s wound window; pooling under
the corpse that outlives the 20 s splash fade on a kill (still cleared on rematch); blood on the blade — tint the
weapon material after a kill, cleared on rematch.

NOT in v1 (next separately reviewed milestone): split geometry, detachable heads/limbs, torso cuts, ragdolls. Do not
claim them, do not half-build them.

## Suggested shape (lead's recommendation, not binding)

- `src/finishers.ts`: `selectFinisher(killed: Killed, weapons) → FinisherId` — pure, exported, unit-tested; and the
  per-finisher presentation script (clip per rig, timing beats, blood cue, camera beat) as data.
- `scene.ts`/`main.ts` consume it after `Killed`; the death pose lookup in `characters.ts` learns the `Death_*`
  variants (role-per-weapon mapping, same pattern as `WEAPON_CLIPS`).
- Ship order: hero-rig template with one finisher (Split Crown) end-to-end first → owner judges on the phone → then
  the set, then per-opponent variants. Small PRs, daily.

## Acceptance

- `npm run quality` green (lint + node tests + typecheck/build + audit + `check-budget` + the Playwright browser
  gate — it runs on your machine, not CI, by design).
- Tests: deterministic selection (same event → same finisher; a mutation that swaps any event field changes the
  pick), one discriminating test per finisher row, blood modes gate every new effect, rematch clears all gore state.
  Mutation receipts, as every combat-adjacent change carries.
- Browser evidence in `artifacts/character/finishers-vN/`: a still per finisher at the duel camera, one sequence
  (webm) of the critical Execution, red/dark/off renders, phone-width viewport. Owner judges from renders; audit each
  step once and say what it caught.
- Blade paths byte-identical unless a clip genuinely changed (then re-bake and say so in the PR).
- Per-fight budget ≤ 10 MB gzip; report the number in the PR.

## Process reminders

Work in your own worktree: `git worktree add ~/Developer/frankendom-finishers -b finishers/gore-v1
origin/codex/01a09a76/task-1`. Never touch `~/Desktop/Business/frankendom` (the lead's checkout). 3 Semble searches +
CodeGraph impact before non-trivial edits; `codegraph sync` after. PRs target `codex/01a09a76/task-1` (the live
trunk — NOT `main`); CI runs `quality:ci`; the lead reviews and merges; the owner deploys. No purchases; free/CC0 or
original work only, licences recorded in `src/assets/README.md`. Cross-lane asks (e.g. you need the audio lane to
layer a wet impact) go in `artifacts/<lane>/REQUESTS.md`. Only the lead edits `GAME_SPEC.md` — if the design has to
change, request it, don't edit.
