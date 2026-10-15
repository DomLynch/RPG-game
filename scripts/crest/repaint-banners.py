#!/usr/bin/env python3
"""Replace the banner crest painted into a baked fortress panorama (public/zones/goblin-fortress-*.webp) with Frankendom's own mark (frankendom-crest.json).
A banner is a red cloth blob with a dark crest inside it: find them, wipe the old crest with the cloth's own colour row by row, draw the new mark at the same place and size.
  repaint-banners.py <in.webp> <out.webp> [--debug <overlay.png>] [--crest scripts/crest/frankendom-crest.json]
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

args = sys.argv[1:]
src, dst = args[0], args[1]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
crest = json.load(open(opt('--crest', 'scripts/crest/frankendom-crest.json')))['crest']
img = Image.open(src).convert('RGB'); a = np.asarray(img).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
red = (r > 95) & (r > 1.45 * g) & (r > 1.6 * b)
lab, n = ndi.label(ndi.binary_closing(red, iterations=2))
found = []
for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    if len(ys) < 250: continue
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max(); h, w = y1 - y0 + 1, x1 - x0 + 1
    if not (0.7 < h / w < 4.0) or w < 14: continue
    cloth = lab[y0:y1 + 1, x0:x1 + 1] == i
    filled = ndi.binary_fill_holes(cloth)
    base = np.median(lum[y0:y1 + 1, x0:x1 + 1][cloth])
    dark = filled & ~cloth | (filled & (lum[y0:y1 + 1, x0:x1 + 1] < 0.5 * base))
    dark = ndi.binary_opening(dark, iterations=1)
    dl, dn = ndi.label(dark)
    if dn == 0: continue
    sizes = ndi.sum(dark, dl, range(1, dn + 1)); k = int(np.argmax(sizes)) + 1
    if sizes[k - 1] < 0.04 * cloth.sum() or sizes[k - 1] < 25: continue
    cy, cx = ndi.center_of_mass(dl == k); my, mx = np.nonzero(dl == k)
    found.append(dict(box=(x0, y0, x1, y1), crest=(x0 + cx, y0 + cy, mx.max() - mx.min() + 1, my.max() - my.min() + 1), mask=(x0, y0, dl == k), cloth=(x0, y0, cloth)))
print(f'{len(found)} banners with a crest in {src}')
for f in found: print('  banner', f['box'], 'crest centre (%.0f,%.0f) size %dx%d' % f['crest'])

if opt('--debug'):
    d = img.copy(); dr = ImageDraw.Draw(d)
    for f in found:
        dr.rectangle(f['box'], outline=(0, 255, 0)); cx, cy, w, h = f['crest']; dr.rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), outline=(255, 255, 0))
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

out = a.copy()
for f in found:
    x0, y0, mask = f['mask']; cx0, cy0, cloth = f['cloth']; h, w = mask.shape
    wipe = ndi.binary_dilation(mask, iterations=2)
    for yy in range(h):
        if not wipe[yy].any(): continue
        row = cloth[yy] & ~wipe[yy]; cols = a[y0 + yy, x0:x0 + w][row] if row.any() else a[y0:y0 + h, x0:x0 + w][cloth & ~wipe]
        if len(cols) == 0: continue
        out[y0 + yy, x0:x0 + w][wipe[yy]] = np.median(cols, axis=0)
    cx, cy, cw, ch = f['crest']; size = max(8, int(round(max(cw, ch) * 1.05)))
    layer = mark(size, None); px, py = int(round(cx - size / 2)), int(round(cy - size / 2))
    base = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); base.paste(layer, (px, py), layer); out = np.asarray(base).astype(np.float32)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, quality=92)
print('wrote', dst)
