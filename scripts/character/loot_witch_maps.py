"""The Witch's own loot maps (Phase M, 2026-09-23). Her six pieces are BUILT ring-hull shells (scripts/build-warrior.mjs), not cuts from her
scan, so there is no surface to bake from: their UVs run u = around the ring, v = along the piece, and a TILE is what they want. This takes
one from her scan's own robe: a patch of the TRELLIS.2 albedo where the robe's vertical folds read as cloth, the skin/white chips of other
charts painted out, made seamless by blending in a half-offset copy toward the edges. The hood and the garter straps wear it (WitchCloth);
the bodice, bracers, leg wraps and boots wear the same weave tinted to the brown the atlas itself carries (WitchLeather: grades as leather).

  blender -b --python-exit-code 1 -P scripts/character/loot_witch_maps.py

Output: src/assets/source/loot/witch_{cloth,leather}_{color,orm}.jpg, picked up by name in build-warrior.mjs's loot export.
"""
import os

import bpy
import numpy as np

SOURCE = os.path.abspath('src/assets/source/creatures/witch.glb')
OUT = os.path.abspath('src/assets/source/loot')
# The patch, in image pixels from the TOP-LEFT of her 2048² albedo (x0, y0, x1, y1): the robe's vertical folds, few foreign chips.
PATCH = (300, 1240, 860, 1740)
COLOR_SIZE, ORM_SIZE, JPEG_QUALITY = 512, 256, 85

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SOURCE)
albedo = next(n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes
              if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name == 'sRGB')
w, h = albedo.size
atlas = np.array(albedo.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]   # Blender rows run bottom-up; flip to top-down
lum = atlas.mean(axis=2)

# Leather's tint: the atlas's own browns (red over green, darker than skin), not a picked colour.
brown = atlas[(atlas[..., 0] > atlas[..., 1] + .03) & (lum > .06) & (lum < .25)]
if len(brown) < 500:
    raise SystemExit(f'witch maps: only {len(brown)} brown texels in the atlas, no leather tint to measure')
tint = brown.mean(axis=0)


def box(a, r):
    """Mean over a (2r+1)² window, edges clamped, via a summed-area table."""
    p = np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2), mode='edge').cumsum(0).cumsum(1)
    n = 2 * r + 1
    return (p[n:, n:] - p[:-n, n:] - p[n:, :-n] + p[:-n, :-n]) / (n * n)


x0, y0, x1, y1 = PATCH
patch = atlas[y0:y1, x0:x1].copy()
# Chips from other charts (skin, the white specks): far from the local mean, or skin-coloured. Painted with the local mean.
pl, local = patch.mean(axis=2), box(patch, 12)
chip = (np.abs(pl - local.mean(axis=2)) > 2.5 * pl.std()) | ((patch[..., 0] > patch[..., 1] + .04) & (pl > .2))
chip = box(chip.astype(np.float32), 2) > .01   # and their antialiased rims (not 0: the summed-area table leaves float dust)
patch[chip] = local[chip]
print(f'witch maps: patch {x1 - x0}x{y1 - y0}, {chip.mean() * 100:.1f}% chips painted out, leather tint {np.round(tint, 3).tolist()}')


def resize(a, size):
    ys, xs = np.linspace(0, a.shape[0] - 1, size), np.linspace(0, a.shape[1] - 1, size)
    return np.stack([np.array([np.interp(xs, np.arange(a.shape[1]), row) for row in
                               np.array([np.interp(ys, np.arange(a.shape[0]), a[:, x, c]) for x in range(a.shape[1])]).T])
                     for c in range(3)], axis=2)


tile = resize(patch, COLOR_SIZE)
# Seamless: toward the edges, blend in the copy rolled by half a tile, whose own seam sits at the centre where the blend is 0.
d = np.abs(np.linspace(-1, 1, COLOR_SIZE))
t = np.clip((np.maximum(d[:, None], d[None, :]) - .55) / .4, 0, 1)
t = (t * t * (3 - 2 * t))[..., None]
tile = tile * (1 - t) + np.roll(tile, (COLOR_SIZE // 2, COLOR_SIZE // 2), axis=(0, 1)) * t
tl = tile.mean(axis=2, keepdims=True)
# Leather: the weave's light and dark around the measured tint, at 60% of the cloth's contrast (hide is smoother than a fold).
hide = np.clip(tint * (1 + .6 * (tl / tl.mean() - 1)), 0, 1)


def orm(colour, rough, spread):
    """R occlusion 1, G roughness (darker = rougher, by `spread`), B metal 0."""
    s = resize(colour, ORM_SIZE).mean(axis=2)
    g = np.clip(rough + spread * (s.mean() - s) / (s.std() + 1e-6) * .1, 0, 1)
    return np.stack([np.ones_like(g), g, np.zeros_like(g)], axis=2)


def save(a, name):
    img = bpy.data.images.new(name, a.shape[1], a.shape[0], alpha=False)
    img.colorspace_settings.name = 'sRGB' if name.endswith('_color.jpg') else 'Non-Color'
    img.pixels[:] = np.concatenate([a[::-1], np.ones(a.shape[:2] + (1,), np.float32)], axis=2).ravel()
    img.filepath_raw = os.path.join(OUT, name)
    img.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = JPEG_QUALITY
    img.save()
    print(f'MAP {name} {a.shape[1]}x{a.shape[0]} {os.path.getsize(img.filepath_raw)} B')


save(tile.astype(np.float32), 'witch_cloth_color.jpg')
save(orm(tile, .95, .3).astype(np.float32), 'witch_cloth_orm.jpg')
save(hide.astype(np.float32), 'witch_leather_color.jpg')
save(orm(hide, .72, 1).astype(np.float32), 'witch_leather_orm.jpg')
