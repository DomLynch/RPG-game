"""Cloud reduction and exported-asset proof, selected PROP injected by submitter."""
from pathlib import Path
import os,json,hashlib,math
import bpy,httpx,bmesh
from mathutils import Vector
from huggingface_hub import HfApi,get_token,hf_hub_url,CommitOperationAdd
NAME=os.environ.get('PIT_PROP','bull-skull');REPO='Domlynch/frankendom-pit-room-20260930';api=HfApi();REV=api.repo_info(REPO,repo_type='dataset').sha;R=Path('/tmp/prop');R.mkdir(exist_ok=True)
caps={'bull-skull':3000,'gate':6000,'weapon-rack':3500,'chest-banded':1800,'chest-plain':1400,'table':1800,'torch-sconce':1500};cap=caps[NAME]
resp=httpx.get(hf_hub_url(REPO,'props/'+NAME+'/donor.glb',repo_type='dataset',revision=REV),headers={'Authorization':'Bearer '+get_token()},follow_redirects=True,timeout=180);resp.raise_for_status();(R/'donor.glb').write_bytes(resp.content)

model=R/'donor.glb'
# Reimport the delivered GLB for authoritative review images.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(model));meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box];low=Vector(tuple(min(v[i] for v in points) for i in range(3)));high=Vector(tuple(max(v[i] for v in points) for i in range(3)));mid=(low+high)/2;size=max(high-low)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=8;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.22,.22,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7;scene.view_settings.view_transform='AgX'
for name,loc,power in [('key',(2,-3,4),350),('fill',(-3,-1,1.5),180),('rim',(0,3,3),250)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power*size*size;d.shape='DISK';d.size=size*2;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=mid+Vector(loc)*size;o.rotation_euler=(mid-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('review');cam=bpy.data.objects.new('review',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=size*1.25
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
frames=[]
for name,direction in [('front',(0,-3,.25)),('side',(3,-.3,.2)),('rear',(0,3,.2))]:
 cam.location=mid+Vector(direction)*size;cam.rotation_euler=(mid-cam.location).to_track_quat('-Z','Y').to_euler();p=R/(NAME+'-'+name+'.png');scene.render.filepath=str(p);bpy.ops.render.render(write_still=True);frames.append(p)

api.create_commit(repo_id=REPO,repo_type='dataset',commit_message='Untouched donor diagnostic captures',operations=[CommitOperationAdd(path_in_repo='diagnostic/'+NAME+'/'+p.name,path_or_fileobj=p.read_bytes()) for p in frames]);os._exit(0)
