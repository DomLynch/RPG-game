# Brief — Frankendom hero body pass (from v36)

Owner's call (2026-09-16): the head is accepted ("not perfect, but let's move forward"); the neck blend shipped in v36.
This is the body plan the owner asked for. Each item is one shippable pass with its own review folder, in this order.
Judge every pass in `details.png` close-ups, `inspection-turntable.png` and the 390×844 phone still; the owner checks.

## Where the body is (v36, honest read of `humanoid-v36/details.png`, `inspection-turntable.png`)
- Skin: one painted tone (Blender Studio realistic male, CC0), pale and pink beside the photographic head under the same
  light; no pores or skin folds that read, no hair, no veins; the tan/blood zones are too faint to notice. Reads as CG.
- Build: lean. Narrow shoulders and thin arms under a head that is now 1.1× the base head's height — under-built for a
  "triple-A" hero.
- Kit: exomis is a flat beige shell (weak folds, clean cut edges), pteruges are saturated red slabs, baldric is flat
  leather with studs. Wrist wraps and the sandal sole are fine at the phone camera.
- Hands/feet: grip reads, fingers fine, toes fine. Nails and knuckle creases absent — only visible in close-ups.
- Budget: 4.10 MB gzip of 5 MB after v36 (the varied neck texture cost 0.2 MB). Body detail maps stay 1K.

## The passes

### B1 — skin tone and skin detail (first; most visible) — SHIPPED v37 (2026-09-16)
Goal: torso and limbs read as the same man as the head under the studio and arena light.
- Tone: sample `SKIN_TONE` from the head texture's lit cheek/forehead texels (high `coverage`, not the scan's shadowed
  neck ring, which is what `keentools_skin_tone` reads today and why the body is paler). Keep `RING_TONE` for the collar.
- Sun: stronger and wider — forearms/hands, shins, nape, shoulder tops, upper chest V; inner arms and torso stay lighter.
- Detail: pore/skin-fold normal at 1.6 is subtle — add a second detail octave (knuckle and elbow creases, knee folds)
  into `skin_normal`; roughness variation (shiny shins/forearms, matte torso); faint veins on forearms and hands
  (`pos_body`-keyed strokes, blue-grey, 0.06 strength); sparse body hair on chest, forearms and shins as the chin's
  quilted grain (`stretch_refill`-style patches from the head's own stubble, squeezed to hair scale).
- Files: `head.py` (`keentools_skin_tone`, `skin_variation`, `body_colour`, `build`), maps `skin_color`, `skin_normal`,
  `skin_orm`. No geometry. Check the collar (`neck-sheet.png` views) still blends after the tone change.
- Acceptance: face and forearm side by side in `details.png` read as one skin; no seam in `neck front`/`neck side`.

### B2 — athletic build (second) — SKIPPED: the owner likes the build (2026-09-16)
Goal: a fighter's frame under the heroic head, rig untouched.
- Region scales keyed on the rig's joints (as `skin_variation` keys on them), applied to `hbm` and `HIGH` before any
  bake, before `align_arms`/`align_legs`: shoulders/traps +8% width, deltoids and upper arms +12% girth, forearms
  +15%, chest +8% depth, thighs and calves +10% girth, waist unchanged. Smooth falloff at the joints so the elbows,
  wrists, knees and ankles stay where the bones are.
- Re-fit: `align_arms`, `align_legs` and the kit cut curves run after (they key on the mesh), thumb/hand frame check
  (`probe_hand4`-style), sandal and wrap fit.
- Files: `parts.py` (`realistic_body`, a new `build_shape(mesh_obj)`), tests: triangle cap unchanged, pose bounds
  (`tests/characters.test.ts` stride depth 1.65 may need a look if the legs thicken).
- Acceptance: turntable 0/90/180° reads as an athlete; no kit clipping in `sequence.png`; blade paths byte-identical.

### B3 — kit materials (third)
- Exomis: linen weave (procedural 512, warp/weft + slub), grime at the hem and armpit, a hem with thickness (a
  `ring_strip` band) and a frayed alpha edge; folds normal re-baked after B2.
- Pteruges: leather grain, dye variation per strip, worn edges, the red desaturated 20% (the runtime recolours the
  opponent's — keep the `Heraldry` hook).
- Baldric and belt: leather grain and edge wear; studs stay.
- Files: `parts.py` (`level1_kit`, `bronze_maps`-style map builders), `build-warrior.mjs` materials. Budget: each new
  map at 512 or 1K, measured with `check-budget`.

### B4 — hands and feet polish (last)
- Nails (a lighter, glossier oval per fingertip in `skin_color` + roughness), knuckle creases in the normal, toe
  separation shading. Close-up only; skip if the budget is tight.

### Not in scope / owner decisions
- Hunyuan3D textured trial for kit references needs a paid host (owner decision, not signed up).
- Body hair density and the tan level are taste calls — B1 ships a conservative version and the owner tunes.

## Pipeline (unchanged)
`HEAD_PHOTO=1 HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic` → `node scripts/build-warrior.mjs`
→ `node scripts/bake-blades.mjs` → `node scripts/character-preview.mjs --label humanoid-v3N` → `npm run quality` →
commit on `char/hero-v1` → PR into `codex/01a09a76/task-1` → merge → `git merge --ff-only` → `bash scripts/deploy.sh`
→ `release.json` revision and served GLB hash == local. Constraints as in `BRIEF-hero-polish-v24.md`.
