#!/usr/bin/env python3
# Tiles goblin-ladder-sheet.sh's captures into artifacts/looks/goblin/sheet/goblin-ladder-{front,back,foe}.png (one row of ten each).
import glob, os
from PIL import Image, ImageDraw
RANKS = "L1-sewer-imp L2-kobold L3-nain-rouge L4-andvari L5-alberich L6-rumpelstiltskin L7-puck L8-anansi L9-hermes L10-loki".split()
OUT = 'artifacts/looks/goblin/sheet'
def cell(r, side):   # the roster sheet: title band 60 px, cells 420x720 at x 0 (front) / 440 (back)
    im = Image.open(f'{OUT}/roster-{r}/Recruit.png').convert('RGB'); x = 0 if side == 'front' else 440
    return im.crop((x + 20, 60, x + 440, 780))
def foe(r):
    fs = sorted(glob.glob(f'artifacts/herolook/ladder-{r}/today/*.png')); im = Image.open(fs[min(5, len(fs) - 1)]).convert('RGB')
    return im.resize((375, round(im.height * 375 / im.width)))
for name, fn, w, h in (('front', lambda r: cell(r, 'front'), 420, 720), ('back', lambda r: cell(r, 'back'), 420, 720), ('foe', foe, 375, 812)):
    sheet = Image.new('RGB', (len(RANKS) * (w + 6), h + 26), 'black'); d = ImageDraw.Draw(sheet)
    for i, r in enumerate(RANKS):
        try: im = fn(r)
        except Exception as e: print(name, r, 'missing', e); continue
        if im.size != (w, h): im = im.resize((w, h))
        sheet.paste(im, (i * (w + 6), 26)); d.text((i * (w + 6) + 4, 6), f'Goblin {r}', fill='white')
    sheet.save(f'{OUT}/goblin-ladder-{name}.png'); print(name, sheet.size)
