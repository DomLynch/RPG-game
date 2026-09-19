"""Append fitted surfaces while retaining shipped clips, inverse binds and weapon data."""
import copy,json,struct,sys,hashlib
from pathlib import Path
def compact(d,b):
    d=copy.deepcopy(d)
    def retain(key,used):
        ids=sorted(set(used));mapping={old:i for i,old in enumerate(ids)};d[key]=[d[key][i] for i in ids];return mapping
    meshes=retain('meshes',[n['mesh'] for n in d['nodes'] if 'mesh'in n])
    for n in d['nodes']:
        if 'mesh'in n:n['mesh']=meshes[n['mesh']]
    primitives=[p for m in d['meshes'] for p in m['primitives']]
    materials=retain('materials',[p['material'] for p in primitives if 'material'in p])
    for p in primitives:
        if 'material'in p:p['material']=materials[p['material']]
    infos=[]
    def visit(v,key=''):
        if isinstance(v,dict):
            if key.endswith('Texture') and 'index'in v:infos.append(v)
            for k,item in v.items():visit(item,k)
        elif isinstance(v,list):
            for item in v:visit(item)
    visit(d['materials']);textures=retain('textures',[i['index'] for i in infos])
    for i in infos:i['index']=textures[i['index']]
    sources=[]
    for t in d['textures']:
        if 'source'in t:sources.append(t)
        sources.extend(v for v in t.get('extensions',{}).values() if 'source'in v)
    images=retain('images',[v['source'] for v in sources])
    for v in sources:v['source']=images[v['source']]
    samplers=retain('samplers',[t['sampler'] for t in d['textures'] if 'sampler'in t])
    for t in d['textures']:
        if 'sampler'in t:t['sampler']=samplers[t['sampler']]
    skins=retain('skins',[n['skin'] for n in d['nodes'] if 'skin'in n])
    for n in d['nodes']:
        if 'skin'in n:n['skin']=skins[n['skin']]
    refs=[]
    for p in primitives:
        refs.extend((p['attributes'],k) for k in p['attributes'])
        if 'indices'in p:refs.append((p,'indices'))
    refs.extend((s,'inverseBindMatrices') for s in d['skins'] if 'inverseBindMatrices'in s)
    refs.extend((s,k) for a in d.get('animations',[]) for s in a['samplers'] for k in ['input','output'])
    accessors=retain('accessors',[o[k] for o,k in refs])
    for o,k in refs:o[k]=accessors[o[k]]
    refs=[(a,'bufferView') for a in d['accessors'] if 'bufferView'in a]+[(i,'bufferView')for i in d['images'] if 'bufferView'in i]
    views=retain('bufferViews',[o[k] for o,k in refs])
    for o,k in refs:o[k]=views[o[k]]
    out=bytearray()
    for v in d['bufferViews']:
        out+=b'\0'*(-len(out)%4);at=v.get('byteOffset',0);chunk=b[at:at+v['byteLength']];v['byteOffset']=len(out);v['buffer']=0;out+=chunk
    return d,out

root=Path('artifacts/character/creatures');family=sys.argv[1];base='pitborn' if family=='minotaur' else 'nightborn'
def read(p):
 r=Path(p).read_bytes();n=struct.unpack_from('<I',r,12)[0];return json.loads(r[20:20+n]),bytearray(r[28+n:])
def write(p,d,b):
 d['buffers']=[{'byteLength':len(b)}];j=json.dumps(d,separators=(',',':')).encode();j+=b' '*(-len(j)%4);b+=b'\0'*(-len(b)%4)
 p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)
d,b=read(f'src/assets/{base}.glb');new,nb=read(root/f'{family}-surface.glb');frozen=copy.deepcopy(d);original=bytes(b)
# UVs are preserved by the fitter; retain the original WebP maps byte-for-byte.
source,sb=read(Path(f'src/assets/source/creatures/{family}.glb'))
new['images']=copy.deepcopy(source.get('images',[]))
for img in new['images']:
    view=source['bufferViews'][img['bufferView']];at=view.get('byteOffset',0);nb+=b'\0'*(-len(nb)%4)
    img['bufferView']=len(new['bufferViews']);new['bufferViews'].append({'buffer':0,'byteOffset':len(nb),'byteLength':view['byteLength']});nb+=sb[at:at+view['byteLength']]
for key in ['textures','samplers','materials']:new[key]=copy.deepcopy(source.get(key,[]))
for key in ['extensionsUsed','extensionsRequired']:new[key]=list(dict.fromkeys(new.get(key,[])+source.get(key,[])))

skin=next(n['skin'] for n in d['nodes'] if n.get('name')=='Skin')
joints={d['nodes'][n]['name']:i for i,n in enumerate(d['skins'][skin]['joints'])}
newskin=new['skins'][0];remap={i:joints[new['nodes'][n]['name']] for i,n in enumerate(newskin['joints'])}
# Inverse binds must address the same rest-space coordinates as the preserved skeleton.
def accessor(doc,data,i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];size=struct.calcsize(fmt)*k;off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*k,data,off+i*v.get('byteStride',size)) for i in range(a['count'])]
oldib=accessor(d,b,d['skins'][skin]['inverseBindMatrices']);newib=accessor(new,nb,newskin['inverseBindMatrices'])
err=max(abs(a-bb) for i,row in enumerate(newib) for a,bb in zip(row,oldib[remap[i]]));assert err<1e-4,('inverse-bind mismatch',err)
for mesh in new['meshes']:
 for prim in mesh['primitives']:
  a=new['accessors'][prim['attributes']['JOINTS_0']];v=new['bufferViews'][a['bufferView']];fmt={5121:'B',5123:'H'}[a['componentType']];size=struct.calcsize(fmt)*4;off=v.get('byteOffset',0)+a.get('byteOffset',0)
  for i in range(a['count']):
   at=off+i*v.get('byteStride',size);values=struct.unpack_from('<'+fmt*4,nb,at);struct.pack_into('<'+fmt*4,nb,at,*[remap[j] for j in values])
# Hide inherited body art, retain every rigid weapon attachment and all bones/clips.
weaponroots=[i for i,n in enumerate(d['nodes']) if n.get('name') in ['WeaponDrawn','SwordDrawn','SwordSheathed']]
keep=set()
def visit(i):
 keep.add(i)
 for c in d['nodes'][i].get('children',[]):visit(c)
for i in weaponroots:visit(i)
for i,n in enumerate(d['nodes']):
 if 'mesh'in n and i not in keep:n.pop('mesh');n.pop('skin',None)
b+=b'\0'*(-len(b)%4);bo=len(b);b+=nb
counts={k:len(d.get(k,[])) for k in ['bufferViews','accessors','images','samplers','textures','materials','meshes']}
for v in new['bufferViews']:v['byteOffset']=v.get('byteOffset',0)+bo
for a in new['accessors']:
 if 'bufferView'in a:a['bufferView']+=counts['bufferViews']
for img in new.get('images',[]):
 if 'bufferView'in img:img['bufferView']+=counts['bufferViews']
for tex in new.get('textures',[]):
 if 'source'in tex:tex['source']+=counts['images']
 if 'sampler'in tex:tex['sampler']+=counts['samplers']
 for e in tex.get('extensions',{}).values():
  if 'source'in e:e['source']+=counts['images']
def material(v,key=''):
 if isinstance(v,dict):
  if key.endswith('Texture') and 'index'in v:v['index']+=counts['textures']
  for k,item in v.items():material(item,k)
 elif isinstance(v,list):
  for item in v:material(item)
for m in new.get('materials',[]):m['name']=family.title()+'Surface';material(m)
for mesh in new['meshes']:
 for p in mesh['primitives']:
  p['attributes']={k:v+counts['accessors'] for k,v in p['attributes'].items()}
  if 'indices'in p:p['indices']+=counts['accessors']
  if 'material'in p:p['material']+=counts['materials']
for key in counts:d.setdefault(key,[]).extend(new.get(key,[]))
# Creature surfaces bind from their intact reconstructed A-pose; weapons retain their original skin.
bindings=json.loads((root/f'{family}-binds.json').read_text())
b+=b'\0'*(-len(b)%4); at=len(b)
def mm(a,b):return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
vals=[v for i,n in enumerate(d['skins'][skin]['joints']) for v in mm(oldib[i],bindings[d['nodes'][n]['name']])]
raw=struct.pack('<'+'f'*len(vals),*vals);b+=raw
view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':at,'byteLength':len(raw)})
ac=len(d['accessors']);d['accessors'].append({'bufferView':view,'componentType':5126,'count':len(vals)//16,'type':'MAT4'})
new_bind_skin=copy.deepcopy(d['skins'][skin]);new_bind_skin['inverseBindMatrices']=ac;skin=len(d['skins']);d['skins'].append(new_bind_skin)
parent=next(i for i,n in enumerate(frozen['nodes']) if any('skin'in frozen['nodes'][c] for c in n.get('children',[])))
for n in new['nodes']:
 if 'mesh'not in n:continue
 node={'name':'CreatureBody','mesh':n['mesh']+counts['meshes'],'skin':skin,'extras':{'creature':family}}
 i=len(d['nodes']);d['nodes'].append(node);d['nodes'][parent]['children'].append(i)
for key in ['extensionsUsed','extensionsRequired']:
 if key in new:d[key]=list(dict.fromkeys(d.get(key,[])+new[key]))
d.setdefault('extras',{})['creatureSource']={'family':family,'stage':'in-game-playtest','baseSha256':hashlib.sha256(Path(f'src/assets/{base}.glb').read_bytes()).hexdigest(),'generatorSha256':hashlib.sha256(Path('scripts/character/creatures.py').read_bytes()+Path(__file__).read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256((Path(f'src/assets/source/creatures/{family}.glb')).read_bytes()).hexdigest()}
assert b[:len(original)]==original
assert d['animations']==frozen['animations']
assert d['skins'][:len(frozen['skins'])]==frozen['skins']
d,b=compact(d,b)
write(Path(f'src/assets/{family}.glb'),d,b)
print('ASSEMBLED',family,'bind error',err,'bytes',len(b),'clips',len(d['animations']))
