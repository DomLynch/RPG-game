# Hero Look — project state (AAA-look pilot)

Lane opened 2026-09-26 19:2x +04 by Strategy on Dom's order ("good, let's use a custom dev for this, as a test"). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md). Folder `~/Developer/frankendom-herolook`, session name **Frankendom - Hero Look**, key `herolook`. Reports to Lead; Lead sends Strategy milestones. Read `docs/briefs/armour-sets-direction.md` and its folder `docs/briefs/armour-sets/` first.

## HANDOFF — 2026-09-26 ~23:05 +04 (restart from here; replace wholesale next time)

**Now (pick up in this order; box steps only after Lead's Published/FREE, deploy.sh gone AND load < 30, one heavy process at a time).**
Deploy 13a90467 was running at 23:0x. Lead is the reporting channel (Strategy/Dom send via Lead; Strategy may message directly).
1. **Reduction bake, normal-transfer version (never run yet).** Dom's rule: TRELLIS.2 generates at MAX only (1536 / 50 steps ×3 / 500k / 4096) and the fit solves the reduction. Run:
   `/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 -P scripts/character/herolook_bake.py -- src/assets/source/creatures/legionary-d-tmax.glb src/assets/source/creatures/legionary-dbake.glb 80000 4096` (~4–6 min)
   then `~/.venvs/face/bin/python scripts/character/glb_webp_to_png.py src/assets/source/creatures/legionary-dbake.glb public/herolook/raw-dbake.glb` and `node scripts/herolook-sheet.mjs --label sheet-d E0=public/herolook/raw-dbake.glb`; compare `sheet-d/A-front.png` vs `E0-front.png` at 1:1. If still shards, next options: voxel/quad remesh then decimate, or Blender "Decimate" planar/unsubdiv, then bake.
2. **E = fitted hero from the bake**, hero's OWN head (Dom reversed the A-head idea 22:5x: keep the current face; OWN_HEAD default 1; hero-head-a.glb is NOT created): `cp legionary-dbake.glb legionary.glb` in src/assets/source/creatures, then `HELM_FIT=width CREATURE_TRIS=80000 CREATURE_OUT=public/herolook/legionary-e.glb node scripts/build-creatures.mjs legionary`. NO herolook_normal.py (its metal 0.6 dulled the steel — dropped). Sheet column E next to A and B (`node scripts/herolook-sheet.mjs --label sheet-d E=public/herolook/legionary-e.glb`), recompose sheet-1280 + chest 1:1, send Lead + Dom (SendUserFile). HELM_FIT=width stops the ×1.25 height stretch ("reads as a crown"); justify any widening with a clipping still.
3. **GPT leg** (Dom approved its look): input `artifacts/herolook/gpt/sand-legionary-review.glb` (copied from /Users/domininclynch/Desktop/Business/artifacts/sand-legionary-pilot/review/ — READ-ONLY source, never the old glb/ folder). `blender -b -P scripts/character/herolook_join.py -- artifacts/herolook/gpt/sand-legionary-review.glb src/assets/source/creatures/legionary-gpt.glb artifacts/herolook/gpt/scutum-gpt.glb` → cp to legionary.glb → fit with the CURRENT hero head (arm angle unmeasured: its arms hang ~15–20°; try CREATURE_ARM≈65–70, CREATURE_HEIGHT≈1.94, iterate on a Profile still). Its own head only as a reference column if cheap (OWN_HEAD=0). Then its scutum vs ours in one shot, and the kill + fight replay at 375 beside E with tris / MB gz / Mac frame time labelled "Mac, not a phone".
4. **Pixelmator proof** (Dom said do it): `node scripts/pixelmator-maps.mjs --in artifacts/herolook/pix/in --out artifacts/herolook/pix/out --size 4096` on the -d 2048 colour map (already extracted). First run may hit macOS Automation (TCC) "not authorized to send Apple events": report the exact error to Lead, don't work around. Proof = 1:1 before/after crops, seconds per map, one kill still on the hero beside untouched. Guard refuses it under a deploy lock (named pixelmator-*).
5. Polish after the above: steel-not-gold chest eagle (converter-side: it is already steel in B), dark chin patch (fit side).

**Findings tonight (keep).**
- Six-angle sheet (`artifacts/herolook/sheet-d/`, harness `scripts/herolook-sheet.mjs`; fitted rigs posed back to A-pose, arms 62°): Dom ranks raw A (max 495k/4096) best, raw B (-d 100k/2048) second, both fitted below. Loss A→B = converter setting (gold eagle/trim go muddy); B→C1 fit = small (face swap, helm stretched taller, chin patch); C1→C2 our re-material (metal 0.6) = slightly worse.
- Decimating the 495k to 80k SHATTERS (Blender collapse). Baking 4096 maps onto the decimated mesh still shattered → it is NORMALS: TRELLIS winding is inconsistent; recomputing outside-normals made it worse (flips shells). Current bake transfers the 495k's custom normals (DATA_TRANSFER CUSTOM_NORMAL), no weld. Untested.
- Hunyuan3D-2.1 lost the bake-off on raw output (40k cap, blobby, no face); dropped (only a candidate metal/rough map source).
- The raw 4096 WebP colour map fails to decode in Chromium; `scripts/character/glb_webp_to_png.py` re-embeds PNG for stills.
- Cost of the bold-cuirass fit (legionary-d): 106,795 tris, 10 draws, 4.61 MB gz vs today's hero 2.66 (+1.95, accepted for the pilot).

**Open / blocked.**
- HF ZeroGPU Pro quota EXHAUSTED until ~2026-09-27 19:20 +04 (error "Try again in 21:30:05" at 21:50). Credits $1/10 min (~$1 per max set) are Dom's decision, put to him via Strategy; never buy or work around. The max-latent lower extraction (`trellis2.py --also-faces 150000 100000`) waits for quota.
- Phone frame time: needs Dom's iPhone; winner ships as ONE PR (?hero= switch + GLB) after #843/#849, check-budget first. Mac number still owed with the GPT render.
- Quality gate: timed out twice on a load-100+ Mac (not a failure); src change on the branch is only the stills-only ?hero=/?prop= switches in src/scene.ts (tsc clean).

**Gotchas.**
- Session worktree `.claude/worktrees/vigorous-northcutt-a264de`, branch herolook/sand-legionary (pushed, 6769aed5+). Never write into ~/Developer/frankendom-herolook.
- ALWAYS `pgrep -f "^bash scripts/deploy.sh"` and check load before any Blender/browser/Pixelmator step; wait for Lead's posted slot (I jumped the queue twice tonight: 21:15 and 21:42).
- `herolook-stills.mjs --pilot` takes a repo-relative path (no leading slash) or it throws ERR_HTTP_HEADERS_SENT. `herolook-game-stills.mjs --pilot` takes the URL path (/herolook/x.glb). Game stills are 1125x2436 (3x); resize, don't crop, for 375.
- Replay frame timing is wall-clock and shifts with load: pick fight/kill frames from a contact sheet by content.
- `build-creatures.mjs legionary` always reads src/assets/source/creatures/legionary.glb (swap files); env passes through: CREATURE_TRIS, CREATURE_OUT, CREATURE_ARM, CREATURE_HEIGHT, HELM_FIT, OWN_HEAD.
- zsh does not word-split `$var` in `set -- $p`.
- artifacts/ is gitignored: tooling goes in scripts/.

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
