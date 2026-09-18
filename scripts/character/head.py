"""Realistic head for the universal humanoid (imported by parts.py, `--body realistic` only).

The Blender Studio body is UDIM: the head owns texture tile 1001, torso and limbs tiles 1002-1004. This module keeps that
split — the head gets its own `Face` material and maps (2K authored, 1K shipped), the body tiles pack into one `Skin`
atlas — and then does what a painted-on face cannot: sculpted wrinkles and pores displaced into the high mesh and baked
to the normal map, photographed skin micro-detail (Lee Perry-Smith head scan, CC BY 3.0, as tiling detail only — not his
face), and hair, brow and lash cards as real geometry over a shaved scalp cap."""
import math
import os

import __main__ as P  # parts.py, the running Blender script: its image and noise helpers
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

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
    """Split the baked body into a head object (`Face`) and the rest (`Skin`); both keep weights, UVs and modifiers.
    The joint mesh's vertex normals are carried across as custom normals, or the seam shades as a dark line."""
    select_only([body])
    joint = {(round(v.co.x, 6), round(v.co.y, 6), round(v.co.z, 6)): v.normal.copy() for v in body.data.vertices}
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    pieces = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    for piece in pieces:
        normals = [joint.get((round(v.co.x, 6), round(v.co.y, 6), round(v.co.z, 6)), v.normal).copy() for v in piece.data.vertices]
        piece.data.normals_split_custom_set_from_vertices([tuple(n) for n in normals])
    head = max(pieces, key=lambda o: sum(v.co.z for v in o.data.vertices) / len(o.data.vertices))
    rest = next(o for o in pieces if o is not head)
    return head, rest


# --- baking ------------------------------------------------------------------------------------------------------------

def bake_tiles(obj, kind, sizes, select_only, float_buffer=False, high=None, cage=0.02, samples=1, margin=16, ao_distance=0.35, normal_space='TANGENT'):
    """Bake `kind` once, every material slot of `obj` into its own image: the way to bake a UDIM body to per-tile maps.
    Returns float arrays (rows = v from the bottom, RGBA) in slot order."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.render.bake.margin = margin
    scene.render.bake.use_selected_to_active = high is not None
    scene.render.bake.normal_space = normal_space
    if high is not None:
        scene.render.bake.cage_extrusion = cage
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


# --- photographed face by projection ---------------------------------------------------------------------------------

PHOTO = 'artifacts/source/face/gpt_front.png'  # owner-generated (GPT image model), flat-lit, synthetic; landmarks beside it

# MediaPipe index → head-mesh (x, z) in rig space. The mesh side is measured (probe of body_realistic.glb) or derived from
# the FACE landmarks; the photo side is read from the landmarks JSON. Two eyes × (centre, inner, outer), nose, subnasale,
# nostrils, mouth (corners, lip line, lip tops), chin, brow (inner, peak, tail), hairline, cheek sides.
def head_correspondences(F, lid_ring):
    ex, ez = F['eye_l'].x, F['eye_l'].z
    n, m = F['nose'], F['mouth']
    inner, outer = lid_ring  # |x| of the lid opening's inner and outer corners
    pairs = {
        'eye_r': ((159, 145), (-ex, ez)), 'eye_l': ((386, 374), (ex, ez)),
        33: (-outer * 0.92, ez), 133: (-inner * 1.08, ez - 0.001), 362: (inner * 1.08, ez - 0.001), 263: (outer * 0.92, ez),
        1: (0.0, n.z), 2: (0.0, n.z - 0.016), 98: (-0.016, n.z - 0.011), 327: (0.016, n.z - 0.011),
        61: (-0.024, m.z), 291: (0.024, m.z), 13: (0.0, m.z), 0: (0.0, m.z + 0.011), 17: (0.0, m.z - 0.011),
        152: (0.0, m.z - 0.056), 199: (0.0, m.z - 0.037),
        105: (-0.027, ez + 0.016), 334: (0.027, ez + 0.016), 55: (-0.010, ez + 0.012), 285: (0.010, ez + 0.012),
        46: (-0.055, ez + 0.009), 276: (0.055, ez + 0.009),
        10: (0.0, ez + 0.076), 234: (-0.077, ez - 0.008), 454: (0.077, ez - 0.008),
    }
    return pairs


def tps_fit(src, dst):
    """Thin-plate spline mapping 2D src points onto dst points (both n×2). Returns the solved weights."""
    n = len(src)
    d = np.linalg.norm(src[:, None, :] - src[None, :, :], axis=2)
    K = np.where(d > 0, d * d * np.log(d + 1e-12), 0.0)
    Pm = np.hstack([np.ones((n, 1)), src])
    A = np.zeros((n + 3, n + 3))
    A[:n, :n] = K + np.eye(n) * 1e-6  # a little regularisation: the correspondences are hand-measured
    A[:n, n:] = Pm
    A[n:, :n] = Pm.T
    rhs = np.zeros((n + 3, 2))
    rhs[:n] = dst
    return src, np.linalg.solve(A, rhs)


def tps_eval(model, q, chunk=32768):
    """Evaluate the spline at q (…×2) → …×2, in chunks: a 2K tile against hundreds of landmarks must not be one array."""
    src, w = model
    n = len(src)
    flat = q.reshape(-1, 2)
    out = np.empty_like(flat)
    src32 = src.astype(np.float32)
    for i in range(0, len(flat), chunk):
        f = flat[i:i + chunk].astype(np.float32)
        d = np.linalg.norm(f[:, None, :] - src32[None, :, :], axis=2)
        U = np.where(d > 0, d * d * np.log(d + 1e-12), 0.0)
        out[i:i + chunk] = U @ w[:n] + w[n] + f @ w[n + 1:]
    return out.reshape(q.shape)


VIEWS = [  # (image, camera yaw in degrees: + = camera on the character's left, seeing the left side of the face)
    ('artifacts/source/face/gpt_front.png', 0.0),
    ('artifacts/source/face/gpt/raw4.png', 35.0), ('artifacts/source/face/gpt/raw3.png', -35.0),
]  # the ±90° profiles supply depth (PROFILES) but are not projected: they paint hair and ear shadow onto the temples


def photo_layer_multi(pos, normal_obj, F, lid_ring, size, head):
    """Every portrait view projected onto the face tile and blended by how squarely each sees the surface. Each view's
    warp comes from its own landmarks against the head's 3D landmarks rotated into that view; profiles use only the
    visible side's landmarks. Views are exposure-matched to the front."""
    import json
    dense = F.get('dense')  # (target cloud, ok mask) from fit_head_dense: the mesh's 468 landmarks in 3D
    if dense is not None:
        land3 = {i: dense[0][i] for i in np.where(dense[1])[0]}
        pairs = {i: None for i in land3}
    else:
        pairs = head_correspondences(F, lid_ring)
        def mesh3(xz):
            hit, loc, _, _ = head.ray_cast(Vector((float(xz[0]), F['nose'].y - 0.15, float(xz[1]))), Vector((0, 1, 0)))
            return np.array([xz[0], loc.y if hit else F['nose'].y + 0.03, xz[1]], np.float64)
        land3 = {key: mesh3(val[1] if isinstance(val[0], tuple) else val) for key, val in pairs.items()}
    acc = np.zeros(pos.shape[:2] + (3,), np.float32)
    wsum = np.zeros(pos.shape[:2], np.float32)
    front_mean = None
    ez = F['eye_l'].z
    oval = ellipse(pos, (0.0, F['nose'].y + 0.03, ez - 0.02), (0.095, 0.11, 0.115), 0.3)
    crown = ellipse(pos, (0.0, F['nose'].y + 0.06, ez + 0.02), (0.10, 0.13, 0.13), 0.3)  # the hair too, through the head mask
    scalp_zone = scalp_mask(pos, F)
    for image, yaw in VIEWS:
        if not os.path.exists(image):
            continue
        th = math.radians(yaw)
        right = np.array([math.cos(th), math.sin(th), 0.0])
        cam = np.array([math.sin(th), -math.cos(th), 0.0])
        lm = json.load(open(image.rsplit('.', 1)[0] + '.landmarks.json'))
        pts = np.array(lm['points'], np.float32)
        ph, pw = lm['height'], lm['width']
        photo = P.load_pixels(image, 'sRGB')
        sil = P.load_pixels(image.rsplit('.', 1)[0] + '.mask.png', 'Non-Color')[..., 0]
        head_path = image.rsplit('.', 1)[0] + '.head.png'
        head_sil = P.load_pixels(head_path, 'Non-Color')[..., 0] if os.path.exists(head_path) else sil
        src, dst = [], []
        for key, val in pairs.items():
            p3 = land3[key]
            if abs(yaw) > 60 and (p3[0] * math.copysign(1, yaw) < -0.004 or key in (10,)):  # profile: visible side only
                continue
            if val is None:
                px = pts[key]
            elif isinstance(val[0], tuple):
                a, b = val[0]
                px = (pts[a] + pts[b]) / 2
            else:
                px = pts[key]
            src.append((float(p3 @ right), float(p3[2])))
            dst.append((float(px[0]), float(ph - px[1])))
        if len(src) < 6:
            continue
        model = tps_fit(np.array(src, np.float64), np.array(dst, np.float64))
        proj = np.stack([pos.astype(np.float64) @ right, pos[..., 2].astype(np.float64)], axis=2)
        uv = tps_eval(model, proj)
        u = np.clip(uv[..., 0], 0, pw - 1.001)
        v = np.clip(uv[..., 1], 0, ph - 1.001)
        u0, v0 = np.floor(u).astype(int), np.floor(v).astype(int)
        fu, fv = (u - u0)[..., None], (v - v0)[..., None]
        sample = (photo[v0, u0] * (1 - fu) * (1 - fv) + photo[v0, u0 + 1] * fu * (1 - fv) + photo[v0 + 1, u0] * (1 - fu) * fv + photo[v0 + 1, u0 + 1] * fu * fv)
        facing = np.clip(normal_obj.astype(np.float64) @ cam, 0, 1) ** 1.5
        inside = (u > 2) & (u < pw - 3) & (v > 2) & (v < ph - 3)
        w = (facing * np.maximum(sil[v0, u0] * oval, head_sil[v0, u0] * crown * scalp_zone) * inside).astype(np.float32)
        luma = sample @ np.array([0.30, 0.59, 0.11])
        wide = blur(luma, 128)
        mean = float((wide * w).sum() / (w.sum() + 1e-6))
        sample = sample * np.clip((mean / (wide + 1e-3)) ** 0.9, 0.6, 1.6)[..., None]
        view_mean = (sample * w[..., None]).sum(axis=(0, 1)) / (w.sum() + 1e-6)
        if front_mean is None:
            front_mean = view_mean
        else:
            sample = sample * (front_mean / (view_mean + 1e-6))[None, None, :]  # exposure match to the front
        acc += sample.astype(np.float32) * w[..., None]
        wsum += w
        print(f'VIEW {os.path.basename(image)} yaw={yaw:+.0f} landmarks={len(src)} coverage={float((w > 0.2).mean()):.3f}')
    sample = acc / np.maximum(wsum, 1e-6)[..., None]
    weight = np.clip(wsum * 1.4, 0, 1)
    return np.clip(sample, 0, 1), weight


def photo_layer(pos, normal_obj, F, lid_ring, size):
    """The portrait projected onto the face tile: (x, z) of every texel → thin-plate-warped photo pixel; weight from
    how squarely the surface faces the camera and a soft face oval. Mild de-lighting flattens the studio key."""
    import json
    lm = json.load(open(PHOTO.rsplit('.', 1)[0] + '.landmarks.json'))
    pts = np.array(lm['points'], np.float32)
    photo = P.load_pixels(PHOTO, 'sRGB')  # rows from the bottom
    ph, pw = photo.shape[:2]
    pairs = head_correspondences(F, lid_ring)
    src, dst = [], []
    for key, val in pairs.items():
        if isinstance(val[0], tuple):  # eye centre = midpoint of upper and lower lid landmarks
            a, b = val[0]
            px, mesh = (pts[a] + pts[b]) / 2, val[1]
        else:
            px, mesh = pts[key], val
        src.append(mesh)
        dst.append((px[0], ph - px[1]))  # photo rows counted from the bottom
    model = tps_fit(np.array(src, np.float64), np.array(dst, np.float64))
    xz = pos[..., [0, 2]].astype(np.float64)
    uv = tps_eval(model, xz)
    u = np.clip(uv[..., 0], 0, pw - 1.001)
    v = np.clip(uv[..., 1], 0, ph - 1.001)
    u0, v0 = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = (u - u0)[..., None], (v - v0)[..., None]
    sample = (photo[v0, u0] * (1 - fu) * (1 - fv) + photo[v0, u0 + 1] * fu * (1 - fv) + photo[v0 + 1, u0] * (1 - fu) * fv + photo[v0 + 1, u0 + 1] * fu * fv)
    # The portrait's own silhouette (landmark oval, eroded and feathered) sampled through the same warp: no background.
    silhouette = P.load_pixels(PHOTO.rsplit('.', 1)[0] + '.mask.png', 'Non-Color')[..., 0]
    sil = silhouette[v0, u0]
    # De-light: divide by a wide luminance blur inside the face, keep the mean.
    ez = F['eye_l'].z
    oval = ellipse(pos, (0.0, F['nose'].y + 0.03, ez - 0.02), (0.088, 0.09, 0.108), 0.3)
    luma = sample @ np.array([0.30, 0.59, 0.11])
    spots = np.clip(blur(luma, 16) - luma, 0, 1)[..., None]  # small dark marks (freckles, moles): mostly lifted; a few stay
    sample = sample + spots * 0.85 * sample
    wide = blur(luma, 128)  # the broad lighting gradient
    mean = float((wide * oval).sum() / (oval.sum() + 1e-6))
    sample = sample * np.clip((mean / (wide + 1e-3)) ** 0.9, 0.6, 1.6)[..., None]
    facing = np.clip((-normal_obj[..., 1] + 0.05) / 0.5, 0, 1)  # -y is the camera side; 45° surfaces still take the photo
    inside = (u > 2) & (u < pw - 3) & (v > 2) & (v < ph - 3)
    weight = facing * oval * inside * sil
    return np.clip(sample, 0, 1), weight


def fit_head_to_photo(objs, eyes, F):
    """Warp the head (and the sculpt copy) so its features sit where the portrait's are: a similarity from the eye
    spacing maps photo landmarks into rig metres; a smooth 2D spline (x, z) moves every correspondence onto its target
    and carries the skin between them; the eyeballs follow their sockets. Returns the fitted landmark positions, so
    later steps (lid ring, paint, projection) use the photo's proportions, not the base mesh's formulas."""
    import json
    lm = json.load(open(PHOTO.rsplit('.', 1)[0] + '.landmarks.json'))
    pts = np.array(lm['points'], np.float64)
    ph = lm['height']  # noqa: F841
    pairs = head_correspondences(F, F['lid_ring'])
    def photo_pt(key, val):
        if isinstance(val[0], tuple):
            a, b = val[0]
            return (pts[a] + pts[b]) / 2
        return pts[key]
    eye_r_px, eye_l_px = photo_pt('eye_r', pairs['eye_r']), photo_pt('eye_l', pairs['eye_l'])
    scale = (F['eye_l'].x - F['eye_r'].x) / (eye_l_px[0] - eye_r_px[0])  # metres per pixel
    mid_px, mid_m = (eye_r_px + eye_l_px) / 2, ((F['eye_l'].x + F['eye_r'].x) / 2, F['eye_l'].z)
    def to_mesh(px):
        return np.array([mid_m[0] + (px[0] - mid_px[0]) * scale, mid_m[1] - (px[1] - mid_px[1]) * scale])
    src, dst = [], []
    for key, val in pairs.items():
        if key in (33, 133, 362, 263, 'eye_l', 'eye_r'):  # eyes stay put: eyeballs and lids are tuned to the mesh's openings
            continue
        mesh = np.array(val[1] if isinstance(val[0], tuple) else val, np.float64)
        src.append(mesh)
        dst.append(to_mesh(photo_pt(key, val)))
    src, dst = np.array(src), np.array(dst)
    model = tps_fit(src, dst - src)  # spline of displacements, so far-away skin moves ~0
    ez = F['eye_l'].z
    for obj in objs:
        co = np.array([[v.co.x, v.co.y, v.co.z] for v in obj.data.vertices], np.float64)
        face = np.clip((F['nose'].y + 0.10 - co[:, 1]) / 0.05, 0, 1) * np.clip((co[:, 2] - (ez - 0.20)) / 0.05, 0, 1) * np.clip((ez + 0.14 - co[:, 2]) / 0.05, 0, 1)
        disp = tps_eval(model, co[:, [0, 2]].reshape(-1, 1, 2)).reshape(-1, 2) * face[:, None]
        for v, d in zip(obj.data.vertices, disp):
            v.co.x += float(d[0])
            v.co.z += float(d[1])
        obj.data.update()
    fitted = {key: to_mesh(photo_pt(key, val)) for key, val in pairs.items()}
    print('FIT scale_m_per_px', round(scale, 6), 'max move mm', round(float(np.abs(dst - src).max() * 1000), 1))
    return fitted


BASE_RENDER = 'artifacts/source/face/base_front.png'  # the base head rendered by render_head.py, landmarks beside it
PROFILES = {90.0: 'artifacts/source/face/gpt/raw2.png', -90.0: 'artifacts/source/face/gpt/raw1.png'}
LEFT_EYE = (33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246)
RIGHT_EYE = (362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398)


def load_landmarks(image):
    import json
    lm = json.load(open(image.rsplit('.', 1)[0] + '.landmarks.json'))
    return np.array(lm['points'], np.float64), lm['width'], lm['height']


def base_landmarks_3d(head, F):
    """The 468 landmarks the model found on the rendered base head, cast back into the mesh: 3D positions in rig space."""
    import json
    meta = json.load(open('artifacts/source/face/base_render.json'))
    pts, w, h = load_landmarks(BASE_RENDER)
    c = Vector(meta['centre'])
    ortho = meta['ortho_scale']
    out = np.zeros((len(pts), 3))
    ok_mask = np.zeros(len(pts), bool)
    for i, (px, py) in enumerate(pts):
        x = c.x + (px / w - 0.5) * ortho
        z = c.z + (0.5 - py / h) * ortho
        hit, loc, _, _ = head.ray_cast(Vector((x, c.y - 2.0, z)), Vector((0, 1, 0)))
        if hit:
            out[i] = (loc.x, loc.y, loc.z)
            ok_mask[i] = True
    return out, ok_mask


def photo_landmarks_3d(base3, ok_mask):
    """The same 468 points on the man in the portraits: x, z from the front by a similarity solved against the base
    (scale + shift, least squares over every landmark), depth from whichever profile sees each point, anchored so his
    nose tip sits at the base nose's depth."""
    front, w, h = load_landmarks(PHOTO)
    f2 = np.stack([front[:, 0], h - front[:, 1]], axis=1)
    b2 = base3[:, [0, 2]]
    # similarity: b2 ≈ s * f2 + t  (isotropic; portraits and render share the orthographic framing convention)
    fm, bm = f2[ok_mask].mean(axis=0), b2[ok_mask].mean(axis=0)
    fc, bc = f2[ok_mask] - fm, b2[ok_mask] - bm
    s = float((fc * bc).sum() / (fc * fc).sum())
    t = bm - s * fm
    xz = s * f2 + t
    target = base3.copy()
    target[:, 0] = xz[:, 0]
    target[:, 2] = xz[:, 1]
    # Depth: the profiles are trusted only along the midline silhouette (forehead, nose, lips, chin), where a profile
    # landmark sits on a real edge. Everything else keeps the base head's lateral depth structure, shifted so the
    # midline follows his profile curve — eye sockets and cheeks are never sheared by hallucinated side landmarks.
    midline = np.abs(xz[:, 0] - xz[1, 0]) < 0.006
    prof_depth = np.full(len(front), np.nan)
    for yaw, image in PROFILES.items():
        if not os.path.exists(image.rsplit('.', 1)[0] + '.landmarks.json'):
            continue
        prof, pw, _ = load_landmarks(image)
        sign = 1.0 if yaw > 0 else -1.0  # camera on the left: image right = +y (back)
        d = sign * (prof[:, 0] - prof[1, 0]) * s + base3[1, 1]  # nose tip (id 1) at the base nose depth
        prof_depth = np.where(np.isnan(prof_depth), d, (prof_depth + d) / 2)
    ids = np.where(midline & ok_mask & ~np.isnan(prof_depth))[0]
    if len(ids) >= 4:
        order = ids[np.argsort(xz[ids, 1])]
        offset = np.interp(xz[:, 1], xz[order, 1], prof_depth[order] - base3[order, 1])  # midline depth change, by height
    else:
        offset = np.zeros(len(front))
    target[:, 1] = base3[:, 1] + offset
    return target


def fit_head_dense(objs, eyes, head, F):
    """Warp the head to the portraits with all 468 landmarks (3D thin-plate spline of displacements), then resize and
    seat the eyeballs in his eye openings. Returns the target landmark cloud (the mesh's landmarks after the fit)."""
    base3, ok_mask = base_landmarks_3d(head, F)
    target = photo_landmarks_3d(base3, ok_mask)
    src, dst = base3[ok_mask], target[ok_mask]
    n = len(src)
    d = np.linalg.norm(src[:, None, :] - src[None, :, :], axis=2)
    K = -d  # 3D thin-plate kernel
    Pm = np.hstack([np.ones((n, 1)), src])
    A = np.zeros((n + 4, n + 4))
    A[:n, :n] = K + np.eye(n) * 2e-4
    A[:n, n:] = Pm
    A[n:, :n] = Pm.T
    rhs = np.zeros((n + 4, 3))
    rhs[:n] = dst - src
    wts = np.linalg.solve(A, rhs)
    def warp(q):
        dq = np.linalg.norm(q[:, None, :] - src[None, :, :], axis=2)
        return (-dq) @ wts[:n] + wts[n] + q @ wts[n + 1:]
    ez = F['eye_l'].z
    for obj in objs:
        co = np.array([[v.co.x, v.co.y, v.co.z] for v in obj.data.vertices], np.float64)
        face = np.clip((F['nose'].y + 0.12 - co[:, 1]) / 0.06, 0, 1) * np.clip((co[:, 2] - (ez - 0.22)) / 0.06, 0, 1) * np.clip((ez + 0.16 - co[:, 2]) / 0.05, 0, 1)
        disp = np.zeros_like(co)
        active = face > 0.001
        disp[active] = warp(co[active]) * face[active, None]
        for v, dd in zip(obj.data.vertices, disp):
            v.co.x += float(dd[0])
            v.co.y += float(dd[1])
            v.co.z += float(dd[2])
        obj.data.update()
    # eyeballs: the size and place of his openings
    result = {}
    for e, ids in zip(eyes, (LEFT_EYE, RIGHT_EYE)):
        # the lid margin: the eye-contour landmarks cast from the front into the fitted head hit the lid edge surface
        margin = []
        for xz in target[list(ids)][:, [0, 2]]:
            hit, loc, _, _ = head.ray_cast(Vector((float(xz[0]), F['nose'].y - 0.2, float(xz[1]))), Vector((0, 1, 0)))
            if hit:
                margin.append((loc.x, loc.y, loc.z))
        margin = np.array(margin) if len(margin) >= 8 else target[list(ids)]
        half_w = float(margin[:, 0].max() - margin[:, 0].min()) / 2
        radius = half_w * 0.85  # eyeball ≈ 0.8 of the opening's half-width
        cx, cz = (margin[:, 0].max() + margin[:, 0].min()) / 2, (margin[:, 2].max() + margin[:, 2].min()) / 2
        # depth from the upper and lower lid margins (the corners sit off the eyeball): the cornea's front pole stands
        # 1.5 mm in front of the mid-lid margin plane, as on a real eye (−y is forward)
        mid = margin[np.abs(margin[:, 0] - cx) < half_w * 0.35]
        y_mid = float(mid[:, 1].mean()) if len(mid) >= 2 else float(margin[:, 1].mean())
        centre = np.array([cx, y_mid + radius + 0.0015, cz])  # cornea apex 1.5 mm behind the mid-lid skin
        print(f'EYE {e.name} margin pts={len(margin)} half_w mm={half_w * 1000:.1f} r mm={radius * 1000:.1f} centre y={centre[1]:.4f} mid-lid y={y_mid:.4f}')
        pts = np.array([[v.co.x, v.co.y, v.co.z] for v in e.data.vertices], np.float64)
        A = np.hstack([2 * pts, np.ones((len(pts), 1))])  # the eyeball's true sphere: the vertex mean sits toward the iris
        sol, *_ = np.linalg.lstsq(A, (pts ** 2).sum(axis=1), rcond=None)
        old_c = Vector(sol[:3])
        old_r = math.sqrt(max(float(sol[3] + (sol[:3] ** 2).sum()), 1e-8))
        k = radius / old_r
        for v in e.data.vertices:
            v.co = Vector(centre) + (v.co - old_c) * k
        e.data.update()
        result[e.name] = (Vector(centre), radius)
    print(f'DENSE FIT landmarks={n} max move mm={float(np.abs(dst - src).max() * 1000):.1f} eye radius mm={radius * 1000:.1f}')
    return target, ok_mask, result


def close_lids(obj, eye_centres, radius, upper=math.radians(13), lower=math.radians(4)):
    """Bring the lids down: rotate skin near each eyeball about the eye centre (x axis), so the lid stays on its sphere
    and never cuts the eye. Full at the lid margin, fading out 18 mm from the eyeball."""
    for c in eye_centres:
        for v in obj.data.vertices:
            d = v.co - c
            dist = d.length - radius
            if dist > 0.018 or d.y > 0.004:
                continue
            fall = 1 - max(0.0, dist) / 0.018
            angle = (-upper if d.z > 0 else lower) * fall
            y, z = d.y, d.z
            v.co.y = c.y + y * math.cos(angle) - z * math.sin(angle)
            v.co.z = c.z + y * math.sin(angle) + z * math.cos(angle)
    obj.data.update()


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
        h += groove(xz, [(sx * 0.0055, ez + 0.017), (sx * 0.0045, ez + 0.030), (sx * 0.006, ez + 0.040)], 0.0015, -0.14)
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
        h += groove(xz, [(sx * 0.017, n.z - 0.004), (sx * 0.026, n.z - 0.02), (sx * 0.031, m.z - 0.010)], 0.0038, -0.10)
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
    ez = F.get('hairline_z', ez + 0.076) - 0.076 - (0.018 if 'hairline_z' in F else 0.0)  # fitted hairline, shells start inside the portrait's hair
    recession = np.clip((np.abs(pos[..., 0]) - 0.028) / 0.022, 0, 1) ** 1.5 * 0.014  # the hairline rises at the temples
    sides = np.clip((np.abs(pos[..., 0]) - 0.048) / 0.02, 0, 1) ** 1.2  # … then drops to the ear tops round the sides
    hairline = ez + 0.076 + recession - sides * 0.021 - np.clip(pos[..., 1] - ey + 0.02, 0, None) * 0.55  # sides: 5 mm above the ear tops
    scalp = np.clip((pos[..., 2] - hairline) / (0.035 if 'hairline_z' in F else 0.02), 0, 1)  # a long feather into the portrait's hairline
    ear = np.clip((np.abs(pos[..., 0]) - 0.040) / 0.008, 0, 1) * np.clip((pos[..., 1] - (ey + 0.010)) / 0.01, 0, 1) * np.clip(((ey + 0.12) - pos[..., 1]) / 0.01, 0, 1) * np.clip(((ez + 0.056) - pos[..., 2]) / 0.008, 0, 1)  # the ear and the skull under it
    scalp = scalp * (1 - ear)  # the ears are not scalp
    scalp = np.maximum(scalp, np.clip((pos[..., 1] - (ey + 0.075)) / 0.02, 0, 1) * np.clip((pos[..., 2] - (ez - 0.03)) / 0.05, 0, 1))  # the nape reaches the neck, over a long feather
    return scalp * np.clip((pos[..., 2] - (ez - 0.05)) / 0.02, 0, 1)


def face_colour(pos, mask, F, ao, detail, size, photo=None):
    """The face's colour: olive Mediterranean base, sub-dermal zones (blood in the nose, cheeks and ears; blue-grey
    beard shadow; warmer forehead), photographed micro-mottle, an old scar, arena dust, a shaved scalp under the cards.
    Brows and lashes are geometry now, so they leave only their shadow here."""
    fbm = P.fbm
    ex, ey, ez, n, m, c, front, xz = landmarks(F, pos)
    base = (np.array([0.64, 0.47, 0.35]) if SKIN_TONE is None else SKIN_TONE * 1.06)[None, None, :]  # healthy olive: a shade lighter and pinker than the body
    tone = fbm(size, 41, octaves=(4, 8, 16, 32))[..., None]
    colour = base * (0.94 + tone * 0.12)
    colour[..., 1] *= 1 + (tone[..., 0] - 0.5) * 0.04
    colour[..., 0] *= 1 + (fbm(size, 42, octaves=(8, 16)) - 0.5) * 0.08
    cavity = np.clip(ao, 0, 1)[..., None] ** 1.2
    colour = colour * (np.array([0.55, 0.47, 0.44])[None, None, :] * (1 - cavity) + cavity)  # occlusion goes red, not grey: skin
    colour = colour * (1 + (detail - 0.5) * 1.3)  # scan mottle and pores, centred on 1
    if photo is not None:  # the portrait owns the front of the face; painted features only fill in where it fades
        sample, w = photo
        core = w > 0.8  # match the photo's skin statistics to the painted skin so the two meet without a step
        gain = (colour[core].mean(axis=0) / (sample[core].mean(axis=0) + 1e-6)) if core.any() else np.ones(3)
        sample = np.clip(sample * gain[None, None, :], 0, 1)
        lips_w = ellipse(pos, (F['mouth'].x, F['mouth'].y, F['mouth'].z), (0.028, 0.014, 0.012), 0.5)[..., None]
        luma = (sample @ np.array([0.30, 0.59, 0.11]))[..., None]
        sample = sample * (1 - lips_w * 0.45) + luma * lips_w * 0.45  # a man's lips: desaturate what the portrait brought
        # Skin: the painted base keeps tone and shape (no baked shadows); the portrait adds only what is finer than ~8 mm —
        # pores, mottle, hair. Feature zones (brows, lips, beard, nostrils) take the portrait as it is.
        detail = np.clip(sample / (blur(sample, 32) + 1e-3), 0.55, 1.6)  # finer than ~1 cm
        ey_, ez_ = F['eye_l'].y, F['eye_l'].z
        zones = np.maximum.reduce([
            ellipse(pos, (0.034, ey_ - 0.006, ez_ + 0.017), (0.026, 0.02, 0.008), 0.5), ellipse(pos, (-0.034, ey_ - 0.006, ez_ + 0.017), (0.026, 0.02, 0.008), 0.5),
            ellipse(pos, (F['mouth'].x, F['mouth'].y, F['mouth'].z), (0.028, 0.014, 0.012), 0.5),
            ellipse(pos, (0.012, F['nose'].y + 0.01, F['nose'].z - 0.01), (0.008, 0.012, 0.007), 0.5), ellipse(pos, (-0.012, F['nose'].y + 0.01, F['nose'].z - 0.01), (0.008, 0.012, 0.007), 0.5),
            beard_mask(pos, F, size) * 0.85])
        photo_col = sample * (1 - zones[..., None] * 0.0)  # flat-lit portraits: taken as they are; zones kept for the composite option
        colour = colour * (1 - w[..., None]) + photo_col * w[..., None]
        keep = 1 - w
    else:
        keep = np.ones(pos.shape[:2], np.float32)
    # Zones.
    forehead = np.clip((pos[..., 2] - (ez + 0.035)) / 0.02, 0, 1) * front
    colour *= 1 + forehead[..., None] * np.array([0.03, 0.02, -0.04])[None, None, :]
    flush = ellipse(pos, (n.x, n.y, n.z), (0.02, 0.02, 0.025), 0.8)
    for sx in (1, -1):
        flush = np.maximum(flush, ellipse(pos, (sx * (ex + 0.015), ey + 0.02, ez - 0.045), (0.035, 0.03, 0.03), 0.9) * 0.6)
        flush = np.maximum(flush, ellipse(pos, (sx * F['ear_x'], ey + 0.07, ez), (0.02, 0.03, 0.035), 0.8) * 0.8)
    flush = flush * keep
    colour[..., 0] *= 1 + flush * 0.12
    colour[..., 1] *= 1 - flush * 0.03
    colour[..., 2] *= 1 - flush * 0.10
    for sx in (1, -1):
        socket = ellipse(pos, (sx * ex, ey + 0.004, ez + 0.006), (0.03, 0.022, 0.02), 0.6)
        colour *= (1 - socket[..., None] * np.array([0.04, 0.07, 0.10])[None, None, :] * (front * keep)[..., None])
        brow = ellipse(pos, (sx * 0.031, ey - 0.006, ez + 0.027), (0.024, 0.02, 0.005), 0.6) * front * keep
        colour *= (1 - brow * 0.22)[..., None]  # the shadow under the brow cards
        lash = ellipse(pos, (sx * ex, ey - 0.012, ez + 0.009), (0.018, 0.012, 0.0028), 0.9)  # soft shading at the lid margin, not a stroke
        colour *= 1 - (lash * 0.22 * front * keep)[..., None]
        lower = ellipse(pos, (sx * ex, ey - 0.012, ez - 0.012), (0.017, 0.012, 0.0010), 0.6)  # lower lid margin, lighter
        colour *= 1 - (lower * 0.25 * front * keep)[..., None]
    ears = np.maximum(ellipse(pos, (F['ear_x'], ey + 0.07, ez), (0.025, 0.035, 0.04), 0.6), ellipse(pos, (-F['ear_x'], ey + 0.07, ez), (0.025, 0.035, 0.04), 0.6))
    colour *= (1 - ears * 0.10)[..., None]
    # Lips: a man's — barely rosier than the skin, a defined border, darker at the mouth line.
    lips = ellipse(pos, (m.x, m.y, m.z), (0.027, 0.014, 0.011), 0.4)
    inner = ellipse(pos, (m.x, m.y, m.z), (0.0245, 0.013, 0.0095), 0.4)
    lip_colour = np.array([0.50, 0.27, 0.23])[None, None, :]
    colour = colour * (1 - (lips * 0.30 * front * keep)[..., None]) + lip_colour * (lips * 0.30 * front * keep)[..., None]
    colour *= (1 - (lips - inner) * 0.18 * front * keep)[..., None]
    colour *= (1 - groove(xz, arc(m.x - 0.025, m.x + 0.025, m.z, -0.001), 0.0009, 0.45) * front * keep)[..., None]
    # Beard shadow with stubble grain; a cool cast.
    beard = beard_mask(pos, F, size) * keep
    grain = np.repeat(np.repeat((np.random.default_rng(62).random((size // 2, size // 2)) < 0.30).astype(np.float32), 2, 0), 2, 1)
    colour *= (1 - beard * (0.10 + grain * 0.30))[..., None]
    colour *= 1 - (beard * 0.08)[..., None] * np.array([0.3, 0.05, -0.4])[None, None, :]
    # Moles and a healed scar across the left brow.
    rng = np.random.default_rng(67)
    for _ in range(4):
        px, pz = rng.uniform(-0.05, 0.05), rng.uniform(c.z + 0.02, ez + 0.06)
        colour *= (1 - ellipse(pos, (px, ey, pz), (0.0012, 0.02, 0.0012), 0.6) * 0.45 * front * keep)[..., None]
    for k in range(60):
        t = k / 60
        sc = ellipse(pos, (ex + 0.02 - t * 0.03, ey - 0.03 + t * 0.012, ez + 0.045 - t * 0.075), (0.0028, 0.01, 0.0028), 0.8) * keep
        colour = colour * (1 - sc[..., None] * 0.0) + np.array([0.62, 0.42, 0.34])[None, None, :] * (sc * 0.0)[..., None]  # scar: a later battle mark
    if FIGHTERS[FIGHTER].get('pallor'):  # the Nightborn (his brief, the no-credits pass on the stand-in head): the blood drained —
        luma = (colour @ np.array([0.30, 0.59, 0.11]))[..., None]  # half the chroma gone and what is left runs cold
        colour = colour * 0.45 + luma * 0.55
        colour *= np.array([0.97, 1.00, 1.05])[None, None, :]
        for sx in (1, -1):  # his eyes sit in hollows: a deeper, wider shadow than the living socket shade above (over the photo too: no keep)
            hollow = ellipse(pos, (sx * ex, ey + 0.002, ez - 0.004), (0.030, 0.026, 0.026), 0.55) * front
            colour *= (1 - hollow[..., None] * np.array([0.20, 0.24, 0.28])[None, None, :])
        shaven = beard_mask(pos, F, size) * front  # clean-shaven: the photographed stubble fades back toward cold skin (over the photo: no keep)
        colour = colour * (1 - shaven[..., None] * 0.6) + (luma * 1.10) * (shaven[..., None] * 0.6)
        throat = groove(xz, arc(-0.030, 0.030, c.z - 0.038, -0.008), 0.0016, 1.0) * front  # a thin old scar across the throat, bowed a little under the chin
        colour = colour * (1 - throat[..., None]) + np.array([0.60, 0.50, 0.48])[None, None, :] * throat[..., None]  # healed tissue: paler than his grey, barely pink
    # Sweat-dirt at the temples, faint.
    streak = fbm(size, 65, octaves=(16, 256))
    temples = np.maximum(ellipse(pos, (ex + 0.045, ey + 0.03, ez + 0.02), (0.012, 0.02, 0.045), 0.9), ellipse(pos, (-(ex + 0.045), ey + 0.03, ez + 0.02), (0.012, 0.02, 0.045), 0.9))
    colour *= (1 - temples * np.clip((streak - 0.58) * 6, 0, 1) * 0.0 * front)[..., None]  # no grime on the hero face
    # Shaved scalp under the hair cards, feathered hairline.
    scalp = scalp_mask(pos, F) * keep  # painted only where no photo reaches (crown, back)
    for _ in range(8):  # grow across the skull island's seam margin so no texel there is left unpainted
        scalp = np.maximum.reduce([scalp, np.roll(scalp, 2, 0), np.roll(scalp, -2, 0), np.roll(scalp, 2, 1), np.roll(scalp, -2, 1)])
    dense = np.repeat(np.repeat((np.random.default_rng(64).random((size // 2, size // 2)) < 0.6).astype(np.float32), 2, 0), 2, 1)  # grain that survives 1K
    colour *= (1 - scalp * (0.42 + dense * 0.30))[..., None]
    colour *= 1 - (scalp * 0.1)[..., None] * np.array([0, 0.3, 0.6])[None, None, :]
    # Arena dust, light.
    dust = np.clip((fbm(size, 1, octaves=(4, 8, 16, 64)) - 0.45) * 2.4, 0, 1)[..., None]
    colour = colour * (1 - dust * 0.08) + np.array([0.30, 0.28, 0.25])[None, None, :] * dust * 0.08  # the arena's dust stays on the body
    return np.clip(colour, 0, 1)


def face_roughness(pos, F, detail, size):
    """Skin is matte: 0.6 with pore breakup; tighter on the oily T-zone and lips, coarser through the beard and scalp."""
    ex, ey, ez, n, m, c, front, xz = landmarks(F, pos)
    rough = 0.70 + (detail[..., 0] - 0.5) * 0.30
    tzone = np.maximum(ellipse(pos, (0, ey - 0.02, ez + 0.055), (0.03, 0.03, 0.028), 0.9), ellipse(pos, (n.x, n.y, n.z + 0.01), (0.013, 0.02, 0.03), 0.9)) * front
    rough -= tzone * 0.06
    rough -= ellipse(pos, (m.x, m.y, m.z), (0.027, 0.014, 0.011), 0.4) * front * 0.10
    rough += beard_mask(pos, F, size) * 0.10 + scalp_mask(pos, F) * 0.14
    for sx in (1, -1):
        rough -= ellipse(pos, (sx * ex, ey - 0.008, ez + 0.006), (0.02, 0.015, 0.012), 0.5) * front * 0.06  # lids
    return np.clip(rough, 0.3, 0.95)


def _smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def sun_mask(pos):
    """Where the sun reaches a man in an exomis: forearms and hands, shins, the tops of the shoulders and nape, the
    open V of the chest; the upper arms and thighs partly. Keyed on the rig's joints in the baked position map."""
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    ax = np.abs(x)
    elbow, knee = abs(P.elbow_l.x), P.calf_l.z
    forearm = _smooth(elbow - 0.02, elbow + 0.04, ax)                                   # elbow outwards, hands included
    upper_arm = _smooth(elbow - 0.24, elbow - 0.10, ax) * (1 - forearm)
    legs = ax < elbow - 0.2
    shin = _smooth(knee + 0.05, knee - 0.02, z) * _smooth(0.03, 0.08, z) * legs
    thigh = _smooth(knee + 0.30, knee + 0.12, z) * _smooth(knee - 0.02, knee + 0.06, z) * legs
    nape_shoulders = _smooth(P.neck.z - 0.12, P.neck.z - 0.02, z) * (ax < 0.25)
    chest_v = _smooth(P.neck.z - 0.22, P.neck.z - 0.08, z) * _smooth(0.14, 0.06, ax) * (y < 0)  # y runs backward
    sun = np.clip(forearm + 0.5 * upper_arm + 0.8 * shin + 0.25 * thigh + 0.6 * nape_shoulders + 0.45 * chest_v, 0, 1)
    return sun * (0.85 + 0.15 * P.fbm(pos.shape[0], 43, octaves=(4, 8)))  # uneven, like real sun


def limb_frame(pos, a, b):
    """Cylinder coordinates about the joint segment a→b: t along it (0 at a, 1 at b), radius, angle around it."""
    a, b = np.array(a, np.float32), np.array(b, np.float32)
    axis = b - a
    length = float(np.linalg.norm(axis))
    axis = axis / length
    rel = pos - a[None, None, :]
    t = (rel @ axis) / length
    radial = rel - t[..., None] * length * axis[None, None, :]
    r = np.linalg.norm(radial, axis=2)
    e1 = np.cross(axis, np.array([0, 0, 1.0]))
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(e1, axis)
    return t, r, np.arctan2(radial @ e1, radial @ e2)


def body_veins(pos, mask):
    """Forearm and hand-back veins: four wandering curves per arm in the forearm's cylinder coordinates, thicker at
    the elbow, ending at the knuckles. A soft 0–1 mask."""
    out = np.zeros(pos.shape[:2], np.float32)
    rng = np.random.default_rng(7)
    for e, h in ((P.elbow_l, P.hand_l), (P.elbow_r, P.hand_r)):
        t, r, ang = limb_frame(pos, e, h)
        win = _smooth(0.12, 0.25, t) * (1 - _smooth(1.15, 1.35, t))
        for k in range(4):
            a0 = rng.uniform(-0.9, 0.9) + (0 if k % 2 else math.pi)
            wobble = 0.5 * np.sin(t * 6.0 + rng.uniform(0, 6)) + 0.25 * np.sin(t * 13.0 + rng.uniform(0, 6))
            da = np.angle(np.exp(1j * (ang - a0 - wobble)))
            width = 0.0016 * (1.2 - 0.6 * t)
            out += np.exp(-((da * r) / width) ** 2) * win * rng.uniform(0.6, 1.0)
    return np.clip(out, 0, 1) * mask


def body_scars(pos, mask):
    """Old healed cuts on the body tile, a 0–1 mask: a long slash across the right pectoral, a cut across the outside of
    the left forearm, a nick across the right bicep and a slash down the outside of the right thigh. Limb scars are bands in
    the limb's cylinder coordinates (as the veins); torso scars are lines in the front plane. Each has a soft core and a
    faint wider halo, so it reads as scar tissue and not as a painted line."""
    if not SCARS:
        return np.zeros(pos.shape[:2], np.float32)
    out = np.zeros(pos.shape[:2], np.float32)
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    def line(px, pz, ax, az, bx, bz, width, front):  # a segment in the front (x, z) plane, on front-facing skin (y < front)
        dx, dz = bx - ax, bz - az
        L = math.hypot(dx, dz)
        t = np.clip(((px - ax) * dx + (pz - az) * dz) / (L * L), 0, 1)
        d = np.hypot(px - (ax + t * dx), pz - (az + t * dz))
        core = np.exp(-(d / width) ** 2) * (1 - _smooth(0.85, 1.0, t)) * (1 - _smooth(0.85, 1.0, 1 - t))
        return core * _smooth(0.0, 0.02, front - y)
    def limb(a, b, t0, t1, a0, width_m, tilt):  # a cut across a limb: from angle a0 at t0 to a0 + tilt at t1, width in metres
        t, r, ang = limb_frame(pos, a, b)
        along = np.clip((t - t0) / (t1 - t0), 0, 1)
        da = np.angle(np.exp(1j * (ang - (a0 + tilt * along))))
        win = _smooth(t0 - 0.03, t0, t) * (1 - _smooth(t1, t1 + 0.03, t))
        return np.exp(-((da * r) / width_m) ** 2) * win
    sh_r, nk, pv = P.shoulder_r, P.neck, P.pelvis
    # right pectoral: from under the right collarbone down and inward, 14 cm (widths in metres: healed cuts are 5-7 mm)
    out += 1.0 * line(x, z, sh_r.x * 0.75, nk.z - 0.14, sh_r.x * 0.15, nk.z - 0.27, 0.0060, pv.y - 0.02)
    # right upper arm (the bare sword arm; the exomis covers the left shoulder): a short cut across the outer bicep
    out += 0.8 * limb(sh_r, P.elbow_r, 0.40, 0.52, -1.2, 0.0050, 0.5)
    # outside of the left forearm: a cut across the forearm at a third of the way down, angled
    out += 0.9 * limb(P.elbow_l, P.hand_l, 0.30, 0.55, 0.3, 0.0050, 1.1)
    # outside of the right thigh: a long slash from the hip down
    out += 0.9 * limb(P.joint('thigh_r'), P.calf_r, 0.25, 0.60, -2.0, 0.0070, -0.4)
    core = np.clip(out, 0, 1)
    halo = np.clip(blur(core, 4) * 2.5, 0, 1) * 0.35
    result = np.clip(np.maximum(core, halo), 0, 1) * mask
    print(f'SCARS painted: {int((result > 0.3).sum())} core texels, {int((result > 0.05).sum())} with halo')
    return result


def body_hair(pos, mask, seed=11):
    """Sparse body hair: short dark strokes on the chest's V, the forearms and the shins, drawn in texture space along
    the local downhill direction (where z falls fastest), a little scatter and curl each. Returns a 0–1 canvas."""
    size = pos.shape[0]
    rng = np.random.default_rng(seed)
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    ax = np.abs(x)
    elbow, hand, knee = abs(P.elbow_l.x), abs(P.hand_l.x), P.calf_l.z
    chest = _smooth(P.neck.z - 0.30, P.neck.z - 0.12, z) * _smooth(0.16, 0.05, ax) * (y < -0.02) * (z < P.neck.z - 0.03)
    forearm = _smooth(elbow - 0.01, elbow + 0.05, ax) * (1 - _smooth(hand - 0.02, hand + 0.02, ax))
    shin = _smooth(knee + 0.04, knee - 0.03, z) * _smooth(0.05, 0.10, z) * (ax < elbow - 0.2)
    density = (0.45 * chest + 0.6 * forearm + 0.35 * shin) * mask
    gz_y, gz_x = np.gradient(z)
    canvas = np.zeros((size, size), np.float32)
    ys, xs = np.nonzero(density > 0.05)
    if len(ys) == 0:  # the head tile's neck: no hair zones
        return canvas
    for i in rng.choice(len(ys), int(len(ys) * 0.012)):
        py, px = int(ys[i]), int(xs[i])
        if rng.random() > density[py, px]:
            continue
        dy, dx = -gz_y[py, px], -gz_x[py, px]
        norm = math.hypot(dy, dx)
        if norm < 1e-6:
            continue
        a = math.atan2(dy / norm, dx / norm) + rng.normal(0, 0.35)
        length = rng.uniform(4, 9)
        curl = rng.normal(0, 0.06)
        for step in range(int(length)):
            a += curl
            cy, cx = int(round(py + math.sin(a) * step)), int(round(px + math.cos(a) * step))
            if 0 <= cy < size and 0 <= cx < size and mask[cy, cx]:
                canvas[cy, cx] = max(canvas[cy, cx], 0.6 + 0.4 * (1 - step / length))
    return canvas


def body_nails(pos, mask, nrm_obj):
    """Finger and toe nails as a soft 0–1 mask, plus the lunula (the paler half-moon at the root). The rig's finger bones
    overshoot the mesh (the thumb by 2 cm), so the tips are found in the position map: per finger a y-band of the hand,
    its outermost texels; per toe an x-band of the forefoot, its foremost texels. The nail is an oval 7–8 mm behind
    the tip on the side whose object-space normal faces the nail's way (up, palms down in the rest pose)."""
    size = pos.shape[0]
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    n_obj = np.stack([P.upsample(nrm_obj[..., c], size) for c in range(3)], axis=2) if nrm_obj.shape[0] != size else nrm_obj
    nails = np.zeros((size, size), np.float32)
    lunula = np.zeros((size, size), np.float32)
    counts = []
    def oval(centre, along, r_along, r_across, facing):
        rel = pos - centre[None, None, :]
        a = rel @ along
        side = rel - a[..., None] * along[None, None, :]
        across = np.linalg.norm(side, axis=2)
        d = (a / r_along) ** 2 + (across / r_across) ** 2
        m = np.clip((1.15 - d) / 0.3, 0, 1) * ((n_obj @ facing) > 0.3)
        root = np.clip((0.5 - (a + r_along) / (2 * r_along)) / 0.25, 0, 1)
        return m, m * root
    def add(name, m, lu):
        nonlocal nails, lunula
        nails, lunula = np.maximum(nails, m), np.maximum(lunula, lu)
        counts.append(f'{name} {int((m > 0.5).sum())}')
    hand_z, hx = P.hand_l.z, abs(P.hand_l.x)
    for sign, side in ((1.0, 'l'), (-1.0, 'r')):
        hand = mask & (sign * x > hx + 0.09) & (z > hand_z - 0.08) & (z < hand_z + 0.06)
        if hand.sum() < 500:
            continue
        H = pos[hand]
        thumb_sel = (H[:, 2] < hand_z - 0.025) & (H[:, 1] < 0.015)
        fingers = H[~thumb_sel]
        reach = sign * fingers[:, 0]
        seg = fingers[reach > hx + 0.15]  # the fingers beyond the knuckles: four rods side by side in (y, z)
        yz = seg[:, 1:3]
        centre_yz = yz.mean(axis=0)
        u, sv, vt = np.linalg.svd(yz - centre_yz, full_matrices=False)
        w2 = vt[0]  # the direction the fingers fan along
        coord = (yz - centre_yz) @ w2
        cents = np.array([np.quantile(coord, q) for q in (0.12, 0.38, 0.62, 0.88)])[:, None] * w2[None, :] + centre_yz
        for _ in range(30):  # k-means, one cluster per finger
            lab = np.argmin(((yz[:, None, :] - cents[None, :, :]) ** 2).sum(axis=2), axis=1)
            cents = np.array([yz[lab == k].mean(axis=0) if (lab == k).any() else cents[k] for k in range(4)])
        w3 = np.array([0.0, w2[0], w2[1]])
        pal = np.cross(np.array([sign, 0, 0.0]), w3)
        pal /= np.linalg.norm(pal)
        near_tip = seg[sign * seg[:, 0] > (sign * seg[:, 0]).max() - 0.02]
        base = fingers[(reach > hx + 0.115) & (reach < hx + 0.135)]
        curl = np.sign((near_tip @ pal).mean() - (base @ pal).mean()) if len(base) and len(near_tip) else 1.0  # the fingers curl towards the palm
        dorsal = -curl * pal
        for k in range(4):
            sel = lab == k
            if sel.sum() < 50:
                continue
            r = sign * seg[sel][:, 0]
            tip = seg[sel][r > r.max() - 0.010]
            c = tip.mean(axis=0)
            c = c + dorsal * ((tip @ dorsal).max() - c @ dorsal - 0.001)  # on the dorsal surface, not in the finger's core
            c = np.array([sign * (r.max() - 0.0075), c[1], c[2]], np.float32)
            m, lu = oval(c, np.array([sign, 0, 0.0]), 0.0065, 0.0045, dorsal)
            add(f'finger{k}_{side}', m, lu)
        th = H[thumb_sel]
        if len(th) > 30:
            axis = np.array([sign * 0.75, -0.36, -0.55])
            axis /= np.linalg.norm(axis)
            # the thumb's nail faces the back of the hand rolled ~50° towards the index finger's side
            order = np.argsort(cents @ w2)
            radial = np.array([0.0, *(cents[order[0]] - cents[order[-1]])])
            radial = radial if (radial @ np.array([0, 0, 1.0])) < 0 else -radial  # towards the index finger (the lowest finger in this rest pose)
            radial /= max(1e-6, np.linalg.norm(radial))
            facing = None
            for ang in (0.9, -0.9):
                cand = dorsal * math.cos(ang) + np.cross(axis, dorsal) * math.sin(ang) + axis * (axis @ dorsal) * (1 - math.cos(ang))
                if facing is None or cand @ radial > facing @ radial:
                    facing = cand
            facing /= np.linalg.norm(facing)
            proj = th @ axis
            end = th[proj > proj.max() - 0.010]
            c = end.mean(axis=0)
            c = (c + facing * ((end @ facing).max() - c @ facing - 0.001) - axis * 0.008).astype(np.float32)
            m, lu = oval(c, axis, 0.0075, 0.0058, facing)
            add(f'thumb_{side}', m, lu)
    for foot in (P.foot_l, P.foot_r):
        f = np.array(foot, np.float32)
        region = mask & (z < 0.05) & (np.abs(x - f[0]) < 0.07) & (y < f[1] - 0.10)
        if region.sum() < 100:
            continue
        inner = 1.0 if f[0] > 0 else -1.0  # the big toe is on the inside (towards x = 0)
        for off, w in zip([-0.030, -0.012, 0.002, 0.016, 0.027], [0.011, 0.007, 0.0065, 0.006, 0.006]):  # big toe → little toe
            band = region & (np.abs((x - f[0]) * (-inner) - off) < w)
            if band.sum() < 20:
                continue
            tip = y[band].min()
            end = band & (y < tip + 0.010)
            centre = np.array([x[end].mean(), tip + 0.007 + w * 0.3, z[end].max() - 0.001], np.float32)  # on the toe's top
            m, lu = oval(centre, np.array([0, -1.0, 0]), 0.006 + w * 0.3, w * 0.7, np.array([0, 0, 1.0]))
            add(f'toe{off:+.3f}', m, lu)
    print('BODY nails (texels over 0.5):', ', '.join(counts))
    return nails * mask, lunula * mask


def body_creases(pos, mask):
    """Skin folds at the back of the elbows and the front of the knees: fine furrows across the joint, a height field."""
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    h = np.zeros(pos.shape[:2], np.float32)
    for e in (P.elbow_l, P.elbow_r):
        d = np.linalg.norm(pos - np.array(e, np.float32)[None, None, :], axis=2)
        h += np.sin((x - e.x) / 0.004) * 0.5 * _smooth(0.05, 0.02, d) * _smooth(-0.01, 0.02, y - e.y)  # the back of the joint (y runs backward)
    for k in (P.calf_l, P.calf_r):
        d = np.linalg.norm(pos - np.array(k, np.float32)[None, None, :], axis=2)
        h += np.sin((z - k.z) / 0.005) * 0.5 * _smooth(0.06, 0.025, d) * _smooth(0.01, -0.02, y - k.y)  # the front of the knee
    for side in ('l', 'r'):  # knuckle furrows: a short transverse groove on the back of each finger joint
        for finger in ('index', 'middle', 'ring', 'pinky', 'thumb'):
            for seg in ('02', '03'):
                name = f'{finger}_{seg}_{side}'
                if name not in P.armature.data.bones:
                    continue
                j = np.array(P.joint(name), np.float32)
                d = np.linalg.norm(pos[..., :2] - j[None, None, :2], axis=2)
                h -= np.exp(-((d / 0.0025) ** 2)) * 0.8 * (z > j[2] + 0.002) * _smooth(0.012, 0.004, d)
    return h * mask


def body_normal(nrm, pos, mask, hair, veins, strength=0.6, nails=None):
    """The body's normal map: the sculpt bake plus one height field's slopes — 2-texel pores, the joint creases, the
    hair strokes and the veins in slight relief."""
    size = nrm.shape[0]
    rng = np.random.default_rng(31)
    fine = rng.random((size, size)).astype(np.float32)
    fine = (fine + np.roll(fine, 1, 0) + np.roll(fine, 1, 1) + np.roll(np.roll(fine, 1, 0), 1, 1)) / 4
    height = fine * 0.5 + body_creases(pos, mask) * 0.6 + hair * 0.10 + veins * 0.15  # audit 2026-09-16: 0.35 vein relief and 0.9 pores read as mottling on the forearm at the grip camera
    if SCARS:
        height = height + body_scars(pos, mask) * 0.9  # scar tissue stands a little proud of the skin
    if nails is not None:
        height = height * (1 - nails * 0.8) + nails * 1.2  # a smooth raised plate with a bevelled edge
    gy, gx = np.gradient(height)
    out = nrm.copy()
    out[..., 0] = np.clip(out[..., 0] - gx * strength, 0, 1)
    out[..., 1] = np.clip(out[..., 1] + gy * strength, 0, 1)
    return out


def skin_variation(colour, pos):
    """A body is not one tone. Sun (`sun_mask`): darker and warmer where it reaches. Blood: knees, elbows and knuckles
    a touch redder. Keyed on the rig's joints in the baked position map, so it lands on the body wherever the mesh is;
    applied before the median match, so the overall tone is unchanged and the neck seam still meets the scan."""
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    sun = sun_mask(pos)
    tan = np.array([0.86, 0.78, 0.68])[None, None, :]  # darker and warmer; blue drops most
    colour = colour * (1 - sun[..., None] * 0.7) + colour * tan * (sun[..., None] * 0.7)
    def blush(cx, cy, cz, r):
        return np.exp(-(((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (2 * r * r)))
    blood = np.zeros_like(sun)
    for side in (1, -1):
        e, h, k = P.elbow_l if side > 0 else P.elbow_r, P.hand_l if side > 0 else P.hand_r, P.calf_l if side > 0 else P.calf_r
        blood += blush(e.x, e.y + 0.03, e.z, 0.045)                        # elbow point (back of the joint)
        blood += blush(h.x + side * 0.06, h.y - 0.01, h.z + 0.01, 0.035)   # knuckles
        blood += blush(k.x, k.y - 0.04, k.z, 0.05)                         # kneecap (front)
    blood = np.clip(blood, 0, 1) * 0.5
    colour = colour * (1 + blood[..., None] * np.array([0.10, -0.02, -0.05])[None, None, :])
    return colour, sun


def body_colour(pos, mask, ao, detail, size, nails=None):
    """Body tiles: the same skin, dustier, with the scan mottle at half strength; veins, hair and (given) nails."""
    fbm = P.fbm
    base = (np.array([0.60, 0.44, 0.31]) if SKIN_TONE is None else SKIN_TONE)[None, None, :]  # matched to the scanned head when there is one
    tone = fbm(size, 41, octaves=(4, 8, 16, 32))[..., None]
    colour = base * (0.92 + tone * 0.18)
    colour[..., 1] *= 1 + (tone[..., 0] - 0.5) * 0.06
    colour[..., 0] *= 1 + (fbm(size, 42, octaves=(8, 16)) - 0.5) * 0.10
    colour = colour * (0.55 + 0.45 * np.clip(ao, 0, 1) ** 1.2)[..., None]
    colour = colour * (1 + (detail - 0.5) * 2.0)
    colour, sun = skin_variation(colour, pos)
    dust = np.clip((fbm(size, 1, octaves=(4, 8, 16, 64)) - 0.45) * 2.4, 0, 1)[..., None]
    colour = colour * (1 - dust * 0.22) + np.array([0.30, 0.28, 0.25])[None, None, :] * dust * 0.22
    global BODY_NORM
    if SKIN_TONE is not None:  # the unsunned skin's median lands on the scanned neck's, shading and dust included
        if BODY_NORM is None:  # the body tile sets the factor; the head tile's neck reuses it, so the two tiles meet at the collar on the same tone
            plain = mask & (sun < 0.1)
            BODY_NORM = SKIN_TONE / np.median(colour[plain if plain.sum() > 1000 else mask], axis=0)
        colour = colour * BODY_NORM[None, None, :]
    veins = body_veins(pos, mask)
    colour = colour * (1 - veins[..., None] * 0.14 * np.array([1.0, 0.85, 0.55])[None, None, :])  # a little darker and bluer
    colour = colour * (1 - body_hair(pos, mask)[..., None] * 0.4)
    if SCARS:  # healed cuts: paler, pinker, hairless tissue with a faint darker halo
        sc = body_scars(pos, mask)
        core = np.clip(sc * 1.4 - 0.4, 0, 1)[..., None]
        halo = np.clip(sc * 3, 0, 1)[..., None] - core
        pale = colour * np.array([1.26, 1.06, 1.00])[None, None, :]  # lighter, pinker tissue, hairless
        colour = colour * (1 - core) + pale * core
        colour = colour * (1 - halo * 0.14)
    if nails is not None:  # a paler, pinker plate with a pale lunula and a darker rim at the skin fold
        n, lu = nails
        rim = np.clip(n * 4, 0, 1) - n
        colour = colour * (1 + n[..., None] * np.array([0.10, 0.04, 0.02])[None, None, :]) * (1 + lu[..., None] * 0.12) * (1 - np.clip(rim, 0, 1)[..., None] * 0.18)
    if FIGHTERS[FIGHTER].get('pallor'):  # the Nightborn: the body takes the face's drain — skin_mul alone brightened but stayed
        luma = (colour @ np.array([0.30, 0.59, 0.11]))[..., None]  # warm, and a tan body beside the grey-white face read as two people
        colour = colour * 0.35 + luma * 0.65  # owner 2026-09-17: paler still
        colour *= np.array([0.96, 1.00, 1.06])[None, None, :]
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


def fill_margin(img, valid, steps=20):
    """Grow the baked texels into the unbaked margin (nearest-neighbour style, by iterated averaging of valid
    neighbours) so nothing dark bleeds through at UV seams via filtering and mips."""
    out = img.copy()
    ok = valid.copy()
    for _ in range(steps):
        if ok.all():
            break
        acc = np.zeros_like(out)
        cnt = np.zeros(ok.shape, np.float32)
        for shift, axis in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
            src = np.roll(out, shift, axis)
            sok = np.roll(ok, shift, axis)
            acc += src * sok[..., None]
            cnt += sok
        grow = (~ok) & (cnt > 0)
        out[grow] = acc[grow] / cnt[grow][..., None]
        ok = ok | grow
    return out


def clean_normal(n):
    """Texels where the bake rays hit the inside of a socket or the mouth come back as wild slopes; ease them flat."""
    tilt = np.sqrt((n[..., 0] - 0.5) ** 2 + (n[..., 1] - 0.5) ** 2)
    keep = np.clip((0.42 - tilt) / 0.12, 0, 1)[..., None]
    flat = np.array([0.5, 0.5, 1.0])[None, None, :]
    return n * keep + flat * (1 - keep)


# --- cards -------------------------------------------------------------------------------------------------------------

def card_texture(size=1024):
    """One RGBA strand sheet, eight 128-px columns: 0-3 hair clumps, 4-5 brow hairs, 6-7 a lash fan (root at the left).
    Strands are quadratic curves, tapered from a 2.5-px root to a sub-pixel tip, with soft anti-aliased alpha — the
    difference between hair and a marker stroke once the card is mip-mapped."""
    rng = np.random.default_rng(70)
    rgba = np.zeros((size, size, 4), np.float32)
    col_w = size // 8
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    dark = np.array([0.24, 0.165, 0.11])

    def strand(p0, p1, p2, root_w, tip_w, tint, y_range=None):
        # quadratic Bézier p0→p2 via p1, rasterised as a chain of 18 segments; alpha soft over 1 px, tapered
        bx0 = min(p0[0], p1[0], p2[0]) - 6
        bx1 = max(p0[0], p1[0], p2[0]) + 6
        by0 = min(p0[1], p1[1], p2[1]) - 6
        by1 = max(p0[1], p1[1], p2[1]) + 6
        x0, x1 = int(max(bx0, 0)), int(min(bx1, size))
        y0, y1 = int(max(by0, 0)), int(min(by1, size))
        if x1 <= x0 or y1 <= y0:
            return
        X, Y = xx[y0:y1, x0:x1], yy[y0:y1, x0:x1]
        best = np.full(X.shape, 1e9, np.float32)
        best_t = np.zeros(X.shape, np.float32)
        ts = np.linspace(0, 1, 19)
        pts = [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in ts]
        for (ax, ay), (bx, by), t in zip(pts[:-1], pts[1:], ts[:-1]):
            abx, aby = bx - ax, by - ay
            u = np.clip(((X - ax) * abx + (Y - ay) * aby) / (abx * abx + aby * aby + 1e-6), 0, 1)
            d = np.sqrt((X - (ax + u * abx)) ** 2 + (Y - (ay + u * aby)) ** 2)
            closer = d < best
            best = np.where(closer, d, best)
            best_t = np.where(closer, t + u / 18, best_t)
        w = root_w + (tip_w - root_w) * best_t
        a = np.clip((w / 2 + 0.5 - best), 0, 1)
        light = 0.8 + 0.5 * best_t  # tips catch the light
        for ch in range(3):
            rgba[y0:y1, x0:x1, ch] = rgba[y0:y1, x0:x1, ch] * (1 - a) + tint[ch] * light * a
        rgba[y0:y1, x0:x1, 3] = np.maximum(rgba[y0:y1, x0:x1, 3], a)

    for col in range(4):  # hair: a clump, root at v=0, tips at the top, gently splayed
        x_base = col * col_w
        for _ in range(34):
            x0 = x_base + rng.uniform(14, col_w - 14)
            top = rng.uniform(size * 0.55, size * 0.97)
            drift = rng.uniform(-40, 40)
            strand((x0, rng.uniform(0, size * 0.05)), (x0 + drift * 0.4, top * 0.55), (x0 + drift, top), rng.uniform(2.2, 3.2), 0.5,
                   dark * rng.uniform(0.7, 1.8) * np.array([1.0, rng.uniform(0.9, 1.0), rng.uniform(0.8, 1.0)]))
    for col in (4, 5):  # brows: fewer, finer, all leaning the same way like real brow hair
        x_base = col * col_w
        for _ in range(30):
            x0 = x_base + rng.uniform(10, col_w - 10)
            top = rng.uniform(size * 0.5, size * 0.92)
            lean = rng.uniform(10, 30)
            strand((x0, rng.uniform(0, size * 0.08)), (x0 + lean * 0.5, top * 0.5), (x0 + lean, top), rng.uniform(1.8, 2.6), 0.4, dark * rng.uniform(0.6, 1.2))
    for col in (6, 7):  # lashes: root at the left edge of the column, curling right and up, repeated down the column
        x_base = col * col_w
        for k in range(70):
            y0 = k * size / 70 + rng.uniform(-3, 3)
            reach = col_w * rng.uniform(0.5, 0.95)
            strand((x_base + 2, y0), (x_base + reach * 0.55, y0 - rng.uniform(4, 14)), (x_base + reach, y0 - rng.uniform(16, 34)), rng.uniform(2.0, 2.8), 0.4, dark * 0.6)
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


def hair_shells(head, F, layers=10, spacing=0.0005):
    """A buzz cut as fur shells: the scalp polygons copied `layers` times, each pushed out along the normal, one dotted
    alpha texture in the head's own UV layout, and a vertex-colour alpha that thins the outer shells so the crop tapers.
    Reads as dense short hair from every angle at any distance; no card silhouettes."""
    import bmesh
    me = head.data
    scalp_polys = []
    for poly in me.polygons:
        c = poly.center
        if scalp_mask(np.array([[[c.x, c.y, c.z]]], np.float32), F)[0, 0] > 0.08:  # the vertex feather ends the hair, not the polygon edge
            scalp_polys.append(poly.index)
    keep = set(scalp_polys)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    base = bpy.data.meshes.new('scalp')
    bm.to_mesh(base)
    bm.free()
    verts, faces, uvs, colours, normals = [], [], [], [], []
    ez = F['eye_l'].z
    xs = [v.co.x for v in base.vertices]
    ys = [v.co.y for v in base.vertices]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    feather = {v.index: float(scalp_mask(np.array([[[v.co.x, v.co.y, v.co.z]]], np.float32), F)[0, 0]) for v in base.vertices}  # noqa: F841
    full_normals = []
    for v in base.vertices:  # normals of the whole head, not of the cut-out: the scalp's centre seam must not split
        ok, loc, nrm, _ = head.closest_point_on_mesh(v.co)
        full_normals.append(nrm.normalized() if ok else v.normal.copy())
    for layer in range(layers):
        off = spacing * (layer + 1)
        t = layer / (layers - 1)
        shade = 0.6 + 0.5 * t  # roots dark, tips lit
        jitter = (((layer * 7919) % 97) / 97 - 0.5) * 0.006, (((layer * 104729) % 89) / 89 - 0.5) * 0.006  # per-shell UV shift: no dot columns
        start = len(verts)
        for v, nrm in zip(base.vertices, full_normals):
            height = min(1.0, max(0.0, (v.co.z - (ez + 0.02)) / 0.10))  # 0 at the ear tops, 1 on top: the fade
            alpha = (1.0 - 0.70 * t) * (0.5 + 0.5 * height)  # v16: taper and side fade in the density * min(1.0, max(0.0, (feather[v.index] - 0.15) / 0.45))  # taper, fade, hairline
            comb = Vector((0.0, 0.75, -0.66)) - nrm * Vector((0.0, 0.75, -0.66)).dot(nrm)  # back and down, along the skin
            verts.append(v.co + nrm * off + comb.normalized() * (0.0012 * t))  # v16: outer shells slide a little along the comb
            normals.append(nrm.copy())
            colours.append((shade, shade, shade, alpha))
        for poly in base.polygons:
            faces.append(tuple(start + i for i in poly.vertices))
            for li in poly.loop_indices:
                v = base.vertices[base.loops[li].vertex_index]  # top-down projection: one island, no seam over the crown
                uvs.append((start + v.index, ((v.co.x - x0) / (x1 - x0) * 2.0 + jitter[0], (v.co.y - y0) / (y1 - y0) * 2.0 + jitter[1])))
    out = bpy.data.meshes.new('hair_shells')
    out.from_pydata([tuple(v) for v in verts], [], faces)
    out.update()
    uv = out.uv_layers.new(name='UVMap')
    per_vertex = dict(uvs)
    for poly in out.polygons:
        for li in poly.loop_indices:
            uv.data[li].uv = per_vertex[out.loops[li].vertex_index]
    col = out.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for i, c in enumerate(colours):
        col.data[i].color = c
    out.normals_split_custom_set_from_vertices([tuple(n) for n in normals])
    obj = bpy.data.objects.new('hair_shells', out)
    bpy.context.collection.objects.link(obj)
    print(f'HAIR shells={layers} faces={len(faces)}')
    return obj


def shell_texture(size=1024):
    """Tiling dot field for the fur shells: each dot is one hair, its alpha its length (the outer shells' vertex alpha
    cuts the short ones first). Dark brown with a little variation. Sampled through the shells' own top-down UVs."""
    rng = np.random.default_rng(73)
    seed_dots = rng.random((size // 4, size // 4))
    length = rng.random((size // 4, size // 4)).astype(np.float32)
    hard = np.repeat(np.repeat(np.where(seed_dots < 0.72, 0.62 + 0.38 * length, 0.0).astype(np.float32), 4, 0), 4, 1)
    alpha = (hard + np.roll(hard, 1, 0) + np.roll(hard, -1, 0) + np.roll(hard, 1, 1) + np.roll(hard, -1, 1)) / 5  # soft round hairs, not squares
    tone = 0.75 + 0.5 * rng.random((size, size, 1))
    colour = np.array([0.15, 0.10, 0.07])[None, None, :] * tone  # dark brown, near-black at the roots
    return np.concatenate([np.clip(colour, 0, 1), alpha[..., None]], axis=2).astype(np.float32)


def brow_cards(head, F, rng_seed=72, dense=False, count=None):
    """Two rows of single-hair cards along each brow ridge: heavy and upward at the nose, sweeping outward and down
    toward the temple."""
    ey, ez = F['eye_l'].y, F['eye_l'].z
    rng = np.random.default_rng(rng_seed)
    mesh = CardMesh()
    count = 0
    for sx in (1, -1):
        rows = ((0, 0.0), (1, 0.0016), (2, -0.0013)) if dense else ((0, 0.0),)  # painted face: the cards are the brow
        if count == 0:  # the portrait carries the brows
            rows = ()
        for row, dz in rows:
            for k in range(30 if dense else 22):
                t = (k + rng.uniform(0.1, 0.9)) / (30 if dense else 22)
                x = sx * (0.011 + 0.043 * t)
                z = ez + 0.010 + 0.011 * math.sin(math.pi * t ** 0.85) + dz  # on the brow bone, where the portrait's brow is
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
    normal_obj, normal_obj_body = [n[..., :3] * 2 - 1 for n in bake_tiles(body, 'NORMAL', [size, size // 2], select_only, normal_space='OBJECT')]
    detail_colour, detail_height = scan_detail(size)
    lid_ring = F['lid_ring']
    photo = None
    height = height_map(pos_face, mask_face, F, detail_height, size)
    displace_high(high, height, select_only)
    nrm_face, nrm_body = [clean_normal(n[..., :3]) for n in bake_tiles(body, 'NORMAL', [size, size], select_only, high=high, samples=8, margin=8)]
    colour_face = face_colour(pos_face, mask_face, F, P.upsample(ao_face, size), detail_colour, size, photo)
    if os.environ.get('BODY_DUMP'):  # the body tile's inputs, for tuning its paint offline
        np.savez_compressed(os.environ['BODY_DUMP'], pos=pos_body.astype(np.float32), mask=mask_body, ao=ao_body.astype(np.float32), detail=detail_colour.astype(np.float16), nrm=nrm_body.astype(np.float16), pos_face=pos_face.astype(np.float32), mask_face=mask_face, ao_face=ao_face.astype(np.float32),
                            skin_tone=SKIN_TONE, joints=np.array([list(v) for v in (P.pelvis, P.neck, P.head, P.shoulder_l, P.shoulder_r, P.elbow_l, P.elbow_r, P.hand_l, P.hand_r, P.foot_l, P.foot_r, P.calf_l, P.calf_r)], np.float32))
    nails = body_nails(pos_body, mask_body, normal_obj_body)
    colour_body = body_colour(pos_body, mask_body, P.upsample(ao_body, size), detail_colour, size, nails=nails)
    rough_face = face_roughness(pos_face[::2, ::2], F, detail_colour[::2, ::2], size // 2)
    sun_body = sun_mask(pos_body)
    rough_body = np.clip(0.72 - 0.17 * sun_body[::2, ::2] + (detail_colour[::2, ::2, 0] - 0.5) * 0.3 - 0.35 * nails[0][::2, ::2], 0.3, 0.95)  # a sheen on the sunned limbs, matte torso, glossy nails
    if SCARS:
        rough_body = np.clip(rough_body - 0.25 * np.clip(body_scars(pos_body, mask_body) * 1.4 - 0.4, 0, 1)[::2, ::2], 0.3, 0.95)  # healed tissue is smoother than the skin around it
    nrm_body = body_normal(nrm_body, pos_body, mask_body, body_hair(pos_body, mask_body), body_veins(pos_body, mask_body), nails=nails[0])
    def orm(rough):
        return np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    colour_face, nrm_face = fill_margin(colour_face, mask_face), fill_margin(nrm_face, mask_face)
    maps = {
        'Face': {'baseColor': save_two_sizes('face_color', colour_face, 'sRGB'), 'normal': save_two_sizes('face_normal', nrm_face, 'Non-Color'),
                 'metallicRoughness': save_jpeg('face_orm', orm(rough_face), 'Non-Color')},
        'Skin': {'baseColor': save_two_sizes('skin_color', colour_body, 'sRGB'), 'normal': save_two_sizes('skin_normal', nrm_body, 'Non-Color'),
                 'metallicRoughness': save_jpeg('skin_orm', orm(rough_body), 'Non-Color')},
        'HairCards': {'baseColor': save_png_rgba(os.path.join(materials_out, 'hair_cards.png'), card_texture())},
    }
    head, rest = separate_head(body, select_only)
    tag(head, 'Head', 'Face', slot='Face')
    tag(rest, 'Body', 'Skin', slot='Skin')
    if SKIN_TONE is not None:  # the scanned head replaces everything above its neck stub: this tile's neck is painted like the body
        below = np.clip((F['kt_neck_z'] + 0.02 - pos_face[..., 2]) / 0.02, 0, 1)[..., None]
        near = np.clip((pos_face[..., 2] - (F['kt_neck_z'] - 0.025)) / 0.025, 0, 1)[..., None]  # 1 at the stub's edge, 0 2.5 cm below
        flat = SKIN_TONE[None, None, :]  # what the stub fades to (keentools_head): both sides meet on the same flat tone
        body_style = body_colour(pos_face, mask_face, P.upsample(ao_face, size), detail_colour, size)
        colour_face = fill_margin(colour_face * (1 - below) + (body_style * (1 - near) + flat * near) * below, mask_face)
        maps['Face']['baseColor'] = save_two_sizes('face_color', colour_face, 'sRGB')
        soft = np.clip(ao_face ** 1.3, 0, 1)  # the body's occlusion map, in this tile's own layout, so the two necks shade alike
        soft = soft * (1 - P.downsample(near, size // ao_face.shape[0])[..., 0]) + P.downsample(near, size // ao_face.shape[0])[..., 0]
        maps['Face']['occlusion'] = save_jpeg('face_ao', np.stack([soft, soft, soft], axis=2), 'Non-Color')
    elif os.path.exists(PHOTO) and os.environ.get('HEAD_PHOTO', '1') == '1':
        photo = photo_layer_multi(pos_face, normal_obj, F, lid_ring, size, head)
        colour_face = fill_margin(face_colour(pos_face, mask_face, F, P.upsample(ao_face, size), detail_colour, size, photo), mask_face)
        maps['Face']['baseColor'] = save_two_sizes('face_color', colour_face, 'sRGB')
    hair = tag(hair_shells(head, F), 'hair_shells', 'HairShell', bone='Head', slot='Hair')
    maps['HairShell'] = {'baseColor': save_png_rgba(os.path.join(materials_out, 'hair_shell.png'), shell_texture())}
    brows = tag(brow_cards(head, F, dense=photo is None, count=0 if photo is not None else None), 'brow_cards', 'BrowCards', bone='Head', slot='Face')
    maps['BrowCards'] = dict(maps['HairCards'])  # same sheet, sharper cut-off in the build
    # Lash strips are off: with the lids closed they crossed the opening as a line. Back once placed on the scanned lid edge.
    return {'maps': maps, 'ao_body': ao_body, 'head': head, 'body': rest, 'parts': [head, rest, hair, brows],
            'tiles': {'colour_face': colour_face, 'colour_body': colour_body, 'pos_face': pos_face, 'pos_body': pos_body,
                      'mask_face': mask_face, 'mask_body': mask_body, 'ao_face': ao_face, 'ao_body': ao_body, 'detail': detail_colour, 'size': size, 'nails': nails}}


# --- KeenTools reconstructed head (photogrammetry from the owner's five portraits) ----------------------------------

# One scan per fighter. `cams` are the portraits' (azimuth, elevation) in degrees — azimuth + = camera on the character's
# left, elevation + = from below — for the coverage mask; `chin` = the owner's chin push, sketched for the hero's scan
# only; `hair_lum` = the sRGB luminance below which a texel beside the unseen crown counts as photographed hair (0.16
# for a dark buzz cut; the blond-grey Veteran's hair measures 0.34 median against 0.66 skin, 2026-09-16); `hair` = how the
# unphotographed crown is filled: 'buzz' (scalp grain in the hair tone) or 'full' (swept-back strands in the hair's own
# shadow and highlight tones).
FIGHTERS = {
    'hero': {'kt_glb': 'artifacts/source/keentools/01a0a628-a661-7ec2-89ec-735ecb733b5f.glb',  # eight portraits: the five plus three from below for the jaw (2026-09-15)
             'cams': ((0, 0), (35, 0), (-35, 0), (90, 0), (-90, 0), (0, 40), (-45, 40), (0, 15)), 'chin': True, 'hair_lum': 0.16, 'hair': 'buzz', 'scars': False, 'decimate': 0.28},
    'veteran': {'kt_glb': 'artifacts/source/keentools/01a0a9a9-c037-70f2-8015-bbd1faf9f823.glb',  # seven portraits (front, ±35, ±90, two from below), 2026-09-16
                'cams': ((0, 0), (30, 0), (-25, 0), (90, 0), (-90, 0), (0, 28), (-22, 24)), 'chin': True, 'hair_lum': 0.50, 'hair': 'full', 'scars': True, 'decimate': 0.26},  # decimate: helmed, crown stripped — the budget goes to the helm and greaves; chin: his scan's jaw is the same vertical wall the hero's was (tip -0.76, underside -0.88 scan units) — the owner's U applies
    # The Nightborn (opponent 5): seven owner portraits (front, from below, from above, ±35, ±90) 2026-09-16 23:13, artifacts/source/face/nightborn/.
    # kt_glb is a STAND-IN (the hero's scan) until the KeenTools account has credits (the 23:0x job stopped at 402 after the uploads);
    # re-run scripts/create-head.mjs on the seven and point this at the new GLB. Until then the stand-in is RESTYLED to his brief
    # (2026-09-17, the no-credits pass): skin_mul pales him grey-white, pallor drains the face's health and sinks his eyes,
    # dark_eyes near-blacks the iris; the pointed ears and the throat scar are parts.py/face_colour on the same flags.
    'nightborn': {'kt_glb': 'artifacts/source/keentools/01a0a628-a661-7ec2-89ec-735ecb733b5f.glb',
                  'cams': ((0, 0), (0, 25), (0, -20), (35, 0), (-35, 0), (90, 0), (-90, 0)), 'chin': True, 'hair_lum': 0.16, 'hair': 'full', 'scars': True, 'decimate': 0.26,  # decimate: the Veteran's — the budget goes to the sleeves, hose and boots
                  'skin_mul': (1.34, 1.42, 1.58), 'pallor': True, 'dark_eyes': True, 'red_eyes': True},  # skin_mul: the hero's olive scan paled and cooled to his brief's grey-white; red_eyes: the owner, 2026-09-17 — the brief's "no red eyes" yielded (a deep ember, no glow)
    'pitborn': {'kt_glb': 'artifacts/source/keentools/01a0ab5b-b143-7531-ad79-6de9bacbf0fa.glb',  # seven owner portraits (front, ±35, ±90, from below, from above), 2026-09-16
                'cams': ((0, 0), (35, 0), (-35, 0), (90, 0), (-90, 0), (0, 25), (0, -20)), 'chin': False, 'hair_lum': 0.38, 'hair': 'buzz', 'scars': True, 'decimate': 0.28, 'skin_mul': (0.74, 0.80, 0.84)},  # shaved green scalp: stubble darker than skin; no helm, so the crown keeps its budget; skin_mul: v1 body came out tan [.479 .425 .315] beside a grey-green head — darker, less red
    'goblin': {'kt_glb': 'artifacts/source/keentools/01a0ab81-4cff-7871-bac7-adfa28d57d0b.glb',  # seven owner portraits (front, ±35, ±90, from below, from above), 2026-09-16 22:33
               'cams': ((0, 0), (35, 0), (-35, 0), (90, 0), (-90, 0), (0, 25), (0, -20)), 'chin': False, 'hair_lum': 0.42, 'hair': 'buzz', 'scars': True, 'decimate': 0.28, 'skin_mul': (0.80, 0.77, 0.78), 'backdrop_cool': True},  # stubbled bald scalp (hair_lum .42: the photographed stubble is lum ~.32 — at .30 the fill took only its shadows and printed a dark band round a pale crown); no helm; skin_mul: v1 body rendered (178,154,125) beside a (143,115,97) cheek — tan and 25–30 % too bright for the grey-brown face; backdrop_cool: the grey backdrop smeared onto the crown
    # The Executioner (opponent 6): seven GPT portraits (front, ±35, ±90, from below ~25°, from above ~20°), 2026-09-17,
    # artifacts/source/face/executioner/. kt_glb is a STAND-IN (the hero's scan) until the KeenTools account has credits —
    # the 22:1x job stopped at 402 AFTER the uploads; resume with
    # `node scripts/create-head.mjs artifacts/source/keentools --avatar 01a0b094-dcd8-7792-835d-5bdb88f42cf6` and point this at the new GLB.
    # Masked and hooded in game — the iron half-mask and ragged hood are kit parts (parts.py), so chin is off (the jaw sits
    # behind iron) and the crown's budget goes to the hood. Dark stubble under the hood. decimate 0.08, far below every
    # other fighter: his face is never seen (only eyes/brow, which are separate meshes with their own ratios, and the skin
    # normal map is baked from the full-res head), and the v3 head at the Veteran's helmed 0.26 broke the 60k skinned-triangle
    # ceiling (61,363 — tests/characters); 0.20 still shipped 60,827. 0.08 lands ~59.7k with margin.
    'executioner': {'kt_glb': 'artifacts/source/keentools/01a0a628-a661-7ec2-89ec-735ecb733b5f.glb',
                    'cams': ((0, 0), (35, 0), (-35, 0), (90, 0), (-90, 0), (0, 25), (0, -20)), 'chin': False, 'hair_lum': 0.14, 'hair': 'buzz', 'scars': False, 'decimate': 0.08},
}
FIGHTER = 'hero'
KT_GLB = FIGHTERS[FIGHTER]['kt_glb']
CAMS = FIGHTERS[FIGHTER]['cams']
CHIN = FIGHTERS[FIGHTER]['chin']
HAIR_LUM = FIGHTERS[FIGHTER]['hair_lum']
HAIR = FIGHTERS[FIGHTER]['hair']
SCARS = FIGHTERS[FIGHTER]['scars']  # old wounds on the body tile (body_scars): a veteran's record, per GAME_SPEC's persistent scars
DECIMATE = FIGHTERS[FIGHTER]['decimate']  # the scan head's decimate ratio for the phone mesh


def select_fighter(name):
    """Point the scan pipeline at one fighter's portraits and tuning (parts.py --fighter <name>; default hero)."""
    global FIGHTER, KT_GLB, CAMS, CHIN, HAIR_LUM, HAIR, SCARS, DECIMATE
    f = FIGHTERS[name]
    FIGHTER, KT_GLB, CAMS, CHIN, HAIR_LUM, HAIR, SCARS, DECIMATE = name, f['kt_glb'], f['cams'], f['chin'], f['hair_lum'], f['hair'], f['scars'], f['decimate']


SKIN_TONE = None  # linear skin colour sampled from the scanned neck; the painted body and neck stub take it as their base
NECK_DROP_KT = 0.99  # the scanned head is cut this far below eye level IN SCAN UNITS (≈10 cm at the eye-spacing scale): just under the jaw, where the skin weights are all neck and head (lower, the base body's clavicle weights tear the seam in pose)
SCALE = None       # scan units → metres, set by keentools_skin_tone
BODY_NORM = None   # the body tile's tone normalisation, reused by the head tile's neck
RING_TONE = None   # the photographed head's tone arriving at the collar, per azimuth around the neck (bins × RGB): what the neck below continues
SCALE_HEIGHT = None  # the scan's scale before the owner's +10%
NECK_Z = None      # the cut height in rig space, set by keentools_skin_tone
KT = None         # (object, images, slot_names) once imported


def keentools_import():
    """Import the KeenTools GLB once: the single mesh with four material slots (Head, EyeLeft, EyeRight, Teeth)."""
    global KT
    if KT is not None:
        return KT
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=KT_GLB)
    kt = next(o for o in set(bpy.data.objects) - before if o.type == 'MESH')
    bpy.context.view_layer.update()
    for o in set(bpy.data.objects) - before:
        if o is not kt:
            bpy.data.objects.remove(o, do_unlink=True)
    kt.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    kt.select_set(True)
    bpy.context.view_layer.objects.active = kt
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    images, slot_names = {}, []
    for i, m in enumerate(kt.data.materials):  # the importer's textures, by slot
        node = next((n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None) if m and m.use_nodes else None
        images[i] = node.image if node else None
        slot_names.append(m.name if m else '')
    KT = (kt, images, slot_names)
    return KT


def keentools_skin_tone(eye_l, eye_r, crown_z):
    """Median linear colour of the scan's neck band (the stub's height, once scaled to the rig), so the painted body can be
    matched to the photographed head before it is painted. Also fixes the scan's scale (eye level → crown against the base
    head's, `SCALE`) and the height of the cut under the jaw (`NECK_Z`), which everything downstream shares."""
    global SKIN_TONE, SCALE, NECK_Z, SCALE_HEIGHT
    kt, images, _ = keentools_import()
    mesh = kt.data
    eye_slots = [i for i in (1, 2) if i < len(mesh.materials)]
    cents = []
    for slot in eye_slots:
        vs = {v for p in mesh.polygons if p.material_index == slot for v in p.vertices}
        cents.append(sum((mesh.vertices[v].co for v in vs), Vector()) / len(vs))
    mid = (cents[0] + cents[1]) / 2
    kt_top = max(v.co.z for p in mesh.polygons if p.material_index == 0 for v in [mesh.vertices[i] for i in p.vertices])
    eye_scale = abs(eye_l.x - eye_r.x) / abs(cents[0].x - cents[1].x)
    scale = 1.10 * (crown_z - (eye_l.z + eye_r.z) / 2) / (kt_top - mid.z)  # by head height, then +10% (owner's call, 2026-09-15: a heroic read at the phone camera)
    SCALE_HEIGHT = scale / 1.10  # the size at which the scan's head matches the base head's height — the base head is a target at that size
    SCALE = scale
    NECK_Z = (eye_l.z + eye_r.z) / 2 - NECK_DROP_KT * scale
    print(f'KEENTOOLS head scale by height {scale:.4f} (by eye spacing it would be {eye_scale:.4f}, {scale / eye_scale:.2f}x); cut {NECK_DROP_KT * scale * 100:.1f} cm below the eyes')
    lo, hi = mid.z - NECK_DROP_KT - 0.45, mid.z - NECK_DROP_KT  # the stub's band, in scan units
    uv = mesh.uv_layers.active.data
    w, h = images[0].size
    px = np.empty(w * h * 4, np.float32)
    images[0].pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[:, :, :3]
    samples = []
    for p in mesh.polygons:
        if p.material_index != 0 or not (lo < p.center.z < hi):
            continue
        for li in p.loop_indices:
            u, v = uv[li].uv
            samples.append(px[min(h - 1, int((1 - v) * h)), min(w - 1, int(u * w))])
    samples = np.array(samples)
    samples = samples[samples.max(axis=1) > 0.06]  # skip un-photographed texels
    neck_tone = np.median(samples, axis=0)
    # the body's tone comes from the lit face, not the neck band under the jaw (photographed in the chin's shadow: the
    # body painted to it read paler and pinker than the face under the same light). Cheekbones and forehead, forward-facing.
    ys = [p.center.y for p in mesh.polygons if p.material_index == 0]
    fwd = -1.0 if (mid.y - min(ys)) < (max(ys) - mid.y) else 1.0  # the nose is nearer the eyes than the back of the skull
    face = []
    for p in mesh.polygons:
        if p.material_index != 0 or p.normal.y * fwd < 0.35:
            continue
        dz, dx = p.center.z - mid.z, abs(p.center.x - mid.x)
        if not ((-0.42 < dz < -0.20 and 0.22 < dx < 0.55) or (0.25 < dz < 0.60 and dx < 0.40)):  # cheekbones (above the beard line) and forehead
            continue
        for li in p.loop_indices:
            u, v = uv[li].uv
            face.append(px[min(h - 1, int((1 - v) * h)), min(w - 1, int(u * w))])
    face = np.array(face)
    face = face[face.max(axis=1) > 0.06]
    lum = np.array([0.30, 0.59, 0.11])
    face_tone = np.median(face, axis=0) if len(face) > 500 else neck_tone
    SKIN_TONE = face_tone * (neck_tone @ lum) / (face_tone @ lum)  # the face's hue at the neck band's brightness (the lit cheek itself renders near white; the body painted to the neck band alone read pink-grey beside the face)
    SKIN_TONE = SKIN_TONE * np.array(FIGHTERS[FIGHTER].get('skin_mul', (1.0, 1.0, 1.0)))  # per-fighter correction: the Pitborn's neck band is lit paler and warmer than his grey-green cheeks
    print(f'KEENTOOLS skin tone {np.round(SKIN_TONE, 3)}: hue of {len(face)} cheek/forehead texels {np.round(face_tone, 3)}, brightness of the neck band {np.round(neck_tone, 3)} ({len(samples)} texels; values are sRGB-encoded, as Blender pixels are)')
    return SKIN_TONE


def keentools_head(weights_from, eye_l, eye_r, armature, select_only, tag, save_jpeg_fn, save_two_sizes_fn, materials_out, size=2048):
    """Bring the KeenTools head (Head, EyeLeft, EyeRight, Teeth; 4K textures) onto the rig: scaled by eye spacing,
    eyes aligned to the base eyes, shoulders cut off, skin weights from the body by nearest surface, head decimated for
    the phone with a normal map baked from the full mesh, textures resampled, the untextured crown filled from its
    neighbours. Returns (parts, maps, neck_z): everything above neck_z on the body's Face tile is replaced."""
    kt, images, slot_names = keentools_import()
    select_only([kt])
    # split by material into four objects
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    pieces = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    by_slot = {}
    for o in pieces:  # each piece keeps one material after the split: map it back to the original slot by name
        used = [m.name for m in o.data.materials if m]
        by_slot[slot_names.index(used[0]) if used and used[0] in slot_names else len(by_slot)] = o
    head, eye_a, eye_b, teeth = by_slot[0], by_slot[1], by_slot[2], by_slot[3]
    def centroid(o):
        return sum((v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
    ca, cb = centroid(eye_a), centroid(eye_b)
    kt_eye_l, kt_eye_r = (eye_a, eye_b) if ca.x > cb.x else (eye_b, eye_a)
    if eye_l.x < eye_r.x:  # the rig names its eyes from the viewer's side; match by position, never by name
        eye_l, eye_r = eye_r, eye_l
    cl, cr = centroid(kt_eye_l), centroid(kt_eye_r)
    scale = SCALE if SCALE is not None else (eye_l.x - eye_r.x) / (cl.x - cr.x)  # keentools_skin_tone sized it by head height
    kt_mid = (cl + cr) / 2
    rig_mid = (eye_l + eye_r) / 2
    M = Matrix.Translation(rig_mid) @ Matrix.Scale(scale, 4) @ Matrix.Translation(-kt_mid)
    for o in (head, kt_eye_l, kt_eye_r, teeth):
        o.data.transform(M)
        o.data.update()
    # shoulders off: keep the head and a neck stub
    neck_z = NECK_Z if NECK_Z is not None else rig_mid.z - NECK_DROP_KT * scale
    bm = bmesh.new()
    bm.from_mesh(head.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < neck_z - 0.03], context='FACES')
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, neck_z), plane_no=(0, 0, 1), clear_inner=True)  # a clean level edge
    bm.to_mesh(head.data)
    bm.free()
    for poly in head.data.polygons:
        poly.use_smooth = True
    # the phone mesh: decimated copy, normal map baked from the full one
    full = head.copy()
    full.data = head.data.copy()
    full.name = 'kt_head_full'
    bpy.context.collection.objects.link(full)
    keep = head.vertex_groups.new(name='decimate')  # the level bottom edge survives the collapse
    keep.add([v.index for v in head.data.vertices if v.co.z > neck_z + 0.003], 1.0, 'REPLACE')
    dec = head.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = DECIMATE
    dec.use_collapse_triangulate = True
    dec.vertex_group = 'decimate'
    dec.vertex_group_factor = 1.0
    select_only([head])
    bpy.ops.object.modifier_apply(modifier='Decimate')
    head.vertex_groups.remove(head.vertex_groups['decimate'])
    for o, ratio in ((teeth, 0.06), (kt_eye_l, 0.5), (kt_eye_r, 0.5)):  # the scan's teeth and eyes are far denser than a phone needs
        dec = o.modifiers.new('Decimate', 'DECIMATE')
        dec.ratio = ratio
        dec.use_collapse_triangulate = True
        select_only([o])
        bpy.ops.object.modifier_apply(modifier='Decimate')
    ring = [v.co for v in head.data.vertices if v.co.z < neck_z + 0.012]  # the stub's bottom edge: the neck axis
    neck_c = sum(ring, Vector()) / max(1, len(ring))
    # weights from the fitted body (the base head, whose tile carries the neck; not the headless torso), then the rig
    for o in (head, kt_eye_l, kt_eye_r, teeth):
        select_only([weights_from, o])
        bpy.ops.object.data_transfer(data_type='VGROUP_WEIGHTS', vert_mapping='POLYINTERP_NEAREST', layers_select_src='ALL', layers_select_dst='NAME', use_create=True)
        arm = o.modifiers.new('Armature', 'ARMATURE')
        arm.object = armature
    # the stub's lower band slides onto our neck so the silhouette runs straight into the body: aimed at a copy of our
    # head already cut to the neck, so the rays never meet our chin. (Drawing our neck out to the scan's collar instead
    # flares it under the jaw — the scan is wider there.)
    neck_only = weights_from.copy()
    neck_only.data = weights_from.data.copy()
    bpy.context.collection.objects.link(neck_only)
    cut_above(neck_only, neck_z + 0.0015, select_only)
    # the collar blend must stay under the chin: on this scan the chin's underside is 0.14 scan units above the cut
    # (profile measured 2026-09-15: lips at -0.51…-0.66, chin tip -0.75, underside -0.85, cut -0.99 below eye level), so
    # the geometric band is 0.10 units and the texture fade 0.14 — detecting the chin from the profile found the lip once
    band = 0.10 * scale
    # the scan's jaw runs as a near-vertical wall from the lip crease to the cut (front y recedes 7 mm over 2.7 cm), and the
    # short collar turned it into a shelf under the chin that read as a cut just below the lips. On the front, below the chin
    # tip (-0.78), the blend now runs over 0.21 units so the underside curves back to the throat the way a jaw does
    front_band, front_from = 0.145 * scale, rig_mid.z - 0.80 * scale  # the chin wall stays to -0.85, then the underside turns back to the throat over the last 1.8 cm (a 0.21 band pulled the chin tip into a beak)
    print(f'KEENTOOLS collar band {band * 100:.1f} cm; jaw underside band {front_band * 100:.1f} cm below the chin tip')
    fade_vg = head.vertex_groups.new(name='seam_fade')  # the texture's fade to the body tone: taller than the geometric collar, still under the chin
    fade_band = 0.09 * scale  # the eight-view scan photographed the underside of the jaw: keep its stubble, fade only the last centimetre
    for v in head.data.vertices:  # from the heights before the chin is lowered: the lowered chin tip is not part of the collar (painted flat, it read as a pale patch under the chin)
        b = fade_band * (0.3 if v.co.y < neck_c.y - 0.02 else 1.0)  # ahead of the neck axis the collar sits in the jaw's shadow, and the scan's whole (short) underside lay within the band: a short fade there, so the lowered underside keeps its stubble
        t = min(1.0, max(0.0, (v.co.z - neck_z) / b))
        w = 1 - t * t * (3 - 2 * t)
        if w > 0:
            fade_vg.add([v.index], w, 'REPLACE')
    for o in (head, full):  # the bake source too, so the normal map still lines up at the neck
        neck_blend(o, neck_only, neck_z, neck_c, band=band, front_band=front_band, front_from=front_from)
        if os.environ.get('HEAD_CHIN', '1' if CHIN else '0') == '1':  # after the collar blend, so the lowered chin is not pulled back onto the neck outline
            chin_strong(o, rig_mid, scale, neck_c, stretch_group=(o is head))
    level_mouth([full, head], rig_mid, scale)  # the tilt measured on the full mesh, the same roll applied to both
    bpy.data.objects.remove(neck_only, do_unlink=True)
    cut_above(weights_from, neck_z + 0.0015, select_only)  # our head goes; our neck ends just inside the scan's collar
    seam = bake_attribute(head, 'seam_fade', select_only, size)  # where the stub fades into the body, in texture space
    back_vg = head.vertex_groups.new(name='back')  # the nape: vertices facing backward, for the collar's occlusion
    head.data.update()
    for v in head.data.vertices:
        b = min(1.0, max(0.0, (v.normal.y - 0.1) / 0.5))
        if b > 0:
            back_vg.add([v.index], b, 'REPLACE')
    back = bake_attribute(head, 'back', select_only, size)
    head.vertex_groups.remove(head.vertex_groups['back'])
    ao_kt = P.upsample(bake_ao_single(head, select_only, size // 2, samples=64), size)  # the scan's own occlusion, body present
    head.vertex_groups.remove(head.vertex_groups['seam_fade'])
    # the collar's shading: at a mesh edge the vertex normals only know the faces above, so the stub's bottom ring lit
    # differently from the neck it sits on and printed a line. Its normals now come from our neck, fading out up the band.
    if os.environ.get('HEAD_COLLAR_NORMALS', '0') == '1':  # experiment: borrowed normals along the ring (off: they lit the band as a pale strip at the nape)
        dt = head.modifiers.new('CollarNormals', 'DATA_TRANSFER')
        dt.object, dt.use_loop_data, dt.data_types_loops, dt.loop_mapping = weights_from, True, {'CUSTOM_NORMAL'}, 'NEAREST_POLYNOR'
        dt.vertex_group, dt.mix_mode, dt.mix_factor = 'neck_blend', 'REPLACE', 1.0
        select_only([head])
        bpy.ops.object.modifier_move_to_index(modifier='CollarNormals', index=0)
        bpy.ops.object.modifier_apply(modifier='CollarNormals')
    head.vertex_groups.remove(head.vertex_groups['neck_blend'])  # not a bone
    zone = head.vertex_groups.new(name='hair_zone')  # above the nape hairline (eye level and up), for the crown fill
    for v in head.data.vertices:
        h = (v.co.z - (neck_z + 0.01)) / 0.02  # hair right down to the collar at the back, like the photographed sides; the seam fade then draws one continuous nape hairline
        if h > 0:
            zone.add([v.index], min(1.0, h), 'REPLACE')
    hair_zone = bake_attribute(head, 'hair_zone', select_only, size)
    head.vertex_groups.remove(head.vertex_groups['hair_zone'])
    scalp_vg = head.vertex_groups.new(name='scalp')  # the top and back of the skull above the brow line: where the photographed hair is (not the forehead, temples or nape skin)
    for v in head.data.vertices:
        q = max(v.normal.z, v.normal.y)  # facing up or back
        w = min(1.0, max(0.0, (q - 0.15) / 0.35)) * min(1.0, max(0.0, (v.co.z - (rig_mid.z + 0.03)) / 0.03))
        if w > 0:
            scalp_vg.add([v.index], w, 'REPLACE')
    scalp = bake_attribute(head, 'scalp', select_only, size)
    head.vertex_groups.remove(head.vertex_groups['scalp'])
    cams = [Vector((math.sin(math.radians(a)) * math.cos(math.radians(e)), -math.cos(math.radians(a)) * math.cos(math.radians(e)), -math.sin(math.radians(e))))
            for a, e in CAMS]  # this fighter's portraits (azimuth, elevation from below): the direction the surface must face to have been photographed
    cover = head.vertex_groups.new(name='coverage')  # how squarely the best photograph saw each vertex
    head.data.update()
    for v in head.data.vertices:
        q = max(v.normal.dot(c) for c in cams)
        if q > 0:
            cover.add([v.index], min(1.0, q), 'REPLACE')
    coverage = bake_attribute(head, 'coverage', select_only, size)
    head.vertex_groups.remove(head.vertex_groups['coverage'])
    stretch = bake_attribute(head, 'stretch', select_only, size) if 'stretch' in head.vertex_groups else np.zeros((size, size), np.float32)
    if 'stretch' in head.vertex_groups:
        head.vertex_groups.remove(head.vertex_groups['stretch'])
    front = None
    if HAIR == 'full':  # the stretched chin's donor stubble must come from the face: with hair to the nape, the same texture rows hold hair beside the jaw
        front_vg = head.vertex_groups.new(name='front')
        for v in head.data.vertices:
            w = min(1.0, max(0.0, (neck_c.y - v.co.y) / 0.03))  # ahead of the neck axis, as chin_strong picks its vertices
            if w > 0:
                front_vg.add([v.index], w, 'REPLACE')
        front = bake_attribute(head, 'front', select_only, size)
        head.vertex_groups.remove(head.vertex_groups['front'])
    # textures: resample the 4K head colour to 2K/1K, eyes to 512; fill the untextured crown from its neighbours
    def pixels(img):
        w, h = img.size
        px = np.empty(w * h * 4, np.float32)
        img.pixels.foreach_get(px)
        return px.reshape(h, w, 4)[:, :, :3]
    colour = pixels(images[0])
    colour = P.downsample(colour, colour.shape[0] // size) if colour.shape[0] > size else colour
    seen_edge = 0.6 + (0.16 * (hair_streaks(size, seed=13) - 0.5) * (scalp > 0.5) if HAIR == 'full' else 0)  # full hair: the photographed tufts end ragged along the strands, not on one coverage iso-line
    dark = (colour.max(axis=2) < 0.06) | ((coverage < seen_edge) & ((hair_zone > 0.5) | (back > 0.3))) | (coverage < 0.3)
    if FIGHTERS[FIGHTER].get('backdrop_cool'):  # the portraits' neutral backdrop projected onto the crown at grazing angles: a cool texel (blue ≥ 85 % of red) above the hairline is neither skin nor stubble — unseen, so the fill covers it (per fighter: grey hair is cool too)
        backdrop = (hair_zone > 0.5) & (colour[:, :, 2] >= colour[:, :, 0] * 0.85)   # skin and stubble here run b ≈ .6–.7 r; the backdrop's graded edge ~.9
        print(f'KEENTOOLS backdrop on the crown: {int((backdrop & ~dark).sum())} cool texels marked unseen')
        dark = dark | backdrop  # black; the crown, back and nape seen only at a grazing angle (a smear, or the portrait's grey backdrop); elsewhere only what no camera saw at all — the under-chin stubble is real and stays
    filled = crown_fill(colour, dark, size, hair_zone, coverage=coverage, scalp=scalp)
    crown_w = np.clip(1 - blur((~dark).astype(np.float32), 16) * 1.6, 0, 1) * dark * (scalp > 0.5) if HAIR == 'full' else np.zeros((size, size), np.float32)  # where the crown is synthesised strands (crown_fill's own blend weight)
    island = bake_attribute(head, None, select_only, size, margin=0) > 0.5  # the texture's islands
    filled = stretch_refill(filled, 1 + 4 * stretch, dark | (coverage < 0.6), island, size, front=front)  # the lowered chin: its stretched photo's grain re-covered at a density that survives the stretch
    filled = delight(filled, dark | (coverage < 0.6))  # the portraits' key light is baked in: the lit cheeks and forehead rendered brighter and shinier than the body
    fade = np.clip(seam * 1.1, 0, 1)  # fully flat at the very edge, so it carries none of the photograph's lighting
    if SKIN_TONE is not None:  # the photograph's baked neck lighting flattens to the body's albedo towards the seam
        mottle = (0.92 + P.fbm(size, 41, octaves=(4, 8, 16, 32)) * 0.18)[..., None]  # the painted body's own tone noise, so the band is skin, not paint
        global RING_TONE
        RING_TONE = ring_tones(head, filled, neck_z, neck_c, size)  # the head's own tone just above the band, around the neck
        az_c, az_s = head.vertex_groups.new(name='az_c'), head.vertex_groups.new(name='az_s')
        for v in head.data.vertices:
            a = math.atan2(v.co.y - neck_c.y, v.co.x - neck_c.x)
            az_c.add([v.index], (math.cos(a) + 1) / 2, 'REPLACE')
            az_s.add([v.index], (math.sin(a) + 1) / 2, 'REPLACE')
        az_tex = np.arctan2(bake_attribute(head, 'az_s', select_only, size) * 2 - 1, bake_attribute(head, 'az_c', select_only, size) * 2 - 1)
        head.vertex_groups.remove(head.vertex_groups['az_c'])
        head.vertex_groups.remove(head.vertex_groups['az_s'])
        target = ring_lookup(RING_TONE, az_tex) * mottle  # the band flattens to the head's own tone at that side of the neck (a flat body tone printed a step at the collar); the neck below picks the same tone up
        filled = filled * (1 - fade)[..., None] + target * fade[..., None]  # our neck meets it on the same tone
        # at the nape the flat band read pale under a rim light: darken it with the scan's own occlusion (64 samples,
        # lightly blurred, bounded to 0.7), only where the head faces backward and only within the fade
        occl = 1 - (1 - (0.55 + 0.45 * np.clip(blur(ao_kt, 4), 0, 1) ** 1.2)) * back * fade  # the painted body's own occlusion curve
        filled = filled * occl[..., None]
        RING_TONE = ring_tones(head, filled, neck_z, neck_c, size)  # re-read from the finished band (fade and nape occlusion in): what the neck below must continue
    if FIGHTERS[FIGHTER].get('pallor'):  # the Nightborn's no-credits restyle of the STAND-IN scan texture (his brief): pale grey-white
        # skin, black hair, clean-shaven, sunken eyes, the throat scar. skin_mul pales only the painted body; the photographed head is
        # restyled here, on `filled`, before the gutters are margined. Position grids come from normalised vertex-group bakes (the az_c/az_s pattern).
        pos_g = {}
        for name, val in (('nb_px', lambda v: (v.co.x - neck_c.x + 0.20) / 0.40), ('nb_py', lambda v: (v.co.y - neck_c.y + 0.10) / 0.30), ('nb_pz', lambda v: (v.co.z - neck_z + 0.05) / 0.45)):
            vg = head.vertex_groups.new(name=name)
            for v in head.data.vertices:
                vg.add([v.index], min(1.0, max(0.0, val(v))), 'REPLACE')
            pos_g[name] = bake_attribute(head, name, select_only, size)
            head.vertex_groups.remove(head.vertex_groups[name])
        hx = pos_g['nb_px'] * 0.40 - 0.20 + neck_c.x
        hy = pos_g['nb_py'] * 0.30 - 0.10 + neck_c.y
        hz = pos_g['nb_pz'] * 0.45 + neck_z - 0.05
        lum = np.array([0.30, 0.59, 0.11])
        luma = filled @ lum
        skin = (island & ~dark).astype(np.float32)  # photographed skin and features (dark = the unseen crown the fill synthesised)
        # The blood drained: skin paled and cooled, two-thirds of the chroma gone; dark features (lashes, brows, hair, nostrils) keep their ink.
        paled = np.clip((luma[..., None] * 0.65 + filled * 0.35) * 1.22 + 0.03, 0, 1) * np.array([0.95, 1.00, 1.07])[None, None, :]  # owner 2026-09-17: paler
        w_skin = np.clip((luma - 0.18) / 0.15, 0, 1) * skin
        filled = filled * (1 - w_skin[..., None]) + paled * w_skin[..., None]
        # Black hair: dark texels above the brow line (photographed buzz AND the fill's synthesised crown strands) go cold black, not brown.
        above = np.clip((hz - (rig_mid.z + 0.015)) / 0.025, 0, 1)
        darkish = np.clip((0.36 - luma) / 0.14, 0, 1)
        hairpix = np.maximum(above, scalp * 0.8) * darkish * island
        filled = filled * (1 - hairpix[..., None] * np.array([0.62, 0.58, 0.52])[None, None, :])  # red falls hardest: cold black
        # Clean-shaven: mid-dark stubble on the front below the cheek line melts into the surrounding skin (lashes, nostrils and the
        # mouth line are darker than the band and keep their edges).
        below = np.clip(((rig_mid.z - 0.015) - hz) / 0.02, 0, 1)
        fwd = np.clip((neck_c.y + 0.02 - hy) / 0.04, 0, 1)
        stubble = below * fwd * np.clip((luma - 0.10) / 0.10, 0, 1) * np.clip((0.45 - luma) / 0.18, 0, 1) * skin
        smooth = blur(filled, 32)  # 32: the tile is 2048 — blur's downsample needs a divisor (24 crashed the first pass)
        filled = filled * (1 - stubble[..., None] * 0.75) + smooth * (stubble[..., None] * 0.75)
        # His eyes sit in hollows and the cheeks fall in: gaunt, not just pale (owner 2026-09-17: scarier). The eyeballs themselves
        # are eye_colour's dark_eyes/red_eyes.
        pos3 = np.stack([hx, hy, hz], axis=-1)
        def orb(centre, radii, soft):
            d = np.sqrt((((pos3 - np.array(centre)[None, None, :]) / np.array(radii)[None, None, :]) ** 2).sum(axis=-1))
            return np.clip((1 + soft - d) / soft, 0, 1)
        for ev in (eye_l, eye_r):
            hollow = orb((ev.x, ev.y, ev.z), (0.032, 0.030, 0.028), 0.55)
            filled = filled * (1 - hollow[..., None] * np.array([0.24, 0.28, 0.32])[None, None, :])
            sx = 1 if ev.x > 0 else -1
            cheek = orb((ev.x + sx * 0.030, ev.y + 0.006, ev.z - 0.052), (0.026, 0.024, 0.030), 0.6)  # the hollow under the cheekbone
            filled = filled * (1 - cheek[..., None] * np.array([0.10, 0.13, 0.16])[None, None, :])
        # A thin old scar across the throat, 2.5 cm under the chin tip (0.78 + 0.20 scan units below the eyes), bowed a little at the middle.
        z_s = rig_mid.z - (0.78 + 0.20) * SCALE
        bow = z_s - 0.006 * np.cos(np.clip(hx / 0.035, -1, 1) * math.pi / 2)
        scar = np.exp(-((hz - bow) / 0.0018) ** 2) * np.clip((0.035 - np.abs(hx)) / 0.008, 0, 1) * np.clip((neck_c.y - 0.005 - hy) / 0.02, 0, 1) * island
        filled = filled * (1 - scar[..., None]) + np.array([0.62, 0.52, 0.50])[None, None, :] * scar[..., None]  # healed tissue: paler than his grey, barely pink
        print(f'KEENTOOLS nightborn restyle: skin {int((w_skin > 0.5).sum())} texels paled, hair {int((hairpix > 0.5).sum())} blackened, stubble {int((stubble > 0.3).sum())} faded, scar {int((scar > 0.5).sum())} texels')
    core = blur(island.astype(np.float32), 4) > 0.98  # their interiors: the outermost texels straddle the raw (white) gutter and printed a pale strip along the collar ring
    filled = fill_margin(filled, core, steps=64)  # interior colours spill outward over the edge texels and into the gutters
    maps = {'Photo': {'baseColor': save_two_sizes_fn('kt_face_color', filled, 'sRGB')},
            'PhotoEyes': {'baseColor': save_jpeg_fn('kt_eye_color', eye_colour(P.downsample(pixels(images[1]), max(1, images[1].size[0] // 512))), 'sRGB')},
            'PhotoTeeth': {'baseColor': save_jpeg_fn('kt_teeth_color', P.downsample(pixels(images[3]), max(1, images[3].size[0] // 512)), 'sRGB')}}
    normal = bake_tiles_single(head, full, select_only, size)
    if crown_w.any():  # synthesised strands get a little relief across the strand direction, so the crown is not a smooth dome
        gy, gx = np.gradient(blur(hair_streaks(size), 2))
        normal = normal.copy()
        normal[..., 0] = np.clip(normal[..., 0] - gx * 6.0 * crown_w, 0, 1)
        normal[..., 1] = np.clip(normal[..., 1] + gy * 6.0 * crown_w, 0, 1)
    maps['Photo']['normal'] = save_two_sizes_fn('kt_face_normal', normal, 'Non-Color')
    rough = 0.62 + 0.38 * fade  # the photographed skin's sheen, going fully matte where the collar meets the body's matte skin
    rough = np.maximum(rough, 0.86 * crown_w)  # hair is matte: no broad skin sheen across the synthesised crown
    maps['Photo']['metallicRoughness'] = save_jpeg_fn('kt_face_orm', np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2), 'Non-Color')
    bpy.data.objects.remove(full, do_unlink=True)
    if kt not in (head, kt_eye_l, kt_eye_r, teeth) and kt.name in bpy.data.objects:  # the original object survives the split as one of the pieces
        bpy.data.objects.remove(kt, do_unlink=True)
    parts = [tag(head, 'kt_head', 'Photo', slot='Face'), tag(kt_eye_l, 'kt_eye_l', 'PhotoEyes', slot='Eyes'), tag(kt_eye_r, 'kt_eye_r', 'PhotoEyes', slot='Eyes'), tag(teeth, 'kt_teeth', 'PhotoTeeth', slot='Face')]
    print(f'KEENTOOLS head scale={scale:.4f} neck_z={neck_z:.3f} neck_c=({neck_c.x:.3f}, {neck_c.y:.3f}) head faces={len(head.data.polygons)} eyes={len(kt_eye_l.data.polygons)} teeth={len(teeth.data.polygons)}')
    return parts, maps, neck_z, neck_c


def eye_colour(px):
    """The scan's eye texture is the photograph on the ball: under the brow the sclera reads grey and the iris flat. The
    iris is found as the dark, saturated blob at the centre; the ring around it up to ~1.9 iris radii is the sclera, lifted
    towards a cool white (skin at the corners and lashes excluded by saturation and darkness); the iris mid-tones get a
    small lift, the pupil none."""
    h, w = px.shape[:2]
    mx, mn = px.max(axis=2), px.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    ys, xs = np.mgrid[0:h, 0:w]
    blob = (sat > 0.35) & (mx > 0.06) & (mx < 0.35)  # the iris: coloured but dark, near the centre (the lids lie further out)
    blob &= (np.abs(xs - w / 2) < w * 0.17) & (np.abs(ys - h / 2) < h * 0.17)
    cy, cx = ys[blob].mean(), xs[blob].mean()
    r_iris = math.sqrt(blob.sum() / math.pi)
    r = np.hypot(ys - cy, xs - cx)
    ring = np.clip((r - r_iris * 1.0) / (r_iris * 0.12), 0, 1) * np.clip((r_iris * 2.4 - r) / (r_iris * 0.4), 0, 1)
    sclera = ring * np.clip((0.44 - sat) / 0.12, 0, 1) * np.clip((mx - 0.22) / 0.12, 0, 1)  # paler and greyer than skin; not lashes
    iris = np.clip((r_iris * 0.95 - r) / (r_iris * 0.1), 0, 1) * np.clip((mx - 0.06) / 0.06, 0, 1)  # inside the ring, not the pupil
    out = px * (1 + 0.08 * iris)[..., None]
    out = out * (1 - 0.4 * sclera)[..., None] + np.array([0.78, 0.79, 0.82])[None, None, :] * (0.4 * sclera)[..., None]
    if FIGHTERS[FIGHTER].get('dark_eyes'):  # the Nightborn (his brief: dark hollow eyes): the iris sinks toward black, the sclera's lift is halved — no glow, just less light
        out = out * (1 - 0.55 * iris)[..., None]
        out = out * (1 - 0.25 * sclera)[..., None]
    if FIGHTERS[FIGHTER].get('red_eyes'):  # the owner, 2026-09-17: red eyes — a deep ember iris over the darkened ball (no glow, the pupil stays black)
        ember = np.array([0.45, 0.06, 0.04])[None, None, :]
        out = out * (1 - 0.60 * iris)[..., None] + ember * (0.60 * iris)[..., None]
    print(f'KEENTOOLS eye colour: iris at ({cx:.0f}, {cy:.0f}) r={r_iris:.0f}px, sclera {int((sclera > 0.5).sum())} texels')
    return np.clip(out, 0, 1)


def _upsample_rect(grid, h, w):
    """Separable bilinear upsample of an nv×nu grid to h×w (streaks: few rows, many columns → slow along v, fast across u)."""
    nv, nu = grid.shape
    rows = np.array([np.interp(np.linspace(0, nu - 1, w), np.arange(nu), grid[i]) for i in range(nv)])
    return np.array([np.interp(np.linspace(0, nv - 1, h), np.arange(nv), rows[:, j]) for j in range(w)]).T


def hair_streaks(size, seed=9):
    """Strand noise for a full head of swept-back hair: on the scan's UV layout the strands run along v (up from the
    hairline over the crown, down the back), so the noise is slow along v and fine across u."""
    rng = np.random.default_rng(seed)
    total, weight = np.zeros((size, size)), 0
    for k, (nv, nu) in enumerate(((size // 48, size // 3), (size // 24, size // 2 * 3 // 2), (size // 12, size))):
        amp = 0.55 ** k
        total += amp * _upsample_rect(rng.random((nv, nu)), size, size)
        weight += amp
    return total / weight


def crown_fill(colour, dark, size, hair_zone, stubble=None, coverage=None, scalp=None):
    """The scan photographs the front and sides; the crown and the back of the skull are smeared from grazing views
    (`dark`). Growing the boundary inward leaves streaks, so beyond a short feather the fill is flat: the photographed
    hair's own tone (buzz-cut grain on top, or swept strands for `HAIR` 'full') where the head is above the hairline, the
    skin tone below it (the nape), by the baked `hair_zone` map."""
    filled = fill_margin(colour, ~dark, steps=48)  # a short growth only: a long one prints the boundary texels as streaks
    reach = blur((~dark).astype(np.float32), 16)  # 1 on the photograph, fading to 0 across the boundary
    lum = colour.mean(axis=2)
    band = (~dark) & (reach < 0.9) & (reach > 0.3) & (hair_zone > 0.5) & (lum < HAIR_LUM)  # photographed hair next to the black (darker than this fighter's skin)
    hair = np.median(colour[band], axis=0) * 1.1 if band.sum() > 500 else np.array([0.06, 0.046, 0.036])  # a little scalp shows through a buzz cut
    skin = SKIN_TONE if SKIN_TONE is not None else np.array([0.50, 0.40, 0.34])
    grain = P.fbm(size, 7, octaves=(size // 8, size // 4, size // 2))
    dots = P.fbm(size, 8, octaves=(size // 2, size))
    if HAIR == 'full' and coverage is not None and scalp is not None:
        # the boundary texels are grazing-angle smears (dark, desaturated roots): read the hair's real shadow and
        # highlight tones from well-photographed hair on the scalp itself (top/back of the skull above the brows — the
        # nape and temple skin next to the unseen band read as a rosy highlight) and lay swept strands between them
        well = (~dark) & (coverage > 0.6) & (scalp > 0.5) & (lum < HAIR_LUM)
        if well.sum() < 500:
            well = band
        lw = lum[well]
        lo_t, hi_t = np.percentile(lw, 15), np.percentile(lw, 90)
        lo = np.median(colour[well][lw <= lo_t], axis=0)
        hi = np.median(colour[well][lw >= hi_t], axis=0)
        strand = _smooth(0.25, 0.8, hair_streaks(size))[..., None]
        fine = (0.92 + 0.16 * P.fbm(size, 12, octaves=(size // 2, size)))[..., None]
        hair_synth = (lo[None, None, :] * (1 - strand) + hi[None, None, :] * strand) * fine
        print(f'KEENTOOLS crown fill (full hair): shadow {np.round(lo, 3)} highlight {np.round(hi, 3)} from {int(well.sum())} well-seen texels')
    else:
        hair_synth = hair[None, None, :] * (0.72 + 0.56 * grain)[..., None] * (1 - 0.35 * (dots > 0.62))[..., None]
    local = blur(blur(fill_margin(colour, ~dark, steps=400), 32), 8)  # the photographed skin's own tone carried in (no streaks at this blur), so the under-chin and nape match their surroundings
    skin_synth = local * (0.92 + 0.16 * grain)[..., None]
    synth = hair_synth * hair_zone[..., None] + skin_synth * (1 - hair_zone[..., None])
    if stubble is not None:  # sparse dark grain over skin, like the photographed stubble beside it
        stubble_synth = skin_synth * (1 - 0.55 * (dots > 0.55))[..., None] * (0.9 + 0.2 * grain)[..., None]
        synth = synth * (1 - stubble[..., None]) + stubble_synth * stubble[..., None]
    w = np.clip(1 - reach * 1.6, 0, 1)[..., None] * dark[..., None]
    print(f'KEENTOOLS crown fill: hair tone {np.round(hair, 3)} from {int(band.sum())} texels')
    return filled * (1 - w) + synth * w


def ring_tones(head, colour, neck_z, neck_c, size, bins=36):
    """The head texture's median colour in the band 0.4–1.5 cm above the collar ring, per azimuth bin around the neck axis
    (the chin's stubble at the front, the nape's skin at the back, the jaw's sides between), smoothed around the ring."""
    me = head.data
    uv = me.uv_layers.active.data
    acc = [[] for _ in range(bins)]
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            if not (0.004 < v.co.z - neck_z < 0.015):  # right above the ring (the photograph's own shading there is what the neck must continue; 1.2-3 cm up it was 10% lighter at the front)
                continue
            u, w = uv[li].uv
            a = math.atan2(v.co.y - neck_c.y, v.co.x - neck_c.x)
            acc[int((a + math.pi) / (2 * math.pi) * bins) % bins].append(colour[int(w * size) % size, int(u * size) % size])
    tones = np.array([np.median(a, axis=0) if len(a) >= 5 else [np.nan] * 3 for a in acc], np.float32)
    for _ in range(bins):  # empty bins take their neighbours'
        bad = np.isnan(tones[:, 0])
        if not bad.any():
            break
        for i in np.nonzero(bad)[0]:
            nb = [tones[(i + d) % bins] for d in (-1, 1) if not np.isnan(tones[(i + d) % bins, 0])]
            if nb:
                tones[i] = np.mean(nb, axis=0)
    tones = np.nan_to_num(tones, nan=float(np.nanmean(tones)))  # not smoothed around the ring: the stubble's dark front turns into the lit sides within 60°, and a blur left the jaw corners 15% lighter on the neck than on the head
    print(f'KEENTOOLS ring tones: front {np.round(tones[bins // 4], 3)} back {np.round(tones[bins // 4 * 3], 3)} ({sum(len(a) for a in acc)} samples, {bins} bins)')  # y runs backward: the front is azimuth -90°
    return tones


def ring_lookup(tones, az):
    """`tones` (bins × RGB) interpolated circularly at azimuth `az` (an array, radians)."""
    bins = len(tones)
    f = (az + math.pi) / (2 * math.pi) * bins - 0.5
    i0 = np.floor(f).astype(int)
    t = (f - i0)[..., None]
    return tones[i0 % bins] * (1 - t) + tones[(i0 + 1) % bins] * t


def neck_tiles(real, neck_z, neck_c, select_only, save_two_sizes, save_jpeg, reach=0.08):
    """After the scanned head is placed: the neck below the collar continues the head's tone. Both tiles are repainted
    below the ring with their shared occlusion bake (no flat band at the collar any more — it printed a pale strip) and
    tinted from the head's ring tone at their side of the neck (`RING_TONE`) to the body's tone over `reach` metres down,
    so the collar is a gradient, not a step."""
    t = real['tiles']
    size = t['size']
    def collar_soft(ao, pos):  # the base head's own occlusion, but not the line its neck printed where the stub now overlaps it: within 1.5 cm of the ring nothing darker than the local average
        near = np.clip(1 - (neck_z - pos[..., 2]) / 0.015, 0, 1)
        near = P.downsample(near[..., None], pos.shape[0] // ao.shape[0])[..., 0]
        return ao * (1 - near) + np.maximum(ao, blur(ao, 16)) * near
    ao_face, ao_body = collar_soft(t['ao_face'], t['pos_face']), collar_soft(t['ao_body'], t['pos_body'])  # the one bake both tiles share (re-baking against the scanned head lit the shoulders differently and printed the tile split)
    style = body_colour(t['pos_face'], t['mask_face'], P.upsample(ao_face, size), t['detail'], size)
    below = np.clip((neck_z + 0.02 - t['pos_face'][..., 2]) / 0.02, 0, 1)[..., None]
    colour_face = t['colour_face'] * (1 - below) + style * below
    colour_body = body_colour(t['pos_body'], t['mask_body'], P.upsample(ao_body, size), t['detail'], size, nails=t['nails'])  # BODY_NORM is fixed from the first paint: the same paint, collar softened
    lum = np.array([0.30, 0.59, 0.11])
    def tint(colour, pos, mask, ao):
        depth = neck_z - pos[..., 2]
        w = np.clip(depth / reach, 0, 1)
        w = 1 - w * w * (3 - 2 * w)
        w = np.where(depth > -0.002, w, 1.0) * mask  # everything up to the ring (the head tile above it is cut away)
        az = np.arctan2(pos[..., 1] - neck_c.y, pos[..., 0] - neck_c.x)
        full = ring_lookup(RING_TONE, az) / SKIN_TONE[None, None, :]
        tempered = full * ((full @ lum) ** -0.4)[..., None]  # the head's hue in full, its (photographed, shadowed) darkness at 60%: a lit neck under a chin, not a dirty one
        w1 = np.clip((depth - 0.01) / 0.03, 0, 1)
        w1 = (1 - w1 * w1 * (3 - 2 * w1))[..., None]  # ...but the first centimetre matches the head's band exactly and eases to the tempered tone by 4 cm, so the ring itself is not a step
        factor = tempered * (full / tempered) ** w1
        factor = factor / (0.55 + 0.45 * np.clip(P.upsample(ao, pos.shape[0]), 0, 1) ** 1.2)[..., None] ** w1  # and carry no baked occlusion there: the head's band has none (measured: the sides sat 5% darker than the band)
        return np.clip(colour * (1 + (factor - 1) * w[..., None]), 0, 1)
    colour_face = fill_margin(tint(colour_face, t['pos_face'], t['mask_face'], ao_face), t['mask_face'])
    colour_body = tint(colour_body, t['pos_body'], t['mask_body'], ao_body)
    near = np.clip(1 - (neck_z - t['pos_face'][..., 2] - 0.01) / 0.03, 0, 1)  # the occlusion map too: fully lit at the ring like the head tile, its own by 4 cm
    near = P.downsample(near[..., None], t['pos_face'].shape[0] // ao_face.shape[0])[..., 0]
    soft = np.clip(ao_face ** 1.3, 0, 1) * (1 - near) + near
    maps = real['maps']
    maps['Face']['baseColor'] = save_two_sizes('face_color', colour_face, 'sRGB')
    maps['Face']['occlusion'] = save_jpeg('face_ao', np.stack([soft, soft, soft], axis=2), 'Non-Color')
    maps['Skin']['baseColor'] = save_two_sizes('skin_color', colour_body, 'sRGB')
    real['ao_body'] = ao_body  # the shared occlusion map follows
    print(f'KEENTOOLS neck tiles: both tiles repainted below the collar, tinted from the ring tone over {reach * 100:.0f} cm')


def delight(colour, unseen, keep=0.45, gain=0.84):
    """Flatten the photograph's baked lighting: everything brighter than the seen skin's median brightness is pulled
    towards it (`keep` of the excess survives — the forehead and cheekbone highlights were the portrait's key light,
    which the arena lights again), then the whole map takes `gain`. Owner's call (2026-09-16): the face read shiny and
    ~10% brighter than the body it had been matched to; v41: "10% darker again, more gritty" — keep 0.55 → 0.45, gain 0.93 → 0.84."""
    lum = colour @ np.array([0.30, 0.59, 0.11], np.float32)
    seen = ~unseen & (lum > 0.05)
    m = float(np.median(lum[seen])) if seen.sum() > 1000 else float(np.median(lum))
    target = np.where(lum > m, m + (lum - m) * keep, lum)
    factor = np.where(lum > 1e-4, target / np.maximum(lum, 1e-4), 1.0) * gain
    print(f'KEENTOOLS delight: median {m:.3f}, highlights kept at {keep:.2f}, gain {gain:.2f}; brightest texel {lum.max():.3f} -> {(lum * factor).max():.3f}')
    return np.clip(colour * factor[..., None], 0, 1)


def stretch_refill(colour, ratio, unseen, island, size, patch=64, seed=5, front=None):
    """The chin move stretches the photograph over the lowered chin (`ratio` = the local edge stretch, baked): its stubble
    smeared into streaks, and the scan's chin was pale and sparse anyway (seen at a grazing angle) where the portraits
    show dense stubble. Texels stretched by more than 20% are re-covered with the photographed stubble beside them:
    unstretched, seen, non-lip patches from similar rows of the texture (the stubble's lie changes down the face), each
    squeezed vertically by the local stretch so that, spread over the moved mesh, the grain comes back to the
    photograph's density. Quilted under a raised-cosine window, half overlapping; the patches' own tones smoothed across
    them; a feather at the zone's edge. (Keeping the photograph's own tone under new grain stretched the dark patch under
    the lip into a strip down the chin; carrying the tone in from the sides went blotchy.)"""
    zone = ratio > 1.2
    if zone.sum() < 200:
        return colour
    zy, zx = np.nonzero(zone)
    near = np.zeros_like(zone)
    near[max(0, zy.min() - 80):zy.max() + 80, max(0, zx.min() - 300):zx.max() + 300] = True
    src = near & ~zone & (ratio < 1.05) & ~unseen
    if front is not None:
        src &= front > 0.5  # donors from the face only (a fighter with hair to the nape has hair on these rows beside the jaw: it quilted a dark beard under the chin)
    redness = colour[..., 0] - colour[..., 1]
    src &= redness < np.median(redness[src]) + 0.03  # the lower lip borders the zone; its pink is not stubble
    c = np.pad(src.astype(np.int32), ((1, 0), (1, 0))).cumsum(0).cumsum(1)  # box sums: is a source rectangle wholly unstretched skin?
    def box_full(y, x, h, w):
        return y + h < size and x + w < size and c[y + h, x + w] - c[y, x + w] - c[y + h, x] + c[y, x] == h * w
    sy, sx = np.nonzero(src)
    hf = colour  # whole patches: the stubble and its skin
    rng = np.random.default_rng(seed)
    quilt = np.zeros_like(colour)
    wsum = np.zeros(colour.shape[:2], np.float32)
    win1 = np.hanning(patch + 2)[1:-1]
    win = np.outer(win1, win1)[..., None]
    step = patch // 2
    tiles = misses = 0
    for y in range(max(0, zy.min() - patch), min(size - patch, zy.max() + 1) + 1, step):
        for x in range(max(0, zx.min() - patch), min(size - patch, zx.max() + 1) + 1, step):
            tz = zone[y:y + patch, x:x + patch]
            if not tz.any():
                continue
            r = float(np.clip(ratio[y:y + patch, x:x + patch][tz].mean(), 1.0, 4.0))
            h = int(round(patch * r))
            cand = rng.choice(len(sy), 60)
            pick = next((k for k in cand if abs(int(sy[k]) - y) < 120 and box_full(sy[k], sx[k], h, patch)), None)
            if pick is None:
                pick = next((k for k in cand if box_full(sy[k], sx[k], h, patch)), None)
            if pick is None:
                misses += 1
                continue
            block = hf[sy[pick]:sy[pick] + h, sx[pick]:sx[pick] + patch]
            if h != patch:  # squeeze the rows by the stretch (box average between rounded row bounds)
                cs = np.concatenate([np.zeros((1, patch, 3), np.float32), block.cumsum(axis=0)], axis=0)
                bounds = np.round(np.linspace(0, h, patch + 1)).astype(int)
                block = (cs[bounds[1:]] - cs[bounds[:-1]]) / np.maximum(1, bounds[1:] - bounds[:-1])[:, None, None]
            quilt[y:y + patch, x:x + patch] += block * win
            wsum[y:y + patch, x:x + patch] += win[..., 0]
            tiles += 1
    quilt /= np.maximum(wsum, 1e-3)[..., None]
    cov = (wsum > 0).astype(np.float32)[..., None]  # blurs normalised over the tiled area, so its border does not darken them
    tone16 = blur(quilt * cov, 16) / np.maximum(blur(cov, 16), 1e-3)
    tone64 = blur(quilt * cov, 64) / np.maximum(blur(cov, 64), 1e-3)
    synth = np.clip(quilt - tone16 + tone64, 0, 1)  # the sources' own tone, smoothed across the patches
    # the chin's underside owns only a few texture rows above the collar ring (the scan saw it at a grazing angle), each
    # spread over millimetres of mesh: at the island's edge the grain would print as streaks, so the last rows carry the
    # smooth tone only, with no feather against the gutter
    edge = zone & (blur(island.astype(np.float32), 8) < 0.99)
    synth = np.where(edge[..., None], np.clip(tone64, 0, 1), synth)
    w = np.clip(blur(zone.astype(np.float32), 8) * 1.2, 0, 1)
    w = np.maximum(w, edge.astype(np.float32))[..., None]
    print(f'KEENTOOLS stretch refill: {int(zone.sum())} texels over {tiles} tiles ({misses} without a source) from {len(sy)} unstretched texels')
    return colour * (1 - w) + synth * w


def neck_blend(obj, target, neck_z, axis, band=0.06, lift=0.0002, front_band=None, front_from=None):
    """The stub's lowest `band` metres slide radially onto `target`'s neck (ray from the neck axis through each vertex),
    so the silhouette runs straight into the body. The blend eases in and out (smoothstep), so the collar leaves the
    ring with our neck's own slope — a linear blend tilted the whole band and it caught the light as a stripe. Leaves
    the weights in a 'neck_blend' vertex group (the seam fade and the borrowed normals key on it)."""
    vg = obj.vertex_groups.new(name='neck_blend')
    inv = target.matrix_world.inverted()
    hits = misses = 0
    for v in obj.data.vertices:
        b = band
        if front_band is not None and v.normal.y < -0.3 and (front_from is None or v.co.z < front_from):
            b = front_band  # the jaw's underside: a long, gentle turn back to the throat instead of a shelf under the chin
        t = min(1.0, max(0.0, (v.co.z - neck_z) / b))
        w = 1 - t * t * (3 - 2 * t)
        if w <= 0:
            continue
        vg.add([v.index], w, 'REPLACE')
        origin = Vector((axis.x, axis.y, min(v.co.z, neck_z - 0.001)))  # our neck is cut just above the ring: aim at its top
        direction = Vector((v.co.x - axis.x, v.co.y - axis.y, 0))
        if direction.length < 1e-6:
            continue
        hit, loc, _, _ = target.ray_cast(inv @ origin, (inv.to_3x3() @ direction).normalized(), distance=0.3)
        if hit:
            goal = target.matrix_world @ loc + direction.normalized() * lift  # a collar just outside our neck
            v.co = v.co.lerp(Vector((goal.x, goal.y, v.co.z)), w)  # our neck's outline at the ring, carried up the band
            hits += 1
        else:
            misses += 1
    obj.data.update()
    print(f'NECK BLEND {obj.name}: {hits} hits, {misses} misses')


def bake_attribute(obj, group, select_only, size, margin=8):
    """A vertex group rasterised into `obj`'s UV space (Cycles EMIT bake of the attribute), as a float map; with no
    group, a mask of the UV islands themselves."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    scene.render.bake.margin = margin
    scene.render.bake.use_selected_to_active = False
    img = bpy.data.images.new('kt_attr', size, size, float_buffer=True)
    mat = bpy.data.materials.new('kt_attr_bake')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    emit = nodes.new('ShaderNodeEmission')
    if group is None:
        emit.inputs['Color'].default_value = (1, 1, 1, 1)
    else:
        attr = nodes.new('ShaderNodeAttribute')
        attr.attribute_name = group
        links.new(attr.outputs['Fac'], emit.inputs['Color'])
    links.new(emit.outputs['Emission'], nodes['Material Output'].inputs['Surface'])
    node = nodes.new('ShaderNodeTexImage')
    node.image = img
    nodes.active = node
    saved = [m for m in obj.data.materials]
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    select_only([obj])
    bpy.ops.object.bake(type='EMIT', use_clear=True)
    obj.data.materials.clear()
    for m in saved:
        obj.data.materials.append(m)
    px = np.empty(size * size * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return np.clip(px.reshape(size, size, 4)[:, :, 0], 0, 1)


def bake_ao_single(obj, select_only, size, samples=64):
    """Cycles ambient occlusion of `obj` in its own UV space, everything else in the scene occluding, as a float map."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.render.bake.margin = 8
    scene.render.bake.use_selected_to_active = False
    img = bpy.data.images.new('kt_ao', size, size)
    mat = bpy.data.materials.new('kt_ao_bake')
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    saved = [m for m in obj.data.materials]
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    select_only([obj])
    bpy.ops.object.bake(type='AO', use_clear=True)
    obj.data.materials.clear()
    for m in saved:
        obj.data.materials.append(m)
    px = np.empty(size * size * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(size, size, 4)[:, :, 0]


def bake_tiles_single(low, high, select_only, size):
    """Tangent normal of `high` onto `low`'s single material slot (the low keeps its UVs from the full mesh)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 8
    scene.render.bake.margin = 8
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.01
    scene.render.bake.normal_space = 'TANGENT'
    img = bpy.data.images.new('kt_normal', size, size)
    mat = bpy.data.materials.new('kt_normal_bake')
    mat.use_nodes = True
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    mat.node_tree.nodes.active = node
    low.data.materials.clear()
    low.data.materials.append(mat)
    high.hide_render = high.hide_viewport = False
    select_only([low, high])
    bpy.ops.object.bake(type='NORMAL', use_clear=True)
    scene.render.bake.use_selected_to_active = False
    px = np.empty(size * size * 4, np.float32)
    img.pixels.foreach_get(px)
    return clean_normal(px.reshape(size, size, 4)[:, :, :3])


def level_mouth(objs, rig_mid, scale):
    """The scan's mouth is quirked: one corner sits ~2 mm lower than the other (−2.1° across 55 mm). The mouth zone
    (0.40–0.72 scan units below eye level, the front of the face) rolls about the forward axis through the mouth's centre by
    the opposite angle, so the corners level; the texture rides with the vertices. Eases to nothing at the zone's edges."""
    head = objs[0]  # measured here (the undecimated mesh keeps the lip opening as one loop)
    head.data.update()
    # the mouth corners: the lateral extremes of the lip opening's boundary (an open hole) inside the zone
    bm = bmesh.new()
    bm.from_mesh(head.data)
    cand = {v for v in bm.verts if any(e.is_boundary for e in v.link_edges)}
    loops, seen = [], set()  # the lip opening is the largest boundary loop whose centre lies in the mouth zone; decimation leaves tiny holes that must not be mistaken for its corners
    for v in cand:
        if v in seen:
            continue
        loop, stack = [], [v]
        while stack:
            w = stack.pop()
            if w in seen:
                continue
            seen.add(w)
            loop.append(w)
            stack += [e.other_vert(w) for e in w.link_edges if e.is_boundary and e.other_vert(w) in cand and e.other_vert(w) not in seen]
        loops.append(loop)
    def in_zone(loop):
        c = sum((w.co for w in loop), Vector()) / len(loop)
        return 0.40 < (rig_mid.z - c.z) / scale < 0.75 and abs(c.x - rig_mid.x) < 0.25 * scale and c.y < rig_mid.y - 0.2 * scale
    mouth_loops = [l for l in loops if in_zone(l)]
    rim = max(mouth_loops, key=len) if mouth_loops else []
    if len(rim) < 30:
        bm.free()
        print(f'KEENTOOLS level mouth: no lip opening found (largest loop {len(rim)}), skipped')
        return
    lv, rv = max(rim, key=lambda v: v.co.x), min(rim, key=lambda v: v.co.x)
    left, right, li, ri = lv.co.copy(), rv.co.copy(), lv.index, rv.index
    bm.free()
    tilt = math.atan2(left.z - right.z, left.x - right.x)
    centre = (left + right) / 2
    drop_mm = (left.z - right.z) * 1000
    rot = Matrix.Rotation(tilt, 4, 'Y')  # a roll about Y by +tilt lifts the low corner (checked numerically: -tilt doubled the quirk)
    def smooth(a, b, x):
        t = min(1.0, max(0.0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    moved = 0
    for o in objs:
        for v in o.data.vertices:
            u = (rig_mid.z - v.co.z) / scale
            dx = abs(v.co.x - rig_mid.x) / scale
            fwd = (rig_mid.y - v.co.y) / scale  # forward of the eye plane (y runs backward): the whole lip slab rolls, the cheeks ease out, the ears stay
            w = smooth(0.34, 0.42, u) * (1 - smooth(0.70, 0.78, u)) * (1 - smooth(0.40, 0.50, dx)) * smooth(-0.45, -0.05, fwd)
            if w <= 0:
                continue
            target = centre + rot @ (v.co - centre)
            v.co = v.co.lerp(target, w)
            moved += 1
        o.data.update()
    left2, right2 = head.data.vertices[li].co, head.data.vertices[ri].co  # the same corners, re-read
    print(f'KEENTOOLS level mouth: corners were {math.degrees(tilt):+.1f}° off level ({drop_mm:+.1f} mm); {moved} vertices rolled across {len(objs)} meshes; now {math.degrees(math.atan2(left2.z - right2.z, left2.x - right2.x)):+.1f}°')


def chin_strong(head, rig_mid, scale, axis, down=0.18, forward=0.09, stretch_group=False):
    """A strong, LONGER chin (the owner's sketch, 2026-09-15: the jaw's bottom edge a good 2.5 cm lower at the centre,
    rising to the jaw corners — a U). Two smooth fields on the front of the lower face, in scan units below eye level:
    the chin's bottom (peak 0.90) moves DOWN by up to `down` at the centre, tapering to the sides, and the chin zone
    (peak 0.85) FORWARD by up to `forward`. Both are zero at the lip crease (0.69) and above — the lips do not move — and
    zero at the collar ring (0.99), which stays where our neck meets it: the underside between runs up and back from the
    lowered chin to the throat, as a jaw does. Applied after the collar blend so the blend does not pull the chin back."""
    head.data.update()
    sx_down, sx_fwd = 0.38 * scale, 0.30 * scale  # the U (v34, accepted): 1.7 cm lower at the centre and 3 cm out
    before = [v.co.copy() for v in head.data.vertices] if stretch_group else None
    moved = 0
    def smooth(a, b, x):
        t = min(1.0, max(0.0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    for v in head.data.vertices:
        if abs(v.co.x - rig_mid.x) > 0.6 * scale:
            continue
        u = (rig_mid.z - v.co.z) / scale  # scan units below eye level
        # ahead of the neck axis only, by position (a facing test skipped the underside's down-facing vertices on one
        # mesh and not the other: a scalloped chin edge and a normal map that could not find its high-poly twin there)
        win = smooth(0.70, 0.76, u) * (1 - smooth(0.955, 0.99, u)) * smooth(0.0, 0.03, axis.y - v.co.y)
        if win <= 0:
            continue
        dx = v.co.x - rig_mid.x
        dz = down * math.exp(-((u - 0.90) / 0.09) ** 2) * math.exp(-(dx / sx_down) ** 2)
        dy = forward * math.exp(-((u - 0.85) / 0.08) ** 2) * math.exp(-(dx / sx_fwd) ** 2)
        v.co += Vector((0, -dy, -dz)) * (win * scale)
        moved += 1
    head.data.update()
    if before is not None:  # where the move stretched the photograph: the longest edge at each vertex against its old length
        ratio = np.ones(len(before), np.float32)
        for e in head.data.edges:
            a, b = e.vertices
            old_len = (before[a] - before[b]).length
            if old_len < 1e-7:
                continue
            r = (head.data.vertices[a].co - head.data.vertices[b].co).length / old_len
            ratio[a], ratio[b] = max(ratio[a], r), max(ratio[b], r)
        vg = head.vertex_groups.new(name='stretch')  # (ratio - 1) / 4: 0 = unstretched, 1 = five times longer
        marked = 0
        for i, r in enumerate(ratio):
            if r > 1.02:
                vg.add([i], min(1.0, (r - 1) / 4), 'REPLACE')
                marked += 1
        print(f'KEENTOOLS chin strong: {marked} vertices stretched (max {ratio.max():.2f}x, {int((ratio > 1.3).sum())} over 1.3x)')
    print(f'KEENTOOLS chin strong: {moved} vertices, down {down * scale * 1000:.1f} mm, forward {forward * scale * 1000:.1f} mm at most')


def chin_extend(head, rig_mid, scale, amount=0.10):
    """The reconstruction's chin is flat (profile in scan units below eye level: lips −0.51…−0.66, crease −0.69, chin
    tip −0.75 only 0.011 ahead of the crease, underside −0.85, cut −0.99) where the portraits show a strong chin. Two
    things did not work: a boss under the lip read as a pout, and borrowing the base head's outline tore the mouth. This
    extends the jaw instead: the band from the chin tip down to just above the collar moves forward and down, most at
    the chin's underside, nothing above the tip, so the lips and crease are untouched and the collar still meets the neck."""
    head.data.update()
    tip, under, floor = rig_mid.z - 0.76 * scale, rig_mid.z - 0.86 * scale, rig_mid.z - 0.95 * scale
    lower_lip, upper_lip = rig_mid.z - 0.63 * scale, rig_mid.z - 0.52 * scale
    push = Vector((0, -1, -0.6)).normalized()
    sx = 0.22 * scale
    moved = 0
    for v in head.data.vertices:
        if v.co.z < floor or v.normal.y > -0.05 or abs(v.co.x - rig_mid.x) > 0.5 * scale:
            continue
        lat = math.exp(-((v.co.x - rig_mid.x) / sx) ** 2)
        d = Vector((0, 0, 0))
        if v.co.z <= tip:  # the jaw's underside, forward and down
            g = math.exp(-((v.co.z - under) / (0.07 * scale)) ** 2) * lat
            g *= min(1.0, (tip - v.co.z) / (0.03 * scale)) * min(1.0, (v.co.z - floor) / (0.04 * scale))  # eases in below the tip, out above the collar
            d += push * (amount * g * scale)
        # the profile itself: the scan's lower lip sits 1 mm ahead of its upper lip and of the chin, which reads as a pout
        # from the front — the lower lip goes back 2.5 mm, the upper lip and the chin tip come forward, all along y only so
        # the open lip boundary moves as one
        prof = (-0.020 * math.exp(-((v.co.z - lower_lip) / (0.035 * scale)) ** 2)   # negative: back (+y)
                + 0.010 * math.exp(-((v.co.z - upper_lip) / (0.03 * scale)) ** 2)
                + 0.040 * math.exp(-((v.co.z - (rig_mid.z - 0.77 * scale)) / (0.05 * scale)) ** 2))
        d += Vector((0, -prof * lat * scale, 0))
        if d.length > 1e-5:
            v.co += d
            moved += 1
    head.data.update()
    print(f'KEENTOOLS chin extend: {moved} vertices, {amount * scale * 1000:.1f} mm at the underside; lower lip back {0.020 * scale * 1000:.1f} mm, chin tip forward {0.040 * scale * 1000:.1f} mm')


def cut_above(obj, z, select_only):
    """Remove everything of `obj` above height z with a level cut (the base head, once the reconstructed head takes its
    place: what is left of the neck ends just inside the scan's collar)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_outer=True)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj
