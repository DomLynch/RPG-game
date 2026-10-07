# Quadruped family rig (docs/specs/origins/body-families.md): a reduced quadruped body (scripts/character/herolook_bake.py output) gets a
# procedural skeleton (spine 5, neck, head, jaw, ears, tail 4, four 4-bone legs), automatic weights, and the clip set the mob view plays:
# Idle, Walk, Run, Bite, Hurt, Flee, Death. The skeleton is placed from FRACTIONS of the body's bounding box, so the same script rigs a wolf
# and a boar; per-body numbers live in the BODIES table.
#   blender -b -P scripts/character/quadruped_rig.py -- <in mob.glb> <out rigged.glb> [body=wolf] [--sheet <dir>]
# The body faces -Y in Blender (glTF +Z), stands on its lowest vertex, is centred on X. Clips are 30 fps, loops are seamless.
import math
import os
import sys

import bpy
from mathutils import Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = argv[0], argv[1]
BODY = next((a.split("=")[1] for a in argv if a.startswith("body=")), "wolf")
SHEET = argv[argv.index("--sheet") + 1] if "--sheet" in argv else None

# Joint positions as (y, z) fractions of the bounding box: y 0 = nose end, 1 = tail end; z 0 = ground, 1 = top. Leg x is a fraction of the
# half width. Measured on the reduced ash wolf (2026-10-07): front paws at y~.33, hind paws at y~.73.
BODIES = {
    "wolf": {
        "spine": [(.78, .50), (.66, .53), (.52, .56), (.40, .58), (.30, .58)],        # pelvis ... chest
        "neck": [(.22, .66)], "head": (.16, .72), "nose": (.04, .62), "jaw": (.07, .60),
        "ear": ((.18, .98), .45),                                                      # tip (y, z), x fraction
        "tail": [(.84, .52), (.92, .42), (.98, .30), (1.02, .18)],
        "front": [(.31, .52), (.32, .30), (.33, .16), (.33, .03)],                     # shoulder, elbow, wrist, paw
        "hind": [(.72, .52), (.68, .34), (.75, .20), (.74, .03)],                      # hip, knee, hock, paw
        "legx": .55,
    },
}[BODY]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
vs = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
mid_x = (lo.x + hi.x) / 2
for v in mesh.data.vertices:   # stand it on the ground, centred on X (the rig's root sits at the origin, between the paws)
    v.co.x -= mid_x
    v.co.z -= lo.z
hi.x -= mid_x
lo.x -= mid_x
hi.z -= lo.z
lo.z = 0
L, H, HW = hi.y - lo.y, hi.z, (hi.x - lo.x) / 2


def P(yz, x=0.0):
    return Vector((x, lo.y + yz[0] * L, yz[1] * H))


arm_data = bpy.data.armatures.new("QuadRig")
arm = bpy.data.objects.new("QuadRig", arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = eb[parent]
    return b


bone("root", Vector((0, lo.y + .5 * L, 0)), Vector((0, lo.y + .5 * L, .08 * H)))
prev = "root"
for i, yz in enumerate(BODIES["spine"]):
    nxt = BODIES["spine"][i + 1] if i + 1 < len(BODIES["spine"]) else BODIES["neck"][0]
    bone(f"spine{i}", P(yz), P(nxt), prev)
    prev = f"spine{i}"
chest = prev
bone("neck", P(BODIES["neck"][0]), P(BODIES["head"]), chest)
bone("head", P(BODIES["head"]), P(BODIES["nose"]), "neck")
bone("jaw", P(BODIES["jaw"]), P(BODIES["nose"]) + Vector((0, 0, -.05 * H)), "head")
for side, sx in (("L", 1), ("R", -1)):
    tip = P(BODIES["ear"][0], sx * BODIES["ear"][1] * HW)
    bone(f"ear_{side}", P(BODIES["head"], sx * .3 * HW) + Vector((0, 0, .05 * H)), tip, "head")
prev = "spine0"
for i, yz in enumerate(BODIES["tail"]):
    nxt = BODIES["tail"][i + 1] if i + 1 < len(BODIES["tail"]) else (yz[0] + .04, yz[1] - .08)
    bone(f"tail{i}", P(yz), P(nxt), prev)
    prev = f"tail{i}"
for pair, parent in (("front", chest), ("hind", "spine0")):
    pts = BODIES[pair]
    for side, sx in (("L", 1), ("R", -1)):
        prev = parent
        for j, name in enumerate(("up", "low", "pastern", "paw")):
            head = P(pts[j], sx * BODIES["legx"] * HW)
            tail = P(pts[j + 1], sx * BODIES["legx"] * HW) if j < 3 else P(pts[3], sx * BODIES["legx"] * HW) + Vector((0, -.06 * L, 0))
            bone(f"{pair}_{name}_{side}", head, tail, prev)
            prev = f"{pair}_{name}_{side}"
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
# Automatic (heat) weights fail on this body: the reduced mesh is open shells (37k of its verts got nothing). Skin it by distance instead:
# each vertex follows its 3 nearest bone segments, weight ~ 1/d^3. Soft where a limb meets the trunk, which is what a furred body wants.
bpy.ops.object.parent_set(type="ARMATURE_NAME")
segs = [(b.name, Vector(b.head_local), Vector(b.tail_local)) for b in arm_data.bones if b.name != "root"]
for name, _, _ in segs:
    if name not in mesh.vertex_groups:
        mesh.vertex_groups.new(name=name)


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t)).length


for v in mesh.data.vertices:
    d = sorted((seg_dist(v.co, a, b), n) for n, a, b in segs)[:3]
    w = [1.0 / (x + .004 * H) ** 3 for x, _ in d]
    tot = sum(w)
    for (x, n), wi in zip(d, w):
        mesh.vertex_groups[n].add([v.index], wi / tot, "REPLACE")
groups = {g.name: 0 for g in mesh.vertex_groups}
for v in mesh.data.vertices:
    for g in v.groups:
        if g.weight > .01:
            groups[mesh.vertex_groups[g.group].name] += 1
unweighted = sum(1 for v in mesh.data.vertices if not any(g.weight > .01 for g in v.groups))
print("weights: groups", len(groups), "unweighted verts", unweighted, "empty groups", [k for k, n in groups.items() if n == 0], flush=True)

# --- clips ------------------------------------------------------------------------------------------------------------------------------
FPS = 30
bpy.context.scene.render.fps = FPS
pb = arm.pose.bones
for b in pb:
    b.rotation_mode = "QUATERNION"


def rot(name, axis, deg):
    """Rotate bone `name` about a WORLD axis (x: pitch, forward is -y; y: roll; z: yaw). Basis is relative to the bone's own rest frame."""
    r = pb[name].bone.matrix_local.to_quaternion()
    q = Quaternion(Vector(axis), math.radians(deg))
    pb[name].rotation_quaternion = r.inverted() @ q @ r


def move(name, dz=0.0, dy=0.0, dx=0.0):
    r = pb[name].bone.matrix_local.to_quaternion()
    pb[name].location = r.inverted() @ Vector((dx * H, dy * H, dz * H))


def clear():
    for b in pb:
        b.rotation_quaternion = (1, 0, 0, 0)
        b.location = (0, 0, 0)


def key(frame):
    for b in pb:
        b.keyframe_insert("rotation_quaternion", frame=frame, group=b.name)
        b.keyframe_insert("location", frame=frame, group=b.name)


actions = {}


def clip(name, frames, pose, loop=True):
    """pose(t) with t in [0,1] sets the pose; keys every frame; a loop repeats frame 0 at the end so it closes."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create().action = act
    n = frames + 1
    for f in range(n):
        clear()
        pose((f % frames) / frames if loop else f / frames)
        key(f + 1)
    actions[name] = act


TAU = 2 * math.pi


def s(t, ph=0.0, k=1):
    return math.sin(TAU * (k * t + ph))


def leg(pair, side, t, ph, swing, lift):
    """One leg: the upper swings about x (positive = forward), the lower folds when the foot is in the air."""
    a = s(t, ph)
    fold = max(0.0, math.cos(TAU * (t + ph))) * lift
    sgn = 1 if pair == "front" else -1
    rot(f"{pair}_up_{side}", (1, 0, 0), -swing * a)
    rot(f"{pair}_low_{side}", (1, 0, 0), sgn * fold * (1 if pair == "front" else -.8))
    rot(f"{pair}_pastern_{side}", (1, 0, 0), -sgn * fold * .5)


def gait(t, swing, lift, bob, phases, flex=0.0, head=0.0, tail=0.0):
    leg("front", "L", t, phases[0], swing, lift)
    leg("front", "R", t, phases[1], swing, lift)
    leg("hind", "L", t, phases[2], swing, lift)
    leg("hind", "R", t, phases[3], swing, lift)
    move("root", dz=bob * abs(s(t, .25, 2)))
    for i in range(5):
        rot(f"spine{i}", (1, 0, 0), flex * s(t, .1, 2) * (1 if i % 2 else -1) * .5)
    rot("neck", (1, 0, 0), head + 3 * s(t, .4, 2))
    for i in range(4):
        rot(f"tail{i}", (0, 0, 1), tail * s(t, .2 + i * .1))


def idle(t):
    for i in range(5):
        rot(f"spine{i}", (1, 0, 0), 1.2 * s(t, i * .05))
    move("root", dz=.004 * s(t))
    rot("head", (0, 0, 1), 5 * s(t, .1))
    rot("neck", (1, 0, 0), 3 * s(t, .3))
    for i in range(4):
        rot(f"tail{i}", (0, 0, 1), 9 * s(t, .2 + i * .08))
    for side in "LR":
        rot(f"ear_{side}", (1, 0, 0), 6 * max(0, s(t, .6, 2)))


clip("Idle", 60, idle)
clip("Walk", 30, lambda t: gait(t, 24, 40, .008, (0, .5, .5, 0), head=2, tail=14))
clip("Run", 18, lambda t: gait(t, 40, 55, .02, (0, .08, .5, .58), flex=14, head=6, tail=10))


def flee(t):
    """The Run at a faster, lower, scared gallop: head down, tail tucked, ears flat. The mob view switches to it below the row's fleeAt hp."""
    gait(t, 46, 60, .024, (0, .06, .5, .56), flex=18, head=22, tail=0)
    for i in range(4):
        rot(f"tail{i}", (1, 0, 0), -14)
    for side in "LR":
        rot(f"ear_{side}", (0, 1, 0), (-1 if side == "L" else 1) * 25)


clip("Flee", 14, flee)


def bite(t):
    """Crouch, lunge forward with the jaw open, snap shut, recover."""
    k = math.sin(math.pi * t / .55) if t < .55 else 0.0
    move("root", dy=-.12 * k, dz=-.03 * k)
    for i in range(5):
        rot(f"spine{i}", (1, 0, 0), -6 * k)
    rot("neck", (1, 0, 0), -18 * k)
    rot("head", (1, 0, 0), -10 * k)
    jaw = math.sin(math.pi * (t - .1) / .3) if .1 < t < .4 else 0.0
    rot("jaw", (1, 0, 0), 38 * jaw)
    for side in "LR":
        rot(f"front_up_{side}", (1, 0, 0), 22 * k)
        rot(f"hind_up_{side}", (1, 0, 0), 12 * k)


clip("Bite", 21, bite, loop=False)


def hurt(t):
    k = math.sin(math.pi * t)
    for i in range(5):
        rot(f"spine{i}", (1, 0, 0), 5 * k)
    rot("neck", (1, 0, 0), 20 * k)
    rot("head", (1, 0, 0), 12 * k)
    rot("jaw", (1, 0, 0), 25 * k)
    move("root", dy=.04 * k, dz=-.01 * k)
    for side in "LR":
        rot(f"front_up_{side}", (1, 0, 0), -14 * k)
    for i in range(4):
        rot(f"tail{i}", (1, 0, 0), -18 * k)


clip("Hurt", 15, hurt, loop=False)


def death(t):
    """Buckle and fall onto the left side, settle; the last key is the corpse pose and is held."""
    e = t * t * (3 - 2 * t)
    rot("root", (0, 1, 0), 90 * e)
    move("root", dx=-HW / H * e, dz=HW / H * e)
    for pair in ("front", "hind"):
        for side in "LR":
            rot(f"{pair}_up_{side}", (1, 0, 0), (-18 if pair == "front" else 18) * e)
            rot(f"{pair}_low_{side}", (1, 0, 0), (28 if pair == "front" else -24) * e)
    rot("neck", (1, 0, 0), 25 * e)
    rot("jaw", (1, 0, 0), 30 * e)


clip("Death", 36, death, loop=False)

# --- export + pose sheet ------------------------------------------------------------------------------------------------------------------
arm.animation_data.action = None
for name, act in actions.items():   # one NLA strip per clip so the exporter writes every action
    tr = arm.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, int(act.frame_range[0]), act)
mesh.name = os.environ.get("BAKE_NAME", "Wolf")
os.makedirs(os.path.dirname(os.path.abspath(DST)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_image_format="JPEG", export_animations=True,
                          export_animation_mode="NLA_TRACKS", export_force_sampling=True, use_selection=False)
print("exported", DST, {n: (int(a.frame_range[0]), int(a.frame_range[1])) for n, a in actions.items()}, flush=True)

if SHEET:
    os.makedirs(SHEET, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.render.resolution_x, sc.render.resolution_y = 600, 420
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = L * 1.25
    cam.location = (3, lo.y + .5 * L, H * .45)   # side view, looking along -x
    cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    for name, act in actions.items():
        for tr in arm.animation_data.nla_tracks:
            tr.mute = tr.name != name
        a, b = int(act.frame_range[0]), int(act.frame_range[1])
        for i, f in enumerate([a + round((b - a) * q / 4) for q in range(5)]):
            sc.frame_set(f)
            sc.render.filepath = os.path.join(SHEET, f"{BODY}-{name}-{i}.png")
            bpy.ops.render.render(write_still=True)
    print("sheet frames in", SHEET, flush=True)
