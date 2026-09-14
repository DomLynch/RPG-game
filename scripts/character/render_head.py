"""Render the realistic base head flat-lit from the front (and 90° sides) at a known orthographic scale, so the same
landmark model that reads the portraits can read the mesh: blender -b -P scripts/character/render_head.py"""
import json
import math

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='src/assets/source/parts/body_realistic.glb')
objs = {o.name: o for o in bpy.data.objects if o.type == 'MESH'}
head, eyes = objs['Head'], [objs['eye_L'], objs['eye_R']]
for o in bpy.data.objects:
    if o.type == 'MESH' and o not in [head] + eyes:
        o.hide_render = True
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'  # flat, shadowless: exactly a texture-reference photo
scene.display.shading.light = 'STUDIO'  # soft, so the landmark model sees eyes, brows and lips
scene.display.shading.color_type = 'TEXTURE'
scene.render.resolution_x = scene.render.resolution_y = 1254
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('grey')
scene.world.color = (0.35, 0.35, 0.35)
def textured(name, image):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    tex = m.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(image)
    m.node_tree.links.new(tex.outputs['Color'], m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    m.node_tree.nodes.active = tex
    return m
head.data.materials.clear()
head.data.materials.append(textured('face', 'src/assets/source/materials/face_color_r@2k.jpg'))
for e in eyes:
    e.data.materials.clear()
    e.data.materials.append(textured('eye', 'src/assets/source/materials/eye_color_r.jpg'))
vs = [head.matrix_world @ v.co for v in head.data.vertices]
top = max(v.z for v in vs)
ez = sum((eyes[0].matrix_world @ v.co for v in eyes[0].data.vertices), Vector()) / len(eyes[0].data.vertices)
centre = Vector((0.0, 0.0, ez.z - 0.06))
ortho = 0.36  # metres across the frame: head fills ~70 % like the portraits
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = ortho
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
meta = {'ortho_scale': ortho, 'centre': [centre.x, centre.y, centre.z], 'views': {}}
for name, yaw in (('front', 0.0), ('left90', 90.0), ('right90', -90.0)):
    th = math.radians(yaw)
    cam.location = centre + Vector((math.sin(th), -math.cos(th), 0.0)) * 2.0
    cam.rotation_euler = (math.radians(90), 0.0, -th)  # look at the centre; camera up = +z
    scene.render.filepath = f'artifacts/source/face/base_{name}.png'
    bpy.ops.render.render(write_still=True)
    meta['views'][name] = {'yaw': yaw}
json.dump(meta, open('artifacts/source/face/base_render.json', 'w'))
print('RENDER ok', meta)
