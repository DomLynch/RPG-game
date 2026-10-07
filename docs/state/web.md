## 2026-10-06 ~19:00 (+04) — HANDOFF before /clear (Dom). READ FIRST: tutorial UI #1442 @b41d1132 waits on the Auditor; loot2 not started; NO VPS browser jobs until the Auditor clears #1438/#1443

**Now (pick up here):** (1) **#1442** `web/tutorial-ui` @b41d1132 (base `char/tutorial-pacing` = Char's #1441 @e4cf0d00, PASSed by Combat): the tutorial start scene's big prompt behind `?tutorial=1` (src/tutorial-ui.ts, #tutorial-prompt, CSS, ~6 lines in main.ts). Reads match.tutorial.current/.done/.parryWindow/.tooFar. Wording: SLASH "tap Fight to draw" then "tap Slash"; GUARD "hold Guard as his swing comes"; PARRY "TAP Guard when it says NOW!" (NOW! state "TAP Guard!"); ROLL "roll as his thrust comes"; STEP CLOSER "move toward him"; YOU'RE READY + Fight! (sets frankendom.firstloss.v1, goes to ?fight=1). Owed: Auditor verdict on #1441+#1442 (delta since b351bd03 = src/tutorial-ui.ts + its test), then ONE VPS stills job with a hard timeout (Guard, STEP CLOSER, Parry NOW!, Kick, Roll, YOU'RE READY) only after the Auditor clears #1438/#1443; stills into the #1442 body and to Lead. Deploy rebuilds /preview/tutorial/ between releases; Dom's yes replaces the first fight (a separate small PR). (2) **loot2** (Lead, Dom's screenshots): `?look=loot2` only, CSS-only, branch `web/loot2` off trunk (nothing written yet): one column, Take = single primary, Leave/Link/Clip small secondary in one row, Pit entry one clean button, nothing overlapping at 375x812; preview /preview/loot2/ via Deploy, stills to Lead, no live change until Dom's yes.
**Done today:** #1396 lessons UI (53ff2714), #1398 touch router + tier (live 1673e04b), #1409 ledger drop, #1411 row 43 fix-forward (seeds the first-loss flag). Camera is FROZEN (Lead relaying Dom via Strategy): no framing/viewport/layout changes that move the fight.
**Open:** Auditor on #1441+#1442; loot2; retaken stills.
**Gotchas:** (lxxvi) BSD `sed -i -e` leaves `file-e`; `git add src tests` committed one (#1409 first head): use `sed -i ''` and check `git ls-files | grep -- '-e$'`. (lxxvii) `pkill -f name` kills the calling shell if the command line contains name: use `pkill -f "[n]ame"`. (lxxviii) uncapped VPS stills runs hung 48 min and starved the Auditor (load 84-92): one job, hard timeout, kill own pids. (lxxix) `git rebase --onto origin/<base> <old-base-sha> <branch>` for a stack whose base was rebased. (lxxx) rsync of the checkout is ~1 GB: background it. Untracked scratch (do not commit): scripts/_loot-stills-tmp.mjs, scripts/_tutorial-stills-tmp.mjs.
**Branches:** `web/tutorial-ui` @b41d1132 pushed; `web/state-1006b` (this entry); `web/loot2` not created yet (an empty local branch may exist).

## 2026-10-06 ~08:40 (+04) — HANDOFF before /clear (Dom). READ FIRST: #1396 head 3c893cc7 has a trunk merge + a NEW release row; its final VPS receipts and the sha to Auditer/Lead are still owed

**Now (pick up here):** **#1396 @3c893cc7: receipts DONE and 3c893cc7 SENT to the Auditer (local_866b9640-bb94-4aa0-b8fc-df2bfc00e271) and Lead (local_1bcdcf54-b8b3-4ee1-9597-f3c06d9e74d9) at ~08:50; the body's checks line is updated. Receipts ON 3c893cc7 (VPS, capture, 04:35Z; /opt/frankendom-shadow/work/web-lessons-final.out): 152/152 tests (lessons, graphics, hud, first-loss, input, release-checks), eslint 0, tsc 0, build 0, row 51 exit 0 (4 steps, 0 page errors). READY is ON HOLD until the Auditer re-passes 3c893cc7** (their PASS was on bcac31a6; the delta is the trunk merge, row 51 and the licence line). Nothing for me to do until their verdict; then tell Lead. If a fix is asked, re-run the runner (rsync the checkout to work/web-lessons, keep the runner OUTSIDE the synced folder: `rsync --delete` wipes it; runner = `node --test` the six test files, `npx eslint src scripts/first-loss-browser-check.mjs scripts/release-rows-for.mjs tests/lessons.test.ts tests/release-checks.test.ts`, `npx tsc --noEmit -p .`, `npm run build`, `FIRST_LOSS_RECEIPT_DIR=out node scripts/first-loss-browser-check.mjs`) and name the receipts at the head of the body.
**What changed on #1396 since the Auditer's PASS (all pushed, branch web/lessons-ui):** (a) trunk merged (8d1a979a); (b) **release row 51 `scripts/first-loss-browser-check.mjs`** (Lead's ask: no release row covers a fresh visitor): fresh context opens `/` -> lesson starts (recorder false, practiceOnly, flag stored) -> script plays out, all five beats heard in order, after-loss line + "Fight for real" -> lands on `?fight=1`, a normal fight starts (no `__lesson`, no teaching line) -> a second plain visit is not the lesson -> 0 page errors. It PASSED once on the VPS (ROWEXIT 0, 4 steps) at 9e86e3c5. Registered in `.quality-gate.json` release_commands (row 51, appended so existing row numbers do not shift), release_triggers (joined the page rule main.ts/index.html hit; a rule ahead of src/** for src/lessons*.ts + src/first-loss*.ts that carries src/**'s rows; its own script's own rule) and scripts/release-rows-for.mjs AREAS (deploy-time scope: main.ts, src/lessons*, src/first-loss* now run 6 rows, not 5); tests/release-checks.test.ts re-pinned with the reason (50 -> 51 rows; kept(main.ts) 5 -> 6). release-checks 13/13 locally; (c) **licence notice**: render-budget line removed (Dom scrapped the render budget, World reverts #1395) and a test pins "only shipping ports are listed" (touch-router/layout-tier stay: they are #1398).
**Also open:** **#1398** `web/touch-router` @ae942d99 (off trunk): touch router + layout tier, inert, stills + receipts in the body; **Lead has not routed it to the Auditer yet** (asked twice). **#1399** (this docs PR). Pit-room stills for Strategy (10-02) still owed or covered by the live Pit-walls shots (Lead/Strategy's call).
**Lead's rulings to remember:** the lesson prompts ship for the scripted first loss only, the 09-24 "status line only reports" rule stays everywhere else, cited as "Lead ruling 2026-10-06 under Dom's delegation" (never Dom's own words); a signed-in player on a new device may see the lesson once (accepted, one line in the body); no CSS reads data-tier until a named bug + Dom's stills; tablet = 1000-1024 wide.
**Gotchas (new):** (lxxi) `rsync --delete` of the checkout wipes any runner script you put inside the synced folder: keep it next to it. (lxxii) Release rows are numbered in `.quality-gate.json` release_commands; append, never insert; `release_triggers` is first-match-wins per file (join an existing rule or put a new one ahead carrying the other rule's rows); the deploy-time scope is a SEPARATE table (`AREAS` in scripts/release-rows-for.mjs) and tests/release-checks.test.ts pins both the 50/51 total and each file's rows. (lxxiii) zsh: `K="ssh -o ..."; $K host` fails ("no such file"): put ssh calls in a bash script file. (lxxiv) The deploy hook blocks the WHOLE command if its text has `node --test`/builds, so edits in the same command never run: edit first, run checks from a script file or on the VPS. (lxxv) `pkill -f vps4.sh` leaves the child ssh alive; kill both.
**Worktrees/branches:** checkout on `web/state-1006` (this entry); `web/lessons-ui` @3c893cc7 pushed, `web/touch-router` @ae942d99 pushed. VPS folders to delete when the Auditer is done: `/opt/frankendom-shadow/work/web-lessons`, `web-tier`, `web-lessons-final.sh`, `web-lessons-final.out`. Untracked scratch to delete: `scripts/_stills-tmp.mjs`, `_stills-win-tmp.mjs`, `_lesson-stills-tmp.mjs`, `_tier-stills-tmp.mjs`, `mockups-*`.

## 2026-10-06 ~03:00 (+04) — HANDOFF. READ FIRST: #1396 (first-loss prompts) ships on Lead's ruling, Auditer PASS pending; #1398 (touch router + layout tier) is waiting on the Auditer; nothing of mine is live-blocking

**Now (pick up here):** (1) **#1398** `web/touch-router` (off trunk): src/touch-router.ts (who owns each finger, wired ONLY to the arena camera drag in main.ts) + src/layout-tier.ts (compact/standard/tablet on `<html data-tier>`; tablet = 768+ short side and 1000-1024 wide per Lead). Both ported from levy-street/world-of-claudecraft @f46f30f (MIT notice in the headers). Behaviour-neutral and inert: input.ts and the zoom guards untouched, **no CSS may read the tier until there is a named bug and Dom's stills (Lead)**. Owed: 375 stills in the PR body (VPS job `work/web-tier`, script `scripts/_tier-stills-tmp.mjs` untracked), Auditer PASS on the head, then Lead's READY. (2) **#1396** `web/lessons-ui` @3dc54b1c, stacked on Char's #1394 (@400773de): the five lesson prompts (src/lessons.ts, ids and `match.startLesson` from first-loss.ts), HudView.lesson/lessonFight, the one-time first-fight trigger (`frankendom.firstloss.v1`, plain `/` page + no scorecard fights), after-loss line "You fell. That was the lesson." + button "Fight for real". **Lead ruled 2026-10-06 under Dom's delegation: the prompts ship for the scripted first-loss fight only; the 09-24 "status line only reports" rule stays in force everywhere else. Hold removed; still needs the Auditer's PASS.** (Dom's own 10-05 words only said "teaching pack on existing surfaces"; cite Lead's ruling, not Dom's.) Retarget to trunk once #1394 merges. Owed: Auditer PASS on 3dc54b1c (asked, queued).
**Done today:** #1314 (DUEL for signed-in players) merged ffa4eea8, ancestor of live 4056467a; live Pit-walls stills for Dom (5 shots, 390x694, `stills/pit-walls-live-baaf19d7` @9173c9f2) sent to Lead; #1396 and #1398 opened; VPS folders `web-live` deleted.
**Open:** Pit-room stills (day + night, 375, hero in the Pit with the loadout sheet open) owed to Strategy since 10-02: the live Pit-walls shots may cover it, Lead/Strategy's call. #1396 waits on the Auditer. Layout-tier CSS waits on a named bug.
**Gotchas (new):** (lxiv) tests/graphics.test.ts boots main.ts in a node VM and stubs every `./x.ts` import by name: a new import in main.ts needs `modules['./x.ts'] = ...` there or EVERY harness test fails with "x is not a function" (hit by lessons.ts; fixed in the same PR). (lxv) The one-time first loss would hit every fresh harness fighter: boot() seeds `frankendom.firstloss.v1` = '1'; seed `''` to meet it. (lxvi) `firstLossDue` needs a plain `/` URL: `?debug=1` or any parameter disables the trigger, so stills of the plain path must load `/` and the prompt stills use `?lesson=1&debug=1` + `__lessonShow(id)` (Char owns `__lesson`). (lxvii) The kill-screen button shows only after the finisher camera settles: wait for `#reset-button` visible AND opacity 1 before the after-loss still. (lxviii) VPS capture recipe now: rsync the checkout to `/opt/frankendom-shadow/work/<lane-x>`, `ln -s ../cam-A/node_modules`, run under `/opt/frankendom-shadow/bin/capture <lane> ...`; a job that holds a slot over 10 min logs a WARNING (a long scripted fight can); delete the folder after. (lxix) send_message needs the full `local_...` session id from list_sessions, not the 6-char one from ListAgents. (lxx) I sat 20 min "waiting on the VPS" after the job had finished: poll the output file, do not wait for the notification.
**Worktrees/branches:** checkout on `web/state-1006` (this entry); `web/lessons-ui`, `web/touch-router`, `web/duel-signed-in`, `web/state-1002` pushed. Untracked, mine: `mockups-arena-draw/`, `mockups-profile/`, `scripts/_stills-tmp.mjs`, `scripts/_stills-win-tmp.mjs`, `scripts/_lesson-stills-tmp.mjs`, `scripts/_tier-stills-tmp.mjs` (delete the four scratch scripts when the PRs land). VPS `work/web-lessons` and `work/web-tier` to delete after the Auditer.

## 2026-10-03 — final held Ground Set NIGHT lateral clearance candidate; all-four retake pending

- Duel11cdd final27PASS/1HOLD: Ground Set actor1 NIGHT still merges with foot shadow in qualified held tell/payoff. Physically inspected current375 pixels and raw tell258windup0.65/payoff314recover0.311 under `seven-class-a-foe-clearance-20261003`; forward-only f002 remains a retained negative for native readability.
- Exactly ONE existing Ground position line changed: same continuous NIGHT positive-cos yaw weight adds up to0.35 outward lateral spacing to both existing fleck rows. Existing forward correction retained. All other source bytes exact: DAY/opposite-facing NIGHT placement, Cut Mark/private helpers/resources/pool/size/colour/opacity/clock/fade/G1yield/clear unchanged. No style/light/glow/stomp/pose/assets/framework/mechanics changes.
- Added3 lateral-clearance/accepted-placement assertions to existing meaningful placement test; original12 cases and same-active side-on continuity remain byte-identical. Actual pre-fix lateral assertion RED retained; final14/14 focused PASS, scoped lint/types exit0, diffcheck PASS. `artifacts/seven-class-a-web/ground-lateral-receipt.json` binds hashes/receipts; all prior negatives preserved.
- Native readability UNVERIFIED after delta. Auditer affected one-line source binding; Combat owns ONE all4 Ground retake and explicit other24 carry. No Web browser/build/fullgate/variants/integration writes. All owned processes closed: FREE.

## 2026-10-03 — Ground Set opponent NIGHT foot-shadow placement repair; native retake pending

- Duel final source-fcf42 verdict25PASS/3HOLD: Web only Ground Set actor1 NIGHT held. Actual actor1 NIGHT held-tell/payoff and accepted actor0 NIGHT reference pixels read; raw tell258windup0.65/land300/payoff314recover0.311. Minimum cause-specific placement correction from current399 source.
- Exactly ONE factory position line changed: existing Ground Set NIGHT localz adds up to0.35 using continuous positive cosine of existing target-facing yaw. Opposite-facing NIGHT and all DAY positions unchanged; Cut Mark and every private helper/resource/ink/clock/fade/G1yield/clear byte-identical. Static ground placement through payoff, no stomp/pose/step. Initial hard-sign proposal rejected by same-active side-on regression; retained RED receipt, continuous correction passes.
- Existing12 cases byte-identical plus2 meaningful placement/continuity regressions; actual14/14 focused PASS, scoped lint/types exit0, diffcheck PASS. Original prefix/whole remaining source parity physically asserted. `artifacts/seven-class-a-web/ground-front-receipt.json` binds source/test/RED/check receipts; all old negatives preserved.
- Combat owns one combined8 affected Knuckle/Ground capture with explicit other20 carry; Auditer affected-delta binding. No Web browser/build/fullgate/variants/integration-checkout writes. Postrepair native look UNVERIFIED. No owned workers/listeners: FREE.

## 2026-10-03 — bounded Ground Set/Cut Mark readability repair; integrated frames pending

- Lead bounded repair after Duel judged source-c251: Ground Set DAY pass/NIGHT both actors floor blend; Cut Mark all four cases faint smear. Physically viewed native375 held-tell/payoff images for both held night Ground Set actors, both Cut Mark actors DAY/NIGHT, and Ground Set DAY0 reference; phase observations bind held tell to windup0.65 and payoff to recover1/3.
- Minimum factory-only delta: Cut Mark uses existing private hard fleck texture, dark stripe width0.24→0.34, stance offset0.43→0.85 and sweep0.82→1.45 to expose endpoints outside body shadow. Ground Set NIGHT-only width0.14→0.20 and outward offset0.22→0.36; DAY placement/colour preserved. Darker NIGHT body, narrow restrained warm edge. No pale fill/glow/lights/high plume/new stomp/pose/assets/clock/mechanics.
- Entire original B/boss/helpers prefix AND new factory cast-clock/yield/clear/fade sections physically byte-identical to prior source. Existing tests unchanged; actual12/12 focused PASS after Lead CPU closure grant, scoped lint/types exit0, diffcheck PASS. Old receipt preserved; new `artifacts/seven-class-a-web/readability-receipt.json` binds delta.
- Combat owns one combined changed20-case source capture and batch integration; independent review binds affected delta only. No maker browser/build/full gate/variants/publication. Native readability after repair remains UNVERIFIED. No owned worker/listener: FREE.

## 2026-10-03 — Ground Set and Cut Mark A source candidate; integration/visual checks pending

- Direct Dom resume via Lead; fresh base `3348ddfbac760290baa9a36979fc8f6678c3e08b`, isolated `web/seven-class-a`. Combat contract: `groundset`/`cutmark`, exports `createGroundSet(scene, opponent, exposure)`/`createCutMark(...)`, existing normalized caster1 render/clear and manager disposal.
- Appended 69 lines to `src/special-fx-dwarf-shield.ts`; original module prefix byte-identical (SHA256 `fa21532adff2784ac1fec09d1057eacd228f7a169f8953dbbc757e63652e1982`). All B/boss/helpers preserved. Compact pooled ground planes: stationary Dwarf weight patches, Shieldmaiden torn stripe plus one accepted-landing sidecut. Dark body/narrow warm edge; no pose/kit/audio/mechanics changes.
- `tests/seven-class-a-dwarf-shield.test.ts`: missing exports RED preserved; actual 12/12 focused CPU PASS, real sim events for either caster, non-origin/yaw, DAY/NIGHT numerical bounds, frozen events, landing-only payoff, fizzle, clear/rearm/yield (active gather AND landed recovery)/epoch, late-load/stale-counter protection, private pooling and exact-once manager disposal. Scoped lint/types and diff check PASS. Receipts under ignored `artifacts/seven-class-a-web/`.
- Combat owns integration and all registry/routes/identity. Full gate/build/browser/release checks remain HELD for Lead slot. No rendered 375px DAY/NIGHT acceptance, publication or physical-phone claim. No owned worker/listener: FREE. Next: Combat batch intake, independent review, Lead-slotted combined CPU/browser checks.

## 2026-10-02 — two independent Sparring special selectors (source implementation, unverified)

- Base actual live b1a1144338d9e96bd6792604f9650daf97326852, isolated web/sparring-independent-specials-20261002. Supersedes abandoned one-control plan; old selector release and Drag artifacts preserved.
- Web source: separate Your fighter/Opponent groups; Your legacy skills plus Combat-supported class/tier presets; foe five bands with independent None/default/reset. Every new-form Start emits yourSpecial=id|none, preserves legacy skill/kit/Stage/Finisher, validates exact choices, writes nothing. Old omitted parameter preserves legacy mode. Bad/conflicting/duplicate/non-Spar player selections refuse visibly.
- Main passes per-side selection to Combat Match API, routes preload/cast/fizzle by actor and exact preset, keeps legacy path only when selection omitted. Existing read-only Sparring probe exposes real fighter/event evidence; updated current-source completion uses real HUD casts, player-only/opponent-only/both and legacy links, retaining inventory/contrast/Stage/cleanup checks. Focused source regressions added.
- NO manual tests/build/browser yet: Combat exclusive CPU. Combat helper+Match copied read-only for imports/types, not Web-authored or committed; exact runtime freeze will replace copies before integration. All39 support is objective/provisional until Combat factory+genuine Match evidence and independent review, not a current player-visual acceptance claim.
- Next: intake exact Combat reviewed commit, Web required CPU after transfer, Duel independent source/tests, allocated actual375/cast/effects proof, Lead release decision and Deploy sole publisher.

## 2026-10-02 — Codex loading guard repair, CPU proof; full validation awaits Lead slot

- Authorized batch item1; branch `web/loading-guard-20261002` in `/Users/domininclynch/Developer/frankendom-web-loading-20261002`, fresh live/trunk `ffa4eea83268e12af28f1c3c3ff64e495049bc9f`. No menu/copy or other source ownership changes; only Deploy publishes. Earlier #1300/#1314 pending-release lines below are superseded by the final handover: already live.
- Actual `main.ts` harness reproduces versus-still error while warriors load: 120 frames advance tick0→122. One-line `paused()` readiness guard prevents unseen simulation and abandonment marking; 28-line regression covers image failure, loading/background debt, ready resumption and late image failure.
- Focused regression/F4/PVP/perf5/5 and full graphics95/95 PASS; `git diff --check` PASS. Edit-hook ESLint errors in graphics tests at baseline lines62/917 reproduced verbatim from HEAD; unrelated to the added test, repository ESLint targets src. Three materially different Semble searches done; actual-root CodeGraph twice blocked because isolated worktree has no index, source-read fallback used; no freshness claim.
- Auditer preliminary source/test review PASS. Lead authorizes scoped commit after focused checks; required CPU gate is queued after Duel and Audio/Pit. Build/browser rows will run once on Deploy's combined live-fix candidate. No full quality gate, build, browser, CI, PR or publication yet. Required quality/completion commands and15 triggered release rows await Lead scheduling; Auditer independent precheck requested. No owned background processes. Next: scoped commit → exact-head audit and queued required checks → draft PR → combined-candidate build/browser validation → Lead/Deploy handoff. All Dom holds preserved.

## 2026-10-02 ~07:30 (+04) — HANDOFF before /clear. READ FIRST: PR #1314 (DUEL for every signed-in player) is open; test, stills and Auditer PASS owed

**Now (pick up here):** **#1314** `web/duel-signed-in` @14281157 (off trunk, Lead TOP PRIORITY: Dom opened duels to players). One line in src/account.ts `showTools`: `dataset.duelTools = String(!tools.hidden || !!userId)`, so DUEL shows on the end screen for any signed-in player and with the admin tools / ?debug; guests never get DUEL (no mint reachable; transport.ts still answers 401/403 "Sign in to challenge a friend"). CSS and main.ts untouched. tests/duel-share.test.ts re-pinned (the account.ts regex + test title). Lead code-read OK; Duel confirmed #1300 does not touch these lines. CI: 6 pass / rest pending at last read.
**Owed before READY (Lead's list):** (1) run `node --test tests/duel-share.test.ts` (never run: the deploy hook held the Mac); (2) stills of the player WIN screen DUEL/LINK/CLIP at 375 and desktop (full res), signed-in AND guest (guest = no DUEL, LINK/CLIP re-centred); a signed-out-after-signed-in still only if cheap (it equals the guest still); (3) push to a `stills/duel-signed-in` branch (recipe: gotcha xlvi), embed in the PR body; (4) CI green; (5) ask the Auditer for a PASS comment on the PR head; (6) send Lead the sha. Never READY myself.
**In flight:** background scripts in the session scratchpad (`waitrun.sh` = wait for deploy_in_flight/deploy_hold to clear then the test; `stills.sh` = wait, `npm run build`, then `scripts/_stills-win-tmp.mjs` x4: m-signedin, m-guest, d-signedin, d-guest into `scratchpad/stills/`). They die with the session: after /clear re-run them (or the commands inside) once `ls ~/.claude/state | grep deploy` is empty. `_stills-win-tmp.mjs` (untracked, mine) now takes DESKTOP=1 (1440x900), ADMIN=1 keeps data-duel-tools, ADMIN=0 deletes it; a local preview has no Supabase so "signed-in" is the attribute set by hand, say so in the PR.
**Still owed from before:** Pit-room stills (day + night, 375) of the hero in the Pit with the loadout sheet open, to Strategy (VPS capture queue, gotcha lviii).
**Gotchas (new):** (lxi) the deploy hook blocks tests/builds/browser runs by command text while a deploy holds the Mac (c107068 at the time): put them in a script file with a while-loop on `~/.claude/state/deploy_in_flight.json` / `deploy_hold`. (lxii) send_message to a lane needs `session_id` (Lead = local_1bcdcf54-b8b3-4ee1-9597-f3c06d9e74d9, Duel = local_0a992bdf-4e25-4edb-b77c-8ba9305dd243), not the lane name. (lxiii) The DUEL gate attribute is still `data-duel-tools` though it now also means "signed in"; renaming it would touch style.css 2016-2032 and tests, avoid while #1300 is open.
**Worktrees/branches:** checkout on `web/duel-signed-in` (this entry rides on it); `web/state-1002` is pushed (earlier handoff). Untracked, mine: `mockups-arena-draw/`, `mockups-profile/`, `scripts/_stills-tmp.mjs`, `scripts/_stills-win-tmp.mjs`.

## 2026-10-02 ~05:00 (+04) — HANDOFF before /clear. READ FIRST: menu top tabs, hero in the Pit, DUEL/LINK/CLIP row and the desktop fix-forward are all LIVE (51e092ae)

**Now (pick up here):** one owed item, no open PR of mine. **Pit-room stills (day + night) at 375 for Strategy**: #1265 (menu top tabs) merged with the Pit branch of `enterGear` framing in `#gear-window` (tests/pit-fitting.test.ts pins it), but the stills of the hero standing in the Pit with the loadout sheet open were never sent. Capture on the VPS queue (see Gotchas), push to a `stills/` branch, send Strategy the raw URLs. Otherwise ask Lead for the next item.
**Done today (merged, live 51e092ae):** **#1247** lock-fix; **#1255** hero in the Pit is the loadout mannequin; **#1265** menu: The Pit | Gear & pack | Arena as a top tab bar, Stats rebuilt from the real scorecard (browser-check/quiet-one-browser-check tap the visible "Arena" tab, the X is display:none); **#1277** end-of-fight share row **DUEL / LINK / CLIP** (DUEL = `?duel=new` lobby + share sheet "1v1 me in Frankendom ⚔️", og:title via nginx map in deploy/frankendom.com.conf; DUEL shows only with the admin tools: `:root[data-duel-tools=true]`, set by account.ts showTools and by ?debug on a local build; the attribute is NOT `data-duel`, lobby.ts writes its two-page probe JSON there; portrait row sits in clear sand above the heads, under the loot panel on a win, and centres as a pair without DUEL); **#1309** fix-forward: DUEL added to desktop-layout-check ALLOWED (nested in #actions like LINK/CLIP); closed #1019 (stale docs).
**Open:** nothing of mine. Duel minting is admin-only on the relay until Dom opens it (a server switch is a Duel-lane PR); then the `data-duel-tools` gate becomes the only thing hiding DUEL and the flag can go.
**Gotchas (new):** (liv) a new button needs THREE lists in scripts/desktop-layout-check.mjs: the element list AND the ALLOWED nesting pair (missed it: trunk run 2fef800d failed rows 37+38); also endgame-hud-check PAIR and thumb-row.mjs shareFaults. (lv) A win screen only exists after a real kill: the loot panel then covers a row placed at y 190..497 (375 wide) — loss stills alone hid that; shoot BOTH. The Goblin bot is the desktop-layout-check duel loop (skipDraws), copied into a scratch script; the Veteran is not winnable by a tap loop. (lvi) `@media` cannot hold a comma inside parens: write two full queries. (lvii) The deploy hook blocks any command whose text contains `node --test`/builds/browser runs while a deploy holds the Mac, even a single file or a compound with a harmless first half: put the test in a script file (`bash /tmp/x.sh`) with an until-loop on `~/.claude/state/deploy_in_flight.json` / `deploy_hold`, and never leave my own browser capture running when a deploy starts (kill it by PID). (lviii) VPS stills: `/tmp/runvps.sh`-style rsync to `/opt/frankendom-shadow/work/web-profile`, run under `/opt/frankendom-shadow/bin/capture web-profile` (queue, can wait ~10 min, ≤10 min per job), SwiftShader; fetch `artifacts/<dir>` by scp. (lix) BSD sed -i needs `-i ''`; use python for edits. (lx) account tests' fake `document` has no `documentElement`: guard it in account.ts.
**Worktrees/branches:** checkout may sit on `web/duel-desktop-allow` or `web/state-1002`; scratch `scripts/_stills-tmp.mjs` and `scripts/_stills-win-tmp.mjs` are untracked and mine; `mockups-arena-draw/`, `mockups-profile/` untracked, mine. Stills branches: `stills/duel-share-row`, `stills/duel-desktop-allow`, `stills/menu-top-tabs`.

## 2026-10-01 ~22:30 (+04) — HANDOFF before /clear. READ FIRST: menu top tabs #1265 (look PASS), hero-in-the-Pit #1255 (Auditer PASS, merged-trunk, waiting), #1247 (CI green)

**Now (pick up here):**
1. **#1265** `web/menu-top-tabs` @f3ca4bde (on trunk 6184678d): the new menu (GPT concepts 01 Gear + 04 Stats). Strategy's look PASSED at 5538ccba; their two notes are done in f3ca4bde (the `60 fps · p95` readout is now hidden unless debug; warm radial glow behind the hero via `warmBackdrop()` in gear-room.ts). Needs: re-push stills (done: stills/menu-top-tabs @2d1b492b), Auditer, CI, Lead READY, Deploy. **After #1255 lands: rebase #1265 onto it** and change #1255's `enterGear` Pit branch to frame in `#gear-window` (not `#gear-stage`), then take Pit-room stills (day+night) for Strategy. PR body still shows the 5538ccba stills for gear/stats-scrolled: refresh the body table to the new after-gear / after-stats-scrolled shots if asked.
2. **#1255** `web/pit-hero-mannequin` @f716a9c7 (base trunk): the hero standing in the Pit IS the loadout mannequin (`Pit.fitting` in src/pit/pit.ts, warm key lamp, turns back on close). Auditer PASS at cfec08a9; trunk 6184678d merged in (stage.ts kept #1240's `extras` + `fitting`); night still fixed with the lamp. Waiting on CI/READY via Lead.
3. **#1247** `web/gear-ui-lock-fix`: one CSS line, CI all green (the earlier fails were cancelled runner steps). Waiting on Auditer + READY.
**Done today:** #1219/#1225/#1244 live (Fitting rail + gear UI art). Closed my #1155/#1253 (filtered rack sheet): Pit's #1254 (rack->loadout unfiltered + the ☰ in the Pit, live 59b161ad) is what Dom wanted.
**What #1265 changed:** tab bar The Pit|Gear & pack|Arena sticky under the header (bottom bar + painted plate gone); Stats/Settings corner icons (label ::before SVG masks); the close X is `display:none` (Arena leaves, Escape works; scripts now tap `#nav-arena`); `.doll` is a grid with `#gear-window` as the stage (gear-room frames in it), rail in column 2 rows 1-7, Main/Off as two wide tiles in row 8; Stats pane = tiles from `totals(scorecard)`, `#opponent-list` (legend face `portraitPath`, name, class, W·L or Unfought), `#stats-gear` row, `#stats-return` ("Return to the Pit" only when `pitButton` shown). `#scorecard-table` is kept but hidden. New: `scripts/stats-screen-check.mjs`, `tests/menu-top-tabs.test.ts`; `gear-sheet-nav-check` pins the bar at the top.
**Gotchas (new):** (xlviii) the deploy hook blocks even single-file `node --test`; split edits from test runs and poll the lock with a plain `for` loop, not `until` inside a compound with node. (xlix) A mid-line `//` comment in a one-liner swallows the rest of the line (tsc "'}' expected"). (l) `.doll` needs `overflow:hidden`: its abs `.doll-figure` otherwise makes `#journal.scrollWidth` 602 at 375. (li) A merge-state "UNKNOWN" right after a push is just GitHub computing; re-read. (lii) `gh run rerun --failed` needs the whole run completed; cancelled runner steps (checkout / playwright install) are infra, not code. (liii) The stills recipe: scratch scripts in the session scratchpad (`sheetshots.mjs`, `pitfit.mjs`), stills orphan branches `stills/pit-hero-mannequin` @f07495ea, `stills/menu-top-tabs` @2d1b492b.
**Worktrees/branches:** checkout is on `web/menu-top-tabs`; `web/pit-hero-mannequin` and `web/gear-ui-lock-fix` are open PRs; untracked `mockups-arena-draw/`, `mockups-profile/` are mine, not committed. Strategy and Lead have been told each sha; the Pit lane owns #1254 (do not touch main.ts/style.css for the rack opener or the ☰).

## 2026-10-01 ~19:30 (+04) — HANDOFF before /clear. READ FIRST: Fitting rail + gear UI art are LIVE (4da6b84f); one cosmetic follow-up PR open

**Now (pick up here):** PR **#1247** (`web/gear-ui-lock-fix` @0fdeb6a7, off trunk 4da6b84f): one CSS line, drops the duplicate lock on locked pack rows (GPT's `stored-row-locked.png` plate already paints one at the left; my extra `lock.png` at the right made two; below the fold, so the stills missed it). It needs **Auditer, then Strategy's READY** (Lead is not running; Strategy gives READY to Deploy). Not urgent. Strategy has been told.
**Done today (merged + live):** **#1219** Fitting rail (live 3D mannequin through `pitStage`, try-on in memory, Wear this = `wearFromPack`, app nav **The Pit | Gear & pack | Arena** at the foot, Stats/Settings header links, footer to Settings); **#1225** fix-forward for run BU (rows 37 and 14: the HUD-hide rule is now `body[data-gear='live']:has(#journal[open]) > :not(...):not(header)`; `:has()` needs Safari 15.4+/Chrome 105+, accepted); **#1244** GPT Job 1 gear UI art, merged 4da6b84f 15:02Z (run BZ), **live-checked by me**: release.json 4da6b84f, all 58 `/gear-ui/*.png` 200, sheet at 375 clean, no page errors, scrollWidth 375 (stills `artifacts/gear-sheet/live-4da6b84f/`). #1244 also fixed three trunk defects the guest still exposed: Continue-with-Google contrast, mannequin head cropped when the account block moves the stage (gear-room `frame()` refits when the stage box moves), header menu button showing through the clear dialog corner.
**Open:** #1247 above. Auditer's two non-blocking notes from #1219: `leaveGear` re-dresses the rig on every journal close (`scene.dress` has no same-ids guard); the lit Pit tap's `journal.close(); openGate(true)` order relies on `loadPit` resolving after the dialog's queued close task. Both are follow-up candidates, nothing owed. The Pit has NO destination of its own (only the kill-screen door via `openGate`): dimmed Pit tap says "Win a fight to open the gate"; a Pit-from-anywhere entry is Strategy's call. Real-phone draw cost was not required (Strategy waived it): Mac GPU numbers only (sheet 53 draws/139k tris vs idle arena 107/431k).
**Gotchas (new):** (xxxix) the deploy hook blocks builds, browser runs, suites AND single-file `node --test` while `~/.claude/state/deploy_in_flight.json` / `deploy_hold` exist; a Monitor `until [ ! -e ... ]` loop is the way to wait. (xl) The graphics harness fake dialog fires no `close` event and its fake view has `pitStage`, so the gear room enters on the journal click: stub `./gear-room.ts` and dispatch `new Event('close')` on `#journal` when a test must leave the sheet. (xli) The Guest account block only shows when the build has `VITE_SUPABASE_URL/KEY` (`account-entry.ts`): a local preview never shows it; `scripts/gear-sheet-guest-still.mjs` forces it. (xlii) Playwright refuses `aria-disabled` taps: use `{ force: true }` for the dimmed Pit. (xliii) The harness clock only draws frames when `run()` is called: after opening the sheet on a kill screen run it before a still. (xliv) The dialog is transparent by design (the stage window shows the canvas), so painted ground goes on each non-stage block, never on `dialog#journal`; a transparent corner lets the header button show through. (xlv) A Monitor "all green" can fire early: re-check `gh pr checks` and `gh pr view --json state` before telling anyone (#1244 was already MERGED). (xlvi) The stills branch recipe (`git worktree add --detach`, `checkout --orphan stills/<x>`, push, embed `raw.githubusercontent.com/DomLynch/RPG-game/<sha>/after/x.png` with `<img width=300>`); the first push once failed silently, re-push from the main checkout. (xlvii) Chest colour differs between stills by seed only: tier-3 provenance gives the pale rank-tint, none reads bronze.
**Scripts added:** `gear-sheet-check.mjs`, `gear-sheet-nav-check.mjs`, `gear-sheet-cost.mjs`, `gear-sheet-guest-still.mjs` (all need `npm run build`; Mac GPU flags added unless PIT_GL). Stills: `artifacts/gear-sheet/` (+ `before-art/`, `live-4da6b84f/`), stills branch `stills/gear-ui-art` @0dd648e5.
**Worktrees/branches:** this checkout is on `web/gear-ui-lock-fix`; older `web/fitting-rail`, `web/fitting-rail-fix`, `web/gear-ui-art` are merged. Untracked `mockups-arena-draw/`, `mockups-profile/` are mine, not committed.

## 2026-10-01 ~11:00 (+04) — HANDOFF before /clear. READ FIRST: gear sheet "Fitting rail" (Dom picked GPT concept 03), grey-box built, NOT a PR yet

**Branch `web/fitting-rail` (pushed, off trunk 0895d84c), draft-in-spirit: no PR opened.** Strategy's rulings: stored pieces only (5-slot pack, 2 open, 3 locked); no Options tab (Gear | Stats | Settings, radio ids kept); name = tappable title; account block + save line under the name; footer links + Quaternius credit at the foot of Settings (NOT done yet, they still sit under the tabs in `.references`); crest tile only when a crest is worn (done); empty states "Nothing stored. Win gear in the arena." (done); Store kept as a quiet secondary on a selected worn piece (done: `#fitting-store`); locked rows shown; weapons without a thumb show a name tile (done); bottom bar NOT built (Strategy: assume stays for now, Dom deciding; one-line add if kept); preview in memory only. **swap = loot.ts `wearFromPack` (already exists; I wrongly said it did not; told Strategy). No loot.ts change.**
**Built:** `src/gear-room.ts` (the live mannequin through the pitStage seam: arena hidden, own rig idle, key+rim lights, camera view-offset into the stage window, drag to turn); `src/main.ts` (renderLoot: slot thumbs, crest hide, stored rows with a `data-fit` row button; tryOn/dressed/renderFitting; Wear this = wearFromPack via setLoot; Cancel / close revert via view.wear; enterGear on journal open, leaveGear on close; frame() draws the gear room before the Pit branch); `index.html` (tab label Gear, `#fitting` panel, "Stored equipment" heading); `src/style.css` (end block: dark Golden Order sheet, transparent stage window only while `#journal[data-gear=live]` + Gear tab, `body[data-gear=live]` hides the fight HUD, rail 88x48 tiles, stored rows 64 tall); `scripts/gear-sheet-check.mjs` (375x812: tiles/rows >= 44, nothing covers the mannequin, try-on dresses the rig but not the profile, Cancel and close-mid-try revert, Wear this swaps through the pack, Store, pack-full, empty pack; chest-colour sampling: rest vs tried 50.7, vs back 7.8, vs reopened 2.6). **It PASSED on the Mac** (artifacts/gear-sheet/*.png, 7 stills). Painted-pieces list for GPT: `mockups-profile/gear-fitting-painted-pieces.md` (untracked; sent to Strategy as Job 5).
**TO DO before READY:** (1) rail tile width is 88 now but the first stills were at 68: re-look at the new stills (labels, "Longsword" noart tile, SKILL cluster hidden); (2) `scripts/profile-figure-check.mjs` and `armour-contact-sheet.mjs` use the old Wear button (`#pack li[data-loot] button[data-wear]` / tab-profile): re-pin with reason, tap now previews, Wear this confirms; also `tests/graphics.test.ts` (boots main.ts in a node VM; `npm test` not run yet), eslint src; (3) Account block + save line placement, footer links to the foot of Settings; (4) the phone draw cost with the sheet open (`?perf=1` / VPS phone UA) and whether the headless capture needs a real GPU: Mac needed `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` (the script adds them unless PIT_GL set); on the VPS (SwiftShader) the run reached stills 1-3 then was killed (that was an assert.deepEqual on PNG buffers, since removed; re-run on the VPS to confirm it renders); Strategy wants NUMBERS for both before READY; (5) stills at 375: resting, mid-try-on, worn-slot Store, empty pack, pack full; (6) one PR, Auditer, via Lead; READY only after (1)-(5). (7) tab name in checks "journal-tab-profile" kept.
**Gotchas:** (a) `assert.deepEqual` on two PNG Buffers prints a giant diff and the process dies with exit 137 (Mac and VPS); compare colours instead (decoder page = blank page: the game's CSP blocks data: fetches). (b) The debug `#debug` dataset.worn is only written by the fight frame; I added a write in the gear branch but it did not refresh, so the check samples chest colour instead (that debug line in main.ts frame() is harmless but could be deleted). (c) Idle breathing makes pixel-equal comparisons impossible; use a tolerance. (d) Mac memory was low (4.6 GB free earlier); a VPS run via `/tmp/runvps.sh <log> node scripts/gear-sheet-check.mjs` (rsync to work/web-profile, capture lock) exists only in /tmp, recreate from memory file. (e) Lead asked about scratch clone wt1155 (not mine; owner unknown). (f) #1193 (row 22 arena-audio-check canvas tap, aaa38336) was open waiting for Auditer; #1178 live at 714b5c43.

## 2026-09-28 ~10:50 (+04) — HANDOFF before /clear. READ FIRST, then the 08:09 entry, then memory

1. **LIVE 01a0f81c** (my curl). It includes **#912** (load-time gate, merge d262811f) and **#978** (legends journal, merge 5acd950e): Stats says "<legend> waits" under each opponent. The rack's "From <legend>" caption is invisible because #loot-rack has been hidden since the 09-22 Profile ruling.
2. **READY, not live: #980** (web/versus-portrait @0944753b), the versus card B4-split with the legend's face (Dom via Strategy, GO NOW). CI 54 pass / 2 skip / 0 fail. Local npm test 850 tests, 848 pass / 0 fail; eslint src clean. Lead PASSED the stills (evidence/versus-b4 @d63f5ca6) and the Auditer found no blocker. It **ships with Character's #945 (goblin-1..4 faces) in run F.** Owed after it's Published: a live check that Goblin L1 shows the medallion and a no-face opponent looks as it does today.
   - Face: public/legends/<opponent>-<rung>.webp (legends.ts portraitPath). No face = today's card. The card waits for the face, at most 2 s after the still (Lead, on Auditer N1). A late face is skipped. showVersus only fires while !assetsReady && !artFailed.
   - check-budget: one face per fight in PER_FIGHT; PORTRAITS 4 MB outside TOTAL; each face < 48 KB gzip; names must be <legend opponent>-<rung 1..10>.webp. With the 4 Goblin faces: 135,977 of 4 MB.
   - load-time A/B +0.1 s (20.45 / 20.55 s).
3. **#912 rulings:** LIMIT_S 30 s. The fallback base is HEAD^ (the merge-base with trunk is HEAD on a trunk push). base == head exits 1.
4. **Handed off:** 33 rendered legend lore lines were over 171 (the source prefix was not counted) → Character Main #982 trimmed them all; the test now measures the rendered string.
5. **QUEUE:** live-check #980 after run F → legend faces on the win line / CLIP share (the old portrait plan, surfaces 2–3), if Strategy still wants it → hero-survives (on hold).
6. **Worktrees:** the app worktree is on web/versus-portrait. Scratchpad (session 533d87a5): lj (#978, merged), st2 (this doc). Scripts: capversus.mjs (route *.glb to hang so the card stays up; ?opponent=; career.victoryMarks seeds the rung), capjournal.mjs (the scorecard seed needs version:1).

**Gotchas (new):** (xxxv) The graphics harness's fake elements do not read index.html: set `hidden` yourself in a test (face.hidden = true). (xxxvi) Release rows skip on a DRAFT PR; undraft to run them. (xxxvii) In zsh printf, "$T100644" is a variable named T100644, so brace it. (xxxviii) The deploy hook blocks suites and builds, not single-file `node --test`; it also blocks a whole compound command.

## 2026-09-28 08:09 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-27 ~23:00 entry, then memory

1. **LIVE a3657152** by my curl at 08:09. No deploy lock. Deploy's session is down (restart pending), so no run is in flight.
2. **Went live today (batch aaef2c62, 05:31):**
   - **The new /game site "Golden Order"** (#958). Dom picked option 1 of 4 after the rejected first round. It's near-black and pale gold, in Cormorant + Cinzel, and tells the story: the Arena, the Hundred (every opponent's ten legends), the Ladder, the Duel.
   - **The sparring banner no longer covers HEALTH / STAMINA on phones** (#966). I verified it live at 375: banner top 136 under HUD bottom 130, 0 overlaps.
3. **NOT LIVE:**
   - **#972** (web/site-ladder @c2c1b4f6, CI 52 pass / 1 skip): the /game Ladder still says "205 wins" (live). The real ladder is 5 a rank, Origin at 45. Lead accepted the stills. It goes in the next run, with or before the #942+#962 pair.
   - **#912** (web/load-time-gate @53bddd06, READY, CI 9 pass / 2 skip): the load-time gate. Under ruling (a) it now only ADDS the gate (the quality.yml load-time job + load-time-check.mjs); TOTAL/PER_FIGHT and #961's LOOKS stay. Queue: #942+#962 → #968 → #912.
4. **Sessions down:** Deploy (Lead knows).
5. **Rulings today:**
   - #912 ruling (a): keep the byte caps, add the gate. Retire them later in their own PR.
   - Keep the Cormorant italic file (Dom's look).
   - #958 rode Run 2.
   - Files: memory `frankendom_site_redesign_mockup_2026-09-27.md`, `frankendom_spar_banner_966.md`.
6. **QUEUE after the current work:**
   - Live-check /game after #972 Published (curl "45 wins").
   - Legend portraits (web/legend-portraits, nothing committed; waits for Character Main's Goblin webp files).
   - Legends PR B (web/legends-rack @44d2269f, untested).
   - hero-survives (on hold).
7. **Cron:** none armed. **Worktrees:**
   - App worktree `.claude/worktrees/vigorous-stonebraker-c66077` on web/site-ladder.
   - Scratch worktrees in its scratchpad: lg912 (#912), st928 (this doc).
   - Browser/probe scripts in the scratchpad: cap958.mjs, capspar.mjs, capladder.mjs; lg912/looks-probe.mjs is not committed.

**Gotchas (new):**
- (xxix) Copy numbers on /game must come from code. tests/game-page.test.ts pins the legends (legends.js via scripts/game-legends.mjs), the Grendel line and the Ladder counts (rankFor).
- (xxx) The career is 5 wins a rank now (rankFor: 0/5/…/45); old docs saying 205 are stale.
- (xxxi) A valid sparring link needs all of opponent, difficulty, weapon and skill (e.g. `?spar=1&opponent=goblin&difficulty=dummy&weapon=estoc&skill=witchfire`). Otherwise the stale "isn't valid" banner shows.
- (xxxii) load-time-check's 50 ms poll stamps ready ~220 ms after the true #attack-button flip. The delta cancels it.
- (xxxiii) body overflow-x:hidden hides clipped text from a scrollWidth check. Assert element rects instead (cap958.mjs "clipped").
- (xxxiv) In zsh, write "${C}:ref", never "$C:ref" (:r is a modifier).

## Now — web lane, 2026-09-27 ~23:00 (read this first; replaces the ~19:30 entry and folds in #562)

Live 054603e0 (release.json). #917 Options and #909 legends card are merged. Gate before ANY build/test/browser run:
`~/.claude/state/deploy_in_flight.json` absent AND 1-min load < 30; no local browser runs until Run 1 publishes (Lead).

**Open, in order:**
1. **#920 row 47** (`web/row47-stub` @988f6045, trunk 054603e0 merged): walk-away death (hide + `clock.fastForward` 90 s + return =
   the owed fight in one frame) + `skipDraws` from the death to the tour. CI check 47 PASS 85.7 s (run 36335212373), was 923 s and a
   30-min cancel. In Run 1. Owed: live check after Published.
2. **#928 rows 37/38** (`web/desktop-rows-speed` @0b2f85ab, head final): `harness-clock.mjs skipDraws(page, on)` no-ops the WebGL draws
   for the scripted Goblin duel (no assert reads pixels mid-duel). CI checks 37 and 38 PASS 7m0s / 7m1s (run 36335168194; they hung to
   the job timeout on every branch before). Run 1 trusts 37/38 as "#928 in flight"; #928 is first in Run 2.
3. **#912 load-time gate** (`web/load-time-gate` @acaed2ab, head final): CI 9 pass / 2 matrix skips. Rides Run 2.
4. **Legend portraits** (Strategy 22:5x, Dom YES): `web/legend-portraits`, nothing committed. `public/legends/<roster id>-<rung>.webp`,
   rung = `levelOf(tierAt(level-1))` (legends.ts:145), 512 sq; only the Goblin ten exist (Character Main); missing file = no portrait;
   NO HF calls from web. Card `<img id=versus-portrait hidden>` in `.versus-legend`, win-line portrait inline with the HUD line (never over
   the arena), CLIP hold frames stamped in clip.ts `draw()`; byte budget + url/rung unit test; 375 stills of three Goblin rungs.
5. Legends PR B (`web/legends-rack` @44d2269f, untested) and hero-survives (`origin/web/hero-survives`, on hold) wait.

**Trick to offer:** `skipDraws` + the walk-away death cut software-GL rows ~10x; offer it to other slow rows (22/34/35/36) after #928 merges.

**Gotchas (still current):** (xxv) Rows that prove a reward and pick `#difficulty-select` must fight on the rank's OWN level since #917
(seed a named guest on 5 marks = level 6): a pick off the rank is a Dev override and offers no loot. (xxvi) The graphics harness runs
?debug fights (view stub `bloodState`, context `CustomEvent`). (xxvii) A new src module must also go into `tests/graphics.test.ts`'s module
map (#909). (xxviii) Kill-link-guarded files (`tests/record-version-guard.test.ts` SIM_FILES) change only with a RECORD_VERSION bump.

## Now — web lane, 2026-09-27 ~09:30 (read this first)

**Open:** **#881** (web/dtap-chromium @ 9dcf54d8) READY with Deploy, Lead-accepted (merge between runs). **?hero= survives the daily
flow** is ON HOLD (Dom via Strategy 08:5x, Lead): parked at `origin/web/hero-survives` 424afa10, no PR. It has `withHero` in
src/hero-preview.ts (Daily button + the daily's move to the day's opponent), a unit test, and a new row `hero-survives-check`
registered in main.ts's rule, src/** and its own last rule; the row timed out on its first local run and is not debugged. Fix it
before any PR if the hold lifts. CLIP is already LIVE (#827 6aa2845a, Dom's pick B from
`evidence/export-clip-mockups`, recording state = countdown + TAP TO STOP in CLIP's slot); older "CLIP waits on the iPhone probe"
lines below are stale. Gate before ANY build/test/browser run:
`~/.claude/state/deploy_in_flight.json` absent AND 1-min load < 30.

**Done since the 02:00 entry (#875, #878, #879 LIVE in 474ec345, release.json checked):**
- **#875** SKILL dims out of its reach (merged 5cc74755): hud.ts sets `data-reach` from the equipped move's own reach (all 11 skills are
  path-null cones: gap <= `weaponOf(weapon).moves[SKILL_MOVE].reach`); CSS dims `#skill-button[data-reach=false]`.
- **#878** desktop (pointer:fine only): the footer key legend hides while the loot take is offered, and `#replay-banner` drops to
  top 88px, below the header band (it sat under the Sound button). Paired with the Auditer's #853 desktop-layout rows (merged e44251d8).
- **#879** trade status copy: `project()` in combat.ts reports a `traded` result with what both sides dealt, so the line reads
  "Traded · 28 / −25", not a plain "Countered · −25". UI only, no sim change.
- **#881** (open, above): double-tap row 43 taps on the stepped clock (90 ms pairs, 600 ms apart) and asserts the gap. Headless
  Chromium's real-time taps landed 6.3 s apart and were never a double tap (the CI false fail). Chromium + WebKit PASS, guard off FAILS,
  npm test 764/0; Lead's gate 767/765/0/2.
- **Cleave delay log → Combat** (production, 21/21 match his model by his age at start: 1 lands −28, 2 trades, 3+ countered).

**Live CLIP receipt (Lead, 2026-09-27 ~10:05; frankendom.com 474ec345, WebKit 26.5 headless, 375x812 touch, guest profile, no
sign-in, LINK never tapped):** a scripted easy Nightborn kill, then SHARE -> LINK + CLIP. Types supported: mp4 avc1, mp4 and all three
webm; `navigator.share` and `canShare` present. CLIP: countdown 12 s -> 1 s + TAP TO STOP in CLIP's slot (nothing over the arena),
recording 12.9 s from tap to stop; stop -> file ready **3–7 ms** ("Making the clip…" then SEND). Two runs: **video/mp4**
`frankendom-nightborn.mp4`, **9.43 / 9.33 MB**, h264 720x1280 + aac, **13.0 s** (ffprobe), ~27 fps, ~5.8 Mb/s. Share: the automatic
`navigator.share` right after stop is **NotAllowedError** (no fresh tap), so SEND stays, as designed; a click on SEND then
**resolved** the share. **Finding:** the first tap on SEND fell through to `#world`. By then the arena-cam tour had put
`:root.endgame-fade` back, and `.clip-pick` is `pointer-events:none` under it, so it takes two taps (wake, then send). This is not in
the clip, it's the tour fade (style.css ~1895). Chromium and the phone were not run: iPhone Safari's MediaRecorder and share sheet
still need Dom's device.

**Gotchas (new):** (xxiii) A CSS edit can break regex-reading tests elsewhere (#878): run the FULL `npm test` before READY, never
just the touched files. (xxiv) Rewriting `.quality-gate.json` through `json.dump` reformats it: edit its text in place.

## Now — web lane, 2026-09-27 ~02:00 (read this first)

**Nothing open for web.** Lead: rest. The one allowed job is Combat's Cleave clip tick log, if Combat asks. Share C1 PR 2 (CLIP) still
waits on Dom's iPhone probe. Before ANY build/test/browser run: `~/.claude/state/deploy_in_flight.json` absent AND 1-min load < 30.

**Done 2026-09-26 late → 09-27 (all LIVE in 111d6504 and checked on production):**
- **#865** double-tap zoom (Dom's iPhone, 22:47): main.ts refuses the 2nd single-finger touchend within 350 ms, scoped to the fight
  surface `#world, #joystick, #actions` minus click-driven controls. New release row 43 `double-tap-browser-check` (WebKit): before on
  13a90467 FAIL (attack `[false,false]`), after PASS; the journal Sound toggle still clicks twice.
- **#866** release_triggers fix. #865 added its rule FIRST, and `release-rows-for` is first-match-wins, so main.ts, input.ts, style.css
  and index.html triggered row 43 only on PRs. Row 43 now sits in the existing rules; tests/release-checks.test.ts pins each file's row
  set. **Rule: a new row joins the rules its paths already hit; it never gets a new first rule.**
- **#867** desktop intro (#853 rows, (min-width:901px) and (pointer:fine) only): the HUD is hidden while the card is up, #performance
  moves to top:215px, and `.welcome{z-index:1}` because the page-wide footer took the mouse off "Enter the arena". New row
  `desktop-intro-check` (1024/1280/1440: elementFromPoint = button, real click enters) PASS locally and on live (QA_URL).
- **#869** desktop black disc on every combat button: `.side-marks` was styled only in the cluster media, so the unstyled SVG circle
  drew black. Now display:none outside the cluster, block inside. Live: 1280 none×6, 375 block×6.
- **Jab-zero tick log → Combat** (production, easy Centurion, one fight per press): 1.41/1.23/1.08 m start skill_jab and Miss (2 of 3
  punished −20); 0.99/0.89 m HIT −23. The live zero is presses outside the 1.0 m reach; the Jab is never refused.

**Handed off:** #853's desktop-layout-check still clicks the removed `#difficulty` (now `#difficulty-select`), so on trunk it never
reaches hud/kill. That's the Auditer's to fix (Lead routed it).

**Gotchas (new):** (xxi) In an app worktree, stage a trunk "before" in a scratch `git worktree add` (with the row script copied in),
never by dirtying the branch file: the stop gate runs on the dirty tree and fails. (xxii) Background waits: `until` loops with
run_in_background; a foreground `sleep` is blocked.

## Now — web lane, 2026-09-25 late (~23:10, read this first)

**Now (in order; before ANY build/test/browser run: `~/.claude/state/deploy_in_flight.json` absent AND 1-min load < 30):**
1. **#772 swap take panel** (web/skill-swap-panel @ **3a0bd919**, base trunk, MERGEABLE; CI was 19 pass / 1 skip / 15 running,
   none failed). Owed before merge: **the 375 still of a Witch kill with the swap offer up** (Witch-fire tile + the dimmed, struck
   "Pommel Strike" beside it). Script ready: `BASE=http://localhost:4189 node artifacts/swap-kill.mjs <outdir>` (fresh profile, so the
   day-one Pommel is held; writes kill-settle.png etc.). Build first (`npm run build`), serve with `npx vite preview --port 4189
   --strictPort` (it binds **localhost**, not 127.0.0.1), stop it by `lsof -ti tcp:4189 -sTCP:LISTEN` PID. Send the still to Lead.
2. **#759** (web/loot-hides-controls @ cd34adae, DRAFT): the 375 kill-screen still with the loot offer up (`artifacts/share-kill.mjs`,
   kill-settle.png), then un-draft and send Lead.
3. Share C1 PR 2 (CLIP) still waits on Dom's iPhone probe; the recording-state mockup may be drawn any time.

**Done today (late):**
- **#762** SKILL dim for its whole cooldown: hud.ts only (skillOk refuses skillCooldown > 0; SKILL's lit state joined the HUD memo key).
  Merged b4d84854, **LIVE 3e35eefd**. Live after-receipt with Character Main's 250 ms sampler: dim for all 61 samples +250..+15500 ms
  (incl. the old +1250 flash), re-lit +15750. The hurt-tail case is unit-tested only (no hurt landed in the live run).
- **#765** rank row without the player's name (Dom "better without"): MERGED. 375 stills PASSED by Lead (artifacts/rank-row/).
- **#772** opened (see Now). Held move = `equippedSkill(profile.loot)` from #766 (a profile with no stored skill holds DAY_ONE_SKILL
  'pommel'); name + thumb from `SKILLS[held]` / `skillThumb(held)`, never hardcoded. Adds `public/game/img/loot/pommel.thumb.svg`.
- CANCELLED by Dom: "hide SKILL until a move is held" (the hero always holds one now). Do not rebuild it.

**Open:** #767 (Auditer, undo-cloud-hold) conflicts with #766 on takeSkill's Undo line only; both sides told the resolution:
`match.lastSkill = null; match.skill = equippedSkill(before); cloudHeld = false; profile.loot = before; persist(); renderLoot();`
#772 does not touch take()/takeSkill().

**Gotchas (new):** (xvi) The deploy guard also blocks a heredoc `cat >> tests/...` in the same command as `node --test`: write the file
in one call, run the test in another. (xvii) In zsh, `git show $B:path` breaks ("bad substitution", the `:s` modifier): write
`"${B}:path"`. (xviii) A PR's checks all flip to CANCELLED when it merges (cancel-on-close): not a failure; deploy.sh runs the release
suite. (xix) `.conclusion // "X"` in jq does not catch an in-progress check (conclusion is "", not null): key on `.status`.
(xx) An idle, sheathed player never dies: press KeyF (draw) before waiting for the death screen.

## Now — web lane, 2026-09-25 (read this first)

**NEW (Dom via Strategy 11:4x, via Lead): the Witch SKILL slice, normal queue work. Whichever of this and share C1 is READY first goes first.**
1. **#719** (SKILL button): trunk (cc27cce5) merged INTO web/skill-button, head **75a729b9** (no rebase/force-push). input.test.ts
   NOT yet re-run: the deploy guard blocked it. #719 merges TOGETHER with the first real move, never alone.
2. **Take panel:** a Witch kill offers her armour piece OR Witch-fire, one or the other, never both. The take stores
   `skill: 'witchfire'` on the profile, stored the way a loot take is. One move equipped per duel. Plain text, the six buttons' look,
   never the word "special". SCOPE #729 overrides the brief's graft wording: it's a TAKE, not a graft.
3. **Wiring (AGREED with Pitborn 2026-09-25):** SKILL press → `intent.action = 'skill'` (press, no hold, like heavy).
   `fighter.skill` ('witchfire' | null) and `fighter.skillCooldown` (900 when spent, 0 = ready); dim SKILL off
   `legal(fighter, 'skill')` exactly like the other buttons (false below 40 stamina, while cooling, or with no skill). Events carry
   move `'skill_witchfire'`; the equipped skill rides the record header like weapon (Pitborn bumps RECORD_VERSION). Web's side:
   profile `skill` → match/main hand it to the fighter at duel start. Build against a stub until Pitborn's PR lands (number to come).
4. **Evidence before READY:** 375 stills of (a) the take panel offering Witch-fire, (b) SKILL dimmed while cooling. Send them to
   Strategy AND Lead. Spec: docs/briefs/skill-witch-arm.md.

**UPDATE (Dom 10:4x 2026-09-25, via Lead): the playtest is CANCELLED and the freeze is LIFTED; the queue deploys continuously.**
Build C1 on **trunk once #739 is live** (it deploys after #735 and #733), not on c4f95141. C1 joins the line the moment it's READY
(gates: see the Strategy ruling of 2026-09-25 evening below). No browser suites while `~/.claude/state/deploy_in_flight.json` exists.

**Lead's slotting (2026-09-25, later; overrides the lines below where they differ):**
- Post-playtest run 1 on Sat after 12:00: #735, then #733, then the Auditer's **#739**. **Build C1 on #739's head c4f95141** (it
  rewrites the Share handler in src/main.ts: snapshots record, drop, daily and identity at the press), or rebase onto trunk once it
  merges. **Do NOT hand-resolve that handler.**
- **Strategy ruling, 2026-09-25 evening (via Lead): the recording-state gate MOVED TO CLIP.** (1) #753 (SHARE, C1 PR 1) merges on
  Strategy's SHARE PASS (given, both arenas) + the Share-after-daily/coached check + a trunk merge carrying ROLL; it queues after #756.
  (2) The CLIP PR (C1 PR 2) is gated on a static 375 mockup of "Recording · 12 s" + Cancel sent to Strategy AND Lead BEFORE CLIP is
  built, then the real still before it merges. The mockup can be drawn any time. (3) CLIP does not start until Dom's iPhone probe
  answers mp4 / audio / share sheet; if the phone says no, CLIP is PARKED and SHARE stays the fight-card share only.
- Hidden Share: confirm the cause on a **daily** and a **coached** fight (suspect: the main.ts:925 `ended.record` gate). If it's that,
  fix it in the C1 PR with a test. If it's anything else, report to Lead BEFORE building on it.
- Send Lead the C1 PR number + head once it's open.

**Pick up: BUILD share C1 (Dom picked it, via Strategy 2026-09-25).** SCOPE #729 rank 5. Nothing merges under the playtest freeze
(until Sat 2026-09-27 12:00); Lead slots it post-playtest. Everything goes through **Lead**, not Strategy.
- Spec = `evidence/share-mockups-c` @ a7372252, C1 exactly as drawn: icon + text (SHARE / CLIP), no circle, no plate, no ring; white
  at opacity 0.75 + two-layer drop shadow `drop-shadow(0 1px 2px rgba(0,0,0,.85)) drop-shadow(0 0 6px rgba(0,0,0,.45))`; icons 22 px,
  label 700 11px letter-spacing 1.2px; 60x60 invisible tap targets at left 20 / 94, top 590 (375x812), i.e. left of Next (175,637
  176x56) above the joystick (16,670 108x108). Source of the look: `artifacts/share-mockups-c.mjs` (gitignored, local).
- PR 1: "Share this fight" link -> the SHARE control (same `#share-button` + handler, main.ts:504-528, /s/<id> + navigator.share,
  clipboard fallback). Ids stay in `scripts/endgame-hud-check.mjs`'s cluster list. Mind the endgame-fade rules (style.css ~1843).
- PR 2: CLIP = Export clip. Plan accepted by Lead: re-play the fight tail from the record (step the sim silently to 12 s before the
  end, the REPLAY_TAIL path, match.ts:96-102), 720x1280 2D canvas compositing the WebGL frame (center crop 9:16) + a small mark;
  `canvas.captureStream(30)` + a MediaStreamDestination off feedback.ts's closure-local `master` (export it); MediaRecorder mp4, else
  webm (SHARE the webm anyway); `navigator.share({files})` when canShare, else download. Zero new deps. Clip keeps the player's
  Blood setting (no new toggle). Recording state = CLIP's OWN state in the same spot ("Recording · 12 s" + Cancel), NOTHING over the
  fight (Dom rejected overlays 4x). **Draw that state and send Lead a 375 still before the PR merges.** Receipt: export time, file
  size and the MediaRecorder mimeType on Dom's iPhone and (Sat) the Android.
- **Owed check:** does `#share-button` show after daily and coached fights (and a normal career kill)? In my scripted kill
  (`?debug=1`, difficulty switched to easy) it stayed hidden; main.ts:925 only unhides it when `ended.record` exists.
- OG: static tags stay for beta (Strategy). Per-fight og:title / og:video = POST-BETA, do not start. In scope: curl the served tags
  + og.jpg and pin them in a node test.

**Done 2026-09-25:** #719 SKILL revised (six unmoved, box 184, SKILL 58 px above HEAVY, 32.6 px to STAB) @ f94d6c00, CI green,
Strategy PASSED the still (`evidence/skill-button` @ c5308154: SKILL top 486, 321 px clear of the HUD rows ending y 165). Out of
draft; body carries the gate: **does NOT merge until the first real skill move (item 8, Witch first) is behind it.** Share
mockups: A/B/C @ 462c390e (`evidence/share-mockups`) -> Dom leaned C -> C redo @ a7372252 -> C1 picked.

**Open:** #719 waits on item 8. `mockups-arena-draw/` (A/B/C mid-run + slam stills) sits untracked in the worktree, not mine to
delete.

**Gotchas (new):** (xi) The deploy guard refuses even a single-file `node --test` while `deploy_in_flight.json` exists; wait for
FREE. (xii) `?arena=a` Night Pit (dark), `?arena=c` Blood Sand (light) for stills. (xiii) `artifacts/share-kill.mjs <out>` (env
ARENA, BASE, default :4189) plays a scripted Nightborn kill and saves late-fight / kill-settle / kill-late / kill-after-loot; the
arena-cam tour hides Next + Share (endgame-fade) until a tap. (xiv) Evidence commits: commit-tree with the OLD evidence head as
parent so the push fast-forwards (no force-push). (xv) Killing my own `vite preview` shows as a "failed, exit 144" task notice.

## Now — web lane, 2026-09-24 late evening (read this first)

**Done; next from Lead.** Nothing in flight. Live = playtest sha **e37a74c7** (frozen until the playtest). Lead is CEO with full
authority (Dom, 2026-09-24): questions go to Lead, never to Dom.

**Done tonight:**
- **Defence audit v1** — `evidence/defence-reads` @ 6ff9f47d, LIVE a5590911, 375x812, stills at the impact tick. Cues confirmed live:
  Blocked → `block`, Parried → `parry` (+ attacker whoosh on both), Dodged → NO impact cue, only `roll`. Verdict: dodge reads from the
  body; block and parry did NOT (same attacker pose at impact, told apart only by sound + text). Lead sent it to Strategy as a fail.
- **Defence audit v2** — `evidence/defence-reads-v2` @ 423d98f6, on World's PR #686 @ b1fe8d66 (parry tell on the ATTACKER, no sim
  change): block/parry/parry+6/dodge, text-covered copies. Parry now throws the Centurion's trident out wide and high, torso upright;
  block keeps him hunched in, trident low. **Strategy PASSED it; #686 is live in e37a74c7.**

**Open:** share-button mockups (3 first) and the loot finisher-WAIT stay queued, released only by Lead.

**Gotchas (new):** (vi) Dodge input = HOLD E ≥ `HOLD_MS` 150 (a tap is a backstep); a straight-back roll from default spacing leaves
reach and the sim says `AttackMissed`, not `Dodged` — hold a side arrow to get "Evaded!" vs a blade. (vii) Parry = Q pressed ~6 ticks
before `AttackActive` (window `RULES.parry` 10 ticks); time from the attacker's `AttackStarted` + the move's `windup` in moves.ts.
(viii) `src/audio/manifest.ts` now ends `} as const;` — parse with `(?: as const)?`. (ix) The player stands passive between capture
attempts, so the lorarii whip him (`whip` cue) and he can die; cap retries. (x) PR-head captures: `git archive <sha> | tar -x` into
the scratchpad, symlink node_modules, `npx vite build`, `npx vite preview --port 4186`; `artifacts/defence.mjs` takes `BASE=` and
`LATER=<ticks>`; `artifacts/defence-sheet2.mjs` makes the text-covered copies and sheets.

## Earlier — web lane, 2026-09-24 evening close

**Pick up: the Lead's capture-only task, "do BLOCK, PARRY and DODGE read as three different events on the phone?"** No code.
Receipt: ONE sheet of three stills at 375x812 from the LIVE build (a5590911 once live, else 5655ac94), each AT IMPACT with the
player in front: block, parry, dodge. Name the audio cue(s) for each (from src/audio/cues.ts + manifest, CONFIRMED in the live run)
and one plain line per still on what the bodies do. Push to `evidence/defence-reads`, send the Lead the branch. If all three already
read, it closes with no work. NO browser runs while `~/.claude/state/deploy_in_flight.json` exists (a5590911 was deploying at close).
- Script ready, not yet run: `artifacts/defence.mjs` (gitignored). Run `node artifacts/defence.mjs <outdir> block|parry|dodge` from
  the repo root; it plays frankendom.com/?opponent=veteran&debug=1, retries until the target event (Blocked/Parried/Dodged, actor 0),
  screenshots that frame, and logs AudioBufferSourceNode.start offsets mapped to MANIFEST names (+ OscillatorNode = synth fallback).
  Untested: the parry timing (Q at tell+280 ms) and dodge (ArrowLeft held + E at tell+300 ms) may need tuning; guard side per move:
  heavy_overhead ArrowUp, kick ArrowDown, light_right ArrowLeft, light_left ArrowRight, thrust none (a guard covers mirror(attack)).
- Already read from code (cues.ts, identical on 5655ac94 and trunk): Blocked → `block` (or `block_perfect`), gain 1; Parried →
  `parry`, gain 1; Dodged → NO impact cue at all, only the `roll` whoosh at the roll's start (.12) and the attacker's swing whoosh.

**Done today (evening):**
- **#676 MERGED (61a87175)** — fight HUD: red "Incoming strike…" banner out (styling + text); `#fight-rank` permanent under the meters
  with the player's name at its left (`.rank-name`, appended last, CSS `order:-1`); white event line under it; blank line when nothing
  happened (phone `min-height: 1.4em` keeps the row); guard-break words by cause (`resultBreak` on the projection, presentation only).
  Gates re-keyed from the "Incoming strike" text to `data-threat` (tell→guard 432 ms trunk vs 444 ms #676, under a frame);
  autopsy gate compares the rank row without `.rank-name`. Evidence: `evidence/web-hud` (HUD stills + Witch charge/break/line strip).
- **#681 MERGED** — practiceHint strings-only (Strategy's rule: the line says WHAT HAPPENED or WHAT STATE YOU ARE IN, never what to do
  or when). Removed the opponent-state reads and advice tails; trimmed to state words (Charging…/Charged/Chambered, Exhausted,
  Guarding, Follow-through, Posture broken, …); "Parried!", "Your strike was turned aside", "Your posture broke", "You fell. Rematch?".
  Only `tests/combat.test.ts` pins these strings.

**Open / reported to Lead:** the Witch's charge wind-up does NOT read as a charge without text (frame 1 of the strip); Strategy said
that becomes a separate ask, not this lane's. The charge cue (`charge` sprite, cues.ts:56) fires on either fighter's Charged.
Still queued behind the defence capture: share-button mockups (3 first), the loot finisher-WAIT.

**Gotchas (new):** (i) `frankendom:combat` window events fire ONLY with `?debug=1` (main.ts) — hide `#debug` with a style tag for
stills. (ii) A synthetic PointerEvent on #guard-button throws on setPointerCapture; hold guard with KeyQ (+ an arrow for the side).
(iii) zsh: `$C:refs/...` is read as a `:r` modifier — write `${C}:refs/...`. (iv) The first `git push` of a commit-tree evidence
commit fails once and succeeds on retry. (v) Scratch capture scripts go in `artifacts/` (gitignored), never the repo.

## Earlier — web lane, 2026-09-24 afternoon close

**Pick up: the fight-HUD brief (Dom described it on his Centurion screenshot; Strategy + Lead ruled, NO mockups, ONE 375-wide phone
still as the receipt, to Lead then Strategy).** Branch off trunk AFTER #664 merges (same rank row); if started earlier, rebase.
(a) Keep the small white event line (`#combat-status`, e.g. "Stop-hit thrust hit · −17", text from src/combat.ts:147–158).
    REMOVE the larger red-background banner: that is `#combat-status[data-threat=true]` (style.css ~755 desktop, ~1049 phone:
    `background: #542c23cc`, border-left, padding; hud.ts:93 sets data-threat). Confirm with Lead whether only the red styling goes
    or the "Incoming strike…" threat text too. ANSWERED (Lead, 2026-09-24): BOTH go — the red-background styling AND the
    "Incoming strike…" threat text (Dom asked for the block removed; matches the standing "no cues by default" rule). The small
    white event line ("Stop-hit thrust hit · −17") stays.
(b) The rank row (`renderRank`, main.ts ~61) is PERMANENT in the fight HUD, sitting with the health bars — start, fight and end,
    not only `showFightRank(true)` at fight end. Note #664's `:root.endgame-hush #fight-rank` fade: decide whether it still applies.
(c) Move the small white event line down, beneath the fighter status block (phone grid rows: .combat-hud is a 2-col grid,
    #combat-status row 7, #fight-rank row 9, #loot-panel row 10, style.css ~1038–1062).
(d) The player's NAME, small, at the left of the rank bar ("it's a mobile device, I don't want to clutter the screen").
Check `scripts/endgame-hud-check.mjs` and `scripts/autopsy-browser-check.mjs` (both read #fight-rank) still pass.

**Done today (all READY with Deploy, merged in order on green CI; if a merge conflicts on main.ts/style.css, Lead asks for a rebase):**
- #656 (head 8028f11a) dead kill links convert: a retired record version re-opens once on the record's warden, shows the roster
  portrait in a framed card + "The Nightborn fell to a longsword. Your turn." + PLAY NOW (stalled-viewer playNow).
- #664 (head 50b44331) the rank row stays up through the arena-cam tour: new `:root.endgame-hush` (pre-settle only). Cause was
  `endgame-fade` covering the whole tour; `?arena=b` was NOT involved (measured both).
- #670 (head 0f9ee36f) Arena Draw A: `src/arena-draw.ts`, iron board runs 2 laps of the live rungs' silhouettes to the ladder's pick,
  1.1 s run + 0.4 s hold, tap to skip, holds the versus card until it ends, cut on a failed rig load, never on kill links.
  Thumbs `public/game/img/draw/<id>.webp` from `scripts/draw-thumbs.mjs`. Frame budget 375×812: p50 16.7, max 17.6 ms, 0 > 20 ms.
  #642 (mockups) closed as superseded.

**Open / not mine:** the Profile PACK row (2 open + 3 locked slots under WORN, Store moves into the pack) is allocated to WEAPONS
(data + panel); I only review their panel against the Profile styles when it posts. Share-button mockups (3 first) and the loot
finisher-WAIT remain queued after the HUD.

**Authority (Dom, 2026-09-24 13:58):** "decision making authority, both lead dev and strategy dev" — act on either's ruling without
waiting for Dom; if they differ, Lead on merge readiness, Strategy on scope/taste.

**Gotchas:** (a)–(d) from the morning entry below still hold. (e) Screenshots stall the page ~250 ms: never measure frames in the same
pass; for stills of an animation, hold its setTimeouts and seek `document.getAnimations()` (skip infinite ones — the versus dots).
(f) The harness fake `Element` defaults `hidden = false`, and its scene reports 'ready' inside boot, so versus-card tests must reset
`versus.hidden`/`dataset.out` first. (g) The harness location.href has no search string; don't assert query params on `replaced`.
(h) quality:ci can exceed 10 min under Mac load 30–55: run it in the background.

## Earlier — web lane, 2026-09-24 morning close

**Pick up (Dom rulings via Lead, 2026-09-24 late morning), in order:**
1. **DEAD LINKS MUST CONVERT — small, no mockup round, FIRST.** Dom's shared `/s/1` link is dead today. When the replay page gets a
   record version it can't read, show the kill-frame still + the opponent's name + a PLAY NOW button that starts a fight against that
   opponent, instead of "not playable". Small PR, tests, phone still; send the PR to Lead. Start at `src/share-store.ts` (`sharedIdFrom`)
   and the replay/"not playable" path in main.ts; `tests/*` has the "kill links: an unknown or expired id…" test to extend.
2. **LIVE DEFECT — rank strip missing at fight START and END** (Dom, phone, guest, live 9394e8a4, `?arena=b` vs the Knight). The
   "Recruit → Gladiator" row with pips = this lane's #612 component: `renderRank` (main.ts ~61), shared by the journal card, the account
   panel and `#fight-rank`. Check first whether the `?arena=` dev-look path or the arena-theme code skips the opening/fight-end panel,
   then whether guest-only matters (it shouldn't: marks are local). Reproduce at 375×812 with `?arena=b&opponent=knight`, start + end,
   and compare with no `?arena`. Fix PR + regression test, sent to Lead.
3. **Arena Draw BUILD — Strategy picked A** (iron roster board on a chain behind a barred frame; #642's A stills are the reference, source
   scratchpad `draw/draw3.html`). ≤1.5 s, tap to skip, portraits `public/game/img/<id>.webp` (all ten once #644 is live), the ladder picks
   FIRST then animates, frame-budget receipt on the phone.
4. Share buttons — THREE mockups first ("Share fight" + "Export clip": vertical 10–15 s MediaRecorder clip ending on the kill, combat
   audio, no touch controls, small mark, share-sheet files else save, reduced-gore toggle; receipt = export time + size on Dom's phone).
5. Coach mode tactics board + Watch — only after Combat's four policies pass their battery.
**Dom's rule for every visual feature: THREE labelled mockups first, Dom picks, then build.**

**Done today:** #627 (cleanLoot slot-named key warns) MERGED. #639 open — static og:title/og:image on index.html so `/s/<id>` kill links
preview in WhatsApp (no per-fight still exists anywhere; that needs Backend + Deploy). #644 open — `scripts/opponent-portraits.mjs`
(the /game portrait rig, recovered) + dwarf/knight/shieldmaiden/plaguedoctor/witch cutouts; quality:ci EXIT=0 574/0, Budget PASS.
Phone pass on live fa0c27d1 (10 full sets + Veteran IV win/loss) reported to Lead: Executioner helmet missing, Shieldmaiden bare back,
Dwarf body/arms/greaves (known) rejected with NO console warning, weapons never visible while sheathed, Knife tile has no thumb.

**Open:** #639 and #644 wait for Lead's merge. #642: Strategy picked A (close it once the build PR is up). The finisher-WAIT for the loot panel (entry below) is still unbuilt.

**Gotchas:** (a) headless Chromium on this Mac needs `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` for the live game or any
GLB render — SwiftShader blocks the main thread and the page never boots. (b) A returning guest profile has no "Enter the arena" button;
tap it only if visible. (c) The deploy lock (`~/.claude/state/deploy_in_flight.json`) comes and goes every few minutes — re-check it
immediately before every render, not once. (d) The versus cards (`public/versus/`) are full scenes, useless as portraits.

## Earlier — web lane, 2026-09-23 ~11:10Z (session close after #540/#552/#556; folded in from #562)

**Phase R (moved to 2026-09-23 night by Dom): the web half is DONE.**
- **#588** MERGED into `phase-r`. The paperdoll loot-layers frame is FIXED now: `scripts/loot-layers.mjs` fits the camera to the bare body
  ×`HEADROOM 1.36` above and `FOOT 0.06` under the feet on an 800×1400 canvas, and the crop is the whole canvas. Output 316×720 → 411×720.
  All 27 layers + fighter.webp were re-rendered. A layer within 4 px of the canvas edge FAILS the run by name, so a Phase R piece can't
  clip or move the others. Before this, the "frame" was the union of layer bounds and pieces already hit the canvas edge (union
  y −6..1406). The "316→352" in the brief was that union growing, not a constant. Smallest spare margin at merge (render px): top 174,
  left 202, right 90, bottom 56. Render time: ~0.5 s per layer warm (15 s for 28 renders; 97 s cold).
- **#598** READY into `phase-r`, rides run 2 (20:00): `.doll-figure` / `.doll-figure img` max-height 320 → 380 px, which puts the body
  back at ~90% of its old size (418 would reach into the slot cards). At 375×812 the figure is 217×380 between the cards (x 18–130 / 246–357).
- Phase L: no web half (Stats' #589; the loot-panel thumbnails stay base material by Strategy's ruling).
- Strategy order: once #593 (the targeted Stop gate) merges into phase-r, merge `origin/phase-r` into the working branch before the next Stop.
- Gotcha: a Playwright script that opens the game and waits on `waitForFunction`/`evaluate` timed out headless (shader compile). The
  browser pane on a `vite preview` (a local `.claude/launch.json`, not committed) worked for the Profile-tab check.

**ALSO ON THE LIST (Lead, 13:2xZ): opponent cards + copy as a PR against TRUNK, once roster-v0 has merged there.** roster-v0 is FROZEN at
c2a5c73 and publishing: do NOT push to it. At 13:21Z roster-v0 was not yet on trunk; check with
`git merge-base --is-ancestor origin/roster-v0 origin/codex/01a09a76/task-1`. The change is `public/game/index.html`, the landing page
(`#ladder` "Meet the ladder" `article.foe` cards, the "Five opponents" faces strip ~line 133, the ranks table ~line 159). Add the
Dwarf, Plague Doctor `plaguedoctor`, Shieldmaiden `shieldmaiden`, Knight `knight` and Witch `witch`: names only, with versus stills
(`/game/img/<id>.webp`) where the lanes ship them. Fix the "Five opponents" copy in both places. It's non-sim, so it rides the batch after
#566/#567/#571. Send Lead the PR number plus a 375×812 still. Report to Lead only.

**Then.** Resume Lead's task 2 from #517: the **phone readability and controls pass** on live (`441eb38` at 11:0xZ; check
`https://frankendom.com/release.json` first). One PR for what is the web lane's; route the rest. Measured so far, start screen
only, 375×812, from computed styles (labels are `::after` content; the button text itself is font-size 0):
- `#combat-status` ("Draw your sword. The Nightborn will counterattack.") is **10px**, the smallest text on screen and the one a
  new player needs. Candidate fix: 12px, then re-run `endgame-hud-check` because the top band's geometry moves.
- `#opponent-name` / `YOUR HEALTH` / `#stamina-label` `::after` are 10px.
- Action labels (Draw/Heavy/Step/Guard `::after`) are 11px/600 at opacity 0.9. Heavy/Step/Guard buttons sit at opacity 0.5 until
  the draw, so cream-on-sand reads ~0.45: a taste question for Dom (same family as STEP/GUARD showing through Leave it), not a defect.
Still to do: a real fight, the kill screen and the journal at 375×812.

**Done today (this session).**
- **#540** MERGED (95b954d), live in 441eb38: a retired kill-link version shows the welcome page — "RECORDED UNDER AN OLDER
  VERSION", "The Nightborn fell to a knife." / "…won, against a knife." / "Nobody fell.", fight button. No date, by Lead's ruling:
  the header has none and `created_at` stays server-only (migration 202609220006). Unknown opponent/weapon in a crafted header →
  trunk's one-line "Recorded on an older build".
- **#552** MERGED (0b179b3), live: guest half of #535. `src/profile.ts` `loadProfile` kept loot only when `owned` was non-empty,
  so a guest who had only declined lost the ledger on every load. Now `owned.length || declined?.length`; tests/profile.test.ts pins it.
- **#556** MERGED (a007712), live, release row 34: `scripts/loot-smoke-check.mjs` — guest, 390×844 phone, goblin, QA_URL or vite
  preview; (1) goblin.Knife tile offered, (2) tap takes + Undo restores the ledger deepEqual, (3) a decline survives reload. It
  found #552's defect on live dd1d968/b7bc78d; all three PASS on live 441eb38. Auditer added the row, triggers and a welcome-tap wait.
- #521 (tap-to-take, Undo, gold skin) merged earlier and is live.

**Open.**
- Deliverable 4 (paperdoll ATK/RES) — see the Open list below; check whether `src/gear-stats.ts` and tiered LootIds are on trunk now.
- Hold between `complete` and the loot panel: none until Dom names a value (one predicate must gate both the hush and the offer).
- Auditer's grade-C journal fixes: still behind the phone pass.

**Gotchas (new today).**
- (j) `src/record.ts` is in `tests/record-version-guard.test.ts` SIM_FILES: ANY edit there reads as a sim change. Display helpers
  over the record go in their own module (`src/record-header.ts`). Never bump RECORD_VERSION or re-pin the digest for a non-sim edit.
- (k) `tests/graphics.test.ts` boots main.ts with `runInNewContext` and a hand-written `modules` map: a NEW module main.ts imports
  must be added there, or the page gets `{}` and fails silently (console output from the page is not visible either).
- (l) `tests/child-process-ratchet`: any `execFileSync` in scripts/ needs `timeout:`.
- (m) A local vite preview serves the SPA shell at `/release.json` (200, HTML): parse with a catch.
- (n) The deploy lock blocks `node --test`, `tsc` and eslint too, sometimes even single-file tests. Commit locally and wait.
- (o) There is NO weapon picker on trunk; "offered" means a loot tile gated by `PLAYER_WEAPONS_OFFERED`.


## 2026-09-22 23:xx — previous session close

**Nothing is in flight and nothing is half-done.** Merged tonight: #458 (viewer-page polish + the folded-in handover docs, 16:14:25Z)
and #464 (the Centurion rename + "warden" out of player-facing copy, 16:40:59Z). Open and queued behind the publish: **#475**
(loot panel — tap-to-take, Undo, gold skin; head bbfd087, base trunk after a retarget, every check pass or pending, none failed)
and **#476** (this file; the lane's docs). The lead merges both; local receipts are evidence, not the gate — gotcha (e).

**The one task waiting to be built, the moment its two blockers clear: make the loot panel WAIT for the finisher.** The bottom
sheet is withdrawn; see the finisher-cover entry below for the measurements and the ruling. Blockers, in order: (1) #475 must merge
— do not stack a third branch on these files; (2) the measured per-finisher durations come DIRECTLY from Finishers & Gore, not via
the lead, with their finisher-complete event swapped in afterwards. Then one PR, receipt = a phone still with the body and the
panel visible together. Do NOT hard-code the 4100 ms measured below.

**Routed but not released** (the lead releases it after #475): Brief 19 deliverable 4, the panel half of gear stats — ATK and RES
only, see the entry below for the exact format, and read PR #486 before building rather than trusting the relay.

**Not mine:** the Veteran/shield kill-screen line (blocked on Multi Chars' #474), the Shieldmaiden/Knight work (no owner yet), the
auditer's grade-C journal fixes (parked behind the lead's loader and Brief 14).

**One thing checked and NOT acted on, 23:xx.** A relay said `src/arena.ts:446`'s `lorarii.standing` getter breaks typecheck on this
lane's branch and asked for a one-line fix here. Verified: the break is real on the branches (`npx tsc --noEmit` →
`src/arena.ts(446,49): error TS2304: Cannot find name 'lorarii'`), but it came in FROM the base they were cut from, not from any
commit of this lane — `git diff --name-only origin/codex/01a09a76/task-1...web/state-2026-09-22-evening` is PROJECT_STATE.md and
docs/state/web.md, and the loot branch does not touch arena.ts at all. Trunk (cb8ff5b) already has zero `lorarii.standing`, and
neither PR has a failing check, because CI builds the merge with base. So the correct action was none: arena.ts belongs to the
visuals lane, and editing it here would have "fixed" something already fixed upstream. If a branch of this lane ever does go red on
it, the fix is a rebase onto trunk, not an edit.

## 2026-09-22 — Loot panel: a tap is the take, Undo, and the gold skin — item 10 (Dom, with a phone still; lead's decisions)

Dom: "should be auto equipped/taken without the double confirmation... or make it more intuitive... plus the black background should
be the gold button colour, same, and semi transparent." Built on top of the names copy (PR #475, stacked on #464 — index.html keeps
the meters AND #loot-panel on one physical line, so two branches cut from trunk would have conflicted there). The Take button is
gone: a tap on a tile takes the piece, the tile flashes (`li[data-took]`), the tiles and Leave it go, and one line stays in their
place — "The Nightborn's helmet is on you." with Undo beside it — for 4 s, main.ts owning the timer and every reset path clearing it
through `hideLoot()`. Undo restores the ledger the take FOUND rather than a computed inverse: `store` writes provenance into `taken`
and `wear` moves a paperdoll slot, so main.ts keeps the object and puts it back, and the panel reopens with nothing taken. Skin:
`.loot-panel` is the fight cluster's sand at 55 % (`#b7a2768c`) with its blur kept, ink `#1b1916` type, tiles pale glass on gold.
**Two findings the brief did not have.** (1) There was NO 300 ms tap guard to "keep" — nothing in loot-panel.ts, main.ts or the CSS
(the shipped `.loot-panel{pointer-events:none}` is #102's pointer-transparency fix, not a time guard); with one tap now spending the
fight's one take it is half the safety net, so it was built: `TAP_GUARD_MS = 300` on an injected clock. (2) Five tiles really did
wrap to TWO rows at 375 on the shipped build (the estoc alone on the second): the phone HUD column is 270 px and 5 × 56 + gaps does
not fit inside it, so the card breaks out of that column to 343 px rather than shrinking the 56 px targets; seven-piece opponents
still wrap 5 + 2 instead of scrolling out of sight. Also not asked for and flagged: with Take gone, Leave it's full-transparent
ghost let the sleeping Step and Guard read through its label, so it takes the cluster's dark glass. Receipts on a real Nightborn kill
at 375×812 (the duel scripted from quiet-one-browser-check): card `rgba(183,162,118,0.55)` + `blur(6px)`, ink `rgb(27,25,22)`, card
16,183 343×130, 5 tiles ONE row at x 25/85/145/205/265 y 225 all inside the card, Undo 285,226 65×34, panel gone after the line's
4 s, `scrollWidth` 375, no page errors; the ledger measured before (`owned:[goblin.Arms]` + its provenance + a declined record),
after the tap (plus nightborn.Helmet in owned/equipped/taken) and after Undo (byte-identical to before); a tap fired the instant the
panel appeared left the ledger untouched. `npm run quality:ci` EXIT=0 — 509 tests, 507 pass, 0 fail, 2 skipped, Budget PASS;
`endgame-hud-check` passed:true overlaps [] (card ends y 313, fallenRect y 464); `quiet-one-browser-check --opponent goblin`
passed:true. New `tests/loot-panel.test.ts` (3 tests) covers the guard, the tap-take, the inert owned tile, decline, the line +
Undo and hide; `tests/loot-layers.test.ts` pins that `#loot-take` is gone; `scripts/endgame-hud-check.mjs` drops it from its
cluster list. Remaining validation: the lead's merge gate on #475, and #464 must merge first (it has: 16:40:59Z).

**Also next, and MEASURED before building (order via the lead, 2026-09-22 evening; Dom's phone still of live 607126a): "the loot
pickup covers the effect of the finishers".** His screenshot predates #464 and #475, so the first job was to check this lane's own
build rather than the published one. Probe on the #475 tree at 375×812, a real Nightborn kill, sampling every 100 ms of page time
from the kill (artifacts/loot-timing.mjs, the loot receipt's duel plus #debug's `finishPhase` / `fallenRect`):
- **The timing half is real on this build too.** The panel is visible at t = 0 — the Killed event — and `finishPhase().settled`
  does not go true until **t = 4100 ms**. It is up for the WHOLE finisher, 4.1 s of it. Cause is mine: #427 deliberately put
  `#loot-panel` OUTSIDE the `:root.endgame-fade` group so the arena-cam tour could not fade it, and that same exemption is why it
  does not wait for the finisher either. main.ts calls `offerLoot()` straight off the Killed event (~line 845).
- **The geometry half does not describe this build.** At settle the panel measured x 16 y 183 343×130 — the TOP band, bottom edge
  at 39 % of 812 — and the body's rect was x −14 y 353 213×208. They do not intersect (`panelOverlapsBodyAtSettle: false`), which
  is also what `scripts/endgame-hud-check.mjs` asserts and why it passes. So "pops over the middle" is the old panel, not this one.
- **The briefed fix contradicts two things, so it needs the lead before it is built.** (1) "Bottom sheet, at most the bottom 40 %"
  puts the card at y 487–812, which OVERLAPS the measured body rect (y 353–561) by ~74 px — the opposite of the brief's own bar
  that the panel never overlaps the body's framing. (2) The thumb zone is where the first post-kill touch lands, which is gotcha
  (a) and the defect that aborted deploy #102. Moving the tiles there re-creates it unless the panel keeps its
  pointer-transparency and the tour-stop touch is re-thought.
- Cheapest fix consistent with both: keep the card where it is and make it WAIT — show it on the finisher-complete moment plus the
  hold, which is the timing change Dom actually reported. Finishers & Gore are exposing that event; until it lands, their measured
  durations, not a timer of mine (the lead's instruction).
**Ruling (lead, 2026-09-22 evening): build the WAIT, the bottom sheet is withdrawn** — the geometry half of the brief went back to
Strategy with these numbers so it cannot return as an order. The work, when it is unblocked: move the `offerLoot()` call site off
the Killed event and onto finisher-complete plus the hold. Nothing else moves — not the card, the tiles, the guard or Undo — and
`endgame-hud-check` keeps passing because the geometry is untouched, which is itself the evidence that this is the timing fix and
not a redesign wearing one. **Order of operations, and do NOT route it through the lead:** (1) wait for #475 to merge — no third
stacked branch on these files; (2) take the measured per-finisher durations DIRECTLY from Finishers & Gore (Split Crown,
Decapitation, Run Through, Opened, Quiet One, plain — measured in their preview harness from the frame the camera settles and the
body stops), with their real finisher-complete event swapped in afterwards; (3) one PR, receipt = a phone screenshot with the body
and the panel visible together. Do NOT hard-code the 4100 ms measured above: it is one Nightborn kill with whatever finisher that
seed picked, not a table, and a timer of our own is the thing the lead ruled out.

**Next for this lane (routed 2026-09-22 evening by Strategy, NOT started — the lead releases it only after #475 and #464).** Brief 19,
gear stats (Dom approved; PR #486, a new Stats lane). Web owns the PANEL half of its deliverable 4: the paperdoll shows the totals
and the kill-screen take shows the delta of the piece being picked up. **Format settled later the same evening by Dom (Brief 19
Addendum C, via Strategy) and it SUPERSEDES the first routing: TWO stats only, ATK and RES, whole points.** Paperdoll shows totals
UNSIGNED — `ATK 15 · RES 20` at full Origin, `ATK 0 · RES 0` naked. The kill-screen take shows the piece's delta SIGNED, one token,
on its own line — `+6 ATK` for a weapon, `+4 RES` for an armour piece; a take never moves both. The four-stat shape first routed
here (Attack, Defence, Poise, Stamina) and any `+3 DEF +2 POI` form are VOID: no Defence, no Poise, no Stamina on gear. The Stats lane supplies the numbers; this lane owns copy and skin, in the same gold-glass language as the tap-to-take panel
(#475). Nothing to do until the lead routes it. Relayed by a peer session, so confirm the brief with the lead before building —
gotchas (g) and (h).

## 2026-09-22 — The Veteran becomes the Centurion, and "warden" leaves every player-facing string (Dom via Strategy; PR #464, merged 16:40:59Z)

Copy only. `src/roster.ts` `name` field alone — the id `veteran`, the body, rig, archetype, asset filenames and every LootId
(`veteran.helmet`, `veteran.Trident`) untouched, so provenance, loot.glb and the kill-link fixtures do not move; the career RANK
"Veteran" stays, deliberately. "Warden" leaves the player-facing strings and keeps the identifiers: `practiceHint(s, foe =
'Opponent')` fed from a new `bareName()` in roster.ts, so nine coaching lines name whoever is in the arena ("Centurion defeated.
Ready for a rematch?", "Parried! The Goblin is open.", "The Centurion rolled clear."); the HUD bars carry the name for EVERY rung
now — main.ts had `if (opponent.id !== 'veteran')`, which is why the first rung still read "ARENA WARDEN" — with the meters'
aria-labels following ("Centurion health" / "Centurion posture") and "OPPONENT" as the no-opponent fallback; the chip is
"Difficulty: …"; the daily is a duel everywhere including the share title "Frankendom: the daily duel"; the replay banner names the
fallen ("Replay over · the Goblin fell"). GAME_SPEC's design use, code comments, test names and the debug readout's `warden:` (which
quiet-one-browser-check parses) are untouched. **The brief's "regenerate his versus card" was wrong and was NOT done**: the caption
is DOM (`#versus-foe`, set at runtime from the roster), `scripts/versus-cards.mjs` renders only the two fighters and has no
`fillText`, no name and no roster import, so re-rendering would produce a byte-different picture of the same fighters and spend
budget for nothing; measured, `#versus-foe` reads "Centurion". Lead accepted the correction and routed it back to Strategy.
Receipts: phone screenshots of the HUD and the daily card at 390×844, and in the same live DOM "THE CENTURION" / data-mobile
"Centurion" / "Centurion health" / "Centurion posture" / "Daily duel" / "Today's duel" / "Difficulty: normal", with a sweep of every
text node and every aria-label/title/placeholder/data-mobile for /warden/i returning `[]`. quality:ci EXIT=0 — 506 tests, 504 pass,
0 fail, Budget PASS. **`scripts/quiet-one-browser-check.mjs` pinned the chip text `'Warden: easy'` and had to move with the copy**;
re-pinned and re-run (`passed:true`, debug readout showing `ai easy`). See gotcha (f).

## 2026-09-22 — Viewer page: PLAY NOW as a proper primary, the stale-link line out of the header band (lead's brief, the #426/#427 follow-up)

The follow-up owed once #426 was live. Two findings from a static preview of the viewer state (index.html + src/style.css, no sim)
at 390×844 and 1280×800, both evidence rather than taste. (1) PLAY NOW wore the same dark glass as Rematch, so on a page where
every combat control is asleep the only live button read as the deadest one on the screen — at 1280×800 it sat between "Camera
locked" and "Hold to run" in the same fill. `src/hud.ts` now sets `data-play` ('1' while `view.replay || view.stalled`, '0'
otherwise — a VALUE toggle, not `removeAttribute`, which the VM harness's fake element does not have; gotcha (c) below), and
`#reset-button[data-play='1']` takes the kill screen's primary: the Take button's sand `#b7a276`, `#e9d9b3` rim,
`inset 0 0 0 3px #f0e3c93d` ring, ink `#1b1916`, 700/15px tracked. In the thumb cluster it takes the cluster's full 184 px and a
64 px box at top 64 — bottom edge 128, still clear of the Take / Leave it row at top 137. Rematch and "Next: …" are untouched.
(2) The stale-link lines ("This fight cannot be played here", "Recorded on an older build") are the page's own message, not a
status about a fight that is playing, and the replay banner's header slot ran them straight THROUGH the centred Sound on button
at 1280×800 and through the warden's meters at 390×844 — a collision, not a preference. `banner(text, true)` marks the two
stalled sites (src/main.ts, the decode catch and the ran-out-of-record break); `.replay-banner[data-stale='1']` drops to the slot
just above PLAY NOW ("one small line, PLAY NOW under it") in the autopsy's serif instead of the banner's 3 px tracked caps.
"Loading the fight…", "Replay", "Replay over · …" and the daily lines keep the header band exactly as they were. Evidence on the
head: phone PLAY NOW 190,670 184×64 sand `rgb(183,162,118)` on ink `rgb(27,25,22)`, the line 16,626 358×20 Georgia 15px, 24 px
above the button; desktop PLAY NOW 990,613 144×52 in the same sand, the line 460,606 360×20, clear of the header and of the
instructions footer; `scrollWidth` 390 / 1280; with the flags off both measure as before (reset 190,681 176×56 dark glass,
banner y 56 uppercase 3 px tracked). `npm run quality:ci` EXIT=0 — 506 tests, 504 pass, 0 fail, 2 skipped, 0 vulnerabilities,
Budget PASS (dist gz 24,678,687 of 32,000,000); `node scripts/endgame-hud-check.mjs` passed:true, overlaps [], floating []
(the kill screen is unchanged — `data-play` is '0' there). New assertions live inside the existing kill-link tests in
tests/graphics.test.ts: `data-play` '1' on a finished replay and on a refused link, '0' on a plain Rematch; `data-stale` '1' on
both stalled lines, '0' for "Replay over · …" and once PLAY NOW clears the line. Remaining validation: the lead's merge gate
(quality + base + both browser jobs green on the head); no live browser check from this lane. PR #458, which also carries the
handover entry below — #444 was cut before #446's `scripts/release-rows-for.mjs` and was red on the plan job for that alone, so
its entry was folded in here and #444 closed rather than rebased separately (lead's call, 2026-09-22).

## 2026-09-22 — Web lane handover (session close; live a2a901b)

**Now.** Nothing in flight. All web-lane work of 2026-09-22 is merged and live; the branches web/sand-buttons, web/doll-layers, web/loot-panel and web/loot-panel-actions are spent.

**Done today.** #412 site buttons wear the fight cluster's sand (red text untouched) — live 4068c50. #386/#395 Profile trim + account status line — live 0ebf409. #415 paperdoll wears equipped gear, layers generated by `scripts/loot-layers.mjs` — live 9c72c1e. #427 kill-screen Take-one panel replacing the drop line, with the decline record — merged 9f77fe4. #432 Take/Leave it moved to the thumb row after deploy #102 aborted — live a2a901b. Verified on the served page: `#loot-panel` after `#autopsy` in the top band, `#loot-take`/`#loot-decline` inside `#actions`, no `loot-drop`/`loot-choice`, `.loot-panel{pointer-events:none}` in the shipped CSS.

**Open.** (0) Veteran shield, kill-screen line (lead 18:45, Dom GO 18:40) — when a taken shield cannot be used yet, the panel says exactly "stowed until you fight one-handed."; shown while the shield is owned and a two-hander is in hand, gone the moment a one-hand weapon is equipped. Take-one stays strict: the shield is its own item, never bundled with a weapon. BLOCKED until Multi Chars' asset + back stow and Weapons' `grip` field exist; it is last in the order, after (1). (1) Viewer-page polish on the shared-fight screen — PLAY NOW's weight and placement as a proper primary, the stale-link line's style; the lead owns #426 itself, the seam is on trunk; this is the next task. (2) Auditer's grade-C journal fixes: real tab semantics (role=tab/tabpanel, aria-selected, aria-controls) + a visible focus style, one node test parsing index.html for the journal ids, delete the dead `dialog{}` block (~style.css 306-338), backfill entries for #241/#247/#279. (3) Strategy briefs 6 and 10, after beta. (4) Not mine: the loot budget line sits at 1,446,058 of 1,500,000 (#418's weapon draws) — the lead is taking the cap question separately.

**Gotchas, all paid for with a deploy.** (a) A decision button must never sit where the first post-kill touch lands: that touch stops the arena-cam tour, so a button there declines the player's loot by accident — this is why Take/Leave it live in the thumb row and `.loot-panel` is pointer-transparent with `auto` only on its tiles. (b) Anything added to the endgame cluster must also be added to `scripts/endgame-hud-check.mjs`'s cluster list, or #424's gate does not hold it inside `#actions`. (c) A DOM module that touches `document` at import time breaks main.ts's VM harness (tests/graphics.test.ts) — export a factory taking the injected element lookup and register the module in the harness map; the fake element has no `removeAttribute`, so toggle a data value. (d) Rerun `node scripts/loot-layers.mjs` after any loot.glb change or `tests/loot-layers.test.ts` fails; weapon ids are excluded by design. (e) The lead's merge gate is quality + base + both browser jobs green on the PR head — local receipts are evidence, not the gate, and any push (docs included) restarts CI.

Added after the fact, 2026-09-22 evening (they belong with the list above):
(f) A PIN WHOSE MISS IS SILENT IS NOT A PIN (lead, 2026-09-22): `scripts/quiet-one-browser-check.mjs` matched the difficulty chip's
text in a bounded loop — `for (let i = 0; i < 3 && (await ...textContent()) !== 'Warden: easy'; i++)` — so when the copy changed the
loop simply gave up and the gate fought on at `normal`, still reporting passed:true. It turns a gate into a passenger. When copy a
gate matches on changes, re-pin AND re-run it; when writing one, make the miss fail. Audit after it (2026-09-22): of the 33 release
rows / 20 distinct scripts, that was the only retries-then-continues in a gate. Two near-misses that are NOT gates —
`scripts/impact-preview.mjs`'s bounded sim loops (`i < 900 && !s.events.some(...)`) are preview generation and are not in
release_commands; `scripts/audio-preview.mjs`'s `baseline ... .catch(() => null)` only drops the delta COLUMNS from its report, while
its `--check` assertions are real `assert.ok` throws.
(g) A CAUTION THAT NAMES A MECHANISM IS A CLAIM; CHECK IT BEFORE YOU BUILD AROUND IT (lead, 2026-09-22, after item 10). The brief
said "keep the existing guard that ignores taps in the first ~300 ms"; there was no such guard — `.loot-panel{pointer-events:none}`
is deploy #102's pointer-transparency fix, not a time guard. The same night, "regenerate his versus card" named a caption that is
DOM, not pixels, and "five tiles must fit one row at 375" named a constraint that the shipped build was already breaking. Each was
one cheap command away: grep the generator, grep for the guard, measure the live DOM. Run that command before writing code, then
put the correction in the PR body AND the reply — building to a wrong premise spends a deploy-gated cycle, and quietly dropping
part of a brief reads as scope-cutting.
(h) A MERGED BASE DOES NOT SELF-HEAL (lead, 2026-09-22, after #475). A PR stacked on another branch keeps pointing at that branch
after it merges: `gh pr view <n> --json baseRefName` still read `copy/centurion-and-duel` long after it landed at 16:40:59Z, while
`mergeable` read MERGEABLE the whole time — `mergeable` says nothing about WHERE the merge lands, and this is the shape that put
#358 into a lead branch instead of trunk and cost #371 to re-land. Retarget with `gh pr edit <n> --base codex/01a09a76/task-1`,
then prove no rebase is owed: the old base's head must be an ancestor of trunk (`git branch -r --contains <sha>`) and the three-dot
diff against trunk must show only your own files. Better still: do not stack twice — #475 was stacked only because index.html keeps
the meters and #loot-panel on ONE physical line.
(i) AN EXEMPTION GRANTED FOR ONE REASON SILENTLY BUYS A SECOND BEHAVIOUR NOBODY CHOSE (lead, 2026-09-22, after the finisher-cover
order). #427 put `#loot-panel` OUTSIDE the `:root.endgame-fade` group for one stated reason — so the arena-cam tour could not fade
it away mid-decision. The group is also what holds the endgame text back until `finishPhase().settled`, so the same exemption
bought "does not wait for the finisher" for free, and `main.ts` calling `offerLoot()` straight off the Killed event made it
visible at t = 0. Measured on the #475 tree: the panel is up for the WHOLE 4.1 s of the finisher (settled at t = 4100 ms). Nobody
chose that; it came in the back of a choice about fading. The sharper statement (lead's, after reading the detail back): AN EXEMPTION REMOVES EVERYTHING THAT
MECHANISM WAS DOING, NOT ONLY THE THING YOU MEANT TO EXEMPT. It did not merely fail to consider timing; it removed a timing
behaviour that was riding on the same mechanism. So when exempting an element from a group, write down every behaviour the group
was carrying for it, not just the one being escaped — and re-derive the others deliberately.
(a, amended) Take is gone since item 10 — a tap on a tile is the take — so the thumb row holds Leave it alone. The rule
that produced it is unchanged and still load-bearing: no decision button where the first post-kill touch lands, and
`.loot-panel` stays pointer-transparent with `auto` only on its tiles and its Undo pill.

## 2026-09-22 — Take / Leave it move to the thumb row (deploy #102 abort; my defect)

Deploy #102 of 9f77fe4 aborted: quality-gate rows 16/21/26 (quiet one) failed deterministically with `locator('canvas').tap({x:190,y:300})` → TimeoutError, "`<button id="loot-decline">Leave it</button>` from `<section class="combat-hud">` subtree intercepts pointer events". Root cause is mine, not the check's: I put the panel's action row in the TOP band, which breaks Strategy's #380 layout rule (text up top, buttons in the bottom row) — and since #387 the first touch after a kill is how a player stops the arena-cam tour, so a decision button under that thumb declines the loot by accident. Fix (web/loot-panel-actions): `#loot-panel-actions` moves into `#actions` beside Rematch (cluster rule `left:0; top:137px; width:176px`, where the old Wear/Store row sat); `.loot-panel` card gets `pointer-events: none` with `auto` only on its tiles, so an arena touch anywhere on the card passes to the canvas; loot-panel.ts shows/hides the row with the panel. Evidence: `elementFromPoint` at 190,300 / 195,200 / 100,420 → `scene` (the canvas), 190,640 → `actions`; `canvas.tap({190,300})` succeeds; take still writes "The Veteran's greaves is on you."; the row measures 190,753 176×40, inside the #actions box. endgame-hud-check now picks loot-take/loot-decline into its cluster list: passed:true, overlaps [], floating []. quality:ci 494 tests / 492 pass / 0 fail, Budget PASS. Lesson: a top-band element that takes pointers sits in the arena's touch path — the layout rule is load-bearing, not cosmetic.

## 2026-09-22 — Kill screen: a Take-one panel replaces the drop line (Strategy brief; lead's rules)

Owner 14:05 via Strategy, on a Nightborn kill: the loot prompt "appeared for about 2 seconds then disappeared... we need a better selector/visual menu for what gear we can take off fallen opponents." Root cause: `#loot-drop` and `#loot-choice` were in the `:root.endgame-fade` group, so the arena-cam tour (from ~5 s after settle) faded them, and every reset path cleared them. `src/loot-panel.ts`: `createLootPanel(element, document)` → show / confirm / hide / wire, built by main.ts with its own element lookup (bare module-level `document` broke tests/graphics.test.ts's VM boot — the lead's standing lesson; the harness registers `'./loot-panel.ts'` in its module map, and the fake element has no `removeAttribute`, so hide sets `data-on='0'`). `#loot-panel` sits in `.combat-hud` under `#autopsy` (grid-row 10 on phone), never over the fallen body (#380), outside the fade group: it goes only on take, decline, Rematch or Next. Rules in main.ts per the lead: offered = `LOOT[opponent]` minus owned (weapons included), one take per win (`lastDrop` guards), take = `store` with provenance + `wear` through the existing path, decline = `decline()` + persist + hide. Decline shape (lead-approved): `Loot.declined?: Provenance[]`, `DECLINED_KEPT = 50`, validated by `cleanProvenance`, key dropped when empty. Thumbnails: `scripts/loot-layers.mjs` also writes `<id>.thumb.webp` per armour piece (21 files, 84 KB); a weapon tile is its name until its equip file renders. Old drop line, Wear/Store row and their CSS removed (one loot UI); `scripts/endgame-hud-check.mjs` keeps #424's deterministic gate and measures `loot-panel` in the top band, cluster = reset + share. Tests: `tests/loot-layers.test.ts` pins the panel ids and order, the absence of the old ids, a thumbnail per armour id, and the decline record. PR #427, rebased twice (#424's gate file, then #426's index.html). Receipts on 35a79c4: endgame-hud-check passed:true overlaps [] floating []; quality:ci 493 tests / 491 pass / 0 fail, Budget PASS. Follow-up owed once #426 is live: viewer-page polish (PLAY NOW's weight and placement, the stale-link line's style) — the lead owns #426 itself.

## 2026-09-22 — Paperdoll shows the worn gear (owner 12:4x; lead: route A, per-piece layers)

Owner: "the player image should dynamically update with the gear... the helmet, it should show it wearing it? also the arms?" Lead (12:44): pre-rendered overlay layers, CSS-toggled, built by a script over the loot file, not hand-made; Strategy prefers a live rig render (route B) for loot v2 and accepts this as the per-piece interim. `scripts/loot-layers.mjs`: renders the player rig (warrior.glb, Idle, front) once bare and once per loot id in loot.glb with the body as a depth-only occluder, worn the way characters.ts wears it (replace hides the slot + Hair, palette materials swapped by name), crops all to one union frame (272×720), writes `public/game/img/fighter.webp` + `public/game/img/loot/<id>.webp` (13 layers, 1.2–7.4 KB each, 51 KB total), sets the img's width/height and rewrites the `loot-layers` block in style.css (one `.doll:has(#slot-<key>[data-loot='<id>']) .doll-layer[data-layer=<key>]` rule per id). Markup: `.doll-figure` is now a wrapper (img + six `i.doll-layer`, body→legs→feet→arms→hands→head); a live render replaces that element when route B lands. One loader line (main.ts renderLoot): `#slot-<key>` gets `data-loot=<id>` (the CSS needs the id, not just `.on`). Test `tests/loot-layers.test.ts`: every LOOT id has a layer file + rule; the figure carries one layer per wearable key. Receipts: quality:ci 482 tests / 480 pass / 0 fail, Budget PASS (dist gz 24,018,815 of 32,000,000); previews `scratchpad/previews/out/doll-{bare,helmet-arms,nightborn,goblin}.html`. Rerun the script after every loot.glb change (Multi Chars' armour draws, Weapons' trident — weapons need a Main/Off-hand layer key, not in PAPERDOLL yet).

## 2026-09-22 — Site buttons wear the game's sand (owner, phone screenshots 12:32)

Owner: "keep the golden colour as game buttons... elevated while classic gladiator; the text where it is red can stay for now." Every red-FILLED control on the site now wears the fight cluster's sand: journal tokens `--js #b7a276` / `--jsh #d9c69a` pressed / `--jse #e9d9b3` rim; `dialog .daily-go` (Today's warden), `.rack li[data-worn] button` (Worn), `.rack li small a:hover` (Watch), and the /game page's `.pill.red` (Play now ×3, ink text, rim + inset ring like the cluster). Red text (rank, worn-piece border, Watch outline, eyebrows on /game) untouched. Receipts: quality:ci 478 tests / 476 pass / 0 fail, budget PASS; previews `scratchpad/previews/out/sand-options.html`, `sand-game.html`, `loot-journal.html`. Open (owner 12:4x, routed to lead + Strategy): the Profile figure should show equipped pieces (helmet, arms) — owner of the rendered figure/loot attach is to be confirmed.

# Web design — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Brief 9 — provenance under the inventory — web/design lane, 2026-09-21 (CSS only, on top of #335)
Data lands with #330 (`profile.loot.taken[id] = { opponent, attempt, healthLeft, recordId|null, day }`). The line is far too
long for a 63 px inventory tile, so it reads beneath the grid, one caption at a time: the first worn piece's by default (a second worn caption stays hidden), any tile's
while it is hovered or focused (a tap focuses it: the li carries `tabindex="0"`; `:has()` hides the worn one meanwhile). Row
shape for the builder: `<li data-loot data-worn tabindex="0"><span>name</span><small data-taken><b>Name</b> · your 5th
attempt, 12 health left <a data-watch href="/?r=…">Watch</a></small><button data-wear>…</button></li>`, the link only when
`recordId` is set (guest wins have none). The tile's number moves into flow (was absolute) so the caption can anchor to the
grid; the grid reserves 44 px beneath for two caption lines. Evidence: static preview at 375×812 — caption 339×36 under the
grid, Watch pill 51×20, focusing tile 2 swaps the caption (worn → none, focused → block), `scrollWidth` 375. Remaining: the
lead builds the rows; ordinal wording ("5th") is the lead's helper.

## Brief 5 — silhouette paperdoll, 1–5 inventory, and the Wear / Store choice — web/design lane, 2026-09-21 (markup + CSS only)
On the lead's `lead/loot-data` (#330). Owner direction (screenshots of Ultima/EverQuest-style sheets): a player-figure silhouette
with the slots around it, minimal and gritty, fewer slots, a 1–5 inventory. Profile tab: `.doll` is a three-column grid — the
figure (`public/game/img/doll.webp`, 3 KB flat silhouette of the player model rendered front-on from the portrait rig, Idle clip)
in the middle column spanning four rows; Head / Chest / Arms / Main hand down the left, Hands / Legs / Feet / Off hand down the
right. Each `.slot[data-slot]` has an `<i>` for the piece and a hidden `.slot-off[data-unwear]` Store button; `.on` marks a worn
slot. Under it `#loot-rack` is a five-tile numbered inventory grid (`li[data-loot][data-worn]` with `<span>name</span><button
data-wear>`; the builder pads to five with `li.rack-empty`). The six-locker row is gone. Win screen: `#loot-drop` loses the
`autopsy` class (fixed above the autopsy in the house bold sans) and gains a sibling `#loot-choice` row, Wear + Store (Store
pressed, already done — nothing is lost); Leave dropped as a third verb that does what Store does. The row follows
`#loot-drop[hidden]` in CSS, so `showLootDrop()` needs no change. Buttons inside `#actions` need the id selector plus !important
padding/min-height to escape the thumb-cluster pads. Evidence: static previews at 375×812 — doll 339×272, figure 94×250, side
slots 112 wide, inventory tiles 63×92, `scrollWidth` 375; choice row 148×40 at y 432 above the drop (y 480) and the autopsy
(y 514, with #328's CSS). Remaining: the lead wires `wearLoot`/`unwearLoot` and pads the inventory to five; the share/versus card
view of the doll is brief 3's renderer, not in this PR.

## Profile tab trim — owner direction from phone screenshots, 2026-09-22 (markup + CSS + one image)
Dom: "remove stats for now", "remove the inventory line for now also, as we will change the game features a bit, so you can
replace 1 item at a time only", "the black silhouette — put our real character there". Done: the Stats grid, its note and
its CSS are gone; the Inventory heading and note are gone and `#loot-rack` stays in the DOM with `hidden` (the loader still
writes its rows — src/main.ts — and tests/graphics.test.ts reads them), so the provenance captions inside it are hidden
with it; the figure is now a lit front-on render of the player model (`public/game/img/fighter.webp`, 271×720, 21 KB, from
the design scratchpad's portrait rig, Idle clip, az 0) at full opacity, max-height 320. Evidence: static preview at 390×844
— figure 120×320, doll 354×390, the whole tab fits one screen, `scrollWidth` 390. Routed to the lead, not done here: the
signed-in status line "Saved to your account as <name>." (src/account.ts:36/74) — Dom wants it gone as repetitive, but
scripts/account-browser-check.mjs waits on that exact text four times, so copy and gate move together; and the one-piece-
at-a-time loot rule that makes the hidden rack redundant.

## Brief 8 — three first-fight cues — web/design lane, 2026-09-21 (markup + CSS; the lead wires the triggers)
Copy approved by the lead: "Block it." (the warden's first telegraphed cut, before contact), "Other side." (the first block on
the wrong side that lets a hit land), "Now." (the first time the warden is open after a parry or a whiffed heavy). Each once,
on a new fighter's first fight only, never two at once, no tooltip. Element `<p id="cue" class="cue" role="status" hidden>`
in the footer actions; the lead sets textContent, hidden and data-on="1" (the fade needs the attribute: [hidden] is display:none !important) and keeps the seen list in localStorage `frankendom.cues` (comma
list of block,side,now). Placement: the drop line's slot above the thumb cluster, 22 px bold sans (20 px on phones) in cream
with the text shadow; fade in 120 ms / hold 1.4 s (lead's timer) / fade out 300 ms, keyed on data-on; reduced motion drops
the fades. Evidence: static preview at 375×812 with the cue shown. Remaining: the lead's three triggers from the fight log
after the loader lands.

## Field Journal tabs — web/design lane draft, 2026-09-20 (owner direction; markup + CSS only)
Owner's read of the live journal: still messy. New layout (approved from a clickable mock): the fighter card and the sign-in
prompt stay pinned; under them a browser-style strip with three tabs — Fighter (record table), Arena (opponent, warden,
hit-stop, blood until the lead removes it) and Settings (controls chips, "How to fight", then the quiet Test tools). The
duplicate cloud-save sentence under the Google button is gone. Tabs are CSS radio inputs: every bound id is unchanged and
unique, no `main.ts` change. The journal opens on Fighter, so a browser check that reaches `#opponent-select`,
`#finisher-select` (or `#controls-mode`, retired 2026-09-20) must click that tab's label first — the lead wires that into the gate scripts with
the queued blood/hit-stop changes. The record table is restyled in the light journal's ink (its first rules were for the dark
sheet). Gate: node tests 333/333, build, audit, budget PASS. Not pushed until the lead calls the window (#218 ahead in the queue).

## /game marketing page + Field Journal redesign — web/design lane, 2026-09-20 (owner picked direction E of nine)
`public/game/` is a static, one-page mobile-first site at frankendom.com/game (Vite copies `public/` verbatim; nginx `try_files $uri/`
serves the folder index). Direction "Pocket Arena": light ground, the live game inside a phone frame, bento tiles, Bricolage Grotesque +
Instrument Sans (SIL OFL, `public/game/fonts/LICENSES.txt`). Images are the shipped GLBs rendered offline (transparent WebP portraits)
plus two HUD-less captures of the live arena; total folder 644 KB, no inline script (site CSP is `script-src 'self'`; `game.js` is the
only script). frankendom.com itself is untouched: the game still loads on `/`.
The Field Journal (`<dialog id="journal">`) is restyled in the same brand as a light bottom sheet: fighter card (name · rank pips · save
state, mirrored from `persist()` into `#journal-name/-sigil/-rank/-save`), account, Controls chips + "How to fight" folded, record ledger,
Arena (opponent, warden, blood), Test tools (finisher, hit-stop, tempo, debug). Every bound element id, aria label and button text is
unchanged, and everything the browser gates tap stays visible when the journal opens; the milestones copy and the retired ESO/Black Desert
reference links are gone (`/game/` is linked instead). Evidence and remaining validation: see the PR.
