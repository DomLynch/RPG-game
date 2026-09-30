"""Copy only reviewed source artifacts; runtime compression remains World-owned."""
from pathlib import Path
import json,shutil,hashlib,gzip
R=Path(__file__).resolve().parents[1];D=Path('/Users/domininclynch/Desktop/Business/frankendom/docs/character-references/pit')
rows=[]
for name in ['bull-skull','weapon-rack','table','torch-sconce']:
 src=R/'final'/name;out=D/'props'/name;out.mkdir(parents=True,exist_ok=True)
 for p in src.iterdir():
  if p.suffix in ['.png','.json','.glb']:shutil.copy2(p,out/p.name)
 refs=out/'references';refs.mkdir(exist_ok=True)
 for p in (R/'props'/name).iterdir():
  if p.suffix in ['.png','.json'] and p.name!='lowmesh.json':shutil.copy2(p,refs/p.name)
 shutil.copy2(R/'props'/name/'donor.glb',out/(name+'-donor.glb'))
 rec=json.loads((out/(name+'-receipt.json')).read_text());b=(out/(name+'.glb')).read_bytes();rec['gzip_bytes']=len(gzip.compress(b,mtime=0));rec['donor_sha256']=hashlib.sha256((out/(name+'-donor.glb')).read_bytes()).hexdigest();rec['material_encoding']='1024 WebP embedded in GLB; lossless PNG source maps alongside';rec['not_runtime_ship_copy']=True;(out/(name+'-receipt.json')).write_text(json.dumps(rec,indent=2));rows.append(rec)
for p in (R/'source').glob('*'):
 if p.suffix in ['.py','.mjs']:shutil.copy2(p,D/'source'/p.name)
for p in (R/'receipts').glob('*.json'):shutil.copy2(p,D/'receipts'/p.name)
manifest={'status':'four prop source candidates; gate and two chests blocked by gated DINOv3 access','source_only':True,'props':rows,'remaining_caps':{'gate':6000,'chest-banded':1500,'chest-plain':1000},'files':[]}
for p in sorted(D.rglob('*')):
 if p.is_file() and p.name!='manifest.json':manifest['files'].append({'path':str(p.relative_to(D)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(D/'manifest.json').write_text(json.dumps(manifest,indent=2));print({'props':len(rows),'files':len(manifest['files']),'source_glb_bytes':sum(x['bytes'] for x in rows)})
