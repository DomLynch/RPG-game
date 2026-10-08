# Zone 1 scenery kit (Lead 2026-10-08, the Zone 1 quality plan): low-tri, instanceable props on ONE shared atlas. World scatters them (150-300 instances);
# this script only makes the meshes. Procedural, seeded, no downloads: every mesh is a few prisms or spheres, flat-shaded, coloured by UV into a 4x4 swatch atlas,
# with a vertex-colour darkening toward the base so a prop sits in the ground instead of floating. Origin = the base centre, +Y up (glTF), 1 unit = 1 m.
#   blender -b -P scripts/character/zone1_kit.py -- <out.glb> [atlas.png]
# Budget per piece (tris): tree <= 250, bush <= 160, boulder <= 100, tuft <= 40, landmark <= 1200 (camp, ruin arch, stone circle, grove: one node each, origin = the centre on the ground); the script prints each count and fails when one is over.
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
BUDGET = {"tree": 250, "bush": 160, "boulder": 100, "tuft": 40, "landmark": 1200}

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


def hnoise(co, seed):
    """A deterministic -1..1 hash of a position (no textures: the grain lives in the vertex colour)."""
    return math.modf(math.sin(co.x * 127.1 + co.y * 311.7 + co.z * 74.7 + seed * 19.3) * 43758.5453)[0]


GROUND = (.60, .49, .36)   # the terrain's dusty tan-brown: the base of every prop is pulled toward it so the kit sits in the ground's palette (Lead 2026-10-08)


def paint(bm, uv, col, faces, swatch, base_y=0.0, top_y=1.0, dark=0.55):
    u, v = swatch_uv(swatch)
    for f in faces:
        for loop in f.loops:
            loop[uv].uv = (u, v)
            co = loop.vert.co
            t = min(1.0, max(0.0, (co.z - base_y) / max(1e-6, top_y - base_y)))   # Blender Z up; the exporter turns it to Y up
            k = dark + (1 - dark) * t
            n, w = hnoise(co, 1) * .16, hnoise(co, 2) * .07   # grain: a brightness wobble per vertex plus a warm/cool drift, so a flat face is never one flat colour
            r, g, b = k * (1 + n + w), k * (1 + n), k * (1 + n - w)
            if t < .3:   # dust: the foot of a prop takes the ground's colour
                m = (1 - t / .3) * .4
                r, g, b = r + (GROUND[0] - r) * m, g + (GROUND[1] - g) * m, b + (GROUND[2] - b) * m
            loop[col] = (min(1, max(0, r)), min(1, max(0, g)), min(1, max(0, b)), 1.0)


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


# ---- the landmarks: composites of the same primitives on the same atlas, one node each, placed once by World ---------------------------

def put(bm, uv, col, make, off, rot=0.0):
    """Run a piece's make() then move what it added to `off` (x, y, z), turned `rot` about Z."""
    before = set(bm.verts)
    make(bm, uv, col)
    fresh = [v for v in bm.verts if v not in before]
    bmesh.ops.rotate(bm, verts=fresh, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(rot, 3, "Z"))
    bmesh.ops.translate(bm, verts=fresh, vec=off)


def box(bm, uv, col, c, hx, hy, hz, rot, swatch, base_y=0.0, top_y=1.0):
    """An axis-turned box (a crate): a 4-sided prism from c up hz, `hx` wide, turned `rot` about Z."""
    faces = prism(bm, (c[0], c[1], c[2]), (c[0], c[1], c[2] + hz), hx * 1.41, hx * 1.41, 4, rot + math.pi / 4)
    paint(bm, uv, col, faces, swatch, base_y, top_y, .6)
    return faces


def camp():
    """A camp that reads as one: an A-frame canvas tent with a dark doorway and ridge poles, a ring of stones round a crossed-log fire with a cook spit, two crates and a
    sack, and three log seats. About 30 x 15 px on a phone at 25 m, so the silhouette (tent peak, crossed logs, boxes) carries it."""
    def make(bm, uv, col):
        for i in range(8):   # fire ring
            a = 2 * math.pi * i / 8
            paint(bm, uv, col, blob(bm, (math.cos(a) * .8, math.sin(a) * .8, .12), (.22, .19, .15), 40 + i, 0, .2), "rock_dark" if i % 2 else "rock_warm", 0, .35, .6)
        paint(bm, uv, col, blob(bm, (0, 0, .03), (.6, .6, .06), 49, 0, .1), "soot", 0, .15, .9)
        paint(bm, uv, col, blob(bm, (.05, -.05, .08), (.2, .17, .06), 50, 0, .1), "ember_dim", 0, .15, 1)
        for i, a in enumerate((0.3, 2.4, 4.5)):   # three logs crossed over the embers
            c = Vector((math.cos(a) * .5, math.sin(a) * .5, .08)); e = Vector((-c.x, -c.y, .4))
            paint(bm, uv, col, prism(bm, c, e, .085, .08, 5, 0), "charcoal" if i % 2 else "bark_dark", 0, .5, .7)
        for sx in (-1.15, 1.15):   # the cook spit: two forked uprights and a pole across
            paint(bm, uv, col, prism(bm, (sx, 0, 0), (sx, 0, 1.05), .045, .035, 5, 0), "bark_dark", 0, 1.1, .6)
        paint(bm, uv, col, prism(bm, (-1.2, 0, 1.0), (1.2, 0, 1.0), .035, .035, 4, .8), "bark_ash", 0, 1.1, .8)
        for i, a in enumerate((.6, 2.7, 4.5)):   # log seats lying round the ring
            c = Vector((math.cos(a) * 1.8, math.sin(a) * 1.8, .0)); t = Vector((-math.sin(a), math.cos(a), 0)) * .55
            paint(bm, uv, col, prism(bm, c - t + Vector((0, 0, .17)), c + t + Vector((0, 0, .2)), .17, .16, 6, 0), "bark_dark", 0, .4, .6)
        # the tent (an A-frame 2.2 long, 1.9 wide, 1.5 high) behind the fire at +x
        ox, oy, L, Wd, H = 3.6, 0.0, 2.2, .95, 1.5
        y0, y1 = oy - L / 2, oy + L / 2
        v = lambda x, y, z: bm.verts.new((x, y, z))
        a0, a1, b0, b1, r0, r1 = v(ox - Wd, y0, 0), v(ox - Wd, y1, 0), v(ox + Wd, y0, 0), v(ox + Wd, y1, 0), v(ox, y0, H), v(ox, y1, H)
        paint(bm, uv, col, [bm.faces.new((a0, a1, r1, r0)), bm.faces.new((b0, b1, r1, r0))], "bone", 0, H, .7)   # the two canvas slopes
        paint(bm, uv, col, [bm.faces.new((a0, b0, r0))], "charcoal", 0, H, .8)   # the doorway: a dark triangle, so the tent has a mouth
        paint(bm, uv, col, [bm.faces.new((a1, b1, r1))], "bone", 0, H, .7)
        paint(bm, uv, col, prism(bm, (ox, y0 - .35, H + .02), (ox, y1 + .35, H + .02), .05, .045, 5, 0), "bark_dark", 0, H + .1, .8)
        for (px, py) in ((ox - Wd, y0), (ox + Wd, y0), (ox - Wd, y1), (ox + Wd, y1)):
            paint(bm, uv, col, prism(bm, (px, py, -.02), (px, py, .3), .03, .025, 4, 0), "bark_dark", 0, .4, .8)
        # two crates and a sack by the tent
        box(bm, uv, col, (1.9, 1.5, 0), .3, .3, .55, .3, "root", 0, .6)
        box(bm, uv, col, (2.35, 1.2, 0), .22, .22, .4, 1.0, "bark_ash", 0, .45)
        paint(bm, uv, col, blob(bm, (1.7, 1.0, .25), (.28, .24, .27), 55, 0, .15), "grass_pale", 0, .5, .7)
    return make


def ruin_arch():
    """Two fluted pillars (one snapped), a fallen lintel half and rubble: the broken arch of a road shrine."""
    def make(bm, uv, col):
        for sx, top in ((-1.5, 3.4), (1.5, 2.2)):
            paint(bm, uv, col, prism(bm, (sx, 0, -.05), (sx, 0, .4), .62, .55, 8, .2), "rock_dark", 0, .4, .5)   # the plinth
            paint(bm, uv, col, prism(bm, (sx, 0, .4), (sx, 0, top), .45, .4, 8, 0), "rock_light", 0, 3.4, .55)
        paint(bm, uv, col, prism(bm, (-1.7, 0, 3.4), (-.2, 0, 3.55), .34, .3, 4, .8), "rock_light", 0, 3.6, .75)   # the lintel stub still on the tall pillar
        paint(bm, uv, col, prism(bm, (1.2, 1.4, .3), (2.9, 1.9, .3), .33, .3, 4, .3), "rock_warm", 0, .6, .6)   # the fallen half
        for i, (x, y, r) in enumerate(((.2, .6, .38), (-.6, -.7, .3), (.9, -.5, .26), (2.3, 1.1, .34), (-2.4, .9, .27))):
            paint(bm, uv, col, blob(bm, (x, y, r * .5), (r, r * .9, r * .65), 60 + i, 0, .25), "rock_moss" if i % 2 else "rock_dark", 0, r, .6)
    return make


def stone_circle():
    """Nine tapering standing stones in a ring, leaning a little, and a low altar slab in the middle."""
    def make(bm, uv, col):
        rnd = random.Random(70)
        for i in range(9):
            a = 2 * math.pi * i / 9 + rnd.uniform(-.1, .1); h = rnd.uniform(1.6, 2.6)
            b = Vector((math.cos(a) * 3.2, math.sin(a) * 3.2, -.05)); lean = Vector((math.cos(a), math.sin(a), 0)) * rnd.uniform(-.2, .2)
            paint(bm, uv, col, prism(bm, b, b + Vector((0, 0, h)) + lean, .42, .26, 5, rnd.uniform(0, 1)), "rock_dark" if i % 3 else "rock_moss", 0, h, .5)
        paint(bm, uv, col, prism(bm, (0, 0, -.05), (0, 0, .5), 1.0, .9, 6, .3), "rock_warm", 0, .5, .6)
        paint(bm, uv, col, prism(bm, (0, 0, .5), (0, 0, .62), .9, .85, 6, .3), "ash_pale", 0, .62, .9)
    return make


def grove():
    """Three dead trees close together with scrub and tufts between them."""
    def make(bm, uv, col):
        put(bm, uv, col, tree(81, 5.4, .5, 4), (-1.5, .4, 0), .4); put(bm, uv, col, tree(82, 4.2, -.6, 4), (1.4, -.6, 0), 2.0); put(bm, uv, col, tree(83, 6.0, .2, 4), (.1, 1.9, 0), 4.0)
        put(bm, uv, col, bush(84, 1.1, 1), (.2, -1.8, 0)); put(bm, uv, col, bush(85, .9, 0), (-2.3, -.9, 0))
        for i, (x, y) in enumerate(((.9, .6), (-.7, -.4), (2.4, .5), (-1.2, 1.9))):
            put(bm, uv, col, tuft(90 + i, 14, .45), (x, y, 0))
    return make


PIECES = [
    ("tree_dead_a", "tree", tree(1, 5.0, .6, 5)), ("tree_dead_b", "tree", tree(2, 3.6, -.8, 4)), ("tree_dead_c", "tree", tree(3, 6.4, .3, 6)),
    ("bush_scrub_a", "bush", bush(11, 1.3, 0)), ("bush_scrub_b", "bush", bush(12, .95, 1)),
    ("boulder_a", "boulder", boulder(21, 1.0, .8, "rock_dark", "rock_light")), ("boulder_b", "boulder", boulder(22, .75, 1.0, "rock_dark", "rock_moss")), ("boulder_c", "boulder", boulder(23, 1.2, .65, "rock_dark", "rock_warm")),
    ("tuft_a", "tuft", tuft(31, 18, .55)), ("tuft_b", "tuft", tuft(32, 22, .35)),
    ("landmark_camp", "landmark", camp()), ("landmark_ruin_arch", "landmark", ruin_arch()), ("landmark_stone_circle", "landmark", stone_circle()), ("landmark_grove", "landmark", grove()),
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
    x += {"tuft": 1.2, "landmark": 9.0}.get(kind, 3.2)
    print(f"KIT {name:14s} {tris:4d} tris (budget {BUDGET[kind]})")
    if tris > BUDGET[kind]:
        raise SystemExit(f"{name} is over its budget: {tris} > {BUDGET[kind]}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True)
print("KIT-TOTAL", sum(counts.values()), "tris,", len(counts), "pieces ->", OUT)
