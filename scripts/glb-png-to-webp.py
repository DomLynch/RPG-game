#!/usr/bin/env python3
"""Rewrite a GLB so its embedded PNG images are lossy WebP (EXT_texture_webp), geometry and everything else byte-identical.
Usage: python3 glb-png-to-webp.py <in.glb> <out.glb> <quality> [<quality for names containing 'metalrough'>]
Why: a PNG texture on a 1,900-triangle weapon was 959 KB of a 1,065 KB file (docs/specs/characters/phone-budgets.md). Needs Pillow with WebP.
Prints per image: before/after bytes and the mean and max absolute difference per channel after the round trip (a size-for-fidelity check)."""
import io, json, struct, sys
from PIL import Image, ImageChops

src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
q_data = int(sys.argv[4]) if len(sys.argv) > 4 else q
raw = open(src, 'rb').read()
magic, ver, _total = struct.unpack('<4sII', raw[:12])
assert magic == b'glTF' and ver == 2
jlen, jtype = struct.unpack('<I4s', raw[12:20]); assert jtype == b'JSON'
doc = json.loads(raw[20:20 + jlen])
blen, btype = struct.unpack('<I4s', raw[20 + jlen:28 + jlen]); assert btype == b'BIN\0'
bin0 = raw[28 + jlen:28 + jlen + blen]
views = doc['bufferViews']
data = [bin0[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in views]
changed = {}
for i, im in enumerate(doc.get('images', [])):
    if im.get('mimeType') != 'image/png': continue
    old = data[im['bufferView']]
    pic = Image.open(io.BytesIO(old)); pic.load()
    has_alpha = pic.mode in ('RGBA', 'LA') and pic.getchannel('A').getextrema()[0] < 255
    pic = pic.convert('RGBA' if has_alpha else 'RGB')
    quality = q_data if 'metalrough' in (im.get('name') or '').lower() else q
    out = io.BytesIO(); pic.save(out, 'WEBP', quality=quality, method=6); new = out.getvalue()
    back = Image.open(io.BytesIO(new)).convert(pic.mode)
    diff = ImageChops.difference(pic, back); ex = diff.getextrema()
    mean = [sum(i * c for i, c in enumerate(diff.getchannel(ch).histogram())) / (pic.width * pic.height) for ch in range(len(ex))]
    print(f"image {i} {im.get('name')}: {pic.width}x{pic.height} {pic.mode} q{quality}: {len(old)} -> {len(new)} bytes, mean abs diff {[round(m, 2) for m in mean]}, max {[e[1] for e in ex]}")
    data[im['bufferView']] = new; im['mimeType'] = 'image/webp'; changed[i] = True
for t in doc.get('textures', []):
    s = t.get('source')
    if s in changed:
        t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': s}; del t['source']
if changed:
    for key in ('extensionsUsed', 'extensionsRequired'):
        have = doc.setdefault(key, [])
        if 'EXT_texture_webp' not in have: have.append('EXT_texture_webp')
body = bytearray(); off = 0
for v, d in zip(views, data):
    pad = (-len(body)) % 4; body += b'\0' * pad
    v['byteOffset'] = len(body); v['byteLength'] = len(d); body += d
body += b'\0' * ((-len(body)) % 4)
doc['buffers'][0]['byteLength'] = len(body)
js = json.dumps(doc, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
total = 12 + 8 + len(js) + 8 + len(body)
open(dst, 'wb').write(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(body), b'BIN\0') + bytes(body))
print(f"{src}: {len(raw)} -> {total} bytes")
