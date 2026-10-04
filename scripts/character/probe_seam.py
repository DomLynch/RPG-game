"""Collar seam receipt: the colour step across the neck ring in a built warrior.glb.
`blender -b --python scripts/character/probe_seam.py -- src/assets/warrior.glb` prints, per 30° around the neck, the
median 8-bit sRGB colour of the head tile 3–12 mm above the ring and of the body tile 3–12 mm below, and their
difference (mean |dRGB|). v35: mean 12.1 / max 23.4; v36: mean 5.4 / max 18.4."""
import bpy, sys, math, numpy as np
path = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
def image_of(obj):
    for m in obj.data.materials:
        if not m or not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and 'Base' in (n.outputs[0].links[0].to_socket.name if n.outputs[0].links else ''):
                return n.image
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image: return n.image
def pixels(img):
    w, h = img.size; px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); return px.reshape(h, w, 4)[:, :, :3], w, h
meshes = {o.name: o for o in bpy.data.objects if o.type == 'MESH'}
photo = next(o for n, o in meshes.items() if 'Photo' in n and 'Eyes' not in n and 'Teeth' not in n)
face = next(o for n, o in meshes.items() if n.startswith('Face') or n == 'Face')
def samples(obj, zsel):
    img = image_of(obj); px, w, h = pixels(img)
    me = obj.data; uv = me.uv_layers[0].data
    out = []
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            co = obj.matrix_world @ v.co
            if zsel(co.z):
                u, t = uv[li].uv
                c = px[min(h - 1, int(t * h)) % h, min(w - 1, int(u * w)) % w]
                out.append((math.atan2(co.y, co.x), c))
    return out
fz = [(face.matrix_world @ v.co) for v in face.data.vertices]
ring = max(c.z for c in fz) - 0.0015   # the base neck is cut 1.5 mm above the collar ring
pz = [(photo.matrix_world @ v.co) for v in photo.data.vertices]
top = [c for c in pz if ring - 0.001 < c.z < ring + 0.003 and abs(c.x) < 0.08]  # the stub's own bottom ring (the pipeline's azimuth axis)
ax = sum(c.x for c in top) / len(top); ay = sum(c.y for c in top) / len(top)
rad = max(math.hypot(c.x - ax, c.y - ay) for c in top) + 0.003
print(f'ring z {ring:.4f} axis ({ax:.3f},{ay:.3f}) radius {rad:.3f}')
def samples(obj, zsel):
    img = image_of(obj); px, w, h = pixels(img)
    me = obj.data; uv = me.uv_layers[0].data
    out = []
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            co = obj.matrix_world @ v.co
            if zsel(co.z) and math.hypot(co.x - ax, co.y - ay) < rad:
                u, t = uv[li].uv
                c = px[min(h - 1, int(t * h)) % h, min(w - 1, int(u * w)) % w]
                out.append((math.atan2(co.y - ay, co.x - ax), c))
    return out
above = samples(photo, lambda z: ring + 0.003 < z < ring + 0.012)   # the head's collar band, 3-12 mm above the ring (chin excluded by radius)
below = samples(face, lambda z: ring - 0.012 < z < ring - 0.003)    # the neck, 3-12 mm below
def srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255
bins = 12; steps = []
for b in range(bins):
    lo, hi = -math.pi + b * 2 * math.pi / bins, -math.pi + (b + 1) * 2 * math.pi / bins
    a = [c for az, c in above if lo <= az < hi]; d = [c for az, c in below if lo <= az < hi]
    if len(a) > 5 and len(d) > 5:
        steps.append(np.abs(srgb(np.median(a, axis=0)) - srgb(np.median(d, axis=0))).mean()); print(f'  bin {b:2d} az {math.degrees((lo+hi)/2):+5.0f}: head {np.round(srgb(np.median(a, axis=0)))} neck {np.round(srgb(np.median(d, axis=0)))} step {steps[-1]:.1f}')
print(f'SEAM {path}: colour step across the collar ring (mean |dRGB| in 8-bit sRGB, median 3-12 mm above vs below, per 30-deg bin): mean {np.mean(steps):.1f}  max {np.max(steps):.1f}  bins {len(steps)}  ({len(above)} head / {len(below)} neck samples)')
