"""Fit a TRELLIS.2 ranged-weapon reconstruction to the weapon part contract (sandbox ranged weapons, 2026-10-15).

    blender -b --python-exit-code 1 -P scripts/ranged-fit.py -- <id> <raw.glb> <out.glb> [spec.json]

Reads the immutable reconstruction, turns it so its long axis is the part's +Y (the weapon's own axes per scripts/ranged-fit.json), scales it to the spec's length, puts the hand (the grip) at the origin,
decimates to the phone budget, shrinks the colour maps, and writes ONE node named WeaponDrawn with the userData the sandbox reads (hand, nock / muzzle, contact) as glTF extras. Writes <out>.json beside it
(bounds, triangles, the userData) so the fit is measured, not eyeballed. Run through the VPS queue: runuser -u frankrows -- /usr/local/bin/blender-cpu --python scripts/ranged-fit.py -- ...
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
weapon, raw, out = args[0], args[1], args[2]
spec = json.load(open(args[3] if len(args) > 3 else "scripts/ranged-fit.json"))[weapon]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=raw)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = "WeaponDrawn"

def verts():
    n = len(obj.data.vertices)
    a = np.empty(n * 3, dtype=np.float64)
    obj.data.vertices.foreach_get("co", a)
    return a.reshape(n, 3)

b = verts()
g = np.stack([b[:, 0], b[:, 2], -b[:, 1]], axis=1)          # Blender (x, y, z up) -> glTF (x, y up, z toward the viewer)
c = g @ np.array(spec["cFromG"], dtype=np.float64).T          # glTF axes -> the part's axes
s = spec["lengthM"] / (c[:, 1].max() - c[:, 1].min())
c *= s
y0 = c[:, 1].min() + spec["gripAlong"] * (c[:, 1].max() - c[:, 1].min())
near = np.abs(c[:, 1] - y0) < 0.04
z0 = float(np.median(c[near, 2])) if near.any() else float(np.median(c[:, 2]))
x0 = float((c[:, 0].max() + c[:, 0].min()) / 2)
c -= np.array([x0, y0, z0])
extras = dict(spec["extras"])
if spec.get("nock") == "tipZ":                               # the string plane: the z of the two tips
    tips = c[np.abs(np.abs(c[:, 1]) - c[:, 1].max()) < 0.05, 2]
    extras["nock"] = [0.0, 0.0, round(float(np.median(tips)), 4)]
if spec.get("muzzle") == "top":
    extras["muzzle"] = [0.0, round(float(c[:, 1].max()), 4), round(float(np.median(c[c[:, 1] > c[:, 1].max() - 0.05, 2])), 4)]
bb = np.stack([c[:, 0], -c[:, 2], c[:, 1]], axis=1)            # the part's axes -> Blender, so the glTF exporter (Y up) hands them back unchanged
obj.data.vertices.foreach_set("co", bb.reshape(-1))
obj.data.update()

before = len(obj.data.polygons)
mod = obj.modifiers.new("fit-decimate", "DECIMATE")
mod.ratio = min(1.0, spec["tris"] / max(1, sum(len(p.vertices) - 2 for p in obj.data.polygons)))
bpy.ops.object.modifier_apply(modifier=mod.name)
for p in obj.data.polygons:
    p.use_smooth = True
for img in bpy.data.images:
    if img.size[0] > spec["texture"]:
        img.scale(spec["texture"], spec["texture"])
for k, v in extras.items():
    obj[k] = v
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_extras=True, export_yup=True, export_apply=True, export_image_format="AUTO")

tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
cc = verts(); gg = np.stack([cc[:, 0], cc[:, 2], -cc[:, 1]], axis=1)
res = dict(weapon=weapon, scaleApplied=round(float(s), 5), faces_before=before, triangles=int(tris), min=[round(float(v), 3) for v in gg.min(axis=0)], max=[round(float(v), 3) for v in gg.max(axis=0)], extras=extras)
Path(out + ".json").write_text(json.dumps(res, indent=2))
print("ranged-fit", json.dumps(res))
