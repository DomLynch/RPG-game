"""The arena guard's body (Brief 13, 2026-09-22): the CC0 base man decimated for six instances on a phone. Six of the hero
(63k triangles) would double the scene; the lorarius stands at the ring wall and is never framed close, so his body is the
Superhero_Male base mesh collapsed to RATIO of its 12.6k triangles with its skin weights kept (Blender's Decimate keeps
vertex groups), no eyes, no brows (a cap covers the brow line; the eyes are two dark texels at that distance). Exported
skinned on the same armature, the same bone names as warrior.glb, for scripts/build-warrior.mjs WARRIOR_GUARD=1 to dress.

  blender -b --python-exit-code 1 -P scripts/character/guard_body.py -- [--ratio 0.55]
"""
import os
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RATIO = float(args[args.index('--ratio') + 1]) if '--ratio' in args else 0.55
BASE = 'artifacts/source/base/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
OUT = 'src/assets/source/guard/body.glb'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BASE)
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
armature.matrix_world.identity()
body = bpy.data.objects['SuperHero_Male']
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not body]:
    bpy.data.objects.remove(o, do_unlink=True)
body.data.materials.clear()
while len(body.data.uv_layers) > 1:
    body.data.uv_layers.remove(body.data.uv_layers[1])
before = len(body.data.polygons)
mod = body.modifiers.new('Decimate', 'DECIMATE')
mod.ratio = RATIO
mod.use_collapse_triangulate = True
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.modifier_apply(modifier='Decimate')
for poly in body.data.polygons:
    poly.use_smooth = True
body.name = 'Body'
body['material'], body['slot'] = 'Skin', 'Skin'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
for o in bpy.context.selected_objects:
    o.select_set(False)
body.select_set(True)
armature.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_extras=True, export_apply=True,
                          export_yup=True, export_materials='NONE', export_skins=True, export_animations=False,
                          export_normals=True, export_texcoords=True)
print(f'GUARD body: {before} → {len(body.data.polygons)} faces (ratio {RATIO}) → {OUT}')
