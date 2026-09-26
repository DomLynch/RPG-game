# Hero Look READY gate: does any clip tear the fitted set at a joint? Every clip of a skinned hero GLB is sampled; at each sample every
# edge's length is compared with its bind length. A tear is an edge stretched past TEAR x (a mesh split open at an elbow, knee or neck).
# Prints one line per clip (worst stretch, torn-edge count, the frame and bone region of the worst) and exits 1 if any clip tears.
#   blender -b --python-exit-code 1 -P scripts/character/herolook_clipcheck.py -- public/herolook/<set>.glb [tear 2.0] [step 4]
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SRC = argv[0]
TEAR = float(argv[1]) if len(argv) > 1 else 2.0
STEP = int(argv[2]) if len(argv) > 2 else 4
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.find_armature() == rig]
scene = bpy.context.scene


def lengths(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    ed = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", ed)
    co, ed = co.reshape(-1, 3), ed.reshape(-1, 2)
    out = np.linalg.norm(co[ed[:, 0]] - co[ed[:, 1]], axis=1), co[ed].mean(axis=1)
    ev.to_mesh_clear()
    return out


rig.animation_data_create()
rig.animation_data.action = None
for p in rig.pose.bones:
    p.matrix_basis.identity()
dg = bpy.context.evaluated_depsgraph_get()
dg.update()
bind = {o.name: lengths(o, dg)[0] for o in meshes}
failed = 0
for action in bpy.data.actions:
    rig.animation_data.action = action
    if hasattr(rig.animation_data, "action_slot") and action.slots:
        rig.animation_data.action_slot = action.slots[0]
    f0, f1 = (int(x) for x in action.frame_range)
    worst, torn, where = 1.0, 0, ""
    for f in list(range(f0, f1 + 1, STEP)) + [f1]:
        scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for o in meshes:
            ln, mid = lengths(o, dg)
            ratio = ln / np.maximum(bind[o.name], 1e-5)
            ratio[bind[o.name] < 0.002] = 1.0   # sub-2 mm edges: noise, not a tear
            i = int(ratio.argmax())
            torn = max(torn, int((ratio > TEAR).sum()))
            if ratio[i] > worst:
                worst, where = float(ratio[i]), f"{o.name} f{f} at ({mid[i][0]:.2f}, {mid[i][1]:.2f}, {mid[i][2]:.2f})"
    bad = worst > TEAR
    failed += bad
    print(f"CLIP {action.name:<28} worst x{worst:.2f} torn {torn:>4} {'TEAR' if bad else 'ok'}  {where}", flush=True)
print(f"CLIPCHECK {SRC}: {len(bpy.data.actions)} clips, {failed} tear past x{TEAR}", flush=True)
sys.exit(1 if failed else 0)
