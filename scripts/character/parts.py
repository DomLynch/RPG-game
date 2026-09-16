# Headless Blender authoring for the warrior. Reproducible: committed script → src/assets/source/{parts,materials} → build-warrior.mjs.
#   blender -b -P scripts/character/parts.py                    write the level-1 kit and the skin maps
#   blender -b -P scripts/character/parts.py -- --proof <dir>   write a pipeline-proof ring instead, into <dir>
# Contract for every exported mesh: coordinates in the base rig's UNSCALED rest space (build-warrior.mjs narrows the
# finished scene by 0.9/0.97/0.97 afterwards), Y-up metres, UVs present, custom property `material` (a material name the
# build knows) and either `bone` (rigid attachment) or real skin weights (vertex groups named by bone; the build remaps
# them by name). Materials and textures are assigned by the build, not here.
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import head as HEADMOD  # noqa: E402  realistic head: UDIM tiles, sculpted normal, cards

SOURCE = 'artifacts/source/base/Universal Base Characters[Standard]/Base Characters'
BASE = f'{SOURCE}/Godot - UE/Superhero_Male_FullBody.gltf'
TEXTURES = f'{SOURCE}/Textures'
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
proof = '--proof' in args
realistic = '--body' in args and args[args.index('--body') + 1] == 'realistic'
FIGHTER = args[args.index('--fighter') + 1] if '--fighter' in args else 'hero'  # whose scan and tuning (head.FIGHTERS); the realistic body only
if FIGHTER != 'hero' and not realistic:
    raise SystemExit('--fighter needs --body realistic')
HEADMOD.select_fighter(FIGHTER)
VARIANT = ('realistic' if FIGHTER == 'hero' else FIGHTER) if realistic else ''  # parts/manifest file tag: body_<VARIANT>.glb, manifest_<VARIANT>.json
HBM = 'artifacts/source/human-base-meshes/human_base_meshes_bundle.blend'
out = args[args.index('--proof') + 1] if proof else 'src/assets/source/parts'
materials_out = 'src/assets/source/materials'
SUFFIX = ('_r' if FIGHTER == 'hero' else f'_{FIGHTER}') if realistic else ''  # material file suffix; the hero keeps its shipped names

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BASE)
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
armature.matrix_world.identity()  # author against the unscaled rest pose
body = bpy.data.objects['SuperHero_Male']
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not body]:
    bpy.data.objects.remove(o, do_unlink=True)
while len(body.data.uv_layers) > 1:  # the source carries an empty second UV set; TEXCOORD_1 is ours (occlusion)
    body.data.uv_layers.remove(body.data.uv_layers[1])


def realistic_body():
    """Replace the stylised CC0 body with Blender Studio's realistic male (CC0): appended, scaled to the rig, its A-pose
    arms raised rigidly into the rig's T rest, then weighted from the CC0 body by nearest surface."""
    global body
    from mathutils import Matrix
    with bpy.data.libraries.load(HBM, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in ('GEO-body_male_realistic', 'GEO-body_male_realistic.eye.L', 'GEO-body_male_realistic.eye.R')]
    hbm = bpy.data.objects['GEO-body_male_realistic']
    eyes = [bpy.data.objects[n] for n in ('GEO-body_male_realistic.eye.L', 'GEO-body_male_realistic.eye.R')]
    global HIGH
    HIGH = hbm.copy()  # keeps the bundle's multires sculpt for a high→low normal bake
    HIGH.data = hbm.data.copy()
    HIGH.name = 'BodyHigh'
    bpy.context.collection.objects.link(HIGH)
    for m in HIGH.modifiers:
        if m.type == 'MULTIRES':
            m.levels = m.render_levels = m.total_levels
    for o in [hbm] + eyes:
        bpy.context.collection.objects.link(o)
        o.data = o.data.copy()  # the two eyes share a mesh; transforms can only be applied to single-user data
        o.modifiers.clear()
    bpy.context.view_layer.update()  # world matrices (eyes are parented, body sits in a lineup) exist only after this
    for o in eyes + [hbm, HIGH]:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
    bpy.context.view_layer.update()
    # Scale, centre and ground: match the CC0 body's height; feet on the floor; x centred.
    cc0_top = max(v.co.z for v in body.data.vertices)
    world_verts = [hbm.matrix_world @ v.co for v in hbm.data.vertices]
    top, floor = max(v.z for v in world_verts), min(v.z for v in world_verts)
    cx = (max(v.x for v in world_verts) + min(v.x for v in world_verts)) / 2
    scale = cc0_top / (top - floor)
    fit = Matrix.Translation((-cx * scale, 0, -floor * scale)) @ Matrix.Scale(scale, 4)
    for o in [hbm, HIGH] + eyes:
        o.matrix_world = fit @ o.matrix_world
        select_only([o])
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # A-pose → T rest: raise each arm rigidly about the rig's shoulder joint, blending in across the shoulder.
    for mesh_obj in (hbm, HIGH):  # the high copy's base verts must follow the same raise; multires offsets are relative
        for side, sgn in (('l', 1), ('r', -1)):
            pivot = joint(f'upperarm_{side}')
            arm = [v for v in mesh_obj.data.vertices if v.co.x * sgn > pivot.x * sgn - 0.06 and v.co.z > pivot.z - 0.75]
            hand_z = min(v.co.z for v in arm)
            hand_x = max(abs(v.co.x) for v in arm)
            angle = math.atan2(pivot.z - hand_z, hand_x - abs(pivot.x))
            for v in arm:
                blend = min(1.0, max(0.0, (abs(v.co.x) - (abs(pivot.x) - 0.03)) / 0.09))
                a = angle * blend
                dx, dz = v.co.x - pivot.x, v.co.z - pivot.z
                v.co.x = pivot.x + dx * math.cos(a) - sgn * dz * math.sin(a)
                v.co.z = pivot.z + sgn * dx * math.sin(a) + dz * math.cos(a)
        mesh_obj.data.update()
    for mesh_obj in (hbm, HIGH):
        align_arms(mesh_obj)
        align_legs(mesh_obj)
    HEADMOD.split_tiles(hbm)   # head → its own `Face` tile and material; body tiles → one atlas
    HEADMOD.face_group(HIGH)   # the sculpt copy keeps UDIM UVs; the face group limits the displacement
    # Weights from the CC0 body at rest, both now in T.
    select_only([body, hbm])
    bpy.ops.object.data_transfer(data_type='VGROUP_WEIGHTS', vert_mapping='POLYINTERP_NEAREST', layers_select_src='ALL', layers_select_dst='NAME', use_create=True)
    for poly in hbm.data.polygons:
        poly.use_smooth = True
    arm_mod = hbm.modifiers.new('Armature', 'ARMATURE')
    arm_mod.object = armature
    hbm.name = 'Body'
    global FACE
    eye_l = sum((v.co for v in eyes[0].data.vertices), Vector()) / len(eyes[0].data.vertices)
    eye_r = sum((v.co for v in eyes[1].data.vertices), Vector()) / len(eyes[1].data.vertices)
    if eye_l.x < eye_r.x:
        eye_l, eye_r = eye_r, eye_l
    if os.environ.get('HEAD_PHOTO', '1' if FIGHTER == 'hero' else '0') == '1' and os.path.exists(HEADMOD.PHOTO):  # fit the head to the portrait first (the hero's portrait: another fighter's scan replaces the head anyway)
        pre_face = [v.co for v in hbm.data.vertices if v.co.z > eye_l.z - 0.12 and v.co.z < eye_l.z + 0.16]
        pre_nose = min(pre_face, key=lambda c: c.y)
        pre_radius = max((v.co - eye_l).length for v in eyes[0].data.vertices)
        pre_ring = [v.co for v in hbm.data.vertices if abs((v.co - eye_l).length - pre_radius) < 0.004 and v.co.y < eye_l.y + 0.01]
        pre = {'eye_l': eye_l, 'eye_r': eye_r, 'nose': pre_nose.copy(), 'mouth': Vector((0, pre_nose.y + 0.012, pre_nose.z - 0.038)),
               'lid_ring': (min(abs(c.x) for c in pre_ring), max(abs(c.x) for c in pre_ring)) if pre_ring else (eye_l.x - 0.018, eye_l.x + 0.022)}
        if os.path.exists(HEADMOD.BASE_RENDER.rsplit('.', 1)[0] + '.landmarks.json'):
            DENSE = HEADMOD.fit_head_dense([hbm, HIGH], eyes, hbm, pre)
            FITTED = None
        else:
            DENSE = None
            FITTED = HEADMOD.fit_head_to_photo([hbm, HIGH], eyes, pre)
        eye_l = sum((v.co for v in eyes[0].data.vertices), Vector()) / len(eyes[0].data.vertices)
        eye_r = sum((v.co for v in eyes[1].data.vertices), Vector()) / len(eyes[1].data.vertices)
        if eye_l.x < eye_r.x:
            eye_l, eye_r = eye_r, eye_l
    else:
        FITTED = None
        DENSE = None
    if DENSE is None:  # the base eyes: a touch deeper and the lids brought down; a dense fit seats them from the portraits
        for e in eyes:
            for v in e.data.vertices:
                v.co.y += 0.0015
            e.data.update()
        eye_l, eye_r = eye_l + Vector((0, 0.0015, 0)), eye_r + Vector((0, 0.0015, 0))
    eye_radius = max((v.co - eye_l).length for v in eyes[0].data.vertices)
    if DENSE is None:
        for mesh_obj in (hbm, HIGH):  # a fighter's eyes are not wide open: bring the lids down before any bake
            HEADMOD.close_lids(mesh_obj, [eye_l, eye_r], eye_radius, upper=math.radians(20), lower=math.radians(6))
    ring = [v.co for v in hbm.data.vertices if abs((v.co - eye_l).length - eye_radius) < 0.004 and v.co.y < eye_l.y + 0.01]
    lid_ring = (min(abs(c.x) for c in ring), max(abs(c.x) for c in ring)) if ring else (eye_l.x - 0.018, eye_l.x + 0.022)
    face = [v.co for v in hbm.data.vertices if v.co.z > eye_l.z - 0.12 and v.co.z < eye_l.z + 0.16]
    nose = min(face, key=lambda c: c.y)  # most forward point of the face
    print(f'FACE eye_l={tuple(round(v, 3) for v in eye_l)} nose={tuple(round(v, 3) for v in nose)}')
    FACE = {'eye_l': eye_l, 'eye_r': eye_r, 'nose': nose.copy(), 'ear_x': max(abs(c.x) for c in face), 'lid_ring': lid_ring,
            'mouth': Vector((0, nose.y + 0.012, nose.z - 0.038)), 'chin': Vector((0, nose.y + 0.02, nose.z - 0.085))}
    if FITTED is not None:  # the portrait's proportions, now also the mesh's
        FACE['mouth'] = Vector((float(FITTED[13][0]), nose.y + 0.012, float(FITTED[13][1])))
        FACE['chin'] = Vector((0, nose.y + 0.02, float(FITTED[152][1]) + 0.01))
        FACE['hairline_z'] = float(FITTED[10][1])
    if DENSE is not None:
        target, ok_mask, eye_fit = DENSE
        FACE['dense'] = (target, ok_mask)
        FACE['mouth'] = Vector((float(target[13][0]), float(target[13][1]), float(target[13][2])))
        FACE['chin'] = Vector((0, float(target[152][1]), float(target[152][2]) + 0.01))
        FACE['hairline_z'] = float(target[10][2])
    for e, side in zip(eyes, ('L', 'R')):
        tag(e, f'eye_{side}', 'Eyes', bone='Head', slot='Eyes')
    bpy.data.objects.remove(body, do_unlink=True)
    body = hbm
    return [tag(hbm, 'Body', 'Skin', slot='Skin')] + eyes


def joint(name):
    """Rest-pose position of a bone head, in the unscaled rig space (Blender Z-up)."""
    return armature.data.bones[name].head_local.copy()


def bone_tail(name):
    return armature.data.bones[name].tail_local.copy()


def align_legs(mesh_obj):
    """Lay each leg onto its bones. The Studio body stands ~5 cm forward of the CC0 rig at the knee and ~11 cm at the
    ankle, so the ankle joint sat at the mesh's heel and every foot rotation hinged behind the foot (a broken-looking
    ankle in the walk). The leg's smoothed slice centreline (x and y, per cm of height) is translated onto the bone line
    hip → knee → ankle, blended in below the hip; the foot below the ankle moves rigidly with the ankle's offset."""
    verts = mesh_obj.data.vertices
    for side, sgn in (('l', 1), ('r', -1)):
        hip, knee, ankle = joint(f'thigh_{side}'), joint(f'calf_{side}'), joint(f'foot_{side}')
        def bone_at(z):
            a, b = (knee, hip) if z >= knee.z else (ankle, knee)
            t = (z - a.z) / max(1e-6, b.z - a.z)
            return a.lerp(b, min(1.0, max(0.0, t)))
        bins = {}
        for v in verts:
            if v.co.x * sgn > 0.02 and ankle.z - 0.005 < v.co.z < hip.z:
                bins.setdefault(round(v.co.z * 100), []).append(v.co.copy())
        raw = {k: sum(c, Vector()) / len(c) for k, c in bins.items()}
        keys = sorted(raw)
        centres = {}
        for k in keys:
            near = [(raw[q], math.exp(-((q - k) / 2.0) ** 2)) for q in keys if abs(q - k) <= 3]
            centres[k] = sum((c * w for c, w in near), Vector()) / sum(w for _, w in near)
        def mesh_at(z):
            k = max(keys[0], min(keys[-1], z * 100))
            lo = max(q for q in keys if q <= k); hi = min(q for q in keys if q >= k)
            return centres[lo] if lo == hi else centres[lo].lerp(centres[hi], (k - lo) / (hi - lo))
        moved = 0
        for v in verts:
            if v.co.x * sgn <= 0.02 or v.co.z > hip.z + 0.06:
                continue
            z = max(ankle.z, min(hip.z, v.co.z))  # the foot takes the ankle's offset
            blend = min(1.0, max(0.0, (hip.z + 0.06 - v.co.z) / 0.14))
            d = bone_at(z) - mesh_at(z)
            v.co.x += d.x * blend
            v.co.y += d.y * blend
            moved += 1
        mesh_obj.data.update()
        d_ankle = bone_at(ankle.z) - mesh_at(ankle.z)
        print(f'ALIGN LEGS {side}: ankle offset ({d_ankle.x * 100:+.1f}, {d_ankle.y * 100:+.1f}) cm, knee ({(bone_at(knee.z) - mesh_at(knee.z)).y * 100:+.1f}) cm, {moved} verts')


def align_arms(mesh_obj):
    """Lay each raised arm onto its bones. The Studio body's arms come forward and up of the rig's straight T, and its
    hands are palm-down where the rig's are palm-back, so finger bones fell outside the fingers and the grip tore.
    (1) The arm's centreline (mean of 1 cm slices along x) is translated onto the bone line shoulder → elbow → wrist →
    middle fingertip, blended in over the shoulder. (2) The hand is rotated about the wrist so its finger direction and
    thumb direction match the rig's; the forearm takes that rotation progressively from the elbow (pronation)."""
    from mathutils import Matrix, Quaternion
    verts = mesh_obj.data.vertices
    for side, sgn in (('l', 1), ('r', -1)):
        shoulder, elbow, wrist = joint(f'upperarm_{side}'), joint(f'lowerarm_{side}'), joint(f'hand_{side}')
        tip = bone_tail(f'middle_03_{side}')
        thumb = bone_tail(f'thumb_03_{side}')
        line = sorted([shoulder, elbow, wrist, tip], key=lambda p: abs(p.x))
        def bone_centre(ax):
            for a, b in zip(line, line[1:]):
                if abs(a.x) <= ax <= abs(b.x):
                    t = (ax - abs(a.x)) / max(1e-6, abs(b.x) - abs(a.x))
                    return a.lerp(b, t)
            return line[-1] if ax > abs(line[-1].x) else line[0]
        arm = [v for v in verts if v.co.x * sgn > abs(shoulder.x) + 0.03 and v.co.z > shoulder.z - 0.3]
        bins = {}
        for v in arm:
            bins.setdefault(round(abs(v.co.x) * 100), []).append(v.co.copy())
        raw = {k: sum(c, Vector()) / len(c) for k, c in bins.items()}
        keys = sorted(raw)
        centres = {}  # smoothed over ±3 cm: slice means jitter at creases and knuckles, and every jump would print a ridge
        for k in keys:
            near = [(raw[q], math.exp(-((q - k) / 2.0) ** 2)) for q in keys if abs(q - k) <= 3]
            centres[k] = sum((c * w for c, w in near), Vector()) / sum(w for _, w in near)
        def body_centre(ax):
            k = ax * 100
            lo = max([q for q in keys if q <= k], default=keys[0])
            hi = min([q for q in keys if q >= k], default=keys[-1])
            if lo == hi:
                return centres[lo]
            return centres[lo].lerp(centres[hi], (k - lo) / (hi - lo))
        # (1) centreline onto the bones (y and z only), blended in across the shoulder
        for v in verts:
            if v.co.x * sgn <= abs(shoulder.x) - 0.02 or v.co.z < shoulder.z - 0.3:
                continue
            ax = abs(v.co.x)
            blend = min(1.0, max(0.0, (ax - (abs(shoulder.x) - 0.02)) / 0.10))
            d = bone_centre(ax) - body_centre(max(ax, keys[0] / 100))
            v.co.y += d.y * blend
            v.co.z += d.z * blend
        mesh_obj.data.update()
        # (2) hand frame: finger direction and thumb direction, body vs rig
        hand = [v for v in verts if v.co.x * sgn > abs(wrist.x) + 0.005 and (v.co - wrist).length < 0.25]
        far = sorted(hand, key=lambda v: -abs(v.co.x))[:60]
        finger_b = (sum((v.co for v in far), Vector()) / len(far) - wrist).normalized()
        base = [v for v in hand if abs(v.co.x) < abs(wrist.x) + 0.13]  # the thumb tip lies ~12 cm out; it is the vertex farthest off the finger axis
        thumb_tip = max(base, key=lambda v: ((v.co - wrist) - (v.co - wrist).dot(finger_b) * finger_b).length)
        thumb_b = (thumb_tip.co - wrist).normalized()
        finger_r, thumb_r = (tip - wrist).normalized(), (thumb - wrist).normalized()
        def frame(f, t):
            n = f.cross(t).normalized()
            return Matrix((f, n.cross(f), n)).transposed()  # columns: finger, in-palm, palm normal
        R = frame(finger_r, thumb_r) @ frame(finger_b, thumb_b).inverted()
        q = R.to_quaternion()
        print(f'ALIGN ARMS {side}: hand rotation {math.degrees(q.angle):.1f}° about {tuple(round(c, 2) for c in q.axis)}; finger dir body {tuple(round(c, 2) for c in finger_b)} rig {tuple(round(c, 2) for c in finger_r)}')
        for v in verts:
            if v.co.x * sgn <= abs(elbow.x) or v.co.z < shoulder.z - 0.3:
                continue
            t = min(1.0, (abs(v.co.x) - abs(elbow.x)) / max(1e-6, abs(wrist.x) - abs(elbow.x)))  # 0 at the elbow, 1 from the wrist out
            pivot = elbow.lerp(wrist, t) if t < 1 else wrist
            rot = Quaternion().slerp(q, t)
            v.co = pivot + rot @ (v.co - pivot)
        mesh_obj.data.update()
        # (3) the thumb's own abduction: the frame match puts the body's thumb in the rig's thumb plane but keeps its
        # angle from the fingers; swing the thumb about its base joint onto the rig's thumb bone
        base_j = joint(f'thumb_01_{side}')
        tip_b = thumb_tip.co.copy()  # the vertex was already carried by the hand rotation above
        axis_b, axis_r = (tip_b - base_j).normalized(), (thumb - base_j).normalized()
        swing = axis_b.rotation_difference(axis_r)
        thumb_len = (tip_b - base_j).length
        stretch = min(1.12, (thumb - base_j).length / max(1e-6, thumb_len))  # the rig's thumb chain is longer than the body's thumb: meet it part way, never a freak thumb
        for v in verts:
            d = v.co - base_j
            along_t = d.dot(axis_b)
            if along_t < -0.01 or along_t > thumb_len + 0.03 or (d - axis_b * along_t).length > 0.024:
                continue
            blend = min(1.0, max(0.0, along_t / 0.03))
            d = Quaternion().slerp(swing, blend) @ d
            along_r = d.dot(axis_r)
            d = d + axis_r * (along_r * (stretch - 1) * blend)
            v.co = base_j + d
        mesh_obj.data.update()
        print(f'ALIGN ARMS {side}: thumb swung {math.degrees(swing.angle):.1f}°, stretched {stretch:.2f}x')


SLOTS = {'tunic': 'Body', 'baldric': 'Body', 'belt': 'Body', 'studs': 'Body', 'skirt': 'Legs', 'kilt': 'Legs',
         'wrap_l': 'Arms', 'wrap_r': 'Arms', 'sole_l': 'Boots', 'sole_r': 'Boots', 'straps_l': 'Boots', 'straps_r': 'Boots'}


def slot_for(name):
    for prefix, slot in [('strap', 'Boots'), ('sole', 'Boots'), ('wrap', 'Arms'), ('skirt', 'Legs'), ('kilt', 'Legs')]:
        if name.startswith(prefix):
            return slot
    return 'Body'


def tag(obj, name, material, bone=None, slot=None):
    """Every exported piece names its material, its equipment slot (Helmet, Body, Arms, Gloves, Legs, Boots, Shield) and
    either a rigid bone or carries skin weights."""
    obj.name = name
    obj['material'] = material
    obj['slot'] = slot if slot is not None else slot_for(name)
    if bone:
        obj['bone'] = bone
    return obj


def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def extract(name, material, keep, lift=0.012, thickness=0.008, source=None, face_keep=None):
    """Clothing cut from the body itself: faces whose centre passes `keep(p)` are kept, lifted off the skin and given
    thickness. Vertex groups (skin weights) and UVs come with the faces, so the piece deforms exactly like the body."""
    select_only([source or body])
    bpy.ops.object.duplicate()
    part = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(part.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)  # weld UV-seam splits so only the real cut counts as a boundary
    inside = {v: keep(v.co) for v in bm.verts}
    crossings = {}  # for every edge the cut crosses: where exactly, by bisection — the hem then lies on the cut itself
    for e in bm.edges:
        a, b = e.verts
        if inside[a] != inside[b]:
            v_in, lo, hi = (a, a.co.copy(), b.co.copy()) if inside[a] else (b, b.co.copy(), a.co.copy())
            for _ in range(12):
                mid = (lo + hi) / 2
                if keep(mid):
                    lo = mid
                else:
                    hi = mid
            crossings.setdefault(v_in, []).append(lo)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(inside[v] for v in f.verts) or (face_keep is not None and not face_keep(f))], context='FACES')
    for v, pts in crossings.items():
        if v.is_valid:
            v.co = sum(pts, Vector()) / len(pts)
    smooth_boundary(bm, passes=3, factor=0.5)  # only the last of the mesh's stair-steps; the curve itself is the cut
    bm.to_mesh(part.data)
    bm.free()
    ao_uv = part.data.uv_layers.new(name='ao')  # TEXCOORD_1 → the body's baked occlusion, same layout as the skin atlas
    for i, loop in enumerate(part.data.uv_layers[0].data):
        ao_uv.data[i].uv = loop.uv
    if material in ('Leather', 'Heraldry'):  # tileable maps: the atlas layout spread one tile over the whole body — 6× repeats it at strap scale (the occlusion keeps the atlas layout on TEXCOORD_1)
        for loop in part.data.uv_layers[0].data:
            loop.uv = loop.uv * 4.0
    part.modifiers.clear()
    lift_mod = part.modifiers.new('Lift', 'DISPLACE')
    lift_mod.strength, lift_mod.mid_level = lift, 0
    shell = part.modifiers.new('Shell', 'SOLIDIFY')
    shell.thickness, shell.offset, shell.use_rim = thickness, 1, True
    arm = part.modifiers.new('Armature', 'ARMATURE')
    arm.object = armature
    return tag(part, name, material)


def smooth_boundary(bm, passes=24, factor=0.6):
    """Relax the cut edge along itself so a hem reads as cloth, not as the triangle mesh it was cut from."""
    boundary = {v: [e.other_vert(v) for e in v.link_edges if e.is_boundary] for v in bm.verts if any(e.is_boundary for e in v.link_edges)}
    for _ in range(passes):
        target = {v: sum((n.co for n in ns), Vector()) / len(ns) for v, ns in boundary.items() if len(ns) >= 2}
        for v, t in target.items():
            v.co = v.co.lerp(t, factor)


AO_WHITE = (0.85, 0.30)  # a fully lit texel of the baked body occlusion, for pieces with their own UVs


def ao_white(part):
    layer = part.data.uv_layers.new(name='ao')
    for d in layer.data:
        d.uv = AO_WHITE
    return part


def transfer_weights(part):
    """Nearest-body-vertex skin weights for a piece that was not cut from the body (strips, studs)."""
    select_only([part])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # verts in rig space, object at origin
    select_only([body, part])  # data_transfer copies FROM the active object TO the other selected ones
    bpy.ops.object.data_transfer(data_type='VGROUP_WEIGHTS', vert_mapping='NEAREST', layers_select_src='ALL', layers_select_dst='NAME', use_create=True)
    weighted = sum(1 for v in part.data.vertices if v.groups)
    assert weighted == len(part.data.vertices), f'{part.name}: {weighted}/{len(part.data.vertices)} vertices received weights'
    arm = part.modifiers.new('Armature', 'ARMATURE')
    arm.object = armature
    return part


def ring_strip(name, material, a, b, t, width, arc=(0.0, 2 * math.pi), segments=28, lift=0.004, thickness=0.004, probe_radius=0.2, max_reach=None, rows_n=1, bow=0.0):
    """A strap that hugs the body: probe points around the limb axis a→b at parameter t, snap each to the nearest skin,
    and stitch a strip `width` wide along the axis. Weights come from the body; the strap has its own UVs."""
    axis = (b - a).normalized()
    u = axis.cross(Vector((0, 0, 1)))
    if u.length < 1e-3:
        u = axis.cross(Vector((0, 1, 0)))
    u.normalize()
    v = axis.cross(u)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    rows = []
    steps = max(1, rows_n)
    for k in range(steps + 1):
        tt = t + (width / (b - a).length) * k / steps
        row = []
        for i in range(segments + 1):
            th = arc[0] + (arc[1] - arc[0]) * i / segments
            centre = a + (b - a) * tt
            radial = u * math.cos(th) + v * math.sin(th)
            surface, normal = nearest_surface(centre + radial * probe_radius)
            if bow:  # an open strip curls away from the body along its middle, a hanging cloth fold instead of a flat plank
                surface = surface + normal * (bow * math.sin(math.pi * i / segments))
            if max_reach and (surface - centre).length > max_reach:  # snapped to another limb: stay on this one
                surface, normal = centre + radial * max_reach * 0.7, radial
            row.append(bm.verts.new(surface + normal * lift))
        rows.append(row)
    closed = abs((arc[1] - arc[0]) - 2 * math.pi) < 1e-6
    for r in range(steps):
        for i in range(segments):
            f = bm.faces.new((rows[r][i], rows[r][i + 1], rows[r + 1][i + 1], rows[r + 1][i]))
            for loop, (uu, vv) in zip(f.loops, ((i / segments, r / steps), ((i + 1) / segments, r / steps), ((i + 1) / segments, (r + 1) / steps), (i / segments, (r + 1) / steps))):
                loop[uv_layer].uv = (uu * 4, vv)
    if closed:
        bmesh.ops.remove_doubles(bm, verts=[v for row in rows for v in row], dist=1e-5)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    shell = obj.modifiers.new('Shell', 'SOLIDIFY')
    shell.thickness, shell.offset, shell.use_rim = thickness, 0, True
    return tag(ao_white(transfer_weights(obj)), name, material)


def nearest_surface(point):
    """Body surface point and normal closest to `point`, in rig space."""
    to_body = body.matrix_world.inverted()
    ok, location, normal, _ = body.closest_point_on_mesh(to_body @ point)
    if not ok:
        return point, Vector((0, -1, 0))
    return body.matrix_world @ location, (body.matrix_world.to_3x3() @ normal).normalized()


# --- rig landmarks (Blender Z-up: x = character's left, y = back, z = up) ---
pelvis, neck, head = joint('pelvis'), joint('neck_01'), joint('Head')
shoulder_l, shoulder_r = joint('upperarm_l'), joint('upperarm_r')
elbow_l, elbow_r, hand_l, hand_r = joint('lowerarm_l'), joint('lowerarm_r'), joint('hand_l'), joint('hand_r')
foot_l, foot_r, calf_l, calf_r = joint('foot_l'), joint('foot_r'), joint('calf_l'), joint('calf_r')
torso_half_width = abs(shoulder_r.x) - 0.045


def in_torso(p):
    return abs(p.x) < torso_half_width and pelvis.z - 0.03 < p.z < neck.z + 0.02


def along(p, a, b):
    """Parameter of p projected onto segment a→b (0 at a, 1 at b)."""
    d = b - a
    return (p - a).dot(d) / d.length_squared


def level1_kit():
    kit = []
    # Tunic: rough cloth over the torso and the tops of the arms, open at the neck.
    # Exomis: a working man's tunic pinned over the LEFT shoulder, the sword arm and right shoulder bare.
    def neckline(p):
        dip = math.exp(-(p.x / 0.07) ** 2) * (0.07 if p.y < 0 else 0.02)
        return neck.z - 0.035 - dip
    def bare_right(p):  # a diagonal from the right armpit up across the right chest and shoulder
        return p.x < -0.03 and p.z > neck.z - 0.15 - (p.x + 0.03) * 1.1 and p.y < 0.06
    def armhole_left(p):
        return along(p, shoulder_l, elbow_l) > 0.22 and p.z < shoulder_l.z + 0.05
    kit.append(extract('tunic', 'Gambeson', lambda p: abs(p.x) < torso_half_width + 0.07 and pelvis.z - 0.03 < p.z < neckline(p)
                       and not bare_right(p) and not armhole_left(p) and (p - shoulder_r).length > 0.09, lift=0.010, thickness=0.007))
    # Under-skirt: dyed cloth over hips and upper thighs, so the strips above it never show skin between them.
    kit.append(extract('skirt', 'Heraldry', lambda p: abs(p.x) < 0.24 and pelvis.z - 0.25 < p.z < pelvis.z + 0.01, lift=0.014, thickness=0.005))
    # Baldric: a leather loop around the torso, over the left shoulder and under the right arm, hugging the body.
    centre = Vector((0.0, pelvis.y, pelvis.z + 0.37))
    n = Vector((0.66, 0.0, 0.75)).normalized()  # the loop's plane leans from the right hip up to the left shoulder
    kit.append(ring_strip('baldric', 'Leather', centre - n * 0.025, centre + n * 0.025, 0.0, 0.05, segments=44,
                          lift=0.017, thickness=0.005, probe_radius=0.30, max_reach=0.34))
    # Belt around the hips.
    kit.append(extract('belt', 'Leather', lambda p: in_torso(p) and pelvis.z + 0.005 < p.z < pelvis.z + 0.055, lift=0.024, thickness=0.007))
    # Forearm wraps: seven narrow overlapping leather turns from the wrist to mid-forearm, each hugging the arm's taper.
    for elbow, hand, side in [(elbow_l, hand_l, 1), (elbow_r, hand_r, -1)]:
        for k in range(7):
            kit.append(ring_strip(f'wrap_{"l" if side > 0 else "r"}_{k}', 'Wrap', elbow, hand, 0.93 - k * 0.055, 0.06, lift=0.003 + (k % 2) * 0.002, probe_radius=0.1, max_reach=0.09, rows_n=3))
    # Sandals: a thick sole under the foot, straps over the instep and toes, an ankle strap. Toes stay bare.
    for foot, ball, side in [(foot_l, joint('ball_l'), 1), (foot_r, joint('ball_r'), -1)]:
        name = 'l' if side > 0 else 'r'
        kit.append(extract(f'sole_{name}', 'Leather', lambda p, s=side: p.x * s > 0 and p.z < 0.03, lift=0.0, thickness=0.007,
                           face_keep=lambda f: f.normal.z < -0.45))  # one flat sole: every downward face under the foot, arch included; nothing on the toes
        heel = Vector((foot.x, foot.y, 0.012))  # the strap rings run from the heel-top down the foot to the toes
        toe = Vector((ball.x, ball.y - 0.02, 0.012))
        kit.append(ring_strip(f'strap_instep_{name}', 'Leather', heel, toe, 0.42, 0.016, arc=(0, math.pi), lift=0.004, probe_radius=0.08, max_reach=0.075))
        kit.append(ring_strip(f'strap_toe_{name}', 'Leather', heel, toe, 0.80, 0.012, arc=(0, math.pi), lift=0.004, probe_radius=0.08, max_reach=0.07))
        kit.append(ring_strip(f'strap_ankle_{name}', 'Wrap', Vector((foot.x, foot.y, 0)), Vector((foot.x, foot.y, 0.2)), 0.44, 0.035, lift=0.004, probe_radius=0.08, max_reach=0.075, rows_n=2))  # a strap, not a boot cuff; the wraps' leather
    # Kilt strips over the hips, dyed cloth (the Heraldry surface): each strip follows the hip and thigh surface down
    # from the belt, so it curves with the body instead of hanging as a flat plank.
    top, bottom = Vector((0, pelvis.y, pelvis.z - 0.02)), Vector((0, pelvis.y, pelvis.z - 0.30))
    for i in range(11):
        ang = (i + 0.5) / 11 * math.pi * 2 - math.pi / 2  # ring_strip's angle 0 is +x; start at the front
        half = 0.13
        length = 0.25 + ((i * 7) % 5) * 0.012  # a worn, uneven hem
        kit.append(ring_strip(f'kilt_{i}', 'Heraldry', top, bottom, 0.0, length, arc=(ang - half, ang + half), segments=5,
                              lift=0.026, thickness=0.005, probe_radius=0.16, max_reach=0.19, rows_n=7, bow=0.012))
    # Iron studs along the baldric and belt: the kit's only metal, skinned like the leather beneath it.
    studs = []
    axis_u = n.cross(Vector((0, 0, 1))).normalized()
    axis_v = n.cross(axis_u)
    for k in range(22):  # rivets along the baldric loop, skipping the underarm
        th = (k + 0.5) / 22 * math.pi * 2
        radial = axis_u * math.cos(th) + axis_v * math.sin(th)
        surface, normal = nearest_surface(centre + radial * 0.30)
        if (surface - centre).length > 0.34 or (surface.x < -0.12 and surface.z > pelvis.z + 0.3):
            continue
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.0065, location=surface + normal * 0.0195)
        studs.append(bpy.context.active_object)
    for k in range(12):
        ang = (k + 0.5) / 12 * math.pi * 2
        surface, normal = nearest_surface(pelvis + Vector((math.sin(ang) * 0.3, -math.cos(ang) * 0.3, 0.03)))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.006, location=surface + normal * 0.0275)
        studs.append(bpy.context.active_object)
    select_only(studs)
    bpy.ops.object.join()
    kit.append(tag(ao_white(transfer_weights(bpy.context.active_object)), 'studs', 'Steel'))
    # Belt buckle: a bronze ring at the front, rigid to the pelvis.
    surface, normal = nearest_surface(pelvis + Vector((0, -0.3, 0.03)))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.02, minor_radius=0.0045, major_segments=20, minor_segments=8, location=surface + normal * 0.03)
    buckle = bpy.context.active_object
    buckle.rotation_euler = (math.radians(90), 0, 0)
    select_only([buckle])
    bpy.ops.object.transform_apply(rotation=True, location=True)
    kit.append(tag(ao_white(buckle), 'buckle', 'Antique brass', bone='pelvis'))
    return kit


def bronze_helmet():
    """Helmet slot, tier 2: an open-faced bronze helm shelled from the head itself (so it fits the skull), cheek guards and
    a nasal, a neck guard behind, and a dyed horsehair crest on the Heraldry surface so the two fighters stay distinct."""
    skull_source = bpy.data.objects.get('kt_head') or HEAD if realistic else body  # the realistic head is its own object; the scan when present
    skull = [v.co for v in skull_source.data.vertices if v.co.z > head.z - 0.03 and abs(v.co.x) < 0.12]
    front_y = min(v.y for v in skull)  # nose tip (-y is the front)
    def keep(p):
        if p.z < head.z - 0.02 or (p.y < 0 and p.z < head.z + 0.015):  # below the neck guard; chin stays free
            return False
        face = p.y < front_y + 0.075 and head.z + 0.015 < p.z < head.z + 0.128 and abs(p.x) < 0.058
        nasal = abs(p.x) < 0.013 and p.z > head.z + 0.055
        return not (face and not nasal)
    helm = extract('helmet_bronze', 'Bronze', keep, lift=0.0, thickness=0.009, source=skull_source)
    helm['slot'] = 'Helmet'  # keeps the head's own unique UVs; bronze is a tiled surface
    # A helm has its own form: project the shell onto a smooth dome (ellipsoid above the brow line, vertical skirt below
    # for the cheek guards and neck guard). Topology, UVs and weights stay; ears and hairline do not.
    centre = Vector((0, head.y + 0.006, head.z + 0.088))
    rx, ry, rz = 0.104, 0.128, 0.118
    for v in helm.data.vertices:
        d = v.co - centre
        if d.z > 0:
            k = math.sqrt((d.x / rx) ** 2 + (d.y / ry) ** 2 + (d.z / rz) ** 2)
        else:
            k = math.sqrt((d.x / rx) ** 2 + (d.y / ry) ** 2)
            d.z *= k  # keep height on the skirt
        projected = d / max(k, 1e-6)
        ear = abs(v.co.x) > 0.06 and head.z + 0.03 < v.co.z < head.z + 0.10
        if not ear and projected.length < d.length + 0.012:  # never inside the head (ears sit inside the dome anyway)
            projected = d.normalized() * (d.length + 0.012)
        v.co = centre + projected
    # Seamless spherical UVs for the bronze: the skin atlas's islands would print their seams onto the metal.
    uv = helm.data.uv_layers.active.data
    for poly in helm.data.polygons:
        us = []
        for li in poly.loop_indices:
            d = helm.data.vertices[helm.data.loops[li].vertex_index].co - centre
            us.append((math.atan2(d.x, d.y) / (2 * math.pi) + 0.5) * 2)
        if max(us) - min(us) > 1:  # polygon straddles the wrap
            us = [u + 2 if u < 1 else u for u in us]
        for li, u in zip(poly.loop_indices, us):
            d = helm.data.vertices[helm.data.loops[li].vertex_index].co - centre
            uv[li].uv = (u, (d.z + 0.15) / 0.3 * 1.5)
    # Crest: an arc of dyed horsehair over the crown, rigid to the head.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.215, minor_radius=0.052, major_segments=32, minor_segments=8,
                                     location=head + Vector((0, 0.01, 0.10)), rotation=(0, math.radians(90), 0))
    crest = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(crest.data)  # local space: ring in XY; after the 90° Y rotation local -y is the front, local -x the crown
    def keep_arc(f):
        c = f.calc_center_median()
        angle = math.degrees(math.atan2(c.y, c.x)) % 360  # 270 = front, 180 = crown, 90 = back
        return 108 <= angle <= 247
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep_arc(f)], context='FACES')
    bm.to_mesh(crest.data)
    bm.free()
    crest.scale = (1, 1, 0.32)  # flatten the tube across the ring plane into a plate
    select_only([crest])
    bpy.ops.object.transform_apply(scale=True, rotation=True, location=True)
    return [helm, tag(crest, 'crest_red', 'Heraldry', bone='Head', slot='Crest')]


def wrap_maps():
    """Wrist wraps at 256: a leather strip seen across its width (v), worn pale along both edges, a stitch line inside each
    edge, grain along the turn (u). Tiles 4× around the arm like every ring strip."""
    size = 256
    v = (np.arange(size) / size)[:, None] * np.ones((1, size))
    grain = fbm(size, 31, octaves=(2, 4, 8, 16))
    streak = fbm(size, 32, octaves=(1, 2, 4))  # low along v (rows), so it reads as lengthwise grain once tiled around
    edge = np.clip((0.09 - np.minimum(v, 1 - v)) / 0.06, 0, 1) * (0.6 + 0.4 * grain)
    stitch = (np.abs(np.minimum(v, 1 - v) - 0.14) < 0.012) * ((np.arange(size)[None, :] // 6) % 2 == 0)
    base = np.array([0.20, 0.13, 0.09])[None, None, :] * (0.85 + 0.30 * grain)[..., None] * (0.9 + 0.2 * streak)[..., None]
    worn = np.array([0.40, 0.29, 0.20])[None, None, :]
    colour = base * (1 - edge[..., None] * 0.7) + worn * (edge[..., None] * 0.7)
    colour = colour * (1 - stitch[..., None] * 0.5) + np.array([0.30, 0.24, 0.17])[None, None, :] * stitch[..., None] * 0.5
    rough = np.clip(0.82 - edge * 0.25 + grain * 0.1, 0.4, 0.95)
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    height = grain * 0.5 - np.clip((0.05 - np.minimum(v, 1 - v)) / 0.05, 0, 1) * 1.5 - stitch * 0.6
    gy, gx = np.gradient(height)
    n = np.stack([-gx * 10, gy * 10, np.ones_like(gx)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return {'baseColor': save_jpeg('wrap_color', colour, 'sRGB'), 'normal': save_jpeg('wrap_normal', n * 0.5 + 0.5, 'Non-Color'), 'metallicRoughness': save_jpeg('wrap_orm', orm, 'Non-Color')}


def linen_maps(tunic, folds, size=2048):
    """The exomis in its own layout (the body atlas' torso): undyed linen — a fine two-way weave, slubs, low mottling —
    with the grime of a fighter's only tunic: dark in the fold creases (from the baked folds normal), at the hem and the
    armpits, a sweat shadow down the chest and the back, dust everywhere; a stitched hem band along the cut edges."""
    shell = tunic.modifiers.get('Shell')
    if shell:
        shell.show_render = shell.show_viewport = False
    pos, mask = bake_position(tunic, size)
    if shell:
        shell.show_render = shell.show_viewport = True
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    rng = np.random.default_rng(51)
    weave = ((np.arange(size)[:, None] // 2 + np.arange(size)[None, :] // 2) % 2) * 0.035 - 0.0175  # a 2-texel cross-hatch at 3.5%: thread texture up close (6% read as a printed grid; 1-texel vanished in the mips)
    slub = np.zeros((size, size), np.float32)
    for _ in range(1400):  # thick threads, a few centimetres long, along the weft
        r, c, n = rng.integers(size), rng.integers(size), rng.integers(12, 40)
        slub[r, c:min(size, c + n)] = rng.uniform(0.04, 0.10)
    mottle = fbm(size, 52, octaves=(4, 8, 16, 32))
    fine = fbm(size, 53, octaves=(64, 128, 256))
    base = np.array([0.52, 0.47, 0.37])[None, None, :] * (0.90 + 0.20 * mottle + weave + slub + 0.06 * (fine - 0.5))[..., None]  # unbleached, greyed linen (0.70/0.64/0.52 rendered as a bedsheet)
    stains = np.clip((fbm(size, 55, octaves=(3, 6, 12)) - 0.58) * 5, 0, 1)  # a few old stains
    crease = np.clip((np.abs(folds[..., 0] - 0.5) + np.abs(folds[..., 1] - 0.5)) * 4 - 0.15, 0, 1)  # where the folds bend
    if crease.shape[0] != size:
        crease = upsample(crease, size)
    hem = np.clip((pelvis.z + 0.05 - z) / 0.08, 0, 1)
    armpit = sum(np.exp(-(((x - sh.x * 0.85) ** 2 + (y - sh.y) ** 2 + (z - sh.z + 0.06) ** 2) / (2 * 0.06 ** 2))) for sh in (shoulder_l, shoulder_r))
    sweat = np.exp(-((x / 0.06) ** 2)) * np.clip((neck.z - 0.12 - z) / 0.25, 0, 1) * np.clip((z - pelvis.z - 0.06) / 0.1, 0, 1)
    dust = np.clip((fbm(size, 54, octaves=(2, 4, 8, 32)) - 0.4) * 1.6, 0, 1)
    grime = np.clip(0.6 * crease + 0.8 * hem * (0.6 + 0.4 * mottle) + 0.7 * np.clip(armpit, 0, 1) + 0.5 * sweat + 0.55 * dust + 0.5 * stains, 0, 1)
    dirt = np.array([0.30, 0.25, 0.18])[None, None, :]
    colour = base * (1 - grime[..., None] * 0.55) + dirt * (grime[..., None] * 0.55)
    inside = np.clip(HEADMOD.blur(mask.astype(np.float32), 4) * 1.0, 0, 1)  # the cut edges: a darker stitched hem band 4-8 texels in
    band = mask & (inside < 0.97)
    stitch = band & (((np.arange(size)[:, None] + np.arange(size)[None, :]) // 5) % 2 == 0)
    colour = colour * (1 - band[..., None] * 0.18) * (1 - stitch[..., None] * 0.15)
    colour = HEADMOD.fill_margin(colour, mask, steps=16)
    rough = np.clip(0.92 - 0.12 * sweat - 0.05 * grime + 0.04 * (mottle - 0.5), 0.6, 0.98)[::2, ::2]
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    return {'baseColor': save_jpeg('gambeson_color', colour, 'sRGB'), 'metallicRoughness': save_jpeg('gambeson_orm', orm, 'Non-Color')}


def leather_maps(size=512):
    """Baldric, belt, sandal soles and straps: dark oiled leather, tileable — full-grain pores, creases across the strap,
    pale worn edges along v (the ring strips' edges), scuffs. Colour in the map (the material factor is white)."""
    v = (np.arange(size) / size)[:, None] * np.ones((1, size))
    grain = fbm(size, 61, octaves=(8, 16, 32, 64, 128))
    pores = fbm(size, 62, octaves=(128, 256))
    crease = np.clip(np.sin(np.arange(size)[None, :] / size * 2 * math.pi * 7 + fbm(size, 63, octaves=(2, 4)) * 6) * 0.5 + 0.5 - 0.7, 0, 1) * 3
    rng = np.random.default_rng(64)
    scuff = np.zeros((size, size), np.float32)
    for _ in range(60):
        r, c, n = rng.integers(size), rng.integers(size), rng.integers(10, 60)
        scuff[r, c:min(size, c + n)] = rng.uniform(0.3, 0.8)
    edge = np.clip((0.10 - np.minimum(v, 1 - v)) / 0.08, 0, 1) * (0.6 + 0.4 * grain)
    base = np.array([0.26, 0.17, 0.11])[None, None, :] * (0.80 + 0.35 * grain + 0.12 * (pores - 0.5))[..., None]
    worn = np.array([0.46, 0.34, 0.24])[None, None, :]
    colour = base * (1 - edge[..., None] * 0.6) + worn * (edge[..., None] * 0.6)
    colour = colour * (1 - crease[..., None] * 0.10) + worn * (scuff[..., None] * 0.35)  # creases at 0.25 tiled as corduroy on the soles
    rough = np.clip(0.70 - edge * 0.2 + grain * 0.15 + scuff * 0.1, 0.35, 0.95)
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    height = grain * 0.6 + pores * 0.3 - crease * 0.35 - np.clip((0.04 - np.minimum(v, 1 - v)) / 0.04, 0, 1) * 1.5
    gy, gx = np.gradient(height)
    n = np.stack([-gx * 8, gy * 8, np.ones_like(gx)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return {'baseColor': save_jpeg('leather_color', colour, 'sRGB'), 'normal': save_jpeg('leather_normal', n * 0.5 + 0.5, 'Non-Color'), 'metallicRoughness': save_jpeg('leather_orm', orm, 'Non-Color')}


def heraldry_maps(size=512):
    """The pteruges and under-skirt, tileable, undyed: the dye is the material's colour factor (the runtime recolours
    the opponent's), so this map is light — leather grain, dye pooling in the low noise, the strips' bottom edge scuffed
    pale, a stitch line along the top, thin lengthwise wear."""
    v = (np.arange(size) / size)[:, None] * np.ones((1, size))
    u = np.ones((size, 1)) * (np.arange(size) / size)[None, :]
    grain = fbm(size, 71, octaves=(8, 16, 32, 64, 128))
    pool = fbm(size, 72, octaves=(2, 4, 8))
    streak = fbm(size, 73, octaves=(1, 2, 4, 64))  # lengthwise (v) grain once tiled around
    rng = np.random.default_rng(74)
    scuff = np.zeros((size, size), np.float32)
    for _ in range(50):
        r, c, n = rng.integers(int(size * 0.6), size), rng.integers(size), rng.integers(8, 40)
        scuff[r, c:min(size, c + n)] = rng.uniform(0.3, 0.7)
    bottom = np.clip((v - 0.90) / 0.08, 0, 1) * (0.5 + 0.5 * grain)
    value = 0.72 + 0.26 * grain + 0.12 * (streak - 0.5) - 0.30 * pool + 0.35 * bottom + 0.3 * scuff
    colour = np.clip(np.stack([value, value * 0.96, value * 0.92], axis=2), 0, 1)  # (a stitch line at v=0.06 tiled across the under-skirt as rows of rivets: dropped)
    rough = np.clip(0.78 - bottom * 0.15 + grain * 0.12 - pool * 0.1, 0.4, 0.95)
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    height = grain * 0.5 + streak * 0.3 - np.clip((v - 0.96) / 0.04, 0, 1) * 1.5
    gy, gx = np.gradient(height)
    n = np.stack([-gx * 8, gy * 8, np.ones_like(gx)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return {'baseColor': save_jpeg('heraldry_color', colour, 'sRGB'), 'normal': save_jpeg('heraldry_normal', n * 0.5 + 0.5, 'Non-Color'), 'metallicRoughness': save_jpeg('heraldry_orm', orm, 'Non-Color')}


def bronze_maps():
    """Worn bronze at 512: warm metal, green-black patina in the low noise, bright scratches, roughness that follows the wear."""
    size = 512
    height = fbm(size, 21, octaves=(4, 8, 16, 32, 64))
    rng = np.random.default_rng(22)
    scratch = np.zeros((size, size), dtype=np.float32)
    for _ in range(90):
        x0, y0, a, n = rng.random() * size, rng.random() * size, rng.random() * math.pi, int(15 + rng.random() * 70)
        xs = (x0 + np.cos(a) * np.arange(n)).astype(int) % size
        ys = (y0 + np.sin(a) * np.arange(n)).astype(int) % size
        scratch[ys, xs] = 1
    cavity = np.clip(1 - height, 0, 1) ** 1.5
    bronze = np.array([0.42, 0.27, 0.13])[None, None, :]
    patina = np.array([0.10, 0.17, 0.14])[None, None, :]
    colour = bronze * (1 - cavity[..., None] * 0.7) + patina * cavity[..., None] * 0.7
    colour = colour * (1 - scratch[..., None] * 0.35) + np.array([0.72, 0.55, 0.32])[None, None, :] * scratch[..., None] * 0.35
    rough = np.clip(0.32 + height * 0.45 - scratch * 0.15, 0.2, 0.9)
    orm = np.stack([np.ones_like(rough), rough, np.ones_like(rough)], axis=2)
    gy, gx = np.gradient(height - scratch * 0.25)
    n = np.stack([-gx * 14, gy * 14, np.ones_like(gx)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    normal = n * 0.5 + 0.5
    return {'baseColor': save_jpeg('bronze_color', colour, 'sRGB'), 'normal': save_jpeg('bronze_normal', normal, 'Non-Color'), 'metallicRoughness': save_jpeg('bronze_orm', orm, 'Non-Color')}


def proof_ring():
    """A bevelled ring under the helmet: exists only to prove the Blender → build → bake → gate path."""
    bpy.ops.mesh.primitive_torus_add(major_radius=.095, minor_radius=.012, major_segments=40, minor_segments=10, location=neck + Vector((0, 0, .075)))
    ring = bpy.context.active_object
    ring.rotation_euler = (math.radians(6), 0, 0)
    return tag(ring, 'proof_ring', 'Antique brass', 'neck_01')


def upsample(grid, size):
    """Separable bilinear upsample of a square grid to size×size."""
    n = grid.shape[0]
    x = np.linspace(0, n - 1, size)
    rows = np.array([np.interp(x, np.arange(n), grid[i]) for i in range(n)])
    return np.array([np.interp(x, np.arange(n), rows[:, j]) for j in range(size)]).T


def fbm(size, seed, octaves=(8, 16, 32, 64)):
    rng = np.random.default_rng(seed)
    total, weight = np.zeros((size, size)), 0
    for k, n in enumerate(octaves):
        amp = 0.5 ** k
        total += amp * upsample(rng.random((n, n)), size)
        weight += amp
    return total / weight


def save_jpeg(name, rgb, colorspace):
    """rgb: float array h×w×3 in the image's own colour space convention (linear floats for sRGB images)."""
    name = name.replace('@2k', SUFFIX + '@2k') if '@2k' in name else name + SUFFIX
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.colorspace_settings.name = colorspace
    px = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(px.ravel())
    img.file_format = 'JPEG'
    path = os.path.join(materials_out, f'{name}.jpg')
    img.save(filepath=path, quality=88)
    return path


def load_pixels(path, colorspace):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = colorspace
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[:, :, :3]


def downsample(px, factor):
    h, w = px.shape[:2]
    return px.reshape(h // factor, factor, w // factor, factor, -1).mean(axis=(1, 3))


def bake_folds(part, name, size=1024, scale=0.09, strength=0.012):
    """Tangent-space normal map of cloth folds for `part`, baked from a subdivided, procedurally displaced copy of it."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 8
    scene.render.bake.margin = 8
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.03
    scene.render.bake.normal_space = 'TANGENT'
    select_only([part])
    bpy.ops.object.duplicate()
    high = bpy.context.active_object
    high.modifiers.clear()
    lift = high.modifiers.new('Lift', 'DISPLACE')
    lift.strength, lift.mid_level = 0.010, 0
    sub = high.modifiers.new('Sub', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    folds = bpy.data.textures.new('folds', type='CLOUDS')
    folds.noise_scale, folds.noise_depth = scale, 3
    disp = high.modifiers.new('Folds', 'DISPLACE')
    disp.texture, disp.strength, disp.mid_level = folds, strength, 0.5
    weave = bpy.data.textures.new('weave', type='STUCCI')
    weave.noise_scale = 0.004
    fine = high.modifiers.new('Weave', 'DISPLACE')
    fine.texture, fine.strength, fine.mid_level = weave, 0.0012, 0.5
    img = bpy.data.images.new(f'{name}_folds', size, size)
    mat = bpy.data.materials.new(f'{name}_bake')
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    part.data.materials.clear()
    part.data.materials.append(mat)
    shell = part.modifiers.get('Shell')
    if shell:
        shell.show_render = shell.show_viewport = False  # bake the outer surface only
    select_only([part, high])  # low mesh active, high mesh selected
    bpy.ops.object.bake(type='NORMAL', use_clear=True)
    if shell:
        shell.show_render = shell.show_viewport = True
    scene.render.bake.use_selected_to_active = False
    bpy.data.objects.remove(high, do_unlink=True)
    part.data.materials.clear()
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(size, size, 4)[:, :, :3]


def bake_position(obj, size=2048):
    """Object-space position of every texel in `obj`'s UV layout: the map that lets features be painted by landmark."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    scene.render.bake.margin = 16
    scene.render.bake.use_selected_to_active = False
    img = bpy.data.images.new(f'{obj.name}_pos', size, size, float_buffer=True)
    mat = bpy.data.materials.new(f'{obj.name}_posbake')
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    previous = [m for m in obj.data.materials]
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    select_only([obj])
    bpy.ops.object.bake(type='POSITION', use_clear=True)
    obj.data.materials.clear()
    for m in previous:
        obj.data.materials.append(m)
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(size, size, 4)
    return px[:, :, :3], px[:, :, 3] > 0.5


def eye_maps(eye, size=512):
    """Iris, pupil and sclera painted from the eye's own object-space positions: the iris faces -y (forward)."""
    pos, mask = bake_position(eye, size)
    pts_ = np.array([[v.co.x, v.co.y, v.co.z] for v in eye.data.vertices], np.float64)  # true sphere centre (the mean leans to the iris)
    sol_, *_ = np.linalg.lstsq(np.hstack([2 * pts_, np.ones((len(pts_), 1))]), (pts_ ** 2).sum(axis=1), rcond=None)
    centre = sol_[:3].astype(np.float32)
    d = pos - centre[None, None, :]
    r = np.linalg.norm(d, axis=2) + 1e-6
    forward = -d[..., 1] / r  # 1 at the front pole
    angle = np.arccos(np.clip(forward, -1, 1))
    iris = np.clip((0.52 - angle) / 0.03, 0, 1)  # larger than anatomical: less white, a heavier-lidded read
    pupil = np.clip((0.17 - angle) / 0.02, 0, 1)
    theta = np.arctan2(d[..., 2], d[..., 0])
    fibres = 0.5 + 0.5 * np.sin(theta * 48) * np.sin(theta * 7)
    ring = np.clip((angle - 0.38) / 0.09, 0, 1)  # limbal ring: dark, wide
    iris_colour = np.array([0.22, 0.13, 0.06])[None, None, :] * (0.7 + fibres[..., None] * 0.6) * (1 - ring[..., None] * 0.75)
    sclera = np.array([0.74, 0.68, 0.63])[None, None, :] * (0.85 + 0.15 * (1 - np.clip((angle - 0.5) / 0.9, 0, 1)))[..., None]
    # The upper lid overhangs the eye: its shadow on the VISIBLE upper sclera is what stops an eye reading as a white
    # ball. z/r = 0 is straight ahead; the shadow starts just below that and is solid by a third of the way up.
    lid = np.clip((d[..., 2] / r + 0.30) / 0.55, 0, 1)
    sclera *= (1 - lid ** 1.3 * 0.5)[..., None]
    side = np.clip((np.abs(d[..., 0]) / r - 0.40) / 0.45, 0, 1)  # the eyeball darkens toward the corners and the sides
    sclera = sclera * (1 - side[..., None] * 0.45) + np.array([0.42, 0.24, 0.20])[None, None, :] * (side * 0.35)[..., None]
    veins = fbm(size, 71, octaves=(32, 64, 128))
    sclera[..., 1:] *= 1 - np.clip((veins - 0.62) * 4, 0, 1)[..., None] * 0.35
    colour = sclera * (1 - iris[..., None]) + iris_colour * iris[..., None]
    colour *= (1 - lid[..., None] ** 1.3 * 0.5 * iris[..., None])  # the lid shadow crosses the iris too
    colour *= (1 - pupil[..., None] * 0.97)
    rough = np.where(iris > 0.5, 0.10, 0.48).astype(np.float32)  # wet cornea; the white is moist, not glass
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    return {'baseColor': save_jpeg('eye_color', colour, 'sRGB'), 'metallicRoughness': save_jpeg('eye_orm', orm, 'Non-Color')}


def bake_high_normal(low, high, size=2048, cage=0.02):
    """Tangent normal map of `high`'s surface detail onto `low`'s UV layout (multires sculpt → game mesh)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 8
    scene.render.bake.margin = 8
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = cage
    scene.render.bake.normal_space = 'TANGENT'
    img = bpy.data.images.new(f'{low.name}_hi', size, size)
    mat = bpy.data.materials.new(f'{low.name}_hibake')
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    previous = [m for m in low.data.materials]
    low.data.materials.clear()
    low.data.materials.append(mat)
    high.hide_render = high.hide_viewport = False
    select_only([low, high])
    bpy.ops.object.bake(type='NORMAL', use_clear=True)
    scene.render.bake.use_selected_to_active = False
    low.data.materials.clear()
    for m in previous:
        low.data.materials.append(m)
    high.hide_render = True
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(size, size, 4)[:, :, :3]


def bake_ao(size=1024, distance=0.35):
    """Cycles ambient occlusion of the bare body in its own UV layout, at rest. Cloth and leather cut from the body share
    that layout, so one bake serves the skin (multiplied in) and every extracted piece (as a glTF occlusion map)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.world = scene.world or bpy.data.worlds.new('bake')
    scene.world.light_settings.distance = distance
    scene.render.bake.margin = 8
    img = bpy.data.images.new('ao', size, size)
    mat = bpy.data.materials.new('bake')
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    previous = [m for m in body.data.materials]
    body.data.materials.clear()
    body.data.materials.append(mat)
    select_only([body])
    bpy.ops.object.bake(type='AO', use_clear=True)
    body.data.materials.clear()
    for m in previous:
        body.data.materials.append(m)
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    ao = px.reshape(size, size, 4)[:, :, 0]
    return np.clip(ao, 0, 1)


AO = None
HEAD = None  # realistic: the head object (its own material and texture tile)
REAL = None
FITTED = None
DENSE = None


def occlusion_map():
    """The baked occlusion as a shared greyscale JPEG (contact shadow under straps, arms, jaw, between fingers)."""
    soft = np.clip(AO ** 1.3, 0, 1)
    return save_jpeg('ao_body', np.stack([soft, soft, soft], axis=2), 'Non-Color')


def hair_maps():
    """The CC0 hair set at 512: dark cropped hair with a soft hairline instead of a flat cap."""
    colour = downsample(load_pixels(f'{TEXTURES}/T_Hair_1_BaseColor.png', 'sRGB'), 4)
    colour = colour * np.array([0.55, 0.42, 0.32])[None, None, :] * 0.7  # dark brown, keeps the strand shading
    normal = downsample(load_pixels(f'{TEXTURES}/T_Hair_1_Normal.png', 'Non-Color'), 4)
    return {'baseColor': save_jpeg('hair_color', colour, 'sRGB'), 'normal': save_jpeg('hair_normal', normal, 'Non-Color')}


def save_two_sizes(name, rgb, colorspace):
    """Author at 2K, ship 1K: `<name>@2k.jpg` beside `<name>.jpg` (the build picks @2k with WARRIOR_TEXTURES=2k)."""
    if rgb.shape[0] >= 2048:
        save_jpeg(f'{name}@2k', rgb, colorspace)
        rgb = downsample(rgb, rgb.shape[0] // 1024)
    return save_jpeg(name, rgb, colorspace)


def pore_normal(normal, seed=31, strength=0.35):
    """Fine skin pores layered into a normal map: high-frequency noise slopes added to the tangent components."""
    size = normal.shape[0]
    rng = np.random.default_rng(seed)
    fine = rng.random((size, size)).astype(np.float32)
    fine = (fine + np.roll(fine, 1, 0) + np.roll(fine, 1, 1) + np.roll(np.roll(fine, 1, 0), 1, 1)) / 4  # soften to ~2 px pores
    gy, gx = np.gradient(fine)
    out = normal.copy()
    out[..., 0] = np.clip(out[..., 0] - gx * strength, 0, 1)
    out[..., 1] = np.clip(out[..., 1] + gy * strength, 0, 1)
    return out


def skin_maps():
    """Skin maps from the CC0 source with an ash-and-grit pass: grey dust in the noise, dark speckles, no clean skin.
    Authored at the source's 2K; the shipped default is the 1K downsample."""
    os.makedirs(materials_out, exist_ok=True)
    colour = load_pixels(f'{TEXTURES}/T_Superhero_Male_Ligh.png', 'sRGB')
    size = colour.shape[0]
    dust = np.clip((fbm(size, 1, octaves=(4, 8, 16, 64)) - 0.40) * 2.4, 0, 1)
    speck = (np.random.default_rng(2).random((size, size)) < 0.006).astype(np.float32) * (fbm(size, 3) > 0.45)
    ash = np.array([0.20, 0.19, 0.18])[None, None, :]
    grime = np.array([0.06, 0.045, 0.035])[None, None, :]
    out_colour = colour * (1 - dust[..., None] * 0.5) + ash * dust[..., None] * 0.5
    out_colour = out_colour * (1 - speck[..., None] * 0.4) + grime * speck[..., None] * 0.4
    out_colour *= np.array([0.92, 0.86, 0.80])[None, None, :]  # sun-darkened, less pink
    ao_full = upsample(AO, size) if AO.shape[0] != size else AO
    cavity = (0.42 + 0.58 * np.clip(ao_full, 0, 1) ** 1.6)[..., None]  # baked occlusion as dirt and shadow in every crease
    out_colour = out_colour * cavity
    # Stubble: fine dark grain over the jaw and upper lip of the face island (atlas rows are bottom-up).
    yy, xx = np.mgrid[0:size, 0:size] / size
    jaw = np.exp(-((yy - 0.80) / 0.045) ** 2) * (xx < 0.34) * (np.abs(xx - 0.17) < 0.12)
    grain = (np.random.default_rng(5).random((size, size)) < 0.35).astype(np.float32)
    out_colour = out_colour * (1 - (jaw * grain * 0.22)[..., None])
    normal = pore_normal(load_pixels(f'{TEXTURES}/T_Superhero_Male_Normal.png', 'Non-Color'))
    rough = downsample(load_pixels(f'{TEXTURES}/T_Superhero_Male_Roughness.png', 'Non-Color'), 4)[:, :, 0]
    r = rough.shape[0]
    rough = np.clip(rough * 0.85 + dust[::size // r, ::size // r] * 0.25 + (fbm(r, 8) - 0.5) * 0.25, 0, 1)  # oil and sweat vary the sheen
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    return {'baseColor': save_two_sizes('skin_color', out_colour, 'sRGB'), 'normal': save_two_sizes('skin_normal', normal, 'Non-Color'), 'metallicRoughness': save_jpeg('skin_orm', orm, 'Non-Color')}


OUTFITS = 'artifacts/source/outfits/Modular Character Outfits - Fantasy[Standard]'


def export_kit(kit, path, skins=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    armatures = list({o.find_armature() or armature for o in kit})
    select_only(kit + armatures)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_extras=True, export_apply=True,
                              export_yup=True, export_materials='NONE', export_skins=skins, export_animations=False,
                              export_normals=True, export_texcoords=True)
    for obj in kit:
        print(f'PART {obj.name} material={obj["material"]} slot={obj["slot"]} bone={obj.get("bone", "skinned")} faces={len(obj.data.polygons)}')
    print(f'PARTS {len(kit)} → {path}')


def ranger_items():
    """Loot-tier light armour from the CC0 Modular Character Outfits pack (rigged to this skeleton): boots, bracers, one
    pauldron. Imported as-is; their own UVs address the pack's atlas, which ranger_maps() re-tints into our palette."""
    items = []
    for part, slot, ratio in [('Male_Ranger_Feet_Boots', 'Boots', 0.6), ('Male_Ranger_Arms', 'Arms', 0.6), ('Male_Ranger_Acc_Pauldron', 'Shoulders', 0.8)]:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=f'{OUTFITS}/glTF (Godot-Unreal)/Modular Parts/{part}.gltf')
        new = [o for o in bpy.data.objects if o not in before]
        mesh = next(o for o in new if o.type == 'MESH' and o.name.startswith(part))  # the rig ships a helper Icosphere too
        for o in new:
            if o.type == 'MESH' and o is not mesh:
                bpy.data.objects.remove(o, do_unlink=True)
        rig = next(o for o in new if o.type == 'ARMATURE')
        rig.matrix_world.identity()
        decimate = mesh.modifiers.new('Budget', 'DECIMATE')  # the pack is not low-poly; keep the phone budget
        decimate.ratio = ratio
        mesh.modifiers.move(len(mesh.modifiers) - 1, 0)  # before the armature modifier
        items.append(tag(mesh, part.replace('Male_Ranger_', '').lower(), 'Ranger', slot=slot))
    return items


def ranger_maps():
    """The pack's 4K Ranger PBR set at 1024, greens pulled to worn leather, plus the same dust and grit as the skin."""
    os.makedirs(materials_out, exist_ok=True)
    colour = downsample(load_pixels(f'{OUTFITS}/Textures/Ranger/T_Ranger_BaseColor.png', 'sRGB'), 4)
    size = colour.shape[0]
    r, g, b = colour[..., 0], colour[..., 1], colour[..., 2]
    green = np.clip((g - np.maximum(r, b)) / (g + 1e-3) * 5, 0, 1)[..., None]  # relative greenness, catches dark olives
    leather = np.array([0.30, 0.19, 0.11])[None, None, :]
    lum = (0.3 * r + 0.59 * g + 0.11 * b)[..., None]
    colour = colour * (1 - green) + (leather * np.clip(lum / 0.18, 0.25, 1.6)) * green  # keep the pack's shading, drop its hue
    grey = lum * np.ones_like(colour)
    colour = colour * 0.8 + grey * 0.2  # take the remaining chroma down a step
    dust = np.clip((fbm(size, 11, octaves=(4, 8, 16, 64)) - 0.42) * 2.2, 0, 1)[..., None]
    colour = colour * (1 - dust * 0.4) + np.array([0.18, 0.17, 0.16])[None, None, :] * dust * 0.4
    normal = downsample(load_pixels(f'{OUTFITS}/Textures/Ranger/T_Ranger_Normal.png', 'Non-Color'), 4)
    orm = downsample(load_pixels(f'{OUTFITS}/Textures/Ranger/T_Ranger_ORM.png', 'Non-Color'), 8)
    orm[..., 1] = np.clip(orm[..., 1] * 0.9 + dust[::2, ::2, 0] * 0.25, 0, 1)
    return {'baseColor': save_jpeg('ranger_color', colour, 'sRGB'), 'normal': save_jpeg('ranger_normal', normal, 'Non-Color'), 'metallicRoughness': save_jpeg('ranger_orm', orm, 'Non-Color')}


if proof:
    export_kit([proof_ring()], os.path.join(out, 'proof_ring.glb'), skins=False)
else:
    body_parts = realistic_body() if realistic else []
    if realistic:
        HIGH.hide_render = True  # only the game mesh occludes itself
        use_kt = os.environ.get('HEAD_KT', '1') == '1' and os.path.exists(HEADMOD.KT_GLB)  # the photogrammetry head replaces ours
        if use_kt:
            eye_l_o, eye_r_o = bpy.data.objects['eye_L'], bpy.data.objects['eye_R']
            el = sum((v.co for v in eye_l_o.data.vertices), Vector()) / len(eye_l_o.data.vertices)
            er = sum((v.co for v in eye_r_o.data.vertices), Vector()) / len(eye_r_o.data.vertices)
            HEADMOD.keentools_skin_tone(el, er, max(v.co.z for v in body.data.vertices))  # the body is painted to match the scan; the scan is sized to the base body's crown
            FACE['kt_neck_z'] = HEADMOD.NECK_Z
        REAL = HEADMOD.build(body, HIGH, FACE, armature, select_only, save_two_sizes, save_jpeg, materials_out, tag)  # bare body: bakes first
        AO, HEAD, body = REAL['ao_body'], REAL['head'], REAL['body']
        body_parts = REAL['parts'] + [o for o in body_parts if o.name.startswith('eye_')]
        if use_kt:
            kt_parts, kt_maps, neck_z, neck_c = HEADMOD.keentools_head(HEAD, el, er, armature, select_only, tag, save_jpeg, save_two_sizes, materials_out)
            REAL['maps'].update(kt_maps)
            HEADMOD.neck_tiles(REAL, neck_z, neck_c, select_only, save_two_sizes, save_jpeg)  # the neck continues the scanned head's tone; occlusion re-baked against the scanned head
            AO = REAL['ao_body']
            body_parts = [o for o in body_parts if o.name not in ('hair_shells', 'brow_cards', 'eye_L', 'eye_R')] + kt_parts
    else:
        AO = bake_ao()  # bare body only: every later piece would occlude it
    kit = level1_kit()
    if realistic:
        export_kit(body_parts, os.path.join(out, f'body_{VARIANT}.glb'))  # head, body, eyes, hair/brow/lash cards
    tunic = next(o for o in kit if o.name == 'tunic')
    folds = bake_folds(tunic, 'tunic')
    GAMBESON_NORMAL = save_jpeg('gambeson_normal', folds, 'Non-Color')
    GAMBESON_MAPS = linen_maps(tunic, folds)  # the tunic's colour and roughness in the same layout
    export_kit(kit, os.path.join(out, f'level1_{VARIANT}.glb' if realistic else 'level1.glb'))
    ITEM = '' if FIGHTER == 'hero' else f'_{FIGHTER}'  # the helm is shelled from this fighter's own skull: one per head
    if FIGHTER == 'hero':
        export_kit(ranger_items(), 'src/assets/source/items/ranger.glb')  # fitted to the shared body: one copy
    helm, crest = bronze_helmet()
    export_kit([helm], f'src/assets/source/items/helmet_bronze{ITEM}.glb')   # a poor gladiator's first helm: plain
    export_kit([crest], f'src/assets/source/items/crest_red{ITEM}.glb')      # the crest is a later, extravagant reward
if not proof:
    import json
    manifest_path = os.path.join(materials_out, f'manifest_{VARIANT}.json' if realistic else 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    ao_file = os.path.basename(occlusion_map())
    extra = [('Eyes', eye_maps(bpy.data.objects['eye_L']), 0.5), ('Face', REAL['maps']['Face'], 1.6), ('HairCards', REAL['maps']['HairCards'], 1.0), ('BrowCards', REAL['maps']['BrowCards'], 1.0), ('HairShell', REAL['maps']['HairShell'], 1.0)] + [(k, REAL['maps'][k], 0.8) for k in ('Photo', 'PhotoEyes', 'PhotoTeeth') if k in REAL['maps']] if realistic else []
    # the Studio sculpt's muscle relief is subtle: amplified in the shader (Skin normalScale 1.6 for the realistic build)
    for name, maps, scale in [('Skin', REAL['maps']['Skin'] if realistic else skin_maps(), 1.6 if realistic else 0.8), ('Ranger', ranger_maps(), 1.0), ('Bronze', bronze_maps(), 0.7), ('Wrap', wrap_maps(), 1.0), ('Hair', hair_maps(), 0.6)] + extra:
        manifest[name] = {k: os.path.basename(v) for k, v in maps.items()}
        manifest[name]['normalScale'] = scale
        print(f'MAPS {name} {maps}')
    manifest['Skin']['occlusion'] = ao_file
    for name in ['Gambeson', 'Leather', 'Heraldry', 'Steel']:  # baked occlusion via TEXCOORD_1; Steel keeps the build's procedural colour
        manifest[name] = {'occlusion': ao_file, 'occlusionTexCoord': 1}
    for name, maps in (('Gambeson', GAMBESON_MAPS), ('Leather', leather_maps()), ('Heraldry', heraldry_maps())):  # authored kit materials (body pass B3)
        manifest[name].update({k: os.path.basename(v) for k, v in maps.items()})
        manifest[name]['normalScale'] = 1.0
    manifest['Gambeson']['normal'] = os.path.basename(GAMBESON_NORMAL)  # baked folds in the tunic's own layout
    manifest['Gambeson']['normalScale'] = 1.5  # the folds read flat at 1.0 once the cloth had a real colour map
    json.dump(manifest, open(manifest_path, 'w'), indent=1)
