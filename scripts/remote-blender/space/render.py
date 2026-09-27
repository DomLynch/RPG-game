# Headless Blender (bpy module or `blender -b --python`): import a GLB (rest pose), frame the whole figure like the roster cell (front = fight-camera side at yaw, back = yaw + 180),
# sand floor + sun + grey ambient, Cycles CPU. Usage (inside blender -b --python render.py --): --glb --out --views front,back --size WxH --samples N --yaw deg --pitch deg --fill f
import math, os, sys
import json
A = json.loads(os.environ.get('FK_RENDER_ARGS', '{}'))   # app.py passes the parameters here: the bpy module and the interpreter both touch sys.argv
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []; arg = lambda k, d: A.get(k.lstrip('-'), a[a.index(k) + 1] if k in a else d)
import bpy
from mathutils import Vector
GLB, OUT, VIEWS = arg('--glb', None), arg('--out', '/tmp/out'), arg('--views', 'front,back').split(',')
W, H = (int(x) for x in arg('--size', '420x720').split('x')); SAMPLES = int(arg('--samples', 24)); YAW = math.radians(float(arg('--yaw', 20))); PITCH = math.radians(float(arg('--pitch', 12))); FILL = float(arg('--fill', 0.9))
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.hide_render]
# Bounds from the evaluated (rest-posed, armature-deformed) meshes.
dg = bpy.context.evaluated_depsgraph_get(); lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    me = o.evaluated_get(dg).to_mesh()
    for v in me.vertices:
        p = o.matrix_world @ v.co; lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    o.evaluated_get(dg).to_mesh_clear()
centre = (lo + hi) / 2; height = hi.z - lo.z
# Floor + lights + world
bpy.ops.mesh.primitive_plane_add(size=40, location=(centre.x, centre.y, lo.z)); floor = bpy.context.object
m = bpy.data.materials.new('Sand'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.62, 0.55, 0.42, 1); m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.95; floor.data.materials.append(m)
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10)); sun = bpy.context.object; sun.data.energy = 3.5; sun.data.angle = math.radians(4); sun.rotation_euler = (math.radians(50), math.radians(-15), math.radians(35))
world = bpy.data.worlds.new('W'); bpy.context.scene.world = world; world.use_nodes = True; bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.55, 0.5, 0.42, 1); bg.inputs[1].default_value = 0.7
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True; sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'   # view transform stays Blender 4.2's default (AgX)
cam_data = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cam_data); sc.collection.objects.link(cam); sc.camera = cam; cam_data.lens = 50; cam_data.sensor_fit = 'VERTICAL'
for view in VIEWS:
    yaw = YAW + (math.pi if view == 'back' else 0)
    # Distance so the figure's height fills FILL of the frame at this lens (vertical sensor 24 mm).
    dist = (height / FILL) / 2 / math.tan(math.atan(12 / cam_data.lens))
    target = Vector((centre.x, centre.y, lo.z + height * 0.5))
    pos = target + Vector((math.sin(yaw) * math.cos(PITCH), -math.cos(yaw) * math.cos(PITCH), math.sin(PITCH))) * dist
    cam.location = pos; cam.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'{view}.png'); bpy.ops.render.render(write_still=True)
    print(f'rendered {view} {W}x{H} samples {SAMPLES} height {height:.2f} dist {dist:.2f}')
