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
        w = (facing * sil[v0, u0] * inside * oval).astype(np.float32)
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
    head_co = np.array([[v.co.x, v.co.y, v.co.z] for v in head.data.vertices], np.float64)  # the fitted head
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
    hairline = ez + 0.076 + recession - sides * 0.062 - np.clip(pos[..., 1] - ey + 0.02, 0, None) * 0.55
    scalp = np.clip((pos[..., 2] - hairline) / (0.035 if 'hairline_z' in F else 0.02), 0, 1)  # a long feather into the portrait's hairline
    ear = np.clip((np.abs(pos[..., 0]) - 0.058) / 0.01, 0, 1) * np.clip((pos[..., 1] - (ey + 0.015)) / 0.01, 0, 1) * np.clip(((ey + 0.10) - pos[..., 1]) / 0.01, 0, 1) * np.clip(((ez + 0.045) - pos[..., 2]) / 0.01, 0, 1)
    scalp = scalp * (1 - ear)  # the ears are not scalp
    scalp = np.maximum(scalp, np.clip((pos[..., 1] - (ey + 0.075)) / 0.02, 0, 1) * np.clip((pos[..., 2] - (ez + 0.005)) / 0.02, 0, 1))
    return scalp * np.clip((pos[..., 2] - (ez - 0.02)) / 0.02, 0, 1)


def face_colour(pos, mask, F, ao, detail, size, photo=None):
    """The face's colour: olive Mediterranean base, sub-dermal zones (blood in the nose, cheeks and ears; blue-grey
    beard shadow; warmer forehead), photographed micro-mottle, an old scar, arena dust, a shaved scalp under the cards.
    Brows and lashes are geometry now, so they leave only their shadow here."""
    fbm = P.fbm
    ex, ey, ez, n, m, c, front, xz = landmarks(F, pos)
    base = np.array([0.64, 0.47, 0.35])[None, None, :]  # healthy olive: a shade lighter and pinker than the body
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
    # Sweat-dirt at the temples, faint.
    streak = fbm(size, 65, octaves=(16, 256))
    temples = np.maximum(ellipse(pos, (ex + 0.045, ey + 0.03, ez + 0.02), (0.012, 0.02, 0.045), 0.9), ellipse(pos, (-(ex + 0.045), ey + 0.03, ez + 0.02), (0.012, 0.02, 0.045), 0.9))
    colour *= (1 - temples * np.clip((streak - 0.58) * 6, 0, 1) * 0.0 * front)[..., None]  # no grime on the hero face
    # Shaved scalp under the hair cards, feathered hairline.
    scalp = scalp_mask(pos, F) * (1 - (1 - keep) * 0.7)  # the photo already carries the buzz cut at the hairline
    for _ in range(8):  # grow across the skull island's seam margin so no texel there is left unpainted
        scalp = np.maximum.reduce([scalp, np.roll(scalp, 2, 0), np.roll(scalp, -2, 0), np.roll(scalp, 2, 1), np.roll(scalp, -2, 1)])
    dense = (np.random.default_rng(64).random((size, size)) < 0.75).astype(np.float32)
    colour *= (1 - scalp * (0.50 + dense * 0.22))[..., None]
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
        if scalp_mask(np.array([[[c.x, c.y, c.z]]], np.float32), F)[0, 0] > 0.25:
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
    feather = {v.index: float(scalp_mask(np.array([[[v.co.x, v.co.y, v.co.z]]], np.float32), F)[0, 0]) for v in base.vertices}
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
            alpha = (1.0 - 0.70 * t) * (0.5 + 0.5 * height) * min(1.0, max(0.0, (feather[v.index] - 0.15) / 0.45))  # taper, fade, hairline
            comb = Vector((0.0, 0.75, -0.66)) - nrm * Vector((0.0, 0.75, -0.66)).dot(nrm)  # back and down, along the skin
            verts.append(v.co + nrm * off + comb.normalized() * (0.0012 * t))  # outer shells slide a little along the comb: a lean, not a streak
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
    alpha = np.repeat(np.repeat(np.where(seed_dots < 0.72, 0.62 + 0.38 * length, 0.0).astype(np.float32), 4, 0), 4, 1)  # 4-px hairs
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
    normal_obj = bake_tiles(body, 'NORMAL', [size, size // 4], select_only, normal_space='OBJECT')[0][..., :3] * 2 - 1
    detail_colour, detail_height = scan_detail(size)
    lid_ring = F['lid_ring']
    photo = None
    height = height_map(pos_face, mask_face, F, detail_height, size)
    displace_high(high, height, select_only)
    nrm_face, nrm_body = [clean_normal(n[..., :3]) for n in bake_tiles(body, 'NORMAL', [size, size], select_only, high=high, samples=8, margin=8)]
    colour_face = face_colour(pos_face, mask_face, F, P.upsample(ao_face, size), detail_colour, size, photo)
    colour_body = body_colour(pos_body, mask_body, P.upsample(ao_body, size), detail_colour, size)
    rough_face = face_roughness(pos_face[::2, ::2], F, detail_colour[::2, ::2], size // 2)
    rough_body = np.clip(0.66 + (detail_colour[::2, ::2, 0] - 0.5) * 0.3, 0.4, 0.95)
    def orm(rough):
        return np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], axis=2)
    colour_face, nrm_face = fill_margin(colour_face, mask_face), fill_margin(nrm_face, mask_face)
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
    if os.path.exists(PHOTO) and os.environ.get('HEAD_PHOTO', '1') == '1':
        photo = photo_layer_multi(pos_face, normal_obj, F, lid_ring, size, head)
        colour_face = fill_margin(face_colour(pos_face, mask_face, F, P.upsample(ao_face, size), detail_colour, size, photo), mask_face)
        maps['Face']['baseColor'] = save_two_sizes('face_color', colour_face, 'sRGB')
    eye = bpy.data.objects['eye_L']
    eye_centre = sum((v.co for v in eye.data.vertices), Vector()) / len(eye.data.vertices)
    eye_radius = max((v.co - eye_centre).length for v in eye.data.vertices)
    hair = tag(hair_shells(head, F), 'hair_shells', 'HairShell', bone='Head', slot='Hair')
    maps['HairShell'] = {'baseColor': save_png_rgba(os.path.join(materials_out, 'hair_shell.png'), shell_texture())}
    brows = tag(brow_cards(head, F, dense=photo is None, count=0 if photo is not None else None), 'brow_cards', 'BrowCards', bone='Head', slot='Face')
    maps['BrowCards'] = dict(maps['HairCards'])  # same sheet, sharper cut-off in the build
    # Lash strips are off: with the lids closed they crossed the opening as a line. Back once placed on the scanned lid edge.
    return {'maps': maps, 'ao_body': ao_body, 'head': head, 'body': rest, 'parts': [head, rest, hair, brows]}
