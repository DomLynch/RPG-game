"""Reference scene from release snapshot; material comparison only, not browser proof."""
from pathlib import Path
import os,json,math,hashlib,urllib.request,httpx
import numpy as np
from PIL import Image
import bpy
from mathutils import Vector,Matrix
from huggingface_hub import HfApi,get_token,hf_hub_url,CommitOperationAdd
R=Path('/tmp/pit-render');R.mkdir(exist_ok=True);api=HfApi();REPO='Domlynch/frankendom-pit-room-20260930';REV=api.repo_info(REPO,repo_type='dataset').sha
files=['inputs/room-snapshot.json','A-v1/materials/torch-soot.png']+['A-v1/materials/'+n+'-'+m+'.png' for n in ['wall','vault','floor'] for m in ['albedo','normal','roughness']]
for name in files:
 print('FETCH',name,flush=True)
 p=R/name;p.parent.mkdir(parents=True,exist_ok=True)
 response=httpx.get(hf_hub_url(REPO,name,repo_type='dataset',revision=REV),headers={'Authorization':'Bearer '+get_token()},timeout=120,follow_redirects=True)
 response.raise_for_status();p.write_bytes(response.content)
snapshot=json.loads((R/'inputs/room-snapshot.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.resolution_x=375;scene.render.resolution_y=812;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.20,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.15
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.4
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def xyz(p):return (p[0],-p[2],p[1])
def tex(mat,path,slot,linear=False):
 n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(path),check_existing=True);n.extension='REPEAT'
 if linear:n.image.colorspace_settings.name='Non-Color'
 bs=mat.node_tree.nodes.get('Principled BSDF')
 if slot=='Normal':
  normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.65;mat.node_tree.links.new(n.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 else:mat.node_tree.links.new(n.outputs['Color'],bs.inputs[slot])
 return n
mats=[]
for i,m in enumerate(snapshot['materials']):
 mat=bpy.data.materials.new('original-'+str(i));mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');color=m.get('color') or [.3,.3,.3]
 bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=m.get('roughness') or .8;bs.inputs['Metallic'].default_value=m.get('metalness') or 0
 if m.get('map'):
  data=m['map'];p=R/('original-'+str(i)+'.png');Image.fromarray(np.array(data['data'],dtype=np.uint8).reshape(data['height'],data['width'],4)).save(p);t=tex(mat,p,'Base Color')
  if m.get('transparent'):mat.node_tree.links.new(t.outputs['Alpha'],bs.inputs['Alpha'])
 if m.get('type')=='MeshBasicMaterial':bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=2
 if m.get('transparent') and not m.get('map'):bs.inputs['Alpha'].default_value=m.get('opacity',1)
 mats.append(mat)
newmats={}
for name in ['wall','vault','floor']:
 mat=bpy.data.materials.new(name+'-PBR');mat.use_nodes=True
 for m,slot in [('albedo','Base Color'),('normal','Normal'),('roughness','Roughness')]:tex(mat,R/'A-v1/materials'/(name+'-'+m+'.png'),slot,m!='albedo')
 # Room-space dampness limited to lower 60cm, no repeating stain.
 if name=='wall':
  ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=ns.get('Principled BSDF');base=bs.inputs['Base Color'].links[0].from_socket
  geo=ns.new('ShaderNodeNewGeometry');sep=ns.new('ShaderNodeSeparateXYZ');links.new(geo.outputs['Position'],sep.inputs[0]);remap=ns.new('ShaderNodeMapRange');remap.inputs['From Min'].default_value=0;remap.inputs['From Max'].default_value=.6;remap.inputs['To Min'].default_value=.60;remap.inputs['To Max'].default_value=1;links.new(sep.outputs['Z'],remap.inputs['Value']);mix=ns.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;links.new(base,mix.inputs[1]);links.new(remap.outputs['Result'],mix.inputs[2]);links.new(mix.outputs[0],bs.inputs['Base Color'])
 if name=='floor':
  ns=mat.node_tree.nodes;links=mat.node_tree.links;bs=ns.get('Principled BSDF');base=bs.inputs['Base Color'].links[0].from_socket
  geo=ns.new('ShaderNodeNewGeometry');sep=ns.new('ShaderNodeSeparateXYZ');links.new(geo.outputs['Position'],sep.inputs[0]);ab=ns.new('ShaderNodeMath');ab.operation='ABSOLUTE';links.new(sep.outputs['X'],ab.inputs[0]);remap=ns.new('ShaderNodeMapRange');remap.inputs['From Min'].default_value=.35;remap.inputs['From Max'].default_value=.85;remap.inputs['To Min'].default_value=.86;remap.inputs['To Max'].default_value=1;links.new(ab.outputs[0],remap.inputs['Value']);mix=ns.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;links.new(base,mix.inputs[1]);links.new(remap.outputs['Result'],mix.inputs[2]);links.new(mix.outputs[0],bs.inputs['Base Color'])
 newmats[name]=mat
objects=[]
for i,m in enumerate(snapshot['meshes']):
 if snapshot['materials'][m['material']].get('type')=='MeshBasicMaterial' and snapshot['materials'][m['material']].get('transparent'):continue
 verts=np.asarray(m['position']).reshape(-1,3);faces=np.asarray(m['indices']).reshape(-1,3);mesh=bpy.data.meshes.new('snapshot-'+str(i));mesh.from_pydata(verts.tolist(),[],faces.tolist());mesh.update()
 o=bpy.data.objects.new('snapshot-'+str(i),mesh);scene.collection.objects.link(o);o.matrix_world=C@Matrix(np.asarray(m['matrix']).reshape(4,4).T.tolist())
 mesh.materials.append(mats[m['material']]);uv=mesh.uv_layers.new(name='UVMap');coords=np.asarray(m['uv']).reshape(-1,2)
 for poly in mesh.polygons:
  for li in poly.loop_indices:uv.data[li].uv=coords[mesh.loops[li].vertex_index]
 objects.append((o,m['material']))
# Use physical reference lights, not the game's renderer-specific intensities.
def light(name,kind,at,energy,color,target=None,size=.25):
 data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
 if kind=='AREA':data.shape='DISK';data.size=size
 else:data.shadow_soft_size=size
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=xyz(at)
 if target:ob.rotation_euler=(Vector(xyz(target))-ob.location).to_track_quat('-Z','Y').to_euler()
 return ob
light('Gate daylight','AREA',(0,2.2,-5.8),650,(1,.79,.52),(0,.6,0),1.8)
light('Gentle camera fill','AREA',(0,2.7,2.4),95,(.63,.69,.82),(0,1,0),3)
for x in [-3.85,3.85]:light('Warm torch','POINT',(x,1.9,-2.4),110,(1,.40,.13),size=.12)
camdata=bpy.data.cameras.new('Phone');cam=bpy.data.objects.new('Phone',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='PERSP';camdata.sensor_fit='VERTICAL';camdata.angle=math.radians(51);camdata.clip_start=.03
(R/'renders').mkdir(exist_ok=True)
for phase in ['before','after']:
 if phase=='after':
  # Wall soot uses its own UV and alpha texture; it never repeats with the stone.
  soot=bpy.data.materials.new('torch-soot-decal');soot.use_nodes=True
  node=tex(soot,R/'A-v1/materials/torch-soot.png','Base Color');soot.node_tree.links.new(node.outputs['Alpha'],soot.node_tree.nodes.get('Principled BSDF').inputs['Alpha']);soot.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=1
  for sx in [-1,1]:
   bpy.ops.mesh.primitive_plane_add(size=1,location=(sx*3.99,2.4,2.30),rotation=(math.pi/2,0,-sx*math.pi/2));o=bpy.context.object;o.name='torch-soot';o.scale=(.75,.85,1);o.data.materials.append(soot)
  for o,mi in objects:
   if mi in [0,1]:
    factor=.8 if mi==0 else .5
    for loop in o.data.uv_layers.active.data:loop.uv*=factor
   if mi==0:
    o.data.materials.clear();o.data.materials.append(newmats['wall']);o.data.materials.append(newmats['vault'])
    for poly in o.data.polygons:
     world=o.matrix_world@poly.center
     if world.z>2.81:poly.material_index=1
   elif mi==1:o.data.materials.clear();o.data.materials.append(newmats['floor'])
 for pose in ['gate','trophies']:
  p=snapshot['poses'][pose];cam.location=xyz(p['camera']);cam.rotation_euler=(Vector(xyz(p['target']))-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(R/'renders'/f'{phase}-{pose}-375.png');bpy.ops.render.render(write_still=True)
  api.upload_file(repo_id=REPO,repo_type='dataset',path_in_repo='A-final/renders/'+Path(scene.render.filepath).name,path_or_fileobj=Path(scene.render.filepath).read_bytes())
# Save packed reproducible reference scene after maps are final.
for image in bpy.data.images:
 if image.source=='FILE':image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(R/'pit-reference.blend'))
receipt={'source_revision':snapshot['revision'],'crown':snapshot['crown'],'reference_only':True,'hero_and_loot':'omitted for material inspection','camera_poses':snapshot['poses'],'resolution':[375,812],'samples':48,'materials_revision':REV,'frames':[{ 'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (R/'renders').glob('*.png')]}
(R/'render-receipt.json').write_text(json.dumps(receipt,indent=2))
api.create_commit(repo_id=REPO,repo_type='dataset',commit_message='Pit reproducible material reference scene',operations=[CommitOperationAdd(path_in_repo='A-final/'+p.name,path_or_fileobj=p.read_bytes()) for p in [R/'pit-reference.blend',R/'render-receipt.json']])
print('PIT_REFERENCE_COMPLETE',flush=True);os._exit(0)
