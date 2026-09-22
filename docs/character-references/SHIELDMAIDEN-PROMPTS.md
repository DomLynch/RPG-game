# The Shieldmaiden — reference candidates (Brief 15, PR #471)

Generated in-lane 2026-09-22. **Concept references, not game renders, and not approved.** Dom picks one
**letter** — A, B or C — and that letter is the design this lane builds toward. Sheet:
`shieldmaiden-candidates-v1.png`.

## PICKED: A — HARD OUTLINE (Dom, 2026-09-22)

Dom's word on this sheet: **"i think A"**, then he pasted column A's own two panels back with
**"this one"** — the pick is confirmed against the images, not just the letter, so there is no ambiguity of
the kind that crossed the letter and the panel on the Nightborn's sheet. **A is the approved design
direction** and the one this lane
builds toward: fitted riveted mail hauberk to mid-thigh over a padded dark wool gambeson, squared and layered
iron shoulder plates giving a flat hard shoulder line, broad studded belt, plain iron vambraces, dark
trousers with straight leather leg wraps, hard low boots, two tight crown braids pinned flat. Straight,
squared, armoured edges all the way round the outline.

B and C are not built. They stay on the sheet as the record of what A was chosen against — that matters,
because the three are within 0.04 of each other on build and were separated on outline alone.

Approved as a **direction**, not as a render: A's own panels carry generator artifacts (the bare panel's
palms sit half-open rather than at the thighs) which are not part of what was picked.

## CORRECTION — the v1 numbers are withdrawn (2026-09-22, later)

**Every shoulder-width figure in the "measured reskin check" section below is withdrawn.** They were measured
off threshold-plus-flood-fill masks, and the conclusion drawn from them — "the Veteran sits inside the
candidates' spread" — **is false**. Corrected sheets: `shieldmaiden-silhouettes-v2.png` and
`shieldmaiden-stripped-v2.png`.

Two faults, both mine:

1. **The mask.** My per-row threshold with a border flood-fill cannot see polished plate or a painted shield
   face, which mirror the backdrop and land at its own luminance — no threshold separates a mirror from what
   it is mirroring. The Executioner lane also found my flood-fill *fuses arms into the torso* on a figure
   whose hands rest on the thighs, because the gap between arm and hip is enclosed too and should stay open.
   The fix is not a threshold: a **u2net subject matte** (`rembg`, `only_mask=True, post_process_mask=True`)
   handles the mirrored plate, keeps the arm gaps open, drops the floor shadow, and picks up a grounded
   weapon head. Harness: `scripts/character/silhouette.py` (Executioner lane, PR #502).
2. **The pose.** My bare panels came back with her arms held out from the body, so the shoulder measurement
   was reading **arm span**, while the Veteran and Executioner references hang their arms at the sides. The
   comparison was never valid. I re-rendered the three bare panels with the arms pinned — same design, same
   seed, measurement pass only — and re-measured everything off u2net mattes.

### Corrected numbers — shoulder width ÷ figure height, bare, arms at sides

| | shoulder/height | solidity |
|---|---|---|
| A — hard outline | **0.284** | 0.705 |
| B — soft outline | **0.319** | 0.822 |
| C — asymmetric | **0.276** | 0.703 |
| Veteran | 0.360 | 0.682 |
| Executioner | 0.374 | 0.637 |
| Knight (Executioner lane, #502) | 0.367 | — |

**What actually holds.** The three men cluster inside 0.014 — among *them*, mass separates nothing, which is
the Executioner lane's finding and it survives correction. Her three candidates spread 0.043, and the widest
(B) is widest because of a fur mantle rather than frame, so mass is not the axis between her candidates
either. **The design conclusion — choose on outline character, not build — stands. The evidence I first
published for it does not, and one claim in it was simply wrong.**

What is *new* and was invisible under the bad masks: she sits clearly below all three men, 0.28–0.32 against
0.36–0.37. That is a real separation and a useful one — she reads as a woman on breadth alone.

### The stripped test — direction A fails it

Prompted by the Executioner lane finding the Knight fails the same test. Loot v2 makes gear takeable, so the
honest question is not "did the bare panel come back bare" but "does she read as *herself* with every
lootable slot off". Rendered with mail, shoulder plates, belt, vambraces and boots all removed
(`shieldmaiden-stripped-v2.png`): **shoulder/height drops 0.284 → 0.240 and what remains is a generic thin
woman in a tunic.** The flat hard shoulder line that A was chosen *for* is the iron shoulder plates, and they
come off. Even the pinned crown braids read as loose hair once the armour stops framing the skull.

This does not overturn the pick — A is still Dom's chosen direction and still the right *silhouette* — but it
says the direction is not yet carried by anything that cannot be removed. Raised with Lead rather than solved
here: it wants either an unlootable identity element on the body itself (build, scars, the braids authored as
geometry) or an explicit decision that she reads as generic when stripped, as the Knight currently does.

## How they were made

`black-forest-labs/FLUX.1-schnell` through `gradio_client`, signed in with the owner's stored Hugging Face
token, `api_name="/infer"`, 832×1216, 4 steps, **seed 190926 held fixed across all six renders so the
variation between columns is design and not noise**.

**`scripts/character/kontext.py` cannot do this.** It is image→image (`--image` is `required=True`; its
docstring is "a fighter's approved portrait → the single full-body A-pose reconstruction source"), and there
is no text-to-image script in `scripts/character/`. Three lanes were briefed at it on 2026-09-22 before the
error was caught. Its `token()` helper is still the auth pattern to copy.

## Three prompt lessons, each paid for in a re-roll

- **Naming a thing to forbid it summons it.** "carries NO weapon and NO shield" put a shield in every bare
  panel; so did the noun *shieldmaiden* itself. The bare prompts now say only what is there — empty open
  hands, clear background beside both arms — and drop the word *shieldmaiden* for *Norse woman warrior*.
- **The kit has to lead.** With the weapon described at the tail, the axe rendered as a bare haft with no
  head at all. Moving the axe and shield to the first sentence fixed it.
- **"BEARDED AXE" grows a beard on her face.** It did, literally. The shape is now described without the
  word: a hook-bladed axe whose cutting edge sweeps down into a deep pointed spur below the haft.

## The measured reskin check

"The Nord reskinned" is the standing risk, so each candidate's silhouette is computed from its own pixels
(per-row background — the studio backdrop is a vignette, so a global threshold blows out whole panels) and
shoulder-width ÷ figure-height is measured off it, against existing fighters' own trunk references.

| | bare | in loadout |
|---|---|---|
| A — hard outline | 0.26 | 0.23 |
| B — soft outline | 0.28 | 0.30 |
| C — asymmetric | 0.24 | 0.26 |
| Veteran (`veteran-source-v1.png`) | 0.29 | — |
| Executioner (`executioner-source-v1.png`) | 0.36 | — |

The three candidates span 0.24–0.28 bare and the Veteran sits at 0.29, inside that spread: **mass does not
separate her from the existing men, and it will not separate the candidates from each other.** This matches
what the Executioner lane measured on the Knight (0.39–0.40 against the Executioner's 0.36). The separator
that does work is outline character — hard plate edges (A) against broken fur and falling cloth (B) against
a one-heavy-side asymmetry (C). Judge the columns on that, not on build.

Caveat on the bottom row: the loadout silhouettes hollow out inside the shield face, whose mid-grey reads as
backdrop. The **bare** silhouette row is the decisive one, which is also the test that matters — the shield
is lootable, so an outline that only works with the shield up fails the moment a player takes it.

## The prompts

### A — HARD OUTLINE

**bare.** Her hands are empty. A woman standing with both arms hanging straight down and angled slightly out from her hips, both hands open and empty with the fingers pointing down at the floor, nothing whatsoever in either hand and nothing slung across her back or shoulders -- clear grey background visible all around both arms and both hands. Full body, single figure, standing upright in a symmetrical relaxed A-pose facing the camera directly, arms straight and held about 40 degrees out from the sides, palms turned toward the thighs, fingers relaxed and slightly open, feet planted shoulder-width apart, whole figure from the crown of the head to the feet inside the frame with clear empty space above and below. She is a woman: a Norse woman warrior of a dark medieval fantasy arena, smooth clean female face and jaw, late twenties to thirties, tall and physically strong, weathered fair skin, pale blue-grey eyes, a hard level stare. Plain flat uniform medium-grey studio background, even soft frontal light, no cast shadow on the background, no vignette, no atmosphere, no props, no scenery, no text. Realistic hand-painted dark-fantasy concept rendering with credible worn PBR-like materials, leather that has creased, mail with weight, wool that hangs. Not glossy, not plastic, not a toy, not a smooth mannequin, no cleavage armour, no bikini mail, no fantasy pin-up, no cape flaring in wind, no glow, no magic effects. HARD OUTLINE. Fitted riveted mail hauberk to mid-thigh over a padded dark wool gambeson, squared and layered iron shoulder plates that give her a flat hard shoulder line, a broad studded leather belt, plain iron vambraces, dark trousers bound with straight leather leg wraps, hard low boots. Her hair is drawn into two tight crown braids pinned flat against the skull. Every edge of her outline is straight, squared and armoured. Both of her hands are completely empty and open, palms turned toward her thighs, all fingers visible, relaxed and slightly spread, with clear empty grey background visible on both sides of each hand and all the way down both arms. Her forearms, wrists, hands, back and shoulders are clear and unencumbered; her whole torso from collarbone to belt is uncovered and fully visible to the camera.

**loadout.** A large hook-bladed iron axe and a round wooden shield. The axe head is the sharpest, biggest shape in her lowered right hand: a wide flaring single-bitted iron blade the length of her forearm, mounted on the end of a short straight wooden haft, its long curved cutting edge sweeping down into a deep pointed spur that hangs well below the line of the haft with an open hook between spur and haft. The round flat wooden shield rides on her left forearm, held low beside her left hip and angled away so her torso stays visible, about as wide as her own shoulders, painted boards, iron rim, domed iron boss. Full body, single figure, standing upright in a symmetrical relaxed A-pose facing the camera directly, arms straight and held about 40 degrees out from the sides, palms turned toward the thighs, fingers relaxed and slightly open, feet planted shoulder-width apart, whole figure from the crown of the head to the feet inside the frame with clear empty space above and below. She is a woman: a Norse shieldmaiden of a dark medieval fantasy arena, smooth clean female face and jaw, late twenties to thirties, tall and physically strong, weathered fair skin, pale blue-grey eyes, a hard level stare. Plain flat uniform medium-grey studio background, even soft frontal light, no cast shadow on the background, no vignette, no atmosphere, no props, no scenery, no text. Realistic hand-painted dark-fantasy concept rendering with credible worn PBR-like materials, leather that has creased, mail with weight, wool that hangs. Not glossy, not plastic, not a toy, not a smooth mannequin, no cleavage armour, no bikini mail, no fantasy pin-up, no cape flaring in wind, no glow, no magic effects. HARD OUTLINE. Fitted riveted mail hauberk to mid-thigh over a padded dark wool gambeson, squared and layered iron shoulder plates that give her a flat hard shoulder line, a broad studded leather belt, plain iron vambraces, dark trousers bound with straight leather leg wraps, hard low boots. Her hair is drawn into two tight crown braids pinned flat against the skull. Every edge of her outline is straight, squared and armoured. On her left forearm she carries a round flat wooden Viking shield roughly as wide as her own shoulders, held low beside her left hip and angled slightly away so that her torso stays fully visible, plain painted boards, an iron rim and a domed iron boss at the centre. Her right hand grips a short straight wooden haft down at her side. Mounted on the top of that haft is a large single-bitted iron axe head, clearly visible against the grey background and about as long as her forearm: a wide flaring blade whose long curved cutting edge sweeps downward and ends in a deep pointed beard hanging well below the line of the haft, leaving an open hook between the beard and the wood. The steel head is the biggest and sharpest shape in her right hand.

### B — SOFT OUTLINE

**bare.** Her hands are empty. A woman standing with both arms hanging straight down and angled slightly out from her hips, both hands open and empty with the fingers pointing down at the floor, nothing whatsoever in either hand and nothing slung across her back or shoulders -- clear grey background visible all around both arms and both hands. Full body, single figure, standing upright in a symmetrical relaxed A-pose facing the camera directly, arms straight and held about 40 degrees out from the sides, palms turned toward the thighs, fingers relaxed and slightly open, feet planted shoulder-width apart, whole figure from the crown of the head to the feet inside the frame with clear empty space above and below. She is a woman: a Norse woman warrior of a dark medieval fantasy arena, smooth clean female face and jaw, late twenties to thirties, tall and physically strong, weathered fair skin, pale blue-grey eyes, a hard level stare. Plain flat uniform medium-grey studio background, even soft frontal light, no cast shadow on the background, no vignette, no atmosphere, no props, no scenery, no text. Realistic hand-painted dark-fantasy concept rendering with credible worn PBR-like materials, leather that has creased, mail with weight, wool that hangs. Not glossy, not plastic, not a toy, not a smooth mannequin, no cleavage armour, no bikini mail, no fantasy pin-up, no cape flaring in wind, no glow, no magic effects. SOFT OUTLINE. A heavy wolf-fur mantle over both shoulders that breaks her shoulder line into a deep ragged soft mass, a long undyed wool overdress belted at the waist and falling to the shins in loose folds, a short mail shirt showing only at the chest, soft leather shoes bound with crossed thongs. A single long thick braid falls forward over the fur to her waist. Her outline is broken, soft and irregular: fur, cloth and hair, no hard plate edges anywhere. Both of her hands are completely empty and open, palms turned toward her thighs, all fingers visible, relaxed and slightly spread, with clear empty grey background visible on both sides of each hand and all the way down both arms. Her forearms, wrists, hands, back and shoulders are clear and unencumbered; her whole torso from collarbone to belt is uncovered and fully visible to the camera.

**loadout.** A large hook-bladed iron axe and a round wooden shield. The axe head is the sharpest, biggest shape in her lowered right hand: a wide flaring single-bitted iron blade the length of her forearm, mounted on the end of a short straight wooden haft, its long curved cutting edge sweeping down into a deep pointed spur that hangs well below the line of the haft with an open hook between spur and haft. The round flat wooden shield rides on her left forearm, held low beside her left hip and angled away so her torso stays visible, about as wide as her own shoulders, painted boards, iron rim, domed iron boss. Full body, single figure, standing upright in a symmetrical relaxed A-pose facing the camera directly, arms straight and held about 40 degrees out from the sides, palms turned toward the thighs, fingers relaxed and slightly open, feet planted shoulder-width apart, whole figure from the crown of the head to the feet inside the frame with clear empty space above and below. She is a woman: a Norse shieldmaiden of a dark medieval fantasy arena, smooth clean female face and jaw, late twenties to thirties, tall and physically strong, weathered fair skin, pale blue-grey eyes, a hard level stare. Plain flat uniform medium-grey studio background, even soft frontal light, no cast shadow on the background, no vignette, no atmosphere, no props, no scenery, no text. Realistic hand-painted dark-fantasy concept rendering with credible worn PBR-like materials, leather that has creased, mail with weight, wool that hangs. Not glossy, not plastic, not a toy, not a smooth mannequin, no cleavage armour, no bikini mail, no fantasy pin-up, no cape flaring in wind, no glow, no magic effects. SOFT OUTLINE. A heavy wolf-fur mantle over both shoulders that breaks her shoulder line into a deep ragged soft mass, a long undyed wool overdress belted at the waist and falling to the shins in loose folds, a short mail shirt showing only at the chest, soft leather shoes bound with crossed thongs. A single long thick braid falls forward over the fur to her waist. Her outline is broken, soft and irregular: fur, cloth and hair, no hard plate edges anywhere. On her left forearm she carries a round flat wooden Viking shield roughly as wide as her own shoulders, held low beside her left hip and angled slightly away so that her torso stays fully visible, plain painted boards, an iron rim and a domed iron boss at the centre. Her right hand grips a short straight wooden haft down at her side. Mounted on the top of that haft is a large single-bitted iron axe head, clearly visible against the grey background and about as long as her forearm: a wide flaring blade whose long curved cutting edge sweeps downward and ends in a deep pointed beard hanging well below the line of the haft, leaving an open hook between the beard and the wood. The steel head is the biggest and sharpest shape in her right hand.

### C — ASYMMETRIC OUTLINE

**bare.** Her hands are empty. A woman standing with both arms hanging straight down and angled slightly out from her hips, both hands open and empty with the fingers pointing down at the floor, nothing whatsoever in either hand and nothing slung across her back or shoulders -- clear grey background visible all around both arms and both hands. Full body, single figure, standing upright in a symmetrical relaxed A-pose facing the camera directly, arms straight and held about 40 degrees out from the sides, palms turned toward the thighs, fingers relaxed and slightly open, feet planted shoulder-width apart, whole figure from the crown of the head to the feet inside the frame with clear empty space above and below. She is a woman: a Norse woman warrior of a dark medieval fantasy arena, smooth clean female face and jaw, late twenties to thirties, tall and physically strong, weathered fair skin, pale blue-grey eyes, a hard level stare. Plain flat uniform medium-grey studio background, even soft frontal light, no cast shadow on the background, no vignette, no atmosphere, no props, no scenery, no text. Realistic hand-painted dark-fantasy concept rendering with credible worn PBR-like materials, leather that has creased, mail with weight, wool that hangs. Not glossy, not plastic, not a toy, not a smooth mannequin, no cleavage armour, no bikini mail, no fantasy pin-up, no cape flaring in wind, no glow, no magic effects. ASYMMETRIC OUTLINE. Half-armoured and deliberately unbalanced: her left shield arm is heavily built up with a thick strapped leather bracer to the elbow and a plated iron shoulder cop, while her right arm is entirely bare to the shoulder, muscled and marked with old scars. A sleeveless scale jerkin cut high over one hip, a knotted sash, dark trousers, one shin in an iron greave and the other in plain wraps. Her hair is shaved close on the left and falls in a long loose braid on the right. Her outline reads as one heavy side and one light side. Both of her hands are completely empty and open, palms turned toward her thighs, all fingers visible, relaxed and slightly spread, with clear empty grey background visible on both sides of each hand and all the way down both arms. Her forearms, wrists, hands, back and shoulders are clear and unencumbered; her whole torso from collarbone to belt is uncovered and fully visible to the camera.

**loadout.** A large hook-bladed iron axe and a round wooden shield. The axe head is the sharpest, biggest shape in her lowered right hand: a wide flaring single-bitted iron blade the length of her forearm, mounted on the end of a short straight wooden haft, its long curved cutting edge sweeping down into a deep pointed spur that hangs well below the line of the haft with an open hook between spur and haft. The round flat wooden shield rides on her left forearm, held low beside her left hip and angled away so her torso stays visible, about as wide as her own shoulders, painted boards, iron rim, domed iron boss. Full body, single figure, standing upright in a symmetrical relaxed A-pose facing the camera directly, arms straight and held about 40 degrees out from the sides, palms turned toward the thighs, fingers relaxed and slightly open, feet planted shoulder-width apart, whole figure from the crown of the head to the feet inside the frame with clear empty space above and below. She is a woman: a Norse shieldmaiden of a dark medieval fantasy arena, smooth clean female face and jaw, late twenties to thirties, tall and physically strong, weathered fair skin, pale blue-grey eyes, a hard level stare. Plain flat uniform medium-grey studio background, even soft frontal light, no cast shadow on the background, no vignette, no atmosphere, no props, no scenery, no text. Realistic hand-painted dark-fantasy concept rendering with credible worn PBR-like materials, leather that has creased, mail with weight, wool that hangs. Not glossy, not plastic, not a toy, not a smooth mannequin, no cleavage armour, no bikini mail, no fantasy pin-up, no cape flaring in wind, no glow, no magic effects. ASYMMETRIC OUTLINE. Half-armoured and deliberately unbalanced: her left shield arm is heavily built up with a thick strapped leather bracer to the elbow and a plated iron shoulder cop, while her right arm is entirely bare to the shoulder, muscled and marked with old scars. A sleeveless scale jerkin cut high over one hip, a knotted sash, dark trousers, one shin in an iron greave and the other in plain wraps. Her hair is shaved close on the left and falls in a long loose braid on the right. Her outline reads as one heavy side and one light side. On her left forearm she carries a round flat wooden Viking shield roughly as wide as her own shoulders, held low beside her left hip and angled slightly away so that her torso stays fully visible, plain painted boards, an iron rim and a domed iron boss at the centre. Her right hand grips a short straight wooden haft down at her side. Mounted on the top of that haft is a large single-bitted iron axe head, clearly visible against the grey background and about as long as her forearm: a wide flaring blade whose long curved cutting edge sweeps downward and ends in a deep pointed beard hanging well below the line of the haft, leaving an open hook between the beard and the wood. The steel head is the biggest and sharpest shape in her right hand.
