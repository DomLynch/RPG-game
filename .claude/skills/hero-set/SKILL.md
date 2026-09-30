---
name: hero-set
description: Generate one hero armour set or kit piece and fit it on the hero rig with the hero's own head. FLUX design, Kontext A-pose, TRELLIS.2 at MAX settings on Hugging Face, Blender fit, stills for Dom. Hero Look and Armour lanes. Use when asked to make, regenerate or re-issue a set, piece or shield.
---

# Hero set recipe (Hero Look owns the recipe, Armour builds sets with it)

The hero's head and face are fixed. They are Dom's own authored asset and never an input or an output of this recipe. Only armour, kit and weapons are generated. Any "make X look better" on a character means new geometry through this recipe, never a shader or light pass (measured: light + full-size maps moved the look 5 to 10 percent at most).

Tooling lives on branch `herolook/sand-legionary` (6769aed5+) until its PR lands: `herolook_bake.py`, `glb_webp_to_png.py`, `herolook-sheet.mjs`, `herolook_probe.py` and the OWN_HEAD/HELM_FIT switches. None of them are on trunk yet.

Before ANY Blender, browser or Pixelmator step:

```bash
pgrep -f "^bash scripts/deploy.sh" && echo "DEPLOY IN FLIGHT: wait" ; uptime
```

Wait for a free box (no deploy.sh, load < 30) AND Lead's posted slot. One heavy process at a time. Never disable the deploy guard.

## 1. Design image (FLUX.1-dev, text to image)

```bash
scripts/character/t2i.py --prompt-file docs/character-references/<set>-t2i.txt --out docs/character-references/<set>-source-tN.png --seed <n> --size 832x1216
```

Prompt shape: full-body, single character, neutral background, the set's reference sheet in words (silhouette first, material second, colour third). Never start from the hero's own portrait: Kontext on his face keeps the face and loses the look. The face comes back at the fit.

## 2. A-pose (Kontext)

```bash
scripts/character/kontext.py --image <set>-source-tN.png --prompt-file <set>-tN-pose.txt --out <set>-source-tNa.png --seed 190926
```

"Change his pose only: A-pose, both arms straight, lifted out to the sides, everything else identical."

## 3. Reconstruction (TRELLIS.2 on Hugging Face, MAX only)

Dom's standing rule (2026-09-26): every run at max.

```bash
scripts/character/trellis2.py --image <set>-source-tNa.png --name <set> --resolution 1536 --steps 50 --faces 500000 --texture 4096 [--also-faces 150000 100000]
```

Runs on Hugging Face ZeroGPU with the local token (`~/.cache/huggingface/token`). Never a box bake while a deploy is in flight. If the quota is exhausted, report the reset time; paid credits are Dom's decision, never buy or work around. Hunyuan3D is not used (40k-tri cap, lost the bake-off).

## 4. Reduction bake (normal transfer, not decimation)

Plain decimation of the 495k mesh shatters; the cause is inconsistent TRELLIS winding. Transfer the max-mesh normals onto the low mesh. Status: the normal-transfer bake (6769aed5) has NOT been run yet; its first result is the proof. If it still shards: voxel/quad remesh then decimate, or Decimate planar/unsubdiv, then bake.

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 -P scripts/character/herolook_bake.py -- src/assets/source/creatures/<set>-tmax.glb src/assets/source/creatures/<set>-bake.glb 80000 4096
~/.venvs/face/bin/python scripts/character/glb_webp_to_png.py src/assets/source/creatures/<set>-bake.glb public/herolook/raw-<set>.glb   # Chromium cannot decode the 4096 WebP map
```

## 5. Height, then fit on the hero rig (Blender 5.2.1)

Probe the width profile (`scripts/character/herolook_probe.py`) and set the family height so the helm crown lands just over the hero's skull (legionary: 1.90 m sole to crest tip over the hero's 1.44 m shoulder joint; arm angle 62 for a 40 degree A-pose source).

Add the family row in `scripts/character/creatures.py` (base `warrior`), the family in the three arm/finger tuples, and `creature_pack.py`'s base map. Then:

```bash
cp src/assets/source/creatures/<set>-bake.glb src/assets/source/creatures/<set>.glb
OWN_HEAD=1 HELM_FIT=width CREATURE_TRIS=80000 CREATURE_OUT=public/herolook/<set>.glb node scripts/build-creatures.mjs <set>
```

- `HELM_FIT=width` scales the helm's width and depth only; the default `scale` also stretches it ×1.25 tall, which reads as a crown (Dom). Justify any widening with a clipping still. `CREATURE_TRIS` defaults to 45000; hero sets are 80000.

- `OWN_HEAD=1` is the default and stays on: `creature_pack.py` KEEP_SLOTS keeps the hero's Face and Eyes; `creatures.py` HEAD FIT scales the generated helm about the chin line to the hero's skull plus 1.2 cm a side and cuts the generated face inside the helm opening only.
- Fingers are NOT on `keep_fingers`: generated fingers pinned rigid stay open; under the donor curl they become claws.
- `CREATURE_OUT` keeps the file out of `src/assets` (the bundle globs `./assets/*.glb`). Output: skinned on the hero's skeleton, all 25 clips, sword kept.

## 6. Shield or held prop (optional)

`t2i.py` on a product-shot prompt, `trellis2.py --name <set>-scutum --resolution 1536 --steps 50 --faces 500000 --texture 4096` (Dom's MAX rule covers every TRELLIS run; herolook_scutum.py reduces it), then `blender -b -P scripts/character/herolook_scutum.py` (6k tris, 1.02 m, upright in the Idle pose at the left forearm), then:

```bash
python3 scripts/character/herolook_attach.py public/herolook/<set>.glb artifacts/herolook/scutum-placed.glb lowerarm_l --name HeroScutum
```

Place in Idle, never T-pose.

## 7. Stills for Dom (the deliverable)

```bash
node scripts/herolook-stills.mjs --pilot public/herolook/<set>.glb --label <set>          # Profile pair vs today's kit; repo-relative path, no leading slash
node scripts/herolook-game-stills.mjs --label <set> [--start 9 --every 0.4]                # one real winning fight at 375x812 with ?hero=/herolook/<set>.glb
```

Send Dom the kill screen and the fight-camera frame side by side with today's kit, plus tris / map sizes / MB compressed and the phone frame time. Judged on "reads as the guide" and on flat materials. Then the six-angle sheet if asked: `node scripts/herolook-sheet.mjs --label <set> E0=public/herolook/raw-<set>.glb`.

## Known failure modes and the step that owns them

| Symptom | Owner | Fix |
|---|---|---|
| Face reads as a pale mask | generation | 1536 resolution, then the own-head fit removes it anyway |
| Crest is a lumpy blob | generation | TRELLIS cannot do hair-like brushes; build a crest card |
| Hands are claws | fit | fingers pinned rigid (step 5) |
| Shield off the forearm | fit | place in Idle, not T |
| Mesh shatters after reduction | bake | normal transfer (step 4, unproven until its first sheet); never plain decimation |
| Set reads as "a man in a leather cap" up close | design | re-dressing the old kit loses; regenerate from a design image |

`artifacts/` is gitignored: tooling goes in `scripts/`. Set direction and references: `docs/briefs/armour-sets-direction.md` (sets are factions; references are guides, not specs).

## Rank-ladder fits: six lessons from GPT's Goblin, Veteran and Pitborn ladders (2026-09-27)

1. **Prove one rank before batching.** Fit one rung fully and check it front, back, fight distance, Heavy, Guard and Kick before repeating the method on the other nine. Pitborn's collar fault would have been caught at rung one.
2. **Shared edges move together.** Vertices along armour boundaries need matching transforms and bone weights; adjusting the helmet alone pulled the collar apart. Fit continuously across the boundary.
3. **Lock identity before generation.** Write down face visibility, helmet height, exposed skin, weapon-side clearance and the elite silhouettes first (the Pitborn list is the model). Dom's latest word overrides any conflicting feedback.
4. **Use the proven baseline.** 1024 reconstruction, 100k target triangles, 2048 textures. Keep the donor files; repair a fit locally before paying for another generation.
5. **Use Metal for Mac previews.** Hardware rendering beat the software path; load each model once, then switch cameras. See `shared-mac`.
6. **Preserve originals, verify the deliverable.** L1 stays untouched; check rig, clips and shared-edge weights on the EXPORTED GLB and render that file, not the Blender scene. Say plainly when a reconstructed surface replaces visible original skin.
