"""A TRELLIS.2 head (one mesh, one texture, any scale) → the head GLB `head.py` expects from KeenTools: one mesh with four
material slots in order (Head, EyeLeft, EyeRight, Teeth), each textured, in KeenTools' units (eye spacing 0.5755, eyeballs of
radius 0.152 sitting behind the lids, teeth 0.64 below the eye line — measured on the hero's scan, 2026-09-20). The eye sockets
are found the way the portraits are read: a flat-lit orthographic front render, the MediaPipe landmark model (iris centres),
then rays back onto the mesh. Eyeballs and teeth are borrowed from a donor scan (their textures are repainted downstream by
`eye_colour`/`dark_eyes`; the teeth never show — no fighter opens his mouth). Nothing in head.py changes: point a fighter's
`kt_glb` at the output.

  blender -b --python-exit-code 1 -P scripts/character/trellis_head.py -- <trellis.glb> <out.glb> [--portrait <front.png>] [--donor <kt.glb>] [--python <face venv python>]

With --portrait, the texture's skin is matched to the portrait's skin: TRELLIS.2 bakes the face two to three times darker than
the photograph it was given (measured 2026-09-20: cheek luminance .12–.21 against the portrait's .46), and the pipeline paints the
body to the head's tone. The gain comes from the same landmark points on both (cheeks, forehead, chin), so hair and cloth stay dark.

Writes <out>.json beside the GLB with what it measured (eye spacing found, scale applied, landmark confidence), and the front
render + landmark overlay under artifacts/character/trellis-head/ for the receipt.
"""
import json
import math
import os
import subprocess
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
donor = args[args.index('--donor') + 1] if '--donor' in args else 'artifacts/source/keentools/01a0a628-a661-7ec2-89ec-735ecb733b5f.glb'
python = args[args.index('--python') + 1] if '--python' in args else os.path.expanduser('~/.venvs/face/bin/python')
portrait = args[args.index('--portrait') + 1] if '--portrait' in args else None
SKIN_POINTS = (50, 280, 10, 151, 152, 168, 425, 205)  # cheeks, forehead, chin, nose bridge, cheekbones
EYE_SPACING, EYE_RADIUS, EYE_MID = 0.5755, 0.152, Vector((0.006, -0.792, 0.362))  # KeenTools' units, from the hero's scan
IRIS_L, IRIS_R = 473, 468  # MediaPipe refined-landmark iris centres (the subject's left eye is on the image's right)
LID_L = (362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398)  # the lid margins, in order round the opening
LID_R = (33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246)
work = 'artifacts/character/trellis-head'
os.makedirs(work, exist_ok=True)


def only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def import_mesh(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in set(bpy.data.objects) - before]
    mesh = next(o for o in new if o.type == 'MESH')
    only([mesh])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o is not mesh:
            bpy.data.objects.remove(o, do_unlink=True)
    mesh.parent = None
    return mesh


bpy.ops.wm.read_factory_settings(use_empty=True)
head = import_mesh(src)
head.name = 'Head'
if len(head.data.materials) != 1 or not head.data.materials[0] or not head.data.materials[0].use_nodes:
    sys.exit(f'expected one node material on the TRELLIS mesh, found {[m.name if m else None for m in head.data.materials]}')
tex = next((n for n in head.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
if tex is None:
    sys.exit('the TRELLIS material carries no image texture')
head.data.materials[0].name = 'Material_0'


def front_render(mesh, yaw):
    """Flat-lit orthographic view of the face (looking along +Y, the face at -Y after `yaw`), 1024², the pipeline's own
    reference-photo setup (render_head.py). Returns the PNG path and the frame (cam x, cam z, ortho scale) for the rays back."""
    if yaw:
        mesh.data.transform(Matrix.Rotation(math.radians(yaw), 4, 'Z'))
        mesh.data.update()
    vs = [v.co for v in mesh.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    cx, cz = (lo.x + hi.x) / 2, (lo.z + hi.z) / 2
    span = max(hi.x - lo.x, hi.z - lo.z) * 1.15
    scene = bpy.context.scene
    cam = bpy.data.objects.get('cam') or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    if cam.name not in scene.collection.objects:
        scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = span
    cam.data.clip_start, cam.data.clip_end = 0.01, 100
    cam.location = (cx, lo.y - 10, cz)
    cam.rotation_euler = (math.radians(90), 0, 0)  # looking along +Y
    scene.camera = cam
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x = scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new('grey')
    scene.world.color = (0.35, 0.35, 0.35)
    path = os.path.join(work, f'front-yaw{yaw}.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path, (cx, cz, span)


def landmarks(png):
    r = subprocess.run([python, 'scripts/character/landmarks.py', png], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return json.load(open(png.rsplit('.', 1)[0] + '.landmarks.json'))


lm, frame, current, yaw_used = None, None, 0, None
for yaw in (0, 180, 90, -90):  # the face is wherever the landmark model finds it: turn the head until a front view reads
    png, frame = front_render(head, yaw - current)
    current, yaw_used = yaw, yaw
    lm = landmarks(png)
    if lm:
        break
if not lm:
    sys.exit('no face found in any front render — is this a head?')
w, h = lm['width'], lm['height']
cx, cz, span = frame


def ray_from_pixel(px, py):
    x = cx + (px / w - 0.5) * span
    z = cz - (py / h - 0.5) * span
    hit, loc, normal, _ = head.ray_cast(Vector((x, -100, z)), Vector((0, 1, 0)))
    return loc if hit else None


iris = {}
for name, idx in (('l', IRIS_L), ('r', IRIS_R)):
    px, py = lm['points'][idx]
    loc = ray_from_pixel(px, py)
    if loc is None:
        sys.exit(f'iris {name} ray missed the mesh at pixel {px:.0f},{py:.0f}')
    iris[name] = loc
# The reconstruction is a closed surface with the eyes painted on it. Cut each lid opening (the landmark contour, rays onto the
# mesh, faces whose centre falls inside it and near its depth) so the eyeballs — and their painted iris — show the way a scan's do.


def inside(pt, poly):
    x, z = pt
    n, hit = len(poly), False
    for i in range(n):
        (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % n]
        if (z1 > z) != (z2 > z) and x < x1 + (z - z1) * (x2 - x1) / (z2 - z1):
            hit = not hit
    return hit


openings = {}
for key, ring in (('l', LID_L), ('r', LID_R)):
    pts = []
    for idx in ring:
        px, py = lm['points'][idx]
        loc = ray_from_pixel(px, py)
        if loc is not None:
            pts.append(loc)
    if len(pts) >= 6:
        openings[key] = pts
bm = bmesh.new()
bm.from_mesh(head.data)
cut = []
for key, pts in openings.items():
    cx_, cz_ = sum(p.x for p in pts) / len(pts), sum(p.z for p in pts) / len(pts)
    poly = [(cx_ + (p.x - cx_) * 1.2, cz_ + (p.z - cz_) * 1.2) for p in pts]  # a fifth wider than the landmark margin: the lid's thickness, so the opening reads at phone size
    depth_y, width = sum(p.y for p in pts) / len(pts), max(p.x for p in pts) - min(p.x for p in pts)
    for f in bm.faces:
        c = f.calc_center_median()
        if abs(c.y - depth_y) < width and inside((c.x, c.z), poly):  # the lid surface within an eye's width of the margin's depth; the skull behind is far beyond it
            cut.append(f)
bmesh.ops.delete(bm, geom=list(set(cut)), context='FACES')
bm.to_mesh(head.data)
bm.free()
head.data.update()
print(f'TRELLIS_HEAD eye openings cut: {len(set(cut))} faces over {len(openings)} eye(s)')

# Texture ↔ portrait tone match: the texel under each skin landmark (ray → face → its UV) against the portrait's own pixels there.
gain = None
if portrait:
    uvs = head.data.uv_layers.active.data
    skin_uv = []
    for idx in SKIN_POINTS:
        px, py = lm['points'][idx]
        hit, loc, normal, face_index = head.ray_cast(Vector((cx + (px / w - 0.5) * span, -100, cz - (py / h - 0.5) * span)), Vector((0, 1, 0)))
        if hit:
            poly = head.data.polygons[face_index]
            u = sum((uvs[li].uv for li in poly.loop_indices), Vector((0, 0))) / len(poly.loop_indices)
            skin_uv.append([u.x, u.y])
    tex_png = os.path.join(work, 'texture.png')
    tex.image.filepath_raw = tex_png
    tex.image.file_format = 'PNG'
    tex.image.save()
    r = subprocess.run([python, 'scripts/character/landmarks.py', portrait], capture_output=True, text=True)
    if r.returncode == 0 and skin_uv:
        matched = os.path.join(work, 'texture-matched.png')
        code = f'''
import json, cv2, numpy as np
tex = cv2.imread({tex_png!r}, cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
por = cv2.imread({portrait!r})[:, :, ::-1].astype(np.float32) / 255
plm = json.load(open({portrait.rsplit('.', 1)[0] + '.landmarks.json'!r}))['points']
H, W = tex.shape[:2]
def patch(im, x, y, r=5):
    y0, x0 = max(0, int(y) - r), max(0, int(x) - r)
    return im[y0:int(y) + r, x0:int(x) + r, :3].reshape(-1, 3)
t = np.concatenate([patch(tex, u * W, (1 - v) * H) for u, v in {skin_uv!r}])
p = np.concatenate([patch(por, plm[i][0], plm[i][1]) for i in {list(SKIN_POINTS)!r}])
t = t[t.max(axis=1) > 0.04]
gain = np.median(p, axis=0) / np.maximum(np.median(t, axis=0), 1e-3)
gain = np.clip(gain, 0.5, 4.0)
out = tex.copy()
out[:, :, :3] = 1 - np.clip(1 - tex[:, :, :3] * gain[None, None, ::1], 0, 1)   # a plain gain, clipped: highlights are rare on a matte face
cv2.imwrite({matched!r}, (np.clip(out, 0, 1) * 255).round().astype(np.uint8))
print(json.dumps({{'gain': gain.tolist(), 'texture_skin': np.median(t, axis=0).tolist(), 'portrait_skin': np.median(p, axis=0).tolist()}}))
'''
        r2 = subprocess.run([python, '-c', code], capture_output=True, text=True)
        if r2.returncode == 0:
            gain = json.loads(r2.stdout.strip().splitlines()[-1])
            new_img = bpy.data.images.load(matched)
            new_img.name = 'Image_0'
            tex.image = new_img
            new_img.pack()
        else:
            print('TONE MATCH FAILED', r2.stderr[-400:])
# The eyeballs sit behind the lid surface: the donor's own eye sits `depth` behind the point in front of it (measured below).
spacing = abs(iris['l'].x - iris['r'].x)
scale = EYE_SPACING / spacing
mid = (iris['l'] + iris['r']) / 2
M = Matrix.Translation(EYE_MID) @ Matrix.Scale(scale, 4) @ Matrix.Translation(-mid)
head.data.transform(M)
head.data.update()
for k in iris:
    iris[k] = M @ iris[k]

# Donor: eyeballs and teeth, and how deep an eye sits behind the surface in front of it.
donor_obj = import_mesh(donor)
donor_slots = [m.name for m in donor_obj.data.materials]  # by slot order — the names may carry Blender's .001 suffixes here
only([donor_obj])
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
pieces = {}
for o in bpy.context.selected_objects:
    m = next((mm for mm in o.data.materials if mm), None)
    pieces[donor_slots.index(m.name)] = o
d_head, d_eye_a, d_eye_b, d_teeth = pieces[0], pieces[1], pieces[2], pieces[3]


def centroid(o):
    return sum((v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)


ca, cb = centroid(d_eye_a), centroid(d_eye_b)
d_eye_l, d_eye_r = (d_eye_a, d_eye_b) if ca.x > cb.x else (d_eye_b, d_eye_a)
depths = []
for e in (d_eye_l, d_eye_r):
    c = centroid(e)
    hit, loc, _, _ = d_head.ray_cast(Vector((c.x, -100, c.z)), Vector((0, 1, 0)))
    if hit:
        depths.append(c.y - loc.y)
depths = [d for d in depths if 0 < d < 2 * EYE_RADIUS]  # a ray through the lid opening finds the socket's back: not a depth
depth = sum(depths) / len(depths) if depths else EYE_RADIUS * 0.8
d_mid = (centroid(d_eye_l) + centroid(d_eye_r)) / 2
teeth_offset = centroid(d_teeth) - d_mid
for e, key in ((d_eye_l, 'l'), (d_eye_r, 'r')):
    target = iris[key] + Vector((0, EYE_RADIUS - 0.012, 0))  # the cornea a hair inside the opening: the reconstruction painted the eye ON the surface, so the surface is where the eye's front was
    e.data.transform(Matrix.Translation(target - centroid(e)))
mouth = (iris['l'] + iris['r']) / 2 + teeth_offset
hit, lips, _, _ = head.ray_cast(Vector((mouth.x, -100, mouth.z)), Vector((0, 1, 0)))  # the teeth sit behind whatever this face has for lips; nobody opens his mouth
d_teeth.data.transform(Matrix.Translation(Vector((mouth.x, (lips.y if hit else mouth.y) + 0.45, mouth.z)) - centroid(d_teeth)))
bpy.data.objects.remove(d_head, do_unlink=True)

# One mesh, four slots in KeenTools' order: the head's material first, then the donor's eye and teeth materials.
for o in (d_eye_l, d_eye_r, d_teeth):
    head.data.materials.append(o.data.materials[0])
only([head, d_eye_l, d_eye_r, d_teeth])
bpy.ops.object.join()
head = bpy.context.view_layer.objects.active
head.name = 'Head'
for i, m in enumerate(head.data.materials):  # KeenTools' names, in KeenTools' order
    m.name = f'Material_{i}'
slots = [m.name for m in head.data.materials]
assert slots == ['Material_0', 'Material_1', 'Material_2', 'Material_3'], slots
only([head])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_animations=False)
report = {'source': src, 'donor': donor, 'portrait': portrait, 'tone': gain, 'yaw': yaw_used, 'eye_spacing_found': spacing, 'scale': scale, 'eye_depth': depth,
          'iris_l': list(iris['l']), 'iris_r': list(iris['r']), 'slots': slots, 'vertices': len(head.data.vertices),
          'triangles': sum(len(p.vertices) - 2 for p in head.data.polygons)}
json.dump(report, open(out.rsplit('.', 1)[0] + '.json', 'w'), indent=1)
print('TRELLIS_HEAD', json.dumps(report))
