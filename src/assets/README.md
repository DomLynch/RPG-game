# Origins Arena warden asset

Foundation: Quaternius, Universal Base Characters (Standard), Superhero_Male_FullBody.
https://quaternius.com/packs/universalbasecharacters.html
https://quaternius.itch.io/universal-base-characters

Motion: Quaternius and Gonzalo Furnier, Universal Animation Library (Standard v3),
Unreal-Godot/UAL1_Standard.glb (root motion disabled).
https://quaternius.com/packs/universalanimationlibrary.html
https://quaternius.itch.io/universal-animation-library

Both foundations are CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
Retrieved from the creator's free itch.io downloads on 2026-09-13; no purchase or seller contact.
The original animation archive's License.txt is preserved alongside this file.

Original project work: helmet, fitted plate harness, heraldry, scabbard, surface maps,
body proportion adjustment, sword geometry, authored guard pose, draw transition and animation retargeting. This is an early original character
art pass; no claim of final AAA art or complete combat animation coverage.

Rebuild: extract the two official Standard archives into artifacts/source/base and
artifacts/source/animations, preserving their archive directory names. Run
`npm run build:warrior` from the repository root. The script uses only
locked project dependencies and writes warrior.glb. Source archives stay ignored.
The free body has broader proportions; the finished model narrows its width by 10%.
Included source clips: Idle_Loop, Walk_Loop, Jog_Fwd_Loop, Sprint_Loop, Sword_Idle,
Sword_Attack, Hit_Chest, Death01 and Roll. Draw and Guard are authored offline on the same rig. Roll pelvis translation is kept in place horizontally; the simulation owns travel. Runtime animation
never moves simulation. The two fighters share geometry and use separate skeletons.

Source archive SHA-256:
- base.zip: fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40
- animations.zip: cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724

Combat feel pass: the same CC0 Sword_Attack supplies a reversed Return (backhand) clip. Heavy and Riposte are original offline-authored two-arm poses on this rig, exported by scripts/build-warrior.mjs. No additional third-party source, audio sample or licence is introduced. Runtime audio is original procedural noise/resonance synthesis. These 14 exported clips include the three additions; this is not a claim that all 14 distinct spec checklist roles are filled (bespoke guard impact and alternate hit remain absent).

Polished exchange: ArmedWalk, StrafeLeft, StrafeRight and Kick are original offline work on the existing CC0 rig (18 shipped clips total). Guard/Draw and lateral motion include grounded pelvis tracks. Collision paths are regenerated from the final GLB by scripts/bake-blades.mjs and checked against its active blade poses. Blood droplet/splash sprites are original procedural Canvas textures; no downloaded sound, texture, paid pack or new asset licence. The free CC0 UAL2 Standard remains a future clip-fit candidate; it was researched, not acquired or integrated.

Defensive motion pass: BlockImpact, Parry and Deflected are original same-rig clips, bringing the asset to21 clips. Confirmed blocks absorb force through the arms/spine; a parry turns the blade and the attacker loses the striking line. These are authored clips, not purchased or downloaded mocap.

Parts pipeline (character lane, 2026-09-14): `scripts/character/parts.py` runs headless in Blender (`blender -b -P
scripts/character/parts.py`) against the CC0 base rig and writes `src/assets/source/parts/*.glb` — meshes in the unscaled
rest space with `bone` and `material` extras. `scripts/build-warrior.mjs` merges any such parts into the per-material
skinned draws before the final body narrowing; with no parts the output is byte-identical to the previous build. Blender
5.2 LTS (GPL) is an authoring tool only; nothing from it ships except geometry authored by this project's own scripts.
Material maps follow the same pattern: `src/assets/source/materials/manifest.json` maps a material name to `baseColor`,
`metallicRoughness` (glTF packed: G roughness, B metal), `normal` and optional `normalScale` image files in that directory
(PNG or JPEG). Authored slots replace the procedural 256² maps per channel; unlisted slots keep them. No manifest → identical output.

Universal humanoid and level-1 kit (character lane, 2026-09-14): the build now keeps the whole CC0 body — face, eyes, eyebrows —
with its own skin, normal and roughness maps resampled to 1024/512 JPEG by `scripts/character/parts.py` (with an original
ash-and-grit pass) and committed under `src/assets/source/materials/` via `manifest.json`. Buzzed hair is the CC0 `Hair_Buzzed`
mesh attached to the head bone. All plate primitives are gone. The level-1 kit (`src/assets/source/parts/level1.glb`) is original
work generated headlessly from the body surface: sleeveless linen tunic, studded leather baldric and belt, forearm wraps,
sandal-boots, dyed under-skirt and kilt strips (the Heraldry surface), iron studs (the Steel surface). Sword and scabbard are
unchanged. No new third-party asset or licence; everything derives from the two CC0 archives above.

Motion pass (character lane, 2026-09-14): Guard now comes from the CC0 Universal Animation Library 2 (Standard, Quaternius,
`Unreal-Godot/UAL2_Standard.glb`, SHA-256 8cee20ab1bc55130092447e810e26df22dd2803eccc54f52137a7d54d7ab88a8, retrieved by the
owner from the creator's free itch.io download on 2026-09-14; License.txt preserved alongside): the raise-and-hold window of
`Sword_Block` retimed to the contract's 1 s. BlockImpact and Parry remain original derivations, now from that hold pose.
Extract the archive under artifacts/source/animations2 preserving its directory name; the build requires it.

Equipment items (character lane, 2026-09-14): loot-tier pieces from the CC0 Quaternius Modular Character Outfits – Fantasy
[Standard] pack (retrieved by the owner from the creator's free download on 2026-09-14; License_Standard.txt preserved under
artifacts/source/outfits; part file SHA-256: Male_Ranger_Acc_Pauldron.gltf 967bd4e8d85821fb9…, Male_Ranger_Feet_Boots.gltf
e71cd92792aeabca2…). `scripts/character/parts.py` imports the Ranger boots, bracers and pauldron (rigged to this skeleton),
decimates them to the phone budget and writes `src/assets/source/items/ranger.glb` plus re-tinted 1024/512 JPEG maps of the
pack's own PBR set (`ranger_*.jpg`, greens pulled to worn leather, dust added). Items are equipped only in demo builds
(`WARRIOR_ITEMS=ranger`) until the runtime swaps slots; the shipped GLB is unchanged.

Helmet slot (character lane, 2026-09-14): `src/assets/source/items/helmet_bronze.glb` is original work — an open-faced bronze
helm shelled from the head mesh (so it inherits the head's skin weights), projected onto a smooth dome with cheek guards, nasal
and neck guard, plus a horsehair crest on the Heraldry surface. Its bronze maps (`bronze_*.jpg`, 512) are procedural. Demo
builds only (`WARRIOR_ITEMS=helmet_bronze`); a helmet hides the `Hair` slot. Hair is now its own slot draw for that reason.

Realistic body (character lane, 2026-09-14, demo builds `WARRIOR_BODY=realistic`): Blender Studio Human Base Meshes Bundle v1.0.0
(CC0, https://download.blender.org/demo/asset-bundles/human-base-meshes/, SHA-256 46a912c0524072ac3b78c35d5d2471df7b8df102394a050ca8cd7184e3393648,
retrieved 2026-09-14) — `GEO-body_male_realistic` and its eyes, appended by `scripts/character/parts.py --body realistic`, scaled
to the rig, arms raised rigidly from A to the rig's T rest, weighted from the CC0 body by nearest surface. The bundle ships no
textures: skin colour is painted procedurally by landmark from a baked position map (brows, lips, flush, stubble, buzz cut),
the multires sculpt is baked high→low into the normal map with pores added, eyes are painted the same way. Outputs carry the
`_r` suffix (`body_realistic.glb`, `level1_realistic.glb`, `manifest_realistic.json`, `*_r.jpg`).

Realistic head pass 2 (character lane, 2026-09-14, demo builds only): `scripts/character/head.py`. The Blender Studio body is UDIM,
so the head now keeps its own texture tile as the `Face` material (2K authored, 1K shipped: `face_*_r.jpg`) and the three body
tiles pack into one `Skin` atlas. Wrinkles, folds and pores are a landmark-keyed height map displaced into the multires sculpt
(two extra levels) and baked high→low into the face normal map. Hair, brows and lashes are strand cards (`hair_cards.png`, an
original procedural strand sheet; alpha cut-out, no sorting) rigid to the head — hair in the `Hair` slot, brows and lashes in
`Face`. Skin micro-detail (pore and mottle structure only) is high-passed from a forehead patch of the "Infinite, 3D Head Scan"
by Lee Perry-Smith (Infinite-Realities / Triplegangers), licensed CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/),
retrieved 2026-09-14 from the three.js examples (`examples/models/gltf/LeePerrySmith/`; SHA-256 Map-COL.jpg e976d73b31407f8d…,
Infinite-Level_02_Disp_NoSmoothUV-4096.jpg 937dea3ab1adea46…); the licence file is preserved beside the download under
`artifacts/source/lps/`. Nothing of that scan's face shape or identity is used — the patch is mirrored and tiled as texture grain.
Attribution: "Infinite, 3D Head Scan by Lee Perry-Smith, CC BY 3.0". The `Face` material carries KHR_materials_specular
(factor 0.5) and the cards `KHR_materials_specular` 0.3 — both load as MeshPhysicalMaterial in the runtime with no code change.

Realistic head pass 3 (character lane, 2026-09-14, demo builds only): the front of the face is a photograph projected onto the
head — a synthetic portrait (no real person) generated with FLUX.1 Krea-dev via its public Hugging Face Space
(`artifacts/source/face/portrait_seed11.png`, prompt and seed in `scripts/character/head.py`; FLUX.1 outputs carry no licence
restriction on use), landmarked with MediaPipe Face Mesh (`scripts/character/landmarks.py`, Apache 2.0, run in a separate venv),
thin-plate-warped onto measured head landmarks, de-lit, silhouette- and eye-masked, colour-matched and blended into the painted
skin by facing angle (`head.photo_layer`). Lids are rotated 13°/4° about the eyeball centres before baking. Hair is now fur
shells (7 offset copies of the scalp with a dotted alpha and per-shell vertex alpha, `hair_shell.png`); brows and lashes stay
cards on a redrawn curved-strand sheet, alpha-blended. Portrait and landmark files are committed under
`artifacts/source/face/` so the build is reproducible without network access.

Realistic head pass 6 — reconstructed head (character lane, 2026-09-14, demo builds only): the head is now a photogrammetry
reconstruction of the owner's five synthetic portraits (GPT-generated, no real person; `artifacts/source/face/gpt_front.png`
and `gpt/raw1..4.png`) made with the KeenTools Cloud API (`scripts/create-head.mjs`, key from `KEENTOOLS_API_KEY`, never
stored in the repo): `artifacts/source/keentools/01a0a0ab-aa11-7be1-9b43-2221309c04b9.glb` (SHA-256 04a4987809abc23c…,
retrieved 2026-09-14; head, two eyes, teeth, four 2048² textures). `head.keentools_head` scales it by eye spacing onto the
base eyes, cuts it 10 cm below eye level (under the jaw, where the base rig's weights are all neck and head), slides that
collar radially onto our neck, transfers the skin weights from the base head by nearest surface, decimates to 15.6k
triangles with a normal map baked from the full mesh, and fills the un-photographed crown and back (found by camera
coverage, not colour) with the photographed hair's own tone and fresh buzz-cut grain — the nape with skin. The base body is
painted to the scan's neck colour (`SKIN_TONE`), and both sides of the seam meet on that flat tone with no occlusion. Fur
shells and brow cards are off when the scan is present; the bronze helm is shelled from the scan. A/B against Hunyuan3D-2mv
(`scripts/character/hunyuan.py`, Hugging Face Space, shape only on the free quota): likeness lost to KeenTools —
`artifacts/character/humanoid-v19/AB-RESULTS.md`.

Body pass (character lane, 2026-09-14, demo builds only): `parts.align_arms` lays each raised arm of the Studio body onto the
rig's bones — the arm's smoothed slice centreline is translated onto the shoulder → elbow → wrist → fingertip bone line, and
the hand is rotated about the wrist (the forearm pronating into it) so its finger and thumb directions match the rig's; the
finger bones now sit inside the fingers and the grip closes on the hilt. Forearm wraps are seven narrow turns hugging the
wrist half of the forearm (smooth-shaded); the sandal sole is the underside only, so the toes stay bare.

Shipped fighter (2026-09-14): the Blender Studio body with the reconstructed head is now the default build — `npm run build:warrior`
writes it; `WARRIOR_BODY=classic` rebuilds the CC0 stylised body. The "demo builds only" notes above describe how the passes were
staged, not the current default. Shipped budget: 5.80 MB GLB (3.25 MB gzip), 59.8k skinned triangles per fighter, 1K face and
body maps (2K authored copies stay in `src/assets/source/materials/*@2k.jpg`).

Polish pass v24 (character lane, 2026-09-15): eyes — the scan's eye texture gets its sclera lifted towards a cool white in the
ring around the detected iris and the iris mid-tones a little (`head.eye_colour`), and `PhotoEyes` a modest clearcoat for a
catch-light. Body skin — `head.skin_variation` keys sun (forearms and hands, shins, shoulder tops) and blood (elbows, knuckles,
knees) on the rig's joints in the baked position map, before the median match, so the overall tone and the collar still meet the
scan. Head — sized by eye-level-to-crown against the base body (1.16×), the cut under the jaw and the hairline now in scan units
so they follow the size; collar blend eased (smoothstep) and kept under the chin tip found from the profile; the texture fade to
the body tone is taller than the geometric collar; the scan gets a roughness map (matte at the collar) and borrows our neck's
normals along its bottom ring. Thumb — swung onto its bone chain and stretched ≤1.12× towards the rig's longer thumb. Wrist
wraps — their own `Wrap` material with a procedural leather-strip map (worn edges, stitch line; `wrap_*.jpg`, 256²).

v25 (2026-09-15): head +10% over the height match (owner's call). The crown fill treats anything seen at more than ~53° from every
camera as un-photographed and paints hair right down to the collar at the back, so the seam fade draws one nape hairline instead of
two photographed "tails" beside a filled centre. Both skin tiles share one tone normalisation (`BODY_NORM`), and the shoulder-top
sun zone is gone — its edge sat on the head tile's boundary. `character-preview.html` follows the combat lane's export clean-up
(`DEFENCE`/`KICK` rebuilt from `RULES`/`MOVES`).

v26 (2026-09-15): the collar blend under the jaw is a fixed 0.10 scan units (the profile-based chin finder had picked the lip and
the blend flattened the chin); the texture fade 0.14. `parts.align_legs` lays each leg onto its bones the way `align_arms` does
the arms — the Studio body stood ~5 cm ahead of the rig at the knee and ~11 cm at the ankle, so the ankle joint hinged behind the
foot. The sandal's ankle strap is a strap again (3.5 cm, the wraps' leather).

v27 (2026-09-15): the sandal sole is every downward-facing face under the foot (arch included, 7 mm) — one flat sole instead
of a toe pad and a heel block. Below the hairline only texels no camera saw at all are re-painted (the under-chin stubble is
photographed at a grazing angle and stays); the crown/back keep the stricter rule. The fill's growth is short (48 texels) and
the skin synth carries the surrounding photographed tone, so no streaks.

v28 (2026-09-15, superseded by v30): `head.chin_boss` — the reconstruction's chin was flat (profile in scan units below eye level: lips −0.51…−0.66,
crease −0.69, chin only 0.011 ahead of the crease at −0.75) where the portraits show a strong rounded chin. A smooth boss
centred at −0.80, ~15 mm at the tip, 0.21 units wide, pushed along one forward-and-down direction below the lip crease only
(per-vertex normals tear the open lip boundary), applied before the neck cut so the bake source and the phone mesh share it.

v29 (2026-09-15): the pale band at the nape (issue #22) was the portraits' grey backdrop leaking through the projection at the
back-centre, where the ±90° cameras see the head at a grazing angle; those texels are now treated as un-photographed like the
crown (a baked `back` mask gates it), and the collar band at the back takes the scan's own 64-sample occlusion with the body's
occlusion curve. Island edge texels take interior colours before the gutter fill. The borrowed collar normals are off
(`HEAD_COLLAR_NORMALS=1` re-enables them); they did not help.

v30 (2026-09-15): `head.chin_extend` replaces the chin boss — the boss under the lip read as a pout, and borrowing the base
head's outline tore the mouth. The band from the chin tip down to just above the collar moves forward and down (~13 mm at the
chin's underside), nothing above the tip, so the collar still meets the neck; and the profile itself is corrected along y only
(the scan's lower lip sat 1 mm ahead of its upper lip and of the chin — a pout from the front): lower lip back 2.6 mm, upper
lip forward 1.3 mm, chin tip forward 5.2 mm, the open lip boundary moving as one.

v31 (2026-09-15, interim): the chin pushes (v28 boss, v30 jaw extension and lip profile) are off — `HEAD_CHIN=1` re-enables
`chin_extend` for experiments. In profile every one of them looked wrong: the scan never captured the jaw (the five portraits
cover it only at a grazing angle), and pushing vertices cannot invent the shape. The fix is either two extra portraits from ~45°
below for a new KeenTools job, or the base body's jaw stitched on below the lip crease. The v29 nape fix ships.

v32 (2026-09-15): re-scan. Three more synthetic portraits from below (`artifacts/source/face/gpt/jaw_a.png` front from ~40°
below, `jaw_b.png` three-quarter from below, `jaw_c.png` chin raised) joined the five, and KeenTools reconstructed a head
with a real chin and jaw angle: `artifacts/source/keentools/01a0a628-a661-7ec2-89ec-735ecb733b5f.glb` (SHA-256 recorded
below; one billed job, 2026-09-15). The coverage mask knows the three low cameras. No chin pushes.

## The Veteran — the opponent (character lane, 2026-09-16)

`src/assets/veteran.glb` is the opponent: a second man on the same rig, clips and sword as the player's `warrior.glb`
(`tests/characters.test.ts` asserts every bone track and the sword attachments are identical, so the baked blade paths serve
both). `src/scene.ts` loads it for the opponent through `loadWarriors(player, opponent)`; with one URL the runtime still
recolours the opponent's Heraldry, with two it does not. Source: seven synthetic portraits of an older man (GPT-generated, no
real person; `artifacts/source/face/veteran/{front,left35,right35,left90,right90,below_front,below_right}.png`, 1254²) →
KeenTools Cloud (`scripts/create-head.mjs`, one billed job, 2026-09-16; cameras estimated at 0°, +27°, -22°, +61°, -66°,
and two from 27° / 22° below) → `artifacts/source/keentools/01a0a9a9-c037-70f2-8015-bbd1faf9f823.glb` (SHA-256
036ae4fc81b5feb3…, untracked like the hero's). The pipeline is the hero's, parametrised: `head.FIGHTERS` holds each
fighter's scan, portrait cameras (coverage mask), chin push (hero only — his scan's jaw needed it, this one has two low
portraits and a closed mouth, so `level_mouth` also skips) and hair; `parts.py --fighter veteran` writes
`body_veteran.glb` / `level1_veteran.glb`, `*_veteran.jpg` maps and `manifest_veteran.json`, and its own
`helmet_bronze_veteran.glb` / `crest_red_veteran.glb` (the helm is shelled from the skull); `WARRIOR_FIGHTER=veteran
node scripts/build-warrior.mjs` assembles `veteran.glb`. The hero's outputs are byte-identical before and after (checked).
`HEAD_PHOTO` defaults off for a non-hero fighter: the photo fit targets the hero's portrait and the scan replaces the head.
Crown: the hero's fill assumed a dark buzz cut (hair = texels darker than 0.16); this man is blond-grey (hair 0.34 median
against 0.66 skin), so `hair_lum` is per fighter and `hair: 'full'` fills the unphotographed crown with swept strands —
shadow and highlight tones read from well-photographed hair on the geometric scalp (top/back above the brows; the nape and
temple skin next to the band read as a rosy highlight when sampled), the photographed tufts ending ragged along the strands
rather than on one coverage iso-line, matte (roughness ≥ 0.86) with a strand normal so the crown is not a smooth dome.
Chin: `chin_strong` (the owner's U, v34) runs for him too — his scan's jaw was the same vertical wall the hero's was — and
`stretch_refill` takes its donor stubble from the face only for full-hair fighters (the rows beside the jaw hold his nape
hair, which quilted a dark beard under the chin). Review: `artifacts/character/veteran-v1/` (`faces.png` both heads from the
portrait angles, `details-opponent.png`, `chin-before-after.png`, turntable, phone stills). Budget cap 5 → 12 MB gzip
(owner, 2026-09-16).

Kit pass (2026-09-16, same day, owner's list): everything the eye uses at the phone camera, per fighter and gated so the
hero's outputs stay byte-identical.
- `parts.KIT` per fighter: the Veteran's exomis is a darker undyed linen (0.40/0.37/0.32) with heavier grime (0.72); his
  pteruges and crest are dark oiled umber (`#3f2e22`, the Heraldry colour factor in build-warrior.mjs) against the hero's
  madder red. **Heraldry recolour decision:** the runtime tints the opponent's Heraldry only when both fighters share one
  GLB (`loadWarriors(url)` with a single URL — the twins fallback); with `veteran.glb` the dye is baked and the runtime
  leaves it alone.
- Greaves (`parts.greaves`, slot `Greaves`): bronze shin guards shelled from the shin itself, from above the sandal's ankle
  strap over the kneecap, wrapping 122° either side of the front and open behind the calf, cylindrical UVs so the tiled
  bronze shows no atlas seams, rim-only shell (`extract(rim_only=True)`: no inner faces) and decimated by half — a smooth
  plate needs none of the shin's density. Skin weights ride with the faces, so they bend with the leg.
- Helmet (`parts.bronze_helmet`, rebuilt): the earlier helm was shelled from the decimated scan head — every opening tore
  along its triangles and it cost 13k triangles. It is now a parametric Chalcidian helm: an ellipsoid dome sized from the
  skull (width from the band just above the ears, so the ears sit in the notches), a brow rim at the top of the ears, the
  face opening under a 3 cm brow arch with a nasal bar, cheek guards deepest at 60° hugging the jaw, ear notches, a neck
  guard flaring off the nape; 72 × 20 (azimuth × height) grid, outside vertices of kept faces moved onto the analytic
  boundary along one grid line (averaging two twisted quads and flipped their normals), the whole surface oriented once
  from the grid's winding (a per-face recalc flipped patches beside the openings), open edges extruded 6 mm inward as a
  rim; 1.3k faces, rigid on the Head bone like the crest. `WARRIOR_FIGHTER=veteran` builds with `helmet_bronze` by default
  (`WARRIOR_ITEMS` overrides). Owner's call after the first live look (2026-09-16): no crest — it floated, and the first
  opponent is a poor veteran; extravagant gear is for the later, harder men (`crest_red_veteran.glb` stays built). `strip_crown_under_helm` drops the scan head's faces radially inside the dome
  above 4 cm over the rim (hidden for a fighter who always fights helmed: 1.1k faces), and his head decimates at 0.26
  (`FIGHTERS[...]['decimate']`; the hero stays 0.28) so the Veteran ships at 59.5k skinned triangles under the 60k cap.
  `tests/characters.test.ts` locomotion ceiling 1.87 → 2.0 m (REQUESTS #9): the crest reaches ~1.92 m.
- Bronze (`parts.bronze_maps`, shared by helm and greaves; the hero's shipped GLB carries no bronze): the 512 tile of flat
  gold with thin scratch lines read as cheap under the arena environment (owner). Now 1024, aged and hand-hammered: broad
  shallow dents whose facets catch the light (260 overlapping spherical caps, wrapped so the tile has no seam), corrosion
  pits denser in the oxide, 22 dark-bottomed gouges and 300 fine hand-drawn scratches showing fresh metal, oxide mottling
  over a dull copper-brown base (0.40/0.255/0.125 — bronze, not gold), grey-green patina pooling in pits and hollows
  (desaturated, per the materials rule), satin roughness 0.28–0.92 (rougher in the patina, smoother along scratches), the
  patina dielectric. Manifest normalScale 0.7 → 1.0. First attempt (520 deep dents, ×22 normal) read as cratered rock;
  the relief was halved and the dents broadened. Colour, owner's reference (a museum Corinthian helm, 2026-09-16): the
  copper-red read as fake; a grey-yellow pass went dark olive, a matte pale pass went clay. Shipped: pale greige-tan
  (0.62/0.545/0.415) faded a fifth of the way to grey, oxide and patina in the same key, metalness 0.86 under the thin
  patina skin (0.56 where it pools), satin roughness 0.36–0.9; pits at half density, scratches quiet. Then (owner, the
  same evening): the dome still carried one bright hot spot that read as plastic — roughness base 0.54 → 0.63 (0.46–0.92),
  metalness 0.86 → 0.80: the sheen spread wide and dim, still metal (0.62 had read as clay).
- Scars (`head.body_scars`, `FIGHTERS[...]['scars']`): four healed cuts on the body tile — a 14 cm slash across the bare
  right pectoral, a cut across the outer right bicep, one across the outside of the left forearm, a long slash down the
  outside of the right thigh — 5–7 mm wide (the first pass at 2.6 mm vanished into the 1K map), paler and pinker tissue,
  hairless, a faint darker halo, standing proud in the normal and smoother in the roughness. Close-up detail, like the nails.
- Build (`parts.build_shape`, `KIT['build']`; B2 of the body brief, skipped for the hero): girth added radially about each
  limb's bone line after the limbs are laid onto the bones — upper arms +12 %, forearms +14 %, thighs and calves +10 % —
  fading to nothing at the joints, the chest +8 % deeper about the spine, shoulders and traps +8 % wider; game mesh and
  high sculpt alike, before any bake. The kit is cut from that surface and the strips probe it, so tunic, belt, wraps,
  straps and greaves follow without clipping (`build-before-after.png`). 59.4k skinned triangles.

## Combat audio (audio lane, 2026-09-15; reconciled 2026-09-20)
`src/assets/audio/sprite.m4a` (AAC-LC 128 kb/s, Apple AudioToolbox encoder via ffmpeg `aac_at`, for Safari) and `sprite.ogg`
(Opus 96 kb/s VBR via ffmpeg `libopus`, for Chrome/Android) are one audio sprite built by `node scripts/build-audio.mjs`
(needs ffmpeg on PATH; bit-exact flags, so two builds are byte-identical). The generated `src/audio/manifest.ts` maps
cue → variants → [start, duration]. Two kinds of source, both listed in this file:
- Original procedural Foley (deterministic Node DSP: seeded noise, broadband sweeping-low-pass impact bodies, dense gritty
  inharmonic iron clusters, swept air), normalised to −4 dBFS for codec headroom — the combat cues (whoosh_light/heavy, draw,
  hit_flesh/heavy/kick, block, block_perfect, parry, guard_break, charge, kill, roll, backstep; 2–5 seeded variants each).
  No third-party sample, no AI generator, no licence.
- Five CC0 recordings from Freesound for the fatal pass (death voice, flesh cut/stab/tear, bone crack, crowd gasp/cheer),
  hash-pinned in `artifacts/audio/SOURCES.json` and credited under "Fatal contact and crowd — 2026-09-19" below. Downloads
  are build inputs, never runtime requests.
The separate optional arena bank (`src/assets/arena-audio/arena.m4a|ogg`, `scripts/build-arena-audio.mjs`, crowd bed,
reactions, jeers, chants, close grunts, opening bell) is documented under "Arena life" in PROJECT_STATE.md; the bell is
generated by `src/audio/bell.ts` and shared by the bank and the network-independent fallback. Evidence per iteration lives
under `artifacts/audio/<label>/` (rendered by `scripts/audio-preview.mjs`; WAVs stay out of git, reports and tables are
committed). The pre-sprite synthesised layers remain in `src/feedback.ts` as the fallback until the sprite has decoded.

v33 (2026-09-15): the chin. The eight-view scan's chin tip sits level with the lip crease and the wall below it ran straight to
the collar, where a short blend left a shelf — it read as a cut under the lips. `head.chin_strong` (owner's call: a strong,
longer chin) moves the chin zone (0.74–0.90 scan units below eye level, front-facing, broad) down by up to 7.6 mm and forward
by up to 11.4 mm, zero at the lip crease and above and zero again at the collar ring; the collar blend on the front runs
over 1.8 cm below the chin wall so the underside turns back to the throat. The texture fade at the collar is 1 cm — the
underside keeps its photographed stubble. `HEAD_CHIN=0` leaves the scan untouched.

v34 (2026-09-15): the owner's sketch — the jaw's bottom edge a good 2.5 cm lower at the centre, rising to the jaw corners.
`head.chin_strong` now runs after the collar blend (so the blend cannot pull the chin back onto the neck outline) and moves
the chin's bottom (peak 0.90 scan units below eye level) down by up to 23 mm at the centre, tapering to the sides, plus the
forward push; zero at the lip crease and at the collar ring, so the underside runs up and back from the lowered chin to the
throat. Cost: the photographed stubble under the chin stretches over the longer surface (visible from below, not at the
phone camera).

v35 (2026-09-16): the mouth levelled and the stretched chin re-covered. `head.level_mouth`: the scan's mouth was quirked —
one corner 1.8 mm lower than the other (−1.9° across 55 mm, a smirk); the lip slab (0.34–0.78 scan units below eye level,
ahead of the eye plane) rolls about the forward axis through the corners' midpoint by the opposite angle, measured on the
full mesh and applied to both, so the normal map still lines up; the exported corners read −0.2°. `head.chin_strong` now
picks its vertices by position (ahead of the neck axis) instead of by facing — the facing test had skipped down-facing
underside vertices on one mesh and not the other, which scalloped the chin's edge and left the normal-map bake with no
twin to find there (streaks under the chin, in v34 too). It also records the real stretch (each vertex's longest edge
against its old length, max 2.55×) and `head.stretch_refill` re-covers texels stretched by more than 20% with the
photographed stubble beside them: unstretched, seen, non-lip 64-texel patches from similar rows of the texture, each
squeezed vertically by the local stretch so the grain comes back to the photograph's density on the moved mesh, quilted
under a raised-cosine window with their tones smoothed; the underside's last texture rows above the collar (the scan saw
it at a grazing angle: only ~20 rows) carry the smooth tone alone. The collar's texture fade is computed from the heights
before the chin is lowered and is 3 mm ahead of the neck axis (the throat sits in the jaw's shadow), so the lowered chin
tip is no longer painted flat. Result: a rounded, uniformly stubbled chin like the portraits' (`humanoid-v35/chin-mouth-v34-v35.png`).

v36 (2026-09-16): the neck continues the head. The collar was a step: the head's band flattened to the scan's neck-ring
tone (`SKIN_TONE`, sampled in the photograph's shadow) and the body tile below carried a pale 2.5 cm strip of the same
flat tone. Now `head.ring_tones` reads the head texture's median colour 1.2–3 cm above the ring in 24 azimuth bins (chin
stubble at the front, nape skin at the back, jaw sides between), the head's band flattens to that tone at its side of the
neck (per-texel azimuth from two baked attributes), and `head.neck_tiles` repaints both body tiles below the ring —
their shared occlusion bake, no flat strip, the ring's shadow line under the stub's overlap softened within 1.5 cm — and
tints them from the ring tone to the body tone over 8 cm (the head's hue in full, its photographed darkness at 60%).
The `Skin` material is now MeshPhysical with skin-strength specular like `Face`, and the `Face` tile's normal scale
matches `Skin` (1.6): the two tiles meet on the neck and shaded differently. Measured (`scripts/character/probe_seam.py`,
the median colour 3–12 mm above vs below the ring per 30°): the step fell from mean 12.1 / max 23.4 to mean 5.4 /
max 18.4 in 8-bit sRGB; nine of twelve bins are within 4.3. To get there the ring tone is read 0.4–1.5 cm above the
ring (not higher: the photograph is 10% lighter there at the front), in 36 unsmoothed bins (the stubble's dark front
turns into the lit sides within 60°), re-read once the band's fade and nape occlusion are in, and the first centimetre
of neck matches it exactly with no baked occlusion (eased to the tempered tone and the body's own occlusion by 4 cm).
What remains is the jaw corners, where the tone gradient is steepest, and a faint geometric ridge at the ring (the
stub sits 0.2 mm outside the neck). Not done: the body's overall tone is still sampled from the scan's shadowed neck
ring, so the torso and limbs read paler than the face under the same light — first item of the body pass
(`artifacts/character/BRIEF-body-pass-v36.md`). `humanoid-v36/neck-owner-angles-v35-v36.png`, `neck-sheet.png`.

v37 (2026-09-16, body pass B1 — skin): the body read as one pale, waxy, pink-grey tone beside the photographic head.
Measured in the harness (`skin match` view, the lit shoulder vs the stubbled cheek): R/G 1.12 vs 1.16, B/G 0.91 vs 0.87
— desaturated, not paler. Changes, all in `head.py`: the body tone (`keentools_skin_tone`) is the lit face's hue
(median of forward-facing cheekbone/forehead texels) at the neck band's brightness — the lit cheek itself renders
near white, so its brightness is not the albedo; `sun_mask` now reaches the shoulder tops and nape, the chest's open V
and the thighs a little, at 0.7 of a warmer tan; `body_veins` (four wandering curves per forearm in the limb's cylinder
coordinates, to the knuckles), `body_hair` (short dark strokes drawn down the chest V, forearms and shins along the
local downhill direction in texture space) and `body_creases` (furrows at the back of the elbows and the front of the
knees) go into the colour and into one height field whose slopes join the sculpt normal (`body_normal`, 2-texel pores
included — the old `pore_normal` pass is gone); roughness 0.72 on the torso, 0.55 on the sunned limbs. Rendered:
shoulder R/G 1.16 / B/G 0.86 — the cheek's numbers. Audit: at the grip camera the first pass read as mottling on the
forearm (0.9 pores, 0.35 vein relief); shipped at 0.6 / 0.15 with the vein colour at 0.14. Note on colour spaces: Blender's
`Image.pixels` are raw bytes/255 on both load and save (probed), so every "linear" float in this pipeline is in fact
sRGB-encoded — self-consistent, and the reason an offline lab that sRGB-encoded on write came out pale. Budget 4.09 MB
gzip (the owner lifted the 5 MB cap if needed). `humanoid-v37/skin-before-after.png`, `phone-v36-v37.png`, `details.png`.

v38 (2026-09-16, body pass B3 — kit materials): the exomis was a flat khaki with the build's 256-texel linen stretched
over the whole body atlas (a blurry grid), the pteruges a dark wine slab, the leather a smooth dark blob. `parts.py`
now authors three material sets: `linen_maps` (2K, in the tunic's own layout via `bake_position` — unbleached greyed
linen with a 2-texel cross-hatch at 3.5%, slubs, mottle; grime in the fold creases from the baked folds normal, at the
hem and armpits, a sweat shadow down the chest and back, dust and a few stains; a darker stitched band along the cut
edges; roughness map), `leather_maps` (512, tileable: full-grain oiled leather, creases at 0.10, pale worn edges along v,
scuffs; normal and roughness) and `heraldry_maps` (512, tileable, undyed: the dye stays the material's colour factor —
`build-warrior.mjs` keeps `baseColorFactor` for Heraldry only — so the runtime's opponent recolour still works; dye
pooling in the low noise, the strips' bottoms scuffed pale; normal and roughness). Pieces cut from the body with
`Leather`/`Heraldry` (belt, soles, under-skirt) get their atlas UVs ×4 on TEXCOORD_0 so the tiles repeat at strap scale
(TEXCOORD_1 keeps the atlas for occlusion). Heraldry colour `#6b1a1e` → `#6e2622` under the ~0.85 map. Gambeson folds
normal scale 1.5. Audit (1×): the first linen (0.70/0.64/0.52, 2-texel weave at 6%) rendered as a bedsheet with a
printed grid; a heraldry stitch line tiled across the under-skirt as rows of rivets (dropped); leather creases at 0.25
tiled as corduroy on the soles. Budget 4.40 MB gzip. `humanoid-v38/kit-before-after.png`, `kit-sheet.png`,
`phone-v37-v38.png`, `details.png`.

v39 (2026-09-16, body pass B4 — hands and feet): `head.body_nails` paints finger and toe nails — a paler, pinker,
glossier oval (roughness −0.35, a raised plate with a bevel in the normal, a pale lunula, a darker rim) 7–8 mm behind
each tip on the side whose object-space normal faces the nail's way. The rig's finger bones overshoot the mesh (the
thumb by 2 cm), so the tips come from the position map: the fingers beyond the knuckles are four rods in (y, z) —
k-means, one cluster each, tip = the outermost texels; the back of the hand is the side the fingers curl away from;
the thumb's nail faces that rolled ~50° towards the index side; the toes are five x-bands of the forefoot, nail on each
band's top at its foremost point. `body_creases` adds a transverse furrow on the back of each finger joint. Audit: the
first placement (from the bones) painted nothing — 0 texels per finger, caught by the per-nail texel count now printed
(`BODY nails`); the second sat the ovals in the fingers' cores, 6 mm under the skin. The little toe's nail is still
missing (its band finds no top-facing texels) — noted, not visible at the game camera. `humanoid-v39/hands-feet-sheet.png`,
`feet-before-after.png`. Also noted for later: the wrist wraps' ring strips read as torn at very close range.

v40 (2026-09-16): the face read shiny and brighter than the body it had been matched to (owner's screenshot). Cause:
the portraits' key light is baked into the scan's texture (lit cheekbones and forehead), and the arena lights it again;
measured in the harness the lit cheek was 16% brighter than the lit shoulder. `head.delight` pulls everything brighter
than the seen skin's median brightness towards it (55% of the excess survives) and takes the whole map to 0.93 —
before the ring tones are read, so the neck still continues the head; the `Photo` material goes from roughness .62 /
specular .5 to .72 / .4. After: the lit cheek 9% brighter than the shoulder, the stubbled cheek darker than it; the
highlights on the forehead gone matte. `humanoid-v40/face-brightness-before-after.png`, `phone-v39-v40.png`.

v41 (2026-09-16): "10% darker again, more gritty" (owner, on v40 live). `delight` keeps 0.45 of the highlights (was
0.55) at gain 0.84 (was 0.93); `Photo` roughness .78 / specular .35. Measured: the lit cheek 192 vs the lit shoulder 186
(+3%; v39 was +16%), the stubbled cheek darker than the shoulder. `humanoid-v41/face-brightness-v40-v41.png`, `phone-v40-v41.png`.

v42 (2026-09-16): the hands hung with the palms facing forward (owner's screenshot; both fighters). `parts.align_arms`
step (2) matched the body hand's *thumb* direction to the rig's thumb chain — but on the base mesh and on the rig the
thumb droops 45° below the palm, so the whole hand rolled 45° about the forearm to put it "in plane", and the index and
pinky bones sat 9–21 mm outside their fingers (v41: nearest vertex to the index joints 9/12/14 mm, pinky 14/15/21). The
match now uses the hand's plane — the direction the fingers fan along (index_01 → pinky_01 on the rig; the principal
axis of the fingers' spread on the mesh) — and the rotation is 5.8° instead of ~45°; the finger joints sit 3–6 mm from
the skin and the *_03 weights land on their own fingers. Step (3), the thumb swing, now moves only the thumb — vertices nearer
the mesh thumb's axis than the index finger's, eased in over 2.5 cm from the base joint, no stretch (a plain cylinder
caught palm vertices and pulled a spike; skipping the swing left the thumb bones 3–6 cm off the thumb, which lies level
beside the index on the relaxed body while the rig's is abducted and droops 45°): 33°, 130 vertices, thumb joints 02/03 now
10/7 mm from the skin (the leaf tip stays 41 mm out — the rig's thumb chain is 110 mm to the body's 65). Measured
against the rig, the hand-plane roll went from 44.0° to 14.1° (the fingertip fan of a relaxed hand is not quite the
knuckle line); index joints 9/12/14 → 6/4/8 mm, pinky 14/15/21 → 4/5/4. Both fighters rebuilt — the Veteran shares the function. `humanoid-v42/hands-before-after.png`,
`hand-rest-after.png`, `hands-phone-before-after.png`.

## Weapons (weapons lane, 2026-09-16) — the trident

`src/assets/weapons/trident/`: `trident.glb` (the part alone). Since slice V the shipped `veteran.glb` IS the Veteran carrying it (every sword
clip plus 13 `Trident_*` clips). Built by `scripts/build-weapon.mjs` through `scripts/build-warrior.mjs` (`WARRIOR_FIGHTER=veteran
node scripts/build-warrior.mjs` — the trident is the Veteran's default weapon; `[WEAPON_VARIANT=A|B|C]` picks a silhouette), then
`node scripts/bake-blades.mjs` (the manifest entry samples `WeaponDrawn.extras.contact`, the tines).

Owner's pick (2026-09-16): variant `short` — a fat, wide fork on a stick 60% as long (1.42 m butt to tip, 0.86 m shaft), brown ash.

Provenance: **original project work, no new third-party asset, texture or licence.** The geometry is Three.js primitives (ash shaft,
bronze butt cap / socket / crossbar / three tines, two leather grips); the materials are procedural — the bronze uses the Veteran's
approved museum-bronze values (0.62/0.545/0.415, roughness .63, metalness .80), the leather is the sword's, the ash is a flat dark
wood; no image maps. The 13 clips are original, authored offline on the same CC0 rig: the body comes from the already-shipped clips
(Sword_Idle → Armed, ArmedWalk, StrafeLeft/Right, Hit_Chest, Death01 — CC0 Quaternius UAL1/UAL2 retargets recorded above) and
both arms are re-solved onto the shaft with build-warrior's two-bone reach, as Heavy / Riposte / Kick were. Checked 2026-09-16:
neither UAL1 nor UAL2 Standard (43 clips each) has a spear, polearm or staff clip, so nothing was retargeted from a library and no
Mixamo / KayKit / MoCap Online clip was downloaded. Silhouette variants and evidence: `artifacts/weapons/REPORT.md`.

## Weapons (weapons lane, 2026-09-16) — the cleaver

`src/assets/weapons/cleaver/`: `cleaver.glb` (the part alone) and `veteran-cleaver.glb` (the Veteran's 1.0× rig carrying it — the
**bake source** for the cleaver's blade table, so the brute's simulated blade is a man's and his rendered 1.13× blade runs past it, never
short of it; the sword's 21 clips, `Heavy` re-keyed as a diagonal hack). Since slice W the shipped `pitborn.glb` IS the Pitborn carrying it:
`WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs` (the cleaver is his default; owner's pick = variant A, `WEAPON_VARIANT=B|C` for the
others; the bake source is `WARRIOR_FIGHTER=veteran WARRIOR_WEAPON=cleaver WARRIOR_OUT=src/assets/weapons/cleaver/veteran-cleaver.glb`), then
`node scripts/bake-blades.mjs`.

Provenance: **original project work, no new third-party asset, texture or licence.** The blade is a procedural loft (a swept centreline
and a width envelope, wedge section) and the furniture Three.js primitives; the materials are procedural (pitted iron, dark wood; no
image maps). The re-keyed `Heavy` is original, on the same CC0 rig and the same authored-key grammar as the sword's Heavy / Riposte /
Attack / Return recorded above. Evidence and the three silhouettes: `artifacts/weapons/REPORT.md`.

## Weapons (weapons lane, 2026-09-17) — the knife

Since slice X the shipped `goblin.glb` IS the goblin carrying the sica (`WARRIOR_FIGHTER=goblin` defaults to the knife; the shelf's `goblin-knife.glb` was removed as a byte-identical duplicate). Formerly `src/assets/weapons/knife/goblin-knife.glb`: the goblin's own rig (character lane, #86) carrying the sica — a short hooked knife — with the
sword's 21 clips, `Heavy` re-keyed as a diagonal hack. Built by `scripts/build-weapon.mjs` through `build-warrior.mjs`
(`WARRIOR_FIGHTER=goblin WARRIOR_WEAPON=knife [WEAPON_VARIANT=A|B|C] WARRIOR_OUT=…`).

Provenance: **original project work, no new third-party asset, texture or licence.** A procedural loft (swept centreline, width envelope,
wedge section, the hook's back sharpened over its last third) and Three.js primitives; procedural materials (scavenged iron, greasy wood,
cord); no image maps. The re-keyed `Heavy` is the cleaver's original keys on the same CC0 rig. Evidence and the silhouettes:
`artifacts/weapons/REPORT.md`.

## Weapons (weapons lane, 2026-09-17) — the estoc

`src/assets/weapons/estoc/nightborn-estoc.glb`: the Nightborn's own rig (character lane, #85 brief / his build) carrying the estoc — a
long, thin, thrust-first blade — with every clip byte-identical to `nightborn.glb`. Built by `scripts/build-weapon.mjs` through
`build-warrior.mjs` (`WARRIOR_FIGHTER=nightborn WARRIOR_WEAPON=estoc [WEAPON_VARIANT=A|B|C] WARRIOR_OUT=…`).

Provenance: **original project work, no new third-party asset, texture or licence.** A procedural square-section loft and Three.js
primitives (cross, ring, wire turns, pommel); procedural materials (bright steel, black-oiled iron, wire); no image maps. No clip is
re-keyed. Evidence and the silhouettes: `artifacts/weapons/REPORT.md`.

# Arena (world lane, 2026-09-17)

Every arena texture — sand albedo and normal map, ashlar stone, sky dome, crowd silhouette atlas, torn-banner alpha — is generated at load
by `src/assets/arena/textures.ts` from seeded noise (an integer hash, tileable value noise, stamped pebbles). Original project work; no
third-party images, models or fonts, nothing downloaded, no licence to record. The geometry in `src/arena.ts` is procedural Three.js
(`three/addons/utils/BufferGeometryUtils.js` for merging). The same functions run in `tests/arena.test.ts`, so the pixels the test
measures are the pixels the phone shows. Review captures: `node scripts/arena-preview.mjs --label <name>` → `artifacts/world/<name>/`.

## Weapons (weapons lane, 2026-09-18) — the scythe

`src/assets/weapons/scythe/`: `scythe.glb` (the part alone) and `executioner-scythe-{A,B,C}.glb` (silhouette variants, the owner's pick B
also as `executioner-scythe.glb`) — the Executioner's own 1.36× rig carrying the scythe with a 13-clip `Scythe_*` family authored on it
(the two-hand grip solver from the trident; per-key blade roll so the crescent reads from the game camera), plus `warrior-scythe.glb`:
the MAN-SCALE bake rig (`WARRIOR_FIGHTER=hero WARRIOR_WEAPON=scythe WARRIOR_OUT=…`), the intended blade-table source after the combat
lane's flip, per the cleaver convention. Built by `scripts/build-weapon.mjs` through `build-warrior.mjs`
(`WARRIOR_FIGHTER=executioner WARRIOR_WEAPON=scythe [WEAPON_VARIANT=A|B|C] WARRIOR_OUT=…`). ON THE SHELF: nothing references these yet
(`WEAPONS.scythe` borrows the longsword; the flip is `artifacts/weapons/REQUESTS.md` §15–17).

Provenance: **original project work, no new third-party asset, texture or licence.** A procedural loft (haft sweep, the crescent's
curved edge as a swept width envelope, wedge section) and Three.js primitives (ferrules, collar); procedural materials (varnished ash,
pitted iron `#4c4946`); no image maps. All 13 clips are original authored keys on the same CC0 rig and the same authored-key grammar as
the sword's clip family recorded above. Evidence and the silhouettes: `artifacts/weapons/scythe-notes.md`.

## Audio movement pass — 2026-09-19
`src/assets/audio/sprite.{m4a,ogg}` now contains 54 regions, including four roll and four backstep variants.
Source/origin: original cloth/leather and sand DSP in `scripts/build-audio.mjs` (`RECIPES.roll/backstep`), authored 2026-09-19; no third-party recording or licence.
Processing: seeded broadband friction layers, short amplitude envelopes, fade-out, existing -4 dBFS normalization, AAC/Opus encoders. Reproduce with `node scripts/build-audio.mjs`.
These cues mark movement start only; no footfall/landing events or material inference were added. Existing impact recipes are unchanged.

## Fatal contact and crowd — 2026-09-19
The 73-region AAC/Opus sprite adds human death voices, restrained organic fatal contact, and three 2.5 s crowd variations.
These are CC0 public recordings, verified on the linked Freesound source pages on 2026-09-19. Source URLs, authors,
licence URLs and SHA-256 hashes are pinned in `artifacts/audio/SOURCES.json`; downloads are build inputs, never runtime requests.

| Source | Author | Licence | Use |
|---|---|---|---|
| [Crowd Cheer.wav](https://freesound.org/people/deleted_user_2104797/sounds/324892/) | deleted_user_2104797 | CC0-1.0 | Three separate recorded cheering takes |
| [small crowd gasp shock surprise](https://freesound.org/people/HowardV/sounds/264376/) | HowardV | CC0-1.0 | Crowd onset and double-death reaction |
| [Grunt1 - Death Pain.wav](https://freesound.org/people/tonsil5/sounds/416839/) | tonsil5 | CC0-1.0 | Short dying grunt |
| [Grunt2 - Death Pain.wav](https://freesound.org/people/tonsil5/sounds/416838/) | tonsil5 | CC0-1.0 | Second recorded dying grunt |
| [rip_tear FLESH!.wav](https://freesound.org/people/aust_paul/sounds/30931/) | aust_paul | CC0-1.0 | Natural-object Foley for cut, puncture, sever and skull layers |

Processing in `scripts/build-audio.mjs`: mono 48 kHz decode, short trims/fades, high/low-pass filters, restrained pitch changes,
three delayed crowd layers, existing -4 dBFS normalization and AAC/Opus encoding. Four voice variants use two distinct recordings;
three cheer variants use three distinct takes. Reproduce with `node scripts/build-audio.mjs` (ffmpeg with aac_at and libopus).
Existing impact recipes and gains remain unchanged. Only decapitation gets a sever tear; Split Crown gets a short crack;
blood-off and kicks omit added wet layers. Crowd starts 350 ms after fatal contact, with the roar fading in after its gasp.


## Minotaur and Wraith reconstructed playtest (2026-09-19)

`minotaur.glb` and `wraith.glb` are fitted derivatives of the original generated
surfaces in `source/creatures/`. Inputs were owner-approved project concept images
(see `docs/character-references/PROMPTS.md`); reconstruction used the official
Microsoft TRELLIS.2 Space, seed 190926, at resolution 1024 with 2048 textures.
The [TRELLIS.2 code/model project](https://github.com/microsoft/TRELLIS.2) uses the
MIT licence, retained at `source/creatures/TRELLIS-LICENSE.txt`. This is a record of
the generating software licence, not a claim that model outputs or their inherited
Frankendom rig and motion are CC0. Existing base rig/clip/weapon licences above apply.
No MPFB or downloaded animal morph is included in these production surfaces.

Raw source SHA-256:
- Minotaur: `70a4ed946a428f3deee86ac7671404c4e5f71af38d1120e5637e27544ef501c1`
- Wraith: `16d3ab3fcfcc19b413685fe67abd6510f330710e33f69d35a1b13e4ceee03c16`

Offline build: `node scripts/build-creatures.mjs`; contract check:
`node scripts/creature-check.mjs`. The packaging metadata records the exact source,
base and generator hashes. Surface UVs and compressed source images are preserved.
Arena-life audio (2026-09-19): `scripts/build-arena-audio.mjs` builds the separate optional AAC/Opus bank under
`arena-audio/`. Murmur: SpliceSound, “Indoor adult murmur, medium group.wav”
(https://freesound.org/people/SpliceSound/sounds/260122/). Jeers/wordless group calls: deleted_user_2104797,
“Crowd Boo.wav” (https://freesound.org/people/deleted_user_2104797/sounds/324893/). Both CC0 1.0,
https://creativecommons.org/publicdomain/zero/1.0/, retrieved 2026-09-19; URL/hash pins in
`artifacts/audio/arena-life/SOURCES.json`. Reuses the pinned CC0 crowd/gasp/tonsil5 grunt recordings in
`artifacts/audio/SOURCES.json`. Seven offset recorded groups form the bed; shortened cheer/gasp takes react to
combat; rhythmic open-vowel edits form wordless chants. Bell is original modal synthesis. No music or modern songs.
Existing combat bank and its 1 MB cap are unchanged; optional arena bank cap is 450 KB combined gzip.
## The Quiet One — 2026-09-19
Original project animation and procedural wound presentation; no new third-party asset or licence.
`scripts/build-quiet-one.mjs` authors `Death_QuietOne` (2.4 seconds, 61 keys) on each existing CC0-derived rig.
Run `node scripts/build-quiet-one.mjs` to append/revise this clip on shipped rigs, then `node scripts/bake-blades.mjs`.
Existing geometry, materials, embedded textures, bone nodes and animation bytes remain unchanged; the full warrior
builder invokes the same authoring function after final scaling. Anatomical hinge frames keep the palm at the throat,
feet roll with the fall, and offline skin-envelope clearance grounds the corpse for each body build.
Reuses the existing licensed death/contact/body/crowd audio at quieter gains with delayed collapse and gasp.

Reconstruction packing rounds only position/normal/UV float precision before gzip: positions
and normals to 1/16384, UVs to 1/65536 (under 0.016 texel error at 2K). It refreshes
accessor bounds and leaves weights, source images, existing clips and weapons intact.

## Werewolf and Skeleton reconstructed sources — 2026-09-19
Original project reference artwork generated with built-in image generation; images and exact prompts
are retained in `docs/character-references/`. Converted through the signed-in official Microsoft
TRELLIS.2 Space with seed190926, 1024 resolution, 100000 export faces and 2048 textures.
The owner supplied a Hugging Face PRO subscription; no separately billed GPU job was used.
The existing TRELLIS software licence and inherited rig/weapon/animation licences above apply.
Source meshes are unrigged: fitted game surfaces, bindings and motion checks are a separate build stage.

Raw source SHA-256:
- Werewolf: `f2691db5b870eed7d95af59c00d47e4d12b3c105e2423c7d7f5ca7fbe38ea03b`
- Skeleton: `7135dd7639954eb1c21871833ba8eabb9000ef8289dcbbc152130a27ae09eeb9`

Werewolf uses the Pitborn animation/cleaver donor. Skeleton uses the Veteran trident donor, with
rigid weighting for exposed bones rather than the broad smoothing used on flesh. Neither source
constitutes an automatically game-ready character; inspect fitted attack/guard/locomotion poses.

## Lossless production transport — 2026-09-19

`npm run build` packs emitted GLBs with Meshoptimizer 1.2.0 (MIT, build-only dependency);
the existing Three.js package supplies the runtime decoder. The authoring GLBs remain unchanged
by this step. No geometry, animation, skin weights or used texture pixels are quantized.
Unused material/texture payloads and the offline `creatureWeaponBase` rollback document are
omitted from production copies; original source files retain them for authoring.
The build hashes compressed bytes before emission. `check-glb-compression.mjs` independently
decodes and compares every accessor, clip, node and used material/image against the source,
and its browser mode checks Chromium/WebKit under the staged CSP with ordinary eval blocked.
Decoder licensing is shipped at `/licenses/meshoptimizer.txt`.

JPEG textures are additionally repacked by `jpegtran` without changing their DCT coefficients. Only a smaller
representation is kept; dimensions, decoded RGBA pixels, ICC/EXIF/colour metadata and all non-JPEG map bytes
are independently checked. Source GLBs and their embedded maps remain untouched. The build needs
`jpegtran` (`brew install jpeg-turbo` on macOS; `apt install libjpeg-turbo-progs` on Linux); CI installs it.
`jpeg-js` is a development-only independent pixel judge, not a browser/runtime dependency.

## Executioner reconstructed (TRELLIS.2) — 2026-09-20
`executioner.glb` is now a fitted derivative of a TRELLIS.2 reconstruction, replacing the procedural
v5 body (owner, 2026-09-20: "rebuild improve via trellis … grade elite level char … keep the old as a backup").
The v5 rig is retained byte-for-byte at `source/backups/executioner-v5.glb` (SHA-256
`d5b149d279ef9e91951ee91fca231354d73b3149fa8226a052a796fb2aedba3c`) and is the **weight/clip/weapon donor**
for the rebuild: its 1.32× root, scythe `WeaponDrawn`, and all clips are inherited unchanged except
`Death_QuietOne`, which `build-quiet-one.mjs` re-authors on the new body's own skin envelope.
Source image: `docs/character-references/executioner-source-v1.png` — FLUX.1 Kontext [dev] edit of the
owner-approved masked reference set (local, git-ignored) into a full-body A-pose, run through the signed-in
official Hugging Face Space `black-forest-labs/FLUX.1-Kontext-Dev` (seed 190926, then a second pass removing a
chest stain); prompt in `docs/character-references/PROMPTS.md`. Reconstruction: official Microsoft TRELLIS.2
Space via `gradio_client` with the owner's signed-in PRO token, seed 190926, resolution 1024, 100000 export
faces, 2048 textures. No separately billed GPU job. The TRELLIS software licence and inherited
rig/weapon/animation licences above apply. FLUX.1 Kontext [dev] is distributed under Black Forest Labs'
FLUX.1 [dev] Non-Commercial License — **owner to confirm that licence's terms on output use before commercial launch**.
Raw source SHA-256: `56708c69f043e3ee22f9f058d488e45998396f3adcf5d3d9bf045a435c7ea1c5`.
Fit recipe (`scripts/character/creatures.py`): donor arm 64°, reach 1.15, shift (0.02, −0.12, 0), 1.87 m,
solved so the posed `WeaponDrawn` origin lands in the reconstruction's palm (0.011 m); finger weights are kept
on the arms so the clips curl his fingers round the haft (grip gap 0.019 m in every scythe clip vs the v5 rig's
0.003 m; 0.04–0.08 m without finger weights). Build: `node scripts/build-creatures.mjs executioner`.
