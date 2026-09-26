# Hero Look — project state (AAA-look pilot)

Lane opened 2026-09-26 19:2x +04 by Strategy on Dom's order ("good, let's use a custom dev for this, as a test"). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md). Folder `~/Developer/frankendom-herolook`, session name **Frankendom - Hero Look**, key `herolook`. Reports to Lead; Lead sends Strategy milestones. Read `docs/briefs/armour-sets-direction.md` and its folder `docs/briefs/armour-sets/` first.

## HANDOFF — 2026-09-26 ~20:45 +04 (restart from here; replace wholesale next time)

**Now (pick up in this order).**
1. **22:00 frame for Dom = the BOLD-CUIRASS set.** Dom on v3: "shield looked decent", the character "average / similar to what we have". Strategy's rule: design around one or two big readable devices and strong shape breaks, not fine detail. The new source `docs/character-references/sand-legionary-source-d190926a.png` has bright polished steel, a big gold eagle filling the chest, gold-rimmed pauldrons and a crimson scarf. Its TRELLIS.2 1536 reconstruction is `src/assets/source/creatures/legionary-d.glb` (untracked). It is NOT fitted yet: a deploy started, and local Blender/browser steps wait for deploy.sh to exit. At FREE, run from the worktree:
   `cd src/assets/source/creatures && cp legionary-d.glb legionary.glb && cd ../../../..` (the fitter reads `legionary.glb`; the t3a source is kept as `legionary-t3a-r1536.glb`), then
   `CREATURE_OUT=public/herolook/legionary-d.glb node scripts/build-creatures.mjs legionary`
   `~/.venvs/face/bin/python scripts/character/herolook_normal.py public/herolook/legionary-d.glb --metal 0.6 --strength 3`
   `python3 scripts/character/herolook_attach.py public/herolook/legionary-d.glb artifacts/herolook/scutum-placed.glb lowerarm_l --name HeroScutum`
   `node scripts/herolook-stills.mjs --pilot public/herolook/legionary-d.glb --label legionary-d --look profile`
   `~/.venvs/face/bin/python scripts/herolook-strip.py --out artifacts/herolook/legionary-d/profile-pair --title "Profile · same frame" --crop 0.12,0.06,0.92,0.97 --panel artifacts/herolook/legionary-v1/today.png "Today" --panel artifacts/herolook/legionary-d/pilot.png "Sand Legionary"`
   Then the game pairs: `node scripts/herolook-game-stills.mjs --label game-d --pilot /herolook/legionary-d.glb --frames 28 --every 0.5`. Frames are wall-clock, so pick the kill and fight frames by content, not by index. Send each still to Lead as it lands.
2. **Phone frame time**: not measured yet. `?perf=1` gives an on-device readout; the fastest honest number is Dom's iPhone on a build carrying `?hero=` (needs Lead). A headless Mac number is not a phone number; say so if that is all there is.
3. **Generator bake-off** (Strategy order, Dom 20:3x): the same source through (a) TRELLIS.2 max, (b) Hunyuan3D-2.1 with PBR, (c) Meshy or Tripo. Then the same fit and Profile camera, three stills side by side, with tris and texture set for each. Hunyuan3D-2.1 is running via `artifacts/herolook/hy21.py` (direct `/generation_all` call; `scripts/character/hunyuan.py` failed on 2.1 with "Please provide either a caption or an image"). Output goes to `artifacts/source/hunyuan/legionary-hy21-*.glb`, log `artifacts/hunyuan-legionary.log`. Meshy: 30 credits per image-to-3D with 2K PBR, about $0.60 on Pro ($20 for 1,000 credits). Dom pays and supplies the key; never create accounts. Tripo price: not found (page 403). Also try MULTI-VIEW: front/side/back design views generated first, then fed to the converter.
4. **Budget (Dom, 20:3x)**: hero sets may use up to 80k tris at close-up cameras, with an automatic LOD under 30k for the fight camera; textures 2048 close-up and 1024 in the fight. The LOD step is not built yet.
5. **Adopt or amend Armour's tooling commit** `origin/armour/hero-sets-tooling` 4ded6d53 (off 06e5531e). It generalises `family == "legionary"` to `HERO_SETS = ("legionary", "hoplite")` and adds a hoplite row with CREATURE_HEIGHT. You own the tooling; merge it rather than let two copies diverge.

**Done today (all on herolook/sand-legionary, pushed; no PR by rule).** 7e0cd090 sources, harness and ?hero= switch; c2bcf6ae draft recipe, own-head fit, scutum, replay stills; 06e5531e helm scaled over the hero's head, fingers rigid. Stills sent to Lead, all under `artifacts/herolook/` (untracked):
- interim (materials+light only: Dom "5–10% max, same same");
- legionary-v2 (first generated pair: Strategy PASSED the direction test, the recipe is adopted);
- legionary-head (own head);
- legionary-v3 (own head + open hands + seated scutum: Dom "shield decent, character average");
- game-v3 kill-pair and fight-pair (real game, same replayed fight).
Cost of v3, measured with scripts/optimize-glb.mjs: pilot rig 3.92 MB gzipped vs today's hero 2.67 MB (+1.25 MB); 72k tris, 10 draws; body colour 2048 WebP + ORM 2048, scutum 1024.

**Open.** 22:00 bold-cuirass pair (blocked on deploy FREE). Frame time (needs a phone). Bake-off. The ?hero= switch in src/scene.ts stays branch-only until Lead reviews it. Crest is a brush but lumpy. Cheek-guard edges tear slightly at the face, and there is a pale seam under the chin.

**Gotchas.**
- Session worktree: `.claude/worktrees/vigorous-northcutt-a264de` (node_modules symlinked from ~/Developer/frankendom-herolook). Never write into ~/Developer/frankendom-herolook.
- The TRELLIS source GLBs and public/herolook/*.glb are untracked (5–9 MB each); they regenerate from the committed PNG + seed.
- `build-creatures.mjs legionary` always reads `src/assets/source/creatures/legionary.glb`: swap files to switch sources. It overwrites `artifacts/character/creatures/legionary-*`.
- `herolook_attach.py` refuses a rig that already has HeroScutum. Keep a `-noshield` copy, or rebuild before re-attaching.
- Local Blender and browser steps wait while `pgrep -f "^bash scripts/deploy.sh"` is running (Lead's rule; one build ran across a deploy start at 20:02 before the notice arrived).
- Scratchpad files vanished once. Keep probes in `artifacts/herolook/`.
- TRELLIS.2 `--faces` minimum is 100000.

## RECIPE (draft, 2026-09-26 20:0x +04) — a generated armour set on the hero, as run tonight

Strategy ruled the Sand Legionary passes the direction test; this is the recipe Armour runs. Draft: steps as actually run, failure modes named. All commands from the repo root; Python is `~/.venvs/face/bin/python` (gradio_client, PIL); HF login via `hf auth login` (ZeroGPU quota, never printed). Every step writes its prompt, seed and sha beside its output.

1. **Design image (FLUX.1-dev text-to-image).** `scripts/character/t2i.py --prompt-file <p>.txt --out docs/character-references/<set>-source-tN.png --seed <n> --size 832x1216` (~60 s). Prompt shape (`sand-legionary-t2i-c.txt`): "Full-body studio photograph of a lean athletic broad-shouldered clean-shaven arena gladiator …, standing upright in a symmetrical A-pose facing the camera, … head to sandals in frame, no weapon and no shield. He wears <set, piece by piece: helm + crest, cuirass, tunic, belt, skirt, bracers, greaves, footwear>. <wear: scuffed dented iron, dulled brass, oiled cracked leather, faded frayed cloth>. Plain flat uniform light grey studio background, soft even frontal lighting, no shadows, no floor line, photorealistic, sharp detail." Run 2–3 seeds, pick by eye against the guide.
   - FAILED route: Kontext on the hero's own portrait (`kontext.py` on `artifacts/source/face/gpt_front.png`) keeps the face and LOSES THE LOOK (skullcap, flat vest, rag skirt). Do not start from the hero's face; the face comes back at step 5.
   - Body type: say "lean athletic"; the first seed gave a heavy bearded man with a belly.
2. **A-pose (Kontext).** `scripts/character/kontext.py --image <tN>.png --prompt-file <set>-tN-pose.txt --out <set>-source-tNa.png --seed 190926` (~30 s). "Change his pose only: … A-pose with both arms held straight and lifted out to the sides at 40 degrees from his body, clear space between the arms and the torso, open relaxed hands … Keep the same man, the same <every piece>, same colours and materials. Plain light grey background." FLUX alone will not give arms off the body; TRELLIS fuses arms that touch the torso.
3. **Reconstruction (TRELLIS.2).** `scripts/character/trellis2.py --image <set>-source-tNa.png --name <set> --resolution 1536` → `src/assets/source/creatures/<set>.glb` (~105 s at 1536). **Use 1536**: at 1024 the face and crest were a smeared mask and a blob; 1536 carries the cuirass bands, studs and a brushier crest. faces 100000 (the Space's minimum), texture 2048.
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
