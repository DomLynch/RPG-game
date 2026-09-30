# The Pit — project state

## 2026-09-30 ~20:3x (+04) — HANDOFF before /clear (Dom: "save your work now"). READ FIRST, then memory `project_pit_handoff_0930h.md`, `project_pit_dom_phone_test_0930.md`, `project_pit_props_pr_0930g.md`

1. **LIVE 1be74bb3** (BF, Deploy 18:18; my curl). **#1172 GPT's props READY at 91d58e87** (CI 8 pass, un-drafted ~20:3x, FROZEN by Lead; Lead: the run after BG, with #1178). The rack at real scale on the left wall (my decision, Lead agreed); table, two sconces, bull skull from Stage.prop (`src/pit-prop.ts`, retried on a bare decode, reported to Sentry, null → bare spot); primitives removed; the helm caps the rack's post (1.81 m, measured from rack.glb). Receipts in the body: VPS tests/tsc/eslint/budget, Mac pit-browser-check PASS (memory flat 109/137/80, rack.glb-404 page), stills ref `stills/pit-props` 4d38612e, Lead stills PASS, Auditer PASS (P2-a/b fixed, P3-a/b/c taken, P3-d follow-up).
2. **Dom's phone test (18:15–18:23), Lead's ruling, three separate PRs off trunk after #1172, order 3 → 2 → 1:** (3) ~2 s black leaving the Pit; (2) camera +40 % / room +25 % with +30/40/50 stills for Strategy; (1) a baked arena still behind the gate (after World's stills).
3. **(3) root cause + WIP:** the black is the NEXT-RUNG RELOAD after a win (main.ts reset → `location.reload()`), not pit.ts leave(). Measured (Mac, trunk): WebKit's new document commits at 68 ms with a frame of luminance 1; first arena frame 1.6 s; Chromium holds the old frame (0 ms black), 11.9 s fight-ready at CPU ×4 + 4G. Lead GO on (a) fade the Pit to the gate's light and set a sessionStorage flag, (b) the fresh page paints the same light from its first paint (`public/gate-light.js`, a classic head script: the CSP allows no inline) until the arena's first frame, 8 s hard timeout, flag read once, storage errors = today's behaviour, (c) prefetch the next rung's rig (+ look off phone tier) from the Pit, bytes only. **Branch `pit/no-black` c2d41b50, pushed, NO PR yet**: all of (a)(b)(c) built with tests/gate-light.test.ts 6/6, tsc/eslint clean; row `scripts/pit-exit-check.mjs` (WebKit luminance across the reload, row 50) added. RED: one repo test on the trigger table ("a new row joins the rules its paths already hit, never a new first rule") — fix the placement first; the row has not run on the fixed build; Strategy's prefetch on/off table (3 runs each, Chromium throttled + WebKit local) not measured; Web not yet told the index.html/main.ts lines. Lead lifted the CI hold: open the PR when green.
4. **Sessions:** this lane clearing at ~20:3x. Lead [193542], Strategy [eb45ee], Deploy "Frankedom - Deploy Githib etc." [a52045], Auditer [222a2c], World [90e2f1], Web [e82901]. No crons.
5. **Gotchas:** run the whole `npm test` before calling a head ready; HF stills declined (a spend needs Dom's word in the Pit chat; no Playwright on the HF CPU Space); the Opus Stop-audit hook is over its weekly limit until Oct 5 (CI is the receipt); a stills receipt names its head.


## 2026-09-30 16:19 (+04) — HANDOFF before /clear (Dom: "save your work"). READ FIRST, then the 17:3x entry below, then memory `project_pit_handoff_0930f.md`, `project_pit_props_0930e.md`, `project_pit_ruling_d1_gate_tap.md`

1. **LIVE 3fab84c4** (my curl 16:19) = trunk with #1157 picker MERGED (11:31Z): the rack/trophies/gate tap sheet is live. #1151 dressing live since a578c62b. No run of mine in flight.
2. **Went live today:** the Pit's mood-board dressing (#1151, 14:29) and the tap picker (#1157, on the trunk now serving). Both from this lane.
3. **NOT LIVE:**
   - #1149 D2 gate trigger (`pit/gate-trigger` b158f66c, on trunk, un-drafted, CI 10 SUCCESS / 6 SKIPPED): waits on Deploy's run with Combat's #1144 (BA); ships #1144 → #1149 together.
   - #1160 PR B skull wall (`pit/skull-wall` 2a4b500e, on trunk, DRAFT, CI running 7 pending): GPT's four props mounted at real scale via `Stage.prop` (bull-skull, rack, sconce, table + skull; primitives removed), niche rim in the wall tone, look stills wait on `__pit.ready()`. World's #1162 skull merged in. Owed before un-draft: post the two rack-scale stills (VPS artifacts/pit/look-real and look-fit, logs /tmp/pit-look-2a4b500e.log, /tmp/pit-look-fit.log) for Lead's scale decision (my recommendation real scale), wall/gate stills for the rim, a marker re-shoot once Backend #1156 (`loot.defeats`, still OPEN) lands.
   - State doc PR #1142 (`pit/state-0930`) still open; Lead asked to merge it.
4. **Sessions down:** this lane only (clearing on Dom's word at ~16:2x).
5. **Rulings today:** none new this session; D1 = tap the lit gate, no button (Dom 14:44, memory `project_pit_ruling_d1_gate_tap.md`); no primitive skull anywhere (Lead, in #1160).
6. **QUEUE:** #1160 owed stills → Lead's eye → un-draft → READY. D1 as ONE PR on trunk the moment #1149 lands (button removed, lit gate, Web's cue, tests, stills lit-idle + tap-open). Then C racks (Web #1155 `Stage.openJournal(filter)`, rack wear == journal equip).
7. **No crons.** App worktree xenodochial-curran-b9e3c5 on `pit/skull-wall` (node_modules from frankendom-armour); scratch worktree for this doc under the session scratchpad (`state/`). VPS: work/pit (capture), work/pit-tests, work/pit-wall. Session refs: Lead [2d4d86], Strategy [03fae2], World [df6a8e], Deploy [e032ac], Auditer [ae267c]. Gotcha: fetch refs by name (the shared repo had corrupt stray `code-quality/vps-shadow-rows N` refs).

## 2026-09-30 ~17:3x (+04) — HANDOFF before self-clear (context past 400k). READ FIRST, then memory `project_pit_handoff_0930d.md`, `project_pit_ruling_d1_gate_tap.md`, `project_pit_rulings_0930.md`

- **NOW:** #1149 (pit/gate-trigger b158f66c, draft, on trunk) CI running after the harness fix; Lead un-drafts on green if this lane is down (told 17:2x); ships #1144 → #1149 in one run (BA). #1157 picker READY (00324392, un-drafted). #1160 PR B draft on pit/picker at 2a157a95. #1151 LIVE a578c62b.
- **Done today:** #1151 memory-row root cause + fix (Pit.ready = latest stock, ready-wait sampling, 10 s timeout, honest skip) → LIVE. #1157 picker (Stage.readTap, picker.ts boxes, sheet on tap) → READY. #1149: probe answered Lead (no-input kill screen = trunk); real bug fixed (door never hid on the walk: updateHud overwrote it; single assignment + test); §9 stills via a chunk-holding script (ref stills/pit-gate); harness fix (classList.toggle for the fade; the coordinator stub carries the pure helpers); trunk merged; op-id pin updated; 110/110 on the VPS. #1160 PR B: 100-slot wall from loot.defeats (defensive), niches + skulls as two instanced draws, SWAPPABLE props via SceneStage.prop() from public/pit/props/ (World's skull.glb IN at 2fec5299, 287 tris; bull-skull.glb to come, nothing drawn until it lands, #1151's primitive skull removed), carved cells (vertex colours), legend card on tap (GameStage.legend), wall pose; tests 32/32; stills refs stills/pit-wall (c18c7f4b) and stills/pit-wall-2 (7e8589cb). D1 ruling logged.
- **Open / owed:** #1160 re-shoot of the `wall` pose (look-flag now accepts it, 2a157a95) and a re-shoot with markers after Backend's #1156 (trunk's loader strips defeats until then; seed is in pit-look-stills); retarget #1160 after #1157 merges; bull-skull prop from World; #1162 closes as superseded. D1 (tap the lit gate, no button) as ONE PR on trunk once #1149 lands, ahead of C (racks, Web #1155 openJournal). Known: visit-1 warm-up delta in the memory row unattributed; door pill over the joystick while walking (Web follow-up, goes away with D1).
- **Gotchas:** stills receipts must name the git head; harness `until()` resolves with page time (0 = at once), never test its truthiness; `waitForFunction` never sees a CSS transition advance on the harness clock; the Pit chunk is prefetched at the kill, hold its request to see the line; `mergeGeometries([])` is null; the shared repo had corrupt stray refs `code-quality/vps-shadow-rows N` (Finder duplicates) that broke every fetch/merge, removed; the trunk workflows run only on PRs into trunk, and a retarget alone runs nothing (empty trigger commit). VPS checkouts: work/pit (capture), work/pit-tests, work/pit-wall; `PIT_MEMORY_ROW=skip` only with `PIT_GL=swiftshader`.
- **Sessions:** this lane's app worktree xenodochial-curran-b9e3c5 (node_modules from frankendom-armour) on pit/skull-wall; scratch git worktree for pit/gate-trigger under the session scratchpad. Lead [2d4d86], Strategy [03fae2], World [df6a8e], Deploy [e032ac], Auditer [ae267c]. No crons.

## 2026-09-30 ~15:5x (+04) — #1151 LIVE (a578c62b); PR A picker #1157 on trunk; PR B skull wall #1160; #1149 door bug fixed + §9 stills; D1 ruling (tap the lit gate)

- **LIVE a578c62b (Deploy 14:29, 49/49):** #1151 Dom's mood-board dressing. Its Mac gate found a real defect in the memory row's sampling, not a leak: the check sampled 1.5 s after open and loot.glb lands late on a busy box, so the visit's nine piece geometries first drew at a random visit (+9 on the Mac at load 15, visit 3; the same on the VPS). Fixed: `Pit.ready` = the room's LATEST stock (a re-entry restocks; Code Quality's F1), the `?debug` `__pit.open()` awaits it, the check samples after it + 3 frames every visit and fails loudly after 10 s; `PIT_MEMORY_ROW=skip` prints SKIPPED and needs `PIT_GL=swiftshader`. Mac rerun alone at 56688fb5: visits 2–10 flat at 105/131/80; visit 1 = 91/129/77 open, 100/129/77 closed (the warm-up delta is Known, unattributed). #1143 closed as merged with it.
- **#1157 (PR A, the picker, `pit/picker` 22d75de7):** retargeted to trunk and merged with it after #1151 landed. A press on the canvas under 8 px that lifts there is a tap (`Stage.readTap`, NDC, drained per frame); picker.ts casts the ray through world-space boxes beside the room's merged draws (no meshes); a pick opens that zone's sheet where he stands until he walks or taps the floor. Tests 4 + 24/24 Pit files. Owed: the rack-tap still (VPS run in flight), then READY.
- **#1160 (PR B, the skull wall, `pit/skull-wall` 8e930c84, base pit/picker):** 100 slots on the far wall's panels either side of the gate (one row per legend opponent, ranks outward, PORTRAIT_KEYS order via `SceneStage.legendKeys()`), niches + skulls as two instanced draws (room budget 20). `loot.defeats` (Backend #1156, not yet merged; trunk's loader strips the field until then) read defensively with tests. **The skull is a swappable asset:** `SceneStage.prop('skull')` from `public/pit/props/skull.glb` (World intakes GPT's model: one mesh, +Z, ≤ 3k tris, ≤ 300 KB, textures capped 512/256 by World's `budgetTextures`), a bone marker until it lands. Lead's ruling: no primitive skull anywhere → the bull skull over the chests rides `prop('bull-skull')` too (0.7 m) and draws nothing until it lands; #1151's procedural skull is removed by this PR. A tap on a slot opens the legend's card (`GameStage.legend(key)`: portrait, story, source; unbeaten = who waits). Tests 31/31 on the VPS. Owed: wall stills from the gate pose (queued on the VPS), Lead's eye; retarget after #1157.
- **#1149 (D2 gate trigger, `pit/gate-trigger` 791ab7a8):** Lead's product-bug question answered with a VPS probe (table in the body): the no-input kill screen matches trunk (opacity 1 within 1 s, the tour fades at 3 s); BUT the door never hid on the walk — `updateHud()` set `pitButton.hidden = !door` after the frame loop's `doorHidden`. Fixed 3e13efef: the hide/return is decided in updateHud (the one assignment), the loop records the move; gate tests 5/5. The four §9 stills are in the body (ref `stills/pit-gate` 15dd4169; `scripts/pit-gate-stills.mjs` holds the prefetched chunk by a route until the line still, then releases it), Lead ACCEPTED. Ship order #1144 → #1149, one run after AZ; CI on this branch only runs after the retarget (it is based on Combat's branch). Known: the door pill sits over the joystick ring while walking; Lead routed it to Web; it goes away with D1.
- **RULING (Dom 14:44 via Strategy, evidence 43fcebc4): D1 = tap the LIT GATE itself, no button.** Pit owns it: one PR on trunk after #1149 lands (ahead of C racks); `Stage.readTap` path (the 70 px gate-mouth tap already in #1149), the button removed, the gate lit (Web for the cue); reachable with the stick live, never from a drag; stills lit-idle + tap-open. Memory `project_pit_ruling_d1_gate_tap.md`.
- **Order agreed with Lead:** B now → D1 the moment #1149 is on trunk → C racks (Web #1155 `Stage.openJournal(filter)`).
- **Lessons (in memory):** a stills receipt must name the git head; the harness `until()` resolves with the page time it was met at (0 = at once), never test its truthiness; Playwright `waitForFunction` never sees a CSS transition advance while the harness clock stands, use `until()`; `mergeGeometries([])` is null.
- **Sessions:** app worktree xenodochial-curran-b9e3c5 (node_modules from frankendom-armour); VPS checkouts work/pit (capture), work/pit-tests, work/pit-wall. Session refs today: Lead [2d4d86], Strategy [03fae2], World [df6a8e], Deploy [e032ac], Auditer [ae267c], Finishers [d6a795], Web [97bec8], Backend [d04ce7]. No crons.

Lane opened 2026-09-29 18:4x +04 by Strategy on Dom's order ("lets move forwards … setup the new dev session … under the RPG game"), after Dom's design and a GPT review of Strategy's plan. Reports to Lead. Append new entries at the TOP with evidence and the remaining validation (AGENTS.md).

## 2026-09-30 ~13:4x (+04) — HANDOFF before /clear (Dom: "save your work"). READ FIRST, then memory `project_pit_handoff_0930c.md`, `project_pit_rulings_0930.md`, `reference_pit_interfaces.md`

- **#1151 (pit/d3-a 61fc4ccc, draft, on trunk 8af4c0c8):** the room's dressing is Dom's mood-board pick (Strategy's written spec, 12:1x): sand floor, wooden rack with red shield + gold laurel, sword, spear, iron helm on the shelf, one banner, bed + blanket + red throw, two iron-banded chests, table with jug and cup, bull skull, red rug, two low torches; the three trophies stand on the chests and the table (Lead's ruling 12:4x, in the body; Strategy may override → empty TROPHY_SPOTS). Fixed with tests on the way: the vault's strips were mirrored (a sawtooth, the clear colour through it — the pass-2 mocks Dom judged had this), no lunettes, smoke/dust geometries and the key's shadow map never disposed. Receipts: 22 Pit tests (VPS, d7c08273), 5 room tests (VPS, 61fc4ccc), tsc + eslint clean, Pit chunk 5,620 B gzip of 40,000 at c34e0e7d.
- **Stills of 61fc4ccc** (VPS SwiftShader, 375) are in `~/Desktop/Business/frankendom-shared/pit-d3a-stills-2026-09-30/look/`: rack, gate reviewed and pass; trophies re-shot after the skull's horns were rooted, NOT yet reviewed. To do: review, push as ref `stills/pit-d3a-2`, replace the body's table, send URLs to Lead and Strategy.
- **Mac slot (Lead):** me first after the AW deploy publishes (deploy 1e3a743 pre-empted the 12:25 slot; nothing of mine ran), then Finishers (ping "Mac free"), then AX: `pit-browser-check` on pit/d3-a (memory row + flow) and #1149's four §9 stills. On the GPU-less VPS the memory row steps once by 9 geometries at a random visit on trunk a570b54e as on the branch (12-visit probe stepped nowhere): `PIT_MEMORY_ROW=skip` there only; the row is the Mac gate's. READY for #1151 after that, Lead's eye on the stills and World's review.
- **#1149 (pit/gate-trigger 2eb411d0, draft, base combat/gate-walk):** on Combat's updated #1144 (1db4509d, MERGEABLE); tests/pit-gate.test.ts ran today for the first time, 4/4 (the arrival case gives the sheet a least document). Ship order: #1144 → this, one run, neither ships alone.
- **Queue after #1151 READY (Strategy GO 12:5x, Dom "ok yes agree, get it live", Lead APPROVED):** A picker (~0.25 d) → B skull wall (~1.5 d; Backend's #1156 `loot.defeats` of PORTRAIT_KEYS, silhouettes until it lands, defensive read + absent-case test) → C racks (~1 d; Web's #1155 `Stage.openJournal('weapons'|'armour')`, rack wear() through the journal's equip path with an equality test, no sim or record change). Each PR based on the previous branch; retarget to trunk and update from trunk after the previous merges, before READY, never earlier. Estimates stay between lanes; to Dom NOW + the blocking step.
- **Sessions:** app worktree xenodochial-curran-b9e3c5 on pit/d3-a (node_modules from frankendom-armour); a scratch worktree for pit/gate-trigger in the session scratchpad. No crons. Live at the clear: 7d44e261.

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
