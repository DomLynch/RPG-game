#!/usr/bin/env python3
"""Sever pre-check for a look (Finishers/Lead, 2026-09-27): sever() keeps a triangle with the severed head only when its average Head-bone
weight is >= 0.5 (characters.ts on #918). Per skinned primitive whose vertices touch the Head joint, print the share of triangles that
stay with the head, the share that stay with the body, and which bones carry the rest. Usage: glb-head-weights.py <glb> [<glb>...]"""
import json, struct, sys, numpy as np
for path in sys.argv[1:]:
    b = open(path, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); bl = struct.unpack('<I', b[20 + n:24 + n])[0]; bin_ = b[28 + n:28 + n + bl]
    acc, bvs = j['accessors'], j['bufferViews']
    def rd(ai):
        a = acc[ai]; bv = bvs[a['bufferView']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        dt = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a['componentType']]; k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        return np.frombuffer(bin_, dt, a['count'] * k, off).reshape(a['count'], k)
    joints = [j['nodes'][i]['name'] for i in j['skins'][0]['joints']]; head = joints.index('Head')
    print('==', path.split('/')[-1])
    for m in j['meshes']:
        for p in m['primitives']:
            if 'JOINTS_0' not in p['attributes']: continue
            J = rd(p['attributes']['JOINTS_0']).astype(int); W = rd(p['attributes']['WEIGHTS_0']).astype(float); I = rd(p['indices']).reshape(-1, 3).astype(int)
            hw = (W * (J == head)).sum(1)   # per-vertex Head weight
            if hw.max() < 0.05: continue
            tri = hw[I].mean(1); keep = (tri >= 0.5).mean(); P = rd(p['attributes']['POSITION'])
            other = {}
            for v in np.where(hw < 0.5)[0]:
                for jj, w in zip(J[v], W[v]):
                    if w > 0 and jj != head: other[joints[jj]] = other.get(joints[jj], 0) + w
            top = ', '.join(f'{k} {v / max(1, sum(other.values())) * 100:.0f}%' for k, v in sorted(other.items(), key=lambda x: -x[1])[:3])
            print(f"  {m.get('name')}: {len(I)} tris, y {P[:,1].min():.2f}–{P[:,1].max():.2f}; with head {keep * 100:.1f}%, with body {(1 - keep) * 100:.1f}%; body-side bones: {top or 'none'}")
