#!/usr/bin/env python3
"""Hero Look pilot strip (docs/state/herolook.md): two (or more) same-frame renders side by side in the mood board's own format, at 375 wide
for Dom's phone and at 1280 for a closer look, each panel labelled. Panels are the transparent 800x1400 (or supersampled) renders from
scripts/herolook-stills.mjs, laid over the Profile tab's own dark ground so the pair reads the way the tab does.

    ~/.venvs/face/bin/python scripts/herolook-strip.py --out artifacts/herolook/interim/strip \
        --panel artifacts/herolook/interim/today.png "Today: Centurion kit" --panel artifacts/herolook/interim/kit-closeup.png "Close-up budget" \
        [--title "Profile tab"] [--crop 0.06,0.02,0.94,0.98]
Writes <out>-375.png and <out>-1280.png.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("--panel", nargs=2, action="append", metavar=("PNG", "LABEL"), required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--title", default="")
ap.add_argument("--crop", default="0.10,0.00,0.90,1.00", help="fractional left,top,right,bottom crop of each render (the frame has spare margin)")
ap.add_argument("--bg", default="#1a1714")
a = ap.parse_args()
cl, ct, cr, cb = (float(x) for x in a.crop.split(","))


def font(px):
    for f in ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        try:
            return ImageFont.truetype(f, px)
        except OSError:
            continue
    return ImageFont.load_default()


def strip(width):
    n = len(a.panel)
    gap = max(2, width // 150)
    pad = gap
    pw = (width - pad * 2 - gap * (n - 1)) // n
    panels = []
    for png, label in a.panel:
        im = Image.open(png).convert("RGBA")
        w, h = im.size
        im = im.crop((int(w * cl), int(h * ct), int(w * cr), int(h * cb)))
        ph = round(pw * im.height / im.width)
        panels.append((im.resize((pw, ph), Image.LANCZOS), label))
    ph = max(p.height for p, _ in panels)
    lab = max(14, width // 26)
    title_h = (lab + gap * 2) if a.title else 0
    out = Image.new("RGBA", (width, pad + title_h + ph + lab + gap * 3 + pad), a.bg)
    d = ImageDraw.Draw(out)
    f = font(lab)
    ft = font(lab)
    if a.title:
        d.text((width // 2, pad + gap), a.title, fill="#d9cfbf", font=ft, anchor="ma")
    x = pad
    for p, label in panels:
        cell = Image.new("RGBA", (pw, ph), "#2a2521")
        cell.alpha_composite(p, (0, ph - p.height))
        out.alpha_composite(cell, (x, pad + title_h))
        d.text((x + pw // 2, pad + title_h + ph + gap), label, fill="#e8dfd0", font=f, anchor="ma")
        x += pw + gap
    out.convert("RGB").save(f"{a.out}-{width}.png", optimize=True)
    print(f"{a.out}-{width}.png {out.width}x{out.height}")


for w in (375, 1280):
    strip(w)
