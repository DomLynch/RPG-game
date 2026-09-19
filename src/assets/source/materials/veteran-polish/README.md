# Veteran material source tiles

Original albedo artwork generated with the built-in ImageGen tool on 2026-09-19 for this game. These are surface tiles, not a regenerated fighter. Source PNGs are retained unchanged here; runtime JPEG/PBR maps are produced by `scripts/character/veteran_materials.py` in Blender. No third-party character asset or paid reconstruction is involved.

## Art direction / prompts
Bronze: seamless, flat, uniformly lit cross-polarized ancient Greek bronze albedo; fine dense grain, tiny pits, restrained abrasion and mottling; no highlights, shadows, perspective, objects or text. The first brown-gold output was rejected as too golden in the model render. Final edit: preserve the surface detail, desaturate toward neutral grey-brown museum bronze (approximately sRGB 125/116/98, exposed patches 160/149/124, oxide 81/76/64).

Leather: seamless dark umber vegetable-tanned saddle leather albedo (approximately sRGB 76/51/33), fine irregular pores, shallow broken creases, subtle abrasion and hand-oiled patches; no large cracks, reptile scales, lighting, perspective, objects or text.

The generated images are 1254 square. The baker resamples them to 1024, welds tile edges, derives restrained micro-relief and roughness, and retains the original fitted hammer/fold/strap normals. Roughness/metalness are authored estimates, not measured scans. ORM maps are 512; albedo/normal maps are 1024. Runtime maps use JPEG quality82; the final GLB is8,156,620 bytes (4,439,218 gzip), versus7,705,620 (4,036,012 gzip) before. The existing tunic colour and all face/skin images remain unchanged.

## Rebuild / audit
`blender -b -P scripts/character/veteran_materials.py` refreshes only the Veteran material views in the current GLB. It verifies unchanged geometry, rig, skin weights and animation data before writing. Running it twice must produce the same GLB. The normal full Blender character pipeline also calls this baker before the GLB assembler reads the manifest.

`node scripts/veteran-polish-check.mjs` checks embedded map bytes against the material manifest and captures front/detail/phone/motion renders. `--before <original.glb>` additionally verifies unchanged rig/mesh/animation/other image payloads and creates captioned, otherwise unretouched before/after images. Studio lighting, exposure, camera, pose and resolution are identical across each pair.
