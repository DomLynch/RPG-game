# Bake the worn pieces of loot.glb as vertex-colour LOD pieces for the merged remote figure (v2 of figure-source.ts). One skinned mesh per LootId (`goblin.Body` = its Steel, Antique brass, Leather, Bone and Gambeson draws joined),
# on the SAME 65-bone rig (every loot skin lists the hero's bones by name), no clips, no texture, ONE shared material, each draw's base colour sampled into the 'Col' layer. Each node keeps its extras (slot, opponent, layer) so the
# runtime knows which body part a `replace` piece hides. Budgets are a row (origins/preview/loot-lod.json: keepRatio of the source tris, a floor, a cap per LootId).
#   blender -b -P scripts/character/loot_far_lod.py -- <loot-lod.json> <row id>
# Donor check (2026-10-17): Morrowind (openmw apps/openmw/mwrender/npcanimation.cpp: addOrReplaceIndividualPart, one skinned part per slot bound to the one skeleton by bone name, a slot's priority hides the body parts it covers) is where the
# slot / layer ('over' vs 'replace') semantics come from; WoW does the same with geosets and a composited body texture. The merge here is ours: the one-shared-material rule (0 programs after ready) rules out per-part textures.
import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lod_bake_lib import bake_colour, drop_armature_modifier, reduce_to, tris_of  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
ROWS, ROW_ID = argv[0], argv[1]
row = next(r for r in json.load(open(ROWS))["lootLods"] if r["id"] == ROW_ID)["fields"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=row["source"])
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
print("LOOTLOD armatures", sum(1 for a in bpy.data.objects if a.type == "ARMATURE"))
meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.vertex_groups and not o.name.startswith(row["skipPrefix"])]   # a mesh with no vertex groups is the source's stray helper (an Icosphere)

groups = {}   # LootId (the node name minus its material) -> its draws
for o in meshes:
    groups.setdefault(o.name.rsplit(".", 1)[0], []).append(o)

mat = bpy.data.materials.new("loot-lod")
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.9
bsdf.inputs["Metallic"].default_value = 0.0
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])

report = []
for loot_id, draws in sorted(groups.items()):
    extras = {k: draws[0].get(k) for k in ("slot", "opponent", "layer") if draws[0].get(k) is not None}
    src = sum(tris_of(o) for o in draws)
    budget = min(row["maxTrisPerId"], max(row["minTris"], round(src * row["keepRatio"])))
    for o in draws:
        bake_colour(o)
        drop_armature_modifier(o)
        reduce_to(o, max(8, round(tris_of(o) * budget / src)))
        for layer in list(o.data.uv_layers):
            o.data.uv_layers.remove(layer)
        o.data.materials.clear()
        o.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    for o in draws:
        o.select_set(True)
    bpy.context.view_layer.objects.active = draws[0]
    bpy.ops.object.join()
    piece = bpy.context.view_layer.objects.active
    piece.name = loot_id
    piece.data.name = loot_id
    piece.data.color_attributes.active_color = piece.data.color_attributes["Col"]
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=row["influences"])
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    mod = piece.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    for k, v in extras.items():
        piece[k] = v
    report.append((loot_id, src, tris_of(piece)))

# every other object is the unskinned helper or a leftover armature
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.name not in groups:
        bpy.data.objects.remove(o, do_unlink=True)

print("LOOTLOD pieces", len(report), "src tris", sum(r[1] for r in report), "lod tris", sum(r[2] for r in report), "bones", len(arm.data.bones))
for r in report:
    print("LOOTLOD", r)
bpy.ops.export_scene.gltf(filepath=row["out"], export_format="GLB", export_apply=False, export_animations=False, export_vertex_color="ACTIVE", export_skins=True, export_yup=True, export_extras=True)
print("LOOTLOD-OUT", row["out"])
