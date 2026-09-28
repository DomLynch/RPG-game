# Hero Look — project state (AAA-look pilot)

Lane opened 2026-09-26 19:2x +04 by Strategy on Dom's order ("good, let's use a custom dev for this, as a test"). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md). Folder `~/Developer/frankendom-herolook`, session name **Frankendom - Hero Look**, key `herolook`. Reports to Lead; Lead sends Strategy milestones. Read `docs/briefs/armour-sets-direction.md` and its folder `docs/briefs/armour-sets/` first.

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
