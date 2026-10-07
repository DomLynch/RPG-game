# World body (Lead 2026-10-07, Dom's phone test: the Origins preview lags and goes black on an iPhone 15 because every world creature is the full
# duel GLB: goblin.glb is 62k tris and 34 textures). One cheap body per kind, generated in a batch from the duel GLB itself so the rig and the
# clip names stay identical: the world plays idle/walk on it and the duel GLB loads only when the fight starts.
# Steps: drop the carried weapons, join the skinned body meshes, decimate on geometry (vertex-group weights follow the collapse), unwrap fresh,
# bake every source material's base colour into ONE atlas through Emission (copied, not relit), export the armature and actions untouched.
#   blender -b -P scripts/character/world_body.py -- <duel.glb> <out.glb> [tris 8000] [size 1024]
# BAKE_DROP=<comma list of material-name prefixes to drop> (default Weapon), BAKE_FMT=WEBP|PNG, BAKE_LIFT=<gamma> as in herolook_bake.py.
import os
import sys
import time

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = argv[0], argv[1]
TRIS = int(argv[2]) if len(argv) > 2 else 8000
SIZE = int(argv[3]) if len(argv) > 3 else 1024
DROP = tuple(os.environ.get("BAKE_DROP", "Weapon").split(","))
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]
for o in meshes:   # carried weapons are not part of the world body
    if o.data.materials and all((m.name if m else "").startswith(DROP) for m in o.data.materials):
        bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in scene.objects if o.type == "MESH"]
arm = next(o for o in scene.objects if o.type == "ARMATURE")
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
hi = bpy.context.view_layer.objects.active
hi_tris = sum(len(p.vertices) - 2 for p in hi.data.polygons)
height = hi.dimensions.z

low = hi.copy()
low.data = hi.data.copy()
low.name = "Low"
scene.collection.objects.link(low)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = low
low.select_set(True)
while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.materials.clear()
for m in list(low.modifiers):
    if m.type != "ARMATURE":
        low.modifiers.remove(m)
mod = low.modifiers.new("Reduce", "DECIMATE")
mod.ratio = min(1.0, TRIS / hi_tris)
mod.use_collapse_triangulate = True
# Armature last in the stack would deform before the collapse: apply the decimate first by moving it to the top.
bpy.ops.object.modifier_move_to_index(modifier="Reduce", index=0)
bpy.ops.object.modifier_apply(modifier="Reduce")
bpy.ops.object.shade_smooth()
low.data.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004, area_weight=1.0)
bpy.ops.uv.pack_islands(margin=0.004)
bpy.ops.object.mode_set(mode="OBJECT")
low_tris = sum(len(p.vertices) - 2 for p in low.data.polygons)

img = bpy.data.images.new("WorldColour", SIZE, SIZE, alpha=False)
img.colorspace_settings.name = "sRGB"
mat = bpy.data.materials.new("WorldBody")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.8
bsdf.inputs["Metallic"].default_value = 0.0
low.data.materials.append(mat)

# Every source material: route its base colour (image or flat value) through Emission so the bake copies it.
for m in hi.data.materials:
    if m is None or not m.use_nodes:
        continue
    t = m.node_tree
    b = next((n for n in t.nodes if n.type == "BSDF_PRINCIPLED"), None)
    out = next(n for n in t.nodes if n.type == "OUTPUT_MATERIAL")
    if b is None:
        continue
    e = t.nodes.new("ShaderNodeEmission")
    sock = b.inputs["Base Color"]
    if sock.is_linked:
        t.links.new(sock.links[0].from_socket, e.inputs["Color"])
    else:
        e.inputs["Color"].default_value = sock.default_value
    t.links.new(e.outputs["Emission"], out.inputs["Surface"])

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 1
bake = scene.render.bake
bake.use_selected_to_active = True
bake.cage_extrusion = height * 0.01
bake.max_ray_distance = height * 0.03
bake.margin = 6
bpy.ops.object.select_all(action="DESELECT")
hi.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active = low
for n in nt.nodes:
    n.select = False
tex.select = True
nt.nodes.active = tex
bpy.ops.object.bake(type="EMIT")
print(f"baked {SIZE}px at {time.time() - t0:.0f}s", flush=True)

lift = float(os.environ.get("BAKE_LIFT", "1"))
if lift != 1:
    import numpy as np
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    px[:, :3] = np.clip(px[:, :3], 0, 1) ** (1 / lift)
    img.pixels = px.ravel().tolist()
bpy.data.objects.remove(hi, do_unlink=True)
low.name = os.path.splitext(os.path.basename(DST))[0]
low.parent = arm
os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_image_format=os.environ.get("BAKE_FMT", "WEBP"), export_image_quality=90,
                          export_animation_mode="ACTIONS", export_force_sampling=False, use_selection=False)
print(f"WORLD-BODY {SRC} {hi_tris} tris -> {DST} {low_tris} tris, atlas {SIZE}, {time.time() - t0:.0f}s", flush=True)
