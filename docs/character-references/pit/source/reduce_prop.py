"""Cloud reduction and exported-asset proof, selected PROP injected by submitter."""
from pathlib import Path
import os,json,hashlib,math
import bpy,httpx,bmesh
from mathutils import Vector
from huggingface_hub import HfApi,get_token,hf_hub_url,CommitOperationAdd
NAME=os.environ.get('PIT_PROP','bull-skull');REPO='Domlynch/frankendom-pit-room-20260930';api=HfApi();REV=api.repo_info(REPO,repo_type='dataset').sha;R=Path('/tmp/prop');R.mkdir(exist_ok=True)
caps={'bull-skull':3000,'gate':6000,'weapon-rack':3500,'chest-banded':1500,'chest-plain':1000,'table':2500,'torch-sconce':1500};cap=caps[NAME]
resp=httpx.get(hf_hub_url(REPO,'props/'+NAME+'/donor.glb',repo_type='dataset',revision=REV),headers={'Authorization':'Bearer '+get_token()},follow_redirects=True,timeout=180);resp.raise_for_status();(R/'donor.glb').write_bytes(resp.content)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(R/'donor.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();obj=bpy.context.object;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);obj.name=NAME;obj.data.name=NAME+'-mesh'
flip=NAME=='torch-sconce'
if flip:
 for v in obj.data.vertices:v.co.x=-v.co.x;v.co.y=-v.co.y
coords=[v.co.copy() for v in obj.data.vertices];lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)));hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)));extent=hi-lo
sizes={'gate':(2.8,.45,2.7),'weapon-rack':(4.5,.34,2.5),'chest-banded':(.75,.60,.50),'chest-plain':(.75,.60,.50),'table':(.95,.70,.75),'torch-sconce':(.20,.22,.45)}
scale=Vector((1.1/extent.x,)*3) if NAME=='bull-skull' else Vector(tuple(sizes[NAME][i]/extent[i] for i in range(3)))
wall=NAME in ['bull-skull','torch-sconce','weapon-rack'];centre=Vector(((lo.x+hi.x)/2,hi.y if wall else (lo.y+hi.y)/2,(lo.z+hi.z)/2 if wall else lo.z))
if NAME=='torch-sconce':centre.z=lo.z+.9*extent.z
for v in obj.data.vertices:v.co=Vector(tuple((v.co[i]-centre[i])*scale[i] for i in range(3)))
# Direct welded quadric reduction retains the donor surface instead of remeshing it.
response=httpx.get(hf_hub_url(REPO,'props/'+NAME+'/lowmesh.json',repo_type='dataset',revision=REV),headers={'Authorization':'Bearer '+get_token()},follow_redirects=True,timeout=120);response.raise_for_status();lowdata=response.json()
donor=obj;donor.name=NAME+'-high';original=len(donor.data.polygons);donor.select_set(False)
vs=[]
for i in range(0,len(lowdata['positions']),3):
 x,y,z=lowdata['positions'][i:i+3];co=Vector((-x,z,y) if flip else (x,-z,y));vs.append(tuple((co[j]-centre[j])*scale[j] for j in range(3)))
faces=[lowdata['indices'][i:i+3] for i in range(0,len(lowdata['indices']),3)]
mesh=bpy.data.meshes.new(NAME+'-mesh');mesh.from_pydata(vs,[],faces);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.dissolve_degenerate(bm,dist=1e-7,edges=list(bm.edges));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update();obj=bpy.data.objects.new(NAME,mesh);bpy.context.collection.objects.link(obj);obj.select_set(True);bpy.context.view_layer.objects.active=obj
count=len(mesh.polygons);assert count<=cap
for p in obj.data.polygons:p.use_smooth=NAME not in ['table','chest-banded','chest-plain','gate']
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
mat=bpy.data.materials.new(NAME+'-baked');mat.use_nodes=True;obj.data.materials.clear();obj.data.materials.append(mat);bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.82
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.06;scene.render.bake.max_ray_distance=.15;scene.render.bake.margin=12
maps=[];donor.select_set(True);bpy.context.view_layer.objects.active=obj
for channel in ['albedo','normal','roughness','metallic']:
 image=bpy.data.images.new(NAME+'-'+channel,1024,1024,alpha=False);image.colorspace_settings.name='sRGB' if channel=='albedo' else 'Non-Color';node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
 if channel=='normal':bpy.ops.object.bake(type='NORMAL')
 else:
  for highmat in donor.data.materials:
   highbs=highmat.node_tree.nodes.get('Principled BSDF');slot={'albedo':'Base Color','roughness':'Roughness','metallic':'Metallic'}[channel];inp=highbs.inputs[slot]
   emit=highmat.node_tree.nodes.new('ShaderNodeEmission');emit.inputs['Strength'].default_value=1
   if inp.links:highmat.node_tree.links.new(inp.links[0].from_socket,emit.inputs['Color'])
   else:
    value=inp.default_value;emit.inputs['Color'].default_value=value if channel=='albedo' else (value,value,value,1)
   highmat.node_tree.links.new(emit.outputs[0],highmat.node_tree.nodes.get('Material Output').inputs['Surface'])
  bpy.ops.object.bake(type='EMIT')
 path=R/(NAME+'-'+channel+'.png');image.filepath_raw=str(path);image.file_format='PNG';image.save();image.pack();maps.append(path)
 if channel=='albedo':mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 elif channel=='normal':
  normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.7;mat.node_tree.links.new(node.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 else:mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Roughness' if channel=='roughness' else 'Metallic'])
bpy.data.objects.remove(donor,do_unlink=True);bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
obj['units']='metres';obj['origin']='wall mount point' if wall else 'base centre';obj['source_sha256']=hashlib.sha256(resp.content).hexdigest()
model=R/(NAME+'.glb');bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',use_selection=True,export_yup=True,export_image_format='WEBP',export_image_quality=80,export_tangents=True,export_extras=True)
import struct
blob=model.read_bytes();js=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]]);count=sum(js['accessors'][p['indices']]['count']//3 for m in js['meshes'] for p in m['primitives']);assert count<=cap
bpy.ops.wm.save_as_mainfile(filepath=str(R/(NAME+'.blend')))
# Persist before spending render time.
files=[model,R/(NAME+'.blend')]+maps
api.create_commit(repo_id=REPO,repo_type='dataset',commit_message=NAME+' reduced source checkpoint',operations=[CommitOperationAdd(path_in_repo='final/'+NAME+'/'+p.name,path_or_fileobj=p.read_bytes()) for p in files])
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
p=R/(NAME+'-receipt.json');p.write_text(json.dumps(record,indent=2));frames.append(p);api.create_commit(repo_id=REPO,repo_type='dataset',commit_message=NAME+' exported-model review',operations=[CommitOperationAdd(path_in_repo='final/'+NAME+'/'+p.name,path_or_fileobj=p.read_bytes()) for p in frames]);print(json.dumps(record),flush=True);os._exit(0)
