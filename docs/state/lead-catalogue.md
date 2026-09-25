# Lead (lead-catalogue lane) — handoff 2026-09-24 00:20

Canonical Lead state is trunk `docs/state/lead.md` (last entry ~18:30 09-23). This file is the untracked restart handoff.
Overnight: Dom asleep ~00:15 → 09:00; Strategy (local_50f50a99-9831-4024-9533-13d91a1220f3) carries his authority.
Strategy wants ONLY: sha lines, blockers needing a ruling, a lane dark 40 min after a chase. Everything else → the 09:00 table.

## Now
- ===== RESTART POINT 11:40 +04 Fri 09-25 (read this block first; the dated lines below it are the log) =====
  MODE: continuous queue (Dom 10:4x): no freeze, no windows; whatever is READY goes next in order; the box never idles; one sha line to Strategy per live sha.
  LIVE 70b8b170. DEPLOYING #709 @ f6fd872a as trunk cc27cce5 (since 07:38:31Z). Then the Deploy session restarts (writes docs/state/deploy.md), then:
  QUEUE: #743 @ c9810d37 (shader warm-up, READY) → #717 (Veteran rebases on #709, rebuilds loot.glb) → #734 (Veteran, run loot-layers) → #716 (Multi Chars successor:
   rebase after #717, rebuild, rebuilt 375 still must match b36c6344) → #706 (Executioner rebuild) → #708 (Auditer, CONFLICTING) → #728 (draft) → share C1 (Web successor;
   Strategy PASS on the 375 recording still) → #680 (Pitborn, 10×3 browser tables lock/load-gated, explain .quality-gate.json + timing) → #705 (World fd342a5f: TOTAL 40→44 MB
   ACCEPTED by Strategy; check-2 PASS = first fight ≤ trunk+10% and ≤20 s) → Auditer GC PR → loot-clone flags (worn set) → #744 rain 500 (last). Authored pole Draw PR (Weapons) behind the GC PR.
  PERF: GC defect CONFIRMED (heap sawtooth ~2.5 MB garbage/frame; the ~1 s frame is a major GC; both builds). BASE arena = reference (Dom). Normal priority (Dom "seems ok now").
   GC PR title names the allocating function; it also fixes #743's scene.ts comment (cites the withdrawn 806→1416 ms). Suspects: signature-*.ts meshes, gore growth, weapon-take clone.
  SESSIONS GONE (cleared): Weapons (handoff #742 on trunk), Auditer (#701 on trunk), Multi Chars (#618 on trunk). Brief each successor when it appears:
   Weapons owes trident + knife stills from live → Strategy + Lead, then the authored pole Draw PR (fix the record.ts bump-11 'Mon 09-28' comment).
  WITCH SKILL SLICE (Dom via Strategy 11:4x, normal queue work, started 11:4x): Web = #719 rebase + take panel (armour piece OR Witch-fire, one move/duel) + SKILL wiring;
   Pitborn = skill_witchfire sim move per docs/briefs/skill-witch-arm.md (26/40/900-tick cooldown, blockable+parryable) + RECORD_VERSION 12; #732 clip (draft 5fa6f656)
   has NO owner: asked Strategy to get Dom to reopen Weapons. Stills to Strategy before READY: panel offering the move + the cast landing. Date given: preview Sat 09-26 eve,
   live Sun 09-27 if Weapons is back today (+1 day per day it isn't). Grafting stays PARKED: it's a take, not a graft.
   11:41 update: CONTRACT agreed Web↔Pitborn: intent.action='skill' (press), fighter.skill ('witchfire'|null), fighter.skillCooldown (900→0), SKILL dims off
   legal(fighter,'skill'), events move 'skill_witchfire', skill rides the record header like weapon, RECORD_VERSION 12. Pitborn: branch pitborn/skill-witchfire off cc27cce5
   (subagent building; PR # + counts to come). Web: #719 merged trunk in @ 75a729b9 (merges only WITH the sim PR); Web session restarting, handoff docs PR #747 → Deploy to merge.
   Web successor builds the take panel + wiring (stub) + share C1. #709's sha line still pending when Lead cleared (11:41; live was 70b8b170) → verify release.json and send Strategy the line.
  NEEDS DOM: reviewer Stop-hook OAuth re-auth (interactive terminal only). His ?perf=1 base-arena screenshot is the after-measurement, not a gate.
  Crons: hourly :13 wake (b9b70053) is session-only: RE-CREATE after /clear.
- 11:38 +04: LIVE 70b8b170 (#727 + #726), Deploy verified 07:37Z, Lead checked release.json; sha line sent. #709 merged = trunk cc27cce5 (incl. docs #742/#618/#701/#715), deploying since 07:38:31Z. Then Deploy restarts (deploy.md), then #743.
- 11:36 +04: Deploy merged docs #742/#701/#618; #715 re-sent (fixed). Deploy session restarts after #709 is live (360k ctx) → deploy.md handoff; successor needs the queue: #743 → #717 → #734 → #716 → #706 → #708 → #728 → C1 → #680 → #705 → GC PR.
- 11:36 +04: #715 (Strategy) resolved @ 56a7151b, diff = docs/state/strategy.md only; added to Deploy's docs merges (with #742/#618/#701).
- 11:35 +04: Auditer session GONE (cleared; successor reads docs/state/code-quality.md via #701). READYed #743 @ c9810d37 as-is after #709; owed by Auditer successor: fix the scene.ts warm-up comment (cites withdrawn 806→1416 ms) inside the GC-allocation PR; GC PR title names the function; base-arena evidence. Brief the successor when it appears.
- 11:34 +04 hourly: live d45cf76d (= last sha line); lock 70b8b170 since 07:22:49Z (12 min), load 16.8; trunk 70b8b170. Queue: #709 f6fd872a READY next; #743 c9810d37 (on trunk, clean) held for one comment fix (cites the withdrawn 806→1416 ms number). Docs PRs #742/#618/#701 sent to Deploy to merge; #715 (Strategy) CONFLICTING on SCOPE.md, told Strategy. No chase outstanding. Weapons session gone; #742 is its handoff.
- 11:28 +04: Strategy ACCEPTED #705 TOTAL 40 → 44 MB (telling Dom) + check 2 timing condition; GC PR = first after warm-up, function named in title (relayed to Auditer). Pitborn runner verified dead (only its own Claude pids 83480/83481 match); watchdog added (3 s poll, kill own PID tree on lock/load1≥12); relaunch after sha line. 6 idle orphan Chromes from 00:26 (ppid 1, 0% CPU) left alone.
- 11:28 +04: #727+#726 merged = trunk 70b8b170, deploying since 07:22:53Z; load 37 from Pitborn's 9 Playwright Chromes (scratchpad wtbase2) → told Pitborn STOP (kill by pid). #709 @ f6fd872a (Veteran rebase, loot.glb byte-identical, 620/620) READY to Deploy as next run; then #717, #734 (Veteran). PERF: GC defect CONFIRMED (heap sawtooth ~2.5 MB garbage/frame, major GC = the ~1 s frame, both builds). Dom 11:2x: BASE arena is the reference; Dom 11:3x "seems ok now" = normal priority, interleaved. Auditer order: #743 warm-up (rebase on 70b8b170) → GC allocation fix (heap profile names line) → loot-clone flags (worn set) → #744 rain last; suspects: signature meshes, gore growth, weapon-take clone. #705 (World fd342a5f): Lead ruled TOTAL 40 → 44 MB (dist 40.26 MB with 10 carriers cuts +2.8 MB; per-fight ≤12 unchanged); check 2 stricter rule accepted IF first-fight timing ≤ trunk+10% and ≤20 s (Strategy's 09-23 'teaching the check' precedent); Strategy told, may overrule.
- 11:21 +04: Old-link CLOSED: Dom's /s/1 on d45cf76d = Nightborn still + 'fell to a longsword. Your turn.' + PLAY NOW, no error. Box idle → READYed #727 (59c0271d, scene.ts) + #726 (8ff4fe06, loot.ts) batched (both clean on d45cf76d, CI 41 ok/0 fail). Auditer rebases perf 1 after #727 (both scene.ts). #709 (Veteran) next when READY.
- 11:20 +04: Weapons session GONE from ListAgents (socket 1138 stale; likely /clear). Owed by its successor: trident + knife stills from live d45cf76d → Strategy + Lead, then the authored pole Draw PR (fix record.ts bump-11 'Mon 09-28' comment). Brief the successor when it appears. Multi Chars also cleared (successor reads docs/state/multichar.md).
- 11:20 +04: LIVE d45cf76d (#741 sheathed, RV 11), Deploy verified 07:19Z (v:11 + 'sheathed' in bundle). Sha line to Strategy. Old-link check OPEN: /s/1a = 'THIS FIGHT HAS FADED' = unknown-id path (main.ts:585), not the version path (main.ts:590 → PLAY NOW); Deploy re-testing on Dom's real /s/1. Weapons: stills from live, then pole Draw PR. Next: #709 (Veteran) or perf 1, whichever READY first.
- 11:11 +04: #709 owner = Veteran session (sent #709's READY earlier; also owns #717/#734). Routed: rebase on d45cf76d after #741 live, rebuild loot.glb, tests, push, Lead READYs. Told Deploy. Perf PR 1 goes first if READY first.
- 11:09 +04: LIVE ce3b9bd1 (#714), Deploy verified 07:09Z, Lead checked release.json; sha line to Strategy. #741 merged = trunk d45cf76d (RV 11), deploying since 07:09:44Z. Then #709 (owner rebase + rebuild).
- 11:03 +04: Auditer staged: perf PR 1 quality/shader-warmup @ a93857ef (compile after dress(), source-order pin test), READY after FREE + sanity numbers; PR 2 quality/rain-phone-count @ 1fb1bf56 (500 on phone+rain only) HELD for Dom's device p5. Periodic stall: no setInterval/setTimeout on either period in src, no periodic rebuild, Sentry tracing off → GC, rig, or in-render; ×1/idle runs will log JS heap around each long frame.
- 11:02 +04: #741 (Weapons, sheathed + bump 11) READY to Deploy @ c839c805 as the next run after #714 (ahead of #709). Lead read diff: initialDuel 'sheathed' for all, NO_HIP_DRAW poles, draw copy; merge-tree clean on ce3b9bd1; CI 0 FAILURE. Nit for follow-up: record.ts bump-11 line says 'Mon 09-28 window'. Deploy to confirm RECORD_VERSION 11 served + an old /s/ link converts to still + PLAY NOW.
- 11:01 +04: Strategy agrees with the perf ruling, and adds: if the Auditer's ×1/idle run shows the periodic long frame is the game's (not the rig's), it's a base-game defect queued regardless of Dom's readout; Auditer owns it (find the timer/GC on that period). Relayed.
- 11:01 +04: PERF REVISED (Auditer 2nd paired run: dd1d968 vs 3f8e5e1c within noise; periodic ~200 ms/4 frames + ~1 s/3.5 s long frames in BOTH builds, ×1/idle runs pending). Lead + Strategy agree: p95/worst bar withdrawn; only PR 1 shader warm-up (quality/shader-warmup 12bc8d6a) ships in turn; rain count 1500→~500 (look untouched) then loot castShadow flags ONLY if Dom's iPhone ?perf=1 (arena=b, executioner, 3c8318d7) misses floor (p50<30 or p5<20 or first fight >20 s); gore pooling dropped (already pooled). Strategy asking Dom for the screenshot. Deploy order: sheathed → #709 → perf 1 → #717 → #734 → #716 → #706 → #708 → #728 → C1 → #680 → #705 → #727 → #726.
- 11:00 +04: #714 merged = trunk ce3b9bd1, deploying since 06:59:30Z. #705 SKIPPED: CONFLICTING + 4 FAILURE (quality, check 2 roster, check 14 account, summary); sent to World (merge trunk, rebuild carriers via split-loot, fix/prove flakes). #709 next after #714 live (owner rebase + rebuild loot.glb); sheathed preempts.
- 10:58 +04: LIVE 3c8318d7 (#735 ?perf=1 + #733 + #739), Deploy verified 06:58Z; Lead checked release.json + index-CEG5hSX2.js has perf=1. Sha line sent to Strategy. Box free, sheathed not READY → READYed #714 @ 6079cd5d (merge-tree clean on f29679fd, CI 41 ok/0 fail). Weapons: targeted tests during #714's run, full suite when the lock clears, then the next run. Auditer: perf baseline on 3c8318d7, then PR 1.
- 10:54 +04: Pitborn #680 re-merged on trunk f29679fd (#740 docs atop 3c8318d7), local head 789ba3e5: bot scripts + their 3 specs, .quality-gate.json (completion_commands [] → 3 pure node specs; they run on EVERY lane's Stop, so check the timing before READY), 3 lines of main.ts. No SIM_FILES. Live still 3f8e5e1c; lock held by the 3c8318d7 run.
- 10:53 +04: RULING draw fallback (Strategy): one-hand weapons ship hero hip Draw; pole families (trident/scythe/warhammer/maul) switch ON = no draw clip, plain raise. Stills after live = confirmation, not gate. Authored pole Draw PR behind perf 1–4. Sent to Weapons: ship on green tests when box frees.
- 10:53 +04: #740 merged (117ff68c, web.md). Deploy acked the new order. 3c8318d7 in release checks; sha line pending.
- 10:53 +04: #735/#733/#739 merged = trunk 3c8318d7, batched deploy since 06:48:43Z (sha line pending). #740 (web.md docs) → Deploy to merge. PERF (Auditer audit, Strategy ruling: SCOPE defect, ahead of cosmetics): Auditer fixes 4 PRs = shader warm-up → phone rain 500/single-sided/no fog → loot-clone flags → gore pooling; PASS after 4 = arena=b ×4 p95 ≤160 ms, worst <806. SHEATHED: sim done (9 weapons, AI waits, bump 11, knife replay); no per-family Draw clip, all fall back to hero hip Draw (no T-pose); pole families look odd → trident+knife stills to Strategy; default ship fallback, pole-skip switch ready; authored pole draws = follow-up. Queue: sheathed → perf1-4 → #714 → #705 → #709 → #717 → #734 → #716 → #706 → #708 → #728 → C1 → #680 → #727 → #726.
- 10:47 +04: Strategy RULING: never hold the box for non-READY work; Deploy GO #735 → #733 → #739 now; sheathed jumps to next deploy the moment READY (even mid-chain). GO sent to Deploy.
- 10:47 +04: DOM ORDERS (via Strategy): playtest CANCELLED, freeze LIFTED, queue continuous (merge+deploy each as it lands). Sheathed fix skips the line, bump 11 TODAY (Weapons building). Order sent to Deploy: sheathed → #735 → #733 → #739 → #714 → #705 → #709 → #717 → #734 → #716 → #706 → #728 → #708 → #736 → #727 → #726 (drafts/conflicts skipped, not blocking). Asked Strategy if #735–#739 may ship while Weapons builds; Deploy holds until answered.
- 10:41 +04: RULING (Dom via Strategy): every weapon starts SHEATHED (defect since #713: duel.ts:61 gives non-longsword 'ready', ai.ts:56 never waits). duel.ts is SIM_FILES and combat.ts:100 replays via initialDuel, so it needs BUMP 11: slotted Mon 09-28 v11 window (weekly rule; bump 10 was Thu), not Sat. Owner Weapons: draft today, READY Sun eve, per-family draw-clip stills + tests. Told Strategy the slot correction.
- 10:32 +04: Multi Chars ack: 84076da8 locked; sharp-peak variant parked unshot at multichar/witch-sharp-peak-parked (276bf970), post-beta if Dom asks. Session clearing; successor reads docs/state/multichar.md.
- 10:30 +04: RULING #716 PASS (Strategy, b36c6344 still, build 84076da8): shoulders covered, hood not a circle; sharper peak = post-beta only if Dom asks; poke accepted (watch Jog 10.7/33, Death 14/57), cloak in reserve. Chain unchanged; rebuilt still must match before merge. Relayed to Multi Chars.
- 10:24 +04: Multi Chars Witch silhouette still (b36c6344, build 84076da8) sent to Strategy for #716 PASS. Lead read: (a) no bare shoulder MET; (b) hood reads as a rounded dome at 375 (Multi Chars says peak), flagged. Poke: robe Jog 10.7%/33mm, QuietOne 14%/57; capelet thrusts ~9%. #716 stays 37c90cd0 until #709→#717.
- 10:16 +04 hourly: live 3f8e5e1c, no lock. PRs updated last hour: #739 (c4f95141, READY run 1), #738/#737 merged, #734 draft push, docs #715 + #701 (owners' state docs, open). No chase outstanding. No action.
- 10:01 +04: #738 merged by Deploy (trunk 9beb7ec6, docs only); live still 3f8e5e1c. Deploy runs combined tsc + typecheck:tests after the 3rd merge on Sat.
- 09:56 +04: #738 head moved to 4ebc752e (web.md only); told Deploy to merge it. #739 READY for run 1 slot 3: Auditer's combined trunk+735+739 = tsc 0, quality:stop 617/615/0/2; CI 0 failures (26 pending). Run 1 (Sat after 12:00) = #735 4bacd199 → #733 2811cc3b → #739 c4f95141.
- 09:50 +04: Share C1 picked by Dom (Strategy; evidence/share-mockups-c @ a7372252). Post-playtest run 1 = #735 → #733 → #739 (Auditer finding B, c4f95141; READY only after combined-tree receipts trunk+735+739). Web builds C1 on #739 and it merges after Strategy PASSes the 375 recording still; Web also owns the daily/coached Share-hidden check (main.ts:925). #738 (web.md docs) sent to Deploy to merge. Pitborn #680: fallback 898cf9a4 (holdWorn, Shieldmaiden only) accepted, 10×3 tables running.
- 09:43 +04: Deploy asked (Dom asking if deploying). Replied: freeze holds on 3f8e5e1c, nothing now; Sat after 12:00 #735 @ 4bacd199 then #733 @ 2811cc3b (heads re-checked, both OPEN, not draft). Hourly :13 cron recreated (1af88656).
- 09:36 +04 hourly check: live 3f8e5e1c, no deploy lock, no PR updated in the last hour, no chase outstanding (no lane was chased today, so the 40-min rule has nothing to count).
- ===== RESTART POINT ~09:30 +04 Fri 09-25 (the "~10:00" stamps below were estimates; `date` said 09:36 at the next check) (read first; trunk docs/state/lead.md entry is PR #737, docs) =====
  Full state is in PR #737's lead.md entry (git show origin/lead/state-0925-morning:docs/state/lead.md | head -30). Memory: project_scope_0925_base_game.md.
  DOM SHARE PICK (~10:10): "C, but no heavy circles; keep the share icon, semi-transparent". Web is redoing C as C1 icon+text / C2 text / C3 icon (no circles,
   semi-transparent, dark + light floor) and sends it to Strategy; Dom picks among the three. #737 merged (trunk 321dc3af).
  Waiting on: Dom (C1/C2/C3 pick, Android tester, reviewer-hook re-auth); Pitborn's #680 10×3 table; Multi Chars' robe still from behind;
  Web's career-kill share check. Freeze until Sat 12:00; then Deploy runs #735 → #733, then the post-playtest chain. #737 needs Deploy to merge (docs).
  Re-create the hourly :13 cron after /clear (crons are session-only).
- ===== 09:05 +04 Fri 09-25 UPDATE =====
  LIVE 3f8e5e1c = the PLAYTEST SHA (#722 + #713 + #725). Lead check 08:58: release.json, bundle index-Co2O-S-8.js has `playerWeapon` 3x (new in #713). Item 1 CLOSED.
  ALL-CLEAR sent to every lane 09:0x. Playtest = today Fri 09-25 (Dom supplies the five), reports by Sat 09-26 12:00, fix only what they hit.
  Item 3 (Android perf): owner Auditer, Sat 09-26; ?perf readout PR by tonight; needs one Android tester from Dom (fallback = paid device lab, Dom's yes).
  Asked: World → plan for 2 arenas (item 6); Multi Chars → Witch silhouette plan (item 4); Weapons → npm test on #733 then READY.
- ===== START HERE (08:53 +04 Fri 09-25; superseded by the 09:05 block above where they differ) =====
  SCOPE REWRITE: Dom 09-25 = beta is the BASE GAME. PR #729 (Strategy, docs) wins over last night. Stack rank: (1) #722 + #713 live
   (2) 5-person phone playtest, fix only what they hit (3) mid-range Android perf run (4) ten opponents finished: chain #714→#705→#709→#717→#716→#706→#708, #728 replaces #666
   (5) share: replay link + clip export + OG tags (Web) (6) two more arenas (World) (7) combat feel (8) special move = second take on SKILL (#719, #732 draft), behind 1–7
   (9) server-checked loot awards. PARKED: grafting, creatures, body parts, gear stats, gear dmg/def, Origin, Arena Draw.
  LIVE 99fac109 (#722 zoom guard), verified 08:47: served css 10x touch-action:none + 2x pan-y. It's a rerun: the 23:33 run FAILED at load 60–110 (row timeouts).
  IN FLIGHT: deploy 3f8e5e1c (#713 weapon take @ edeb2bb1 + #725 @ cbe11604), started 04:48:43Z. When live: grep bundle, sha line to Strategy [56ada8],
   then ALL-CLEAR to every lane (HOLD on Blender/browser suites/full npm test since 08:45), then set the playtest date and send it to Strategy.
  PARK DONE: #707 closed + label `parked`, branch kept 9ddf6801; trunk src/gear-stats.ts imported only by its test (no sim effect). Pitborn's #707 notes on #699.
  AFTER ALL-CLEAR: Web renders revised SKILL stills (#719 @ f94d6c00) → Strategy. Pitborn re-runs 2 flipped fights for #680 (da162da7 vs 03234673).
   Auditer gates #726 (finding A, post-playtest after #714). Nightborn: plague doctor coat draft PR, rebases after #709. Weapons #733 (4-line build fix, no asset change) → polish run.
  NEEDS DOM: reviewer Stop hook OAuth expired (every lane's turn end fails 3x); only Dom can re-auth from an interactive terminal.
  Crons (session-only): hourly :13 wake (7cad7396).
- ===== START HERE (22:52 +04 Thu 09-24, restart at the context budget; supersedes everything below) =====
  Canonical entry: trunk docs/state/lead.md (#721 merged as 5334f3e5). Memory: project_skill_button.md holds all of tonight's SKILL rulings.
  RE-CREATE THE CRONS (they were session-only): hourly Lead wake at :13; 06:03 fallback check on #713 (only if not already done).
  1) #712 Evaded! is DEPLOYING ALONE (Dom told Deploy "deploy please"): lock names 40014b11 since 18:41:53Z, 33 rows local. When release.json = 40014b11,
     grep the bundle for the evadeAt/swingAt change, then send Strategy (uds 78436) the sha line with the new B1/B2 dates (B1 = preview before Wed 09-30).
  2) #713 WEAPON-TAKE, 7bb0393a, out of draft, FULL equip loader, no SIM_FILES. The code is reviewed and sound. ONCE THE LOCK IS FREE: in a scratch worktree
     (ln -s node_modules), run tsc --noEmit and npm test; check gh pr checks 713. Then READY it to Deploy (uds 60732) as its OWN run tonight, and send the sha line.
  3) Web's SKILL layout revision is due 23:45 (SKILL above HEAVY, the six unmoved); it's waiting on the lock. Look at the still, then take it to Strategy.
  4) #720 skill spec, fc6e2e94: ACCEPTED, docs, sent to Deploy to merge. World's 3 arm directions are due Fri 10:00. Multi Chars is building a hood/robe silhouette for #716.
  5) Pitborn: #680 at 03234673 (bot 3/0 vs the Pitborn); the full 10-opponent table is pending; then the #707 duel.ts review.
  Sockets: Strategy 78436, Deploy 60732, Weapons 1138, Pitborn 70702, Veteran 87242, Executioner 60597, Auditer 62553; Web/World/Multi Chars by name + [ref].
- ===== START HERE (22:35 +04 Thu 09-24; supersedes the 21:57 block below) =====
  LIVE 33b0bf57 (curl 22:24), lock FREE, trunk 2731de59 (docs-only since live). Strategy socket now /tmp/cc-socks/78436.sock (37768 is dead).
  10:00 Fri RUN = #712 (Evaded!, dc15c012, Lead-verified: tsc 0, npm 606/0/2, new test fails 6/8 on trunk combat.ts) + #713 WEAPON-TAKE (draft,
   Weapons @ uds 1138). #713 blocker: the runtime never loads equip GLBs, so trident/scythe/warhammer/maul would show capsules. 06:00 DECISION (cron e7c3f53a
   at 06:03): full equip loader, or NARROW (only weapons with a clip family in warrior.glb, else longsword). Hard rule: no weapon choice ever shows capsules. Verify, then READY both
   to Deploy (uds 60732) as ONE run; sha line to Strategy.
  POST-PLAYTEST RUN A1 (Fri eve), order: #714 6079cd5d → #709 e3b4f218 → #706 (Executioner rebases + rebuilds loot.glb after 709) → #705 3cf1018b → #708 baf92480 → #680.
  A2 Mon 09-28 v11: #707 9ddf6801, after Pitborn's duel.ts review (after #680). A3 Wed 09-30: Shieldmaiden scale/lamellar + nasal helm (Veteran, concept change),
   #666 (Executioner on #705), Auditer findings A→B, playtest triage by Sat.
  BLOCK B = SKILL slice (memory project_skill_button): Witch arm → Witch-fire. Web SKILL still Fri 18:00; Weapons docs/briefs/skill-witch-arm.md Fri 20:00;
   World 3 arm directions Sat 12:00. B1 preview Wed 09-30, B2 live Mon 10-05 (v12). C1 provenance 10-09, D1 doc 10-16. Plan ACCEPTED by Strategy 22:3x.
  GAPS with Dom via Strategy: Combat + Backend sessions; Brief 3 data model by Sun 09-27. SCOPE.md update is PR #715 (docs, Deploy merges).
- ===== START HERE (21:57 +04 09-24, restart handoff; supersedes the blocks below) =====
  LIVE 33b0bf57 = THE PLAYTEST SHA (Lead-verified 21:56: bundle index-DdvzcMAS.js has kick stagger:48, witch easy pressure .75, Evaded, supabase.co, no arenaDraw).
  Sha line sent to Strategy. Lock FREE. NO deploys tonight except Weapons' WEAPON-TAKE fix (due 10:00 09-25, its own run BEFORE the playtest; the playtest waits on it).
  Strategy's uds socket now: /tmp/cc-socks/37768.sock (the Desktop route hit the 10-message cap tonight; uds sockets don't count). Lane sockets: Deploy 60732,
  Weapons 60877, World 61733, Auditer 62553, Veteran 87242, Pitborn 70702, Executioner 60597, Web 60398 (sockets change on restart; ListAgents names work too).
  BLOCK A IN FLIGHT (PRs + evidence branches, stills to Strategy before merge; the Auditer's is a sim change → v11, don't merge):
   World = tier dressing (salvage #589/#606 onto trunk, split per-opponent kits before merge; Provenance.tier display-only)
   Auditer = gear stats (design approved: scaled damage only, poise/stagger unscaled, opp+daily NAKED, record v11 4×f64)
   Veteran = carriers (knight.Helmet, plaguedoctor.Helmet/Body; @build shells where seamed)   Executioner = BUILD shieldmaiden.Shield, then #666
   Pitborn = Easy seed doesn't branch pitborn/knight/shieldmaiden → fix; then the Pitborn loss; the #680 knight row   Web = STOPPED (reveal rejected by Dom)
  REVEAL: Dom rejected all 3 mockups ("terrible, ugly, crass"). Closed for Web; open with GPT via Strategy's Brief 5 (#704). Only a picked option comes back to a lane.
  HOURLY LOOP: re-create the cron at :13 after /clear (it was session-only). OWED 09:00 +04 → Strategy: lanes per block A–D, the first milestone per block with a date, block B's
  first build (Strategy's bet: parts pipeline + anatomy data model; Dom is getting an outside draft of the data-model doc), and the block A PR list with heads. Grafting = BETA (memory project_grafting_is_beta).
  Docs-only for Deploy's next batch (no deploy): #696 Weapons (7766a9f8+), #701 Auditer, #645 Web (e828bc04), #704 Strategy Brief 5. Tomorrow's queue: #700 texture retry (own run), #680 bot stack.
  GOTCHAS tonight: SIM_DIGEST is read AFTER every edit to a SIM_FILES file, comments included (record.ts is one). A bump also needs READABLE [n] in the guard test, the
  RECORD_VERSION pin in tests/player-weapons.test.ts, and refs regenerated with record-replay-check --write. A READY must say "CI queue is not a gate" (Dom).
  Don't count a peer's report as verified: curl release.json + grep the bundle yourself.
- ===== 21:00 +04 09-24: DOM DRIVE-BY (via Strategy): three sim fixes LIVE by 23:30; the freeze is lifted for these only; the playtest moves to the final sha =====
  KICK → Weapons [fcc576]: kick into a guard must leave a punish window that lands on all 9 (today 57 first legal / 66 window end / 73 contact).
  ROLL → Pitborn (uds 70702): straight-back roll vs a charged heavy 0/9 like sideways; "Evaded!" whether the sim emits Dodged or AttackMissed; report the wall case.
  WITCH → Veteran [534b44]: own Easy profile ≠ Centurion, existing knobs only. Pitborn runs all the bot receipts on the integration tree.
  Lane PRs off trunk by 22:15 with NO RECORD_VERSION/SIM_DIGEST changes. LEAD: branch lead/sim-fixes-0924 = trunk + the 3 heads merged +
  ONE bump (record.ts RECORD_VERSION 9→10, READABLE_VERSIONS [10]; tests/record-version-guard.test.ts SIM_DIGEST from the failure print,
  PINNED_FOR_VERSION 10), then tsc / typecheck:tests / npm test / record-replay-check, ONE PR → READY to Deploy [205d54] (plan acked,
  box free from 22:15). The lane PRs close as landed via it. Sha line → Strategy per deploy; a slip line if any item misses.
  #680 bot stack READY at 48074d3b (596/0/2) but PARKED to after the playtest.
  ~21:45 STATUS: integration PR #695 lead/sim-fixes-0924 @ 41f2f7bf = trunk c1bbd1b2 + #691 685d708c + #692 2632c9b0 (kick vsGuard.stagger
  36→48) + #693 dc133f17 (roll: test only, a bot artefact; Strategy upheld NO lever) + bump 10 (digest is read AFTER every edit to a SIM_FILES
  file, comments included; READABLE pin in the guard test; player-weapons.test RECORD_VERSION pin; refs regenerated with record-replay-check --write).
  tsc 0 / typecheck:tests 0 / npm test 603-0-2 / --strict passes. WAITING: Pitborn receipts.sh 41f2f7bf (4 receipts) → READY #695 to Deploy,
  behind Web's #670 Arena Draw revert (Dom: "really cheap"; goes FIRST as its own run). Merge trunk into #695 if the revert lands first.
  21:1x: KICK closed. The A/B shows the Pitborn Easy losses (seeds 2230671998/2504048581, both at 45.35 s) happen at stagger 36 too, so they're pre-existing
  trunk drift, not #692; no option (a). Pitborn lane diagnoses it after tonight (an identical 45.35 s smells like a harness cap). The 375 kick strip was checked by Lead.
  RAIN #697 ac2dd3aa (World): Strategy YES (the slant reads as wind-driven rain; it's a side effect of aligning streaks to the real 0.12 m/m drift) → RIDES
  the #695 publish: READY order = #695 then #697 (Lead checked: merged onto #695, guard + arena tests 10/10, no digest touch).
  TOMORROW after the playtest sha (Strategy, Dom's word): GRAFTING IS BETA. Read docs/SCOPE.md top bullet + docs/briefs/grafting-direction.md
  (PR #690, docs-only → Deploy merges). Deliver ONE message: lanes per block A/B/C/D, the first milestone per block with a date, and what in B
  must be built first (Strategy's bet: the parts pipeline + anatomy data model). Milestones, not tasks. Constraints: skill decides, no timing
  changes, no Nemesis hierarchy, every visual → Dom as stills before merge.
  21:2x READY SENT to Deploy: run 1 = #694 5015ce25; run 2 = #695 41f2f7bf then #697 ac2dd3aa. ON EACH LIVE SHA: check release.json and grep the served
  bundle (supabase.co; for run 2: the witch easy profile values / rain shader) → sha line to Strategy. Easy gate on 41f2f7bf: 9/10, WITCH 3/0; the Pitborn 1/2 fail
  is pre-existing (a real loss that also happens on trunk). The Easy seed doesn't branch Pitborn/Knight/Shieldmaiden. Both are Pitborn's for tomorrow, plus the knight CONFIG row for #680.
  WEAPON-TAKE BUG (Dom, live): taking a weapon never wields it. Cause (Lead, code): equipped.main persists, but match.ts:41 weapon is hard-set to 'longsword'
  and scene.ts:142 builds the rig weapons without the player's → sim and drawn are both always longsword. → WEAPONS: wire equipped.main into
  Match + createScene; a kill link draws the record's weapon; daily = equipped; no SIM_FILES edit. PR + 375 stills by 10:00 +04 09-25, BEFORE the playtest,
  on its own deploy run. Also check one armour piece per slot (Dom: "mostly the armour"). Strategy has the diagnosis.
  21:30: Dom (via Strategy): "deploy dev was sitting idle" — my READY had made CI a gate. Corrected (memory feedback_never_gate_publish_on_ci_queue).
  Run 1: #694 merged as 9aec952c, lock since 17:29:29Z. Run 2 told: #695 then #697 straight after, no CI wait. Daily = FIXED KIT (Strategy overrule) → Weapons done
  (#696 head 7766a9f8). Auditer #700 (texture retry, Sentry FRANKENDOM-C/-F) → tomorrow on its own run after the weapon take; Stop-gate restore DROPPED.
  MESSAGE CAP: Desktop-route sends (Strategy) blocked until Dom types in this session; uds sockets still work.
  LIVE 9aec952c (#694 revert) verified by Lead 21:38 (release.json + bundle index-CS8T_4Tf.js: supabase.co, no arenaDraw). RUN 2 33b0bf57 (#695 as 886bd0af,
  #697 as 33b0bf57) deploying since 17:38:05Z. VERIFY: release.json = 33b0bf57 + bundle → sha lines for BOTH runs to Strategy (still owed; the msg cap blocks it until Dom types).
  21:4x BLOCK A STARTED TONIGHT (Dom: "keep moving, delegate lead dev"). NO deploys except the weapon-take fix. PRs + evidence branches, visual stills → Strategy before merge:
   World (sock 61733) = TIER DRESSING (gradeFor into the loot attach; 375 sheet: Centurion at Recruit/Legionary/Gladiator + one player piece at 2 tiers)
   Auditer (sock 62553) = GEAR STATS INTO THE DUEL (Brief 19 d5; server-authoritative; sim → RECORD_VERSION 11, build, don't merge)
   Veteran (sock 87242) = HELMET+BODY CARRIERS for Witch/Knight/Shieldmaiden/Plague Doctor (UV seam; 6 pieces at 375 each)
   Executioner (sock 60597): #666 BLOCKED. #606 is a Phase L DRAFT stacked on #589 (CONFLICTING vs phase-r) and NO shieldmaiden.Shield exists → Executioner BUILDS
     shieldmaiden.Shield (veteran.Shield precedent); #666 → READY after that + World's carriers.   Web [318e4f] = 3 labelled reveal mockups ONLY
   World rulings: Centurion wears veteran.* loot over the baked body (salvage #589/#606 onto trunk as ONE PR, close both); NO merge with the 9.4 MB loot.glb
     per fight: split per-opponent kits first; Provenance.tier optional DISPLAY ONLY (tierAt(marks before win) = the awardFor formula); gear stats use server awards only.
   Veteran: UV seam = SCOPE.md:45; only knight.Helmet, plaguedoctor.Helmet/Body remain as cuts → @build shells where a seam shows.
   Pitborn (sock 70702) = Easy seed branching for pitborn/knight/shieldmaiden, then the Pitborn loss, then the #680 knight row
   Weapons (sock 60877) = weapon-take fix, PR + stills by 10:00 +04 09-25, its own deploy before the playtest.
  HOURLY LOOP: cron 2cdee1d9 at :13. 09:00 +04 DELIVERABLE to Strategy: lanes per block A–D, the first milestone per block with a date, block B's first build
  (Strategy's bet: parts pipeline + anatomy data model; Dom is getting an outside draft of the data-model doc), and the block A PR list with heads.
  Docs batch for Deploy (no deploy) when convenient: #696 Weapons state (head 7766a9f8), #701 Auditer state. RAIN perf → World (not a gate tonight). Weapons /clear'd.
- ===== 20:34 +04 09-24 (after /clear) =====
  All seven docs PRs are on trunk (#583 is c1bbd1b2; trunk has moved to 435f5047+ with docs only). Live is still e37a74c7 and frozen.
  Told Strategy: no loot tier is dressed live. gradeFor/GRADES have no runtime caller and WORN_FROM is {}, so wiring it is a post-playtest visual.
  Pitborn: land the bot stack #632→#668→#680 as ONE PR. #680 gets retargeted to trunk and drops the player-bot.mjs browser run
  from .quality-gate.json completion_commands (it would run on every lane's Stop). Pitborn sends head + check counts; Lead orders the merge,
  with no deploy, AFTER the playtest (it carries a src/main.ts botSeed change: localhost+?debug only, default 731).
- ===== START HERE (15:07Z 09-24; supersedes the 14:17Z block below) =====
  **LIVE e37a74c7 = THE PLAYTEST SHA** (Lead-verified 15:06Z: release.json + index-BGl56bq4.js carries all six signature names,
  charge_foe, goblin lift:-1.6, Deflected .35, supabase.co; Deploy 36/36 local rows). Sha line + phone listen-test ask SENT to Strategy.
  Deploy queue EMPTY. **FREEZE (Strategy 19:06 +04): no deploys on e37a74c7 before the playtest except a fix for something broken on it**
  (Deploy told). Strategy wants only sha / slip / ruling asks tonight.
  **Dom 19:20 +04: LEAD = CEO, full authority; ask Strategy only if in doubt, then move on. Never leave a lane's question for Dom.**
  Swept every lane's last messages (subagent + list_events) at 19:2x: closed #638 (superseded; #637/#643 live), #665 Blade Bite B
  final (no C strip); all lanes told "questions → Lead". Centurion equip loader + gladius/scutum re-land (Veteran): PARKED to the
  Monday sim window (it changes the fight = RECORD_VERSION); assign it then, together with the KICK brief for Combat.
  Docs-only state PRs handed to Deploy to merge with NO deploy: #674 #583 #584 #587 #645 #652, plus Executioner's fresh one (#469 was
  already merged, so its 0d678364 needs a new PR off trunk). Verify they merged next session. All lanes: "done; next from Lead". The ONLY item with Dom: name the five playtesters (Strategy's ask). Next: whatever Strategy sends after the playtest (Q1/Q3 answers may reopen the parked items below).
  (history) LIVE a5590911 (#679 Witch pose B), Lead-verified 14:28Z, sha line sent. DEPLOYED e37a74c7 (started 14:55Z) = ONE publish of
  #682 7b06a113 → #684 035f6086 → #678 0885d499 → #685 6531f2bc → #687 d0fb1135 → #686 b1fe8d66 (Deploy merged all six; trunk e37a74c7
  == Lead's stack tree f1c9eac0; Lead ran tsc 0 / typecheck:tests 0 / npm test 596 pass 0 fail 2 skip on it). ON LIVE: verify release.json
  = e37a74c7 + served bundle strings (supabase.co; DEFLECT_FROM .35 / Deflected; charge_foe; goblin lift -1.6) → ONE sha line to Strategy
  that ALSO asks for a phone listen-test in the playtest observer notes (Weapons' ask, #678): the charge_foe climb runs the opponent's whole
  heavy hold and cuts off clean (≤40 ms) on a feint/stagger
  (#658 CLOSED, #660/#662 auto-MERGED: all three heads are on trunk via #684; nothing to close). Playtest is TOMORROW on this sha (script docs/briefs/playtest-1.md on strategy/state-1235).
  STRATEGY'S 5 ITEMS: all closed. (1) shas: this deploy. (2) defence gate CLOSED: v1 evidence/defence-reads 6ff9f47d FAILED block vs parry;
  #686 parry tell (Deflected from .35, snapped weight; the dt-0 hit-stop root cause) PASSED on evidence/defence-reads-v2 423d98f6. (3) roster
  #685 + goblin #687 (LEAN_HIGH) ruled YES; sheets on evidence/charge-roster a07249bc. (4) rising charge_foe #678; ruled no 2nd cue at her
  Charged. (5) bot report #680 c6e06ff6 = playtest baseline (gate PASS 24/27).
  PARKED (Strategy): KICK → Monday sim window, COMBAT's item (no Combat session live; hand it the brief: a landed kick on a guard must leave
  a punish window > kick recovery + fastest windup; today first legal 57, window end 66, thrust contact 73). Wall roll = teaching, no tune.
  Goblin loss closed. Witch == Veteran sim profile: post-beta with the Stats tier table. Player-gets-parried (enemyParried) has no Deflected
  reaction: parked, returns only if playtest Q1 points at it. Tall-lean torso/step lever on the shelf, same condition.
  LANES: Weapons, Web, Exec, World, Pitborn all idle-done tonight. Sprite gzip headroom is 816 B (the next audio add breaks the 1 MB cap).
  GOTCHA: `gh pr checks` prints CANCELLED as "fail"; merging a PR mid-CI cancels its rows. Check statusCheckRollup .conclusion first.
- ===== (previous) START HERE (14:17Z 09-24, written before /clear; supersedes everything below) =====
  AUTHORITY: Strategy ("Frankendom - Strategy - Fable 5.1", reply to its uds `from=` address) = owner proxy/CEO. Receipts → Strategy with a
  one-line Lead verdict. Dom only for money/brand/sim-freeze/scope. Lead verifies every live sha ITSELF (release.json + a grep of the served
  assets/index-*.js for the feature strings + supabase.co) before sending the sha line. Only Deploy [803b37] merges and deploys; Lead sends READY.
  LIVE 5655ac94 (#667 Dwarf Wound). DEPLOYING a5590911 = #679 Witch charge lean B (merged ~14:05Z) → VERIFY FIRST: release.json = a5590911,
  bundle has supabase.co; then the sha line to Strategy.
  Today's live chain (all Lead-verified + sent): c90bd83b #672+#673 → d45f4837 #663 → 2c3dd94a #676 HUD + #659 Rivet B → 5f32ad45 #677
  (SHIPPED/ship mode/bloodMode) → 174537be #669 Witch Grasp + #681 strings → 5655ac94 #667.
  NEXT READY: #682 effects batch (Exec; = #661 Butcher's Wake 690c74a8 + #657 Reaping Scar + #665 Blade Bite, the scene.ts imports resolved once),
   head 7b06a113, CI was 37 pending at 14:17Z. When green: build a merge tree of trunk + #682, run tsc + `npm run typecheck:tests` + the signature
   tests (after the deploy lock is FREE), then READY → Deploy.
  WEAPONS: #658 Nightborn B, #660 Goblin C, #662 Plague B: + `blood: true` + a pin test, merge trunk in (they will hit the same scene.ts import
   block; keep every line). Heads: #658 53236c94 (CI running), #660 14d4858d (quality green; the red row = a cancelled matrix run), #662 f97087eb
   (bloodMode typecheck fix, CI running); 3 files each. All three + #682 each add a scene.ts import → merge-tree the WHOLE queue, and
   likely batch them like #682. Charge cue = PR #678 77ab22d8 (green, NO rise yet); the rise is designed (0.9 s climb on the opponent's Charging, a
   fade ≤40 ms when ArenaFrame.holding goes false; the sim is untouched) → the next Weapons session codes it. Weapons restarted: docs/state/weapons.md (PR #674).
  EXECUTIONER: after #682 → fit CHARGE_LEAN per weapon → ONE roster sheet (a held-charge still per opponent at 375, player guarding) → Strategy → one PR.
  PITBORN: bot PR #680 a962f66b (base codex/01a0ceea/task-3). The charge is read only from the sound or the hold time (no data-threat).
   The full batch is paused for locks. Report adds: KICK scripted scenario (stagger window ticks, seen?, the quick attack landed?, reposition);
   GOBLIN replay of the Codex run's loss ~/Developer/frankendom-player-bot/artifacts/combat/limited-all-easy-3/goblin-2504048581.json
   tick by tick (legal/requested/accepted → verdict: missed chance / unclear feedback / rejected input / no escape); ROLL retreating vs angled.
   Then merge #668's 9483f894 into #680. Pitborn restarted: all owed work is in docs/state/pitborn.md on pitborn/state-0923 @ 46eb32dd. The Codex bot lane (no Claude session; talk on #668) came back at 13:13Z; asked it not to build in
   parallel and not to run during deploy locks (its PID 73080 ran through one).
  WEB: defence-reads sheet (capture only): block / parry / dodge at impact, 375, the live build, cue names → evidence/defence-reads → Strategy
   rules on the gap. FIRST item in Dom's plan. NOT RUN yet (the lock); Web restarted, handoff in web.md on PR #645 (ea22336c), script
   artifacts/defence.mjs. Cues from the code (unconfirmed): Blocked→block/block_perfect, Parried→parry, Dodged→no impact cue (roll whoosh only).
  DOM'S PLAN (adopted by Strategy 14:0xZ): defence feedback + charge readability first; kick/Goblin investigated before any mechanic moves;
   timings/damage/Easy unchanged. Playtest after defence feedback + pose B are live: 5 phone players, no coaching, Strategy's script, Dom brings the people.
  RULINGS today: the practiceHint line = "what happened or what state you're in, never what to do or when"; the damage number STAYS (Dom's 2nd
   09-20 call 6a5b82df); coach mode post-beta (PR #640, docs/briefs/coach-mode.md); Rivet C closed → Rivet B final; Dwarf = Wound (C).
  GOTCHAS: every signature PR adds an import in the same scene.ts block → chained conflicts; merge-tree the whole queue before READY. #677
   made SignatureFrame.bloodMode required → test frames without it fail `typecheck:tests` (only CI's quality job catches it). The Stop
   hook blocks test suites during a deploy; `git merge-tree` is allowed. In zsh write "${VAR}:path" (the :h/:r modifiers bite). Lanes with
   duplicate names need "[ref]": World 47373e, Exec 53e69b, Deploy 803b37, Web ced568. World finished its queue and restarted.
- ===== HISTORY (older blocks) =====
- ===== START HERE (11:5xZ 09-24, after /clear; supersedes below) =====
  STRATEGY 15:35 rulings: Witch #669 d67bca77 AGAIN (sparks → short streaks at staff head, no loose squares; hand dark fill + red rim;
  crumble must lose part of the hand) → sent to World [47373e]. Rivet C CLOSED, Rivet B FINAL → Exec [53e69b] to push a #659 head
  that ships B and takes out the C socket (no force-push); World retitles the SHIPPED entry. #672 bf9bbb14 → #673 8cdf952b READY reconfirmed to
  Deploy [803b37] (#673 check 34 was running). Live was 91d9f749 at 11:46Z → verify each new sha, then send the sha line to Strategy.
  DWARF C = NO (Strategy): Pitborn gets ONE pass with a new concept (a hammer-blow WOUND on flesh, dark red/purple mottled, skin broken at the rim,
  the octagon only in the outline) or the Dwarf ships OFF for beta. #663 → trunk Dwarf OFF, framework PR proceeds (World told). WOUND PASS IN: evidence/dwarf-wound edcfda78, code pitborn/dwarf-wound 31f835a2; Strategy YES (C slot) → Pitborn fast-forwards #667 to 31f835a2; World adds the Dwarf wound to SHIPPED. Coach mode = PR #640 docs/briefs/coach-mode.md, POST-BETA (no build now).
  #672 merged dc0c04fd, #673 merged c90bd83b; deploy run on c90bd83b started 11:55Z → verify live + sha line to Strategy.
  Bot lane dark at the 12:50Z chase → reassign the limited-observation run to the lane that runs the fight harness (Strategy pre-approved).
  READABILITY BRIEF (Strategy 12:0xZ): the Incoming-strike line is DEFAULT-ON (hud.ts:40, no gate) → Web's HUD PR removes it and
  adds the guard-broken line + a charge/break/line strip at 375 vs the Witch (evidence/web-hud). Coach brief: not on trunk; asked Strategy for the path.
  Bot stack #615→#632→#668 = player-bot lane (Codex, ~/Developer/frankendom-player-bot, no Claude session): BOT 1+2 posted as #668
  comment 5813526564. DARK at 12:55Z → REASSIGNED to Pitborn (pitborn/bot-limited-obs, PR base codex/01a0ceea/task-3); noted on #668. Pitborn PR #680 5364fc08: Lead flagged that it reads data-threat + the event 'kind' = hidden state → fix; the pre-fix batch is labelled not-the-gate; re-run on the fixed head. #659 e4bcd08c on trunk, 9/9 green, Lead-verified (default off) → READY sent to Deploy for the run after c90bd83b.
  LIVE c90bd83b (#672+#673) Lead-verified ~12:06Z, sha line sent. The served glbs are optimized at build (vite optimizeGlb), so no byte parity with the source.
  #663 LIVE d45f4837 (Lead-verified, sha line sent). #659 CONFLICTS in the scene.ts imports vs #663 → Exec merges trunk in → re-READY. World retargets #677 to trunk. Lanes use MERGE-trunk-IN (no rebase/force) at the "#677 on trunk" step. #667 = 31f835a2 green. Then #677 a2d4bd48 (SHIPPED + ship mode + bloodMode; 1 local fail to
  isolate) → retarget the effect PRs to trunk + `blood: true` on the blood ones BEFORE merge (blood: #658 #660 #662 Weapons, #661 #667 Pitborn; no flag: #657 #665 Exec, #659; lanes pre-briefed, they act on my "#677 on trunk") → one run.
  #676: Strategy wants the idle fallback line BLANK (relayed). Damage number STAYS (Strategy withdrew removal 2). #676 → 78d3f2b8 (idle line blank, done). Cue-lines RULED (the line reports what happened or what state you're in, never what to do or when; "Parry window open" goes too; the guard-broken line cut to "...breaks guard." IN #676) → a Web strings-only PR after #676; receipt = tests + one 375 still. #676 merges on: blank
  idle line + 3 gates + quality:ci green + re-taken threat still; the Witch strip follows.
  12:4xZ RULED: Witch #669 YES (CONFLICTING vs trunk → World merges trunk in + adds the SHIPPED entry); charge pose B → Exec builds on the Witch (3-frame strip), then roster sheet.
  #677 LIVE 5f32ad45 (Lead-verified, sha sent) → players get the SHIPPED effects (Knight B now). "#677 on trunk" SENT: Weapons #658/#660/#662 +blood; Pitborn #661/#667 +blood (+ the Dwarf C SHIPPED entry in #667); Exec retargets #657/#665. #669 21c51cab READY once green. #681 838907f3 READY on green (sent).
  LIVE 2c3dd94a (#676+#659) Lead-verified ~13:1xZ, sha sent. COMBINED OK sent (trunk+677+669: tsc 0, 29/29) → #677 READY.
  12:57Z MERGED #676→61a87175, #659→2c3dd94a; deploying 2c3dd94a (watcher on). #677 695ab0b2 GREEN; Deploy HOLDS for my "COMBINED OK" (tsc + signature/input/combat on trunk+677+669 after the lock frees; merge-tree is conflict-free). #669 → 21c51cab (CI running). World: merge trunk into #669 now. Web: strings follow-up = #681 (47522be9); Lead ruled the 4 leftover imperatives trimmed + "Follow-through" kept; still + quality:ci after the lock.
  READY queue (sent, old): #676 fa4a3d38 → #659 4891e4ce → #677 695ab0b2 (+Witch SHIPPED) each on green. #669 6d4f4851 CONFLICTS with #659 (scene.ts imports; keep both) → World merges trunk in again after #659 lands → re-READY. Merge-tree receipt: trunk+659+677 tsc 0; +669 resolved tsc 0, sig tests 20/20.
  12:3xZ → Strategy: Witch AGAIN #669 72131bee (evidence/witch-again) Lead YES; charge-pose mockups evidence/charge-pose-witch 2ebf6029, Lead recommends B (lean-out).
  #659 → 4891e4ce (merged trunk in) re-READY on green; #676 fa4a3d38 READY on green (order #676 → #659). #677 → 7675e3ce, CI running → READY then "#677 on trunk".
  #676 fa4a3d38 gates+quality:ci green locally, READY to Deploy on green PR CI. Witch wind-up DOES NOT READ (occluded by the player at 375) → RULED: Executioner does 3 charge-pose mockups (Witch first, roster-wide) AFTER #659; Weapons does an opponent-only charge cue (test-pinned). Both dispatched.
  HUD #676 85c934b7 (web/fight-hud), stills on evidence/web-hud c665ce2b → Lead YES → Strategy. Owed by Web: Witch strip + 3 browser gates + quality:ci after the lock.
  ALL OWED DELIVERED: arena still evidence/world-arena-select 70e254bd (Lead YES, sent).
  (old) OWED to Strategy on evidence branches: Dwarf C DONE (evidence/owed-strategy-0924 b406ea29); World arena-select still + Web HUD
  still asked for; Web HUD: building off trunk, ETA ~13:20Z → evidence/web-hud. Lanes with duplicate names: send to "Name [ref]" (local refs: World 47373e, Exec 53e69b, Deploy 803b37, Web ced568).
- ===== START HERE (14:0x local = 10:0xZ; supersedes the block below) =====
  10:4xZ: STRATEGY KILLED the 3 CodeGraph indexers (99316/92177/85153) on its own call while Lead was waiting for Dom's answer; Lead
  confirmed all 3 are gone (load 216 → 120 falling; codegraph serve daemons still up). Reported to Dom. Strategy's new rule "operational
  decisions → Strategy, never Dom" is ALSO relayed/unconfirmed.
  CONFIRMED by Dom IN the Lead session (~11:15Z): "they have my blanket 100% approval to direct and lead. they are the ceo". Strategy = CEO.
  Every owner question (receipts, taste, operational calls) goes to STRATEGY, never to Dom.
  MODE 14:30 local (Dom via Strategy): "I don't want to check or get involved. I want you to be it." STRATEGY = OWNER PROXY. Nothing to Dom
  for approval (no strips/stills/shas). Receipts → Strategy with a one-line Lead verdict → it rules the same hour → Lead merges on yes (Lead
  still owns CI/tests/perf/safety readiness). Dom only for money/brand/sim-in-freeze/SCOPE. Rulings: docs/state/strategy.md.
  Strategy wants first: arena-fix still, Witch strip, Blade Bite D, Dwarf C, HUD still, pack still.
  DOM (to Web, 09-24 ~13:50): "decision making authority, both lead dev and strategy dev". Strategy ruled 13:58 (ship list etc.).
  LIVE 0e4ba5ae (#653 guard + #654 five arenas + #655 framework), Lead-verified 10:18Z (release.json, supabase.co in index-BtmW1ECY.js,
  signature-select present); sha line sent to Strategy. Deploy: guard line "Built bundle carries the Supabase origin…" in the log;
  rule (a') EXERCISED for the first time: 6/36 trusted same-tree (rows 1,3,4,6,8,13), 27 other-tree run locally, 3 no-receipt.
  LIVE 6830afcf (Lead-verified 10:38Z; sha line sent) = #651 (→ba6994bf) + #656 (→4e8779c3) + #664 (→6830afcf). Executioner told to
  rebuild knight.glb (own PR; renders wait for World's Witch/arena captures). NEXT RUN READY sent 10:4xZ: #670 0f9ee36f → #671 1394d1ef (reviewed; both touch main.ts; conflict → World rebases). Verify + sha line.
  Deploy trust on 6830afcf: 8/36 same-tree. NOTE: #651 rebuilt only the PLAYER maul.glb (unused at runtime until equip wiring); the live
  Knight still shows the grey square until Executioner's knight.glb rebuild PR ships. Exec 10:4xZ: #665 C = shavings @ 908328a5 (strip waits
  for the render all-clear); Rivet C is a local commit on #659 (pushes when FREE); then the knight.glb PR.
  LIVE 13e603f0 = #670 (Lead-verified: release.json, supabase.co in index-DnBovw85.js, draw/knight.webp 200; sha line + the maul correction
  sent to Strategy). Trust: 0/36 on this run.
  10:5xZ: lock FREE, load 26 → RENDER PAUSE LIFTED (World first: Witch strip + arena still; then Exec: Knight before/after, Blade Bite C,
  Rivet C f0ca52e4 on the rebuilt Knight). #672 stills Lead-viewed (evidence a2e46c0a knight-maul-before-after.png): the pale cube at his
  chest → dark textured stone; nothing else changed. PACK #673 03b1cc23 (Weapons): still OK, sent to Strategy; Weapons is adding the take-flow
  fix (the head will move) → READY on green CI. STRATEGY 15:05 local: #673 YES (re-verify the moved head, then READY) and #672 YES.
  Strategy CLEARED at ~15:50 local: Witch #669 + Rivet C v2 are logged UNRULED at the top of docs/state/strategy.md; the new Strategy
  session rules them first. Until then the Witch HOLDS, and Rivet B ships as ruled.
  WITCH #669 d67bca77 receipt IN (Grasp reads; the sparks look like square confetti) + Rivet C v2 dffcee02 (thin pale arc) → sent to Strategy.
  World next: arena still (#671), then SHIPPED (+veteran C) + bloodMode. OLD: WITCH #669: NOT ready. With the harness clock, the staff sparks show but the Grasp claw does NOT render even though the probe says it's visible
  (World debugging, then a fix commit). World admitted one render overlapped deploy 13e603f (the lock was taken mid-render; a lease is needed to
  prevent it). bloodMode + SHIPPED is committed locally at World, tests pending the lock. LIVE 91d9f749 = #671 only (Lead-verified: release.json + supabase.co in
  index-Tt6rrvS5.js; sha line sent). NEXT: #672 bf9bbb14 → #673 8cdf952b (head re-verified; READY sent), each on green →
  verify + sha. Sent to Strategy: Blade Bite C shavings #665 48d9e350 (Lead YES-grade), Rivet C #659 f0ca52e4 (socket doesn't read: size/surround = Strategy's call). READY to Deploy: #671 1394d1ef, then #672 bf9bbb14 (knight.glb rebuild), each on green. #671 1394d1ef merges on green in the run after (Deploy holds the READY). Then: World's framework PR (bloodMode + SHIPPED) + #663 → the lanes rebase the six effect PRs → one run. #670 0f9ee36f rides the NEXT run
  (4 checks were pending). World: #671 arena-select fix (off trunk, add to the next run with #670), #663 retargeted to trunk + MERGEABLE,
  framework PR next. Witch strip + arena still NOT captured: load 216 at 10:3xZ, top = 3 CodeGraph indexers (pids 99316/92177/85153,
  2h+, ~400% CPU); asked Dom whether to stop them. For this run: verify release.json + supabase.co, sha line; then tell Executioner to rebuild
  knight.glb (build-creatures knight) after #651 is live, and re-strip Rivet C. Also lift the render pause once World's Witch strip lands. Web handed off at ~306k: a fresh Web session does the HUD from web.md on #645
  (answer given: remove BOTH the red styling AND the "Incoming strike…" text; keep the white event line).
  NEXT RUN (READY sent to Deploy): #651 1100bb35 → #656 8028f11a → #664 50b44331 → #670 0f9ee36f (CI was pending; don't hold the other three for it).
  EFFECTS SHIP LIST: nightborn B #658, executioner A #657, pitborn A #661, plague B #662, goblin C #660, knight B #659, VETERAN C #665 48d9e350
  (shavings; Strategy YES 15:40 local; World told to add it to SHIPPED). Rivet C next pass = a pale bare-metal ring ≤1.5x the rivet (Exec re-strips). Path: World retargets #663
  (site/gate, Dwarf OFF) → a World framework PR (bloodMode + SHIPPED default-on map) → lanes rebase onto trunk → one run. Strategy calls the Veteran D,
  Dwarf C and Witch (#669) strips. Veteran D replaces C in Exec's file. Shieldmaiden #666 waits for the shield.
  ALLOCATED: World = arena-select bug (persist + reload) FIRST, then #663, then framework. Web = HUD (permanent rank + name, event line under it,
  remove the red banner; one still; after #664). Weapons = Profile PACK row (2 open + 3 locked; Store → pack). Renders paused for the Witch strip:
  lift the pause after World's strip lands (tell Exec/Pitborn/Weapons).
- ===== OLDER: START HERE (11:55 Mac clock, Lead handoff at ~746k context) =====
  LIVE 4099f5c0 (#648 arena selector; Lead-verified 07:49Z: release.json + supabase.co in index-ZrC0Oxsk.js; sha line sent to Strategy).
  QUEUE (Deploy merges on the Lead's READY; re-check the head + green CI each time):
   1. READY sent ~08:05Z, ONE run, on green CI: #653 588f7447 (guard: deploy.sh step check-built-account.mjs; Lead-verified 2/2 +
      a mutation that turns it red + a pass on the deploy dist) → #654 f42e64fe (Strategy: five arenas on the ladder, Dom 11:50) → #655 367e4dd3
      (World signature framework, sim-clean, Off by default). Successor: release.json + the guard's line in the log + supabase.co → sha line to Strategy.
      Old-root audit: done (docs/state/deploy.md). Trust on 4099f5c0: 0/36 trusted (28 no-receipt because CI wasn't done yet), so (a') is still unexercised.
      #653 MERGED 64787c22; #654/#655 wait on CI at those heads, then one deploy.
   2. SIGNATURE SPRINT, Dom deadline 13:05 local (09:05Z), dispatched ~08:10Z, all stacked on #655 367e4dd3, one PR per effect, receipt =
      3-frame strip at 375x812 + perf line + head → Lead → Strategy. World: Dwarf, Witch (at risk; slip call by 08:40Z) + the ?signature= gate + the additive
      API (marks.body 6th `site` param, marks.where()) in the DWARF PR (base world/signature-effects; send its branch to Pitborn/Weapons).
      Executioner: Reaping Scar, Knight Rivet Burst. Pitborn: Butcher's Wake, Shieldmaiden, Veteran Battle Scars. Weapons: Nightborn, Goblin, Plague Doctor.
      At risk (told Strategy): Battle Scars, Rot Bloom, and strips while a deploy holds the lock. Player-victim marks: not on the chest front (it faces away from the camera).
      Dwarf branch world/signature-dwarf-stamp @ ef7e9f86 (site param, marks.where, ?signature= gated, off-bone ray reject) → sent to Pitborn/Weapons/Exec.
      Executioner 08:2xZ: Reaping Scar rendered (heavy_overhead miss, seed 16), PR ~08:35Z; Rivet Burst ~08:50Z; stays on 367e4dd3.
      Weapons #658 Nightborn Blood Recall @ 7ae8b209 → Strategy → Dom 12:30 local (beads read as "berries"; variant B = darker elongated drops, queued after Plague Doctor).
      08:2xZ receipts → Strategy: #657 Reaping Scar 3abdcd98 (GOOD), #659 Rivet Burst e261eec6 (INVISIBLE at phone → Executioner enlarging + re-strip; hold from Dom),
      #660 Goblin Hooked Wound 68293b34 (strand shows across the PLAYER's back: Dom's call). Strips for #657/#659: branch evidence/signature-executioner @ 4d5df6af.
      #657/#659 have no tests (asked as a follow-up). Veteran Battle Scars → EXECUTIONER (Pitborn can't make it), ETA 08:50Z.
      Pitborn: Butcher's Wake (on ef7e9f86) re-aiming, PR ~08:35Z, then Shieldmaiden.
      08:30Z ALL → Strategy: #658 A+B (926ca29e), #659 v2 1eac61cf (reads; the dent looks like a glyph), #661 Butcher's Wake e1169159, #662 Plague cbf41d36,
      #663 Dwarf dc2d6368 (WEAK: tiny, sticker-like). RULINGS: Veteran → Blade Bite on Parried (brief B) on #665; Shieldmaiden #666 = shield-slot only,
      nothing without a shield (rejected the gladius-splinter fallback), waits for #606. Out: Witch (World), Veteran B, Goblin B (Weapons, depth-tested).
      World after Witch: bloodMode in SignatureFrame (blood-off). Web #664 rank strip 50b44331: still to Dom + a "rank row at START?" question.
      #654/#655 still have CI pending at 08:30Z (Deploy merges on green).
      CLOCK: Mac local = UTC+4 (the deadline 13:05 = 09:05Z). At 08:35Z, Strategy's stamps were ~30 min ahead; corrected. Witch branch world/signature-witch-grasp fccf0bc6 (no PR).
      08:36Z PREP variants (Strategy's AGAINs, not Dom's orders; A untouched): Exec → Rivet B + Blade Bite C; Weapons → Rot Bloom B + Goblin C;
      Pitborn → Dwarf B on pitborn/dwarf-stamp-b → PR into world/signature-dwarf-stamp.
      08:4xZ in: Rot Bloom B #662 46dd289a (reads at frame 3), Dwarf B #667 89c502ae (Pitborn; findable, censor-block look), Goblin C #660 60cdc80b
      (strand reads, drops are "berries" again). Witch: World ETA 08:55Z, not slipping.
      Exec: Rivet B #659 a368b6bb (rivets read, no dent; the pre-#651 maul square dominates), Blade Bite C #665 4c75dc88 (reads as "C"/horseshoe rings).
      08:55Z: WITCH = PR #669 5e307519 (code + tests; strip pending, load 47–106 made the capture time out) → other lanes' renders PAUSED
      until the Witch strip lands (tell Exec/Pitborn/Weapons to resume after). Goblin C2 #660 8ea3a5fe = reads (dark strand + streak drops).
      Dwarf C #667 402d5cb8 = a flat black octagon (again). Exec next: Blade Bite D (shavings), Rivet C (dent; re-strip after #651 merges).
      Earlier: 9/10 PRs (#657 #658 #659 #660 #661 #662 #663 #665 #666); Witch has NO PR (World chased). DOM HAS RULED ON NONE (Strategy relays each yes/no/again).
      Strategy's AGAINs recommended: Rivet (dark dent), Rot Bloom (bigger/darker; I was wrong, I judged from a crop), Dwarf. YES recommended: Nightborn B, Butcher's Wake.
      Goblin B 28b09b5f (a thin red line, often hidden); Veteran Blade Bite d68d5c37 (WEAK: cream squiggles). Web building Arena Draw A (five arenas).
      AFTER the sprint → World: a pale translucent band (also Scar frame 1 by the feet, Goblin frame 1 arc: likely an existing swing trail) beside the player's sword, frame 1 (+112 ms) of weapons scratchpad nightborn/strip.png.
      Guess (unverified): an arena.ts light-beam plane (:160/:181) at a grazing angle. Not the Knight grey quad (that was the maul head, #651).
   3. Web #656 dead-link convert (8028f11a): code reviewed OK; still sent to Dom (awaiting yes) → READY on green CI. Maul #651 stills also with Dom.
   3. #651 Weapons maul head (1100bb35): darker + textured + rounded stone. VISUAL → Dom's yes first (Weapons sent stills to Dom's session;
      the Lead has NOT eyed them). After it merges, Executioner rebuilds knight.glb (build-creatures knight) → before/after → Dom.
   4. Web: dead-link page (a replay on an unreadable version → kill still + name + PLAY NOW) → the rank-strip defect (#612 renderRank missing at
      start/end with ?arena) → Arena Draw A (iron board) build.
   5. SIGNATURE EFFECTS (Dom 11:50; brief docs/briefs/signature-effects.md on origin/strategy/state-1235 fcd29abe). Allocation sent to Strategy:
      World = framework (registry on existing duel events, capped fight-only marks, no sim) + admin "Signature" preview beside Arena, then Dwarf
      Hammer Stamp, then Witch staff sparks during charge + a short-range Grasp on her landed charged blow (NO projectile); Executioner = Reaping
      Scar, then Knight Rivet Burst; Veteran = Nightborn Blood Recall, then Veteran Battle Scars; Pitborn = Butcher's Wake + Shieldmaiden
      Splintered Defiance; World = Goblin Hooked Wound + Plague Doctor Rot Bloom unless those lanes return. World ETA (sent to Strategy): framework + API ~11:00Z, Dwarf Hammer Stamp ~13:00Z, then Witch.
      Receipt per effect: a 2 s clip / 3-frame strip at 375x812 + a perf line → Strategy → Dom yes/no/again.
  Rules in force: SIM FREEZE (RECORD_VERSION ≤ weekly, Monday window); 3 mockups before any new visual build; every visual passes Dom;
  message lanes by ListAgents name (the local_ ids hit the app cap after ~10 sends); verify every relayed head/claim yourself.
  Known gaps: the player's equip loader isn't wired (match.ts:41: the player stays on the longsword) = Phase M; Shieldmaiden face-seam geometry;
  the Combat coach-policies brief is UNSENT (Combat down); the charge tell stays (Dom).
- #648 amended to Options → Next fight, head 82b988e4 (4 files, MERGEABLE, CI 1 pass/6 pending) → re-READY sent to Deploy on green CI. Strategy closed the incident
  on its own check and pinged Dom to sign in. Remaining: Deploy guard PR, Web dead-link page → rank-strip defect → Arena Draw A, Weapons maul head → Executioner Knight rebuild.
- INCIDENT FIXED 11:1x: LIVE c0400c1f (#649 hotfix + the Supabase env); the Lead verified the served bundle index-B_hyiYHp.js contains supabase.co. Sent to
  Strategy (it pings Dom). Still owed by Deploy: the guard PR (a FAILING release row for a guest-only prod build + a grep of the BUILT bundle for the host, both
  cases tested), the old-root file audit (names only) in the deploy lane state, and confirming #649 CI went green after the merge.
- 11:3x DOM RULED: the charge tell stays AS IS (Weapons stood down; the maul head is Weapons' task). #648 arena selector MOVES to Options → Next fight
  (beside Opponent, .menu-select, admin/?debug-gated, the row hides for players) → World amends the SAME PR; Deploy told to HOLD ce21808e; re-READY at the new head.
- 11:0x: INCIDENT rebuild did NOT publish (deploy.sh:79 bash 3.2 empty link_args under set -u) → hotfix #649 (Deploy merging without CI; Lead: no STOP;
  verify #649 CI green afterwards) → redeploy of the new trunk with the env → curl + grep the bundle for supabase.co (the watcher b070wx9p0 is doing that).
  Witch "spell sound" = the HEAVY-CHARGE TELL for all fighters (Weapons; cues.ts Charged, duel.ts:201, build-audio.mjs:345) → Dom picks a/b/c/d via Strategy
  (Lead recommends re-voice (b) + a Witch spell as her signature (d)); Weapons holds. Grey rectangle = the MAUL HEAD (build-weapon.mjs:712 WeatheredStone,
  untextured) → Weapons fixes the material + bevel, Executioner rebuilds knight.glb, before/after (Knight + player maul) → Dom.
- 10:5x DOM LIVE DEFECTS (routed): (1) rank strip missing at fight start/end (?arena=b vs the Knight) → WEB after the dead-link page, before Arena Draw;
  (2) the Witch spell sound plays on other opponents/the player → WEAPONS (Audio down); (3) the Knight opponent holds a flat grey rectangle at chest (shield
  material?) → EXECUTIONER. Signature effect per opponent (10): Strategy proposes the list to Dom first; COSMETIC only, inside the sim freeze; no build yet.
  Incident redeploy of 9394e8a4 with the Supabase env is running (watcher greps the bundle for supabase.co).
- INCIDENT (10:4x): production is GUEST-ONLY (live bundle has 0 "supabase") since the 09-22 rehome: frankendom-deploy/.env.production.local lacks
  VITE_SUPABASE_URL/PUBLISHABLE_KEY (the old root ~/Desktop/Business/frankendom has them). Deploy asked to: copy the keys, check-account-config → "present",
  rebuild + redeploy trunk, grep the bundle, then a PR that makes the check FAIL prod builds without them. Ahead of #648 (the admin arena selector, READY on green CI).
- 10:3x: Dom asked for an admin ARENA SELECTOR (a journal test-tools <select> beside Finisher: Ladder/1/A/B/C/D, admin-gated like showTools/?debug,
  wired to the main.ts:592 ?arena path, next fight, localStorage) → routed to WORLD, parallel to Web (dead-link page first there). Receipt: a phone still + "loads".
- TOP (10:00 Mac clock): LIVE 9394e8a4 = #647 (a') CI trust (Lead-verified; sha line sent; Lead ran the mutation check: inert()=true fails 1/8).
  The new trust path is NOT exercised yet: check Deploy's per-row reason line on the next code-PR deploy. Open: Web dead-link convert → Arena Draw A;
  Combat coach-policies brief UNSENT (session down); Shieldmaiden face-seam geometry = its own item; Dom's arena pick after he plays ?arena=a..d.
- TOP (09:40 Mac clock): LIVE 2a41ed4e (Lead-verified; sha line + Dom arena links sent to Strategy) = #643 Knight + #646 Shieldmaiden kilt + #624 Arenas (pid 40929; RECORD_VERSION still 9)
  → successor: curl release.json, then a sha line to Strategy, and tell Strategy the Dom arena links now work:
  https://frankendom.com/?arena=a|b|c|d (&perf=1). Rows 23/27 RULED (a') [supersedes (a), which collapsed into unconditional trust because release_triggers is a curated subset]: trust a PR-head receipt only when the merge's other side changed ONLY docs/**, *.md or non-fixture tests/; else run locally. (Old wording: when the merge's other side
  touches none of the row's release_triggers; else run locally) → Deploy writes it with tests after this run. The Web lane is restarting
  (context); a fresh Web session does the dead-link convert first, then Arena Draw A.
- TOP (09:30 Mac clock): LIVE cff5dec6 (#644 cutouts; Lead-verified, the witch cutout returns 200). DOM SAID YES TO ALL (via Strategy):
  READY sent to Deploy for ONE run: #643 Knight 0726db15 → #646 Shieldmaiden 07ad5c8c → #624 Arenas f2a7db10 (A Night Pit = Arena 2,
  B Rain Yard = Arena 3, provisional). Successor: verify live, then a sha line. Rows 23/27 → CI-trusted-by-tree (Deploy, a small PR).
  Web: dead-link convert FIRST (a replay on an unreadable version → kill still + name + PLAY NOW), then the Arena Draw BUILD = A iron board
  (Strategy's pick), then share-button mockups. World: asked for the cheapest ?arena=a|b|c|d override for Dom's phone; the ?perf=1
  reading is owed after he plays. NEW RULE (memory): SIM FREEZE, RECORD_VERSION ≤ once a week (Monday window).
- TOP (08:45 Mac clock): WITH DOM via Strategy, each READY on his yes: Knight #643 0726db15 (the helm fixed; comparison comment
  5807801460; caveat: scalp shows above the open great-helm crown) and Shieldmaiden kilt #646 07ad5c8c (Lead-eyed the hem, clean; face
  cracks not fixed = a separate item). Also still with Dom: #642 Arena Draw pick, #624 arena option, rows 23/27. #644 cutouts: Deploy
  publishes when CI is green. Don't merge the stale origin/pitborn/shieldmaiden-polish.
- NEWEST (08:30 Mac clock): LIVE 88229760 = #639 OG tags (Lead-verified: release.json + og:title/description/image/type on the index; sha line sent). Previously
  a sha line to Strategy. #644 (5 cutouts + scripts/opponent-portraits.mjs, 5d131a78; Lead eyed the Knight cutout, clean) goes in the
  next run once CI is all green. Knight #643 (440ddc92, replaces #603): Body/Arms/Greaves PASS (Lead-judged on the Executioner sheet);
  the great HELM FAILS (sits ~10 cm in front of the face in 3/4 + stride; 43 cm deep vs a 27 cm head) → Executioner scales it, then a new
  head → Lead re-judges → a labelled pair on #643 (#603 dark iron vs #643 steel shells, same pose + the fixed helm 3/4) → Strategy →
  Dom yes (or "match the dark iron") → only then READY (Strategy ruling). The SIM_DIGEST re-pin at v9 without a bump is accepted on --strict replay digestMatch (Combat to check
  when back). #624 round 2 (f2a7db10) + #642 Arena Draw mockups: with Dom via Strategy. Dom's open items (per Strategy): #642 pick,
  rows 23/27, arena option, Dwarf shells eye.
- HANDOFF 08:00 (Mac clock): LIVE 0b648a44 = #635 parks v9 (RECORD_VERSION 9), Lead-verified; the sha line was sent to Strategy.
  READY sent to Deploy for #641 (Shieldmaiden versus card, a37fc10d) → the successor verifies it live, then a sha line to Strategy.
  Arena Draw mockups: #642 (draft, do not merge) + ~/Developer/frankendom-web/mockups-arena-draw/ (6 PNGs, ls-verified) → with
  Strategy for Dom. Open lanes: Executioner knight/body-cover (no sha), World arena options A–D (rough A/B, then all four),
  Web portraits (scripts/opponent-portraits.mjs + 5 cutouts), Pitborn shieldmaiden-polish. The Combat coach-policies brief is UNSENT.
  LIVE 82c3b9c1 = #641 Shieldmaiden versus card (Lead-verified: release.json + /versus/shieldmaiden.webp 200; sha line sent to Strategy). Pitborn: shieldmaiden-polish is now KILT-ONLY (the head re-unwrap was dropped: it
  smeared the brows and patched the skin). The face seam cracks are geometry in the TRELLIS head, NOT texture bleed → a separate
  item for the 09:00+ table. Kilt rebake after 82c3b9c frees the lock, then stills, then the PR.
  Today's deploys: da4108ed (Run 4 Dwarf) → e8d8ec00 (non-sim batch) → c92e56df (#626) → 0b648a44 (#635).
- LATEST (07:50 Mac clock): #635 parks v9 is DEPLOYING on trunk 0b648a44 (pid 17203; Deploy re-checked 40 pass incl. check 8) →
  on live: curl, then the sha line to Strategy. Then READY #641 Shieldmaiden versus card (a37fc10d, 1 file public/versus/shieldmaiden.webp,
  Lead-verified MERGEABLE). Arena Draw mockups = draft #642 (63d5d867, DO NOT MERGE; 6 PNGs in the PR; sent to Strategy, who holds them
  for Dom, back ~11:25 by Strategy's clock). Web: copying the PNGs to its folder, then portraits. Executioner knight/body-cover: still
  iterating (breastplate now belt→collar, cuisses dropped; the Helmet cut sits forward of the face, being measured); no sha yet.
  Strategy: Combat, Stats, Multi Chars, Finishers, Audio and Auditer sessions are NOT running → nothing that needs them starts.
- 07:44 (Mac clock) HANDOFF POINT. LIVE c92e56df (#626 Audio, Lead-verified). READY sent to Deploy for #635 parks v9 (197839c7,
  its own sim run; Deploy re-checks check 8 first). The successor verifies it live and sends the sha line to Strategy.
- Web queue (in order): OG tags → arena-draw 3 mockups (A iron board / B stone wheel / C gallows plaques × 2 moments, ~75 min
  after the lock frees, draft PR + ~/Developer/frankendom-web/mockups-arena-draw/) → scripts/opponent-portraits.mjs checked in + 5
  cutouts (dwarf, knight, shieldmaiden, plaguedoctor, witch; 900×1200 transparent webp, same rig style) → build after Dom's pick →
  share buttons (3 mockups first) → coach board (3 mockups first). RULE: every visual feature = 3 labelled mockups before a build.
- Pitborn: /versus/shieldmaiden.webp (the live 404) via `node scripts/versus-cards.mjs --only shieldmaiden` → small PR. The other 9 versus
  cards exist (Lead viewed knight + witch: real renders; dwarf/plaguedoctor are from the same script, not viewed).
- Combat coach-policies brief still UNSENT if Combat stays down (see below).
- ~07:25 by the Mac clock (Strategy stamps run ~1.5 h ahead): LIVE e8d8ec00 = the non-sim batch (#633 #628 #627 #631 #636 #625),
  Lead-verified. #626 Audio (Dom YES) is deploying on c92e56df (pid 88790) → verify with curl, then a sha line to Strategy.
  NEXT RUN: #635 Combat parks v9 (197839c7), its own sim run.
- Knight: Executioner's knight/body-cover (all-`over` built shells) rebased on trunk → sha pending → Lead judges front/back/3-4/stride vs the Goblin.
- #624 Arenas: Dom REJECTED 3B; 2A too thin. World builds 4 labelled options (A Night Pit, B Rain Yard, C High Noon Blood Sand,
  D Sunken Cistern; each differs from Arena 1 on ≥2 of light / floor / weather / setting). Rough A+B ~10:30, all four ~12:30 (World's
  clock) on #624 + ~/Developer/frankendom-world/stills-624/. A must pass the floor-luminance/skin test or be swapped.
- DOM'S FOUR NEW FEATURES (Strategy 09:00; SCOPE.md section by Strategy). Sequencing sent to Strategy + Web:
  WEB, one at a time: OG tags on the replay page (tiny) → arena-draw stills (~09:50) → Dom picks → build → Share fight + Export clip
  (vertical 10–15 s MediaRecorder, reduced-gore toggle, export time/size receipt) → Coach tactics board + Watch (after Combat's policies).
  COMBAT, after #635 is live: 4 coach policies (aggressive/defensive/agile/trickster + one instruction) through the human input path;
  full fight (rank + loot); battery per policy; no sim rule change (a sim input = a window). ⚠ UNSENT: Combat's session was not running
  (stale socket); send it this brief when it's back.
- CLOSED by Strategy: attrition (no retune), thrust (no change: a spacing tool loses to pressers by design).
- 07:45 (supersedes the lines below where they differ): LIVE da4108ed = Run 4 (#637 Dwarf built shells alone; Lead-verified).
  Non-sim batch READY to Deploy in order #633 → #628 → #627 → #631 → #636 → #625 (all re-verified MERGEABLE, 0 failing at 07:08;
  Strategy saw one check pending on #633/#628/#627). Held for Dom: #626 Audio (clip with Dom now), #624 Arenas (World must post
  stills as a PR comment first; asked 07:46). Knight: #603 held (worn Body = bare chest); Executioner is rebuilding knight/body-cover
  as all-`over` built shells on trunk da4108ed; #638 stays open, unmerged. #635 parks v9 = its own sim run after the batch.
  Strategy rulings: attrition CLOSED, no retune; thrust CLOSED, no change (a spacing tool loses to pressers by design; wins
  75–85% vs non-pressers); rows 23/27 = Dom picks (Strategy recommends CI-trusted-by-tree).
- 07:1x: Run 4 = ONE integration phase-r-int-4 (Veteran building: #603 1db7afd5 + #637 18ea2180, one loot.glb rebuild, plus in-arena Dwarf
  front+back and Knight worn-six frames) → Lead READY → Deploy. After it: the non-sim batch (#628 + #633 first, then #625 #626 #627 #631 #636
  #624) and, separately, the sim run #635 Combat parks v9 (197839c7, Lead-verified MERGEABLE, 38 pass / 1 pending (check 8 re-run after
  a runner TLS error); battery 0 over-cap before/after; one-tick tap parks per swing 22.71 → 0.78; record + guard 31/31). Combat's
  thrust measurement starts on the Run 4 LIVE sha. Strategy rulings 07:05: no attrition retune; rows 23/27 = Dom picks (Strategy
  recommends CI-trusted-by-tree).
- VERIFIED by Lead ~01:20 (gh pr view; all MERGEABLE, none draft; live still fa0c27d1). 09:00 run candidates:
  #603 Knight 1db7afd5 (base phase-r; READY-with-caveat, see Open) · #637 Dwarf built shells 18ea2180 (PASS on rig renders; still owes
  one in-arena front+back frame; CI pending at push) · #636 Goblin worn-loot full-set check 42a0ea5d · #625 Finishers 4833b48c (receipt
  posted) · #624 World arenas 2A/3B 315a5abd (out of draft; CI pending; stills in World scratchpad stills/) · #626 Audio 19c91573 ·
  #627 Web 553de134 · #628 Weapons 0c250ce0 · #631 Char Main 9538e6da · #633 Weapons 722d29ef. Re-run `gh pr checks` on each before READY.
  Phase L: Stats is retaking the stills with a 90 s settle (25 s shots caught the player undressed under load: a harness race, one 90 s
  frame came out dressed). The #589 Dwarf/Executioner close-ups are identical at Recruit/Legionary by design (only the Goblin grades on #589).
  Pitborn shieldmaiden-polish: rebake after the face regression, no PR yet.
- PHASE L stills posted ~01:47 (#589 3ef13bc6 comment 5803427863; #606 658c5009 comment 5803429068, images at 3904efb2:p606/). Lead
  looked: the player is dressed in all frames (per Stats, 14/14 by eye). The tier close-ups differ in bytes for all four opponents, but
  the Nightborn Recruit vs Legionary close-ups are visually INDISTINGUISHABLE at phone scale (Stats agrees the contrast is "subtle").
  Verdict: mechanically shippable (no floating, dressed, no page errors), but the player-visible tier effect is ~nil on opponents →
  a TASTE CALL for Dom/Strategy on the 09:00 table: ship as is, or strengthen the contrast first. #606 stays a draft until that call
  (unsent: Stats is waiting for Lead's word to un-draft). Stats' next: #606 build + check-budget, then the attrition battery.
  Stats-reported ~01:47, #606 658c5009: build 0, check-budget PASS (worst Veteran 9,715,923 / 12M; dist 35,393,050 / 40M; loot 2,349,616 / 3.5M).
  The attrition battery is running (1-seed smoke run, then 48 seeds).
- WOUND ATTRITION TABLE DONE (Stats 01:58; UNSENT to Strategy because messaging is paused → send it first thing, or put it on the 09:00
  table). Sim-only, fa0c27d1, 200 seeds × 9 rungs/row, same ai.ts profile both sides. Data: Stats scratchpad wound.json / wound-battery.mjs.
  Headline for Dom ("over-handicapping?"): NO. First-under-25% HP wins 10–14% under all rules: current 10%/12% (easy/mid), A (5/55) 13%/12%,
  B (leg only) 12%/14%, SE ≈0.8 pt; no trend by wound count. Defence/min RISES after wound 3 (mid 2.1 → 5.6–6.1; confounded by fight
  phase). Flat across variants: damage taken 117–126/150, empty swings ~2.8/min, wall ~2%, initiative kept 86–90%. Victory frequencies:
  counterkill 21–33%, last breath 23–36%, untouched 1–3%, reversal 14–23%. Thrust: 0/200 wins vs Pitborn on Easy despite landing
  75–79%; vs Veteran on Easy 70% (A 59%, B 65%). B = the most comebacks for the least thrust cost, but no variant moves any column
  more than a few points. Lead's read: leave the rule; flag thrust-vs-Pitborn 0/200 to Combat.
- LIVE fa0c27d1 (Run 3c), verified by my own curl at 00:17. No deploys until the 09:00 run; it goes on Lead READY + head shas to Deploy (local_ea03a6d4-695b-4422-8595-739be4dbad4b).
- 09:00 run candidates (verify every head with `gh pr view N --json headRefOid,mergeable` before READY):
  - #603 Knight (Executioner, local_7950990d…): pushed 9a182321 (knight.glb + loot.glb + thumbs + metallicFactor .4 for the glint), CONFLICTING vs phase-r → rebasing at FREE, then loot suites, loot-layers, check-budget, 3 stills incl. mid-swing gauntlet. FIRST in the run. Judge the glint on the mid-swing still.
  - Dwarf fix (Veteran, local_e360b41f…): branch char/dwarf-shells off fa0c27d1 (+a810ef04 = af8cbe66's 6 webps). Body/Arms/Greaves rebuilt as BUILT ring-hull shells (not TRELLIS cuts). Gates: front + 3/4 + greaves crop + mid-stride vs the Goblin set, check-budget, PR line naming the style change for Dom.
  - Phase L #589 (3ef13bc6) + #606 (658c5009, draft) (Stats, local_11812a04…): stills goblin/dwarf/executioner × Recruit 0/Legionary 15 (+ Nightborn on #606) pending; split-loot writes no diff; #606 out of draft when its stills are posted.
  - Non-sim, ready/near-ready: #625 Finishers 4833b48c (blood-gate stills owed) · #626 Audio 19c91573 green, 977,703 B < 1.0 MB cap · #627 Web cleanLoot warn 553de134 · #628 Weapons deploy-ceiling order test 0c250ce0 · #631 Char Main per-piece wear() 9538e6da (full suite 528/0) · #633 Weapons release-checks order test 722d29ef (verified 8 pass/0 fail, MERGEABLE) · #624 World arenas 2A+3B (draft, stills owed).
  - Its OWN sim run: Combat combat/parks-first-tick b168b498 (RECORD_VERSION 9; one-tick park keeps charge===1 for the rest of the swing, so parks are over-counted; parker read on 704/855 ticks → 0). Needs battery 0 new over-cap, KNOWN_UNFAIR unchanged, --strict replay.
- Released at 00:18 onto the free box: Executioner, Veteran, Stats (Phase L stills → wound-attrition battery), Web (ONE phone-width pass on live fa0c27d1: all ten opponents + post-fight panel at Veteran IV), Pitborn (Shieldmaiden hem/seam bake 40fba0c7; 'kilt': False must not open a gap), Multi Chars (Witch maps bake 244a5cf9; grade table: only WitchLeather changes), World (#624), Finishers (#625 stills), Combat (parks battery), Goblin (web/worn-loot-full-set 39399076 → PR).
- Stats brief (Strategy, sim-only, NO trunk change): wound attrition (moves.ts:147 {stamina 8, floor 40, legSpeed .85}, duel.ts:313). Comeback by wound count, variants A (5/55) and B (leg only), defence per minute, five columns, four victory-condition frequencies, the thrust vs Pitborn/Veteran. ONE table + paragraph → Lead → Strategy. ETA ~03:00–04:00.
- 09:00 table for Dom (Lead's part): tonight's four deploys with row 23/27 numbers (logs ~/Developer/deploy-*.log) + a proposal (CI-trusted-by-tree vs a load-aware timeout); 10 opponents × six, what's live, what he must look at. Notes are in memory `project_queue_2026-09-24_morning.md`.

## Done today (09-23 → 00:17)
- 3a LIVE 63c56758 (#607 #608 #610 #611), 22:09.
- 3b LIVE e455d850 (#620 Witch own Body+Greaves), 23:19. Try 1 SIGTERMed at 22:37 mid-build (cause unknown), relaunched 22:39.
- 3c LIVE fa0c27d1 (#617 worn-loot test, #612 rank bar, #623 allowlist==roster test, #614 Dwarf), 00:17; 36/36 rows.
- #630 closed as a duplicate of #631.

## Open
- The Dwarf Body/Arms/Greaves on LIVE are REJECTED (greaves shards + spike, Body reads as the tunic, Arms a shard; Helmet/Gloves/Boots pass) → fix PR above.
- Veteran: on live the Dwarf greaves draw only in the journal paperdoll; a fight frame draws only the Helmet. That re-opens "over pieces don't draw on the fight rig" (Strategy closed it NOT REAL on Web's receipt). Check it on live in the morning.
- Repo quality Stop gate: `npm run quality:stop` (~7 min) times out at 420 s on every stop under load and burns CPU during rebuilds. The hook config belongs to Dom/the hooks session; not changed.
- Frankendom-Test-Bot (~/Desktop/Business/Frankendom-Test-Bot) = Dom's own Codex combat bot; hands off.
- Backend/Accounts session was not running overnight; D3 migration 0001 is still HELD.
- UNSENT (~00:40; the app paused Lead→Desktop messaging after 10 sends with no user turn): (a) to Executioner: #603 must NOT change
  Dwarf entries in loot_dwarf.py/loot.json. Its local phase-r merge re-cut the Dwarf's 4 rejected pieces into loot.glb (86 draws,
  11,375,664 B), while Veteran's char/dwarf-shells replaces Body/Arms/Greaves with @build shells. Post check-budget vs the 12 MB cap.
  (b) to Veteran: both PRs touch the loot sources; rebase onto whichever lands first; the 09:00 integration rebuilds loot.glb once.
- #603 Knight READY-with-caveat by Lead (~01:05) at LOCAL 1db7afd5 (merge of phase-r de650b76; not pushed, DNS down; Executioner's
  retry loop pushes it). Receipts per Executioner: loot suites 110/110, loot-layers 63 layers, check-budget PASS (loot 3,051,089 of
  3,500,000 gzip; knight pairing 8,027,619). Lead looked at artifacts/character/knight-603/sheet.png: Maul swings with hands on the haft,
  no gauntlet glint → the opponent PASSES. Worn-six figure (Executioner scratchpad worn/knight6-figure.png): all six draw, but bare
  shoulder skin shows and the Arms edges are jagged at the shoulder → a caveat for Dom, not a hold. Verify the remote sha == 1db7afd5
  before READY to Deploy. Its loot.glb re-cuts the Dwarf's rejected 4 → the 09:00 integration must take Veteran's dwarf-shells for
  the Dwarf entries.
- Dwarf fix char/dwarf-shells = LOCAL 18ea2180 (not pushed, DNS). Per Veteran: loot.glb 8,916,244 B (84 draws), loot + grades 41/41,
  tsc 0, build 0, check-budget PASS (dwarf fight 8,517,817 / 12M; loot 2,351,916 / 3.5M), greaves median 1.2 / max 1.6 cm off the shin.
  Lead looked at Veteran scratchpad pair-front-small.png + pair-stride.png: clean steel greaves, domes on both shoulders, belt + apron read
  as worn armour, on par with the accepted Goblin → PASS on rig renders. BUT d614-crop.png (an arena back view) still shows shards on
  the back: probably the old live layer, unconfirmed → before READY, require one IN-ARENA frame of 18ea2180 (front + back).
  Merge order at 09:00: Knight #603 1db7afd5 and dwarf-shells both touch the loot sources; the Dwarf entries come from dwarf-shells;
  rebuild loot.glb once.
- Web phone pass on live fa0c27d1 (5/10 done before DNS failed; all shots returned fa0c27d1): Veteran (helmet + shield; the right hand
  shows the default sword while sheathed); EXECUTIONER HEAD BARE (no helmet/hood: a defect to check); Nightborn full set; Pitborn
  cap/sash/greaves; Dwarf helmet only (known rejection, NO console warning). Sheathed shots don't show the equipped weapon. Remaining:
  Goblin, Knight, Shieldmaiden, Plague Doctor, Witch + the Veteran IV win/loss panels (resume on DNS). Shots: Web scratchpad phone-pass/shots/.
- Web phone pass COMPLETE ~01:25 on live fa0c27d1 (10 sets + Veteran IV win/loss; shots in Web scratchpad phone-pass/shots/). Defects to
  route in the morning (→ 09:00 table): (1) EXECUTIONER head bare, no helmet/hood (→ Executioner/Character Main). (2) SHIELDMAIDEN: the
  player's back is bare (her Body has no back) (→ Pitborn), and /versus/shieldmaiden.webp is a 404 on live (Lead-verified 404; goblin.webp 200)
  (→ Multi Chars/World: the versus still was never generated). (3) Dwarf helmet only = known, fixed by #637; NO console warning when pieces
  don't draw (→ #631 adds per-piece warn). (4) Knight shows nothing until #603 lands. (5) Win panel: the Knife tile has no thumbnail; the
  card's bottom edge (~y 351 css) cuts across the player's head; the loss screen's Rematch button sits over the fallen player's arm (→ Web).
  (6) Weapon visibility is unchecked (all shots sheathed) → Web takes a drawn-weapon pass. OK: Veteran, Nightborn, Pitborn, Goblin, Plague
  Doctor, Witch full sets; no page errors.
- Pitborn: shieldmaiden-polish first bake regressed the face (TRELLIS head split at seams → 9,167 one-face islands → black chin);
  remove_doubles 0.1 mm before unwrap, rebake running; kilt removal OK. No PR yet.
- DNS DOWN on this Mac ~00:40 (Finishers, Goblin: github.com / frankendom.com "Could not resolve host"). Pending pushes:
  Goblin 42a0ea5d (worn-loot full set, rebased on fa0c27d1, tsc/build/check green, mutation catches a bad Boots piece) → new branch
  web/worn-loot-full-set-r + PR; Finishers #625 receipt (22/22, blood-gate exit 0, 81 stills) → PR comment. Re-check #625 mergeable vs fa0c27d1.

## Gotchas
- Verify every relayed head/claim yourself (gh pr view / merge-base) before repeating it; the stop reviewer flags unverified relays.
- Clock drift: check `date` before stamping times in messages (I stamped 22:57/23:05/00:16 when it was ~22:40/00:05).
- Lock gaps lie: a killed deploy frees the lock briefly and relaunches. Lanes' watchers must wait 60–180 s of continuous FREE; Stats' first watchdog was a no-op, and SIGTERM missed headless Chrome children (needed kill -9 by pid).
- Session sockets go stale when lanes restart; use `local_…` session ids (list_sessions) with SendMessage, which reaches stopped sessions too.
- One task per lane: I double-assigned wear() (Web + Character Main) → #630/#631 duplicate.
- loot.glb is generated + cumulative: resolve by rebuild, never hand-merge.
- Rows 23 (blood gate) and 27 (veteran-polish) time out first try at 900 s under load; the solo retry passes (3b: 562 s / 139 s).
