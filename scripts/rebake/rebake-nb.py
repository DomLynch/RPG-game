# Nightborn rebake (Armour 2026-09-28 19:1x): the Knight rebake generalised to SEVERAL parts, each `part=<node>[:<primitive>]=<tris>`, every
# part baking base colour + metallic/roughness from ITS OWN material's atlas into ONE new atlas / ONE material (name from `name=`); the mesh's
# other primitives (e.g. L10_Armour p1 "articulated metal") are kept as they are. No tatter erosion, no component drop.
# Usage: rebake-nb.py <in.glb> <out.glb> part=L10_ClosedHelmet=30000 part=L10_Armour:0=30000 name=L10_Rebaked [atlas=2048 q=85 qmr=70]
import json,struct,sys,os,io,numpy as np, xatlas, pyfqmr
from scipy.spatial import cKDTree
from PIL import Image
sys.path.insert(0,os.path.dirname(__file__)); from glbpose import Glb; from srgbfold import fold_base_factor
SRC,OUT=sys.argv[1],sys.argv[2]; opts=dict(a.split('=',1) for a in sys.argv[3:] if '=' in a and not a.startswith('part=')); PARTS=[]
for a in sys.argv[3:]:
    if a.startswith('part='):
        spec,tris=a[5:].rsplit('=',1); node,_,prim=spec.partition(':'); PARTS.append((node,'*' if prim=='*' else int(prim or 0),int(tris)))
DRAW=opts.get('name','Rebaked'); BUD={(n_,p_):t_ for n_,p_,t_ in PARTS}
MINCOMP=int(opts.get('mincomp',1)); ATLAS=int(opts.get('atlas',2048)); Q=int(opts.get('q',85))
g=Glb(SRC); j=g.j; bin_=g.bin
def img(i):
    im=j['images'][i]; bv=j['bufferViews'][im['bufferView']]; return Image.open(io.BytesIO(bin_[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]))
def texsrc(ref): t=j['textures'][ref['index']]; return t.get('extensions',{}).get('EXT_texture_webp',{}).get('source',t.get('source'))
def maps_of(mi):
    # a part's source colour = baseColorTexture x baseColorFactor (or the flat factor when the material has no texture: the Dwarf's
    # "coverage armour"/gorget are factor-only); MR likewise from metallicRoughnessTexture x (roughnessFactor G, metallicFactor B).
    # The factors are folded INTO the baked atlas and the new material's factors are reset to 1 (Dwarf 2026-09-28 20:1x).
    m_=j['materials'][mi]; pb=m_.get('pbrMetallicRoughness',{}); bcf=np.array(pb.get('baseColorFactor',[1,1,1,1])[:3],np.float32)
    b_=np.asarray(img(texsrc(pb['baseColorTexture'])).convert('RGB')).astype(np.float32) if 'baseColorTexture' in pb else np.full((4,4,3),255,np.float32)
    b_=fold_base_factor(b_,bcf)   # factor is LINEAR, texels are sRGB: multiply in linear light (2026-09-30; the old byte-times-factor multiply baked tinted parts too dark)
    rf=float(pb.get('roughnessFactor',1)); mf=float(pb.get('metallicFactor',1))
    mr_=np.asarray(img(texsrc(pb['metallicRoughnessTexture'])).convert('RGB')).astype(np.float32) if 'metallicRoughnessTexture' in pb else np.full(b_.shape,255,np.float32)
    mr_[...,1]*=rf; mr_[...,2]*=mf; mr_=np.clip(mr_,0,255).astype(np.uint8)
    return b_,mr_
mat0=None
atlas=xatlas.Atlas(); parts=[]
for node in j['nodes']:
    if 'mesh' not in node: continue
    prims=j['meshes'][node['mesh']]['primitives']
    for pi_ in (['*'] if (node.get('name'),'*') in BUD else range(len(prims))):
      if (node.get('name'),pi_) not in BUD: continue
      key=(node.get('name'),pi_); sel=prims if pi_=='*' else [prims[pi_]]
      # merged part (Dwarf 20:3x): the armour's material primitives are patches of ONE surface; decimated apart, every patch edge is a
      # preserved border and the cut floors. Concatenate them, remember each face's material, weld and decimate as one mesh.
      P_,UV_,IDX_,J_,W_,FM_=[],[],[],[],[],[]; off_=0
      for q_,pq in enumerate(sel):
          pp=g.acc(pq['attributes']['POSITION']).astype(np.float64); pu=g.acc(pq['attributes']['TEXCOORD_0']).astype(np.float64); pidx=g.acc(pq['indices']).reshape(-1,3).astype(np.int64)
          P_.append(pp); UV_.append(pu); IDX_.append(pidx+off_); J_.append(g.acc(pq['attributes']['JOINTS_0']).astype(int)); W_.append(g.acc(pq['attributes']['WEIGHTS_0']).astype(np.float64)); FM_.append(np.full(len(pidx),pq['material'])); off_+=len(pp)
      pos=np.concatenate(P_); uv=np.concatenate(UV_); idx=np.concatenate(IDX_); ji=np.concatenate(J_); w=np.concatenate(W_); facemat=np.concatenate(FM_)
      p=sel[0]; mats_used=sorted(set(facemat.tolist())); MAPS={mi:maps_of(mi) for mi in mats_used}; base,mr=MAPS[mats_used[0]]; TH,TW=base.shape[:2]
      if mat0 is None: mat0=p['material']; pbr=j['materials'][mat0]['pbrMetallicRoughness']
      if w.max()>1.5: w/=255
      # old surface for baking: triangle list with per-corner old UV (per-face islands)
      old_tri=pos[idx]; old_uv=uv[idx]; old_cent=old_tri.mean(1)
      # weld by position AND skinning (Armour 2026-09-30: a position-only weld gave seam duplicates one side's weights -> Knight L2 phone 78 cm)
      _,rep,inv=np.unique(np.hstack([np.round(pos,5),ji,np.round(w,2)]),axis=0,return_index=True,return_inverse=True); inv=inv.ravel(); P=pos[rep]; W=w[rep]; JI=ji[rep]
      F=inv[idx]; F=F[(F[:,0]!=F[:,1])&(F[:,1]!=F[:,2])&(F[:,0]!=F[:,2])]
      # tatters: drop connected components under MINCOMP tris
      from scipy.sparse import csr_matrix; from scipy.sparse.csgraph import connected_components
      e=np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]); A=csr_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(len(P),len(P))); nc,lab=connected_components(A,directed=False)
      tl=lab[F[:,0]]; tsz=np.bincount(tl,minlength=nc); keep=tsz[tl]>=MINCOMP; dropped=(~keep).sum(); F=F[keep]
      # tatters (Strategy 2026-09-28): GPT's plane cuts leave open edges whose black backfaces read as jagged strands; erode ERODE rings of
      # triangles off every open edge inside the arm/shoulder band (y BAND), which trims the strands to a straight hem. Skirt hem and neck untouched.
      ERODE=int(opts.get('erode',0)); y0,y1=[float(x) for x in opts.get('band','1.35,2.12').split(',')]
      for _ in range(ERODE):
          e=np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),1); u,c=np.unique(e,axis=0,return_counts=True); bverts=np.zeros(len(P),bool); bverts[u[c==1].ravel()]=True
          touch=bverts[F].any(1); band=((P[F].mean(1)[:,1]>y0)&(P[F].mean(1)[:,1]<y1)); F=F[~(touch&band)]
      dropped+=0
      # decimate (quadric, borders locked)
      ms=pyfqmr.Simplify(); ms.setMesh(P,F); ms.simplify_mesh(target_count=BUD[key],aggressiveness=5,preserve_border=True,verbose=False); P2,F2,_=ms.getMesh()
      # weights for the decimated vertices: nearest welded vertex
      d,nn=cKDTree(P).query(P2); W2=W[nn]; JI2=JI[nn]
      parts.append(dict(name=node['name'],node=node,pi=pi_,base=base,mr=mr,TW=TW,TH=TH,facemat=facemat,MAPS=MAPS,P=P2.astype(np.float32),F=F2.astype(np.uint32),W=W2,JI=JI2,old_tri=old_tri,old_uv=old_uv,old_cent=old_cent))
      print(f"{node['name']}: welded {len(P)} v / {len(F)+dropped} t, dropped {dropped} tatter tris (<{MINCOMP}), decimated -> {len(P2)} v / {len(F2)} t")
      # boost=<node>,<node> boostk=K (Nightborn L2 22:3x): those parts' charts get K x the texel density in the shared atlas (xatlas packs by 3D
      # area; only the atlas input is scaled, the baked geometry is not): the open-crown face photo would otherwise shrink to ~8 % of the map.
      k_=float(opts.get('boostk',2)) if node['name'] in opts.get('boost','').split(',') else 1.0
      atlas.add_mesh((P2*k_).astype(np.float32),F2.astype(np.uint32))
missing=[k for k in BUD if k not in {(pt['name'],pt['pi']) for pt in parts}]
if missing: sys.exit(f'REBAKE PARTS NOT FOUND in this file: {missing} (20:3x: a wrong PARTS list silently produced a mis-cut look)')
co=xatlas.ChartOptions(); po=xatlas.PackOptions(); po.resolution=ATLAS; po.padding=4; po.bilinear=True
atlas.generate(chart_options=co,pack_options=po); print('atlas',atlas.width,atlas.height,'charts',atlas.chart_count)
AW,AH=atlas.width,atlas.height; newbase=np.zeros((AH,AW,3),np.float32); newmr=np.zeros((AH,AW,3),np.float32); cover=np.zeros((AH,AW),bool)
def bary(p,a,b,c):
    v0=b-a; v1=c-a; v2=p-a; d00=(v0*v0).sum(-1); d01=(v0*v1).sum(-1); d11=(v1*v1).sum(-1); d20=(v2*v0).sum(-1); d21=(v2*v1).sum(-1); den=d00*d11-d01*d01+1e-20
    v=(d11*d20-d01*d21)/den; w=(d00*d21-d01*d20)/den; return np.stack([1-v-w,v,w],-1)
for k,part in enumerate(parts):
    vmap,ind,uvs=atlas[k]; P=part['P'][vmap]; W=part['W'][vmap]; JI=part['JI'][vmap]; F=ind.astype(np.int64); part.update(P=P,W=W,JI=JI,F=F,UV=uvs)
    tree=cKDTree(part['old_cent'])
    # rasterise every new triangle into the atlas; each texel -> 3D point -> nearest old triangle (by centroid, k=8, closest point) -> old uv -> sample
    uvpx=uvs*np.array([AW,AH]); 
    for t in range(len(F)):
        tri=uvpx[F[t]]; x0,y0=np.floor(tri.min(0)).astype(int); x1,y1=np.ceil(tri.max(0)).astype(int)
        if x1<=x0 or y1<=y0: x1=x0+1; y1=y0+1
        xs,ys=np.meshgrid(np.arange(max(x0-1,0),min(x1+2,AW)),np.arange(max(y0-1,0),min(y1+2,AH))); pts=np.stack([xs.ravel()+0.5,ys.ravel()+0.5],1)
        b=bary(pts,tri[0],tri[1],tri[2]); inside=(b>-0.02).all(1)
        if not inside.any(): continue
        b=np.clip(b[inside],0,1); b/=b.sum(1,keepdims=True); p3=b@P[F[t]]
        _,cand=tree.query(p3,k=6); ot=part['old_tri'][cand]                      # (n,6,3,3)
        bb=bary(p3[:,None,:],ot[:,:,0],ot[:,:,1],ot[:,:,2]); bbc=np.clip(bb,0,1); bbc/=bbc.sum(-1,keepdims=True)
        proj=np.einsum('nkc,nkcd->nkd',bbc,ot); dist=np.linalg.norm(proj-p3[:,None,:],axis=-1); best=dist.argmin(1)
        ouv=np.einsum('nc,ncd->nd',bbc[np.arange(len(best)),best],part['old_uv'][cand[np.arange(len(best)),best]])
        yy=ys.ravel()[inside]; xx=xs.ravel()[inside]; srcm=part['facemat'][cand[np.arange(len(best)),best]]
        for mi_ in np.unique(srcm):
            sm=srcm==mi_; bb_,mm_=part['MAPS'][int(mi_)]; th_,tw_=bb_.shape[:2]; px=np.clip((ouv[sm,0]*tw_).astype(int),0,tw_-1); py=np.clip((ouv[sm,1]*th_).astype(int),0,th_-1)
            # Veteran (2026-09-29): a material's MR map can be smaller than its base map (Face: 2048 base, 512 MR) -> sample each at its own size
            mh_,mw_=mm_.shape[:2]; mx=np.clip((ouv[sm,0]*mw_).astype(int),0,mw_-1); my=np.clip((ouv[sm,1]*mh_).astype(int),0,mh_-1)
            newbase[yy[sm],xx[sm]]=bb_[py,px]; newmr[yy[sm],xx[sm]]=mm_[my,mx]; cover[yy[sm],xx[sm]]=True
    print(part['name'],'baked',len(F),'tris')
# dilate uncovered texels from covered neighbours (padding against bilinear bleed)
from scipy.ndimage import distance_transform_edt
_,(iy,ix)=distance_transform_edt(~cover,return_indices=True); newbase=newbase[iy,ix]; newmr=newmr[iy,ix]
def webp(a,q):
    im=Image.fromarray(a.astype(np.uint8)); im=im.resize((ATLAS,ATLAS),Image.LANCZOS) if im.size!=(ATLAS,ATLAS) else im; b=io.BytesIO(); im.save(b,'WEBP',quality=q); return b.getvalue()
imgs=[webp(newbase,Q),webp(newmr,int(opts.get('qmr',70)))]; print('new maps bytes',[len(x) for x in imgs])
# ---- write: new buffer from scratch for the rebaked draws; copy everything else's bufferViews via GC
views=j['bufferViews']; accs=j['accessors']; blob=bytearray(bin_)
def append(raw,target=None):
    off=len(blob); blob.extend(raw); blob.extend(b'\0'*((4-len(raw)%4)%4)); bv={'buffer':0,'byteOffset':off,'byteLength':len(raw)}
    if target: bv['target']=target
    views.append(bv); return len(views)-1
def acc_(arr,ctype,atype,target=None,minmax=False,norm=False):
    a={'bufferView':append(np.ascontiguousarray(arr).tobytes(),target),'componentType':ctype,'count':len(arr),'type':atype}
    if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    if norm: a['normalized']=True
    accs.append(a); return len(accs)-1
# new images/textures/material
for x in imgs: j['images'].append({'mimeType':'image/webp','bufferView':append(x),'name':DRAW+'_baked'})
ib,im_=len(j['images'])-2,len(j['images'])-1
j['textures'].append({'extensions':{'EXT_texture_webp':{'source':ib}}}); j['textures'].append({'extensions':{'EXT_texture_webp':{'source':im_}}})
newmat=dict(j['materials'][mat0]); newmat['name']=DRAW; newmat['pbrMetallicRoughness']=dict(pbr); newmat['pbrMetallicRoughness'].update(baseColorFactor=[1,1,1,1],metallicFactor=1,roughnessFactor=1); newmat['pbrMetallicRoughness']['baseColorTexture']={'index':len(j['textures'])-2}; newmat['pbrMetallicRoughness']['metallicRoughnessTexture']={'index':len(j['textures'])-1}; newmat.pop('normalTexture',None); newmat.pop('occlusionTexture',None)
j['materials'].append(newmat); NM=len(j['materials'])-1
for part in parts:
    P,F,W,JI,UV=part['P'],part['F'],part['W'],part['JI'],part['UV']
    # smooth vertex normals
    N=np.zeros_like(P); fn=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]]); 
    for c in range(3): np.add.at(N,F[:,c],fn)
    N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-12
    wq=np.round(W*255).astype(np.int64); wq[np.arange(len(wq)),wq.argmax(1)]+=255-wq.sum(1)
    prim={'attributes':{'POSITION':acc_(P.astype(np.float32),5126,'VEC3',34962,True),'NORMAL':acc_(N.astype(np.float32),5126,'VEC3',34962),'TEXCOORD_0':acc_(UV.astype(np.float32),5126,'VEC2',34962),'JOINTS_0':acc_(JI.astype(np.uint8),5121,'VEC4',34962),'WEIGHTS_0':acc_(wq.astype(np.uint8),5121,'VEC4',34962,norm=True)},'indices':acc_(F.astype(np.uint32).ravel(),5125,'SCALAR',34963),'material':NM,'mode':4}
    prim['material']=NM
    if part['pi']=='*': j['meshes'][part['node']['mesh']]['primitives']=[prim]
    else: j['meshes'][part['node']['mesh']]['primitives'][part['pi']]=prim
# GC accessors/bufferViews/images/textures/materials
live_acc=set()
for m in j['meshes']:
    for p in m['primitives']: live_acc|=set(p['attributes'].values()); live_acc.add(p['indices'])
for sk in j['skins']: live_acc.add(sk['inverseBindMatrices'])
for an in j.get('animations',[]):
    for sm in an['samplers']: live_acc|={sm['input'],sm['output']}
live_mat=sorted({p['material'] for m in j['meshes'] for p in m['primitives'] if 'material' in p}); mmap={m:i for i,m in enumerate(live_mat)}
for m in j['meshes']:
    for p in m['primitives']: p['material']=mmap[p['material']]
j['materials']=[j['materials'][m] for m in live_mat]
live_tex=set()
for m in j['materials']:
    for o in [m,m.get('pbrMetallicRoughness',{})]:
        for k in ('baseColorTexture','metallicRoughnessTexture','normalTexture','occlusionTexture','emissiveTexture'):
            if k in o: live_tex.add(o[k]['index'])
tmap={t:i for i,t in enumerate(sorted(live_tex))}
for m in j['materials']:
    for o in [m,m.get('pbrMetallicRoughness',{})]:
        for k in ('baseColorTexture','metallicRoughnessTexture','normalTexture','occlusionTexture','emissiveTexture'):
            if k in o: o[k]['index']=tmap[o[k]['index']]
j['textures']=[j['textures'][t] for t in sorted(live_tex)]
live_img=set()
for t in j['textures']:
    s_=t.get('extensions',{}).get('EXT_texture_webp',{}).get('source',t.get('source')); live_img.add(s_)
imap={s_:i for i,s_ in enumerate(sorted(live_img))}
for t in j['textures']:
    if 'source' in t: t['source']=imap[t['source']]
    if 'EXT_texture_webp' in t.get('extensions',{}): t['extensions']['EXT_texture_webp']['source']=imap[t['extensions']['EXT_texture_webp']['source']]
j['images']=[j['images'][s_] for s_ in sorted(live_img)]
amap={a:i for i,a in enumerate(sorted(live_acc))}; live_bv=set(accs[a]['bufferView'] for a in live_acc)|{im['bufferView'] for im in j['images']}
bmap={b:i for i,b in enumerate(sorted(live_bv))}; nb=bytearray(); nviews=[]
for b in sorted(live_bv):
    v=views[b]; data=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]; off=len(nb); nb.extend(data); nb.extend(b'\0'*((4-len(data)%4)%4)); nv=dict(v); nv['byteOffset']=off; nviews.append(nv)
j['bufferViews']=nviews; j['accessors']=[dict(accs[a],bufferView=bmap[accs[a]['bufferView']]) for a in sorted(live_acc)]
for m in j['meshes']:
    for p in m['primitives']: p['attributes']={k:amap[v] for k,v in p['attributes'].items()}; p['indices']=amap[p['indices']]
for sk in j['skins']: sk['inverseBindMatrices']=amap[sk['inverseBindMatrices']]
for an in j.get('animations',[]):
    for sm in an['samplers']: sm['input']=amap[sm['input']]; sm['output']=amap[sm['output']]
for im in j['images']: im['bufferView']=bmap[im['bufferView']]
j['buffers']=[{'byteLength':len(nb)}]
j['scenes'][0].setdefault('extras',{})['rebaked']=sorted({n_ for n_,_,_ in PARTS})   # Hero Look's phone test (#1024 @ 73b2385d): the draws whose material/atlas were re-baked
js=json.dumps(j,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
out=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(nb))+struct.pack('<I',len(js))+b'JSON'+js+struct.pack('<I',len(nb))+b'BIN\0'+bytes(nb)
open(OUT,'wb').write(out); print('wrote',OUT,len(out)); Image.fromarray(newbase.astype(np.uint8)).resize((1024,1024)).save(OUT+'.base.png'); Image.fromarray(newmr.astype(np.uint8)).resize((512,512)).save(OUT+'.mr.png')
