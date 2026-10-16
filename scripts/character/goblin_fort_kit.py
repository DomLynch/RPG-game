# The goblin fort kit (Dom's two reference pictures, 2026-10-16: an orc palisade fort with horns, skulls, spikes and an orange banner; a bone-and-skull cave camp with lanterns and hide tents). Strategy's written GO: main-game assets for Zone 1's goblin camps,
# the Test Zone (zone 90) is the first consumer. Names follow docs/briefs/goblin-camp-props.md (`goblin_palisade_a/b`, `goblin_totem`, `goblin_banner`) plus the gate, spikes, lantern, hut and tower.
# Same recipe as zone1_kit.py (one material, a 4x4 swatch atlas, vertex-colour grain, flat shading, procedural, seeded, no downloads), so the pieces draw with the SAME material features (map + vertex colour, double-sided) and compile no new render program.
#   blender -b -P scripts/character/goblin_fort_kit.py -- <out.glb> [atlas.png]
# Origin = the prop's ground centre, +Y up (glTF), 1 unit = 1 m, local +X along a wall's length, the gate's passage and the hut's door face +Y of the glTF (-Z Blender front is the exporter's business: every piece is authored facing Blender -Y, which is glTF +Z).
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
ATLAS = argv[1] if len(argv) > 1 else os.path.splitext(OUT)[0] + "-atlas.png"
BUDGET = {"wall": 700, "gate": 1000, "totem": 600, "spikes": 220, "banner": 300, "lantern": 320, "hut": 1000, "tower": 1300}

SWATCHES = [
    ("plank_dark", (72, 52, 38)), ("plank_mid", (108, 78, 52)), ("plank_light", (142, 106, 74)), ("rope", (146, 120, 80)),
    ("hide", (86, 66, 52)), ("hide_dark", (50, 40, 34)), ("bone", (206, 196, 172)), ("bone_dark", (150, 140, 118)),
    ("iron", (96, 100, 106)), ("iron_dark", (52, 54, 58)), ("banner", (214, 98, 34)), ("banner_dark", (122, 42, 22)),
    ("glow", (255, 176, 74)), ("soot", (24, 22, 22)), ("rock_dark", (92, 88, 84)), ("rock_warm", (122, 104, 90)),
]
SW = {n: i for i, (n, _) in enumerate(SWATCHES)}
GROUND = (.60, .49, .36)


def make_atlas():
    size = 256
    img = bpy.data.images.new("goblin-fort-kit-atlas", size, size, alpha=False)
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
    return math.modf(math.sin(co.x * 127.1 + co.y * 311.7 + co.z * 74.7 + seed * 19.3) * 43758.5453)[0]


def paint(bm, uv, col, faces, swatch, base_z=0.0, top_z=1.0, dark=0.6, glow=False):
    u, v = swatch_uv(swatch)
    for f in faces:
        for loop in f.loops:
            loop[uv].uv = (u, v)
            co = loop.vert.co
            t = min(1.0, max(0.0, (co.z - base_z) / max(1e-6, top_z - base_z)))
            k = 1.0 if glow else dark + (1 - dark) * t
            n, w = hnoise(co, 1) * (0 if glow else .14), hnoise(co, 2) * (0 if glow else .06)
            r, g, b = k * (1 + n + w), k * (1 + n), k * (1 + n - w)
            if t < .25 and not glow:   # dust at the foot
                m = (1 - t / .25) * .35
                r, g, b = r + (GROUND[0] - r) * m, g + (GROUND[1] - g) * m, b + (GROUND[2] - b) * m
            loop[col] = (min(1, max(0, r)), min(1, max(0, g)), min(1, max(0, b)), 1.0)


def prism(bm, base, top, r0, r1, sides, rot=0.0):
    base, top = Vector(base), Vector(top)
    axis = top - base
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


def blob(bm, centre, radii, seed, subdiv=0, jitter=0.12):
    rnd = random.Random(seed)
    res = bmesh.ops.create_icosphere(bm, subdivisions=subdiv + 1, radius=1.0)
    verts = res["verts"]
    for v in verts:
        k = 1 + rnd.uniform(-jitter, jitter)
        v.co = Vector((v.co.x * radii[0] * k, v.co.y * radii[1] * k, v.co.z * radii[2] * k)) + Vector(centre)
    return list({f for v in verts for f in v.link_faces})


def put(bm, uv, col, make, off, rot=0.0):
    before = set(bm.verts)
    make(bm, uv, col)
    fresh = [v for v in bm.verts if v not in before]
    bmesh.ops.rotate(bm, verts=fresh, cent=(0, 0, 0), matrix=Matrix.Rotation(rot, 3, "Z"))
    bmesh.ops.translate(bm, verts=fresh, vec=off)


def beam(bm, uv, col, a, b, r, swatch, top_z=4.0, sides=4, dark=.6):
    return paint(bm, uv, col, prism(bm, a, b, r, r * .92, sides, .6), swatch, 0, top_z, dark) or None


def stake(bm, uv, col, x, y, height, lean=(0, 0), r=.07, swatch="plank_mid", top_z=3.0):
    """A sharpened log: a 5-sided prism that tapers to a point."""
    paint(bm, uv, col, prism(bm, (x, y, -.08), (x + lean[0], y + lean[1], height), r, .012, 5, x * 3.1), swatch, 0, top_z, .5)


def horn(bm, uv, col, base, direction, length, r=.07, curl=.6):
    """A bone horn: three tapering segments that bend up by `curl` (radians) per segment."""
    p = Vector(base)
    d = Vector(direction).normalized()
    for i in range(3):
        seg = length / 3
        bend = Vector((0, 0, 1)) * math.sin(curl * (i + 1)) * .5
        d = (d + bend).normalized()
        q = p + d * seg
        paint(bm, uv, col, prism(bm, p, q, r * (1 - i * .28), r * (1 - (i + 1) * .28) + .008, 5, 0), "bone", 0, 4.0, .85)
        p = q


def skull(bm, uv, col, c, scale, seed, face=(0, -1, 0)):
    """A cranium blob, a jaw, and two dark eye sockets on the `face` side: reads as a skull from 20 m."""
    s = scale
    f = Vector(face).normalized()
    paint(bm, uv, col, blob(bm, c, (.13 * s, .15 * s, .12 * s), seed, 0, .08), "bone", c[2] - .15, c[2] + .15, .9)
    jaw = Vector(c) + f * .07 * s + Vector((0, 0, -.1 * s))
    paint(bm, uv, col, blob(bm, jaw, (.08 * s, .07 * s, .05 * s), seed + 1, 0, .05), "bone_dark", c[2] - .15, c[2] + .15, .9)
    side = Vector((-f.y, f.x, 0))
    for sgn in (-1, 1):
        eye = Vector(c) + f * .1 * s + side * sgn * .05 * s + Vector((0, 0, .015 * s))
        paint(bm, uv, col, blob(bm, eye, (.035 * s, .03 * s, .035 * s), seed + 2 + sgn, 0, .02), "soot", 0, 1, 1.0)


def rock(bm, uv, col, c, r, seed, swatch="rock_dark"):
    paint(bm, uv, col, blob(bm, (c[0], c[1], c[2] + r * .4), (r, r * .9, r * .65), seed, 0, .22), swatch, 0, r * 1.5, .6)


# ---- the pieces -------------------------------------------------------------------------------------------------------------------

def wall(variant):
    """A 5 m palisade run along +X: sharpened logs of uneven height, two lashed crossbars; b adds a skull on a taller stake and a leaning brace; c a row of out-leaning spikes at the foot."""
    def make(bm, uv, col):
        rnd = random.Random(100 + variant)
        n = 11
        for i in range(n):
            x = -2.5 + 5.0 * i / (n - 1)
            h = rnd.uniform(2.1, 2.8) + (.4 if (variant == 1 and i == 5) else 0)
            stake(bm, uv, col, x, rnd.uniform(-.04, .04), h, (rnd.uniform(-.05, .05), rnd.uniform(-.04, .04)), .075 + rnd.uniform(0, .02), "plank_dark" if i % 3 == 0 else ("plank_mid" if i % 3 == 1 else "plank_light"), 2.8)
        for z in (.7, 1.65):   # the lashed crossbars, behind the logs
            paint(bm, uv, col, prism(bm, (-2.6, .11, z), (2.6, .11, z + .03), .05, .05, 4, .8), "plank_dark", 0, 2.8, .7)
            for i in range(0, n, 2):   # a rope lashing at every second log
                x = -2.5 + 5.0 * i / (n - 1)
                paint(bm, uv, col, prism(bm, (x, 0, z - .06), (x, 0, z + .09), .1, .1, 5, 0), "rope", 0, 2.8, .85)
        if variant == 1:
            skull(bm, uv, col, (0.0, -.12, 3.05), 1.0, 130, (0, -1, 0))
            paint(bm, uv, col, prism(bm, (1.6, .6, -.05), (1.1, .1, 1.7), .06, .045, 4, 0), "plank_dark", 0, 2.8, .7)   # a brace
            paint(bm, uv, col, prism(bm, (-1.6, .6, -.05), (-1.1, .1, 1.7), .06, .045, 4, 0), "plank_dark", 0, 2.8, .7)
        if variant == 2:
            for i in range(6):
                x = -2.3 + i * .92
                stake(bm, uv, col, x, -.28, .85, (0, -.45), .05, "plank_light", 1.0)
    return make


def gate():
    """Two stout towers either side of a 2 m passage, a lintel with a skull and a crossed pair of horns, two short wings of palisade, an iron-banded crest."""
    def make(bm, uv, col):
        for sx in (-1.45, 1.45):
            paint(bm, uv, col, prism(bm, (sx, 0, -.08), (sx, 0, 3.6), .32, .26, 6, .3), "plank_dark", 0, 3.6, .5)
            for z in (1.0, 2.4):   # iron bands
                paint(bm, uv, col, prism(bm, (sx, 0, z), (sx, 0, z + .14), .35, .35, 6, .3), "iron", 0, 3.6, .8)
            paint(bm, uv, col, prism(bm, (sx, 0, 3.55), (sx, 0, 4.35), .22, .01, 6, .3), "plank_mid", 0, 4.4, .8)   # the sharpened cap
        paint(bm, uv, col, prism(bm, (-1.8, 0, 3.05), (1.8, 0, 3.05), .17, .17, 4, .8), "plank_mid", 0, 3.6, .7)   # lintel
        paint(bm, uv, col, prism(bm, (-1.8, 0, 3.4), (1.8, 0, 3.4), .09, .09, 4, .8), "plank_dark", 0, 3.6, .7)
        skull(bm, uv, col, (0, -.2, 3.45), 1.6, 140)
        for sgn in (-1, 1):
            horn(bm, uv, col, (sgn * .15, -.2, 3.62), (sgn * 1.0, -.2, .35), 1.0, .08, .55)
        for sgn in (-1, 1):   # the wings of palisade
            for i in range(6):
                x = sgn * (1.95 + i * .27)
                stake(bm, uv, col, x, 0, 2.1 + (i % 3) * .2 - i * .04, (0, 0), .075, "plank_mid" if i % 2 else "plank_dark", 2.6)
        for z in (.6, 1.5):
            paint(bm, uv, col, prism(bm, (-3.7, .1, z), (-1.75, .1, z), .045, .045, 4, .8), "plank_dark", 0, 3, .7)
            paint(bm, uv, col, prism(bm, (1.75, .1, z), (3.7, .1, z), .045, .045, 4, .8), "plank_dark", 0, 3, .7)
        for sx in (-1.45, 1.45):   # a few stones at each foot
            rock(bm, uv, col, (sx + .3, -.4, 0), .3, 150 + int(sx * 10))
    return make


def totem():
    """A skull totem: a 3 m pole, three skulls stacked and shrinking, a horned crest at the top, crossbars hung with bones, a ring of rocks at the foot."""
    def make(bm, uv, col):
        paint(bm, uv, col, prism(bm, (0, 0, -.08), (0, 0, 3.1), .13, .1, 7, .2), "plank_dark", 0, 3.4, .5)
        for i, (z, s) in enumerate(((1.0, 1.1), (1.55, .95), (2.05, .8))):
            skull(bm, uv, col, (0, -.14, z), s, 160 + i * 5)
        skull(bm, uv, col, (0, -.14, 2.8), 1.5, 175)
        for sgn in (-1, 1):
            horn(bm, uv, col, (sgn * .14, -.12, 2.92), (sgn * 1.0, -.1, .3), .9, .075, .6)
        paint(bm, uv, col, prism(bm, (-.7, 0, 1.3), (.7, 0, 1.3), .04, .04, 4, .8), "plank_mid", 0, 3.4, .7)   # a crossbar hung with bones
        for sx in (-.6, -.2, .2, .6):
            paint(bm, uv, col, prism(bm, (sx, -.04, 1.28), (sx + .02, -.04, .95 - abs(sx) * .2), .025, .018, 4, 0), "bone", 0, 3.4, .85)
        for i in range(5):
            a = 2 * math.pi * i / 5
            rock(bm, uv, col, (math.cos(a) * .35, math.sin(a) * .35, 0), .17 + (i % 2) * .05, 180 + i)
    return make


def spikes():
    """A cluster of seven sharpened stakes leaning out of a lashed foot of rocks: a caltrop heap, the camp's fence in the open."""
    def make(bm, uv, col):
        rnd = random.Random(200)
        for i in range(7):
            a = 2 * math.pi * i / 7 + rnd.uniform(-.2, .2)
            lean = .45 + rnd.uniform(0, .2)
            stake(bm, uv, col, math.cos(a) * .12, math.sin(a) * .12, rnd.uniform(.95, 1.5), (math.cos(a) * lean, math.sin(a) * lean), .055, "plank_light" if i % 2 else "plank_mid", 1.5)
        paint(bm, uv, col, prism(bm, (0, 0, .22), (0, 0, .3), .22, .21, 7, 0), "rope", 0, .4, .9)
        for i in range(4):
            a = 2 * math.pi * i / 4 + .4
            rock(bm, uv, col, (math.cos(a) * .3, math.sin(a) * .3, 0), .15 + (i % 2) * .05, 210 + i)
    return make


def banner():
    """A tall pole with a crossbar, a torn orange war cloth hanging from it with a dark sigil, and a skull finial."""
    def make(bm, uv, col):
        paint(bm, uv, col, prism(bm, (0, 0, -.08), (0, 0, 3.4), .07, .05, 6, .1), "plank_dark", 0, 3.4, .5)
        paint(bm, uv, col, prism(bm, (-.55, 0, 3.0), (.55, 0, 3.02), .04, .04, 4, .8), "plank_mid", 0, 3.4, .7)
        skull(bm, uv, col, (0, -.03, 3.5), .8, 230)
        # the cloth: five strips, each a quad, zig-zagged in depth so it reads as hanging cloth from the side
        def v(x, y, z):
            return bm.verts.new((x, y, z))

        xs = [-.5 + i * .25 for i in range(5)]
        top = 2.96
        for i in range(4):
            drop = 1.55 - (.35 if i == 1 else 0) - (.55 if i == 3 else 0)
            y0, y1 = (.04 if i % 2 else -.04), (-.04 if i % 2 else .04)
            f = bm.faces.new((v(xs[i], y0, top), v(xs[i + 1], y1, top), v(xs[i + 1], y1, top - drop), v(xs[i], y0, top - drop)))
            paint(bm, uv, col, [f], "banner", top - 1.6, top, .55)
        for x in (xs[1], xs[2], xs[3]):   # a diamond sigil, three quads in the dark red
            pass
        sig = [bm.faces.new((v(-.12, -.06, 2.2), v(.12, -.06, 2.2), v(.12, -.06, 1.95), v(-.12, -.06, 1.95)))]
        paint(bm, uv, col, sig, "banner_dark", top - 1.6, top, .8)
        for sgn in (-1, 1):   # torn tails
            f = bm.faces.new((v(sgn * .5, 0, top), v(sgn * .5, 0, top - .7), v(sgn * .62, .05, top - .35)))
            paint(bm, uv, col, [f], "banner_dark", top - 1.6, top, .7)
        for i in range(4):
            a = 2 * math.pi * i / 4
            rock(bm, uv, col, (math.cos(a) * .2, math.sin(a) * .2, 0), .13, 240 + i)
    return make


def lantern():
    """A bone lantern on a leaning post: a hooked arm, a short chain, a six-sided bone cage round a bright core, a skull on the post."""
    def make(bm, uv, col):
        paint(bm, uv, col, prism(bm, (0, 0, -.08), (.06, 0, 2.3), .07, .05, 6, .1), "plank_dark", 0, 2.4, .5)
        paint(bm, uv, col, prism(bm, (.05, 0, 2.2), (.7, 0, 2.28), .035, .03, 4, .8), "plank_mid", 0, 2.4, .7)   # the arm
        paint(bm, uv, col, prism(bm, (.7, 0, 2.28), (.7, 0, 2.0), .012, .012, 4, 0), "iron_dark", 0, 2.4, .9)   # the chain
        cx, cz = .7, 1.72
        paint(bm, uv, col, prism(bm, (cx, 0, cz - .12), (cx, 0, cz + .1), .06, .06, 6, 0), "glow", 0, 1, 1.0, glow=True)   # the lit core
        for i in range(6):   # the bone cage
            a = 2 * math.pi * i / 6
            paint(bm, uv, col, prism(bm, (cx + math.cos(a) * .12, math.sin(a) * .12, cz - .18), (cx + math.cos(a) * .12, math.sin(a) * .12, cz + .16), .018, .018, 4, 0), "bone", 0, 2.4, .9)
        paint(bm, uv, col, prism(bm, (cx, 0, cz + .16), (cx, 0, cz + .3), .15, .02, 6, 0), "bone_dark", 0, 2.4, .9)   # the cap
        paint(bm, uv, col, prism(bm, (cx, 0, cz - .22), (cx, 0, cz - .17), .1, .1, 6, 0), "bone_dark", 0, 2.4, .9)
        skull(bm, uv, col, (.03, -.06, 1.15), .8, 260)
        for i in range(3):
            a = 2 * math.pi * i / 3
            rock(bm, uv, col, (math.cos(a) * .22, math.sin(a) * .22, 0), .12, 270 + i)
    return make


def plank_box(bm, uv, col, c, w, d, h, rot, swatch, top_z):
    return paint(bm, uv, col, prism(bm, (c[0], c[1], c[2]), (c[0], c[1], c[2] + h), w * .707, w * .707, 4, rot + math.pi / 4), swatch, 0, top_z, .6)


def hut():
    """A goblin hut 3.4 x 2.6 m: lashed plank walls 1.7 m high with stake corners, a steep hide roof overhanging a ridge pole that carries a crossed pair of horns, a dark doorway on the front, a skull over it."""
    def make(bm, uv, col):
        L, W, H = 1.7, 1.3, 1.7   # half-length (x), half-width (y), wall height
        def v(x, y, z):
            return bm.verts.new((x, y, z))

        # walls: four quads, planks suggested by two vertical stripes of the darker swatch
        c = [v(-L, -W, 0), v(L, -W, 0), v(L, W, 0), v(-L, W, 0)]
        t = [v(-L, -W, H), v(L, -W, H), v(L, W, H), v(-L, W, H)]
        walls = [bm.faces.new((c[i], c[(i + 1) % 4], t[(i + 1) % 4], t[i])) for i in range(4)]
        paint(bm, uv, col, walls, "plank_mid", 0, H, .55)
        for i in range(8):   # plank seams: thin dark strips on the front and back
            x = -L + (i + .5) * (2 * L / 8)
            paint(bm, uv, col, prism(bm, (x, -W - .02, 0), (x, -W - .02, H), .025, .025, 4, .8), "plank_dark", 0, H, .6)
        # door on the front (-y): a dark panel and a frame
        paint(bm, uv, col, [bm.faces.new((v(-.38, -W - .04, 0), v(.38, -W - .04, 0), v(.38, -W - .04, 1.35), v(-.38, -W - .04, 1.35)))], "soot", 0, H, 1.0)
        for sx in (-.42, .42):
            paint(bm, uv, col, prism(bm, (sx, -W - .06, 0), (sx, -W - .06, 1.45), .05, .05, 4, .8), "plank_dark", 0, H, .7)
        paint(bm, uv, col, prism(bm, (-.46, -W - .06, 1.42), (.46, -W - .06, 1.42), .05, .05, 4, .8), "plank_dark", 0, H, .7)
        skull(bm, uv, col, (0, -W - .1, 1.78), 1.0, 300)
        # the roof: two hide slopes overhanging by .35, ridge at 2.75
        RZ = 2.75
        a0, a1, b0, b1 = v(-L - .45, -W - .35, H - .1), v(L + .45, -W - .35, H - .1), v(-L - .45, W + .35, H - .1), v(L + .45, W + .35, H - .1)
        r0, r1 = v(-L - .45, 0, RZ), v(L + .45, 0, RZ)
        slopes = [bm.faces.new((a0, a1, r1, r0)), bm.faces.new((b1, b0, r0, r1))]
        paint(bm, uv, col, slopes, "hide", H - .1, RZ, .55)
        gables = [bm.faces.new((a0, b0, r0)), bm.faces.new((a1, r1, b1))]
        paint(bm, uv, col, gables, "hide_dark", H - .1, RZ, .65)
        paint(bm, uv, col, prism(bm, (-L - .7, 0, RZ + .02), (L + .7, 0, RZ + .02), .07, .07, 5, .3), "plank_dark", 0, 3.2, .7)   # the ridge pole
        for sgn in (-1, 1):   # a crossed pair of horns on each gable
            for hs in (-1, 1):
                horn(bm, uv, col, (sgn * (L + .65), 0, RZ + .03), (sgn * .55, hs * .55, .6), .7, .06, .5)
        for sx, sy in ((-L, -W), (L, -W), (-L, W), (L, W)):   # sharpened corner stakes
            stake(bm, uv, col, sx, sy, 2.2, (0, 0), .08, "plank_dark", 2.4)
    return make


def tower():
    """A goblin watch tower: four lashed legs 5.2 m, a platform at 3.6 m with a plank rail and out-leaning spikes, a hide roof on four posts with horns, a ladder, rocks at the foot."""
    def make(bm, uv, col):
        for sx in (-.95, .95):
            for sy in (-.95, .95):
                paint(bm, uv, col, prism(bm, (sx * 1.15, sy * 1.15, -.1), (sx * .85, sy * .85, 5.1), .17, .13, 5, .2), "plank_dark", 0, 5.2, .5)
        for z in (1.2, 2.4):   # cross bracing
            for (a, b) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
                s = 1.1 - z * .06
                paint(bm, uv, col, prism(bm, (a[0] * s, a[1] * s, z), (b[0] * s, b[1] * s, z + .04), .045, .045, 4, .8), "plank_mid", 0, 5.2, .7)
        # the platform
        paint(bm, uv, col, prism(bm, (0, 0, 3.45), (0, 0, 3.65), 1.45, 1.45, 4, math.pi / 4), "plank_mid", 0, 5.2, .7)
        for sx in (-1.0, 1.0):   # rail
            for sy in (-1.0, 1.0):
                pass
        for i in range(7):
            x = -1.0 + i * (2.0 / 6)
            for sy in (-1.0, 1.0):
                stake(bm, uv, col, x, sy, 4.45, (0, sy * .06), .05, "plank_light", 5.2)
                stake(bm, uv, col, sy, x, 4.45, (sy * .06, 0), .05, "plank_light", 5.2)
        for z in (3.95, 4.3):
            for sy in (-1.0, 1.0):
                paint(bm, uv, col, prism(bm, (-1.05, sy, z), (1.05, sy, z + .02), .04, .04, 4, .8), "plank_dark", 0, 5.2, .7)
                paint(bm, uv, col, prism(bm, (sy, -1.05, z), (sy, 1.05, z + .02), .04, .04, 4, .8), "plank_dark", 0, 5.2, .7)
        # the roof: four posts and a hide pyramid
        for sx in (-.95, .95):
            for sy in (-.95, .95):
                paint(bm, uv, col, prism(bm, (sx, sy, 3.6), (sx, sy, 5.6), .06, .05, 4, .8), "plank_dark", 0, 5.8, .6)
        def v(x, y, z):
            return bm.verts.new((x, y, z))

        ap = v(0, 0, 6.5)
        cs = [v(-1.45, -1.45, 5.45), v(1.45, -1.45, 5.45), v(1.45, 1.45, 5.45), v(-1.45, 1.45, 5.45)]
        paint(bm, uv, col, [bm.faces.new((cs[i], cs[(i + 1) % 4], ap)) for i in range(4)], "hide", 5.4, 6.5, .55)
        for i, (sx, sy) in enumerate(((-1.4, -1.4), (1.4, -1.4), (1.4, 1.4), (-1.4, 1.4))):
            horn(bm, uv, col, (sx, sy, 5.45), (sx, sy, .25), .75, .06, .6)
        # a ladder up the front
        for sx in (-.3, .3):
            paint(bm, uv, col, prism(bm, (sx, -1.5, 0), (sx, -1.1, 3.6), .045, .045, 4, 0), "plank_light", 0, 4, .7)
        for i in range(8):
            z = .35 + i * .4
            paint(bm, uv, col, prism(bm, (-.3, -1.5 + z * .11, z), (.3, -1.5 + z * .11, z + .01), .03, .03, 4, 0), "plank_light", 0, 4, .75)
        skull(bm, uv, col, (0, -1.5, 3.3), 1.1, 320)
        for i in range(6):
            a = 2 * math.pi * i / 6 + .3
            rock(bm, uv, col, (math.cos(a) * 1.6, math.sin(a) * 1.6, 0), .25 + (i % 2) * .1, 330 + i)
    return make


PIECES = [
    ("goblin_palisade_a", "wall", wall(0)), ("goblin_palisade_b", "wall", wall(1)), ("goblin_palisade_c", "wall", wall(2)),
    ("goblin_gate", "gate", gate()), ("goblin_totem", "totem", totem()), ("goblin_spikes", "spikes", spikes()),
    ("goblin_banner", "banner", banner()), ("goblin_lantern", "lantern", lantern()),
    ("goblin_hut", "hut", hut()), ("goblin_tower", "tower", tower()),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
make_atlas()
mat = bpy.data.materials.new("goblin-fort-kit")   # the same node setup as zone1-kit: the atlas multiplied by the vertex colour, rough, not metal, double sided
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images["goblin-fort-kit-atlas"]
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
    x += {"wall": 7.0, "gate": 9.0, "totem": 3.5, "spikes": 3.0, "banner": 3.5, "lantern": 3.5, "hut": 6.0, "tower": 6.0}[kind]
    print(f"FORT {name:18s} {tris:4d} tris (budget {BUDGET[kind]})")
    if tris > BUDGET[kind]:
        raise SystemExit(f"{name} is over its budget: {tris} > {BUDGET[kind]}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True)
print("FORT-TOTAL", sum(counts.values()), "tris,", len(counts), "pieces ->", OUT)
