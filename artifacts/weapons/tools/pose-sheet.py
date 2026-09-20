"""Pose sheet from a built rig, without the browser harness: front + side of named clips at given times (weapons lane).

    blender -b -P artifacts/weapons/tools/pose-sheet.py -- <rig.glb> <out-prefix> Clip:t [Clip:t ...]
"""
import math
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
rig, prefix, poses = args[0], args[1], [(p.split(":")[0], float(p.split(":")[1])) for p in args[2:]]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rig)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 600, 900
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.32, 0.33, 0.35, 1)
for i, (rot, energy) in enumerate([((math.radians(55), 0, math.radians(35)), 4), ((math.radians(60), 0, math.radians(-120)), 1.5)]):
    light = bpy.data.objects.new(f"Sun{i}", bpy.data.lights.new(f"Sun{i}", "SUN"))
    scene.collection.objects.link(light)
    light.rotation_euler, light.data.energy = rot, energy
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
views = {"front": ((0, -4.2, 1.05), (math.radians(88), 0, 0)), "side": ((4.2, 0, 1.05), (math.radians(88), 0, math.radians(90)))}
arm.animation_data_create()
for clip, t in poses:
    action = bpy.data.actions[clip]
    arm.animation_data.action = action
    if hasattr(arm.animation_data, "action_slot") and action.slots:
        arm.animation_data.action_slot = action.slots[0]
    start, end = action.frame_range
    scene.frame_set(int(round(start + (end - start) * t)))
    bpy.context.view_layer.update()
    for name, (loc, rot) in views.items():
        cam.location, cam.rotation_euler = loc, rot
        scene.render.filepath = f"{prefix}-{clip}-{t}-{name}.png"
        bpy.ops.render.render(write_still=True)
        print("saved", scene.render.filepath)
