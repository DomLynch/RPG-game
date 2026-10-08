# Town building kit (Lead 2026-10-08, docs/TOP10.md Town plan row 3): modular pieces on ONE shared atlas, a 3 m module, weighted variants, and three composed buildings
# (bank, smithy, inn) listed as RECIPES of placements so World's generator and this script assemble the same thing. Procedural, seeded, no downloads, no textures
# beyond one 256 swatch atlas; grain and ground-dust live in the vertex colour (same trick as zone1_kit.py).
#   blender -b -P scripts/character/town_kit.py -- <out.glb> <manifest.json> [atlas.png]
# Frame: 1 unit = 1 m, glTF +Y up; every piece's origin is its base centre on the ground; its FRONT faces glTF +Z (Blender -Y). A wall piece is 3 m long along X,
# .3 m thick, 3 m high (a module); a roof piece covers a 3 x 3 m module with its ridge along X; rotate a piece in 90 degree steps about Y to place it.
# Donor: 2004Scape-Server (MIT; LocShape wall / corner / roof / centrepiece taxonomy with four rotation angles): the idea of typed pieces + rotations, no code or assets copied.
# Budget per piece (tris): wall <= 200, corner <= 80, arch <= 220, roof <= 120, stall <= 260, counter <= 260, sign <= 90, chimney <= 90; the script fails over budget.
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, MANIFEST = argv[0], argv[1]
ATLAS = argv[2] if len(argv) > 2 else os.path.splitext(OUT)[0] + "-atlas.png"
BUDGET = {"wall": 200, "corner": 80, "arch": 220, "roof": 120, "stall": 260, "counter": 260, "sign": 90, "chimney": 90}
M = 3.0   # the module (m)

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


# ---- walls (front = Blender -Y, thickness .3) --------------------------------------------------------------------------------------------------------

def wall_body(bm, uv, col, body, base, frame, top=M):
    """The module wall: a stone plinth, the body, a top plate and timber corner posts when `frame`."""
    box(bm, uv, col, (-1.5, -.17, 0), (1.5, .17, .5), base, "stone")
    box(bm, uv, col, (-1.5, -.15, .5), (1.5, .15, top - .15), body)
    box(bm, uv, col, (-1.5, -.19, top - .15), (1.5, .19, top), frame or "timber")
    if frame:
        for x in (-1.5, 1.5 - .16):
            box(bm, uv, col, (x, -.19, .5), (x + .16, .19, top - .15), frame)


def wall_plain(body, base, frame):
    def make(bm, uv, col):
        wall_body(bm, uv, col, body, base, frame)
        if frame:   # half-timbering reads from far: two diagonal braces
            for sx in (-1, 1):
                box(bm, uv, col, (sx * .7 - .06, -.2, .9), (sx * .7 + .06, .2, 2.5), frame)
    return make


def wall_with_hole(body, base, frame, x0, x1, z0, z1, leaf=None, shutters=False, door=False):
    """A wall with a rectangular opening from (x0, z0) to (x1, z1): four body boxes round it, a lintel and a sill, and a leaf (the door) or two shutters."""
    def make(bm, uv, col):
        box(bm, uv, col, (-1.5, -.17, 0), (1.5, .17, .5), base, "stone")
        box(bm, uv, col, (-1.5, -.15, .5), (x0, .15, M - .15), body)
        box(bm, uv, col, (x1, -.15, .5), (1.5, .15, M - .15), body)
        if z0 > .5:
            box(bm, uv, col, (x0, -.15, .5), (x1, .15, z0), body)
        box(bm, uv, col, (x0, -.15, z1), (x1, .15, M - .15), body)
        box(bm, uv, col, (-1.5, -.19, M - .15), (1.5, .19, M), frame or "timber")
        box(bm, uv, col, (x0 - .08, -.2, z1 - .02), (x1 + .08, .2, z1 + .12), frame or "timber")   # lintel
        if not door:
            box(bm, uv, col, (x0 - .08, -.24, z0 - .08), (x1 + .08, .2, z0 + .02), "stone")   # sill
        if frame:
            for x in (-1.5, 1.5 - .16):
                box(bm, uv, col, (x, -.19, .5), (x + .16, .19, M - .15), frame)
        if leaf:   # the door leaf, recessed
            box(bm, uv, col, (x0 + .05, -.05, 0), (x1 - .05, .05, z1 - .02), leaf)
        if shutters:   # shutters swung open against the wall each side
            w = (x1 - x0) / 2
            box(bm, uv, col, (x0 - w - .04, -.24, z0), (x0 - .04, -.18, z1), "timber_light")
            box(bm, uv, col, (x1 + .04, -.24, z0), (x1 + w + .04, -.18, z1), "timber_light")
    return make


def corner(body, frame):
    def make(bm, uv, col):
        box(bm, uv, col, (-.28, -.28, 0), (.28, .28, .5), "stone", "stone")
        box(bm, uv, col, (-.25, -.25, .5), (.25, .25, M - .1), frame)
        box(bm, uv, col, (-.28, -.28, M - .1), (.28, .28, M), "timber")
    return make


# ---- arches ---------------------------------------------------------------------------------------------------------------------------------------

def arch_stone(r=1.1, pier=.55, seg=8):
    def make(bm, uv, col):
        for sx in (-1, 1):
            box(bm, uv, col, (sx * (r + pier / 2) - pier / 2, -.3, 0), (sx * (r + pier / 2) + pier / 2, .3, 2.3), "stone", "stone_dark")
        cz = 2.3
        for i in range(seg):
            a0, a1 = math.pi * i / seg, math.pi * (i + 1) / seg
            o = r + .5
            pts = [(math.cos(a0) * r, cz + math.sin(a0) * r), (math.cos(a1) * r, cz + math.sin(a1) * r), (math.cos(a1) * o, cz + math.sin(a1) * o), (math.cos(a0) * o, cz + math.sin(a0) * o)]
            vs = [(bm.verts.new((px, -.3, pz)), bm.verts.new((px, .3, pz))) for px, pz in pts]
            fs = [bm.faces.new((vs[0][0], vs[1][0], vs[2][0], vs[3][0])), bm.faces.new((vs[3][1], vs[2][1], vs[1][1], vs[0][1])),
                  bm.faces.new((vs[0][0], vs[0][1], vs[1][1], vs[1][0])), bm.faces.new((vs[2][0], vs[2][1], vs[3][1], vs[3][0])),
                  bm.faces.new((vs[1][0], vs[1][1], vs[2][1], vs[2][0])), bm.faces.new((vs[3][0], vs[3][1], vs[0][1], vs[0][0]))]
            paint(bm, uv, col, fs, "stone_dark" if i % 2 else "stone", top=cz + o)
        box(bm, uv, col, (-.2, -.34, cz + r), (.2, .34, cz + r + .55), "stone_dark")   # keystone
    return make


def arch_gate():
    def make(bm, uv, col):
        for sx in (-1.25, 1.25):
            post(bm, uv, col, sx, 0, 0, 3.0, .17, "timber", 6)
        box(bm, uv, col, (-1.6, -.14, 2.7), (1.6, .14, 3.0), "timber")
        for sx in (-1, 1):   # corner braces
            box(bm, uv, col, (sx * 1.0 - .08, -.08, 2.2), (sx * 1.0 + .08, .08, 2.7), "timber_light")
        box(bm, uv, col, (-.5, -.1, 3.0), (.5, .1, 3.45), "timber_light")   # a little gable on top
    return make


# ---- roofs (3 x 3 module, ridge along X, two slopes) ---------------------------------------------------------------------------------------------

def roof(swatch, rise=1.2, over=.35):
    def make(bm, uv, col):
        hz = M / 2 + over
        for s in (-1, 1):
            a, b = Vector((-1.5 - .05, s * hz, 0)), Vector((1.5 + .05, s * hz, 0))
            c, d = Vector((1.5 + .05, 0, rise)), Vector((-1.5 - .05, 0, rise))
            fs = slab(bm, d, c, b, a, .14) if s < 0 else slab(bm, a, b, c, d, .14)
            paint(bm, uv, col, fs, swatch, top=rise + .2, dark=.8)
        box(bm, uv, col, (-1.58, -.12, rise - .02), (1.58, .12, rise + .12), "timber")   # ridge cap
    return make


def roof_end(swatch):
    def make(bm, uv, col):
        v = [bm.verts.new(p) for p in ((-1.5, -.15, 0), (1.5, -.15, 0), (0, -.15, 1.2), (-1.5, .15, 0), (1.5, .15, 0), (0, .15, 1.2))]
        fs = [bm.faces.new(f) for f in ((v[0], v[2], v[1]), (v[3], v[4], v[5]), (v[0], v[1], v[4], v[3]), (v[0], v[3], v[5], v[2]), (v[1], v[2], v[5], v[4]))]
        paint(bm, uv, col, fs, swatch, top=1.2)
        box(bm, uv, col, (-.08, -.19, .2), (.08, .19, 1.1), "timber")
    return make


# ---- stalls, counters, signs, chimneys -----------------------------------------------------------------------------------------------------------

def stall(awning, goods):
    def make(bm, uv, col):
        for sx in (-1.3, 1.3):
            for sy, h in ((.8, 2.5), (-.8, 2.0)):
                post(bm, uv, col, sx, sy, 0, h, .07, "timber", 5)
        a, b, c, d = Vector((-1.6, 1.0, 2.55)), Vector((1.6, 1.0, 2.55)), Vector((1.6, -1.1, 2.05)), Vector((-1.6, -1.1, 2.05))
        paint(bm, uv, col, slab(bm, a, b, c, d, .06), awning, top=2.6, dark=.9)
        box(bm, uv, col, (-1.45, -1.0, .8), (1.45, -.5, .95), "timber_light")   # the counter board
        box(bm, uv, col, (-1.45, -1.0, 0), (1.45, -.55, .8), "timber")   # its front
        for i, (x, sw) in enumerate(zip((-.95, 0.0, .95), goods)):   # goods on the board: three heaps
            box(bm, uv, col, (x - .3, -.9, .95), (x + .3, -.6, 1.2 + .1 * (i % 2)), sw, dark=.85)
        box(bm, uv, col, (-1.2, .5, 0), (-.5, 1.0, .5), "timber_light")   # a crate behind
        box(bm, uv, col, (.4, .55, 0), (1.0, 1.0, .4), "timber")
    return make


def counter_bank():
    def make(bm, uv, col):
        box(bm, uv, col, (-1.5, -.45, 0), (1.5, .45, 1.05), "stone_dark")
        for i in range(4):   # inset front panels
            x = -1.2 + i * .8
            box(bm, uv, col, (x, -.5, .2), (x + .6, -.45, .9), "timber")
        box(bm, uv, col, (-1.58, -.52, 1.05), (1.58, .52, 1.15), "stone", "stone")   # the top slab, overhanging
        for i in range(7):   # the grille: brass bars
            x = -1.3 + i * .43
            box(bm, uv, col, (x - .015, -.1, 1.15), (x + .015, -.05, 2.0), "brass", dark=.9)
        box(bm, uv, col, (-1.5, -.12, 1.95), (1.5, -.03, 2.05), "brass", dark=.9)   # grille rail
        box(bm, uv, col, (-1.4, .05, 1.15), (-.8, .4, 1.3), "timber_light")   # a ledger
        for x in (.8, 1.0, 1.2):   # coin stacks
            box(bm, uv, col, (x - .07, .15, 1.15), (x + .07, .29, 1.25 + (x - .8) * .4), "brass", dark=.9)
    return make


def counter_bar():
    def make(bm, uv, col):
        box(bm, uv, col, (-1.5, -.4, 0), (1.5, .4, 1.1), "timber")
        box(bm, uv, col, (-1.58, -.47, 1.1), (1.58, .47, 1.2), "timber_light", "timber_light")
        for x in (-1.0, 1.0):   # barrels behind
            post(bm, uv, col, x, .75, 0, .9, .32, "timber_light", 8)
            post(bm, uv, col, x, .75, .5, .55, .34, "iron", 8)
        for x in (-.7, 0, .7):   # mugs
            post(bm, uv, col, x, -.1, 1.2, 1.36, .05, "iron", 5)
    return make


def sign(symbol, board):
    def make(bm, uv, col):
        box(bm, uv, col, (-.06, -.06, 1.2), (.06, .06, 2.6), "timber")   # the wall post
        box(bm, uv, col, (-.04, -.9, 2.4), (.04, .04, 2.5), "iron")   # the arm
        box(bm, uv, col, (-.05, -.85, 1.4), (.05, -.15, 2.2), board)   # the board
        if symbol == "mug":
            box(bm, uv, col, (-.08, -.65, 1.6), (.08, -.35, 1.95), "brass", dark=.9)
            box(bm, uv, col, (-.08, -.35, 1.7), (.08, -.25, 1.85), "brass", dark=.9)
        elif symbol == "anvil":
            box(bm, uv, col, (-.08, -.7, 1.6), (.08, -.3, 1.72), "iron")
            box(bm, uv, col, (-.08, -.58, 1.72), (.08, -.42, 1.85), "iron")
            box(bm, uv, col, (-.08, -.82, 1.8), (.08, -.4, 1.88), "iron")
        else:
            post(bm, uv, col, 0, -.5, 1.6, 1.62, .0, board)
            sides = 8
            ring = [bm.verts.new((.07, -.5 + math.cos(2 * math.pi * i / sides) * .17, 1.8 + math.sin(2 * math.pi * i / sides) * .17)) for i in range(sides)]
            paint(bm, uv, col, [bm.faces.new(ring)], "brass", dark=.9)
    return make


def chimney(swatch, tall):
    def make(bm, uv, col):
        box(bm, uv, col, (-.4, -.4, 0), (.4, .4, tall), swatch, "stone_dark")
        box(bm, uv, col, (-.5, -.5, tall), (.5, .5, tall + .18), "stone")   # the cap
        box(bm, uv, col, (-.22, -.22, tall + .18), (.22, .22, tall + .4), "soot")   # the flue
    return make


PIECES = [   # (node, kind, weight, make)
    ("wall_plain_a", "wall", 4, wall_plain("plaster", "stone", None)),
    ("wall_plain_b", "wall", 3, wall_plain("plaster_warm", "stone", "timber")),
    ("wall_plain_c", "wall", 2, wall_plain("brick", "stone_dark", None)),
    ("wall_window_a", "wall", 3, wall_with_hole("plaster", "stone", None, -.5, .5, 1.2, 2.2, shutters=True)),
    ("wall_window_b", "wall", 2, wall_with_hole("plaster_warm", "stone", "timber", -.45, .45, 1.15, 2.15)),
    ("wall_door_a", "wall", 3, wall_with_hole("plaster", "stone", None, -.55, .55, 0, 2.3, leaf="door", door=True)),
    ("wall_door_b", "wall", 2, wall_with_hole("brick", "stone_dark", None, -.6, .6, 0, 2.4, leaf="timber_light", door=True)),
    ("wall_corner_a", "corner", 3, corner("plaster", "timber")),
    ("wall_corner_b", "corner", 2, corner("brick", "stone_dark")),
    ("arch_stone_a", "arch", 2, arch_stone()),
    ("arch_gate_a", "arch", 2, arch_gate()),
    ("roof_a", "roof", 4, roof("shingle")),
    ("roof_b", "roof", 3, roof("tile")),
    ("roof_c", "roof", 1, roof("thatch")),
    ("roof_end_a", "roof", 3, roof_end("plaster")),
    ("stall_a", "stall", 3, stall("canvas", ("canvas_red", "thatch", "tile"))),
    ("stall_b", "stall", 3, stall("canvas_red", ("plaster", "brick", "stone"))),
    ("stall_c", "stall", 1, stall("thatch", ("iron", "stone_dark", "iron"))),
    ("counter_bank_a", "counter", 1, counter_bank()),
    ("counter_bar_a", "counter", 1, counter_bar()),
    ("sign_tavern_a", "sign", 1, sign("mug", "timber_light")),
    ("sign_smith_a", "sign", 1, sign("anvil", "stone_dark")),
    ("sign_bank_a", "sign", 1, sign("coin", "timber")),
    ("chimney_a", "chimney", 2, chimney("brick", 2.0)),
    ("chimney_b", "chimney", 2, chimney("stone", 2.6)),
]

# Recipes: a building is a list of placements (piece, x, z in metres on the ground plane of the building, rot = quarter turns about Y). The 2 x 2 module building is 6 x 6 m;
# walls sit on the module edges, roofs on the module centres, front (the door wall) at +Z. World places the same lists; this script assembles them for the stills.
RECIPES = {
    "bank": {"modules": [2, 2], "parts": [
        ["wall_door_b", 0, 3, 0], ["wall_window_a", 0, -3, 2], ["wall_window_b", -3, 0, 3], ["wall_plain_c", 3, 0, 1],
        ["wall_plain_c", -3, 3, 0], ["wall_corner_b", 3, 3, 0], ["wall_corner_b", -3, 3, 0], ["wall_corner_b", 3, -3, 0], ["wall_corner_b", -3, -3, 0],
        ["roof_b", -1.5, 0, 0], ["roof_b", 1.5, 0, 0], ["chimney_a", 2.2, -1.5, 0], ["sign_bank_a", -1.2, 3.3, 0], ["counter_bank_a", 0, 1.2, 0]]},
    "smithy": {"modules": [2, 2], "parts": [
        ["wall_plain_b", 0, -3, 2], ["wall_window_a", -3, 0, 3], ["wall_plain_b", 3, 0, 1], ["wall_corner_a", 3, -3, 0], ["wall_corner_a", -3, -3, 0],
        ["roof_a", -1.5, 0, 0], ["roof_a", 1.5, 0, 0], ["chimney_b", -2.4, -1.4, 0], ["stall_c", 0, 3.4, 0], ["sign_smith_a", 3.3, 1.2, 1]]},
    "inn": {"modules": [3, 2], "parts": [
        ["wall_door_a", -1.5, 3, 0], ["wall_window_a", 1.5, 3, 0], ["wall_window_b", -4.5, 0, 3], ["wall_plain_b", 4.5, 0, 1],
        ["wall_window_a", -3, -3, 2], ["wall_plain_a", 0, -3, 2], ["wall_window_b", 3, -3, 2],
        ["wall_corner_a", 4.5, 3, 0], ["wall_corner_a", -4.5, 3, 0], ["wall_corner_a", 4.5, -3, 0], ["wall_corner_a", -4.5, -3, 0],
        ["roof_a", -3, 0, 0], ["roof_a", 0, 0, 0], ["roof_a", 3, 0, 0], ["chimney_a", 3.6, -1.4, 0], ["sign_tavern_a", -3.0, 3.3, 0], ["counter_bar_a", 1.5, 0.8, 0]]},
}

bpy.ops.wm.read_factory_settings(use_empty=True)
make_atlas()
mat = bpy.data.materials.new("TownKit")
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

manifest = {"module": M, "front": "+Z (glTF)", "pieces": {}, "recipes": RECIPES, "atlas": "256x256, 16 swatches"}
x = 0.0
for name, kind, weight, make in PIECES:
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
    manifest["pieces"][name] = {"kind": kind, "weight": weight, "tris": tris, "size": dims}
    ob.location.x = x
    x += 4.2
    print(f"TOWN {name:16s} {tris:4d} tris (budget {BUDGET[kind]}) size {dims}")
    if tris > BUDGET[kind]:
        raise SystemExit(f"{name} is over its budget: {tris} > {BUDGET[kind]}")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE", export_yup=True)
with open(MANIFEST, "w") as f:
    json.dump(manifest, f, indent=1)
print("TOWN-TOTAL", sum(p["tris"] for p in manifest["pieces"].values()), "tris,", len(manifest["pieces"]), "pieces ->", OUT)
