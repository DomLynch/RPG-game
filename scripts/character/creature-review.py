"""Offline pose review on CPU. These studio renders do not replace game/browser checks.

blender -b --python-exit-code 1 -P scripts/character/creature-review.py -- skeleton
"""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector
family=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(f'src/assets/{family}.glb').resolve()))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
Path('artifacts/character/werewolf-skeleton').mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12
scene.render.resolution_x=650;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Review');scene.world.color=(.18,.18,.18)
for loc,power,size in [((3,-4,5),650,4),((-3,-1,3),350,3),((0,3,4),600,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc); l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-6,2.7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.8;scene.camera=cam
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
rig.animation_data_create()
for track in rig.animation_data.nla_tracks: track.mute=True
for clip,fraction in ([('Trident_Idle',0),('Trident_Thrust',.45),('Trident_Guard',.5)] if family == 'skeleton' else [('Armed',0),('Attack',.45),('Guard',.5)]):
 action=next((a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_')),None)
 if action is None: print('MISSING',clip);continue
 rig.animation_data.action=action
 slots=[s for s in action.slots if s.target_id_type=='OBJECT']
 if slots:rig.animation_data.action_slot=slots[0]
 lo,hi=action.frame_range;scene.frame_set(int(lo+(hi-lo)*fraction))
 scene.render.filepath=str(Path(f'artifacts/character/werewolf-skeleton/{family}-{clip}-cpu.png').resolve());bpy.ops.render.render(write_still=True)
