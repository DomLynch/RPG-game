"""Before/after sheet for one weapon (weapons lane, Phase 2 polish).

    ~/.venvs/face/bin/python artifacts/weapons/tools/before-after.py <id> <before-label> <after-label> "<before caption>" "<after caption>"

Left: the part alone, old and new, rendered by weapon-render.py under identical lighting (/tmp/<id>-old-*.png, /tmp/<id>-new-*.png).
Right: the harness's in-game frames (guard, weapon in hand, thrust) from artifacts/weapons/<label>/weapon-on-rig.png.
Writes artifacts/weapons/<after-label>/before-after.png.
"""
import sys

from PIL import Image, ImageDraw, ImageFont

weapon, before, after, cap_before, cap_after = sys.argv[1:6]
W = "artifacts/weapons"
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 30)


def crop(sheet, col, row):
    return Image.open(sheet).crop((col * 480, row * 480, (col + 1) * 480, (row + 1) * 480))


def row(canvas, y, label, parts, game):
    ImageDraw.Draw(canvas).text((20, y - 42), label, fill=(240, 240, 240), font=font)
    x = 20
    for p in parts:
        canvas.paste(p, (x, y))
        x += 350
    for g in game:
        canvas.paste(g, (x, y + 110))
        x += 480


out = Image.new("RGB", (2 * 350 + 3 * 480 + 50, 60 + 700 + 70 + 700 + 30), (28, 30, 34))
for y, label, tag, sheet in [(60, cap_before, "old", before), (60 + 700 + 70, cap_after, "new", after)]:
    parts = [Image.open(f"/tmp/{weapon}-{tag}-{view}.png").resize((350, 700)) for view in ["face", "threeq"]]
    game = [crop(f"{W}/{sheet}/weapon-on-rig.png", c, r) for c, r in [(3, 1), (0, 0), (0, 2)]]  # guard, weapon in hand, thrust contact
    row(out, y, label, parts, game)
out.save(f"{W}/{after}/before-after.png")
print(f"{W}/{after}/before-after.png {out.size}")
