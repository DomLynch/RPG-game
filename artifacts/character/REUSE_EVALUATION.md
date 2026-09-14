# Reuse evaluation — 2026-09-14 (owner-supplied research, checked against this lane's constraints)

Constraints applied: mobile browser + Three.js 0.186 pinned; CC0/owner-made only, no purchases; frozen rig/clip contract;
authoring on a Mac (no NVIDIA GPU); everything reproducible from committed sources.

| Item | Disposition | Why |
|---|---|---|
| **Quaternius UAL2 [Standard]** (free, CC0, 17 MB, same rig family) | **ADOPT — next step** | Real authored sword strikes, recoveries, combos, knockback. Non-contact clips (Hit, Death, Guard, Block, Parry, Deflected, Strafes, ArmedWalk) can be replaced inside the contract by retiming to the frozen durations. Attack clips move the blade during contact → flagged GAMEPLAY CHANGE, prepared as a side-by-side for combat review. Needs the zip at `artifacts/source/animations2.zip` (owner download from quaternius.itch.io; SHA-256 recorded in src/assets/README.md like UAL1). |
| **Quaternius Modular Character Outfits – Fantasy** (Nov 2025, CC0, free tier = 60–70 % of 62 parts, glTF, rigged to the Universal Base Characters skeleton) | **ADOPT — for equipment slots** | Helmets, pauldrons, cuirasses, greaves, boots, gloves that already fit our body and bone names, weighted. Style is stylised-lowpoly, so every adopted part gets our material treatment (PBR maps via the manifest path), silhouette edits in parts.py and the 7 m phone-camera test before it ships. Needs the Standard zip at `artifacts/source/outfits.zip` (owner download from quaternius.com/itch.io; SHA-256 recorded). |
| three-vrm / VRM avatars | Rejected | Different humanoid standard and rig; the game's contract is this skeleton and these 21 clips. |
| LOWPO Horror pack, PSX/Gothic environment packs | Out of lane | Enemy archetypes and environment are the lead's/presentation's scope; the character lane keeps to the humanoid and its equipment. |
| Animato (text → bpy animation) | Not needed | The motion pass edits UAL2 clips directly in bpy/Three.js with the blade bake as the validator; an LLM wrapper adds no reproducibility. |
| upf-gti/retargeting-threejs (Apache-2.0) | Not needed | UAL2 targets the same skeleton as the body, so the existing rotation-delta retarget in build-warrior.mjs applies unchanged. Revisit only for non-Quaternius motion. Its no-nonuniform-scale warning is moot: we retarget in the unscaled rig. |
| ahujasid/blender-mcp (MIT) | Deferred | Authoring already runs headless from committed scripts, which is what keeps every asset reproducible. Interactive MCP would add speed for sculpt-like tweaks at the cost of an undocumented command trail. Reconsider for the helmet tier if scripted modelling proves too slow. |
| microsoft/TRELLIS.2 (MIT, needs ≥24 GB NVIDIA, Linux) | Deferred | No suitable GPU here; cloud GPU is a paid service (owner approval). Would only be used to generate material candidates for approved geometry, then rebaked through the manifest path. |
| VAST-AI SkinTokens (MIT, ≥14 GB NVIDIA) | Deferred | Same GPU block. Our kit inherits the body's own weights by construction, so deformation is not the current problem. |
| N8python/n8ao (licence metadata inconsistent) | Presentation lane | Runtime post-process with a `postprocessing` peer dependency: a runtime change and a phone frame-time cost. Logged in REQUESTS.md for the lead/presentation lane after the asset is done. |
| MetaHuman Vampire, Epic Game Animation Sample | Rejected | Licence not verified for Three.js reuse; different skeleton; hair cards/cloth unsuitable for the mobile budget. |
| Blender Studio Human Base Meshes (CC0) | Rejected for now | Would replace a rigged, animated body that already works with the contract. Keep as the fallback if anatomy becomes the limiting defect. |
| Wiggle, Three.js TBA | Rejected | Reparents bones / no evidence of a GLB saving. |

## Working rule adopted from the owner's note
For every need: find the best legal source asset → extract → adapt to the Frankendom skeleton and art direction → retexture →
optimise for mobile → export GLB → validate under the real lock camera. Offline fixes only; never a runtime hack for an asset problem.
Open-sourcing the rig/pipeline (Frankendom Human Rig v1 + viewer + validator + build scripts) is the owner's strategic call; the
lane keeps everything reproducible and licence-clean so that option stays open.
