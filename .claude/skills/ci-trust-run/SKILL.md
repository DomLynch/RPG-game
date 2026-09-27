---
name: ci-trust-run
description: The fast release mode for frankendom.com when the Mac is busy or the change is a one-row delta. Rows already green on GitHub CI for the same tree are trusted with a recorded reason (DEPLOY_TRUST_ROWS); only the delta rows run locally. Includes the 10-minute row cap, the retry rule and when a run may stop. Deploy lane, ruled by Strategy or Lead.
---

# CI-trust release run (Deploy)

Tonight's proof: 054603e0 (Options + row-4 re-pin) ran ONE row locally (row 4, 45 s), trusted rows 1–3 and 5–46 from the LOCAL 1094653e run's receipts (that tree differed only by scripts/audio-preview.mjs, which only row 4 runs) and row 47 by ruling; launched at load ~50, published in 5–6 minutes (20:24:52 → 20:30). The full 47-row run takes 40+ minutes and hangs under load.

## When to use it
- The Mac is shared with heavy work (GPT's Blender fits, a quiet window, load > 30).
- The head differs from an already-gated tree by a small delta (a pin, a comment, docs).
- Strategy or Lead has ruled it for this run.

## How
1. Every trusted row needs a reason in DEPLOY_TRUST_ROWS. Two valid kinds: "CI release-checks green for <sha>", or same-tree receipts from a LOCAL run: "passed on local run <sha>, tree differs only by <file>, which only row N runs". No bare row numbers. The old relabel dist-hash shortcut is RETIRED (not reproducible across worktrees).
2. Rows that CI cannot cover, and every row touched by the delta, run locally.
3. Pre-merge gate on the combined tree runs only when the batch has ≥ 2 code/data PRs; one CI-green code PR plus docs skips it; docs-only never runs it.
4. Post the Published line with: rows real / trusted, load at start and end, release.json and VPS both on the sha, the served index cmp.

## Stop and cap rules
- A run STOPS only when a non-trusted row fails its retry too. First-try load flakes get one solo retry.
- Any row over 10 minutes wall clock is killed and reported FAILED (#922, rides the hardening run). Row 47 idled the box 21 minutes on 2026-09-27.
- A GitHub-runner hang (rows 37/38/47) may be trusted with a reason ONLY while its fix PR is in flight.
- When Dom says "pause deployment", stop the doomed run and clear the lock; do not finish it "because it is nearly done".
