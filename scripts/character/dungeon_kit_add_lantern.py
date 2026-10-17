# Adds the goblin fort kit's `goblin_lantern` (public/world/kit/goblin-fort-kit.glb on char/goblin-fort-restyle-5, TRELLIS.2 seed 191301, 3,500 tris) to the dungeon kit as the node `lantern`, so the Bone Hollow's end room can
# stand lanterns from the same hand-placed `kit.fixed` rows as its walls and piles. The node keeps the fort kit's ground-centre origin and size (about 1.0 x 2.3 x 0.5 m); its own material and texture ride along.
#   blender -b -P scripts/character/dungeon_kit_add_lantern.py -- <dungeon-kit.glb> <goblin-fort-kit.glb> <out.glb>   then: node scripts/pack-world-body.mjs <out.glb>
import sys

import bpy

KIT, FORT, OUT = sys.argv[sys.argv.index("--") + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KIT)
kit_objs = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=FORT)
new = [o for o in bpy.data.objects if o not in kit_objs]
lantern = next(o for o in new if o.name.startswith("goblin_lantern") and o.type == "MESH")
for o in new:
    if o is not lantern:
        bpy.data.objects.remove(o, do_unlink=True)
lantern.name = lantern.data.name = "lantern"
lantern.parent = None
lantern.location = (9.0, 0.0, 0.0)   # laid in the kit's row (bone_pile sits at 4.5): a row's placement ignores the node's own x
print("LANTERN", [round(v, 2) for v in lantern.dimensions], len(lantern.data.polygons), "polys")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True)
print("KIT-OUT", OUT, sorted(o.name for o in bpy.data.objects))
