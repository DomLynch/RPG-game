# Adds the goblin fort kit's `goblin_lantern` (public/world/kit/goblin-fort-kit.glb on char/goblin-fort-restyle-5, TRELLIS.2 seed 191301, 3,500 tris) to the dungeon kit as the node `lantern`, so the Bone Hollow's end room can
# stand lanterns from the same hand-placed `kit.fixed` rows as its walls and piles. The node keeps the fort kit's ground-centre origin and size (about 1.0 x 2.3 x 0.5 m); its own material and texture ride along.
#   blender -b -P scripts/character/dungeon_kit_add_lantern.py -- <dungeon-kit.glb> <goblin-fort-kit.glb> <out.glb>   then: node scripts/pack-world-body.mjs <out.glb>
import sys

import bpy

KIT, FORT, OUT = sys.argv[sys.argv.index("--") + 1:][:3]
LANTERN_TEX = 512
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
for mat in lantern.data.materials:   # a hand-held-size prop: 2048 px of texture is the budget's biggest cost (the kit's world file is capped at 1.3 MB gzip)
    for node in mat.node_tree.nodes if mat.use_nodes else []:
        if node.type == "TEX_IMAGE" and node.image and max(node.image.size) > LANTERN_TEX:
            node.image.scale(LANTERN_TEX, LANTERN_TEX)
import numpy as np
for img in bpy.data.images:   # Blender hands an untouched JPEG to the exporter as it came: write the pixels back so every texture is re-encoded at the export quality
    if img.size[0] and img.size[1]:
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        img.pixels.foreach_set(px)
        img.update()
print("LANTERN", [round(v, 2) for v in lantern.dimensions], len(lantern.data.polygons), "polys")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_image_format="JPEG", export_jpeg_quality=78)   # JPEG 78, as #3021's pack
print("KIT-OUT", OUT, sorted(o.name for o in bpy.data.objects))
