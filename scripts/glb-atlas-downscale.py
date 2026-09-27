#!/usr/bin/env python3
"""Downscale a GLB's embedded images in place (Armour, 2026-09-27, Lead's lever 2 for tier looks): every image wider than --max is
resized to --max (webp stays webp, PNG/JPEG stay as they are, quality --q), the binary chunk rebuilt with the new bytes.
  ~/.venvs/face/bin/python scripts/glb-atlas-downscale.py --in a.glb --out b.glb [--max 1024] [--q 85] [--only Image_0,Image_1]"""
import argparse, io, json, struct
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('--in', dest='inp', required=True); ap.add_argument('--out', required=True); ap.add_argument('--max', type=int, default=1024); ap.add_argument('--q', type=int, default=85); ap.add_argument('--only', default=''); ap.add_argument('--webp', action='store_true', help='also re-encode PNG images as webp (lever 2: 1024 webp atlases); textures switch to EXT_texture_webp')
A = ap.parse_args(); only = set(A.only.split(',')) - {''}
b = open(A.inp, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); bl = struct.unpack('<I', b[20 + n:24 + n])[0]; bin_ = b[28 + n:28 + n + bl]
bvs = j['bufferViews']; replaced = {}
for im in j.get('images', []):
    if 'bufferView' not in im or (only and im.get('name') not in only): continue
    bv = bvs[im['bufferView']]; raw = bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    pic = Image.open(io.BytesIO(raw)); w, h = pic.size
    towebp = A.webp and im['mimeType'] == 'image/png'
    if max(w, h) <= A.max and not towebp: continue
    if max(w, h) > A.max: s = A.max / max(w, h); pic = pic.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    out = io.BytesIO(); fmt = 'WEBP' if towebp else {'image/webp': 'WEBP', 'image/png': 'PNG', 'image/jpeg': 'JPEG'}[im['mimeType']]
    pic.save(out, fmt, **({'quality': A.q} if fmt != 'PNG' else {'optimize': True})); replaced[im['bufferView']] = out.getvalue()
    if towebp:
        im['mimeType'] = 'image/webp'; idx = j['images'].index(im)
        for t in j.get('textures', []):
            if t.get('source') == idx: del t['source']; t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': idx}
        for key in ('extensionsUsed', 'extensionsRequired'): j[key] = sorted(set(j.get(key, [])) | {'EXT_texture_webp'})
    print(f"{im.get('name')} {'png->webp ' if towebp else ''}{w}x{h} {len(raw)} B -> {pic.size[0]}x{pic.size[1]} {len(replaced[im['bufferView']])} B")
parts = []; off = 0
for i, bv in enumerate(bvs):
    data = replaced.get(i, bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]); pad = (4 - len(data) % 4) % 4
    bv['byteOffset'] = off; bv['byteLength'] = len(data); parts.append(data + b'\0' * pad); off += len(data) + pad
newbin = b''.join(parts); j['buffers'][0]['byteLength'] = len(newbin)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(A.out, 'wb').write(b'glTF' + struct.pack('<II', 2, 28 + len(js) + len(newbin)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(newbin)) + b'BIN\0' + newbin)
print(f"{A.out}: {28 + len(js) + len(newbin)} bytes")
