# Hero Look reduction step (docs/state/herolook.md, Dom 2026-09-26: generate at MAX, reduce in the fit). Decimating the 495k TRELLIS
# mesh straight to the 80k fit budget shattered it: collapse edits drag its UV islands, and the seams tear into shards. So the geometry
# is reduced alone, the low mesh gets fresh UVs, and the 495k's own maps are BAKED onto it at full size (colour, and metal/rough packed as
# glTF expects), each through Emission so the value is copied, not relit.
#   blender -b -P scripts/character/herolook_bake.py -- <in 495k.glb> <out low.glb> [tris 80000] [size 4096]
import os
import sys
import time

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = argv[0], argv[1]
TRIS = int(argv[2]) if len(argv) > 2 else 80000
SIZE = int(argv[3]) if len(argv) > 3 else 4096
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hi = next(o for o in bpy.context.scene.objects if o.type == "MESH")
bpy.context.view_layer.objects.active = hi
hi.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
height = hi.dimensions.z
hi_tris = sum(len(p.vertices) - 2 for p in hi.data.polygons)

# LOW: a copy, welded, decimated on geometry alone, then unwrapped fresh.
low = hi.copy()
low.data = hi.data.copy()
low.name = "Low"
bpy.context.collection.objects.link(low)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = low
low.select_set(True)
while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
if os.environ.get("BAKE_WELD", "0") == "1":   # off: welding fuses armour to the body under it (tested 2026-09-26)
    bpy.ops.mesh.remove_doubles(threshold=height * 0.0002)   # TRELLIS splits vertices along its UV seams: weld them so collapse sees one surface
bpy.ops.object.mode_set(mode="OBJECT")
tris = sum(len(p.vertices) - 2 for p in low.data.polygons)
mod = low.modifiers.new("Reduce", "DECIMATE")
mod.ratio = min(1.0, TRIS / tris)
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.shade_smooth()
# NORMALS: the reconstruction's triangle winding is inconsistent (open, layered shells), so normals Blender rebuilds from it after the
# collapse point every which way, and on metal each wrong one is a bright shard. Recomputing them "outside" flips half the shells (tried,
# 2026-09-26). The 495k carries its own vertex normals: transfer those onto the low mesh instead of deriving new ones.
dt = low.modifiers.new("HiNormals", "DATA_TRANSFER")
dt.object = hi
dt.use_loop_data = True
dt.data_types_loops = {"CUSTOM_NORMAL"}
dt.loop_mapping = "POLYINTERP_NEAREST"
bpy.ops.object.modifier_apply(modifier=dt.name)
low.data.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.002, area_weight=1.0)
bpy.ops.uv.pack_islands(margin=0.002)
bpy.ops.object.mode_set(mode="OBJECT")
low_tris = sum(len(p.vertices) - 2 for p in low.data.polygons)


def image(name, colour):
    img = bpy.data.images.new(name, SIZE, SIZE, alpha=False)
    img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    return img


colour_img, mr_img = image("BakedColour", True), image("BakedMetalRough", False)
mat = bpy.data.materials.new("LegionaryBaked")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
tc = nt.nodes.new("ShaderNodeTexImage")
tc.image = colour_img
tm = nt.nodes.new("ShaderNodeTexImage")
tm.image = mr_img
sep = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(tc.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tm.outputs["Color"], sep.inputs["Color"])
nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])   # glTF packing: G roughness, B metallic
nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
low.data.materials.clear()
low.data.materials.append(mat)

# The 495k's material: find its colour and metal/rough image nodes, and route each to Emission in turn.
hm = hi.active_material.node_tree
hi_bsdf = next(n for n in hm.nodes if n.type == "BSDF_PRINCIPLED")
out = next(n for n in hm.nodes if n.type == "OUTPUT_MATERIAL")
emit = hm.nodes.new("ShaderNodeEmission")


def source(socket):   # the image node feeding a BSDF input, through any separate/multiply nodes the importer placed
    node = socket.links[0].from_node
    while node.type != "TEX_IMAGE":
        node = next(i.links[0].from_node for i in node.inputs if i.is_linked)
    return node


hi_colour, hi_mr = source(hi_bsdf.inputs["Base Color"]), source(hi_bsdf.inputs["Roughness"])

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 1
bake = scene.render.bake
bake.use_selected_to_active = True
bake.cage_extrusion = height * 0.004
bake.max_ray_distance = height * 0.02
bake.margin = 8
bpy.ops.object.select_all(action="DESELECT")
hi.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active = low
for src, img in ((hi_colour, colour_img), (hi_mr, mr_img)):
    hm.links.new(src.outputs["Color"], emit.inputs["Color"])
    hm.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    for n in nt.nodes:
        n.select = False
    target = tc if img is colour_img else tm
    target.select = True
    nt.nodes.active = target
    bpy.ops.object.bake(type="EMIT")
    print(f"baked {img.name} {SIZE}px at {time.time() - t0:.0f}s", flush=True)

bpy.data.objects.remove(hi, do_unlink=True)
low.name = "Legionary"
os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_image_format="WEBP", export_image_quality=92, use_selection=False)
print(f"BAKED {SRC} {hi_tris} tris -> {DST} {low_tris} tris, maps {SIZE}, {time.time() - t0:.0f}s", flush=True)
