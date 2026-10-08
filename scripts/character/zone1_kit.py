# Zone 1 scenery kit (Lead 2026-10-08, the Zone 1 quality plan): low-tri, instanceable props on ONE shared atlas. World scatters them (150-300 instances);
# this script only makes the meshes. Procedural, seeded, no downloads: every mesh is a few prisms or spheres, flat-shaded, coloured by UV into a 4x4 swatch atlas,
# with a vertex-colour darkening toward the base so a prop sits in the ground instead of floating. Origin = the base centre, +Y up (glTF), 1 unit = 1 m.
#   blender -b -P scripts/character/zone1_kit.py -- <out.glb> [atlas.png]
# Budget per piece (tris): tree <= 250, bush <= 160, boulder <= 100, tuft <= 40; the script prints each count and fails when one is over.
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
ATLAS = argv[1] if len(argv) > 1 else os.path.splitext(OUT)[0] + "-atlas.png"
BUDGET = {"tree": 250, "bush": 160, "boulder": 100, "tuft": 40}

# The 4x4 swatch atlas: (name, rgb 0-255). A face's UV points at its swatch's centre.
SWATCHES = [
    ("bark_dark", (58, 46, 38)), ("bark_ash", (96, 86, 78)), ("charcoal", (34, 30, 28)), ("root", (88, 62, 44)),
    ("scrub_dry", (112, 108, 72)), ("scrub_olive", (84, 90, 58)), ("grass_tan", (150, 136, 92)), ("grass_pale", (176, 164, 118)),
    ("rock_light", (138, 132, 124)), ("rock_dark", (92, 88, 84)), ("rock_warm", (122, 104, 90)), ("rock_moss", (92, 100, 78)),
    ("soot", (24, 22, 22)), ("bone", (200, 190, 168)), ("ember_dim", (120, 52, 30)), ("ash_pale", (190, 184, 174)),
]
SW = {n: i for i, (n, _) in enumerate(SWATCHES)}


def make_atlas():
    size = 256
    img = bpy.data.images.new("zone1-kit-atlas", size, size, alpha=False)
    px = []
    for y in range(size):
        for x in range(size):
            _, c = SWATCHES[(y * 4 // size) * 4 + x * 4 // size]
            px += [c[0] / 255, c[1] / 255, c[2] / 255, 1.0]
    img.pixels = px
    img.filepath_raw = ATLAS
    img.file_format = "PNG"
    img.save()
    return img


def swatch_uv(name):
    i = SW[name]
    return ((i % 4) + 0.5) / 4, ((i // 4) + 0.5) / 4


def build(name, make):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.color.new("Col")
    make(bm, uv, col)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    return ob


def paint(bm, uv, col, faces, swatch, base_y=0.0, top_y=1.0, dark=0.55):
    u, v = swatch_uv(swatch)
    for f in faces:
        for loop in f.loops:
            loop[uv].uv = (u, v)
            t = min(1.0, max(0.0, (loop.vert.co.z - base_y) / max(1e-6, top_y - base_y)))   # Blender Z up; the exporter turns it to Y up
            k = dark + (1 - dark) * t
            loop[col] = (k, k, k, 1.0)


def prism(bm, base, top, r0, r1, sides, rot=0.0):
    """A tapered n-gon prism from point base to point top (capped on top, open at the bottom: it sits in the ground)."""
    base, top = Vector(base), Vector(top)
    axis = (top - base)
    h = axis.length
    q = Vector((0, 0, 1)).rotation_difference(axis.normalized())
    ring0, ring1 = [], []
    for i in range(sides):
        a = rot + 2 * math.pi * i / sides
        d = Vector((math.cos(a), math.sin(a), 0))
        ring0.append(bm.verts.new(base + q @ (d * r0)))
        ring1.append(bm.verts.new(base + q @ (d * r1 + Vector((0, 0, h)))))
    faces = [bm.faces.new((ring0[i], ring0[(i + 1) % sides], ring1[(i + 1) % sides], ring1[i])) for i in range(sides)]
    faces.append(bm.faces.new(list(reversed(ring1))))
    return faces


def blob(bm, centre, radii, seed, subdiv=0, jitter=0.18):
    """A squashed, jittered icosphere: subdiv 0 is 20 tris, 1 is 80."""
    rnd = random.Random(seed)
    res = bmesh.ops.create_icosphere(bm, subdivisions=subdiv + 1, radius=1.0)
    verts = res["verts"]
    for v in verts:
        k = 1 + rnd.uniform(-jitter, jitter)
        v.co = Vector((v.co.x * radii[0] * k, v.co.y * radii[1] * k, v.co.z * radii[2] * k)) + Vector(centre)
    fs = list({f for v in verts for f in v.link_faces})
    return fs


# ---- the pieces ------------------------------------------------------------------------------------------------------------------

def tree(seed, height, lean, branches):
    def make(bm, uv, col):
        rnd = random.Random(seed)
        mid = Vector((lean * height * .05, rnd.uniform(-.1, .1), height * .55))
        trunk_top = Vector((lean * height * .14, 0, height))
        main = "bark_ash" if seed % 2 else "bark_dark"
        fs = prism(bm, (0, 0, -0.05), mid, .36, .2, 7, rnd.uniform(0, 1))
        paint(bm, uv, col, fs, main, 0, height, .45)
        fs = prism(bm, mid, trunk_top, .2, .06, 7, rnd.uniform(0, 1))
        paint(bm, uv, col, fs, main, 0, height, .45)
        for i in range(branches):
            t = rnd.uniform(.4, .92)
            start = Vector((trunk_top.x * t, 0, height * t))
            a = rnd.uniform(0, 2 * math.pi) + i * 1.3
            L = height * rnd.uniform(.2, .36) * (1.2 - t * .55)
            end = start + Vector((math.cos(a) * L, math.sin(a) * L, L * rnd.uniform(.2, .75)))
            bf = prism(bm, start, end, .075, .022, 4, rnd.uniform(0, 1))
            paint(bm, uv, col, bf, "charcoal" if i % 3 == 0 else "bark_dark", 0, height, .7)
            if i % 2 == 0 and L > .8:   # a twig off the branch
                tw0 = start + (end - start) * .6
                tw1 = tw0 + Vector((math.cos(a + .9) * L * .4, math.sin(a + .9) * L * .4, L * .3))
                paint(bm, uv, col, prism(bm, tw0, tw1, .04, .015, 3, 0), "charcoal", 0, height, .7)
        # a few exposed roots, low and flat, so the trunk grips the ground
        for i in range(3):
            a = rnd.uniform(0, 2 * math.pi) + i * 2.1
            rf = prism(bm, (0, 0, .08), (math.cos(a) * .6, math.sin(a) * .6, .0), .12, .03, 3, 0)
            paint(bm, uv, col, rf, "root", 0, .3, .6)
    return make


def bush(seed, spread, dry):
    def make(bm, uv, col):
        rnd = random.Random(seed)
        n = rnd.randint(5, 7)
        for i in range(n):
            a = 2 * math.pi * i / n + rnd.uniform(-.3, .3)
            r = spread * rnd.uniform(.25, .7) * (0 if i == 0 else 1)
            sz = spread * rnd.uniform(.38, .55)
            fs = blob(bm, (math.cos(a) * r, math.sin(a) * r, sz * .55), (sz, sz, sz * .75), seed * 31 + i, 0, .25)
            paint(bm, uv, col, fs, "scrub_olive" if (dry + i) % 4 == 0 else ("grass_tan" if i % 3 == 0 else "scrub_dry"), 0, spread * .9, .5)
    return make


def boulder(seed, size, squash, swatch, top="rock_light"):
    def make(bm, uv, col):
        fs = blob(bm, (0, 0, size * squash * .45), (size, size * .9, size * squash), seed, 1, .22)
        bm.normal_update()
        paint(bm, uv, col, [f for f in fs if f.normal.z <= .45], swatch, 0, size * squash * 1.6, .6)
        paint(bm, uv, col, [f for f in fs if f.normal.z > .45], top, 0, size * squash * 1.6, .8)
    return make


def tuft(seed, blades, h):
    def make(bm, uv, col):
        rnd = random.Random(seed)
        for i in range(blades):
            a = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(.0, .12)
            lean = rnd.uniform(.08, .32) * h
            hh = h * rnd.uniform(.7, 1.1)
            c = Vector((math.cos(a) * r, math.sin(a) * r, 0))
            d = Vector((-math.sin(a), math.cos(a), 0)) * .035
            tip = c + Vector((math.cos(a + .5) * lean, math.sin(a + .5) * lean, hh))
            f = bm.faces.new((bm.verts.new(c - d), bm.verts.new(c + d), bm.verts.new(tip)))
            paint(bm, uv, col, [f], "grass_tan" if i % 2 else "grass_pale", 0, h, .55)
        # a double-sided look without a second face per blade: the material is double sided on export
    return make


PIECES = [
    ("tree_dead_a", "tree", tree(1, 5.0, .6, 5)), ("tree_dead_b", "tree", tree(2, 3.6, -.8, 4)), ("tree_dead_c", "tree", tree(3, 6.4, .3, 6)),
    ("bush_scrub_a", "bush", bush(11, 1.3, 0)), ("bush_scrub_b", "bush", bush(12, .95, 1)),
    ("boulder_a", "boulder", boulder(21, 1.1, .8, "rock_dark", "rock_light")), ("boulder_b", "boulder", boulder(22, .8, 1.0, "rock_warm", "ash_pale")), ("boulder_c", "boulder", boulder(23, 1.5, .65, "rock_dark", "rock_warm")),
    ("tuft_a", "tuft", tuft(31, 18, .55)), ("tuft_b", "tuft", tuft(32, 22, .35)),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
make_atlas()
mat = bpy.data.materials.new("zone1-kit")
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images["zone1-kit-atlas"]
tex.interpolation = "Closest"
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

counts = {}
x = 0.0
for name, kind, make in PIECES:
    ob = build(name, make)
    ob.data.materials.append(mat)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    counts[name] = tris
    ob.location.x = x
    x += 3.2 if kind != "tuft" else 1.2
    print(f"KIT {name:14s} {tris:4d} tris (budget {BUDGET[kind]})")
    if tris > BUDGET[kind]:
        raise SystemExit(f"{name} is over its budget: {tris} > {BUDGET[kind]}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True)
print("KIT-TOTAL", sum(counts.values()), "tris,", len(counts), "pieces ->", OUT)
