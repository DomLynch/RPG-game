"""Cloud reduction and exported-asset proof, selected PROP injected by submitter."""
from pathlib import Path
import os,json,hashlib,math
import bpy,httpx,bmesh
from mathutils import Vector
from huggingface_hub import HfApi,get_token,hf_hub_url,CommitOperationAdd
NAME=os.environ.get('PIT_PROP','bull-skull');REPO='Domlynch/frankendom-pit-room-20260930';api=HfApi();REV=api.repo_info(REPO,repo_type='dataset').sha;R=Path('/tmp/prop');R.mkdir(exist_ok=True)
caps={'bull-skull':3000,'gate':6000,'weapon-rack':3500,'chest-banded':1800,'chest-plain':1400,'table':1800,'torch-sconce':1500};cap=caps[NAME]

for NAME in ['bull-skull','weapon-rack']:
 cap=caps[NAME];R=Path('/tmp/final')/NAME;R.mkdir(parents=True,exist_ok=True);maps=[]
 def fetch(filename):
  response=httpx.get(hf_hub_url(REPO,'reduced-v2/'+NAME+'/'+filename,repo_type='dataset',revision=REV),headers={'Authorization':'Bearer '+get_token()},follow_redirects=True,timeout=180);response.raise_for_status();p=R/filename;p.write_bytes(response.content);return p
 blend=fetch(NAME+'.blend');receipt=json.loads(fetch(NAME+'-receipt.json').read_text());original=receipt['donor_triangles'];wall=True
 for channel in ['albedo','normal','roughness','metallic']:maps.append(fetch(NAME+'-'+channel+'.png'))
 bpy.ops.wm.open_mainfile(filepath=str(blend));bpy.ops.object.select_all(action='DESELECT');obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 model=R/(NAME+'.glb');bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',use_selection=True,export_yup=True,export_image_format='WEBP',export_image_quality=80,export_tangents=True,export_extras=True)
 import struct
 blob=model.read_bytes();js=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]]);count=sum(js['accessors'][p['indices']]['count']//3 for m in js['meshes'] for p in m['primitives']);assert count<=cap
 api.create_commit(repo_id=REPO,repo_type='dataset',commit_message=NAME+' compact1024 source checkpoint',operations=[CommitOperationAdd(path_in_repo='final/'+NAME+'/'+p.name,path_or_fileobj=p.read_bytes()) for p in [model,blend]+maps])
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
 record={'name':NAME,'triangles':count,'cap':cap,'donor_triangles':original,'model_sha256':hashlib.sha256(model.read_bytes()).hexdigest(),'bytes':model.stat().st_size,'bounds_blender':[list(low),list(high)],'origin':'mount point' if wall else 'base centre','units':'metres','textures':[{'file':p.name,'size':[1024,1024],'bytes':p.stat().st_size} for p in maps],'renders':[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in frames],'status':'review candidate; compressed ship copy is World responsibility'}
 p=R/(NAME+'-receipt.json');p.write_text(json.dumps(record,indent=2));frames.append(p);api.create_commit(repo_id=REPO,repo_type='dataset',commit_message=NAME+' exported-model review',operations=[CommitOperationAdd(path_in_repo='final/'+NAME+'/'+p.name,path_or_fileobj=p.read_bytes()) for p in frames]);print(json.dumps(record),flush=True)
os._exit(0)
