#!/usr/bin/env python3
# GLB structure probe (no three, no Blender): tris per mesh + material, skins, clips, images; compares two rigs by joint/clip names.
import json, struct, sys
def probe(p):
    b=open(p,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n])
    acc=j.get('accessors',[]); imgs=j.get('images',[]); tex=j.get('textures',[])
    tris=0; meshes=[]
    for m in j.get('meshes',[]):
        t=0
        for pr in m['primitives']:
            c=acc[pr['indices']]['count'] if 'indices' in pr else acc[pr['attributes']['POSITION']]['count']
            t+=c//3
        tris+=t; meshes.append((m.get('name'),len(m['primitives']),t,[ (j['materials'][pr['material']].get('name') if 'material' in pr else None) for pr in m['primitives']]))
    skins=[(len(s['joints'])) for s in j.get('skins',[])]
    jn=[j['nodes'][i].get('name') for s in j.get('skins',[]) for i in s['joints']]
    clips=[a.get('name') for a in j.get('animations',[])]
    print(p, 'bytes',len(b),'tris',tris,'meshes',len(meshes),'skins',skins,'clips',len(clips),'images',len(imgs),'ext',j.get('extensionsUsed'))
    for m in meshes: print('  ',m)
    print('  images',[ (i.get('mimeType'), i.get('name')) for i in imgs][:12])
    print('  clips',clips)
    return set(jn), clips
# Usage: python3 scripts/glb-probe.py <shipped rig.glb> <candidate.glb> — joints and clips must match by NAME for a drop-in look (Armour, 2026-09-27)
a,ca=probe(sys.argv[1]); b,cb=probe(sys.argv[2])
print('joints equal', a==b, 'missing in candidate', sorted(a-b)[:10], 'extra', sorted(b-a)[:10]); print('clips same set', set(ca)==set(cb), 'missing', sorted(set(ca)-set(cb)))
