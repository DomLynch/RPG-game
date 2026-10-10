"""One Cycles render on the GPU:
   node scripts/gpu-run.mjs <sha> --blender -- blender -b -P scripts/gpu-run/render-proof.py   ->   artifacts/gpu-run-render-proof.png"""
import sys
import bpy

sys.path.insert(0, '/usr/local/share/gpu-run')
import cycles_gpu

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0, 1))
bpy.ops.mesh.primitive_plane_add(size=8)
bpy.ops.object.light_add(type='AREA', location=(2, -3, 5))
bpy.context.object.data.energy = 600
bpy.ops.object.camera_add(location=(4, -5, 3), rotation=(1.1, 0, 0.8))
scene.camera = bpy.context.object
backend = cycles_gpu.enable(scene)
scene.cycles.samples = 128
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.filepath = 'artifacts/gpu-run-render-proof.png'
bpy.ops.render.render(write_still=True)
print('RENDERED backend=%s file=%s' % (backend, scene.render.filepath))
