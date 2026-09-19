# Character production pilots

## Owner review and new direction — 2026-09-19

The owner **rejected the procedural pilots below as amateur**. Passing structural
checks did not make them acceptable art. Do not use them as approved masters.

The owner approved the new seven-view [Minotaur](character-references/minotaur-v1.png)
and [Wraith](character-references/wraith-v1.png) concept sheets. The
Minotaur needs a credible heavy bovine skull continuous with its neck, trapezius
and muscular body. The Wraith needs a skeletal face and claws, broken crown and
airy semi-transparent wisps; its lower body dissolves. This supersedes the earlier
solid-bodied Wraith interpretation. Approved sheets are concepts, not game renders.

### MPFB test

Installed and enabled MPFB **2.0.17** in Blender **5.2.1 LTS**, from the official
[tagged source](https://github.com/makehumancommunity/mpfb2/tree/v2.0.17), packaged
as a Blender extension. The extension-platform sync failed because Blender online
access was disabled; the pinned source installation succeeded without changing
that preference. Local experiment: `artifacts/character/mpfb-test/`.

The test created editable human macro/target sources, applied anatomical and
animal-head targets, added MPFB's game-engine rig, evaluated a pose, and exported
static GLBs. Minotaur: 29,436 triangles. Wraith: 27,802 triangles with BLEND alpha
and a separate smoke texture. Both loaded in the local Three.js study viewer.
These are **MPFB rig tests, not the existing Frankendom combat rig or clips**.

Visual audit rejected both as final art: Minotaur retains a tame cow face and
insufficiently developed surfaces; Wraith's core still reads as a human mannequin.
The first triangle-tuft fur attempt was also rejected and removed from the second
test. MPFB is a useful anatomical foundation, not an automatic creature-finishing
tool. Experiment scripts remain beside their outputs, outside production tooling.

### Approved image references and reconstruction trial

Built-in image generation produced the seven-view sheets using the owner's
attached images as visual references. A subsequent front-view reconstruction
source was made for each creature. The Wraith source deliberately omits smoke so
the opaque core and transparent effects can be authored separately.
The exact sheet prompts and audit caveat are in [PROMPTS.md](character-references/PROMPTS.md).

The signed-in free official [Microsoft TRELLIS.2 demo](https://huggingface.co/spaces/microsoft/TRELLIS.2)
subsequently exported **both** approved reconstructions successfully on 2026-09-19.
Seed 190926, resolution 1024, export decimation 100000, texture 2048. Original
GLBs are committed in `src/assets/source/creatures/`; no paid GPU job was needed.

## Reconstructed in-game playtest — owner authorised 2026-09-19

This supersedes the old art-only boundary for the reconstructed models. It does
not approve the rejected procedural/MPFB pilots below. Minotaur and Wraith are
additional roster entries after the five existing encounters, sharing Pitborn's
cleaver and Nightborn's estoc combat respectively. They use ordinary deaths;
paired executions remain disabled until authored for their anatomy.

Build with `node scripts/build-creatures.mjs`; verify with
`node scripts/creature-check.mjs`. Blender fits an intact A-pose surface to the
shared joints, transfers/smooths four skin influences, and reduces each body to
45,000 triangles. The assembler supplies corrected inverse binds and preserves
original weapon geometry, clip channels and source WebP textures. Source/base/
generator hashes reject stale builds. Runtime Wraith presentation adds fading
lower wisps and a 28-point ash cloud, with no additional asset download.

Actual in-game images and checks are saved under `artifacts/character/creatures/`.
Owner phone playtesting and final creature-specific animation/finisher artistry
remain open; these are testable reconstructions, not a finished nine-character set.

### Source and licence records

- MPFB source tag archive SHA-256:
  `d08e726c798fdc4eefb02b06b6c4efe37d40b5439777e53cf96dce0e5073297d`.
  MPFB code is GPL-3.0-or-later; its bundled asset data is CC0-1.0.
- The optional `jaldmic_vaca_cow_head` morph is by **JALdMIC**, labelled **CC-BY**
  in the official [animal03 pack](https://static.makehumancommunity.org/assets/assetpacks/animal03.html).
  Original source: `http://www.makehumancommunity.org/node/3544`.
  Used in the rejected Minotaur test with adjusted weight and further geometry
  edits. The pack does not specify a CC-BY version; no version is invented here.
  Pack archive SHA-256:
  `6eff3aaa16699b9e924c50364b33b346dd5558b1838f82aed021d561b96ffb86`.
- Source receipts, downloaded licences, recipe and installation helper are retained
  in `artifacts/character/mpfb-test/`. No paid service was used. MPFB assets remain confined to the rejected experiment.

## Previous procedural pilots — rejected, retained for comparison

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
