#!/usr/bin/env python3
# Tiles goblin-ladder-sheet.sh's captures into artifacts/looks/goblin/sheet/goblin-ladder-{front,back,foe}.png (one row of ten each).
import glob, os
from PIL import Image, ImageDraw
OPP = os.environ.get('OPP', 'goblin')   # OPP=veteran RANKS="L1 L2 …" (2026-09-27); a rank listed in EXTRA=<rank>=<png> is pasted from that file
RANKS = os.environ.get('RANKS', "L1-sewer-imp L2-kobold L3-nain-rouge L4-andvari L5-alberich L6-rumpelstiltskin L7-puck L8-anansi L9-hermes L10-loki").split()
OUT = f'artifacts/looks/{OPP}/sheet'
def cell(r, side):   # the roster sheet: title band 60 px, cells 420x720 at x 0 (front) / 440 (back)
    im = Image.open(f'{OUT}/roster-{r}/Recruit.png').convert('RGB'); x = 0 if side == 'front' else 440
    return im.crop((x + 20, 60, x + 440, 780))
def foe(r):
    fs = sorted(glob.glob(f'artifacts/herolook/ladder-{"" if OPP == "goblin" else OPP + "-"}{r}/today/*.png')); im = Image.open(fs[min(5, len(fs) - 1)]).convert('RGB')
    return im.resize((375, round(im.height * 375 / im.width)))
for name, fn, w, h in (('front', lambda r: cell(r, 'front'), 420, 720), ('back', lambda r: cell(r, 'back'), 420, 720), ('foe', foe, 375, 812)):
    sheet = Image.new('RGB', (len(RANKS) * (w + 6), h + 26), 'black'); d = ImageDraw.Draw(sheet)
    for i, r in enumerate(RANKS):
        try: im = fn(r)
        except Exception as e: print(name, r, 'missing', e); continue
        if im.size != (w, h): im = im.resize((w, h))
        sheet.paste(im, (i * (w + 6), 26)); d.text((i * (w + 6) + 4, 6), f'{OPP.capitalize()} {r}' + (' = Centurion bronze proof (static Sand Legionary not rigged)' if OPP == 'veteran' and r == 'L6' else ''), fill='white')
    sheet.save(f'{OUT}/{OPP}-ladder-{name}.png'); print(name, sheet.size)
