"""Realistic head for the universal humanoid (imported by parts.py, `--body realistic` only).

The Blender Studio body is UDIM: the head owns texture tile 1001, torso and limbs tiles 1002-1004. This module keeps that
split — the head gets its own `Face` material and maps (2K authored, 1K shipped), the body tiles pack into one `Skin`
atlas — and then does what a painted-on face cannot: sculpted wrinkles and pores displaced into the high mesh and baked
to the normal map, photographed skin micro-detail (Lee Perry-Smith head scan, CC BY 3.0, as tiling detail only — not his
face), and hair, brow and lash cards as real geometry over a shaved scalp cap."""
import math
import os

import __main__ as P  # parts.py, the running Blender script: its image and noise helpers
import bpy
import numpy as np
from mathutils import Vector

LPS = 'artifacts/source/lps'
QUADRANT = {1: (0.0, 0.5), 2: (0.5, 0.5), 3: (0.0, 0.0)}  # body tiles 1002-1004 → atlas quadrants; (0.5, 0) stays white


# --- UDIM handling ---------------------------------------------------------------------------------------------------

def tile_of(uv_layer, poly):
    return int(uv_layer[poly.loop_indices[0]].uv[0] // 1)


def split_tiles(obj):
    """Material slot 0 (`Face`) for tile 1001 polygons, slot 1 (`Skin`) for the rest with their UVs packed into a 2×2
    atlas; a `face` vertex group marks the head for displacement."""
    me = obj.data
    for name in ('Face', 'Skin'):
        me.materials.append(bpy.data.materials.new(f'{name}_slot'))
    uv = me.uv_layers.active.data
    group = obj.vertex_groups.new(name='face')
    for p in me.polygons:
        t = tile_of(uv, p)
        if t == 0:
            p.material_index = 0
            group.add(list(p.vertices), 1.0, 'REPLACE')
        else:
            p.material_index = 1
            qx, qy = QUADRANT[min(t, 3)]
            for li in p.loop_indices:
                u, v = uv[li].uv
                uv[li].uv = ((u - t) * 0.5 + qx, v * 0.5 + qy)


def face_group(obj):
    """The same `face` vertex group on an object that keeps its UDIM UVs (the high-resolution sculpt copy)."""
    uv = obj.data.uv_layers.active.data
    group = obj.vertex_groups.new(name='face')
    for p in obj.data.polygons:
        if tile_of(uv, p) == 0:
            group.add(list(p.vertices), 1.0, 'REPLACE')


def separate_head(body, select_only):
    """Split the baked body into a head object (`Face`) and the rest (`Skin`); both keep weights, UVs and modifiers."""
    select_only([body])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    pieces = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    head = max(pieces, key=lambda o: sum(v.co.z for v in o.data.vertices) / len(o.data.vertices))
    rest = next(o for o in pieces if o is not head)
    return head, rest


# --- baking ------------------------------------------------------------------------------------------------------------

def bake_tiles(obj, kind, sizes, select_only, float_buffer=False, high=None, cage=0.02, samples=1, margin=16, ao_distance=0.35):
    """Bake `kind` once, every material slot of `obj` into its own image: the way to bake a UDIM body to per-tile maps.
    Returns float arrays (rows = v from the bottom, RGBA) in slot order."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.render.bake.margin = margin
    scene.render.bake.use_selected_to_active = high is not None
    if high is not None:
        scene.render.bake.cage_extrusion = cage
        scene.render.bake.normal_space = 'TANGENT'
    if kind == 'AO':
        scene.world = scene.world or bpy.data.worlds.new('bake')
        scene.world.light_settings.distance = ao_distance
    previous = list(obj.data.materials)
    images = []
    for i, size in enumerate(sizes):
        img = bpy.data.images.new(f'{obj.name}_{kind}{i}', size, size, float_buffer=float_buffer)
        mat = bpy.data.materials.new(f'{obj.name}_{kind}bake{i}')
        mat.use_nodes = True
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = img
        mat.node_tree.nodes.active = node
        obj.data.materials[i] = mat
        images.append(img)
    if high is not None:
        high.hide_render = high.hide_viewport = False
        select_only([obj, high])
    else:
        select_only([obj])
    bpy.ops.object.bake(type=kind, use_clear=True)
    scene.render.bake.use_selected_to_active = False
    if high is not None:
        high.hide_render = True
    for i, m in enumerate(previous):
        obj.data.materials[i] = m
    out = []
    for img, size in zip(images, sizes):
        px = np.empty(size * size * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        out.append(px.reshape(size, size, 4))
    return out


# --- 2D helpers ----------------------------------------------------------------------------------------------------------

def blur(a, factor):
    """Box blur by block averaging and bilinear upsampling (cheap, separable enough for detail extraction)."""
    h = a.shape[0]
    small = P.downsample(a[..., None] if a.ndim == 2 else a, factor)
    if a.ndim == 2:
        return P.upsample(small[..., 0], h)
    return np.stack([P.upsample(small[..., c], h) for c in range(a.shape[2])], axis=2)


def mirror_tile(patch, size):
    """A patch made seamless by mirroring, then repeated to size×size."""
    m = np.concatenate([patch, patch[::-1]], axis=0)
    m = np.concatenate([m, m[:, ::-1]], axis=1)
    reps = math.ceil(size / m.shape[0])
    big = np.tile(m, (reps, reps) + ((1,) if m.ndim == 3 else ()))
    return big[:size, :size]


def groove(xz, points, radius, depth):
    """Height along a polyline in the face plane (x across, z up): a gaussian trough (depth<0) or ridge (>0)."""
    d2 = np.full(xz.shape[:2], np.inf, np.float32)
    for a, b in zip(points[:-1], points[1:]):
        a, b = np.array(a, np.float32), np.array(b, np.float32)
        ab = b - a
        t = np.clip(((xz - a) @ ab) / (float(ab @ ab) + 1e-9), 0, 1)
        proj = a + t[..., None] * ab
        d2 = np.minimum(d2, ((xz - proj) ** 2).sum(axis=2))
    return depth * np.exp(-d2 / (2 * radius * radius))


def arc(x0, x1, z, bow, n=9):
    """Points of a shallow arc from x0 to x1 at height z, bowing by `bow` in the middle."""
    return [(x0 + (x1 - x0) * k / (n - 1), z + bow * math.sin(math.pi * k / (n - 1))) for k in range(n)]


def ellipse(pos, centre, radii, softness=0.35):
    d = np.sqrt((((pos - np.array(centre)[None, None, :]) / np.array(radii)[None, None, :]) ** 2).sum(axis=2))
    return np.clip((1 + softness - d) / softness, 0, 1)


# --- photographed detail -------------------------------------------------------------------------------------------------

def scan_detail(size):
    """Tiling micro-detail from the Lee Perry-Smith scan: a forehead patch of colour (high-passed, 1K source) and of the
    4K displacement (high-passed), mirrored seamless and repeated. Only the pore/mottle structure survives the high-pass;
    nothing of the face's identity does."""
    colour = P.load_pixels(f'{LPS}/Map-COL.jpg', 'sRGB')            # 1024², rows from the bottom
    disp = P.load_pixels(f'{LPS}/Infinite-Level_02_Disp_NoSmoothUV-4096.jpg', 'Non-Color')[..., 0]  # 4096²
    def region(img, u0, v0, side):  # a square window, side in that image's pixels, from the forehead (no hair, no beard)
        h, w = img.shape[:2]
        r, c = int(v0 * h), int(u0 * w)
        return img[r:r + side, c:c + side]
    cpatch = region(colour, 0.43, 0.80, 128)
    cpatch = cpatch - blur(cpatch, 8) + 0.5
    dpatch = region(disp, 0.43, 0.80, 512)
    dpatch = dpatch - blur(dpatch, 16)
    dpatch = dpatch / (np.abs(dpatch).max() + 1e-6)
    return mirror_tile(cpatch, size), mirror_tile(dpatch, size)


# --- painting by landmark -----------------------------------------------------------------------------------------------

def landmarks(F, pos):
    ex, ey, ez = F['eye_l'].x, F['eye_l'].y, F['eye_l'].z
    n, m, c = F['nose'], F['mouth'], F['chin']
    front = np.clip((n.y + 0.09 - pos[..., 1]) / 0.03, 0, 1)  # face-facing texels only
    xz = pos[..., [0, 2]]
    return ex, ey, ez, n, m, c, front, xz


def height_map(pos, mask, F, detail, size):
    """Sculpt in a texture: wrinkles, folds and ridges keyed to the landmarks, pores from the scan. 0.5 = no change."""
    ex, ey, ez, n, m, c, front, xz = landmarks(F, pos)
    h = np.zeros(pos.shape[:2], np.float32)
    # Forehead: three faint lines, bowed with the brow.
    for k, dz in enumerate((0.052, 0.063, 0.074)):
        h += groove(xz, arc(-0.036, 0.036, ez + dz, 0.004), 0.0013, -0.09 * (1 - 0.15 * k))
    # Glabella: the frown creases between the brows — the set expression.
    for sx in (1, -1):
        h += groove(xz, [(sx * 0.0055, ez + 0.017), (sx * 0.0045, ez + 0.030), (sx * 0.006, ez + 0.040)], 0.0015, -0.22)
    # Brow ridge: a broad bulge above each eye that the cards sit on.
    for sx in (1, -1):
        h += groove(xz, [(sx * 0.012, ez + 0.022), (sx * 0.03, ez + 0.032), (sx * 0.052, ez + 0.024)], 0.007, 0.14)
        # Lid fold and under-eye crease.
        h += groove(xz, arc(sx * (ex - 0.014), sx * (ex + 0.016), ez + 0.011, 0.003), 0.0012, -0.10)
        h += groove(xz, arc(sx * (ex - 0.012), sx * (ex + 0.016), ez - 0.013, -0.002), 0.0016, -0.08)
        # Crow's feet from the outer corner.
        for angle in (-24, -4, 18):
            a = math.radians(angle)
            x0, z0 = sx * (ex + 0.021), ez + 0.001
            h += groove(xz, [(x0, z0), (x0 + sx * 0.017 * math.cos(a), z0 + 0.017 * math.sin(a))], 0.0009, -0.10)
        # Nasolabial fold: nostril wing to beside the mouth corner, broad and deep.
        h += groove(xz, [(sx * 0.017, n.z - 0.004), (sx * 0.026, n.z - 0.02), (sx * 0.031, m.z - 0.010)], 0.0038, -0.22)
        # Nostril crease.
        h += groove(xz, [(sx * 0.010, n.z - 0.008), (sx * 0.016, n.z - 0.001)], 0.0015, -0.16)
        # Philtrum ridges.
        h += groove(xz, [(sx * 0.005, m.z + 0.009), (sx * 0.0045, n.z - 0.013)], 0.0014, 0.08)
    # Lips: fine vertical creases across the mouth; the mouth line itself.
    for k in range(-7, 8):
        x = m.x + k * 0.0036 + (0.0008 if k % 2 else 0)
        h += groove(xz, [(x, m.z - 0.007), (x + 0.0005, m.z + 0.007)], 0.00045, -0.07)
    h += groove(xz, arc(m.x - 0.026, m.x + 0.026, m.z, -0.001), 0.0009, -0.22)
    # Chin: mentolabial fold and a dimple.
    h += groove(xz, arc(-0.016, 0.016, m.z - 0.017, -0.003), 0.003, -0.11)
    h += groove(xz, [(0, c.z + 0.012), (0, c.z + 0.013)], 0.004, -0.07)
    h *= front
    # Pores from the scan, everywhere on the face, less on the lips and scalp; stubble bumps in the beard.
    beard = beard_mask(pos, F, size)
    lips = ellipse(pos, (m.x, m.y, m.z), (0.027, 0.014, 0.011), 0.4)
    h += detail * 0.14 * (1 - lips * 0.7) * (1 - scalp_mask(pos, F) * 0.6)
    grain = np.repeat(np.repeat((np.random.default_rng(62).random((size // 2, size // 2)) < 0.30).astype(np.float32), 2, 0), 2, 1)
    h += beard * grain * 0.05  # the same dots as the colour: each stubble hair is a bump
    return np.clip(0.5 + h, 0, 1)


def beard_mask(pos, F, size):
    ex, ey, ez, n, m, c, front, xz = landmarks(F, pos)
    jaw = np.clip((m.z - 0.010 - pos[..., 2]) / 0.02, 0, 1) * np.clip((pos[..., 2] - (c.z - 0.05)) / 0.025, 0, 1)
    cheek = np.clip((pos[..., 2] - (c.z - 0.05)) / 0.02, 0, 1) * np.clip((abs(pos[..., 0]) - 0.03) / 0.015, 0, 1) * np.clip((n.z - 0.01 - pos[..., 2]) / 0.02, 0, 1)
    lip = ellipse(pos, (m.x, m.y - 0.002, m.z + 0.019), (0.031, 0.015, 0.009), 0.4)
    mouth = ellipse(pos, (m.x, m.y, m.z), (0.028, 0.014, 0.010), 0.3)
    return np.clip(np.maximum(np.maximum(jaw, cheek * 0.8), lip * 0.9) * (1 - mouth), 0, 1) * front


def scalp_mask(pos, F):
    ey, ez = F['eye_l'].y, F['eye_l'].z
    hairline = ez + 0.076 - np.clip(pos[..., 1] - ey + 0.02, 0, None) * 0.55
    scalp = np.clip((pos[..., 2] - hairline) / 0.02, 0, 1)
    scalp = np.maximum(scalp, np.clip((pos[..., 1] - (ey + 0.075)) / 0.02, 0, 1) * np.clip((pos[..., 2] - (ez + 0.005)) / 0.02, 0, 1))
    return scalp * np.clip((pos[..., 2] - (ez - 0.02)) / 0.02, 0, 1)


def face_colour(pos, mask, F, ao, detail, size):
    """The face's colour: olive Mediterranean base, sub-dermal zones (blood in the nose, cheeks and ears; blue-grey
    beard shadow; warmer forehead), photographed micro-mottle, an old scar, arena dust, a shaved scalp under the cards.
    Brows and lashes are geometry now, so they leave only their shadow here."""
    fbm = P.fbm
    ex, ey, ez, n, m, c, front, xz = landmarks(F, pos)
    base = np.array([0.60, 0.44, 0.31])[None, None, :]
    tone = fbm(size, 41, octaves=(4, 8, 16, 32))[..., None]
    colour = base * (0.92 + tone * 0.18)
    colour[..., 1] *= 1 + (tone[..., 0] - 0.5) * 0.06
    colour[..., 0] *= 1 + (fbm(size, 42, octaves=(8, 16)) - 0.5) * 0.10
    colour = colour * (0.55 + 0.45 * np.clip(ao, 0, 1) ** 1.2)[..., None]
    colour = colour * (1 + (detail - 0.5) * 3.0)  # scan mottle and pores, centred on 1
    # Zones.
    forehead = np.clip((pos[..., 2] - (ez + 0.035)) / 0.02, 0, 1) * front
    colour *= 1 + forehead[..., None] * np.array([0.03, 0.02, -0.04])[None, None, :]
    flush = ellipse(pos, (n.x, n.y, n.z), (0.02, 0.02, 0.025), 0.8)
    for sx in (1, -1):
        flush = np.maximum(flush, ellipse(pos, (sx * (ex + 0.015), ey + 0.02, ez - 0.045), (0.035, 0.03, 0.03), 0.9) * 0.6)
        flush = np.maximum(flush, ellipse(pos, (sx * F['ear_x'], ey + 0.07, ez), (0.02, 0.03, 0.035), 0.8) * 0.8)
    colour[..., 0] *= 1 + flush * 0.12
    colour[..., 1] *= 1 - flush * 0.03
    colour[..., 2] *= 1 - flush * 0.10
    for sx in (1, -1):
        socket = ellipse(pos, (sx * ex, ey + 0.004, ez + 0.006), (0.03, 0.022, 0.02), 0.6)
        colour *= (1 - socket[..., None] * np.array([0.08, 0.14, 0.18])[None, None, :] * front[..., None])
        brow = ellipse(pos, (sx * 0.031, ey - 0.006, ez + 0.027), (0.024, 0.02, 0.005), 0.6) * front
        colour *= (1 - brow * 0.22)[..., None]  # the shadow under the brow cards
        lash = ellipse(pos, (sx * ex, ey - 0.012, ez + 0.011), (0.017, 0.012, 0.0014), 0.5)
        colour *= 1 - (lash * 0.6 * front)[..., None]
    ears = np.maximum(ellipse(pos, (F['ear_x'], ey + 0.07, ez), (0.025, 0.035, 0.04), 0.6), ellipse(pos, (-F['ear_x'], ey + 0.07, ez), (0.025, 0.035, 0.04), 0.6))
    colour *= (1 - ears * 0.10)[..., None]
    # Lips: a man's — barely rosier than the skin, a defined border, darker at the mouth line.
    lips = ellipse(pos, (m.x, m.y, m.z), (0.027, 0.014, 0.011), 0.4)
    inner = ellipse(pos, (m.x, m.y, m.z), (0.0245, 0.013, 0.0095), 0.4)
    lip_colour = np.array([0.50, 0.27, 0.23])[None, None, :]
    colour = colour * (1 - (lips * 0.30 * front)[..., None]) + lip_colour * (lips * 0.30 * front)[..., None]
    colour *= (1 - (lips - inner) * 0.18 * front)[..., None]
    colour *= (1 - groove(xz, arc(m.x - 0.025, m.x + 0.025, m.z, -0.001), 0.0009, 0.45) * front)[..., None]
    # Beard shadow with stubble grain; a cool cast.
    beard = beard_mask(pos, F, size)
    grain = np.repeat(np.repeat((np.random.default_rng(62).random((size // 2, size // 2)) < 0.30).astype(np.float32), 2, 0), 2, 1)
    colour *= (1 - beard * (0.14 + grain * 0.42))[..., None]
    colour *= 1 - (beard * 0.08)[..., None] * np.array([0.3, 0.05, -0.4])[None, None, :]
    # Moles and a healed scar across the left brow.
    rng = np.random.default_rng(67)
    for _ in range(4):
        px, pz = rng.uniform(-0.05, 0.05), rng.uniform(c.z + 0.02, ez + 0.06)
        colour *= (1 - ellipse(pos, (px, ey, pz), (0.0012, 0.02, 0.0012), 0.6) * 0.45 * front)[..., None]
    for k in range(60):
        t = k / 60
        sc = ellipse(pos, (ex + 0.02 - t * 0.03, ey - 0.03 + t * 0.012, ez + 0.045 - t * 0.075), (0.0028, 0.01, 0.0028), 0.8)
        colour = colour * (1 - sc[..., None] * 0.35) + np.array([0.62, 0.42, 0.34])[None, None, :] * (sc * 0.35)[..., None]
    # Sweat-dirt at the temples, faint.
    streak = fbm(size, 65, octaves=(16, 256))
    temples = np.maximum(ellipse(pos, (ex + 0.045, ey + 0.03, ez + 0.02), (0.012, 0.02, 0.045), 0.9), ellipse(pos, (-(ex + 0.045), ey + 0.03, ez + 0.02), (0.012, 0.02, 0.045), 0.9))
    colour *= (1 - temples * np.clip((streak - 0.58) * 6, 0, 1) * 0.08 * front)[..., None]
    # Shaved scalp under the hair cards, feathered hairline.
    scalp = scalp_mask(pos, F)
    dense = (np.random.default_rng(64).random((size, size)) < 0.75).astype(np.float32)
    colour *= (1 - scalp * (0.50 + dense * 0.22))[..., None]
    colour *= 1 - (scalp * 0.1)[..., None] * np.array([0, 0.3, 0.6])[None, None, :]
    # Arena dust, light.
    dust = np.clip((fbm(size, 1, octaves=(4, 8, 16, 64)) - 0.45) * 2.4, 0, 1)[..., None]
    colour = colour * (1 - dust * 0.22) + np.array([0.30, 0.28, 0.25])[None, None, :] * dust * 0.22
    return np.clip(colour, 0, 1)


def face_roughness(pos, F, detail, size):
    """Skin is matte: 0.6 with pore breakup; tighter on the oily T-zone and lips, coarser through the beard and scalp."""
    ex, ey, ez, n, m, c, front, xz = landmarks(F, pos)
    rough = 0.62 + (detail[..., 0] - 0.5) * 0.35
    tzone = np.maximum(ellipse(pos, (0, ey - 0.02, ez + 0.055), (0.03, 0.03, 0.028), 0.9), ellipse(pos, (n.x, n.y, n.z + 0.01), (0.013, 0.02, 0.03), 0.9)) * front
    rough -= tzone * 0.10
    rough -= ellipse(pos, (m.x, m.y, m.z), (0.027, 0.014, 0.011), 0.4) * front * 0.10
    rough += beard_mask(pos, F, size) * 0.10 + scalp_mask(pos, F) * 0.14
    for sx in (1, -1):
        rough -= ellipse(pos, (sx * ex, ey - 0.008, ez + 0.006), (0.02, 0.015, 0.012), 0.5) * front * 0.06  # lids
    return np.clip(rough, 0.3, 0.95)


def body_colour(pos, mask, ao, detail, size):
    """Body tiles: the same skin, dustier, with the scan mottle at half strength."""
    fbm = P.fbm
    base = np.array([0.60, 0.44, 0.31])[None, None, :]
    tone = fbm(size, 41, octaves=(4, 8, 16, 32))[..., None]
    colour = base * (0.92 + tone * 0.18)
    colour[..., 1] *= 1 + (tone[..., 0] - 0.5) * 0.06
    colour[..., 0] *= 1 + (fbm(size, 42, octaves=(8, 16)) - 0.5) * 0.10
    colour = colour * (0.55 + 0.45 * np.clip(ao, 0, 1) ** 1.2)[..., None]
    colour = colour * (1 + (detail - 0.5) * 2.0)
    dust = np.clip((fbm(size, 1, octaves=(4, 8, 16, 64)) - 0.45) * 2.4, 0, 1)[..., None]
    colour = colour * (1 - dust * 0.22) + np.array([0.30, 0.28, 0.25])[None, None, :] * dust * 0.22
    return np.clip(colour, 0, 1)


# --- displacement ------------------------------------------------------------------------------------------------------

def displace_high(high, height, select_only, strength=0.003, extra_levels=2):
    """Subdivide the sculpt copy and push the face height map into it along the normals, face vertices only."""
    mod = next(m for m in high.modifiers if m.type == 'MULTIRES')
    select_only([high])
    for _ in range(extra_levels):
        bpy.ops.object.multires_subdivide(modifier=mod.name, mode='CATMULL_CLARK')
    mod.levels = mod.render_levels = mod.sculpt_levels = mod.total_levels
    size = height.shape[0]
    img = bpy.data.images.new('face_height', size, size, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    px = np.concatenate([np.repeat(height[..., None], 3, axis=2), np.ones((size, size, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(px.ravel())
    tex = bpy.data.textures.new('face_height', 'IMAGE')
    tex.image = img
    tex.extension = 'REPEAT'
    disp = high.modifiers.new('Sculpt', 'DISPLACE')
    disp.texture = tex
    disp.texture_coords = 'UV'
    disp.uv_layer = high.data.uv_layers.active.name
    disp.direction = 'NORMAL'
    disp.mid_level = 0.5
    disp.strength = strength
    disp.vertex_group = 'face'


def clean_normal(n):
    """Texels where the bake rays hit the inside of a socket or the mouth come back as wild slopes; ease them flat."""
    tilt = np.sqrt((n[..., 0] - 0.5) ** 2 + (n[..., 1] - 0.5) ** 2)
    keep = np.clip((0.42 - tilt) / 0.12, 0, 1)[..., None]
    flat = np.array([0.5, 0.5, 1.0])[None, None, :]
    return n * keep + flat * (1 - keep)


# --- cards -------------------------------------------------------------------------------------------------------------

def card_texture(size=512):
    """One RGBA strand sheet, eight 64-px columns: 0-3 hair clumps, 4-5 brow hairs, 6-7 a lash fan (root at the left)."""
    rng = np.random.default_rng(70)
    rgba = np.zeros((size, size, 4), np.float32)
    col_w = size // 8
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    dark = np.array([0.26, 0.18, 0.12])  # sRGB values as written: dark brown, not the black a linear 0.07 becomes
    def strand(x0, x1, y0, y1, width, tint, alpha=1.0, taper=True):
        # a straight tapered line from (x0,y0) root to (x1,y1) tip in pixel space
        ax, ay, bx, by = x0, y0, x1, y1
        abx, aby = bx - ax, by - ay
        t = np.clip(((xx - ax) * abx + (yy - ay) * aby) / (abx * abx + aby * aby + 1e-6), 0, 1)
        d = np.sqrt((xx - (ax + t * abx)) ** 2 + (yy - (ay + t * aby)) ** 2)
        w = width * ((1 - 0.75 * t) if taper else 1)
        a = np.clip((w - d) / 0.8, 0, 1) * alpha
        light = 0.85 + 0.35 * t  # lighter toward the tip
        for ch in range(3):
            rgba[..., ch] = rgba[..., ch] * (1 - a) + tint[ch] * light * a
        rgba[..., 3] = np.maximum(rgba[..., 3], a)
    for col in range(4):  # hair: a loose clump, root at the bottom (v=0), tip at the top; open enough that mips cut it
        x_base = col * col_w
        for _ in range(15):
            x0 = x_base + rng.uniform(6, col_w - 6)
            x1 = x0 + rng.uniform(-10, 10)
            y1 = rng.uniform(size * 0.5, size * 0.98)
            strand(x0, x1, rng.uniform(0, size * 0.06), y1, rng.uniform(1.4, 2.4), dark * rng.uniform(0.7, 1.9) * np.array([1.0, rng.uniform(0.9, 1.0), rng.uniform(0.8, 1.0)]))
    for col in (4, 5):  # brows: small cards, so the column must stay dense enough to survive mip averaging
        x_base = col * col_w
        for _ in range(24):
            x0 = x_base + rng.uniform(4, col_w - 4)
            strand(x0, x0 + rng.uniform(-6, 6), rng.uniform(0, size * 0.1), rng.uniform(size * 0.6, size * 0.95), rng.uniform(2.4, 3.2), dark * rng.uniform(0.9, 1.4))
    for col in (6, 7):  # lashes: root at the column's left edge, fanning right, repeated down the column
        x_base = col * col_w
        for k in range(90):
            y0 = k * size / 90 + rng.uniform(-2, 2)
            strand(x_base + 1, x_base + col_w * rng.uniform(0.45, 0.95), y0, y0 + rng.uniform(-8, 8), rng.uniform(2.6, 3.6), dark * 0.7, taper=False)
    # Colour under the transparent texels is the hair colour too, so filtering never drags black into the strand edges.
    empty = rgba[..., 3] < 0.02
    rgba[empty, :3] = dark
    return rgba


def save_png_rgba(path, rgba):
    h, w = rgba.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.colorspace_settings.name = 'sRGB'
    img.alpha_mode = 'STRAIGHT'
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.file_format = 'PNG'
    img.save(filepath=path)
    return path


class CardMesh:
    """Accumulates card quads (rows of vertex pairs) into one mesh with normals and UVs."""
    def __init__(self):
        self.verts, self.normals, self.uvs, self.faces = [], [], [], []

    def add(self, rows, normal, column):
        """rows: list of (left, right) Vector pairs from root to tip; column: 0-7 of the strand sheet."""
        base = len(self.verts)
        n = len(rows)
        u0, u1 = column / 8, (column + 1) / 8
        for i, (left, right) in enumerate(rows):
            v = i / (n - 1)
            self.verts += [left, right]
            self.normals += [normal, normal]
            self.uvs += [(u0, v), (u1, v)]
        for i in range(n - 1):
            a = base + 2 * i
            self.faces.append((a, a + 1, a + 3, a + 2))

    def add_strip(self, rows, normals, u_root, u_tip, v_repeat):
        """A strip along an arc: rows are (root, tip) pairs; u runs root→tip, v along the arc."""
        base = len(self.verts)
        n = len(rows)
        for i, ((root, tip), nrm) in enumerate(zip(rows, normals)):
            v = v_repeat * i / (n - 1)
            self.verts += [root, tip]
            self.normals += [nrm, nrm]
            self.uvs += [(u_root, v), (u_tip, v)]
        for i in range(n - 1):
            a = base + 2 * i
            self.faces.append((a, a + 1, a + 3, a + 2))

    def build(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        me.update()
        uv = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                uv.data[li].uv = self.uvs[me.loops[li].vertex_index]
        me.normals_split_custom_set_from_vertices([tuple(n) for n in self.normals])
        obj = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(obj)
        return obj


def surface_frame(head, point, direction):
    """Nearest point on the head surface, its normal, and `direction` flattened onto the tangent plane."""
    ok, loc, nrm, _ = head.closest_point_on_mesh(point)
    if not ok:
        return point, Vector((0, -1, 0)), direction
    d = direction - nrm * direction.dot(nrm)
    return loc.copy(), nrm.normalized(), d.normalized() if d.length > 1e-6 else Vector((0, -1, 0))


def card_rows(root, normal, direction, length, width, lifts, tapers):
    side = normal.cross(direction).normalized()
    rows = []
    n = len(lifts)
    for k in range(n):
        t = k / (n - 1)
        centre = root + direction * (length * t) + normal * lifts[k]
        rows.append((centre - side * (width * tapers[k] / 2), centre + side * (width * tapers[k] / 2)))
    return rows


def hair_cards(head, F, rng_seed=71):
    """A short crop that fades at the sides: cards on the scalp, growing from a crown whorl, standing up on top and
    lying flat toward the ears. The painted scalp cap underneath carries the shaved look between cards."""
    ey, ez = F['eye_l'].y, F['eye_l'].z
    crown_z = max(v.co.z for v in head.data.vertices)
    whorl = Vector((0.0, ey + 0.055, crown_z - 0.005))
    rng = np.random.default_rng(rng_seed)
    mesh = CardMesh()
    count = 0
    for poly in head.data.polygons:
        c = poly.center
        p = np.array([[[c.x, c.y, c.z]]], np.float32)
        s = float(scalp_mask(p, F)[0, 0])
        if s < 0.8:  # cards stay inside the painted cap; the feathered hairline is paint, not strokes on the forehead
            continue
        height = np.clip((c.z - (ez + 0.025)) / 0.10, 0, 1)  # 0 at the temples, 1 at the crown
        density = 2.4 + 3.2 * height  # cards per polygon on top; sparser down the fade
        n_cards = int(density) + (1 if rng.random() < density - int(density) else 0)
        for _ in range(n_cards):
            jitter = Vector((rng.normal(0, 0.003), rng.normal(0, 0.003), rng.normal(0, 0.003)))
            root, nrm, d = surface_frame(head, c + jitter, (c - whorl))
            # in front of the whorl the crop lies forward; behind, it runs down the back
            lean = math.radians(rng.normal(0, 14))
            side = nrm.cross(d).normalized()
            d = (d * math.cos(lean) + side * math.sin(lean)).normalized()
            length = 0.006 + 0.014 * height ** 0.8
            width = 0.008 + 0.005 * height
            lifts = [0.0004, 0.0025 + 0.002 * height, 0.0035 + 0.003 * height, 0.003 + 0.0025 * height]
            rows = card_rows(root, nrm, d, length, width, lifts, [1.0, 1.0, 0.9, 0.6])
            mesh.add(rows, nrm, int(rng.integers(0, 4)))
            count += 1
    print(f'HAIR cards={count}')
    return mesh.build('hair_cards')


def brow_cards(head, F, rng_seed=72):
    """Two rows of single-hair cards along each brow ridge: heavy and upward at the nose, sweeping outward and down
    toward the temple."""
    ey, ez = F['eye_l'].y, F['eye_l'].z
    rng = np.random.default_rng(rng_seed)
    mesh = CardMesh()
    count = 0
    for sx in (1, -1):
        for row, dz in ((0, 0.0009), (1, -0.0012)):
            for k in range(36):
                t = (k + rng.uniform(0.1, 0.9)) / 36
                x = sx * (0.011 + 0.043 * t)
                z = ez + 0.021 + 0.013 * math.sin(math.pi * t ** 0.85) + dz
                hit, loc, nrm, _ = head.ray_cast(Vector((x, ey - 0.12, z)), Vector((0, 1, 0)))
                if not hit:
                    continue
                up = Vector((sx * 0.35, 0, 1)) if t < 0.3 else (Vector((sx * 1, 0, 0.35)) if t < 0.72 else Vector((sx * 1, 0, -0.45)))
                _, nrm, d = surface_frame(head, loc, up)
                length = 0.0090 - 0.0035 * t
                width = 0.0030
                rows = card_rows(loc, nrm, d, length, width, [0.0005, 0.0010, 0.0014, 0.0016], [1.0, 1.0, 0.9, 0.7])
                mesh.add(rows, nrm, 4 + int(rng.integers(0, 2)))
                count += 1
    print(f'BROW cards={count}')
    return mesh.build('brow_cards')


def lash_cards(head, F, eye_radius):
    """An upper-lash strip per eye along the lid margin, fanning forward and up."""
    ex, ey, ez = F['eye_l'].x, F['eye_l'].y, F['eye_l'].z
    mesh = CardMesh()
    for sx in (1, -1):
        centre = Vector((sx * ex, ey, ez))
        rows, normals = [], []
        for k in range(13):
            a = math.radians(20 + 140 * k / 12)  # from the outer corner over the top to the inner corner
            u = math.cos(a) * sx
            # lid margin: on the eyeball's upper front, then the lashes fan forward-up
            root = centre + Vector((u * eye_radius * 0.92, -eye_radius * 0.72 * math.sin(a) ** 0.5 - 0.001, eye_radius * 0.42 * math.sin(a) + 0.001))
            direction = Vector((u * 0.3, -0.8, 0.85)).normalized()
            tip = root + direction * (0.0085 * (0.55 + 0.45 * math.sin(a)))
            rows.append((root, tip))
            normals.append(Vector((u * 0.3, -1, 0.3)).normalized())
        mesh.add_strip(rows, normals, 0.75, 1.0, 3.0)
    return mesh.build('lash_cards')


# --- orchestration ----------------------------------------------------------------------------------------------------

def build(body, high, F, armature, select_only, save_two_sizes, save_jpeg, materials_out, tag):
    """Everything realistic-head, in order: AO and position per tile, height map → displaced sculpt → normal bake,
    colour and roughness per tile, head split, cards. Returns maps for the manifest and the parts to export."""
    size = 2048
    ao_face, ao_body = bake_tiles(body, 'AO', [1024, 1024], select_only, samples=32, margin=8)
    ao_face, ao_body = np.clip(ao_face[..., 0], 0, 1), np.clip(ao_body[..., 0], 0, 1)
    ao_body[ao_body < 0.02] = 1.0  # the empty atlas quadrant reads white (the AO_WHITE texel lives there)
    pos_face, pos_body = bake_tiles(body, 'POSITION', [size, size], select_only, float_buffer=True)
    pos_face, mask_face = pos_face[..., :3], pos_face[..., 3] > 0.5
    pos_body, mask_body = pos_body[..., :3], pos_body[..., 3] > 0.5
    detail_colour, detail_height = scan_detail(size)
    height = height_map(pos_face, mask_face, F, detail_height, size)
    displace_high(high, height, select_only)
    nrm_face, nrm_body = [clean_normal(n[..., :3]) for n in bake_tiles(body, 'NORMAL', [size, size], select_only, high=high, samples=8, margin=8)]
    colour_face = face_colour(pos_face, mask_face, F, P.upsample(ao_face, size), detail_colour, size)
    colour_body = body_colour(pos_body, mask_body, P.upsample(ao_body, size), detail_colour, size)
    rough_face = face_roughness(pos_face[::2, ::2], F, detail_colour[::2, ::2], size // 2)
    rough_body = np.clip(0.66 + (detail_colour[::2, ::2, 0] - 0.5) * 0.3, 0.4, 0.95)
    def orm(rough):
        return np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    maps = {
        'Face': {'baseColor': save_two_sizes('face_color', colour_face, 'sRGB'), 'normal': save_two_sizes('face_normal', nrm_face, 'Non-Color'),
                 'metallicRoughness': save_jpeg('face_orm', orm(rough_face), 'Non-Color')},
        'Skin': {'baseColor': save_two_sizes('skin_color', colour_body, 'sRGB'), 'normal': save_two_sizes('skin_normal', P.pore_normal(nrm_body, strength=0.3), 'Non-Color'),
                 'metallicRoughness': save_jpeg('skin_orm', orm(rough_body), 'Non-Color')},
        'HairCards': {'baseColor': save_png_rgba(os.path.join(materials_out, 'hair_cards.png'), card_texture())},
    }
    head, rest = separate_head(body, select_only)
    tag(head, 'Head', 'Face', slot='Face')
    tag(rest, 'Body', 'Skin', slot='Skin')
    eye = bpy.data.objects['eye_L']
    eye_centre = sum((v.co for v in eye.data.vertices), Vector()) / len(eye.data.vertices)
    eye_radius = max((v.co - eye_centre).length for v in eye.data.vertices)
    hair = tag(hair_cards(head, F), 'hair_cards', 'HairCards', bone='Head', slot='Hair')
    brows = tag(brow_cards(head, F), 'brow_cards', 'BrowCards', bone='Head', slot='Face')
    lashes = tag(lash_cards(head, F, eye_radius), 'lash_cards', 'BrowCards', bone='Head', slot='Face')
    maps['BrowCards'] = dict(maps['HairCards'])  # same sheet, sharper cut-off in the build
    return {'maps': maps, 'ao_body': ao_body, 'head': head, 'body': rest, 'parts': [head, rest, hair, brows, lashes]}
