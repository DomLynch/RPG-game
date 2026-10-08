# Townspeople clothes layer (Lead 2026-10-08, plan A): a few low-tri garment meshes that ride the WARRIOR WORLD BODY'S OWN skeleton and clips (no new rig),
# on ONE small swatch atlas, so a townsperson is the world body + a choice of pieces + a tint (origins/preview/mob-looks.ts dressing). Procedural, no downloads.
# Each garment is its own skinned mesh node named `Cloth_<piece>`; the game shows or hides pieces per outfit. Weights are explicit per ring (nearest-body-vertex
# transfer tore the robe between the legs in Walk): the skirt blends pelvis into the thigh on its own side, a sleeve blends upperarm into lowerarm at the elbow.
#   blender -b -P scripts/character/town_clothes.py -- <warrior-world.glb> <out.glb> [atlas.png] [pieces: robe,sleeves,belt,cap]   (TOWN_FULL=1: body + clips kept, for renders)
# Budget per piece (tris): robe <= 260, sleeves <= 140, belt <= 60, cap <= 80; the script prints each count and fails when one is over.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
ATLAS = argv[2] if len(argv) > 2 else os.path.splitext(OUT)[0] + "-atlas.png"
PIECES = (argv[3] if len(argv) > 3 else "robe,sleeves,belt,cap").split(",")
BUDGET = {"robe": 260, "sleeves": 140, "belt": 60, "cap": 80}

# 4x4 swatches, near-neutral so the runtime tint (mob-looks) reads: (name, rgb)
SWATCHES = [
    ("cloth_main", (170, 160, 150)), ("cloth_trim", (210, 196, 150)), ("cloth_dark", (96, 88, 84)), ("leather", (110, 78, 52)),
    ("cloth_light", (222, 214, 200)), ("brass", (190, 150, 70)), ("felt", (120, 70, 64)), ("ink", (40, 36, 40)),
    ("", (128, 128, 128)), ("", (128, 128, 128)), ("", (128, 128, 128)), ("", (128, 128, 128)),
    ("", (128, 128, 128)), ("", (128, 128, 128)), ("", (128, 128, 128)), ("", (128, 128, 128)),
]
SW = {n: i for i, (n, _) in enumerate(SWATCHES) if n}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
for o in [o for o in bpy.data.objects if o.type == "MESH" and o is not body]:
    bpy.data.objects.remove(o, do_unlink=True)
W = body.matrix_world
bverts = [W @ v.co for v in body.data.vertices]


def make_atlas():
    size = 128
    img = bpy.data.images.new("town-clothes-atlas", size, size, alpha=False)
    px = []
    for y in range(size):
        for x in range(size):
            _, c = SWATCHES[(y * 4 // size) * 4 + x * 4 // size]
            px += [c[0] / 255, c[1] / 255, c[2] / 255, 1.0]
    img.pixels = px
    img.filepath_raw = ATLAS
    img.file_format = "PNG"
    img.save()


def uv_of(name):
    i = SW[name]
    return ((i % 4) + .5) / 4, ((i // 4) + .5) / 4


def section(z, half=.36):
    """Half-width (x) and half-depth (y) and centre y of the body's torso/legs cross-section at height z (arms excluded by |x| < half)."""
    pts = [v for v in bverts if abs(v.z - z) < .05 and abs(v.x) < half]
    if not pts:
        return .2, .14, 0.0
    return max(abs(v.x) for v in pts), (max(v.y for v in pts) - min(v.y for v in pts)) / 2, (max(v.y for v in pts) + min(v.y for v in pts)) / 2


def bone(name):
    b = arm.data.bones[name]
    return arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local


def new_mesh(name, build):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    build(bm, uv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return ob


def paint(bm, uv, faces, swatch):
    u, v = uv_of(swatch)
    for f in faces:
        for loop in f.loops:
            loop[uv].uv = (u, v)


def ring(bm, z, hx, hy, cy, sides, pad):
    return [bm.verts.new((math.cos(2 * math.pi * i / sides) * (hx + pad), cy + math.sin(2 * math.pi * i / sides) * (hy + pad), z)) for i in range(sides)]


def tube(bm, rings):
    faces = []
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        faces += [bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])) for i in range(n)]
    return faces


WEIGHTS = {}
LEFT = 1.0 if bone("thigh_l")[0].x > 0 else -1.0   # which side of x the left thigh is on


def robe_weights(co):
    z = co.z
    if z >= 1.38:
        return {"neck_01": .3, "spine_03": .7}
    if z >= 1.22:
        return {"spine_03": 1.0}
    if z >= 1.05:
        return {"spine_02": .5, "spine_01": .5}
    if z >= .86:
        k = (1.05 - z) / .19
        return {"spine_01": 1 - k, "pelvis": k}
    t = min(1.0, (.86 - z) / .76) * .7   # the hem follows the legs, but never all the way: it stays a skirt
    left = min(1.0, max(0.0, .5 + co.x * LEFT / .2))   # a smooth split between the two sides, no jump at x = 0
    return {"pelvis": 1 - t, "thigh_l": t * left, "thigh_r": t * (1 - left)}


def robe(bm, uv):
    """Neck-to-ankle robe: rings follow the body's own section (padded), a flare to the hem, open at neck and hem."""
    sides = 12
    levels = [(1.47, .035), (1.38, .07), (1.22, .06), (1.05, .05), (.86, .09), (.62, .15), (.36, .16), (.1, .18)]
    rings = []
    for z, pad in levels:
        hx, hy, cy = section(z)
        hx = .13 if z >= 1.45 else (min(max(hx, .17), .24) if z >= 1.3 else max(hx, .21))   # a close collar, shoulders no wider than the body's, a straight hang below
        rings.append(ring(bm, z, hx, max(hy, .1), cy, sides, pad))
        for v in rings[-1]:
            WEIGHTS[v.co.to_tuple()] = robe_weights(v.co)
    faces = tube(bm, rings)
    paint(bm, uv, faces[: sides * 3], "cloth_main")
    paint(bm, uv, faces[sides * 3:], "cloth_main")
    paint(bm, uv, faces[-sides:], "cloth_trim")   # a trimmed hem
    paint(bm, uv, faces[:sides], "cloth_trim")   # and collar


def sleeves(bm, uv):
    for side in ("l", "r"):
        a0, _ = bone(f"upperarm_{side}")
        _, a1 = bone(f"lowerarm_{side}")
        axis = (a1 - a0)
        n = axis.normalized()
        t = n.cross(Vector((0, 1, 0))).normalized()
        u = n.cross(t).normalized()
        rings = []
        for k, r in ((0, .1), (.25, .095), (.5, .09), (.75, .08), (1, .072)):
            c = a0 + axis * k
            rings.append([bm.verts.new(c + (t * math.cos(2 * math.pi * i / 8) + u * math.sin(2 * math.pi * i / 8)) * r) for i in range(8)])
            for v in rings[-1]:
                WEIGHTS[v.co.to_tuple()] = {f"upperarm_{side}": 1.0} if k <= .25 else ({f"upperarm_{side}": .5, f"lowerarm_{side}": .5} if k == .5 else {f"lowerarm_{side}": 1.0})
        faces = tube(bm, rings)
        paint(bm, uv, faces, "cloth_main")
        paint(bm, uv, faces[-8:], "cloth_trim")


def belt(bm, uv):
    hx, hy, cy = section(1.0)
    r = ring(bm, .98, hx, hy, cy, 12, .07), ring(bm, 1.05, hx, hy, cy, 12, .07)
    for rr in r:
        for v in rr:
            WEIGHTS[v.co.to_tuple()] = {"pelvis": .5, "spine_01": .5}
    paint(bm, uv, tube(bm, list(r)), "leather")


def cap(bm, uv):
    h0, _ = bone("Head")
    c = h0 + Vector((0, 0, .11))
    sides = 10
    rings = []
    for z, r in ((.0, .125), (.06, .12), (.11, .085), (.15, .03)):
        rings.append([bm.verts.new((c.x + math.cos(2 * math.pi * i / sides) * r, c.y + math.sin(2 * math.pi * i / sides) * r * 1.05, c.z + z)) for i in range(sides)])
        for v in rings[-1]:
            WEIGHTS[v.co.to_tuple()] = {"Head": 1.0}
    faces = tube(bm, rings)
    paint(bm, uv, faces, "felt")
    paint(bm, uv, faces[:sides], "cloth_dark")


MAKERS = {"robe": robe, "sleeves": sleeves, "belt": belt, "cap": cap}
make_atlas()
mat = bpy.data.materials.new("TownClothes")
mat.use_nodes = True
mat.use_backface_culling = False
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images["town-clothes-atlas"]
tex.interpolation = "Closest"
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = .95
bsdf.inputs["Metallic"].default_value = 0.0
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

counts = {}
for piece in PIECES:
    ob = new_mesh(f"Cloth_{piece}", MAKERS[piece])
    ob.data.materials.append(mat)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    counts[piece] = tris
    print(f"CLOTHES {piece:8s} {tris:4d} tris (budget {BUDGET[piece]})")
    if tris > BUDGET[piece]:
        raise SystemExit(f"{piece} is over its budget: {tris} > {BUDGET[piece]}")
    # skin it: the explicit per-ring weights recorded when the vertex was made (keyed by its position)
    for g in {g for w in WEIGHTS.values() for g in w}:
        if g not in ob.vertex_groups:
            ob.vertex_groups.new(name=g)
    for v in ob.data.vertices:
        for g, wt in WEIGHTS[v.co.to_tuple()].items():
            if wt > 0:
                ob.vertex_groups[g].add([v.index], wt, "REPLACE")
    ob.parent = arm
    m = ob.modifiers.new("Armature", "ARMATURE")
    m.object = arm
# The shipped file is the CLOTHES ONLY: the garments plus the armature's joint names (the game skins them onto the warrior world body's own skeleton by bone name),
# no body mesh, no clips. TOWN_FULL=1 keeps the body and the clips for the preview renders.
full = os.environ.get("TOWN_FULL") == "1"
if not full:
    bpy.data.objects.remove(body, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=False, export_animations=full, export_skins=True, export_yup=True)
print("CLOTHES-TOTAL", sum(counts.values()), "tris,", len(counts), "pieces ->", OUT)
