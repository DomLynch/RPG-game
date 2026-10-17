# The empty dungeon kit: three placeholder boxes with the node names the Test Zone Sandbox keys its rows on (building-skins.json fits for the wall and the doorway, a props-defs row for the pile), at the sizes it asked for
# (2026-10-17: ground-centre origin, front facing +Z, width x height x depth in metres). scripts/character/goblin_piece_fit.py then swaps each TRELLIS.2 mesh into its node (same name, same box), the way the fort kit was built.
#   blender -b -P scripts/character/dungeon_kit_seed.py -- <out.glb>
import sys

import bpy

OUT = sys.argv[sys.argv.index("--") + 1]
NODES = (   # name, width, height, depth, x offset in the kit file (laid in a row so the glb opens readable; a row's fit ignores it)
    ("cave_wall", 4.0, 3.0, 1.0, -4.0),
    ("cave_doorway", 4.0, 3.2, 1.2, 0.0),
    ("bone_pile", 1.6, 0.8, 1.6, 3.5),
)
bpy.ops.wm.read_factory_settings(use_empty=True)
mat = bpy.data.materials.new("dungeon-seed")
for name, w, h, d, x in NODES:
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    o = bpy.context.active_object
    o.name = name
    o.data.name = name
    o.scale = (w, d, h)   # Blender is Z-up: x width, y depth, z height
    bpy.ops.object.transform_apply(scale=True)
    for v in o.data.vertices:
        v.co.z += h / 2   # the box stands on the ground (y=0 in glTF), centred in x and z
    o.location = (x, 0.0, 0.0)   # the node's own offset is only the x it sits at
    o.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True)
print("SEED-OUT", OUT)
