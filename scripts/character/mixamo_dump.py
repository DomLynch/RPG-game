# Dump a skinless Mixamo FBX to plain JSON: the rest pose and every frame's world head position + world rotation of each bone, in three.js space (Y up).
# The retarget itself runs in Node (scripts/build-special-clips.mjs) against warrior.glb, so no glTF/Blender axis conversion is ever involved.
# The FBX files are Adobe Mixamo content: they never enter the repo (docs/specs/combat/mixamo-plan.md); the JSON stays in the private drop folder too.
#   blender -b -P scripts/character/mixamo_dump.py -- <out-dir> <file.fbx> [...]
import bpy, sys, os, json
from mathutils import Matrix

args = sys.argv[sys.argv.index('--') + 1:]
out_dir, paths = args[0], args[1:]
# Blender (X right, Y forward, Z up) -> three.js (X right, Y up, Z toward the viewer): (x, y, z) -> (x, z, -y)
C = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
Ci = C.inverted()


def pack(m):
    t = (C @ m.to_translation())
    q = (C @ m.to_3x3() @ Ci).to_quaternion()
    return [round(t.x, 5), round(t.y, 5), round(t.z, 5), round(q.w, 6), round(q.x, 6), round(q.y, 6), round(q.z, 6)]


for path in paths:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    bones = [b.name for b in arm.data.bones]
    rest = {b.name: pack(arm.matrix_world @ b.matrix_local) for b in arm.data.bones}
    action = bpy.data.actions[0]
    arm.animation_data_create().action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    f0, f1 = [int(round(x)) for x in action.frame_range]
    frames = []
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        frames.append([pack(arm.matrix_world @ arm.pose.bones[n].matrix) for n in bones])
    doc = {'file': os.path.basename(path), 'fps': bpy.context.scene.render.fps, 'bones': bones,
           'parents': [arm.data.bones[n].parent.name if arm.data.bones[n].parent else None for n in bones], 'rest': rest, 'frames': frames}
    name = os.path.splitext(os.path.basename(path))[0].replace(' ', '_') + '.json'
    with open(os.path.join(out_dir, name), 'w') as fh:
        json.dump(doc, fh, separators=(',', ':'))
    print('DUMPED', name, len(frames), 'frames', len(bones), 'bones')
