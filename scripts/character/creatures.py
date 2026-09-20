"""Weight the intact reconstructed A-pose, then bind to original combat joints."""

import bpy
import math
import sys
import json
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector

root = Path("artifacts/character/creatures")
family = sys.argv[sys.argv.index("--") + 1]
recipes = {
    "minotaur": ("pitborn", 65, 1.35, (0.055, -0.16, -0.045), 1.85, 48),
    "wraith": ("nightborn", 45, 0.97, (0, -0.20, -0.015), 1.88, 8),
    "werewolf": ("pitborn", 65, 1.10, (0.025, -0.08, -0.045), 1.85, 16),
    "skeleton": ("veteran", 60, 1.0, (0, -0.04, -0.025), 1.80, 0),
    # Re-proportioned donor (build-warrior.mjs BUILD.dwarf, 1.494 m standing): true dwarf height; fingers follow the donor's finger tracks.
    "dwarf": ("source/creatures/dwarf-donor", 60, 1.0, (0, -0.04, -0.025), 1.494, 8),
    # The Executioner is his own donor: the v5 rig (backup) carries his 1.32x root, scythe and clips. Arm pose solved
    # numerically so the posed WeaponDrawn origin lands in the reconstruction's palm (angle 64, reach 1.15, 0.011 m).
    "executioner": ("source/backups/executioner-v5", 64, 1.15, (0.02, -0.12, 0), 1.87, 16),
}
base, arm_angle, arm_stretch, arm_shift, height, smooth_steps = recipes[family]
# The absolute heights below were tuned on ~1.80 m donors; the short dwarf donor scales them. Every other family keeps k = 1.
k = height / 1.80 if family == "dwarf" else 1.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(f"src/assets/{base}.glb").resolve()))
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
rig.animation_data_clear()
rig.matrix_world.identity()
for p in rig.pose.bones:
    p.matrix_basis.identity()
rig.data.pose_position = "POSE"
bpy.context.view_layer.update()
# The weight donor is posed to the reconstruction. The final clips remain untouched.
for side, sgn in [("l", 1), ("r", -1)]:
    p = rig.pose.bones["upperarm_" + side]
    pivot = p.head.copy()
    angle = math.radians(arm_angle) * sgn
    stretch = arm_stretch
    shift = Vector((sgn * arm_shift[0], arm_shift[1], arm_shift[2]))
    p.matrix = (
        Matrix.Translation(pivot + shift)
        @ Matrix.Rotation(angle, 4, "Y")
        @ Matrix.Translation(-pivot)
        @ p.matrix
        @ Matrix.Diagonal((1, stretch, 1, 1))
    )
    if family == "minotaur":
        thigh = rig.pose.bones["thigh_" + side]
        thigh.matrix = Matrix.Translation((sgn * 0.12, 0, 0)) @ thigh.matrix
bpy.context.view_layer.update()
segments = {
    p.name: (p.head.copy(), p.tail.copy())
    for p in rig.pose.bones
    if any(p.name.startswith(n) for n in ["upperarm_", "lowerarm_", "hand_"])
}
C = Matrix.Rotation(-math.pi / 2, 4, "X")
ci = C.inverted()
binds = {
    p.name: [
        float((C @ (p.matrix @ p.bone.matrix_local.inverted()).inverted() @ ci)[r][c])
        for c in range(4)
        for r in range(4)
    ]
    for p in rig.pose.bones
}
(root / f"{family}-binds.json").write_text(json.dumps(binds))
parts = [bpy.data.objects[n] for n in ["Skin", "Photo"] if n in bpy.data.objects]
for obj in parts:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        if mod.type == "ARMATURE":
            bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = parts[0]
body.name = "WeightSource"
# Original T skeleton is retained in the exported package; assembly supplies A-pose inverse binds.
for p in rig.pose.bones:
    p.matrix_basis.identity()
bpy.context.view_layer.update()
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(
    filepath=str((Path(f"src/assets/source/creatures/{family}.glb")).resolve())
)
mesh = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
mesh.name = "CreatureBody"
coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
lo = min(v.z for v in coords)
hi = max(v.z for v in coords)
for v, p in zip(mesh.data.vertices, coords):
    v.co = Vector(
        (
            p.x * height / (hi - lo),
            p.y * height / (hi - lo),
            (p.z - lo) * height / (hi - lo),
        )
    )
mesh.matrix_world.identity()
mesh.data.update()
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
# The reconstruction duplicates vertices at UV islands. Weld coincident geometry
# before decimation so islands cannot simplify apart and open cracks when posed.
# Blender stores UVs per face corner, so their texture seams remain intact.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.00001)
bpy.ops.object.mode_set(mode="OBJECT")
mesh.data.calc_loop_triangles()
tris = len(mesh.data.loop_triangles)
if tris > 45000:
    mod = mesh.modifiers.new("Mobile surface", "DECIMATE")
    mod.ratio = 45000 / tris
    bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.data_transfer(
    data_type="VGROUP_WEIGHTS",
    vert_mapping="POLYINTERP_NEAREST",
    layers_select_src="ALL",
    layers_select_dst="NAME",
    use_create=True,
)
head = mesh.vertex_groups["Head"]
pelvis = mesh.vertex_groups["pelvis"]
for v in mesh.data.vertices:
    x, y, z = v.co
    # Crown and horns are one rigid skull. Wisps hang from the pelvis, never knee joints.
    rigid = (
        head
        if z > 1.62 * k or (abs(x) < 0.20 and z > 1.53 * k)
        else pelvis
        if (family == "wraith" and z < 1.04)
        or (family == "minotaur" and abs(x) < 0.11 and z < 0.98 and y > 0.16)
        else None
    )
    ws = (
        [(rigid.index, 1)]
        if rigid
        else sorted(
            [(g.group, g.weight) for g in v.groups if g.weight > 1e-6],
            key=lambda a: -a[1],
        )[:4]
    )
    # Disallow nearest-body transfer from attaching claws to the adjacent thigh.
    edge = (0.23 + max(0, 1.30 - z) * 0.23) if family in ("minotaur", "werewolf", "executioner") else 0.27
    if family == "skeleton":
        edge = 0.185 + max(0, 1.4 - z) * 0.26
    if family == "dwarf":
        edge = 0.185 * k + max(0, 1.4 * k - z) * 0.26
    arm_mix = max(
        0, min(1, (abs(x) - edge) / (0.10 if family in ("minotaur", "werewolf", "executioner") else 0.055))
    ) * max(0, min(1, (1.62 * k - z) / 0.10))
    if rigid == head:
        arm_mix = 0
    arm_mix *= max(0, min(1, (z - (0.50 * k if family in ("minotaur", "werewolf", "skeleton", "dwarf", "executioner") else 0.92)) / 0.10))
    # Human hands (the Executioner): keep the donor's transferred finger weights on the arm so the clips curl his
    # fingers round the haft; the segment blend below is for claws and mitts and pins fingers rigid to the hand.
    keep_fingers = family in ("executioner", "dwarf") and arm_mix > 0.5
    if not rigid and not keep_fingers:
        arm_names = (
            "upperarm",
            "lowerarm",
            "hand",
            "thumb",
            "index",
            "middle",
            "ring",
            "pinky",
            "clavicle",
        )
        ws = [
            (i, w)
            for i, w in ws
            if not mesh.vertex_groups[i].name.startswith(arm_names)
        ]
        total = sum(w for _, w in ws)
        if total:
            ws = [(i, w / total) for i, w in ws]
        else:
            side = "l" if x > 0 else "r"
            name = (
                "neck_01"
                if z > 1.48 * k
                else "spine_03"
                if z > 1.30 * k
                else "spine_02"
                if z > 1.10 * k
                else "spine_01"
                if z > 0.98 * k
                else "pelvis"
                if z > 0.84 * k
                else "thigh_" + side
                if z > 0.52 * k
                else "calf_" + side
                if z > 0.18 * k
                else "foot_" + side
            )
            ws = [(mesh.vertex_groups[name].index, 1)]
    if arm_mix and not keep_fingers:
        side = "l" if x > 0 else "r"
        dist = []
        for name in ["upperarm_" + side, "lowerarm_" + side, "hand_" + side]:
            a, b = segments[name]
            ab = b - a
            t = max(0, min(1, (v.co - a).dot(ab) / ab.length_squared))
            dist.append(
                (mesh.vertex_groups[name].index, (v.co - (a + t * ab)).length_squared)
            )
        nearest = min(d for _, d in dist)
        manual = [(i, math.exp(-(d - nearest) / 0.003)) for i, d in dist]
        total = sum(w for _, w in manual)
        merged = {i: w * (1 - arm_mix) for i, w in ws}
        for i, w in manual:
            merged[i] = merged.get(i, 0) + arm_mix * w / total
        ws = sorted(merged.items(), key=lambda a: -a[1])[:4]
    if family == "skeleton":
        # Exposed ribs and long bones are rigid; broad flesh blends bend the tibia.
        if arm_mix == 0 and 1.04 < z < 1.48:
            ws = [(mesh.vertex_groups["spine_03"].index, 1)]
        elif arm_mix > 0.95:
            ws = [(max(ws, key=lambda pair: pair[1])[0], 1)]
        elif z < 0.84 and arm_mix == 0:
            side = "l" if x > 0 else "r"
            name = ("foot_" if z < 0.15 else "calf_" if z < 0.52 else "thigh_") + side
            ws = [(mesh.vertex_groups[name].index, 1)]
    for group in [g.group for g in v.groups]:
        mesh.vertex_groups[group].remove([v.index])
    total = sum(w for _, w in ws)
    if not total:
        pelvis.add([v.index], 1, "REPLACE")
    else:
        for g, w in ws:
            mesh.vertex_groups[g].add([v.index], w / total, "REPLACE")
# Smooth across welded spatial neighbours, including UV seams, then retain four influences.
coords = np.array([tuple(v.co) for v in mesh.data.vertices])
unique, inv = np.unique(np.round(coords, 5), axis=0, return_inverse=True)
w = np.zeros((int(inv.max()) + 1, len(mesh.vertex_groups)), dtype=np.float32)
counts = np.bincount(inv)
for v, i in zip(mesh.data.vertices, inv):
    for g in v.groups:
        w[i, g.group] += g.weight
w /= counts[:, None]
mesh.data.calc_loop_triangles()
tri = np.array([t.vertices for t in mesh.data.loop_triangles])
tri = inv[tri]
a = tri[:, [0, 1, 2]].reshape(-1)
b = tri[:, [1, 2, 0]].reshape(-1)
a, b = np.concatenate([a, b]), np.concatenate([b, a])
degree = np.bincount(a, minlength=len(w))
for _ in range(smooth_steps):
    sums = np.zeros_like(w)
    np.add.at(sums, a, w[b])
    w = 0.35 * w + 0.65 * sums / np.maximum(1, degree)[:, None]
for v, i in zip(mesh.data.vertices, inv):
    for group in [g.group for g in v.groups]:
        mesh.vertex_groups[group].remove([v.index])
    ids = np.argsort(w[i])[-4:]
    total = float(w[i, ids].sum())
    for g in ids:
        weight = float(w[i, g]) / total
        if weight > 1e-6:
            mesh.vertex_groups[int(g)].add([v.index], weight, "REPLACE")
for p in mesh.data.polygons:
    p.use_smooth = True
mesh.parent = rig
mesh.matrix_parent_inverse.identity()
mod = mesh.modifiers.new("Combat skeleton", "ARMATURE")
mod.object = rig
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.wm.save_as_mainfile(filepath=str((root / f"{family}-fitted.blend").resolve()))
bpy.ops.export_scene.gltf(
    filepath=str((root / f"{family}-surface.glb").resolve()),
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_skins=True,
    export_extras=True,
    export_image_format="AUTO",
)
print("FITTED", family, len(mesh.data.vertices), len(mesh.data.polygons), flush=True)
