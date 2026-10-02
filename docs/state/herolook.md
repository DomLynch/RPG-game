# Hero Look — project state (AAA-look pilot)

Lane opened 2026-09-26 19:2x +04 by Strategy on Dom's order ("good, let's use a custom dev for this, as a test"). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md). Folder `~/Developer/frankendom-herolook`, session name **Frankendom - Hero Look**, key `herolook`. Reports to Lead; Lead sends Strategy milestones. Read `docs/briefs/armour-sets-direction.md` and its folder `docs/briefs/armour-sets/` first.

## 2026-10-02 07:1x (+04) — HANDOFF before /clear (Dom). READ FIRST, then the 2026-10-01 19:5x entry below, then memory `herolook-1002-albedo.md`

**LIVE** 51e092ae (my curl 07:10). No lock of mine, no run in flight, no cron. Nothing of mine runs on the Mac or the VPS (all shoot scripts finished; VPS scratch kept: `/opt/frankendom-shadow/work/herolook/pack/exhood/{nb,ex3,nbpr,wt}`, tools `nlift.py`, `mkd.py`, `matchfull.py`, `nonmetal.py`, `nonmetal2.py`, `hoodlift.py`, `regionstats.py`, `tex2.py`, shoot4..12.sh). HF freeze: no ZeroGPU calls made.

**Went live / merged today.** #1243 Executioner hood lift (merged), #1221 sweep doc (merged), per Lead. Not mine: nothing of today's work below is live.

**NOT LIVE (waiting for Dom's yes, then Auditer; both are HOLD, out of draft so CI runs)**
- **#1282 Nightborn L9** @3de1435b3: phone file steel-green (atlas median 25→38, baseColorFactor 0.22/0.95/0.34→0.30/0.62/0.40) + full file atlas matched per channel to the phone result (tint stays [1,1,1]). Strategy PASS. CI green, real check-budget: nightborn 22,726,221 of 22,800,000, nightborn-phone 13,729,338 of 16,000,000. Stills on branch `stills/nb-l9-albedo`.
- **#1305 Executioner L3** @0f7e2dbc6: phone file, Body-prim texel lift, median luma 31→55, webp q80. Strategy PASS at 55 (reject 70 = ash-grey in Rain Yard), Night Pit idle PASS. CI green (11 pass, 2 skip); real check-budget: executioner-phone 14,269,802 of 14,300,000 (30 KB headroom, tight: Exec L8 would add to this set), executioner 22,185,403 of 22,300,000. NOT yet sent to Lead: this CI figure. Stills on `stills/exec-l3-body` (@3df2d8d4a).
- #1195 legend portrait review: still DRAFT, DIRTY (needs a rebase), Strategy reads, repaints parked.

**Worst-5 status (Strategy's list, by Lead's order)**
- Nightborn L9 = #1282. Executioner L3 = #1305.
- **Executioner L8**: stills with Strategy since ~00:00 (`~/Desktop/Business/artifacts/herolook-executioner-L8-body-20261002/`, branch `stills/exec-l8-body` @fa4bb70d9). Body prim only (geometry_0.002), median 25→55, webp q75. My read: visible but modest, plate stays near-black (47% of the body prim is metal >200). NO PR until Strategy says. Trial file `E8-B55q75-executioner-L8-phone.glb` in that folder.
- **Dwarf L8**: non-metal albedo lift (body 27→53, Lining 2.6→35, plate untouched) gave NO readable gain at 375; no halo/seam at the mask edge. My recommendation: do not ship. NO PR (Lead: wait for Strategy's line). Files in `~/Desktop/Business/artifacts/herolook-dwarf-nightborn-L8-20261002/`.
- **Nightborn L8**: albedo 51 accepted, reads in the Night Pit (helm and plates show), done, no change.

**Rulings today (memory `herolook-1002-albedo.md`)**: metalness x0.6/0.4 = no visible effect, theory closed; NB L9 A (48 median) and C (38) fail as emerald/plastic, D (38 + steel-green tint) passes on sand; the Pit is a World lighting question, no more rounds from me; one opponent = one look (phone and desktop must agree); matched crop is the right fix when the idle camera can't be pinned, say so in the PR body; PRs that CI should run on go OUT of draft with a HOLD line first in the body; route messages to Strategy through Lead (Lead may restart; if Lead is cleared, address Strategy Dev by title).

**QUEUE, in order**
1. Send Lead the #1305 CI check-budget figure above (owed).
2. Wait for Strategy's line on Exec L8 (PR or not) and Dwarf L8 (drop). If Exec L8 gets a go: branch from trunk, replace `public/looks/executioner-L8-phone.glb` with the trial file, check the executioner-phone set against 14,300,000 (it is ~30 KB under after #1305; L8 q75 is 7.7 KB SMALLER than the trunk file, so it fits), PR out of draft with HOLD, stills from `stills/exec-l8-body`.
3. GPT hero r3: brief written, Dom hands it to GPT (`~/Desktop/Business/artifacts/frankendom-hero-r3-20261001/BRIEF.md`). When it lands I judge it at the 375 fight-camera still (current hero beside r3, sand + night, idle + Heavy frame); deltoids −15%, neck join closed, r2 tunic kept.
4. If Dom ships #1188 (Shieldmaiden gloves): Shieldmaiden L2–L10 after-sweep is mine (sweep.sh pattern, VPS).
5. #1195 needs a rebase before it can leave draft (Strategy reads first).

**Where things are.** Worktree `/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/happy-mahavira-532342` (app worktree; branches herolook/nb-l9-albedo = #1282, herolook/exec-l3-body = #1305, this doc on `herolook/state-1002`; scratch worktrees for stills branches in the session scratchpad, throwaway). Tell Dom once: reopen me on ~/Developer/frankendom-herolook with the worktree switch off. VPS capture is first-come queue: call `capture herolook ...` directly, jobs under ~10 min; shoot scripts must run as `su frankrows` (root trips git "dubious ownership"); never edit a running bash script with `sed -i` (new inode, the run keeps the old one: overwrite the file it copies instead). Tex lookups: find the Rebaked material's baseColor/MR texture through `textures[].source` (Dwarf's are images 2/3; reading image 0 gave me a wrong Dwarf atlas stat once).
**Addressing:** Lead = "Frankendom - Lead Developer" (session id changes; ListAgents), Strategy = "Frankendom - Strategy Dev", Executioner lane, Auditer + fixer.

## 2026-10-01 19:5x (+04) — HANDOFF before /clear (Dom). READ FIRST, then the 15:5x entry below

**Now.** Nothing of mine runs on the Mac. No crons. All VPS jobs are FINISHED (no waiters). Frames below are NOT YET READ.

**PRs (all verified 19:5x with gh pr view):** #1243 Executioner hood lift L2/L3/L4/L6 (head 2c54cc50, DRAFT: Dom's yes + Strategy's READY; Executioner lane PASS with one open point; Auditer PASS incl. check-budget exit 0, L3/L6 phone rank-look rows PASS). #1221 sweep 100 pairs (open, not draft, waiting to merge). #1195 legend portrait review (DRAFT, Strategy reads it; READY via Lead; repaints parked, GPT paused). HF freeze (Dom): no ZeroGPU calls; I made none.

**Open work, in order**
1. **Iron half-mask check for #1243 (Executioner lane's one open point).** Do not leave draft until settled. Close-ups finished: VPS `/opt/frankendom-shadow/work/herolook/pack/exhood/closeups/L{2,4,6}{before,after}-{front,head}.png` (tool: Weapons' closeup-src, SwiftShader, clip=null so the pose may be a bind pose). Read them: does the iron half-mask still read at the front/head after the lift? If the mask is in the Hood draw, exclude its texels (hoodlift.py mask) and re-push. Send the crops to Executioner lane [e539f8]. Atlas crops were inconclusive (fragmented rebake). Numeric check already sent: hood-core texels shared with other meshes 0 in all 8 files; lifted mask overlaps one texel (L2 full); other meshes change by webp noise only (mean 1.1-2.6/255).
2. **Metalness experiment (Strategy/Dom, nothing ships before Dom sees stills).** Hypothesis: fully metallic dark-base rebakes read black (worst-5: nightborn L9, nightborn L8, executioner L8, dwarf L8, executioner L3). Variants: every material's metallicFactor x0.6 and x0.4 (JSON-only, `jsonmetal.py`), phone files, own arena + sand. Frames: `pack/exhood/wt/artifacts/herolook/mtl-{before,m06,m04}-{nightborn,executioner,dwarf}-{own,sand}/0N-<Tier>-{idle,fight}.png` (nightborn Primus+Invictus, executioner Primus, dwarf Primus; dwarf job was the last, check it finished: shoot2.log "SHOOT2 DONE 15:43"). Read them, build a before|0.6|0.4 sheet per look (grid script pattern in pack/exhood hood-*.jpg: PIL on the VPS, scp the jpg), send Strategy the curve + a verdict. Executioner L3 body lift (b) not started (same hoodlift.py on the Body mesh).
3. Executioner hood: L5 dropped (lift made it vivid orange); L7 untouched (median luma 43). Goblin L3/L9 = lighting (shadow band), not asset, closed.
4. If Dom ships #1188 (Shieldmaiden gloves) the Shieldmaiden L2-L10 after-sweep is mine (sweep.sh pattern, VPS).

**Findings to carry**
- Executioner hood texels were near-black in the atlas (median luma 8-17 of 255 vs bodies 32-125); fix = per-channel power lift of atlas texels under the hood triangles only (median -> 44), same-size lossy webp q85. executioner-phone budget re-pinned 14.25 -> 14.3 MB (phone set 14,266,134 B, full 22,196,127 B).
- Mac `rank-look-check` wants its own stamped dist: pass `--build`.
- VPS `capture` is first-come-first-served since 2026-10-01 (v2.4). Polling for FREE never wins: call `capture herolook <cmd>` directly (CAPTURE_WAIT_S=14400). A job over ~10 min gets a warning: split per opponent. A killed waiter ("Terminated") drops its ticket: resubmit.

**Tools (VPS `/opt/frankendom-shadow/work/herolook/pack/exhood/`):** hoodlift.py (image-only texel lift), maskcheck.py, regions.py, shoot.sh (hood before/after), shoot2.sh (metalness, one lock job per opponent), shoot3.sh (close-ups), metal/{06,04}/ (variant glbs), out/ (fixed looks), wt/ (trunk worktree with dist-exh built). Mac scratch /tmp/exh (geomdump.mjs, glbtex.py, jsonmetal.py) may not survive. Stills branch `stills/exec-hood` (hood sheets, linked from #1243).
**Mac:** branch herolook/exec-hood = #1243 head; worktree session folder; node_modules symlink. Scratch git clones listed to Lead as throwaway, nothing deleted.
**Addressing:** Lead is cleared; Strategy = "Frankendom - Strategy Dev"; Auditer "Frankendom - Auditer + fixer - Fable 5.1"; Executioner lane [e539f8]. Tell Dom once: reopen me on ~/Developer/frankendom-herolook with the worktree switch off.

## 2026-10-01 15:5x (+04) — Job 2 closed: live rank sweep 100/100 pairs (PR #1221). READ FIRST

1. **Live sweep, every character x rank** (iPhone UA, 375, real fight): table in `docs/state/herolook-sweep-2026-10-01.md` (PR #1221). All 100 pairs captured: the 97 with a look returned the look file 200, state `on`, 0 console errors; the 3 base rungs (goblin L1, veteran L1, veteran L6) request no look, state `none`, 0 errors. Live was e65a6d8d for the first 24, 0f9a09c1 for the other 75 (no change mid-run).
2. **One finding:** Executioner L2-L7 hoods read as a flat black shape at the fight camera (Armour owns those hoods); Goblin L3 and L9 near-black in the shadowed arena. Goblin loads the full file (not in PHONE_LOOKS), as expected.
3. **Job 1 = PR #1195** (legend portrait review, 30 of 100 flagged, draft until Strategy has read it; READY via Lead; its branch carries a 23:5x state entry). HF freeze from Dom: I made no ZeroGPU calls.
4. **Nothing in flight.** Open: dark disc with a white arc over the Knight's chest on a kill frame (unexplained); if Dom ships #1188 the Shieldmaiden L2-L10 after-sweep is mine. VPS tools: `pack/sweep.sh`, `sweep2.sh`, `live-cur/scripts/live-rank.mjs`, `sheet-sweep.py`, `grid.py`.

## 2026-09-30 21:4x (+04) — HANDOFF before /clear (Dom's order). READ FIRST, then the 21:1x entry below

**Now.** LIVE 64d13481 (my curl 21:4x). Two VPS jobs of mine are QUEUED and detached (they survive the clear); nothing of mine runs on the Mac. No crons. No PR of mine is open except the parked #1095 and #940.

**In flight (both wait for the VPS capture lock; Weapons' scstills.sh held it at 21:4x)**
1. `pack/live-batch.sh` → `pack/live-batch.log` (empty at 21:4x = still waiting for the lock to read FREE twice a minute apart). It then shoots Pitborn, Shieldmaiden, Executioner and Witch at rank 1 ON LIVE, phone user agent, 375 wide: frames in `pack/live-cur/artifacts/live-<opp>-L1/` (`A-idle.png`, `A-hit.png`, `B-kill-NN.png`, `live.json` with the network log and look state). Asked for by Lead (Pitborn + Shieldmaiden, check the SM gloves read tan) and Strategy (all of today's L1s).
2. `pack/pb-l2-shoot.sh` → `pack/pb-l2-shoot.log` (waits for job 1). Pitborn Legionary at the fight camera, full + phone, with throwaway copies whose steel chart is brightened (`pack/smfix/l2/`, NOT shippable): output `work/weapons/pb-tree/artifacts/herolook/pitborn-L2-rungs-{full,phone}-steelfix/02-Legionary-{idle,fight}.png`. Before frames: the same tree's `pitborn-L1-rungs-{full,phone}-cc0bddd7/02-Legionary-*.png`.

**Next, in order**
1. When job 1 is done: fetch the frames, one sheet per look (idle, hit, kill; `tools-herolook/sheet.py` is the pattern), read `live.json` (the `-phone.glb` must be the file that loads, state `on`, 0 errors), check the Shieldmaiden's gloves are tan. Send Lead one line + the frame paths; send Lead and Strategy the stills with one line per look ("as delivered" or "defect: …"). The Knight L1 was shot at 19:5x on 43b7bc35 (frames on Weapons' #1181).
2. When job 2 is done: before/after sheet of the Pitborn's steel at the fight camera → verdict "visible / not visible" to Lead and Strategy. Lead's rule: a re-cut only if the still shows the difference; no new PR until then. If visible: Armour's route is `~/Desktop/Business/artifacts/looks-from-armour-worktree/pitborn/tools/pitborn-ranks.sh` with the old tool `rebake-nb.py.pre-srgbfix-5e70d394` plus only the fold line (the bake intermediates for L2–L10 no longer exist).
3. Split agreed with Armour: mine = Pitborn head steel L2–L7; Armour = Executioner hoods L2–L7, Witch L8, Shieldmaiden gloves L2–L10.
4. Then ask Strategy for the next brief.

**Open questions**
- The handoff hook reads `docs/state/herolook.md` ON TRUNK (last updated 2026-09-26); this doc lives on branch `herolook/sand-legionary` only. Ask Lead whether it goes to trunk by a docs PR.
- Not explained, reported to Lead: a dark disc with a white arc over the Knight's chest on the kill frame of his live capture.
- Not checked: Executioner / Pitborn / Shieldmaiden / Witch L1 in a real fight on live (job 1 closes this).

**Where things are**
- Tools, durable copy: VPS `/opt/frankendom-shadow/work/herolook/pack/tools-herolook/` (sheet.py, pr-audit.py, live-look.mjs, partswap.py, sm-handfix.py, atlasswap.py, chartremap.py, the shoot scripts) and `pack/smfix/`, `pack/ring/`. Mac copies are in session c0915aff's scratchpad under /private/tmp (may not survive).
- Scratch git worktrees (merged branches, safe to remove with `git worktree remove`): session c0915aff scratchpad `w-pb`, `w-sm`; session 5d198e35 scratchpad `w-kn`, `w-ex`, `w-state` (this doc); session fab0f4ef `w-union`.
- VPS scratch kept on the Auditer's advice until Dom or Lead says: `pack/union-b1263`, `live-43b7`, `live-cur`, `ring`, `smfix`; Weapons' `pb-tree`, `sm-tree` are released by me but job 2 still uses `pb-tree`.
- Lead = "Frankendom - Lead Developer", Strategy = "Frankendom - Strategy - Fable 5.1", Armour, Auditer: address by name via ListAgents (sockets change on restart).
- Tell Dom once: reopen me on `~/Developer/frankendom-herolook` with the worktree switch off.

## 2026-09-30 21:1x (+04) — Pitborn L1 + Shieldmaiden L1 LIVE (64d13481, run BK); six Recruit looks shipped by this lane today. READ FIRST

1. **LIVE 64d13481** (my curl 21:04) = #1145's merge commit; #1137 merged as b176e82e. All four files HTTP 200 and byte-equal to trunk and to the PR heads: pitborn-L1.glb a9589a8e, pitborn-L1-phone.glb 66f5f160, shieldmaiden-L1.glb e38b3c30, shieldmaiden-L1-phone.glb 977310b7. **Not checked: either look in a real fight on live.**
2. **How (Strategy's brief 20:1x: take Weapons' #1137 + #1145 to READY; Weapons handed both over):**
   - No mesh redo: both phones pass ringout (Pitborn 10 cm, Shieldmaiden 12 cm; limit 25), skinoff 0, one skin, under 60k verts and 2.6 MB.
   - **Colour-fold bug** (found on the Shieldmaiden's dark phone hands): Armour's rebake-nb.py `maps_of` wrote sRGB texel × LINEAR baseColorFactor into the atlas, so any tinted material folded into a rebake came out too dark. Fixed image-only in both phones: Shieldmaiden gloves [40, 27, 17] → [110, 91, 72]; Pitborn steel (skullcap + shin plates) [6, 4, 3] → [39, 37, 34]. The fulls were packed, not rebaked: no folded tint. Armour's tool fix is #1183 (in BK).
   - #1137: NOT_WORN_AT { pitborn: { Recruit: ['Helmet'] } } (Lead: an L1 PR must not change L2–L10); Knight budget comment lines restored; union merge with #1140 Witch. #1145 stacked on #1137. Auditer PASS on 6a8e8239 and 16373992.
3. **Also today after 19:4x:** Knight L1 live fight capture on 43b7bc35 (phone file loads with a phone user agent, look on, 0 errors; frames on Weapons' #1181). Unexplained and reported to Lead: a dark disc with a white arc over the Knight's chest on the kill frame.
4. **Nothing in flight.** Nothing of mine on the Mac or VPS; no crons. Asked Strategy for the next brief. Parked: #1095 Goblin 256² (Dom: not for beta), #940 legionary sources (draft).
5. **Tools** (session c0915aff scratchpad, copies on VPS /opt/frankendom-shadow/work/herolook/pack): ring/ (ringout, unmeshopt; use Weapons' rbvenv python), hl-l1stills.sh + sm-reshoot.sh / pb-reshoot.sh (capture lock), sheet.py, live-knight.mjs (live capture; set a phone user agent), pr-audit.py (colour-fold audit on named files), smfix/ (sm-handfix.py flat repaint, partswap.py = take one draw's chart from a re-bake with the fixed fold, rebake-nb-fixfold.py).
6. **Gotchas:** re-baking a whole atlas shifts about half its texels by 1–7 levels even with the same inputs, so swap only the tinted chart; the mesh is deterministic. skinoff2 prints nothing at exactly 0. zsh: `$var:path` is a modifier, always `${var}:path`; an unquoted heredoc eats JS `${}`. Playwright's isMobile does not change the user agent, and live picks the -phone look by user agent. Lead's socket changes on restart: address by name via ListAgents. CI runners can queue repo-wide for 10+ minutes; a hung job can be cancelled and `gh run rerun --failed` without moving the head.

## 2026-09-30 19:4x (+04) — Knight L1 LIVE (43b7bc35, run BH); both L1 PRs of this lane are merged and live

1. **LIVE 43b7bc35** (my curl 19:42) = #1148's merge commit. /looks/knight-L1.glb b6d307c0 (6,723,088 B) and knight-L1-phone.glb 20209c7c (1,734,460 B): HTTP 200, byte-equal to trunk and to the PR head ad8b8c20. Executioner L1 (#1150) live since 1be74bb3, byte-equal. Not checked for either: the look in a real fight on live.
2. #1148 path: quality's first job hung in a runner step, re-run (no push), then a repo-wide runner queue; green 8/8 at 19:2x, un-drafted, sha to Lead, GO in BH.
3. **Nothing in flight.** Nothing of mine on the Mac or VPS; no crons. Asked Lead for the next task. Parked: #1095 Goblin 256² (Dom: not for beta), #940 legionary sources (draft).
4. Tools: ringout = ~/armour-builds/l1-work/persist-0930/bundle-knrecut/tools (unmeshopt first, LIM=0.25); VPS budget tree pack/union-b1263; stills pack/l1stills.sh. Lead's socket changes on restart: address by name via ListAgents.

## 2026-09-30 18:3x (+04) — Executioner L1 LIVE (1be74bb3); Knight L1 #1148 at ad8b8c20, draft, CI 7 pass + quality pending

1. **LIVE 1be74bb3** (my curl 18:3x). **Executioner L1 (#1150, merged 18:10, run BF) is live:** /looks/executioner-L1.glb e6e8893a and executioner-L1-phone.glb 5e001f1a, HTTP 200, byte-equal to trunk. Not checked: the look in a real fight on live.
2. **#1148 Knight L1: head ad8b8c20a9390be846c6b5816f5cd3ca3cd1d0a0** (trunk 1be74bb3 merged in; the L1-line conflict resolved from the union ref; tree 4fdc1e98 == union + trunk). tsc clean, rank-look.test 26/0. Carried from cd1bea40 (same L1 files): Multi Chars owner review PASS (Lead's read), ringout PASS (phone 15 cm, 0 v; PR comment 5912743861), Budget PASS on union b12630f2 (knight 26,403,984/26.5M, knight-phone 16,551,181/16.6M; PR comment 5912844514).
3. **NEXT:** quality green → `gh pr ready 1148` → full sha to Lead (run BG). No pushes to herolook/knight-l1. After BG: curl /looks/knight-L1.glb (b6d307c0) and knight-L1-phone.glb (20209c7c).
4. Knight owner = Multi Chars. The grey slab at the Knight's chest (also on L2) is with Weapons. VPS budget tree: pack/union-b1263.

## 2026-09-30 17:5x (+04) — Restart: #1150 READY (frozen), #1148 merged with trunk c59d4a46, still draft

1. **LIVE c59d4a46** (my curl 17:5x). Session runs in app worktree happy-mahavira-532342.
2. **#1150 Executioner L1: READY, frozen at cd7caf25024bbcc2bab6a54ebe3ef4494ce13a03.** My gh read: 8 pass / 0 fail; the Executioner lane's owner review on the PR says PASS. Sha sent to Lead. No pushes.
3. **#1148 Knight L1: head cd1bea407c031be6de67f5530973be7da49aba3a** (trunk c59d4a46 merged in, clean; #1164's Knight phone recut L2–L5 is in it). tsc clean, rank-look.test 26/0. Ringout gate (Armour's ringout.py, LIM 25 cm): L1 phone 20209c7c PASS, worst 15 cm, 0 v; L1 full PASS 8 cm; controls match #1164's table. Receipt: PR comment 5912743861. CI pending at 17:5x. Not run: check-budget on a build of the merged tree.
4. **Union ref rebuilt:** herolook/l1-knight-exec-union b12630f2 (tree 3838206a); 13462fda is stale.
5. **Remaining:** #1148 CI green + the Knight character-owner review (asked Lead who does it) → `gh pr ready 1148` → sha to Lead, then frozen. After the run: curl /looks/knight-L1*.glb and /looks/executioner-L1*.glb and compare shas with the committed files.

## 2026-09-30 16:1x (+04) — HANDOFF before /clear. READ FIRST, then the 15:56 entry below (its rulings, gotchas and worktree list still hold)

1. **LIVE 3fab84c4** (BA) by my curl at 16:1x; nothing of mine running on the Mac or VPS. No crons.
2. **CI is GREEN on both L1 PRs** (my `gh pr checks` at 16:1x: base, browser ×4, load-time, net-engines, quality = 8 pass; plan/rows/summary skipping, as expected for a looks-only diff). Both are still DRAFT:
   - Knight L1 **#1148 @580179223bb40676b467de5b8cb645aa7723ab24**
   - Executioner L1 **#1150 @cd7caf25024bbcc2bab6a54ebe3ef4494ce13a03**
3. **NEXT ACTION (owed, not yet done):** `gh pr ready 1148 1150`, then send both full shas to Lead ["Frankendom - Lead Developer [2d4d86]"] + Deploy, with the union ref **herolook/l1-knight-exec-union 13462fda** (tree 88007a09) for the L1-line conflict. They ride TOGETHER in run BC. Do not move either head after sending (a head move = rebuild).
4. **Then:** verify BC live: curl /looks/knight-L1*.glb and /looks/executioner-L1*.glb (full + phone) and compare shas with the committed files; then back to Lead for the next task.
5. This restart ran in app worktree vigorous-northcutt-a264de (session 78bba0c4). Gotcha: commit 028c58d2 on this branch emptied this doc by mistake (a heredoc wrote to a bad path); the next commit restored it. Tell Dom once: "reopen me on ~/Developer/frankendom-herolook with the worktree switch off".

## 2026-09-30 15:56 (+04) — HANDOFF before /clear. READ FIRST, then the 12:4x entry below, then memory herolook-pipeline.md (top entries 12:5x → 15:5x)

1. **LIVE 3fab84c4** (BA) by my curl at 15:56; no deploy.sh running; nothing of mine running on the Mac or VPS.
2. **Went live today (after 12:4x):** the look now starts downloading before the Fight tap (#1154, live since AX ba31b32c, ~13:56); the Nightborn's new Recruit look, full + phone (#1147, live in AZ 4efe5fe6 at 15:24; verified by my curl: phone 75a61e00, full 3504c4bb).
3. **NOT LIVE yet:** Knight L1 **#1148 @580179223bb40676b467de5b8cb645aa7723ab24** and Executioner L1 **#1150 @cd7caf25024bbcc2bab6a54ebe3ef4494ce13a03**, both DRAFT with CI running (8 pending at 15:5x), both merged with trunk 3fab84c4, tsc + rank-look.test 26/0. They ride TOGETHER in run BC (after BB). They conflict with each other only on the L1 lines; Deploy resolves by taking those three files from the reference branch **herolook/l1-knight-exec-union 13462fda** (tree 88007a09, Deploy rehearsed it: identical). check-budget on the union (VPS build) PASS: knight 26,403,984/26.5M, knight-phone 16,557,249/16.6M, executioner 22,098,593/22.3M, executioner-phone 14,199,295/14.25M, TOTAL 39,644,063/44M. **NEXT ACTION: when CI is green on both, `gh pr ready 1148 1150`, then send the full shas to Lead + Deploy. A head move after that means a rebuild.**
4. Sessions down: none known.
5. **Rulings today (after 12:4x)**, all in memory herolook-pipeline.md:
   - Nightborn L1 phone: head maps one size down (phone only).
   - The committed file is 75a61e00: 6553f60e's BIN with 9248352a's material key order. The cause (geometry encoding) is likely, not proven.
   - Armour's head atlas CANCELLED.
   - The dark collar is the known lighting item, no follow-up.
   - Never write an image-only change with gltf-transform NodeIO: it reorders the material JSON (the LOD contract fails) and re-encodes the geometry. Use imgswap.py / keyorder.py.
   - #1148/#1150 ride together, and knight-phone stays at 16.6 MB (Armour's recut only shrinks it).
6. **QUEUE:** (a) un-draft #1148 + #1150 on green, send shas → BC; (b) verify BC live: curl /looks/knight-L1*.glb and /looks/executioner-L1*.glb shas against the committed files; (c) back to Lead for the next task.
7. **Crons:** none. Worktree: app worktree vigorous-northcutt-a264de (branch herolook/prefetch-before-fight, merged). Scratch worktrees:
   - session 5d198e35 scratchpad: w-kn (herolook/knight-l1), w-ex (herolook/executioner-l1), w-nb.
   - session fab0f4ef scratchpad: w-union (herolook/l1-knight-exec-union), w-state (this doc).
   - Tools in fab0f4ef scratchpad: firstfight.mjs, nbabc.sh, imgswap.py, keyorder.py.
   - PR monitor has #1148 and #1150 bound.
   - Lead = "Frankendom - Lead Developer [2d4d86]", Armour = [0d2116].

## 2026-09-30 12:4x (+04): HANDOFF before /clear. READ FIRST, then memory herolook-pipeline.md (top entries 11:2x → 12:4x)

**Now (P1 TODAY, Strategy via Lead): the prefetch PR.** Start the rank-look fetch when the opponent + rung are known (ladder / menu, BEFORE the Fight tap), keep the decode off-screen and the swap on the idle beat (src/rank-look.ts rankLookStream :67–92, src/scene.ts:250; today the fetch starts at the first frame with duel.tick > 0). Why: L1 = Recruit = a new player's FIRST fight, and the NB full streams 8.4 s after Fight, so a short first fight never shows the look. Required body receipt: fresh profile, FIRST fight, desktop, L1 look visible before the first exchange (still or timestamps: fetch start, ready, swap vs first exchange). If small and green it rides AX with the L1s; otherwise the very next run. The L1s don't wait for it.

**Done today (after 11:0x)**
1. **#1131 PD L1 READY → live in AV** (trunk merge 7bb56f40; Mac gate + stills PASS).
2. **#1153 READY @c9676664** (off trunk 1e3a7434): rank-look-check rows 2/4 are a REPORT on full-tier files under a hard 10 s / 150 ms ceiling; the phone keeps 4 s / 50 ms. scripts/rank-look-rows.mjs (pure rowVerdict) + tests/rank-look-rows.test.ts; an unmeasured report row fails (Lead's review). Mutations checked. Late joiner, AX, ahead of the L1s.
3. **#1147 Nightborn L1 @1fe8b744** (DRAFT, on #1132): extras.resized phone contract (tests/rank-look.test.ts lodArt/assertResized + 3 mutation checks), Armour's head file 2d664bfd + resized=[Face,Photo,PhotoEyes,PhotoTeeth] (9248352a). Stills + head fix PASS; desktop paragraph + swap table in the body.
4. **#1148 Knight L1 @08b30017** (DRAFT, on #1132): Armour phone 20209c7c; knight 26.5 / knight-phone 16.6 MB (Lead approved); stills PASS.
5. **#1150 Executioner L1 @26e8c421** (DRAFT, on #1131): HF selected 605d9b2a as delivered; phone e0.0011 (5e001f1a); executioner-phone 14.25 MB; tears Known (option A); stills PASS.
6. Mac swap ×3 sitting 12:10–12:25 (table in the Lead message and the #1147 body): every phone PASS; every full over 4 s row 2 (4.87–8.37 s) with one swap frame 50–100 ms. #1153 turns those into REPORT.

**Open**
- #1147/#1148/#1150 → READY after #1153 merges (full rows go REPORT) + CI green. Swap numbers still owed in the #1148 and #1150 bodies.
- #1147 resized-head phone: row 2 4.28 s (one run, 12:12, phone HARD 4 s). Mac re-run ×3 after AW. If the median is > 4 s, step Face/Photo down one size (Lead), then re-check the close-up.
- Phone-tier LOD test (tests/rank-look.test.ts:182, 'nightborn L1: Face keeps the desktop material and image bytes'): it went red on #1147 @b65df73a (head maps downsized outside extras.rebaked), was reverted at aef84c1e, and is FIXED at 1fe8b744 by the extras.resized contract: `node tests/rank-look.test.ts` on 1fe8b744 = 25 pass / 0 fail (12:5x). Not open. The Stop gate failure came from the old b65df73a checkout.
- #1132 Dwarf (Armour): my sitting measured it (full 6.78 s / 50.1 ms; phone PASS); tell Armour.

**Rulings today (after 11:0x)**: stills are VPS frame-stepped (Strategy withdrew the Mac-stills rule); only the swap timing needs the Mac. Full-tier rows 2/4 are REPORT under hard 10 s / 150 ms. extras.resized is approved (Lead + Strategy). Phone bounds never move.

**Gotchas**: `pgrep -f "bash X"` inside a `bash -c` waiter matches itself; wait on a PID. The Ex phone "holes" were real surface (red-bg test), not the UV gutter. `git revert -q` isn't a flag; don't amend after a failed revert. The deploy hook blocks `node --test`; `node tests/x.test.ts` runs one file. Tell Dom once: "reopen me on ~/Developer/frankendom-herolook with the worktree switch off".

## 2026-09-30 11:0x (+04): Now / Done today / Open / Gotchas. READ FIRST, then memory herolook-pipeline.md (top entries 07:5x → 10:3x)

**Now.** #1115 Executioner READY @719a5515; Lead accepted the stills, and AU GO has gone to Deploy. The next Mac turn is after Deploy's AU deploy_hold clears: PD #1131 clean re-gate of the full file (swap ×3), then PD stills (Recruit + Legionary, full + phone). Weapons (Pitborn + Witch L1, ~60 min) goes after me.

**Done today**
1. #1115 (Executioner L2–L10, full + phone):
   - L9 swap ×3 on the Mac GPU: full 17.7 / 17.7 / 17.6 ms PASS; phone 133 / 217 / 17 ms. Strategy: it ships, recorded in the body as a KNOWN DEFECT (one long task on first render; JS apply 0.6 ms).
   - The prewarm lever I proposed already exists (scene.ts compileAsync + one map per frame), so it's withdrawn. The replacement is a Mac GPU perf trace of the L9 phone swap after AU.
   - Rung stills L1–L10 idle + mid-fight, full + phone (images-only commit e62276ac on refs/heads/stills/herolook-1115). IDLE verdict PASS (legs planted and connected; helms L8–L10). Mid-fight feet are covered by the hero: a known item for the stance follow-up.
2. PD L1 #1131 (template for every L1), head e889d1e5:
   - SHIPPING_LOOKS.plaguedoctor [1..10]; the rungs exit follows SHIPPING_LOOKS.
   - Tier split (Strategy 10:1x, Dom's AAA-quality ask): DESKTOP_LOOK_FILE 3.2 MB for full-tier files of PHONE_LOOKS sets; 5a/5c = REPORT on full; test + mutation.
   - Full = GPT's mesh + 2048 map as delivered (ae911112, 2,575,009 gz); the phone keeps 1024 (extras.rebaked [L1_Armour, L1_FittedGloves]).
   - plaguedoctor line 22.6 MB. CI 8/8 on 7a910179.
3. Nightborn L1: branch herolook/nightborn-l1 @85374c75 (stacked on Armour's #1132 @be8ac691), files = Armour's handover. DESKTOP_LOOK_SET nightborn 5.6 MB, set line 22.8 MB (measured 22,729,937). VPS tests 33/33. No PR yet.
4. Knight L1: the as-delivered full is packed (VPS work/herolook/pack/out/knight-L1-asis.glb, b6d307c0, 4,384,841 gz, 5b ~85.3 MiB). It waits for Armour's phone.
5. Pitborn L1: measured and handed to Weapons (file a9589a8e + recipe); Lead ruled a 3.3 MB desktop cap + 24.5 MB set.

**Open**
- PD #1131: clean re-gate (the 10:15 one was contaminated by the Pit's stills job on the Mac) → stills → READY. It rides the run after AU.
- Nightborn: rebase once #1132 moves onto e889d1e5; Mac gate + stills + close-up vs GPT render; open the PR.
- Knight: Armour's phone → PR (DESKTOP_LOOK_SET knight 4.4 MB, set line measured ~26.5 MB, standing rule).
- L9 phone swap perf trace after AU (attribute the long task, then ONE lever with numbers).

**Rulings today**
- Strategy (Dom "same AAA quality"): assets ship as delivered (lossless re-encodes only); the budget moves, not the asset; only phone variants get decimated.
- Stills on the critical path are taken on the MAC in real time, never SwiftShader.
- Row 5b tier split: desktop 96 MiB (lands in #1132).

**Gotchas**
- VPS: only `ssh frankvps` (ControlMaster), no retry loops, polls ≤ 1/min; `pkill -f <pattern>` over ssh kills its own bash -c. Use `setsid nohup … &` for detached jobs.
- `--rungs` needs `--look` (any committed file), or it exits 2 at startup.
- zsh `${C}:refs` needs braces.
- gltf-transform must write VertexLayout.SEPARATE for the repo's optimizeGlb.
- Tell Armour whenever the #1131 head moves (#1132 is stacked on it).
- Tell Dom once: "reopen me on ~/Developer/frankendom-herolook with the worktree switch off".

## 2026-09-30 00:3x (+04) — HANDOFF before /clear. READ FIRST, then memory herolook-pipeline.md (top entries 2026-09-29 21:0x → 2026-09-30 00:1x)

1. **LIVE 5f2f622a** (my curl 00:3x); it contains #1103 (rank-look-check reads the end-tick stamp, merge 01478e49). Deploy run AT (the Pit) was running at 00:3x. Nothing of the Executioner is live.
2. **EXECUTIONER #1115** (DRAFT, branch herolook/executioner-prep, head **719a5515**, CI 8 pass / 0 fail on it). Lead's order; Dom GO 20:4x via Strategy.
   - Prep fdefb8c8: executioner in SHIPPING_LOOKS + PHONE_LOOKS, .gitignore, file-presence guard, rig contract test (keep=[] drops his draws and carriers, his scythe stays, opened is his so the pre-swap bake applies).
   - Drop 09ddbb94 (trunk 5f2f622a merged in at aec31699): 18 files byte-identical to **~/armour-builds/executioner/handover-l2l10** (shasum 18/18; Lead verified 18/18). Re-pinned [2..10]. Budget executioner 22_300_000 / -phone 14_000_000 (Armour ×1.15 down). The LOOK_FILE 2.6 MB cap binds each full file.
   - Tests-only fix-forward 7c579214 + 719a5515 (Lead accepted): all 10 ladder opponents now have looks, so graphics.test's two standing-mid-page tests stay inside one rung (device 10 marks, server 14, both Gladiator, rematch at 15; dial 4 losses at rank 11 = 9, floor 10). The no-looks pin moved to minotaur. NEW pin: a standing onto another look file reloads (Recruit → 10 marks = L3, reloads 1, no rematch Match). Local 111/111; mutation (reload → false) makes the pin FAIL 1/1.
3. **Slot 1 (23:28–23:53, box back 00:1x, late) on 719a5515: PARTIAL.**
   - plainDeath rows L2/L5/L8/L9/L10 full+phone: look on, no page errors, 0t = Node 1264 (stamp), 0r everywhere.
   - Row 2 FAIL, a report with his own ceiling (Lead): full 4.36 / 4.39 / 4.54 / 4.51 / 5.08 s; phone L8 4.39, L10 6.89 s.
   - **Row 4 L9 ONLY: full 284 ms, phone 217 ms** (quiet load ~10; the others 17.6–33 ms). Single runs. L9 has the same structure as L10; the ruby transmission material is also on L8, which passes.
   - No tear in the death frames I viewed (L2 full, L8 phone). Receipts: scratchpad/ex/artifacts/herolook/executioner-*-719a5515.
4. **NEXT, on Lead's FREE after run AT publishes:** `END=HHMM zsh <scratchpad>/slot2.sh` (session 45c9e866 scratchpad; it reuses the ex/ worktree build of 719a5515). Order: **L9 swap ×3 full + phone FIRST** (load < 15 wait for timing only) → `--rungs` ready-idle + mid-fight stills Legionary/Champion/Primus/Invictus/Origin full + phone (pause only above 60) → L10 decap → roster. Stills go into the #1115 body as they land; send "box back" + sha AT the window end.
5. **Lead rulings 00:2x:** if L9 is confirmed > 100 ms, **L9 is HELD**: it keeps the live look, the other ranks ship, and I send ONE lever with the measured cause, with no fix before Lead's word. If it isn't confirmed, it's a single-run outlier, noted in the body. Row 2 over 4 s: a report, not a hold. A rank with a visible tear at 375 keeps the live look (with the crop). GPT deformation flags ship as known minor. Trunk scythe stays; the L2–L7 open hood keeps GPT's weights. No local runs, not even a unit file, without Lead's FREE.
6. **Gotchas:** plainDeath B stills are finisher frames, not the ready/mid-fight stills (those come from `--rungs`). Row 4 lives in the load phase: rerun with `--skip-replay`, NOT `--skip-load`. Lead has two sessions with the same name: message **"Frankendom - Lead Developer [bd2101]"**. Undo a mutation with cp from a backup, never `git checkout -- file`. No crons. #1095 Goblin still parked (Dom). Tell Dom once: "reopen me on ~/Developer/frankendom-herolook with the worktree switch off".

## 2026-09-29 20:32 (+04) — HANDOFF before /clear. READ FIRST, then the 15:56 entry below, then memory herolook-pipeline.md (top entries 16:3x–20:20)

1. **LIVE 5ec33cf2** (my curl 20:32); no deploy_hold, no deploy running.
2. **Live today (my own checks):** the Pitborn's rank armour, L2–L10 (bbfb074a, #1076); the Centurion's, L2–L5 + L7–L10 with the L10 collar repack (303af39e, #1100); the Shieldmaiden's, L2–L10 (5ec33cf2, #1101). All files served and byte-equal to the repo.
3. **Not live:**
   - **#1103** rank-look-check: row 0t reads main.ts's end stamp (#debug data-replay) and marks tickSource. READY, CI 7/7 on e230bf61; it rides Lead's next code run.
   - **#1095 PARKED by Dom (20:4x via Lead): NOT for the beta.** The Goblin keeps the current live look; the draft stays for a later close-up-only use (win screen / Profile), memory goblin-256-parked.md. Earlier status: Goblin 256² normals, DRAFT @ e7b594cd (trunk 5ec33cf2 merged in, one merge base). Slot done 20:11–20:20, table and stills in the body. It has no hold (cpu×1: no swap-window frame over 25 ms; 5b 11 MB), so it ships on Lead's READY. Flagged to Lead/Strategy: the ×4 fight p95 is Q 82.5/133.4 ms vs A 17.7/17.6, and the 256² is not visible at the 375 fight camera for L6/L10 (matched "same"). The texture-upload attribution is still open (no output this slot).
4. **Sessions down:** none of mine.
5. **Rulings today** (memory herolook-pipeline.md + feedback-graphics-over-perf.md):
   - Rows 1/2 are perf: a report, with the set's own `--stream` ceiling at quiet worst + 15 % (Pitborn full 5.9 / phone 5.2 s, Shieldmaiden full 5.5 s; the Centurion needs none).
   - Row 0t is correctness: it must equal Node on quiet ×3.
   - No local runs outside Lead's box FREE.
   - Builds go outside ~/Desktop (a detached git worktree in the scratchpad).
   - Copy files only from PROMOTED handovers (~/Desktop/Business/artifacts/looks/<opp>/handover-l2l10) and check with shasum -c.
   - Budget lines at measured + ≤ 15 % (Shieldmaiden 24 MB / 16.65 MB).
   - Merge trunk into a stacked PR so it has ONE merge base (commit-tree, no force-push).
6. **QUEUE:** (a) #1103 merges, then verify; (b) #1095 is parked, so nothing to do; (c) whatever Lead sends next (the next opponent set follows the same prep → drop → slot recipe).
7. **No crons.** App worktree vigorous-northcutt-a264de, currently on branch herolook/replay-end-tick (clean). Slot recipe scripts are in session 64444d39's scratchpad: pitslot.sh / vetslot.sh / smslot.sh / gobslot.sh, plus receipts-*. Tell Dom once: "reopen me on ~/Developer/frankendom-herolook with the worktree switch off".

## 2026-09-29 15:56 (+04) — HANDOFF before /clear. READ FIRST, then memory herolook-pipeline.md (top entries 2026-09-29 12:3x–15:56)

1. **LIVE ab643555 or later** (#1089 look-swap bounding sphere live, verified 12:3x). Nothing else of mine is live since.
2. **PITBORN #1076** (draft, head **1ba79362**, branch herolook/pitborn-prep): 18 files = Armour handover-l2l10 (L4-phone re-issued 640373bc, collar de-headed; swapped 1ba79362), `pitborn: [2..10]`, budget `pitborn` 23_900_000 / `pitborn-phone` 16_000_000 (Armour's measure + ≤15 %), sha table in body. 80797721 fixed MY test pin (L8 adds `Fitted_joint_sleeves` too; CI was 1006 pass / 1 fail on c94d9160). CI on 1ba79362: check it. Finishers gates 1+2 L8–L10 PASS (lane-reported, Lead eyeballed).
   - **Box slot (Lead FREE 15:3x) run 15:34–15:56 on c94d9160, STOPPED by me at 15:56: box load hit 233 (Armour's Centurion batch + Finishers).** Results valid only before the load spike: L2 full/phone and L5 full FAIL row 2 stream-in only (5.15 / 4.87 / 4.51 s > 4 s: fetch 3.97 s vs Witch L2's 2.85 s for the same 2.8 MB, plus ~1.2 s pre-swap bake the Witch doesn't have); all other rows PASS there (5b 10.7, 5a 43,243 full, 5c 55,286 phone, 0r, 0t, swap frame 17.7 ms). L5 phone all PASS. L8 full timed out (my 300 s cap), L8 phone + L10 full TimeoutError, L10 phone / L4-phone decap / roster / --matched NOT RUN (killed). Receipts: artifacts/herolook/pitborn-L{2,5}-*-c94d9160/receipt.json.
   - **NEXT:** re-run the slot on a quiet box (Lead's FREE, load < 30) on 1ba79362: `dist/looks/pitborn-L4-phone.glb` must be the new file (a --build of 1ba79362 does that). Script: session 2de99910 scratchpad/pitslot.sh (rows L2/L5/L8/L10 full+phone plainDeath --look-only; L4-phone decapitation --skip-load; roster; --matched L2/L5/L8/L10 f60,240 WITH --look). Row 2: report stream-in with the fetch/bake split; ask Lead whether the whole-body 4 s ceiling applies to a baking look (the tool's header allows a look's own --stream ceiling). Stills → PR body → links to Lead → "box back".
   - **Lead's row-2 ruling (15:59):** the L2/L5 stream-in numbers above DON'T COUNT (load ~200). Re-run on a quiet box, build of 1ba79362 OUTSIDE ~/Desktop (iCloud syncs it; use a git-archive export in the scratchpad, bsslot.sh pattern). If row 2 is still > 4 s it does NOT block: a baked whole-body look gets its own `--stream` ceiling at measured + 15 %, reason in the commit, numbers in the body. Every other row must pass, and the stills are required. Wait for Lead's "box FREE (Pitborn slot)" (after Finishers' Centurion gate 2).
3. **CENTURION #1100** (draft, head **30fd1162**, branch herolook/veteran-prep, base trunk so CI runs, STACKED on #1076: merge #1076 first). 16 files = Armour handover-l2l10 (each blob re-hashed equal), `veteran: [2,3,4,5,7,8,9,10]` (L6 = static Sand Legionary, no rig → base rig), budget `veteran` 15_400_000 / `veteran-phone` 15_100_000. Plan (Lead): Pitborn releases ALONE, Centurion the next run after Finishers' Centurion gates + my slot.
4. **GOBLIN 256² #1095** (draft @5d5be90b): Dom's pick, SHIPS (Dom: "better graphics is more important"). Hold only on the 22 MiB cap (CI row 5b ~21.3) or a NEW dropped frame at cpu×1. ×4 A/B = report only. Slot script scratchpad/comboslot.sh (~9.5 min: Witch texture-upload attribution + Goblin ×4 A/Q ×4 + ×1 A/Q ×2 + --matched stills L2/L6/L10). Behind Pitborn and Centurion.
5. **Texture-upload attribution** (Strategy GO, measure only): in comboslot.sh step 1; harness stall.mjs logs every tex call ≥1 ms (size, source, first touch).
6. **Rulings today:** see memory feedback-graphics-over-perf (look upgrade within caps ships; perf deltas are numbers, never a reason to drop). Only Lead's "box FREE" opens the Mac; CI covers commits.
7. **Gotchas:** worktree parked detached on trunk. When a slot is running on a checkout, change branches ONLY via plumbing (temp GIT_INDEX_FILE + hash-object + commit-tree) so the dist stamp's clean-tree check holds. zsh `${C}:refs` needs braces. The Stop gate runs the tests on the CURRENT checkout. Tell Dom once: "reopen me on ~/Developer/frankendom-herolook with the worktree switch off".

## 2026-09-29 12:55 (+04) — Look-swap fix LIVE (#1089, ab643555); Draw-tap bell handed to Audio

1. **LIVE ab643555** (my curl 12:55): #1089 merged (merge ab643555, ancestor of live), and the live bundle `index-CFjhoEMw.js` carries `boundingSphere=(e.geometry.boundingSphere??…).clone()` inside `lookPlan`. Deploy reports 48/48 rows pass. Not re-measured on live: the receipt is the local-build before/after below.
2. **What it fixed:** three 0.186 computes a CPU-skinned bounding sphere for depth sorting on the first render of every new SkinnedMesh, even with culling off (`WebGLRenderer.js:1921–1923`). Look copies now carry the file's bind-pose sphere (`src/characters.ts` lookPlan) + asserts in the rank-look phone/full shadow test, mutation-checked (dropped line: pass 0 / fail 1).
   | cpu×4, local builds, one slot 12:25–12:26, Witch L10-phone | swap frame r1/r2/r3 | median | skinned-sphere samples |
   |---|---|---|---|
   | before (trunk 046f915f) | 138.7 / 67.1 / 114.3 ms | 114.3 | 91 / 50 / 79 ms |
   | after (#1089) | 23.2 / 49.3 / 19.1 ms | 23.2 | 0 / 2 / 0 ms |
   Residual: a 30 ms first-draw texture upload in 1 of 3 runs, a separate item, not chased (Strategy told).
3. **Draw-tap frame** (111–128 ms ×4; sampler 12:08 on live 046f915f): #1 = arena bell synthesized on the main thread when Draw is tapped before arena audio decodes (`src/audio/arena.ts:65–66`, 76 % of a 121 ms frame, 1 of 3 runs: a race). **Owner Audio** (Lead/Strategy routed). Audio has my harness command + analyzers (git-ignored `artifacts/herolook/stall.mjs --profile`, `prof-buckets.mjs`, `prof-frames.mjs`, `prof.mjs`), with a note to force the race by delaying `**/arena-audio/**`.
4. **Open in lane:** #1076 Pitborn prep DRAFT @ d88a2a1c waits for the Pitborn files. Dom owes the Goblin normal pick and the hero phone-LOD yes.

## 2026-09-29 11:57 (+04) — Look-swap stall MEASURED; Draw-tap frame is the bigger hitch; sampler slot queued

1. **Measured** (slot 11:53:01–11:53:38, live bfe1633a, `?opponent=witch&tier=Origin&gfx=phone`, headless Chromium 375×812 @3x, 3 runs at cpu×1 and cpu×4; JS main-thread time of the game's rAF callback from Chrome traces). cpu×4 r3 overlapped by Web's `_glintlive.mjs` Chrome (11:53:34), not an outlier.
   | | cpu×1 (3 clean) | cpu×4 (clean r1, r2) |
   |---|---|---|
   | steady frame p50 | 1.0–1.5 ms | 3.1–4.3 ms |
   | look-swap frame | 8.1 ms median (7.3–8.6) | 29.2 ms (27.6–30.7) = one dropped frame |
   | of which wearLook (applyMs) | 0.4–0.6 ms | 1.8–2.1 ms |
   | first frame after the Draw tap (fight start, not the swap) | 33–36 ms | 111–128 ms |
   No GC, no WebGL call ≥ 0.5 ms and no long task inside the swap frame, so the extra ~25 ms is JS and NOT attributed yet (the trace had no CPU sampler). Receipts (git-ignored, app worktree): `artifacts/herolook/stall/stall.json` + `trace-cpu{1,4}-r{1..3}.json`.
2. **Rulings (Strategy with Lead, ~11:55, replacing their first "no swap code before beta"):**
   - Swap lever = **CONDITIONAL YES pre-beta.** If the sampler puts the extra 24–27 ms on first-render setup of the new skinned draws, build a hidden one-off render of the look inside the existing warm-up (`src/scene.ts:242–250`, after compileAsync + initTexture) as ONE small PR, with a before/after ×4 trace as the receipt. It rides any run. Otherwise it's parked **post-beta** with no second guess.
   - The **Draw-tap frame** (111–128 ms at ×4) comes first: top 3 costs to Strategy + Lead. The owner follows what dominates: first render / shader compile / scene or arena setup → World; sim or match init (fight state, AI, replay/record) → Combat; split → World leads. Nobody codes before the table.
3. **Next:** ONE ~1-min sampler slot right after run AI publishes, on Lead's "box FREE": `node artifacts/herolook/stall.mjs --profile --cpu 4 --runs 3 --out artifacts/herolook/prof1`, then offline `node artifacts/herolook/prof.mjs artifacts/herolook/prof1/trace-*.json --bundle <live index-*.js>` (live has no source maps; costs named by surviving method names + a bundle snippet). "slot done" to Lead when the browser exits.
4. Unchanged: #1076 Pitborn prep DRAFT @ d88a2a1c waits for the Pitborn files; Dom owes the Goblin normal pick and the hero phone-LOD yes.

## 2026-09-29 10:5x (+04) — HANDOFF before /clear. READ FIRST, then memory herolook-pipeline.md (top entries 2026-09-29 08:0x–10:5x)

1. **LIVE 1bc5d57d** (my curl 10:5x; contains 90a8b7ac): **Witch rank looks L2–L10 full + phone LIVE** (#1068, merge 90a8b7ac, first live in 48788d3c). My check there: 18/18 witch files live == trunk by sha256; bundle has witch:[2..10] in SHIPPING_LOOKS and 'witch' in the phone set. Run AB (#1061 matched verdict, #1064 Knight helm split) live earlier, Knight L8–L10 6/6 verified.
2. **Done today:** #1068 Witch (slot 09:40–09:46 @8fd32975: 8/8 rank-look rows PASS, 5b 10.7 MB, 0r/0t, roster PASS both tiers, --matched "look changed" f240 all ranks; stills via orphan commit 230069c1 on refs/heads/herolook/witch-stills). Knight L10 "narrow shoulders" (Dom's phone shot) = GPT L10 design + dark shading, NOT pack / helm split (offline skinned silhouettes 6 poses + live textured stills Origin vs Recruit). Shoulder–helm notch measured with a repeatable tool → Armour fixed it in #1074 (01024af2).
3. **In flight (mine):**
   - **#1076 Pitborn prep, DRAFT @ d88a2a1c** (tree == dc5256af, CI quality PASS on dc5256af): pitborn: [] + PHONE_LOOKS, file-presence guard in rank-look.test (each set lists exactly its committed files, both tiers; mutation-checked both ways), rig contract test (keep = [] → his 16 built-rig draws + carriers off, 5a nets them, cleaver stays, opened → pre-swap bake). NO check-budget lines (Strategy: they land WITH the file drop at measured + ≤ 15 %, overage to Strategy first). Drop = 18 files + re-pin [2..10] + budget lines + pin L8 numbers + slot.
   - **LOOK-SWAP STALL (Lead/Strategy):** MEASURE ONLY, then a table + ONE proposed lever to Strategy + Lead, NO fix before Strategy sees it. Needs the box: queued after Weapons → Armour (#1074 stills) → Web (Dom's glint); WAIT for Lead's "box FREE". Harness ready (git-ignored): `artifacts/herolook/stall.mjs` in app worktree vigorous-northcutt-a264de (live site, ?opponent=witch&tier=Origin&gfx=phone, 375@3x, cpu 1,4 × 3 runs; per-frame WebGL call timing + applyMs + long tasks + Chrome trace anchored on a 'look-on' user-timing mark). Swap path scene.ts:241–261 already does compileAsync + initTexture pre-swap; suspects: VBO upload on first draw, shadow-depth program compile, wearLook JS, GC from dispose. Context: docs/state/code-quality.md:31 (finisher-pool warm-up long tasks).
4. **Waiting on Dom:** Goblin normal pick (A = live 21.00 MiB vs 256² 21.33; if 256² wire Armour's handover-qres in a look PR); hero phone-LOD work (needs Dom's yes). Knight L10 broader pauldrons would be an Armour/GPT asset call (Strategy/Dom). legionary.glb (3.96 MB inside the 44 MB TOTAL) drop-or-own-line lever: Strategy/Dom's call.
5. **Rulings today:** Witch budget 22/14 MB (Lead, measured +13/+12 %); gate 1 (Finishers closed-helm rule) applies to L8–L10 only; budget lines only at measured + ≤ 15 % with files; --matched still needs --look (exits 2 without).
6. **Gotchas:** app worktree, park detached on trunk between edits. `git merge` AND `git revert` fail silently here (stash) — use merge-tree + commit-tree, and revert by `git checkout <good> -- <file>` + commit; never `--amend` after a failed step. zsh: `${C}:refs`. Local public/looks + dist/ carry stale git-ignored GLBs (centurion-bronze, goblin-L*-loki/anansi/hermes) → local check-budget unusable, trust CI's clean build. Tell Dom once: "reopen me on ~/Developer/frankendom-herolook with the worktree switch off".

## 2026-09-29 07:1x (+04) — HANDOFF before /clear. READ FIRST, then memory herolook-pipeline.md (top entries 2026-09-29 05:3x–07:2x)

1. **LIVE b10a9f3f** (my curl). Nightborn L2–L10 (#1025) and Dwarf L2–L10 (#1030) rank looks went live in b10a9f3f: my check 36/36 look files live == trunk by sha256, and the bundle carries nightborn + dwarf in SHIPPING_LOOKS and the phone set.
2. **Done today:** #1059 row 48 green on CI (live in 73a9a6ce); #1055 --matched stills harness live; #1025/#1030 merged trunk (merge commits, no force), CI-green, stills + Lead's f240 verdict; roster-browser-check `lookbake=off` (#1025's pre-swap bake is ≤ 6 ms/frame and outlasted the 60 s wait on the GPU-less runner, Goblin 52 → 60+ s; now 32–34 s).
3. **Waiting on Lead's next run (both READY-asked, heads frozen):**
   - **#1061** @ eba0147e (READY): `--matched` verdict at f240 by pixels ≥ 33 levels (`MATCHED_DIFF`, same if ≤ 5,000 px), `--judge <dir>:<a>,<b>` re-runs it offline on saved shots, row 0t (browserTick === nodeTick), per-shot receipts (page time, tick, load). A/As ≤ 902 px on the Knight + Nightborn arenas; A/Bs ≥ 23,940. **Known limit:** f60's frame-wide 1–2-level noise is UNNAMED (a performance.now rebase and an equal real-time warm-up were measured and did nothing; both dropped).
   - **#1064** @ 3e066c60 (ready for review, READY asked): Knight L8–L10 helm split, full + phone, from Armour's handover-sever (Finishers gate 1 PASS). Test re-pin: L8 adds Knight_L8_Armour_Helm, verts 76,997 → 77,327. Stills flag 5,842 / 11,754 px at f240 = the intended Head → neck_01 weight move on the pauldrons (Armour's attribute diff); Lead's eye verdict: identical.
4. **Given to Dom (no PR):** Goblin L2 + L8 three-way page, live A (21.00 MiB textures) | 256² normal (21.33) | full normal (26.33, over the bar): session 3147ec11 scratchpad/goblin-normal-3way.html. Dom picks A or 256²; only then does a PR exist (Armour's files: ~/Desktop/Business/artifacts/looks/goblin/handover-qres/).
5. **Open:** #1030's Dwarf is live; the old seed-828 split is gone (row 48). The f60 noise cause (a future lane task, not blocking). Next queued: hero phone-LOD work (needs Dom's yes).
6. **Gotchas:** park this worktree detached on trunk between edits (a branch ahead of trunk fires the repo Stop gate on every Stop). `git merge` fails here with "stash failed": use merge-tree --write-tree + commit-tree. zsh eats `$C:refs` (use `${C}`) and doesn't split `set -- $x`. Calibrate before calling anything noise: I got it wrong twice today (the −98% claim and the Knight "arena noise"), and an A/A disproved both. Scratch tools (ignored path): artifacts/herolook/hist.mjs, glbcount.mjs, texprobe.mjs.

## 2026-09-29 05:00 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-28 23:16 entry below, then memory herolook-pipeline.md (top entries 2026-09-29)

1. **LIVE deb50812** (my curl 05:00). No deploy running, no run of mine in flight. Box is Lead's to give (Lead's session was unreachable at 04:5x; Strategy logged my status for Lead's restart).
2. **Went live today:** the Goblin L2, L4–L10 fix (#1054, merged). The armour normal map was dropped so each file loads ~21 MiB of textures, under the 22 MiB bar; same form as L3. Before/after stills at L2 and L8 in the PR; Dom judges them in the morning.
3. **NOT LIVE:**
   - **#1025 Nightborn** draft @ **51d87f00**: rebased onto trunk fc2254aa (no merges; tree = trunk+#1025 merge, Auditer PASS). Armour's L3–L7 repack wired (10 files, shasum 10/10, static 5b 10.7 MiB each). The 23:16 entry's gate/slot plan still applies for the browser rows. NEXT: rank-look.test + tsc (CI on push, or a slot), then Lead's READY. The Dwarf replay-split hold on #1025 is lifted: Combat's bisect shows trunk diverges too.
   - **#1030 Dwarf** draft @ **aa04bd5d**: stacked on #1025, 18 dwarf blobs = Finishers' judged tree b9815248. HELD until the Dwarf can be killed in the browser (every replay: hero dies at 2,172 vs Node win at 2,248; Combat is chasing a page fast-forward sim split). If #1025 moves, re-stack: cherry-pick #1030's 2 commits onto it + check dwarf blobs.
   - **#1055** READY @ **80cd1a7d** (scripts/rank-look-check.mjs only): `--matched` same-frame A/B stills (Lead's rule: every look PR uses it), row 0r (every replay must end with him fallen; proven: Dwarf FAIL, Nightborn PASS), `--dist` build stamp + `--build` (proven). OUT of run Y: the deltas after Auditer's 032a6c4c PASS need a reviewer (Lead arranging).
   - **#1059** row 48 browser-replay-check (Code Quality's PR, Lead gave me the fix) @ **306a450a**: CI timed out 11/11 because the replay played on wall-clock with software GL. Fix: harnessClock + skipDraws after a real-time boot, stage-labelled errors, fail fast after 2. Bound to this session. NEXT: when CI is green, put the row-48 receipt + timings in #1059's body and send Lead the sha.
4. **Sessions down:** Lead (unreachable at 04:5x; Strategy restarts it).
5. **Rulings today** (memory herolook-pipeline.md): Goblin 5b = option A (no Dom wait); rebaked phone rule "at most ONE new material, the atlas" accepted (Nightborn L8–L10 plate); Nightborn full tier 64–68k verts accepted, 60k bar is phone-only; `--matched` for all look before/after stills; earliest-kill bot floor ~12.0 s (Combat) for bake budgets; every execSync/spawnSync in scripts/ needs `timeout:`; ask Lead for a slot before any test run.
6. **QUEUE:** #1059 CI receipt → #1025 tests + READY → #1055 review → #1030 after the Dwarf fix → then the hero phone-LOD work (queued since 09-28, needs Dom's yes).
7. **No crons.** App worktree `.claude/worktrees/vigorous-northcutt-a264de`, parked detached on trunk, clean. Scripts in session 558412e2 scratchpad: normaldiff.mjs, goblinslot.sh, matchedslot.sh, victimslot.sh, buildslot.sh.

## 2026-09-28 23:16 (+04) — HANDOFF before /clear. READ FIRST, then the 21:3x entry below, then memory herolook-pipeline.md (top entries 22:3x–23:5x)

1. **LIVE e9107428** (my curl 23:16; run U published). No run of mine in flight. Box is Lead's: wait for his "box FREE".
2. **Went live today:** nothing new from this lane since Knight looks (b7290bdd).
3. **NOT LIVE — #1025 Nightborn, DRAFT, head fe9cc9bf, pushed, UNTESTED since c57a3a8f** (deploy lock; Lead's rule: tsc/tests are box work too). PR body top says "UNTESTED, slot pending".
   - First slot @ f3c54a6f (22:07) FAILED: 5b L2 45.3 MiB; row C L8/L10 drained (bake >200 steps, kill first; L8 worst step 54.6 ms). Receipts: session 5683c274 scratchpad ci1001/artifacts/herolook/nightborn-*-f3c54a6f (+L8 -r2).
   - Commits since: 8d138778 (a) pre-swap bake, ≤6 ms/frame, 8 ms step cap · 6558a707 fallback opened→runThrough when bake pending, `?lookbake=off` · c57a3a8f Strategy 22:27 FORCED runThrough nightborn+dwarf L8–L10, no bake (RUN_THROUGH_LOOKS; gate row C n/a, passes only if the opened kill played runThrough) · 151e50e8 no pre-swap bake where opened never plays (Knight/PD unchanged) + gate bakeP95/onAfterFirst/--load-query · f50f3f14 lookBakes() + Knight/PD zero-bake test · 82bfe681 Armour L2 + L2-phone repack (sha 10983558…f540 / 00535a21…05f6, verified) · fe9cc9bf static row-5b test on every shipped file (EXPECTED RED on Nightborn L3–L7).
   - Blocker: Armour's L3–L7 repack (10 files, handover-l3l7/ in laughing-meitner-7d47c2/artifacts/looks/nightborn/), ON HOLD until Lead's box FREE. Wire + shasum each.
   - #1030 Dwarf, draft @ f48431ff, stacked: after #1025 merge trunk into it, same forced L8–L10 + same rerun. Armour: Dwarf 5b passes every rank.
4. **Sessions down:** none known.
5. **Rulings (Lead/Strategy/Finishers tonight, memory 22:3x–23:5x):** (a) accepted with 3 conditions (drain before earliest kill ~16 s per Combat smoke; no hitch p95 vs lookbake=off; fallback built in). Fallback = runThrough (Finishers, Lead confirmed), plainDeath last resort. Strategy 22:27: Nightborn/Dwarf ship with forced runThrough at L8–L10 if (a) isn't proven. Row 5b now on ALL ranks, both tiers.
6. **SLOT PLAN (in order):** tsc → `node --test tests/rank-look.test.ts` → mutation (drop the opensWaist term in lookBakes → Knight rows red; restore) → push → gate rows: L2 + L3–L7 5b full+phone (--look-only); L8/L10 full row C (forced n/a) + row A L8; L10-phone row 1; `?lookbake=off` opened on L2/L5 = fallback proof; p95 bake vs `--load-query '&lookbake=off'` + onAfterFirst on Goblin L8 `&gfx=phone` and Nightborn L5-phone; row C opened on Goblin L8; face crops L2 + L5, full + phone, new vs old (old = git show f3c54a6f:public/looks/nightborn-L{2,5}*.glb served as /looks/nightborn-L2-old.glb via ?ranklook) for Strategy + Armour. Then update PR body, "Nightborn done" + sha to Lead.
7. **No crons.** App worktree .claude/worktrees/vigorous-northcutt-a264de on herolook/nightborn-looks (clean). Slot script template: session 722ef145 scratchpad/nbslot.sh; clean build checkout: session 5683c274 scratchpad/ci1001.

## 2026-09-28 21:3x (+04) — HANDOFF before /clear. READ FIRST, then memory herolook-pipeline.md (top entries)

1. **LIVE 026d07e4** (my curl 21:3x). Knight rank looks went live in b7290bdd (#1024): my check found 18/18 knight files 200 and byte = trunk, bundle has knight:[2..10]. Dom's link: frankendom.com/?opponent=knight&tier=<Rank>. Plague Doctor -phone files are live (591e0976, 9/9 = trunk).
2. **In flight (all mine, all DRAFT, tree clean):**
   - **#1025 Nightborn** L2–L10 full + phone, head **bdac752c** (merged with trunk b7290bdd). 13/13 rank-look tests. Budget nightborn 21 / nightborn-phone 16 MB (Lead 20:3x). L8–L10 = Finishers-passed shas (phone L8 22e1a5df; the bad rerun 7aa44875 is rejected by the test). Also carries the wearLook fix: keep [] nets EVERY draw it turns off (built rigs). NEXT: Lead's slot **after Auditer's rows**: build + check-budget, roster both tiers, gate L2/L8/L10 full + phone, stills 375 ready idle + mid-fight L2/L8/L10 → PR body → "Nightborn done" + sha.
   - **#1030 Dwarf** L2–L10 full + phone, head **f48431ff**, STACKED on #1025. 14/14. Budget dwarf 17 / dwarf-phone 14.5 MB (Lead 21:1x). Finishers re-sim L8–L10 PASS; the six passed shas match what's committed. NEXT: after #1025 merges, merge trunk into it, then the slot (gate incl. row C opened, his full finisher list; stills L2/L8/L10). GPT defects listed as shipping AS DELIVERED.
3. **Rulings today (Lead):** phone test rebaked rule = a rebaked draw adds at most ONE new material (the shared atlas), every other primitive byte-equal to desktop; URI (build-shared) images compared by URI. Row 5c binds the -phone run for PHONE_LOOKS sets (full file never reaches the phone), release coverage = rank-look.test in quality:ci. Gate B look-off accepts 'none'. Set budget lines per opponent are storage-only (per-file 2.6 MB cap binds). READY-by-sha: every wired file must match the passed sha list.
4. **Traps:** commit before every turn end (Stop gate fires on untracked files too; 37 old legionary scratch files were MOVED to session 722ef145 scratchpad/untracked-moved/). zsh: brace `${c}:refs`, and `set -- $p` doesn't split. During a deploy, run only a BARE `node --test <file>` (no pipes).
5. **Scripts:** session 722ef145 scratchpad: knightslot.sh / knighthalf.sh (slot template: waits load ≤ 30 per row, 10-min cap then "loaded box"), clean build checkout = session 5683c274 scratchpad/ci1001. No crons.

## 2026-09-28 18:06 (+04) — HANDOFF before /clear. READ FIRST, then the 03:59 entry below, then memory

1. **LIVE b69ca9c3** (my curl 18:06). **Run Q deploy.sh IS RUNNING** (pids seen 18:06): it carries #1017 (merged) + #1015 (merged); #1014 was still OPEN at 18:06. No run of mine in flight; the box is not mine.
2. **Went live today:** #961 Goblin rank looks ON (05:03, cc1e90d7). #1001 Plague Doctor rank looks ON by default, L2–L10 (Dom: "integrate the plague doctor fully in game so I can test"), live by b69ca9c3. Test link for Dom: frankendom.com/?opponent=plaguedoctor&tier=Champion (swap the rank word; Recruit = today's body).
3. **NOT LIVE yet:**
   - #1017 PD phone-tier LODs (merged, in run Q): `<opp>-L<n>-phone.glb`, streamed when phoneTier(); 39.9–43.7k skinned verts vs 121k. It fixes Dom's iPhone jitter at L8–L10 (GPU vertex/skinning bound).
   - #1014 castShadow off on phone look draws (Auditer, OPEN at 18:06).
   - #973 Auditer nits on opened.ts (draft): waits for a Lead window for its 3-min x4 row-C run.
   - #940 legionary sources: ARCHIVE draft, never merge while the hero is on hold, never delete the branch.
4. **Sessions down:** none known.
5. **Rulings today** (memory herolook-pipeline.md): look files keep=[] = whole fitted figure (scanned rig); row 5a = 45k added tris NET of a freed CreatureBody (bodyFreed); row 5c (Auditer #1015) = phone, body-replacing look ≤ 60k skinned verts whole; phone LODs are a mechanical meshopt derivative (LockBorder+Permissive; maps, materials, skin untouched), own check-budget set `plaguedoctor-phone` 14 MB; roster check forces gfx=full AND gfx=phone for an opponent with phone files (a Mac headless isMobile+hasTouch page is phoneTier; Linux CI is not); looks may drop TANGENT + clips.
6. **QUEUE after run Q:**
   - (a) Live check: /looks/plaguedoctor-L<n>-phone.glb 200 on frankendom.com, and ?gfx=phone&opponent=plaguedoctor&tier=Origin fetches L10-phone with state 'on'.
   - (b) The Auditer's fight-stats after-numbers, then Dom's ?perf=1 shots on his iPhone are pass/fail for the jitter. If it still jitters, Lead routes it back.
   - (c) #973 row-C run on Lead's window.
7. **No crons.** App worktree .claude/worktrees/vigorous-northcutt-a264de (branch herolook/pd-phone-lod, merged). Session scratchpad 5683c274…/scratchpad:
   - pdphone/pack-phone.sh + cut.mjs: my copy of Armour's pack pipeline with --flags. zsh gotcha: `${X:+--opt $X}` is ONE arg.
   - lodslot.sh: the merged-stack slot script.
   - ci1001/: a clean detached checkout for builds.
   - Evidence branches: evidence/plaguedoctor-looks-1001, evidence/pd-phone-lod-1017.
   - Running tests during a deploy: the hook allows a BARE `node --test <file>`, never a chained command.

## 2026-09-28 03:59 (+04) — HANDOFF before /clear. READ FIRST, then the NOW block below it, then memory

1. **LIVE 0d3d7442** (my curl 03:59). No deploy.sh running. No run of mine in flight.
2. **Went live today:** #918, the rank-look streaming runtime (the opponent's rank look streams in after the fight is playable and swaps on at a quiet beat), shipped DEFAULT-OFF in Run 2 (a0a9275a, 02:26). Row C, the waist-cut rebake step at CPU x4, went 1983 → 160 → 111 → 188 → 56 → 21.7 ms.
3. **NOT LIVE — #961 "Goblin rank looks ON"** (herolook/goblin-looks-on @ 0f6df34d, READY and undrafted). The Goblin at rank 2–10 streams public/looks/goblin-L2..L10.glb (Armour's packed4, frozen); rank 1 = his rig as shipped. Deploy has a conditional re-GO as the 4th run after #965, on its own CI count. It went red once on release check 2 (a streamed look counted as a rig); fixed, and the check now asserts the Goblin's L3 goes ON (negative run proven). The gate on L2/L5/L10 PASSES and the rank stills L1–L10 are in the PR body (evidence/goblin-looks-on-961 @ ee8be077); Finishers' L8–L10 closed-helm PASS; Auditer no-blocker. After publish, the live proof on request from Deploy: ?opponent=goblin&tier=Origin fetches /looks/goblin-L10.glb and __rankLook reaches 'on'; at Recruit nothing is fetched.
4. **Sessions down:** none that I know of (Lead is back after its 02:1x clear).
5. **Rulings today** (all in memory herolook-pipeline.md): look files carry only their own draws plus extras.keep (Lead); keep names are read through sanitizeNodeName (Wrap.Boots → WrapBoots); storage cap (b): one LOOKS line per opponent set (Goblin 22 MB gz), 2.6 MB gz per file, out of TOTAL and per-fight; L1 = no look, L2 = Armour 8bb6efcb (no arms); a rank-up at the rematch reloads when the look file changes; the replay/sparring rank notes are issue #963 (not blockers).
6. **QUEUE after #961:** (a) the Auditer-nits PR off trunk: opened.ts inline `if (i % CHUNK === CHUNK-1) { yield took(); … }` instead of `yield* pause(i)`, and reset `scanned` at phase yields, plus its own 3-min x4 row-C run (test-slot work; pause if deploy.sh starts). (b) The live proof of #961 when Deploy asks. (c) Veteran/Pitborn look sets when Armour's packed4 files pass (each needs its own LOOKS line).
7. **No crons.** Worktree: app worktree .claude/worktrees/vigorous-northcutt-a264de (branch herolook/goblin-looks-on). Gate scripts: session scratchpads (gate-on.sh, wait30.sh, guard30.sh in fe83399b…; guard2/waitquiet/uricheck in 52277733…). Node step probe: scratchpad zz-steps.test.ts (keep it OUT of tests/). Stills: `node scripts/rank-look-check.mjs --opponent goblin --look /looks/goblin-L2.glb --dist dist --rungs [--tiers …] --label …`.

## NOW — 2026-09-27 late (restart from here; replace wholesale next time)

**Role:** Hero Look owns the generation RECIPE + fit tooling; Armour builds the sets; everything via Lead. Legionary-on-hero is CLOSED (hero = Recruit, own face). Plan = **100 looks** (docs/briefs/tier-kits.md on trunk, #900 merged): LOW today's kit r1–3 (tints), one MID mesh r4–6 (tints), four HIGH meshes r7–10 (`master` steel/blackened, `primus` emerald, `invictus` gold, `origin` obsidian-ruby) = 50 generations; spend = Dom's ~$50 HF call. Ids `<opponent>.<slot>@<look>` (LOW no suffix); server migration widens the piece check (Backend, after #621/#778); look = min(record level, server rank before claim).

**Open:**
- **#906** (herolook/set-hide @ ee04b9db, docs, queued in a docs batch): docs/briefs/tier-looks-runtime.md — rank looks stream after first playable and swap only on an idle beat (hero too); size limit = CI time gate (first playable ≤ 20 s at 9 Mbps, Web); an opponent hides his own look AS A SET; OFF/STAYS table per rig (6 scanned rigs = fused CreatureBody → full fitted figure with its own skin + head split; 4 built rigs = hide by material list; Leather rows by bone from Armour). CI green; the repo Stop gate keeps timing out at 420 s on the loaded box (not failing).
- **Opponent look check** for Armour: `scripts/opponent-look-check.mjs` on origin/herolook/look-check @ 0d658ac1 (no PR yet; ask Lead whether to PR it). Trunk Centurion → SET RULE FAIL "CreatureBody visible" (expected until runtime set-hide or Armour's figure build).
- **Centurion bronze proof** = next art deliverable, Armour builds, I support (they keep Part2 skin in the opponent look file, reuse the v9b raw fit; HAND_STRIP + smoothing wall 587627c2 only if re-fit — still unverified).
- After the bronze proof lands: ONE small PR removing the `?hero` flag + public/herolook/legionary.glb.
- Kill-record script RV16-fixed @ 7777744f (seed 925 wins).

**Rules:** heavy runs (Blender, renders, test suites) only on Lead's GO + pgrep deploy.sh empty + load < 30. Deadlines are NOW/ASAP only; name the physical blocker. Measure bytes through scripts/optimize-glb.mjs (source gzip overstates ~2×). Check supabase/migrations when an id shape changes.

## CLOSED — 2026-09-27 10:4x +04 (Dom via Strategy, relayed by Lead)

Legionary-on-hero is CLOSED, not paused. The hero stays the Recruit with his own face; no new hero body, no female hero; playable opponent bodies are an Origin feature after beta. The Sand Legionary becomes the **Centurion's Bronze opponent set** (tier 5 Champion, levels 21–25). Armour fits it on the Centurion's rig as the proof; the source (`~/Desktop/Business/artifacts/sand-legionary-pilot/review/sand-legionary-review.glb`, sha e47ed74a…, already split per piece) and the fit notes were sent to Armour 10:5x. The `?hero` preview flag stays as a dev route until that proof lands, then one small PR removes the flag and `public/herolook/legionary.glb`. **Now:** tier-kit table for the other nine opponents, docs PR #900 (`docs/briefs/tier-kits.md`, branch `herolook/tier-kits` @ 0dc4ffc0), waiting on Lead → Strategy before any spend. This branch stays as history; never delete it.

## HOLD — 2026-09-27 08:5x +04 (Dom via Strategy, relayed by Lead)

All legionary work stopped: hands, crest, forearm, phone-tier pricing, draft default-swap PR. The live `?hero` preview is untouched. No new hero brief until Dom and Strategy close the design talk; idle until Lead sends one. Only work in flight: `HAND_STRIP` now also walls the hand off from the 16-pass weight smoothing (`scripts/character/creatures.py`), WIP on `herolook/sand-legionary` @ 587627c2, **never fitted or verified**. 

**Standing rule (Dom, 2026-09-27 10:1x, via Strategy):** no fake extended deadlines or times; every deadline to Dom, Lead or Strategy is NOW or ASAP. If today is physically impossible, name the physical blocker (a run with minutes left, a red gate, the box busy, an HF quota), never a day.

Everything below is the pre-hold handoff, kept as it was.

## HANDOFF — 2026-09-27 ~02:05 +04 (restart from here; replace wholesale next time)

**MORNING ORDER (Lead, 2026-09-27 morning; start heavy steps only after #879 Published, pgrep + load < 30).** (1) Fix the preview's faults in order: hand slivers, crest-top fringe, Riposte forearm stretch. Proof as last night: pose-strip, clipcheck delta vs warrior.glb, 375 fight + kill frames. ONE PR that updates public/herolook/legionary.glb (optimizeGlb it first). NOTE: Lead's suggested strip of non-arm-chain weights near the hand IS HAND_STRIP, already in v9b, and it did not remove the slivers at full-body scale. Next routes: re-pose the source's arms out to an A-pose before the fit (hands away from the thighs, as with the TRELLIS sources), or delete the generated hands and use the hero's hand geometry. (2) Price a PHONE-TIER legionary: ≤50k tris, 1024 maps. Numbers only: gz MB, per-fight total vs 12 MB, Mac frame time. Report to Lead as you go.

**Strategy GO + additions (via Lead).** (a) First visible artefact within 30 min of starting: a before/after still of the hands. (b) The preview update gets its own deploy run when READY. (c) Also prepare a DRAFT default-swap PR behind Dom's yes: the legionary replaces warrior.glb (dropped from the bundle), with loot hidden on an armoured body as the interim rule, and check-budget per-fight before/after in the PR body. It stays draft until Dom says yes, then one run.

**Shipped tonight.** Dom (23:5x via Strategy): "gpt version is amazing, you are just adding the face." The GPT review set (`artifacts/herolook/gpt/sand-legionary-review.glb`, read-only) is fitted on the hero's rig with his OWN head. It is live as a **preview flag**: PR #870 (herolook/preview-flag @ 8a9b5bd0), deployed in b0e4a2fe. Dom's link: https://frankendom.com/?hero=/herolook/legionary.glb. Live proof at 375 WebKit: `200 /herolook/legionary.glb`, no warrior.glb, no loot.glb, 0 errors (`artifacts/herolook/live-375.png`). Swapping warrior.glb for every player is Dom's call after he has seen it (loot-layer collision, about +1.9 MB gz a fight).

**The ship fit (v9b).** `herolook_join.py` on the review GLB → cp to `src/assets/source/creatures/legionary.glb` → `HEAD_SKIN=Material_0.008 HELM_MATS="Material_0.001,Material_0.002,Burgundy horsehair" HELM_SCALE=1.22 HELM_FIT=even HAND_STRIP=1 OWN_HEAD=1 CREATURE_TRIS=95000 CREATURE_ARM=64 CREATURE_HEIGHT=2.022 CREATURE_OUT=public/herolook/legionary-v9b.glb node scripts/build-creatures.mjs legionary`. Then run the build's own `optimizeGlb` (scripts/optimize-glb.mjs) on it before it goes to `public/herolook/`: public/ files skip the build optimizer, and the raw file broke the 44 MB total (10.09 → 6.05 MB, 4.05 MB gz). Result: 108,598 tris with head and sword, 17 draws, 25 clips.
- The GPT model is already hero scale (its eyes 1.645 m vs his 1.643). Never shrink it, or the helm drops over his eyes.
- `creature_pack.py` splits a multi-material source into one draw per primitive. The loader (characters.ts loadFighter) needs `CreatureBody` as ONE SkinnedMesh; without the split the game showed "Warrior art could not load".
- Head fit: HEAD_SKIN cuts only the generated head skin (head column, |x| < 12 cm). HELM_MATS scales and pushes only the helm pieces, which is what fixed the torn pauldrons. HELM_FIT=even never squeezes depth, so the cheek guards stay.

**Evidence.** PR #870 body. Default fight 9,871,129 → 9,871,330 B gz. Total 39.57 → 43.63 MB of 44, **headroom 374,511 B** (Lead accepted it for the preview). Relative clipcheck vs today's hero: the absolute ×2 rule is miscalibrated because it fails the shipped hero on 26/26; the legionary's worst stretch is lower on every clip. Mac frame time: median 17.3 ms vs the hero's 17.2–17.7. Mocked-QA WebKit check `scripts/hero-preview-check.mjs`: PASS.

**Morning table (in order).**
1. **Hands**: reddish slivers at the sword hand in Attack, Heavy and Riposte (`artifacts/herolook/pose/pose-strip-v9b.png`). Cause: the source's hands hang beside the thighs, so the finger skin (CreaturePart2 = base-body) took thigh weight. Tried: KEEP_FINGERS, FINGER_SCALE, HAND_ARM (hard, then soft) and HAND_STRIP. Close-ups improve, full-body shots don't. Next idea: re-pose the source's arms out (A-pose, like TRELLIS) before the fit, or delete the generated hands and borrow the hero's hand geometry.
2. Crest fringe at the helm crown. 3. Stretched forearm skin in Riposte. 4. The Profile paperdoll is still today's figure (static images). 5. The daily/kill-link redirects drop `?hero=`. 6. Storage headroom.

**Parked.** TRELLIS normal-transfer bake (legionary-d-tmax → dbake, 61 s): the shards are fixed; black skin speckle is left (ray misses on inward normals). Next: a second pass with flipped normals, filling the misses. ZeroGPU quota resets ~2026-09-27 19:20 +04.

**Gotchas.** Before EVERY heavy command, in the same command: wait until load < 30, `pgrep -f "^bash scripts/deploy.sh"` is empty, and Lead has posted FREE. I slipped twice tonight (a fit during 99f21cc3, and a clipcheck at load 37). The PR worktree is in the session scratchpad (`scratchpad/pr`); the set tooling is on herolook/sand-legionary (6524d7fe+). Hand/pose shots: `artifacts/herolook/hand-shot.py`, `pose-shot.py` (local, gitignored).

## RECIPE (draft, 2026-09-26 20:0x +04) — a generated armour set on the hero, as run tonight

Strategy ruled the Sand Legionary passes the direction test; this is the recipe Armour runs. Draft: steps as actually run, failure modes named. All commands from the repo root; Python is `~/.venvs/face/bin/python` (gradio_client, PIL); HF login via `hf auth login` (ZeroGPU quota, never printed). Every step writes its prompt, seed and sha beside its output.

1. **Design image (FLUX.1-dev text-to-image).** `scripts/character/t2i.py --prompt-file <p>.txt --out docs/character-references/<set>-source-tN.png --seed <n> --size 832x1216` (~60 s). Prompt shape (`sand-legionary-t2i-c.txt`): "Full-body studio photograph of a lean athletic broad-shouldered clean-shaven arena gladiator …, standing upright in a symmetrical A-pose facing the camera, … head to sandals in frame, no weapon and no shield. He wears <set, piece by piece: helm + crest, cuirass, tunic, belt, skirt, bracers, greaves, footwear>. <wear: scuffed dented iron, dulled brass, oiled cracked leather, faded frayed cloth>. Plain flat uniform light grey studio background, soft even frontal lighting, no shadows, no floor line, photorealistic, sharp detail." Run 2–3 seeds, pick by eye against the guide.
   - FAILED route: Kontext on the hero's own portrait (`kontext.py` on `artifacts/source/face/gpt_front.png`) keeps the face and LOSES THE LOOK (skullcap, flat vest, rag skirt). Do not start from the hero's face; the face comes back at step 5.
   - Body type: say "lean athletic"; the first seed gave a heavy bearded man with a belly.
2. **A-pose (Kontext).** `scripts/character/kontext.py --image <tN>.png --prompt-file <set>-tN-pose.txt --out <set>-source-tNa.png --seed 190926` (~30 s). "Change his pose only: … A-pose with both arms held straight and lifted out to the sides at 40 degrees from his body, clear space between the arms and the torso, open relaxed hands … Keep the same man, the same <every piece>, same colours and materials. Plain light grey background." FLUX alone will not give arms off the body; TRELLIS fuses arms that touch the torso.
3. **Reconstruction (TRELLIS.2).** STANDING SETTING (Dom 2026-09-26 21:3x, supersedes the 100k line): MAX only, `--resolution 1536 --steps 50 --faces 500000 --texture 4096` (+ `--also-faces 150000 100000` for fit inputs from the same latent when quota allows). The reduction to the 80k fit budget is the fit's job: plain decimation shatters (`artifacts/herolook/bakeoff/d-vs-tmax.png`); see HANDOFF for the bake step; Hunyuan3D-2.1 lost the bake-off on the raw output (40k-tri cap, blobby, no face), kept only as a candidate source of metal/rough maps. `scripts/character/trellis2.py --image <set>-source-tNa.png --name <set> --resolution 1536` → `src/assets/source/creatures/<set>.glb` (~105 s at 1536). **Use 1536**: at 1024 the face and crest were a smeared mask and a blob; 1536 carries the cuirass bands, studs and a brushier crest. faces 100000 (the Space's minimum), texture 2048.
4. **Height.** Probe the reconstruction's width profile (`artifacts/herolook/probe.py`, Blender) and set the family's height so the helm crown lands just over the hero's skull: legionary = 1.90 m sole-to-crest-tip over the hero's 1.44 m shoulder joint. Arm angle 62 fits a 40° A-pose source (fingertips within 5 cm).
5. **Fit onto the hero rig (Blender 5.2.1).** Family row in `scripts/character/creatures.py` recipes on base `warrior` (the Plague Doctor recipe), plus the family in the three arm/finger tuples and `creature_pack.py`'s base map; then `CREATURE_OUT=public/herolook/<set>.glb node scripts/build-creatures.mjs <set>` (~6 min on a loaded box). Output: skinned on the hero's own skeleton, all 25 clips, sword kept. `CREATURE_OUT` keeps it out of `src/assets` (the bundle globs `./assets/*.glb`).
   - **Own head** (Strategy: the hero's face is the identity): `creature_pack.py` KEEP_SLOTS keeps the hero's Face and Eyes draws; `creatures.py` HEAD FIT scales the generated helm about the chin line so its width and depth at the brow match the hero's skull plus 1.2 cm a side (legionary: x1.25 wide, x0.80 deep; blended in over 6 cm under the chin so the neck guard stays on the cuirass), cuts the generated face in the helm's opening only (front-facing, chin to 5 cm over the eyes, within 7.5 cm of the midline), and pushes any helm vertex still inside the skull out to 1.2 cm. The generated neck is left alone: thinner than the hero's, it sits inside it. Two failed tries, both recorded so nobody repeats them: cutting everything within 1.8 cm of the head removed the whole helm; pushing vertices out one by one crushed the helm into a skullcap. The generated head is simply smaller than the hero's.
   - **Fingers**: NOT on `keep_fingers`. The generated fingers are longer and splayed wider than the hero's fitted knuckles (hero hands v44), so the donor's curl bent them into claws; pinned rigid to the hand they stay open and relaxed.
6. **Shield (FLUX → TRELLIS.2 → placed).** `t2i.py` on a product-shot prompt (`sand-legionary-scutum-t2i.txt`), `trellis2.py --name <set>-scutum --texture 1024`; `blender -b -P scripts/character/herolook_scutum.py` decimates to 6k tris, sizes it (1.02 m), stands it upright facing forward-left in the Idle pose at the left forearm and carries it into the forearm's rest frame; `python3 scripts/character/herolook_attach.py public/herolook/<set>.glb artifacts/herolook/scutum-placed.glb lowerarm_l --name HeroScutum` hangs it off the bone (byte-level merge, rig untouched). Placed in T-pose instead, it crossed the chest.
7. **Stills.** Profile pair: `node scripts/herolook-stills.mjs --pilot public/herolook/<set>.glb --label <l>` (the loot-layers Profile frame, today's Centurion kit vs the set) then `scripts/herolook-strip.py`. In game: `node scripts/herolook-game-stills.mjs --label <l> [--start 9 --every 0.4]` replays one real winning fight (`scripts/herolook-kill-record.mjs`, seed 925 vs the Centurion) in the real game at 375x812 with `?hero=/herolook/<set>.glb` (stills-only switch, branch-only until Lead reviews it).

**Known failure modes (and the step that owns them).** Face mask with red lips at 1024 (generation: use 1536, then the own-head fit). Crest as a lumpy blob (generation: TRELLIS does not do hair-like brushes; candidate fix is a built crest card, not yet tried). Hands as claws (fit: generated fingers under the donor's curled finger weights; fixed by pinning them rigid, see step 5). Scutum placement (fit: place in Idle, not T).

## 2026-09-26 19:25 +04 — Interim Profile pair: light and materials alone (Lead's split, Dom 19:4x)

**Finding.** Today's Centurion kit on the hero, rendered twice through the Profile tab's own frame (loot-layers camera, fov 18, 800x1400): once as shipped, once at the close-up budget. Light and materials alone barely move it. The bronze helm and greaves gain grain and a cast shadow; the kit is still a tunic, a slab skirt and tube greaves. **The mesh is the limit, not the shader.** So the pilot's answer hangs on generation and fit, not on renderer work.

**Close-up budget used.** Shadow-casting key (2048 map, PCF soft) + cool fill + warm rim; environment 0.28 → 0.55; 2x supersample; the kit's maps at source size instead of the carrier's copies.

**Cost line (interim).**
| Map family | Shipped on the hero (colour/normal/ORM) | Close-up | Download delta |
|---|---|---|---|
| Bronze (helm, greaves) | 1024 / 512 / 1024 | 1024 / 1024 / 512 | +0.1 MB (normal) |
| Leather | 512 / 512 / 512 | 1024 / 1024 / 512 | +0.41 MB (114 KB → 530 KB) |
| Heraldry, Wrap | 512, 256 | unchanged | 0 |
Total about +0.5 MB. Frame time: not measured; this is an offline Playwright render, not a phone.

**Evidence.** `artifacts/herolook/interim/profile-pair-{375,1280}.png`, `today.png`, `kit-closeup.png` (untracked, local). Harness `scripts/herolook-stills.mjs --pilot none --label interim --look closeup --ss 2`, strip `scripts/herolook-strip.py`. Sent to Lead 19:2x; Lead forwarded.

**Generation so far.** Kontext on the hero's own face (sources v1, v2, v2g4, b1) kept the face and lost the look: a skullcap, a flat plate vest, rag skirt, leather boots. FLUX.1-dev text-to-image with a written design (t1–t3) reads as the set; t3 (lean legionary, tall red crest, banded cuirass, studded strip skirt over red, greaves) was put into an A-pose by Kontext (t3a) and sent to TRELLIS.2. Prompts and receipts sit beside each PNG in `docs/character-references/sand-legionary-*`.

**Remaining.** TRELLIS.2 → `build-creatures.mjs legionary` (fit on the hero rig, CREATURE_OUT outside src/assets) → Sand Legionary Profile pair on the same frame and background (Lead, due 22:00) → kill screen, fight camera, phone frame time.

## Now — the pilot, as of 2026-09-26 19:2x +04 (restart brief; replace wholesale)

**The question you exist to answer.** Dom looked at the mood board (`docs/briefs/armour-sets/moodboard-mid-tier-four-sets.webp`) and asked: can that level of character detail live in OUR game, in the browser, on a phone, without a rewrite? Dom's words: "our current chars are decent for an indie game, but these sort of look and feel chars would be wow AAA grade and go viral." You prove it or disprove it with ONE set, end to end, before anyone spends weeks.

**The pilot.** Take the **Sand Legionary** from the mood board (red segmented cuirass, crested helm, rectangular red shield, gladius). Build it as a wearable set for the hero using the pipeline the characters already use (image-to-3D generation as for Veteran v2 and the Nightborn face, Blender clean-up and fit, our materials), but at the higher budget the hero-moment cameras can afford: real metal / leather / cloth PBR, a normal map carrying the engraving, and whatever key light and shadow the close-up cameras need. Put it on the hero in our arena.

**The deliverable (stills, nothing else counts).** One 375-wide strip in the mood board's own format, same camera and arena per pair: (a) Profile tab, pilot set vs today's Centurion kit; (b) kill screen, pilot vs today; (c) the fight camera, pilot vs today, so Dom sees honestly what does NOT change at 110 px; (d) optional 1280 of (a) and (b). Plus one cost line: texture sizes, extra download in MB, and frame time on the mid-range Android when Dom supplies it (until then, on the slowest device you have). Stills go to Lead, Lead to Strategy, Strategy to Dom. No PR before Dom's verdict.

**Where the detail must show.** Kill screen, loot take card, Profile, versus card, share clip: the frames people screenshot. The fight camera is NOT the target; there only silhouette and light/dark balance read, and the Armour lane owns that bar.

**Rules.**
- Reference is a GUIDE, not a spec (Dom): design the set for our meshes and camera; nothing traced.
- Own branch off trunk, zero changes to combat, sim, or anything in `src/` that the fight reads. If a renderer change (light, post, texture budget) is needed for the close-up cameras, it is behind a flag or camera-mode switch and off in the fight.
- Phone first: say what the budget IS, do not guess. If the look only holds at 1024 textures, say so with the MB.
- Do not touch the Armour lane's pieces or its ten-rung work; coordinate slot ids through Lead if you need the paperdoll.
- Every still is a real render from our engine, never a concept image.
- Ship each still when it exists; no batching. First pair (Profile, pilot vs today) is the first milestone, not the full strip.

**Success test (Dom judges).** Side by side, the pilot reads as the mood board's character standing in our arena, not as a shinier version of today's Centurion. If it does: the recipe is written down in this file and the Armour lane builds every set that way. If it does not: we know before spending weeks, and you write down exactly which step lost the look (generation, fit, materials, or light).

**Inputs.** `docs/briefs/armour-sets/` (mood board + ten arena renders), `docs/briefs/armour-sets-direction.md`, the character pipeline notes the Character Main and Multi Chars lanes keep in their state files, `docs/GAME_SPEC.md` for the cameras. Dom is also briefing an outside designer (GPT) with the same ask; whatever comes back lands in the same folder as more guides.

**Session.** Dom opens the session on `~/Developer/frankendom-herolook` (Lead creates the worktree off trunk). Restart: read this file, then `docs/briefs/armour-sets-direction.md`, then say in one line what you are picking up.
