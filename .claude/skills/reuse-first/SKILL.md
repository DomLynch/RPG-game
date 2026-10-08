---
name: reuse-first
description: Dom's rules: DONOR GAMES FIRST for any medium/large feature (EverQuest, Ultima Online, WoW, RuneScape, Gothic, Morrowind, Civilization... 55 repos on the storage box) and reuse what another lane already built. Dom's rule (2026-10-07) for every Frankendom lane before any fix or feature: find what another lane or a merged PR already built for the same shape of problem and reuse it; a simple change that passes 30 minutes is reported to Lead, not retried. Use before starting any task, when a fix is taking longer than expected, and when a reviewer or the COO asks "didn't X already solve this". Every lane; the Auditor names the prior PR on the thread when a lane re-solves it.
---

# Reuse first, report at 30 minutes

Dom's example: a lane spent an hour working out how to make the dog bigger. Rats had been scaled up weeks earlier by another lane. Five minutes with that PR would have done it.

## Donor games first (Dom, standing, 2026-10-08) — before ANY medium or large feature
We don't reinvent fire. For anything significant (saving, combat, loot, bank, trade, crafting, quests, NPCs, factions, world servers, economy), FIRST check how the legendary games already solve it, take the best of the best, and say which one you used.
**Where they are:** 55 open-source game repos in the donor library on the storage box, `/mnt/frankendom-donors` on the VPS (ssh in `vps-heavy-jobs`). World of Claudecraft is also on the Mac at `~/Developer/donors/world-of-claudecraft`. Our written studies: `docs/specs/origins/eqemu-*`, `modernuo-*`, `gothic-*`, `openmw-*`, `server-save-schema.md`, `item-loot-storage-summary.md`, and `docs/research/origins-best-in-class.md`.
**Which donor for what:**
| System | Look at |
|---|---|
| Saving, world/zone servers, who-sees-what | EQEmu, AzerothCore (WoW), forgottenserver (Tibia), Ryzom, Veloren, 2004Scape / LostCityRS (RuneScape) |
| Loot tables, drops | EQEmu, AzerothCore, rathena (Ragnarok) |
| Bank, secure trade, auction | ModernUO (Ultima Online), AzerothCore |
| MMO combat on a server | AzerothCore, EQEmu, OpenDAoC, Veloren |
| NPC routines, dialogue, factions | OpenGothic + ZenKit (Gothic), openmw (Morrowind), daggerfall-unity |
| Quests, journal | ModernUO, openmw, AzerothCore |
| Skills, crafting, levelling | ModernUO, 2004Scape, rathena, openmw |
| Economy, simulation | freeciv / Unciv (Civilization), OpenTTD, simutrans |
| Phone UI, touch, HUD | World of Claudecraft (MIT) |
**Copy or clean-room:** World of Claudecraft is MIT, so its code can be ported with credit. Almost everything else is GPL/AGPL: read it, write down the design (a study in `docs/specs/origins/`), then write our own code. Never paste GPL code into the game. Leaked or decompiled sources (e.g. OpenXRay, DevilutionX) are out.
**In the PR body:** "Donor: <game> (<file or study>), what we took" or "No donor fits: checked <games>". The Auditor asks for it on every medium/large PR.

## Before you start (two minutes, every task)
1. Search merged PRs for the shape of the problem, not the noun: `gh pr list -R DomLynch/RPG-game --state merged --search "<verb or mechanism>" --limit 10`. "scale", "size", "flag", "layer", "stills harness", "record version", "rebase", "preview rebuild".
2. Search the repo for the helper: `rg -l "<function or key you'd expect>" src scripts tests`. Shared helpers live in `src/` and `scripts/lib/`; the Auditor's dedupe PRs (e.g. fx-math) say where.
3. Read your own lane's state doc "learned" section and memory. Then the lane that owns the nearest system: Characters for rigs and scaling, Combat for sim and record flags, World for scene and capture, Web for CSS and end screens, Backend for server and migrations.
4. Write one line in the PR body: "Reused: <PR/helper>" or "Nothing to reuse: searched <terms>".

## The 30-minute cap
A simple change (one value, one CSS rule, one flag, one re-pin) that is still not done after 30 minutes is a blocker, not a puzzle. Stop, write three lines to Lead: what you tried, what failed, what you suspect. Lead either names the prior art or re-scopes. Retrying the same fix a third time is a repair loop; the Stop hook and the COO both flag it.

## Patterns already solved, do not rebuild
- Scaling a creature: the rat scale-up (Characters lane); same rig recipe applies to any body family.
- Record-version bumps: re-pin the pinned tests with a comment, never relax the guard (`fix-forward`).
- Trunk moved under your PR: merge trunk in, do not rebase, so the Auditor's PASS sha stays traceable.
- Stills: the repo harness scripts (`visual-pr-stills`), never a hand screenshot.
- Preview flag for a look question: `look-test`, five minutes, no release rows.
- Release checks when the VPS queue is full: the one-spare-core exception in `vps-heavy-jobs`.

## The Auditor's part
When a PR re-implements something a merged PR already has, the Auditor says so on the thread with the PR number, before anything else in the review.
