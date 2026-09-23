"""Floor blood textures, made to MULTIPLY onto the sand (owner 2026-09-23: the death pool read "cartoon-ish").

Writes src/assets/blood/floor-pool.png and floor-splash.png: RGB = the blood's colour, A = how much of it there is.
The material draws dst * lerp(1, rgb, a), so the sand grain always shows through: a dark near-black core, thin
desaturated translucent edges, an irregular silhouette (noise on the radius + fBm), and a halo of fine spatter.
Deterministic (fixed seeds). Run: ~/.venvs/face/bin/python scripts/blood/floor-textures.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = 'src/assets/blood/'
CORE, MID, EDGE = np.array([0.24, 0.015, 0.025]), np.array([0.62, 0.03, 0.05]), np.array([0.86, 0.40, 0.40])   # multipliers: near-black core → wet crimson → a thin stain


def fbm(size, rng, octaves=5):
    out, amp = np.zeros((size, size)), 1.0
    for o in range(octaves):
        n = 4 * 2 ** o
        grid = rng.random((n + 1, n + 1))
        out += amp * np.array(Image.fromarray((grid * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)) / 255
        amp *= 0.5
    return out / out.max()


def texture(size, seed, lobes, body, spatter):
    rng = np.random.default_rng(seed)
    y, x = (np.mgrid[0:size, 0:size] - size / 2) / (size / 2)
    r, a = np.hypot(x, y), np.arctan2(y, x)
    # Irregular silhouette: a few lobes of different reach, then fBm on the edge.
    reach = body * (1 + sum(rng.uniform(.03, .1) * np.cos(k * a + rng.uniform(0, 6.3)) for k in lobes))
    blob = (r < reach * (0.55 + 0.7 * fbm(size, rng, 6))).astype(float)   # the noise, not the lobes, draws the edge: never a star
    blob = ndimage.binary_opening(blob > 0, iterations=2)
    # Tendrils: blood runs off the pool in a few fingers of different length (the reference photos), not a round edge.
    yy, xx = np.mgrid[0:size, 0:size] / (size / 2) - 1
    for _ in range(rng.integers(3, 6)):
        ang, length, width = rng.uniform(0, 2 * np.pi), body * rng.uniform(.35, .9), body * rng.uniform(.08, .2)
        along, across = xx * np.cos(ang) + yy * np.sin(ang) - body * .6, -xx * np.sin(ang) + yy * np.cos(ang)
        blob = np.maximum(blob, ((along / length) ** 2 + (across / (width * (1 - np.clip(along / length, 0, 1) * .6))) ** 2 < 1) * (0.5 + fbm(size, rng, 4) > .8))
    lab, n = ndimage.label(blob); sizes = ndimage.sum(blob, lab, range(1, n + 1))
    blob = ndimage.binary_fill_holes(np.isin(lab, 1 + np.where(sizes >= sizes.max() * .02)[0])).astype(float)   # the pool plus its bigger satellites
    # Spatter halo: many small drops, denser near the pool, a few stretched along their flight.
    halo = np.zeros((size, size))
    throw = rng.uniform(0, 2 * np.pi)   # the spatter flew one way: most of it lies on one side
    for _ in range(spatter):
        ang, dist = throw + rng.vonmises(0, 1.2), body * (1 + rng.exponential(.3))
        cx, cy = size / 2 + np.cos(ang) * dist * size / 2, size / 2 + np.sin(ang) * dist * size / 2
        rad = size * rng.uniform(.0015, .007) * max(.35, 1.5 - dist)
        stretch = rng.uniform(1, 2.8)
        dx, dy = (np.mgrid[0:size, 0:size][1] - cx), (np.mgrid[0:size, 0:size][0] - cy)
        along, across = dx * np.cos(ang) + dy * np.sin(ang), -dx * np.sin(ang) + dy * np.cos(ang)
        halo = np.maximum(halo, ((along / (rad * stretch)) ** 2 + (across / rad) ** 2 < 1) * rng.uniform(.55, 1))
    # Depth: dark where the blood is thick (far from the edge), thin and translucent at the rim.
    depth = ndimage.distance_transform_edt(blob) / (size * body * .16)
    depth = np.clip(depth, 0, 1) ** .6
    depth = ndimage.gaussian_filter(depth, size / 256) * (0.85 + 0.15 * fbm(size, rng, 4))
    alpha = np.clip(ndimage.gaussian_filter(blob, size / 1000) * (0.4 + 0.6 * depth), 0, 1)
    alpha = np.maximum(alpha, ndimage.gaussian_filter(halo, size / 700) * 0.8)
    t = np.clip(depth, 0, 1)[..., None]
    rgb = np.where(t < .5, EDGE * (1 - 2 * t) + MID * 2 * t, MID * (2 - 2 * t) + CORE * (2 * t - 1))
    rgb = np.where(halo[..., None] > alpha[..., None] * 0.9, MID * .8, rgb)   # spatter: small wet crimson drops
    img = np.dstack([np.clip(rgb, 0, 1), alpha])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


texture(512, 190923, (2, 3, 5, 7), .6, 260).save(OUT + 'floor-pool.png', optimize=True)
texture(256, 230919, (2, 3, 4, 6), .34, 120).save(OUT + 'floor-splash.png', optimize=True)
print('wrote', OUT + 'floor-pool.png', OUT + 'floor-splash.png')
