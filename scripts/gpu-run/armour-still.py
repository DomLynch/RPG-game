"""One armour still in Cycles, the same scene on the T4 and on a CPU box, so the two render times compare (Lead 2026-10-10: the --blender proof, "time vs blender-cpu").
   node scripts/gpu-run.mjs <sha> --blender -- blender -b -P scripts/gpu-run/armour-still.py -- src/assets/knight.glb artifacts/armour-still-gpu.png gpu
   blender-cpu -b -P scripts/gpu-run/armour-still.py -- src/assets/knight.glb artifacts/armour-still-cpu.png cpu
The fighter on his Idle clip at frame 0, front-on at 375x812, one sun and a flat grey world, 128 samples, no denoiser (the same work on both devices).
Prints RENDER cold|warm seconds=<render call only> device=<backend>: cold includes kernel load, warm is the steady-state frame."""
import sys
import time

import bpy

glb, out, device = sys.argv[sys.argv.index('--') + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in bpy.data.objects:
    if o.type == 'MESH' and any((m.name if m else '').startswith('Weapon') for m in o.data.materials):
        o.hide_render = True
    if o.type == 'ARMATURE':
        idle = next((a for a in bpy.data.actions if a.name.split('.')[0] == 'Idle'), None)
        if idle:
            o.animation_data_create(); o.animation_data.action = idle
sc = bpy.context.scene
sc.frame_set(0)
sc.render.engine = 'CYCLES'
if device == 'gpu':
    sys.path.insert(0, '/usr/local/share/gpu-run')
    import cycles_gpu
    backend = cycles_gpu.enable(sc)
else:
    sc.cycles.device = 'CPU'; backend = 'CPU'
sc.cycles.samples = 128
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 375, 812
world = bpy.data.worlds.new('grey'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs[0].default_value = (.18, .17, .16, 1); sc.world = world
bpy.ops.object.light_add(type='SUN', rotation=(0.8, 0.2, 0.6)); bpy.context.object.data.energy = 3
# Fixed framing for a ~2 m fighter (a bounding-box fit took in something far larger and left him a fifth of the frame): 50 mm, portrait, he fills ~90 % of the height.
bpy.ops.object.camera_add(location=(0, -3.7, .92), rotation=(1.5708, 0, 0))   # glTF +Z forward imports as Blender -Y: the camera stands in front
sc.camera = bpy.context.object; sc.camera.data.lens = 50
sc.render.filepath = out
# Twice in one session: the first render carries the device's kernel load/compile (OptiX/CUDA on the T4), the second is the steady-state frame.
for run in ('cold', 'warm'):
    t = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    print(f'RENDER {run} seconds={time.perf_counter() - t:.1f} device={backend} file={out}')
