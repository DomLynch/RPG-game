# Inkverse red accent: ONE cloth piece for the hero rig (Strategy 2026-10-23: the hero has no cloth to redden, only the Heraldry hip patch). A short scarf: a collar band
# round the neck and a half-cape tail down the back from the left shoulder, on the hero's OWN skeleton (neck_01, spine_03, spine_02: no new rig, no new bones), as its own
# skinned mesh `Cloth_InkScarf` with its own material `InkScarf` (flat red, so the ink look's red tag can name it). Built the way scripts/character/town_clothes.py builds
# its garments (explicit weights per ring, sections taken from the body), and small: <= 90 tris.
#   blender -b -P scripts/character/ink_scarf.py -- <hero warrior.glb> <out.glb>        (INK_FULL=1: body and clips kept, for renders)
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
BUDGET = 90

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
W = body.matrix_world
bverts = [W @ v.co for v in body.data.vertices]


def bone(name):
    b = arm.data.bones[name]
    return arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local


def section(z, half=.30):
    """Half-width (x), half-depth (y) and centre y of the body's torso cross-section at height z (arms excluded by |x| < half)."""
    pts = [v for v in bverts if abs(v.z - z) < .04 and abs(v.x) < half]
    if not pts:
        return .17, .11, 0.0
    return max(abs(v.x) for v in pts), (max(v.y for v in pts) - min(v.y for v in pts)) / 2, (max(v.y for v in pts) + min(v.y for v in pts)) / 2


neck_z = bone("neck_01")[0].z
toe, foot = bone("foot_l")[1], bone("foot_l")[0]
FWD = 1.0 if (toe.y - foot.y) >= 0 else -1.0   # which way the body faces along y; the tail hangs on the other side
BACK = -FWD
LEFT = 1.0 if bone("thigh_l")[0].x > 0 else -1.0   # which side of x the left side is on
WEIGHTS = {}


def lerp(a, b, t):
    return a + (b - a) * t


def collar(bm):
    """Two-and-a-half rings round the neck, flaring onto the shoulders."""
    sides, rings = 12, []
    for dz, rx, ry, w in ((.035, .095, .095, {"neck_01": .6, "spine_03": .4}), (-.01, .125, .115, {"neck_01": .3, "spine_03": .7}), (-.07, .175, .13, {"spine_03": 1.0})):
        z = neck_z + dz
        _, _, cy = section(z - .03)
        ring = []
        for i in range(sides):
            a = 2 * math.pi * i / sides
            v = bm.verts.new((math.cos(a) * rx, cy + math.sin(a) * ry, z))
            WEIGHTS[v.co.to_tuple()] = w
            ring.append(v)
        rings.append(ring)
    faces = []
    for a, b in zip(rings, rings[1:]):
        faces += [bm.faces.new((a[i], a[(i + 1) % sides], b[(i + 1) % sides], b[i])) for i in range(sides)]
    return faces


def tail(bm):
    """A ribbon down the back from the left shoulder, drifting toward the spine, hugging the back's section."""
    rows, length, z0 = 6, .46, neck_z - .07
    prev = None
    faces = []
    for r in range(rows):
        t = r / (rows - 1)
        z = z0 - length * t
        hx, hy, cy = section(z)
        cx = lerp(.085 * LEFT, -.02 * LEFT, t)
        half = lerp(.085, .055, t)
        y = cy + BACK * (hy + .03 + .012 * t)
        row = []
        for k, (dx, dy) in enumerate(((-half, 0.0), (0.0, BACK * .014), (half, 0.0))):
            v = bm.verts.new((cx + dx, y + dy, z))
            if t <= .2:
                WEIGHTS[v.co.to_tuple()] = {"spine_03": 1.0}
            else:
                k2 = min(.6, (t - .2) / .5 * .6)
                WEIGHTS[v.co.to_tuple()] = {"spine_03": 1 - k2, "spine_02": k2}
            row.append(v)
        if prev:
            for k in range(2):
                faces.append(bm.faces.new((prev[k], prev[k + 1], row[k + 1], row[k])))
        prev = row
    return faces


me = bpy.data.meshes.new("Cloth_InkScarf")
ob = bpy.data.objects.new("Cloth_InkScarf", me)
bpy.context.collection.objects.link(ob)
bm = bmesh.new()
faces = collar(bm) + tail(bm)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True

mat = bpy.data.materials.new("InkScarf")
mat.use_nodes = True
mat.use_backface_culling = False
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (.72, .08, .07, 1.0)   # the red the tag keys on
bsdf.inputs["Roughness"].default_value = .95
bsdf.inputs["Metallic"].default_value = 0.0
mat.diffuse_color = (.72, .08, .07, 1.0)
ob.data.materials.append(mat)

tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
print(f"INKSCARF {tris} tris (budget {BUDGET}) neck z {neck_z:.3f} back {'+y' if BACK > 0 else '-y'} left {'+x' if LEFT > 0 else '-x'}")
if tris > BUDGET:
    raise SystemExit(f"over budget: {tris} > {BUDGET}")
for g in {g for w in WEIGHTS.values() for g in w}:
    ob.vertex_groups.new(name=g)
for v in ob.data.vertices:
    for g, wt in WEIGHTS[v.co.to_tuple()].items():
        ob.vertex_groups[g].add([v.index], wt, "REPLACE")
ob.parent = arm
m = ob.modifiers.new("Armature", "ARMATURE")
m.object = arm

if os.environ.get("INK_FULL") != "1":   # the shipped file is the scarf plus the armature's joint names: the game skins it onto the hero's own skeleton by bone name
    for o in [o for o in bpy.data.objects if o.type == "MESH" and o is not ob]:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=False, export_animations=os.environ.get("INK_FULL") == "1", export_skins=True, export_yup=True)
print("INKSCARF-OUT", OUT)
