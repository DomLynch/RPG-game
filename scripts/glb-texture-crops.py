#!/usr/bin/env python3
"""Close-up proof for a GLB texture re-encode: for each embedded image, a 100% crop of the middle, before | after | difference x6, as one PNG.
Usage: python3 glb-texture-crops.py <before.glb> <after.glb> <out dir> <label>"""
import io, json, os, struct, sys
from PIL import Image, ImageChops

def images(path):
    raw = open(path, 'rb').read()
    jlen = struct.unpack('<I', raw[12:16])[0]; doc = json.loads(raw[20:20 + jlen]); bin0 = raw[28 + jlen:]
    out = []
    for im in doc['images']:
        v = doc['bufferViews'][im['bufferView']]; o = v.get('byteOffset', 0)
        out.append((im.get('name', 'image'), Image.open(io.BytesIO(bin0[o:o + v['byteLength']])).convert('RGB')))
    return out

before, after, outdir, label = sys.argv[1:5]
os.makedirs(outdir, exist_ok=True)
for (n, a), (_, b) in zip(images(before), images(after)):
    w, h = a.size; box = (w // 4, h // 4, w // 4 + min(256, w // 2), h // 4 + min(256, h // 2))
    ca, cb = a.crop(box), b.crop(box); d = ImageChops.difference(ca, cb).point(lambda x: min(255, x * 6))
    sheet = Image.new('RGB', (ca.width * 3 + 8, ca.height), (30, 30, 30)); sheet.paste(ca, (0, 0)); sheet.paste(cb, (ca.width + 4, 0)); sheet.paste(d, (ca.width * 2 + 8, 0))
    sheet.save(os.path.join(outdir, f'{label}-{n}.png')); print('wrote', f'{label}-{n}.png', sheet.size)
