# numpy GLB skinning: pose a rig on one of its clips at a time fraction, return skinned positions per skinned draw; edge-stretch metric.
import json,struct,numpy as np
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}; NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
class Glb:
    def __init__(s,path):
        b=open(path,'rb').read(); ln=struct.unpack('<I',b[12:16])[0]; s.j=json.loads(b[20:20+ln]); bl=struct.unpack('<I',b[20+ln:24+ln])[0]; s.bin=b[28+ln:28+ln+bl]; s.raw=b
    def acc(s,ai):
        a=s.j['accessors'][ai]; bv=s.j['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); n=NC[a['type']]
        arr=np.frombuffer(s.bin,CT[a['componentType']],a['count']*n,off).reshape(a['count'],n)
        if a.get('normalized'): arr=arr.astype(np.float32)/np.iinfo(CT[a['componentType']]).max
        return arr
def trs(t,r,sc):
    x,y,z,w=r; R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    M=np.eye(4); M[:3,:3]=R*np.array(sc); M[:3,3]=t; return M
def local_mats(g,clip=None,frac=0.0):
    nodes=g.j['nodes']; T=[np.array(n.get('translation',[0,0,0]),float) for n in nodes]; R=[np.array(n.get('rotation',[0,0,0,1]),float) for n in nodes]; S=[np.array(n.get('scale',[1,1,1]),float) for n in nodes]
    if clip is not None:
        an=next(a for a in g.j['animations'] if a['name']==clip); tmax=max(g.acc(sm['input'])[-1,0] for sm in an['samplers']); t=frac*tmax
        for ch in an['channels']:
            sm=an['samplers'][ch['sampler']]; ti=g.acc(sm['input'])[:,0]; vo=g.acc(sm['output']); step=1
            if sm.get('interpolation')=='CUBICSPLINE': vo=vo.reshape(len(ti),3,-1)[:,1,:]
            k=np.searchsorted(ti,t)-1; k=max(0,min(k,len(ti)-2)); a=0 if ti[k+1]==ti[k] else (t-ti[k])/(ti[k+1]-ti[k]); a=min(max(a,0),1)
            v0,v1=vo[k],vo[k+1]; p=ch['target']['path']; ni=ch['target']['node']
            if p=='rotation':
                if np.dot(v0,v1)<0: v1=-v1
                v=v0*(1-a)+v1*a; v/=np.linalg.norm(v); R[ni]=v
            elif p=='translation': T[ni]=v0*(1-a)+v1*a
            elif p=='scale': S[ni]=v0*(1-a)+v1*a
    return [trs(T[i],R[i],S[i]) for i in range(len(nodes))]
def globals_(g,L):
    nodes=g.j['nodes']; parent={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}; G=[None]*len(nodes)
    def gm(i):
        if G[i] is None: G[i]=(gm(parent[i])@L[i]) if i in parent else L[i]
        return G[i]
    return [gm(i) for i in range(len(nodes))]
def skinned(g,clip=None,frac=0.0,draws=None):
    G=globals_(g,local_mats(g,clip,frac)); out={}
    for ni,n in enumerate(g.j['nodes']):
        if 'mesh' not in n or 'skin' not in n: continue
        if draws and n.get('name') not in draws: continue
        sk=g.j['skins'][n['skin']]; ibm=g.acc(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1); JM=np.array([G[jn] for jn in sk['joints']])@ibm
        for pi,p in enumerate(g.j['meshes'][n['mesh']]['primitives']):
            pos=g.acc(p['attributes']['POSITION']).astype(float); ji=g.acc(p['attributes']['JOINTS_0']).astype(int); w=g.acc(p['attributes']['WEIGHTS_0']).astype(float)
            if w.max()>1.5: w/=255
            M=np.einsum('vk,vkij->vij',w,JM[ji]); P=np.einsum('vij,vj->vi',M[:,:3,:3],pos)+M[:,:3,3]
            out[(n.get('name'),pi)]=(P,pos,p)
    return out
def edges(g,p):
    idx=g.acc(p['indices']).reshape(-1,3) if 'indices' in p else np.arange(g.j['accessors'][p['attributes']['POSITION']]['count']).reshape(-1,3)
    e=np.concatenate([idx[:,[0,1]],idx[:,[1,2]],idx[:,[2,0]]]); e=np.sort(e,1); return np.unique(e,axis=0)
def stretch(g,clip,frac,draws=None):
    res={}
    for (name,pi),(P,pos,p) in skinned(g,clip,frac,draws).items():
        e=edges(g,p); l0=np.linalg.norm(pos[e[:,0]]-pos[e[:,1]],axis=1); l1=np.linalg.norm(P[e[:,0]]-P[e[:,1]],axis=1); ok=l0>1e-6; r=l1[ok]/l0[ok]
        res[name]=dict(max=float(r.max()),p99=float(np.percentile(r,99)),above2=int((r>2).sum()),edges=int(ok.sum()))
    return res
if __name__=='__main__':
    import sys; g=Glb(sys.argv[1]); clips=sys.argv[2].split(','); fracs=[float(x) for x in sys.argv[3].split(',')]
    for c in clips:
        for f in fracs:
            r=stretch(g,c,f); print(c,f,{k:(round(v['max'],2),round(v['p99'],2),v['above2']) for k,v in r.items()})
