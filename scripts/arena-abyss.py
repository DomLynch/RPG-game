"""Arena 1's abyss: an aerial view looking straight down from far above (Dom 2026-10-06; refs: hazy blue mountain ranges, a lake, puffy
clouds in front). Seeded and deterministic; numpy + PIL. Writes public/arena/abyss.webp: a square disc map (centre = straight below the
island, the rim fades into the haze colour the arena's horizon bowl is painted, ABYSS_HAZE in src/arena.ts).
Usage: python3 scripts/arena-abyss.py [out.webp] [size]"""
import sys
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/arena/abyss.webp'
N = int(sys.argv[2]) if len(sys.argv) > 2 else 420
HAZE = np.array([176, 194, 214], dtype=np.float32)   # keep equal to ABYSS_HAZE in src/arena.ts
rng = np.random.default_rng(1006)

def noise(period, octaves=5, gain=0.5, size=N, ridged=False, seed=0):
    r = np.random.default_rng(1006 + seed * 97 + period)
    out = np.zeros((size, size), np.float32); amp, norm = 1.0, 0.0
    for o in range(octaves):
        p = period * 2 ** o
        grid = r.random((p + 1, p + 1)).astype(np.float32)
        layer = np.asarray(Image.fromarray(grid).resize((size, size), Image.BICUBIC), np.float32)
        if ridged: layer = 1 - np.abs(layer * 2 - 1)
        out += amp * layer; norm += amp; amp *= gain
    return out / norm

yy, xx = np.mgrid[0:N, 0:N].astype(np.float32); cx = (N - 1) / 2
rad = np.hypot(xx - cx, yy - cx) / cx   # 0 centre .. 1 rim

# Terrain: ridged ranges on a broad warp, a lake basin, snow above the tree line.
warp = noise(3, 3, seed=1)
h = 0.7 * noise(4, 5, 0.45, ridged=True, seed=2) + 0.3 * noise(6, 3, 0.4, seed=3)
h = h * (0.6 + 0.8 * noise(2, 2, seed=4)) + 0.25 * (warp - 0.5)
h = (h - h.min()) / (h.max() - h.min())
sea = 0.43
lake = np.clip((sea - h) / 0.05, 0, 1)
# Hillshade from a low sun in the south-west.
gy, gx = np.gradient(h * 22.0)
shade = np.clip(0.62 + 1.5 * (-gx * 0.6 + gy * 0.8) / (1 + np.hypot(gx, gy)), 0.15, 1.35)
snow = np.clip((h - 0.56 - 0.1 * noise(16, 3, seed=5)) / 0.07, 0, 1) * np.clip(0.55 + 0.6 * (shade - 0.4), 0, 1)
forest = noise(30, 3, seed=6)
low = np.stack([62 + 22 * forest, 78 + 22 * forest, 66 + 14 * forest], -1)      # dark conifer green-grey valleys
high = np.stack([118 + 20 * h, 110 + 18 * h, 104 + 16 * h], -1)                  # bare grey-brown rock
t = np.clip((h - 0.42) / 0.3, 0, 1)[..., None]
col = (low * (1 - t) + high * t) * shade[..., None]
col = col * (1 - snow[..., None]) + np.array([232, 238, 246], np.float32) * (0.55 + 0.5 * shade[..., None]) * snow[..., None]
water = np.array([44, 78, 112], np.float32) * (0.8 + 0.4 * noise(40, 2, seed=7))[..., None]
col = col * (1 - lake[..., None]) + water * lake[..., None] + 14 * np.clip(1 - np.abs(h - sea) / 0.012, 0, 1)[..., None] * (1 - lake[..., None])  # pale shore

# Clouds drifting between: puffy tops, rose-grey bellies, their shadow dropped on the land.
c = noise(7, 6, 0.55, seed=8) + 0.25 * (noise(2, 2, seed=9) - 0.5)
cloud = np.clip((c - 0.6) / 0.12, 0, 1)
dx, dy = int(N * 0.03), int(N * 0.045)
sh = np.roll(np.roll(cloud, dy, 0), dx, 1)
col = col * (1 - 0.35 * sh[..., None])
lit = np.clip(0.8 + 1.6 * (np.roll(c, -3, 0) - c), 0.55, 1.15)
top = np.stack([250 * lit, 244 * lit, 240 * lit], -1); belly = np.array([170, 166, 182], np.float32)
body = belly + (top - belly) * np.clip((cloud * 1.5)[..., None], 0, 1)
col = col * (1 - cloud[..., None]) + body * cloud[..., None]

# Aerial perspective: blue haze thickening toward the rim (and a thin veil everywhere).
fog = np.clip(0.12 + 0.88 * np.clip((rad - 0.55) / 0.45, 0, 1) ** 1.6, 0, 1)[..., None]
col = col * (1 - fog) + HAZE * fog
Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(OUT, quality=82, method=6)
print('wrote', OUT, N)
