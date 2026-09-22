#!/usr/bin/env python3
"""sil -- reference image -> black silhouette, measured, and a comparison sheet.

Segmentation is a u2net subject matte, not a threshold. A threshold cannot do
this job on these references and three separate attempts proved it:

  * the backdrop is a RADIAL vignette, so a left->right per-row estimate sags
    in the middle and flags lit backdrop as figure;
  * a grey closing wide enough to erase the figure over-reaches across that
    same gradient and flags the dark side of the backdrop as figure;
  * polished plate MIRRORS the backdrop, so the breastplate lands at the
    backdrop's own luminance -- the same failure Pitborn hit on the
    Shieldmaiden's shield face, and no threshold separates them.

Flooding the background in from the border (Pitborn's fix for hollow figures)
makes the plate case worse, not better: the gap between an arm and the hip is
an ENCLOSED hole, so the flood fills it and the Knight loses exactly the
articulated outline the test exists to judge. The matte has none of these
problems, and it leaves the floor shadow out as well.
"""
import argparse
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw
from rembg import new_session, remove
from scipy import ndimage
from scipy.spatial import ConvexHull

HEAD_BAND = 0.08     # top fraction of the figure taken as head/helm width
SHOULDER_RATIO = 1.8  # the shoulder line is where width first reaches this x head
SHOULDER_DEPTH = 0.12  # rows below that line still counted as the pauldron region
_SESSION = None


def silhouette(path):
    global _SESSION
    if _SESSION is None:
        _SESSION = new_session("u2net")
    im = Image.open(path).convert("RGB")
    mask = np.asarray(remove(im, session=_SESSION, only_mask=True,
                             post_process_mask=True)) > 127
    lab, n = ndimage.label(mask)
    if n > 1:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        mask = lab == (int(np.argmax(sizes)) + 1)
    return mask


def measure(fig):
    ys = np.nonzero(fig)[0]
    y0, y1 = ys.min(), ys.max()
    height = y1 - y0 + 1
    widths = []
    for y in range(y0, y1 + 1):
        r = np.nonzero(fig[y])[0]
        widths.append(0 if r.size == 0 else r.max() - r.min() + 1)
    widths = np.array(widths)
    # A fixed band just reports the band's own edge, so find the shoulder
    # line instead: scanning down from the crown, it is the first row whose
    # width reaches SHOULDER_RATIO x the head/helm width.
    head = float(np.median(widths[:max(1, int(height * HEAD_BAND))]))
    hit = np.nonzero(widths >= head * SHOULDER_RATIO)[0]
    srow = int(hit[0]) if hit.size else int(np.argmax(widths))
    # Take the widest row in the pauldron region below that line, so the
    # number is shoulder breadth and not elbows, hands, or a grounded weapon.
    send = min(len(widths), srow + int(height * SHOULDER_DEPTH))
    shoulder = int(widths[srow:send].max())

    # Outline hardness: solidity is the figure's area over its convex hull's.
    # An articulated plate outline -- open gaps at the arms, a straight skirt
    # hem, squared pauldrons -- leaves more of the hull empty than a soft mass
    # of hood and falling cloth does.
    pts = np.column_stack(np.nonzero(fig))
    solidity = float(fig.sum()) / ConvexHull(pts).volume
    return {
        "height_px": int(height),
        "head_px": round(head),
        "shoulder_px": shoulder,
        "shoulder_over_height": round(shoulder / height, 3),
        "shoulder_row_frac": round(srow / height, 3),
        "max_width_over_height": round(float(widths.max()) / height, 3),
        "max_width_row_frac": round(float(np.argmax(widths)) / height, 3),
        "solidity": round(solidity, 3),
    }


def crop(fig):
    ys, xs = np.nonzero(fig)
    return fig[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def render(fig, out, pad=8):
    sub = crop(fig)
    h, w = sub.shape
    canvas = np.full((h + 2 * pad, w + 2 * pad), 255, np.uint8)
    canvas[pad:pad + h, pad:pad + w] = np.where(sub, 0, 255)
    Image.fromarray(canvas, "L").save(out)


def sheet(figs, out, height=900, gap=40, label_h=46):
    """Every figure on one baseline, scaled to a common height."""
    tiles = []
    for name, fig in figs:
        sub = crop(fig)
        w = max(1, int(sub.shape[1] * height / sub.shape[0]))
        tile = Image.fromarray(np.where(sub, 0, 255).astype(np.uint8), "L")
        tiles.append((name, tile.resize((w, height), Image.LANCZOS)))
    total = sum(t.size[0] for _, t in tiles) + gap * (len(tiles) + 1)
    canvas = Image.new("L", (total, height + gap + label_h), 255)
    draw = ImageDraw.Draw(canvas)
    x = gap
    for name, tile in tiles:
        canvas.paste(tile, (x, gap // 2))
        draw.text((x, height + gap // 2 + 8), name.upper(), fill=0)
        x += tile.size[0] + gap
    canvas.save(out)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("images", nargs="+", help="reference images, left to right")
    ap.add_argument("--out", default="artifacts/silhouette",
                    help="output directory (artifacts/ is untracked, AGENTS.md)")
    args = ap.parse_args(argv)
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    rows, figs = {}, []
    for path in args.images:
        name = pathlib.Path(path).stem
        fig = silhouette(path)
        rows[name] = measure(fig)
        render(fig, out / f"sil-{name}.png")
        figs.append((name, fig))
    sheet(figs, out / "sheet.png")
    (out / "measures.json").write_text(json.dumps(rows, indent=2) + "\n")
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
