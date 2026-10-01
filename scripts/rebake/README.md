# scripts/rebake

Tools that write shipped look assets (`public/looks/*.glb`). Moved into the repo on 2026-09-30 (Lead ruling) from the Armour lane's
gitignored `artifacts/looks/nightborn/tools/`.

- `rebake-nb.py` — rebakes several parts of a GPT look into ONE atlas / ONE material (`part=<node>[:<prim>]=<tris> name=L<n>_Rebaked`).
  This copy replaces both lane copies: `5e70d394` (used for the rank looks packed 09-28/29) and `3e00aada` (= 5e70d394 plus the
  position + skinning weld of 09-30). It is `3e00aada` plus the colour fix below.
- `srgbfold.py` — folds a material's `baseColorFactor` into its texels in linear light.
- `glbpose.py` — GLB reader + pose helpers the rebake imports.
- `test_srgbfold.py` — `python3 scripts/rebake/test_srgbfold.py scripts/rebake/rebake-nb.py` (exit 1 on failure).

## The colour bug fixed here

`baseColorFactor` is linear; texture texels are sRGB. `maps_of` used to multiply the sRGB bytes by the linear factor, so every
factor-only or factor-tinted part came out too dark in rebaked files (factor 0.16 → byte 41 instead of 111). It now calls
`fold_base_factor`: `sRGB(linear(texel) × factor)`. Factor 1 stays byte-exact.

Looks already live that were baked with the old line are listed in the PR that added this folder; they are re-cut in their own PRs.

## Running

Python 3 with `numpy scipy pillow xatlas pyfqmr`. Not part of CI (the runners have no Python step); run the test by hand after any
change to `maps_of` or `srgbfold.py`. Heavy rebakes run on the HF Space or the VPS, not on the shared Mac.
