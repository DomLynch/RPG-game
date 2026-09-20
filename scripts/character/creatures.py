"""Weight the intact reconstructed A-pose, then bind to original combat joints."""

import bpy
import bmesh
import math
import sys
import json
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector

root = Path("artifacts/character/creatures")
family = sys.argv[sys.argv.index("--") + 1]
recipes = {
    "minotaur": ("pitborn", 65, 1.35, (0.055, -0.16, -0.045), 1.85, 48),
    "wraith": ("nightborn", 45, 0.97, (0, -0.20, -0.015), 1.88, 8),
    "werewolf": ("pitborn", 65, 1.10, (0.025, -0.08, -0.045), 1.85, 16),
    "skeleton": ("source/backups/veteran-v1", 60, 1.0, (0, -0.04, -0.025), 1.80, 0),  # the v1 Veteran (Studio body): the shipped veteran.glb is now the v2 reconstruction
    # Re-proportioned donor (build-warrior.mjs BUILD.dwarf, 1.494 m standing): true dwarf height; fingers follow the donor's finger tracks.
    "dwarf": ("source/creatures/dwarf-donor", 60, 1.0, (0, -0.04, -0.025), 1.494, 8),
    # The Executioner is his own donor: the v5 rig (backup) carries his 1.32x root, scythe and clips. Arm pose solved
    # numerically so the posed WeaponDrawn origin lands in the reconstruction's palm (angle 64, reach 1.15, 0.011 m).
    "executioner": ("source/backups/executioner-v5", 64, 1.15, (0.02, -0.12, 0), 1.87, 16),
    # The Veteran is his own donor too: v1 (KeenTools head on the Studio body, backup) carries his rig, trident and
    # clips. The Kontext source stands in a 62° A-pose (docs/character-references/veteran-source-v1.png).
    "veteran": ("source/backups/veteran-v1", 62, 1.0, (0, -0.04, -0.025), 1.82, 16),
}
base, arm_angle, arm_stretch, arm_shift, height, smooth_steps = recipes[family]
# The absolute heights below were tuned on ~1.80 m donors; the short dwarf donor scales them. Every other family keeps k = 1.
k = height / 1.80 if family == "dwarf" else 1.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(f"src/assets/{base}.glb").resolve()))
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
rig.animation_data_clear()
rig.matrix_world.identity()
for p in rig.pose.bones:
    p.matrix_basis.identity()
rig.data.pose_position = "POSE"
bpy.context.view_layer.update()
# The weight donor is posed to the reconstruction. The final clips remain untouched.
for side, sgn in [("l", 1), ("r", -1)]:
    p = rig.pose.bones["upperarm_" + side]
    pivot = p.head.copy()
    angle = math.radians(arm_angle) * sgn
    stretch = arm_stretch
    shift = Vector((sgn * arm_shift[0], arm_shift[1], arm_shift[2]))
    p.matrix = (
        Matrix.Translation(pivot + shift)
        @ Matrix.Rotation(angle, 4, "Y")
        @ Matrix.Translation(-pivot)
        @ p.matrix
        @ Matrix.Diagonal((1, stretch, 1, 1))
    )
    if family == "minotaur":
        thigh = rig.pose.bones["thigh_" + side]
        thigh.matrix = Matrix.Translation((sgn * 0.12, 0, 0)) @ thigh.matrix
bpy.context.view_layer.update()
segments = {
    p.name: (p.head.copy(), p.tail.copy())
    for p in rig.pose.bones
    if any(p.name.startswith(n) for n in ["upperarm_", "lowerarm_", "hand_"])
}
C = Matrix.Rotation(-math.pi / 2, 4, "X")
ci = C.inverted()
binds = {
    p.name: [
        float((C @ (p.matrix @ p.bone.matrix_local.inverted()).inverted() @ ci)[r][c])
        for c in range(4)
        for r in range(4)
    ]
    for p in rig.pose.bones
}
(root / f"{family}-binds.json").write_text(json.dumps(binds))
parts = [bpy.data.objects[n] for n in ["Skin", "Photo"] if n in bpy.data.objects]
# The Veteran keeps his v1 KeenTools head: the Photo/Face/Eyes draws ride along in the pack (creature_pack KEEP_SLOTS), the
# reconstruction is cut at the jaw line (its own soft face, wire hair and mis-sized skull go) and its neck, from the top of
# the shoulders up, is drawn in 8 mm inside the scanned neck's outline row by row (full from 6 cm below the cut), so the
# photographed skin covers the seam, the reconstruction's grey beard stub and its nape hair all round with no ledge: the
# exposed part is a smooth taper from the reconstruction's shoulders to the scan's neck. The helm then fits by construction.
NECK_CUT, NECK_TUCK, NECK_BAND, NECK_SECTORS, NECK_STEP = 1.585, 0.008, 0.125, 24, 0.005


def neck_sector(x, y):
    return int((math.atan2(y, x) + math.pi) / (2 * math.pi) * NECK_SECTORS) % NECK_SECTORS


neck_outline = {}  # (sector, z bin) -> the v1 head/neck's outermost radius there
if family == "veteran":
    for x, y, z in (
        obj.matrix_world @ v.co for name in ("Photo", "Face") for obj in [bpy.data.objects[name]] for v in obj.data.vertices
    ):  # the scanned head with its neck stub, and the Studio neck/collar tiles that ship with it
        if NECK_CUT - NECK_BAND - 0.02 <= z <= NECK_CUT + 0.03:
            key = (neck_sector(x, y), round(z / NECK_STEP))
            neck_outline[key] = max(neck_outline.get(key, 0.0), math.hypot(x, y))
    # The scan's neck tiles thin out at the sides below the collar; fill a row's missing sectors round the circle from
    # its nearest measured neighbours (rows with fewer than a quarter measured are left out and never tuck).
    for zb in {zb for _, zb in neck_outline}:
        have = {s: r for (s, z), r in neck_outline.items() if z == zb}
        if len(have) < NECK_SECTORS // 4:
            continue
        for s in range(NECK_SECTORS):
            if s in have:
                continue
            lo = next(d for d in range(1, NECK_SECTORS) if (s - d) % NECK_SECTORS in have)
            hi = next(d for d in range(1, NECK_SECTORS) if (s + d) % NECK_SECTORS in have)
            a, b = have[(s - lo) % NECK_SECTORS], have[(s + hi) % NECK_SECTORS]
            neck_outline[(s, zb)] = a + (b - a) * lo / (lo + hi)
for obj in parts:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        if mod.type == "ARMATURE":
            bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = parts[0]
body.name = "WeightSource"
# Original T skeleton is retained in the exported package; assembly supplies A-pose inverse binds.
for p in rig.pose.bones:
    p.matrix_basis.identity()
bpy.context.view_layer.update()
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(
    filepath=str((Path(f"src/assets/source/creatures/{family}.glb")).resolve())
)
mesh = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
mesh.name = "CreatureBody"


def base_colour_image(obj):
    for slot in obj.material_slots:
        for node in slot.material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and any(l.to_socket.name == "Base Color" for l in node.outputs[0].links):
                return node.image


def skin_weight(px):
    """0..1 per texel: how much it reads as bare skin (warm hue, moderate saturation), in the image's stored encoding."""
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    top, low = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    sat = (top - low) / np.maximum(top, 1e-4)
    ramp = lambda x, lo, hi: np.clip((x - lo) / (hi - lo), 0, 1)
    return ramp(sat, 0.10, 0.16) * ramp(0.72 - sat, 0, 0.06) * ramp(r - g, 0.02, 0.05) * ramp(r - b, 0.06, 0.10) * ramp(g - b, 0.0, 0.02) * ramp(r, 0.2, 0.28)


def match_skin(image, reference):
    """The reconstruction bakes its skin darker and redder than the photographed head it now wears. Per-channel gains
    on skin-weighted texels bring its mean skin to the donor neck tile's, so the collar seam is geometry, not colour."""
    read = lambda img: np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    ref = read(reference)
    # Only the texels the scan's neck strip shows (its collar tile is darker at the edges), still skin-weighted.
    strip, _ = uv_mask(bpy.data.objects["Face"], reference, lambda lo, hi: lo >= NECK_CUT - NECK_BAND + 0.03 and hi <= NECK_CUT - 0.03)
    w_ref = skin_weight(ref) * strip
    target = (ref[:, :3] * w_ref[:, None]).sum(0) / w_ref.sum()
    px = read(image)
    w = skin_weight(px)
    have = (px[:, :3] * w[:, None]).sum(0) / w.sum()
    gain = np.clip(target / have, 0.8, 1.35)
    px[:, :3] = np.clip(px[:, :3] * (1 + (gain - 1)[None, :] * w[:, None]), 0, 1)
    image.pixels.foreach_set(px.reshape(-1))
    print("SKIN MATCH", image.name, "skin texels", int((w > 0.5).sum()), "have", have.round(3), "target", target.round(3), "gain", gain.round(3), flush=True)
    return px, target


def uv_mask(obj, image, keep):
    """Texels touched by obj's faces that pass keep(min z, max z), with ~2 texels of bleed past each edge."""
    w, h = image.size
    uv = obj.data.uv_layers.active.data
    mask = np.zeros((h, w), dtype=bool)
    faces = 0
    for poly in obj.data.polygons:
        zs = [(obj.matrix_world @ obj.data.vertices[i].co).z for i in poly.vertices]
        if not keep(min(zs), max(zs)):
            continue
        faces += 1
        pts = np.array([(uv[l].uv.x * w, (1 - uv[l].uv.y) * h) for l in poly.loop_indices])
        for tri in range(1, len(pts) - 1):
            a, b, c = pts[0], pts[tri], pts[tri + 1]
            x0, y0 = np.floor(np.minimum.reduce([a, b, c])).astype(int) - 2
            x1, y1 = np.ceil(np.maximum.reduce([a, b, c])).astype(int) + 2
            ys, xs = np.mgrid[max(y0, 0) : min(y1, h), max(x0, 0) : min(x1, w)]
            pxy = np.stack([xs + 0.5, ys + 0.5], -1)
            d = (b - a)[0] * (c - a)[1] - (b - a)[1] * (c - a)[0]
            if abs(d) < 1e-9:
                continue
            u = ((pxy - a)[..., 0] * (c - a)[1] - (pxy - a)[..., 1] * (c - a)[0]) / d
            v = ((b - a)[0] * (pxy - a)[..., 1] - (b - a)[1] * (pxy - a)[..., 0]) / d
            pad = 2.5 / max(1.0, math.sqrt(abs(d)))
            mask[ys, xs] |= (u >= -pad) & (v >= -pad) & (u + v <= 1 + pad)
    return mask.reshape(-1), faces


def paint_neck(image, px, tone, z_from):
    """The visible strip of reconstruction between its shoulders and the scanned neck carries its own baked nape hair and
    beard stub. Every texel a face above z_from touches is painted the matched skin tone (a little grain kept), so the
    strip reads as bare neck under the scan's ragged lower edge."""
    mask, faces = uv_mask(mesh, image, lambda lo, hi: lo >= z_from)
    idx = np.flatnonzero(mask)
    rng = np.random.default_rng(190926)
    grain = 1 + rng.normal(0, 0.025, (len(idx), 1))
    px[idx, :3] = np.clip(tone[None, :] * grain, 0, 1)
    image.pixels.foreach_set(px.reshape(-1))
    print("NECK PAINT faces", faces, "texels", len(idx), "tone", tone.round(3), flush=True)


def save_matched(image):
    # creature_pack.py ships the source WebP byte-for-byte; the matched map goes beside the surface for it to swap in.
    image.file_format = "WEBP"
    image.filepath_raw = str((root / f"{family}-basecolor.webp").resolve())
    image.save(quality=92)


if family == "veteran":
    skin_px, skin_tone = match_skin(base_colour_image(mesh), base_colour_image(bpy.data.objects["Face"]))
coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
lo = min(v.z for v in coords)
hi = max(v.z for v in coords)
for v, p in zip(mesh.data.vertices, coords):
    v.co = Vector(
        (
            p.x * height / (hi - lo),
            p.y * height / (hi - lo),
            (p.z - lo) * height / (hi - lo),
        )
    )
mesh.matrix_world.identity()
mesh.data.update()
if family == "veteran":
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bmesh.ops.bisect_plane(
        bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, NECK_CUT), plane_no=(0, 0, 1), clear_outer=True
    )
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()


def tuck_neck():
    """Runs after decimation, so no edge collapse can move a neck vertex back outside the scanned outline."""
    tucked = 0
    for v in mesh.data.vertices:
        x, y, z = v.co
        if z > NECK_CUT - NECK_BAND:
            s, zb = neck_sector(x, y), round(z / NECK_STEP)
            # The nearest three 5 mm rows, innermost wins: on the beard's sloping underside the row above is wider.
            outline = min([neck_outline[(s, zb + d)] for d in (-1, 0, 1) if (s, zb + d) in neck_outline] or [0.0])
            r = math.hypot(x, y)
            if outline and r > outline - NECK_TUCK:
                t = min(1.0, (z - (NECK_CUT - NECK_BAND)) / (NECK_BAND - 0.06))
                nr = r + (outline - NECK_TUCK - r) * t
                v.co.x, v.co.y = x * nr / r, y * nr / r
                tucked += 1
    mesh.data.update()
    print("NECK CUT", NECK_CUT, "top", round(max(v.co.z for v in mesh.data.vertices), 4), "tucked", tucked, flush=True)
    paint_neck(base_colour_image(mesh), skin_px, skin_tone, NECK_CUT - NECK_BAND)
    save_matched(base_colour_image(mesh))


bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
# The reconstruction duplicates vertices at UV islands. Weld coincident geometry
# before decimation so islands cannot simplify apart and open cracks when posed.
# Blender stores UVs per face corner, so their texture seams remain intact.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.00001)
bpy.ops.object.mode_set(mode="OBJECT")
mesh.data.calc_loop_triangles()
tris = len(mesh.data.loop_triangles)
# The Veteran's surface stops at the jaw; his scanned head (12.7k with eyes and teeth) rides on top under the 60k ceiling.
budget = 39000 if family == "veteran" else 45000
if tris > budget:
    mod = mesh.modifiers.new("Mobile surface", "DECIMATE")
    mod.ratio = budget / tris
    if family == "dwarf":
        # A 1536-res reconstruction carries fine face/beard/finger detail that a uniform collapse turns into shards. Spend the
        # 45k budget where the camera goes: the head (top 24 % of the body) and the hands keep their triangles, the torso,
        # skirt and legs absorb the reduction. Blender collapses vertices with higher group weight first (factor 1 = full effect).
        detail = mesh.vertex_groups.new(name="Mobile surface budget")
        top = max(v.co.z for v in mesh.data.vertices)
        # The head proper (not the shoulders: the reconstructed plate is noisy and collapses smoother when decimated with the torso).
        head_zone = lambda v: v.co.z > top * 0.76 and abs(v.co.x) < 0.14 * height
        for v in mesh.data.vertices:
            hand_zone = abs(v.co.x) > 0.40 * height and 0.40 * height < v.co.z < 0.62 * height
            detail.add([v.index], 0.0 if head_zone(v) or hand_zone else 1.0, "REPLACE")
        mod.vertex_group = detail.name
        mod.vertex_group_factor = 1.0
        # The reconstruction's splayed fingers are thin strips; once the donor's finger tracks curl them they read as splinters.
        # Round the hands into a solid grip before binding (hand zone only; the rest of the surface is untouched).
        hands = mesh.vertex_groups.new(name="Mobile surface hands")
        for v in mesh.data.vertices:
            if abs(v.co.x) > 0.40 * height and 0.40 * height < v.co.z < 0.62 * height:
                hands.add([v.index], 1.0, "REPLACE")
        smooth = mesh.modifiers.new("Hand rounding", "SMOOTH")
        smooth.vertex_group = hands.name
        smooth.factor = 0.6
        smooth.iterations = 12
        bpy.ops.object.modifier_move_to_index(modifier=smooth.name, index=0)
        # The 1536-res head carries micro-facets and hairline holes in the beard that shade as dark triangles. Close the
        # holes, then relax the head surface volume-preservingly: the beard/lower face (below the nose line) gets the full
        # relaxation, the upper face (brow, eyes, nose) a third of it so its features stay crisp.
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.fill_holes(sides=8)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        head_relax = mesh.vertex_groups.new(name="Mobile surface head")
        for v in mesh.data.vertices:
            if head_zone(v):
                head_relax.add([v.index], 1.0 if v.co.z < top * 0.90 else 0.35, "REPLACE")
        relax = mesh.modifiers.new("Head relaxation", "LAPLACIANSMOOTH")
        relax.vertex_group = head_relax.name
        relax.lambda_factor = 0.35
        relax.lambda_border = 0.0
        relax.iterations = 4
        relax.use_volume_preserve = True
        relax.use_normalized = True
        bpy.ops.object.modifier_move_to_index(modifier=relax.name, index=1)
    for m in list(mesh.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
if family == "veteran":
    tuck_neck()
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.data_transfer(
    data_type="VGROUP_WEIGHTS",
    vert_mapping="POLYINTERP_NEAREST",
    layers_select_src="ALL",
    layers_select_dst="NAME",
    use_create=True,
)
head = mesh.vertex_groups["Head"]
pelvis = mesh.vertex_groups["pelvis"]
for v in mesh.data.vertices:
    x, y, z = v.co
    # Crown and horns are one rigid skull. Wisps hang from the pelvis, never knee joints.
    rigid = (
        head
        if z > 1.62 * k or (abs(x) < 0.20 and z > 1.53 * k)
        else pelvis
        if (family == "wraith" and z < 1.04)
        or (family == "minotaur" and abs(x) < 0.11 and z < 0.98 and y > 0.16)
        else None
    )
    ws = (
        [(rigid.index, 1)]
        if rigid
        else sorted(
            [(g.group, g.weight) for g in v.groups if g.weight > 1e-6],
            key=lambda a: -a[1],
        )[:4]
    )
    # Disallow nearest-body transfer from attaching claws to the adjacent thigh.
    edge = (0.23 + max(0, 1.30 - z) * 0.23) if family in ("minotaur", "werewolf", "executioner") else 0.27
    if family in ("skeleton", "veteran"):  # a man on the Veteran's rig: arm starts 18.5 cm off the midline
        edge = 0.185 + max(0, 1.4 - z) * 0.26
    if family == "dwarf":
        edge = 0.185 * k + max(0, 1.4 * k - z) * 0.26
    arm_mix = max(
        0, min(1, (abs(x) - edge) / (0.10 if family in ("minotaur", "werewolf", "executioner") else 0.055))
    ) * max(0, min(1, (1.62 * k - z) / 0.10))
    if rigid == head:
        arm_mix = 0
    arm_mix *= max(0, min(1, (z - (0.50 * k if family in ("minotaur", "werewolf", "skeleton", "dwarf", "executioner", "veteran") else 0.92)) / 0.10))
    # Human hands (the Executioner): keep the donor's transferred finger weights on the arm so the clips curl his
    # fingers round the haft; the segment blend below is for claws and mitts and pins fingers rigid to the hand.
    keep_fingers = family in ("executioner", "dwarf", "veteran") and arm_mix > 0.5
    if not rigid and not keep_fingers:
        arm_names = (
            "upperarm",
            "lowerarm",
            "hand",
            "thumb",
            "index",
            "middle",
            "ring",
            "pinky",
            "clavicle",
        )
        ws = [
            (i, w)
            for i, w in ws
            if not mesh.vertex_groups[i].name.startswith(arm_names)
        ]
        total = sum(w for _, w in ws)
        if total:
            ws = [(i, w / total) for i, w in ws]
        else:
            side = "l" if x > 0 else "r"
            name = (
                "neck_01"
                if z > 1.48 * k
                else "spine_03"
                if z > 1.30 * k
                else "spine_02"
                if z > 1.10 * k
                else "spine_01"
                if z > 0.98 * k
                else "pelvis"
                if z > 0.84 * k
                else "thigh_" + side
                if z > 0.52 * k
                else "calf_" + side
                if z > 0.18 * k
                else "foot_" + side
            )
            ws = [(mesh.vertex_groups[name].index, 1)]
    if arm_mix and not keep_fingers:
        side = "l" if x > 0 else "r"
        dist = []
        for name in ["upperarm_" + side, "lowerarm_" + side, "hand_" + side]:
            a, b = segments[name]
            ab = b - a
            t = max(0, min(1, (v.co - a).dot(ab) / ab.length_squared))
            dist.append(
                (mesh.vertex_groups[name].index, (v.co - (a + t * ab)).length_squared)
            )
        nearest = min(d for _, d in dist)
        manual = [(i, math.exp(-(d - nearest) / 0.003)) for i, d in dist]
        total = sum(w for _, w in manual)
        merged = {i: w * (1 - arm_mix) for i, w in ws}
        for i, w in manual:
            merged[i] = merged.get(i, 0) + arm_mix * w / total
        ws = sorted(merged.items(), key=lambda a: -a[1])[:4]
    if family == "skeleton":
        # Exposed ribs and long bones are rigid; broad flesh blends bend the tibia.
        if arm_mix == 0 and 1.04 < z < 1.48:
            ws = [(mesh.vertex_groups["spine_03"].index, 1)]
        elif arm_mix > 0.95:
            ws = [(max(ws, key=lambda pair: pair[1])[0], 1)]
        elif z < 0.84 and arm_mix == 0:
            side = "l" if x > 0 else "r"
            name = ("foot_" if z < 0.15 else "calf_" if z < 0.52 else "thigh_") + side
            ws = [(mesh.vertex_groups[name].index, 1)]
    for group in [g.group for g in v.groups]:
        mesh.vertex_groups[group].remove([v.index])
    total = sum(w for _, w in ws)
    if not total:
        pelvis.add([v.index], 1, "REPLACE")
    else:
        for g, w in ws:
            mesh.vertex_groups[g].add([v.index], w / total, "REPLACE")
# Smooth across welded spatial neighbours, including UV seams, then retain four influences.
coords = np.array([tuple(v.co) for v in mesh.data.vertices])
unique, inv = np.unique(np.round(coords, 5), axis=0, return_inverse=True)
w = np.zeros((int(inv.max()) + 1, len(mesh.vertex_groups)), dtype=np.float32)
counts = np.bincount(inv)
for v, i in zip(mesh.data.vertices, inv):
    for g in v.groups:
        w[i, g.group] += g.weight
w /= counts[:, None]
mesh.data.calc_loop_triangles()
tri = np.array([t.vertices for t in mesh.data.loop_triangles])
tri = inv[tri]
a = tri[:, [0, 1, 2]].reshape(-1)
b = tri[:, [1, 2, 0]].reshape(-1)
a, b = np.concatenate([a, b]), np.concatenate([b, a])
degree = np.bincount(a, minlength=len(w))
for _ in range(smooth_steps):
    sums = np.zeros_like(w)
    np.add.at(sums, a, w[b])
    w = 0.35 * w + 0.65 * sums / np.maximum(1, degree)[:, None]
for v, i in zip(mesh.data.vertices, inv):
    for group in [g.group for g in v.groups]:
        mesh.vertex_groups[group].remove([v.index])
    ids = np.argsort(w[i])[-4:]
    total = float(w[i, ids].sum())
    for g in ids:
        weight = float(w[i, g]) / total
        if weight > 1e-6:
            mesh.vertex_groups[int(g)].add([v.index], weight, "REPLACE")
for p in mesh.data.polygons:
    p.use_smooth = True
mesh.parent = rig
mesh.matrix_parent_inverse.identity()
mod = mesh.modifiers.new("Combat skeleton", "ARMATURE")
mod.object = rig
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.wm.save_as_mainfile(filepath=str((root / f"{family}-fitted.blend").resolve()))
bpy.ops.export_scene.gltf(
    filepath=str((root / f"{family}-surface.glb").resolve()),
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_skins=True,
    export_extras=True,
    export_image_format="AUTO",
)
print("FITTED", family, len(mesh.data.vertices), len(mesh.data.polygons), flush=True)
