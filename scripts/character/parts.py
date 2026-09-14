# Headless Blender authoring for warrior parts. Reproducible: committed script → src/assets/source/parts/*.glb → build-warrior.mjs.
#   blender -b -P scripts/character/parts.py                    write the kit (none yet) to src/assets/source/parts
#   blender -b -P scripts/character/parts.py -- --proof <dir>   write a pipeline-proof ring instead, into <dir>
# Contract for every exported mesh: coordinates in the base rig's UNSCALED rest space (build-warrior.mjs narrows the
# finished scene by 0.9/0.97/0.97 afterwards), Y-up metres, UVs present, custom properties `bone` (rigid attachment)
# and `material` (one of Steel, Antique brass, Leather, Heraldry). Materials and textures are assigned by the build, not here.
import math
import os
import sys

import bpy
from mathutils import Vector

BASE = 'artifacts/source/base/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = args[args.index('--proof') + 1] if '--proof' in args else 'src/assets/source/parts'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BASE)
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
armature.matrix_world.identity()  # author against the unscaled rest pose
for o in [o for o in bpy.data.objects if o.type != 'ARMATURE']:
    bpy.data.objects.remove(o, do_unlink=True)


def joint(name):
    """Rest-pose position of a bone head, in the unscaled rig space (Blender Z-up)."""
    return armature.data.bones[name].head_local.copy()


def part(name, bone, material, mesh_obj):
    mesh_obj.name = name
    mesh_obj['bone'] = bone
    mesh_obj['material'] = material
    return mesh_obj


def proof_ring():
    """A bevelled ring under the helmet: exists only to prove the Blender → build → bake → gate path."""
    bpy.ops.mesh.primitive_torus_add(major_radius=.095, minor_radius=.012, major_segments=40, minor_segments=10,
                                     location=joint('neck_01') + Vector((0, 0, .075)))
    ring = bpy.context.active_object
    ring.rotation_euler = (math.radians(6), 0, 0)
    return part('proof_ring', 'neck_01', 'Antique brass', ring)


kit = [proof_ring()] if '--proof' in args else []
os.makedirs(out, exist_ok=True)
for obj in kit:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(out, f'{obj.name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_extras=True, export_apply=True,
                              export_yup=True, export_materials='NONE', export_skins=False, export_animations=False,
                              export_normals=True, export_texcoords=True)
    print(f'PART {path} bone={obj["bone"]} material={obj["material"]} faces={len(obj.data.polygons)}')
print(f'PARTS {len(kit)} → {out}')
