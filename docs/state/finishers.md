# Finishers & gore — project state

## 2026-10-01 ~20:50 (+04) — HANDOFF before /clear: Blood Tithe #1217 Auditer PASS, #1256 open. READ FIRST, then memory frankendom_finishers_2026-10-01_tithe_specials.md, then the 17:20 entry below (older, partly superseded)

**Now (pick up in this order):**
1. **Nothing is mine to run.** #1217 (Blood Tithe, head `4dbc7b2132d0`) has Strategy PASS (day + Pit, v2.8 @0b0fe966) and Auditer PASS (carries to 4dbc7b21, test-only delta); Lead decides READY and sends Deploy a no-publish merge into #1120's branch once CI is green (its 'plan' job was CANCELLED, not failed; Lead re-ran it). #1256 (blood-edge `reset()`, head `9f17ffc3`, off trunk) has Auditer PASS, CI is the receipt. Check both with `gh pr view` before doing anything.
2. **Owed at #1120's trunk merge (Lead's ruling, also in #1217's body):** #1217 conflicts with trunk in `src/feedback.ts` and `src/main.ts` (my feedback.ts is an older #1216). At that one merge take trunk's `feedback.ts` whole (`src/audio/special.ts` already matches trunk); Audio then confirms the swell level (trunk plays into `arenaOutput`, mine into `balance`). Do NOT merge trunk into #1217 earlier (Lead's ruling; I had to abort one).
3. **Wait for the next special.** Capture rules now: DAY arena only for Strategy's pass, one VPS job per move, send the 5 fps strip + trimmed mp4 straight to Strategy; NO night Pit films until all 30 moves have a day pass, then one batch per lane; Strategy judges every special (Dom delegated all 30); the capture box was at load ~40, so do not queue extra jobs.

**Done today (receipts):** #1120 head `8c371bd3` merged into #1217; `tithe` is the THIRD entry in `src/special-modes.ts` (its forward pose is the mode's `held()`, combat.ts and scene.ts name no special). Blood Tithe went v2.3 FAIL, v2.4 FAIL, v2.5 PARTIAL, v2.7 DAY PASS, v2.8 DAY + PIT PASS (stills in `evidence/blood-tithe/stills/tithe28-still-sheet.jpg`, clips in `~/Desktop/Business/frankendom-blood-tithe-v28/`). Checks on 0b0fe966: `node scripts/quality-stop-targeted.mjs` 1156/1156, `npm test` 1180 pass / 0 fail / 2 skipped, tsc src + tests clean; special-tithe 16/16 at 4dbc7b21. Not run: release browser rows, phone fps.

**Open / blocked on:** Lead (READY, Deploy merge), CI on #1217/#1256, Audio (swell level after the feedback.ts switch), Combat (post-special attack lockout, after Sat 3 Oct), the next special from Strategy.

**Gotchas:**
- Strategy's Tithe limits, now pinned in tests: puffs ≤ 0.4 m (`MOTE_MAX`), ≤ 0.3 opacity (`BURST_ALPHA`), spray is a narrow cone from the real blade tip to the hero's chest (`CONE` 0.4 m half-width), nothing behind or beside the caster; red light peaks at the strike and is plain 0.4 s later (`LIGHT_PEAK`, `LIGHT_FADE`); the settling ground dust is gone by +0.4 s. The burst is a deterministic lerp tip to hero (no velocities); `age` after the landing counts from the landing tick (shadowPhase), not from the cast start (I subtracted LAND_AT twice once).
- The Auditer's lesson: an assertion must bind. My first veil pin summed puffs within 0.6 m of the head while the fixture's tip was 0.76 m out, so it read 0 at any opacity; prove a pin by mutating the constant (BURST_ALPHA 3) and watching it fail.
- Restart the VPS checkout before each shoot: `ssh frankvps`, `cd /opt/frankendom-shadow/work/finishers && git fetch origin finishers/blood-tithe && git checkout --detach FETCH_HEAD`; run scripts are `artifacts/tithe25-run.sh day|pit` (copy with sed to a new tag), they build `dist-tithe` only when its `.sha` differs, so a Pit job must wait for the day job (shared port 4814). `capture --queue`/`--status`; a plain `&` job gives no notification, use run_in_background with an until-loop on the `.done` file.
- zsh: `$C:refs/...` is a history modifier, write `${C}:refs/...`. macOS sed needs `-i ''`. Pillow lives in `/private/tmp/fin-pil` (until reboot). Evidence stills go by git plumbing onto `evidence/blood-tithe` (temp GIT_INDEX_FILE, commit-tree, push).
- `tests/specials.test.ts` exists only on the #1120 stack, not on trunk; on a trunk branch use the single-file tests that exist there. Under a deploy hold only single-file `node tests/x.test.ts` runs; the Stop gate defers (one gate per Mac).

## 2026-10-01 ~17:20 (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_finishers_2026-10-01_tithe_specials.md, then the 2026-10-01 00:10 entry below

**Now (pick up in this order):**
1. **Blood Tithe v2.3 clips (#1217, draft, preview-only).** A VPS capture job is queued ("finishers 4 of 4" at 14:13Z behind Pitborn, 2 Hero Look, Multichar): `capture finishers bash artifacts/tithe-run.sh` in `frankvps:/opt/frankendom-shadow/work/finishers` (checkout detached at cfe315f6; script builds dist-tithe, serves :4814, runs `artifacts/tithe-clip-vps.mjs` day + Pit, writes `artifacts/tithe23/`, then `artifacts/tithe23.done`). When done: `scp -r 'frankvps:/opt/frankendom-shadow/work/finishers/artifacts/tithe23/.' ~/Desktop/Business/frankendom-blood-tithe-v23/`, build the 3-still sheet (wind-up | payoff | aftermath, day top, Pit below) with Pillow, **check the 5 fps frames yourself** (is the sword arm and blade a visible line through the gather? does the thrust come toward the hero/camera?), then send paths to Strategy ("Frankendom - Strategy Dev") and Lead. Two files per arena: `tithe23-*.mp4` trimmed to ~16 ticks after the strike (before the Centurion's ordinary next attack) and `*-full.mp4`. If the job died, resubmit the same command. Dom judges; accept no look on his behalf.
2. **Then merge #1120's head into #1217** (`git merge origin/finishers/hades-shadow-claw-fx`, head 8c371bd3 at this writing) and add Blood Tithe as the THIRD entry in `src/special-modes.ts` `SPECIAL_MODES` (key `tithe`: load = import('./special-tithe.ts') createBloodTithe, `at: 'head'`, default lift, `extra(w)` = [player/opponent `hand_r` bones, anchors], `wantsHands`-style args). scene.ts on #1217 still has my old `specialId`-less `veteran && ?special=tithe` loader chain: take the registry version and move tithe into it. `advanceCast(..., isBloodTithe)` already uses World's seam.
3. **Blood-edge `reset()` follow-up (Lead's ask, owed).** #1182 MERGED 07:11Z (I wrongly kept saying it was waiting). Small PR off trunk: `createBloodEdge` rotation only resets when the tick goes backwards, so it runs on across fights; add `reset()` called on fight start (scene.ts / main.ts match start), with a test, so replays show the same strips (smear, bleed, streak).
4. When Audio's #1216 (seam `want/special/cutSpecial`, 3323b953) is on trunk: drop my own feedback.ts hunk, `src/audio/special.ts`, `src/audio/gate.ts` and the gate/special asset copies from #1217 (take trunk's on conflict).

**Done today (receipts):** #1182 blood edge MERGED (GPT's 3 painted strips, rotation, L/R only, 6 vw x 68 %, 480 ms/150 ms hold; head-on = both edges at 0.6). #1120 Hades' Shadow v3 FINAL (Dom: leave as is); base head now **8c371bd3** = d6ae070d + World's `advanceCast(..., is)` seam 6b3f2711 + #1220 Red Wind + #1223 Shield Quake (merge bcf417f1) + special registry `src/special-modes.ts` 8bd3a8a8 + special-clip.mjs timeout 97aef880 + World's `travel` hook (cherry-pick of bc45f395). #1203 Hades v4 painted sprites PARKED draft (Dom: v3 is final). #1217 Blood Tithe (Mars, Centurion rank 10, preview-only `?special=tithe`, level 46): v1 kept at `finishers/blood-tithe-v1` bad5e796; v2 look approved by Dom ("This is good"); v2.1 thrust clip forward; v2.2 arm held at contact + upper arm yawed ~29 deg out; v2.3 (cfe315f6, pushed) strike aimed at the hero, burst from the blade's real tip (sword node local Y, contact.to) thrown forward, charge strung along the blade, mist thins near it; plus my audio wiring (swell cue starts on SpecialStarted, peaks 2.0 s in = the strike). Tests tithe 13, special-fx 8, combat 10; tsc src+tests clean at 9b8e2afa.

**Open / blocked on:** Dom's verdict on Tithe v2.2/v2.3 (Strategy shows him after checking 5 fps frames); Auditer + CI on #1217; Deploy to publish /preview/ from #1120; Audio #1216 landing; Combat's post-special attack lockout (sim, after Saturday 3 Oct).

**Gotchas:**
- The Centurion's ORDINARY AI heavy_overhead starts 18 ticks after SpecialLanded (t300 -> t318, hit t352) inside the 45-tick recover window: the overhead sweep and white arc after the Tithe are NOT the effect. Strategy ruled: caster may not attack until recover ends, Combat builds it after Saturday. Do not touch the AI; trim the clip instead.
- Captures go on the VPS capture lock (`ssh frankvps`, `capture finishers <cmd>`, now first-come-first-served; `capture --status/--queue`), NOT the Mac, even for a single browser: Lead's rule, and "no deploy.sh in pgrep" is not the test (deploy_hold is). Under a hold: single-file `node tests/x.test.ts` is allowed, `node --test`, vite builds and browser runs are blocked.
- NEVER `git add -A src` (it swept in another lane's untracked scythe assets). Stage explicit paths. After a rewrite of an unreviewed own branch use `--force-with-lease`.
- The Hades/Tithe pose: the heavy raise = backhand look; a thrust clip held SHORT of contact tucks the blade at his chest; the camera is behind the hero so a forward blade is end-on. Fix in v2.2/2.3 = thrust held AT contact + `upperarm_r` yaw about world-up (`-ARM_OUT` outward, eased to 0 over the last 16 ticks, then aimed at the target's chest, held 14 ticks past the strike). The yaw is applied every frame after the mixer and assumes the mixer rewrites the bone each frame (no accumulation seen in the clips).
- The game's pale streak above the sword in a wind-up is `WeaponTrail` (characters.ts), hidden by the effect during the cast.
- The red light is the scene's own lights/fog/sky + gate light + env fill (no page overlay: HUD untouched), restored exactly on clear.
- webp: Pillow in a venv (no cwebp/magick). PIL lossless alpha doubles the size; use alpha_quality 60-70.
- Evidence images: git plumbing to `evidence/<name>` branches (blood-edge-gpt, hades-shadow-v3, hades-shadow-v4, blood-tithe: stills v1, v2, v2.1, v2.2 sheets; v2.3 sheet to add). macOS sed -i needs '' and dislikes \n: use python edits.
- No HF/ZeroGPU use (Dom's rule). Peers: Strategy = "Frankendom - Strategy Dev", Lead = "Frankendom - Lead Developer", Auditer = "Frankendom - Auditer + fixer - Fable 5.1", Audio = "Frankendom - Audio", World = "Frankendom - Visuals and World".
- Tooling: /private/tmp/fin-k2-src/artifacts (survives until reboot): tithe-clip.mjs / tithe-clip-vps.mjs (day/pit clip, 3 stills, trimmed + full), blood-real.mjs, serve.mjs; VPS copies in frankvps:/opt/frankendom-shadow/work/finishers/artifacts. Desktop folders: ~/Desktop/Business/frankendom-blood-tithe{,-v2,-v21,-v22}, frankendom-blood-gpt, frankendom-hades-shadow{,-v4}.

## 2026-10-01 ~00:10 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-30 evening entry below, then memory frankendom_finishers_2026-10-01_blood_hades.md

**Now (pick up in this order):**
1. **Blood edge, waiting on Dom's vein pick (V1/V2/V3).** Then put it on **#1182** (branch `finishers/blood-edge-retune`, frozen head `c0e7e56afe7f376aa247542fdcde7ee4ac611398`, Auditer PASS at that sha, CI never reported): LEFT/RIGHT strips only, no top/bottom, centred 66 % of height, tapered ends, safe-area + 6 px; hairline spine ≤ 3–4 px + individual 1–1.5 px veins (Dom's pick C of 09-29: "the vein/tentacle type, much thinner"; the 7be23668/c0e7e56a thick band was REJECTED); 480 ms with ~150 ms peak hold (linear effect easing, ease-out on the fade keyframe only); mapping = game's own EDGE (blow from the right → LEFT strip, from the left → RIGHT strip), overhead/thrust/low → BOTH strips at ~0.6 strength (≈ 3 in 4 blows the player takes, by move list); re-pin the px-depth test on the new numbers, keep pointer-events none. Then Auditer, CI, send Lead the full sha; it goes in the next run. Shoot the GPT capillary strip (`~/Desktop/Business/artifacts/frankendom-art-four-jobs-20260930/blood/final/blood-left-capillary-rivulets.png`, the only one that matches) as a FOURTH candidate beside Dom's pick; the other four GPT strips are the thick look, don't use.
2. **Hades' Shadow, #1120** (branch `finishers/hades-shadow-claw-fx`, head `d6ae070d15c1e4918d7fc30a44cc904d134c0828`, Auditer PASS at that sha, preview-only, NO merge until after Sat 3 Oct): claw removed entirely, the cloud is the whole move (0.7 m above the target's head, 24-tick drop onto the head on the landing tick, covers, thins, clears; violet-grey halo for the Night Pit; depthTest false), plus `CAST_MARGIN = 60` hard timeout so a cast with no end event force-ends (Auditer's #1186 P3, test fails first). Open: phone fps at `?perf=1` (only a VPS SwiftShader run, labelled, then Dom's phone after the preview refresh; the queued VPS run was the claw build and I cancelled it), CI never reported on the head, `/preview/hades-claw` refresh goes to Deploy ONLY after Dom says keep (rename the folder to hades-shadow then). World rebases #1186 (Nyx) on this head to inherit the timeout.
3. Owed, low: the VPS `?perf=1` run for the Shadow build; Executioner L2–L10 still waits on Lead's FREE; B4 WebCodecs spike still waits on Dom's phone-probe paste. Combat took over the hit-stop/parry/block/kick C/roll C seen-not-seen list (not mine any more).

**Done today (receipts):** #1182 opened (retune 12 vw strip/480 ms/safe-area, stills in evidence/blood-edge-retune) — Dom REJECTED that look ("way too much… cheap and fake"); look-test samples A–D and then veins V1/V2/V3 (12 clips + stills + -vs-reference.png in ~/Desktop/Business/frankendom-blood-samples/; Lead liked V2); Hades v2 clips (superseded) and Hades' Shadow v3 clips + three stills each in ~/Desktop/Business/frankendom-hades-shadow/ (stills evidence/hades-shadow, PR comment 1120#issuecomment-5915950802). #1174 (`--look`/`--viewport`) still READY, not mine to merge. Live at my last look was 1be74bb3 then later runs (deploys 103af66/64d1348 in flight); I did not re-curl release.json at the end.

**Open / blocked on:** Dom's vein pick (Strategy relays); Deploy for the preview refresh; Auditer for #1182 once it carries the pick; Lead for the run slot.

**Gotchas:**
- Look-test tooling lives in /private/tmp/fin-k2-src/artifacts (survives until reboot): `blood-samples.js` (injected overlay, kinds A–D and V1–V3, `__sample(list, kind, seed)`, `__tt(ms)`), `blood-sample.mjs` (frame-stepped live capture, modes forceright/forceleft/both), `blood-live2.mjs`, `hades-clip.mjs` (preview or local dist, 3 stills + 7.2 s clip), `serve.mjs <dist> <port>`, `perf-hades.mjs` + `run-perf.sh` (VPS, in frankvps:/opt/frankendom-shadow/work/finishers/artifacts/hades-perf/). Static server for a local dist: `node serve.mjs <dist> 4811`; kill by `kill $(lsof -ti :4811)`.
- The Centurion only ever lands overhead/thrust on a passive player (0 side hits in 6000 steps), so side-edge takes are FORCED on a real hit tick: say so in every message ("side forced on a real overhead hit").
- Game's blood-edge overlay is created lazily and removed/hidden nodes stay referenced by the game: to detect hits, hide with `visibility:hidden` and mark animations `__seen`, never `box.remove()`.
- Live browser captures still run under deploy_hold (Playwright); `node --test` and vite builds are blocked by the PreToolUse hook then, plain `node tests/<file>.test.ts` is not.
- zsh: `$C:refs/...` parses `:r` modifier, write `${C}:refs/...`; macOS sed needs `-i ''` and dislikes `\n` in patterns: use a python edit. Never `ps | grep` + kill in the same command as the pattern (it kills your own shell).
- `gh` needs `-R DomLynch/RPG-game` and `test -s` the body file first. Evidence images go to an `evidence/<name>` branch via git plumbing (temp GIT_INDEX_FILE, hash-object, commit-tree, push `${C}:refs/heads/evidence/<name>`).
- The Pit's `?arena=` param is ignored on the ladder; the override is `sessionStorage['frankendom.arena-override']` (1 = Ash Pit light sand, a = Night Pit).
- Peer messages: Lead = "Frankendom - Lead Developer", Strategy = "Frankendom - Strategy - Fable 5.1 [eb45ee]" (3 share the name), Auditer = "Frankendom - Auditer + fixer - Fable 5.1 [222a2c]", Deploy = "Frankedom - Deploy Githib etc. [a52045]". The stop-hook quality gate defers whenever any lane's gate or a deploy runs; CI is the gate of record.

## 2026-09-30 evening (+04) — HANDOFF before /clear. READ FIRST, then the 16:17 entry below, then memory frankendom_finishers_2026-09-30_look_flag.md

1. **Live** was 1be74bb3 per release.json at my last curl (my read, not re-checked at the end). No deploy of mine.
2. **#1174 `--look` / `--viewport` (draft -> READY for review)**, branch `finishers/sever-look-flag` @ fe9c67ee, scripts only (`scripts/finisher-preview.mjs`). VPS receipt PASS for the swap (GLB requested + `rank look ...: on` for knight-L2/L9/L10-phone; stills in ~/Desktop/Business/frankendom-knight-look-receipt/). CI at last read: quality re-run, 2 SUCCESS / 6 SKIPPED / 8 not finished. Needs Auditer's code review and Lead's merge. Not mine to merge.
3. **Knight has NO Split Crown / decapitation on trunk**: roster.ts:37 `finishers: ['plainDeath']` -> resolveFinisher null -> finisherSidePose never runs -> lock camera behind the hero (side 0.034). finisherSidePose itself gives 0.707 for veteran/goblin/knight (node check, seed 731). Lead ruled Armour's sever gate N/A. Adding the finishers waits until after Sat 3 Oct (sim freeze), and the Knight L9/L10 helm split is judged in that same PR.
4. **#1120 Hades Shadow Claw (preview-only, base combat/special-hades)**: merged trunk c59d4a46 into it -> head ae51f92e (5 conflicts in main.ts / graphics.test.ts resolved). Preview live https://frankendom.com/preview/hades-claw/ (Deploy). CI: Lead cancelled the first dispatch during the run-BG hold; I re-dispatched release-checks as run 36732656639 (in_progress at last read). Sims frozen until after Sat 3 Oct, so nothing sim-side.
5. **OPEN: Hades stills on the VPS.** `hades-stills.mjs` (a copy of scripts/special-stills.mjs pointed at the preview URL, software GL) was still running under `capture finishers` (pid 291113/302565) with windup + strike done and recover pending; files on frankvps in /opt/frankendom-shadow/work/finishers/artifacts/hades-claw-stills/ (a local copy of the first two is in the old session scratchpad only). Wind-up shows the black claw over the hero's head, the cloud hard to read on the dark floor; the strike still is at the start of recover, the claw already gone. TO DO: fetch all three, look, post to #1120 (gh pr comment / body, -R DomLynch/RPG-game), then message Deploy "done capturing" so it can retire the preview copy.
6. **Also open**: B4 part A WebCodecs spike waits on Dom's phone-probe paste (from the 16:17 entry, unchanged); Executioner L2-L10 gates on Lead's FREE.
7. **Traps**: `git switch -c X --track origin/X` FAILS when local X exists and the next `git merge` then lands on the previous branch (I fast-forwarded short-lock-camera; reset --keep to 1b7e9c9b). `git merge` after any switch: check `git branch --show-current`. The stop-time reviewer is out of quota until Oct 5 (weekly limit), so stop-hook audits fail with no fault of the work; the repo quality gate is deferred whenever another lane's gate runs (one per Mac).
8. **Sessions**: message Lead as "Frankendom - Lead Developer" (sockets change; ListAgents), Deploy as "Frankedom - Deploy Githib etc.". Worktree `.claude/worktrees/lucid-ellis-9746bf` carries this entry on finishers/state-handoff-0928 (PR #1045). No cron.

## 2026-09-30 16:17 (+04) — HANDOFF before /clear. READ FIRST, then the 12:50 entry below, then memory frankendom_finishers_2026-09-30.md

1. **LIVE 3fab84c4** (my curl of release.json at 16:17 = trunk head, #1157 pit/picker). Run AW (1e3a7434, with #1146 kick C + roll C) went live before 13:14. Nothing of mine is running, and no code of mine is in flight.
2. **DONE: won-fight live clip receipt = PASS** (owed to Lead, the B2 case). Live 1e3a7434, level 1 vs the Centurion, record `1702/killed/731` (`killed` = victim 1, the hero won). Finisher by eye: Split Crown (crown opens ~5.6 s). File 10.46 s, 720×1280, audio + video, 304 frames; tap→file 10.6 s; 0 page errors; kill ~5.6 s, fall + kill cam, down by 8.5 s, new frames to 10.30 s (no freeze on the killing tick). Not measured: the exact finisher end, so the 1 s tail is not timed separately. Posted in #1139 (issuecomment-5908179724); frames on `evidence/clip-live-win-1139` @ 6b75ab9e (sheet / kill / zoom .png); clip at ~/Desktop/Business/frankendom-clip-live-win.mp4. Lead has the path. `live-clip-win.mjs` ran unmodified (its "won" check is the clip button, which also shows on a death; confirm with the `record` field).
3. **Mac:** released to The Pit at 13:2x (Lead changed the hand-off from Hero Look to The Pit, #1149 stills).
4. **OPEN: B4 part A (WebCodecs offline encode, <5 s),** 2 h timebox spike, Lead's ruling. Waiting on Dom's paste from the phone probe https://claude.ai/artifact/1rKXbFUY6bP6dXFJ5Gb2dN (Run → Copy → paste). No full mux until his result.
5. **Queue after that (from the 09:12 entry, unchanged):** Executioner L2–L10 gates when Lead sends FREE; Hades FX #1120 polish after Dom's next look (keep the cloud look).
6. **No cron.** Worktree `.claude/worktrees/lucid-ellis-9746bf`, this entry on `finishers/state-handoff-0928` (PR #1045, open). Message Lead as "Frankendom - Lead Developer" (use ListAgents; sockets change), The Pit as "Frankendom - The Pit".

## 2026-09-30 12:50 (+04) — HANDOFF before /clear. READ FIRST, then the 09:12 entry below, then memory frankendom_finishers_2026-09-30.md (and the 09-30 lines at the bottom of frankendom_finishers_2026-09-29.md)

1. **LIVE 7d44e261** (run AV; my curl at 12:50). Deploy lock + deploy_hold PRESENT: run AW **1e3a743** is in flight and contains #1146.
2. **Went live today:** hit impact #1128 (landed blows and guards have weight; run AU). Saved clip fixes (run AV, 12:1x): **B2 #1139**, the clip plays through the finisher and kill camera and ends 1 s after it (it used to freeze on the killing tick); **B4 part 1 #1141**, a 5 s lead-in (was 9), so the wait drops to ~9 s. Live receipt PASS for a player death (9.02 s file, 9.35 s tap→file, fall + kill cam play); posted in #1139, evidence/clip-live-av-1139 @ 87974fc5, clip at ~/Desktop/Business/frankendom-clip-live-av.mp4.
3. **In flight (run AW 1e3a743):** **#1146 kick C + roll C on by default** (Dom's picks 10:4x). Merged 12:25 at a1b0b527; Lead passed the stills (evidence/hitfx-roll-kick-c-1146 @ 137f646a). After it publishes, curl release.json = 1e3a743x.
4. **OWED (Lead):** a WON-fight live clip receipt with a named finisher: ffprobe length + frames of the finisher completing, then the 1 s tail. Script `/private/tmp/fin-k2-src/artifacts/live-clip-win.mjs <outdir>` (level 1, spam light on the harness clock until CLIP shows, clock.resume, real MediaRecorder + download). The first run of that script may need fixing (untested; check that `record` says `killed`). Mac order: after AW publishes, **The Pit's 15 min, then me (~5 min)**; The Pit pings me "Mac free". Post in #1139 + verdict to Lead.
5. **B4 part A (WebCodecs offline encode, <5 s):** 2 h timebox spike, Lead's ruling. Docs: iOS Safari 16.4–18 has partial WebCodecs (AudioEncoder reportedly missing); 26 is full. Phone probe for Dom: https://claude.ai/artifact/1rKXbFUY6bP6dXFJ5Gb2dN (Run → Copy → paste). No full mux until his result.
6. **Rulings today:** Dom GO kick C + roll C default; the roll lean follows "always on incl. reduced motion" (Strategy; a settings toggle if anyone ever complains). Look-branch `-c` contact-log fix b7339c3a (trunk has no contact log). A VPS dist lives until its PR is READY, then Auditer deletes it (all mine deleted). Mac look clips are frame-stepped on Metal (vstep.mjs), 17–19 s per take; never real-time on the VPS.
7. **Lessons:** `gh` outside a repo dir fails silently, so always pass `-R DomLynch/RPG-game` and `test -s` the body file before `gh pr edit --body-file` (I blanked #1128's body once; restored from GraphQL userContentEdits). While a deploy runs, the deploy hook blocks even single-file tests, so CI is the first run; run quality-stop-targeted before READY.
8. **Sessions:** none for Dom to restart. Message Lead as "Frankendom - Lead Developer [387ea1]" (sockets change; use ListAgents), Strategy via its last uds.
9. **No cron.** Worktree `.claude/worktrees/lucid-ellis-9746bf`; this entry on `finishers/state-handoff-0928` (PR #1045). Scratch tools in /private/tmp/fin-k2-src/artifacts (vstep.mjs, vstep-ev.mjs, ac2.sh, cap.mjs, live-clip*.mjs); /private/tmp survives until a reboot.

## 2026-09-30 09:12 (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_finishers_2026-09-29.md (09-30 lines at the bottom)

1. **#1128 hit-impact (REAL PR, Dom approved, ON by default, rides run AU with #1127/#1115/#1129).** Branch `finishers/hit-impact`, head **7f889938**, CI GREEN (run 36670069388, all jobs). `src/hit-impact.ts` tiers: full (heavy/charged/GuardBroken/skill_*) +5 f + 4 cm knock away from the blow; half (other landed hits) +3 f / 2 cm; parry +11 f + 7 cm jolt toward the attacker; block +2 f / 2 cm knock. Always on incl. reduced motion (owner ruling; `if (still) return` removed from rig.shove). `?duel=` turns off only the EXTRA stop (knock stays). Fix-forwards: graphics module map, browser-check riposte waits for the float, graphics hit-stop rows = base + impactStopMs read on the contact frame. **Owed before READY: fight-camera stills in the PR body** (trunk 5f2f622a vs PR 7f889938, 375, idle + parry + block + guard break at +1/+4 frames; say "VPS software-GL frame-stepped"). They were SHOOTING at 09:12 on the VPS (capture lock held by finishers, pid 104238; output /opt/frankendom-shadow/work/finishers/artifacts/stills/*.png, log run-stills.log → "STILLS-DONE"). Then: scp them home, push to an evidence branch, add to the #1128 body, tell Lead "stills in".
2. **Look tests (look branch `finishers/look-hitfx-guard` @ ca644e96, NOT for build):** `?look=hitfx-ring` (ring, Dom: OFF), `hitfx-log`, `hitfx-kick-a|b|c`, `hitfx-roll-a|b|c`. Delivered to ~/Desktop/Business: frankendom-hitfx-guard-ringoff.mp4 (Dom approved the tiers from it), -guard-ring.mp4, -kick-a/-kick-b (Dom: no difference → A shape wins, B dropped), -roll-a (old 2°), -roll-b (Dom: B dropped). **Owed to Strategy (Dom waiting):** (a) frankendom-hitfx-roll-ac.mp4 = roll-A at 5° | roll-C tumble (8°, 8 cm dip, 4.6 cm shift), same roll, real speed then quarter; (b) frankendom-hitfx-kick-ac.mp4 = A | C (10 cm drop), same kick, quarter speed, impact held 1 s, captioned. VPS dist-k2 is built from ca644e96. Roll takes: `run-rolls.sh` waits for a `go-rolls` flag file (Lead queue: my look clips come after Hero Look/Armour; `touch go-rolls` when Auditer says you're up). Compose with artifacts/ac.sh (CAP_A/CAP_C env, HOLD=1 for kick, frame from the contact log `frame`). Kick takes: MODE=kick vstep.mjs with hitfx-kick-a and hitfx-kick-c (same seed → same frames).
3. **VPS rules (Lead/Auditer):** `ssh frankvps` / `scp … frankvps:` only (one multiplexed connection), max 2 sessions, no polls faster than 1/min, never retry loops (ufw rate-limit locked every lane out once). Every capture goes through `capture finishers …` (lock + queue; `capture --status`). Real-time recordVideo on the VPS runs at 1/5 speed: NEVER; frame-step with scripts/lib/harness-clock.mjs (vstep.mjs + enc.sh). Never `pkill -f` a pattern that matches your own ssh command (it killed my session twice); kill by pid. Workdir /opt/frankendom-shadow/work/finishers (artifacts/: vstep.mjs, stills.mjs, enc.sh, ac.sh, sidebyside.sh, run-*.sh). Mac: nothing heavy while deploy_hold exists; Lead posts "box FREE".
4. **Clips go to ~/Desktop/Business/**, never ~/Developer/frankendom-finishers (this worktree session may not write there).
5. **Queue after that:** Executioner L2–L10 gates (gate 1 L8–L10 + gate 2 seed 731 + L5 open-hood decap spot) when Lead sends FREE; Hades FX #1120 polish after Dom's look.
6. **Worktree** `.claude/worktrees/lucid-ellis-9746bf`, this entry on `finishers/state-handoff-0928` (PR #1045). Message Lead/Strategy/Auditer by their uds address from their last message or by name (two "Lead Developer" sessions exist: use the local one's ref).

## 2026-09-29 22:18 (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_finishers_2026-09-29.md (bottom lines)

1. **IN FLIGHT — Hades' Shadow Claw FX** (Dom GO; brief docs/briefs/special-moves-hades-pilot.md on #1113). Draft PR **#1120**, branch `finishers/hades-shadow-claw-fx`, base `combat/special-hades` (Combat's #1121), **head c698285b**. Files: `src/special-timing.ts` (three-free timeline; land = start + RULES.special.windup − 1; form 18 / fall 12; SPECIAL_RECOVER imported from Combat's `src/special-look.ts`), `src/special-fx.ts` (lazy, procedural: 14-sprite cloud, 4-talon claw, 20-sprite burst; no GLB, no shadows, no Math.random), `src/scene.ts` (dynamic import the first frame a fighter has `specialShare`; Combat's stand-in `specialCloud` removed — re-check after every merge of combat/special-hades, it came back once), `tests/special-fx.test.ts` (timeline, keying, back-dated pickup, full cast in a node scene, cloud anchored on the TARGET's Head at CLOUD_HEIGHT, no static import). Seam agreed with Combat: SpecialStarted/Landed/Fizzled, actor 1 + `skill_lunge` + nightborn. Knee-dip on the struck target = Combat.
2. **Dom's verdict on clip v1 (22:0x): "quite cool, liked the black cloud, better than GPT."** RULE: keep the cloud's LOOK exactly as b57ead2b (radius 0.12+0.34·hash, puff 0.4+0.3·hash, peak opacity 0.9, churn). Allowed changes so far: CLOUD_HEIGHT 0.95→0.5 (parallax: the fight camera put the cloud on Hades's torso), near-black claw, slower tear. All in c698285b.
3. **Receipts:** Combat's slot on 1d855411 (= b57ead2b + b0e96f61): eslint PASS, typecheck:tests PASS, 98/98 tests (special-fx, special-look, specials, graphics) PASS, build `--base=/preview/hades/` PASS with its own special-fx chunk. **c698285b itself not yet run** (3 constants) — asked Combat to re-run the 4 steps on the new hades-preview merge before clip v2 → Deploy. #1120's own CI SKIPS every check (base isn't trunk): don't count it.
4. **Closed-helm gates today, all PASS (evidence branches):** Pitborn L8–L10 (`evidence/pitborn-looks-gate`; L4-phone collar re-issue 640373bc 0.0 cm), Centurion L2–L10 (`evidence/veteran-looks-gate`; L10 re-issue 4bb37c7b/c8dd5227 fixed the loose-island debris), Shieldmaiden L2–L10 (`evidence/shieldmaiden-looks-gate`), Knight #1074 trimmed 5006ea65, Witch #1068 by sha.
5. **QUEUE:** (a) Executioner L2–L10 gates — PRE-EMPTS everything the moment Armour's L8 lands: gate 1 by sha on the packed files + closed-helm rule L8–L10; gate 2 NEEDED (no finishers key): L8–L10 decap + splitCrown ON vs OFF, seed 731 (only 5/40 win), L10 opened/runThrough spot, PLUS an L5 hood decap spot (open hood keeps GPT weights; tear/float → head table to Lead, reweight to Armour). His Reaping Scar throws floor fragments — use the look-OFF control. (b) Hades polish after Dom's next look (keep the cloud look). (c) Row 0t flake (auto replay ends 1–4 ticks late, look on or off) routed to Hero Look via Lead.
6. **Rules:** NO local runs of any size without Lead's "box FREE" (memory feedback_no_local_runs_without_box_free). Builds go to `/private/tmp`, never `~/Desktop` (iCloud + indexers → load 250 killed runs). Probe tools in scratchpad are gone after a reboot; recreate helm-probe/sever-sim from `origin/evidence/finishers-probe-tools`; islands2.mjs/dist-sim.mjs are not saved there (small, rewrite: per-island tris/offset/Head/y).
7. **Worktree** `.claude/worktrees/lucid-ellis-9746bf` on `finishers/hades-shadow-claw-fx` @ c698285b, clean. Message Lead / Combat / Armour by name (Armour: use the ListAgents ref; sockets change on restart).

## 2026-09-29 ~09:00 (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_finishers_2026-09-29.md

1. **Nothing running, nothing owed on the box.** Live was b10a9f3f at 06:3x (release.json = HEAD, checked). No code of mine in flight.
2. **Closed-helm gates, all PASS (verdicts sent to Lead + Strategy):**
   - **Gate 2 (look-on stills, decap + Split Crown), L8–L10.** Nightborn and Dwarf PASS on tree 85b8b90c1d59 (local merge of #1030 814a2c8d + deb50812). Dwarf replay fixed by deb50812 (seed 828, tick 2248, hero wins). Dwarf Split Crown L9/L10 cleared by a scene mesh dump (all near-head meshes = SplitCrown halves; helm draws collapsed). The Nightborn verdict carries to #1025 @ 51d87f00 (same finisher code and L8–L10 bytes; that head lacked deb50812, Hero Look to rebase). Goblin retro PASS on live b10a9f3f with trunk rank-look-check (row 0r: victim 1, browser tick 3443 = Node tick).
   - **Gate 1 (Head weights + sever sim).** Knight L8–L10: the original files FAILED (helm fused in Armour mesh, smear up to 16.2 cm). Armour's helm split PASSES (full 6374c001 / cd388f60 / bddec7f8, phone 2ecd3f7f / 757f10d7 / b8dda166). Knight gate 2 waits for a decap/Split Crown pairing ruling (he is plainDeath-only). Witch L8–L10 PASS, all six (full b3ecc3a7 / d9d1038e / 7207517f, phone 81b1c4f2 / 57120234 / f0e0a443; handover-l2l10). Witch gate 2 is N/A (finishers: []).
3. **OWED:** re-confirm Witch L9/L10 by sha on #1068's tree once Hero Look wires them (head 5467fc2c had L8 only). Then the queue: Veteran L8–L10 look-on stills, Pitborn, Dwarf + Shieldmaiden `--price` rows.
4. **Rules learned:** probe the exact shas from the PR sha table (`git show <head>:public/looks/…`), never a run dir (my Witch L8 16c80177 row was Armour's proof file, not the shipped b3ecc3a7). Use TRUNK's rank-look-check: it needs `--build` (a plain `npm run build` dist has no stamp: "dist is not the build of this tree") and row 0r gates victim 1. A reboot wipes the scratchpad; tools are on `origin/evidence/finishers-probe-tools` @ e80bf7aa (helm-probe, sever-sim, seed-search, sheet3.sh, dump.js, tier-path.patch; fix their absolute import paths if run outside this worktree). zsh: `${T}:path` needs braces.
5. **Worktree** `.claude/worktrees/lucid-ellis-9746bf`, branch `finishers/state-handoff-0928` (this entry, docs only, PR #1045). Message Lead / Strategy / Hero Look by name; Armour has two sessions with that name, so use the ref of the local one (ListAgents).

## 2026-09-28 23:15 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-27 22:47 entry below, then memory

1. **LIVE e9107428** (my curl of release.json, 23:15). Deploy lock PRESENT: 8f1bb783, started 19:15Z, pid 78679 (Deploy's run). Nothing of mine running.
2. **Done this session (reviews and gates, no game code):** Goblin look-on finisher re-shoot on #918 @5a26a50e (frozen packed4 l3/L8/L9/L10 × decap/splitCrown/opened/runThrough) = PASS all 16; evidence `evidence/goblin-look-on-918` @ 7c9b9e45. #961 (Goblin rank looks ON) closed-helm finisher gate on the shipping `?tier=Primus/Invictus/Origin` path = PASS L8/L9/L10, helms 100 % Head; evidence `evidence/goblin-looks-on-961-finishers` @ 94f4f26f. Nightborn gate 1 (Head weights, packed bytes) = PASS on all six closed-helm files: full L8 34a6e8ad / L9 7132ff9d / L10 18b8c899, phone L8 22e1a5df (regenerated after an overwrite) / L9 c9940a7c / L10 5f4c8fa5. Dwarf gate 1: first pack FAILED (helm shards and collar would smear 14–29 cm on sever; retired to artifacts/looks/dwarf/rejected/), Armour reweighted, re-pack PASS on all six: full L8 24506c95 / L9 ace5793f / L10 71d9dacc, phone L8 74ebab57 / L9 fe0d8865 / L10 41b2fd06. Dwarf replay seed search (CPU): a seed wins (828, 2,248 ticks; 16/40), so rank-look-check runs unmodified, no fallback needed.
3. **Correction on record:** my Goblin L8–L10 reports said Split Crown keeps the closed helm whole; wrong. characters.ts splitCrown → sever() → skull.ts splitSkull cuts every head-group mesh at x = 0, helm included (zoomed L10 still confirms).
4. **Rulings (memory frankendom_finishers_2026-09-27.md, 09-28 lines):** Strategy (a): Split Crown cleaves a closed helm with the skull; decapitation takes the helm with the head; no roster change (Nightborn, and the Goblin retroactively). Two hard gates per closed-helm opponent (Nightborn, Dwarf, the Knight when he gets a pairing), both mine: (1) Head-weight probe on the PACKED files, anything under .5 Head goes back to Armour (not a runtime fix); (2) look-on stills L8–L10 × decap + Split Crown, a floater or smear = FAIL. Closed-helm rebake fallback (Hero Look #1025 Nightborn / #1030 Dwarf): my pick is `runThrough` (it cuts nothing and reads no bake; Opened needs its own waist bake), plainDeath as last resort.
5. **Sessions:** none needed from Dom for this lane.
6. **QUEUE (browser slot from Lead, after the Combat battery):** (1) Nightborn gate 2: look-on stills L8/L9/L10 × decapitation + splitCrown on the six shas above; (2) Dwarf gate 2, same; (3) Veteran L8–L10 look-on stills; (4) Pitborn look-on stills; (5) Dwarf + Shieldmaiden `--price` rows. Method: build the PR head, copy the packed files into dist/looks, `node scripts/rank-look-check.mjs --opponent <opp> --look /looks/<file> --dist dist --skip-load --finishers decapitation,splitCrown --look-only --label <x>`; for the shipping path use the local-only tier swap (scratchpad tier-path.patch, never commit). CPU tools (parked on origin/evidence/finishers-probe-tools @ ea10c550; fix their absolute import paths before running): helm-probe.mjs (per-mesh weight by joint), sever-sim.mjs (sever triangle split + collapse distance), seed-search.mjs (rank-look-check:134-137 incl. recorder), sheet.sh (ffmpeg 4×4 grids).
7. **No cron.** Worktree `.claude/worktrees/lucid-ellis-9746bf`, branch `finishers/state-handoff-0928` (this entry, docs only). Message Lead / Strategy / Hero Look by name; Armour = "Frankendom - Armour [d88554]" (the local one; two share the name).

## 2026-09-27 22:47 (+04) — HANDOFF before /clear. READ FIRST, then "Now (… /clear handoff)" below, then memory

1. **LIVE 054603e0** (my curl of release.json, 22:47). No deploy lock. Nothing of mine running.
2. **Done this session (reviews, no code):** Goblin look-on stills (Hero Look #918, L3 / L8 anansi / L9 hermes / L10 loki) = **PASS all four**, sent to Lead: the helm goes with the head on decap, the stump is clean, splitCrown keeps the closed helm whole (the split is hidden under it, as on trunk; a design note, not a fault), opened is clean, auto = decap. **Veteran looks:** code read found that wearLook keeps HIS draw on a shared name, so the look's boots-only `CreatureBody` would have left his own 38,979-tri body visible under the armour. Lead ruled rank-look path + rename; Armour renamed the boots to `L<n>_Boots`. **Probe PASS on all eight renamed files** (L2,3,4,5,7,8,9,10 in laughing-meitner-7d47c2/artifacts/looks/veteran, 21:06): 0 CreatureBody, 1 boots node, no keep extra, 65 joints/38 clips; added tris L2 34,443 … L8 38,830 / L9 39,578 / L10 40,159; helms 100 % Head, skin 0.3–2.6 % with the head (neck).
3. **Not done:** the Veteran L8–L10 look-on finisher stills (browser). They are held by Lead's QUIET WINDOW (Hero Look's 30-min #918 timing run at load ≤ 15; no builds/tests/browser until Lead posts "QUIET WINDOW END"), then the browser is mine.
4. **Sessions:** none needed from Dom for this lane.
5. **Rulings (in memory, frankendom_finishers_2026-09-27.md):** BETA LOOK SET = Veteran, Goblin, Pitborn L1–L10. Veteran looks ship on the rank-look path (#918 streaming), not as a drop-in. Boots node renamed (option a).
6. **QUEUE:** (1) after QUIET WINDOW END, per rank L8/L9/L10 on #918 head (≥ bbf20952): `node scripts/rank-look-check.mjs --opponent veteran --look /looks/veteran-L<n>.glb --finishers decapitation,splitCrown,opened,auto --look-only --skip-load --label veteran-L<n>`; judge from contact sheets (ffmpeg tile/crop; no PIL or magick on this Mac); proof the old body is gone = CreatureBody in the cost `hidden` list + added tris as above (~78k = old body still on) + one close still per rank with no skin through the armour. PASS/FIX per rank to Lead. (2) Pitborn look-on stills once GPT delivers and Armour fits. (3) Dwarf + Shieldmaiden `--price` rows.
7. **No cron.** Worktree `.claude/worktrees/lucid-ellis-9746bf`, branch `finishers/state-handoff-0927`, PR #926 (docs only, open). Quality gate on this tree: `quality-stop-targeted` rc=0, 761/761, 550 s (20:5x). Lead = "Frankendom - Lead Developer", Armour = "Frankendom - Armour" (message by name).

## Now (Finishers & Gore lane, 2026-09-27, /clear handoff)

**Idle, nothing running.** #868 and #871 are live (see below); the state-doc PRs #874 and #887 are merged. Message Lead by name ("Frankendom - Lead Developer"), since its socket changes on a restart.
**Waiting on stills to judge (Lead pings):** (1) Hero Look #918 look-on stills, Goblin L3 then L8 anansi / L9 hermes / L10 loki (closed helms): pass/fail per look × decap / splitCrown / opened / auto kill-cam. Weights already PASS: Armour's pre-check, confirmed here, puts every helm at 100 % Head, and only Face/Photo split, as on trunk. L10's orange mask = a GPT fault, not ours. (2) Veteran (Centurion) L8 barred / L9 winged enclosed / L10 gold mask, the same review after Armour installs them.
**#918 reviews sent:** the sever() `!object.visible` skip is PASS. The stale opened bake gives the same result wherever it runs. On the stall, Lead ruled: settleOpened only on the Killed freeze (220 ms) and only when the finisher is 'opened', with openWaist on-demand as the backstop; Hero Look owes a CPU ×4 receipt. Minor: prepareOpened leaves root.visible = true.
**Then:** the Dwarf + Shieldmaiden `--price` rows (the Dwarf needs a driver that wins).

## Earlier Now (Finishers & Gore lane, 2026-09-27 ~02:20) — FROZEN at 26082c3c

**Standing rule (Dom 2026-09-27 10:1x, via Strategy, all lanes):** "dont set fake extended deadlines or times, everything is NOW or ASAP." The only deadline this lane gives to Dom, Lead or Strategy is NOW or ASAP. If now is physically impossible, name the physical blocker (a battery running with minutes left, a red gate, the box busy / deploy lock, load over the limit, an HF quota), never a day or a time.

**Frozen for the night at live 26082c3c** (release.json checked; Lead: "Finishers is done for tonight"). Nothing in flight. Next session: the Dwarf and Shieldmaiden `--price` rows (below), unless Lead assigns something else.

**Done — #868 E2 option 2 LIVE (111d6504, 01:17).** Lead's option 2: `camera.ts` `TOUR.lookYPortrait 1.3` (landscape `lookY 0.7`) when `camera.aspect < 1`, so on a phone the arena-cam tour drops the fallen below the E2 loot card. Goblin decap at 375x812, 1 shard, local-only `fallenMarks()` probe + `--price` sampler: trunk 13a90467 had neck+chest under the card 4–10 s (worst 13,230 px², corpse top 397@6 s / 386@9 s vs card bottom 455); 6fffc40f 0 px² from 4 s (477 / 463); 2a848f87 (on trunk 99f21cc3) 0 px² from 3 s (478 / 462). Opened: neck+chest under the card 0–3 s, clear from 3.5 s, waist cut and pool visible at 5 s (sent to Strategy to close as ordinary). Buttons 0 throughout. Row 25 exit 0 on 2a848f87; rows 16/21/28 ran to receipts on 6fffc40f; camera.test 13/13. Stills: `evidence/tour-look-portrait` @ d95357c7. **Open gap (accepted by Lead): Dwarf decap unmeasured.** The scripted player lost 3/3 on easy (pre-existing); no substitute numbers.
**Strategy rulings 23:4x:** option 4 YES, plainDeath neck under the card 0–4 s = the ordinary kill, no change. Options 1 and 3 go to Dom's morning table with stills.

**Done — #871 waist-cut shadow LIVE (26082c3c, 02:17; Lead confirmed `receiveShadow` in the served JS).** The Opened cut cap glowed flat orange in shadow: the `WaistCut` mesh (`opened.ts:110`) never set `receiveShadow`, while the halves do (`:91`). Not a missing map (the cap has none by design). One line + `creature-opened.test` asserts cap.receiveShadow == body.receiveShadow (fails 2 of 3 without it). quality-stop-targeted 713/0. Before/after: `evidence/waist-cut-shadow` @ 33c58482 (eye comparison; Lead accepted that for a one-line flag).

**Next:** Dwarf + Shieldmaiden `--price` rows, 1 shard, load < 30. The Dwarf needs a driver that actually wins (scripted loses 3/3 on easy; the hand bot `dwarf-drive.mjs` lost 0 vs 43). The Shieldmaiden has no `finishers` key, so she plays all five unmeasured. Witch/Knight/PD widening on `finishers/new-four-measure` @ 4eb94a4c (ONE PR, ONE RECORD_VERSION bump).

**Gotchas (09-27):** neither harness is pixel-deterministic run to run. The quiet-one duel went tick 1453 vs 900 on the same build; finisher-preview's shadow band shifts. So A/B stills are an eye comparison. finisher-preview serves source via a vite dev server (no build); quiet-one-browser-check serves `dist/` (rebuild per side). In shell runners capture `rc=$?` straight after `wait`: `echo "$(date) $?"` reports 0. In zsh, `$c:r...` in a refspec is a history modifier; write `${c}`. Check the lock AND Lead's slot: a load-only gate would have started before the 00:43 slot.

## Earlier Now (2026-09-26 evening)

**NEXT after /clear (20:4x, 2026-09-26), in Lead's order:** wait for FREE from deploy 849b8f98 (#848 E2 loot card + #852 revert of #850) and load < 30. Then on branch `finishers/kill-cam-e2` @ c2baf9c4 (= trunk 849b8f98 + `fallenMarks()` probe in scene.ts/main.ts, presentation-only, no bump + the #850 loot-beat sampler that now logs which of head/neck/chest/wounds sit inside `#loot-panel` while `data-on='1'`): `npm run build`, then (1) Goblin DECAPITATION `node scripts/quiet-one-browser-check.mjs --finisher decapitation --opponent goblin --blood-check`, read the line "loot card over head/neck/chest/wounds". If neck (the stump) is covered, SEND TO LEAD AT ONCE. (2) Same for opened, quietOne (`--opponent goblin`) and `--finisher plainDeath`, Goblin; then the Dwarf via the hand driver (`dwarf-drive.mjs` + c.sh/s.sh on `evidence/kill-cam-sweep` @ c2b1eb26; `BASE=http://127.0.0.1:<port>` against `npx vite preview` of the same build; fight = `hold KeyW 100`, `press KeyF`, `run 500`, repeat; then `beat`). One line per finisher to Lead: head Y/N, neck/wound Y/N, clear-by time, stills. (3) Then the Shieldmaiden: `finisher-preview --only splitCrown,decapitation,runThrough,opened,plainDeath --opponent shieldmaiden --no-video --label shieldmaiden-measure` (she has no `finishers` key, so she plays all five UNMEASURED on live), then Witch, Knight, Plague Doctor on `finishers/new-four-measure` @ 4eb94a4c (a local widening of their lists; the final roster change = ONE PR, ONE RECORD_VERSION bump 15→16 + SIM_DIGEST re-pin, roster.ts is in SIM_FILES).

**Context (20:0x–20:4x):** #850 (the kill-cam gate) merged, then Deploy's run on d2abd9d4 failed rows 16/21/28 against #848's E2 card (worst px²: decap 9934.5 at 7 s, quietOne 4851.6 at 10 s, opened 3481.6 at 4.5 s, buttons 0) → #850 REVERTED (#852); this state doc's evening entries went with it (restored here). From Deploy's stills (evidence/kill-cam-sweep @ ac3cd57d, e2-trunk-d2abd9d4/): decap severed head clear, stump LIKELY under the card (my still reading, not a projection); opened head+belly clear; quietOne hidden by the killer. Lead + Web: the card already shows only after the finish completes (main.ts:500, scene.ts:866-871, opacity 0 until data-on=1), so part of #850's px² counted an invisible box; no delay PR. The gate PR re-opens with the calibrated numbers per Strategy's ruling. Never raise a threshold to pass.

**Now — kill-camera sweep** `finishers/kill-camera-sweep` (trunk merged; assertion 8d24528b). quiet-one-browser-check samples the fallen body's box against the loot panel and its Take/Leave buttons every 0.1 s over 0–1 s, then every 0.5 s to 10 s, and asserts: never over the buttons; never over the panel, except a plain death's first 3.5 s. Goblin at 375x812: splitCrown and opened 0 px² throughout. runThrough/decapitation 0 in the 09-25 sweep.
**Plain-death hold, ACCEPTED (Strategy 2026-09-26, "an ordinary kill stays ordinary", no camera code):** Goblin plainDeath series (ms: panel/buttons px²) 0–2000 all 1937.5/0, 2500 1782.5/0, 3000 232.5/0, 3500–10000 0/0 (head 4c9907af). The killer hides the corpse (no finisher camera for a plain death, so the lock frame sits behind him); only the corpse box's top grazes the panel's bottom edge; the panel never covers the head or wound. It clears when the arena cam starts to orbit. Stills: branch `evidence/kill-cam-sweep` (t0 / 5s / 10s). A plain-death slide in camera.ts was proposed and declined.
**Dwarf plain death, ACCEPTED on the Goblin's terms (Strategy 2026-09-26, no camera change).** The scripted player can't kill the Dwarf, even on easy, so this was hand-played on live 36d4aecc at 375x812 on easy (won 109 HP to 0) with a paused-clock Playwright driver. Series (ms: panel/buttons px²): 0–2500 all 2251.6/0, 3000 1354.9/0, 3500–10000 0/0. Fallen box y 344–502 vs panel y 148–361: only a 17 px strip under the panel's bottom edge. The killer hides the corpse at t0; from 5 s the corpse, head and blood pool are clear. Stills + series: `evidence/kill-cam-sweep` @ 3baee222, `dwarf-live-36d4aecc/`. **Both cases:** Goblin 1938 px², Dwarf 2252 px², clear by 3.5 s, buttons 0 throughout, head and wounds never covered by the panel. Driver gotchas on live: `getByRole` taps on the welcome form never resolve (submit via `requestSubmit()`, set `#finisher-select` by value + change event); preset difficulty with `addInitScript` on `frankendom.difficulty.v1`; use `executablePath: chromium.executablePath()` + deviceScaleFactor 1 (at DSF 2 on the bundled headless shell, 500 ms of game time took ~2 min at load 60).
**Known gap:** the harness's later `Death_QuietOne` clip regex exits 1 for splitCrown/runThrough/plainDeath. The framing lines and the new assertion run before it. Not fixed here (Lead).

**Done 09-26 afternoon**: #823 (short-opponent lock camera, the #752 redo) READY at 295fa707. The Goblin/Dwarf lift and shoulder step ease out over 1 s (smoothstep) once a finish begins, so every kill settles on trunk's frame. Rows 16/21/28 + row 25 Goblin/Dwarf exit 0; camera.test 13/13. Lead sent it to Deploy. Stills on `evidence/short-lock-camera-823`.

**Gotchas (09-26)**: rows timed out on a hidden `selectOption` on a pre-#821 base (a harness change, not the code under test): merge trunk first. The per-run lock check has a race: a run can start seconds before Deploy takes the lock (it happened at 17:08), so check the lock AND Lead's run plan. A test's "pass N" line can hide the fail line under `head`: grep both `ℹ pass` and `ℹ fail`. This session's app worktree (`.claude/worktrees/lucid-ellis-9746bf`) is where edits land; the Edit tool refuses ~/Developer/frankendom-finishers from it.

## Earlier Now (2026-09-26 morning)

**Now — #792 READY** (row 32 wounds gate) `finishers/row32-timeouts` @ 192cf476, MERGEABLE, handed to Lead via Strategy (Lead offline after its restart): the CPU ×4 budget is opt-in with --budget; both contexts setDefaultTimeout(120000). Row 32 as released exits 0 in 46 s; with --budget it exits 0 in 90 s, so the budget was about half the row. Tests 16/16. The body does not claim it fixes the flake: Deploy's keep-the-first-attempt log (part 2) settles the cause. Not mine to merge. Nothing else is queued for this lane; next is whatever Lead assigns (#752 redo and the kill-camera sweep below are older, still open).

**Done 09-26**: #777 (row 23 split into three) MERGED. **Rivet A PARKED** (#797 closed `parked`, branch `finishers/rivet-a` @ d94d8ea4 kept): first still failed (flat white ellipse, ring over the hero, pale rivets); on the retry the ring was gone and the bolts dark, but a depth-tested dent is hidden by the Knight's own helmet/pauldron at the blow site and by his arms and hammer on the breastplate. Forced-red debug proved it drawn and occluded. MarkLook.depthTest and MarkLook.lift live on that branch. Strategy: a future Knight mark goes on a surface the fight camera sees (pauldron top or helmet), not the chest. Knight On stays Rivet B. **Black floor oval IDENTIFIED, not gore**: a camera raycast in the Witch kill frame hits World's arena scatter (merged `iron` mesh #2a2623, no map): the sunk shield at scatter [3.1, 2.4] (arena.ts:333, 14-seg cap, boss nearly flush) and the trodden helmet at [4.6, 3.3]. Handed to World, who fixed it in #799: both pieces are out of the in-ring scatter, LIVE at eeae57a6 (release.json checked; before/after on origin/evidence/world-scatter-799). CLOSED. The diagnostic is `lane-notes/diag-black-oval-pick.patch` (debugPick in scene.ts + harness `--pick` / `--pick-at fx,fy;…`). Witch staff: a Witch kill plays no finisher in either direction (finishers.ts:21, roster witch finishers []), so no spike needed.

**Next — #752 redo (Lead/Strategy, Goblin lane dark)**: short-opponent lock camera (Strategy's ruling C: scale < 1 lifts the camera + an over-the-left-shoulder step near contact, camera.ts cameraPose + scene.ts; old branch goblin/lock-camera-height @ d76c917a). It failed release row 25 (`finisher-preview --only decapitation --opponent goblin --label decap-front-goblin-gate`: "headless corpse is seen past the killer", maxCameraStep .0077, side .109) and was reverted by #757; row 25 passes without it. Redo off trunk: keep C for the FIGHT and give the finisher its own framing (for example, fade both terms once a finish starts). Before READY: the finisher-preview release rows locally for Goblin AND Dwarf (decap + the other beta finishers), plus a fresh pair of 375 stills matching C.

**Then — kill-camera sweep**: branch `finishers/kill-camera-hold-r` @ f7906420 (pushed). Lead's rule: the body stays clear of the loot panel AND its Take/Leave buttons (measured boxes; the 40 % line is dropped). quiet-one-browser-check now logs panel/button boxes and samples overlap every 0.5 s for 10 s of page time (stills at 5 s / 10 s). At open (375×812, vs goblin): panel y 148–351.5, buttons y 721–761, body y ≈ 408–565. Sweep so far: runThrough and decapitation 0 px² overlap in 21/21 samples; splitCrown, opened, plainDeath still owed. If all clear: NO camera change; one PR that turns it into an assertion inside the existing quiet-one row (no new release row). Killer occlusion of the corpse (the decap still: the hero stands in front of the goblin) is its own later item.

**Done today (2026-09-25)**: #748 (Auditer's applyBoneTransform override) reviewed by reading against three 0.186.0: the same maths minus the spread, so the wound re-glue is unchanged. Grey blood on the hero's tunic (live cc27cce5) reproduced and closed as NOT gore: the blood stays red on the worn Knight set with and without env reflection; the grey-blue is the Knight carrier drawn flat and untextured (routed by Lead to Character Main / #709).

**Open**: Nightborn head-slot mark −2.7 cm (parked). Hero chest wounds are hidden from the behind-the-hero camera (parked).

**Gotchas (09-25)**: macOS has no `timeout`/`gtimeout`, so use a bash until-loop. The PreToolUse deploy guard blocks the WHOLE compound command, including appends/edits, if it holds `node --test`; it even blocks single-file tests during a deploy. quiet-one-browser-check's default opponent (veteran) no longer yields a kill (scripted player loses 3/3), so use `--opponent goblin` like the release rows; its later Quiet-One clip assertion fails for runThrough/splitCrown/plainDeath, but the framing lines print first. The finisher-preview harness runs signatures OFF: pass `view.setSignature('?signature=B', null, true)`. Inside the harness's page template you cannot use backticks (it is itself a template literal). Signature body marks are lit metal (metalness .6) with depthTest off; dark at .6 over mid-grey steel reads as nothing at 375. Hold browser runs until load < 30 and no deploy lock (Lead's standing rule).

## Earlier Now (2026-09-23 afternoon)

**Now**: PR #571 `finishers/floor-blood-real` @ 6efc7d3 (floor blood stains the sand). Handed to Lead for the batch with the shield and zoom fixes; the local blood gate and wounds gate both exit 0. Next is Dom's verdict on the phone once it is live. After that, the parked kill-camera framing (`finishers/kill-camera-hold`, measurement only, a separate PR per Lead's sequencing), then briefing Lead on the `characters.ts` finisher-geometry interface scope before touching that file.

**Done today**: #544 (B/C/D body-wound art rotating per hit, tint off black, floor stars gone) MERGED; #549 (drops from the body to the sand, CPU ×4 receipt) MERGED; #546 (quiet-one check waits for a live Rematch) MERGED. Step 0: the hero's runs are NOT clamped by `surfaceReach`; all 5 marks are uncapped (asserted in the wounds gate).

**Open**: Nightborn head-slot mark −2.7 cm at 0.3 s and MISS at 1.5/3 s, cause unknown (bind-pose sphere disproved). The hero's chest wounds are mostly hidden from the play camera behind him by the facing test; that is correct, but Dom may read it as "no blood on me".

**Gotchas**: `finisher-preview.mjs` `option('x')` reads the NEXT arg, so a bare `--wounds` as the last arg is silently off; use the release row's argument order. `play()` kept one frame cursor across windows until #549 (a second window stepped on from the first one's index). `rear()` renders one frame without advancing the wounds, so a probe after it reads stale facing. The PreToolUse deploy guard blocks a WHOLE compound command if it contains `node --test`, including the file edits in it. Never start a browser gate from a chained command that could outlive FREE: a deploy started mid-run on 09-23 and I had to kill my own blood gate.

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Blood that reads real: body art, drops, floor (owner 2026-09-23: "paint-ball graffiti stickers", then "cartoon-ish" on the floor)

`src/gore.ts`. Body: Dom picked B/C/D of four FLUX candidates (scratchpad `gen.py`, white paper → alpha-cut); `WOUND_ART` rotates per hit from its own seed, drawn after the runs so their seeds hold; upright ±0.2 rad, top edge at the cut; `FRESH` #7a2a2c → #e0a0a0 (the multiply over the photo read as soot). Drops (`DROPS`): the first run of a stopped wound sheds a drop every 3–6 s until half dry; caps 8 falling / 24 spots; pooled. Floor (`multiplyOnto`, `scripts/blood/floor-textures.py`): the kill pool, hit splashes and drop spots MULTIPLY onto the sand, `dst × lerp(1, tex, a·opacity)` through premultiplied custom blending, so the grain shows and fades go to "no change"; near-black core, translucent rim, noise-drawn silhouette (lobes drew a star again), one-sided spatter; stains darken over 8 s.

Evidence: #544 test:all 537/0/2, wounds gate exit 0; #549 gore 17/17, CPU ×4 red p50 1.3 / p95 2.0 vs off 1.1 / 1.7 ms; #571 test:all 563/0/2, blood gate + wounds gate exit 0, same-frame before/after `artifacts/character/floor-after/floor-pool-before-after.png` (375×812, hero killed at frame 2196, +3 s). Remaining: Dom's eye on the phone for #571.

## Blood conforms to the body it lands on (owner 2026-09-22, on a live fight: "blood is still floating on bodies... not joined to the gear or opponent")

`src/gore.ts`, branch `finishers/blood-conform` on c43c677. Diagnosed by instrumenting the close-up probe to raycast from 30 cm outside each mark back along its own normal and report the gap to the first skin or cloth. On trunk: Veteran 0.9 cm at 0.3 s drifting to **5.8 cm** by 1.5 s; Nightborn **−2.7 cm** (mark behind the face mesh, painted over it because depth is off) and frames with no surface under the mark at all. Three faults, not one: (1) the mark's plane used the site table's guessed direction, not the struck face's normal, so a flat 9.6 cm quad sat crooked on the cloth; (2) skin and cloth deform away from the bone after the hit — anchoring once is what turned 0.9 cm into 5.8 cm; (3) strands hang straight down in the mark's plane, so past a cape hem or the underside of an arm they ran into open air.

Fixes: `surfaceHit()` keeps the point the ray met AND that face's own normal, both in the struck bone's frame; one mark is re-measured per frame round robin (≤10 in the pool → each re-glued ~6×/s for one ray a frame, skin list cached per rig, no per-frame allocation); `surfaceReach()` caps each wound's run at hit time to where the surface still continues under it (4 short rays per hit, none per frame); the facing test goes 0 → −0.15 so a grazing mark on a silhouette does not blink out. Depth test and depth write untouched.

After: Veteran and Executioner **0.4–0.5 cm** at 0.3 / 1.5 / 3 s — the 4 mm proud, i.e. on the surface. Evidence: gore.test 14/14; `test:all` 504 pass / 0 fail / 2 skipped; `quality:stop` exit 0; wounds gate veteran exit 0 (0.06 → 0.12 → 0.13 m, the 8 cm floor survives the reach cap) and goblin exit 0 (0.04 → 0.09 → 0.09 m); release rows 1, 2, 13, 14, 29, 31 (what `scripts/release-rows-for.mjs` says this change triggers) all exit 0; stills `artifacts/character/blood-closeup-veteran/closeup-side-{0.3s,1.5s}.png`.

Open, stated not hidden: on the Nightborn the probe still reports **−2.7 cm** at 0.3 s for a head-slot mark (behind the face mesh) and **MISS** at 1.5 s and 3 s — no surface within ±30 cm of the mark along its normal, so the re-glue keeps its last good anchor and that mark can hang off the body on those frames. A padded bind-pose bounding sphere was tried as a cause and **disproved** (numbers unchanged), so the cause is still unknown. Not a regression from this change; the Veteran and Executioner numbers are.

## Blood on arms and wrists + marks on the actual skin (owner 2026-09-22: "run down the leg and arms", "a lot of skin ... wrists", "it floats off the chars")

`src/gore.ts`, branch `finishers/blood-limbs` on b67281e. (1) `woundSite(hit, limb, mirror)`: a side cut across the torso now lands on the near arm for a seeded `ARM_SHARE` (.5) of hits — half upper arm (`upperarm_l/r`), half the wrist end of the forearm (`lowerarm_l/r`); a rig without arm bones falls back to the flank. The overhead cut's shoulder mirrors per hit, so on the Veteran it lands on the bare shoulder as often as the cloak. Legs were already routed (sim `legs` → thigh). All drawn from the same LCG as the runs: replays land the same limb. (2) `surfaceRadius()`: the mark's offset from the bone is measured per hit by a raycast against the rig's own skinned meshes along the wound normal (4 mm proud, clamped to .35–1.5× the slot's table value; the table value stands with no skin/under node) — the fixed .22 shoulder guess hung in the air on a bare shoulder. Evidence: gore.test 14/14 (arm/wrist/flank bones + seeded determinism + no-arm fallback; skinned-box raycast → .104 not .22, fallback, clamp, end-to-end through `hit()`); wounds harness veteran exit 0 (0.06 → 0.12 → 0.13 m), goblin exit 0 (0.04 → 0.09 → 0.09 m); stills `artifacts/character/blood-closeup-veteran/closeup-pick2-1.5s.png` (wrist), `closeup-side-1.5s.png` veteran + goblin (mark on the surface, side-on). Remaining: PR's own release-checks run.

## Blood runs v2: it drips, it does not stretch — lit photo decals over the armour (owner 2026-09-22, "like a tap with a slow leak", "no paintball sticker")

What changed (`src/gore.ts` `createBodyWounds`, branch `finishers/blood-runs` on dcb9d61):
- Runs GROW: each strand is seeded from the hit (`woundSeed`, `lcg`), starts as a bead within 0.3 s, lengthens with `ease(t)=1-(1-t)^2` over 1.5–3 s to a ceiling of 11–19 cm × rig scale, then stops and never shrinks. No cycling. Replays draw identical geometry.
- Dry-out: from the last stopped run, 20 s from wet (roughness .42, fresh crimson) to matte (roughness .75, dried tone). Dark mode multiplies; blood off hides; rematch clears.
- Material: `MeshStandardMaterial` (lit) with FLUX-generated splat + drip photo textures and luminance normals (`src/assets/blood/*.png`, 4 files, ~110 KB), tinted `#7a2a2c` over the photo reds — the raw texture read neon ("paintball sticker"). Canvas tint stands in until the PNGs land and under node.
- Over the armour (Lead ruling 2026-09-22, Dom: "leaks through, over"): `depthTest:false`, no polygonOffset, so a cloak or the Goblin's pauldron never hides a wound. Through-body bleed is stopped by a facing test in `update()` — a mark whose bone-frame surface normal faces away from the eye (`camera.position`, passed from scene.ts) is hidden; its clock keeps running. Overhead shoulder slot radius .16 → .22.
- Known limit: with depth off, a wound on the far fighter can draw over the near fighter's limb when the limb crosses exactly in front of it. Glossy-material pass = separate follow-up ticket (Strategy), no wet-shader work.

Evidence (all on the PR head, 2026-09-22):
- `node --test tests/gore.test.ts` 12/12 — growth (bead at 0.3 s, ≥1.5× at 1.5 s, ≥ 8 cm, never shrinks), world-down across 5 bone rotations, seeded determinism, dry-out, depth-off + facing + goblin ≥ 8 cm at scale .78. `test:all` 469 pass / 0 fail / 2 skipped; `quality:stop` exit 0.
- Wounds harness (`finisher-preview.mjs --wounds`): veteran exit 0, runs 0.3 s 0.06 m → 1.5 s 0.12 m → 3 s 0.13 m; goblin exit 0, 0.04 → 0.09 → 0.09 m (the 8 cm assertion now includes the goblin, pauldron in place). Stills `artifacts/character/blood-runs-{veteran,goblin}/wounds-{0.3s,1.5s,3s}-{front,rear}.png`; close-ups `artifacts/character/blood-closeup-{veteran,goblin}/closeup-*.png`.
- Release rows 0 (run-through), 22 (blood-gate), 28 (record-replay), 29 (wounds-gate), 30 (kill-link), 32 (endgame-hud) all exit 0 locally.
- Phone-tier cost: 10 marks / 22 live runs, `update()` 0.004 ms/frame over 18 000 frames under node, heap delta after gc constant at 6 000 vs 18 000 frames (no per-frame allocation).

Remaining validation: PR's own release-checks run green (rows 22/29/32 on the GitHub runner); Dom's eye on the phone after deploy.

## Body wounds v1: blood from every landed blow, not just the death screen (owner go 2026-09-21, "blood dripping ... after a heavy hit")
Owner: marks from every landed blade blow on any fighter (hero through Dwarf), sided to where the swing came from, showing once
that fighter is at 60% health or below and darkening toward death — separate from the existing finisher/death gore.

`gore.ts` `createBodyWounds` (new, alongside the existing splat pool / throat-cut decal / blade blood): a 5-mark pool per
fighter, presentation only — the simulation decides the hit, damage and location; this only draws it. `woundSite(hit)` maps
the sim's own `HitLocation` (head/torso/legs) + swing `Direction` (right/left/overhead/thrust/low) to a bone and a local
direction in the STRUCK fighter's own frame: a right-hand swing crosses to the victim's left (torso `spine_02`/`spine_03`
for overhead, legs mirror the same side onto `thigh_l`/`thigh_r`, thrust/low sit centred). `scene.ts` calls `bodyWounds.hit`
on every landed `Hit` event (never a kick), skips the same `hasBlood(opponentId)` no-blood gate the splats already use, and
scales the mark by `OPPONENTS[id].scale` for the bigger creatures. Marks ride their bone every frame; severity (opacity +
drip length) scales linearly from 0 at 60% health to full at 0%; a finisher's own gore (opened cut lines, the throat, the
plain death's blade tint) takes over the killed side's marks so they don't fight the finisher's own effect — the plain
death keeps his wounds visible, `bloodMode 'off'` hides everything like the rest of the gore system, rematch clears the pool.

Tests: `gore.test.ts` — `woundSite` direction/location table, `createBodyWounds` (pooled hit registers on a missing bone as
false, threshold show/hide, follows the bone, `off` hides, severity scaling on opacity and drip, rematch clear); mutation on
the threshold comparison caught. `test:all` 412/412. Harness: `finisher-preview.mjs` gained an opt-in `--wounds` still
(a scripted duel to the first landed blow at ≤60% health, +30 settle frames) + a dedicated `wounds-gate` release row
(`--only plainDeath --wounds`) so the other 7 finisher-preview rows don't pay the extra page load. `wounds-gate` ran green
(exit 0; `wounds: warden 4 mark(s) showing (opacity 0.58, drip 0.58); off → 0`) on the goblin harness and again on the
release-row fixture; owner reviewed the rendered stills (`artifacts/character/wounds-gate/wounds-phone-rear.png`) before
the PR went up.

**Audit follow-up (2026-09-22):** peer review of the pushed head (`fcc835b`) found three real items, fixed here: (1)
`bodyWounds.update` re-ran a recursive `root.getObjectByName(mark.bone)` every frame for every used mark (≤10) — `hit()`
already resolves the bone, so it's now cached on the mark at hit time and reused, dropping the per-frame search entirely
(mutation-checked: nulling the cache assignment fails the existing test). (2) `.quality-gate.json` had lost its trailing
newline — restored. (3) Check 5 (`fatal-crowd-browser-check.mjs`) failed on the pushed head with the same wall-clock
timeout signature as an unrelated PR's (#366) known-flaky run, and trunk's own baseline for that check is cancelled, so
flake vs. this PR's heavier per-frame cost wasn't settled by the auditor's read alone — re-running it locally, alone, with
no deploy in flight, to get a clean receipt before pushing the fix. Also: the "mutation caught" claims throughout this
entry are a manual verification step done during development (temporarily break the assertion's target, confirm the test
fails, revert) — not an automated mutation-testing framework wired into the repo; noting this since the audit read it as
possibly a claim about tooling that doesn't exist here.

## Run Through hold: two-handed grip, the off-hand rides the hilt (2026-09-21, owner: "giving the middle finger")
Owner, on the phone hold: the killer's left hand read as a raised open palm / middle finger. Two causes. (1) Rig: the
hold froze the Riposte contact frame's thrown-out left hand; even after moving it to the hilt the Armed pose's fingers
are OPEN (tips 15–18 cm from the wrist), so on the hilt it still read as a raised palm. `build-warrior.mjs` now closes the
off-hand on the grip 7 cm behind the sword hand with the RIGHT hand's fist mirrored onto the left fingers ((x,−y,−z,w)
on the mirrored finger bones; tips 5–10 cm, matching the right). (2) Runtime: `aimBladeAt` turns only the sword arm
onto the victim's chest, so the fist stayed where the clip left it — hanging by the face. `characters.ts` re-solves the
left arm (two-bone reach, the clip's own elbow bend) onto the hilt after the aim, restored each frame like the aim itself.
Rigs: hero rebuilt; goblin rebuilt from cached parts (only the 17 hold left-arm channels changed, mesh/texture bytes
identical); Veteran/Pitborn/Nightborn/Executioner + their weapon twins (estoc, cleaver, warhammer, scythe ×5) took the
hero's 18 left-arm hold keys in place (bytes overwritten inside the binary chunk, file length unchanged — the parity
tests demand identical Fin_RunThrough tracks on the shared skeleton; the estoc twin stays byte-identical to nightborn).
Creatures/Dwarf untouched (own skeletons, never the killer, tests green). Receipts: test:all 402/402 (new off-hand
assertion in the hold-aim test; mutation without the re-solve fails it); release row 0 exit 0; harness
`artifacts/character/runthrough-fist2` settled/rear/landscape stills show both fists stacked on the hilt.
Remaining: owner look on the phone; row 22 (blood-gate, all outcomes) not rerun on this head.

## Finisher side view: measured reach for Quiet One too, foreshortened fit, rate-limited back-off (2026-09-21)
Deploy #57 on fdd6032 (#303 anti-turtling) failed release checks 17 and 20: the passive test Executioner is now lashed off the
wall and dies at heading π nearer the wall. Quiet One's body left the portrait frame (x −40); Opened's reach-driven back-off
stepped 0.267 in one frame (> .25). Fixes (camera.ts, scene.ts): the fallen rig's world bounds feed `finish.reach` for
Quiet One as they already did for Opened's pieces; reach growth is capped at 1.5 cm/frame; the side-view half-width uses
the foreshortened axis (gap/2·sin angle + beyond) — the unforeshortened ask pushed the fit past the 11.5 m arena clamp,
which silently undid it; Quiet One (and any measured reach) gets the inward front-quarter camera candidates near the wall.
Receipts: checks 17 and 20 exit 0 locally on this head; camera/creature-opened/characters 50/50 (the characters test now
feeds the measured reach like the scene does).

## Opened side view fits the landed pieces (2026-09-21)
Release check 17 (`finisher-preview --only opened --opponent executioner`) failed on trunk after #262 (directional guard):
the harness duel now kills at heading 0.99 instead of 1.86 and the 1.36× body's leg half slid under the portrait margin
(x −0.3 vs > 5). Fix is framing, not a seed re-bake: the scene measures the farthest horizontal reach of the Opened pieces
from the fallen's origin (world bounds, monotonic) and hands it to the camera as `finish.reach`; `finisherSidePose` fits
`max(1.5·bodyScale, reach + 0.3)`. Same authorized dolly — no cut, no FOV change; Decapitation's no-push rule untouched.
Verified locally: opened on executioner, veteran, pitborn, goblin, nightborn, dwarf all exit 0 (worst maxCameraStep 0.227).
Minotaur/Wraith opened checks fail on clean trunk too on "waist separation obeys blood mode" — a stale blood-toggle
expectation since #228, on held bodies in the extended list; separate item.

## Dwarf finishers enabled (2026-09-20)
Owner won two fights against the Dwarf and got plain deaths: the roster entry shipped with `finishers: []` (the rule for
reconstructed bodies — only validated finishers, listed explicitly). The Dwarf rig already carries every finisher clip.
Validated on him with the finisher harness (real kills, blood modes, rematch, camera): Split Crown, Decapitation, Run
Through, Opened, plain death — now listed. The Quiet One (picker-only) failed its spray check on him and stays off.

## Finisher rotation: even pool, never the same ceremony twice in a row (2026-09-20)
Owner: "random, but the same finish can't appear twice in a row — keeps it fresh". Measured before the change: the
seeded pick was already even (19.6–20.6 % each over 20 000 kill events) but memoryless (19.9 % back-to-back repeats).
`selectFinisher(finish, weapons, previous)` now excludes the previous fight's ceremony from the pool; the scene keeps
that memory (`lastFinisher`, rolled at rematch) and hands it to the audio resolver via `view.previousFinisher()`, so
scene and audio still agree. Presentation state only; replays with the same history are identical. The preview harness
resets the memory per captured window. Test: 20 000-event sweep asserts no repeat, 16–24 % share each, determinism.

## Beta rotation: five outcomes, The Quiet One picker-only (2026-09-20)
Owner (directly to the finishers lane, 2026-09-20): Split Crown, Decapitation, Run Through and Opened stay; The Quiet One
leaves the automatic rotation (`selectFinisher` now `% 5`). Its clip, pose, gore and audio stay shipped and the dev picker
can still force it ("The Quiet One (test only)"). The finisher preview harness reaches outcomes outside the rotation through
the production picker override on a real kill and labels the window as such; the Quiet One release checks keep passing
that way. No new finishers until beta metrics.

## Finisher cameras — Split Crown front-quarter, Decapitation corpse+head framing (2026-09-20)
Owner phone review: the Split Crown side reveal turned the victim into profile and hid the skull seam; Decapitation's
front camera let the killer's back hide the headless corpse. Split Crown now reveals on a raised 45° front-quarter
(`finisherSidePose`); Decapitation keeps its front view with a camera-right slide and a look at the corpse/head midpoint.
The deploy gate's blood-gate check (decapitation "detached head stays visible above portrait controls") failed on trunk
63f4cd9 independent of this work — the head landed at the portrait edge on Veteran and Pitborn; the midpoint framing
clears it on Veteran, Pitborn, Goblin and Executioner. Harness now asserts the victim's chest/skull are not hidden behind
the killer (camera ray). Run Through alignment (owner: blade reads off-centre) remains open.

## Creature Opened correction — 2026-09-19
Owner reports Opened silently using ordinary death on Wraith and Minotaur. Per-finisher capability and a shared scene/audio resolver now allow only Opened on these creatures. Reuse each actual mesh waist bake; Wraith cut surfaces retain spectral shading with owned materials and a readable3.6-second hold before1.4-second fade. A physical dropped weapon remains; the clawed Wraith has no separate weapon prop. Actual-mesh CPU tests cover grounding, portrait bounds, pause, materials, source preservation and rematch; a Wraith crop found by the new test is corrected with a size-aware Opened camera margin and inward front-quarter option near arena walls. Owner also requests Decapitation retain the original front view: its generic dolly/side slide is removed and a detached-head portrait regression is added. That probe exposed stale skin bind inverses after actor movement, spawning the head6.8m away; the bake now refreshes them and the same all-six-rig regression passes. Creature camera transitions are slowed enough to preserve the existing continuity bound. Exact Minotaur scene rerun passes. Decapitation’s restored front camera exposed an overlong head throw behind portrait controls; a short lateral impulse keeps the head nearby and clear of the victor, and the same contact/drop/settled framing plus raycast-occlusion checks pass. Other creature finishers remain disabled. No simulation, GLB, dependency or input changes. Integrated the maul/claw weapons and ordered cleanup. Claws exposed a non-finite empty-prop support calculation; the same actual-rig regression now passes with finite transforms and no phantom dropped weapon. Full combined gates and public receipts remain pending in artifacts/finishers/creature-opened/.

## Finisher blood upgrade — 2026-09-19 (PR #165)
Owner requests substantially more blood at actual finishing wounds and floor spills beside the body. New fixed pool:160 ballistic droplets and80 growing floor stains, two draw calls; source locations follow neck/head, separated waist faces, jugular or chest entry/exit. Jets taper to drips and stop; red/dark/off and rematch apply. No simulation, input, GLB or dependency changes. CPU source/ballistic/resource checks pass; Integrated published Wraith c757d87 with its arm correction and creature guards preserved; Independent source/lifecycle and refined motion-frame review pass; small/large Decapitation, Opened and Quiet One red/dark/off/hold/rematch checks pass. Final24-command release validation and public receipts are maintained in artifacts/finishers/blood/.

## Opened waist finisher — 2026-09-19 (PR #163)
Owner explicitly authorized a horizontal waist separation: torso slides sideways and falls; legs hold briefly and
fall separately. Own-model static geometry is sliced and capped during loading/reset, outside the killing frame;
closed cut surfaces, original exterior maps, arms retained with torso, victim weapon released to the sand, cached floor supports.
Blood-off keeps the intact collapse. Red/dark/off changes and rematch restore the rig cleanly. Six-way deterministic
pool and journal option; early side camera and two timed landing cues reuse existing resources. No GLB, simulation,
input or dependency change. New creature bodies remain outside finisher support until their separate anatomy review.
Initial CPU checks pass275/275, lint/typecheck/build/audit, 8,933,674-byte worst-fight budget. Tests cover all six
humanoids, grounded halves, held pose, source geometry preservation, mode changes including late enable, and disposal.
First visual review rejected limb-propped landing and portrait crop. A bounded broad-rest-face search, cached floor
supports, one outer cut cap per half, and a wider/higher side view correct them. Stronger tests measure the waist
itself as well as floor contact. Lower-half pivot and resting orientation are fitted at the waist; the victim weapon drops flat independently. All-six CPU checks and Goblin/Pitborn/Nightborn/Executioner final image reviews pass. Corrected Veteran real-scene red/dark/off, portrait/landscape, reduced motion and
rematch checks pass. Integrated creature597ee849 retains spectral rendering and supportsFinishers guards before
both selecting and preparing the effect. The sixth Auto outcome exposed Quiet One large-rig portrait cropping at seed741; its lateral camera margin is widened and that exact real kill is pinned in the existing gate. Small/large, mode/reset/reduced-motion and arena-edge checks pass. Combined budget9,325,213 bytes gzip per fight. The complete23-command
contract includes Opened normal/large-rig scene checks and real phone-size UI victory/hold/rematch. Final integrated
validation, review, exact-head CI and public publication receipts are maintained in artifacts/finishers/opened/;
use public release.json as the served revision authority. Physical-phone feel remains owner-only.

## The Quiet One — 2026-09-19 (PR #159)
Owner authorized the next finisher: restrained neck reaction, left hand at throat, failing backward step, held beat,
knee buckle and right-side collapse. Additive `Death_QuietOne` on all six live fighters and four shelf/bake rigs;
2.4 s authored / 3.2 s presented, final pose held until rematch. The five-way deterministic rotation includes plain death.
Small animated neck wound reuses the existing pool, red/dark/off apply, earlier side camera exposes the held beat,
and existing quieter contact/voice plus delayed body/gasp cues complete the scene. No simulation or input change.

Original offline authoring in `scripts/build-quiet-one.mjs`, also called by the full warrior builder. Binary append
preserves all old clips, meshes, skinning, textures and weapon elbow repairs; preservation verified against f7a1e99
on all ten GLBs. Blade rebake is unchanged. Initial visual review corrected inward elbow, knee/foot ground clipping
and portrait crop; baked skin-envelope clearance accommodates each body. Initial full quality passes 268/268 plus build,
lint, dependency audit, per-fight budget and game browser. All-rig tests cover throat alignment, upright beat,
intact head, ground contact and held corpse; additive-builder test verifies preservation, idempotence and rejection
of a later appended clip. Camera edge/aspect tests include the new ending. Earlier rigid-clip comparison tests now
exempt only the separately authored Quiet One values while retaining clip names, tracks/times and legacy assertions.

Real-scene Veteran/Goblin/Executioner captures cover red/dark/off, portrait/landscape, reduced motion and rematch.
Final sequence video and phone UI/contract gate receipts: `artifacts/finishers/quiet-one/` and
`artifacts/character/quiet-final-scene/`. Two-pass review: pure simulation/input unchanged; then rendered poses,
continuity, modes and reset behavior. All 11 initial completion commands passed, including a real phone-size UI victory/hold/rematch.
A whole-body portrait bound now guards the large Executioner ending as an additional completion command.
Decoded audio QC verifies a silent held beat, late fall/gasp, cancellation and <= -1.54 dBTP fatal peaks;
Quiet One measures -12.2 LUFS against decapitation -10.7 LUFS on the integrated phone mix.
Integrated world/audio 03282b0, Google account e5339e9 and approved dust tint 6bf1399, preserving all account gates/settings.
Final combined checks, exact-head CI, deployment and live playback receipts are recorded in
`artifacts/finishers/quiet-one/`; public `release.json` identifies the served revision. The lead allocated this
release after AUTH FREE; later lanes must wait for its RELEASE FREE. Physical-phone feel remains owner-only.
Sentry inspection found existing asset-fetch/texture/WebGL issues (5/6/A/9/8 and older), not evidence about this
finisher at the time of inspection. No claim of a clean live error stream or public publication.

## Split Crown visible skull split — 2026-09-19 (finishers lane, local gate passed)
Owner approved a skull-only centre split: the halves open slightly and the body collapses intact. Work is isolated from
both the lead checkout and the unfinished Run Through alignment worktrees. Runtime path: real Killed event → existing
selection/clock → `characters.splitCrown` → `skull.splitSkull`; no simulation, weapon data or GLB changes.
Selected triangle clipping with closed cut faces from the existing head bake; rejected a blood-only decal (no silhouette
change) and shader-only separation (faces bridge the gap). The split follows the Head bone as a sibling, using the victim's
own exterior materials; blood off restores the intact head, red/dark toggle the cut, rematch disposes the split resources.
Discovery: three Semble queries plus CodeGraph impact review, with direct review of the sever/rematch and scene seams.
Checks: all six shipped rigs pass geometry/mode/rematch/decapitation regression checks. All five opponents pass real-scene
phone/landscape/rear captures, mode cycling and rematch. Before integrating roster #143, full quality: 247/247 tests, build, audit, 8,361,824/10 MB budget,
Playwright gate PASS; dedicated finisher completion gate PASS. Added the translated/rotated, pre-render head-bake regression.
The initial timed-parry browser failure under concurrent capture load is closed by a full isolated quality pass.
CodeGraph refreshed; two-pass review covered geometry/resource isolation, render placement and browser cleanup.
Evidence: artifacts/finishers/split-crown/REPORT.md. Physical iPhone performance and owner visual acceptance remain unclaimed.
Existing Sentry issues 6/A/5/9/8 concern fetch, texture loading and WebGL initialization; no skull-split event predates this
change. They remain unresolved and outside this visual feature's scope; this change does not claim to repair them.
At the Split Crown release, Run Through remained separate. Its repair is recorded in the Run Through section below;
the inherited failure and earlier partial alignment worktrees remain preserved as historical evidence.

## Finishers & gore milestone authorized — 2026-09-17 (lead, owner's call)
The owner authorized the finishers milestone the 2026-09-13 blood layer deferred ("mortal kombat closers, but gritty,
realistic"; the flat fall-backwards death is the target). Spec: GAME_SPEC.md "Owner-authorized finishers & gore —
2026-09-17" — selection is a pure function of the deterministic `Killed` event (victim/location/move/heading +
weapons), simulation untouched (`RULES.death`, the 220 ms Killed hit-stop, "death has no tail" stand); six v1
finishers (Split Crown, Run Through, The Quiet One, Opened, Hamstrung, Execution); a slow camera push-in over the
death window authorized (no cuts/FOV punch/slow-mo); gore upgrades on the existing pooled systems under the
red/dark/off modes; the 21 clip names/durations stay frozen, finisher clips additive (`Death_*`); NO split
geometry/detachable limbs in v1. Budget: per-fight cap 9 → 10 MB gzip in `scripts/check-budget.mjs` (11 MB needs
further owner sign-off); mesh compression (~half) is the approved later lever. The roadmap deferral line drops
finishers and wounds. Handover brief for the new lane: `artifacts/character/BRIEF-finishers.md` (suggested lane
`finishers/gore-v1`, ship Split Crown end-to-end first for the owner's phone judgment). No code, asset or behaviour
change beyond the budget constant.

## Run Through repair — 2026-09-19 (implementation and local gates passed)
Goal: keep the blade through the animated torso and visible behind the kneeling opponent, until rematch.
Scope: characters.ts pose/aim, scene.ts post-pose alignment, rig regression and finisher-preview completion gate.
Fresh branch from trunk 3bfb0eb; inherited and partial alignment worktrees remain untouched.
Candidates: re-key every rig (fixed spacing still fails); rotate shoulder toward tip (reproduced 0.572 m miss);
grounded render-only step plus blade-midpoint alignment (selected). No new GLBs, dependencies or simulation data.
Failure F1 closed: the original inherited test reproduces a 0.572 m miss; both corrected regression tests and full quality pass.
Hold clip must be one-shot; reset post-mixer corrections before repeated/zero-dt evaluation and rematch.
Passed: all five real torso rigs, translated/rotated parents, variable frame times, red/dark/off, rematch,
real-scene captures and initial full quality (252/252). Both disabled-aim and loop-only mutations fail the regression.
Integrated quality passed 253/253 with lint/typecheck/build/audit, 8,366,568-byte per-fight budget and browser gate.
After the arena merge, configured browser checks and release receipts are recorded in artifacts/finishers/run-through/.
PR #149 carries the scoped fix; production verification is required before any live-resolution claim.
Sentry: unresolved 5/6/A/9/8 are asset fetch/texture/WebGL errors; no evidence linking them to pose alignment.
Three Semble searches + CodeGraph impact completed. No disputed graph edges or performance incident;
Tree-sitter/CPU profiler are not relevant. No cross-agent handoff or new agents.

## Finisher side view — 2026-09-19 (implementation and visual checks passed)
Owner screenshot: hero shoulder hides Run Through and Split Crown at their settled ending. Success: smooth late side
move exposes both fighters in portrait, stays within arena, respects reduced motion/free camera and resets for next fight.
Scope: scene.ts camera endpoint and late blend; camera.test.ts; existing finisher-preview completion checks. No rigs/combat.
Candidates: more fixed lateral offset (unreliable with distance), snap to side (breaks continuous camera), smooth late
move to a fitted side view (selected). Reuse the current camera and presentation clock; no new module or dependency.
Three Semble queries + CodeGraph camera impact reviewed. F1 closed: before correction, the real-scene side-angle assertion
fails; after correction, the same assertion passes for Run Through and Split Crown on Veteran, Goblin and Executioner.
Visual review: both finishers expose the victim in portrait and landscape; red/dark/off, reduced motion, manual orbit and
normal camera return on rematch pass. Late motion stays continuous (maximum measured step 0.077 m/frame at 60 Hz).
Geometric tests cover both finishers around all arena edges, varied headings/spacings and portrait/landscape fields of view.
Evidence: artifacts/character/side-camera-{veteran,goblin,executioner}/ and artifacts/finishers/side-camera/REPORT.md.
Two-pass review: simulation/input/rig behavior untouched; actual rendered victims and existing finisher effects verified.
Local quality passed 261/261 after the arena merge; all seven configured completion commands passed. The subsequent fatal-audio
merge changed no camera/rig code; its new production build passed roster, Split Crown, audio, estoc, counter and arena gates.
PR #154; release quality reruns all tests on the final merge. Deployment and live-UI receipts are recorded separately in
artifacts/finishers/side-camera/ so the served revision remains the authority for publication.
