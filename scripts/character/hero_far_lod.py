# Bake a FAR LOD of a hero rig (Lead 2026-10-17, Web's crowd profile: ~14 skinned meshes per remote hero, the cost is draw submission): ONE skinned mesh (the body) of a few thousand triangles on the SAME 65-bone rig and with
# every clip of the source, plus the weapon as one small rigid mesh on each of the source's SwordDrawn / SwordSheathed nodes, so the figure's existing draw/sheathe swap keeps working. The parts and their triangle budgets are a row
# (origins/preview/far-lod.json), so a new kit bakes its own by adding a row. No texture: each part's base colour is sampled at its vertices into one vertex-colour layer and the body is one material (kit-style: vertex colour only),
# so a far figure uploads no image and links no per-part program.
#   blender -b -P scripts/character/hero_far_lod.py -- <far-lod.json> <row id> [source override] [out override]
# Donor check (2026-10-17): the donor repos hold no client-side model LODs (azerothcore is the server; the listing has no client asset pipeline), so nothing is copied. The approach is the common one for MMO characters (WoW's M2 skin
# profiles, a lower-poly merged body per LOD on the same skeleton), recalled from general knowledge and not read from a donor here: the colour atlas is replaced by vertex colour, and the rig is not reduced (65 bones cost little next to the draws).
import json
import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
ROWS, ROW_ID = argv[0], argv[1]
row = next(r for r in json.load(open(ROWS))["farLods"] if r["id"] == ROW_ID)["fields"]
SRC = argv[2] if len(argv) > 2 else row["source"]
OUT = argv[3] if len(argv) > 3 else row["out"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
objs = {o.name: o for o in bpy.data.objects if o.type == "MESH"}


def base_colour_image(mat):
    """The sRGB image feeding the material's Base Color (followed through any mix), and the colour factor when there is none."""
    if not mat or not mat.use_nodes:
        return None, (0.8, 0.8, 0.8, 1.0)
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return None, (0.8, 0.8, 0.8, 1.0)
    sock = bsdf.inputs["Base Color"]
    seen = set()

    def up(s):
        for link in s.links:
            n = link.from_node
            if n in seen:
                continue
            seen.add(n)
            if n.type == "TEX_IMAGE" and n.image:
                return n.image
            for i in n.inputs:
                got = up(i)
                if got:
                    return got
        return None
    return up(sock), tuple(sock.default_value)


def bake_colour(o):
    """Corner colours: the base-colour image sampled at each loop's UV (nearest, wrapped), times the colour factor; written linear into the 'Col' layer."""
    me = o.data
    img, factor = base_colour_image(me.materials[0] if me.materials else None)
    n = len(me.loops)
    if "Col" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["Col"])
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    if img is None or not me.uv_layers:
        out = np.tile(np.array(factor, dtype=np.float32), (n, 1))
    else:
        w, h = img.size
        px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
        uv = np.empty(n * 2, dtype=np.float32)
        me.uv_layers[0].data.foreach_get("uv", uv)
        uv = uv.reshape(n, 2)
        ix = np.clip(((uv[:, 0] % 1.0) * w).astype(int), 0, w - 1)
        iy = np.clip(((uv[:, 1] % 1.0) * h).astype(int), 0, h - 1)
        out = px[iy, ix]
        out = out * np.array(factor, dtype=np.float32)   # Blender hands back byte images already in scene-linear (the PROBE line's mean checks it against the still)
        print(f"PROBE colour {o.name} image {img.name} cs {img.colorspace_settings.name} mean {out[:, :3].mean():.3f}")
    out[:, 3] = 1.0
    attr.data.foreach_set("color", out.astype(np.float32).ravel())


def drop_armature_modifier(o):
    for m in list(o.modifiers):
        if m.type == "ARMATURE":
            o.modifiers.remove(m)


def reduce_to(o, tris):
    cur = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris >= cur:
        return cur
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    mod = o.modifiers.new("dec", "DECIMATE")
    mod.ratio = tris / cur
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# the body: bake each part's colour, drop its armature modifier, take it down to its budget, join
body_parts = []
report = []
for part in row["parts"]:
    o = objs[part["mesh"]]
    bake_colour(o)
    drop_armature_modifier(o)
    got = reduce_to(o, part["tris"])
    report.append((part["mesh"], got))
    body_parts.append(o)
for o in body_parts:
    me = o.data
    for layer in list(me.uv_layers):
        me.uv_layers.remove(layer)
    me.materials.clear()
mat = bpy.data.materials.new("hero-far")
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.9
bsdf.inputs["Metallic"].default_value = 0.0
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bpy.ops.object.select_all(action="DESELECT")
for o in body_parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = body_parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = row["body"]
body.data.name = row["body"]
body.data.materials.append(mat)
body.data.color_attributes.active_color = body.data.color_attributes["Col"]
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=row["influences"])
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
mod = body.modifiers.new("Armature", "ARMATURE")
mod.object = arm
btris = sum(len(p.vertices) - 2 for p in body.data.polygons)

# the weapon: one rigid mesh per source node (drawn, sheathed), the source's parts joined, taken down to its budget, vertex colour from its own images
w = row["weapon"]
weapon_tris = 0
for node in ("SwordDrawn", "SwordSheathed"):
    parent = bpy.data.objects[node]
    kids = [o for o in objs.values() if o.parent is parent and any(o.name.startswith(m) for m in w["meshes"])]
    for o in kids:
        bake_colour(o)
        for layer in list(o.data.uv_layers):
            o.data.uv_layers.remove(layer)
        o.data.materials.clear()
    bpy.ops.object.select_all(action="DESELECT")
    for o in kids:
        o.select_set(True)
    bpy.context.view_layer.objects.active = kids[0]
    bpy.ops.object.join()
    wo = bpy.context.view_layer.objects.active
    weapon_tris += reduce_to(wo, w["tris"])
    wo.name = "WeaponDrawn" if node == "SwordDrawn" else "WeaponSheathed"
    wo.data.materials.append(mat)
    wo.data.color_attributes.active_color = wo.data.color_attributes["Col"]

# the stray, unskinned helper in the source and every part we replaced
for o in list(bpy.data.objects):
    if o.type == "MESH" and o is not body and not o.name.startswith("Weapon"):
        bpy.data.objects.remove(o, do_unlink=True)

print("FARLOD parts", report, "body tris", btris, "weapon tris (one copy)", weapon_tris // 2, "bones", len(arm.data.bones), "actions", len(bpy.data.actions))
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=False, export_animations=True, export_vertex_color="ACTIVE", export_skins=True, export_yup=True)
print("FARLOD-OUT", OUT)
