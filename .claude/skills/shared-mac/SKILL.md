---
name: shared-mac
description: Rules for the one shared MacBook that runs 21 lane sessions, GPT's Blender fits and every deploy. Check load before launching heavy work, keep heavy work out of a release, take a quiet window for timing gates, never pkill by script name, renice indexers. Every lane; Lead and Deploy enforce it.
---

# The shared Mac

Load 95 at 20:22 on 2026-09-27 came from four lanes restarting at once, each running Playwright. Load 125 blocked the quality gate. Deploy rows are wall-clock browser tests: under load they hang, and a hung row idles the box for everyone.

## Before anything heavy (build, test:all, Blender, a 47-row run, a contact sheet)
```bash
uptime; cat ~/.claude/state/deploy_in_flight.json 2>/dev/null
```
- Load 1-min > 60: wait or tell Lead; do not add to it.
- A deploy is in flight: no builds, no renders, no test:all. Single-browser captures are exempt.
- Never `pkill -f <script>`: it kills other lanes' identical processes. Stop only your own PIDs.

## Quiet window (for timing gates: frame p90, swap ≤ 50 ms, load-time A/B)
Numbers taken at load 40 are worthless. Lead calls a window: ~30 min, load ≤ 15, one browser, no builds anywhere, start and end announced to Strategy and Deploy. Take it right after a deploy publishes or when GPT stops.

## Priority when GPT is fitting meshes
GPT's Blender batch outranks the deploy queue; Deploy runs in CI-trust mode in GPT's gaps. Code lanes are never blocked: writing code, tests and PRs barely touch the Mac.

## Indexers and orphans
A codegraph sync at 79% CPU for two hours is an orphan: renice or kill YOUR OWN, report it. Disk under 6 GB aborts the deploy watcher; check `df -h /`.

## Metal for renders and captures (Dom's ask 2026-09-27, from GPT's fits)
GPT's Pitborn previews rendered on the Mac's GPU through Metal and skipped the slow software path our harnesses use. Lever for Armour, Weapons, Hero Look, Finishers:
- Blender: set the render device to GPU (Metal) in the preferences of the scripted session before EEVEE or Cycles previews; load the model once and switch cameras.
- Playwright stills: headless Chromium falls back to SwiftShader (software WebGL). Try the `--use-angle=metal` launch arg with headless "new" mode and compare wall time and frame on one contact sheet before switching a harness.
- Whoever measures first records device, wall time and load in their state doc; unverified until then.

## Before deleting a cache folder (learned 2026-09-27 22:5x)
`~/.cache` holds more than caches: `~/.cache/huggingface/token` is the Hugging Face login, and `~/.cache/uv` backs every uv-built Python venv (semble, serena, Armour's tools). Deleting it logged the whole Mac out of Hugging Face mid-sprint and blocked GPT's remote TRELLIS. Before any cache delete: `ls ~/.cache`, move the HF token out (`hf auth login` again is the only recovery), and delete subfolders, never the root. Space that stays "used" after a delete is a process holding the file open: `lsof +L1` finds it (the 19 GB codegraph orphan, pid by pid, never by name).
