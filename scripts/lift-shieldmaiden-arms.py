#!/usr/bin/env python3
"""Lift shieldmaiden.Arms plates out of the shoulder (Armour 2026-10-02, take-check P2): radial expansion LIFT m about each arm's axis.
loot.glb is edited IN PLACE: only the POSITION accessor bytes of the shieldmaiden.Arms.* nodes (+ that accessor's min/max) change.
Same effect as build-warrior.mjs `radius + LIFT` on the three lames per shoulder (shells are cylinder sections about the arm axis).
usage: lift-sm-arms.py <in loot.glb> <out loot.glb> [LIFT=0.0175]"""
import json, struct, sys
import numpy as np
src, dst = sys.argv[1], sys.argv[2]; LIFT = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0175
b = open(src, 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; js = json.loads(b[20:20 + jl]); bo = 20 + jl + 8
bl = struct.unpack_from('<I', b, bo - 8)[0]; bin_ = bytearray(b[bo:bo + bl])
assert js['buffers'][0].get('uri') is None and len(js['buffers']) == 1
def pos_acc(i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    assert a['componentType'] == 5126 and a['type'] == 'VEC3' and bv.get('byteStride', 12) == 12
    return a, bv.get('byteOffset', 0) + a.get('byteOffset', 0)
touched = []
for n in js['nodes']:
    if not n.get('name', '').startswith('shieldmaiden.Arms.') or 'mesh' not in n: continue
    sk = js['skins'][n['skin']]; names = [js['nodes'][j]['name'] for j in sk['joints']]
    ia = js['accessors'][sk['inverseBindMatrices']]; ibv = js['bufferViews'][ia['bufferView']]
    ibm = np.frombuffer(bin_, np.float32, 16 * ia['count'], ibv.get('byteOffset', 0) + ia.get('byteOffset', 0)).reshape(-1, 4, 4).astype(float)
    joint = lambda nm: np.linalg.inv(ibm[names.index(nm)].T)[:3, 3]
    for p in js['meshes'][n['mesh']]['primitives']:
        a, off = pos_acc(p['attributes']['POSITION'])
        v = np.frombuffer(bin_, np.float32, 3 * a['count'], off).reshape(-1, 3).astype(float).copy()
        out = np.zeros(len(v), bool)
        for side in 'lr':
            sh, el = joint(f'upperarm_{side}'), joint(f'lowerarm_{side}'); ax = (el - sh) / np.linalg.norm(el - sh)
            m = (np.sign(v[:, 0]) == np.sign(el[0] - sh[0])) & ~out; out |= m
            rel = v[m] - sh; perp = rel - np.outer(rel @ ax, ax); r = np.linalg.norm(perp, axis=1, keepdims=True)
            v[m] += perp / np.maximum(r, 1e-9) * LIFT
        assert out.all(), 'a plate vertex on neither side'
        new = v.astype(np.float32); bin_[off:off + new.nbytes] = new.tobytes()
        a['min'], a['max'] = new.min(0).tolist(), new.max(0).tolist(); touched.append((n['name'], a['count']))
print('lifted', touched, 'LIFT', LIFT)
jb = json.dumps(js, separators=(',', ':')).encode(); jb += b' ' * (-len(jb) % 4)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(bin_)) + struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_))
