# Ink pass for a texture atlas (Inkverse look): greyscale, soft tone steps (no hard posterise), painted line pass, red kept only where already red.
#   python3 ink.py <in> <out.png|webp> [--steps 9] [--line 0.55]
import sys
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
arg = lambda n, d: float(sys.argv[sys.argv.index(n) + 1]) if n in sys.argv else d
STEPS, LINE = arg('--steps', 9), arg('--line', 0.55)

im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32) / 255.0
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b

def blur(x, rad):
    return np.asarray(Image.fromarray((x * 255).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) / 255.0

# red tags: strongly red pixels (kept as red ink), everything else goes grey
mx, mn = a.max(-1), a.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-4)
ratio = r / (np.maximum(g, b) + 0.03)           # skin sits near 1.2-1.5, blood and red cloth 3 and up
red = np.clip((ratio - 2.4) / 1.6, 0, 1) * np.clip((sat - 0.45) / 0.2, 0, 1)
red = blur(red, 0.8)

# tone: contrast curve, then SOFT steps (blend of a quantised and the continuous tone, so detail survives)
base = blur(lum, 0.7)
lo, hi = np.percentile(base, 1), np.percentile(base, 99)
t = np.clip((base - lo) / max(hi - lo, 1e-4), 0, 1)
t = np.power(t, 1.35)                          # darker mids: ink holds the shadows
t = 0.55 * t + 0.45 * (t * t * (3 - 2 * t))    # half S-curve: contrast without blowing skin to paper
q = np.round(t * (STEPS - 1)) / (STEPS - 1)
tone = 0.2 * q + 0.8 * t
tone = 0.14 + 0.58 * tone                      # an ALBEDO, not a picture: the look's ink material does the light, the hatching and the grain on top, so mid greys (0.14-0.72)

# line pass: difference of gaussians on the luminance finds the painted edges, kept soft
dog = blur(lum, 0.8) - blur(lum, 2.4)
edge = np.clip((-dog - 0.012) / 0.05, 0, 1)    # dark side of an edge only: reads as a brush line
tone = tone * (1 - LINE * edge)

# paper grain keeps flat areas painted, not digital (low, fixed seed so the file is repeatable)
rng = np.random.default_rng(7)
grain = blur(rng.normal(0, 1, tone.shape).astype(np.float32) * 0.5 + 0.5, 0.6) - 0.5
tone = np.clip(tone + grain * 0.015, 0, 1)

grey = np.stack([tone * 0.99, tone, tone * 0.97], -1)          # a hair warm
inkred = np.stack([0.15 + 0.62 * tone, 0.03 + 0.05 * tone, 0.04 + 0.05 * tone], -1)
out = grey * (1 - red[..., None]) + inkred * red[..., None]
res = Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))
res.save(dst, quality=90) if dst.endswith('.webp') else res.save(dst)
print(dst, res.size, 'red share %.4f' % float(red.mean()))
