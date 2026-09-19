# Character production pilots

Wraith and Minotaur are **unapproved anatomy studies**, not live roster additions.
The Wraith reuses Nightborn's rig and face UVs, with a bounded cheek sculpt and a
new open cowl. Minotaur reuses Pitborn's body and weapon with an original bovine
head, neck, ears and horns. Both retain the existing human feet and existing kit
for this silhouette/fit gate. Distinct finished faces, fitted creature equipment,
hoof/gait decisions and final surface art remain later approval gates.

## Rebuild and review

Requires the pinned Node dependencies and Blender (validated on 5.2.1 LTS).
No archive recovery, paid API, model download or extra runtime package is needed.

```sh
node scripts/character-pilots.mjs --build
node scripts/character-pilots.mjs --check
node scripts/character-preview.mjs --serve --enemy /artifacts/character/pilots/wraith.glb
```

Replace `wraith.glb` with `minotaur.glb` for the other pilot. The review server is
local only. Outputs live under `artifacts/character/pilots/`: animated GLBs,
editable `*-authored.blend` component scenes, four-angle heads/bodies, eight pose
samples, portrait/landscape captures and `integrity.json`. These are actual GLB
renders, not generated concept pictures. Editable base rigs remain the committed
Nightborn/Pitborn GLBs; the Blender scenes contain newly authored components.

`scripts/character/pilots.py` is the offline maker. It appends geometry to the
original binary payload, hides replaced art, and retains all original animation,
skin, image and weapon data. New components use the same inverse bind matrices
and normalized Head/neck/chest weights. Wraith's face keeps its UVs and skin
weights while replacing position/normal accessors. Added geometry is grouped by
material. The original binary stays intact; hidden old images/geometry have not
yet been pruned from pilot files. The source and generator hashes prevent stale
outputs from passing the integrity check.

`scripts/character-pilots.mjs` is the judge/capture entry point. It checks exact
source-payload, rig and animation preservation, finite attributes and normalized
weights, then loads each through the existing character review harness and fails
on browser errors. It reports visible triangle counts and added draw counts.
The captures use the existing fixed lighting and camera, including phone framing.
Those saved review lights are not proof of parity with the latest live arena.

## Ownership and acceptance

No changes to `ROSTER`, combat definitions, collision capsules, blade bakes,
finishers, AI or live assets. The old motions are fit probes, not approved creature
combat packages. Horn clearance, cowl/shoulder intersections and source-kit reuse
need artistic judgement in motion; sampled poses cannot prove every pose safe.

Next gates: owner anatomy review → refined anatomy and fitted kit → materials →
full movement/contact/finisher compatibility → physical phone performance → two
distinct individuals per approved master. Ordinary death must remain the fallback
until nonhuman executions are explicitly validated. Lead owns roster integration
and deployment after acceptance. Do not deploy these pilot models as finished art.

## Sources

New cowl/bovine geometry and colour variation are original project-authored work.
Inherited body, motion, reconstructed face and skin-detail provenance remains in
`src/assets/README.md` and its adjacent licence files. In particular, inheriting
the source head/body textures does not make the complete derivatives CC0. No new
third-party contribution is introduced by the pilot generator.
