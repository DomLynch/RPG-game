# Expansion lane handover (2026-10-08, +04)

Dom removed the Expansion lane (Strategy, 2026-10-08). This is the one-page handover: what is in flight, who owns it now, where the knowledge lives, and what is NOT done. Facts below are from `gh` and the repo on 2026-10-08; anything I did not verify says so. Nothing new was started after the decision.

## 1. Every open item and its new owner

| Item | State (gh, 2026-10-08) | New owner | What the owner does next |
|---|---|---|---|
| **#1725** `expansion/worldfight` @b5de3f83 (`?worldfight`: the Pit's duel in place on the world's renderer) | ready, CI green, Auditor PASS on the base (36dc6087) and on the pins | **World, Pit & Audio** | Lead folds it. It is the bridge S1/S2 grow from. When #1748's idea is ever wanted, `closeDuel(release)` must skip a mounted stage (`!stage.mounted`). |
| **#1710** `expansion/wolf-preview` @06a0088c (`?wolf` camp, world bodies from `/world/*.glb`, spawn rules) | **draft**, trunk with #1706 merged, record-version guard green on the VPS at that head; trunk has moved since (mobkit.ts, origins-writer.mjs, fight-records.json) | **World, Pit & Audio** | Merge trunk again, take it out of draft, Auditor's full review (Lead asked for it), then fold. |
| **#1748** `expansion/one-context` @ec8836e3 | draft, **PARKED** by Lead (1 live WebGL context after a leave vs 2 on trunk, but a 22-27 s scene rebuild per fight on VPS software GL) | **World, Pit & Audio** | Close it or keep as reference. Its `dispose()` already lives in #1725. Superseded by Dom's "no separate duel stage" ruling. |
| **#1761** `expansion/state-1008a` @1f6e2941 (docs: state entry, ladder 46 -> 50, launch-gates X1) | ready, Auditor PASS, CI green | **Lead** | Fold it (docs, plus one error-message string in `origins/contracts/world.ts`). |
| **#1758** the merged plan comment (my client section C0-C6 is in Backend's edited comment 6045671672) | open (Lead's SCOPE PR) | client section **World, Pit & Audio**; server section **Duels & Backend**; sim section **Combat**; the doc **Lead** | Treat C0-C6 as the client backlog. Order: S1 -> S2 -> S3 (below). |
| **#1705** `expansion/wildlife-rows` @ddbc7b5a (ash wolf / boar / hound as `later` rows) | draft | **Characters & Art** (with Combat for the roster row) | Flip a row off `later` when its body lands: needs a `MOB_LOOKS` entry, a cited source (rows say `source: pending`), a registered loot table. |
| **S1 pre-warm + engage frame time** (preload the 3 fight chunks at idle, pre-build the stage for the nearest creature, measure max rAF dt at engage in WebKit on a real GPU) | **not started** (a local, empty branch `expansion/prewarm` existed; nothing pushed) | **World, Pit & Audio** | Build on Lead's live tick (#1749, `lead-catalogue/preview-zoom-wolf`). Measure the warm-up's own hitch too: it may only move the cost. |
| **Hostile flag** on creature rows + validator + golden; N attackers (attack-token cap 3, phone cap ~4-5 animated) | **not built** | **Combat** (sim, `pack` field, RV37) with **World, Pit & Audio** (engaged creatures always drawn, HUD pip per attacker, camera re-lock) | Data in `origins/mobs/row.ts` + `populate.ts` + `origins/world/zone-rules.ts`. |
| **Server world, saved location, economy gates** (TOP10 #1, #3, #6) | X1 merged #1593 (72289ca7), X2 stage 2 writer half merged #1596; migration `202610070009` is on trunk, **applied? not verified by me**; #1575 (X2 plan) open; S1 100-bot load test is Backend's | **Duels & Backend** | The X1/X2 tests were not re-run by me today. launch-gates.md X1 row is fixed in #1761. |
| **World's request: `zone.preset` per Frontier zone** (cinder-fields, black-mere, blood-ruin, ferry-landing; east-road, cinder-hold, mere-end stay `frontier-haze`) | not started | **World, Pit & Audio** (their own request; it is their look rows) | Set it in the zone data, then they delete `ZONE_ROWS`. |
| **Phone perf follow-ups**: governor + KTX2 loader (to #1709); Web's triangle inputs (shadow pass ~156k tris, two non-indexed Frontier stone meshes ~90k tris) | not started | **World, Pit & Audio** with Web (TOP10 #4) | Inputs are in Web's message on the thread; no fix written. |
| **Dropped items**: legends-rule additions (OUT: Shinto kami, Native American leaders, Bible demons, living-religion figures incl. Quranic jinn and Wendigo, real murderers, copyrighted modern characters, living national/indigenous heroes, active orders, worshipped deities; IN: yokai and folklore) and Isis -> Aset in `origins/patrons/patrons.data.ts` | dropped until the world fight was in; the rule text is in my memory file and the `legends-rule` skill | **Characters & Art** (names/backstories) | Suggestion, Lead to confirm. |
| **World design docs** (`docs/specs/origins/mobs.md`, region1, living-world, one-shard) | in the repo | **Lead** | Keep SCOPE.md and these in step with the one-world ruling. |

PRs already merged (no action): #1669, #1676, #1681, #1682, #1690, #1698, #1700, #1708 (world-fight record), #1709, #1593, #1596, #1579.

## 2. Where the world-client code is

- `origins/preview/main.ts`: walk loop, `startMobFight`, `worldMount`, the one per-page `worldHolder`, QA hooks `window.originsPreview` (pos, place, mobs(), tapMob, duel() incl. `gap`/`foe`, renderInfo, leave, fight).
- `origins/preview/mobs.ts`: placement; `spawnAmong` with `SPAWN_NEAR 25 / SPAWN_FAR 35 / SPAWN_WOLF [15, 25]` (Dom's spawn ruling, pinned in `mobs.test.ts`). `mobs-view.ts`: bodies (`WORLD_URLS` -> `/world/goblin.glb`, `/world/wolf.glb`), phone cap 4, fetch range. `pit-duel.ts`, `encounter-duel.ts`, `world-record.ts`, `hunt.ts`.
- `src/scene.ts`: `createScene(..., world?: WorldMount)` (the mount) and `dispose()`; its guarded forms are pinned in `tests/scene-world-mount.test.ts` (a new use of `world` there must be added to that list).
- Named pins: world duel chrome in `origins/preview/hint.test.ts`; spawn bounds in `origins/preview/mobs.test.ts`.

## 3. Rulings and standing rules in force

- Dom 2026-10-08: ONE world, a hostile flag, the world creature IS the fighter, N-vs-1, nothing pauses or swaps in at engage (SCOPE.md, #1758); then "MMO, thousands of players": the server runs creatures, aggro, movement and fights, the client renders and sends input. Option B (client predicts its own hero with the same deterministic sim and reconciles; reuse `src/net/rollback.ts`, `pvp.ts`, `transport.ts`, `backoff.ts`, `reconnect-policy.ts`) agreed by Backend, Combat and me; gated on a real-phone test at 150-200 ms (Backend builds the delayed link). Sharding by space vs one-shard.md layers is open with Dom via Lead/Strategy.
- Standing rules (Strategy via Lead): an experiment is preview-only (off-the-shelf rigged asset, no RV/migration/fold, no full stills until Dom graduates it); every new or resized body states measured on-screen height vs capsule (`originsPreview.mobs()` reports height); every Dom visual ruling gets a named test the same day.
- Repo: only the deploy session merges to trunk; other lanes open PRs and send shas. Reuse first ("Reused: <PR>" in PR bodies). Say "not on a real phone" for anything measured on the VPS (software GL, ~3 fps).

## 4. Measured facts (VPS Chromium unless stated; none is a real phone)

World at spawn ~340k tris / 64 calls (`?wolf`); the Pit duel adds ~20-30k in place. One-context: 2 live WebGL contexts after a leave on trunk, 1 with #1748; tap->ready on trunk 30 s cold then ~5 ms (stage reused), with #1748 22-27 s per fight (software GL). Alternating wolf/goblin x10 on the live bundle plateaus (wolf 119-120 / 186-188, goblin 146 / 249 geometries/textures). Field duel start gap 6.5 m at tick 0, same as the Pit. Client estimates for C0-C6 (~70-95 h) are mine and unmeasured. Backend's only measured server number is 0.023 ms per tick; Combat measured 16 us per 1v1 tick.

## 5. Gotchas

- The VPS harness scripts (`ctx`, `leak`, `pa`, `wf2`: contexts, memory, spawn, in-place duel) were in `/private/tmp/claude-501`; copies are in `docs/handover/expansion-harness/*.txt` (rename to run). The harness serves `artifacts/origins-preview` and MUST symlink `public/{game,weapons,arena,pit,looks,legends,shields,herolook,gear-ui,world}` or the page 404s its textures. VPS worktree: `/opt/frankendom-shadow/work/expansion/fightflow`; run long jobs detached (a long ssh drops).
- The Browser pane pauses the page when hidden (`document.hidden`); run browser series headless on the VPS.
- The Stop-hook gate runs on the session's own checkout: keep it fast-forwarded or it reports a stale failure. The one-deployer hook blocks local test runs while a deploy is in flight (run on the VPS). GitHub pushes sometimes return 500: retry on the exit status.
- `?worldfight` is default-off; a real-device read (WebKit, a real GPU) is owed before it is ever default-on.

## 6. My notes

Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-expansion/memory/` (`project_origins_lane.md`, newest at the bottom; `feedback_experiments_preview_only.md`). State doc: `docs/state/expansion.md` (newest entry from #1761). Both stay as read-only reference; do not write into that memory dir (it is the lane's).
