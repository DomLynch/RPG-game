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


def joint(name):
    """Rest-pose position of a bone head, in the unscaled rig space (Blender Z-up)."""
    return armature.data.bones[name].head_local.copy()


def tag(obj, name, material, bone=None):
    obj.name = name
    obj['material'] = material
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
    # Sleeveless: the armholes end at the shoulder joint; the neckline dips at the front.
    def neckline(p):
        dip = math.exp(-(p.x / 0.07) ** 2) * (0.075 if p.y < 0 else 0.025)
        return neck.z - 0.04 - dip
    def armhole(p):
        return (p - shoulder_l).length < 0.105 or (p - shoulder_r).length < 0.105
    kit.append(extract('tunic', 'Gambeson', lambda p: abs(p.x) < torso_half_width + 0.06 and pelvis.z - 0.03 < p.z < neckline(p) and not armhole(p), lift=0.010, thickness=0.005))
    # Under-skirt: dyed cloth over hips and upper thighs, so the strips above it never show skin between them.
    kit.append(extract('skirt', 'Heraldry', lambda p: abs(p.x) < 0.24 and pelvis.z - 0.25 < p.z < pelvis.z + 0.01, lift=0.014, thickness=0.005))
    # Baldric: a leather band from the left shoulder to the right hip, front and back.
    a, b = Vector((shoulder_l.x - 0.05, 0, shoulder_l.z)), Vector((shoulder_r.x + 0.16, 0, pelvis.z + 0.03))
    d = (b - a).normalized()
    def on_baldric(p):
        q = Vector((p.x, 0, p.z))
        t = (q - a).dot(d)
        return in_torso(p) and 0 < t < (b - a).length and abs((q - a - d * t).length) < 0.032
    kit.append(extract('baldric', 'Leather', on_baldric, lift=0.022, thickness=0.006))
    # Belt around the hips.
    kit.append(extract('belt', 'Leather', lambda p: in_torso(p) and pelvis.z + 0.005 < p.z < pelvis.z + 0.055, lift=0.024, thickness=0.007))
    # Forearm wraps, both arms.
    for elbow, hand, side in [(elbow_l, hand_l, 1), (elbow_r, hand_r, -1)]:
        kit.append(extract(f'wrap_{"l" if side > 0 else "r"}', 'Leather', lambda p, e=elbow, h=hand: 0.30 < along(p, e, h) < 0.92 and abs(p.z - e.z) < 0.09, lift=0.006, thickness=0.006))
    # Sandal-boots: the foot itself, plus an ankle strap.
    for foot, calf, side in [(foot_l, calf_l, 1), (foot_r, calf_r, -1)]:
        kit.append(extract(f'sandal_{"l" if side > 0 else "r"}', 'Leather', lambda p, f=foot, s=side: p.x * s > 0 and (p.z < f.z + 0.01 or f.z + 0.05 < p.z < f.z + 0.085), lift=0.007, thickness=0.006))
    # Kilt strips over the hips, dyed cloth (the Heraldry surface): weights come from the nearest body vertex.
    strips = []
    for i in range(10):
        ang = (i + 0.5) / 10 * math.pi * 2
        radial = Vector((math.sin(ang), -math.cos(ang), 0))  # -y is the front
        surface, normal = nearest_surface(pelvis + radial * 0.25 + Vector((0, 0, -0.06)))
        top = surface + normal * 0.028
        bpy.ops.mesh.primitive_plane_add(size=1, location=top + Vector((0, 0, -0.12)))
        strip = bpy.context.active_object
        strip.scale = (0.055, 0.26, 1)
        strip.rotation_euler = (math.radians(90), 0, math.atan2(radial.x, -radial.y))
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        bpy.ops.object.modifier_add(type='SUBSURF')
        strip.modifiers[-1].levels = strip.modifiers[-1].render_levels = 1
        strip.modifiers[-1].subdivision_type = 'SIMPLE'
        shell = strip.modifiers.new('Shell', 'SOLIDIFY')
        shell.thickness, shell.offset = 0.006, 0
        strips.append(strip)
    select_only(strips)
    bpy.ops.object.join()
    kilt = bpy.context.active_object
    kit.append(tag(transfer_weights(kilt), 'kilt', 'Heraldry'))
    # Iron studs along the baldric and belt: the kit's only metal, skinned like the leather beneath it.
    studs = []
    for k in range(16):
        t = (k + 0.5) / 16
        for front in (True, False):
            probe = a + (b - a) * t + Vector((0, -0.3 if front else 0.3, 0))
            surface, normal = nearest_surface(probe)
            if abs(surface.x) >= torso_half_width - 0.01:
                continue  # the strap stops at the torso edge; so do its studs
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.0065, location=surface + normal * 0.026)
            studs.append(bpy.context.active_object)
    for k in range(12):
        ang = (k + 0.5) / 12 * math.pi * 2
        surface, normal = nearest_surface(pelvis + Vector((math.sin(ang) * 0.3, -math.cos(ang) * 0.3, 0.03)))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.006, location=surface + normal * 0.029)
        studs.append(bpy.context.active_object)
    select_only(studs)
    bpy.ops.object.join()
    kit.append(tag(transfer_weights(bpy.context.active_object), 'studs', 'Steel'))
    return kit


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
    normal = downsample(load_pixels(f'{TEXTURES}/T_Superhero_Male_Normal.png', 'Non-Color'), 2)
    rough = downsample(load_pixels(f'{TEXTURES}/T_Superhero_Male_Roughness.png', 'Non-Color'), 4)[:, :, 0]
    rough = np.clip(rough * 0.85 + dust[::2, ::2] * 0.25, 0, 1)
    orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    return {'baseColor': save_jpeg('skin_color', out_colour, 'sRGB'), 'normal': save_jpeg('skin_normal', normal, 'Non-Color'), 'metallicRoughness': save_jpeg('skin_orm', orm, 'Non-Color')}


kit = [proof_ring()] if proof else level1_kit()
os.makedirs(out, exist_ok=True)
select_only(kit + [armature])
path = os.path.join(out, 'proof_ring.glb' if proof else 'level1.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_extras=True, export_apply=True,
                          export_yup=True, export_materials='NONE', export_skins=not proof, export_animations=False,
                          export_normals=True, export_texcoords=True)
for obj in kit:
    print(f'PART {obj.name} material={obj["material"]} bone={obj.get("bone", "skinned")} faces={len(obj.data.polygons)}')
print(f'PARTS {len(kit)} → {path}')
if not proof:
    maps = skin_maps()
    import json
    manifest_path = os.path.join(materials_out, 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    manifest['Skin'] = {k: os.path.basename(v) for k, v in maps.items()}
    manifest['Skin']['normalScale'] = 0.8
    json.dump(manifest, open(manifest_path, 'w'), indent=1)
    print(f'MAPS {maps}')
