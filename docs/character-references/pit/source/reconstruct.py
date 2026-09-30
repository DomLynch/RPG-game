"""One MAX reconstruction with durable donor; reduction is a separate stage."""
from pathlib import Path
import sys,json,time,shutil,hashlib
from gradio_client import Client,handle_file
from huggingface_hub import get_token,HfApi,CommitOperationAdd
R=Path(__file__).resolve().parents[1];name=sys.argv[1];p=R/'props'/name;image=p/('repair2.png' if name=='bull-skull' else 'simple-product.png' if name=='torch-sconce' else 'product.png')
seed=30093020;space='microsoft/TRELLIS.2';t=time.time()
receipt={'space':space,'revision':HfApi().space_info(space).sha,'input_sha256':hashlib.sha256(image.read_bytes()).hexdigest(),'seed':seed,'resolution':'1536','ss_sampling_steps':50,'shape_slat_sampling_steps':50,'tex_slat_sampling_steps':50,'donor_target_triangles':500000,'texture_size':4096,'attempts':1}
def predict(c, **kwargs):
 job=c.submit(**kwargs)
 try:return job.result(timeout=720)
 except TimeoutError:
  job.cancel();raise
try:
 c=Client(space,token=get_token(),verbose=False);predict(c,api_name='/start_session');pre=predict(c,input=handle_file(str(image)),api_name='/preprocess_image');pre=pre['path'] if isinstance(pre,dict) else pre
 shutil.copyfile(pre,p/'preprocessed.png');print('PREPROCESSED',name,flush=True)
 predict(c,image=handle_file(pre),seed=seed,resolution='1536',ss_sampling_steps=50,shape_slat_sampling_steps=50,tex_slat_sampling_steps=50,api_name='/image_to_3d')
 print('SHAPE_COMPLETE',name,flush=True)
 result=predict(c,decimation_target=500000,texture_size=4096,api_name='/extract_glb');src=result[1] if isinstance(result,(tuple,list)) else result;src=src['path'] if isinstance(src,dict) else src;shutil.copyfile(src,p/'donor.glb')
 receipt.update(seconds=round(time.time()-t,1),bytes=(p/'donor.glb').stat().st_size,sha256=hashlib.sha256((p/'donor.glb').read_bytes()).hexdigest());(p/'trellis.json').write_text(json.dumps(receipt,indent=2))
 HfApi().create_commit(repo_id='Domlynch/frankendom-pit-room-20260930',repo_type='dataset',commit_message=name+' preserved MAX donor',operations=[CommitOperationAdd(path_in_repo='props/'+name+'/'+f.name,path_or_fileobj=f.read_bytes()) for f in p.iterdir() if f.is_file()])
 print(json.dumps(receipt),flush=True)
except Exception as e:
 receipt.update(error=type(e).__name__+': '+str(e),seconds=round(time.time()-t,1));(p/'trellis-failure.json').write_text(json.dumps(receipt,indent=2));print(receipt['error'][:700],flush=True);sys.exit(1)
