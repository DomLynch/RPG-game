# Physical-ish old-blood decals for the Pit walls: ballistic droplets (size falls and elongation grows with range), irregular dried edges
# (dark rim, thin translucent middle), gravity runs with a bead at the end, finger-streak drags, a cracked dried pool. Output RGBA PNG per event.
import sys, math
import numpy as np
from scipy import ndimage as ndi
from PIL import Image

PPM = 300

def noise(rng, h, w, cell, octaves=3):
    out = np.zeros((h, w)); amp = 1.0; tot = 0
    for o in range(octaves):
        c = max(2, cell // (2 ** o))
        g = rng.random((h // c + 3, w // c + 3))
        z = ndi.zoom(g, c, order=3)[:h, :w]
        out += z * amp; tot += amp; amp *= 0.5
    return out / tot

class Wall:
    def __init__(self, w, h, seed):
        self.w, self.h = w, h
        self.rng = np.random.default_rng(seed)
        self.T = np.zeros((h, w))
    def blob(self, cx, cy, r, e=1.0, ang=0.0, k=1.0, tail=0.0):
        rng = self.rng
        R = int(r * max(e, 1) * 1.6 + 6 + tail)
        x0, x1, y0, y1 = int(cx - R), int(cx + R + 1), int(cy - R), int(cy + R + 1)
        if x1 < 0 or y1 < 0 or x0 >= self.w or y0 >= self.h: return
        xs, ys = np.meshgrid(np.arange(x0, x1) - cx, np.arange(y0, y1) - cy)
        c, s = math.cos(ang), math.sin(ang)
        u = (xs * c + ys * s) / max(e, 1e-3); v = -xs * s + ys * c
        d = np.hypot(u, v); phi = np.arctan2(v, u)
        edge = np.ones_like(d)
        for kk in range(2, 9):
            edge += rng.normal(0, 0.22 / kk ** 0.7) * np.cos(kk * phi + rng.random() * 6.28)
        body = np.clip((edge * r - d) / max(1.0, r * 0.35), 0, 1)
        t = body
        if tail > 0:   # a thin tapered streak behind the drop (it landed moving), the far end thinning out
            along = -u / max(tail, 1); wide = np.abs(v) / max(r * 0.35, 0.6)
            t = np.maximum(t, np.clip(1 - along, 0, 1) * (along > 0) * np.clip(1 - wide, 0, 1) * 0.8)
        ax0, ay0 = max(x0, 0), max(y0, 0); ax1, ay1 = min(x1, self.w), min(y1, self.h)
        self.T[ay0:ay1, ax0:ax1] += k * t[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0]
    def film(self, cx, cy, r, k):
        rng = self.rng
        ys, xs = np.mgrid[0:self.h, 0:self.w]
        d = np.hypot(xs - cx, ys - cy) / r
        n = noise(rng, self.h, self.w, 14, 3)
        self.T += np.clip((1.0 - d + (n - 0.5) * 0.9) * 1.4, 0, 1) * k
    def run(self, x, y, length, width, k=0.8):
        rng = self.rng; wob = rng.normal(0, 0.25); x0 = x; yy = float(y)
        n = int(length); phase = rng.random() * 6.28; amp = rng.uniform(0.5, 2.0)
        stalls = sorted(rng.random(rng.integers(0, 3)) * n)
        for i in range(n):
            f = i / max(n, 1)
            w = width * (1.0 - 0.45 * f) * (0.85 + 0.3 * math.sin(i * 0.15 + phase))
            xx = x0 + math.sin(i * 0.05 + phase) * amp + wob * f * 6
            thick = k * (1 - 0.55 * f)
            if any(abs(i - s) < 2 for s in stalls): thick *= 0.3
            self.blob(xx, yy + i, max(w, 0.7), 1.0, 0.0, thick * 0.35)
        self.blob(x0 + math.sin(n * 0.05 + phase) * amp + wob * 6, yy + n, max(width * 0.75, 1.0), 1.15, math.pi / 2, k * 0.9)
    def finish(self, tint=(1.0, 1.0, 1.0)):
        T = self.T
        T = np.clip(T, 0, 3)
        thin = np.array([128, 52, 38]); thick = np.array([44, 8, 6])
        rim = np.clip(ndi.gaussian_filter(T, 1.2) - ndi.gaussian_filter(T, 7), 0, None)
        depth = np.clip(T * 0.8 + rim * 1.4, 0, 1.4)
        mott = 0.88 + 0.24 * noise(self.rng, self.h, self.w, 9, 3)
        mix = np.clip(depth / 1.2, 0, 1)[..., None]
        rgb = (thin * (1 - mix) + thick * mix) * mott[..., None]
        a = np.clip(1 - np.exp(-2.0 * T), 0, 0.95)
        a = a * (0.9 + 0.1 * noise(self.rng, self.h, self.w, 5, 2))
        img = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
        return Image.fromarray(img, 'RGBA')

def spray(seed, W=int(2.2 * PPM), H=int(1.7 * PPM)):
    g = Wall(W, H, seed); rng = g.rng
    cx, cy = 0.30 * W, 0.66 * H; main = -0.35   # impact; flung up and to the right
    g.blob(cx, cy, 28, 1.5, main, 1.5, tail=30)
    g.film(cx, cy, 55, 0.5)
    for _ in range(5): g.blob(cx + rng.normal(0, 16), cy + rng.normal(0, 12), rng.uniform(7, 14), rng.uniform(1.0, 1.8), main + rng.normal(0, 0.5), 1.0)
    # arterial spurts: bursts of drops along a rising arc, each cluster thinner and farther
    for i in range(7):
        t = (i + 1) / 8; arcx = cx + t * 0.62 * W; arcy = cy - math.sin(t * 2.2) * 0.38 * H + t * t * 0.1 * H
        for _ in range(int(rng.integers(10, 24) * (1 - 0.55 * t))):
            ang = main + rng.normal(0, 0.55); rho = abs(rng.normal(0, 26 * (1 + t)))
            r = max(1.2, 11 * (1 - 0.6 * t) * rng.lognormal(0, 0.45) * math.exp(-rho / 60))
            g.blob(arcx + math.cos(ang) * rho, arcy + math.sin(ang) * rho, r, 1 + 1.4 * t * rng.random() + 0.2, ang + rng.normal(0, 0.15), 1.0, tail=r * 2 * t)
    for _ in range(90):   # the fine mist round the heart
        rho = rng.exponential(0.2 * W); ang = main + rng.normal(0, 0.9)
        g.blob(cx + math.cos(ang) * rho, cy + math.sin(ang) * rho, rng.uniform(0.8, 2.6), 1.0, 0, 0.9)
    # a few runs from the biggest drops (the heart's heavy blobs)
    for _ in range(4):
        g.run(cx + rng.normal(0, 22), cy + 6, rng.uniform(25, 85), rng.uniform(2.2, 3.6))
    return g.finish()

def smear(seed, W=int(2.3 * PPM), H=int(0.85 * PPM)):
    g = Wall(W, H, seed); rng = g.rng
    p0 = np.array([0.08 * W, 0.62 * H]); p1 = np.array([0.55 * W, 0.40 * H]); p2 = np.array([0.93 * W, 0.50 * H])
    g.blob(p0[0], p0[1], 24, 1.3, -0.2, 1.3)   # where the hand landed
    for _ in range(6): g.blob(p0[0] + rng.normal(0, 22), p0[1] + rng.normal(0, 18), rng.uniform(3, 9), 1.4, rng.normal(-0.2, 0.4), 0.9)
    for f in range(4):   # four fingers' lines, each dries out at its own length
        off = (f - 1.5) * 16 + rng.normal(0, 6); life = rng.uniform(0.6, 1.0); wid = rng.uniform(5.5, 8.5); ph = rng.random() * 6
        n = 420
        for i in range(n):
            t = i / n
            if t > life: break
            pt = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2
            tg = 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1); tg = tg / np.hypot(*tg); nrm = np.array([-tg[1], tg[0]])
            pos = pt + nrm * (off + math.sin(t * 9 + ph) * 1.5)
            fade = (1 - t / life) ** 0.7 * (0.35 + 0.65 * max(0, noise_val(rng, i + f * 91) * 1.6))
            g.blob(pos[0], pos[1], wid * (0.6 + 0.5 * fade), 1.0, 0, 0.5 * fade)
    for _ in range(14):
        t = rng.random(); pt = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2
        g.blob(pt[0] + rng.normal(0, 25), pt[1] + rng.normal(0, 22), rng.uniform(0.8, 2.6), 1.0, 0, 0.9)
    return g.finish()
_nz = {}
def noise_val(rng, i):
    return 0.5 + 0.5 * math.sin(i * 0.37 + 1.3) * math.sin(i * 0.11)

def splash(seed, W=int(1.1 * PPM), H=int(1.9 * PPM)):
    g = Wall(W, H, seed); rng = g.rng
    cx, cy = 0.5 * W, 0.2 * H
    g.film(cx, cy, 55, 0.45)
    g.blob(cx, cy, 30, 1.1, rng.random() * 3, 1.6)
    for _ in range(9): g.blob(cx + rng.normal(0, 22), cy + rng.normal(0, 20), rng.uniform(6, 15), rng.uniform(1.0, 1.4), rng.random() * 6.28, 1.1)
    for _ in range(70):   # a radial burst, longer tails the farther it flew
        ang = rng.random() * 6.28; rho = rng.exponential(48) + 18
        r = max(0.9, 7 * math.exp(-rho / 55) * rng.lognormal(0, 0.4))
        g.blob(cx + math.cos(ang) * rho, cy + math.sin(ang) * rho * 0.9, r * 1.3, 1 + rho / 140, ang, 1.0, tail=r * 1.2 + rho * 0.04)
    for _ in range(7):   # runs: one long, the rest stopping short
        g.run(cx + rng.normal(0, 24), cy + 14 + rng.uniform(0, 14), rng.choice([rng.uniform(40, 110), rng.uniform(120, 300)]), rng.uniform(2.4, 4.4), 0.9)
    return g.finish()

def pool(seed, W=int(2.1 * PPM), H=int(0.75 * PPM)):
    g = Wall(W, H, seed); rng = g.rng
    ys, xs = np.mgrid[0:H, 0:W]
    low = noise(rng, H, W, 40, 3); hi = noise(rng, H, W, 12, 3)
    prof = np.clip((ys / H) * 1.1 - 0.12 + (low - 0.5) * 0.9, 0, 1)   # more blood the nearer the floor, ragged top edge
    across = np.clip(1.2 - np.abs(xs / W - 0.45 - (low - 0.5) * 0.3) * 2.6, 0, 1)
    field = np.clip((prof * across - 0.18) * 3.2 + (hi - 0.5) * 0.35, 0, 1)
    ridge = np.abs(noise(rng, H, W, 22, 2) - 0.5)   # dried cracks: thin dark-to-clear lines through the thick middle
    crack = (ridge < 0.012).astype(float) * (field > 0.5)
    g.T += field * 1.4 * (1 - 0.3 * ndi.gaussian_filter(crack, 1.2))
    for _ in range(40):   # drops that jumped from the pool
        x = rng.uniform(0.1, 0.9) * W; y = H * (1 - abs(rng.normal(0, 0.28)))
        g.blob(x, min(y, H - 3), rng.uniform(1.2, 4.2), 1 + rng.random(), 0, 1.0)
    return g.finish()

def puddle(seed, W=int(1.3 * PPM), H=int(1.0 * PPM)):
    g = Wall(W, H, seed); rng = g.rng
    ys, xs = np.mgrid[0:H, 0:W]
    low = noise(rng, H, W, 36, 3); hi = noise(rng, H, W, 10, 3)
    d = np.hypot((xs - W * 0.45) / (W * 0.30), (ys - H * 0.5) / (H * 0.24))   # a pool lying along the sand, longer than wide
    field = np.clip((1.0 - d + (low - 0.5) * 0.9) * 3.0 + (hi - 0.5) * 0.3, 0, 1)
    ridge = np.abs(noise(rng, H, W, 20, 2) - 0.5)
    crack = (ridge < 0.012).astype(float) * (field > 0.5)
    g.T += field * 1.3 * (1 - 0.3 * ndi.gaussian_filter(crack, 1.2))
    g.blob(W * 0.78, H * 0.52, 14, 2.4, 0.1, 1.0, tail=60)   # where it was dragged off
    for _ in range(46):
        ang = rng.normal(0.0, 1.3); rho = abs(rng.normal(0, 0.28 * W)) + 0.2 * W
        g.blob(W * 0.45 + math.cos(ang) * rho, H * 0.5 + math.sin(ang) * rho * 0.7, rng.uniform(1.0, 4.0), 1 + rng.random() * 0.8, ang, 1.0)
    return g.finish()

if __name__ == '__main__':
    out = sys.argv[1]
    for name, fn, seed in (('spray', spray, 11), ('smear', smear, 23), ('splash', splash, 37), ('pool', pool, 51), ('puddle', puddle, 67)):
        im = fn(seed); im.save(f'{out}/{name}.png'); im.save(f'{out}/{name}.webp', quality=88, alpha_quality=90, method=6); print(name, im.size)
