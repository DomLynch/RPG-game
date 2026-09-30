"""Single bounded paid GPU batch; persist each MAX donor before the next item."""
import os,time,json,hashlib,gc
os.environ['ATTN_BACKEND']='flash_attn';os.environ['PYTORCH_CUDA_ALLOC_CONF']='expandable_segments:True';os.environ['OPENCV_IO_ENABLE_OPENEXR']='1'
from pathlib import Path
import torch
from PIL import Image
from huggingface_hub import HfApi,hf_hub_download,CommitOperationAdd
from trellis2.pipelines import Trellis2ImageTo3DPipeline
import o_voxel
api=HfApi();repo='Domlynch/frankendom-pit-room-20260930';rev=api.repo_info(repo,repo_type='dataset').sha;start=time.time();root=Path('/tmp/pit-max');root.mkdir(exist_ok=True)
print('GPU',torch.cuda.get_device_name(),flush=True)
pipeline=Trellis2ImageTo3DPipeline.from_pretrained('microsoft/TRELLIS.2-4B');pipeline.rembg_model=None;pipeline.low_vram=False;pipeline.cuda();print('MODEL_READY',round(time.time()-start,1),flush=True)
for name in ['gate','chest-banded','chest-plain']:
 t=time.time();p=root/name;p.mkdir(exist_ok=True);source=Path(hf_hub_download(repo,'props/'+name+'/preprocessed.png',repo_type='dataset',revision=rev));image=Image.open(source)
 print('START',name,flush=True)
 outputs,latents=pipeline.run(image,seed=30093020,preprocess_image=False,sparse_structure_sampler_params={'steps':50,'guidance_strength':7.5,'guidance_rescale':.7,'rescale_t':5},shape_slat_sampler_params={'steps':50,'guidance_strength':7.5,'guidance_rescale':.5,'rescale_t':3},tex_slat_sampler_params={'steps':50,'guidance_strength':1,'guidance_rescale':0,'rescale_t':3},pipeline_type='1536_cascade',return_latent=True)
 mesh=outputs[0];mesh.simplify(16777216);res=latents[2];print('SHAPE',name,'resolution',res,flush=True)
 glb=o_voxel.postprocess.to_glb(vertices=mesh.vertices,faces=mesh.faces,attr_volume=mesh.attrs,coords=mesh.coords,attr_layout=pipeline.pbr_attr_layout,grid_size=res,aabb=[[-.5,-.5,-.5],[.5,.5,.5]],decimation_target=500000,texture_size=4096,remesh=True,remesh_band=1,remesh_project=0,use_tqdm=True)
 path=p/'donor.glb';glb.export(str(path),extension_webp=True)
 receipt={'backend':'dedicated RTX PRO 6000 HF Job','model':'microsoft/TRELLIS.2-4B','input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'seed':30093020,'resolution':1536,'steps':[50,50,50],'donor_target_triangles':500000,'texture_size':4096,'seconds':round(time.time()-t,1),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_revision':rev,'attempts_this_backend':1}
 rp=p/'trellis-dedicated.json';rp.write_text(json.dumps(receipt,indent=2));api.create_commit(repo_id=repo,repo_type='dataset',commit_message=name+' dedicated MAX donor checkpoint',operations=[CommitOperationAdd(path_in_repo='props/'+name+'/'+f.name,path_or_fileobj=f.read_bytes()) for f in [path,rp]])
 print('SAVED',json.dumps(receipt),flush=True);del outputs,latents,mesh,glb;gc.collect();torch.cuda.empty_cache()
print('ALL_SAVED',round(time.time()-start,1),flush=True)
