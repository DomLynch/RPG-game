# The Pit — project state

Lane opened 2026-09-29 18:4x +04 by Strategy on Dom's order ("lets move forwards … setup the new dev session … under the RPG game"), after Dom's design and a GPT review of Strategy's plan. Reports to Lead. Append new entries at the TOP with evidence and the remaining validation (AGENTS.md).

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
