# Pitborn — lane state

The third opponent and the first creature: an orc-blooded pit brute on the hero rig at scale 1.13, hunched, tusked,
bare-chested, fighting with the cleaver. Rung 2 of the beta ladder. **This lane also owns the Shieldmaiden**
from 2026-09-22 (Dom's own line; Lead allocated, Strategy confirmed).
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## 2026-10-02 (+06) — HANDOFF to GPT (Dom moved all Frankendom work to GPT, 10-02). Read the +05 entry below for detail; this is the open-items table

| Item | Head | State / blocker |
|---|---|---|
| PR #1260 (Pitborn boss specials), base `finishers/hades-shadow-claw-fx`, head `pitborn/specials-8bd3` | 748eae13 | OPEN, Auditer PASS. Merges only on Lead's GO after the night batch ends (base merges are frozen during captures). Union conflicts in `special-look.ts` / `special-modes.ts`: keep both sides, merge only. |
| Night Pit colour pass, branch `pitborn/night-colour` (on origin) | f1735ae3 | Strategy PASSed all three Pit films. NOT yet in #1260. tsc / eslint / `tests/special*.test.ts` have NOT run on it (deploy hook refused). Then `git push origin f1735ae3:refs/heads/pitborn/specials-8bd3` (fast-forward, check origin is still 748eae13) and send Lead the new head + receipts. |
| VPS captures | none running | All nine night-batch and re-film jobs released, exit 0. VPS dist at `/opt/frankendom-shadow/work/pitborn` is f1735ae3 (`work/pitborn-build-night.sh`). |
| Stills in #1260 | n/a | Not embedded. Clips and strips are only on this Mac in `/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/d/{n,r2}/`; regenerate on the VPS (`capture pitborn ./one.sh <antaeus|surtr|typhon> <day|pit>`, `--dpr 2`) if gone. |

## 2026-10-02 (+05) — HANDOFF before /clear. READ FIRST: Night Pit colour pass PASSed at f1735ae3; fold it into #1260 once the checks run

**Now (what the next session picks up):**
1. **Checks on `f1735ae3` have NOT run.** The deploy-in-flight hook refused tsc, eslint and every test file (even a single file) while deploys a0c7c22 and f2e52e4 ran. When Deploy posts FREE, run from `~/Developer/frankendom-pitborn` on branch `pitborn/night-colour`: `npx tsc --noEmit -p .`, `npx eslint src/special-fx-pitborn.ts`, `node --test tests/special-fx-pitborn.test.ts tests/special-look.test.ts tests/specials.test.ts tests/special-modes.test.ts`.
2. **Then fold the commit into #1260's branch (Lead's order):** `pitborn/specials-8bd3` is still at 748eae13 and `f1735ae3` is a direct child, so `git push origin f1735ae3:refs/heads/pitborn/specials-8bd3` fast-forwards it with no rewrite (check `git merge-base --is-ancestor 748eae13 f1735ae3` first, and that origin's head is still 748eae13). Send **Lead** the new #1260 head plus the check receipts; the Auditer checks that delta. **#1260 itself merges only after the night batch ends, and Lead calls the GO.**
3. Optional, not asked: a test pinning the Night Pit looks. None exists; the Pit colours are unpinned.

**Done (10-02):** Night batch filmed at 748eae13 (all six, exit 0, VPS dist `BUILD_OK 748eae13`). Strategy: DAY all PASS; PIT all three FAIL (pale on dark clay: Antaeus whitish cracks and pale flakes, Surtr a pale smoke bank at his legs, Typhon pale strokes across the hero). Fix = a night-only colour pass, `f1735ae3` on `pitborn/night-colour` (on origin, one commit on 748eae13, only `src/special-fx-pitborn.ts`, +10/-11): every change sits in an `exposure > 1.5` branch, day values byte-identical (diff: scratch `d/night-colour.diff`). I removed the now-unused local `sandLook`. Night values: Antaeus seam core (.006,.004,.003) with a dim ember edge (.05,.022,.012), pebbles #14100c; Surtr ash (.02,.018,.016)/(.06,.05,.042), smoke (.012,.011,.01)/(.04,.034,.029); Typhon strokes (.02,.018,.015)/(.035,.031,.026) at the 0.4 cap, specks #14110d. Re-filmed the three Pit clips at f1735ae3 (VPS built via `work/pitborn-build-night.sh`, `BUILD_OK f1735ae3`). Strategy (relayed by Lead): **Antaeus Pit PASS, Surtr Pit PASS, Typhon Pit PASS**; the day PASSes carry; the thin pale swing fan in all three is the game's weapon trail, out of scope. I had looked at all three Pit strips and I looked at only antaeus-pit and typhon-pit of the 748eae13 set.
Messaged: Strategy (six clips, honest about what I viewed), Executioner ("lock free"), Lead (receipts, twice).

**Open:** the checks and the fold above; the #1260 merge (Lead's GO after the batch ends; the base moves, union in `special-look.ts` and `special-modes.ts`, merge only, no trunk); stills not embedded in #1260 (strips and clips live on this Mac only, in the scratch dir `/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/d/` (`n/` = 748eae13 set, `r2/` = the Pit re-films); attach the Pit strips to the PR); PR #1046 (this state doc).

**Gotchas:**
- `SendMessage` needs the bare name, plus ` [ref]` from `ListAgents` when two rows share it (use the one "on this machine"). `mcp__ccd_session_mgmt__send_message` takes the `local_...` session id, not a name.
- Lead's relays are the only path for Strategy's verdicts; Strategy is not cc'd by Lead, so pass anything for Strategy to Strategy directly.
- The VPS capture queue drained fast (all six ran in ~15 minutes, three slots); do not assume a deep queue from the status line. Poll with a bounded `until` loop on the `released at` line in the logs.
- The deploy hook blocks tsc, eslint and tests including single files; git, gh, ssh and ffmpeg are fine. VPS builds are not affected.
- Any code change after a PASS = a fresh film. The fold is a fast-forward of an already-PASSed commit, so no new film.
- Memory: `project_pitborn_boss_specials_2026-10-01.md` (updated 10-02 with this state).

## 2026-10-02 (+04) — HANDOFF before /clear. READ FIRST: night batch is GO and unfilmed; #1260 is Auditer-PASSed and waits to merge after the batch

**Now (what the next session picks up):**
1. **Night batch (Lead's GO, 10-02):** film Antaeus, Surtr, Typhon **day + night** at **748eae13** (head of `pitborn/specials-8bd3`), 6 jobs, one per call. I am **3rd on the VPS lock after Multi Chars** (they message "lock free"). Send the 5 fps strips + mp4s to **Lead** (not Strategy); when done, message **Executioner** "lock free". #1260 merges into the base only AFTER the batch (so the base does not move mid-capture).
2. **The VPS dist is NOT confirmed at 748eae13.** My last `ssh frankvps "bash /opt/frankendom-shadow/work/pitborn-build.sh"` died on `git fetch` ("HTTP2 framing layer"), so the dist there is still 44385bb6 (same effect code, but rebuild anyway). Rerun the build, check the printed `BUILD_OK 748eae13`, then film. Recipe: `ssh frankvps "cd /opt/frankendom-shadow/work/pitborn && CAPTURE_WAIT_S=14400 capture pitborn ./one.sh <antaeus|surtr|typhon> <day|pit>"` from a local background Bash with output to a log (one special per call, `--dpr 2`). Fetch `artifacts/pitborn/<kind>-<day|pit>/clip.mp4`, make a strip (`ffmpeg -vf "fps=5,scale=187:-1,tile=8x4" -frames:v 1`), LOOK at it, send paths + honest read to Lead. Scratch dir: `/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/d/` (may be gone).
3. Night code that has never been filmed: Typhon Pit (strokes/sand capped 0.4, mid-dark grey, 5ce2c675) and Antaeus Pit. Surtr Pit passed at a7dbc50f.

**Done (10-02):** Strategy: all three DAY PASS at 44385bb6. Surtr night Pit PASS at a7dbc50f. **#1260** (https://github.com/DomLynch/RPG-game/pull/1260, base `finishers/hades-shadow-claw-fx`, head **748eae13**, re-merged onto base 5575424f, undrafted, MERGEABLE): Auditer **PASS** (virtual merge + `scripts/special-cost.mjs`). Local at 748eae13: tsc, typecheck:tests, eslint clean, `tests/special*.test.ts` 99 pass. Auditer's four notes landed at 44385bb6 (textures shared by seed, `tests/special-fx-pitborn.test.ts`, caps table, registry comment). Typhon phone cost in the PR body: p95 +0.3 ms at x1, +0.5 ms at x4, +62 draws, +127 tris (`node scripts/special-cost.mjs --special typhon --reps 8`).

**Open:** the night films above (Lead, then Strategy PASS/FAIL); #1260 merge into the base after the batch (Lead/Deploy); stills not embedded in #1260 (strips live on this Mac only; attach the night strips to the PR with the batch); PR #1046 (this state doc).

**Gotchas:**
- Strategy rulings: haze/dust/smoke <= 0.7 day, <= 0.4 Night Pit; cracks, soot, sand marks, small flakes are exempt if darker than the floor and small/on the ground with no sheet over a fighter; Typhon takes NO more density. Any code change after a pass = a fresh film. Nothing changes the code now; do not edit `special-fx-pitborn.ts` without asking.
- Base moves under #1260 (union in `special-look.ts` and `special-modes.ts`, keep both sides, merge only, no trunk) — Lead says when.
- The deploy-in-flight hook refuses tsc/eslint/tests/builds until Deploy posts FREE (git/gh/grep fine); the whole command is refused, so wait and retry.
- Strategy and other sessions restart: `ListAgents`, send by name plus `[ref]`; messages must be self-contained. The `capture` queue can be 6 deep; a "completed" background task for a `( ... ) &` wrapper only means it was backgrounded, check the log for `EXIT`.
- Memory: `project_pitborn_boss_specials_2026-10-01.md` (updated 10-02).

## 2026-10-01 19:55 (+04) — HANDOFF before /clear. READ FIRST: the three Pitborn boss specials (ranks 8-10) are built; recapture + PR are what is left

1. **What exists.** Branch `pitborn/specials-8bd3` @ **2f74c4bc** (on origin, no PR yet), on the specials base **8c371bd3** (= #1120 8bd3a8a8 + Strategy's clip-timeout fix + the `travel` hook). Dom approved the picks 10-01; **Strategy now signs off all 30 boss specials** ("PASS/FAIL, you ship on my PASS, no Dom look").
   - L8 Antaeus = **Cracking Ground**, L9 Surtr = **Ash Fall**, L10 Typhon = **Wind Wall**. Pages `?special=antaeus|surtr|typhon` (levels 36/41/46).
   - Files: `src/special-fx-pitborn.ts` (all three, self-contained painted-stroke helpers; its own cast test `isPitbornSpecial` is passed to `advanceCast` as `is`), `src/special-gust.ts` (the banner gust cell, read by `src/arena.ts`), three `SPECIAL_MODES` entries (`src/special-modes.ts`, Typhon uses `extra` to roll his anchor = the sway), three `SPECIAL_TESTS` rows. `scene.ts` untouched (a test pins that).
   - Checks at 2f74c4bc: tsc, eslint, special-look/specials/special-modes tests pass. Superseded, do not use: `pitborn/specials-greybox`, `pitborn/specials-1120`.
2. **Strategy's rulings (last, 10-01):** Antaeus = **PASS**, goes into the PR now. Typhon: Pit strokes -30 % (done in 2f74c4bc). Surtr: day smoke darker/denser, Pit flakes darker/larger (done in 2f74c4bc). Bar: hero always readable, no pale wash at the peak, **dust ceilings 0.7 / 0.4** (my reading: day / Night Pit opacity ceilings for dust; Typhon Pit is at 0.49, so it likely wants 0.4; Antaeus's crack CAP is 0.85 and was passed; ASK Strategy if unsure). Day + Pit at 375 DPR 2.
3. **IN FLIGHT (will die with /clear):** a local background job was running three captures, one per lock: `typhon pit`, `surtr day`, `surtr pit`. At 19:54 only **surtr-day** had refreshed (19:34 VPS-local). **typhon-pit and surtr-pit are still the OLD v3 clips** (18:43 / 18:39). Resubmit them after the clear, one special per call:
   `ssh frankvps "cd /opt/frankendom-shadow/work/pitborn && CAPTURE_WAIT_S=14400 capture pitborn ./one.sh typhon pit"` (then `surtr pit`). Run from a local background Bash so the waiter has a live parent. `one.sh <kind> <day|pit>` is on the VPS in `work/pitborn/` and the dist there is built at 2f74c4bc (verify: `git log -1 --format=%h` in that dir).
   Then: fetch `artifacts/pitborn/<kind>-<arena>/{clip.mp4,peak.jpg}`, make the sheet (ffmpeg: frame at 3.0 s + peak, day over Pit, hstack/vstack), **look at it yourself**, send clip paths + sheets to **Frankendom - Strategy Dev** by SendMessage. On Strategy's PASS: PR on the specials base (8c371bd3) with stills in the body, then the Auditer.
4. **Honest state of the looks (v3 sheets, stills only; nobody has played the mp4s):** Antaeus reads in both arenas. Typhon reads in both (day strokes near-black on pale edge; Pit strokes were big pale daubs, hence the -30 %). Surtr is the weakest: day smoke was invisible, Pit flakes pale; 2f74c4bc is the fix, unseen. The Typhon sway is a body roll standing in for a real weave pose; the banners' snap (arena.gust via special-gust) is in but not judged.
5. **Gotchas (all cost time today):**
   - The VPS `capture` wrapper was reworked by the Auditor three times (queue file root-owned; an orphan watchdog killed live waiters). It is now FCFS and works (v2.4). A job over **10 min** gets a WARNING; keep one special per call. Never `pkill -f "capture pitborn"` over ssh (it matches the ssh shell itself, exit 255). Kill by pid.
   - VPS clock is UTC+4 vs the lock log's Z times.
   - `special-clip.mjs --dpr 1` fails (odd 375 width, ffmpeg); use `--dpr 2`.
   - Strategy's session address changes: use `ListAgents` and send by name ("Frankendom - Strategy Dev"). Lead's session was cleared; Strategy is holding its queue.
   - Local artifacts: `/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/ffacce84-4006-4174-a616-c5c041ba4307/scratchpad/clips3/` (v3 clips + sheets), `one.sh` and `vps-run.sh` beside it. The VPS rebuild script is `work/pitborn-build.sh` (builds `pitborn/specials-8bd3`).
6. **Other open, mine:** PR #1046 (this state doc). #1137 review: PASS posted 10-01 (right-arm clearance + sash). Memory: `project_pitborn_boss_specials_2026-10-01.md` (branch, VPS capture recipe, who signs off), indexed in `MEMORY.md`.

## 2026-09-30 19:05 (+04) — HANDOFF before /clear. READ FIRST; it CORRECTS the 16:20 entry's item 5 and queue

1. **CORRECTION (Lead, 09-30; I checked both hashes):** `~/Desktop/Business/artifacts/pitborn-ranks/` is GPT's OLDER **09-27** delivery,
   parked 09-28 on Dom's "GPT is re-creating all". `pitborn-L2.glb` sha256 starts `737ed069` there. The **live** L2–L10 (c94d9160, 09-29,
   Dom GO) came from `~/Desktop/Business/Frankendom-Chars/work/pitborn-20260929/delivery/models` (`95161425`). The 09-27 L1 is built on an
   older body, not trunk's `pitborn.glb`. That folder is not a source for anything; item 5 and queue (a) of the 16:20 entry are void, and so
   is the "owner kept the masks" waiver (it was for the 09-27 set). To bring a 09-27 design back, name rank + reason to Lead; it goes to Dom.
2. **QUEUE (Lead's order, 09-30):** review **#1137** (`weapons/pitborn-l1`, "looks(pitborn): L1 Recruit, full + phone", Weapons on loan, stacked
   on #1132) against my must-survive list: **right-arm clearance and the sash** only. **Post PASS/FAIL on the PR** when Weapons posts the stills.
   - State at 19:00: DRAFT, head `5b051704`, 0 comments, its "Stills at 375: idle + mid-fight, full + phone, plus a close-up at GPT's review
     framing" box unticked. Nothing to review yet, so no verdict was given.
   - Its CI was all red at 6m35s (base, load-time, quality, browser rows): one shared cause, not mine, not diagnosed. Weapons/Deploy own it.
3. **Nothing of mine is running:** no crons, no background jobs, no browser. Nothing of this lane's new went live since 09-28.
4. **Open, mine:** PR #1046 (this state doc). **Lane one-liner** sent to Lead 09-30 (lane, task, state).
5. **Weekly limit:** the Stop-hook reviewer failed with "weekly limit, resets **Oct 5 11pm (Dubai)**" (attempts 1–2 of 3). It is the reviewer's
   account. This session kept answering. I first said the limit had passed; that was wrong, and I corrected it to the user.
6. **Session:** the old app worktree is `…/.claude/worktrees/silly-dubinsky-6f0c39` (holds branch `pitborn/state-0928`). This checkout is
   `~/Developer/frankendom-pitborn`; I edited from branch `pitborn/state-0930` and pushed it to `pitborn/state-0928` (PR #1046).
7. **Memory:** `project_pitborn_ranks_gpt_2026-09-30.md` was rewritten to say the folder is the OLD set (index line fixed).

## 2026-09-30 16:20 (+04) — HANDOFF before /clear. READ FIRST, then the 09-28 23:16 entry, then memory

1. **LIVE `3fab84c4`** (my curl, 16:20). No deploy lock of mine; nothing of mine is running (no crons, no background jobs, no browser, no Blender).
2. **Nothing new of this lane's went live since 09-28.** The `pit/*` PRs on trunk (#1122 room, #1136 look-control, #1151 d3-a, #1157 picker, #1159 assets budget) are the arena Pit feature, NOT this lane.
3. **Open, mine:** PR #1046 (this state doc only, branch `pitborn/state-0928`). OPEN, not merged, merges clean onto trunk. Deploy lands it with a batch; nothing to do.
4. **#896 receipt: DONE.** Lead replied "received" (09-28); #896's merge `39522c69` is on trunk.
5. **FOUND 09-30: GPT's Pitborn L1–L10 builds ARE on disk.** Lead said on 09-28 that none had landed. They are at `~/Desktop/Business/artifacts/pitborn-ranks/` (files dated 09-27 21:16): `HANDOFF.md`, `NOTES.md`, `L2..L10-build.json`, `renders/` (ladder-front/back/fight, elite-helmets, motion-sheet), `models/`, `pitborn-ladder-handoff.zip`.
   - L1 = the canonical `pitborn.glb` (byte-identical). L2–L10 are 22.6–25.6 MB GLBs, ~90–97k new triangles each, 25 clips. They are not phone-optimised.
   - Their HANDOFF says the owner **explicitly kept the masks** and waived the open-face suggestion. It lists these differences from my checklist: tall ornaments, torso coverage (green skin mostly hidden), weapon-side clearance, and the one-piece sash. So must-survive items 2 and 3 (face open, green skin) fail on purpose on the elite ranks, on Dom's word. Do not re-litigate that.
   - Armour owns the in-game fit. This lane reviews the renders against the checklist **only when Lead or Dom asks**. I told Lead where the folder is (09-30).
6. **QUEUE:** (a) If asked: review `pitborn-ranks/renders/*` against the must-survive list, taking the owner's mask waiver as given. Report right-arm/weapon clearance and sash continuity only. (b) Nothing else is open.
7. **Session:** still in the app worktree `…/.claude/worktrees/silly-dubinsky-6f0c39`. Dom: reopen me on `~/Developer/frankendom-pitborn` with the worktree switch off.

## 2026-09-28 23:16 (+04) — HANDOFF before /clear. READ FIRST, then the 09-27 22:47 entry, then memory

1. **LIVE `e9107428`** (my curl, 23:16). A deploy lock is held (not mine). Nothing of mine is running: no crons, no background jobs, no browser.
2. **Live from this lane (09-28):** the sash is finished. #896, the loot half, went live in `0d3d7442` (Published 02:59).
   When the player wears Pitborn's gambeson, the back scrap is gone. Verified from the served files:
   - `loot-*.glb` `pitborn.Body.Gambeson_pitborn` has 284 vertices (it was 366).
   - The served `pitborn.Body.webp` sha matches the committed one.
   - The shortened Cacus line is in the index js.
   - Release row 38 (desktop-layout 1440x900) passed on the Mac in 79 s.
   Both halves are live: #782 (opponent) and #896 (loot).
3. **NOT LIVE:** nothing of this lane's.
4. **Sessions:** this session still runs from the app worktree `…/.claude/worktrees/silly-dubinsky-6f0c39`. Dom: reopen me on `~/Developer/frankendom-pitborn` with the worktree switch off.
5. **Rulings (09-28):**
   - Lead OK'd the Cacus (L2) backstory as shortened to 170 chars: trunk now clamps backstories at 171 (the versus card at 375). It reads: "The fire-breathing giant who stole Hercules' cattle and dragged them into his cave by their tails, so the tracks led away. In Frankendom he fights as a thief in the dark."
   - Look PRs need before/after stills at 375 in the body before READY. The browser runs one lane at a time, only on Lead's GO, never during deploy.sh rows.
   - Memory: `project_896_ci_render_2026-09-27.md` (the CI render route and the stills recipe).
6. **QUEUE:**
   - (a) **Pitborn L1–L10 looks** (Lead's beta job for this lane). When GPT delivers them, check each against the must-survive list (face open, green skin visible, right arm clear) before Armour fits it.
   - (b) DONE after the restart: the #896 live receipt went to Lead (msg `4e1f0cb8`, Lead replied "received"; #896 merge 39522c69 on trunk). Deploy and Strategy have it too.
   - Nothing else is open.
7. **Method notes (in memory):**
   - A loot.glb change needs a loot-layers re-render. When the Mac is over load, render on a GitHub runner from a throwaway branch with a push-triggered workflow.
   - The runner redraws most layers with noise ≤ 28 px (median 0), so take only the layers whose diff is real (#896: pitborn.Body at 967 px) plus the css stamp.
   - Branch `pitborn/896-stills` @ `09a8953c` is kept on purpose: #896's body images link to it. Never merge it.
   - An orphan Chrome for Testing (pid 77712, parent launchd, days old) is on the box; Lead said leave it.

## 2026-09-27 22:47 (+04) — HANDOFF before /clear. READ FIRST, then the 09-26 07:30 entry, then memory

1. **LIVE `054603e0`** (my curl, 22:47). No deploy lock; no run of mine in flight. Nothing of mine is running.
2. **Live from this lane (09-26/27):**
   - The Pitborn's sash is one piece on the opponent (#782). Verified on the served GLB: 'Gambeson' has 284 vertices; it was 366.
   - Butcher's Cleave is live (the SCOPE 8 skills, 07:42 on 09-26). It is Combat's row, with my numbers.
3. **NOT LIVE: #896**, sash PR 2, the loot half. DRAFT, head `4ff4fe75`, branch `pitborn/sash-loot`.
   - Contents:
     - loot.glb `pitborn.Body.Gambeson_pitborn` drops its 82-vertex back scrap, keeping 284/366 vertices.
     - Only its 7 accessors changed; 0/26 images changed.
     - `carriers-pitborn.glb` re-cut with `split-loot.mjs`.
     - `tests/pitborn-sash.test.ts` gains the loot test.
     - The Cacus (L2) wording fix (Lead GO).
   - CI: 1 red, and it is expected: `loot-layers` (the stamp).
   - **Owed:** one run of `node scripts/loot-layers.mjs` in a worktree of `pitborn/sash-loot` (symlink `node_modules` from `~/Developer/frankendom-pitborn`). Commit the layers, css and thumbs, push, mark READY, and send Lead the head.
   - **Gate on that run (Lead):** no quiet window announced (Lead posted a QUIET WINDOW for Hero Look's #918, and I have not seen "QUIET WINDOW END"), AND `pgrep -fl "Chrome for Testing"` shows no other test browser, AND no deploy lock. When all three hold, it needs no second ask.
4. **Session:** this session runs from the WRONG folder, the app worktree `…/.claude/worktrees/silly-dubinsky-6f0c39`. Dom: reopen me on `~/Developer/frankendom-pitborn` with the worktree switch off.
   - That folder's 87 stale dirty files (not committed by me) are saved at local ref **`refs/backup/silly-dubinsky-wip`** (`13ee890f`, on old HEAD `e1a673d1`). The folder is detached on trunk `5ae83cde` and clean. That stopped the Stop-gate 420 s loop.
   - The hooks lane has a better fix in flight, Codex-Hooks #49: one gate per Mac, and no gate on a clean checkout.
   - My note to the hooks session that the folder is clean was dropped by its inbox as a repeat. Fold it into the next message to them.
5. **Rulings:**
   - Deadlines are **NOW or ASAP**, never a time or a day; if not now, name the physical blocker (Dom, 09-27; memory `feedback_deadlines_now_or_asap_2026-09-27.md`).
   - AI and sim work is **Combat's**; this lane is the Pitborn opponent (and the Shieldmaiden).
   - The warden reads Witch-fire through the generic path, so no ai.ts change for V1 (Lead ACCEPTED; numbers in the 09-26 07:30 entry).
   - The beta name is "Butcher's Cleave"; "Pit Cleave" is on the post-beta naming list.
   - Legends: Goliath → **Gogmagog** at L4 (Strategy approved). **Multi Chars writes it; do NOT edit rung 4.** Redcap stays.
   - My Pitborn rank-look checklist (9 must-survive points) went to Lead and on to Dom for GPT's rank builds (GPT was on L6). Items 2 and 3 (face open; green skin showing) may only land on L7–L10 plus a re-cut.
6. **QUEUE:** (a) #896: loot-layers → READY → head to Lead. (b) Watch GPT's Pitborn L1–L10 sheet against the checklist when Armour fits it; review only if Lead or Dom asks. (c) Nothing else is open in this lane.
7. **Crons:** none. **Scratch** (dies with this session): `wtloot` (= `pitborn/sash-loot`, pushed) and `strip.mjs`/`diffglb.mjs`, the island strip and the accessor diff. They are only needed again if loot.glb is rebuilt before #896 lands: then re-strip `pitborn.Body.Gambeson_pitborn` (keep the largest position-welded island) and re-run `split-loot.mjs`. That method is in memory `frankendom_committed_glb_drift_splice.md`.

## Now — 2026-09-26 07:30: the Pitborn opponent only; sash PR 2 waits on #716

**Lane rule (Lead, on Dom's ruling via Strategy, ~07:15):** AI and sim work is Combat's. This lane is the Pitborn opponent (and the Shieldmaiden).
The 06:50 entry below is superseded.

**Handed to Combat (done):** SCOPE 8's nine rows, the battery and the rows PR. The battery is `pitborn/skill-battery` @ `207f3753` (on origin). Its
Pommel output (`--seeds 3`, longsword+knife, normal, 140 rows) is byte-identical to the old `pommel-battery.mjs` apart from the new skill column.
Combat got one paragraph (the Pommel template, every `Record<MoveId>` table, `--skill`/`--skills` sharding) and the **Pitborn Cleave row**:
`skill_cleave`, heavy 32/5/31, dmg 22, stamina 40, staminaDamage 60, stagger 28, breaksGuard **false**, chip .4, posture 32, knockback 4, stepIn .55,
reach 1.6, overhead, parryable, poise 0. Caps (Lead checked): worst stun round(28×1.875) = 53 ≤ 55; block margin (5−1)+31−16 = 19 ≥ 9. The name
Strategy ruled the beta name **"Butcher's Cleave"** (live on `edf5d93f`, 07:42); "Pit Cleave" is on the post-beta naming list. Combat's two asks (exit 1 on OVER, `tests/skill-caps.test.ts`) are Combat's now.

**Closed: the warden reading Witch-fire's green tell (#750 follow-up). Lead ACCEPTED: no ai.ts change for V1, no digest move.**
Evidence: a headless probe on trunk `4c1d6af1`. The player walks in and casts only when the warden is `ready`/`guard` and the gap is ≤ 1.1 m,
30 seeds per opponent, `initialPractice` + `stepPractice` with `OPPONENTS[id].profiles[level]`. ai.ts already treats `skill_witchfire` as a
parryable threat through its generic path (plan block/parry/dodge/ignore by profile). Outcome shares of casts:
- hard, parried: Nightborn 72%, Plague Doctor 65%, Executioner 37%, Pitborn 27%, Knight 27%, Veteran/Witch 12%, Shieldmaiden 10%.
- easy, missed (the 1.2 m cone): 17–67% (Knight 67%, Witch 59%, Nightborn 55%).
- Goblin: stuffed by his blow in the windup 70–97% at every level. His lights beat the 40-tick tell, by design (brief (a)).
- Trap: a first probe that cast whenever SKILL was lit read as "stuffed 90–100%". It was casting into the warden's own swing. Gate the cast on
  his phase.

**Open, mine:** sash PR 2. loot.glb `pitborn.Body.Gambeson_pitborn` has the same 284+82 two-piece scrap, and its thumb webp changes with it. Chain
(Lead, 07:30): #716 → **PR 2** → #776 → #705 → #728. Start from trunk once #716 is LIVE. It is the same splice shape as #782 (`splice.mjs`,
`primcmp.mjs` were in the old scratchpad `a1cea9a7…`; recreate them if that is gone). Sash PR 1 (#782) is LIVE: release.json = `4c1d6af1`, and the live `/assets/pitborn-BNhMir0A.glb` 'Gambeson' primitive has 284 vertices
(trunk 284; before the fix 366 = 284 + the 82-vertex scrap). Checked 07:45 from the GLB JSON; the file hash differs from the repo's because the build reprocesses it.

## Then — 2026-09-26 06:50: SCOPE 8, ALL NINE moves in ONE batch, READY 16:00 today (Dom via Strategy); #680 + #782 READY for morning run 2

Repo: `~/Desktop/Business/frankendom/.git` (the Write hook blocks edits in `~/Developer/frankendom-pitborn`; work in scratch worktrees).
SP below = `/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-silly-dubinsky-6f0c39/a1cea9a7-b510-42bb-8659-c7958cbc8d88/scratchpad`.

**1. SCOPE 8: all nine moves, ONE batch, ONE RV bump 13→14, READY by 16:00, live tonight** (Dom's re-ruling via Strategy at ~06:45; it overrides the
A/B/C batches below). Write all nine rows + tests now, no sequencing; push rows as they land so Combat reviews in parallel; tell Deploy + Lead the
moment the rows are in, and Deploy holds the box for the ONE combined battery. A row that fails the battery gets its numbers fixed and re-run; a row
drops only if it can't be fixed by 20:00. I told Lead that 16:00 is makeable (reason: every row is expressible with existing MoveDef knobs,
nothing new in duel.ts; the player takes the move as loot, so no ai.ts casting rule).
The four ruled flags: **Cleave** no breaksGuard, staminaDamage 60, chip .4. **Jab** chained-light timing 16/8/18, stamina 30. **Iron Rush** poise 24 from
tick 8, labelled "armoured against every plain blow from tick 8". **Miasma** one-tick cone, staminaDamage 50. All nine rows: `$SP/scope8-rows.md`, exactly.
(Earlier plan, superseded by the line above:) Batch A of SCOPE 8's nine opponent moves. Same pattern as #750/#766.
- Rows: Combat's paper, used EXACTLY: `$SP/scope8-rows.md` (a copy of `.../bold-bell-141634/712e11ce-.../scratchpad/scope8-rows.md`).
  `skill_lunge` (Nightborn, "Estoc Lunge"): thrust timing, 20 dmg, reach 2.4, stepIn 1. `skill_reaping` (Executioner, "Reaping Blow"): heavy
  timing, 28 dmg, chip .6, poise 24 from 24. `skill_shove` (Centurion = id `veteran`, "Scutum Shove"): kick timing, 18 dmg, knockback 14. The rest of each row as written.
- Scope: `SkillId` union + `SKILL_MOVE` + `MOVES` rows (moves.ts); `SKILLS` in loot.ts, each offered by its opponent; tests (`tests/skill-<id>.test.ts`,
  like skill-pommel); ONE RV bump 13→14; one SCOPE.md line logging the four ruled flags (Cleave, Jab, Iron Rush, Miasma). Re-pin SIM_DIGEST,
  RECORD_VERSION, replay fixture refs.
- Fixed SkillIds (Lead): A = lunge, reaping, shove; B = jab (Goblin), cleave (Pitborn), stomp (Dwarf); C = miasma (Plague Doctor),
  ironrush (Knight), hewer (Shieldmaiden). Move id = `skill_<id>`, SKILLS key = id. Web draws thumbs at `/game/img/loot/<id>.thumb.svg` (main.ts skillThumb).
- **Battery prerequisite DONE and pushed** (Lead's): branch `pitborn/skill-battery` @ `207f3753` (off trunk `5d95a691`, worktree `$SP/wtbat`),
  rides in the batch PR (merge or cherry-pick it in). `scripts/skill-battery.mjs [--skill <id> | --skills a,b]` (was pommel-battery.mjs); default =
  every SkillId. `tests/strategies.ts` `skillUses(id)` generates "<id> on cooldown" + "<id> then light" from the skill's move reach; `SKILL_STRATEGIES`
  is generated from `SKILL_MOVE`, so each new move is swept once its SKILL_MOVE entry lands. POMMEL unchanged (skill-pommel 8/8); old-vs-new
  output IDENTICAL (140 rows); tsc 0, eslint 0. Combat runs the full battery in 3 shards (~15 min), one `--skill` per process, 24 seeds.
- **Web's thumbs are PR #785** (all nine ids, its test checks every SKILLS id has a thumb): send Web the sim PR number the moment it opens.
- **Never run a battery under a deploy lock** (Lead killed-on-sight request at 06:5x; mine had just exited). Rows + single-file tests are fine during a lock.
- READY = the full battery (all offerable weapons × all opponents, per skill) + Combat's AI-vs-AI ceilings receipt on the FINAL head.
  Combat reviews and re-pins; send Combat the branch + final sha, and say when your battery is done (one battery at a time, load < 30).
  Web wants the PR number so its thumbs PR can ride along. Builds and battery runs only with no deploy lock held.
- (Superseded: the batches are now one.)

**2. #782 Pitborn sash (pitborn.glb only) — READY, rides MORNING RUN 2.** Head `6083caf9`: Strategy PASS on the back still, CI 41 pass, Lead accepted.
Splice, not the raw rebuild: trunk's committed pitborn.glb no longer matches trunk's source (control rebuild moves Heraldry ≤3.07 cm, Skin ≤4.4 mm);
the Auditer owns a read-only drift audit across all fighters, and each lane rebuilds after the playtest. Splice tools: `$SP/splice.mjs`, `$SP/primcmp.mjs`, `$SP/posdelta.mjs`.

**3. #680 player bot — READY, rides MORNING RUN 2.** Head `8ba1ed37` (= `4aa366ef` + trunk `5d95a691`). Final 10×3 table on that head: head 29/30,
base 27/30, Shieldmaiden 3/0, no drops (table and completion_commands timings in the PR body; Lead timed them too, 0.19–0.24 s).

**4. Sash PR 2 (loot.glb `pitborn.Body.Gambeson_pitborn`, the same 284+82 two-piece scrap; the player wears it `over` the tunic)** — only in gaps,
batch A outranks it. Chain: #734 → #716 → PR 2 → Goblin #776 → #728. Start from trunk once #716 is LIVE. Same splice shape as #782 plus its thumb.
loot.glb comes from `src/assets/source/parts/level1_pitborn.glb`, which #782 left at trunk.

**Gotchas.** Dom's hold pattern: no Blender or browser runs while load ≥ 30 or a deploy holds the lock (and before 02:00 when Lead says so).
The character preview's `--flat` ignores `--azimuth`; for a back view use `--src /src/assets/<f>.glb --sheet 'Armed:0' --azimuth 180 --close`.
A full character rebuild re-bakes and re-encodes every texture: restore the untouched material jpgs before the Node packing step. zsh here has no `timeout`.
The deploy guard hook matches script names anywhere in a Bash command, heredoc text included: write prose through a file.

## Then — 2026-09-25 23:15: #766 Pommel Strike READY and handed over; #680 table next, then the sash PR 1

Scratchpad (SP) = `/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/209dc0ec-a2e0-4eb0-86bd-97eb5dbec88c/scratchpad`. All worktrees below live in the shared repo `~/Desktop/Business/frankendom/.git`.

**1. #766 Pommel Strike (Dom's day-one skill), READY at `d9055ae6`, pushed.** Branch `pitborn/skill-lunge`, worktree `$SP/wtlunge`.
- Built: `skill_pommel` (moves.ts: reach 1.3, damage 20, stamina 40, 15 s cooldown, chip .4, **stagger 50 = 0.83 s**, knockback 0), `SKILL_MOVE`,
  `DAY_ONE_SKILL` + `equippedSkill()` (loot.ts). Guest, account and **daily** all start with pommel (Strategy overruled the no-skill daily).
  One slot: a Witch-fire take replaces it. Every weapon (Lead + Strategy accepted); **estoc and warhammer rows wind up 22** (sweep: estoc×Goblin
  20/24, warhammer×Executioner 13/24 at 18). RV13 folds Combat's #761 (merged 37586b40). SCOPE item 8 line verbatim.
- Receipts on d9055ae6: npm 670/668/0/2; tsc, typecheck:tests, eslint src clean; guard 4/4 (SIM_DIGEST 1ba9eb44…); replay --strict 4/4 digestMatch;
  `scripts/pommel-battery.mjs` 140/140 within caps (output in the PR body); skill-pommel.test.ts 7.8 s (pins 4 near-cap rows).
- READY sent to **Deploy and Strategy** (Lead's session was gone at 23:10: stale socket, not in ListAgents). Owed by others: Combat's opponent
  identity/fight-length run on d9055ae6 (Goblin median was 44.6 s vs 45 on #761 alone), PR CI. Don't push to #766 unless Lead/Deploy asks.

**2. #750 Witch-fire: LIVE** (on trunk before 8215bfaf). Done.

**3. #680 table — NOT done.** Local head `bcc64950` (4aa366ef + trunk bd08b8a1, clean merge), NOT pushed; PR shows CONFLICTING against
today's trunk, so merge trunk again first (plain merge, no force-push), then rerun tsc + npm + bot tests. Runner `$SP/tables.sh $SP`
(builds `wt680`; `wtbase2` = same head with 03234673's two policy files, dist symlinked); `$SP/summ.sh $SP` prints the per-opponent table.
Only Veteran finished before I stopped it for #766. READY = Shieldmaiden 3/0, no opponent drops. #680 touches no SIM_FILES (Lead checked).
The 4 docs/state/combat.md lines in #680 are Combat's own (#632): keep them (Lead).

**4. Sash PR 1** (`pitborn/sash-front-cut` @ 18a98487): unchanged from the entry below.

**Gotchas today:** the shared repo's trunk ref moves under you (a deploy's fetch): read the merged parent from `git log -1 --format=%p`, not from
memory. A `bash` runner sleeping in `sleep 30` ignores TERM: kill -9 its tree by PID. The deploy hook blocks a multi-file test loop but
not a single test file. The full pommel battery inside npm test was 277 s: keep sweeps in scripts, pin near-cap rows only.

## Then — 2026-09-25 20:30: #680 tables, then the sash PR 1; #750 with Lead

Repo for all three items: `~/Desktop/Business/frankendom/.git` (the Write hook blocks edits in `~/Developer/frankendom-pitborn`,
so work in the session worktree; every branch below is in that repo, and `git worktree list` finds them).

**1. #680 (Lead: "go").** Local head `4aa366ef` = `8bb20db8` + a plain merge of trunk `829dfdf8` (no force-push). NOT pushed.
Worktree `/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/209dc0ec-a2e0-4eb0-86bd-97eb5dbec88c/scratchpad/wt680`
(if the scratchpad is gone, the branch `pitborn/bot-limited-obs` still holds `4aa366ef`).
- On `4aa366ef`: tsc 0, typecheck:tests 0, eslint src clean; npm test 623 tests, 621 pass, 0 fail, 2 skipped; bot tests 34/34.
- Owed: the 10×3 browser table, head policy vs `03234673`'s policy on the SAME dist. Runner `$SP/tables.sh $SP` (SP = that scratchpad):
  it builds `wt680`, and `wtbase2` (detached at `4aa366ef` with `03234673`'s `scripts/lib/player-bot-policy.mjs` and `scripts/player-bot.mjs`
  checked out, `dist` symlinked to wt680's) runs the old policy. It starts only with no deploy lock and load < 30 (Lead), and kills a run by pid at
  load ≥ 40. The runner died with the old session: 0/10 opponents done (Veteran killed twice for load). Rerun it in the background.
- Then: push `4aa366ef` to `pitborn/bot-limited-obs`, with the per-opponent table and the sha in the #680 body. Lead's rule: the full table,
  no threshold tuned to three seeds. READY = Shieldmaiden 3/0 and no other opponent drops.

**2. Pitborn back flap, PR 1 (Lead: after #680).** Branch `pitborn/sash-front-cut` @ `18a98487` (off trunk `63db4fd8`), not pushed.
- Cause: `parts.py` `sash()` cut the front at `p.y < 0.08`, so the lumbar hollow of the tunic passed, and `pitborn.glb` 'Gambeson' = 2 islands
  (284 front + 82 back, 0 bridging triangles, the scrap 0.7–2.4 cm off the skin). Audit still: branch `char/opponent-audit-0925` @ `6a92e8d2`.
- Fix committed: `p.y < (0.08 if t > 0.75 else 0.0)`; `tests/pitborn-sash.test.ts` (one welded piece) FAILS on trunk (2: 284, 82), as Lead asked;
  3 pre-existing ruff findings in parts.py fixed (the post-edit hook blocks on them).
- Owed (load < 30 only): link `artifacts/source` → `~/Developer/frankendom-pitborn/artifacts/source`, then
  `HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic --fighter pitborn` → `WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs`
  (the Phase R fitting runs inside it) → the test goes green → check that ONLY Gambeson changed vs trunk's GLB (mesh names, vertex counts) →
  before/after `character-preview.mjs --enemy /src/assets/pitborn.glb` stills, front and behind → PR. It must NOT touch loot.glb.
- The Stop gate runs the red test at every stop: keep the worktree detached on trunk until the rebuild is ready.
- **PR 2** (loot.glb `pitborn.Body.Gambeson_pitborn` has the same 82-vertex scrap, + its thumb webp): slot after #728 in the loot.glb chain
  (#717 → #734 → #716 → #706 → #728 → ours). Build from trunk only once #728 is LIVE; Lead pings.

**3. #750 Witch-fire (SCOPE 8)**, head `cac2d3a0`: Lead is gating it with #719. It carries Combat's `guarded` commit `5fe91076`; SIM_DIGEST
`6fb3f6ba…` pinned on the combined tree. RV12. npm 634/632/0/2, `record-replay-check --strict` digestMatch ×3. Contact tick 40 of 86 = Weapons'
#732 keying. Next after #680: a small PR for the warden reading the green tell (`ai.ts`, brief (d)), on the same digest-window rules.

## Then — 2026-09-25 morning: #680 waits on Lead's all-clear; #707 parked

**Pick up** (Lead's HOLD: no bot runs, browser suites or full `npm test` until #713+#725 are live and Lead sends the all-clear):
1. **#680 Shieldmaiden regression — fixed, not pushed.** Local commit `da162da7` on `pitborn/bot-limited-obs`, in the
   scratch worktree `$SP/wt680` (SP = this session's scratchpad; recreate it from the commit if the scratchpad is gone,
   because the commit is not on origin yet).
   - Cause: `240fe2c8`'s back-off cleared "worn" at stamina 50 with posture still high, so the bot re-entered one attack
     from worn and walked onto her gladius thrust (reach **1.77**, stepIn 1 — not 2.25). Seed 3024046025: 15 back-offs,
     lost at 56.1 s. Before `240fe2c8` she was 3/0 with 0 back-offs.
   - Fix (bot only): worn clears when posture < 25 **and** stamina >= 50. Do not use a stamina-only release: at >= 80,
     wounds capped her bar at 76 and seed 1637974753 timed out (bot never re-engaged).
   - Full run on the `da162da7` tree (10 opponents x 3): **28/30, Shieldmaiden 3/0.** Receipts `$SP/all-wt680/`.
   - Two flips vs gate-v2: Goblin 3024046025 and Nightborn 1637974753 went win to loss. Both split from gate-v2 at the
     bot's **first slash** (tick 109 vs 110, 114 vs 113), with stamina 100 and posture 0, so the new code cannot be
     involved. It is a one-frame observation shift in the browser harness under load. The Shieldmaiden fight splits
     exactly at the new decision (1443 vs 1449). Lead: "good diagnosis".
   - **After the all-clear (Lead's order):** re-run those two fights on `da162da7` **and** on `03234673`, then push
     `da162da7` with the per-opponent table and sha in the #680 PR body.
   - Lead's READY condition: Shieldmaiden 3/0, no other opponent drops, table + sha in the PR body. Deadline: A1, Fri
     09-25 evening, or #680 comes out of A1.
2. **#707 PARKED** (SCOPE #729: gear stats out of beta). Lead closed it with the `parked` label; the branch is kept.
   Review stopped; do not run its Easy gate. **PASS notes, for when it comes back** (head `9ddf6801`, base `f704eed6`):
   - `src/duel.ts`: `geared()` touches only the three hit writes (vsGuard kick, GuardBroken, clean Hit) and the chip.
     Poise (`dealt < d.poise`), stun, `shake` (posture) and the wound marks read the unscaled blow. `gear === 1` is a
     branch, not a rounding.
   - Naked is bit-identical: both fixtures replay to the same per-tick hash (fighters minus `loadout`, plus events) on
     `9ddf6801` and `f704eed6` (`f8731af001f5dac6`, `fae528f078180bf8`). The fixture digest change is only the new
     `loadout` key in `JSON.stringify(fighters)`; ticks, outcome and killedTick are unchanged.
   - `record-replay-check --strict` passes (digestMatch true). `gear-seam`, `record-version-guard`, `record` and
     `gear-stats` tests: 39/39.
   - Note, not a fault: the Lorarius wall-whip chip (`duel.ts:276`) is not geared. It is environmental, not an attacker.
   - Not done: the bot Easy gate on 707 vs base. When it returns, copy the #680 bot scripts into its tree (untracked):
     trunk does not carry them.

**Done 09-24 night / 09-25:**
- **#666** closed by me as superseded by **#728** (Lead's ruling; the Executioner restacked it on #705 + #706). Checked: same
  patch-id for the no-shield commit; the same +/- lines for the signature commit.
- **#712** "Evaded!" only when the player's own roll/backstep beat the swing. Head `dc15c012`; Lead verified it and
  sent it READY for Weapons' 10:00 run. `combat.ts` only (not a SIM_FILES file). `project()` tracks
  `evadeAt`/`swingAt`. The `fighter.evaded` 2-tick window was too short for a backstep.
- **#680** (parked until after the playtest; head `03234673`):
  - knight CONFIG row;
  - `fightSeeds()` replaces the AI's own lcg for batch seeds (731, 1637974753, 3024046025). lcg-successor seeds fell
    into step and replayed one fight;
  - disengage when posture ≥ 50 and stamina < 50;
  - never block a heavy the stamina bar can't pay for (cost = his weapon's `heavy_overhead.staminaDamage`).
  - Pitborn Easy 3/0.
- Pitborn Easy loss verdict: the bot's play, not tuning. Lead accepted it.
- Parked by Lead for the next version window: `src/match.ts` `nextSeed` (the Rematch seed) uses the same lcg as the AI.
- **#693** (test only) went in with #695.

**Gotchas:**
- Bot fight seeds must never come from the AI's lcg.
- To check whether two fights really differ, replay the recorded inputs under another seed with
  `artifacts/receipts-0924/replay.mjs`.
- Scenario scripts: separate "hold after the roll" from "walk back in".
- Kill only your own PIDs (`pgrep -f` on your own unique `--out=`).

## Then — 2026-09-24 evening: done; next from Lead

**Nothing open in this lane.** The bot report (Strategy item 5) is delivered, and Strategy accepted it as the playtest
baseline.
- **Strategy's rulings:**
  - KICK: parked for Monday's sim window, as **Combat's** item, not ours.
  - Wall roll: no tune; it is teaching.
  - GOBLIN: closed.
  - The posture-broken read: now in the playtest script.
  - Witch = Veteran: parked until after beta.
- **#680** (`pitborn/bot-limited-obs`), head `c6e06ff6`, MERGEABLE against #668's branch. It holds the report, the #668
  merge (`01e6ae68`), `scripts/player-bot-scenarios.mjs` and `scripts/player-bot-replay.mjs`.
- **Both batches are in.**
  - Limited: 24/27 wins, 0 errors, gate pass on all nine.
  - Debug: 27/27, 0 errors. The comparison is posted on #680 (issuecomment-5816962070).
  - Under debug, witch and veteran diverge although their `OPPONENTS` records differ only by id. That is browser-side,
    not sim.

**Gotchas from this task:**
- A side worktree needs a `node_modules` symlink **and** `npm run build` before the Stop gate's bot run works.
  `player-bot.mjs` serves `dist/` through Vite preview; without it, every `page.goto` returns
  ERR_HTTP_RESPONSE_CODE_FAILURE.
- Recorded bot fights replay exactly in node. Apply each key edge at tick + 1, with yaw = aim + π (see the replay
  script).
- Kick move ids are shared across weapons; to tell opponents apart, check `OPPONENTS[id]`, not the move names.

## Then — 2026-09-24 ~15:30 (handover before /clear)

**Pick up: #680 bot report (Lead's assignment, Strategy pre-approved). Blood-flag PRs are done.**
- **#680** `pitborn/bot-limited-obs`, head `a962f66b`, base `codex/01a0ceea/task-3` (#668). Worktree = this checkout's main
  dir (`~/Developer/frankendom-pitborn`, branch pitborn/bot-limited-obs). Lead approved the fix: no `data-threat`
  (enemy "attack" = seen swing start → seen end), charge only from actorless `ChargeCue` (ignored on own hold) or hold time
  (heavy past windup+8). Report: per opponent W/L, chargedHeavies correct/guardedInto/other + cue named, defence table.
- **Batch in flight** (background, lock-aware, aborts+retries an opponent if a deploy starts):
  `$SP/batch.sh $SP` with `SP=/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/a5938653-bdfb-4ddb-9c0c-a30aabaf0c92/scratchpad`.
  Progress `$SP/batch-progress.log`; fights `$SP/bot-limited-final/*.json`, `$SP/bot-debug-final/*.json` (summary.json is per
  opponent run, so aggregate from the per-fight JSONs). Scratch dies with the session: if it's gone, rerun
  `node scripts/player-bot.mjs --opponents=all --fights=3 --no-video` (limited) and `--observation=debug`, only when the lock is FREE.
  DO NOT edit files in the main worktree while it runs (each opponent is a fresh node process).
- **Then, still owed on #680 (all in the same report):**
  1. Merge #668's head `9483f894` into #680 as a normal commit. Conflicts in player-bot-review.mjs, player-bot.mjs,
     tests/player-bot-review.test.mjs are additive: keep their `defenceExchanges` AND my defenceEarned/summarizeDefences/
     chargedAnswers; my perception filter wins where they differ.
  2. Headless scenario script (Lead approved): node, real sim, no sim change — `initialPractice(seed, OPPONENTS[id])` +
     `stepPractice(p, intent, OPPONENTS[id].profiles.easy)`, or `stepDuel` with scripted opponent intents; `legal(f, action)`;
     actions `light|heavy|thrust|kick|dodge|backstep|parry`; a dodge with no move rolls AWAY from the foe. Delay = 11 ticks.
     KICK: close range, opponent holding guard → kick (vsGuard stagger 36) → (i) earliest legal quick attack (landed?) and
     (ii) reposition; report stagger ticks, whether `Staggered` is perceived (tick+11) inside the window. ROLL: back vs angled
     roll vs the same heavy (plain + charged), damage avoided, ticks to first useful hit, distance to wall (RADIUS 8.55), centre
     and near-wall starts. Cross-check kicks vs ~/Developer/frankendom-player-bot/artifacts/combat/kick-candidate-2 and
     kick-candidate-all-3 (READ ONLY, Codex worktree).
  3. GOBLIN: the loss is Codex's `~/Developer/frankendom-player-bot/artifacts/combat/limited-all-easy-3/goblin-2504048581.json`
     (read only). Replay seed 2504048581 in the browser under MY filter with a per-tick trace (legal = controls' aria-disabled /
     accepts(); requested = bot keys/press; accepted = player start events). Verdict: missed chance / unclear recovery feedback /
     rejected inputs / no escape; say whether the loss reproduces.
  4. Fact: the tactical bot never kicks (no KeyC in policy); opponents kicked it 35× in 18 interim fights.
- Send Lead (`Frankendom - Lead Developer`) the head + both batch results + the above. Post the report on #680.

**Blood flags — done, handed over.**
- #667 Dwarf Hammer Wound C: head `e052c1e1`, base trunk, CI green, Lead: "verified and READY to Deploy". SHIPPED
  `dwarf: { variant: 'C', name: 'Hammer Wound' }`, `blood: true` on C only. Evidence strip: branch `evidence/dwarf-wound`.
- #661 Butcher's Wake: head `690c74a8` (bloodMode added to the test frame after CI went red), CI green; taken by Executioner
  into #682 `effects/batch-0924`. Push NOTHING more to `pitborn/sig-butchers-wake` without telling Executioner/Lead.
- #666 Shieldmaiden Splintered Defiance: still waits for her shield.

**Gotchas:** `tsc -p .` does not type-check tests — CI runs `npm run typecheck:tests` (tsconfig.tests.json). Deploys start
often; the PreToolUse hook blocks tests/builds during one (even `node --test` on one file in a loop). Never pkill by name: another
lane's player-bot (artifacts/combat, step 64) runs on this Mac. zsh `$C:r…` is a filename modifier — brace variables before `:`.

## Then — 2026-09-24 ~13:00 (signature effects, Lead's assignment for Dom's 13:05 deadline)

**Three PRs open, all waiting on Dom via Strategy. Nothing to build until one comes back.** HOLD browser renders until Lead says
World's Witch strip has landed (Mac at load 50–100).
- **#661 Pitborn Butcher's Wake (A)**, head `e1169159`, base `world/signature-dwarf-stamp` @ `ef7e9f86`. `src/signature-pitborn.ts`
  + tests + one import line in `scene.ts`. His heavy tears a curved blood sheet off the cleaver → drops → 2 floor spots. Lead: reads;
  sent to Strategy.
- **#666 Shieldmaiden Splintered Defiance (A)**, head `61d65db2`, titled "waits for her shield (#606)". She has NO shield in game.
  Lead ruled **no fallback**: with no `userData.slot === 'Shield'` mesh the effect does nothing; with one, rim chips via
  `marks.shield` (cap 4) + splinters from the rim. Node-tested on a mock shield only, never rendered.
- **#667 Dwarf Hammer Stamp B + C** (prep, not ruled), head `402d5cb8`, into `world/signature-dwarf-stamp` (off `dc2d6368`).
  B = 2× dark bruise square (Strategy: "a smudge", frame 1 "a censor block"). C = chamfered-octagon hammer face, 0.25 s fade-in
  (Lead + me: still a flat black octagon, a hole/sticker not a bruise). A untouched. Next pass if asked: lighter mid-tones, a
  visible rim, less opaque core.
- **Veteran Battle Scars**: reassigned to Executioner. Not ours.
- **Open gap (World's, not ours):** no signature honours blood-off; `SignatureFrame` has no `bloodMode`.
- #661 and #666 each add an adjacent import line to `scene.ts`, so merging both gives a trivial conflict. All three need retargeting
  once #655 and the Dwarf branch land.

## Then — 2026-09-24 morning

**Nothing open in this lane.** Everything below the 09-23 handover has shipped; live `c0400c1f` contains all of it
(`git merge-base --is-ancestor`, checked against frankendom.com/release.json).
- **Shieldmaiden six (#595)** merged 09-23, live.
- **Her jaw band (#608, `dcb47253`)**: the dark chin read as a beard; fixed and carried to trunk by Run 3 (#616/#619).
  The "Open tonight" item below is closed.
- **Her kilt strips (#646, `07ad5c8`, merged 09-24 05:28Z)**: the hero's 11 kilt strips hung below her closed tunic
  and cut the mail into a jagged hem. `parts.py` KIT `'kilt': False`, her row only; every other fighter still gets 11.
  `level1_shieldmaiden.glb` 841,372 → 751,340 B, `shieldmaiden.glb` 6,370,680 → 6,290,728 B; her face/skin
  textures and `body_shieldmaiden.glb` re-baked byte-identical to trunk.
- **Next:** whatever Phase L (#589/#606, the Stats lane's) asks of the Pitborn and Shieldmaiden sets (materials). Not
  yet asked. The #595 known list stands as unassigned polish: her cap reads as a band at fight distance, her
  boots are mid-calf where the reference is low, and the Pitborn's shin plates sit slightly outboard.

## Then — 2026-09-23 night (handover)

**Phase R (six takeable armour pieces + weapon per opponent) was pulled forward to TONIGHT and is done for this lane.**
- **The Pitborn, #591**: MERGED into `phase-r` (run 1). Helmet (iron skullcap, replace), Body (rag sash + belt as `over`: it
  covers 26 % of the player's tunic, so it never undresses him; #434's floor applies to `replace` only), Arms (bone
  plates), Gloves (`~kit`), Greaves (shin wraps + scrap plate), Boots (foot wraps), cleaver. loot.glb +84.5 KB gzip.
- **The Shieldmaiden, #595**: OPEN, head `4b5a8a80`, for the next back-to-back run. Helmet (open banded cap behind the
  braids), Body (her tunic kit + mail skirt to mid-thigh, skirt filed under Body), Arms (shoulder plates), Gloves,
  Greaves (leg wraps), Boots; gladius from Weapons' #586. Toe fix done (boot tip extended up to 9.6 cm for the player's
  toes; the toe shape now shows in the leather). loot.glb +264.6 KB gzip. Loot tests 25/25 + tsc at `03029113`; the last
  merge (#598, two CSS lines) has no re-run because a deploy lock blocked it.
- Both are parts-pipeline fighters: Nightborn's TRELLIS weld does not apply; pieces are ray-fitted by the new
  `scripts/loot-fit.mjs`. Both `pitborn.glb` and `shieldmaiden.glb` were rebuilt so the opponents WEAR their six (the
  held Minotaur/Werewolf bakes on the Pitborn base go stale). Material is the base palette: **material at Phase L**.
- Known, listed in #595: her cap reads as a band at fight distance; her boots are mid-calf, not the reference's low
  pair; the Pitborn's shin plates sit slightly outboard. Stills (untracked): `artifacts/phase-r/*-wearing.png`.
- **Next for this lane, in order:** whatever Phase L asks of these two sets (materials); then the jaw band below.

**Open tonight, not pushed: the Shieldmaiden's dark chin/jaw band.** Visible at close range, reads as a beard. The fix
goes as a PR against trunk (a visual glb change, no sim files) with a same-frame before/after still for Lead. The work is
on LOCAL branch `pitborn/shieldmaiden-body` @ `74de033` (a WIP commit, deliberately not pushed). Next step: one
instrumented run that prints the chin texels' brightness at each stage of `head.py`'s scan-texture pass (after the
`jaw_skin` repaint, before and after `fill_margin`) to find which stage restores them. Measured so far:
- NOT the teeth (tinted pure red, the patch stayed black); NOT culling (a double-sided Photo changed nothing); NOT
  the normal map (sampled flat under the chin); NOT a second UV layer (the adapter head has one).
- REAL and fixed in the WIP: the female sculpt keeps parts of its head on BODY tiles, so the Face-tile cut left Skin
  standing inside the scanned head up to z 1.662 (now cut at the neck, z 1.566: `parts.py`, female only); and the neck
  stub took its tone from a ring of jaw shadow + nape hair (now her skin: `jaw_skin` pins `RING_TONE`).
- The shipped `kt_face_color` still carries dark texels at the chin's UVs (p10 luminance 0.118 in the lowest 15 % of
  the head) although the repaint logs ~56k texels changed, so a later stage overwrites them. Suspect `fill_margin`
  treating chin texels as gutter (`core` from `bake_attribute`); not proven.
- Drop the WIP's `teeth_scale: 0.6` before the PR: it changed nothing.

## Done — 2026-09-23

- **The Shieldmaiden into beta** (Dom, "put them live now"; Brief 15, reference A #498). Pushed into `roster-v0` at
  `80e991a`; roster-v0 is on trunk (`7b277fd`), and Combat's bump 8 (`RECORD_VERSION` 8) covers her row. What landed:
  - `parts.py` KIT `body: 'female'`: the realistic female body as a per-fighter switch (the Witch reuses it); the
    female sculpt's multires capped at 2 levels.
  - `head.split_tiles` packs any number of UDIM tiles (`atlas_cells`; the male's three keep their shipped quadrants).
  - Her own head: FLUX.1-dev portrait of reference A (`artifacts/source/face/shieldmaiden/shieldmaiden-01.png`, prompt
    beside it) → TRELLIS.2 → `trellis_head.py`; braid crown as mesh; `scale_by_eyes` (sized by height, the raised
    braids shrank her face to 0.79× and put the neck cut on her chin).
  - `trellis_head.py` BGR fix: the texture was read BGR against an RGB portrait (blue skin; the Nightborn's near-grey
    sample hid it).
  - Squared layered iron shoulder plates (Arms) in `build-warrior.mjs`, double-walled; gladius in hand;
    `shieldmaiden.glb` 3.47 MB gzip; last rung after the Witch.
  - `ARCHETYPES.shieldmaiden` = the Pitborn's profile verbatim at scale 1, a PLACEHOLDER for Combat's retune.
  - Gladius grip material `GladiusBone` → `GladiusBoneGrip` (finisher blood never paints the grip); player
    `gladius.glb` rebuilt from the same source.
- Phase-0 tint stand-in: written, then cancelled by Lead/Strategy before any push; nothing of it shipped.

## Open

- The jaw band (above): this lane, PR to trunk.
- Her loot pieces: tomorrow's assignment (above).
- Her shield-carry pose (#547 closed; not wired for an opponent): unowned, raise with Lead after the loot work.
- The roster-v0 weapon-flip snapshot had two NEW over-cap rows against the Plague Doctor (trident, scythe: `charged
  heavy only untouched 3/24`): Combat's battery, not this lane's.

## Gotchas (cost time today)

- **The deploy lock blocks `node --test` and Blender**, even single files, and deploys run back to back (5c0a32c then
  7b277fd). Queue work behind a watcher on `~/.claude/hooks/deploy_guard.py` `active_lock()`; never retry in a loop.
- **The deploy hook matches words in a whole command**, heredoc text included: a doc edit that mentions a bake is
  refused. Edit files with the Edit tool and keep builds in their own command.
- **Four lanes appending to the same pinned lists** (ROSTER, ladder, picker, loot-data, roster count, BUILD) conflict on
  every merge: keep both sides and re-sequence the rung assertions. `roster-v0` moved between fetch and push twice:
  always `merge-base --is-ancestor` before pushing.
- **The female body is not the male's topology**: 9 UDIM tiles (not 4), and head surfaces on body tiles. Anything
  keyed on "tile 0 = head" is wrong for her.
- **FLUX prompt trap (new):** "two braids"/"plaits" hang the braids past the shoulders every seed; "milkmaid crown
  braid … like a halo" keeps them on top.
- `character-preview.mjs` weapon stats list the HERO's longsword materials; read the opponent's `sword` panel.

## Earlier — 2026-09-22 (superseded by the entry above)

**BLOCKED ON #478 — the Shieldmaiden.** Her design direction is picked and her body is deliberately not
started. Strategy's ruling: silhouette stage only, nothing wearable before the shield asset lands, because a
half-built character across a dependency is worse than a parked one. Her shield is **a material variant and a
size of Multi Chars' single shield asset (#478), not a second mesh**; if her round shape ever needs a
structurally different mesh that is raised with Multi Chars before authoring, never absorbed here.

- **Picked: A, the hard outline** — Dom, 2026-09-22: "i think A", then column A's own panels pasted back with
  "this one", so the pick is anchored to the images and not just the letter. Mail hauberk to mid-thigh over a
  padded wool gambeson, squared layered iron shoulder plates giving a flat hard shoulder line, broad studded
  belt, plain iron vambraces, dark trousers with straight leg wraps, hard low boots, two tight crown braids.
  Approved as a **direction, not a render**: A's panels carry generator artifacts (half-open palms in the bare
  panel) that are not part of what was picked. Sheet, prompts and method in **#498**; B and C stay in the
  sheet as the record of what A beat.
- **She was chosen on outline, not mass** — but the numbers I first published for that are **withdrawn**
  (#498, `fde8d47`), and the claim "the Veteran sits inside the candidates' spread" was **false**. Two faults:
  my threshold mask cannot see polished plate or a painted shield face (they mirror the backdrop at its own
  luminance) and my flood-fill fuses arms into the torso where a hand rests on a thigh; and my bare panels
  held her arms out, so I was measuring **arm span** against references whose arms hang at their sides.
  Re-rendered bare with the arms pinned (same design, same seed) and re-measured off **u2net mattes** with
  the Executioner lane's harness (`scripts/character/silhouette.py`, #502). Corrected, bare: **A 0.284,
  B 0.319, C 0.276** against **Veteran 0.360, Executioner 0.374, Knight 0.367**. What holds is *their*
  finding, not mine — the three men cluster inside 0.014; her three spread 0.043 and the widest is widest by
  fur, not frame. Choose on outline, not build: the conclusion stands, the first evidence for it did not.
- **Her six takeable pieces are named and accepted** (Strategy, 2026-09-23; posted on #471). Helmet (an open
  iron-banded cap worn *behind* the crown braids, not a closed helm), Body (mail hauberk over its gambeson,
  carrying the studded belt), Arms (the squared layered iron shoulder plates), Gloves (iron vambraces on the
  shared `~kit.Gloves` mesh), Greaves (leather leg wraps), Boots. **No Crest** — that is the Centurion's
  ornament and reference A has nothing on the crown. **Recruit-2 = Arms + Body**, ruled in this lane's favour
  against Lead's handoff (which said Body + Helmet): the rule is "the two identity-carrying slots", Helmet +
  Body was the masked pair's instance and not a constant, and `src/loot.ts:44` puts shoulder plates in Arms
  (`pitborn.Arms` = his bone plates). Naming is not authoring; build order stays Recruit-2 first.
- **Her weapon has no loot slot yet.** `WEAPON_SLOTS` (`src/loot.ts:15`) is Trident, Cleaver, Knife, Estoc,
  Scythe, Warhammer — no bearded axe, gladius or maul. SCOPE.md's ten-weapon launch list needs it extended
  before her axe is takeable. Weapons' and Scalable Chars', flagged on #471 so it is not found at a kill screen.
- **The stripped question is CLOSED — do not re-escalate it.** Strategy dissolved it rather than deciding it:
  **there is no stripped state in the game.** Take-one removes at most one piece, the opponent respawns
  kitted, and a grade is a material variant on a shared mesh (`src/grades.ts`), so her Recruit scrap Arms has
  the same hard shoulder line as her iron one. **The silhouette gate is in-kit at every rung; the bare pass is
  informational, never a bar.** The measurement below stands; the bar inferred from it never existed.
- **The measurement that raised it (kept as evidence, not as a bar).** Loot v2
  makes gear takeable, so the real question is not "did the bare panel come back bare" but "does she read as
  *herself* with every removable slot off". With mail, shoulder plates, belt, vambraces and boots gone she
  goes **0.284 → 0.240 and reads as a generic thin woman**; the flat hard shoulder line A was chosen *for* is
  the shoulder plates. Evidence `shieldmaiden-stripped-v2.png`. Raised with Lead, deliberately not solved
  Evidence `shieldmaiden-stripped-v2.png`. Two outcomes came out of raising it: SCOPE.md's withdrawn figure
  was replaced (#492, `70d210a`) and this lane's rule **"stance before breadth"** went into AGENTS.md under
  its own name (#499, `ec60165`) — a silhouette comparison is only valid between figures in the same stance,
  and no measurement code can tell you when it is not.
- **Her brief no longer understates her cost.** #471 said *cleaver* in three places and rested a "zero new
  animation authoring" saving on the Pitborn's `Cleaver_*` set; the bearded-axe amendment removes that saving.
  Fixed by Lead at `f6af593` — verified on `origin/lead/brief-shieldmaiden`: §1 now states the axe is a NEW
  one-hand family, §2 states the cost plainly (~13 clips on Weapons and the animation pipeline, not Combat),
  §4 records ONE-HAND as the one cleaver property the axe preserves so shield and axe need no stow case.
  Combat's queue (knife → cleaver → estoc → shield) was deliberately left alone — that cleaver is their flip.
- **Next, when #478 is on trunk:** her body to direction A, one PR per deliverable, silhouette tested at the
  fighter's camera bare **and** in loadout. Bare is the real test: the shield is lootable, so an outline that
  only reads with the shield up fails the moment a player takes it.

**The Pitborn himself: nothing building and nothing open.** Every Pitborn PR is merged and live; the worktree
`~/Developer/frankendom-pitborn` is clean and detached at trunk.

**Live carries this lane's work** — verified on the served file, not on the merge. Live `05622cf` serves
`assets/pitborn-6VGMI4zq.glb`, HTTP 200, 3,473,712 B. Its bytes are **not** the source bytes: deploy meshopt-packs assets,
so compare sources, not downloads — `src/assets/pitborn.glb` is sha256 `4817820151…` at both live `05622cf` and trunk
`dcb9d61`, i.e. live is serving the current body. The 2026-09-20 roster hold is in live too (`c2f7b28` is an ancestor):
`minotaur wraith werewolf skeleton` all carry `hold: true` on trunk, so the beta ladder is the five men.

**What he is on trunk.** Recipe `pitborn: { name: 'the Pitborn', body: 'pitborn', rig: 'hero', archetype: 'pitborn',
weapon: 'cleaver' }`. Simulation `OPPONENTS.pitborn` is **combat-owned, not this lane's**: scale 1.13, health 190, poise 16;
normal `{reaction 14, accuracy .85, parry .15, dodge .1, aggression .8, pressure .7, discipline 25, lapse .1, read .6}`.
The reaction/lapse retune (18 → 14, .3 → .1) is the Combat lane's 09-20 entry — see `docs/state/combat.md` "Combat: Pitborn
tune"; tune there, not here, and re-run `tests/opponents.test.ts`.

**Another lane last rebuilt his body.** The spider-hand fix (`docs/state/character.md`, "Spider-hand fix reaches the
opponents", 2026-09-22) rebuilt pitborn/goblin/nightborn through `parts.py`. Checked after it: the texture diet survived
the rebuild — `photo_orm_1k` is still in `head.py` (3 refs) and both bare-kit guards are still in `parts.py`, and the
trunk file measures **84 MB GPU texture estimate / 3.09 MB gzip, 31 images** (was 116 MB before the diet; the ~4 MB over
the diet's 80 is that lane's finger/AO maps, not a regression).

**Open, nothing started:**
- A read-only look at the live journal picker (four greyed "(on hold)", five live) was never taken — held back under the
  ONE-DEPLOYER no-local-browser-runs rule and no FREE signal since. One headless page load when the deploy session is idle.
- Kit pass, parked after the owner's "char is good" on 09-16: iron knee plates and bone plates as **authored parts**
  rather than `build-warrior.mjs` ellipsoids, rope-textured wraps, tusk polish. The classic-body `knee()` primitive is not
  an option — it renders as black boxes on the realistic body.
- Measurement gap raised and not owned by anyone: `character-preview.html`'s texture table counts the **hero's** textures
  only, so no phone-memory number has ever included the opponent.
- His cleaver is Weapons' (`docs/state/weapons.md`, cleaver v1) and the flip was Combat's (`docs/state/combat.md`,
  "Slice W — the Pitborn fights with the cleaver"). This lane does not touch either.

## Done — 2026-09-16 → 20

- **#81 the opponent seam + his body** (merged `89c91fe`). `Opponent`/`OPPONENTS`/`Level` in moves.ts — weapon, body
  `scale`, `health`, `poise`, a profile per level, so a new opponent is a record and not an AI branch; `Fighter.scale/poise/
  maxHealth`; the blade sweep's capsule and head/torso/legs regions scale with the target; **passive poise** — a plain clean
  hit under the threshold wounds and builds posture but never staggers or knocks back (heavies, counter/stop/rear and
  charged always do). `initialDuel()` stayed byte-identical to the Veteran (deep-equal test). Body from `parts.py --fighter
  pitborn` + `BUILD.pitborn` (scale 1.13, hunch +7/+7/−7/−6 on spine_02/03, neck_01, Head) — KeenTools head from seven owner
  portraits, tusks cut on the scan, rag sash, crude iron belt, rag kilt, wraps, barefoot, no helm. Stands 1.957 m to the
  hero's 1.745. `tests/opponents.test.ts` (fairness battery at normal and hard, held guard broken in every fight, the
  off-line whiff punisher as the best honest script) and the Pitborn parity test in `tests/characters.test.ts`.
- **#84 the bone plates go dark** (merged). Owner's first look: "char is good, just make the white bone a bit darker, or
  same as the brown leather colour". Plates got their own `BoneWorn` material (`#6e5d45`, roughness .72); the tusks kept the
  ivory `Bone` so the face still reads.
- **#179 texture diet + phantom rivets → reverted → re-landed in #194.** His two 2048² maps (the rag sash's colour, the scan
  head's roughness) carried nothing a phone resolves at 3 m and ship at 1024: **116 → 80 MB GPU texture estimate**, gzip 2.94
  → 2.90 MB. Scoped to his own rows (`linen_maps(size=1024 if KIT['bare'])`, `FIGHTERS.pitborn.photo_orm_1k`) so no other
  fighter's bake path changed. The black specks on his back and chest were **not** the scars pass — they were the kit's 22
  baldric rivets, still placed along a baldric a bare fighter never wears; none for `KIT['bare']`, belt rivets kept.
  **Why it was reverted (`63f4cd9`):** the Minotaur and Werewolf are creature bakes on the Pitborn base and record its
  sha256, so a new `pitborn.glb` made them stale at release check 20. The rebuild route (#185) was closed in favour of the
  owner's call to hold them.
- **#194 the roster hold** (merged `a20a785`, live). Owner, 09-20: Minotaur, Wraith, Werewolf and Skeleton are Season 2,
  "keep them, don't delete or lose". `hold: true` on a recipe keeps it built and a valid `OpponentId` — saved encounters
  still resolve, `opponentFor` falls back to the first rung — but takes it off the ladder (`LADDER`/`nextAfter` skip it; a
  held id has **no next**, an index-0 wrap the test caught), lists it disabled "(on hold)" in the journal picker, leaves its
  GLB out of the bundle via `scene.ts`'s asset glob, and makes `creature-check`/`creature-browser-check` skip held families
  (still runnable on demand). `tests/ladder.test.ts` pins the five-man ladder, the fallback, and that the glob exclusions
  match exactly the held bodies. Dist **29.9 → 17.9 MB** gzip; no creature GLB in `dist/assets`; picker probe showed four
  disabled, five live. `.quality-gate.json` deliberately untouched (Lead's gate split #187 owns the creature-only checks).
- **#196 the release check learns the hold** (merged). Deploy #6 failed at check 2/25 — `roster-browser-check.mjs` looped
  every `ENCOUNTERS` id and asserted the opponent's health, but a held `?opponent=` renders the first rung by design
  (`actual 150, expected 190`). This lane's miss: the gate is release-only, not in `npm run quality`. The live rungs are now
  checked as fights and each held id as a **fallback** — Veteran's health, exactly two rigs fetched, and no creature GLB
  requested. Reproduced on trunk first (exit 1 at minotaur), then `"passed": true`; `npm test` 323/323.

## Pipeline — how to rebuild him (do not re-derive)

`HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic --fighter pitborn` (~4 min) →
`WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs` → `node scripts/character-preview.mjs --label <x> --enemy
/src/assets/pitborn.glb`. The worktree needs all six `artifacts/source/{base,animations,animations2,human-base-meshes,
hunyuan,lps,outfits}` symlinked from the char worktree.

Traps, each paid for once:
- **Never `skeleton.pose()`** in `build-warrior.mjs` — it changes the exported rest transforms and breaks the `hand_r`
  parity test. The hunch is post-rotations about bind-pose sideways axes.
- **`tusks()`** roots at `mouth_z − 0.020`, where `mouth_z = eyes.z − 1.1 × eye spacing`: the scan is cut under the jaw, so
  the chin is not a landmark.
- **`FIGHTERS.pitborn.skin_mul (0.74, 0.80, 0.84)`** exists because the scan's neck band is lit paler and warmer than his
  grey-green cheeks; without it the body came out tan beside the head.
- **Any change to `pitborn.glb` makes creature bakes on his base stale** (`creature-check` hashes it). While the Minotaur
  and Werewolf are held this costs nothing; if either is unheld, a Pitborn body change ships with their rebuild.
