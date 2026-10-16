# Swap one TRELLIS.2 mesh into the goblin fort kit glb as `goblin_totem`: same node name, same box (the Sandbox's rows key on it), ground-centre origin, +Y up in glTF.
#   blender -b -P scripts/character/goblin_totem_fit.py -- <kit.glb in> <trellis.glb in> <kit.glb out> [target tris] [texture px]
# The material keeps the kit's feature set (base colour map x vertex colour, rough, not metal, double sided) so the draw compiles no new render program. Run on the VPS (blender-cpu).
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
KIT_IN, MESH_IN, OUT = argv[0], argv[1], argv[2]
TARGET_TRIS = int(argv[3]) if len(argv) > 3 else 2500
TEX_PX = int(argv[4]) if len(argv) > 4 else 1024
BOX = Vector((1.5, 0.97, 3.65))   # the old totem's size (x width, depth, height in Blender's Z-up); the glb's w x h x d was 1.5 x 3.65 x 0.97

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KIT_IN)
old = bpy.data.objects["goblin_totem"]
old_loc = old.location.copy()
bpy.data.objects.remove(old, do_unlink=True)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=MESH_IN)
new = [o for o in bpy.data.objects if o not in before]
meshes = [o for o in new if o.type == "MESH"]
for o in new:
    o.parent = None
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
for o in new:
    if o is not ob and o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# uniform scale to the old height, then squash only an axis that is over its old size
def bbox(o):
    c = [o.matrix_world @ Vector(v) for v in o.bound_box]
    return Vector((min(p.x for p in c), min(p.y for p in c), min(p.z for p in c))), Vector((max(p.x for p in c), max(p.y for p in c), max(p.z for p in c)))
lo, hi = bbox(ob)
s = BOX.z / (hi.z - lo.z)
ob.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
lo, hi = bbox(ob)
size = hi - lo
ob.scale = (min(1.0, BOX.x / size.x), min(1.0, BOX.y / size.y), 1.0)
bpy.ops.object.transform_apply(scale=True)
lo, hi = bbox(ob)
ob.location = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))   # the ground centre is the origin
bpy.ops.object.transform_apply(location=True)

# decimate to the target
tris0 = sum(len(p.vertices) - 2 for p in ob.data.polygons)
mod = ob.modifiers.new("dec", "DECIMATE")
mod.ratio = min(1.0, TARGET_TRIS / max(tris0, 1))
bpy.ops.object.modifier_apply(modifier="dec")
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)

# the base-colour image of TRELLIS's material, shrunk; the kit's node setup around it
img = None
for m in ob.data.materials:
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and img is None:
                img = n.image
if img is None:
    raise SystemExit("the TRELLIS mesh has no base-colour image")
img.scale(TEX_PX, TEX_PX)
img.pack()
if "Col" not in ob.data.color_attributes:
    ob.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    for d in ob.data.color_attributes["Col"].data:
        d.color = (1, 1, 1, 1)
ob.data.materials.clear()
mat = bpy.data.materials.new("goblin-fort-totem")
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
mix = nt.nodes.new("ShaderNodeMix")
mix.data_type = "RGBA"
mix.blend_type = "MULTIPLY"
mix.inputs[0].default_value = 1.0
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.95
bsdf.inputs["Metallic"].default_value = 0.0
nt.links.new(tex.outputs["Color"], mix.inputs[6])
nt.links.new(vc.outputs["Color"], mix.inputs[7])
nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
ob.data.materials.append(mat)
ob.name = "goblin_totem"
ob.data.name = "goblin_totem"
ob.location = old_loc   # the old node's own offset in the kit, so the glb swaps in place

lo, hi = bbox(ob)
d = hi - lo
print(f"TOTEM tris {tris0} -> {tris} (target {TARGET_TRIS}); size {d.x:.2f} x {d.z:.2f} x {d.y:.2f} (w x h x d; old 1.50 x 3.65 x 0.97); tex {TEX_PX}px")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True, export_image_format="JPEG", export_image_quality=88)
print("TOTEM-OUT", OUT, os.path.getsize(OUT), "bytes")
