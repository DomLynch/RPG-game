"""Read-only source artifact audit; never calls paid services."""
from pathlib import Path
import json,hashlib,struct,math,io,sys
from PIL import Image
R=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/Users/domininclynch/Desktop/Business/frankendom/docs/character-references/pit')
rows=[]
for p in (R/'materials').glob('*.png'):
 assert Image.open(p).size==(1024,1024),p
for name in ['bull-skull','weapon-rack','table','torch-sconce']:
 p=R/'props'/name/(name+'.glb');b=p.read_bytes();assert struct.unpack_from('<III',b)==(0x46546c67,2,len(b));n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);data=b[28+n:];tris=sum(d['accessors'][v['indices']]['count']//3 for m in d['meshes'] for v in m['primitives']);receipt=json.loads(p.with_name(name+'-receipt.json').read_text());assert tris==receipt['triangles']<=receipt['cap'];assert hashlib.sha256(b).hexdigest()==receipt['model_sha256'];assert any(m.get('name') in [name+'-mesh',name+'-mesh.001'] for m in d['meshes'])
 for im in d['images']:
  v=d['bufferViews'][im['bufferView']];raw=data[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];assert Image.open(io.BytesIO(raw)).size==(1024,1024)
 for ref in receipt['renders']:
  q=p.parent/ref['file'];assert hashlib.sha256(q.read_bytes()).hexdigest()==ref['sha256']
 report=json.loads(p.with_suffix('.glb.validation.json').read_text());assert report['issues']['numErrors']==0 and report['issues']['numWarnings']==0
 rows.append({'name':name,'triangles':tris,'bytes':len(b),'images':len(d['images'])})
for phase in ['before','after']:
 for view in ['gate','trophies']:assert Image.open(R/'review'/f'{phase}-{view}-375.png').size==(375,812)
for f in json.loads((R/'manifest.json').read_text())['files']:
 p=R/f['path'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],p
print(json.dumps({'status':'PASS','materials':len(list((R/'materials').glob('*.png'))),'props':rows,'views':4}))
