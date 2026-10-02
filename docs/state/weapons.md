# Weapons — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## 2026-10-02 03:50 (+04) — HANDOFF TO GPT (Dom moved all Frankendom work to GPT; Strategy's four-part form). Facts below are from commands run 03:4x, not memory

**Now (what the next owner picks up): the Witch / Plague Doctor / Knight class specials, preview-only.** Branch `weapons/class-specials` @ **c56fc0ce** (pushed, NO PR), on the specials base `finishers/hades-shadow-claw-fx` @5575424f (`git merge-base --is-ancestor 5575424f trunk` = NOT on trunk yet: a PR of this branch would carry the whole specials stack, so ask Lead/Strategy before opening one). Dom picked all six; pages `?special=wake|stirring|tempo|pulse|drag|swing` (Witch Stone Wake L6 / Stirring L21, Plague Doctor Doctor's Tempo L6 / Taking the Pulse L21, Knight Ground Drag L6 / Held Swing L21). Strategy's DAY verdicts @8fbc9641: PASS Stirring, Pulse, Swing, Wake; FAIL Tempo (prints/puffs a faint smudge at 375, want about Wake's density, smaller) and Drag (a short patch, want a long dark rut along the drag path). Both reworked in c56fc0ce (Tempo: two pairs of prints + a broad puff per beat; Drag: a 0.8 m arc, the rut traces the maul head's path); tsc, `tsc -p tsconfig.tests.json` and 29 tests (class + specials + special-look) pass ON THE VPS at c56fc0ce, NOT run on this Mac. Owed: (1) look at the re-filmed Tempo and Drag DAY strips; (2) look at all six NIGHT Pit strips (dark, never pale; readable on the dark clay; night palette `classLook` exposure > 1.5 is core 0.026/edge 0.07, raise it if invisible, never go pale); (3) report to Lead with one head sha per strip; (4) the sim wiring stays Combat's (#1114); these are presentation only. Rules: 20 % max health, 20 s, unblockable, ~2 s tell, grounded, smaller than the boss specials, nothing pale or glowing (every mark darker than the floor).
**UPDATE 05:5x (+04), read from the strips.** The c56fc0ce job finished (F4DONE). DAY: Tempo now reads (a dense dark puff round the Doctor each beat, close to Wake's density; it is the heaviest of the six, watch it does not look like smoke) and Drag reads (a long dark arc-rut sweeping round the Knight; strong). NIGHT (arena a) @c56fc0ce: the marks rendered OLIVE-OCHRE and lighter than the shadowed floor (darker only on the red-lit clay), so the night palette failed "dark, never pale"; fixed in **ffbc206a** (near-black neutral core 0.007/edge 0.02), NOT yet re-filmed at that head by anyone who looked: VPS job /tmp/cs_f5.sh (log /tmp/cs_f5.log, ends F5DONE, builds dist-cs5) films all six night to `.../<id>/night5/`. The class-specials head is now **ffbc206a** (use it, not c56fc0ce, in the Now paragraph above). Not yet seen: night strips for pulse and swing at either head.
**Done (merged / closed, from `gh pr view`).** #1200 Centurion painted shields MERGED 21a42b50 (contains #1201's fixes; SHIPPING_SHIELDS filled, shields ship ON); #1199 Shieldmaiden shields MERGED 67ab9249; #1271 class-specials docs brief MERGED b728a442 (docs/briefs/specials/class-specials-witch-pd-knight-2026-10-01.md); #1091 hafted Pommel MERGED (95af56cd); #1185 Shieldmaiden carry live (0895d84c); #1201 and #1187 CLOSED (superseded). Live now c107068c (release.json 03:4x); live 4da6b84f already contained #1200 (`merge-base --is-ancestor`). The scratch shield worktree and the six weapons/shield-* branches are deleted.
**Open.** Open PRs from weapons/*: NONE (`gh pr list --state open`). Branches: `weapons/class-specials` c56fc0ce (above, no PR); `weapons/handoff-0929` e5ca8c95 (older copy of this doc; this PR supersedes it, delete it after merge); 88 other stale `weapons/*` remote branches (90 in total) from merged work, none verified individually: clean them up when GPT has time (`git ls-remote --heads origin 'weapons/*'`). VPS job `/tmp/cs_f4.sh` (log `/tmp/cs_f4.log`, runs as frankrows through `capture weapons`, builds `sm-tree/dist-cs4` at c56fc0ce): tempo DAY and drag DAY done (`/opt/frankendom-shadow/work/weapons/sm-tree/artifacts/class-specials/{tempo,drag}/day4/`), NIGHT films (arena `a`) running in order wake, stirring, tempo, pulse, drag, swing (`.../<id>/night4/`), wake night4 exists, stirring started 03:46Z; the job writes `F4DONE` when it ends; it queues behind other lanes' captures (5-25 min per clip). Older passes for reference: stirring/pulse/swing day @17b5e78e (their code is identical in c56fc0ce), wake day3 @8fbc9641. VPS disk: work/weapons is 9.3 GB (sm-tree has dist-cs, dist-cs2, dist-cs3, dist-cs4; rb, rbvenv, shield-out dirs): delete when done. Local worktrees on this Mac named weapons: frankendom-polearms, frankendom-riposte, frankendom-scythe (old branches, not mine to delete blind).
**Gotchas.** (1) The fight camera sits BEHIND the player: any mark on the line between the fighters is foreshortened and hidden under the two bodies; marks must lie in open ground behind the caster or beside the bodies (that is why Tempo and Drag back off first and Wake/Drag snake). (2) The walkers write the caster's anchor ABSOLUTELY every frame (characters.ts zeroes `anchor.position`): the offset is a world vector turned into the actor group's local frame, as special-fx-goblin.ts does; the rig gaits through special-modes `travel` (negative = walking backwards). (3) Keep src/special-fx-class.ts lazy: nothing may import it statically (a test pins it); the gait lives in the three-free src/special-class-timing.ts for that reason. (4) VPS: git, build and node run as `frankrows` (`runuser -u frankrows -- bash x.sh`), root hits dubious-ownership; film with `capture weapons node scripts/special-clip.mjs --dist D --special S [--arena a] --out O --pre 10 --post 100 --every 2 --dpr 2`; strips = ffmpeg hstack of frames 0025 0040 0052 0062 0068 0085 (strike is near frame 65). (5) A deploy hold blocks whole Bash calls on this Mac that run a test suite or a build, and a blocked call applies NONE of its edits: re-check the file before assuming a change landed; run tests on the VPS instead. (6) `send_message` needs the `local_<uuid>` session id (Lead local_1bcdcf54-b8b3-4ee1-9597-f3c06d9e74d9, Strategy local_50f50a99-9831-4024-9533-13d91a1220f3). (7) macOS `sed -i` needs `-i ''`. (8) Memory: `~/.claude/projects/-Users-domininclynch-Developer-frankendom-weapons/memory/frankendom_weapons_class_specials_2026-10-02.md` (and the older shield notes) hold the same facts.

## 2026-10-02 ~03:40 (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_weapons_class_specials_2026-10-02 (older: class_specials_and_shield_ship_2026-10-01)

**Now.** Class specials for the Witch, Plague Doctor and Knight (Dom picked all six on 2026-10-01 via Lead): branch **weapons/class-specials**, head **c56fc0ce** (pushed, NO PR yet), preview-only on the specials base finishers/hades-shadow-claw-fx @5575424f. Pages: `?special=wake|stirring|tempo|pulse|drag|swing` (Witch Stone Wake L6 / Stirring L21, Plague Doctor Doctor's Tempo L6 / Taking the Pulse L21, Knight Ground Drag L6 / Held Swing L21). Files: src/special-fx-class.ts (the six effects, lazy chunk), src/special-class-timing.ts (three-free: gait, walkOffset/walkLateral, BACKS), one entry each in src/special-modes.ts (classFx) and src/special-look.ts SPECIAL_TESTS, tests/special-fx-class.test.ts (17 tests). Rules (Dom/Strategy): 20 % max health, 20 s, unblockable, ~2 s tell, grounded, smaller than the boss specials, nothing pale or glowing: every mark is a decal/grain DARKER than the floor.
**Verdicts (Strategy, day @8fbc9641).** PASS: Stirring, Pulse, Swing, Wake. FAIL: Tempo (prints/puffs a faint smudge at 375: make them about Wake's density, smaller) and Drag (a short patch: needs a long dark rut along the drag path). Fixed in c56fc0ce: Tempo two pairs of prints + a broad puff per beat, left on the sand; Drag walks a 0.8 m arc with the rut tracing the maul head's path (14 samples + banks), back-off 1.2 m first. tsc, tsc -p tsconfig.tests.json and 29 tests (class + specials + special-look) pass ON THE VPS at c56fc0ce; not run on this Mac (deploy hold).
**In flight.** VPS job /tmp/cs_f4.sh (log /tmp/cs_f4.log, runs as frankrows through `capture weapons`): builds dist-cs4 at c56fc0ce, films tempo + drag DAY (artifacts/class-specials/{tempo,drag}/day4) then all six NIGHT (arena a = the Night Pit; .../night4), under /opt/frankendom-shadow/work/weapons/sm-tree. Ends with the line F4DONE. Strips: ffmpeg hstack of frames 0025 0040 0052 0062 0068 0085 (frames are 2 ticks apart; strike at ~frame 65). NOT YET LOOKED AT: day4 tempo/drag, all six night4 clips.
**Owed.** (1) View tempo/drag day4 strips: is Tempo's mark about Wake's density, is Drag's rut long? (2) View the six night4 strips: dark, NEVER pale, readable on the dark clay (night palette in classLook is exposure > 1.5: core 0.026/edge 0.07; may be too dark to see: fix by raising, not by going pale). (3) Send Lead the paths with one line each and ONE head per strip: stirring/pulse/swing day = 17b5e78e (code identical later), wake day3 = 8fbc9641, tempo/drag day4 + all night4 = c56fc0ce. (4) After Strategy PASS and Dom: ask Lead whether to open the PR (it is based on the specials base, not trunk; Lead said one branch, nothing stacked on another special) and wire the sim only after Combat's #1114 (presentation-only until then). #1271 (docs brief, weapons/class-specials-brief) merged-or-not: check `gh pr view 1271`; I re-ran its CI by close+reopen.
**Gotchas.** (1) The camera sits BEHIND the player: any mark on the line between the fighters is foreshortened and hidden under the two bodies. Marks must be in open ground (behind the caster) or beside the bodies, which is why the walkers back off first and Wake/Drag snake. (2) Walkers write the caster anchor ABSOLUTELY every frame (characters.ts zeroes anchor.position): shift = world vector turned into the actor group's local frame, as special-fx-goblin.ts does; the rig gaits via special-modes `travel` (negative = backing). (3) A static import of the fx file from special-modes.ts breaks the lazy-chunk tests: gait lives in special-class-timing.ts for that reason. (4) macOS sed -i needs '' and a hook blocks whole Bash calls during a deploy: a blocked call applies none of its edits, so re-check files before assuming a change landed. (5) VPS: git/build/node as frankrows (runuser -u frankrows), root has dubious-ownership errors; `capture weapons node scripts/special-clip.mjs --dist D --special S [--arena a] --out O --pre 10 --post 100 --every 2 --dpr 2`; the capture queue ran 10+ deep, a clip waits 5-25 min. (6) send_message needs the local_<uuid> session id (Lead = local_1bcdcf54-b8b3-4ee1-9597-f3c06d9e74d9, Strategy = local_50f50a99-9831-4024-9533-13d91a1220f3). (7) Shield stack is DONE: #1199/#1200 merged, #1201/#1187 closed, scratch worktree and weapons/shield-* branches deleted (live 4da6b84f contains it).

## 2026-10-01 ~11:30 (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_weapons_handoff_2026-10-01 and shield_intake_2026-10-01

**Now.** Painted shields (GPT job 5, HF dataset Domlynch/frankendom-shields-20260930; HF freeze: download only, no ZeroGPU/jobs until Dom rules) are three DRAFT PRs, all opt-in (SHIPPING_SHIELDS empty), all Auditer PASS: **#1199** Shieldmaiden (weapons/shield-shieldmaiden @ 68086af9, off trunk 0895d84c; quality run 36820873809 success; includes #1187's fit-check script, so **close #1187 when #1199 merges**), **#1201** enablement prep stacked on #1199 (weapons/shield-enable @ 60481d08: F1 fitted-geometry dispose, F2 no painted board without a kit Shield slot, tests), **#1200** Centurion stacked on #1199 (weapons/shield-centurion @ 2491d284; Centurion added to SHIELD_CARRIERS, real-carry test; Strategy: GPT set REPLACES his live scutum, rank 1 none, 2–3 plain round, 4–7 crafted round, 8–10 tower). READY only via Lead after Dom's look at the stills + green CI. Merge order Lead set: #1199 → #1201 → rebase #1200 on trunk (it does not contain #1201's fix). Nothing is pushed after a PASS without a new Auditer line.
**Done (mine, 2026-10-01).** #1185 Shieldmaiden carry MERGED+live (0895d84c). Intake: six GPT GLBs measured, cut (512 WebP albedo/normal, 256 metal-rough, 127–157 KB gz each; Shieldmaiden rounds Ø 0.60/0.70 baked uniform; Centurion crafted round in plane to Ø 0.70 depth kept; board depth ≤ 0.12 EXCLUDING boss and rear grip, Strategy confirmed; total with boss 0.14–0.165). Pose test on real rigs: lowest posed vertex 0.058 m (Centurion tower) to 0.158 m, every board faces front at ready. check-budget SHIELDS line (per file < 0.9 MB, set < 2.7 MB, outside PER_FIGHT/TOTAL).
**Evidence (for Dom, via Lead).** https://github.com/DomLynch/RPG-game/tree/evidence/shield-art (@ 0719708): row-<carrier>-<tier>.png (shields at the 375 fight camera), side-before-after.png, texture-1024png-vs-512webp-guard.png, centurion-ladder-live-vs-painted.png (levels 6–8, which are rung 2 = plain round), centurion-L18-L38-live-vs-painted.png (rung 4 crafted round, rung 8 tower). WITHDRAWN, do not use: row-veteran-Master/Primus and centurion-live-scutum-vs-painted.png (those used ?tier=, which leaves the ladder level at 1, so the Centurion was on his trident with a shield painted onto a two-hander = the F2 bug).
**Receipts.** Live 0895d84c shows the Centurion's board in a real ladder fight at levels 6/7/8 (dev-kit level via sessionStorage 'frankendom.dev-kit' = {"level":N}), so no live RV19 bug. Fight level → rung: src/career.ts:8 (TITLES), :27 levelOf = 1+wins, :48–53 rankFor, rung index = floor((level−1)/5): rung 4 = levels 16–20, rung 8 = 36–40; main.ts:451 shownTier.
**Open.** Dom's look at the stills (Lead sent him the Shieldmaiden Recruit row, the ladder pair and the L18/L38 pair) decides READY; then CI on #1200/#1201 after retarget (draft CI is skipped on stacked bases); enablement = a PR filling SHIPPING_SHIELDS only on Lead's word; close #1187 after #1199 merges; delete the scratch worktree ~/Developer/frankendom-weapons-shield once all three merge (git worktree remove --force; branches weapons/shield-*).
**Gotchas.** (1) VPS stills: shieldshoot*.mjs / shieldstills.sh in /opt/frankendom-shadow/work/weapons run AS ROOT for playwright (browsers are under /root), git/build as frankrows (runuser -u frankrows); shield files are served from shield-out/ (512) or shield-out1024/ by the shoot script's 6th arg; shieldshoot-level.mjs takes a fight LEVEL (dev-kit) instead of ?tier=. (2) zsh does not word-split $VAR: use an array or inline -i path for ssh/scp. (3) Hooks block test suites/builds on this Mac while a deploy is in flight; retry after release.json shows the revision. (4) intake.py + measure/zprof/side.py live in the session scratchpad (lost on /clear): the cut recipe is in memory shield_intake_2026-10-01; Blender CLI side renders via /Applications/Blender.app/Contents/MacOS/Blender -b -P. (5) A stray self-symlink node_modules/node_modules in the main checkout was removed (harmless).

## 2026-09-30 22:1x (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_weapons_handoff_2026-09-30_eve (older: the 16:16 and 14:1x entries below + l1_loan_2026-09-30)

**Now.** (1) **#1185 Shieldmaiden carry opt-in** (branch weapons/shieldmaiden-carry, head 218d00d4c4cfb1e54e8c3e76f48115a2f85ac518, draft): Auditer PASS on exactly that sha (comment 5916320694), CI quality run 36751463091 was in progress. STILLS DONE and IN THE BODY: before/after (ready, guard, fight, roll at 375; judged: her board is edge-on at ready/roll before, faces the camera after, comes up over the chest on guard) shot on 218d00d4 at `/opt/frankendom-shadow/work/weapons/sm-tree/artifacts/sc-stills/` and hosted on origin/evidence/shieldmaiden-carry @ e2e7d1e0; body = scratchpad scpr2.md. OWED before READY: CI quality run 36751463091 green on 218d00d4 (check `gh run view`; it was in_progress), then un-draft (`gh pr ready 1185`), flip the body's CI line, send Lead the full sha. A push needs a new Auditer line. (2) **#1187 shield intake tooling** (weapons/shield-intake, draft, ddc46265, CI run 36751656031): scripts/shield-fit-check.mjs + tests (7/7); READY when CI green + Auditer review; no runtime change.
**The shield programme (Dom: "the shields in game are poor looking"; Strategy's rulings 2026-09-30).** Shieldmaiden: 3 shields ranks 1–3 round / 4–7 round richer / 8–10 kite. Centurion (veteran): NO rank-1 shield (trident at Recruit); ranks 2–3 round / 4–7 round richer / 8–10 tower. Envelopes: Centurion tower ≤ 0.88 m tall × ≤ 0.60 wide, Shieldmaiden kite ≤ 0.75 × ≤ 0.60, rounds at today's diameters (Centurion 0.57, Shieldmaiden 0.74); a true 1.0–1.2 m scutum needs a carry-direction change, LATER, Strategy asks Dom after seeing the 0.88. Finish painted, no rank tint. Budget (Lead confirmed): one mesh, ≤ 6,000 tris, one 1024² base+MR(+normal) set, ≤ 0.9 MB gzip per file, ≤ 2.7 MB per character set, OUTSIDE PER_FIGHT and TOTAL like the weapon shapes, fetched after the rigs, never gating first playable. GPT delivery: upright (Y up), face +Z, origin = grip, real metres, back face modelled; intake bakes the rig rotation (bind +Y points DOWN in the world in carry/guard poses). The GPT brief goes to Dom via Strategy. WHEN GPT'S FILES ARRIVE (intake PR, mine): public/shields/<carrier>-<band>.glb (veteran-*, shieldmaiden-*), per-rank table + loader in the weapon-shapes.ts pattern (Centurion rank 1 = none), the storage lines in scripts/check-budget.mjs with the comment "Lead 2026-09-30, via Strategy's shield ruling" and the worst-fight total 13,587,778 B (9,985,823 gates first playable, from CI run 36734691852: veteran pairing), a test/row pinning that the shield loads after ready, stills at the fight camera (ready idle, guard up, mid-fight), Auditer review, `node scripts/shield-fit-check.mjs` on every file.
**Done today (mine).** #1181 Knight grey slab fix MERGED (16:28Z): the slab was /weapons/shapes/maul-plain.glb (and maul-ornate.glb), flat-grey "Neutral forged grey" atlases; both deleted, maul shapes = crafted 4–7 only, storage line 3.3 → 1.0 MB; repaint via GPT is post-beta. L1 rank looks: Pitborn #1137 (cc0bddd7, CI green run 36740101360) and Shieldmaiden L1 #1145 (7975df59, run 36740404256) were HANDED TO HERO LOOK (Strategy's brief; I have no unpushed work on them); Witch #1140 is Multi Chars' (bf9323b3, run 36740323722, their PASS re-confirmed). Lead's merge order: #1140, then #1145, #1137 independent; re-merge trunk only after BJ, not during a run.
**Measured (shield sweep, trunk 64d13481; throwaway script, method below).** Today's pieces: Centurion kit buckler 0.568×0.565×0.069 m, 794 tris, raw geometry 38 KB; Shieldmaiden round 0.744×0.744×0.110 m, 1,220 tris, 87 KB; both skinned to hand_l in the hero bind (hand_l bind (0.706, 1.455, −0.065), centre 6 cm up the forearm, face +Z; build-warrior.mjs:1157–1201). Shown: Shieldmaiden at all ten ranks (roster.ts:43, loot.ts:117); Centurion from ladder level 6 = Legionary (moves.ts:683/700), by level met not rank. No rank look carries a shield mesh. Carry clearance on the hero rig (board height scaled about its centre, 7 poses + 5 attacks at 30 fps; floor = lowest vertex, legs = nearest vertex to thigh/calf/foot bone points, ≥ 9 cm ≈ clear): Centurion with the carry: 0.565 floor +6.4 cm leg 14.9; 0.79 floor +2.5 leg 10.5; 0.90 floor +0.6 leg 9.1; 1.02 floor −1.7 leg 4.5 → ceiling ≈ 0.85–0.90 m. Shieldmaiden WITHOUT the carry (as shipped): lowest −9.2 cm in the roll, face sideways at ready; with the carry floor +1.9 cm leg 6.7 → kite ≤ 0.75 m. Method: node 25 type-stripping script importing src/characters.ts (buildWarriors, withShieldCarry, lootPiecesOf, lootWorn) and three's GLTFLoader with images stripped, as tests/shield-carry.test.ts does; rebuild it from that test's fighter() helper.
**Open.** Stills for #1185 (above); #1185/#1187 CI; GPT's shield files (not before Saturday's duel); the Shieldmaiden carry also needs her stills at Recruit only today (other ranks carry the same way). Knowns: the player's own maul at ranks 1–3 and 8–10 returns to the shipped part (#1181); `__weaponShapes` debug hook keeps the old name on a no-file rank.
**Gotchas.** (1) The Mac disk filled (305 MB) from ~1 GB worktrees: remove scratch worktrees once pushed; keep ONE; VPS has 137 GB. (2) `git checkout --theirs file` drops the non-conflicting hunks of that file too: use `git checkout -m` and resolve hunks. macOS `sed -i` needs `-i ''`. (3) A trunk merge into an L1 branch conflicts in SHIPPING_LOOKS, DESKTOP_LOOK_SET/LOOKS lines and the rank-look test's "no other L1" filter every time trunk gains a row: the order of that list follows the SHIPPING_LOOKS key order. (4) Playwright `page.route` misses worker fetches (the game loads glbs in a worker): use `context.route`. (5) `rank-look-check.mjs` needs `--look`. (6) Stop-hook auditor errors "weekly limit, resets Oct 5 11pm Dubai" are the auditor's quota, not findings. (7) deploy_hold blocks test suites, even single files, while a deploy is in flight; `tsc --noEmit` and node --test on one file were allowed otherwise. (8) A lane's socket address goes stale when it restarts: use ListAgents and the "Frankendom - <lane> [ref]" name. (9) Report CI only from `gh run view`; earlier a green run went stale because trunk moved (#1137/#1145 went CONFLICTING again).

## 2026-09-30 16:16 (+04) — HANDOFF before /clear. READ FIRST, then 2026-09-30 14:1x below, then memory frankendom_weapons_handoff_2026-09-30 + l1_loan_2026-09-30

1. LIVE 3fab84c4 (own curl 16:16, release.json). deploy_hold ACTIVE at 16:16 (Deploy holding the Mac) → no local tests/stills on the Mac.
2. Went live today of mine: nothing new. **#1132 Dwarf L1 is MERGED** (d269ccd6), so the Witch + Shieldmaiden merge chain can start.
3. NOT LIVE, all still DRAFT (own `gh pr view`/`gh pr checks` 16:16):
   - **#1137 Pitborn** @ d483e00e, base trunk. CI `quality` PASS run 36691044836. **CONFLICTING with trunk** (3fab84c4) → rebuild/merge
     trunk (scratch apply_l1.py pitborn on trunk, or merge trunk in), re-push, CI again.
   - **#1140 Witch** @ dace566a, base still `armour/dwarf-l1-recruit` (merged) → retarget to trunk (`gh pr edit 1140 --base codex/01a09a76/task-1`),
     check it's mergeable, get its own CI run.
   - **#1145 Shieldmaiden** @ d845d659, base trunk. CI `quality` PASS run 36691359294 (8 pass / 4 skipping). **CONFLICTING with trunk** →
     after #1140 is fixed, merge trunk in, re-push, CI again.
   Likely conflicts: SHIPPING_LOOKS / NOT_WORN / check-budget / rank-look pins vs trunk's Dwarf + Executioner rows (use the union resolver, scratch resolve_ex.py).
4. Sessions down: none known from this lane.
5. Rulings today: all in memory l1_loan_2026-09-30 (phones rebaked one-atlas 1408², pyfqmr banned, per-set DESKTOP cap pitborn 3.3 MB, NOT_WORN pitborn Helmet, SM face roughness = Known).
6. QUEUE, in order: (a) retarget #1140, clear the #1137/#1145 conflicts, CI green per head (report run IDs only). (b) Re-shoot phone rungs +
   close-ups on the 1408 phone files on the VPS (`capture weapons`, l1stills4.sh pattern; batch 4 hit old SM 0d08329b, Pitborn phone rungs rc=2),
   judge phone face vs full. (c) Local rank-look + check-budget when deploy_hold is None. (d) PR bodies (stills, receipts, Knowns), un-draft,
   READY + sha per PR to Lead [387ea1] + Strategy. (e) Auditer "done" → VPS work/weapons deleted. #1091 hafted Pommel still READY @95af56cd (Lead GO).
7. No cron armed. Session worktree .claude/worktrees/priceless-wu-189421 (branch weapons/handoff-0930, pushes to origin/weapons/handoff-0929; no PR).
   Dom: reopen me on ~/Developer/frankendom-weapons with the worktree switch off.

## 2026-09-30 14:1x (+04) — HANDOFF before /clear. READ FIRST, then memory l1_loan_2026-09-30 (full log) + frankendom_weapons_handoff_2026-09-30

LOAN (Lead, Strategy agreed): Weapons integrates the Pitborn, Witch and Shieldmaiden L1 "Recruit" rank looks (template PD #1131, merged).
1. PRs (all DRAFT; AW merge order from Lead: #1132 Dwarf → #1140 → #1145; #1137 any time after #1132):
   - **#1137 Pitborn** @ d483e00e (base trunk for CI; carries #1132's 4 Dwarf commits). Full a9589a8e (HL pack, 3,258,211 gz, DESKTOP_LOOK_SET
     pitborn 3.3 MB, set 24.5 MB). Phone 1d59ccae: meshopt garment cut + maps-only one-atlas rebake at 1408² (5b 20.2 MiB), skins 16→1,
     1,867,120 gz, 57,399 v, skinoff2 0.3 cm PASS. NOT_WORN pitborn ['Helmet'] + test (Lead accepted).
   - **#1140 Witch** @ dace566a (base #1132). Full d540e110 2,673,885 gz, phone 998b038b meshopt ×0.55; witch 22.5 / witch-phone 14.6 MB.
     Local rank-look + check-budget 34/0. Stills DONE (VPS): look on, feet-in-frame PASS, close-up == GPT renders.
   - **#1145 Shieldmaiden** @ d845d659 (base trunk; on the Witch). Full e38b3c30 3,005,014 gz; phone ba732400 one-atlas 1408² (whole Skin
     draw rebaked), skins 15→1, 1,575,565 gz, 52,139 v, skinoff2 0.3 cm PASS. Dom: ship as delivered, face roughness = Known in body.
2. OPEN, in order: (a) CI `quality` on d483e00e and d845d659 (pending at handoff; earlier reds fixed in the FILES: phone skins, SM Skin
   material, 5b); report fixed only with green run IDs. (b) Re-shoot phone rungs + close-ups on the 1408 heads (batch 4 shot SM at the old
   0d08329b; Pitborn phone rungs rc=2): VPS `capture weapons` with l1stills3/4.sh pattern. Judge phone face vs full (Lead gate). (c) Local
   tests when no deploy_hold. (d) PR bodies (stills, receipts, Knowns), un-draft, READY per PR + sha to Lead [387ea1] + Strategy.
   (e) Tell Auditer "done" so the VPS work/weapons trees are deleted.
3. #1091 hafted Pommel: READY for run AS @95af56cd (earlier); warhammer ear = #1112 KNOWN MINOR.
4. Tools: VPS /opt/frankendom-shadow/work/weapons: rb/{pb,sm}-phone.sh (MAXMAP, TRIS env), rb/tools/dedup-skins.py, rbvenv, {wi,sm,pb}-tree,
   l1stills*.sh. pack: /opt/frankendom-shadow/work/herolook/pack/pack-weapons.mjs. Local scratch apply_l1.py rebuilds an L1 on a base.
5. Gotchas: quality.yml only runs for PRs based on trunk, and not while a PR conflicts; rebake-nb's pyfqmr cut is banned (meshopt cut, budgets
   above counts); GPT raw files carry per-draw skins; a test stopping at its first failing file hides the next one's failure.

## 2026-09-29 13:4x (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_weapons_handoff_2026-09-29_1348 (history: frankendom_weapons_handoff_2026-09-29_clear)

1. LIVE (own curl each): ten painted weapon shapes; the PD cane #1078 (bfe1633a); the Witch staff #1084 (046f915f, 3 glbs byte-identical
   to 978d37eb). Live now a92dd39b. Nothing of mine is in a run.
2. IN FLIGHT (three drafts, CI was pending at 13:48):
   - **#1090 gladius Pommel** @ 4f7b1203 (weapons/pommel-gladius): POMMEL_BASH + tests; two CI fails fixed (readWarrior's file union;
     gladius.glb has no images array). Mark READY on green CI; it rides any run.
   - **#1091 trident + warhammer + maul Pommel** @ 240a108a (weapons/pommel-hafted, STACKED on #1090): twoHandFamily `butt()` in
     scripts/build-weapon.mjs, <Family>_Pommel, PLAYER_CLIPS rows, tests. Its new characters tests FAIL until the equip files are rebuilt.
     Owed in Lead's slot (after Auditer WebKit + Audio trace): `node scripts/build-player-weapon.mjs trident|warhammer|maul`, sizes v the
     1.5 MB equip cap, tsc/tests, check-budget, 375 stills (idle + mid-Pommel) → Strategy → READY. The butt keys were authored blind:
     look hard at the stills.
   - **#1092 maul v3 Forge Warden** @ 6b59bfd9 (weapons/maul-v3-crafted): only maul-crafted.glb (−115 KB gzip). Slot DONE: fit PASS (1 WARN
     1.90), tests 965/0, budget maul 2,925,240/3.3M, stills at evidence 6d7ffca0 "maul v3". Waiting on Dom's art call via Strategy → READY.
3. Rulings today: only Lead's "box FREE" opens the Mac (Strategy standing rule; a cleared lock does not). Scythe Pommel is post-beta. The
   reaper length (1.07 v 1.78 m) is Dom's call. The Witch staff's hip crossing is a KNOWN MINOR DEFECT (post-beta grip offset).
4. Tools: stills script .stills/weapons-stills.mjs (copy + ONLY lists in memory scratch/stills-0929); evidence worktree in the OLD scratchpad
   0f1b6ef6-…/scratchpad/ev (branch evidence/weapon-shapes-stills); crop box crop=460:560:140:520 on the 750×1624 png.
5. Worktree session (.claude/worktrees/priceless-wu-189421): Dom to reopen me on ~/Developer/frankendom-weapons with the worktree switch off.

## 2026-09-29 11:5x (+04) — ten painted shapes + PD cane LIVE; Witch staff in run AI; KNOWN MINOR DEFECT logged

1. LIVE (own curl): the eight painted shapes (#1040…#1066); the warhammer #1071 + reaper #1072 (de4b2f7c, 6 glbs 200 and byte-identical
   to head 00c482f9); the Plague Doctor's cane #1078 (bfe1633a, estoc-cane-{plain,crafted,ornate}.glb 200).
2. In flight: **#1084 Witch staff @ 978d37eb**, READY, Strategy ACCEPTED the stills, Lead GO → run AI alone. Receipts in the body: fit-check
   PASS x3 (4 WARNs: ratios 1.83–1.88, ornate width 0.385 inside the 0.42 allowance), npm test 962/0, check-budget PASS witch-staff
   2,451,157 of 2,600,000. Stills: evidence/weapon-shapes-stills @ f1222613, section "witch-staff". Owed after Published: verify live
   (release.json + witch-staff-*.glb 200).
3. **KNOWN MINOR DEFECT (Strategy ruling via Lead, 2026-09-29):** on the Witch's ornate staff, when the staff points down (Origin frames
   f06/f09, crown zoom panels 4 and 7), the antler tines cross her robe at the hip. No rework before beta. Post-beta candidate: a grip-offset
   tweak on the witch-staff override.
4. Open looks for Dom (noted, no action): the reaper reads 1.07 m v the held Wraith's stock 1.78 m (same hit zone); the PD ornate cane
   mantle overlaps the fist outline in 2/8 frames (accepted with #1078).
5. Code: the fit-check test resolves an opponent's own row to its weapon's envelope through SHAPE_OVERRIDES (estoc-cane → estoc,
   witch-staff → trident). check-budget has its own SHAPES lines: estoc-cane 2.3 MB, witch-staff 2.6 MB.

## 2026-09-29 09:4x (+04) — HANDOFF before /clear. READ FIRST, then memory frankendom_weapons_handoff_2026-09-29_clear (history: frankendom_weapons_handoff_2026-09-29_stack)

1. LIVE: nothing new of mine (live 88a85e64). TEN painted weapon-shape PRs, ONE linear stack, merge in this order only:
   #1040 maul 359f55c4 → #1041 longsword 25e52475 → #1042 gladius acf6df08 → #1043 knife 37474606 → #1052 estoc ab165ed0 →
   #1053 cleaver a209c488 → #1065 scythe be1cde06 → #1066 trident daad168a [these 8 READY, Dom said ship all; heads FROZEN; in Deploy's run
   AC, conditional GO] → #1071 warhammer 69b164e7 → #1072 reaper d2dc1aaf [DRAFTS, nothing run yet].
2. Rulings: painted finish, no runtime tint; per-rank table (10 → 3 files); one PR per weapon; SHAPE_FILE 1.45 MB; an opponent's own
   shape is EXCLUSIVE (the PD keeps his stock estoc until the cane; the Witch keeps her stock trident until her staff: SHAPE_OVERRIDES).
   Trunk 88a85e64 went in by MERGE (no rebase) and was merged up the stack; shape blobs unchanged (evidence page stays valid).
3. Evidence for Dom: branch evidence/weapon-shapes-stills @ 9a4dff8c (README, eight weapons, #1041 guard "check for clipping" zoom).
   #912 phone load PASS (−0.24 s). Carrier facts: the trident is effectively the player's (the Centurion has the gladius already at
   Recruit); the Minotaur and Werewolf are held (they fall back to the Veteran); the Knight is the only L10 maul carrier.
4. NEXT, in my slot (after run AC, and after the Witch #1068 if she's first; box rules): #1071/#1072. Scripts are in
   memory scratch/stills-0929 (copy to .stills/). Build the reaper tip + trunk dist-before; stills ONLY=only-wh.txt (player
   warhammer bands + the Dwarf at Legionary / Praetorian / Origin); Wraith harness `node .stills/wraith-still.mjs` (the held Wraith's rig
   via the vite dev server, Soul Crown + Harvester + stock; Lead: OUR rig counts, GPT's captures only as a second picture); fit-check
   both trios; tsc + typecheck:tests + tests; check-budget; evidence rows; bodies; READY with both shas to Lead + Strategy.
5. After Published: verify live (release.json revision, /weapons/shapes/*.glb 200). Worktree session: Dom to reopen me on
   ~/Developer/frankendom-weapons with the worktree switch off.
## 2026-09-28 19:50 (+04) — #992 live (correction), weapon shapes intake started. READ FIRST, then "2026-09-28 11:53", then memory

1. **Correction (Lead, 13:49 release):** #992 (the estoc and the cleaver play the Pommel Strike, head 2e50979e) MERGED 09:38Z as
   442fa736 and has been live since the 13:49 release. My own check: `gh pr view 992` MERGED, and 442fa736 is an ancestor of live
   717d3e56 (curl 19:4x). I kept reporting it as "waiting on CI" after it merged: the app's CI events never reached this session.
   Lesson: check `gh pr view <n> --json state` before repeating any "waiting" line.
2. **Now (Strategy 19:5x via Lead): intake for GPT's weapon shapes.** 3 shapes per weapon type (PLAIN L1–3 / CRAFTED L4–7 / ORNATE
   L8–10), 30 meshes, the live rank tint supplying the materials. Sources: ~/Desktop/Business/artifacts/weapon-variants-20260928/
   (brief, addendum 1, reference parts, maul-proof/). Maul first, as the proof. Branch `weapons/shape-bands`:
   - `scripts/weapon-fit-check.mjs`: PASS/FAIL per rule of the brief's table (extent Y ±1 cm, contact zone covered, width X, thickness Z,
     tris by band, verts ÷ unique ≤ 1.6 target / 2.0 cap, maps, one node/mesh/material, hand at origin, +Y). `--shipped` gates
     geometry only (shipped parts are multi-material by design). `tests/weapon-fit-check.test.ts` runs it on every shipped part.
   - `src/weapon-shapes.ts`: `bandOf(level)`, `shapeFor(weapon, level)` → `/weapons/shapes/<weapon>-<band>.glb` when the band ships, else
     none (today's part). `SHIPPING_SHAPES` is empty; the dev flag `?shapes=maul-plain,...` names local files. Actor `reshape(mesh)` hangs
     the band's mesh on the weapon node (the own draws go off, the tint grades it as `Blade` metal); scene.ts `dress()` resolves it at the
     fight's `tier` for both fighters. No blade tables, contact extras or SIM_FILES touched.
   - Stills wait for GPT's files. Then the old queue: warhammer + maul carries, Witch staff variants.
3. Box: Hero Look holds it for the Knight #1024 timing gate until ~20:10. No tsc/tests until Lead posts "box free"; editing only.

## 2026-09-28 11:53 (+04) — HANDOFF before /clear. READ FIRST, then "2026-09-27 22:47 HANDOFF", then memory

1. LIVE `01a0f81c` (own curl 11:53). A deploy.sh run is IN FLIGHT at this time (not mine; none of my PRs are waiting).
2. Went live today (Dom's words): **per-rank weapon tint** on every opponent at every rank (#955); **Pommel Strike has its own
   move** on the longsword, the blade tips back so the pommel leads (#965); **the knife plays the Pommel Strike too**, every
   player's first take (#968). All three were verified as ancestors of live `01a0f81c`.
3. NOT LIVE: nothing of mine is open. `#833` signed-in equip scenario: **PASS** on trunk 0d3d7442 (legs 0–4). The earlier failures
   were the harness (a paused harnessClock carried into reloaded pages + a seeded session), not the game. The fixed script is memory
   scratch/equip-signed-in.mjs, and it is not in the repo.
4. Sessions down: none of mine. This lane runs in the app worktree `.claude/worktrees/priceless-wu-189421` (TRAP 3); Dom to reopen
   it on ~/Developer/frankendom-weapons.
5. Rulings/lessons today (memory): Lead PASS on the #955/#965/#968 stills; the Knight/Witch rank tint and the small knife at fight
   distance are design notes for Dom's morning table, not blockers. A knife-rig Skill_Pommel is byte-identical to the hero's
   (build-player-weapon drops it), so sword-grip weapons need routing only (characters.ts PLAYER_CLIPS + combat.ts actorPose).
   A build:warrior re-bake gives float noise on the goblin knife table; revert blade-paths.ts, no RV bump.
   #968's CI check 35 (endgame-hud) failed once as a runner flake: local PASS and one `--failed` rerun PASS (47 pass, 5 skip, 0 fail).
6. QUEUE (Lead): next Pommel weapon if Lead asks (estoc/gladius/cleaver are likely routing-only like the knife; poles need their own
   bash). Old items still open: warhammer + maul carries, Witch mage staff variants (see "Now — 2026-09-26").
7. No crons. Branch `weapons/handoff-0928` (this entry). Stills branches (never merge): weapons/rank-tint-stills, weapons/pommel-stills,
   weapons/knife-pommel-stills. Scripts in memory scratch/: rank-stills, rank-sheets, equip-signed-in, pommel-stills (+ knife),
   knife-probe.

## 2026-09-27 22:47 (+04) — HANDOFF before /clear. READ FIRST, then "Now — weapons lane, as of 2026-09-26", then memory

1. LIVE `054603e0` (own curl 22:47), no deploy lock. #833 (the equip-fallback line, "Your estoc could not load; fighting with the
   longsword") has been live since `13a90467` (09-26 night).
2. Built today, NOT LIVE (no PR yet): **per-rank weapon tint** (Dom via Strategy/Lead: every opponent at every rank; tint-only is the beta
   look for seven opponents). Branch `weapons/rank-tint` (this commit). `characters.ts grade(tier)` → `rank-tint.ts tinted()` on the
   weapon draws; `scene.ts dress()` calls it with the fight's tier. Classes in `grades.ts CLASS_OF` (blade metal, hilt trim, wood null;
   `stone` for WitchStone/WeatheredStone: half-way hue, glow 0.5×→1.8× over the ladder). Ranks 7–10 take the factor tint as interim
   (Lead ruled). 0 GLB bytes, no SIM_FILES. grades 10/10, rank-tint 3/3.
   **Owed:** `npm run quality:ci`. Killed twice (#902 pause, then Lead's quiet window for Hero Look #918), so no result yet. Then the 375
   stills (Witch/Knight/Pitborn at ranks 1/4/6/10, script `node_modules/.cache/rank-stills.mjs`, copy in memory scratch), browser GO from
   Lead. Then the PR + READY with the head.
3. **#833 signed-in scenario** (Backend's ask via Lead): NOT DONE. Run 2 won and took goblin.Knife, then hung ~12 h at leg 1 (harnessClock
   until() is page time). The script now caps each leg by wall clock and records FAIL + page state; memory scratch/equip-signed-in.mjs →
   copy to node_modules/.cache/. Browser GO from Lead.
4. **Pommel clip** (Skill_Pommel, hero day-one skill): `weapons/pommel-bash-2` @ `03f47204`, pushed, no PR. Root cause: the arm (0.47 m) is
   at full stretch in guard (shoulder z −.23, hand .22), so hand goals can't move it; the fix is a forward spine lean (POMMEL_LEAN .2 knob,
   remove before PR). Needs build:warrior (ASK Lead first: Blender/quiet window) + the Skill_Pommel test.
5. Rulings today: deadlines are NOW/ASAP or a physical blocker, never a day (Dom, memory `feedback_now_or_asap_no_deadlines.md`).
   Per-rank looks: tints ranks 1–10 now; ranks 7–10 get one base-colour map per rank next (~29 KB/weapon/rank, measured on the cleaver:
   29,394 B); new meshes (40 = 10 meshes × 4 ranks) only with Dom's yes + credits, Origin first, locked length/grip/contact.
6. QUEUE: Lead posts QUIET WINDOW END → quality:ci on rank-tint → stills (browser GO) → PR + READY → #833 rerun (browser GO) → pommel.
   Box rules: one test run at a time, ask before browser runs and build:warrior, check `pgrep -fl Blender` first.
7. No crons. Session worktree `.claude/worktrees/priceless-wu-189421` (TRAP 3); Dom to reopen on ~/Developer/frankendom-weapons.
   Stop-hook leak reported to Lead: every lane's quality-stop-targeted runs during quiet windows (Claude-hooks lane owns it).

## Now — weapons lane, as of 2026-09-26 ~05:30 +04 (replace this section wholesale; it is the restart brief, not history)

**Now.** Morning run 3 (Deploy merges): **#783** (player trident carry + draw, head `0f1e605d`) then **#784** (player scythe carry + draw,
head `c09424ba`, stacked on #783's branch). Both have green CI and are cleared by Strategy and Lead. When #783 merges, retarget #784 to trunk
(`gh pr edit 784 --base codex/01a09a76/task-1`) if GitHub doesn't, and tell Lead when each is live.
Then, in order (Lead): **1) warhammer + maul carries**: Strategy's trident PASS stands in, same recipe as #784. **2) the Witch mage staff**:
a look-only trident variant: same length, grip and `Trident_*` clips, same sim weapon, zero SIM_FILES, no RV bump. Forks off, shaft a little
thicker, gnarled head, **no spike** (a Witch kill plays no finisher, finishers.ts:21). Variants A (plain gnarled) and B (a small green
stone or knot, the Witch-fire source). Stills per variant: her ready idle at the fight camera plus one mid-fight frame, and ONE labelled
harness `Trident_Carry` shot for context only. They go to Strategy for Dom's pick before anything merges. **3) the pommel hilt-bash clip**:
longsword first, a short bash at arm's reach, the live `skill_pommel` timing (combat.ts:57 plays the thrust placeholder). The 9 opponent
specials (SCOPE 8) ship on existing clips, so there are no new clips from this lane for them.

**Done (2026-09-26 night)**
1. #758 weapon thumbs merged. Pole Draw B ruled by Strategy: a grounded carry, a draw over the shoulder, the hand on the socket (0.94 m
   wrist) accepted for all four poles.
2. #783: `Trident_Carry`/`Trident_Draw` on the player's equip only (the new `PLAYER_CLIPS` map in characters.ts), trident off `NO_HIP_DRAW`.
3. #784: the scythe at roll −1.57 (blade forward over the head, held through the draw). `scytheClips` now uses the shared `twoHandFamily`
   (byte-identical clips). Carry loops key at .25 s (`loop(..., step)`), so scythe.glb is 1,492,544 B, under the 1.5 MB equip cap.
4. Parked on `weapons/pole-draw-creatures` @ `e3cd3b27`: Veteran/Witch rebuilds with the carry, the frozen-donor append and
   `scripts/character/append-donor-clips.mjs`. Strategy: opponents stay `ready`, an opponent carry is post-beta if ever. Also parked:
   the record.ts bump-11 comment fix, until the next RV window.

**Open**
- The scythe equip has 7.5 KB of cap margin. Any further scythe clip needs a size plan first (Lead).
- The committed `warhammer.glb` is stale against the scripts (a 2.3° left-forearm drift, the same one the trident and scythe absorbed on rebuild).
  The warhammer carry PR will absorb it; call it out there.

**Gotchas (new)**
1. **Creatures inherit every clip from their frozen donor** (`src/assets/source/backups/veteran-v1.glb` for the Veteran, Witch and Skeleton).
   A clip authored on the hero rig never reaches them from `build-creatures` alone.
2. **Opponents start `ready`; only the player starts sheathed** (duel.ts `initialDuel`). Sheathed-only clips belong in `PLAYER_CLIPS`, never in `WEAPON_CLIPS`.
3. **A PR touching any SIM_FILE waits for the next RV window, even a comment.** Lead gates on `gh pr view N --json files`.
4. **A lone scratch script can't resolve vite/playwright from the scratchpad.** Copy it to `node_modules/.cache/` (gitignored) and run it from there.
5. **Five lanes' Stop gates at once put load over 190**, and every gate times out at 420 s. Don't loop on it: wait for load under 30.

## Lane lessons — where a stale assumption hides, and what the version guard is actually asking (weapons lane, 2026-09-22)
Three rules from the flip work, kept here because each cost something to learn and none is obvious from the code.

**An explicit instruction is exactly where a stale assumption hides best.** It arrives pre-justified, so it does not trigger the check
that an omission does. Concretely: the `grip` field (#440) came from the shield brief as a list of seven weapons. `MAUL` and `REAPER` were
*not* on it, so they got checked — they spread `CLEAVER` and `ESTOC` and would have silently inherited `one-hand`, and both were set to
`two-hand` deliberately. The trident *was* on it, as "trident as spear" under one-hand, so it was taken as given — and it was wrong:
`src/characters.ts` maps the trident onto the `Trident_*` family and says in its own comment that unlisted roles falling back to the sword
family is "wrong for a two-handed pole", and the scythe, same family shape, already read `two-hand`. The omissions were audited; the
instruction was not. Fixed in #472. Check the values you were handed at least as hard as the ones you had to invent.

**A weapon's brief can shut a lever by contract, and that is worth recording rather than rediscovering.** `tests/weapons.test.ts` pins the
estoc's windup/active/recovery/stepIn/feintUntil/chamber to the sword's *exactly*, because "the sword's timings and lunges exactly" is what
the weapon is. So "tune the thrust recovery like the knife's" was never available for it, however the numbers looked. Sweep it anyway and
record the closed door with evidence — an ambiguous door gets pushed again by the next person.

**The `RECORD_VERSION` guard asks a behaviour question, not a file question.** It hashes `SIM_FILES`, so *any* edit to `src/moves.ts`
trips it — but the guard's own comment sets the rule: a re-pin without a bump needs a receipt that behaviour is unchanged. Two opposite
answers on the same day, and the receipt is what separates them. #440 (knife recovery 15 → 20, scythe heel-jab 18 → 30) genuinely changed
how fights play out, so the bump *was* the point. #472 (`TRIDENT.grip` → `two-hand`) changed a field no sim code reads — verified by grep
across `duel.ts`, `ai.ts`, `sim.ts`, `combat.ts` — and both committed references replayed identically **without being regenerated**
(1677/1452 ticks, same outcome, same state digests), with the fairness table unchanged. Bumping there would have refused every kill link
minted that day for nothing. Ask what the change does, not which file it touched.

### Not the shelf item it looks like: the maul (recorded ahead of the Knight)
`MAUL` (`src/moves.ts`) is the `CLEAVER` spread with a two-hand grip and one overridden move, on `creaturePaths(CLEAVER_PATHS, 'Maul')`.
There is **no maul asset in the repo** — the geometry lives inside the held `minotaur.glb`. So promoting it to a player weapon is a real
deliverable, a hero-rig part *and* its own blade/contact table, not a data row. Confirmed by the lead. No owner yet; nothing started.

*Correction 2026-09-23:* the maul line above ("No owner yet; nothing started") is stale. Owner is this lane (Strategy, 2026-09-23);
the part landed as #509 and the 12-clip `Maul_*` family is on `weapons/maul-clips` — see **Now** for where it stands.

## Session handover — maul part shipped, estoc parked, and a trap waiting for whoever rigs the maul (weapons lane, 2026-09-22)

**Now.** Nothing is in flight. #509 (the Knight's maul part) is ready and with Deploy in the code batch; #501 (this file) is in the
docs batch; #419 (estoc reach) is parked. The next piece of weapons work is whatever the next Strategy session assigns.

**Done today.** #509 the maul PART at silhouette stage (`scripts/build-weapon.mjs`, one file, gate green 468/466/2 on base
`fe0d8e0`). #501 the estoc findings off trunk. The bearded-axe cost measurement that overturned Brief 15 §2 (Strategy is having
Pitborn correct the brief): **one-hand weapons in this repo do not get a clip family.** cleaver, estoc and knife each map ten move
ids onto the same four shared hero clips — `Attack`, `Return`, `Heavy`, `Riposte` — with `clips: null` in `WEAPON_BUILDS`; only the
two-hand poles own prefixed families. The brief's "~13 clips to author" is a two-hand pole family's cost (the scythe's) applied to a
one-hand weapon. Real cost: a part, plus at most the already-shared `CLEAVER_KEYS` re-key.

**Open.** #419 waits on a Nightborn **profile** item in Combat's lane (levers only, no data move): with the estoc at +0.30 m the
Nightborn normal profile must hold `trident vs nightborn normal: charged heavy only` at ≤ 12/24 with margin (14/24 with the fix,
8/24 without), fight length back under the 240-tick bar (321 exhausted over 24), and his hard-tier feint-and-punish identity pin
intact (0/24). Combat stacks the estoc flip on #419 as one PR riding Stats' single bump to 6. Then ONE full-battery re-run on the
pair and a READY line. **Do not re-run the battery before that PR exists** — nothing else moves those rows.

**Gotchas.**
1. **THE MAUL TRAP, for whoever rigs it next.** #509 is the part only — `clips: null`, no rig, no loadout. But `WEAPONS.maul.paths`
   names `Maul_Slash` / `Maul_Heavy` / `Maul_Thrust`, and **those clips exist only on the creature side**: they are authored in
   `scripts/build-creature-weapons.mjs` for the Minotaur, at the Minotaur's contact span `{from: .73, to: 1.11}`. The hero-rig part
   this lane shipped has contact `{from: .65, to: .87}` — a different object at a different scale. So a hero-rig maul needs its own
   family or a re-key onto the shared hero clips, exactly as the warhammer got `Warhammer_*` "on the trident's machinery" rather than
   borrowing the Minotaur's creature-authored `Maul_*` set. **Anyone switching a hero-rig donor to the maul and expecting the paths
   to resolve will bind to creature clips or to nothing.** Strategy has the Executioner doing that switch the day this lands.
2. **The maul's crown is load-bearing, not cosmetic.** `WEAPONS.maul` and `WEAPONS.warhammer` carry identical reaches (light 1.65,
   heavy 1.90, thrust 1.40 — both CLEAVER-derived), so the head crowns at the warhammer's .76. The `real reach` test does not cover
   the maul yet because it is neither a shipped (rig, weapon) pair nor a player weapon; it starts covering it the moment it is rigged.
   Do not "tidy" that height.
3. **The stale-node_modules gotcha is install-date, not base-sha.** World reported that a worktree fast-forwarded onto `fe0d8e0` can
   fail `quality:stop` on a missing `@types/node`, fixed by `npm ci`. This worktree **was** on `fe0d8e0` and did not hit it (468/466/2,
   World's own post-`npm ci` numbers). It depends on when that worktree last installed. Do not run `npm ci` as a ritual, and do not
   read a green gate on `fe0d8e0` as evidence the gotcha is imaginary.
4. **Open the file before acting on a relayed mechanism.** Three plausible relays were wrong in one night, each from a competent
   lane. The costly one: the kicker hover was relayed as the estoc's unblocking event, but it is gated on `guardShare === 0`, which
   is the Goblin's profiles alone — it can never fire on the Nightborn. Acting on it meant a full battery re-run for the same table.

## Estoc reach — re-measured and HELD: the estoc clears, the Nightborn breaks (weapons lane, 2026-09-22) — HELD, NOT PARKED
The estoc was un-parked on the reach fix alone (Dom via Strategy, the lead relaying): `ESTOC.fight.close` is not touched, so the old
stance-hunt revival condition below is **moot** and that hunt stays dead. #419 rebased onto trunk `1741dc5`, head `b1455d4`, PR draft.

**The estoc itself clears with room.** `ESTOC_MOVES` = the sword's spacing convention **+ 0.30 m**, the blade's measured frontier. Full
battery re-run, every weapon, both levels. Against a bar of margin ≥ 2, **zero estoc rows are below it** — worst are goblin normal thrust
6/24 and executioner normal charged heavy 6/24 (cap 12), and goblin hard charged heavy 4/24 (cap 8). The four old rows: goblin normal
thrust 24/24 → 6/24, goblin hard light spam 9/24 → 1/24, goblin hard thrust 23/24 → 3/24, dwarf hard thrust 10/24 → 3/24.

**But the weapon does not travel alone, and that is the finding.** The Nightborn wields the estoc, so +0.30 m on every one of his moves
changes how he fights everyone. Three consequences, each with an in-process control that restored cleanly:

| # | finding | control |
|---|---|---|
| 1 | **new** over-cap row on the **trident** (shipped, offered): `trident vs nightborn normal: charged heavy only` 8/24 → **14/24**, cap 12 | estoc back on sword reach → 8, restored → 14 |
| 2 | Nightborn **fight-length pin fails**: exhausted **321** ticks over 24 fights, bar 240 | `ESTOC_REACH = 0` passes (median 20.5 s, hero wins 10/24); `.30` fails |
| 3 | Nightborn **fight-identity fails** at hard: the feint-and-punish his design names wins **0/24** | same |

(2) and (3) are design contracts, not thresholds — his brief is that he is "beaten by wit, not stamina".

**The lever the brief named is shut by contract, not by taste.** Tuning the estoc's thrust recovery the way the knife's was tuned breaks
`tests/weapons.test.ts`, which pins the estoc's windup/active/recovery/stepIn/feintUntil/chamber to the sword's **exactly** — "the sword's
timings and lunges exactly" is the weapon's brief. Swept before concluding it: 21 → trident 14 FAIL; 24 → trident 7 but the estoc's own
goblin row goes to margin 0; 27 → 12 thin; 30/31/32 → both clear. Non-monotonic, *and* it breaks the defining test at every value. Record
the closed door rather than leaving it ambiguous. Wind-up and stance untouched, as instructed.

**The lead's ruling, 2026-09-22: the trident does NOT leave `PLAYER_WEAPONS_OFFERED`** — "un-offering a shipped weapon to make room for a
shelf one is not a trade I'll make". The branch as pushed *does* remove it, because the table forces the pair (the test asserts a weapon
with no over-cap row must be offered and one with a row must not be). That is why this cannot land as-is and is held rather than fixed: the
invariant and the ruling disagree until the trident row goes away. Same invariant that forced the scythe in on #440 — the system working.

**Held, deliberately, on a dependency.** Combat is fixing a shared approach defect in `src/ai.ts`: every opponent's approach settles at a
*raw* reach value while `inReach` needs `reach − .1`, so wardens park just outside their own range. That changes stopping distance, which
is exactly what +0.30 m interacts with — findings (2) and (3) are engagement-distance symptoms and may move on their own. Re-measuring
before it lands would be the stale-base trap one layer up. **Nothing is retuned and nothing is measured again until that fix is on trunk.**

`RECORD_VERSION` 5 → 6 with `SIM_DIGEST` re-pinned over the final tree and references regenerated (still replaying identically, 1677/1452).

**BUMP RULING, 2026-09-22 (the lead) — the estoc's 6 is NOT this lane's to write.** Trunk carries `RECORD_VERSION = 5` (the batched
knife+scythe flip). Stats' PR B needs 6 for the loadout tail and is ready first, so **Stats carries the bump and this lane rides it**; the
rule is whoever is ready first takes it, and if #419 somehow lands ahead of Stats' PR B the order reverses. The `weapons/estoc-reach`
branch currently writes 6 itself — that stays only while it is a draft, and **the bump comes out (with `SIM_DIGEST` re-pinned) before #419
goes READY behind Stats**. One bump for many, because kill links are the viral surface and N bumps means N waves of dead links.

**SEQUENCING, 2026-09-22 (the lead, correcting himself with Combat's answer).** Combat's **knife** is next, not the cleaver, and it
touches the warden approach in `src/ai.ts` rather than estoc data — so #419's draft status does **not** gate them tomorrow; only the
cleaver-and-after stacks on this lane. Read the other direction, that is this entry's unblocking event: the approach fix this entry is
held on is the thing Combat is about to ship, so **watch trunk for `src/ai.ts`** rather than waiting to be told. Combat is taking this
lane's knife `thrust.recovery` 15 → 20 as measured rather than re-deriving it.

**CORRECTION, 2026-09-22 — the kicker hover is NOT this entry's unblocking event, and #419 should not be sequenced behind it.**
Combat corrected their own mechanism (via the lead): the park is not the approach stop but the **kicker hover**, `src/ai.ts:323`
`const hover = guardShare === 0 ? (reads.poker ? theirs.thrust.reach : reads.kicker ? theirs.kick.reach + .3 : 0) : 0`, with the clamp at
`:330` zeroing forward drive below `hover − margin` (`:328`, margin `.05` for a kicker). That mechanism is real and the arithmetic
reproduces: `MOVES.kick.reach` is 1.2, so hover = 1.50 and forward drive dies at **1.45**; the parked warden's *usable* reaches
(`reach − .1`, the margin `inReach` keeps) are light 1.10, thrust 1.35, heavy 1.45 — parked at exactly the heavy's usable edge, only the
heavy legal. **But those are the knife's reaches (1.2 / 1.45 / 1.55), not the estoc's** (1.95 / 2.30 / 2.20 with the fix). The warden is
the **Goblin**, and that is forced: `guardShare = profile.guard ?? 1` (`:68`), and `guard: 0` appears in exactly one opponent's profiles
in `src/moves.ts` — the goblin's easy/normal/hard (`:509–511`), whose comment says outright "never guards (guard 0)".

**The Nightborn is not guardless**, so `hover` evaluates to 0 for him and the `hover > 0` clamp can never fire on his approach:
`nightborn` (`src/moves.ts:495`) carries `guard: { window, recovery, commits }` — the directional-guard object, a different key — and
none of his three profiles sets the AiProfile `guard` share, so it defaults to 1. **Therefore Combat's kicker-hover fix cannot move
findings (2) or (3), and cannot move the trident row.** What it *does* explain is the `knife vs goblin hard: kick only untouched` 3/24
stalemate this lane already routed to Combat as his approach rather than knife data — that row now has its mechanism, at 1.45 m.

So the hold does not lift when that fix lands. Either a Nightborn-profile change is made, or the trident row is accepted and the flip
test's membership pair is resolved by a product decision. **Do not re-run the full battery on the strength of the kicker fix alone** —
it is a no-op for this weapon's problem, and re-measuring against it would buy the same table a second time.

**Base check, 2026-09-22 (docs PR):** trunk has moved `1741dc5` → `cb8ff5b` (22 commits), and
`git diff --stat b1455d4...cb8ff5b -- src/{ai,duel,moves,sim,record,opponents}.ts` is **empty** — not one sim file moved. So the numbers
below are still the numbers on current trunk, and **Combat's `ai.ts` approach fix is not on trunk yet**: the dependency this entry is held
on is unresolved, not silently satisfied. Re-measuring today would re-derive the same table. (The lane's flip-test rule did land, as
`9ffce97`/#465.)

Evidence: `b1455d4`. Gate 464/467 with 2 skipped and 1 failure, plus 93/94 slow — both failures are the Nightborn and both are caused by
this change; neither pin was relaxed. Remaining validation: **re-run the full battery once Combat's `ai.ts` approach fix is on trunk**, then
either the estoc lands nearly clean, or the surviving trident row goes to Combat as a Nightborn profile item and #419 waits for it.

## Knife flip prep — two rows fixed, one isn't knife data, and a program-level cost (weapons lane, 2026-09-22) — BLOCKED ON A DECISION
Lead's item (1), knife. Three rows on trunk 187dd89, all reproduced: `knife vs veteran normal: thrust from range 18/24`,
`knife vs goblin normal: thrust from range 15/24` (caps 12), `knife vs goblin hard: kick only untouched 3/24` (cap 2).

**The two thrust rows are knife data and are fixed here**: `KNIFE_MOVES.thrust.recovery` 15 -> 20. The knife's poke was unpunishable —
out and home before either warden could answer — so a poker parked at range and won. The wind-up stays 12, the fastest tell in the game
and the floor the knife's brief sets for readability, so it still feels like a knife; only the whiff becomes punishable. Total commitment
12+20 = 32 ticks still undercuts the sword's 16+21 = 37.

**Wind-up is the wrong lever**, measured: 13 -> 22/19, 14 -> 24/24, 15 -> 1/23, 16 -> 2/24. It shifts the tell in and out of each warden's
read window, non-monotonically. Recovery is the mechanism; wind-up is a coin toss.

**20 is the only usable value**, because the Goblin wields this knife and his own fight-length pin moves with it
(`tests/opponents.test.ts`, median 25–45 s):

| recovery | knife rows (Vet / Gob, cap 12) | Goblin median |
|---|---|---|
| 15 (trunk) | **18 FAIL / 15 FAIL** | 42.8 s |
| 16 | 8 / 12 (zero margin) | **47.5 s OVER** |
| 17 | 10 / **13 FAIL** | 43.7 s |
| 18 | 8 / 11 (margin 1) | 44.7 s |
| 19 | 5 / **16 FAIL** | 38.0 s |
| **20** | **5 / 6 (margin 7, 6)** | **44.6 s** |
| 21 | 3 / 4 | **48.5 s OVER** |

Note the median surface: 42.8, 47.5, 43.7, 44.7, 38.0, 44.6, 48.5 across adjacent ticks. 20 passes its pin by 0.4 s on a surface that
swings ten seconds between neighbours — that is luck, not headroom, and it should be re-measured if the Goblin is ever retuned.

**The third row is not knife data.** `KNIFE_MOVES.kick` IS the shared `MOVES.kick` object (identity-checked, `===`), and kick-only is
killed 24/24 by this same Goblin with every other weapon; only the knife pairing fails, and all 24 of its fights end in stalemate at the
7200-tick limit — a kicker and the hard Goblin simply never resolve. That is his approach against the shortest reach in the game
(Combat's lane), not a weapon number, and no weapons change should be made for it.

### Two facts that apply to EVERY weapon change, not just this one
1. **Every player weapon is also a warden's weapon** — goblin/knife, veteran/trident, nightborn/estoc, executioner/scythe,
   pitborn/cleaver, dwarf/warhammer. So every weapon-data change is simultaneously a warden change, and the warden's own pins
   (`tests/opponents.test.ts`) and every OTHER weapon's rows against him move with it. This change moved three of Combat's signed rows
   (estoc-vs-goblin hard light spam 11 -> 9 and thrust 22 -> 23, scythe-vs-goblin normal thrust 19 -> 16) purely because the Goblin's
   knife changed. Re-scan the whole table after any weapon edit; never assume the blast radius is the weapon you touched. It cost the
   estoc its reach fix (#419, parked) and it is the reason a knife tune needs Combat's re-signature.
2. **Every weapon-data change invalidates every shared kill link.** `tests/record-version-guard.test.ts` hashes
   `SIM_FILES = [duel.ts, moves.ts, ai.ts, sim.ts, record.ts]`; any change to `src/moves.ts` requires `RECORD_VERSION` to bump, which
   refuses all previously shared links at decode. That is the correct behaviour — a link must not replay a different fight — but it means
   **N weapon PRs merged separately cost N link-invalidation events.** The remaining flip work should be batched behind ONE deliberate
   bump rather than paid per weapon. That sequencing is the lead's call, which is why this entry is BLOCKED rather than shipped.

LEAD'S RULINGS, 16:31: (a) **Batch the bump** — one `RECORD_VERSION` 3 → 4 for the whole remaining flip work, because kill links are the
viral surface Dom is pushing (PLAY NOW shipped 2026-09-22) and N bumps means N waves of dead links for no product gain. #440 stays a
draft; the scythe and any further weapon-data change stack on the same branch, landing as ONE PR with a single bump and a single
`SIM_DIGEST` re-pin. Leaving the guard red was endorsed explicitly: "I'd rather see it red than see someone bump quietly." (b) The
Goblin kick row is **Combat's**, accepted on the identity/stalemate evidence, routed as a hard-profile item behind Brief 13 and named a
first candidate for Brief 14's per-grade knob — no weapon data is to be spent on it. (c) The knife fix is **approved as measured**.
(d) **Combat's re-signature on the moved snapshot rows is required before the batched PR goes READY** — the lead will not merge on the
weapons lane's signature alone.

STANDING WARNING tied to the Goblin: recovery 20 clears its pins at a median of 44.6 s against a 45 s ceiling, on a surface that swings
38 → 48.5 s across adjacent recovery ticks. That is luck, not headroom. **If the Goblin is ever retuned, re-measure this.**

COMBAT'S ANSWER on (d), 2026-09-22 — **measure once**. He declines to sign magnitudes he has not re-derived on his own seeds ("a
signature that means the other lane told me and it looked plausible is worth nothing"), and box windows are the scarce resource, so
measuring the knife head now would buy a number he'd throw away once the scythe lands. Agreement: **when the scythe is stacked and this
branch is stable, send him ONE sha and ONE consolidated set of every row of his that moved**; he re-derives them all in a single window
and signs or sends his numbers. Until then the three rows are labelled UNVERIFIED BY COMBAT in the #440 body, not "signed" — if the lead
merges first it merges on this lane's measurement alone, and that label is the honest record. Do not soften it.

Two process facts from the same exchange. **Send the head sha you actually measured, re-checked after any rebase**: this branch moved
f890dae → f87d721 when trunk gained #431/#432/#433/#434, and those merges touch none of `duel/moves/ai/sim/record/opponents.ts` or
`tests/player-weapons.test.ts`, so the numbers survived — but an unchecked stale sha manufactures a "disagreement" that is really two
different trees, and costs the other lane a whole window to discover. **Determinism first**: five identical runs in one process were
verified on this surface, which is what makes any difference between two lanes real signal rather than seeds.

State: ready on `weapons/knife-thrust-recovery` (a078af6), snapshot updated, full suite 491/494 (2 skips are the char lane's hand pins),
the ONLY failure the version guard — deliberately red, by the lead's ruling, until the batch lands. Not merged.

## Scythe flip prep — heel-jab recovery 18 → 30, both rows cleared, the scythe is offerable (weapons lane, 2026-09-22) — FIXED
The last of Combat's four. The scythe's two `thrust from range` rows (Veteran 19/24, Goblin 16/24, cap 12) were scythe data, the same
shape as the knife's: the heel-jab reaches 2.10 m and at recovery 18 it was home before either warden could answer, so a jabber parked at
range and never paid. Recovery 18 → 30 clears both with margin (8/24, 6/24). Wind-up stays 14 — the jab still *comes out* quick, which is
the trait the brief names ("quick, short… spacing and interrupt tool"); what changes is that a whiffed jab is punishable.

**This one has an interior, which is why it is payable where the cleaver and estoc were not.** Recovery, 24 seeds, normal, cap 12:

| recovery | Veteran | Goblin | |
|---|---|---|---|
| 18 (shipped) | 19 | 16 | FAIL |
| 26 | 16 | 18 | FAIL |
| 27 | 17 | 18 | FAIL |
| 28 | 12 | 12 | passes, but **exactly on the cap** — margin 0 |
| 29 | 11 | 8 | passes |
| **30** | **8** | **6** | **passes, margin 4 and 6 — taken** |
| 31 | 1 | 4 | passes |
| 32 | 17 | 1 | FAIL |

28–31 is contiguous and graded, and 30 is its centre with both neighbours passing. That is the opposite of the cleaver's surface (22 fails
at 17, 21 and 20 pass at 11, 19 fails at 18 — one tick either way flips it) and of the estoc's. The two reasons that parked those two —
non-monotonic, and zero-ish margin — are both absent here, so the change was taken rather than handed back.

**Wind-up is the wrong lever and was measured as such** (recovery held at 18): 16 → 0/24 FAIL, 18 → 0/20 FAIL, 20 → 0/0, 22 → 0/0. The
Veteran column falls 19 → 0 between wind-up 14 and 16 — a read-window cliff, not a gradient — and 20/22 would clear both rows with a huge
margin for exactly the wrong reason: the tell moves out of the warden's read window. Raising it also costs the trait the brief protects.

**The Executioner wields this scythe, so his side was measured before the change was taken** (AI vs AI, 24 seeds, the `18–45 s` pin):
median 25.9 s untouched, 27.4 at 28, 27.7 at 29, **27.0 at 30**, 27.9 at 31; range 16.2–41.0 s at 30, no unfinished fights at any value.
Unlike the Goblin's pin under the knife change (44.6 s against a 45 s ceiling — luck, and flagged as such), this one has real headroom.

**One other row moved through him**: `cleaver vs executioner normal: light spam` 17/24 → **18/24**. Over the cap either way and its cause is
unchanged (his read of a 22-tick tell, the entry below), so the cleaver's diagnosis and its hand-over to Combat both still stand — but the
number in that entry's table is now 18, not 17. Snapshot updated; **needs Combat's re-signature together with the knife's**.

**The scythe now has no over-cap row at any rung, so it enters `PLAYER_WEAPONS_OFFERED`.** That is not a taste call: the test derives the
excluded set from the table and asserts that a weapon with no row *must* be offered, so the list follows the measurement. Offered is now
longsword, warhammer, trident, scythe.

Also finishes the knife change from `1bb9153`: `KNIFE_MOVES.thrust` went to recovery 20 but `KNIFE_PATHS.thrust` stayed at 15. The path
tables drive the clip retime (`clipSpec`, `src/combat.ts`), not the sim — a path shorter than its move leaves the stab looking recovered
for 5 ticks while the sim still holds the fighter. Both path tables now follow their moves. Presentation only, so no measurement re-opens.

Every sweep ran an untouched control in the same process; it reproduced 19/24 and 16/24 exactly and restored to them after every patch
(the control rule in the entry below — it is what caught the cleaver's asymmetric-light error).

Evidence: `44d414e`. Gate 456/459 plus 93/93 slow, and the fairness table passes against the updated snapshot. The one failure is the
`RECORD_VERSION` guard, red deliberately under the lead's ruling (a): one 3 → 4 bump for the whole remaining flip work, not one per weapon.
**The batch then closed, and the branch was rebased onto trunk `c43c677`** (head `3245d6e`, #440 MERGEABLE/CLEAN). Two things the rebase
changed, both worth keeping: **`RECORD_VERSION` is 5, not 4** — trunk had already taken 4 for Brief 13's whip tell (#431) while this branch
was in flight, so the batch is a further sim change on top of it. And the rebase pulled in a **299-line `src/ai.ts` change plus `duel.ts`,
`moves.ts` and `record.ts`** that belong to the lorarii work, not to this lane: the fairness table was therefore re-run on the rebased tree
before the sha went to Combat, and the snapshot still matches exactly, so neither trunk's changes nor this lane's moved a row. The reference
fights' state digests moved to `d953a09b` / `552f30e5`, which is byte-for-byte what trunk's own fixture already carried — the knife and
scythe move those two Veteran fights not at all (same ticks 1677/1452, outcome and killed tick).

The `grip` field also landed here (the shield brief, via the lead, folded in rather than paying a second bump): one-hand = knife, cleaver,
estoc, trident; two-hand = warhammer, scythe, longsword. The brief named seven; `MAUL` and `REAPER` spread `CLEAVER` and `ESTOC`, so without
an explicit override they would have silently inherited `one-hand` — both set to `two-hand` and flagged to the lead. Data only, nothing in
the sim reads it. `RECORD_VERSION` 3 → 4 was the single bump ruling (a) reserved for the whole flip work. `src/record.ts`
is itself one of the hashed `SIM_FILES`, so the digest was computed *after* the bump rather than copied from the failure message, which
prints the pre-bump one. References regenerated per the documented procedure (`scripts/record-replay-check.mjs --write`, same PR as the
bump) — and both replay to the **identical** fight, same ticks (1677, 1452), outcome, killed tick and state digest. Only the version byte
moved, because neither reference uses the knife or the scythe; the bump is there to refuse older links cleanly, not because these changed.
Gate green on the rebased tree: 465/467 with 2 skipped and 0 failures, plus 94/94 slow.

Remaining validation: **Combat re-signs the snapshot** (this entry's cleaver row and the knife's three estoc/scythe rows) and the PR goes
ready only after that (ruling (d)); the scythe has had no browser/feel pass as a *player* weapon — the
recovery is 200 ms longer than shipped and that is a real change to how the jab reads in the hand, which the numbers cannot judge.

## Cleaver flip prep — the Executioner row is not payable in this lane either (weapons lane, 2026-09-22) — MEASURED, NOT FIXED
Lead's item (1): clear `cleaver vs executioner normal: light spam wins 17/24` (cap 12) with a measured 24-seed battery. Re-run on trunk
9f77fe4 — the row survives every trunk change since it was signed, still exactly 17/24. Every other cleaver pairing passes (veteran,
pitborn, goblin, nightborn, dwarf, at both levels). Diagnosis below; **no cleaver change is proposed, and none should be made.**

It is not the cleaver, it is a tell the Executioner cannot read. Light spam against him, every player weapon, 24 seeds, normal:

| weapon | light windup | result |
|---|---|---|
| cleaver | 22 | **17W/7L** |
| warhammer | 22 | 11W/13L — *already offered* |
| trident | 22 | 11W/13L — *already offered* |
| longsword | 20 | 0W/24L |
| estoc | 20 | 0W/24L |
| knife | 14 | 0W/24L |

Every weapon with a 22-tick light beats him; every weapon with 20 or 14 never touches him. Two of the three 22-tick weapons are shipped
and offered today at 11/24, one cap-step below the cleaver. So this is an Executioner-side blind spot that already ships, and the cleaver
is its worst instance rather than a broken weapon.

Every weapons-side lever, measured (`battery('normal', 24, 7200, OPPONENTS.executioner, STRATEGIES, 'cleaver')`, deterministic — verified
by five identical runs in one process, and by identical-value object copies):

| lever | result | cost |
|---|---|---|
| untouched | 17W FAIL | — |
| light windup 22 → 21 | 11W pass, margin 1 | the heavy-chopper tempo; 22 is deliberate (readability, and slower than the sword by brief) |
| light windup 22 → 20 | 11W pass, margin 1 | as above, and makes it the sword's tempo exactly |
| light windup 22 → **19** | **18W FAIL** | — |
| backhand posture 34 → 20 | 11W pass, margin 1 | a 41 % cut to the weapon's defining trait ("the back of the cleaver is a hammer") |
| backhand posture 34 → 24 | 14W FAIL | — |
| chop posture 26 → 20 | **18W FAIL** (worse) | — |

Two reasons not to take any of them, the same two that parked the estoc. **Non-monotonic**: 22 fails at 17, 21 and 20 pass at 11, 19 fails
at 18 — one tick either way flips the result, so this is sampling noise, not a gradient with a safe interior. **Zero-ish margin**: every
passing value lands on 11/24 against a cap of 12. And each costs a trait the cleaver's brief states explicitly.

### Sweeping a weapon: keep a control inside the harness (rule, not an anecdote)
**Every weapon sweep must run the untouched weapon as a control in the same process as the patched runs, and the control must reproduce
the number you are trying to move.** If it doesn't, your patch is changing more than you think and every row in the sweep is suspect.

This is not hypothetical: the first sweep of this row was wrong and looked entirely plausible. The cleaver's two lights are asymmetric by
design — chop `light_right` posture 26 / damage 17, backhand `light_left` posture **34** / damage 9 (the brief: "the back of the cleaver
is a hammer") — so a patch written as "set the light's posture" hits both and silently nerfs the backhand. It produced a **14W baseline
for an untouched weapon whose true baseline is 17W**, i.e. a plausible three-win error in the direction of the answer I was looking for.
It was caught only because that baseline disagreed with an earlier run of the same config.

Two supporting facts, both measured rather than assumed:
- `tests/strategies.ts` `battery()` **is deterministic** — five identical calls in one process all returned 17W, as did calls made after
  reassigning `WEAPONS.cleaver` to an identical-value deep copy. So a number that differs between two runs means *you changed something*;
  it is never flakiness, and must be explained before the sweep is trusted.
- Per-move patches must name `light_right` and `light_left` separately. Any weapon may carry asymmetric lights; the cleaver does, and the
  knife's brief (edge vs the hook's sharpened back) suggests it may too — check before sweeping, don't assume symmetry.

Handover: the lever is the Executioner reading a 22-tick tell (his reaction window), which is Combat's lane, not a weapon number. Until
that moves, the row stands and the cleaver stays out of `PLAYER_WEAPONS_OFFERED`. Knife and scythe prep follow separately; nothing here
blocks them, and nothing here touches the loot ids (takeable ≠ offered).
## Estoc reach — PARKED, no stance value clears both axes (combat lane, 2026-09-22) — SUPERSEDED 2026-09-22: un-parked on the reach fix alone; the stance hunt stays dead and this entry's revival condition is moot (see the HELD entry above)
The weapons lane's estoc reach fix (#419, now a draft) is correct about the blade and is NOT merged: it cannot ship until the estoc's
stance is retuned, and no stance value exists that is safe. **To revive it, one of two things must change: either the Nightborn stops
carrying the estoc, or the trident-vs-Nightborn fairness row is re-measured against a deliberately retuned Nightborn.** Neither is a
side effect of a weapons change — whoever touches `ESTOC_MOVES` reach or `ESTOC.fight.close` next should read this entry first.
Lead named a third route, but gated: a per-opponent knob or a deliberate Nightborn discipline retune, and only if Strategy or the owner
wants the estoc sooner — it is a bigger change than the estoc is worth. Retuning the TRIDENT's charged heavy (the row that actually
trips) would also clear it and is deliberately NOT listed as a free option: it retunes a shipped, offered weapon to accommodate a shelf
one, which is the trade Lead refused when he put axis 2 in scope. If someone takes that road it is a trident decision on its own merits,
not an estoc fix.

Why a stance retune was needed at all: `ESTOC.fight.close` stood at the longsword's own 1.15 while the move table wore the sword's
reach. Giving the estoc its blade's real reach (+0.30 m) left the stance behind, so the wielder closed to 1.95 - 1.15 = 0.80 m inside
his own cut (with #419 applied; **on trunk today the estoc's stand-off reads 0.50**, light 1.65 against close 1.15, because the reach
fix is unmerged — check the number against a tree with #419 in it, not against trunk) — deeper than any weapon we ship (longsword/cleaver/maul/warhammer 0.50, reaper 0.65, per the weapons lane's sweep). He
over-swung and exhausted himself: `tests/opponents.test.ts` "beaten by wit, not stamina" went 105 -> 321 ticks over 24 fights, cap 240.

Why no retune works. Two axes pull against each other. Axis 1 is that exhaustion pin. Axis 2 is `tests/player-weapons.test.ts`, the
24-seed battery — in scope because **the Nightborn wields the estoc**, so his stance changes how a TRIDENT player fights him, and the
trident is shipped and offered. Stand-off below is `ESTOC.moves.light_right.reach (1.95) - ESTOC.fight.close`:

| close | stand-off | Nightborn exhausted (cap 240) | 24-seed battery |
|---|---|---|---|
| 1.15 | 0.80 | 321 FAIL | pass |
| 1.17 | 0.78 | 215 | FAIL — trident vs nightborn normal: charged heavy only 13/24 |
| 1.19 | 0.76 | 215 | pass |
| 1.20 | 0.75 | 215 | pass |
| 1.21 | 0.74 | 215 | pass |
| 1.23 | 0.72 | 215 | FAIL — same row, 13/24 |
| 1.25 | 0.70 | 215 | FAIL — same row |
| 1.30 | 0.65 | 215 | FAIL — same row |
| 1.35 | 0.60 | 230 | FAIL — same row |
| 1.40 | 0.55 | 317 FAIL | pass |

The 1.19-1.21 window is not usable, for two independent reasons. (1) **Zero margin**: measured directly, the trident's charged-heavy
row is exactly 12/24 at 1.19, 1.20 and 1.21. The cap is 0.5 and the check is `wins/seeds > cap`, so 12/24 passes only by not being
strictly greater — one seed flips it to a failure. A pass by tie-break is not evidence. (2) **It contradicts its own rationale**: a
stand-off of 0.75 makes the estoc the deepest-closing weapon in the game, when the point of the fix is that a point-first blade stands
off FURTHER than a cutter. Note also that 1.17 FAILS while 1.19 passes at identical exhaustion (215): at this resolution the surface is
sampling noise, not a plateau with edges, so bisecting for a better value is not worth anyone's time.

Evidence: sweep run 2026-09-22 on `combat/estoc-offer` (since reverted to its committed head; nothing pushed, no PR). Axis 1 from a probe
reproducing the opponents pin exactly; axis 2 from `node --test tests/player-weapons.test.ts` at each value; the 12/24 margin from a
direct `battery('normal', 24, 7200, OPPONENTS.nightborn, STRATEGIES, 'trident')` read. Also green at the rejected 1.30 before axis 2
caught it, which is the point: `record-replay-check` (both fixtures, digests match), `kill-link-check` (36 fights),
`tests/weapons.test.ts` 34/34, `tests/opponents.test.ts` 20/20. A green suite is not a safe number.

Riding with any revival: a rewritten stance pin (Weapons' anchoring — `reach - close === 0.65` for both the estoc and `WEAPONS.reaper`,
so a longsword retune cannot drag the estoc's pin with it) is kept as `estoc-stance-pin.patch` in the combat lane's scratchpad. It is a
better pin than the `LONGSWORD.fight.close + .15` it replaces, and against today's committed `close` of 1.15 it fails as
`0.8 !== 0.65` — the bug stated as a test. `RECORD_VERSION` stays 3 on trunk: the sim change is parked with the rest.

## Takeable weapons — loot ids for every warden's weapon (weapons lane, 2026-09-22)
Owner (via Strategy, 12:55): "any item can be taken, armour or weapon." Shelf side in `src/loot.ts`: `WEAPON_SLOTS` (Trident, Cleaver,
Knife, Estoc, Scythe, Warhammer) join `ARMOUR_SLOTS` in `LOOT_SLOTS`; `PAPERDOLL.main = WEAPON_SLOTS`; ids `veteran.Trident`,
`pitborn.Cleaver`, `goblin.Knife`, `nightborn.Estoc`, `executioner.Scythe`, `dwarf.Warhammer` appended to `LOOT`; `weaponOf(id)` = the slot
lower-cased (`isWeaponLoot`, `isWeaponSlot`). `dropFor` filters to armour: a weapon is never dropped, it is TAKEN (the lead's kill-screen
"Take one" reads `LOOT[opponent]` minus owned). No loot.glb draw for a weapon — the visual is its equip file `src/assets/weapons/player/
<weapon>.glb` (#309 contract) loaded when `equipped.main` is set; that runtime step and the fight-with-it seam (`playerWeapon` from
`equipped.main`) are the lead's/Combat's. Tests: the loot.glb pin now compares ARMOUR ids to the file's draws (loot-data + loot-wear);
a sibling pin walks every weapon piece → PLAYER_WEAPONS member, main-hand paperdoll, its opponent's roster weapon, equip file present
with WeaponDrawn and its WEAPON_CLIPS family; every ladder warden's weapon is a piece; `dropFor` never returns a weapon; a taken weapon
cleans/wears/unwears only in `main`. Whether a weapon is OFFERED stays `PLAYER_WEAPONS_OFFERED` (Combat's fairness table), untouched.
Shelf status for the lead's (b): all six equip files ship complete as wieldable since #309 — cleaver/knife/estoc on the sword family
(+ a re-keyed Heavy for cleaver/knife; the estoc re-keys nothing by design), scythe/trident/warhammer with their 13/13/12-clip families;
every one has a hero bake pinned by `tests/blade-rig.test.ts`. No family is missing; what gates each weapon is the runtime equip + fairness.

## Flat blade table dropped — `bladePathsByRig` is the only export (weapons lane, 2026-09-22)
The seam PR landed (`src/blade.ts` reads `bladePathsByRig[rig][weapon]`, `tests/blade-rig.test.ts` pins every pair), so
`bake-blades.mjs` no longer writes the transitional flat `bladePaths[weapon]` (the first manifest entry per weapon) — `src/blade-paths.ts`
496 KB → 270 KB, `bladePathsByRig` byte-identical. The last readers were tests: repointed to the rig each one means (hero for
longsword/trident/cleaver/scythe, goblin.knife, nightborn.estoc, minotaur.maul, wraith.reaper); the manifest test now checks every bake
carries all of its weapon's paths and every non-placeholder weapon is baked on some rig. The dead placeholder-borrowing loop in the
bake (no `placeholder` weapon exists) went with it. Closes auditer finding #6 on the merged weapons PRs.

## Player-wieldable weapons — equip files + blade tables by rig (weapons lane, Brief 5, 2026-09-21)
Six loot weapons on the shelf as their own files, `src/assets/weapons/player/<id>.glb` (`scripts/build-player-weapon.mjs`): the
hero build's `WeaponDrawn` in `hand_r`, the skeleton as empties, and only the clips the weapon owns (family + re-keyed `Heavy` for the
cleaver/knife + the Quiet One solved from the weapon) — packed 209–884 KB, nothing in `warrior.glb`, per-fight budget unchanged
(8,817,201 gzip). `blade-manifest.json` gained `rig` and `attach`; `bake-blades.mjs` emits `bladePathsByRig[rig][weapon]` beside the
unchanged flat table (Combat's nested lookup + `Fighter.rig` + the pin land from their lane; until then the flat export is what the sim
reads). Facts: cleaver/warhammer/trident/scythe in the player's hand bake identically to their shipped tables; knife (Goblin rig,
0.816 m off) and estoc (Nightborn body, 0.148 m off) have new `hero` tables baked from the equip files on `warrior.glb`; each equip
file's bake equals a full hero-rig bake (verified all six). Draw vs armed: owner "go" on armed + ready stance (Strategy session).
Open: Combat's runtime equip + sim lookup; the per-weapon battery per rung (Combat); `warrior.glb` lags a rebuild in `Death_QuietOne`.

## Dwarf warhammer — integration of the weapons lane's shelf package (2026-09-20)
Owner: the Dwarf gets a warhammer instead of the Veteran's trident. Weapons shipped `warhammer` on the shelf (#233, weapons/warhammer-v1:
part, 12 `Warhammer_*` clips on the base humanoid rig, WEAPON_CLIPS, `WEAPONS.warhammer = {...MAUL, placeholder}`). Character lane
(`char/dwarf-warhammer`, on top of #233): the donor is rebuilt with `WARRIOR_WEAPON=warhammer`, the Dwarf refitted and packed (37 clips,
185 finite poses, both hands on the haft < 0.08 m, source maps retained; sha 82dab728…), roster `weapon: 'warhammer'`, the creature
browser check keys on the `Warhammer_*` family, and the role-table test maps the warhammer to dwarf.glb. Still Combat's: the reach band and
lifting the `placeholder` flag (the sim uses the maul's numbers until then); the browser gate and the deploy stay with the deployer.

## Warhammer — the Dwarf's, on the shelf (weapons lane, 2026-09-20)
Owner: "Create the dwarf hammer / war hammer - should be medium size". Part (0.93 m, square face on +x, back-spike, langets), the
12-clip `Warhammer_*` family on the humanoid rig (the trident's machinery shared as `twoHandFamily()`, Veteran byte-identical),
`WEAPONS.warhammer` = the maul's set, PLACEHOLDER (Combat sets the .78-fighter reach), `WEAPON_CLIPS.warhammer`, manifest + baked
table, shelf rig `veteran-warhammer.glb`, pose sheets. Grip check at the Dwarf's .78: both wrists ≤ 0.071 m from the haft on the five
grip roles. Next: character lane integrates (donor rebuild `WARRIOR_WEAPON=warhammer` → refit → roster `weapon: 'warhammer'`).

## Weapons Phase 2 polish — reconstructed parts, in progress (weapons lane, 2026-09-20)
Owner reversed the freeze for weapons: polish all of them now for beta, keep the procedural parts as the revert. Trident (Veteran)
and cleaver (Pitborn) ship as TRELLIS.2 reconstructions fitted by `scripts/weapon-fit.py` on the unchanged contact segments
(`bake-blades` tables identical; `WEAPON_VARIANT=short|A` rebuilds byte-identical to the previous rigs). Knife (Goblin), estoc
(Nightborn) and longsword (hero, hand + scabbard) followed in v2 the same way; the scythe part is fitted but not on a rig (the
Executioner's donor re-pack is the character lane's) and maul/claws/reaper (creature injector) are not started. Skeleton,
dwarf and werewolf pick the new parts up on their next creature pack. Evidence: `artifacts/weapons/REPORT.md` "Phase 2 polish".

## Wraith reaper scythe — weapons lane, in progress
Owner replaces claws with a massive two-handed reaper, explicitly distinct from Executioner. New crescent geometry, dark swept haft, twelve Reaper clips and dedicated blade-edge contact marker; original25 base/finisher clips, body maps/skin and1.5 spectral scale retained. Minotaur differs only in shared generator provenance; all seven non-Wraith baked paths unchanged. CPU grip, torso, exact animation/contact, inner/outer reach and AI approach/escape tests pass; visual acceptance and public deployment remain pending the lead-coordinated GPU/release window. Evidence: artifacts/weapons/wraith-reaper/. PR167 finisher repair integrated; rerun Wraith Opened split/fade/ground behavior before release.

## Creature weapons — weapons lane, 2026-09-19
Owner enables stone maul for Minotaur and bare claws for Wraith. Additive offline authoring preserves original creature surfaces/maps/weights and old clips. Twelve new clips per creature cover ready/gaits/attacks/guard/reactions/death/roll/kick. Maul front hand slides within reach; Wraith contact is derived from actual hand/finger vertices and includes its existing 1.5 presentation scale in the bake. Maul shove samples the haft, other attacks sample the stone head. New geometry/contact regression covers all new clips, exact baked/rendered paths, close hits and measured outer misses. Existing head-region grid now uses each weapon's actual timing instead of the sword clock; all previous expected regions remain pinned. All26 configured local gates passed, including real-game creature damage/death/rematch. Integrated draw-bell trunk e8670fa; full quality293/293 and both affected audio gates pass. Final front/side/rear pose sheets reviewed. Creature browser gate now selects full Chromium consistently with the combat gate; default headless-shell timing failures and diagnostics are retained. GitHub Actions did not start because of account billing/spending limits; no CI success claimed. Full contract and deployment receipts: artifacts/weapons/creature-weapons/. Public release authority remains release.json plus live/receipt.json; physical handset review remains owner-only.

## Polearm rear-arm visibility — weapons, 2026-09-19
Owner's rear/front phone captures exposed a second pose defect after PR157: the rear hand was authored on +X (the rig's left side), sending the right elbow through the torso. Both arms and their skin weights were present. Reauthored ready, gait, guard, attack and reaction goals keep the rear grip on the right side; the raised attack passes in front of the shoulder, and supporting-hand slides stay reachable. The shared polearm IK bends outward and forward while retaining the anatomical hinge constraint.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. New 120 Hz regression samples both upper/lower arms against the posed torso core in all clips; the old shipped rig fails it. Existing hinge, grip, contact-height, head-region and reach pins pass. Mesh attributes, material definitions, texture pixels and 2,354 non-arm tracks per rig remain unchanged. A new completion gate captures front, side and rear views at eight ready/gait/guard/attack poses. Initial full quality: 267/267 plus build/audit/budget/browser PASS; account-integrated CPU quality: 270/270. Integrated Quiet One and warm dust trunk 1ee616d, regenerated the three rigs with Death_QuietOne retained, and made its append-preservation fixture cover full exports and additive rigs. All 16 contract commands, final gates and release receipts are recorded in artifacts/weapons/polearm-rear-arm. Sentry FRANKENDOM-5 latest event is texture loading on 714e969; FRANKENDOM-6 is a stackless load failure on f7a1e99. Neither explains the reproduced offline pose; neither is claimed resolved. Physical-phone review remains owner-only.

## Polearm elbow correction — weapons, 2026-09-19
Owner reproduced inward, twisted elbows on the Executioner and Veteran in the live game. Their correct polearm gait clips were already selected. Offline IK used reversed left/right bend poles for this rig and shortest-arc bone aiming left axial roll unconstrained. Polearm-only authoring now places elbows outward and aligns the anatomical hinge from the library stance; sword authoring and all combat timings stay unchanged. The Executioner slides his supporting hand down the haft during the raised wind-up to stay within reach.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. A 120 Hz shipped-rig regression checks every polearm clip for hinge direction and front-wrist distance, plus outward elbows throughout ready gaits. Original shipped rigs fail this regression. Mesh attributes, material definitions, texture pixels and all 2,354 non-arm animation tracks per live rig are unchanged (procedural PNG compression bytes vary on rebuild). Close-up render evidence and validation logs: `artifacts/weapons/polearm-elbows`; delivery is tracked in PR #157. Integrated camera/audio trunk `a8e72e6`: full quality 265/265, build, audit, budget and browser PASS. New real-game desktop/phone-viewport polearm gate verifies served asset hashes and actual polearm playback. Physical-phone validation remains owner-only.

## Button-consistent parry counters — weapons, 2026-09-19
Owner authorized fix and deployment. After a successful parry, Slash selects `slash_riposte` with each weapon's cut clip
and a separately baked collision path; Stab retains `riposte`; Heavy retains `heavy_riposte` (or the earned posture critical).
The counter cut keeps that weapon's existing riposte damage, stamina and timing. The scythe reap retains its 1.4 m dead band;
the trident counter sweep uses its low direction. Ordinary blocks still yield normal Slash/Stab and the existing Heavy counter.
No new control or GLB. Field Journal now describes the actual buttons. Audio's fixed thrust exchange explicitly presses Stab.
Verification: real-touch browser captured the hero's Slash/Attack/24, Stab/Riposte/24 and Heavy/Heavy/30 after actual parries.
Regression checks all light inputs, Stab and Heavy after a real parry, reward consumption, costs, damage and ordinary blocks.
Restoring the old forced-thrust selector fails the regression. Render/bake tests include the new path across weapon families.
The first full run exposed two old assumptions: the AI opener filter counted earned counter cuts as ordinary openers, and
an audio fixture pressed Slash to request its fixed thrust. Those fixtures now name the correct moves; focused 83/83 pass.
Integrated full quality passes 250/250 tests, lint, build, audit, budget and the shared browser gate. Estoc #142 is merged
as d3114a9 with Split Crown #144 preserved. All earlier blade tables are byte-identical; only the new counter paths are added.
Completion and release receipts: `artifacts/weapons/counter-buttons/`. Public deployment remains pending.

## Estoc A activation — 2026-09-19 — PR #142, NOT DEPLOYED
Weapons branch `weapons/estoc-live`, based on trunk `d383b66`. Variant A is built on the current Nightborn,
with matching render/bake GLBs, manifest entry, real ESTOC data, rebaked paths and flipped shelf receipts. Existing clips,
body geometry and textures preserved; all five other weapon trajectory tables unchanged. Preview `--azimuth` added.
The longer point initially registered head hits on the upright Nightborn. The estoc part now carries a 10-degree grip tilt,
composed with the hand attachment by the builder. Only WeaponDrawn's quaternion changes in the GLB: geometry, animations,
textures and every other node remain identical. The unchanged head-region rule passes; no contact remapping or clip edits.
A new real-duel regression checks non-head contacts and measured cut/heavy/thrust frontiers of 2.0/2.5/2.3 m.
Restoring the old blade paths makes that regression fail. The .75 thrust share remains necessary: .70 still fails the unchanged
roll-and-punish cap (3/24 untouched); .75 passes both fairness batteries. AI-vs-AI median 20.9 s, hero wins 9/24.
No AI, damage, timing or spacing edits. Full `npm run quality`: 246/246 tests, build, audit, budget and browser gate PASS.
Estoc browser completion verifies the served rig SHA, WeaponDrawn, portrait/landscape layout and an opponent hit.
Evidence: `artifacts/weapons/estoc-live/` (logs, browser JSON, probes), `estoc-aim/` (reviewed captures).
Lead owns roster integration and deployment; no weapons-lane deployment was attempted. Physical-phone validation outstanding.
Sentry still has earlier unresolved load/texture/WebGL issues (6/A/5/9/8); this unshipped branch cannot resolve those.

## Trident v1 — the weapons lane — 2026-09-16
- Branch `weapons/trident-v1` from trunk 86189a5 (slice U). The Veteran's short trident: a rigid part under `hand_r` (`WeaponDrawn`,
  `extras.contact` on the tines, 652 triangles, no textures) and 13 original clips on the rig (`Trident_Idle/Walk/StrafeLeft/StrafeRight/
  Thrust/ThrustChain/Sweep/High/Guard/BlockImpact/Deflected/Hit/Death`), all two-handed; built by `scripts/build-weapon.mjs` through
  `build-warrior.mjs` (`WARRIOR_WEAPON=trident`, default output byte-identical) into `src/assets/weapons/trident/veteran-trident.glb`
  (not imported by the runtime: the bundle is unchanged until the render lane switches the opponent).
- Data: `WEAPONS.trident` is real (`TRIDENT_MOVES` / `TRIDENT_PATHS`, guard `shaft`, material `bronze`), baked from its own rig via
  `scripts/blade-manifest.json`. Slash = low sweep, Stab = thrust (chains into a second thrust), Heavy = the overhead pin. Measured
  against a standing target with the owner's pick (variant `short`: B's wide fork on a 60% stick, 1.42 m, brown shaft; the thrust reaches
  by driving the rear arm to full extension): thrust lands to 2.25 m (sword stab 2.0), sweep 1.75 (cut 1.7), pin 2.15 (heavy 2.2);
  every `reach` is that number (tests assert ±0.1 m). All numbers provisional — GAMEPLAY CHANGE for combat review; nothing changes on trunk (`initialDuel`
  still longsword vs longsword).
- Harness: `scripts/character-preview.mjs --weapons [--enemy <glb>]` — weapon turntable, on-rig close-ups, clip sheet, 393×852 /
  852×393 lock stills, a 6 s scripted exchange, a cost table; baseline and three passes under `artifacts/weapons/` (REPORT.md).
- Evidence: tests/weapons.test.ts 8 tests (rig + contact segment + clip set, clips agree with the data's contact keys, reach frontier);
  quality gate per the PR. Requests to other lanes in `artifacts/weapons/REQUESTS.md`: the renderer's per-weapon clip list and weapon
  node (the trident is not visible in the game until then), the combat flip and review, a rule for "weak inside the point" (the sim
  sweeps the tines from the wind-up pose, so a thrust lands from 0.4 m like the sword's), the shaft guard profile. Silhouette picked
  by the owner 2026-09-16 (`short`); A/B/C remain as `WEAPON_VARIANT` options.

## Cleaver v1 — the weapons lane — 2026-09-16
- Branch `weapons/cleaver-v1` (stacked on #80 trident + #81 Pitborn seam). The Pitborn's cleaver: "a fat scythe-type cleaver, wider and
  the same length as the longsword" (owner). A procedural single-edged loft (0.19 m belly toward a hooked tip, 0.20 m forward sweep, 615
  triangles, no textures; silhouette A picked by the owner 2026-09-17, B/C remain options) under `hand_r` as `WeaponDrawn` (contact = the edge .14–.86). It rides
  the **sword's clip family** — same 21 clips, same order; only `Heavy` is re-keyed on its rig as a diagonal hack so the edge leads
  (edge·motion .95 vs the sword's .68) — so the renderer needs nothing; `pitborn-cleaver.glb` is his own body carrying it, and the
  shipped `pitborn.glb` takes it with the build flag + one test relaxation (REQUESTS §5). Baked at 1.0× like his sword; at his real
  1.13× the chop reaches 1.85 and the whiff punisher goes 0/24 — the scale call is the combat lane's (REQUESTS §6). `build-warrior.mjs` takes a per-weapon `{ part, clips, keys }` table; default output byte-identical.
- ON THE SHELF (the lanes' split): `CLEAVER` is exported real data — the chop (17, chip .2), the back of the cleaver (the backhand leads
  with the spine: 9 dmg, posture 34 — a hammer), the hack (26, chip .5, posture 42), the poke (7) — but `WEAPONS.cleaver` still borrows the
  longsword and there is no manifest entry: the Pitborn is unchanged until the combat lane flips it (REQUESTS §5). Measured for that flip:
  with lunges equal to the sword's and the sword's reach convention, the Pitborn battery passes 4/24 normal · 6/24 hard with 6/24 stalls at a
  1.0× bake; at his 1.13× the whiff punisher goes 0/24 (REQUESTS §6). The whiff-punisher script now reads the warden's own weapon table.
- Evidence: tests/weapons.test.ts +3 (rig + clip set + edge segment; edge-leading per cut; reach and lunge parity with the sword),
  169/169; `artifacts/weapons/REPORT.md` (cleaver section), sheets under `artifacts/weapons/cleaver-v3/`, `cleaver-B/`, `cleaver-C/`.

## Knife v1 — the weapons lane — 2026-09-17
- Branch `weapons/knife-v1` (stacked on #86 goblin + #82 cleaver). The goblin's short hooked knife: a **sica** — forward grip, inward hook,
  double-edged over the hook so the backhand cuts — 943 triangles, no textures, a 0.42 m blade in his 0.81× hand; his own re-proportioned rig
  carries it (`src/assets/weapons/knife/goblin-knife.glb`) on the sword's clip family, only `Heavy` re-keyed (the diagonal hack). On the shelf:
  `KNIFE` exported (the character lane's proposed timings: wind-ups ≥ 12, feints ≈ 40 % of the wind-up, damage/cost below a sword's; the
  critical's cost 26 → 20), `WEAPONS.knife` still the placeholder, no manifest entry.
- Measured on his rig with the knife's timings: slash lands to 1.2 m, stab 1.45, hack 1.55 (a man's sword 1.7 / 2.0 / 2.2; his placeholder
  today swings the man's table). The character lane's reverse-grip suggestion rejected with numbers: on the sword's clips it never lands (0 m
  at every gap) — it would need its own clips. Owner picked A, the sica (2026-09-17); C stays an option (REQUESTS §11).
- Evidence: tests/weapons.test.ts +4 (193/193 on the merged tree), `artifacts/weapons/REPORT.md` (knife section), sheets `knife-v1/`,
  `knife-B/`, `knife-C/`, `goblin-baseline/`. Hand-off to the combat lane: REQUESTS §9–10.

## Estoc v1 — the weapons lane — 2026-09-17
- Branch `weapons/estoc-v1` from trunk 9d08824. The Nightborn's estoc: a long, thin, thrust-first square-section blade with no edge,
  black iron cross + side ring, wire grip — 1,252 triangles, no textures, contact = the last 40 cm (the point); his own rig carries it
  (`src/assets/weapons/estoc/nightborn-estoc.glb`) with EVERY clip byte-identical to nightborn.glb (nothing re-keyed). On the shelf:
  `ESTOC` exported (the sword's timings and lunges exactly; cuts weaker, no chip; the thrust stronger and chaining; the riposte his payoff;
  `fight.thrustShare .7`; material `'steel'`, a new word in `Material` for audio), `WEAPONS.estoc` still the placeholder, no manifest entry.
- Measured on his rig: the blade lands 0.30 m past the sword everywhere (thrust 2.35, cut 2.0, heavy 2.5); `reach` stays the sword's
  conservative numbers per his brief, the margin reported for combat review. Owner's pick pending: A estoc (default), B rapier cut, C long
  tuck (REQUESTS §14). Hand-off: REQUESTS §12–13. Tests: 224/224.

## Scythe v1 — the weapons lane — 2026-09-18
- Branch `weapons/scythe-v1` from trunk 7ee6e34. The Executioner's scythe (owner picked B over axe, 2026-09-18: the axe duplicated the
  Pitborn's cleaver): 1.32 m haft, 0.74 m blade, sweep .30, iron `#4c4946` — 495 triangles, no textures, contact = the head (1.22–1.32 m).
  His own 1.36× rig carries it (`src/assets/weapons/scythe/executioner-scythe.glb`) with a 13-clip `Scythe_*` family authored on it (the
  trident's two-hand grip solver, per-key blade roll so the crescent reads from the game camera). On the shelf: `SCYTHE` exported,
  `WEAPONS.scythe` still the placeholder, no manifest entry; the combat lane's flip is REQUESTS §15–17 and every part of it is a
  GAMEPLAY CHANGE (new timings, shaft guard profile, chip profile, the arc's dead band).
- Measured on the man-scale bake rig `warrior-scythe.glb` (the cleaver convention — his own 1.36× GLB bakes over a man's capsule and
  everything whiffs): reap lands 1.40–2.10 m, the headsman's high 2.30, the heel-jab 2.05; `reach` = the conservative spacing estimates
  1.8 / 2.0 / 1.8. The dead band is 1.40 m, not the brief's ~1 m — flagged for combat review. The bake caught and the rig test now pins:
  the striking segment must sit ON the target line at the clip's contact key (the first reap keyed it 0.7 m past the crossing and the
  whole active window whiffed).
- Evidence: tests/weapons.test.ts +4 (231/231 on the branch; shelf state, rig contract, contact-pose regression guard, data rules),
  `artifacts/weapons/scythe-notes.md`, sheets `scythe-A/`, `sche-B/…`, `scythe-C/`, `scythe-v1…v5/`, `executioner-baseline/`.
- 2026-09-18 (world lane): motes doubled 260 → 520 per owner live feedback ("motes are good. just double their number") after the
  half-size deploy (PR #123). Size stays 0.1 m, opacity 0.62, drift and gust unchanged — same specks, twice the air.
