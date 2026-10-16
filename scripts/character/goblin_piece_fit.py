# Swap one TRELLIS.2 mesh into the goblin fort kit glb as the node NODE: same node name, same box (the Sandbox's rows key on it), ground-centre origin, +Y up in glTF.
#   blender -b -P scripts/character/goblin_piece_fit.py -- <kit.glb in> <trellis.glb in> <kit.glb out> <node> <height|width> <w> <d> <h> [target tris] [texture px] [ground crop 0..1] [darken above 0..1] [darken factor 0..1]
# <w> <d> <h> is the old node's box in metres (width, depth, height). Mode `height` scales the mesh to <h> (a pole, a tower); `width` scales it to <w> (a wall run); then any axis still over
# its box is squashed to it, and a wall's depth is squashed to <d>. The material keeps the kit's feature set (base colour map x vertex colour, rough, not metal, double sided) so the draw
# compiles no new render program. Run on the VPS (blender-cpu).
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
KIT_IN, MESH_IN, OUT, NODE, MODE = argv[0], argv[1], argv[2], argv[3], argv[4]
BOX = Vector((float(argv[5]), float(argv[6]), float(argv[7])))   # x width, y depth, z height in Blender's Z-up; the glb's w x h x d is (x, z, y)
TARGET_TRIS = int(argv[8]) if len(argv) > 8 else 2500
TEX_PX = int(argv[9]) if len(argv) > 9 else 1024
GROUND_CROP = float(argv[10]) if len(argv) > 10 else 0.0
DARKEN_ABOVE = float(argv[11]) if len(argv) > 11 else 0.0   # fraction of the height above which the vertex colour is toned down
DARKEN = float(argv[12]) if len(argv) > 12 else 0.0   # the multiplier for the red channel (0 = off); green and blue are lifted a little so the tan goes brown-grey, not just dark

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KIT_IN)
old = bpy.data.objects[NODE]
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

def bbox(o):
    c = [o.matrix_world @ Vector(v) for v in o.bound_box]
    return Vector((min(p.x for p in c), min(p.y for p in c), min(p.z for p in c))), Vector((max(p.x for p in c), max(p.y for p in c), max(p.z for p in c)))
lo, hi = bbox(ob)
# TRELLIS bakes the ground a prop stood on into its foot (a grass wedge, a pale slab wider than the prop): delete every face that lies wholly in the lowest GROUND_CROP of the height
if GROUND_CROP > 0:
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    cut = lo.z + GROUND_CROP * (hi.z - lo.z)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if max(v.co.z for v in f.verts) < cut], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    lo, hi = bbox(ob)
# uniform scale to the old height (or width), then squash only an axis that is over its old size
s = (BOX.x / (hi.x - lo.x)) if MODE == "width" else (BOX.z / (hi.z - lo.z))
ob.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
lo, hi = bbox(ob)
size = hi - lo
ob.scale = (min(1.0, BOX.x / size.x), (BOX.y / size.y) if MODE == "width" else min(1.0, BOX.y / size.y), min(1.0, BOX.z / size.z))
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
if MODE == "width":   # decimation pulls a wall's thin ends in: stretch the run back to its old width, so runs placed end to end do not leave a gap, and ground-centre it again
    lo, hi = bbox(ob)
    ob.scale = (BOX.x / (hi.x - lo.x), 1.0, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    lo, hi = bbox(ob)
    ob.location = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    bpy.ops.object.transform_apply(location=True)

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
if DARKEN > 0:   # the kit material multiplies the texture by this colour: tone a too-bright part (a tower's tan hide roof) down toward a brown-grey without a new texture
    top = max(v.co.z for v in ob.data.vertices)
    col = ob.data.color_attributes["Col"].data
    for loop in ob.data.loops:
        if ob.data.vertices[loop.vertex_index].co.z > DARKEN_ABOVE * top:
            col[loop.index].color = (DARKEN, min(1.0, DARKEN * 1.12), min(1.0, DARKEN * 1.35), 1)
ob.data.materials.clear()
mat = bpy.data.materials.new(f"{NODE}-v2")
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
ob.name = NODE
ob.data.name = NODE
ob.location = old_loc   # the old node's own offset in the kit, so the glb swaps in place

lo, hi = bbox(ob)
d = hi - lo
print(f"PIECE {NODE} tris {tris0} -> {tris} (target {TARGET_TRIS}); size {d.x:.2f} x {d.z:.2f} x {d.y:.2f} (w x h x d; old {BOX.x:.2f} x {BOX.z:.2f} x {BOX.y:.2f}); tex {TEX_PX}px")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True, export_image_format="JPEG", export_image_quality=88)
print("PIECE-OUT", OUT, os.path.getsize(OUT), "bytes")
