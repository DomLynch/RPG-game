# Pit room graphics pass — brief for GPT (Strategy, 2026-09-30)

Dom, 13:4x, on the #1151 stills: YES to direction a (layout, props, one axis to the lit gate), but "the walls are still basic Minecraft style and need much better graphics". Cause (read in `src/pit/room.ts` on `pit/d3-a`): the room is fully procedural; `stoneTexture()` builds per-block DataTextures, no image or model files. Lead slotted the material pass: owner Web design (materials, look-test flag `?look=pit-stone`), The Pit on the room code; CC0 textures as the first pass, GPT's set replaces them when it lands. #1151 is not blocked by this.

## Room facts
8 × 6 m, vault crown 3.2 m. Floor y 0, x −4..4, z −3..3. Gate mid far wall (z −3), rack left wall (x −4), chests, table and trophies right wall (x +4), two low warm torches, sand floor, worn red rug. Camera: fixed three-quarter pose per zone (rack, trophies, gate), judged at 375×812. Y-up, metres.

## Deliverable A (first): tileable stone material sets
Seamless 1024×1024 PBR SOURCE maps (albedo, normal, roughness; AO if cheap), PNG. GPT delivers 1024 source only; Web/World make the ship copies (512 WebP, ≤ 150 KB per map, ≤ 1.2 MB per set). Graphics-first carve-out (Lead, 14:0x): if 512 stone reads soft on desktop, a 1024 full-tier set ships beside a 512 phone set.
1. Wall: coursed ashlar, broken bond, recessed dark mortar, per-block tone, damp darkening in the bottom 60 cm; soot fans above the torches as a separate alpha decal.
2. Vault: same family, smaller blocks, darker and cooler.
3. Floor: packed sand over old flagstones in patches, one worn path along the axis to the gate.
Plus two lit reference renders at 375×812 (gate angle, trophies angle): torches warm, gate light falling off down the room. Dom judges on these.

## Deliverable B (after A): hero props as single GLBs via the L1 pipeline
FLUX design → Kontext product shot, neutral background → TRELLIS.2 at MAX → reduce. In order: bull skull (horns rooted at the brow, wall mount) · iron gate (portcullis bars in a stone arch, arch included) · wooden rack, empty (the game hangs its weapons) · two chests (banded, plain) + rough table · torch sconce with bracket (flame stays the game's).
Caps (Lead's ruling 14:0x after World measured: the phone resizes prop maps to 256 and desktop to 512 in `src/arena-props.ts`, so 1024 ship maps are thrown away; `docs/pit-design.md` budgeted 300 KB): triangles after reduction — skull ≤ 3k, sconce ≤ 1.5k, rack ≤ 3.5k, chests + table ≤ 5k together, gate + arch ≤ 6k. GPT delivers 1024 source maps; World ships 512² WebP (gate 768), ≤ 300 KB per GLB, prop pack ≤ 1.2 MB gzip, loaded non-blocking. Pit total ≤ 2.5 MB on the phone path. Origin at base centre (floor pieces) or mount point (wall pieces). Real scale. Named meshes.

## Look rules
Mood-board pick stands: vault, one axis to the lit gate, few big props, nothing added. Palette warm sand, grey-brown stone, soot black, rust iron, one red (rug, shield exist). Match the arena stone family. No glow, runes, invented heraldry or text. No room mesh: walls and floor stay code planes taking materials, so the fixed cameras never clip.

## Handover
Sources (1024 maps, TRELLIS output, prompts) to `docs/character-references/pit/`. Ship copies, made by World/Web, to `public/pit/props/` (GLBs) and `public/pit/stone/` (512 sets); a 1024 desktop stone set, if the carve-out is used, to `public/pit/desktop/`. These are the paths Code Quality's budget gate (#1159) measures. Each file with a receipt: prompts and seeds, tris, map sizes, compressed MB. Web integrates behind the look flag, Pit places props; before/after stills at 375 to Dom via Strategy before any PR.
