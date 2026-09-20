import bpy, math, sys
src, prefix = sys.argv[sys.argv.index('--')+1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs=[o for o in bpy.data.objects if o.type=='MESH']
pts=[o.matrix_world @ v.co for o in objs for v in o.data.vertices]
zmin=min(p.z for p in pts); zmax=max(p.z for p in pts); zc=(zmin+zmax)/2; L=zmax-zmin
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=700; scene.render.resolution_y=1400
scene.render.film_transparent=False
cam=bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); scene.collection.objects.link(cam); scene.camera=cam
cam.data.type='ORTHO'; cam.data.ortho_scale=L*1.08
world=bpy.data.worlds.new('W'); scene.world=world; world.use_nodes=True
bg=world.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.32,0.33,0.35,1); bg.inputs[1].default_value=1.0
for i,(rot,en) in enumerate([((math.radians(55),0,math.radians(35)),4),((math.radians(60),0,math.radians(-120)),1.5),((math.radians(-40),0,math.radians(200)),1.0)]):
    l=bpy.data.objects.new(f'Sun{i}', bpy.data.lights.new(f'Sun{i}','SUN')); scene.collection.objects.link(l); l.rotation_euler=rot; l.data.energy=en
views=[('face',(0,-3,zc),(math.pi/2,0,0)),('threeq',(2.1,-2.1,zc+0.3),(math.radians(82),0,math.radians(45))),('edge',(3,0,zc),(math.pi/2,0,math.pi/2))]
for name,loc,rot in views:
    cam.location=loc; cam.rotation_euler=rot
    scene.render.filepath=f"{prefix}-{name}.png"; bpy.ops.render.render(write_still=True)
# head close-up, three-quarter
cam.data.ortho_scale=L*0.42; cam.location=(2.1,-2.1,zmax-L*0.2); cam.rotation_euler=(math.radians(82),0,math.radians(45))
scene.render.resolution_x=900; scene.render.resolution_y=900
scene.render.filepath=f"{prefix}-head.png"; bpy.ops.render.render(write_still=True)
# grip close-up
cam.location=(2.1,-2.1,zmin+L*0.22); scene.render.filepath=f"{prefix}-grip.png"; bpy.ops.render.render(write_still=True)
