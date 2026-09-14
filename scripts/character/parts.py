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

SOURCE = 'artifacts/source/base/Universal Base Characters[Standard]/Base Characters'
BASE = f'{SOURCE}/Godot - UE/Superhero_Male_FullBody.gltf'
TEXTURES = f'{SOURCE}/Textures'
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
proof = '--proof' in args
out = args[args.index('--proof') + 1] if proof else 'src/assets/source/parts'
materials_out = 'src/assets/source/materials'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BASE)
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
armature.matrix_world.identity()  # author against the unscaled rest pose
body = bpy.data.objects['SuperHero_Male']
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not body]:
    bpy.data.objects.remove(o, do_unlink=True)
while len(body.data.uv_layers) > 1:  # the source carries an empty second UV set; TEXCOORD_1 is ours (occlusion)
    body.data.uv_layers.remove(body.data.uv_layers[1])


def joint(name):
    """Rest-pose position of a bone head, in the unscaled rig space (Blender Z-up)."""
    return armature.data.bones[name].head_local.copy()


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
    obj['slot'] = slot or slot_for(name)
    if bone:
        obj['bone'] = bone
    return obj


def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def extract(name, material, keep, lift=0.012, thickness=0.008):
    """Clothing cut from the body itself: faces whose centre passes `keep(p)` are kept, lifted off the skin and given
    thickness. Vertex groups (skin weights) and UVs come with the faces, so the piece deforms exactly like the body."""
    select_only([body])
    bpy.ops.object.duplicate()
    part = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(part.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)  # weld UV-seam splits so only the real cut counts as a boundary
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(keep(v.co) for v in f.verts)], context='FACES')
    smooth_boundary(bm)
    bm.to_mesh(part.data)
    bm.free()
    ao_uv = part.data.uv_layers.new(name='ao')  # TEXCOORD_1 → the body's baked occlusion, same layout as the skin atlas
    for i, loop in enumerate(part.data.uv_layers[0].data):
        ao_uv.data[i].uv = loop.uv
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


def ring_strip(name, material, a, b, t, width, arc=(0.0, 2 * math.pi), segments=28, lift=0.004, thickness=0.004, probe_radius=0.2, max_reach=None, rows_n=1):
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
    # Forearm wraps: five overlapping leather turns from the wrist up, both arms.
    for elbow, hand, side in [(elbow_l, hand_l, 1), (elbow_r, hand_r, -1)]:
        for k in range(5):
            kit.append(ring_strip(f'wrap_{"l" if side > 0 else "r"}_{k}', 'Leather', elbow, hand, 0.86 - k * 0.11, 0.14, lift=0.004 + k * 0.0015, probe_radius=0.1, max_reach=0.09))
    # Sandals: a thick sole under the foot, straps over the instep and toes, an ankle strap. Toes stay bare.
    for foot, ball, side in [(foot_l, joint('ball_l'), 1), (foot_r, joint('ball_r'), -1)]:
        name = 'l' if side > 0 else 'r'
        kit.append(extract(f'sole_{name}', 'Leather', lambda p, s=side: p.x * s > 0 and p.z < 0.014, lift=0.0, thickness=0.014))
        heel = Vector((foot.x, foot.y, 0.012))  # the strap rings run from the heel-top down the foot to the toes
        toe = Vector((ball.x, ball.y - 0.02, 0.012))
        kit.append(ring_strip(f'strap_instep_{name}', 'Leather', heel, toe, 0.42, 0.016, arc=(0, math.pi), lift=0.004, probe_radius=0.08, max_reach=0.075))
        kit.append(ring_strip(f'strap_toe_{name}', 'Leather', heel, toe, 0.80, 0.012, arc=(0, math.pi), lift=0.004, probe_radius=0.08, max_reach=0.07))
        kit.append(ring_strip(f'strap_ankle_{name}', 'Leather', Vector((foot.x, foot.y, 0)), Vector((foot.x, foot.y, 0.2)), 0.42, 0.06, lift=0.004, probe_radius=0.08, max_reach=0.075))
    # Kilt strips over the hips, dyed cloth (the Heraldry surface): each strip follows the hip and thigh surface down
    # from the belt, so it curves with the body instead of hanging as a flat plank.
    top, bottom = Vector((0, pelvis.y, pelvis.z - 0.02)), Vector((0, pelvis.y, pelvis.z - 0.30))
    for i in range(11):
        ang = (i + 0.5) / 11 * math.pi * 2 - math.pi / 2  # ring_strip's angle 0 is +x; start at the front
        half = 0.13
        length = 0.25 + ((i * 7) % 5) * 0.012  # a worn, uneven hem
        kit.append(ring_strip(f'kilt_{i}', 'Heraldry', top, bottom, 0.0, length, arc=(ang - half, ang + half), segments=3,
                              lift=0.026, thickness=0.005, probe_radius=0.16, max_reach=0.19, rows_n=7))
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
    skull = [v.co for v in body.data.vertices if v.co.z > head.z - 0.03 and abs(v.co.x) < 0.12]
    front_y = min(v.y for v in skull)  # nose tip (-y is the front)
    crown_z = max(v.z for v in skull)
    def keep(p):
        if p.z < head.z - 0.02 or (p.y < 0 and p.z < head.z + 0.015):  # below the neck guard; chin stays free
            return False
        face = p.y < front_y + 0.075 and head.z + 0.015 < p.z < head.z + 0.128 and abs(p.x) < 0.058
        nasal = abs(p.x) < 0.013 and p.z > head.z + 0.055
        return not (face and not nasal)
    helm = extract('helmet_bronze', 'Bronze', keep, lift=0.0, thickness=0.009)
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


def skin_maps():
    """Mobile-sized skin maps from the CC0 source with an ash-and-grit pass: grey dust in the noise, dark speckles, no clean skin."""
    os.makedirs(materials_out, exist_ok=True)
    colour = downsample(load_pixels(f'{TEXTURES}/T_Superhero_Male_Ligh.png', 'sRGB'), 2)
    size = colour.shape[0]
    dust = np.clip((fbm(size, 1, octaves=(4, 8, 16, 64)) - 0.40) * 2.4, 0, 1)
    speck = (np.random.default_rng(2).random((size, size)) < 0.006).astype(np.float32) * (fbm(size, 3) > 0.45)
    ash = np.array([0.20, 0.19, 0.18])[None, None, :]
    grime = np.array([0.06, 0.045, 0.035])[None, None, :]
    out_colour = colour * (1 - dust[..., None] * 0.5) + ash * dust[..., None] * 0.5
    out_colour = out_colour * (1 - speck[..., None] * 0.4) + grime * speck[..., None] * 0.4
    out_colour *= np.array([0.92, 0.86, 0.80])[None, None, :]  # sun-darkened, less pink
    cavity = (0.42 + 0.58 * np.clip(AO, 0, 1) ** 1.6)[..., None]  # baked occlusion as dirt and shadow in every crease
    out_colour = out_colour * cavity
    # Stubble: fine dark grain over the jaw and upper lip of the face island (atlas rows are bottom-up).
    yy, xx = np.mgrid[0:size, 0:size] / size
    jaw = np.exp(-((yy - 0.80) / 0.045) ** 2) * (xx < 0.34) * (np.abs(xx - 0.17) < 0.12)
    grain = (np.random.default_rng(5).random((size, size)) < 0.35).astype(np.float32)
    out_colour = out_colour * (1 - (jaw * grain * 0.22)[..., None])
    normal = downsample(load_pixels(f'{TEXTURES}/T_Superhero_Male_Normal.png', 'Non-Color'), 2)
    rough = downsample(load_pixels(f'{TEXTURES}/T_Superhero_Male_Roughness.png', 'Non-Color'), 4)[:, :, 0]
    rough = np.clip(rough * 0.85 + dust[::2, ::2] * 0.25 + (fbm(size // 2, 8) - 0.5) * 0.25, 0, 1)  # oil and sweat vary the sheen
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    return {'baseColor': save_jpeg('skin_color', out_colour, 'sRGB'), 'normal': save_jpeg('skin_normal', normal, 'Non-Color'), 'metallicRoughness': save_jpeg('skin_orm', orm, 'Non-Color')}


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
    AO = bake_ao()  # bare body only: every later piece would occlude it
    export_kit(level1_kit(), os.path.join(out, 'level1.glb'))
    export_kit(ranger_items(), 'src/assets/source/items/ranger.glb')
    helm, crest = bronze_helmet()
    export_kit([helm], 'src/assets/source/items/helmet_bronze.glb')   # a poor gladiator's first helm: plain
    export_kit([crest], 'src/assets/source/items/crest_red.glb')      # the crest is a later, extravagant reward
if not proof:
    import json
    manifest_path = os.path.join(materials_out, 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    ao_file = os.path.basename(occlusion_map())
    for name, maps, scale in [('Skin', skin_maps(), 0.8), ('Ranger', ranger_maps(), 1.0), ('Bronze', bronze_maps(), 0.7), ('Hair', hair_maps(), 0.6)]:
        manifest[name] = {k: os.path.basename(v) for k, v in maps.items()}
        manifest[name]['normalScale'] = scale
        print(f'MAPS {name} {maps}')
    manifest['Skin']['occlusion'] = ao_file
    for name in ['Gambeson', 'Leather', 'Heraldry', 'Steel']:  # procedural colour, baked occlusion via TEXCOORD_1
        manifest[name] = {'occlusion': ao_file, 'occlusionTexCoord': 1}
    json.dump(manifest, open(manifest_path, 'w'), indent=1)
