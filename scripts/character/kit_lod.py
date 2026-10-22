# Kit LOD (Lead 2026-10-22, phone speed: the goblin camp pieces are 78 % of a Zone 1 fight frame, every instance at full detail in the main AND the shadow pass).
# The static-mesh twin of world_body.py: take one kit file (public/world/kit/<piece>.glb: one node, one mesh, one atlas material), decimate the mesh to a far body of about 1-1.5k tris,
# unwrap fresh, bake the source's base colour into ONE small atlas through Emission (copied, not relit), export the SAME node name so the data row (building-skins.json models[].lod)
# can swap the file without a code literal. No armature, no animation. The far body is for instances beyond the row's `dist`; near ones keep the full file.
#   blender -b -P scripts/character/kit_lod.py -- <kit.glb> <out.glb> [tris 1200] [size 512]
# The source must not carry an explicit meshopt `filter: NONE` (Blender 5.2.2 importer bug): run /opt/blender/normalize-meshopt-default.py on it first.
# KIT_REMESH=<voxel size, fraction of the largest extent> remeshes to a watertight volume before decimating (thin or open parts survive; widen BAKE_CAGE / BAKE_RAY to about 1.5-2x it).
# BAKE_FMT=WEBP|PNG, BAKE_CAGE / BAKE_RAY=<fraction of the piece's height> for the bake cage and max ray distance (default 0.005 / 0.01: narrow, so a ray never reaches through a gap
# between planks and bakes what is behind it; the Nightborn world body flecks taught that, PR 3569).
import os
import sys
import time

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = argv[0], argv[1]
TRIS = int(argv[2]) if len(argv) > 2 else 1200
SIZE = int(argv[3]) if len(argv) > 3 else 512
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit(f"kit_lod: no mesh in {SRC}")
meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
node_name = meshes[0].name   # the glTF node name the row and the renderer look the piece up by
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
hi = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
hi_tris = sum(len(p.vertices) - 2 for p in hi.data.polygons)
height = max(hi.dimensions)   # a kit piece may lie on any axis once imported (Blender is Z-up): its largest extent is the scale of the bake distances

src_mat = hi.data.materials[0] if hi.data.materials else None
rough, metal = 0.8, 0.0
if src_mat is not None and src_mat.use_nodes:
    pb = next((n for n in src_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if pb is not None:
        rough, metal = float(pb.inputs["Roughness"].default_value), float(pb.inputs["Metallic"].default_value)

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
    low.modifiers.remove(m)
REMESH = float(os.environ.get("KIT_REMESH", "0"))   # voxel size as a fraction of the piece's largest extent; 0 = off
if REMESH > 0:
    # Plain collapse shreds thin or open parts (thatch fringes, loose planks, horns) into stretched black shards. A voxel remesh first turns the piece into one watertight volume,
    # so the decimation below works on a clean surface and the silhouette survives; the colour is still baked from the untouched hi mesh (cage widened to cover the voxel offset).
    rm = low.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = height * REMESH
    rm.adaptivity = 0.0
    bpy.ops.object.modifier_apply(modifier="Remesh")
    print(f"remeshed to {sum(len(p.vertices) - 2 for p in low.data.polygons)} tris at voxel {rm.voxel_size if False else height * REMESH:.3f} m", flush=True)
mod = low.modifiers.new("Reduce", "DECIMATE")
mod.ratio = min(1.0, TRIS / hi_tris)
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="Reduce")
try:
    bpy.ops.object.shade_smooth_by_angle(angle=0.7)   # planks and roofs keep their hard edges, curved posts and skulls stay round
except Exception:
    bpy.ops.object.shade_smooth()
low.data.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.008, area_weight=1.0)
bpy.ops.uv.pack_islands(margin=0.008)
bpy.ops.object.mode_set(mode="OBJECT")
low_tris = sum(len(p.vertices) - 2 for p in low.data.polygons)

img = bpy.data.images.new("KitColour", SIZE, SIZE, alpha=False)
img.colorspace_settings.name = "sRGB"
mat = bpy.data.materials.new("KitLod")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = rough
bsdf.inputs["Metallic"].default_value = metal
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
bake.cage_extrusion = height * float(os.environ.get("BAKE_CAGE", "0.005"))
bake.max_ray_distance = height * float(os.environ.get("BAKE_RAY", "0.01"))
bake.margin = 4
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

bpy.data.objects.remove(hi, do_unlink=True)
low.name = node_name
low.data.name = node_name
os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_image_format=os.environ.get("BAKE_FMT", "WEBP"), export_image_quality=85,
                          export_animations=False, use_selection=False)
print(f"KIT-LOD {SRC} {hi_tris} tris -> {DST} {low_tris} tris, atlas {SIZE}, node {node_name}, {time.time() - t0:.0f}s", flush=True)
