# The Pit — project state

Lane opened 2026-09-29 18:4x +04 by Strategy on Dom's order ("lets move forwards … setup the new dev session … under the RPG game"), after Dom's design and a GPT review of Strategy's plan. Reports to Lead. Append new entries at the TOP with evidence and the remaining validation (AGENTS.md).

## 2026-09-30 ~11:00 (+04) — HANDOFF before /clear (Dom: "save your work"). READ FIRST, then the entry below, then memory `project_pit_handoff_0930.md`

- **In flight, no PR yet:** the D2 build on branch `pit/gate-trigger` (c60c5993, stacked on Combat's #1144 `combat/gate-walk` b98a3d25): crossing trigger, tap pick, auto-walk, hold-at-gate, 1 s fade (`#pit-fade`), arrival at his pace (`enter(…, arrival)`), the door hide-on-move/return. tsc + eslint clean; `tests/pit-gate.test.ts` written, NOT run (the AU deploy a570b54 blocked suites). Next: run it, open a DRAFT PR with "Ship order: #1144 → this, one run, neither ships alone" (agreed with Combat and Lead), then the four §9 stills via the VPS queue.
- **D3 pass 2 stills** (VPS, SwiftShader) are home in `~/Desktop/Business/frankendom-shared/pit-d3-stills-2026-09-30/pass2/` (9 PNGs): not yet reviewed, not yet sent to Strategy. Branch `pit/d3-looks` 7f72d440. Strategy's second-pass asks are in memory.
- **READY:** #1136 (look control) at 511b6262, rides the run after AU. #1133 spec green. #1143 seam waits for a chosen style.
- **Ruling (Lead):** the Mac is a strict queue; my stills go via Auditer's VPS capture queue (recipe in memory). My 10:17 Mac run spoiled Hero Look's gate: never again.

## 2026-09-30 10:5x (+04) — Pit LIVE (#1118 + #1122 merged overnight, live e479ab2b); D2 spec, look control, D3 look mocks

1. **LIVE:** e479ab2b carries the Pit (`git merge-base --is-ancestor 9707389d e479ab2b`, my check 09:55). #1118 (`?look=pit`) and #1122 (the walkable Pit) merged 03:48 on quality green at 9707389d. Merged at #1122's close: Lead's three asks (boots material read: goblin.Boots' Wrap is mapless white, the rack now resolves a piece as `wear()` does via `rigMaterials`/`sourceMaterial`; plinths at z ±1.1 with a 3 m trophy pose; door stills win/loss) and Code Quality's P1 (op id before `enter()`) and P2 (a failed build gives the arena back, the room hidden). Stills: refs `stills/pit-room` (77e882a6), `stills/pit-room-2` (ac6e555e).
2. **Dom's live test (via Lead), three items:**
   - **D2 spec** — the gate is the way in: #1133 (docs, 9bf3cf77, CI green). Strategy ACCEPTED with two rulings folded in: the loss stays Recover → rack for the beta; the shortcut button hides as soon as the stick moves and returns after 3 s still. Split (Lead approved): Combat owns the post-kill walk + camera settle (starts after AU stills and #1111); the Pit owns the trigger, fade, hold-at-gate, arrival and the button hide/return. Nothing built yet.
   - **Look control** — #1136 (pit/look-control 511b6262): the arena's canvas drag turns the Pit camera round HIM (Lead's review point, done, with a full-turn framing test); pit-browser-check drags it. READY sent 10:5x on CI green; rides the run after AU.
   - **D3 look mocks** — branch pit/d3-looks 709f04a6, `?look=pit&style=a|b|c` (src/pit/styles.ts + room.ts reads the table; scripts/pit-style-stills.mjs). 9 stills at 375 from the 10:17 run in `~/Desktop/Business/frankendom-shared/pit-d3-stills-2026-09-30/`, sent to Strategy as files; b (cellar) and c (alcove) read as intended, a (under the arena) has an overexposed vault: torch toned down on the branch, re-shoot requested from Auditer's VPS queue. Stills only, no merge.
3. **RULING (Lead, 10:3x):** the Mac is a strict queue (Hero Look #1115 → AU deploy hold → Hero Look PD → Weapons → Finishers); my 10:17 stills run overlapped Hero Look's timing gate. My look-test stills go through Auditer's VPS capture queue from now on; a Mac slot only by asking Lead, at the end of the queue.
4. **Open:** the pit-door-stills first-run TimeoutError (step unlabelled) is an OPEN flake noted in #1122; `gate.go()` → one `nextFight()` is Code Quality's #1126 for after Thursday; the D2 build waits on Combat's PR.
5. **Sessions:** this lane in the app worktree xenodochial-curran-b9e3c5 (node_modules linked from frankendom-armour). No crons.

## 2026-09-29 21:5x — Look test ACCEPTED (Lead); PR3 up as draft #1122

- **#1118 (`?look=pit`):**
  - Box slot 21:34–21:39: tsc 0, eslint 0, 19 tests pass; pit chunk **2,654 B gz** (budget 40,000).
  - Rack and gate stills at 375 are in the PR body. Lead ACCEPTED them as the look test and sent them to Dom.
  - Preview dist handed to Deploy for /preview/pit/ (confirmation pending).
- **Lead's notes:** a white quad at the hero's left shoulder (to identify on the box); the gate read as a flat cream plane (fixed in PR3 as a stone passage); keep the trophy wall visible in a pose (`&pose=trophies`).
- **#1122 (PR3, draft, stacked on #1118):**
  - Enter the Pit / Recover in Web's slot (phone cluster −155/98; desktop row 2/col 1) and in the fade lists.
  - Walk with the fight's stick formula; the camera and sheet follow the zone.
  - Rack = the journal's own rows; trophies with legend + rank; gate = the kill screen's Next/Rematch.
  - Prefetch at the kill; pagehide frees the room.
  - Tests: the mover, and the frame hand-off before any fight work.
  - Box need ~25 min: flow stills, the 10-cycle memory row, the white quad.
- **node_modules:** this worktree links `~/Developer/frankendom-armour/node_modules` (same lockfile), which is untracked.

## 2026-09-29 21:xx — DOM: the Pit is BETA scope; PR2 (?look=pit) up as #1118

- **Ruling (Dom via Strategy, relayed by Lead):** build now, scope = note v1 only. Anything beyond the note is a one-line question to Lead.
- **#1108 (the seam):** merged on trunk ae1f9b47.
- **#1118 (the `?look=pit` look test):** up for CI.
  - Procedural room: 6 draws, 1 light, arena grade.
  - Rack and trophy pieces from loot.glb.
  - Rack and gate poses.
  - main.ts hands the whole frame to the Pit, so no fight update runs while it shows (Lead's condition).
- **ETAs sent to Lead** (estimates): PR2 CI-green ~1.5 h, box ~10 min; PR3 CI-green ~5–6 h after PR2's verdict, box ~25 min; PR4 CI-green ~2 h after PR3, box ~15 min.
- **Grade:** World is not online, so the default is the arena's colour-grade.ts; ask World when a session is up.

## 2026-09-29 — Design accepted; PR 1 (the seam) APPROVED on green CI

- **#1105 (this note):** Lead ACCEPTED it as the design.
  - (a) The Stage methods go in scene.ts; there is no new presentation file.
  - (b) Recover lands at the rack after a defeat.
  - The loss-screen Recover and win-screen Enter-the-Pit buttons are the only additions.
  - Ordering: the next opponent's look prefetch outranks the Pit prefetch (`prefetchPit(after)`).
- **#1108 (the seam, branch `pit/seam`):** Lead APPROVED it at b77e6dc1 on green CI. It rides the next code run after the beta queue items ahead of it and is not wired into main.ts. Its contents:
  - `scene.ts`: `setArenaVisible` hides every direct scene child except the lights and the player, and restores each one's exact visibility (`src/stage-hide.ts`, `tests/stage-hide.test.ts`). `hero.place(x, z, heading, speed m/s, dt)` with the sheathed pose.
  - `src/pit-coordinator.ts` and the `src/pit/` stub.
  - `tests/pit-boundary.test.ts`.
  - The `check-budget.mjs` PIT line (40 KB gz).
  - Lead's review point (1) (speed vs distance) was withdrawn after the evidence (`characters.ts:547,552`; the fight passes hypot/dt).
- **Condition for the coordinator PR (Lead):** while the Pit shows, main.ts must not run the fight-effect updates, because some of them set `.visible` every frame and would un-hide. Assert it in that PR's test.
- **Verification:** nothing was run locally (no node_modules in the app worktree; load 22; Lead: CI only). CI was still running on both heads when this was written.
- **Next:** the `?look=pit` look test on Lead's slot after the beta queue, then the coordinator wiring (PR 3).

## 2026-09-29 — Design note to Lead (docs/pit-design.md)

The design note is up for Lead as a docs PR: room layout, the sealed `src/pit/` + `pit-coordinator.ts` seam and the Stage object, the import-boundary test, the lazy chunk and its honest fallback, the handoff/memory rule (one renderer and scene, build once per page, hide between visits, Next reloads), the budget and what the look test shows. Measured on live 303af39e: entry 440,779 B gzip, souls-look chunk 6,597 B gzip. The budgets (pit chunk ≤ 40 KB gz, entry growth ≤ 2 KB, 0 new binary assets) are unmeasured until the first code PR. Remaining: Lead's answers to (a) where the Stage methods live and (b) Recover landing at the rack, then the look test on Lead's slot. No local build, test or browser run was done (Lead: design and reading only).

## Now — the brief, as of 2026-09-29 18:4x +04 (restart brief; replace wholesale)

**What the Pit is.** A small, torch-lit room under the arena. After a fight the arena gate grinds open; the player walks their own fighter through it (the same free movement as before tapping Fight; the fight camera stays locked during combat). One room, built once, phone first.

**Why it exists.** Stickiness. Every visit must hand the player a next decision: what to wear, whom to challenge, what to earn next. A beautiful empty room fails the brief.

**Three interactions, no more in v1.**
1. **Gear rack**: every piece the player owns, tap to wear, the fighter changes on the spot. Reuses the existing account data (`cloud-profile.ts` owned/equipped/provenance, `account.ts`); no new storage model.
2. **Trophy display**: a FEW chosen pieces shown physically, each with its provenance ("Taken from Leonidas, rank 7"). Never load every owned item.
3. **Next-fight gate**: back to the arena for the next opponent.

**Flow.** After a WIN: choose "enter the Pit" or "fight again" (fast players keep their loop). After a DEFEAT: back through a recovery entrance, not the victory gate.

**Architecture (same repo, sealed module).**
- Code lives in `src/pit/`. A small **coordinator** switches arena ↔ Pit and is the ONLY place that loads the Pit (dynamic import, its own chunk).
- The fight and sim (`duel.ts`, `moves.ts`, `ai.ts`, `main.ts` combat loop) never import from `src/pit/`. The Pit reads only a short, named list of shared interfaces (characters/look loading, account/profile, loot). Add a test that fails on any other import in either direction.
- **Lazy load with an honest fallback**: start downloading after the kill when the device is idle. On a slow connection the player stays in the arena with a clear loading indicator until the room is ready; never a frozen screen, and never promise "no loading".
- Zero change to fight feel, sim numbers or release rows. The Pit chunk gets its own size budget (state it in the first PR, measured).

**Out of v1, in order after it.**
- **Social presence trial**: other fighters standing in the Pit in their real gear, tap to inspect. It can be a small live room (positions only) tested on its own, independent of combat.
- **AI challenger**: fight an AI opponent wearing another player's saved gear. Label it as an AI challenger, NOT a recording of how they fight. Exhibition only (no marks or loot) until farming is ruled out.
- **Real PvP duels** are the Duel lane (`docs/state/duel.md`), a permanent build. The Pit gets a "challenge" spot that plugs into it when ready; the Pit never waits on it.

**Order.** The beta ships first as it is. The Pit lane starts with a LOOK TEST (a style flag and one still of the room on Dom's phone, via the look-test skill) and a design note; no Mac-heavy work without Lead's box slot (one heavy lane at a time, load < 15).

**Estimates are prototype estimates, not commitments.** Strategy's rough size for v1 (gate, walk-in, room, rack, trophies): ~1,000–1,200 game lines plus tests. The acceptance tests matter more than the line count.

**Acceptance for v1.**
- Win → gate opens → walk in → rack → wear a piece → gate → next fight, on a real phone, stills at 375 wide (visual-PR-stills rule).
- Defeat → recovery entrance works.
- Slow-network run: loading indicator shown, no freeze, no lost state.
- Import-boundary test green; fight release rows unchanged; the Pit chunk inside its stated budget.

**Owners.** Pit lane builds the module and coordinator; World advises on the room look/lighting; Web on the rack UI patterns; Backend only if a new server field is truly needed (default: none). Lead runs the order.

## Done
(nothing yet)

## Open
- Dom's call C: the Pit before launch or as the first update after launch (default: after the beta ships, per this brief).

## Gotchas
- The Mac is shared by ~20 sessions; iCloud Desktop sync stays ON (Dom); check load before any browser or Blender run.
