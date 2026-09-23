# The Knight — deliverable 1, the silhouette test (2026-09-22)

Brief 17's first deliverable, run before any model work, on the owner-approved reference
(`knight-source-v1.png`, PR #494). Two passes, because armour is takeable and only one of them
is honest: **in loadout** beside the other seven fighters, and **bare**.

Harness: [`scripts/character/silhouette.py`](../../scripts/character/silhouette.py). Receipts:
`knight-silhouette-loadout-v1.png`, `knight-silhouette-bare-v1.png`,
`knight-silhouette-measures.json`, and the bare source `knight-bare-v1.png`.

## What it found

**1. The bare Knight does not read as anybody.** Stripped, his shoulder-over-height falls from
**0.367 to 0.246** — a third of his shoulder breadth is armour — and his widest point falls from
0.41 to 0.257. More important than the numbers: nothing in the bare outline is his. The great helm,
the squared pauldrons, the skirt and the greaves are the whole of his identity, and under the
six-takeable-pieces ruling (Helmet, Body, Arms, Gloves, Greaves, Boots) **every one of them comes
off**. The Executioner keeps his hood and hair when stripped; the Veteran keeps his mass. The Knight
keeps a thin man.

This is the risk Brief 17 named, now measured rather than asserted. It is a **build-spec**
consequence, not a gear one: the ruling says nothing on the body is rig dressing, so the feature
that survives stripping has to be the body itself. "Thinner than the Executioner", applied to the
bare body, leaves nothing to be thinner than. **Proposed to Lead and Strategy: the Knight's bare
build needs one non-takeable silhouette feature of its own** — the brief cannot leave the bare
figure generic and call the design settled.

**2. Shoulder breadth separates nothing, and the earlier numbers were backwards.** Measured off
correct mattes:

| figure | shoulder/height | widest/height | solidity |
|---|---|---|---|
| knight (bare) | 0.246 | 0.257 | 0.766 |
| knight | 0.367 | 0.410 | 0.714 |
| executioner | 0.374 | 0.595 | 0.637 |
| veteran | 0.360 | 0.521 | 0.682 |
| dwarf | 0.423 | 0.662 | 0.610 |
| skeleton | 0.327 | 0.653 | 0.341 |
| werewolf | 0.372 | 0.574 | 0.594 |
| wraith | 0.374 | 0.709 | 0.774 |
| minotaur | 0.653 | 0.653 | 0.600 |

Knight 0.367, Executioner 0.374, Veteran 0.360 — a spread of **0.014** across all three humans,
below what this instrument can resolve.

**`PROMPTS.md`'s figures (Executioner 0.36, Knight 0.39–0.40) are withdrawn.** They were measured
off threshold silhouettes that fused the arms into the torso. That fusion inflates a plate figure
(dark chainmail sleeves against dark plate merge) and barely touches a bare-armed one, so the
comparison was an artifact of the tool, and its direction was wrong: the Knight is marginally
**narrower** than the Executioner, not wider. The conclusion drawn from those numbers — that mass is
not the separator — survives, and is now better supported than it was.

**3. Where they do separate is arm carriage, not breadth.** The Knight's widest point is 0.41
against the Executioner's 0.595 and the Veteran's 0.521: his arms hang tight against plate while
theirs are carried away from the body. He reads narrow and columnar on the sheet. The soft-versus-
hard contrast the reference approval identified is visible in `knight-silhouette-loadout-v1.png` —
open gaps at the arms, flat plate edges, a straight skirt hem against the Executioner's unbroken
mass — but note that **solidity does not measure it**. Solidity measures pose spread and
raggedness, which is why the wraith (a cloak) scores highest of all. Hard-versus-soft stays a
judgment read off the sheet.

## Why the harness segments rather than thresholds

Three threshold approaches were built and all three failed on this reference, which is worth
recording so nobody rebuilds them:

- the backdrop is a **radial** vignette, so estimating it per row between the left and right borders
  sags in the middle and flags lit backdrop as figure;
- a grey closing wide enough to erase the figure over-reaches across that same gradient and flags
  the dark side of the backdrop as figure;
- **polished plate mirrors the backdrop**, so the breastplate sits at the backdrop's own luminance
  and no threshold separates them — the same failure the Pitborn lane hit on the Shieldmaiden's
  shield face.

Flooding the background in from the border (the Pitborn lane's fix for figures that come out hollow)
makes the plate case worse: the gap between an arm and the hip is an **enclosed** hole, so the flood
fills it and the Knight loses exactly the articulated outline the test exists to judge. A u2net
subject matte has none of these problems and keeps the floor shadow out as well.

## Remaining validation

- The bare pass is a **generated** figure, not a build: same route and seed as the reference
  (`FLUX.1-schnell`, seed 190926, 832x1216, 4 steps), posed to match the reference's stance so the
  silhouette measures build and not pose. It shows what is left when the six pieces come off; it
  does not specify what the bare body should be. That is the open question above.
- No other fighter has a bare reference of this artifact type, so the bare row is the Knight alone.
  The loadout row is the honest comparison until the others have one.
- AAA judgement is a **phone screenshot**, never a viewport render. Nothing here is that; these are
  reference silhouettes, and the model has not been started.
