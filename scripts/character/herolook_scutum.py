"""Hero Look pilot (docs/state/herolook.md): the generated scutum (TRELLIS.2, src/assets/source/creatures/legionary-scutum.glb) cut to a
phone budget and placed where today's kit shield sits on the hero's left forearm, in the hero's rest (T) space. Writes
artifacts/herolook/scutum-placed.glb: one mesh, vertices in rest world space, for scripts/herolook-attach.py to hang off lowerarm_l.
    blender -b --python-exit-code 1 -P scripts/character/herolook_scutum.py -- [--height 1.02] [--tris 6000]
"""
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
HEIGHT = float(args[args.index("--height") + 1]) if "--height" in args else 1.02
TRIS = int(args[args.index("--tris") + 1]) if "--tris" in args else 6000


def world(o):
    dg = bpy.context.evaluated_depsgraph_get()
    e = o.evaluated_get(dg)
    me = e.to_mesh()
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get("co", co)
    e.to_mesh_clear()
    M = np.array(o.matrix_world)
    return co.reshape(n, 3) @ M[:3, :3].T + M[:3, 3]


def frame(P):
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c, full_matrices=False)
    return c, vt  # rows: largest, middle, smallest extent


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path("src/assets/warrior.glb").resolve()))
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
rig.animation_data_clear()
for p in rig.pose.bones:
    p.matrix_basis.identity()
bpy.context.view_layer.update()
fore = rig.pose.bones["lowerarm_l"]

# Placed in the Idle pose the Profile, versus card and kill screen show (Idle at 0.5 s, the loot-layers frame): upright, face forward and
# a little out to the left, boss over the forearm. Then carried back into the forearm's REST frame, so as a child of lowerarm_l it sits
# exactly there in Idle and follows the arm in every other clip.
rest_bone = rig.matrix_world @ fore.matrix
idle = next(a for a in bpy.data.actions if a.name.startswith("Idle"))
rig.animation_data_create()
rig.animation_data.action = idle
fps = bpy.context.scene.render.fps
bpy.context.scene.frame_set(int(round(idle.frame_range[0] + 0.5 * fps)))
bpy.context.view_layer.update()
idle_bone = rig.matrix_world @ fore.matrix
i_head, i_tail = rig.matrix_world @ fore.head, rig.matrix_world @ fore.tail
normal = Vector((0.35, -1.0, 0.0)).normalized()   # Blender -Y is the fighter's front, +X his left
up = Vector((0, 0, 1))
width = up.cross(normal).normalized()
up = normal.cross(width).normalized()
to_rest = rest_bone @ idle_bone.inverted()
print("idle forearm", np.round(np.array(i_head), 3), np.round(np.array(i_tail), 3))
for o in list(bpy.data.objects):
    if o.type != "ARMATURE" or True:
        bpy.data.objects.remove(o, do_unlink=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(Path("src/assets/source/creatures/legionary-scutum.glb").resolve()))
s = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
bpy.context.view_layer.objects.active = s
s.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for p in s.data.polygons)
if tris > TRIS:
    m = s.modifiers.new("phone", "DECIMATE")
    m.ratio = TRIS / tris
    bpy.ops.object.modifier_apply(modifier=m.name)
P = world(s)
sc, sv = frame(P)
ext = (P - sc) @ sv.T
h = ext[:, 0].max() - ext[:, 0].min()
# The source's own axes: height = longest, face normal = thinnest; its front is the side the boss bulges to (the far tail of the normal axis).
s_up, s_w, s_n = Vector(sv[0]), Vector(sv[1]), Vector(sv[2])
if ext[:, 2].max() < -ext[:, 2].min():
    s_n = -s_n
if s_up.z < 0:
    s_up = -s_up
s_w = s_up.cross(s_n)  # right-handed: width, up, normal
src = Matrix((s_w, s_up, s_n)).transposed()  # columns = source axes
dst = Matrix((width, up, normal)).transposed()
k = HEIGHT / h
rot = dst @ src.inverted()
# The boss sits on the forearm's mid-point, the shield face a hand's depth outside the kit disc's plane (a scutum is held off the arm).
centre = i_head * 0.4 + i_tail * 0.6 + normal * 0.09
s.data.transform(Matrix.Translation(-Vector(sc)))
s.data.transform(rot.to_4x4() @ Matrix.Diagonal((k, k, k, 1)))
s.data.transform(Matrix.Translation(centre))
s.data.transform(to_rest)
s.data.update()
s.name = "HeroScutum"
print(f"scutum: {len(s.data.polygons)} faces, {h * k:.2f} m tall, centre {np.round(np.array(centre), 3)}")
out = Path("artifacts/herolook/scutum-placed.glb")
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out.resolve()), use_selection=True, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85)
print("wrote", out)
