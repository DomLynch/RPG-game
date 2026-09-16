# Brief — Frankendom hero polish pass (hand-off to the next implementer)

## Where things are
- Repo `DomLynch/RPG-game`, trunk branch `codex/01a09a76/task-1`, character lane branch `char/hero-v1`, worktree
  `~/Developer/frankendom-char`. Live frankendom.com, GitHub trunk and the worktree are all at `d7846d8` (verified: release.json
  revision and served `warrior.glb` hash equal the local build). Tree is clean; `artifacts/` is git-ignored except force-added
  review files.
- The shipped fighter is the Blender Studio realistic male (CC0) with a KeenTools photogrammetry head made from the owner's five
  synthetic portraits, level-1 kit (exomis tunic, baldric, belt, kilt strips, wrist wraps, sandals), longsword. 59.5k skinned
  triangles per fighter (hard test cap 60,000), GLB 5.8 MB / 3.25 MB gzip, dist budget cap 5 MB gzip.
- Read first: `src/assets/README.md` (every pass documented, provenance/licences), `artifacts/character/README.md` (review
  harness, labels), `artifacts/character/humanoid-v23/` (current look: `face.png`, `details.png`, `inspection-turntable.png`).

## Pipeline (one command each; all reproducible from committed sources)
1. `HEAD_PHOTO=1 HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic` (~8–10 min, Blender 5.2 headless).
   Writes `src/assets/source/parts/*_realistic.glb`, `src/assets/source/materials/*_r.jpg` (+`@2k`), `manifest_realistic.json`.
   Head logic is in `scripts/character/head.py` (`keentools_head`, `crown_fill`, `neck_blend`, `bake_attribute`, `SKIN_TONE`);
   body/kit logic in `scripts/character/parts.py` (`realistic_body`, `align_arms`, `extract`, `ring_strip`, `level1_kit`).
2. `node scripts/build-warrior.mjs` → `src/assets/warrior.glb` (default is now the realistic build; `WARRIOR_BODY=classic` = old
   CC0 body). Materials/maps are declared in `build-warrior.mjs` (`Photo`, `PhotoEyes`, `PhotoTeeth`, `Skin`, `Face`, …).
3. `node scripts/bake-blades.mjs` (should produce no diff unless the sword/rig moved).
4. Review: `node scripts/character-preview.mjs --label <name>` → `artifacts/character/<name>/` (turntable, 12 close-ups,
   clips sheet, phone-camera stills). Studio lighting is frozen — never tune it to flatter the asset. Crop and zoom the
   captures yourself (PIL in `~/.venvs/face/bin/python`) and look at them before claiming anything; the owner checks.
5. Gate: `npm run quality` (lint, 82 tests incl. triangle cap / pose bounds / blade-path parity, build, audit, budget, Playwright).
6. Ship: commit on `char/hero-v1` → push → `gh pr create --base codex/01a09a76/task-1` → merge → `git merge --ff-only` →
   `bash scripts/deploy.sh` (refuses a dirty tree; needs `.env.production.local` — copy from `~/Desktop/Business/frankendom/`,
   it is git-ignored) → verify `curl https://frankendom.com/release.json` and the served GLB hash against the local build.
   Save a review folder `artifacts/character/humanoid-v24` (next number) with `face.png`, `details.png`, turntable, and
   force-add the key images.

## Constraints (do not break)
- Rig: 65 bones, 21 clips, `SwordDrawn`/`SwordSheathed` under `hand_r`, blade paths byte-identical. Do not edit runtime `src/*.ts`
  (combat lane owns it); do not touch the combat lead's checkout `~/Desktop/Business/frankendom` (it has their WIP).
- Triangle cap 60,000 skinned per fighter — you are at 59.5k. Any added geometry needs a matching cut (candidates: KT head
  decimate ratio in `keentools_head`, body `Body` 21k tris).
- Everything derives from CC0 sources + the owner's synthetic portraits; document any new source/licence in `src/assets/README.md`.
- Never commit `.env*`, the KeenTools key, or the Hugging Face token. The Codex stop-hook audit is out of quota until 19 Sep —
  owner has waived it; self-review instead.

## The work, in priority order (each is small; verify each with a capture before moving on)
1. **Eyes at 3/4 and at the arena light.** Irises read flat/dark. In `build-warrior.mjs` the `PhotoEyes` material is
   MeshPhysical roughness .2, clearcoat .6. Add a brighter sclera and a small specular catch: raise `PhotoEyes` clearcoat to ~.9,
   clearcoatRoughness ~.08, roughness ~.15; and in `keentools_head` brighten the `kt_eye_color` texture's sclera (texels with
   low saturation → lift luminance ~15%) while leaving the iris. Judge with the `eyes` cell of `details.png` and the phone still.
2. **Body skin colour variation.** The face is photographic, the body is one flat tone (`body_colour` in `head.py`, base
   `SKIN_TONE` sampled from the scan's neck). Add: (a) a sun-tan gradient — forearms/hands, shins, shoulders, nape slightly
   darker/warmer than torso/inner arms (use the baked position map `pos_body` and the AO); (b) sub-dermal zones — knees, elbows,
   knuckles slightly redder; (c) keep the median tone equal to `SKIN_TONE` so the neck seam stays matched (there is a median
   re-normalisation at the end of `body_colour` — apply the variation before it). Check the jaw/neck seam in `head-audit`
   views afterwards (`neck front`, `neck side`); it must stay invisible.
3. **Thumb tip.** After `align_arms` the rig's thumb chain overshoots the mesh thumb by ~4.5 cm (`thumb_03_r` tail vs nearest
   vertex). Options: lengthen the mesh thumb along its axis by the shortfall inside `align_arms` step (3) (scale thumb verts
   beyond the base joint by `target_len / mesh_len`), or accept and skip. Probe: `/tmp/probe_hand4.py`-style script — import
   `src/assets/source/parts/body_realistic.glb` in Blender and print nearest-vertex distance for `index_03_r`/`thumb_03_r` tails.
4. **Wrist wraps texture.** They are seven `ring_strip` turns in flat dark `Leather`. Give them a strap read: either a
   tiled leather-strip map with a lighter worn edge (procedural, 256², in `parts.py` next to `bronze_maps`) assigned as a new
   material `Wrap`, or vary the lift/tone per turn. Keep them small at the phone camera; no new triangles.
5. **Hunyuan3D textured trial (props/body only).** Script exists: `scripts/character/hunyuan.py`. The free ZeroGPU tier
   cannot run the textured endpoint (135 s per job vs ~127 s quota). Needs Hugging Face PRO or Replicate/fal with a key —
   owner decision; do not sign up or pay. If enabled: run it on the sword/tunic reference and add to
   `artifacts/character/humanoid-v19/AB-RESULTS.md`.

## Acceptance
- Owner's bar: "triple-A mobile", 9/10+. Judge every change in `details.png` close-ups AND the 390×844 phone still.
- Gate green (82/82), triangle count < 60k, budget < 5 MB gzip, blade paths unchanged, seam invisible in `neck front`/`neck side`.
- Ship end to end (PR → merge → deploy → live hash check) and report revisions for MacBook / GitHub trunk / live, the review
  folder, and an honest list of what is still short.

## Open defects after v27 (tracked here; owner-visible)
- **Nape collar band — FIXED in v29 (issue #22).** Root cause was not occlusion: the portraits' grey backdrop leaked through the KeenTools projection at the back-centre (grazing views from the ±90° cameras) and sat exactly on the collar band. Grazing views at the nape are now treated as un-photographed like the crown. Original note: a pale strip between the nape hairline and the neck in `humanoid-v27/chin-feet-audit.png` ("nape" and
  "neck side" cells), most visible under the studio rim light, faint at the phone camera. Cause: the collar band is painted flat
  `SKIN_TONE` with no occlusion, while the neck below carries baked occlusion. Tried and reverted (2026-09-15): a Cycles AO bake
  into the band (blotchy at 16 samples, dark under the jaw) and a 35% blend toward the local blurred tone (went grey). Next lever:
  bake AO at 64+ samples and apply it only at the back (`hair_zone`-gated), or paint the band from the body tile's neck texels.
- **Under-chin fill streaks — FIXED in v35.** The streaks were the normal-map bake failing where `chin_strong`'s facing test had moved one mesh and not the other; the stretched chin texture is now re-covered by `stretch_refill` (quilted, squeezed stubble). Original note: faint radial streaks in the "under chin" cell where no camera saw; only visible from below.
- **Jaw/chin in profile — OPEN, the real blocker for 9/10.** The KeenTools scan has no jaw: chin tip 1.4 mm ahead of the lip
  crease, jaw a flat plane to the throat. v28 (boss under the lip) read as a pout; v29/v30 (base-outline borrow, jaw extension +
  lip profile) tore the mouth / still read wrong in profile; v31 ships the scan's own jaw untouched. Next: (a) two extra portraits
  from ~45° below (chin up) → new KeenTools job (`scripts/create-head.mjs`) → same pipeline; (b) if (a) does not take, stitch the
  base body's jaw on below the lip crease and project the scan's texture onto it. Do not push vertices again.
