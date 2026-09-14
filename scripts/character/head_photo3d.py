"""Five-view geometry-first portrait fit for the realistic head pipeline.

This module wraps scripts/character/head.py and only replaces fit_head_to_photo().
Unlike the original 2D front-view TPS, it reconstructs depth from the ±35° and
±90° portrait views, then deforms the skin in 3D before any photo projection.

It is intentionally opt-in and leaves the committed v14 path untouched.
"""
import json
import math

import numpy as np
from mathutils import Vector

import head as _base
from head import *  # noqa: F401,F403 - expose the full existing head API to parts.py


# MediaPipe-style correspondence keys already defined by head.py are enough to
# lock the features that matter perceptually: eye openings, brow, nose, lips,
# chin, cheek width and hairline.  The side views are used for DEPTH, not merely
# for texture projection.


def _photo_point(points, key, spec):
    if isinstance(spec[0], tuple):
        a, b = spec[0]
        return (points[a] + points[b]) * 0.5
    return points[key]


def _load_views():
    out = []
    for image, yaw in _base.VIEWS:
        lm_path = image.rsplit('.', 1)[0] + '.landmarks.json'
        with open(lm_path, 'r', encoding='utf-8') as f:
            lm = json.load(f)
        out.append((float(yaw), np.asarray(lm['points'], dtype=np.float64), int(lm['width']), int(lm['height'])))
    return out


def _ray_to_skin(obj, x, z, front_y, fallback_y):
    """Return the head-surface point at x/z, shooting from camera side (+Y)."""
    hit, loc, _normal, _face = obj.ray_cast(Vector((float(x), float(front_y), float(z))), Vector((0.0, 1.0, 0.0)))
    if hit:
        return np.array([float(loc.x), float(loc.y), float(loc.z)], dtype=np.float64)
    return np.array([float(x), float(fallback_y), float(z)], dtype=np.float64)


def _reconstruct_targets(F, pairs, views):
    """Reconstruct 3D feature targets.

    Front view defines X/Z. Side views define Y.  Every side view is normalized
    by its eye-to-chin vertical span, which removes the small framing/scale drift
    between the generated reference images.
    """
    yaw0, front, _w0, _h0 = views[0]
    if abs(yaw0) > 1e-6:
        raise RuntimeError('VIEWS[0] must be the front portrait')

    eye_r_px = _photo_point(front, 'eye_r', pairs['eye_r'])
    eye_l_px = _photo_point(front, 'eye_l', pairs['eye_l'])
    eye_px_mid = (eye_r_px + eye_l_px) * 0.5
    eye_m_mid = np.array([
        (F['eye_r'].x + F['eye_l'].x) * 0.5,
        (F['eye_r'].y + F['eye_l'].y) * 0.5,
        (F['eye_r'].z + F['eye_l'].z) * 0.5,
    ], dtype=np.float64)

    eye_px_dist = float(eye_l_px[0] - eye_r_px[0])
    eye_m_dist = float(F['eye_l'].x - F['eye_r'].x)
    if abs(eye_px_dist) < 1e-6:
        raise RuntimeError('Front portrait eye landmarks collapsed')
    front_scale = eye_m_dist / eye_px_dist  # metres / pixel

    front_span = abs(float(front[152][1] - eye_px_mid[1]))
    target = {}
    for key, spec in pairs.items():
        p = _photo_point(front, key, spec)
        tx = eye_m_mid[0] + (float(p[0]) - eye_px_mid[0]) * front_scale
        tz = eye_m_mid[2] - (float(p[1]) - eye_px_mid[1]) * front_scale

        y_est, y_w = [], []
        for yaw, pts, _w, _h in views[1:]:
            th = math.radians(yaw)
            s = math.sin(th)
            if abs(s) < 1e-5:
                continue
            er = _photo_point(pts, 'eye_r', pairs['eye_r'])
            el = _photo_point(pts, 'eye_l', pairs['eye_l'])
            em = (er + el) * 0.5
            span = abs(float(pts[152][1] - em[1]))
            ratio = front_span / max(span, 1e-6)
            ratio = float(np.clip(ratio, 0.82, 1.22))
            scale = front_scale * ratio
            pp = _photo_point(pts, key, spec)
            q_rel = (float(pp[0]) - float(em[0])) * scale
            x_rel = tx - eye_m_mid[0]
            yy = eye_m_mid[1] + (q_rel - x_rel * math.cos(th)) / s
            # Profile views carry the most reliable depth; 35° views stabilize
            # nose, lips and cheek transitions without dominating.
            weight = abs(s) ** 2
            if abs(yy - eye_m_mid[1]) < 0.11:
                y_est.append(yy)
                y_w.append(weight)
        ty = float(np.average(y_est, weights=y_w)) if y_est else float(eye_m_mid[1])
        target[key] = np.array([tx, ty, tz], dtype=np.float64)

    # Depth has an arbitrary global offset. Anchor the reconstructed eye plane
    # exactly to the existing rig's eye plane so only facial SHAPE changes.
    reconstructed_eye_y = (target['eye_l'][1] + target['eye_r'][1]) * 0.5
    y_shift = eye_m_mid[1] - reconstructed_eye_y
    for p in target.values():
        p[1] += y_shift
    return target, front_scale


def _deform_object(obj, src, dst):
    """Local 3D IDW/RBF-style deformation with hard spatial falloff.

    It interpolates feature displacements on the face but naturally reaches zero
    on the ears, back of skull and neck, so the rig seam and body fit are kept.
    """
    if not len(src):
        return
    displacement = dst - src
    coords = np.array([[v.co.x, v.co.y, v.co.z] for v in obj.data.vertices], dtype=np.float64)
    out = coords.copy()
    sigma2 = 0.034 ** 2
    cutoff = 0.072
    chunk = 2048
    for start in range(0, len(coords), chunk):
        q = coords[start:start + chunk]
        diff = q[:, None, :] - src[None, :, :]
        d2 = np.einsum('nki,nki->nk', diff, diff)
        nearest = np.sqrt(np.min(d2, axis=1))
        w = np.exp(-0.5 * d2 / sigma2) / np.maximum(d2, 1e-8) ** 0.35
        delta = (w[..., None] * displacement[None, :, :]).sum(axis=1) / np.maximum(w.sum(axis=1, keepdims=True), 1e-9)
        fade = np.clip((cutoff - nearest) / (cutoff - 0.018), 0.0, 1.0)
        fade = fade * fade * (3.0 - 2.0 * fade)  # smoothstep
        out[start:start + chunk] = q + delta * fade[:, None]
    for v, p in zip(obj.data.vertices, out):
        v.co = Vector((float(p[0]), float(p[1]), float(p[2])))
    obj.data.update()


def _move_eye(eye, target_center, target_radius):
    centre = np.mean(np.array([[v.co.x, v.co.y, v.co.z] for v in eye.data.vertices], dtype=np.float64), axis=0)
    dist = np.linalg.norm(np.array([[v.co.x, v.co.y, v.co.z] for v in eye.data.vertices], dtype=np.float64) - centre[None, :], axis=1)
    radius = float(np.percentile(dist, 98))
    factor = float(np.clip(target_radius / max(radius, 1e-6), 0.72, 1.08))
    for v in eye.data.vertices:
        p = np.array([v.co.x, v.co.y, v.co.z], dtype=np.float64)
        p = target_center + (p - centre) * factor
        v.co = Vector((float(p[0]), float(p[1]), float(p[2])))
    eye.data.update()
    return radius, factor


def fit_head_to_photo(objs, eyes, F):
    """Geometry-first five-view fit, drop-in replacement for head.fit_head_to_photo.

    1) reconstruct target feature points in 3D from front/±35°/±90° portraits;
    2) ray-cast matching semantic controls on the existing head;
    3) deform the low and high head meshes in XYZ with local falloff;
    4) reposition/resize eyeballs after the sockets, rather than letting the
       generic eyeballs dictate the eyelid geometry.
    """
    pairs = _base.head_correspondences(F, F['lid_ring'])
    views = _load_views()
    target, front_scale = _reconstruct_targets(F, pairs, views)

    head = objs[0]
    front_y = float(F['nose'].y - 0.18)
    fallback_y = float(F['nose'].y + 0.025)
    source = {}
    eye_centres = {
        'eye_l': np.array([F['eye_l'].x, F['eye_l'].y, F['eye_l'].z], dtype=np.float64),
        'eye_r': np.array([F['eye_r'].x, F['eye_r'].y, F['eye_r'].z], dtype=np.float64),
    }
    for key, spec in pairs.items():
        if key in eye_centres:
            source[key] = eye_centres[key]
            continue
        xz = spec[1] if isinstance(spec[0], tuple) else spec
        source[key] = _ray_to_skin(head, xz[0], xz[1], front_y, fallback_y)

    # Skin controls exclude the eyeball centres themselves; eyelid corner/rim
    # controls already move the sockets.  This avoids dragging skin toward the
    # centre of the eyeball.
    skin_keys = [k for k in pairs.keys() if k not in ('eye_l', 'eye_r')]
    src = np.stack([source[k] for k in skin_keys], axis=0)
    dst = np.stack([target[k] for k in skin_keys], axis=0)

    # Guard against a single bad synthetic-profile landmark exploding the fit.
    disp = dst - src
    mag = np.linalg.norm(disp, axis=1)
    keep = mag < 0.055
    src, dst = src[keep], dst[keep]
    for obj in objs:
        _deform_object(obj, src, dst)

    # Fit the separate eye balls AFTER socket geometry.  Real eyeball radius is
    # roughly 40-43% of visible eye-opening width; clamp for game robustness.
    target_left = target['eye_l']
    target_right = target['eye_r']
    left_open = abs(float(target[263][0] - target[362][0]))
    right_open = abs(float(target[133][0] - target[33][0]))
    desired = {
        'eye_l': float(np.clip(left_open * 0.42, 0.0105, 0.0135)),
        'eye_r': float(np.clip(right_open * 0.42, 0.0105, 0.0135)),
    }
    centres_now = [np.mean(np.array([[v.co.x, v.co.y, v.co.z] for v in e.data.vertices]), axis=0) for e in eyes]
    ordered = sorted(zip(eyes, centres_now), key=lambda ec: ec[1][0])  # negative X = eye_r, positive X = eye_l
    eye_stats = []
    for (eye, _), key in zip(ordered, ('eye_r', 'eye_l')):
        radius, factor = _move_eye(eye, target_right if key == 'eye_r' else target_left, desired[key])
        eye_stats.append((key, radius, factor))

    max_move = float(np.max(np.linalg.norm(dst - src, axis=1))) if len(src) else 0.0
    print('PHOTO3D controls', len(src), 'front_scale_m_px', round(front_scale, 7), 'max_control_move_mm', round(max_move * 1000, 1))
    print('PHOTO3D eyes', [(k, round(r * 1000, 1), round(f, 3)) for k, r, f in eye_stats])

    # Preserve the old function's return contract: downstream painting asks for
    # x/z only (mouth, chin, hairline).
    return {key: np.array([float(p[0]), float(p[2])], dtype=np.float64) for key, p in target.items()}
