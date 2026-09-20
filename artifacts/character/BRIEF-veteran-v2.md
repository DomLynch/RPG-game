# Brief — Veteran v2 through TRELLIS.2 (character lane, 2026-09-20)

Updated the same day: trunk (bea157c) already carries `scripts/character/trellis2.py`, `trellis_head.py` and the Executioner
rebuilt as a humanoid through `creatures.py`; the Veteran follows that path. Source image by FLUX Kontext, not GPT.

Why: on one turntable the TRELLIS.2 creatures (Minotaur, Wraith) read as one authored surface; the Veteran and hero read
as a mannequin with kit bolted on (`artifacts/character/src-*/inspection-turntable.png`, same studio). The owner wants the
Veteran to the creatures' standard. Beta freeze (owner FYI 2026-09-20) allows polishing existing characters; no new ones.

## Plan
1. `scripts/character/kontext.py`: FLUX.1 Kontext [dev] edit of `artifacts/source/face/veteran/front.png` into the
   full-body A-pose source `docs/character-references/veteran-source-v1.png` (prompt + seed in the sidecar json); a few
   seeds, the owner picks. Needs `HF_TOKEN` in `.env.hf.local` (git-ignored; anonymous ZeroGPU quota is zero).
2. `scripts/character/trellis2.py --image docs/character-references/veteran-source-v1.png --name veteran` (seed 190926,
   1024, 100k faces, 2048 texture — the creatures' settings) → `src/assets/source/creatures/veteran.glb` + sidecar.
3. Fit: a `humanoid` family in `scripts/character/creatures.py` with the current `veteran.glb` as the weight donor (its
   rig, binds and clips are the target), donor arms posed to the A-pose angle measured on the reconstruction, height
   1.80 × build. Drop the greave items (in the mesh now); keep the parametric helm item (it fits his skull) and the
   trident on `hand_r`. 45k triangles, per-fight budget 12 MB.
4. Head decision, judged in `faces.png` at the phone and close-up cameras: TRELLIS spreads 2048² over the whole body,
   so the face gets ~200 px. If it reads soft or drifts from his likeness, graft the KeenTools head at the collar with the
   existing `neck_blend` / `neck_tiles` machinery (the Studio body was cut the same way). Expect to graft.
5. Same gate as every fighter: pose bounds, clip parity, grip on the trident, blade-path bake unchanged, both browser
   gates; review folder `artifacts/character/veteran-v2/`. Lead merges.

## Not in scope
New opponents (Werewolf, Skeleton, Troll…) — parked for Phase 2 per the freeze. The hero: the owner called him done.

## Status 2026-09-20 (evening)
Steps 1–3 done on `char/veteran-v2-fit`: source, reconstruction, fit (helm retained, trident on hand_r). Step 4 decided
from the first render review: the reconstruction's head reads soft (no eyes, wire hair through the helm), so the v1
KeenTools head and neck are grafted back (cut at 1.585 m, 7 cm tuck band, `creatures.py` + `creature_pack.py`
`KEEP_SLOTS`), and the body skin is colour-matched to his scanned neck (`match_skin`). Step 5's renders and the owner
sign-off are the remaining gate; CPU gates re-run after each generator change (the Dwarf and Executioner re-stamp).
