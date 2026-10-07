# Duel body beside world body, textured, one still each at a near and a far camera (Cycles on CPU, one sun, flat grey world).
#   blender -b -P scripts/character/world_body_stills.py -- <duel.glb> <world.glb> <out-prefix> [width 750] [height 812]
import math
import sys

import bpy
from mathutils import Vector

duel, world, prefix = sys.argv[sys.argv.index("--") + 1:][:3]
rest = sys.argv[sys.argv.index("--") + 4:]
W, H = (int(rest[0]), int(rest[1])) if len(rest) > 1 else (750, 812)
bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path, dx):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == "MESH" and any((m.name if m else "").startswith("Weapon") for m in o.data.materials):
            o.hide_render = True
        if o.parent is None:
            o.location.x += dx
    return new


a, b = load(duel, -0.6), load(world, 0.6)
for o in a + b:   # both on the same pose: the Idle clip at frame 0 (the importer otherwise leaves whichever action it applied last)
    if o.type == "ARMATURE":
        idle = next((x for x in bpy.data.actions if x.name.split(".")[0] == "Idle" or x.name.startswith("Idle")), None)
        if idle and o.animation_data:
            o.animation_data.action = idle
bpy.context.scene.frame_set(1)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 24
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.82, 0.85, 1)
sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 50
for tag, dist in (("near", 4.2), ("far", 13.0)):
    cam.location = Vector((0, -dist, 0.9))
    cam.rotation_euler = (math.radians(90), 0, 0)
    sc.render.filepath = f"{prefix}-{tag}.png"
    bpy.ops.render.render(write_still=True)
print("STILLS", prefix)
