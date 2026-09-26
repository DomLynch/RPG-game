# GPT review assembly (artifacts/sand-legionary-pilot/review/sand-legionary-review.glb) -> one surface the hero fit reads like a TRELLIS
# reconstruction: every body and armour mesh joined; the gladius dropped (the fit keeps our sword); the scutum saved alone for
# herolook_scutum.py / herolook_attach.py, so its repaired shield can be judged against ours in the same shot.
#   blender -b -P scripts/character/herolook_join.py -- <review.glb> <out body.glb> <out scutum.glb>
import sys

import bpy

src, body_out, shield_out = sys.argv[sys.argv.index("--") + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_image_format="WEBP", export_image_quality=92)


shield = [o for o in meshes if o.name.startswith("shield")]
body = [o for o in meshes if not o.name.startswith(("shield", "gladius"))]
export(shield, shield_out)
bpy.ops.object.select_all(action="DESELECT")
for o in body:
    o.select_set(True)
bpy.context.view_layer.objects.active = body[0]
bpy.ops.object.join()
body[0].name = "LegionaryGPT"
export([body[0]], body_out)
print("JOINED", len(body), "meshes ->", body_out, "; scutum ->", shield_out, flush=True)
