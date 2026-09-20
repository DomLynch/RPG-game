"""Fit a TRELLIS.2 weapon reconstruction to the game's weapon contract (weapons lane, Phase 2 polish, 2026-09-20).

    blender -b --python-exit-code 1 -P scripts/weapon-fit.py -- trident [--debug]

Reads the immutable source `src/assets/source/weapons/<id>.glb` (the Space's 100k-face extraction, provenance beside it) and
writes `src/assets/source/weapons/<id>.part.glb`: one node named WeaponDrawn, local Y along the weapon with the hand at y = 0,
the striking segment exactly where the shipped procedural part put it (extras.contact — the blade bake, the sim and the combat
data never change), on a phone budget, with the reconstruction's own colour and metal/rough maps.

Two surfaces per weapon. The HEAD (fork, blade) keeps the reconstruction, decimated. Below it the reconstruction is a stack of
overlapping coil shells — welding goes non-manifold, decimating tears the ridges into spikes (both measured on the trident) — so
the grip, wraps and butt are a clean LATHE whose colour is baked from the reconstruction (Cycles, selected → active): the
silhouette is a cylinder, the texture carries the leather turns and the grain. Where the concept picture cropped the weapon, the
lathe repeats the reconstruction's own rows. The fit is measured, never eyeballed: landmarks come from the mesh's width profile.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

weapon = sys.argv[sys.argv.index("--") + 1]
SOURCE = Path("src/assets/source/weapons")
TEX_U, TEX_V = 256, 1024  # the baked strip: around × along

# Each recipe: the shipped contact segment, where the head starts on the contract (`head_at`), how to find it on the
# reconstruction (`head`: 'wide' = the first point clearly outside the shaft; 'flat' = where the section turns blade-thin), which
# end is up (`up`: wide | flat | narrow), the
# handle's layout on the contract, and the phone budget. `edge`: 'bend' turns the part so its hook faces +x (the sword family's
# edge side); the fork needs nothing.
RECIPES = {
    # The Veteran's short trident (owner's pick, 2026-09-16): fork 0.76–1.22 m, butt −0.20, grips under both hands.
    "trident": dict(contact=(0.76, 1.22), head_at=0.75, head="wide", up="wide", butt=-0.20, grips=[(-0.11, 0.11), (0.29, 0.51)],
                    shaft_rgb=(0.36, 0.22, 0.13), tris=4000, texture=512),
    # The Pitborn's cleaver (owner's pick A, the fat scythe): edge 0.14–0.86 m, blade root 0.10, one-hand grip −0.125–0.075.
    # (the reconstruction's own grip is 7 cm of near-black: the lathe is the contract's 20 cm in the procedural haft's dark wood)
    "cleaver": dict(contact=(0.14, 0.86), head_at=0.10, head="flat", up="flat", edge="bend", butt=-0.125, grips=[],
                    shaft_rgb=(0.07, 0.036, 0.015), tris=4000, texture=512),
    # The Goblin's sica (owner's pick A): edge 0.12–0.52 m, blade root 0.09, forward grip −0.11–0.065, an inward hook.
    "knife": dict(contact=(0.12, 0.52), head_at=0.09, head="flat", up="flat", edge="bend", butt=-0.11, grips=[], tris=2500, texture=512),
    # The Nightborn's estoc (A): the point 0.75–1.15 m, the cross under the blade at 0.088, wire grip −0.11–0.088, wheel pommel.
    # The hero's longsword (build-warrior.mjs sword()): the blade 0.18–0.86 m, the cross under it at 0.081, leather grip, wheel pommel.
    "longsword": dict(contact=(0.18, 0.86), head_at=0.081, head="wide", up="narrow", butt=-0.105, grips=[], tris=3000, texture=512),
    "estoc": dict(contact=(0.75, 1.15), head_at=0.088, head="wide", up="narrow", butt=-0.13, grips=[], tris=2000, texture=512),  # the brief: ≤ 2k tris (tests)
    # The Executioner's scythe (owner's pick B): head at 1.32 m (contact 1.22–1.32), butt −0.40, grips under both hands, the blade
    # out along +x in the HORIZONTAL plane sweeping toward game +z (Blender −y). The picture shows a moon in the pole's plane on
    # both sides: the fit keeps the bigger blade, cuts the other off and lays the blade flat; the pole is fitted butt-to-socket.
    "scythe": dict(contact=(1.22, 1.32), head_at=1.31, head="wide", up="wide", fit=("bottom", "head"), butt=-0.40, grips=[(-0.11, 0.11), (0.39, 0.61)],
                   socket=0.13, blade="flat", shaft_rgb=(0.36, 0.22, 0.13), tris=4500, texture=512),
}
recipe = RECIPES[weapon]
raw, out = SOURCE / f"{weapon}.glb", SOURCE / f"{weapon}.part.glb"
c0, c1 = recipe["contact"]
butt = recipe["butt"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(raw.resolve()))
obj = next(o for o in bpy.data.objects if o.type == "MESH")
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
if obj.parent:
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
obj.rotation_mode = "XYZ"  # the glTF importer leaves objects in quaternion mode
me = obj.data
source_tris = sum(len(p.vertices) - 2 for p in me.polygons)


def apply_transform():
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def coords():
    return [v.co.copy() for v in me.vertices]


def extent(P, axis):
    return max(p[axis] for p in P) - min(p[axis] for p in P)


apply_transform()

# 1. Orientation. The Space frames the object however the picture suggested (the trident stood, the cleaver lay flat): the
# principal extents say which axis is which. Length → Z (the game's local Y on export), width → X, thickness → Y; the thin axis
# is mirrored if needed to keep a proper rotation (a blade is symmetric through its plane). Then, for a blade, the hook toward +x.
P = coords()
ext = [extent(P, i) for i in range(3)]
long_, wide_, thin_ = sorted(range(3), key=lambda i: -ext[i])
assert ext[long_] > ext[wide_] * 2, f"{weapon}: no clear length axis {ext}"
M = Matrix.Diagonal((0.0, 0.0, 0.0))
M[2][long_], M[0][wide_], M[1][thin_] = 1.0, 1.0, 1.0
if M.determinant() < 0:
    M[1][thin_] = -1.0
me.transform(M.to_4x4())
me.update()
P = coords()
# Which end is the head (`up`): a fork's is the wider end, a blade's the flatter one (width over thickness), a thrusting
# sword's the narrower one (its guard is the wide part, at the hand).
lo, hi = min(p.z for p in P), max(p.z for p in P)
ends = [[p for p in P if p.z < lo + 0.3 * (hi - lo)], [p for p in P if p.z > hi - 0.3 * (hi - lo)]]
score = [{"wide": extent(E, 0), "flat": extent(E, 0) / max(1e-6, extent(E, 1)), "narrow": -extent(E, 0)}[recipe["up"]] for E in ends]
if score[0] > score[1]:
    me.transform(Matrix.Rotation(math.pi, 4, "X"))
    me.update()
    P = coords()
z_tip, z_bottom = max(p.z for p in P), min(p.z for p in P)
if recipe.get("blade") == "flat":  # a scythe: the bigger blade to +x (mirrored in X and Y — a proper rotation about Z), the other goes
    head_pts = [p for p in P if p.z > z_tip - 0.3 * (z_tip - z_bottom)]
    if max(p.x for p in head_pts) < -min(p.x for p in head_pts):
        me.transform(Matrix.Rotation(math.pi, 4, "Z"))
        me.update()
        P = coords()
if recipe.get("edge") == "bend":  # the tip's side of the axis is the edge's side: turn it to +x
    tip_x = sum(p.x for p in P if p.z > z_tip - 0.15 * (z_tip - z_bottom)) / max(1, sum(1 for p in P if p.z > z_tip - 0.15 * (z_tip - z_bottom)))
    if tip_x < 0:
        obj.rotation_euler.z = math.pi
        apply_transform()
        P = coords()

# 2. Landmarks from the profile, then one uniform scale and shift: the head's start and the tip land on the contract.
# The handle's radius: the narrowest 1 cm band in the lower third (a pommel or a guard in that span must not fatten the grip).
lower = [z_bottom + i * 0.01 for i in range(int(0.33 * (z_tip - z_bottom) / 0.01))]
shaft_r = min(r for r in (max((math.hypot(p.x, p.y) for p in P if z <= p.z < z + 0.01), default=0) for z in lower) if r > 0)
if recipe["head"] == "wide":
    z_head = min(p.z for p in P if abs(p.x) > 4 * shaft_r)
else:  # 'flat': the lowest 1 cm slice whose section is more than twice as wide as thick
    slices = [(z, [p for p in P if z <= p.z < z + 0.01]) for z in [z_bottom + i * 0.01 for i in range(int((z_tip - z_bottom) / 0.01))]]
    z_head = next(z for z, S in slices if S and extent(S, 0) > 2 * extent(S, 1) and extent(S, 0) > 2.2 * shaft_r)
if recipe.get("fit") == ("bottom", "head"):  # a polearm whose head goes sideways: the pole's length is what the contract fixes
    s = (recipe["head_at"] - butt) / (z_head - z_bottom)
    obj.scale = (s, s, s)
    apply_transform()
    obj.location.z = butt - z_bottom * s
else:
    s = (c1 - recipe["head_at"]) / (z_tip - z_head)
    obj.scale = (s, s, s)
    apply_transform()
    obj.location.z = c1 - z_tip * s
apply_transform()
P = coords()
z_bottom, shaft_r = min(p.z for p in P), shaft_r * s
print(f"[weapon-fit] fitted ×{s:.4f}: head at {recipe['head_at']:.3f} (was {z_head:.3f} raw), tip {max(p.z for p in P):.3f}, handle from {z_bottom:.3f}, radius {shaft_r:.4f}")


def radius_at(z):
    r = [math.hypot(p.x, p.y) for p in P if z <= p.z < z + 0.01]
    return max(r) if r else 0


# 3. The handle on the reconstruction: 1 cm bands from the bottom to the head. A wrap is a band thicker than the bare shaft
# (1.25–2.2×) below the ferrule; the ferrule is the last 3 cm under the head; the head starts 1.2 cm above the last wrap or,
# without wraps, right under the blade's guard (the lathe is the whole grip).
bands = [(z, radius_at(z)) for z in [z_bottom + i * 0.01 for i in range(int((recipe["head_at"] - z_bottom) / 0.01))]]
ferrule = (recipe["head_at"] - 0.035, recipe["head_at"] - 0.005)


def runs(ok):  # maximal runs of consecutive bands satisfying ok, as (lo, hi) in z, longest first
    out, start = [], None
    for z, r in bands + [(None, None)]:
        if z is not None and ok(z, r) and z < ferrule[0] - 0.01:
            start = z if start is None else start
        elif start is not None:
            out.append((start, z if z is not None else bands[-1][0] + 0.01))
            start = None
    return sorted(out, key=lambda ab: ab[0] - ab[1])


wraps = runs(lambda z, r: 1.25 * shaft_r < r < 2.2 * shaft_r) if recipe["grips"] else []
wrap = bool(wraps)
wrap_lo, wrap_hi = wraps[0] if wrap else (None, None)  # the longest wrap on the picture is the one every grip copies
wrap_r = max(r for z_, r in bands if wrap_lo <= z_ < wrap_hi) if wrap else shaft_r
if recipe.get("socket"):
    z_cut = recipe["head_at"] - recipe["socket"]  # a mounted blade: the lathe runs up to the socket
elif wrap:
    z_cut = wrap_hi + 0.012
else:
    z_cut = recipe["head_at"] - 0.005  # a blade: the lathe runs up to the guard / ferrule
r_cut, z_top = radius_at(z_cut), z_cut + 0.022
bares = runs(lambda z, r: r <= 1.25 * shaft_r) or [(z_bottom, z_cut)]
bare_rows = (bares[0][0] + 0.012, min(bares[0][1], z_cut) - 0.012)  # the reconstruction's longest bare handle rows
print(f"[weapon-fit] handle: bare rows {bare_rows[0]:.3f}–{bare_rows[1]:.3f}" + (f", wrap {wrap_lo:.3f}–{wrap_hi:.3f} (r {wrap_r:.4f})" if wrap else "") + f", head from {z_cut:.3f}")
assert recipe["grips"] == [] or wrap, f"{weapon}: the recipe wants wraps but none was found on the reconstruction ({bands[:6]}…)"


def v_of(z):  # the baked strip's V along the reconstruction's handle
    return (z - z_bottom) / (z_top - z_bottom)


def lathe(name, rings, material, segments=16):
    """rings: (z, radius, v) bottom to top; a strip between consecutive rings that differ in z, its own V per ring."""
    bm_ = bmesh.new()
    uv_ = bm_.loops.layers.uv.new("UVMap")
    ring_verts = [[bm_.verts.new((r * math.cos(2 * math.pi * i / segments), r * math.sin(2 * math.pi * i / segments), z)) for i in range(segments)] for z, r, _ in rings]
    for k in range(len(rings) - 1):
        if rings[k + 1][0] - rings[k][0] < 1e-6:
            continue
        for i in range(segments):
            a, b = ring_verts[k][i], ring_verts[k][(i + 1) % segments]
            c, d = ring_verts[k + 1][(i + 1) % segments], ring_verts[k + 1][i]
            f = bm_.faces.new((a, b, c, d))
            for lp, (u, v) in zip(f.loops, [(i / segments, rings[k][2]), ((i + 1) / segments, rings[k][2]), ((i + 1) / segments, rings[k + 1][2]), (i / segments, rings[k + 1][2])]):
                lp[uv_].uv = (u, v)
    for f in bm_.faces:
        f.smooth = True
    mesh_ = bpy.data.meshes.new(name)
    bm_.to_mesh(mesh_)
    bm_.free()
    o = bpy.data.objects.new(name, mesh_)
    bpy.context.scene.collection.objects.link(o)
    mesh_.materials.append(material)
    return o


# 4. Bake the reconstruction's handle colour onto a lathe of its own extent, V straight along it.
shaft_mat = bpy.data.materials.new(f"Weapon{weapon.capitalize()}Shaft")
shaft_mat.use_nodes = True
bsdf = shaft_mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value, bsdf.inputs["Metallic"].default_value = 0.82, 0.0
baked = bpy.data.images.new("shaft_bake", TEX_U, TEX_V, alpha=False)
tex = shaft_mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = baked
for n in shaft_mat.node_tree.nodes:  # the bake writes to the image node that is active AND selected (Blender 5: new nodes are not)
    n.select = n == tex  # RNA wrappers: `is` compares Python proxies, not nodes
shaft_mat.node_tree.nodes.active = tex
profile = [(z_bottom + 0.005, shaft_r)] + ([(wrap_lo - 0.012, shaft_r), (wrap_lo, wrap_r), (wrap_hi, wrap_r)] if wrap else []) + [(z_cut, r_cut), (z_top, r_cut * 0.985)]
target = lathe("BakeTarget", [(z, r, v_of(z)) for z, r in profile], shaft_mat)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device, scene.cycles.samples = "CPU", 32
bake = scene.render.bake
bake.use_selected_to_active, bake.cage_extrusion, bake.max_ray_distance, bake.margin = True, 0.012, 0.05, 4
bake.use_pass_direct = bake.use_pass_indirect = False
bake.use_pass_color = True
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
target.select_set(True)
bpy.context.view_layer.objects.active = target
bpy.ops.object.bake(type="DIFFUSE")
baked.pack()
shaft_mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])  # linked after the bake: linked before, Cycles reports a circular image
bpy.data.objects.remove(target, do_unlink=True)

# 5. The shipped lathe: butt to the head, every band on the baked rows it came from (a wrap on the wrap's rows, bare on bare —
# a bare band longer than the picture's bare rows is tiled).
def bare(z0, z1):
    rows, rings = bare_rows[1] - bare_rows[0], []
    z = z0
    while z < z1 - 1e-6:
        step = min(rows, z1 - z)
        rings += [(z, shaft_r, v_of(bare_rows[0])), (z + step, shaft_r, v_of(bare_rows[0] + step))]
        z += step
    return rings


def wrap_band(z0, z1):  # a wrap on the picture's wrap rows, with its two taper rings
    return [(z0 - 0.012, shaft_r, v_of(wrap_lo - 0.012)), (z0, wrap_r, v_of(wrap_lo)), (z1, wrap_r, v_of(wrap_hi)), (z1 + 0.012, shaft_r, v_of(wrap_hi + 0.012))]


rings, z = [], butt + 0.035
for g0, g1 in recipe["grips"]:
    rings += bare(z, g0 - 0.012) + wrap_band(g0, g1)
    z = g1 + 0.012
rings += bare(z, z_cut) + [(z_cut, r_cut, v_of(z_cut)), (z_top, r_cut * 0.985, v_of(z_top))]
shaft = lathe("Shaft", rings, shaft_mat)

# 6. The head: the reconstruction from the cut up, its cut closed with the ring's own texels, a closed butt cap on one ferrule
# texel (plain metal, no smear), then decimated to the budget less the lathe.
bm = bmesh.new()
bm.from_mesh(me)
uv = bm.loops.layers.uv.active
bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.co.z < z_cut for v in f.verts)], context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
if recipe.get("blade") == "flat":  # the scythe: cut the second moon off, lay the blade flat, strap the root to the socket
    r_sock = radius_at(z_cut + 0.01) + 0.01
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.co.x < -r_sock for v in f.verts)], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    torn = [e for e in bm.edges if e.is_boundary and all(v.co.x < 0 and v.co.z > z_cut for v in e.verts)]
    for f in bmesh.ops.holes_fill(bm, edges=torn, sides=0)["faces"]:
        for loop in f.loops:
            src = next((lp for lp in loop.vert.link_loops if lp.face is not f), None)
            if src:
                loop[uv].uv = src[uv].uv
    root = [v for v in bm.verts if r_sock <= v.co.x < r_sock + 0.03]
    H = sum(v.co.z for v in root) / len(root)  # the blade's centreline height where it leaves the socket
    lay = Matrix.Translation((0, 0, H)) @ Matrix.Rotation(-math.pi / 2, 4, "X") @ Matrix.Translation((0, 0, -H))
    for v in bm.verts:
        if math.hypot(v.co.x, v.co.y) > r_sock and v.co.z > z_cut:
            v.co = lay @ v.co
    strap = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    ring_ = [lp for f in bm.faces if all(z_cut <= v.co.z < z_cut + 0.03 and math.hypot(v.co.x, v.co.y) <= r_sock for v in f.verts) for lp in f.loops]
    strap_texel = ring_[len(ring_) // 2][uv].uv.copy()
    for v in strap:
        v.co = Vector((v.co.x * 0.16 + 0.06, v.co.y * 0.05, v.co.z * 0.05 + H))
        for lp in v.link_loops:
            lp[uv].uv = strap_texel
    print(f"[weapon-fit] scythe: blade laid flat about H {H:.3f} (contact {c0}–{c1}), the −x moon removed")
rim = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z - z_cut) < 0.02 for v in e.verts)]
for f in bmesh.ops.holes_fill(bm, edges=rim, sides=0)["faces"]:
    for loop in f.loops:
        src = next((lp for lp in loop.vert.link_loops if lp.face is not f), None)
        if src:
            loop[uv].uv = src[uv].uv
ring = [lp for f in bm.faces if all(z_cut <= v.co.z < z_cut + 0.03 for v in f.verts) for lp in f.loops]
texel = ring[len(ring) // 2][uv].uv.copy()
cap = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=shaft_r + 0.003, radius2=shaft_r + 0.003, depth=0.04)
for v in cap["verts"]:
    v.co.z += butt + 0.02
    for lp in v.link_loops:
        lp[uv].uv = texel
bm.to_mesh(me)
bm.free()
me.update()
me.calc_loop_triangles()
shaft.data.calc_loop_triangles()
mod = obj.modifiers.new("Phone", "DECIMATE")
mod.ratio = (recipe["tris"] - len(shaft.data.loop_triangles)) / len(me.loop_triangles)
mod.use_collapse_triangulate = True
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier=mod.name)
me.calc_loop_triangles()
print(f"[weapon-fit] head {len(me.loop_triangles)} tris + lathe {len(shaft.data.loop_triangles)} tris")

# 7. Authored bare rows where the recipe asks (the trident: the concept painted its oiled ash near black, linear ≈ 0.001 —
# nothing to lift — and the owner asked for a brown shaft): an ash grain in the recipe's tone, seamless around the shaft.
px = np.array(baked.pixels[:], dtype=np.float32).reshape(TEX_V, TEX_U, 4)
if recipe.get("shaft_rgb"):
    rng = np.random.default_rng(190926)
    u, v = np.linspace(0, 1, TEX_U, endpoint=False)[None, :], np.linspace(0, 1, TEX_V, endpoint=False)[:, None]
    grain = np.sin(2 * np.pi * (u * 9 + 0.35 * np.sin(2 * np.pi * v * 1.7) + 0.15 * np.sin(2 * np.pi * v * 6.3)))
    fine = rng.standard_normal((TEX_V, TEX_U)).astype(np.float32)
    fine = sum(np.roll(fine, k, axis=0) for k in range(6)) / 6
    tone = np.array(recipe["shaft_rgb"], dtype=np.float32)[None, None, :] * (1 + 0.07 * grain + 0.09 * fine)[:, :, None]
    rows = np.zeros(TEX_V, dtype=bool)
    rows[int(v_of(bare_rows[0]) * TEX_V):int(v_of(bare_rows[1]) * TEX_V)] = True
    if wrap:
        rows[int(v_of(wrap_hi + 0.012) * TEX_V):int(v_of(z_cut) * TEX_V)] = True
    px[rows, :, :3] = np.clip(tone[rows], 0, 1)
    baked.pixels.foreach_set(px.ravel())
    baked.pack()
bare_mean = px[int(v_of(bare_rows[0]) * TEX_V):int(v_of(bare_rows[1]) * TEX_V), :, :3].mean(axis=(0, 1))
print(f"[weapon-fit] handle rows: bare mean (linear) {np.round(bare_mean, 3).tolist()}" + (" authored" if recipe.get("shaft_rgb") else " baked"))
if "--debug" in sys.argv:
    baked.filepath_raw, baked.file_format = "/tmp/shaft_bake.png", "PNG"
    baked.save()
for image in bpy.data.images:  # the head's maps to the recipe's size (the weapon is ~200 px tall on a phone)
    if image.size[0] > recipe["texture"]:
        image.scale(recipe["texture"], recipe["texture"])
me.materials[0].name = f"Weapon{weapon.capitalize()}"

# 8. The contract: one node, WeaponDrawn (two primitives: head, handle), extras.contact in metres along local Y.
bpy.ops.object.select_all(action="DESELECT")
shaft.select_set(True)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.join()
me = obj.data
me.calc_loop_triangles()
obj.name = me.name = "WeaponDrawn"
obj["contact"] = {"from": c0, "to": c1}
obj["weapon"] = weapon
obj["variant"] = "trellis"
bpy.ops.object.shade_smooth()
bpy.ops.export_scene.gltf(
    filepath=str(out.resolve()), export_format="GLB", use_selection=True, export_extras=True, export_apply=True,
    export_image_format="JPEG", export_jpeg_quality=88, export_animations=False, export_skins=False, export_morph=False,
)
P = coords()
receipt = {
    "weapon": weapon, "source": str(raw), "part": str(out), "source_tris": source_tris, "part_tris": len(me.loop_triangles),
    "scale": round(s, 5), "extent_y": [round(min(p.z for p in P), 4), round(max(p.z for p in P), 4)],
    "width_x": round(extent(P, 0), 4), "thickness_z": round(extent(P, 1), 4), "head_from": round(z_cut, 4),
    "contact": [c0, c1], "texture": recipe["texture"], "bytes": out.stat().st_size,
}
(SOURCE / f"{weapon}.fit.json").write_text(json.dumps(receipt, indent=1) + "\n")
print(f"[weapon-fit] {json.dumps(receipt)}")
