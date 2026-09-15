# Ashcourt warden asset

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
