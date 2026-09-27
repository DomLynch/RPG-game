#!/usr/bin/env python3
"""Put a source rig's OWN map bytes back into a GPT rank file (Veteran ladder, 2026-09-27): GPT's export re-encodes the inherited webp maps as
lossless PNG (5 + 3.6 MB for VeteranSurface vs 1.0 + 0.45 MB webp on trunk). For every material named in --materials that exists in --from
by name, the candidate's baseColor / metallicRoughness / normal images take the source's bytes and mime type (identical pixels, shipped encoding).
Usage: glb-restore-maps.py --in <glb> --out <glb> --from <trunk glb> --materials VeteranSurface[,...]"""
import argparse, json, struct
ap = argparse.ArgumentParser(); ap.add_argument('--in', dest='inp', required=True); ap.add_argument('--out', required=True); ap.add_argument('--from', dest='src', required=True); ap.add_argument('--materials', required=True)
A = ap.parse_args()
def load(p):
    b = open(p, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); bl = struct.unpack('<I', b[20 + n:24 + n])[0]; return j, b[28 + n:28 + n + bl]
def image_of(j, mat, key):
    ref = (mat.get('pbrMetallicRoughness', {}) if key != 'normalTexture' else mat).get(key)
    if not ref: return None
    t = j['textures'][ref['index']]; return t.get('source', t.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
j, bin_ = load(A.inp); sj, sbin = load(A.src); replaced = {}
for name in A.materials.split(','):
    mat = next(m for m in j['materials'] if m.get('name') == name); smat = next(m for m in sj['materials'] if m.get('name') == name)
    for key in ('baseColorTexture', 'metallicRoughnessTexture', 'normalTexture'):
        i, si = image_of(j, mat, key), image_of(sj, smat, key)
        if i is None or si is None: continue
        im, sim = j['images'][i], sj['images'][si]; sbv = sj['bufferViews'][sim['bufferView']]
        replaced[im['bufferView']] = sbin[sbv.get('byteOffset', 0):sbv.get('byteOffset', 0) + sbv['byteLength']]
        before = j['bufferViews'][im['bufferView']]['byteLength']; im['mimeType'] = sim['mimeType']
        if sim['mimeType'] == 'image/webp':
            for t in j['textures']:
                if t.get('source') == i: del t['source']; t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': i}
            for k in ('extensionsUsed', 'extensionsRequired'): j[k] = sorted(set(j.get(k, [])) | {'EXT_texture_webp'})
        print(f"{name}.{key}: {im.get('name')} {before} B -> {sim['mimeType']} {len(replaced[im['bufferView']])} B")
parts = []; off = 0
for k, bv in enumerate(j['bufferViews']):
    data = replaced.get(k, bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]); pad = (4 - len(data) % 4) % 4
    bv['byteOffset'] = off; bv['byteLength'] = len(data); parts.append(data + b'\0' * pad); off += len(data) + pad
newbin = b''.join(parts); j['buffers'][0]['byteLength'] = len(newbin)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(A.out, 'wb').write(b'glTF' + struct.pack('<II', 2, 28 + len(js) + len(newbin)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(newbin)) + b'BIN\0' + newbin)
print(f"{A.out}: {28 + len(js) + len(newbin)} bytes")
