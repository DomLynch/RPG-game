# REQUESTS → combat lane: can any shipped move land `head`?

From: finishers & gore lane (`finishers/gore-v1`, 2026-09-18)
To: combat / moves lane
Re: `blade.ts` `bladeImpact` hit regions vs the finisher spec table

## The finding

`GAME_SPEC.md` "Owner-authorized finishers & gore — 2026-09-17" defines a Split Crown
finisher for `heavy_overhead @ head`. In the shipped blade-path data **no organic kill
ever lands in the head region**:

- AI-vs-AI battery: **24 duels, 285 hits — torso and legs only, zero head.**
- The head region in `src/blade.ts` `bladeImpact` is a single zero-height point at
  `y = 1.45·k` (`regions` row `['head',1.45*k,1.45*k]`), gated by a `0.31·k` proximity
  window, competing against the torso band `[0.85, 1.30]·k`. For the head point to win
  the sort, a blade segment has to pass measurably closer to exactly 1.45·k than to the
  whole torso band — with the shipped overhead paths it never does.
- The finishers lane is **read-only on the sim**; whether any move *can* reach head is
  combat-lane data (blade path authoring in `scripts/bake-blades.mjs` / move arcs).

## What we need from you

1. **Confirm or refute:** with the shipped `bake-blades.mjs` paths and move set, is there
   ANY realistic contact (any weapon, any move, any range/timing) whose blade segment
   passes closest to the `1.45·k` head point? If yes, which move and roughly what setup?
2. **If no:** decide one of —
   a. author/adjust an overhead path (or the head region, e.g. a `[1.35, 1.60]·k` band
      instead of a point) so the spec's Split Crown row is organically reachable; or
   b. tell the owner the row can't fire organically and the owner re-decides the spec row.
3. Until then the finishers lane exercises the Split Crown row in its evidence harness via
   a **single labeled field override** — the Killed/Hit event's `location` is presented as
   `'head'` at the presentation seam (`scripts/finisher-preview.mjs`, header honesty note).
   Everything downstream (selection, pose, clip, gore, dolly) is the unmodified production
   path. This is deliberate and documented; we are not hiding it.

## Why it matters

- Split Crown ships in v1 with the override-gated evidence; if head kills become organic,
  the override in the harness becomes a no-op and nothing else changes.
- If the spec row is re-decided instead, `src/finishers.ts` spec table needs a one-row edit
  and the `Death_SplitCrown` clip stays baked but unselected (additive — no re-export cost).

## Repro of the battery

24 AI-vs-AI duels, both fighters full sim (draw, spacing, all move kinds), every Hit event's
`location` tallied: 285 hits → `torso` / `legs` only. Raw tally lives with the finishers
lane's session notes (seeded duels via `initialPractice`/`stepPractice`, same entry points
as `scripts/finisher-preview.mjs`).
