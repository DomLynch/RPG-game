Engine goblin (left) beside its generated world body (right), 375 px per figure, level-1 armour kept.
Generated 2026-10-09 on the VPS: `blender-cpu --python scripts/character/world_body.py -- src/assets/goblin.glb out.glb 8000 1024`, then `scripts/world-body-check.mjs` and `scripts/character/world_body_stills.py`.
tris 62361 -> 7999, file 5.28 -> 1.84 MB, textures 34 -> 1, decoded texture 23.3 -> 4.0 MB, joints 65 = 65, clips 25 = 25 (none missing).
The regenerated file matches the shipped public/world/goblin.glb in every stat (it is the same pipeline); the shipped file is the world asset.
