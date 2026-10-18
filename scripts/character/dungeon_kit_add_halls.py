# Adds the Zone 2 "Nightborn halls" pieces to the dungeon kit (Dom's ruling 2026-10-18: an open stone approach leads into CLOSED underground halls with a ceiling). The kit had no roof and no floor, so the
# dungeon read as Stonehenge. Seven nodes, built procedurally (a tiling floor and a wall run that joins end to end cannot come out of an image-to-3D model) and dressed with the kit's OWN two stone
# materials, so there is no new style and no new image: `cave_wall-v2` (dark rubble) on walls, corner and vault, `cave_doorway-v2` (the lighter cut stone) on floor and ceiling slab. The sconce is flat colour.
#   blender -b -P scripts/character/dungeon_kit_add_halls.py -- <dungeon-kit.glb> <out.glb>      then: node scripts/pack-world-body.mjs <out.glb>
#
# THE GRID (donor: how classic dungeons kit a crypt, the 4 m module of modular dungeon sets and of UO / Morrowind interior cells): a cell is 4 x 4 m, a wall is 3.8 m (the cave_wall's height, so a hero with a raised sword
# clears the ceiling), every piece has its GROUND-CENTRE origin (y = 0 on the floor), front facing +Z, like the rest of the kit. A wall HUGS THE BACK EDGE of its cell (z = -2 .. -1.2, 0.8 m thick) and is flush
# at both x ends, so `hall_wall` copies at x = k * 4 m join with no gap and no overlap, and a copy turned 90 degrees runs along a side edge. `hall_corner` is the back wall plus the left wall of one cell (the L
# of a room corner; turn it for the other three). The ceiling pieces sit AT wall height in the same cell: `hall_ceiling` is a flat slab (3.8 .. 4.1 m), `hall_vault` a barrel vault along z (springs at 3.8 m, crown
# 5.4 m) that rests on two wall runs. `hall_floor` is a flagstone tile whose top is y = 0. `wall_sconce` stands against the back plane (z = 0), 2.0 m up, and carries an EMPTY child `sconce_light` (the light
# World maps: colour, intensity, reach and flicker are in its glTF extras; a real KHR point light per prop would cost a dynamic light each, so the engine pools them off this node).
import math
import random
import sys

import bpy
import bmesh

KIT, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
CELL, H, T = 4.0, 3.8, 0.8        # cell width, wall height, wall thickness
PLINTH_H, PLINTH_OUT, CAP_H = 0.45, 0.1, 0.3
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KIT)
mats = {m.name: m for m in bpy.data.materials}
STONE, CUT = mats["cave_wall-v2"], mats["cave_doorway-v2"]
# Blender is Z-up and exports y -> -z: so the cell's BACK edge (glTF z = -2) is Blender y = +2, and the front (glTF +Z) is Blender -Y.


def flat(name, rgb, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Roughness"].default_value = 0.75
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
        b.inputs["Emission Strength"].default_value = 1.0
    return m


IRON = flat("sconce_iron", (0.10, 0.09, 0.085))
FLAME = flat("sconce_flame", (1.0, 0.55, 0.15), emit=(1.0, 0.55, 0.15))


def piece(name, x, mat, builder, uv_off=(0.0, 0.0)):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    builder(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new("UVMap")   # box projection in metres: one UV unit = 4 m of the stone atlas, whatever face it lands on
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            c = lp.vert.co
            u, v = ((c.y, c.z) if ax == 0 else (c.x, c.z) if ax == 1 else (c.x, c.y))
            lp[uv].uv = ((u + 2.0) / 6.0 + 0.30 + uv_off[0], v / 6.0 + uv_off[1])   # 6 m of stone per UV unit, windowed to u 0.30..0.97, v 0..0.63+: the cave wall's atlas has a pure black block at u < 0.21, v > 0.67 that a 4 m wall would otherwise show as a window. No per-vertex wrap (it folds a face's two ends onto one u and smears the atlas)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = (x, 0.0, 0.0)   # laid in the kit's row (lantern sits at 9): a row's placement ignores the node's own x
    me.materials.append(mat)
    return o


def box(bm, x0, x1, y0, y1, z0, z1):
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in q])


def floor_tile(bm):
    # four 1.94 m flags with a 0.06 m joint, so the grid shows across every tile edge too; the top is y = 0 (Blender z = 0), 0.25 m deep, a hair of height per flag so the light breaks
    rnd = random.Random(2610)
    for i, (cx, cy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        d = rnd.uniform(0.0, 0.012)
        box(bm, cx - 0.97, cx + 0.97, cy - 0.97, cy + 0.97, -0.25, -d)


def ceiling_slab(bm):
    box(bm, -2.0, 2.0, -2.0, 2.0, H, H + 0.3)                                    # the slab
    for x0, x1, y0, y1 in ((-2.0, 2.0, -2.0, -1.75), (-2.0, 2.0, 1.75, 2.0), (-2.0, -1.75, -1.75, 1.75), (1.75, 2.0, -1.75, 1.75)):
        box(bm, x0, x1, y0, y1, H - 0.15, H)                                     # a 0.25 m frame on the underside: neighbouring slabs read as a coffered grid


def vault(bm, n=12):
    # a barrel vault along z: outer half-ellipse 2.0 x 1.6 from the spring line (3.8 m), inner 1.2 x 1.3 (the wall's inner face), so it is 0.8 m thick at the spring and 0.3 m at the crown
    outer = [(2.0 * math.cos(math.pi * i / n), H + 1.6 * math.sin(math.pi * i / n)) for i in range(n + 1)]
    inner = [(1.2 * math.cos(math.pi * i / n), H + 1.3 * math.sin(math.pi * i / n)) for i in range(n + 1)]
    ring = {y: ([bm.verts.new((x, y, z)) for x, z in outer], [bm.verts.new((x, y, z)) for x, z in inner]) for y in (-2.0, 2.0)}
    (of, if_), (ob, ib) = ring[-2.0], ring[2.0]
    for i in range(n):
        bm.faces.new((of[i], of[i + 1], ob[i + 1], ob[i]))        # outer top
        bm.faces.new((if_[i], ib[i], ib[i + 1], if_[i + 1]))      # underside
        bm.faces.new((of[i], if_[i], if_[i + 1], of[i + 1]))      # end cap at y = -2
        bm.faces.new((ob[i], ob[i + 1], ib[i + 1], ib[i]))        # end cap at y = +2
    for k in (0, n):                                              # the two spring faces, sitting on the walls
        bm.faces.new((of[k], ob[k], ib[k], if_[k]))


def wall_run(bm, corner=False):
    box(bm, -2.0, 2.0, 1.2, 2.0, 0.0, H)                              # the slab on the back edge
    box(bm, -2.0, 2.0, 1.2 - PLINTH_OUT, 1.2, 0.0, PLINTH_H)          # plinth and cap course run the whole 4 m, so copies join
    box(bm, -2.0, 2.0, 1.2 - PLINTH_OUT, 1.2, H - CAP_H, H)
    if corner:                                                        # the left wall, butted against the back wall at y = 1.2
        box(bm, -2.0, -2.0 + T, -2.0, 1.2, 0.0, H)
        box(bm, -2.0 + T, -2.0 + T + PLINTH_OUT, -2.0, 1.2 - PLINTH_OUT, 0.0, PLINTH_H)
        box(bm, -2.0 + T, -2.0 + T + PLINTH_OUT, -2.0, 1.2 - PLINTH_OUT, H - CAP_H, H)


def cyl(o_name, mat, r0, r1, z0, z1, y=0.0, seg=8):
    me = bpy.data.meshes.new(o_name)
    bm = bmesh.new()
    bot = [bm.verts.new((r0 * math.cos(2 * math.pi * i / seg), y + r0 * math.sin(2 * math.pi * i / seg), z0)) for i in range(seg)]
    top = [bm.verts.new((r1 * math.cos(2 * math.pi * i / seg), y + r1 * math.sin(2 * math.pi * i / seg), z1)) for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    return bpy.data.objects.new(o_name, me)


OBJS = [
    piece("hall_floor", 14.0, CUT, floor_tile, (0.0, 0.10)),
    piece("hall_ceiling", 19.0, CUT, ceiling_slab, (0.0, 0.20)),
    piece("hall_vault", 24.0, STONE, vault, (0.0, 0.0)),
    piece("hall_wall", 29.0, STONE, wall_run, (0.0, 0.0)),   # wall and corner share an offset, so a corner's arms match the runs beside it
    piece("hall_corner", 34.0, STONE, lambda bm: wall_run(bm, corner=True), (0.0, 0.0)),
]
# the sconce: a back plate on the wall plane (Blender y = 0 .. -0.05 toward the front), an arm out to y = -0.40, a cup, a torch and its flame; the parts join into one mesh per material
sc = bpy.data.objects.new("wall_sconce", None)
bpy.context.scene.collection.objects.link(sc)
sc.location = (39.0, 0.0, 0.0)
sc_parts = []
for name, mat, build in (
    ("plate", IRON, lambda bm: box(bm, -0.13, 0.13, -0.05, 0.0, 1.85, 2.35)),
    ("arm", IRON, lambda bm: box(bm, -0.03, 0.03, -0.40, -0.05, 2.0, 2.06)),
    ("handle", IRON, None),
    ("cup", IRON, None),
    ("flame", FLAME, None),
):
    if build:
        o = piece("sconce_" + name, 0.0, mat, build)
    else:
        o = {"handle": lambda: cyl("sconce_handle", IRON, 0.035, 0.035, 1.9, 2.3, y=-0.40),
             "cup": lambda: cyl("sconce_cup", IRON, 0.05, 0.10, 2.25, 2.37, y=-0.40),
             "flame": lambda: cyl("sconce_flame", FLAME, 0.085, 0.01, 2.37, 2.67, y=-0.40, seg=6)}[name]()
        bpy.context.scene.collection.objects.link(o)
    o.parent = sc
    sc_parts.append(o)
bpy.ops.object.select_all(action="DESELECT")
for o in sc_parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = sc_parts[0]
bpy.ops.object.join()   # one mesh with two materials: iron and flame
joined = bpy.context.view_layer.objects.active
joined.name = joined.data.name = "wall_sconce_mesh"
joined.parent = sc
light = bpy.data.objects.new("sconce_light", None)
bpy.context.scene.collection.objects.link(light)
light.parent = sc
light.location = (0.0, -0.40, 2.50)
light.empty_display_type = "SPHERE"
light["light"] = '{"color":"#ff9a47","intensity":1.2,"reach":9.0,"flicker":0.15}'   # warm torch; World's theme row reads it (the pooled light budget is the engine's)
for o in OBJS:
    print("PIECE", o.name, [round(v, 3) for v in o.dimensions], len(o.data.polygons), "polys")
print("SCONCE", [round(v, 3) for v in joined.dimensions])
import numpy as np
for img in bpy.data.images:   # same re-encode as the lantern script: every texture goes out at the export quality
    if img.size[0] and img.size[1]:
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        img.pixels.foreach_set(px)
        img.update()
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_image_format="JPEG", export_jpeg_quality=78, export_extras=True)
print("KIT-OUT", OUT, sorted(o.name for o in bpy.data.objects))
