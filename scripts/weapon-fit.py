"""Fit a TRELLIS.2 weapon reconstruction to the game's weapon contract (weapons lane, Phase 2 polish, 2026-09-20).

    blender -b --python-exit-code 1 -P scripts/weapon-fit.py -- trident

Reads the immutable source `src/assets/source/weapons/<id>.glb` (the Space's 100k-face extraction, provenance beside it) and
writes `src/assets/source/weapons/<id>.part.glb`: one mesh named WeaponDrawn, local Y along the shaft with the rear hand at
y = 0, the striking segment exactly where the shipped procedural part put it (extras.contact — the blade bake, the sim and the
combat data never change), decimated to a phone budget with the reconstruction's own colour and metal/rough maps at 512².
build-weapon.mjs `sourced()` loads it as the weapon's default part; the procedural part stays as the `procedural` variant.

The fit is measured, not eyeballed: landmarks come from the mesh's own width profile along its length. Where the concept image
cropped the weapon (a shaft running off the frame) the missing length is cloned from the reconstruction's own bands — shaft,
wrap, socket — so every surface on the part is the reconstruction's surface, at the reconstruction's texel density.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

weapon = sys.argv[sys.argv.index("--") + 1]
SOURCE = Path("src/assets/source/weapons")

RECIPES = {
    # The Veteran's short trident (owner's pick, 2026-09-16): fork 0.76–1.22 m from the rear hand, butt at −0.20, front grip at 0.40.
    "trident": dict(
        contact=(0.76, 1.22),  # WEAPONS.trident's bake segment: crossbar to tip (scripts/build-weapon.mjs VARIANTS.short)
        head_underside=0.75,  # where the fork's underside (the crossbar) sits: 1 cm under the contact's start, like the procedural crossbar
        wide_axis="x",  # the fork spreads along local X (the procedural crossbar is a box along X; the tines flatten in Z)
        butt=-0.20,
        rear_grip=(-0.11, 0.11),  # the rear hand's wrap (the procedural rear grip)
        front_grip=(0.29, 0.51),  # under the front hand: the clips hold the shaft 0.30–0.44 m up (the procedural front grip)
        shaft_rgb=(0.36, 0.22, 0.13),  # linear: the procedural part's oiled ash (#64452f, the owner's "brown shaft")
        tris=4000,
        texture=512,
    ),
}
recipe = RECIPES[weapon]
raw = SOURCE / f"{weapon}.glb"
out = SOURCE / f"{weapon}.part.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(raw.resolve()))
obj = next(o for o in bpy.data.objects if o.type == "MESH")
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
if obj.parent:
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = obj.data


def apply_transform():
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def coords():
    return [v.co.copy() for v in me.vertices]


# 1. No weld (creatures.py welds before skinning): on a rigid prop the UV-island duplicates are harmless, and welding the
# reconstruction's thin double-sided edges makes them non-manifold, which the decimator answers by deleting the fork (measured).
source_tris = sum(len(p.vertices) - 2 for p in me.polygons)

# 2. Orientation. The Space frames the object with its length up (glTF Y → Blender Z) and its face toward the camera; the game
# wants the length along local Y (Blender Z on export) and the wide plane on the recipe's axis.
P = coords()
extent = [max(p[i] for p in P) - min(p[i] for p in P) for i in range(3)]
assert extent[2] > max(extent[0], extent[1]) * 2, f"{weapon}: the reconstruction's length is not along Z {extent}"
wide = 0 if extent[0] > extent[1] else 1
if (recipe["wide_axis"] == "x") != (wide == 0):
    obj.rotation_mode = "XYZ"  # the glTF importer leaves objects in quaternion mode
    obj.rotation_euler.z = math.pi / 2
    apply_transform()

# 3. Landmarks from the width profile: the head's underside is the lowest point that lies clearly outside the shaft.
P = coords()
z_tip = max(p.z for p in P)
z_bottom = min(p.z for p in P)
shaft_r = max(math.hypot(p.x, p.y) for p in P if p.z < z_bottom + 0.06 * (z_tip - z_bottom))
z_head = min(p.z for p in P if abs(p.x) > 4 * shaft_r)
print(f"[weapon-fit] raw: length {z_tip - z_bottom:.3f}, shaft radius {shaft_r:.4f}, head underside {z_head:.3f}, tip {z_tip:.3f}")

# 4. Uniform scale and shift: the head's underside and the tip land on the contract; the shaft is what it is.
c0, c1 = recipe["contact"]
s = (c1 - recipe["head_underside"]) / (z_tip - z_head)
obj.scale = (s, s, s)
apply_transform()
obj.location.z = c1 - z_tip * s
apply_transform()
P = coords()
z_bottom, shaft_r = min(p.z for p in P), shaft_r * s
print(f"[weapon-fit] fitted: scale {s:.4f}, shaft from {z_bottom:.3f} to the tip at {max(p.z for p in P):.3f}, shaft radius {shaft_r:.4f}")


# Radial profile along the shaft in 1 cm bands, used to find the wrap and the socket on the reconstruction.
def radius_at(z):
    r = [math.hypot(p.x, p.y) for p in P if z <= p.z < z + 0.01]
    return max(r) if r else 0


bands = [(z, radius_at(z)) for z in [z_bottom + i * 0.01 for i in range(int((recipe["head_underside"] - z_bottom) / 0.01))]]
socket = (recipe["head_underside"] - 0.035, recipe["head_underside"] - 0.005)  # the ferrule under the head: the last 3 cm
wrap = [z for z, r in bands if 1.25 * shaft_r < r < 2.2 * shaft_r and z < socket[0] - 0.01]
assert wrap, f"{weapon}: no wrap band found on the shaft ({bands[:8]}…)"
wrap_lo, wrap_hi = min(wrap), max(wrap) + 0.01
print(f"[weapon-fit] wrap on the reconstruction: {wrap_lo:.3f}–{wrap_hi:.3f} (radius ≈ {max(r for z, r in bands if wrap_lo <= z < wrap_hi):.4f})")

# 5. Two surfaces. The head keeps the reconstruction (decimated). Below the socket the reconstruction is a stack of overlapping
# coil shells — welding it goes non-manifold, decimating it tears the ridges into spikes (both measured) — so the shaft, both
# wraps and the butt are a clean lathe whose colour is BAKED from the reconstruction (Cycles, selected → active): the silhouette
# is a cylinder, the texture carries the leather turns and the grain. Everything below the picture's edge repeats the bare rows.
wrap_r = max(r for z_, r in bands if wrap_lo <= z_ < wrap_hi)
z_cut = wrap_hi + 0.012  # the head starts here: the socket's flare and everything above it stays the reconstruction
r_cut = radius_at(z_cut)
z_top = z_cut + 0.022
TEX_U, TEX_V = 256, 1024


def v_of(z):  # the baked strip's V along the reconstruction's shaft
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


# The bake target: the reconstruction's own extent, V straight along it.
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
profile = [(z_bottom + 0.005, shaft_r), (wrap_lo - 0.012, shaft_r), (wrap_lo, wrap_r), (wrap_hi, wrap_r), (z_cut, r_cut), (z_top, r_cut * 0.985)]
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
if "--debug" in sys.argv:
    baked.filepath_raw, baked.file_format = "/tmp/shaft_bake.png", "PNG"
    baked.save()
print(f"[weapon-fit] baked the shaft's colour: {TEX_U}×{TEX_V} from {z_bottom:.3f} to {z_top:.3f}")
bpy.data.objects.remove(target, do_unlink=True)

# The shipped lathe: butt to socket, every band on the baked rows it came from (the rear wrap on the wrap's rows, bare on bare).
bare0 = z_bottom + 0.012  # the first bare row above the picture's edge
g0, g1 = recipe["rear_grip"]
butt = recipe["butt"]
f0, f1 = recipe["front_grip"]
bare_top = wrap_lo - 0.012  # the last bare row under the picture's wrap


def bare(z0, z1):  # a bare band on the picture's bare rows, from the first row up
    assert bare0 + (z1 - z0) <= bare_top + 1e-6, f"{weapon}: bare band {z0:.3f}–{z1:.3f} is longer than the picture's bare rows"
    return [(z0, shaft_r, v_of(bare0)), (z1, shaft_r, v_of(bare0 + z1 - z0))]


def wrap(z0, z1):  # a wrap on the picture's wrap rows, with its two taper rings
    return [(z0 - 0.012, shaft_r, v_of(wrap_lo - 0.012)), (z0, wrap_r, v_of(wrap_lo)), (z1, wrap_r, v_of(wrap_hi)), (z1 + 0.012, shaft_r, v_of(wrap_hi + 0.012))]


rings = [*bare(butt + 0.035, g0 - 0.012), *wrap(g0, g1), *bare(g1 + 0.012, f0 - 0.012), *wrap(f0, f1), *bare(f1 + 0.012, z_cut),
         (z_cut, r_cut, v_of(z_cut)), (z_top, r_cut * 0.985, v_of(z_top))]
shaft = lathe("Shaft", rings, shaft_mat)

# The head: the reconstruction from the cut up, decimated to the budget less the lathe, its cut closed (bronze from the ring).
bm = bmesh.new()
bm.from_mesh(me)
uv = bm.loops.layers.uv.active
bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.co.z < z_cut for v in f.verts)], context="FACES")
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
rim = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z - z_cut) < 0.02 for v in e.verts)]
for f in bmesh.ops.holes_fill(bm, edges=rim, sides=0)["faces"]:
    for loop in f.loops:
        src = next((lp for lp in loop.vert.link_loops if lp.face is not f), None)
        if src:
            loop[uv].uv = src[uv].uv
# The butt cap on the head's material: a closed bronze ring at the shaft's radius, its texels the socket's.
ring = [lp for f in bm.faces if all(z_cut <= v.co.z < z_cut + 0.03 for v in f.verts) for lp in f.loops]
texel = ring[len(ring) // 2][uv].uv.copy()  # one socket texel for the whole cap: plain bronze, no smear
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
P = coords()

# 6. The bare shaft's rows: the reconstruction painted its oiled ash near black (linear ≈ 0.001 — nothing to lift), and the owner
# asked for a brown shaft, so those rows are an authored ash grain in the recipe's tone: long grain lines, seamless around the
# shaft, a fine smear along it. The wrap rows stay the baked leather.
if recipe.get("shaft_rgb"):
    import numpy as np
    px = np.array(baked.pixels[:], dtype=np.float32).reshape(TEX_V, TEX_U, 4)
    rng = np.random.default_rng(190926)
    u, v = np.linspace(0, 1, TEX_U, endpoint=False)[None, :], np.linspace(0, 1, TEX_V, endpoint=False)[:, None]
    grain = np.sin(2 * np.pi * (u * 9 + 0.35 * np.sin(2 * np.pi * v * 1.7) + 0.15 * np.sin(2 * np.pi * v * 6.3)))
    fine = rng.standard_normal((TEX_V, TEX_U)).astype(np.float32)
    fine = sum(np.roll(fine, k, axis=0) for k in range(6)) / 6
    tone = np.array(recipe["shaft_rgb"], dtype=np.float32)[None, None, :] * (1 + 0.07 * grain + 0.09 * fine)[:, :, None]
    rows = np.zeros(TEX_V, dtype=bool)
    for a, b in [(z_bottom, wrap_lo - 0.012), (wrap_hi + 0.012, z_cut)]:
        rows[int(v_of(a) * TEX_V):int(v_of(b) * TEX_V)] = True
    px[rows, :, :3] = np.clip(tone[rows], 0, 1)
    baked.pixels.foreach_set(px.ravel())
    baked.pack()
    print(f"[weapon-fit] shaft rows authored: {int(rows.sum())} of {TEX_V}, tone {recipe['shaft_rgb']}")
# The maps to 512² (the weapon is ~200 px tall on a phone).
for image in bpy.data.images:
    if image.size[0] > recipe["texture"]:
        image.scale(recipe["texture"], recipe["texture"])
me.materials[0].name = f"Weapon{weapon.capitalize()}"

# 7. The contract: one node, WeaponDrawn (two primitives: head, shaft), extras.contact in metres along local Y.
bpy.ops.object.select_all(action="DESELECT")
shaft.select_set(True)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.join()
me = obj.data
me.calc_loop_triangles()
obj.name = "WeaponDrawn"
me.name = "WeaponDrawn"
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
    "width_x": round(max(p.x for p in P) - min(p.x for p in P), 4), "thickness_z": round(max(p.y for p in P) - min(p.y for p in P), 4),
    "contact": [c0, c1], "texture": recipe["texture"], "bytes": out.stat().st_size,
}
(SOURCE / f"{weapon}.fit.json").write_text(json.dumps(receipt, indent=1) + "\n")
print(f"[weapon-fit] {json.dumps(receipt)}")
