# Visuals & world — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).


## 2026-10-09 (+04, Mac clock) — HANDOFF #26 (new account restart): #1948 Zone 1 golden fixed, #1953 merged with it, #1952/#1958/#1954/#1957 reviewed, #1959 hero clips (draft)

### Now (verify with `gh pr view`)
- **#1948** `world/zone2-world` @696815a2c: Auditor HOLD (@0f1a019df) fixed. `frontierPlan` drops the landmark of a link the page does not walk (unless a kept link or a spawn stands on it); Zone 1 `frontierBuild` = 170 pieces / 57 solids, hashes acc9e948fd235ae5 / 70bce4a238048f1c, equal on the base 5eee9e6 (before the fix 171/58). Test `Zone 1 world is pinned` in origins/zones/loader.test.ts. VPS clean clone: 173/173 + tests tsc. Auditor re-review asked on the PR.
- **#1953** `char/ember-wolf` @cc068c9c6: merged the #1948 fix (not a rebase: its history holds merges of older #1948 heads); VPS 175/175 + tsc.
- **Reviews posted:** #1952 page side (F1: `spawnNet.tick()` never called, a long no-hit fight lets the 120 s token lapse, Backend's to fix; F2 glued comment); #1958 PASS (test-only); #1954 World OK to merge (Auditor's receipts, not re-run); #1957 stab: mechanics PASS, F1 the hero plays `Attack` for every move.
- **#1959** (draft, base combat/zone1-stab) `world/hero-clips` @566a01239: `onSwing(move)`, main.ts plays warrior.glb `Heavy` / `Kick`, else `Attack` (no thrust clip on the rig: ask Characters). VPS world-combat 10/10 + both tsc. 375 stills (before/after, boar+wolf, VPS software GL, 0 page errors) are posted on the PR but NOT decisive (heavy frame does not show the pose); still open: a frame-stepped clip and a browser run on a real engine.
- **#1959 CLOSED (Lead, 10-09):** Combat's S3 replaces it (clips from the Pit's own animation path).
- **Join mount (Lead, Proof 3): #1965 READY for the Auditor** `world/join-mount` @f4cf90c83 (merged #1960): `onEvent` hook, card = primary pair's foe (S2 `pairs`), hand-off test via a `hero().health` test seed; VPS 238 run / 237 pass / 0 fail + both tsc. WebKit+Chromium 375 still (2 scavengers hunting, 0 errors) in ~/Desktop/Business/frankendom-zone1-moves/join/. A REAL 3-joined still is not reachable in Zone 1 (max 2 drawn per cluster); #1962 closed (folded in). **#1969** `world/zone2-pack` @2bacb790b: Zone 2 wolf camp = 4 (campSize [2,4]) + a >=3-within-JOIN_M test, VPS 208/208; the real 3-joined clip waits for J live at /zone/2/ by the cairn; keep [2,4] if #1953 rewrites the row.
- **K (Lead, revised 10-09):** K4 = move src/hit-impact.ts + feedback sounds into src/fight/ driven by core events (after Combat's K2 head); K7 = Zone 2 full fight with zero combat code, data rows only, <300 lines, test-enforced. Both not started.
- **VPS disk:** was 298/301 G, 0 free at ~07:05 (+04); `df -h /` at ~07:20 read 119G used, 170G free, 42%. Stills ran on it after that. COO was told of the full reading, not yet of the recovery.
- **Next:** a frame-stepped clip for #1957/#1959 (the 300 ms stills are not decisive); the join mount waits for Combat's plan (Dom's ruling via Lead: mount on the shared Pit fight path, not world-combat.ts's copy); seamless row on /zone/2/ after J; mount/engage items from handoff #25 (S3 loadout/level, Frontier frame, session-report cherry-pick) were not touched today.

### Gotchas
- VPS clean clone for checks: /opt/frankendom-shadow/work/world-z2fix (remote set to https://github.com/DomLynch/RPG-game; `git fetch origin <branch>; checkout --detach FETCH_HEAD`; node_modules symlink to work/bn-trunk). The /opt repo's own origin points at itself.
- Heavy runs are hook-blocked on the Mac (a whole command is refused, including its edits): do edits first, run on the VPS.

## 2026-10-08 ~18:20 (+04, Mac clock) — HANDOFF #25: Zone 1 is detached from the Pit; World mounted Combat's open-world combat loop (draft #1875, receipts green on both engines); Handoff #24 (seamless, wolves, boar) lives on origin/world/state-1008 @5aacefe13

### Now (verify every state with `gh pr view`, none of this is a promise)
- **Direction (Dom via Strategy, 10-08 ~17:40):** the Pit is ON HOLD; Zone 1 gets its OWN continuous combat loop (no ring, no fight start/end, no FightRecord/seed/replay). Combat owns the pure step (`origins/combat/zone1.ts`, PRs #1874 S0 -> #1876 S1 guard/roll -> #1877 S2 heavy/kick/2v1, stacked on #1871 speeds.ts); **World owns the mount**. PARKED, do not rebase: #1865 prefetch (keep only the signed-out counter: `origins/preview/session-report.ts` + the `/_e/zone1-stale-session` beacon, Strategy wants a tiny cherry-pick PR), #1867 flee code (dropped), RV41.
- **#1875 (draft, base combat/zone1-loop, head `071c484d8`+)**: `origins/preview/world-combat.ts` (fixed 1/60 accumulator, creatures join inside AGGRO_M+3 and leave when home+far, `Evaded` releases, events -> procedural lunge/hit pulse/fall via `mobs-view` `drive()`/`within()`, bars, hit flash, kill -> `hunt.ts` loot + toast, hero death -> 2 s dim "You died" -> town `TOWN_RESPAWN {0,3}` (TODO World with Characters' town kit #1825/#1826)); `main.ts` wiring (press/tap = cut, hero 'Attack' clip, `?combat=pit` = old Pit path), `originsPreview.combat()/press()` for browser checks. VPS: 17/17 combat+mount tests, tsc + `tsc -p tsconfig.tests.json` clean. **Receipts (VPS software GL, 375x812, built dist)**: Chromium killed the bounty-shrine knight in 40 presses, WebKit in 61, 0 page errors; stills on branch `evidence/zone1-combat-s0` @b4e49fb1d; comment on #1875. NOT covered: hero death veil (the knight never killed him), Mac/iPhone, guard/roll/heavy/kick, Backend kill report. #1875 includes #1873 (S4 death + banner removal, standalone PR) and the two S4 commits.
- **Next, in order:** (1) mount Combat's S1/S2 (replace the Pit's `duel.worldStep` roll/guard in `step()`, add heavy/kick input + `Telegraph.move` clips: 'light_right' cut/bite, 'heavy_overhead', 'kick'; extra events Blocked/Dodged/Staggered{cause}; fighters carry posture/exhausted/phase guard|roll); (2) client for Backend's detached ops (all POST /origins/<op>, bearer, 503 until live Sat AM): `spawn_state{zone}` -> instances/alive/respawnAt/generation (poll 5-10 s; instance ids = my mobSpecs ids), `engage{character,instance}` -> token (one open per instance, max 4), `touch{token,hits}` every hit or <= 30 s (120 s life), `kill_report{token,hits}` -> loot/cp/bronze or 409/422/429; **no death op**; wire engage on the first hit, kill_report on `Died`, treat 503/refusals as unpaid; (3) cherry-pick `session-report.ts` into a tiny PR (Strategy); (4) PvP: step 0 others drawn = branch `world/others-drawn` (view + tests done, NOT wired to a Zone 1 presence frame: presence is the Concord frame and `pose` is withheld in region mode; Backend adds `tag {name,level,protected,standing}` to the frame, name/level/protected Sat 10-10, standing Sun 10-11) -> attack gate + safe-town volumes -> shield icon (protection ends at LEVEL 3) -> bounty board/skull later; PvP builds on this loop, never the Pit relay; (5) outlaw camp: I sent Characters the spot C = (-146,-72) in the Ferry Landing zone with a layout; they send anchors (asset PR ETA ~3-4 h); I place pieces by anchor name and add the red respawn at the fire.
- **UPDATE 18:40:** #1862 and #1859 MERGED. NEW PRs: **#1882** (draft) outlaw camp: Characters' caravan kit placed by name at C=(-146,-72) Ferry Landing turned H=atan2(14,22), anchors via `originsPreview.outlawCamp()`, `?camp=0` hides it, branch world/outlaw-camp @32684418, assets copied from #1879; **world/zone1-mount-s2** @dd6e9515a (draft PR, base combat/zone1-s2): Combat's S1/S2 mounted (guard/roll/heavy/kick from the loop, roll displacement applied with canStand), VPS tsc + 29/29 tests, NO browser run yet. **Strategy's S3 ask NOT done:** pass the player's Loadout into player(...) and each creature's level into creature(...) (Combat #1883 @a2838fe8e, S2b #1881 live lunge/charge/heavy). **Backend asked (Sat 12:00) for the Frontier frame**: I replied origin=Pit centre, bounds x[-330,+30] z[-210,+155], proposed wire shift (-340,-220) (u16 cm); the page then sends Frontier poses only while `frontier` is on once Backend confirms; Backend's server PR is #1880 (spawn_state/engage/touch/kill_report, on hold until the beta ledger, install Sat AM).
- **Zone 1 default entry (#1862 head `ab299591c` has an evidence/ dir in the PR tree that the Auditor wants moved), #1864 (stale-session refresh, STUB receipt posted, Auditor PASS pending quality + the ☰ -> /arena/ still which is Web's), #1859 wolves (head `0a625230c`, merge PASS posted, fold 21), #1873 S4 standalone** are with the Auditor/Lead.

### Done today (receipts on the PRs)
Zone 1 no-query default (#1862), session refresh via supabase-js `getSession()` with envDir proven in the built dist + 3 s cap + Sentry `zone1-stale-session-signed-out` (#1864/#1865), online prefetch design (#1865, parked), S4/death (#1873), the combat mount (#1875) incl. two real bugs found by live runs (loop only wired into the duel-drawing branch; a mid-line `//` comment broke the build and the VPS served a stale dist) and one real Combat bug (creature stopped 1 ulp short of its strike distance: fixed by Combat, fuzz-pinned).

### Gotchas
- VPS harness: scripts live in the VPS work dir `/opt/frankendom-shadow/work/world-zone1` (wc-run.mjs = full fight, wc-probe2.mjs = position probe, prefetch-run.mjs, s4-stills.mjs); build with `npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/wc-dist`, ALWAYS read the build output (a failure leaves a stale dist) and use `?region=1` (trunk only enables the region with it; my #1862 flips the default). Never `pkill -f '<script>'` inside an ssh command (kills the ssh); list pids and `kill <pid>` in a second call. Load 15-20 makes mobs take minutes to draw: wait timeouts 300 s.
- The deploy hold blocks Mac builds/suites; VPS is the evidence path. A `//` comment must never sit mid-line in main.ts. `git switch`/merge: use `git -c merge.autostash=false merge`.
- Tests: every `origins/**/*.test.ts` needs an import in a `tests/origins-*.test.ts` stub (`tests/origins-world-combat.test.ts` imports Combat's zone1 test, my world-combat test and speeds.test.ts until their own stubs merge).
- Hooks: the Stop reviewer wants a `[F1] fixed/rejected` line per finding and distrusts "fixed" without a passing run on the changed head; say "open" until the check passes.

## 2026-10-07 05:50 (+04, Mac clock) — research #18 (distance-scaled camera kick): CLOSED, "not needed on our camera"; the ?look=kickscale flag (#1561) is REMOVED

- **Do not re-run this.** The lock camera sits 4.96-7.2 m from the fight (median 5.38 m over 1221 frames of a scripted Veteran fight) and its distance does not follow fighter separation (1.0 m and 1.6 m strikes: 5.27 and 5.47 m). At the 10 real-fight hits the camera distance was 4.97-5.49 m (median 5.39), so a compensation that holds the kick's screen size is a factor of 0.93-1.02 (span 9.6%, p10-p90 5.06-5.49): below Strategy's ~10% bar. The 0.94-1.34 over all frames is retreats, not hits.
- #1561's 3.5 m reference was wrong (it made every kick ~40% bigger); it was live but flag-off, so no player ever saw it. This PR removes the flag, its module and tests; no player change.
- Roll tilt: peak tilt 6.77 deg flag off, 6.81 with the scale: the angle is not scaled by design and stays equal. The roll's shift could not be isolated (the camera follows the rolling hero, ~8 m of travel).
- A separation-scaled variant (`?look=kickscale-sep`, scale = fighter separation / 1.25 m logged median, clamp 0.7-1.6, changes feel not compensation) was built in the closed PR #1583 (`world/kickscale-sep`); rebuild from there if Strategy wants it as a look test.
- Evidence: ~/Desktop/Business/frankendom-kickscale/result3.json (dummy-opponent harness on the VPS, scratch: ks-dummy.mjs in /private/tmp/claude-501/bloodside).

## 2026-10-04 ~22:xx (+04) — HANDOFF #7 before /clear. READ FIRST (supersedes handoff #6 where it differs)

### Now
- **Camera A/B/C clips for Dom (Strategy request 10-05, look only, NO PR):** the same fight filmed at 375 wide with A = camera.ts from 196ee4df^ (locked: back max(4.2,d*0.62+2.8), y max(3.2,d*1.3)), B = trunk 4056467a camera, C = halfway (back max(4.4,d*0.685+2.9), y = average of A's and B's y). Scenes: Veteran full exchange, Goblin knife close strike, Executioner slash close strike; only src/camera.ts differs, the arena stays current. A background agent (a4efc8348597f04e6, scratch worktree /private/tmp/claude-501/camera-angles/wt, VPS work dir /opt/frankendom-shadow/work/camera-angles via `capture world`) was filming when I was cleared. **First act of the next session:** look in ~/Desktop/Business/frankendom-camera-angles/ (scene-*-sidebyside.mp4, stills-A/B/C.jpg, clips/); if the files are there and the agent's report says what it saw, send Strategy (name 'Frankendom - Strategy (advisor)') the paths plus one line per option: backdrop visible yes/no, enemy blade visible yes/no (judge from frames you open yourself). If nothing is there, check `capture --status` and /opt/frankendom-shadow/work/camera-angles on the VPS, rerun, then clean up the VPS worktree.
- PR #1372 (Pit walls) is the other open item: see the entry below.

- **PR #1372 is OPEN: the Pit walls** (`world/skull-wall` @f19bd17e, base trunk 4056467a; CI was pending when I left). Lead's brief: docs/briefs/pit-walls/BRIEF.md (on lead/pit-ship). It has: skull wall right of the arch (6x5, latest 30 kills), carved record board left of the arch, trophy rack = best 4 pieces (tier, then ladder place), wall of champions on the back fence (daily_board_summary), clay-floor fix (glow/cage always Arena 1 sand), `&skulls=demo` seed, `__pit.tap(id)`/`__pit.sheet()` debug hooks. Stills: evidence/world-pit-walls (stills/pit-walls) and ~/Desktop/Business/frankendom-pit-walls/. Next: watch #1372 CI (Auto-fix offered to Dom), Lead/Auditor review, Lead asks Deploy for /preview/pit-cage/ from my head (4fbea1c7 was published earlier; the polish needs a republish).
- Data layer reads Backend's RPCs (#1366 @69b5c29d, NOT applied to production yet): `pit_recent_kills()`, `pit_record()`; loot fallback for guests/pre-migration (every taken/declined/defeats entry is a kill, newest by day). Dom's real profile therefore shows his ~30 loot-derived kills until the migration is applied.

### Done today (10-04)
- Pit wall blood in #1370 (merged 4056467a): generated decals (scripts/pit-blood-decals.py, numpy+PIL on the VPS) after Dynamic Paint baked blank; GPT strip crops lost the side-by-side.
- Skull wall rework x3 (two panels -> one wall of kills), record board, rack, champions, clay floor, polish (contrast helper, nails), all in #1372. Built mostly by subagents inside this worktree, reviewed by me.

### Open
- Tap raycast itself is covered by tests/pit-picker, not by the browser tap test (the debug hook skips the ray). Phone `?perf=1` not measured. Known nit: one knot ring grazes 'Vale' on the champions board. The rack still shows nothing in the look stills (no loot).
- Old branches left alone: world/pit-blood, world/pit-blood-cage, lead/pit-look (cell comparison link only).

### Gotchas
- **Dynamic Paint in headless Blender 5.2.2 baked blank** (mesh, vertex, particle brushes): do not retry.
- Render on the VPS: work copy `/opt/frankendom-shadow/work/world-cage` is a git worktree of /opt/frankendom-shadow/repo (`git -c safe.directory='*' fetch origin <branch>; checkout --detach`), node_modules symlinked; scripts in /opt/frankendom-shadow/work/world-blood (run3.sh/run4.sh, shot-skulls.mjs for poses, tap.mjs for the tap test), submitted with `CAPTURE_WAIT_S=28800 setsid -f /opt/frankendom-shadow/bin/capture world ./run4.sh`, poll a DONE file. NEVER rsync src/ or public/ from the Mac (754 MB). The Mac is shared and was at load ~50: local SwiftShader times out.
- zsh: `$VAR` ssh options do not word-split (use wrapper scripts); macOS `sed -i ''`; a failing `rm -f glob` aborts a `&&` chain.
- At the cage gate pose the camera sees only ~1.5 m of wall each side of the arch: use `&pose=wall|board|champions` stills (look stills have no GameStage; the demo hooks are added in showPitLook only for `&skulls=demo`).
- The Stop hook runs the targeted gate and the sparring browser check on whatever is in the tree: a subagent editing src/ concurrently breaks it (page reload mid-check); run the check in an isolated `git worktree` of the committed head (node_modules symlinked) instead.
- main.ts must not import src/pit/ (pit-boundary test): reach pit code through src/pit-coordinator.ts.

## 2026-10-03 — Owner rejected both image arena trials; restore default
- Removed both trial modules, two image assets/provenance, Stage options, scene/camera adapters, and trial-only tests/browser workflow/gate rows. Production main/scene/index and original50 release rows restored byte-for-byte to pre-trial950db85c; native arena/camera/characters/combat/sim unchanged.
- Existing Sparring workflow gains no-write checks for original Stage choices and retired trial URL/tab-storage fallback to the default camera. No new production framework or runtime dependency.
- Source530/530, completion34/34, app types and native Sparring/old-link/storage fallback PASS (source runner exit0, errors[]); independent Auditer review, sole Deploy Mac Metal qualification/publication and live default/Gear/Pit verification pending; previous evidence retained in ignored artifacts/Git history. No live cleanup claim yet.

## 2026-10-01 ~18:3x (+04) — HANDOFF #5 before /clear. READ FIRST, then handoff #4 below (still true except where this says otherwise)

### Now
- **Nothing in flight for World.** The Charge (Centurion rank 9, Alexander) is DELIVERED and parked; Strategy/Lead were not running when it finished, so the v5 message was NOT sent: **first act of the next session: send them the v5 paths** (below) via ListAgents names (Strategy Dev, Lead Developer; check who is up).
- v5 files (Mac, 375 camera, hooves muxed, real ArmedRun): `~/Desktop/Business/frankendom-the-charge/charge-v5-day-blood-sand.mp4`, `charge-v5-night-pit.mp4`, `charge-v5-still-sheet.jpg` (v1..v4 beside them). Dom's last ruling on v4: he wants the real armed run; v5 is that.

### Done today (10-01)
- **#1202 Pit stone default MERGED** (08:30Z, head fcc36895; test-215 timeout fix, trunk merge, graphics-harness stub for `pitStoneFrom`). **#1192 Pit extra pack MERGED** (07:11Z).
- **Specials seam:** surveyed (every special descends from #1120; trunk has NO special sim, so an "inert seam alone" was refused by Lead). Landed on #1120 by Finishers: my `advanceCast(..., is)` commit (6b3f2711) and the **travel hook** `SpecialMode.travel?(side, fighters)` + pure `gait()` helper (bc45f395, now inside #1120 8c371bd3), tested both ways (no travel = sim speed and pose untouched; scene.ts names no special id).
- **The Charge:** `world/centurion-charge-u` @ 9af370f7 = ONE commit on #1120 8c371bd3: src/charge-fx.ts, src/charge-timing.ts (slideAt/chargeGait: the body slide and the gait share ONE clock), SPECIAL_MODES.centurion + `centurion` SPECIAL_TESTS row, tests/charge-fx.test.ts (10), scripts/charge-clip.mjs. scene.ts untouched. Local: charge-fx 10/10, special-fx 8/8, special-look 4/4, specials 8/8, graphics 91/91. Preview clips built from `world/centurion-charge-v5c` @ 7d5d49cc = charge-u + Character Main's #1224 files (9878c328: veteran.glb, build-armed-run.mjs, characters.ts ArmedRun; preview-only, NOT for trunk). v5 captured from the equivalent v5b tree (differs only in scripts/special-clip.mjs).
- Charge design as built: low knee-height dust line, a hoof puff per stride with a shadowed underside, ONE clay-toned burst at the foe's feet, clears in ~0.5 s; he eases back 2 m over 18 ticks, then runs the front (4 m/s through the travel hook, above #1224's 3.2 ArmedRun threshold) for 24 ticks, then the sim's strike pose; Audio's hooves cue (#1216 charge.m4a, 1.2 s, arrive at 0.95 s) seam = CUE_AT = LAND_AT - 57 ticks, once per cast (`cue` callback on createChargeFx; the scene does not call it yet, #1216 is dormant). Clips mux the m4a at (windup frame + 62)/60 s.

### Open
- **#1186 Nyx Nightfall** (world/nyx-nightfall @3fb3eebd, OPEN, base finishers/hades-shadow-claw-fx): look FINAL (Dom). It must be re-based onto #1120's NEW head (8c371bd3, now with the registry src/special-modes.ts) as ONE SPECIAL_MODES entry (`nyx`) + SPECIAL_TESTS row, scene.ts untouched (a test pins that it names no special id), before it goes anywhere. Not started.
- The Charge: nobody has asked for a PR yet (preview-only, waits on Dom/Strategy; #1114 sim + #1120 land after Saturday, then each special rebases onto trunk). Audio's cue wiring waits on #1216.
- Old branches left alone: world/centurion-charge @ 65a4808c (stacked on nyx), -r, -m, -t, -v5, -v5b: superseded by -u / -v5c; delete when Lead says.

### Gotchas
- **VPS capture:** the lock (`/opt/frankendom-shadow/bin/capture`) is now FIRST COME FIRST SERVED (Auditer v2.3). Submit ONE job for both arenas under one lock hold and `CAPTURE_WAIT_S=28800`: separate jobs each timed out at 3600 s while others took the lock (old flock was unordered). A job that dies within seconds with "Terminated" = the queue-file permission bug (fixed in v2.3): resubmit. Detach with `setsid -f`; never `pkill -f` a pattern that matches your own ssh (use `[x]yz`).
- Work copy `/opt/frankendom-shadow/work/world-extra` (rsync src/scripts/public/package.json from the worktree, NO --delete; `npx vite build --outDir dist-X`; `node scripts/charge-clip.mjs --special centurion --dist dist-X --arena c|a --pre 60 --post 90`); scripts `run*.sh`/`both.sh` there are mine. Frame mapping: windupFrameInClip + 119 = the landing frame; the cue at +62.
- The rig has no distinct Run clip: Run/Jog alias Walk (`Trident_Walk`). #1224 adds `ArmedRun` for the veteran only (played above 3.2 m/s for a one-hand weapon). Without #1224 the same hook plays the armed-walk cycle at speed.
- A mode's `held()` can pose the caster, `extra()` passes more render args (anchors), `at` picks feet or heads, `lift` the foe's knee-dip; a mode with no `travel` leaves the sim speed alone. The rig anchor (`warriors.*.anchor`) is a presentation offset reset every frame in characters.ts: offset it AFTER the rig update and it never touches the sim.
- A sprite that is sand-coloured on pale sand is invisible at 375: day dust needs a darker tan-brown with a deep underside; a fx whose line starts 3.2 m behind the caster runs off the top of the phone screen (2.0 m is on screen).
- While a deploy holds the Mac the hook blocks `node --test` of some files; `node tests/<file>.test.ts` (direct) ran. Lead/Strategy are sometimes not running: check ListAgents before messaging, and use the ref `[xxxxxx]` when two sessions share a name.

## 2026-10-01 ~10:3x (+04) — HANDOFF #4 before /clear. READ FIRST, then handoff #3 below (still true except where this says otherwise)

### Now
- **#1202 Pit stone default** (world/pit-stone-default @4e96966f, DRAFT, base trunk 0895d84c): Dom's ruling (via Strategy): `pit-stone-full` (GPT stone + AO + wall damp + torch soot) is the Pit's default. Web's `web/pit-stone-c59` merged in
  (3 small conflicts), `pitStoneFrom()` defaults to `stone-full` (live Pit + `?look=pit`), `?look=pit-plain` = the old room for before-stills. Needs: **Auditer review**, then READY. Body carries the sheet (evidence/world-pit-stone-default @f868a58),
  receipt (11 maps 12.67 MiB GPU vs GPT set 8.0, +4.67; lands 111 ms / 457 ms at 4x throttle) and the honest gap: **phone `?perf=1` NOT measured** (needs Dom's phone on a /preview/; if frames drop, back to Dom before READY) and full vs GPT set is subtle (~1% luminance).
  Pit's PR-A (`pit/gate-lift`) also edits room.ts: whichever lands second resolves a small conflict.
- **#1186 Nyx "Nightfall"** (world/nyx-nightfall @3fb3eebd, OPEN, base `finishers/hades-shadow-claw-fx` = #1120): look LOCKED as shot and now FINAL (Dom: "this is good, I like it"; keeps it as is). Auditer PASS at 95fbc66f; re-pass at 3fb3eebd (rebase onto #1120 d6ae070d + stuck-cast ease) was
  requested, not yet seen. CI cannot run until retargeted to trunk (the quality workflow only fires on PRs to trunk): retarget after #1120/#1114 land. Rebase onto Finishers' v3 of special-fx if it lands (Dom cut the claw; I use only advanceCast/Cast/LAND_AT).
- **Nyx tweak pass: CANCELLED (Strategy 10-01: Dom keeps Nightfall and all three specials as is, no sprite tweak pass).** Nothing to do. (GPT's veil sprites are at ~/Desktop/Business/artifacts/frankendom-eight-art-jobs-20260930/02-special-sprites/nyx-nightfall/ if it is ever reopened; known notes: Night Pit veil weak, target faint at peak dark: RIM_NET, `veilTexture`.)
- **#1192 Pit extra pack** (READY, un-drafted by Lead's order, @6955ce06, green, Auditer PASS): gate-machinery + water-bucket + whetstone-wheel in `public/pit/extra/` (316,984 of 1,000,000 B gz), own check-budget row, extra/ off the eager sums. Goes in Lead's next run.
  Returned to GPT (Strategy's brief, Job 0): coal brazier (iron + glowing embers), straw bedding (reads as a slab), broken weapons (must read as weapons, in frame), chained manacles (thicker chain, wall plate that reads at 375). When they return: intake again with the same pipeline.
  Pit consumer PR (not mine) must load extra/ after `ready` and NOT through prop() (first-mesh loader drops 8 of the machinery's 9 nodes).
- Standing: **no ZeroGPU/HF call without Dom's named approval per set** (the $16.12 bill was GPT/Codex's TRELLIS). I used none.

### Done today (09-30 evening -> 10-01)
- #1175 arena stills and #1173 gate + chests merged and live (c3714f78). **#1196 arena stills cropped to 496 x 608 for the narrowed gate (plane 2.2 x 2.7 m) MERGED.** Pit wires them behind the gate after PR-A.
- Nyx Nightfall built, two clips (Blood Sand, Night Pit) + sheets sent, PR #1186; perf on VPS SwiftShader hades vs nyx identical (3 fps both): no measurable cost.
- Intake #3 (#1192) and the stone default (#1202) as above; Pit stone comparison paths sent to Strategy (stills/pit-stone-6 @6b676376, sheet-gate-375.png / sheet-trophies-375.png, Mac copy in `stills-pit-stone-6/`, untracked).

### Open
- Auditer: #1186 re-pass at 3fb3eebd, #1202 first review. Dom: phone `?perf=1` read on a /preview/ with the stone default. Lead: #1192 in the next run; retarget #1186 after the specials stack lands.
- #1176 (audio gate winch) / Pit PR-A / GPT returns are others' or incoming.

### Gotchas
- **VPS recipes (Mac is under the deploy hold; the hook blocks test suites/builds on the Mac while a deploy is in flight):** work copy `/opt/frankendom-shadow/work/world-extra` (hardlink-copy of /opt/frankendom-shadow/repo for src/public/tests/scripts, node_modules symlink, `rsync -a --checksum --delete --exclude assets/source` from the worktree);
  every browser/stills job through `/opt/frankendom-shadow/bin/capture world <cmd>` (one capture at a time, flock FIFO is NOT guaranteed; check `capture --status`). Frame-stepped clips: `scripts/nyx-nightfall-clip.mjs` (two-pass, fake clock, `scripts/lib/harness-clock.mjs`).
- Never `rsync --delete` a dir that holds your own scratch scripts (I deleted my perf script that way); never `pkill -f` a pattern that matches your own ssh command (use `[x]yz` brackets). In zsh a `$VAR` holding "ssh -o ..." does not word-split: use a wrapper script (`v.sh`).
- A trailing `//` comment appended to a `const A = ..., B = ...;` line swallows the rest of the line (it broke check-budget once); put comments on their own line.
- gzip size depends on the zlib: `gzip -9` CLI, Node `gzipSync` on the Mac and on the VPS give different per-file sizes (gate.glb 270,647 / 270,699 / 273,156). check-budget's own reading is the one that counts; the eager `pit/` "moved" only because of the measurer (md5-identical files).
- WebP size parsing: Chromium's encoder writes VP8X + ICCP + VP8; `sharp` writes a bare VP8 chunk (width/height 14-bit at bytes 26-29). tests/pit-arena-stills.test.ts reads both.
- Vite dev: a page `import('/node_modules/three/examples/...')` is served raw (bare `three` import fails); import a project module under /scripts/lib/ instead (vite rewrites it) and put the loader's deps in `optimizeDeps.include`, or vite reloads the page mid-run.
- Lead's flow: draft PRs wait for the Auditer; CI does not fire on un-draft/retarget (close + reopen races cancel-on-close); a push after an Auditer PASS needs a new Auditer line unless Lead orders the rebase push.

## 2026-09-30 19:1x (+04) — HANDOFF #3 before /clear. READ FIRST, then the 16:20 entry below (still true except where this says otherwise)

### Now
- **HOLD (Lead):** GitHub's CI queue is reserved for run BG (#1172, #1148, #1173) until Lead posts "BG green". Push nothing but #1173 until then.
  This entry is committed LOCALLY on docs/world-state-0930b and NOT pushed: push it and open its docs PR after "BG green".
- **#1173 Pit intake #2** (world/pit-intake-2 @ 5455bbbdea09, off trunk c59d4a46): CI green (8 success, 4 skipped), un-drafted, full sha sent to Lead.
  Deploy merges it in run BG. Nothing more from World unless CI or Lead says otherwise.
- **#1175 Pit arena stills** (world/pit-arena-stills @ 7f7b49be, DRAFT, base world/pit-intake-2): waits for #1173 to land. Then `gh pr edit 1175
  --base codex/01a09a76/task-1` and tell Lead, who dispatches its CI. Lead accepted: the plane is a texture on a MeshBasicMaterial (fog:false, sRGB), no GLB.

### Done today (after 16:20)
- #1163 GPT Pit intake is merged and LIVE (c59d4a46; I curled it: #1163's merge bb13dcf0 is in it, pit stone webp 200).
- **#1173:** GPT's gate (SPLIT into `gate-arch` static + `gate-bars` one movable node, origin at the bars' base [0, 0.035, -0.0282]) and chest-a / chest-b.
  Split by geometry in scripts/pit-gate-split.mjs (52 disjoint pieces; iron < 0.2 m deep): 2,484 + 1,276 = 3,760 tris, checked vertex by vertex
  against the source (0 missing, 0 extra). Pack cap 1.2 → 1.4 MB gzip (Lead + Strategy): the 7 props are 1,360,159 B. Stills: evidence/world-pit-gate @ de13a2d2.
- **#1175:** five 512 x 608 WebP stills (public/pit/arena/{1,a,b,c,d}.webp), 136,472 B gzip, shot from 0.3 m inside the gate at 1.62 m by scripts/pit-arena-stills.mjs.
  pit/ total 2,217,837 of 2,500,000. Stills: evidence/world-pit-arena-stills @ 0920501a.
- Reviewed Web's stone stills (stills/pit-stone-6): GPT default PASS, procedural + flagstone FAIL, -full only after a phone ?perf=1 (Lead accepted, to Dom as written).

### Open
- Dom's pick on the stone default (GPT vs -full) and its `?perf=1` reading on the phone (Strategy's bar p50 >= 30, p5 >= 20).
- The Pit swaps its code bars for the GLB gate (uniform scale only: 1.22 fits the 2.2 m width, 1.15 the 2.7 m height; picks with a 375 still), wires the arena plane and the chests.
  The Pit and Web own that. World only answers questions.
- GPT's rack, table, sconce, bull-skull are live; the skull is World's (pit/skull-wall, not on trunk from World).

### Gotchas
- Mac work is under Lead's holds (disk, load, quiet windows): do intake, stills and Blender on the VPS (/opt/frankendom-shadow/work/world-intake2 with @gltf-transform + sharp via
  the world-tools node_modules symlink; /opt/frankendom-shadow/work/world-arena-stills for the arena stills, which needs src/ + src/assets/arena/props/*.glb and `configFile: false`).
  ssh needs `-i ~/.ssh/binance_futures_tool`; in zsh a `$VAR` holding "ssh -o ..." does not word-split: use a small wrapper script.
- Chromium's canvas `toDataURL('image/webp')` writes VP8X + ICCP (456 B) + a lossy VP8 chunk: parse width/height from VP8X, not the VP8 chunk.
- The arena's portcullis and its procedural gate bars stand 0.45 m inside the wall: a camera outside or in the gateway sees only black iron.
- A JSON-level test can check a meshopt-compressed GLB without a decoder: node tree, accessor counts and min/max, all are in the JSON chunk.
- A 40 MB dist total was raised to 44 MB (Lead 09-25, #705's carriers): the pit/ 2.5 MB total is the hard line, cut map sizes before any cap.

## 2026-09-30 16:20 (+04) — HANDOFF #2 before /clear. READ FIRST, then the 15:56 entry below (still true except where this says otherwise)

### Live
- LIVE 3fab84c4 (release.json, own curl 16:16). Nothing of World's is live today.

### Changed since 15:56
- **#1163 GPT Pit intake: CI `quality` FAILED at 36fd0010.** tests/child-process-bounds.test.ts: scripts/pit-ship.mjs had one
  execFileSync with no timeout. Fixed: `timeout: 300_000` on the gltf-transform call, pushed **aa51a5e1** on world/pit-intake. Local
  `node --test tests/child-process-bounds.test.ts` 1 pass / 0 fail. CI on aa51a5e1 was not yet read at handoff.
- **#1162 (skull v2) is MERGED into pit/skull-wall** (Dom, 12:03Z). It ships with the Pit's #1160; nothing more for World to do on the PR.
- GPT stone PASS as the default (stills/pit-stone-5 @dde33046, code f3065592). Weakness: the walls are too clean and bright.

### Queue
1. Read #1163 CI on aa51a5e1. Green → tell Lead (Deploy merges). Red → fix on world/pit-intake.
2. Judge Web's variant (GPT stone + AO + wall damp mask + torch soot) when Web posts the stills. PASS/FAIL goes to Lead first.
3. The Pit's niche-rim fix lands → re-shoot the gate still on the VPS → Lead.
4. GPT's gate + chest-a/chest-b land → intake as in the 15:56 entry (pit-ship.mjs → pit-meshopt-filter.mjs → checker → browser load → PR).

## 2026-09-30 15:56 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-27 afternoon entry, then memory

### Live
- LIVE 3fab84c4 (release.json, own curl 15:56). #1159 (Code Quality's PIT_ASSETS gate: bytes + triangle caps for public/pit/) is merged and in live.
- Nothing of World's went live today; everything below is open.

### Open (World's)
- **#1163 GPT Pit intake** (world/pit-intake @36fd0010, base trunk, NOT draft). Four props (public/pit/props/bull-skull, rack, table, sconce .glb) +
  wall/vault/floor stone (public/pit/stone/*.webp, 512², GL normals, tiles 2/2/3 m) + sources in docs/character-references/pit/ (donor GLBs left
  out; GPT keeps them on HF). pit/ = 1.64 MB gzip (cap 2.5). Browser load on the VPS passed. **CI was running at 15:56 (2 pass, 8 queued); report green
  to Lead.** The body carries Lead's rack-scale ruling for the Pit: 4.5 m wide rack, uniform scale only, the Pit picks with a 375 still.
- **#1162 grittier wall skull** (world/pit-skull @4425a262, base pit/skull-wall, DRAFT). v1 skull already cherry-picked by the Pit (2fec5299).
  Lead passed v2 (stills/pit-skull-2 @7cd69a29). It ships with the Pit's #1160, which waits on Backend's #1156 (defeats), and on the Pit fixing its
  niche rims (white "picture frames", Lead's comment on #1160). Re-shoot the gate still when the Pit pushes that fix.
- **#1033** phone crowd/props: shelved draft (the Low Power Mode false alarm). Leave it.

### Reviews done today (verdicts to Lead first)
- Web's ?look=pit-stone: PASS 94b667b2 → polish HOLD (voussoirs pasted) → PASS at stills/pit-stone-4 @a3c3a6b4 (code 24f02b8f, plain lintel + chamfer).
  Open notes, non-blocking: soot fan not visible, faint vault ribs, vault segment seams.

### Rulings (memory: frankendom_world_pit_stone_review_2026-09-30.md)
- Pit asset caps (Lead, on World's measurement): GLB ≤300 KB, props ≤1.2 MB, map ≤150 KB, maps ≤1.2 MB, pit/ ≤2.5 MB phone; desktop/ 1024 maps
  ≤600 KB each, ≤4.8 MB (only if 512 stone is visibly soft on desktop). Tris: skull 400 (×100 instanced), bull-skull 3k, sconce 1.5k, rack 3.5k,
  gate 6k, chest* + table 5k. Ship path public/pit/{props,stone,desktop}/. Name files to the caps (chest-a/chest-b, never chests.glb).
- The wall skull is a HUMAN skull, World-built (scripts/pit-skull.mjs, procedural, no licence).
- Gate + both chests: GPT makes them (Dom). The Armour message was CANCELLED. Same intake, same receipt.

### Queue
1. #1163 CI green → tell Lead (it merges through Deploy).
2. The Pit's niche-rim fix lands → re-shoot the gate still on the VPS (work/world, branch still-world = world/pit-skull + backend/defeats) → Lead.
3. GPT's gate + chests land in ~/Desktop/Business/frankendom/docs/character-references/pit/props/ → copy (no donors) → VPS: scripts/pit-ship.mjs then
   scripts/pit-meshopt-filter.mjs → checker → browser load → receipt to Lead + Web + Strategy (milestone) → PR.

### Gotchas
- `gltf-transform optimize --compress meshopt` QUANTIZES: scale and offset move onto the node, and the Pit's prop() reads the raw geometry. Use
  scripts/pit-meshopt-filter.mjs (FILTER method + KHR_mesh_quantization declared). It keeps float metres and an identity node.
- In a browser test, three's loaders import bare `three`: import them through a small module that Vite serves, not /node_modules paths.
- zsh: `"$c:refs/..."` applies the `:r` modifier; write `"${c}:refs/..."`.
- Mac: none without Lead's word. VPS (frankrows@49.12.7.18, key ~/.ssh/binance_futures_tool): stills run through `/opt/frankendom-shadow/bin/capture world …`;
  tools in work/world-tools (gltf-transform, sharp), intake in work/world-intake.
- Worktree: this session ran in the app worktree .claude/worktrees/pensive-goodall-2f90b0; branches world/pit-intake, world/pit-skull, docs/world-state-0930.
  No crons.

## Lane state — look test links (#902 live, #908 green), shade/silhouette closed, 2026-09-27 afternoon

### Now (READ FIRST)
- **No active World task.** Lead: "nothing heavy from you now". Next work comes from Lead or Strategy. Deadlines are NOW or ASAP only (entry below).
- If a quiet window is on (Lead posts QUIET WINDOW … END), run no builds, tests or browser runs until END.
- **?look=souls** is an OPTION for Dom to judge on the Centurion bronze proof (Armour's full-figure build). Owed when asked: the phone `?perf=1`
  p50/p5 with and without the flag (Strategy's bar: p50 ≥ 30, p5 ≥ 20), plus a browser eyeball of souls on the Legionary and the Knight.

### Done today
- **#902 LIVE (899a5992)**: `?look=souls`, `?look=shade` and a comma list. src/look-flag.ts is the parse (static, tiny), and src/souls-look.ts is a
  dynamic chunk fetched only with the flag. No flag = today's render; the only default-path change is `hemisphere` held in a named variable in scene.ts.
  Souls: a dusty warm rim behind the fighters that follows the camera, fill ×.55, key ×1.2 (flicker arenas use `look.key`), roughness ×1.15,
  env 1.25, cloth dull, a contact-shadow blob between the feet, AgX tonemap, a CSS vignette, and bloom (threshold 1.0) on desktop only.
- **#908 GREEN, open, flag-only, low in the queue** (head c726a6a8, world/shade-edge-fix, off 899a5992). It adds `?look=silhouette` (every
  fighter mesh, weapons and shields included, flat #000) and fixes the shade rim. Live, shade rendered solid red and tan: the fresnel read the normal-mapped normal
  at power 2.6 × 2.2. It now reads `nonPerturbedNormal`, smoothstep(.6, .92) on 1 − N·V at 0.8. Both skip transparent decals and 'Opened' gore.
  CI 48 pass. The arena-audio-check TimeoutError passed on a rerun. Local: tsc 0, look-flag + graphics 69/0. 375 captures (Pitborn): before/after
  shade and silhouette went to Dom, Lead and Strategy.

### Open
- **Shade and silhouette CLOSED for beta** (Dom: "I don't like it much honestly"; Strategy via Lead). #908 stays for later judging.
- Phone perf for the look flags is not measured.

### Gotchas
- **Phone tier: no post chain.** A multisampled half-float target is ~60 MB more GPU memory at the phone's pixel ratio (the black-fighters
  defect, quality.ts). So on phone AgX is the renderer's own and the vignette is CSS; `&bloom=1` forces the chain on.
- **A fresnel term on the normal-mapped normal fills the body.** Use the geometry normal (`nonPerturbedNormal`) for rims.
- **Capture recipe:** Playwright at 375×812, dpr 2, 9 s after load, against vite dev on a spare port. The script must sit in the repo root to resolve
  `playwright`; delete it after. One browser at a time, and only when the box is free.
- **The Stop hook's quality gate runs `quality-stop-targeted.mjs` locally even in a quiet window** and times out at 420 s under load (not a failure).

## Lane state — #705 live, hat handed to Armour, NOW/ASAP rule, 2026-09-27

### Now
- **Deadlines are NOW or ASAP only** (Dom, 2026-09-27, relayed to every lane by Strategy: "dont set fake extended deadlines or times,
  everything is NOW or ASAP"). Never give Dom, Lead or Strategy a day or clock time. If today is physically impossible, name the physical
  blocker (a battery still running with minutes left, a red gate, the box busy, an HF quota).
- No active World task. Next World work comes from Lead.

### Done
- **#705 ruling C live**: merged as bb98110e (CI all pass on head f85246b6), and live fb156516 contains it (release.json checked, `git merge-base --is-ancestor`).
  The Plague Doctor opponent fights hatless (`NOT_WORN` plaguedoctor: ['Helmet'] in src/loot.ts), and the hero still wears the hat.

### Open
- **The Plague Doctor hat belongs to the new Armour lane now** (Lead released World on 2026-09-26). Armour re-textures it, then takes it off NOT_WORN.
  World sent Lead the diagnosis for Armour. PlaguedoctorCloth has roughness ~.56. On the flat crown and brim, the backlit sun at (-15,26,-18)
  puts a highlight at the camera. Maps and material were ruled out by browser A/Bs (origin/evidence/705-pd-hat).

### Gotchas
- A creature-pipeline opponent (CreatureBody) has no slot draws, so a 'replace' loot piece hides nothing of his own.
- This session may open in the app worktree (.claude/worktrees/pensive-goodall-2f90b0). Edits in ~/Developer/frankendom-world are then refused,
  so branch off trunk in the app worktree and push from there.

## Lane state — #705 held for KnightIron, #787 + #799 live, 2026-09-26 midday

### Now
- **#705 ruling C** (world/tier-dressing, head ed19a9bf, trunk edf5d93f merged): green. CI 17/0 on 2f83ae3d; on the committed ed19a9bf, tsc,
  grade-materials + loot-wear 14/14 and quality-stop-targeted 658/0. **Held out of batches (Lead)** until Character Main restores KnightIron (and
  PlaguedoctorCloth) on the Knight's six in loot.glb (branch char/knight-iron-restore, after #716). When that lands: merge it, run
  `node scripts/split-loot.mjs`, rerun the tests, push, and send CM the head. CM then re-shoots steel-match (hero Knight six + opponent Knight, Recruit/Master, 375) → Strategy.

### Done today
- **#787 shared skill-impact kit**: live in edf5d93f ("skills live"). Local 5/5 + targeted 634/0, CI 15/0.
- **#799 in-ring scatter** (Strategy picked A): the sunk shield and trodden helmet are dropped; they read as black ovals under the Witch arena's night
  light (Finishers' raycast). Live on eeae57a6: release.json and the live bundle literal checked. Before/after 375 stills: origin/evidence/world-scatter-799.
- **#705 red CI fixed** (2f83ae3d): carriers re-cut from loot.glb, and the ruling-C Executioner test fixed. Node parse() drops images, so the test now
  maps his SOURCE_MAPPED materials the way the Knight test does, matches pieces by geometry (~kit names repeat) and collects his own draws by mesh.

### Open
- The Knight steel-match fails on the asset, not the runtime: the knight.* draws in loot.glb lost KnightIron at e3b4f218 (#709; last good dfe371a1).
  wear() does not swap Knight Steel (SOURCE_MAPPED.knight = ['Leather']). Owner: Character Main (Lead's ruling).
- Post-beta: option B, a non-metal rust material to bring the flat scatter gear back. Bespoke VFX for Miasma, Anvil Stomp and Reaping Blow.

### Gotchas
- **There is no lint script and no eslint config.** `npm run -s lint` hides "Missing script"; don't report lint as a check.
- **A metallic merge goes black on the floor under night light.** Near-flush pieces in the iron merge (metalness .78) get almost no diffuse light;
  a vertex tint can't lift a metal. Keep in-ring gear to pieces with a lit edge, or give it a non-metal material.
- **A peer's material diagnosis is a hypothesis.** Check SOURCE_MAPPED and bisect loot.glb's JSON across commits before changing wear().

## Lane state — parry tell (#686), 2026-09-24 evening

### Now
- **#686 parry tell** (head b1fe8d66): Lead verified it. The stack trunk + #684 → #678 → #685 → #686 merges clean. Web is capturing the v2 defence
  sheet on this head (375x812: three stills at the impact tick, plus a parry still about 6 ticks later), and Strategy rules on it. **Don't push to
  #686 unless CI goes red or Strategy's ruling asks for a change.**

### Done
- Why a parry read as a block at impact: every Deflected clip opens on the attack's contact pose (build-warrior.mjs, build-weapon.mjs). The
  parry's 70 ms hit-stop also renders at dt 0, where eased weights never move. So the attacker held the attack pose, and the weapon tip on trunk
  sat 0.000 m from where it sits after a block. The fix is in `src/characters.ts`: Deflected plays from `DEFLECT_FROM = .35` (the thrown-widest
  key in every family), and its weight snaps the way a live blade's does. Test on the impact frame, parried vs blocked: longsword 0.725 m and
  0.676 rad, trident 1.049 m and 0.897 rad. Presentation only.

### Open (follow-up, PARKED by Lead)
- **The player being parried (`enemyParried`) has no Deflected reaction.** `defenceReaction` covers the player only as the defender, and a
  parried player shows the `hurt` phase's pose instead. Not a playtest gate. It comes back if the playtest's "why did you take damage"
  answers point at it.

### Gotchas
- **dt 0 freezes eased weights.** Any pose that must show on an impact frame inside a hit-stop has to set its weight directly, as the
  active-blade rule does; an eased blend holds the previous pose for the whole stop.

## Lane state — signatures framework (SHIPPED + bloodMode), Witch shipped, 2026-09-24 afternoon

### Now
- **#669 Witch (The Grasp)**: Strategy YES. GREEN at 21c51cab, MERGEABLE onto trunk 5f32ad45. Handed to Lead to re-READY; Deploy merges it.
  After it is live: confirm on the phone that a player (tools closed) sees the staff sparks and the Grasp against the Witch with no admin pick.
- Lead dispatches `blood: true` to the effect lanes now that #677 is on trunk. Blood list sent: Nightborn B, Goblin C, Pitborn A,
  Plague B = blood. Executioner A, Knight B, Veteran C, Witch A = not blood. The Dwarf "Wound (C)" (#667) enters SHIPPED with its own PR.
- Owed: the phone `?perf=1` reading for the Witch and for arenas A–D. Dom's pick of two of A–D for ARENA_PICK is still open.

### Done today (afternoon)
- **#663 merged (d45f4837)**: Dwarf Hammer Stamp registered but not shipped, `?signature=` only counts while the test tools are open.
- **#677 merged (5f32ad45)**: `SHIPPED` in src/signature.ts is the ruled variant per opponent, on for every player (nightborn B, executioner A,
  pitborn A, plaguedoctor B, goblin C, knight B "Rivet B", veteran C, witch A). New mode `ship`: tools closed = ship, whatever the URL says. The
  admin select gains "Shipped" as its default and keeps Off / On / A–C. `SignatureFrame.bloodMode` is added; an effect with `blood: true` does not fire on blood off.
  A ruled letter whose module is not registered shows nothing, so each lane's effect PR switches it on as it lands.
- **#669 Witch AGAIN** (Strategy on d67bca77): the sparks are crossed-quad streaks (8 x 1.4 cm, 60–140 ms, ≤ 1.4 m/s), and a spent one collapses
  to zero area. The hand is opaque (transparent: false) and near-black with a red rim; the crumble order sits in an alphaMap, fingertips first, and the ash sheds
  off the crumble front. It is always on the RIGHT shoulder. Strip: origin/evidence/witch-again. Perf (headless Mac, not a phone): p95 16.0 ms, 0/313 dropped.
- **#671 evidence**: origin/evidence/world-arena-select, captured on live d45f4837. After an arena-only change (→ B) the page reloads into the Rain Yard, and the opponent is unchanged.

### Open
- None blocked on this lane. #669 waits only on Deploy's queue.

### Gotchas
- **Check the COMBINATION of your open PRs, and your PR with every PR queued ahead of it.** #677 made `bloodMode` required; #669's test
  frame lacked it, so each was green alone and trunk would have failed tsc. My #669+#677 merge-tree check missed #659 (the Knight import on
  the same scene.ts line). Build the merge tree of trunk + every queued PR ahead of yours: `git merge-tree --write-tree`, then `commit-tree`,
  then a detached worktree with node_modules symlinked, then tsc + tests.
- **A translucent dark decal reads as a hollow outline on the phone.** Noise in the alpha made the black fill see-through and left only
  the red rim. Keep the art opaque and put the dissolve order in an alphaMap with `transparent: false` (alphaTest still discards).
- **Parked Points are not gone.** Points parked under the floor still showed as loose white squares mid-arena. Collapse a spent
  particle to zero area instead.
- **The deploy guard blocks `node --test` even for one file.** Plan local runs for after FREE. `tsc`, git and gh still work during a deploy.
  `timeout` does not exist on macOS (exit 127).
- A reload that skips the welcome form (name already stored) breaks capture scripts that wait for "Enter the arena". Submit only when `#welcome` is visible.

## Lane state — arenas 2/3, arena select, signature effects, 2026-09-24

### Now
- **Signature effects (Dom order via Lead, 2026-09-24).** The brief is `docs/briefs/signature-effects.md` on `origin/strategy/state-1235`
  (fcd29abe); read it from origin. This lane owns: (1) the FRAMEWORK PR: a cosmetic-only registry keyed to existing duel
  events (Hit / Parried / Blocked / Dodged / Charging / Charged / AttackMissed, …) per opponent id, with persistent marks capped
  (suggested 6 per body, 4 per shield, 8 on the floor; oldest fades first) and cleared at fight end. No sim change. It also adds an admin "Signature"
  select (Off / On, plus A/B/C while alternatives exist) in Options → Next fight beside the Arena select, with the same gate as #648's `#arena-row`.
  (2) **Dwarf Hammer Stamp** (a clean heavy stamps the maker's-mark dent decal on the struck body). (3) **Witch**: staff sparks
  during `Charged` (the drone stays), plus a short-range Grasp on her landed charged hit. No projectile. One PR per effect, each with a receipt: a 2 s
  clip or a 3-frame strip at 375x812, plus a perf line. Land the framework FIRST and send Lead its API shape (other lanes build on it).
  ETA given to Lead: framework ~11:00Z, Dwarf ~13:00Z.
- **#648 (Arena select), open at 82b988e4.** It sits on the Options tab beside Opponent. The row `#arena-row` ships hidden and is shown by
  account.ts `showTools` for the admins roster and by main.ts for `?debug`. The pick is stored in sessionStorage (`frankendom.arena-override`)
  and applied at the next load; `?arena=` still wins. Waiting on Lead/Deploy to merge.

### Done today
- **#624 merged (2a41ed4e):** Arenas 2 and 3 are four labelled options for Dom: A Night Pit (low flickering firelight, embers,
  clay), B Rain Yard (wet slate plus reflecting puddles, rain streaks), C Blood Sand (noon sun overhead, blood-stained pale sand, dust),
  D Sunken Cistern (vault, silt under water, light shafts, drips). ARENA_PICK is provisional: A → Arena 2, B → Arena 3. Dom: "put
  them live, I'll decide". Stills and per-option perf are in the #624 comments; evidence images are on `evidence/world-arenas-624`.
- The theme seam in `src/arena-themes.ts` has optional fields: `light` (key-light position; `flicker` sways it, applied in scene.ts), `weather`
  (drives the one Points cloud: ash/embers/rain/dust/drips), `wet` (floor roughness), `shafts` (additive light shafts plus pools), and
  `textures.patch` (`puddle`, which drops roughness by the mask's alpha, or `blood`).

### Open
- Dom's pick of two of A–D for ARENA_PICK is a one-line change. The phone `?perf=1` reading per arena is still owed after he plays them.
- C's heat haze was not built (it needs a full-screen pass, which costs every phone on every frame).

### Gotchas
- **Floor luminance is measured in LINEAR space** (arena-themes.test.ts, 15 % band around Arena 1's 0.087). An sRGB tint of ×1.33
  moved it ×~1.9. Tune the tints by roughly the 2.2th root of the ratio you need.
- **Test harnesses stub main.ts's imports module by module** (tests/graphics.test.ts and 8 others). A new import in main.ts resolves
  to `{}` there and failed 51 tests. Put static data in index.html, or add the module to every harness map.
- **The deploy guard blocks the WHOLE Bash command** when any part of it looks heavy (a test run, a build), including the edits in the same call.
  Make file edits with the Edit tool, or in a separate call, while a deploy holds the lock. Check `~/.claude/state/deploy_in_flight.json`
  immediately before any render: a scratch `node` script is NOT blocked by the guard, and I ran one render during a deploy.
- zsh: `$C:refs/...` in a push refspec parses as a `:r` modifier. Write `"${C}:refs/heads/..."`.

## Lane state — presentation / world, 2026-09-22 (trunk cb4e0ef)

### Now (2026-09-22, end of session)
Four PRs open, all mine, none merged at the time of writing:
- **#485 fix trunk** — URGENT, ahead of everything: trunk becec83 fails `tsc` (TS2304, arena.guards still read the removed
  lorarii), which blocks every lane's build and quality:stop and stops Deploy publishing #467.
- **#467 the guards come off the wall** — the owner's fix for tonight; sim untouched.
- **#466 `?perf=1` overlay** — the instrument of record for the phone.
- **#463 gotchas** — the four instrument rules below.

Next work, on a fresh session: the REPLACEMENT presentation for the wall guards — six silhouettes baked into the wall
texture at the sixths, a one-draw ribbon streak for the lash, a shadow sweep on the sand for the raise (scaled by the
event's `lead` ticks). **No skinned meshes, no per-frame animation.** Bar: p95 under 16.7 ms on the owner's phone read
through `?perf=1`, with the tell still readable from the fighting camera before the lash. `lorariusAngle(i, tick)` still
gives the six sixths; `guard.glb` stays in the repo as the hero-rig reference.
Also still open, non-urgent: measure the guards (or their replacement) while the camera is actually ON the walkway — take
it from a finisher tour capture, where the camera frames the wall naturally.

### Done today
- **Brief 13 — six lorarii on the walkway** (PRs #430 capsules, #435 model → reverted #442, #450 re-land). `src/lorarii.ts`:
  six guards on the ring wall at r 12.1, y = `LAYOUT.wall.top` 2.6, outside `CAMERA_CLAMP` 11.5, so never on the sand and never
  in the fight camera's clear zone. Posts at each sixth's centre offset half a sixth (none on the gate axis); each paces
  ±16° of his post and turns to watch the nearest fighter. `lorariusAngle(i, tick)` is pure in the SIM TICK so Combat can
  source the whip's shove direction from the same guard and a replay places him identically. Bodies are Multi Chars'
  `src/assets/guard.glb` (#428): SKINNED, so six `SkeletonUtils` clones with a mixer each, never one `InstancedMesh`; built one
  per frame. Capsules remain the fallback; `?guards=<n>` caps the count. Whip timing comes from the event — the lead between
  `WhipRaised` and `Whipped` is 60 ticks before the first lash and 30 before repeats (`RULES.wall.loiter`), so the hold is
  `lead − raise` and Raise plays at `clip/lead` (clamp 0.4–2.5). The jeer reads `duel.fighters[i].loiter > 0` — no new event,
  and Audio reads the same field. Seam: `arena.update`'s optional `SimView` ({ tick, fighters }), one line in `scene.ts:614`.
- Versus card: loading line matched to the caption (15px Arial, 3px tracking, #e9ddc5, full opacity) with three dots pulsing in
  turn (1.6 s, 25 → 100 → 25 %, stilled under prefers-reduced-motion); stills re-rendered 30 % wider (`--zoom` on
  `scripts/versus-cards.mjs`, fov ×1.3). PRs #400, #408.
- Death screen: Share is a 44 px link-styled button above Next, right-aligned with it; the status takes the link's place for
  2 s and only for NAMED confirmations — an error must persist, and "Couldn't make a link, try again." is exactly 32
  characters, so a length rule would have cleared it. PR #411.
- End-of-fight camera: a touch anywhere during the arena-cam tour hands the camera back, gated on the tour actually running.
  PR #394.
- Thumb cluster look (owner's "D3"): grey glass fill `#a39f9722`, hairline `#c9c4b8a6`, no inset ring, ticks .55, centre ring 0
  at rest but still lit to .95 for Stab held / straight Guard; stick ring and knob softened. PR #420.
- Release row 33 (`endgame-hud-check`) made deterministic: it sampled during the 250 ms fade and skipped anything at opacity 0,
  so it had been passing by accident. It now waits for the fade, then asserts the TOP BAND never covers the body and the
  cluster buttons stay inside `#actions`. PR #424.

### Open
- Combat's `WhipRaised` is on trunk (#441) but this lane has not seen a real raise-then-lash in a live fight: the raise path is
  exercised by `tests/lorarii.test.ts`, not by the sim. First thing to watch on the next fight capture.
- The owner's bar for the guards is unverified by eye: six on the wall from the fighter's camera on an iPhone, raise visible
  before the lash. The numbers pass; nobody has looked at it on the phone yet.
- `Turn` is authored but never played (see Gotchas); if a patrol reversal ever wants it, the yaw-lerp has to go first.

### Gotchas (2026-09-22 — each one cost real time)
- **Green on its own base is not green on trunk.** Two PRs whose diffs never touch the same LINES can merge cleanly into
  code neither branch contained, and no per-branch CI ever runs the combination. Mine: #466 (the ?perf=1 overlay) ADDED
  `get guards() { return lorarii.standing; }` to arena.ts while #467 (removing the guards) DELETED the lorarii it reads.
  Both green on their own bases; trunk becec83 then failed `tsc --noEmit` with TS2304 and blocked every lane's build and
  quality:stop until #485. The shape to watch is one PR adding a REFERENCE near another removing its REFERENT — renames,
  deletions of shared symbols, cleanup PRs. If a gate fails in a file your branch does not touch, check trunk first
  (`git show <trunk>:<file>`, tsc on a clean trunk checkout), tell the owning lane, and do not patch someone else's file —
  that is exactly what the Pitborn lane did here and it saved the time.
- **When you A/B a cost, make sure one arm actually has NONE of it.** I compared six guards against ONE guard, saw the same
  loading hitches, and told the lane "not the guards". Wrong: one guard already pays the first-pose price, so neither arm
  was a control. Against a genuine ZERO-guard build the worst frame from document start drops 974 -> 655 ms and frames over
  25 ms go 13 -> 11. Both things were true at once — six skinned clones are nearly free in steady state (68.0 draws/frame
  whether six, one or shadowless, because they are culled from the fighting camera) AND about a third of the load spike.
  The owner overruled our numbers from his phone ("definitely slower now because the guards") and he was right; the guards
  came off the wall the same night (#467), with RULES.wall.loiter and the whip audio untouched. **When the person playing
  the game disagrees with a lane's measurement, suspect the measurement.**
- **A check that runs on the Mac measures the Mac.** `guard-browser-check.mjs`'s "phone tier" is Playwright on this Mac at
  852x393 DPR 2 with `isMobile` and NO CPU or GPU throttling, so every phone-tier frame time quoted on 2026-09-22 — mine
  included — described this laptop's vsync, not an iPhone's GPU. Worse, rAF deltas cannot measure frame COST at 60 Hz at
  all: p50 sits at ~16.7 ms for an empty page, so a 16.7 ms ceiling fails everything and a 18 ms one passes anything.
  Multi Chars proved it from the other side (#462): six guards vs one gave IDENTICAL rAF (p50 16.7 / p95 18.5) while CPU
  frame cost under x4 throttling moved 2.5x. Their row now asserts CPU frame cost instead. **The instrument of record for
  the phone is `?perf=1` on the device** (main.ts, style.css `.perf`): p50 / p95 / max, dropped frames over 16.7 ms
  COUNTED, worst frame since load, guards standing/asked-for, draws, triangles. Read the DROPPED COUNT, not the p95 — on a
  vsync-capped device the p95 sits near 16.7 whatever happens and the dropped count is what moves.
- **The first pose of a skinned model is expensive.** "Worst since load" on the phone viewport: 817 ms with six guards;
  Multi Chars' harness 1,037 ms at six against 187 ms at one — shader compile or first-pose work, and it scales with guard
  count where the steady state does not. It is a first-frame cost, not steady stutter; if a jank report is "at the start of
  a fight" rather than throughout, this is the shape to chase.
- **Assume nothing about the environment `main.ts` boots in.** `tests/graphics.test.ts` runs it in a node VM with no
  `URLSearchParams` (49 tests failed on mine), and the same VM has bitten other lanes over import-time `document` and
  `removeAttribute`. Read flags with a regex over `typeof location === 'undefined' ? '' : location.search`.
- **A check that loads a preview page measures the preview page.** `scripts/guard-browser-check.mjs` boots
  `guard-preview.html`, Multi Chars' standalone review page — NOT the game. Its "6 guards, 148,404 tris, 86 draws,
  p95 17.6 ms" was quoted (by me, then by Lead) as the phone-tier cost of the guards IN GAME, and a budget row was set
  from it. It never described the game at all. **Whenever you quote a number, say which page produced it.** The in-game
  figures, counted by wrapping `drawElements`/`drawArrays` on the real canvas at 390x844 dsf 3: **68.0 draws/frame**, the
  same with guard shadows on, with them off, and with `?guards=1` instead of six — because from the fighter's camera the
  walkway is out of frame and all six are culled (and their mixers skipped). The lorarii cost ~0 while you fight; they
  render only when the camera looks at the wall.
- **`castShadow` on the lorarii was already a no-op**: `arena.ts` fits the sun's shadow camera to the pit floor and the
  wall's foot, not the walkway, so the guards were never in the shadow pass. Turning it off changed 68.0 → 68.0.
- **The loading-phase hitches are not the guards.** Frame-gap trace from document start (not an average — an average hides
  this shape): worst frames 974 / 577 / 486 / 313 ms with six guards, and 956 / 603 / 410 / 272 ms with `?guards=1`. The
  same hitches, slightly worse with ONE guard, so they belong to the other assets, not to guard.glb (504 KB, lands at
  ~1.0 s, during loading and before the player can act).
- **The boot fetch budget is a product rule, not a harness quirk.** Anything fetched before first paint costs EVERY cold load,
  phones included. `guard.glb` on the boot path took down deploy #105 (DEPLOY_EXIT=1, nine rows, no flakes). Load after first
  paint — and not inside a fight either: deferring it there stalled the main thread mid-exchange and
  `quiet-one-browser-check` timed out waiting for the canvas to go stable. A hitch a harness can see is a hitch a player feels.
- **A frame-time that never fetched the asset measured the capsules.** My first two phone runs looked fine and meant nothing:
  `guard.glb` was never requested. Check `performance.getEntriesByType('resource')` for the asset in the SAME run before
  trusting any perf number.
- **`scripts/finisher-preview.mjs` counts an actor as "a top-level scene child with a pelvis bone".** The lorarii are built on
  the hero skeleton and live in the arena group, so THE ARENA GROUP became a third actor, `framing` came back undefined, and
  eight rows failed reading `.side` off undefined — for a reason with nothing to do with fetching. The arena group is now
  excluded by name, and a genuine third FIGHTER still fails. Nobody would have guessed this from the symptom.
- **Rebase before concluding a fix didn't work.** Two re-land attempts "failed" the blood gate on a stale base; the same code
  passed on trunk c7d942a.
- **`Turn` is a 180° about-face with a `root.quaternion` track INSIDE guard.glb**, one level under the node this lane
  positions — playing it composes with the outer yaw and spins the guard 360°. The world lane never plays it
  (`docs/state/character.md`, #438, records this).
- **Keep `src/lorarii.ts` free of Vite-only syntax.** `?url` imports and `import.meta.glob` are not resolvable under node, and a
  glob in `arena.ts` broke `tests/arena.test.ts`. The URL is handed in instead.
- **`scripts/roster-browser-check.mjs` means fighter rigs.** Arena GLBs were always excluded (props); `guard.glb` is now named
  in its `ARENA_GLB` list. Size is governed by check-budget's own `guard` row: 231,620 B packed gzip (504 KB is the unpacked
  file — the number that got quoted wrongly during the incident).
- Measured off guard.glb and not to be re-derived: Pace **0.963 m/s at timeScale 1** (walk them slower and the feet skate),
  Raise 0.50 s, Lash 0.60 s, no `stride` userData, no finger or toe tracks.

## Wound-site mark removed — presentation lane, 2026-09-21 (PR #305, merge d379696)
Owner, from a phone screenshot of the Goblin: the flesh-hit wound mark (a dark mark with three drips for the sim's four-second
wound window) floated in the air behind him. Root cause: the mark was drawn at a fixed human torso height (1.15 m) while the
Goblin's own chest bone sits at 0.74 m; on full-height rigs the same fixed height buried it inside the mesh, so nobody noticed
it there either. First fix pinned the mark to the rig's own site bone (PR #304, superseded); owner then asked for outright
removal instead ("lets remove the wound mark, no need"). `gore.ts`'s `arm`/`hide` API and the standing-mark positioning are
gone; the pooled decal itself survives only because The Quiet One's throat-cut finisher still draws it at the animated neck
(`tests/gore.test.ts` pins both: no standing-mark API, throat cut still fades/hides/clears). Receipt: a landed heavy on the
Goblin, side view — floating mark vs nothing, `artifacts/presentation/wound-mark-removed/goblin-before-after.png`.
Remaining: `GAME_SPEC.md`'s gore-upgrades paragraph still described the mark as shipped until this same pass (audit finding,
2026-09-22) — corrected there too.

## Versus card — presentation lane, 2026-09-21 (PR #254, merge 0cd0ac2)
Owner, from the loading screen: "can we have a static actual player image that matches the fight about to happen … rather
than these weird pillar things?" (the capsule stand-ins while the rigs download). A full-bleed `#versus` card now covers the
arena from page load with a still of the real upcoming fight — the hero and the actual opponent, armed, rendered from the
game's own models and arena via `scripts/versus-cards.mjs` (one WebP per live ladder rung, 40–43 KB each, 256 KB total) — and
a "You vs `<Name>`" caption; it fades out (0.45 s) the instant `createScene` reports the rigs are in. Six stills committed:
Veteran, Pitborn, Goblin, Nightborn, Executioner, Dwarf. `tests/graphics.test.ts:497` pins the lifecycle.
Audit finding (2026-09-22, corrected same pass): the hide condition was keyed on the literal display string
`status !== 'Loading warriors…'`, which happened to work only because scene.ts emits exactly three status strings today; any
future in-progress status line would have lifted the card early. `scene.ts`'s `assetStatus` callback now carries an explicit
`kind: 'loading' | 'ready' | 'failed'` alongside the display text, and main.ts keys off `kind` only — two new regression tests
cover a re-worded in-progress status (must not lift) and a load failure (must lift, so the retry notice stays readable).

## Mobile stamina bar fix — presentation lane, 2026-09-20 (PR #248, merge f9a6d1c)
Owner, from an iPhone screenshot: the player's stamina bar showed only a dark-red stub at its right end, never the fill. Cause:
on phones every meter draws as a CSS gradient on the element, but the desktop `#stamina` rule (the lost-ceiling attrition
shading) has id specificity and silently replaced the phone gradient — health has no such rule, which is why it alone drew
correctly. Fix layers both gradients (shading over fill) in the phone `#stamina` rule — 3 lines. Receipt: Playwright at
393×852 with `--fill: 55%; --max: 80%` forced on the meter, before/after, `artifacts/presentation/hud-stamina/before-after.png`.

## Sparks: silver, fanned, glinting, then a visibility step-up — presentation lane, 2026-09-20/21 (PRs #219, #227, #242, merges 5e08ce9 / e07aa0f / 3ea6ceb)
Four owner passes on the clash-sparks effect (`clash-sparks.ts`), each with before/after impact-preview strips:
1. **#219** — grey, thinner, uneven, 70% opaque (from bright uniform orange dots); damage numbers made an optional journal
   setting, default off (`main.ts`, `frankendom.damage-numbers.v1`).
2. **#227** — "maybe a silver reflection then, rather than just grey": cool silver-white cooling to dull silver, no yellow, no
   additive glow; sparks re-aimed to fan sideways/upward across the blades instead of a jet straight away from the defender
   (the strips showed the old jet flew behind his own head and shoulders at the over-the-shoulder camera — the only sparks the
   owner ever saw were the few that cleared his arm); one 3-frame silver glint at the contact point.
3. **#242** — "i cant see the sparks now… a bit more visible": size 0.075 → 0.1, white on strike, glint 3 → 5 frames, one more
   spark per clash (4–8, was 3–7), streaks 3–8 points.
Live sparks today are still these dot-based ones (`PointsMaterial`); a from-scratch streak renderer (thin motion-blurred
lines, per the owner's reference photos — a round sprite reads as a circle) was rewritten in `clash-sparks.ts` after the
owner flagged the dots looked fake, but is uncommitted pending capture and a laptop-free window — not reflected here yet.


## Arena props, startup worker, crowd cull, sky environment, sparks v2 — presentation lane, 2026-09-20 (branch presentation/arena-props)
Five authored props generated on the owner's Hugging Face Pro account (TRELLIS.2 from prompted reference images) and dieted in Blender
(3–5k tris, 512–768² WebP, metallic-roughness → factors): a portcullis that replaces the procedural gate bars once loaded, a weapon rack
on the walkway, a fallen shield, a column drum and a bone pile in the sand band — 672 KB gzip after build packing, +7 MB GPU desktop /
+1.75 MB phone (maps capped 512²/256²), placement held to the exclusion volume by `tests/arena-props.test.ts` from a size table.
Startup: the arena's heavy maps generate in a Web Worker behind flat stand-ins (`buildArena` on the main thread 1,067 → 204 ms) and
`scene.ts` `ready` waits for `arena.ready` so uploads land in the loading screen (p95 18–19 ms in every window; load at trunk parity).
Crowd: spectators outside the camera frustum collapse per frame (~33 of 291 stand at the portrait lock). Sun shadow frustum ±12 m.
The environment map is the arena's own sky once it has landed (warm sand below the horizon), intensity 1.0. Banners stop casting shadows
(the slab on the fighting sand); the gate light is a wider, fainter patch. Sparks v2 on the owner's live feedback: struck off the visible
blade, 3–7, staggered, thin, pale straw → ember, tone-mapped. Evidence `artifacts/presentation/{REPORT-arena-props.md,props-v1,sparks-v2}`,
`artifacts/world/{base,props}-{full,phone}`. Not done: baked AO (needs an unwrapped lightmap pipeline), KTX2 textures (needs the
basis_universal encoder — owner's OK), the phone AA decision and one-pass post (after KTX2). check-budget counts prop GLBs as opponent
candidates: true per-fight ≈ 10.4 of 12 MB.

## Contact grit — presentation lane, 2026-09-20 (branch presentation/impact-grit)
Owner-directed small realistic contact feedback, four steps behind the existing event stream, no sim change: (1) metal sparks
(`src/clash-sparks.ts`) off the defender's guard on a blade-to-blade block or parry — steel on steel only (a shaft, wood, a kick, a landed
blow: none), 4–8 hot streaks under gravity, one bounce off the sand, out ≤ 0.45 s; (2) guard shudder (`src/camera-kick.ts`): the trunk
camera kick was applied before `lookAt` and along the view axis, so it measured 0 px; it is now a world offset applied after the look-at
for the draw only — a heavy drops the camera 6 cm and holds two frames (11 px at phone framing), a heavy block 2.8 cm (6 px), a parry
flicks 2 cm sideways (4 px), all settled within 13 frames; a heavy caught on the guard deepens the body recoil ×1.5; (3) sand puff off
the defender's rear foot on a heavy that lands or is caught (`foot-dust.ts` `puff`); (4) kill dip: exposure −6 % for two frames, eased
back over two, kill only (−2.4 % crop brightness). Harness `scripts/impact-preview.mjs` (scripted block/parry/heavy/kill through the real
`createScene`, hit-stop reproduced) with before/after strips and camera traces in `artifacts/presentation/`; 4 new test files (7 tests).
Gate 314/314 + browser gate on cbec4cd. Phone amplitudes unverified on device; the shove table is one place to halve.

## Mixed, populated crowd and stronger foot sand — world, 2026-09-19
Colour follow-up: owner approved dust size, motion and one-second life but found it grey against the sand. Live phone step capture confirmed the mismatch; a muted golden-tan tint (`#b99a68`, previously `#c9b493`) now sits closer to the lit ground. Only the particle material colour changes. Close/portrait render review and existing lifecycle test pass; release receipts: artifacts/world/warm-dust-notes.

Owner accepted the softened colours and mixed crowd, then requested busy seating around all 360 degrees including the gate, and more visible one-second foot sand. Six subdued garment dyes (dusty maroon/charcoal navy/earth tones) and five body families are assigned independently using nearby-seat diversity before GPU batching. On 291 occupied seats, only 27/844 nearby pairs repeat a body and 10/844 repeat a dye. Every 30-degree sector has at least 24 spectators and 8 on the lower two tiers; rubble, arch lip and flames retain clearance. Tread height follows tessellated stone; actual support raycasts and full-vertex play/camera clearance checks pass. Arena 114,440 triangles / 120k, unchanged meshes and 11.01 MB textures. Physical phone timing remains unmeasured.

Foot sand uses a 48-point pool, five larger denser particles per plant, low lateral curls with drag and a 1-second fade. Idle, combat-pose suppression, teleport rejection, hit-stop and disposal remain intact. Lifecycle check verifies the longer tail and lower-leg height. Existing world preview now captures 12 sectors plus normal portrait dust on/off. Focused arena/dust 11/11, lint and typecheck pass; all 12 sector renders and stronger dust at portrait combat distance reviewed. Full contract, CI and live receipts are tracked under PR #156 and artifacts/world/mixed-crowd-notes. Integrated weapons f7a1e99 and its polearm browser gate; no fighter, combat, audio, camera or lighting edits from world.

## Crowd variety and foot sand — world, 2026-09-19
Owner requested subdued ruby/navy/brown/grey and other muted clothing, stronger sizes, lower-tier audience and restrained grounded foot sand. Six garment-only dyes preserve skin; separate trousers, two stances per five roster families, independent height/build variation. 219 spectators redistribute across five tiers with gate/flame/collapse clearance. Initial render rejected bright clothes and matching trousers; refined captures in artifacts/world/crowd-dust-final. Arena 9/9 and dust lifecycle check pass; full contract receipts in artifacts/world/crowd-variety-notes. Arena 26 measured draws,92,126 triangles,11.01MB textures; physical phone p95 remains owner-only/unmeasured.

Presentation seam coordinated with lead: cached animated feet feed a 24-point pool, one transient draw, 0.55s fade, no idle or combat-pose emission. Real walking-clip preview verifies emission and expiry; hit-stop, teleport and disposal verified separately. No audio/combat/fighter asset/global light edits. All eight local contract commands passed, including npm run quality (260/260 tests), both finishers, roster, audio, estoc, counter and world render checks. Delivery tracked in PR #151; exact merge/deployment and live receipts are kept in artifacts/world/crowd-variety-notes.

## World polish — 2026-09-19 (world/crowd-grounding-light; local, not yet shipped)
Owner approved four sequential passes: roster spectators, settled debris, softer gate light, selective masonry staining.
Step 1: replace the narrow crossed cards with five opaque instanced body silhouettes: human, goblin, Pitborn, executioner, Nightborn. No fighter assets, animation clips or gameplay changed. Irregular gaps and slight depth/yaw variation; existing bounded crowd reactions retained. First judge rejected boxy torsos; refined rounded bodies, darker clothes, hair and robe silhouettes. Arena tests 8/8; first full quality 246/246 + browser gate passed; refined geometry typechecks and arena tests pass. Fixed-camera captures: artifacts/world/polish-1-crowd-refined. Cost: 88,798 triangles / 120k, 21 measured arena draws (+1), 11.01 MB textures (-0.35 MB), floor luminance 0.105 unchanged. Physical phone performance remains unmeasured.

Step 2: settle curved shields, helmet and snapped shaft into the sand; small rubble and pottery gather around three existing column drums. Preserve all five separated in-ring gear sites. Dust uses existing iron vertex colours only, no wear decals. Arena 8/8, lint/typecheck and fixed-camera debris + duel review pass; play/clamp bounds hold. Captures: artifacts/world/polish-2-debris.

Step 3: soften the existing gate shaft through a broader feathered falloff, low-contrast bar interruption and lower peak; warm ground pool and geometry unchanged. Arena 8/8, fixed gate/duel captures reviewed (artifacts/world/polish-3-gate); zero texture/draw/triangle growth.

Step 4: localized dirt at the wall foot and tapering soot above the braziers, baked into existing vertex colours; 552 extra wall triangles keep stains near the ground. Stone albedo/normal pixels unchanged. Arena 8/8 and fixed-camera review pass (artifacts/world/polish-4-masonry). Final local npm run quality: 246/246 + real browser + dependency audit + budget PASS. World preview now runs as a completion command: node scripts/arena-preview.mjs --label quality-world (passed). Final arena: 89,482 triangles, 21 measured draws, 11.01 MB textures, floor luminance 0.105. Two-pass self-review checked clearance/reaction/disposal and fixed-camera materials/readability; no audio, combat, fighter assets, global lighting or camera edits. Integrated trunk 32f783e (roster and Split Crown) preserving both completion commands. Integrated npm run quality: 250/250 plus real browser, audit and budget PASS; all three completion commands (roster routes/migration, Split Crown modes/rematch, world captures) PASS. CodeGraph refreshed in the isolated worktree. PR #145 initial CI passed; integrated newly merged estoc d3114a9 and preserved its completion gate. Revalidation/release receipts pending in artifacts/world/polish-notes.
The subsequent estoc integration passed full quality and all four completion commands. Integrated counter release 3bfb0eb, preserving its browser gate; counter release verified by its lane and window released. Integrated lead 0c7b03f, preserving its Season 1 state. World owns the next release window; final combined gates/live receipts are recorded in artifacts/world/polish-notes.

## Arena life — 2026-09-18 (world lane, owner's picks #1–#5)
Owner: "anything else we can add to make the environment more engaging?" — approved five, built in order, each audited
(tests + captures) before the next. Sound left to the audio lane. **Ash motes**: 220-Point cloud, per-pixel sprite, slow
two-frequency drift + a gust on landed blows (`motes` — Points, not Mesh: the solid-geometry rules are about camera
collision); first pass was invisible at 5 cm/35 % — the brick's luminance noise floor — so 0.14 m, light-toned, reads as
dust. **Firelight**: `fireGlow` warm vertex tint on wall+tier bands above each brazier (angular proximity × height
window; static — the coals' emissive flicker carries motion). ~~**Battle-worn sand**~~ — owner rejected the decals on
review ("3 i dont like"), dropped pre-merge; the `sandWearAtlas` lessons (decal albedo must land below sunlit sand,
≈0.8×) are recorded here in case the idea returns. **Fallen gear**: dented
helmet, snapped spear, broken blade in the iron merge (zero draw calls), yaw-only + low (camera-clamp rule). **Gate
light**: the low sun spills through the arch — beam rides the real sun direction but lives inside the passage (r ≥ 11.7;
the contract caught the first cut at 11.35 m) fading to the floor, plus an additive warm pool where it lands (y < 0.5 is
exempt). Cost: 21/40 draw calls, 21.2k tris, 11.71/12 MB textures. Captures: `artifacts/world/arena-life-*/`.

## Flames frayed — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames-fatter (PR #106): flames are ~50% of the pot, too pointy, too clean — "more like 70-80% of
the pot size… less pointy at top… more frayed/jaggy, separated a bit… gritty and realistic, not fake cartoony". `flamePixels`
(textures.ts) reworks the silhouette only (quad, anchors, palette and wave motion untouched): body width 0.65 → 0.88 with a
blunter profile (pow 0.5 → 0.42), two noise slots that drift apart with height split the upper flame into separate tongues,
high-frequency fray bites the silhouette harder toward the tip, the tip dies in a ragged noise line instead of a point, and a
per-pixel grain keeps the colour gritty. Measured on the brazier close-up: 145 px vs the 200 px pot rim (72%, was 55%).
Contract 226/226, zero draw-call/triangle/texture delta (+509 B source). Captures: `artifacts/world/flames-frayed/`; brazier
close-ups (new `scripts/arena-closeup.mjs` harness — the wide/lock views render flames at ~15 px, too small to art-direct):
`artifacts/world/flames-2-closeup/`, `flames-fatter-closeup/`, `flames-frayed/brazier.png`.

Objective: live responsive longsword practice on frankendom.com, with canonical persistent-fighter RPG direction.
Success: draw/strike, light chain/heavy/riposte, dodge/roll, directional block/timed parry, stamina, moving/guarding warden, player defeat/rematch; functioning movement/camera and saved guest identity; isolated verified HTTPS deployment. No claim of a passed player/hardware or online-combat gate.
Scope: GAME_SPEC.md. Semble discovery is working; CodeGraph was initialized with owner authorization on 2026-09-13. Use both for code work, and run `codegraph sync` after edits.
Files: src/{main,scene,sim,profile}.ts, src/style.css; tests; scripts/deploy.sh; deployment vhost.
Do not inspect/change other business products or existing VPS services.
Selected approach: Vite + TypeScript + Three.js static build, no framework/backend. Babylon and native web exports rejected for additional surface in this bounded gate.
Known risks: no physical minimum-phone tests or external player feedback yet; character art is an early original pass; server storage and actual PvP belong to 0B. VPS had ~1.3 GB free at discovery; deploy only a small static build and do not clean unrelated data.
Next validation: pure simulation invariants, storage failure/reload, touch cancellation, camera edge positions, rendered desktop/mobile layout, public HTTPS and source parity.

## Flames fatter still — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames v2 (PR #104): "fire fatter still, still only 50% of pot size". The flame quads widen
0.95 → 1.3 m (`arena.ts`) and the texture body 0.5 → 0.65 (`flamePixels`), keeping the ragged tongue and wave motion. The wider
quad's vertices (with the lick scale) reached 11.49 m — inside the 11.5 m camera clamp — so the flame anchors move
`wall.inner + 0.42 → +0.55`; the 13 cm offset from the coal pans is invisible. Contract 7/7, zero cost delta. Captures:
`artifacts/world/flames-fatter/` vs `flames-2/`.

## Stone relief: the wall gets its surface — 2026-09-18 (world lane, owner's art direction)
The owner, from the phone: the masonry colour is right but the wall reads flat and machine-smooth — "add some dents, or bits, or
other surface imperfections randomly". The diagnosis: the wall had albedo only, no light response; the sand reads real because it
has a normal map. `stoneNormal` (textures.ts) carves the relief the albedo prints: the ashlar layout is extracted into `ashlar()`
and shared (the albedo is proven pixel-identical by checksum — the owner-approved colour is untouched), so mortar grooves,
proud/recessed blocks, chamfers and the albedo's own cracks land exactly on their printed lines, plus erosion undulation, surface
tooth, two layers of pitted dents and knocked corners. The stone material gains the normal map at scale 1.1. Cost: +1 texture,
11.0 / 12 MB texture memory, +0.8 KB source gzip, zero draw-call or triangle growth. Contract 7/7, full gate + real-browser gate
green. Captures: `artifacts/world/stone-relief/` vs `polish-4/`.

## Arena v1 — The Ashpit — 2026-09-17 (world lane)
The courtyard is replaced behind the lead's seam (`src/arena.ts`, `scene.ts` untouched): a sand-and-gravel pit (owner's call: a
traditional coliseum floor, no tiles) to a podium wall whose inner face stands outside the camera clamp, a portcullis gate on the far
side with a dark passage, chains, six braziers with flickering emissive coals (no lights), eight torn instanced banners, five broken
tiers with fallen blocks, a ruined colonnade and parapet, 235 crowd silhouettes on the upper tiers that bob on a blow, lean in on a parry
and recoil on a kill (≤ 0.1 m / 8°, still in a hit-stop), an ash sky dome with one break of light and fogged mesas. Every texture is
generated at load from seeded noise (`src/assets/arena/textures.ts`; +9.8 KB gzip on the shell, 9.6 MB of texture memory, no
downloads, no licences). The seam gains `floor` (the sand mesh, planar UVs `x / 3, z / 3`) as the decal slot. Measured with the new
harness `scripts/arena-preview.mjs` (game renderer/lights/fog/lock camera, rigs at the start, settled camera; before/after in
`artifacts/world/{baseline,arena-v1}`): 263 → 12 meshes, 330 → 15 arena draw calls in the portrait lock, 4.4k → 19.4k triangles,
floor albedo ≈ 0.24 → 0.088 against the hero's skin sample 0.166 (fighters are now the brightest thing on screen). Contract
(`tests/arena.test.ts`, 7 tests, instances walked): exclusion volume, boundary ring, floor darker than skin with decal UVs, crowd
placement and reaction caps, ≤ 40 meshes / 120k tris / 12 MB textures; 5 mutations caught. Gate 223/223 + browser gate on the new
arena. Not done: phone frame-time and startup measurement (no route from the lane), lighting values (proposal), the rename — three names
proposed (The Ashpit · Worldsedge · The Bonehollow) in `artifacts/world/REQUESTS.md`; report in `artifacts/world/REPORT.md`.

## Arena life 2 — 2026-09-18 (owner's phone pass)
On the live build the owner approved firelight + gate light, rejected nothing new, and asked for two fixes. **Motes were
invisible in gameplay** — the phone camera looks down at busy, dark-speckled sand where a mid-grey speck has no contrast
and the drift was too slow to catch the eye: now 260 (62 % inside r 7.2), 0.2 m, 0.62 opacity, ~1.8× drift speed; owner: "too large, floating grey circles" → half size (0.1 m), kept the contrast + drift.
**Gear wanted inside the ring**: five more pieces (sunk shield, blade fragment, trodden helmet, snapped shaft) scattered
r 2.8–7.6, ≥ ~1 rad apart. The play-circle rule (nothing solid above 6 cm inside r 8.55) means everything lies flat or
squashed into the sand — the contract caught the shield boss at 7 cm. Captures: `artifacts/world/arena-life-2-tuning/`.
