"""Bake aligned technical PBR maps from saved original colour artwork; no generation calls."""
from pathlib import Path
import os,json,hashlib,urllib.request
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from huggingface_hub import HfApi,get_token,hf_hub_url,CommitOperationAdd
R=Path('/tmp/pit'); (R/'materials').mkdir(parents=True,exist_ok=True)
REPO='Domlynch/frankendom-pit-room-20260930'; REV='bab31d37da43864d868deb511284f642f3df4672'; api=HfApi()
def fetch(name):
    p=R/name; p.parent.mkdir(parents=True,exist_ok=True)
    req=urllib.request.Request(hf_hub_url(REPO,name,repo_type='dataset',revision=REV),headers={'Authorization':'Bearer '+get_token()})
    with urllib.request.urlopen(req,timeout=120) as f:p.write_bytes(f.read())
    return p
# Periodic-plus-smooth decomposition removes edge illumination mismatch without mirroring the stone.
def periodic(a):
    h,w=a.shape[:2]; v=np.zeros_like(a)
    v[0]=a[-1]-a[0]; v[-1]=-v[0]; v[:,0]+=a[:,-1]-a[:,0]; v[:,-1]-=a[:,-1]-a[:,0]
    den=2*np.cos(2*np.pi*np.arange(h)/h)[:,None]+2*np.cos(2*np.pi*np.arange(w)/w)[None,:]-4
    den[0,0]=1
    if a.ndim==3:den=den[:,:,None]
    f=np.fft.fft2(v,axes=(0,1))/den; f[0,0]=0
    return a-np.fft.ifft2(f,axes=(0,1)).real
receipts=[]
def save(name,a):
    a=np.clip(np.round(a*255),0,255).astype('uint8'); p=R/'materials'/name
    Image.fromarray(a).save(p)
    d={'file':name,'size':list(Image.open(p).size),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    receipts.append(d)
for name in ['wall','vault','floor']:
    im=Image.open(fetch('inputs/'+name+'.png')).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
    a=periodic(np.asarray(im,dtype=float)/255)
    if name=='vault':a*=np.array([.83,.85,.89])
    a=np.clip(a,0,1)
    save(name+'-albedo.png',a)
    lum=a@np.array([.2126,.7152,.0722]); smooth=gaussian_filter(lum,1.2,mode='wrap')
    # Image-derived relief, not measured geometry. Fine colour grain is damped to avoid noisy normals.
    height=gaussian_filter(np.clip((smooth-.16)/.44,0,1),1,mode='wrap')
    height=height*.65+(lum-gaussian_filter(lum,4,mode='wrap'))*.08
    amp=5 if name!='floor' else 1.8
    dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*amp
    dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*amp
    n=np.stack([-dx,dy,np.ones_like(dx)],axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
    save(name+'-normal.png',n*.5+.5)
    rough=np.clip(.86+(gaussian_filter(lum,3,mode='wrap')-.4)*.1,.75,.96)
    save(name+'-roughness.png',rough)
    save(name+'-ao.png',np.clip(.91+(height-gaussian_filter(height,12,mode='wrap'))*.6,.65,1))
    save(name+'-height.png',height)
    # Diagnostic 2x2 tile sheet; exact source maps remain 1024.
    Image.fromarray(np.tile(np.uint8(a*255),(2,2,1))).resize((1024,1024)).save(R/(name+'-repeat.png'))
# Non-repeating room masks, represented separately from tiling surfaces.
y,x=np.mgrid[0:1024,0:1024]/1023
rng=np.random.default_rng(300930)
noise=gaussian_filter(rng.random((1024,1024)),7); noise=(noise-noise.min())/(noise.max()-noise.min())
damp=np.clip((y-.15)/.85,0,1)**1.7*(.75+.25*noise)
save('wall-damp-mask.png',damp)
path=np.exp(-((x-.5)/(.115+.012*np.sin(y*12)))**4)*(.78+.22*noise)
save('floor-path-mask.png',path)
soot=np.exp(-((x-.5)/(.08+.25*(1-y)))**2)*np.sin(np.pi*y)**.65*(.7+.3*noise)
save('torch-soot.png',np.stack([np.full_like(x,.045),np.full_like(x,.04),np.full_like(x,.032),soot*.7],axis=-1))
report={'files':receipts,'normal_convention':'OpenGL tangent +Y; linear data','method':'Periodic-plus-smooth colour; image-derived relief, not measured PBR; wrap derivatives','seed':300930,'generator_seed':'not exposed by built-in image tool','sources_revision':REV}
(R/'materials/manifest.json').write_text(json.dumps(report,indent=2))
ops=[CommitOperationAdd(path_in_repo='A-v1/'+p.relative_to(R).as_posix(),path_or_fileobj=p.read_bytes()) for p in R.rglob('*') if p.is_file() and 'inputs' not in p.parts]
api.create_commit(repo_id=REPO,repo_type='dataset',commit_message='Pit material maps and repeat diagnostics checkpoint',operations=ops)
print('MATERIALS_PERSISTED',len(receipts),flush=True)
