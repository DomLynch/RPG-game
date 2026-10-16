# Add a hand-modelled row of sharpened stakes to the TRELLIS barricade node `goblin_spikes` in the fort kit glb: two interleaved rows of tapered cones leaning forward and back, one extra mesh
# merged into the node (same material, same node name), so the barricade reads as a row of spears. TRELLIS loses thin stakes in decimation; a cone is 16 tris and cannot.
#   blender -b -P scripts/character/goblin_stakes_add.py -- <kit.glb in> <kit.glb out> [stakes per row]
# The stakes take one UV point sampled from a post of the barricade (the median-brightness texel, plain weathered wood) and the kit's vertex colour, so no new texture and no new program.
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
KIT_IN, OUT = argv[0], argv[1]
N = int(argv[2]) if len(argv) > 2 else 10

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KIT_IN)
ob = bpy.data.objects["goblin_spikes"]
me = ob.data
bm = bmesh.new()
bm.from_mesh(me)
uv = bm.loops.layers.uv.active
col = bm.loops.layers.color.get("Col")

# a plain-wood texel: among loops on the barricade's posts (outer x, mid height), the one whose texel brightness is the median
img = None
for m in me.materials:
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                img = n.image
w, h = img.size
px = list(img.pixels)
cands = []
for f in bm.faces:
    for lp in f.loops:
        v = lp.vert.co
        if abs(v.x) > 0.4 and 0.3 < v.z < 1.0:
            u = lp[uv].uv
            ix, iy = min(w - 1, max(0, int(u.x * w))), min(h - 1, max(0, int(u.y * h)))
            i = (iy * w + ix) * 4
            cands.append((px[i] + px[i + 1] + px[i + 2], u.copy()))
cands.sort(key=lambda c: c[0])
UV0 = cands[len(cands) * 4 // 5][1] if cands else Vector((0.5, 0.5))   # the 80th percentile, not the median: the median texel was near-black and the stakes rendered black

first_new = len(bm.faces)
for row, lean in ((0, 0.45), (1, -0.45)):
    for i in range(N):
        x = -0.5 + i * (1.0 / (N - 1)) + (0.05 if row else 0.0)
        jitter = ((i * 37 + row * 11) % 7 - 3) * 0.015
        base = Vector((x, -0.05 * lean, 0.15 + 0.08 * row + 0.02 * (i % 3)))
        d = Vector((jitter, lean, 0.9)).normalized()
        length = 1.2 + 0.08 * ((i + row) % 3)
        rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        mat = Matrix.Translation(base + d * (length / 2)) @ rot
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=8, radius1=0.04, radius2=0.004, depth=length, matrix=mat, calc_uvs=False)
for f in bm.faces[first_new:]:
    for lp in f.loops:
        lp[uv].uv = UV0
        if col is not None:
            lp[col] = (0.85, 0.82, 0.78, 1.0)
bm.to_mesh(me)
bm.free()
tris = sum(len(p.vertices) - 2 for p in me.polygons)
print(f"STAKES added {2 * N} stakes; spikes node now {tris} tris; uv0 {UV0.x:.2f},{UV0.y:.2f}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True, export_image_format="JPEG", export_image_quality=88)
print("STAKES-OUT", OUT)
