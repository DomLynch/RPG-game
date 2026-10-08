# Outlaw camp caravan kit (Dom's PvP design, 2026-10-08: one small caravan camp per zone away from town, a bank, one trader, no guards): the props the town kit and the Zone 1 kit
# lack. Procedural, seeded, no downloads, on the TOWN kit's own 256 swatch atlas (same palette, same vertex-colour grain), so the atlas is one shared texture. The helpers
# (palette, atlas, paint, cub/box/slab/post) are the town kit's, run from its own source up to its first piece, so the two kits stay one look.
#   blender -b -P scripts/character/caravan_kit.py -- <out.glb> <manifest.json> [atlas.png]
# Frame as the town kit: 1 unit = 1 m, glTF +Y up, every origin the base centre on the ground, the FRONT faces glTF +Z (Blender -Y): the trader's counter, the strongbox's lock, a tent's door.
# The manifest carries a LAYOUT (piece offsets from the camp centre, glTF x/z, heading in degrees about Y) and the ANCHORS (bank, trader, fire, red respawn) World places by.
# Budget per piece (tris): wagon <= 1000, cart <= 450, tent <= 150, strongbox <= 180, crate <= 60, barrel <= 140, sack <= 60, sign <= 90, awning <= 100; the script fails over budget.
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

# ---- the town kit's helpers, verbatim (scripts/character/town_kit.py): palette, atlas, paint, cub / box / slab / post ----
argv = sys.argv[sys.argv.index("--") + 1:]
OUT, MANIFEST = argv[0], argv[1]
ATLAS = argv[2] if len(argv) > 2 else os.path.splitext(OUT)[0] + "-atlas.png"

SWATCHES = [
    ("plaster", (206, 192, 164)), ("plaster_warm", (194, 160, 120)), ("timber", (84, 60, 44)), ("timber_light", (132, 98, 66)),
    ("stone", (140, 134, 126)), ("stone_dark", (96, 92, 88)), ("brick", (150, 82, 62)), ("shingle", (88, 76, 70)),
    ("tile", (170, 96, 64)), ("thatch", (176, 148, 90)), ("canvas", (214, 202, 170)), ("canvas_red", (160, 62, 52)),
    ("iron", (58, 58, 62)), ("brass", (190, 150, 70)), ("door", (104, 72, 48)), ("soot", (30, 28, 28)),
]
SW = {n: i for i, (n, _) in enumerate(SWATCHES)}
GROUND = (.60, .49, .36)


def make_atlas():
    size = 256
    img = bpy.data.images.new("town-kit-atlas", size, size, alpha=False)
    px = []
    for y in range(size):
        for x in range(size):
            _, c = SWATCHES[(y * 4 // size) * 4 + x * 4 // size]
            px += [c[0] / 255, c[1] / 255, c[2] / 255, 1.0]
    img.pixels = px
    img.filepath_raw = ATLAS
    img.file_format = "PNG"
    img.save()


def hnoise(co, seed):
    return math.modf(math.sin(co.x * 127.1 + co.y * 311.7 + co.z * 74.7 + seed * 19.3) * 43758.5453)[0]


def paint(bm, uv, col, faces, swatch, top=3.0, dark=.78):
    u, v = ((SW[swatch] % 4) + .5) / 4, ((SW[swatch] // 4) + .5) / 4
    for f in faces:
        for loop in f.loops:
            loop[uv].uv = (u, v)
            co = loop.vert.co
            t = min(1.0, max(0.0, co.z / top))
            k = dark + (1 - dark) * t
            n, w = hnoise(co, 1) * .12, hnoise(co, 2) * .05
            r, g, b = k * (1 + n + w), k * (1 + n), k * (1 + n - w)
            if t < .12:   # dust at the foot: the ground's colour
                m = (1 - t / .12) * .35
                r, g, b = r + (GROUND[0] - r) * m, g + (GROUND[1] - g) * m, b + (GROUND[2] - b) * m
            loop[col] = (min(1, max(0, r)), min(1, max(0, g)), min(1, max(0, b)), 1.0)


def cub(bm, x0, y0, z0, x1, y1, z1):
    """An axis-aligned box in Blender coordinates (x right, y back, z up); returns its six faces."""
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    return [bm.faces.new(f) for f in ((v[0], v[3], v[2], v[1]), (v[4], v[5], v[6], v[7]), (v[0], v[1], v[5], v[4]), (v[1], v[2], v[6], v[5]), (v[2], v[3], v[7], v[6]), (v[3], v[0], v[4], v[7]))]


def box(bm, uv, col, p0, p1, swatch, top_swatch=None, dark=.78):
    """cub + paint; the top face may take its own swatch (a stone cap, a counter top)."""
    fs = cub(bm, *p0, *p1)
    if top_swatch:
        paint(bm, uv, col, [fs[1]], top_swatch, dark=dark)
        paint(bm, uv, col, [f for i, f in enumerate(fs) if i != 1], swatch, dark=dark)
    else:
        paint(bm, uv, col, fs, swatch, dark=dark)
    return fs


def slab(bm, a, b, c, d, t):
    """A thin slab: the top quad a-b-c-d (Vector corners, counter-clockwise from above) with its underside t lower along -Z."""
    top = [bm.verts.new(p) for p in (a, b, c, d)]
    bot = [bm.verts.new(Vector(p) - Vector((0, 0, t))) for p in (a, b, c, d)]
    return [bm.faces.new(f) for f in ((top[0], top[1], top[2], top[3]), (bot[3], bot[2], bot[1], bot[0]), (top[0], bot[0], bot[1], top[1]), (top[1], bot[1], bot[2], top[2]), (top[2], bot[2], bot[3], top[3]), (top[3], bot[3], bot[0], top[0]))]


def post(bm, uv, col, x, y, z0, z1, r, swatch, sides=6):
    base, tip = Vector((x, y, z0)), Vector((x, y, z1))
    ring0 = [bm.verts.new(base + Vector((math.cos(2 * math.pi * i / sides) * r, math.sin(2 * math.pi * i / sides) * r, 0))) for i in range(sides)]
    ring1 = [bm.verts.new(tip + Vector((math.cos(2 * math.pi * i / sides) * r, math.sin(2 * math.pi * i / sides) * r, 0))) for i in range(sides)]
    fs = [bm.faces.new((ring0[i], ring0[(i + 1) % sides], ring1[(i + 1) % sides], ring1[i])) for i in range(sides)] + [bm.faces.new(list(reversed(ring1)))]
    paint(bm, uv, col, fs, swatch)


BUDGET = {"wagon": 1000, "cart": 450, "tent": 150, "strongbox": 180, "crate": 60, "barrel": 140, "sack": 60, "sign": 90, "awning": 100}


def bar(bm, uv, col, a, b, r0, swatch, sides=4, r1=None, top=3.0, dark=.78):
    """A tapered n-gon bar from point a to point b, capped at both ends (a wheel, an axle, a pole, a hoop)."""
    a, b = Vector(a), Vector(b)
    r1 = r0 if r1 is None else r1
    q = Vector((0, 0, 1)).rotation_difference((b - a).normalized())
    ring0, ring1 = [], []
    for i in range(sides):
        d = Vector((math.cos(2 * math.pi * i / sides + .4), math.sin(2 * math.pi * i / sides + .4), 0))
        ring0.append(bm.verts.new(a + q @ (d * r0)))
        ring1.append(bm.verts.new(b + q @ (d * r1)))
    fs = [bm.faces.new((ring0[i], ring0[(i + 1) % sides], ring1[(i + 1) % sides], ring1[i])) for i in range(sides)]
    fs += [bm.faces.new(ring0), bm.faces.new(list(reversed(ring1)))]
    paint(bm, uv, col, fs, swatch, top=top, dark=dark)
    return fs


def arch(bm, uv, col, x0, x1, cy, cz, ry, rz, swatches, closed=("soot", "canvas")):
    """A half-barrel (a wagon cover, a chest lid) along X: len(swatches) strips from the +y foot over the crown to the -y foot; its two ends are fans (swatch names, or None for open)."""
    n = len(swatches)
    pts = [(cy + math.cos(math.pi * i / n) * ry, cz + math.sin(math.pi * i / n) * rz) for i in range(n + 1)]
    for i in range(n):
        v = [bm.verts.new((x, y, z)) for x, (y, z) in ((x0, pts[i]), (x1, pts[i]), (x1, pts[i + 1]), (x0, pts[i + 1]))]
        paint(bm, uv, col, [bm.faces.new(v)], swatches[i], top=2.4, dark=.85)
    for x, sw in ((x0, closed[0]), (x1, closed[1])):
        if sw:
            c = bm.verts.new((x, cy, cz))
            ring = [bm.verts.new((x, y, z)) for y, z in pts]
            paint(bm, uv, col, [bm.faces.new((c, ring[i], ring[i + 1])) for i in range(n)], sw, top=2.4, dark=.85)


def wheel(bm, uv, col, cx, cy, cz, r, out):
    """An iron-tyred wheel on a Y axle: tyre, wooden disc proud of it, hub, and three spokes on the outer side (`out` = +1 / -1)."""
    bar(bm, uv, col, (cx, cy - .05, cz), (cx, cy + .05, cz), r, "iron", 10, top=2.0)
    bar(bm, uv, col, (cx, cy - .08, cz), (cx, cy + .08, cz), r * .88, "timber_light", 10, top=2.0)
    bar(bm, uv, col, (cx, cy - .12, cz), (cx, cy + .12, cz), r * .2, "iron", 6, top=2.0)
    for k in range(3):
        t = k * math.pi / 3 + .3
        d = Vector((math.cos(t), 0, math.sin(t))) * r * .84
        bar(bm, uv, col, Vector((cx, cy + out * .1, cz)) - d, Vector((cx, cy + out * .1, cz)) + d, .028, "timber", 3, top=2.0)


def wagon(trader):
    """A covered freight wagon 3.8 m long (X), 1.7 wide, 2.1 high with a red-trimmed canvas cover open at the back, a driver's bench and a tongue to +X. `trader`: a drop-down counter
    on the front (-Y) side with goods boxes on it and a lantern post, so the one wagon reads as the trader's stall."""
    def make(bm, uv, col):
        box(bm, uv, col, (-1.9, -.85, .55), (1.9, .85, .62), "timber_light", dark=.7)   # the bed
        box(bm, uv, col, (-1.9, -.85, .62), (1.9, -.8, 1.1), "timber", dark=.8)
        box(bm, uv, col, (-1.9, .8, .62), (1.9, .85, 1.1), "timber", dark=.8)
        box(bm, uv, col, (1.85, -.85, .62), (1.9, .85, 1.1), "timber", dark=.8)
        box(bm, uv, col, (-1.6, -.2, .43), (1.6, .2, .55), "timber", dark=.6)   # the beam under the bed
        for ax in (-1.3, 1.3):
            bar(bm, uv, col, (ax, -.95, .5), (ax, .95, .5), .05, "iron", 4, top=2.0)
            for sy in (-1, 1):
                wheel(bm, uv, col, ax, sy * .95, .5, .5, sy)
        arch(bm, uv, col, -1.75, 1.45, 0, 1.05, .85, .85, ["canvas_red", "canvas", "canvas", "canvas", "canvas", "canvas_red"], ("soot", "canvas"))   # the cover
        box(bm, uv, col, (1.5, -.65, .98), (1.82, .65, 1.05), "timber_light", dark=.8)   # the driver's bench and its back
        box(bm, uv, col, (1.78, -.65, 1.05), (1.84, .65, 1.4), "timber", dark=.8)
        bar(bm, uv, col, (1.9, 0, .5), (3.4, 0, .36), .055, "timber", 4, top=2.0)   # the tongue and the yoke
        bar(bm, uv, col, (3.4, -.5, .36), (3.4, .5, .36), .04, "timber", 4, top=2.0)
        if trader:
            box(bm, uv, col, (-.8, -1.35, .94), (.8, -.85, .99), "timber_light", dark=.85)   # the counter flap, let down
            for sx in (-.75, .75):
                bar(bm, uv, col, (sx, -1.3, .58), (sx, -.86, .94), .02, "iron", 3, top=2.0)   # its two stays
            for i, (x, sw) in enumerate(zip((-.5, 0.0, .5), ("thatch", "plaster_warm", "brick"))):
                box(bm, uv, col, (x - .17, -1.2, .99), (x + .17, -.95, 1.18 + .08 * (i % 2)), sw, dark=.9)   # goods on the flap
            post(bm, uv, col, -.95, -1.3, .94, 1.9, .03, "timber", 4)   # the lantern post
            box(bm, uv, col, (-1.02, -1.37, 1.9), (-.88, -1.23, 2.04), "brass", dark=1.0)
    return make


def handcart():
    def make(bm, uv, col):
        box(bm, uv, col, (-.6, -.42, .4), (.6, .42, .47), "timber_light", dark=.7)
        box(bm, uv, col, (-.6, -.42, .47), (.6, -.38, .78), "timber", dark=.8)
        box(bm, uv, col, (-.6, .38, .47), (.6, .42, .78), "timber", dark=.8)
        box(bm, uv, col, (-.6, -.38, .47), (-.56, .38, .78), "timber", dark=.8)
        bar(bm, uv, col, (0, -.5, .38), (0, .5, .38), .04, "iron", 4, top=2.0)
        for sy in (-1, 1):
            wheel(bm, uv, col, 0, sy * .5, .38, .38, sy)
            bar(bm, uv, col, (.6, sy * .3, .52), (1.7, sy * .27, .62), .035, "timber", 4, top=2.0)   # the shafts
        bar(bm, uv, col, (1.7, -.27, .62), (1.7, .27, .62), .03, "timber", 4, top=2.0)
        bar(bm, uv, col, (-.5, 0, .4), (-.5, 0, 0), .035, "timber", 4, top=2.0)   # the prop leg
    return make


def tent_small():
    """An A-frame canvas tent 2.4 m deep, 2 wide, 1.6 high: a red ridge, a dark doorway on the front (-Y) end, four pegs."""
    def make(bm, uv, col):
        L, Wd, H = 1.2, 1.0, 1.6
        def v(x, y, z):
            return bm.verts.new((x, y, z))

        a0, a1, b0, b1, r0, r1 = v(-Wd, -L, 0), v(-Wd, L, 0), v(Wd, -L, 0), v(Wd, L, 0), v(0, -L, H), v(0, L, H)
        paint(bm, uv, col, [bm.faces.new((a0, a1, r1, r0)), bm.faces.new((b0, b1, r1, r0))], "canvas", top=H, dark=.8)
        paint(bm, uv, col, [bm.faces.new((a0, b0, r0))], "soot", top=H, dark=1.0)
        paint(bm, uv, col, [bm.faces.new((a1, b1, r1))], "canvas", top=H, dark=.8)
        bar(bm, uv, col, (0, -L - .3, H + .02), (0, L + .3, H + .02), .045, "canvas_red", 4, top=H + .1, dark=.9)
        for px, py in ((-Wd - .25, -L), (Wd + .25, -L), (-Wd - .25, L), (Wd + .25, L)):
            bar(bm, uv, col, (px, py, .22), (px * .8, py, -.02), .025, "timber", 3, top=1.0)
    return make


def tent_large():
    """A wall tent 3.6 deep, 3 wide, walls .9 high under a ridge 2.1 high, a dark doorway and a red pennant on the front ridge pole."""
    def make(bm, uv, col):
        L, Wd, Wh, H = 1.8, 1.5, .9, 2.1
        def v(x, y, z):
            return bm.verts.new((x, y, z))

        a0, a1, b0, b1 = v(-Wd, -L, 0), v(-Wd, L, 0), v(Wd, -L, 0), v(Wd, L, 0)
        c0, c1, d0, d1 = v(-Wd, -L, Wh), v(-Wd, L, Wh), v(Wd, -L, Wh), v(Wd, L, Wh)
        r0, r1 = v(0, -L, H), v(0, L, H)
        paint(bm, uv, col, [bm.faces.new((a0, a1, c1, c0)), bm.faces.new((b0, b1, d1, d0))], "canvas", top=H, dark=.75)   # the two side walls
        paint(bm, uv, col, [bm.faces.new((c0, c1, r1, r0)), bm.faces.new((d0, d1, r1, r0))], "canvas", top=H, dark=.85)   # the roof slopes
        paint(bm, uv, col, [bm.faces.new((a1, b1, d1, c1)), bm.faces.new((c1, d1, r1))], "canvas", top=H, dark=.75)   # the back
        paint(bm, uv, col, [bm.faces.new((a0, b0, d0, c0)), bm.faces.new((c0, d0, r0))], "canvas", top=H, dark=.8)   # the front wall and gable
        paint(bm, uv, col, [bm.faces.new(((v(-.5, -L - .02, 0)), v(.5, -L - .02, 0), v(.5, -L - .02, 1.5), v(-.5, -L - .02, 1.5)))], "soot", top=H, dark=1.0)   # the doorway, a hair proud of the wall
        bar(bm, uv, col, (0, -L - .4, H), (0, L + .4, H), .05, "timber", 4, top=H + .1, dark=.8)
        bar(bm, uv, col, (0, -L - .4, H), (0, -L - .4, H + .55), .025, "timber", 3, top=H + .6, dark=.9)   # the pennant staff
        paint(bm, uv, col, [bm.faces.new((v(0, -L - .4, H + .55), v(0, -L - .4, H + .25), v(.55, -L - .4, H + .4)))], "canvas_red", top=H + .6, dark=1.0)
    return make


def strongbox():
    """The bank chest: an iron-strapped timber chest .9 wide with a round lid, three straps, corner plates and a brass lock on the front."""
    def make(bm, uv, col):
        box(bm, uv, col, (-.45, -.28, 0), (.45, .28, .4), "timber", dark=.7)
        arch(bm, uv, col, -.45, .45, 0, .4, .28, .26, ["timber_light"] * 5, ("timber", "timber"))
        for x in (-.28, 0.0, .28):
            box(bm, uv, col, (x - .035, -.292, 0), (x + .035, -.28, .4), "iron", dark=1.0)
        for sx in (-.45, .43):
            for sy in (-.3, .26):
                box(bm, uv, col, (sx, sy, 0), (sx + .02, sy + .04, .1), "iron", dark=1.0)
        box(bm, uv, col, (-.06, -.31, .3), (.06, -.28, .42), "brass", dark=1.0)
    return make


def crate(stack):
    def make(bm, uv, col):
        box(bm, uv, col, (-.32, -.32, 0), (.32, .32, .6), "timber_light", "timber", dark=.7)
        for sy in (-1, 1):
            box(bm, uv, col, (-.34, sy * .325 - .01, 0), (.34, sy * .325 + .01, .05), "iron", dark=1.0)
        if stack:
            box(bm, uv, col, (-.2, -.2, .6), (.22, .2, .98), "timber", "timber_light", dark=.8)
    return make


def barrel():
    def make(bm, uv, col):
        bar(bm, uv, col, (0, 0, 0), (0, 0, .45), .27, "timber", 8, r1=.34, top=.9, dark=.7)
        bar(bm, uv, col, (0, 0, .45), (0, 0, .9), .34, "timber", 8, r1=.27, top=.9, dark=.7)
        for z in (.18, .72):
            bar(bm, uv, col, (0, 0, z), (0, 0, z + .05), .345, "iron", 8, top=.9, dark=1.0)
    return make


def sack(slump):
    def make(bm, uv, col):
        rx, ry, rz = (.3, .27, .32) if not slump else (.4, .26, .22)
        res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        for vtx in res["verts"]:
            vtx.co = Vector((vtx.co.x * rx, vtx.co.y * ry, vtx.co.z * rz + rz * .85))
        paint(bm, uv, col, list({f for vtx in res["verts"] for f in vtx.link_faces}), "thatch", top=.6, dark=.8)
        bar(bm, uv, col, (0, 0, rz * 1.7), (0, 0, rz * 1.7 + .1), .06, "timber_light", 4, r1=.04, top=.6)
    return make


def sign_outlaw():
    """The camp's mark: a post, a crossbar plank and a red rag. It says 'no law here' and is the only thing in the kit that names the camp."""
    def make(bm, uv, col):
        post(bm, uv, col, 0, 0, 0, 2.1, .06, "timber", 6)
        box(bm, uv, col, (-.7, -.05, 1.5), (.7, .03, 1.95), "timber_light", dark=.85)
        box(bm, uv, col, (-.72, -.07, 1.5), (-.66, .05, 1.95), "timber", dark=.8)
        box(bm, uv, col, (.66, -.07, 1.5), (.72, .05, 1.95), "timber", dark=.8)
        def v(x, y, z):
            return bm.verts.new((x, y, z))

        paint(bm, uv, col, [bm.faces.new((v(.15, -.07, 1.9), v(.55, -.07, 1.9), v(.35, -.07, 1.25)))], "canvas_red", top=2.0, dark=1.0)   # the rag
        paint(bm, uv, col, [bm.faces.new((v(-.55, -.07, 1.85), v(-.15, -.07, 1.85), v(-.35, -.07, 1.6)))], "plaster", top=2.0, dark=.95)   # a bleached scrap
    return make


def awning():
    """A trader's lean-to: a red-and-cream canvas sheet 3 m wide on two front posts, falling to the back; stands against a wagon's front (-Y) side."""
    def make(bm, uv, col):
        for sx in (-1.4, 1.4):
            post(bm, uv, col, sx, -1.1, 0, 2.2, .05, "timber", 5)
        for i in range(6):
            x0 = -1.5 + i * .5
            a, b, c, d = Vector((x0, 0, 2.7)), Vector((x0 + .5, 0, 2.7)), Vector((x0 + .5, -1.3, 2.15)), Vector((x0, -1.3, 2.15))
            paint(bm, uv, col, slab(bm, a, b, c, d, .04), "canvas_red" if i % 2 == 0 else "canvas", top=2.8, dark=.9)
    return make


PIECES = [   # (node, kind, make)
    ("wagon_covered_a", "wagon", wagon(False)), ("wagon_trader_a", "wagon", wagon(True)), ("handcart_a", "cart", handcart()),
    ("tent_small_a", "tent", tent_small()), ("tent_large_a", "tent", tent_large()),
    ("strongbox_a", "strongbox", strongbox()), ("crate_a", "crate", crate(False)), ("crate_stack_a", "crate", crate(True)),
    ("barrel_a", "barrel", barrel()), ("sack_a", "sack", sack(False)), ("sack_b", "sack", sack(True)),
    ("sign_outlaw_a", "sign", sign_outlaw()), ("awning_a", "awning", awning()),
]

# The camp, as placements from the camp centre (the fire): [piece, x, z, heading degrees about +Y]; glTF axes (x right, z toward the camera/front). Positive heading turns the piece's front
# (+Z) toward +X. The trader's wagon and the strongbox face the fire; the tents stand back; the sign marks the way in from -Z.
LAYOUT = [
    ["wagon_trader_a", -5.2, -3.0, 70], ["awning_a", -5.2, -3.0, 70], ["wagon_covered_a", 5.4, -2.6, -110], ["handcart_a", 1.2, -6.2, 15],
    ["tent_large_a", -6.8, 3.2, 150], ["tent_small_a", 5.6, 4.0, -145], ["tent_small_a", 1.4, 6.6, 180],
    ["strongbox_a", -2.9, 0.8, 90], ["crate_stack_a", -3.0, 2.0, 20], ["crate_a", -4.2, -0.9, 80], ["barrel_a", -4.0, -5.6, 0], ["barrel_a", -3.4, -5.9, 0],
    ["sack_a", -2.4, 2.4, 0], ["sack_b", 4.0, -4.4, 40], ["crate_a", 6.4, -4.4, 50], ["sign_outlaw_a", 0.0, 9.5, 0],
]
ANCHORS = {   # camp-local glTF positions [x, y, z]: where the player stands to use it, and the red respawn
    "bank": [-2.2, 0, 0.8], "trader": [-3.9, 0, -2.4], "fire": [0, 0, 0], "red_respawn": [0, 0, 2.5],
}

bpy.ops.wm.read_factory_settings(use_empty=True)
make_atlas()
mat = bpy.data.materials.new("CaravanKit")
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images["town-kit-atlas"]
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

manifest = {"front": "+Z (glTF)", "pieces": {}, "layout": LAYOUT, "anchors": ANCHORS, "camp_radius_m": 12, "atlas": "the town kit's 256x256, 16 swatches (public/world/town/buildings.glb)"}
x = 0.0
for name, kind, make in PIECES:
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
    ob.data.materials.append(mat)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    dims = [round(v, 2) for v in ob.dimensions]
    manifest["pieces"][name] = {"kind": kind, "tris": tris, "size": dims}
    ob.location.x = x
    x += max(3.0, dims[0] + 1.5)
    print(f"CARAVAN {name:16s} {tris:4d} tris (budget {BUDGET[kind]}) size {dims}")
    if tris > BUDGET[kind]:
        raise SystemExit(f"{name} is over its budget: {tris} > {BUDGET[kind]}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True)
with open(MANIFEST, "w") as f:
    json.dump(manifest, f, indent=1)
print("CARAVAN-TOTAL", sum(p["tris"] for p in manifest["pieces"].values()), "tris,", len(manifest["pieces"]), "pieces ->", OUT)
