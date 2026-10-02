# Nightborn — lane state

Opponent 5 by brief number, the fourth rung: the pale duelist with the estoc, hero rig at scale 1.03, poise 0, and the only committing parry
on the ladder. Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## 2026-10-02 (night) — HANDOFF (full file: docs/state/nightborn-handover-2026-10-02.md): Red Wind merged into the specials base; Seven Cuts PR #1293 open and HELD; Pale Lunge HELD for Dom. READ FIRST, then memory `frankendom_nightborn_class_specials.md`

**NOW:** nothing to build until Lead/Strategy relay Dom's morning answer. (1) **Red Wind #1220 is MERGED** into `finishers/hades-shadow-claw-fx` (#1120's branch) at 12:39Z 2026-10-01, not trunk; Strategy ruled the Pit look stays as merged (Dom's "leave as is" beats the no-pale bar), Dom sees the Pit still in the morning: keep or darken the Pit sheets. (2) **Seven Cuts PR #1293** https://github.com/DomLynch/RPG-game/pull/1293, head 6e1b167b, base `finishers/hades-shadow-claw-fx` (5575424f), 7 files +160/-9, preview only (`?special=cuts`, Nightborn rank 7). Strategy: Pit PASS. Held like the other specials: not merged into the base until the batch ends, then Auditer, then Lead. (3) **Pale Lunge** (ranks 1-3, `?special=lunge`) lives ONLY on branch `nightborn/class-specials` (head 43d422a8): day look + Pit variant (line 2.4x wider, flare 1.7x longer). Strategy: Pit v2 PASS, "no more passes"; HELD for Dom's ranks 4-7 answer (Nightborn's own move, or the look for Estoc Lunge). No PR for it.
**Done today:** Red Wind night film (night-set); Seven Cuts + Pale Lunge day and Pit films; 16-frame check that the 7th thrust does not clip (no clip, screen overlap only); PR #1293; Pale Lunge Pit variant. Films go to LEAD (not Strategy), nights only in Lead's batch.
**Open:** Dom's morning answers (Pit sheets of Red Wind; ranks 4-7 / Pale Lunge); real-phone `?perf=1` never read; display name of Red Wind (grey, Strategy rules); Auditer review of #1293 after the batch.
**Gotchas:** Dom's rule for every special: NOTHING pale or glowing over the fighters, dark ink only. A straight ground line along the fight camera's axis hides behind the player (the line bends left); a 3 cm ribbon was invisible (7 cm works); cuts need depthTest off or the hero's body hides them; flare stubs are flat planes (they read as tufts because of feathered edges at a grazing angle, Lead's note). Pit is exposure above 1.5 (`--arena a` for capture; `--arena 1` is day). The Mac blocked builds/tests during Deploy runs, so tsc/eslint/tests ran on the VPS (`/opt/frankendom-shadow/work/nightborn/repo`, `git fetch --depth 1 origin <branch> && git checkout -qf FETCH_HEAD`). Stills in PR bodies are hosted on throwaway branches `nightborn/red-wind-stills`, `nightborn/seven-cuts-stills`. Capture is first come first served (`capture --status`).

## 2026-10-01 (afternoon, +04) — HANDOFF before /clear: RED WIND PR #1220 IS OPEN, waiting on the Auditer. Class specials picked by me, waiting on Dom. READ FIRST, then memory `frankendom_red_wind_l8.md`

**NOW:** nothing to build until a reply arrives. (1) **PR #1220** https://github.com/DomLynch/RPG-game/pull/1220, head d77558d1, base `finishers/hades-shadow-claw-fx` (#1120). Stills in the body are hosted on throwaway branch `nightborn/red-wind-stills` (from 90a88664 captures, same render path; the body says so). Lead and the Auditer were messaged; Strategy was NOT reached directly (the bracketed name no longer resolves; the only two Strategy sessions on ListAgents are stale Remote Control ones), Lead was asked to relay. CI result not read yet: check `gh pr checks 1220`. No trunk merge before Sat 3 Oct; Deploy publishes /preview/ from the exact sha after the Auditer clears it. (2) **Class specials for the Nightborn (Strategy's task, Dom's rules: 20% max health, 20 s cooldown, unblockable, ~2 s tell, grounded, not cheesy, smaller than Red Wind).** I sent three takes per slot; my picks, which Strategy agreed with and is tabling for Dom with the Centurion's takes: **Pale Lunge (ranks 1-3)** and **Seven Cuts (ranks 4-7)**. Other takes: Cold Step, Drain Touch; Mist Pass, Crimson Draw. **Do nothing until Strategy relays Dom's pick.** Then grey-box on #1120 (presentation only), day + Night Pit clips at the 375 fight camera on the VPS lock. Strategy's note: Seven Cuts' third thrust must stop at contact range, no clipping through the hero's body at the 375 camera.
**Done today:** PR #1220 opened; class-special takes sent; no code changed after d77558d1.
**Open:** Auditer review of #1220; Dom's pick on the class specials; display-name ruling for Red Wind (it is grey, Strategy rules it); real-phone `?perf=1`; Strategy not directly told the PR number.
**Gotchas:** `capture` on the VPS is now first come first served (`capture --status` / `--queue`; v2.3 fixed a brief root-owned queue file, none of my jobs were affected); the Stop gate defers whenever Deploy has a run in flight (not a failure, CI covers the PR); this state doc still lives on a state branch, not the PR branch: edit in a worktree. This entry is on branch `nightborn/state-1001b` (off `nightborn/state-0926`).

## 2026-10-01 ~11:00 (+04) — HANDOFF before /clear: RED WIND IS DONE EXCEPT THE PR. Dom picked A (ground burst), "red wind is fine, get it live". READ FIRST, then memory `frankendom_red_wind_l8.md`

**NOW (the one job):** open the Red Wind preview PR. Branch `nightborn/red-wind` @ **d77558d1** (pushed), base = **`finishers/hades-shadow-claw-fx`** (#1120's head, which is itself stacked on `combat/special-hades`; merge order after Sat 3 Oct's duel: #1114 -> #1121 -> #1120 -> this). I already merged #1120's tip into the branch (the Auditer flagged the three missing commits; `git merge-base --is-ancestor origin/finishers/hades-shadow-claw-fx HEAD` is true), so the PR diff vs #1120 is clean: 6 files (scripts/special-clip.mjs, scene.ts, special-fx-wind.ts, special-look.ts, special-timing.ts +3, tests/special-fx-wind.test.ts). Un-drafted so CI runs, stills + sheet in the body, then Auditer review (Auditer = "Frankendom - Auditer + fixer - Fable 5.1", pre-read the delta, waits for PR number + head sha), then READY to Lead; Deploy publishes /preview/ from the exact sha (`npx vite build --base=/preview/red-wind/ --outDir dist-preview`). NO trunk merge before Saturday. Tell Lead ("Frankendom - Lead Developer"), Strategy ("Frankendom - Strategy - Fable 5.1 [a673e4]") and the Auditer the PR number + sha.
**Stills for the body:** final-sha captures exist on the VPS (DONEFIN marker): `/opt/frankendom-shadow/work/nightborn/out/fin-day/` (light arena) and `fin-pit/` (Night Pit): clip.mp4, peak.jpg, windup.jpg, meta.json. Their peak.jpg is NOT the burst for the light arena (it lands before the burst): cut burst frames from clip.mp4 with ffmpeg at ~3.1 s (build-up star at ~2.5 s). scp is flaky (connection resets, rate-limiting): one file at a time, retries 15-20 s apart, no ControlMaster, run in background. Earlier same-look stills are local in `~/Developer/frankendom-nightborn/artifacts/red-wind/a3/` (sheet.jpg, burst-day.jpg, burst-pit.jpg, star-*.jpg, clips) from 90a88664, same render path. `artifacts/` is gitignored: to show images in the body, put them on a throwaway branch (e.g. `nightborn/red-wind-stills`, via `gh api` contents PUT) and link `https://github.com/DomLynch/RPG-game/blob/<branch>/<file>?raw=true`, or put the local path in the body (visual-pr-stills skill allows either). Include the `?perf=1` reading only if Dom gave one (he has not; SwiftShader frameMs in meta.json is a ratio, not a phone number).
**What shipped, final (all in src/special-fx-wind.ts, one file):** ground burst A only. 11 painted radial streaks at the target's feet (snap onto the sand in ~0.5 s = GATHER_TICKS 30, then hold faint), release: streaks lengthen in ~0.4 s and 4 broad curved sheets peel up over the target, gone by ~0.8 s; grit points; grey, semi-transparent (CAP 0.8); every cast makes a different star (seed = cast.start; uneven angles, 3 lengths, 1-2 gaps, curves). Deleted: the cylinder, B (spiral updraft), C (wind wall), `?wind=`, src/special-fx-ribbons.ts; all in git history at cacd7fab. Tests 9/9 in tests/special-fx-wind.test.ts, and 28/28 with specials/scene-warmup/special-fx/special-look; tsc and eslint clean.
**Dom's verdict trail (so nobody re-litigates):** v1 too light/grey; v2 orange "cheesy" -> grey semi-transparent; v3/v6 "uniform", "manufacturing-plant plastic cylinder" -> five wind refs, three options; picked A, "build-up 1-2 s is slow, make it faster, keep the end effect"; then "too regular a star" -> randomised; then "red wind is fine, get it live. No pit tone-down."
**Open / honest gaps:** (1) the PR (above); (2) Night Pit sheets are big, bright and fairly opaque over both fighters; Dom saw it and said no tone-down; (3) light-arena build-up streaks are faint on pale sand (left as asked); (4) real phone `?perf=1` read not done; (5) the display name: it is not red any more, Strategy will rule it with Dom, the code name stays `special-fx-wind` / "Red Wind"; (6) HF FREEZE from Dom (via Lead): no ZeroGPU Space or HF job calls from any lane until he rules; I told Lead this lane made none (owed "one line" reply, sent).
**Gotchas:** this state doc lives on branch `nightborn/state-0926`, not on the PR branch: edit it in a worktree of that branch; the post-edit hook runs tsc/eslint on every Write; macOS has no `timeout`; the VPS ssh drops under rapid polling (one connection per check, 60-90 s apart); `capture` lock is shared and not FIFO; deploy guard blocks Bash text mentioning build/test words while a deploy runs; the Stop gate was deferred all session because other lanes' gates were running (not a failure); the cost test now takes the best of three batches because a parallel gate run once read 1.85 ms against a 1.5 limit (real cost ~0.12 ms Mac, ~0.4 ms VPS). VPS work dir `/opt/frankendom-shadow/work/nightborn/repo` (shallow clone; `git fetch --depth 1 origin nightborn/red-wind && git checkout -qf FETCH_HEAD`), scripts `../run-fin.sh` pattern: build then `CAPTURE_WAIT_S=7200 capture nightborn node scripts/special-clip.mjs --dist <dir> --special set --arena 1|a --out ../out/<name>`.

## 2026-10-01 ~01:35 (+04) — HANDOFF before /clear: L8 SET "RED WIND" (Dom's GO via Lead 20:3x). READ FIRST, then the 2026-09-30 16:18 entry, then memory `frankendom_red_wind_l8.md`

**Task (Lead, Dom approved the concept):** build L8 Set's special "Red Wind" from the ground on #1120's Hades pattern: PRESENTATION ONLY (a `?special=set` flag and a /preview/ page, no release rows, NO sim change; Combat's #1114 stays draft until after Sat 3 Oct's duel). Deliver to Strategy + Lead: a 6-8 s clip at the fight camera, 375 wide, LIGHT sand arena AND Night Pit, wind-up + release visible, plus a peak still. Capture on the VPS capture lock, never the Mac (box rules: no Blender/browser/test:all on the Mac while a deploy holds it; heavy work on the VPS).
**State:** branch `nightborn/red-wind` @958832c (pushed, stacked on #1120 `finishers/hades-shadow-claw-fx`; NO PR opened yet). v2 built, tests 6/6 on the VPS (`tests/special-fx-wind.test.ts`). New: `src/special-fx-wind.ts` (lazy chunk; ring = open-cylinder veil with scrolled streak alphaMap, column scours past head in 18 ticks, grains as LineSegments streaks, target's FEET only), `scripts/special-clip.mjs` (frame-stepped, harness clock, two deterministic passes, ffmpeg), `?special=set` = Nightborn level 36 in `src/special-look.ts`, scene.ts holds Set's blade out (thrust contact pose) and lifts the target, cost 0.292 ms/frame measured (v1; v2 not re-measured).
**Clips:** v1 day (superseded, pale, too faint): `artifacts/red-wind/day/`. **v2 LIGHT arena exists and was SENT to Strategy + Lead 01:3x:** `~/Developer/frankendom-nightborn/artifacts/red-wind/v2-day/` (clip.mp4, windup.jpg, peak.jpg). My read: reads at a glance but it is ORANGE-red, closer to fire than Dom's "deep rust"; one colour line in `sandLook()` darkens it. **v2 NIGHT PIT: queued on the VPS lock** (`/opt/frankendom-shadow/work/nightborn/run-clips2.sh` -> `out/v2-pit/`, log `out/v2-pit.log`, done file `out/DONE2`; Weapons held the lock at 17:30Z). When it exists: `scp frankvps:/opt/frankendom-shadow/work/nightborn/out/v2-pit/{clip.mp4,peak.jpg,windup.jpg,meta.json} artifacts/red-wind/v2-pit/`, LOOK at it, send to Strategy ("Frankendom - Strategy - Fable 5.1 [eb45ee]") + Lead.
**Dom's verdicts so far:** v1 "not bad, but too light/grey and not that visible"; Strategy's spec: ring at the feet rising to knee height, one column through the target above head height in ~0.3 s, cloth pulled up, sand rains back; darker saturated RED, lighter dusty rim, streaks not dots; one clean idea, NO added objects/debris/lightning/tornado (from Hades: he cut the claw prop).
**Not done / honest gaps:** (1) cloth and hair pulling upward is NOT drawn (only the target's 0.12 m lift); (2) real phone `?perf=1` read needs Dom's phone once the /preview/ is refreshed after he says keep (SwiftShader frameMs in meta.json is a ratio only); (3) no PR and no /preview/ build yet: that waits for Dom's "keep", then Deploy publishes `npx vite build --base=/preview/red-wind/ --outDir dist-preview`; (4) the first clip went out before v2 existed (Lead said don't batch).
**VPS recipe:** `ssh frankvps` (multiplexed, one connection, no fast polls); work dir `/opt/frankendom-shadow/work/nightborn/repo` (shallow clone, node_modules symlinked to finishers'); `git fetch --depth 1 origin nightborn/red-wind && git checkout -f FETCH_HEAD`; test `nice -n 15 node --test --test-reporter=spec tests/special-fx-wind.test.ts`; build `nice -n 15 npx vite build --outDir dist-v2`; capture `CAPTURE_WAIT_S=7200 capture nightborn node scripts/special-clip.mjs --dist dist-v2 --special set --arena 1|a --out ../out/<name>`. Non-interactive node on the VPS prints TAP: pass `--test-reporter=spec`. `--arena 1` is the light sand arena; with no `--arena` the Nightborn's ladder rung picks the Night Pit (first "day" clip was really the pit).
**Next session:** (a) finish the Night Pit v2 clip above; (b) act on Dom's verdict (colour darker? keep?); (c) if "keep": open the PR (base `finishers/hades-shadow-claw-fx`, stacked on #1120), Deploy publishes the /preview/, Dom's phone `?special=set&perf=1`; (d) the two pending loose ends from before: Lead's 2026-09-30 question about the legends parity line is answered (sent), #736 is closed.
**Gotchas:** zsh eats `$R:src` (use `${R}:src`); the deploy guard blocks Bash commands whose text mentions build/test words while a deploy runs (use Write/Edit for files, light git/ssh only); `capture` lock is not FIFO: Combat/World/Armour/Weapons all use it; never kill someone else's pid (check `readlink /proc/PID/cwd`). Mac load was 40-140 tonight.

## 2026-09-30 16:18 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-27 entries below, then memory

1. **LIVE 3fab84c4** (my own curl of frankendom.com/release.json at 16:18). I did not check the deploy lock or whether a run was in flight, because that is Deploy's job.
2. **Live from this lane:** the Nightborn legend text fixes (#929: Varney's title, Carmilla's age) and the legends parity test (#941) went live. Both merged
   2026-09-27 (#929 at 0ed229dd, #941 at e564c25c), and `git merge-base --is-ancestor` puts both in live 3fab84c4. Loot claims (#778) went live earlier (70a977ea, see below).
3. **NOT LIVE:** nothing from this lane. No open PRs on `nightborn/*` branches (gh, 16:18).
4. **Parity job (was owed to Lead): done on live.** Detached at 3fab84c4: `node --test tests/legends-spec-parity.test.ts` → 2 tests, 2 pass, 0 fail. The owed
   "parity on the final text batch" is covered because that batch is inside live. Lead has not been messaged yet: send them this line on restart if they still want it.
5. **Rulings:** none new since 2026-09-27. Standing ones are in memory: `frankendom_loot_claims_778.md` (careerMarks() is the one rank figure, Lead's level floor),
   `frankendom_legends_parity.md` (edit legends.ts and GAME_SPEC together), `feedback_deadlines_now_or_asap.md` (NOW / ASAP / named blocker only).
6. **QUEUE:** empty. Stand by for Lead's or Strategy's next assignment. For beta the Nightborn stays tint-only (Lead, 2026-09-27).
7. **Setup:** no cron armed. Worktree `.claude/worktrees/brave-khayyam-076b82` (the app refuses edits in ~/Developer/frankendom-nightborn), with
   node_modules symlinked from there. This doc lives on branch `nightborn/state-0926` (not on trunk yet). The Mac is heavily loaded (load 140 at 16:18),
   so ask Lead before any heavy run.

## Now — 2026-09-27 (late night): legends work: #929 + #941 in the text batch; one job left (parity on the final batch)

**READ FIRST after /clear.** Lead's sprint (Dom): runs until ~22:30 on 2026-09-28. For beta the Nightborn stays tint-only (no GPT looks). Box rules: Dom's GPT Blender
batch goes first; ask Lead before any browser run; one test run at a time; no builds, test:all or browser runs during Lead's QUIET WINDOW (Hero Look's #918
timing) until Lead posts "QUIET WINDOW END". A single-file node test is allowed.

**In flight (both Lead-reviewed, in the text batch; the order is Lead's: … #936 → #941 → #935):**
- **#929** `nightborn/legends-check` @0ed229dd: src/legends.ts text only. Varney = "Sir Francis Varney, a tormented undead gentleman" (the serial never makes
  him a baronet); Carmilla = "dead for a century and more" (not "centuries"). The other 8 Nightborn rows were checked against their sources and left as they are. Lead: correct, READY on green CI.
- **#941** `nightborn/legends-spec-parity`: new `tests/legends-spec-parity.test.ts`. The GAME_SPEC.md `### Legends` table (bounded at the next heading) must equal
  src/legends.ts: headers = `i Tier` from grades.ts TIERS, rows = LEGEND_OPPONENTS in order, cells = `Name (source)`. Green on trunk 054603e0 (1/1); eslint and tsc
  clean. Mutation: Carmilla source 1872→1871 in GAME_SPEC → fail 1.

**Next job (Lead):** when Deploy names the final combined text batch, run the parity on it and send Lead the result. How: check out the batch head in this worktree
(`git switch --detach <sha>`) and run `node --test tests/legends-spec-parity.test.ts` (one file, OK in the quiet window); if #941 isn't in the batch, `git show
origin/nightborn/legends-spec-parity:tests/legends-spec-parity.test.ts > tests/…` first, and don't commit it. Parity already checked (0 mismatches): trunk 054603e0, #929,
#930 @2b9a24f4, #932, #933 @6f9eb5d7, #934, #935. The only legend surfaces are main.ts legendNow (the fight card) and the share line; both read legends.ts, and
no site copy holds names.

**Gotchas:** the Stop quality gate times out (420 s) whenever load is above ~40; that's the hook's limit, not a failing check. Don't `until ! pgrep -f` on a
pattern that matches the waiting shell itself. Lead is `uds:/tmp/cc-socks/42306.sock` ("Frankendom - Lead Developer"); re-find it with ListAgents if a send fails.

## Done — 2026-09-27 (night): #778 LIVE; nothing open in this lane

#778 merged to trunk (86f8f7cc is an ancestor of trunk 054603e0) and is live: frankendom.com release.json revision 70a977ea contains 86f8f7cc
(`git merge-base --is-ancestor`). Deploy's state (1372103b) records "claims live 70a977ea". No open PRs from this lane. **Next session:** standing by
for Lead or Strategy's next assignment; nothing heavy without Lead's slot.

## Done — 2026-09-27 (late): #778 READY @ 86f8f7cc, base retargeted to trunk; nothing open in this lane

#778 contains #621 761dd70c, Backend's rollback file (1500ddcc) and trunk 7ea6feb1 (legends live). Lead retargeted the PR base to trunk. The legends
conflicts were resolved keep-both: #778's Match line (fightLevel + the rank port) wins over legends' device-count line; legendNow and './legends.ts' are added.
test:all on 86f8f7cc: 846 tests, 844 pass / 0 fail / 2 skipped; awards check PASS; tsc and eslint clean; merge-tree clean vs trunk and vs #751 b811eafb.
**Status at handoff:** Lead verified 86f8f7cc (MERGEABLE; merge-tree #778 → #751 → #914 on trunk is clean) and sent it to Deploy in the claims READY.
Deploy waits on CI quality going green. **Next session:** stand by for Deploy's merge questions, and run nothing heavy unless Lead gives the slot. If trunk moves
before the publish, merge it in (not a rebase, so no force-push) and send Lead a fresh sha, the test:all counts, and merge-tree results vs trunk and #751.
Work from `.claude/worktrees/brave-khayyam-076b82` (the hook refuses edits in ~/Developer/frankendom-nightborn); the #778 branch is `loot/client-claims`.

**Gotchas from this stretch:** a failed SendMessage socket means the Lead session restarted, so re-find it with ListAgents by name. `git merge` can hit
`fatal: stash failed` from other sessions' stash traffic; retry with `--no-autostash`. Before merging a Backend head, check that it contains trunk
(`git merge-base --is-ancestor`); otherwise #778's diff picks up trunk noise.

## Now — 2026-09-27 (HOLD): #778 at 6fd04ec8 (Lead accepted); gate on the new trunk is HELD by Dom

**HOLD (Dom via Lead): "hold everything for now".** No #778 rebase gate and no heavy runs (tests, batteries, renders, bakes, Blender) until
Strategy's word, which comes after Dom judges the Pitborn shade link. Reading and edits are fine.

**When released:** once #621 is READY and contains live trunk (ed385c6b, or whatever is live then), bring #778 onto #621's head plus trunk.
If trunk's `scripts/awards-database-check.mjs` conflicts, keep #621's version: trunk's steps with `.profiles[preset]`, not `opponentAt`/`profileAt`
at the record's level, so its records don't match how replay.ts replays them (Backend warned). Then `npm run test:all` (Lead's gate for records/profiles;
a local trial on 3155a1df was 839 pass / 0 fail), the awards check, a clean `git merge-tree` against trunk, push, and READY to Lead with the sha. Order: #621, then #778.

**Done since 9728e3f1:** #621's ed44bd6c merged into #778 (boot and rematch use `fightLevel(profile.dial, careerMarks())`). Match has an optional `rank`
port for turnDial (main.ts: `levelOf(careerMarks())`), so the dial steps from the rank the page shows. Tests: mid-page standing reaches the rematch;
two losses, then the standing arrives → rematch at fightLevel(dial, 10) = 6; the match dial case. Each one fails when its wiring is removed.
Lead's level rule is kept server-side: a claim below max(1, serverLevel − DIAL_TRAIL) is refused whole. Accepted cost: one mark on a cacheless first boot.

## Now — 2026-09-27 (later): #778 at 9728e3f1: ladder merged, standing cache built; nothing open here

**Done:** trunk dfeb25b9 (46-level ladder) merged into #778. Backend's c442a54f was merged in: `careerMarks()` is the one number (rank, loot card,
dressed rung, Match level), with the claims figure (server marks + pending + outbox); there is no `session.marks` on #778. **Standing cache**
(Lead's GO): `frankendom.standing.v1` = {userId, standing}, replaced when my_standing answers, kept for its own account when there is no answer,
dropped for another account or on sign-out. main.ts reads it at boot until account.ts answers, so the Match is `careerLevel(careerMarks())`.
Test: cached 10 over device 0 → level 11 and rankFor(10); fails with the device count wired back in. Gate on 9728e3f1: tsc and eslint clean,
npm test 789 pass / 0 fail / 2 skipped, awards-database-check PASS.

**Open (others):** trunk's `scripts/awards-database-check.mjs` is broken by the ladder (`profile` → `level`). #778 carries the fix, and Lead and Backend
were told. The ladder dial (`lead-catalogue/ladder-dial`): whichever of Lead or this lane lands second passes `levelOf(careerMarks())` into the Match.
The publish (#621 + #751 + #778) is Lead's to schedule.

## Now — 2026-09-27: #778 at 0d2d5e8d on #621 @ 2c7bfdf0 (MERGEABLE, Lead verified); one job queued behind the 46-level ladder

**Next session picks up:** nothing until the 46-level ladder (RV16: Lead's `lead-catalogue/ladder-46` + Combat's `combat/ladder-46`,
Lead and Combat's work) is on trunk: this job is blocked only by that landing, and then it is done at once. Then, in `loot/client-claims`: the Match's fight level must come from `levelOf(rankMarks())`, not the
device count, so a signed-in player fights at the level the HUD shows (Lead 2026-09-27; `rankMarks()` in main.ts is the one rank figure
and this lane owns its wiring). The first fight after boot may still use the device count, because the Match is built before
`session.standing` arrives and Next/Rematch reload. Add a unit test: signed-in standing marks 10, device count 0 → level 11 on the next boot.
Required if the claims publish goes after the ladder or in the same batch.

**Done:** trunk edf5d93f merged into #778 (659a642a; `tests/account.test.ts`'s module map gained `./loot-claims.ts` and `@sentry/browser`).
Then #621's (b) head 2c7bfdf0 (my_standing returns pending and pending_owned) was merged in, not rebased (no force-push) → **0d2d5e8d**.
The loot card's "Won at" rank reads `rankMarks()`, like the HUD (Lead agreed). The skill-take test picks the move by `data-loot`, because trunk's
E2 puts it last. Gate on 0d2d5e8d: tsc and eslint clean, npm test 777 pass / 0 fail / 2 skipped, awards-database-check PASS. #778's diff against #621 is back to its own 12 files.
Ships in ONE migration publish with #621 and #751, post-playtest, scheduled by Lead.

**Standing rule (Dom 2026-09-27, via Strategy):** the only deadline this lane gives anyone is NOW or ASAP. Never name a future day or an extended time; if today is physically impossible, name the physical blocker (a battery with N minutes left, a red gate, a deploy lock, an HF quota).

**Gotchas:** after a merge, check for imports that both sides added (a duplicate `captureException` got through the auto-merge and only
tsc caught it). The deploy guard blocks even a single test file while the lock is held.

## Now — 2026-09-26: client loot claims (SCOPE 9a) is PR #778, head abd98f3d, stacked on #621 @ 86c05b2d

**Next session picks up:** wait for Backend to push the my_standing() change (adds `pending`, `pending_owned`) onto #621. Then
`git fetch && git rebase --onto origin/backend/server-standing-rank 86c05b2d` on branch `loot/client-claims`, re-run the gate (tsc src + tests,
`npx eslint src`, `npm test`, `LC_ALL=en_US.UTF-8 node scripts/awards-database-check.mjs`), `git push --force-with-lease`, and send
**both heads** to Lead and Backend. Ships in ONE migration publish with #621, #751 and the 0001 apply. Not before Lead says so.

**Done today:** #736 closed by Lead (moot after #709; branch kept as the Android perf lever). #778 opened and then fixed through two rounds:
- Outbox `src/loot-claims.ts` (`frankendom.claims.v1`, cap 10). An entry is written at the kill of a signed-in ladder win and becomes final on the
  last word: take after the Undo line, Leave it, nothing to offer, or leaving the kill screen. Posts `{opponent, piece, record}`, drops only
  23505/23514, keeps everything else. Share waits for the post, at most `CLAIM_WAIT_MS` = 3000. Eager account mount at idle.
- Lead BLOCKER (rank dip after a post), fixed with Backend's option (b): rank = marks + pending + outbox, and `flushThenStanding` re-reads
  the standing after any post, before the redraw. Tests cover the count across post → re-read (never double, never zero) and the skill
  take (piece null, rank +1). Mutation (a stale re-read) fails 3 tests.
- Gate on abd98f3d: tsc OK, eslint OK, npm test 684/0 (2 slow skipped), awards-database-check PASS.

**Open:** Backend's #621 migration commit (pending/pending_owned). Lead RULED that a null-piece claim (skill take, Leave it) must be
accepted and verified server-side, a publish blocker if the regex refuses it (Backend's side). Skills stay device-only for beta.

**Gotchas:**
- This session is registered to `~/Desktop/Business/frankendom/.claude/worktrees/brave-khayyam-076b82`. The Write hook refuses
  edits in `~/Developer/frankendom-nightborn`, so the work was done here. Same repo, so pushes land on the same remote branches.
- The deploy guard blocks test runs (and any Bash call that contains one) while `~/.claude/state/deploy_in_flight.json` exists.
  Edit files in a separate call, and wait with `until [ ! -e … ]` in the background.
- The graphics harness starts every element visible (index.html ships Share `hidden`), and its setTimeout never fires unless the test
  calls it. `'./loot-claims.ts'` is registered in its module map.

## Now — 2026-09-25 ~08:0xZ: #736 is moot in-game after #709; waiting on Lead: close it (a) or cut it to tooling only (b)

#709 (cc27cce5) builds all of the Plague Doctor's loot as `@build:plaguedoctor-*` shells in build-warrior.mjs (waxed/leather).
`loot/plaguedoctor.glb` and its PlaguedoctorCloth ORM are unreferenced, so the roughness-floor fix no longer reaches loot.glb.
The branch is rebased LOCALLY on cc27cce5 (cutter conflict resolved, trunk code kept plus mine); not force-pushed, nothing rebuilt.
Question posted on #736 (the Lead session had closed). If (b): drop the ORM jpg, loot.glb and layers from the diff, fix the stale
recipe comment in src/loot.ts, then force-push. Trunk has no Plague Doctor Gloves entry any more (flagged to Lead).

## Now — 2026-09-25 ~09:15: Plague Doctor coat is DRAFT #736 (head 5396d062), Lead chose A (.5); waiting on #709

**Shipped in #736 (A):** `--roughness-floor .8` fixes the foil (coat, mask and boots matte). Geometry is byte-identical to trunk; only
the ORM jpg, loot.glb and the layers change. Loot tests 8/8 files pass (33/33); budget PASS (loot 2,353,347 of 3,500,000 gzip).
**Greaves tris NOT reduced:** one collapse pass stalls at ~12.9k of 28,686 at any ratio, because of 1,225 non-manifold weld edges
where the skirt layers touch. The cutter now splits them for cuts below .5, which reaches 6,917 at .13 (floor ~6.8k). But the hem pulls
in and the red kilt shows at the outer thigh (B, not shipped; stills in `docs/character-references/loot-weld/plaguedoctor-coat-*.webp`).
To reach ~3.8k cleanly: remesh + rebake onto new UVs (not started).
**Next:** Lead picked A; B's flag and the split path stay in the cutter as a lever if Saturday's Android perf check fails on load or bytes. After #709 (Veteran, rebuilds the plaguedoctor carriers) merges: rebase on trunk, re-run the cut
(recipe in `src/loot.ts`), `WARRIOR_LOOT=1 node scripts/build-warrior.mjs`, `node scripts/loot-layers.mjs`, the loot tests, then READY with a ¾ still of A against trunk to Lead.
Never hand-merge loot.glb.

## Done — 2026-09-23 evening (all via Lead, base phase-r)

- **#601** Plague Doctor six pieces — merged to phase-r (Run 2). Key fix: `loot_dwarf.py --repose warrior` (his rig rests in an
  A-pose, the player's in a T; loot binds by bone name, so the sleeves landed across the chest).
- **#610** Plague Doctor fit — Boots ratio 1 + `conform` (toes covered), Helmet `conform` (crown covered). Approved by Lead.
- **#611** Nightborn sixth piece, a steel greave he wears and offers — head `f5118b69`, READY; Pitborn is its reviewer. The loot
  build fits it over his own boots too (6/310 + 3/313 boot verts outside, ≤ 3.5 mm; was 267/277 + 271/285, ≤ 20.7 mm).

## Open

- #611 awaits Pitborn's re-check and the integrator; #610 is with the integrator.
- Test gap (for the Auditer, written into #610's body): no loot test checks WHERE a piece lands; #601's mis-bind passed them all.

## Gotchas

- Loot tests pass on visibly broken pieces: composite the paperdoll layers and LOOK every time.
- Load hit 126–180 on 10 cores tonight and loot-layers crashed once. Other lanes run the same scripts: identify a process by
  `lsof -p <pid> -d cwd` before touching it, never by name.
- `phase-r`'s loot.json no longer round-trips through Python `json.dumps`: edit it as text.
- `GLTFLoader` in Node dies on loot.glb's embedded images (`self is not defined`): strip images/textures/materials from the JSON
  chunk and repack first; three sanitizes node names (dots removed), so match on `userData.name`.
- The deploy guard refuses a Bash command whose text mentions build/bake words while a deploy holds the lock, even a doc edit.

## Then — 2026-09-23 (night): PRIORITY 1 is textured carriers, the prerequisite for Phase R

**Lead, relaying Dom's priority 1 (17:4x, via Strategy):** every one of the ten opponents wears and offers six takeable armour pieces
plus its weapon, Recruit rag and scrap first (Phase R, live target 2026-09-24 14:00). **This lane is the prerequisite:** the seam
weld (`char/plague-doctor-loot` @ `817828e`: `loot_dwarf.py --all/--slots`, plus the UV-seam weld before decimating) **plus
TEXTURES** lands first, as its own PR against trunk, **by 09:00 2026-09-24**, so carriers stop reading as lumps or foil.
**No quick-cut carriers.** PR body must include: a before/after still of one carrier in the same frame (re-cut `knight.Helmet`),
tri counts, loot.glb gzip size, and the loot-layers result. Then **one PR per opponent**: the Nightborn (add Greaves → six) and the
Plague Doctor (all six), on the welded pipeline. Report to Lead only. No bakes or tests while a deploy is in flight.

**Prep, from reading `loot_dwarf.py` (not yet tested):**
- The weld does NOT have to drop textures. `bmesh.ops.remove_doubles` merges vertices, but UVs are per-loop data in bmesh, so each
  loop keeps its own UV. So weld on EVERY material path, not only Steel, and keep the piece on its own baked maps (the existing
  non-Steel branch writes `<family>_iron_color.jpg` / `_orm.jpg`). Verify on the knight.Helmet re-cut that no UV islands smear.
- The Decimate collapse can still stretch UVs across former seams. If it shows, set the modifier's delimit to UV/seam, or decimate less.
- Budget: loot.glb cap is 2 MB gzip (`636ce4d`). The Knight's own maps at ratio .2 measured 1,697,905 against the old 1.5 MB cap
  (`77ee5c1`). Ten opponents × six pieces won't fit at per-piece 768 maps. Plan one colour + ORM atlas per opponent at 512,
  and measure with `node scripts/check-budget.mjs` after each opponent.
- Selection: slots come from the dominant bone, so a coat skirt lands in Greaves (29,660 faces on the Plague Doctor). Per-character
  piece mapping needs a z-band or explicit override, not bone alone. The metallic gate (`--metal`) suits iron only; `--all` + `--slots` suits cloth.
- After any loot.glb change, `node scripts/loot-layers.mjs` re-renders ALL layers (the shared frame widens), so commit the whole set.

## Now — 2026-09-23 (evening): the Plague Doctor is a playable body on roster-v0

**Now (next session picks up):**
1. Watch the 21:20 roster-v0 publish. After it, verify the live bundle from the public side: `release.json` revision, then that
   `plaguedoctor-*.glb` is served and the ladder offers him after the Dwarf.
2. **Silhouette test (Brief 18 deliverable 2), measured on the REAL body now** (Lead OK'd skipping the gate for tonight; owed after).
   Use a `--flat` plate at the fighter's camera (PR #500), not a matte: he has a mesh. Compare against the nine.
3. Post-beta carriers: textured Helmet (beak mask, brim, hood) and Body (the coat), from `char/plague-doctor-loot` @ `817828e`.
4. Finishers: he ships `finishers: ['plainDeath']` only. Run the finisher harness on his body and list what passes (the Dwarf rule).

**Done today (all on `origin/roster-v0`, pushed with no force, merged with the branch first each time):**
- `7ce5c24`: body + roster row. Source: a two-pass FLUX Kontext edit of the approved reference into a front A-pose
  (`docs/character-references/plague-doctor-source-v1.png`, the chain in `.kontext.json`). TRELLIS.2 seed 190926/1024/100k/2048,
  then `node scripts/build-creatures.mjs plaguedoctor` with **donor `warrior.glb`** (the hero rig, the longsword and its clips).
  50,970 tris, 25/25 clips, bind error 4e-6, max grip gap 0.066 m (Guard), versus card rendered.
  `ROSTER.plaguedoctor` is the last rung. `ARCHETYPES.plagueDoctor` = the Nightborn row verbatim, scale 1 measured (top 1.840 m vs 1.822).
- `0f508f9`: migration `202609230002`, one file for all 14 encounter ids (the four new ones included). Backend re-OK'd it at `936a541`.
- `936a541`: `tests/encounter-migration.test.ts` checks every ROSTER key is in the newest encounter migration.
- `f076d19`: he joins `tests/characters.test.ts` FIGHTERS (38/38, [slow] included).
- Receipts at `7ce5c24`: tsc, eslint src, typecheck:tests, 25 targeted test files 209/209, build, check-budget PASS
  (his pairing 7.30 of 12 MB).

**Open:**
- `record-version-guard` is red on roster-v0 **by design**: Combat does one RECORD_VERSION 7 → 8 re-pin at 21:15 after the
  last body. Lead ruled no lane bumps it.
- No carrier loot pieces ship tonight for any of the four (Lead's ruling). He drops nothing, and the longsword is the player's own.
- Combat owns his real archetype row and battery. Web owns the marketing-page opponent cards (the Dwarf is missing there too).

**Gotchas (each cost time today):**
- **Opponent ids must match `^[a-z]{1,32}$`**: `loot_claims.opponent` in `202609230001_server_awards.sql`. `plague_doctor` would have broken
  his loot claims. Every new id also needs the `fighter_profiles_encounter_check` migration, or cloud sync fails on his rung.
- **Kontext keeps the source pose** unless the prompt is short and pose-first. Pass 1 fixed the facing and removed the swords; pass 2
  raised the arms. The Space returns **WebP named .png**: re-encode with `sips -s format png` before committing.
- The player's build names its sword node **`SwordDrawn`**, not `WeaponDrawn`. `creature-check.mjs` now falls back like the game does.
- **TRELLIS meshes are split at every UV seam.** Decimating a loot piece tears it into shards unless the seams are welded first
  (`loot_dwarf.py` on Steel, branch above). Untextured Steel at .12 still reads as foil on leather: carriers need their own texture.
- Park this worktree on a trunk branch when idle. The Stop-hook quality gate runs here, and roster-v0 carries red tests by design.

## Now — 2026-09-23 (later)

**Strategy's three rulings of 2026-09-23 01:15, which set how deliverable 1 is run:**

1. **One instrument — corrected 01:40: D1 is cut from MATTES, not plates.** A `--flat` plate needs a mesh and he has
   none, so D1 is `u2net` mattes, arms at the sides, with the slot list stated. The Executioner lane runs a
   matte-vs-plate calibration on the seven rigged fighters once #500 is on trunk; **D1's table states that delta as its
   uncertainty.** Plates from the day he has a mesh. #500 still merges first, #502 still re-cuts off plates, and **no
   table mixes the two instruments** — that is how the Knight's first ratios came out backwards.
2. **For a masked archetype the silhouette IS the kit, so the bare pass is INFORMATIONAL, not a gate.** The gate is
   in-kit at every rung. Recruit-2 for a masked archetype is therefore **Helmet + Body** — his two identity carriers —
   so no game state shows him without both and take-one removes at most one. In #490 at `9c56528`. Measure bare anyway
   so the number sits beside the Knight's. Dom may still choose a body-level feature; nothing waits on it.
3. Report line unchanged: number, head sha, both ratios bare/in-kit and against the Nightborn, when the D1 PR is READY.

**"Bare" is not one definition across the roster, and the fix is annotation, not normalisation.** Multi Chars proposes
**bare = body draws only, every loot piece off** for every figure, which is right to reject "each figure minus its own
`LOOT` row" — that measures kit completeness while looking like it measures build. But it is still not invariant,
because **what lives in the body mesh versus a loot draw is itself a per-character authoring call**: `src/loot.ts:38`
fixes `Body` as "the tunic and what hangs on it", and `src/loot.ts:44` says the Pitborn has no chest piece *because he
wears a rag sash, not a tunic* — so his sash is body geometry. Strip every loot piece from the Pitborn and he keeps a
sash; strip them from the Nightborn and his torso is bare. An invariant "bare" exists only for launch characters,
where `docs/SCOPE.md` rules nothing on the body is rig dressing. For the beta six it is a per-character fact, so **the
D1 table needs a "what survives stripping" column beside the number**, not a normalised definition that hides it.

**A trap for that measures table, found in `src/loot.ts:40-46`: the Nightborn's own LOOT row is FIVE pieces plus the
estoc — he has no `Greaves`.** The six-piece ruling binds launch characters from Legionary; the beta six predate it
(the comment at `src/loot.ts:38` fixes what `Body` means, and the Pitborn's row is the precedent that a chest piece can
be legitimately absent). So a bare Nightborn keeps his shins and a bare Plague Doctor does not. **State that in the
table or the two bare numbers are not comparable** — this is exactly the shape of error that put the Knight's first
ratios backwards.

**Deliverable 1 for Brief 18 — the silhouette test, bare and in loadout — is the next task and has not started.**
Strategy's ask (01:15, after Lead handed off at 00:50): the fighter's camera, bare and in loadout, exactly as the
Executioner lane did for the Knight in **#502**; measured; one PR; then one line back to Strategy with the number, the
head sha, and the two ratios bare/in-kit and against the Nightborn. #502 is the shape to copy —
`scripts/character/silhouette.py`, a `<NAME>-SILHOUETTE.md`, the bare source PNG, both silhouette PNGs and a
`measures.json`. His loadout pass cuts from the approved reference (#493); the **bare pass needs a bare source
generated first**, the way the Knight's `knight-bare-v1.png` was — FLUX.1-dev via `gradio_client`, seed 190926, the
route recorded below.

**#490 now names his six takeable pieces** (pushed `3d1030c`): Helmet = the beaked mask and split brim, Body = the waxed
coat, Arms = the boiled-leather sleeves and shoulder capes, Gloves = the gauntlet cuffs, Greaves = strapped shin guards,
Boots = heavy buckled boots; the longsword is not one of the six. Required before merge by the owner's 2026-09-22 23:12
ruling. **It sharpens deliverable 1: all three of his named silhouette carriers — brim, beak, coat skirt — sit in Helmet
and Body, so every one comes off.** The Knight measured that failure (0.367 → 0.246 bare, the figure read as nobody) and
he is likely to fail it worse. The brief says so and does not pre-judge the fix.

**`docs/SCOPE.md` (PR #492, branch `docs/scope-2026-09-23`) is the current dated scope and beats every older brief,
state entry or memory line.** Read it first next session. It confirms this lane owns the Plague Doctor, that he is
**launch scope, not beta**, longsword, next after the Knight in cost order, and that briefs specify **outline, not
build** (#499).

**A harness deliverable shipped tonight: PR #500, `--flat`** — the opponent alone at the game's own lock camera on a
plain flat backdrop, plus an unlit-black plate. Built for Multi Chars' reskin check in #495. Measured: corner spread 0,
max per-row left/right difference 0. **The finding worth keeping: a valid background is not a valid mask.** A bg−18 cut
of the beauty pass loses part of his head and hands — both masks cut by one rule, the plate is 204,877 px and the beauty
pass loses 5,056 (2.47%) and adds none. Two implementations agree. Use the plate for deliverable 1's measurements, not a
threshold of a beauty render. Nightborn shoulder-over-height on the plate: **0.318** (Multi Chars' band).

Open from this lane, all four mergeable, none merged: **#479** (this file), **#490** (Brief 18, +six pieces), **#493**
(the reference), **#500** (the harness).

## Now — 2026-09-23

**The lane has a second character: the Plague Doctor (Brief 18).** Dom widened the scope in this session's own words
on 09-22 — *"a masked opponent wielding the longsword… silhouette test at the fighter's camera passes before any model
work; AAA judged on a phone screenshot; one PR per deliverable; nothing ahead of the shield in Combat's queue. The
Nightborn stays yours."* A Strategy relay had tried to widen it earlier and was refused until he typed it here; that
refusal was correct and is worth repeating — **a relay cannot widen an owner-set scope.**

Open from this lane, all docs-only and all clean: **#479** (this file), **#490** (Brief 18, approved by Strategy),
**#493** (his approved reference image). Each merged current trunk to clear a stale `src/arena.ts` inherited from the
~90 minutes trunk was broken on 09-22 (`lorarii.standing` called with no import → TS2304); `git diff … -- src/arena.ts`
is now empty against trunk on all three.

**Two measured findings from Brief 18 that outlive it.** `src/characters.ts:26` — `longsword: { Thrust: 'Riposte' }`,
**one** role override, against 19 for the Witch's bladed staff and 21 for a creature family: a longsword character is
nearly free, a new weapon family is the most expensive unit in the project. And **a mask deletes the face problem** —
no scan, no KeenTools credits (still 402 since 09-17), no head pipeline at all.

**The image route Lead had briefed to three lanes was wrong and this lane fixed it.** `scripts/character/kontext.py`
is an image *edit* (`--image` required); there is no text-to-image script in `scripts/character/`. Five candidates were
generated instead from Brief 18's own text: Space `black-forest-labs/FLUX.1-dev`, `/infer` via `gradio_client`,
**seed 190926** fixed across candidates so the variation is the design and not the noise, 896×1152, guidance 3.5,
28 steps, auth reused from `kontext.py`'s `token()`. Throwaway script, scratchpad, not committed. Recipe sent to Multi
Chars and the Executioner lane; whether it becomes a real script is Lead's call once it is known not to be a one-off.

**Two techniques worth keeping, both cheap:** put each candidate's **silhouette, computed from its own pixels**
(background = median of three 60×60 corners, foreground darker than bg−18, 3×3 min filter — **per image**; one global
threshold blacked out a whole panel) directly under it, so a design that is striking in detail and shapeless in outline
disqualifies itself on the sheet; and **keep the rejects with their reasons** — one candidate was dropped because its
outline read as **the Executioner's**, which is a reskin test at silhouette level, before a model exists. Offered to
Multi Chars as a number rather than a judgement: normalise both masks to the same height, align on the feet, take IoU,
and rank.

Dom picked **"E — the patched beak"** (boiled leather, cracked and scorched, one lens plated over with a riveted iron
patch, a warped split brim). **His letter and his pasted image disagreed** — the sheet's columns were labelled C / B / E
and he answered "option c" then pasted the third panel; the image won and he confirmed. Next sheet labels A / B / C in
order.

**Next: deliverable 2, the silhouette test** at the fighter's camera, bare and kitted, against the nine — not started.
His narrow warped brim means the coat skirt and the beak carry the read rather than the wide horizontal Brief 18
originally assumed, so it is measured, not asserted. Nothing is authored before it passes.

**The Nightborn himself is unchanged and needs nothing.** His own TRELLIS face is live; other lanes have rebuilt him
since (spider-hand fix, ladder `lapse` retune) and this lane authored none of it.

## Then — 2026-09-22

Nothing building and nothing open from this lane. Worktree `frankendom-nightborn` clean, fast-forwarded to trunk
`becec83`; no open PR authored here.

**His own face is live** — #198 merged as `032e2fd`, deployed as trunk `a408b9f` on 09-20. Verified from the public side
at the time, not on the merge: `release.json` revision `a408b9f…`, entry `index-BTEtpnRT.js` referencing
`nightborn-DHVK-EOH.glb` (the stand-in build had been `nightborn-CmkJzSnx.glb`). **The served GLB's md5 never matches the
committed one** — the build applies `EXT_meshopt_compression` — so parity is checked on geometry: 59,524 tris served ==
`src/assets/nightborn.glb` at `a408b9f` (md5 `6899475349cf`). Re-checked 09-22 after Scalable Chars' rebuild: served
`nightborn-Bb2iyAc4.glb`, 60,393 tris, matching trunk's rebuilt asset (md5 `9a69a19983c4`) — still his TRELLIS face, since
`head.FIGHTERS.nightborn` on trunk still points at `nightborn-trellis-01.glb`.

**Two things about this character that bite other lanes, both already recorded elsewhere and repeated here because they
are his:**
- `src/assets/weapons/estoc/nightborn-estoc.glb` must stay **byte-identical** to `src/assets/nightborn.glb`
  (`tests/weapons.test.ts:460`). A mismatch does not fail fast — the deepEqual on two ~7 MB buffers **hangs ~280 s**.
  Rebuild the twin in the same commit as the body, always.
- His TRELLIS head `artifacts/source/keentools/nightborn-trellis-01.glb` (+ its `.json` tone report) is **gitignored and
  exists only in worktrees that were handed a copy** — this one and `frankendom-dwarf`. `parts.py` does not error when it
  is missing: `os.path.exists(HEADMOD.KT_GLB)` falls through to a generic stand-in, so a rebuild elsewhere silently ships
  a face regression. Scalable Chars hit exactly this and discarded two builds (docs/state/character.md, 09-22).

Open from this lane: none. Two cosmetic leftovers the owner has not asked for — body AO mottle on the pale skin at ~1 m,
and head faceting from `decimate: 0.14`. Both are Blender rebuilds, no code, no gameplay change.

**Scope:** the owner scoped this session to the Nightborn on 09-20 ("only work on that char"). A Strategy relay on 09-22
23:30 widened it to build the Plague Doctor (Brief 18); **held pending the owner's own word in this session** — a relay
cannot widen an owner-set scope, and the same relay asking for a standing scope note in `CLAUDE.local.md` was declined
for the same reason. Strategy agreed the hold is correct and has put the question to him. Same precedent as the
Executioner lane's Nord refusal (docs/state/executioner.md).

## Done — 2026-09-16 → 22

- **#85 — the Nightborn ships (opponent 5).** `OPPONENTS.nightborn` at `src/moves.ts:489`: scale 1.03, `RULES.health`,
  **poise 0**, and the committing guard `{ window: 16, recovery: 40, commits: true }` — the three per-opponent knobs that
  keep him from being a reskin. `GuardProfile.commits` (`src/moves.ts`) is his: a parry that must run its window, no
  action out of it, and one that met nothing always ends exposed, held or not — "a man's parry yields to any action; the
  Nightborn's does not". The read side is in `src/ai.ts` (tell-reading estimate for a committing parrier, the `parker`
  read); the two intended answers are pinned in `tests/opponents.test.ts` (`feintAndPunish`, `chargePast`). Corrections
  against the owner's draft, recorded so they are not reopened: no facial rig, so no fangs; the charged heavy IS
  parryable; `parryStun` 90 means a kick cannot interrupt the riposte.
- **#198 — his own face, credit-free (live `a408b9f`).** KeenTools returned `402 Insufficient credits` twice, so the head
  came from **TRELLIS.2** on Hugging Face instead: `scripts/character/trellis_head.py` converts a TRELLIS mesh to the
  KeenTools head contract measured off the hero scan (eye spacing 0.5755, eyeball radius 0.152, teeth centroid, face
  toward −Y) — front render + MediaPipe landmarks to place the eyes, lid openings cut through the mesh, texture tone
  matched to the portrait, donor eyeballs/teeth attached by **slot index** (imported donor materials get `.001` suffixes,
  so names cannot be trusted), materials emitted in the order `Material_0..3`. `head.FIGHTERS.nightborn` gains
  `hair: 'mesh'`, which gates seven places in `head.py` that assume a photographed head — chiefly `delight()` (median
  0.061: it drove the face charcoal for three builds), the coverage refill, and the pallor restyle. `HEAD_KT_GLB` lets
  another adapter output be tried without editing the table. Budget at merge: 9.91 / 12 MB per fight, 31.57 / 32 MB dist.
- **The no-credits pass — 2026-09-17** (full record in docs/state/character.md): before TRELLIS, the stand-in (the hero's
  scan) was restyled to his identity on its own texture — `skin_mul`, `pallor`, `dark_eyes`, sunk sockets, throat scar,
  cold-black crown strands, and pointed ears as geometry (`parts.ear_points`, two 3 cm cones on the scan's own helix
  tops). The TRELLIS head superseded the restyle; `KIT.nightborn` is `'ears': False` now that the real head carries them.
- **Rebuilt by other lanes, not this one:** Scalable Chars' spider-hand rebuild (09-22, +2,908 B, estoc twin rebuilt to
  match) and the Auditer's ladder retune `lapse .15 → .3` on the **normal** rung (09-22: the hero brain's wins against him 5 → 10 of 24, Combat signs
  off). Earlier owner retunes: easy (09-20) to a human reaction, a quarter parry and more lapses — an 8-tick reaction and
  a .45 parry had made easy as hard as hard; hard (09-20) discipline 40 → 35, pressure .5 → .6. All in
  docs/state/combat.md; this lane authors none of them.

## Open

- **Nothing.** The estoc's parked stance (#419 draft, #429) is Weapons', and its revival explicitly names this character —
  "either the Nightborn stops carrying the estoc, or the trident-vs-Nightborn fairness row is re-measured against a
  deliberately retuned Nightborn" (docs/state/weapons.md). Neither is this lane's to decide; a Nightborn-profile DECISION
  goes to Lead, never a reopened stance number.
