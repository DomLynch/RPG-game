"""Arena 2's painted far world: Dom's own painting (2026-10-06, 'the skull gate'), cropped to the band above his drawn arena floor and graded
into the strip format of public/arena/backdrop-1.webp (420 x 535, mirrored round the ring by arena.ts). The head fades into Arena 1's sky
(SKY_TOP), the foot into its foot colour (FOOT), as backdrop-1's edges are painted, so the dome and the abyss meet the picture without a seam.
Usage: python3 scripts/arena-backdrop-2.py dom-arena2-backdrop-portrait.webp public/arena/backdrop-2.webp"""
import sys
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
SKY_TOP = np.array([154, 116, 81], np.float32)  # Arena 1's sky colour at the head of backdrop-1.webp (Arena 2 wears Arena 1's light)
FOOT = np.array([90, 64, 46], np.float32)       # and the mean of backdrop-1's foot row
im = Image.open(SRC).convert('RGB'); w, h = im.size
# Portrait source: castle and sky above the skull gate, stands and statues, then the front wall at y ~0.47-0.57 h and his floor below. Keep above the wall's grates.
x0, x1, y1 = int(w * 0.13), int(w * 0.87), int(h * 0.52)
crop = im.crop((x0, 0, x1, y1)).resize((420, 535), Image.LANCZOS)
a = np.asarray(crop, np.float32)
rows = np.linspace(0, 1, 535, dtype=np.float32)[:, None, None]
top = np.clip(1 - rows / 0.10, 0, 1) ** 1.5      # head: first 10 %
foot = np.clip((rows - 0.88) / 0.12, 0, 1) ** 1.2  # foot: last 12 %
a = a * (1 - 0.85 * top) + SKY_TOP * 0.85 * top
a = a * (1 - foot) + FOOT * foot
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT, quality=82, method=6)
print('wrote', OUT)
