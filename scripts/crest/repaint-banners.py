#!/usr/bin/env python3
"""Replace the banner crest painted into a baked fortress panorama (public/zones/goblin-fortress-*.webp) with Frankendom's own mark (frankendom-crest.json).
The old crest's place on each banner is a data row (banner-crests.json: centre and size per banner, measured on the image); each box is wiped with the cloth's own colour and Frankendom's mark is drawn at the same place and size.
  repaint-banners.py <in.webp> <out.webp> [--debug <overlay.png>] [--apply] [--crest scripts/crest/frankendom-crest.json] [--crests scripts/crest/banner-crests.json]
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

args = sys.argv[1:]
src, dst = args[0], args[1]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
crest = json.load(open(opt('--crest', 'scripts/crest/frankendom-crest.json')))['crest']
img = Image.open(src).convert('RGB'); a = np.asarray(img).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
red = (r > 95) & (r > 1.45 * g) & (r > 1.6 * b)
import os
stem = os.path.splitext(os.path.basename(src))[0]
boxes = json.load(open(opt('--crests', 'scripts/crest/banner-crests.json')))[stem]
found = [dict(crest=tuple(c), box=(int(c[0] - c[2] / 2), int(c[1] - c[3] / 2), int(c[0] + c[2] / 2), int(c[1] + c[3] / 2))) for c in boxes]
print(f'{len(found)} crests in {src}')

if opt('--debug'):
    d = img.copy(); dr = ImageDraw.Draw(d)
    for f in found:
        cx, cy, w, h = f['crest']; dr.rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), outline=(255, 255, 0))
    d.save(opt('--debug'))
    if '--apply' not in args: sys.exit(0)

hexc = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
def mark(size, rgb_cloth):
    """The crest as an RGBA layer of `size` px square (drawn 4x, then reduced)."""
    S = size * 4; layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    P = lambda p: ((p[0] + 1) / 2 * (S - 1), (p[1] + 1) / 2 * (S - 1)); U = S / 2
    ink, edge = hexc(crest['ink']) + (255,), hexc(crest['edge']) + (255,)
    for s in crest['shapes']:
        col = edge if s.get('color') == 'edge' else ink
        if s['kind'] == 'polygon':
            pts = [P(p) for p in s['points']]
            if s.get('fill'): d.polygon(pts, fill=ink)
            if s.get('edge'): d.line(pts + [pts[0]], fill=edge, width=max(1, int(crest['edgeWidth'] * U)), joint='curve')
        elif s['kind'] == 'line': d.line([P(s['from']), P(s['to'])], fill=col, width=max(1, int(s['width'] * U)))
        elif s['kind'] == 'circle':
            cx, cy = P(s['center']); rr = s['radius'] * U; d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=col)
    return layer.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.5))

out = a.copy(); H, W = a.shape[:2]
for f in found:
    cx, cy, cw, ch = f['crest']; pad = 0.2
    x0, x1 = max(0, int(cx - cw / 2 * (1 + pad))), min(W - 1, int(cx + cw / 2 * (1 + pad))); y0, y1 = max(0, int(cy - ch / 2 * (1 + pad))), min(H - 1, int(cy + ch / 2 * (1 + pad)))
    top = a[max(0, y0 - 4):max(1, y0 - 1), x0:x1 + 1].mean(axis=0) if y0 > 1 else None; bottom = a[min(H - 2, y1 + 2):min(H, y1 + 5), x0:x1 + 1].mean(axis=0) if y1 < H - 3 else None
    top = bottom if top is None else top; bottom = top if bottom is None else bottom   # the cloth's own colour: each column runs from the cloth just above the box to the cloth just below it
    t = np.linspace(0, 1, y1 - y0 + 1)[:, None, None]; out[y0:y1 + 1, x0:x1 + 1] = top[None] * (1 - t) + bottom[None] * t
    size = max(8, int(round(max(cw, ch)))); layer = mark(size, None); px, py = int(round(cx - size / 2)), int(round(cy - size / 2))
    base = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); base.paste(layer, (px, py), layer); out = np.asarray(base).astype(np.float32)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, quality=int(opt("--quality", "80")), method=6)
print('wrote', dst)
