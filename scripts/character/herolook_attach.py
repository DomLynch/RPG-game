#!/usr/bin/env python3
"""Hero Look pilot (docs/state/herolook.md): hang a rigid prop GLB (vertices in the hero's rest world space) off one joint of a rig GLB,
as a plain child node of that joint, so it follows the bone in every clip. Byte-level merge, nothing re-exported: the rig's own
accessors, skins and clips are untouched.
    python3 scripts/character/herolook_attach.py public/herolook/legionary.glb artifacts/herolook/scutum-placed.glb lowerarm_l [--name HeroScutum]
"""
import json
import struct
import sys

import numpy as np

rig_path, prop_path, joint = sys.argv[1:4]
name = sys.argv[sys.argv.index("--name") + 1] if "--name" in sys.argv else "HeroProp"


def read(p):
    r = open(p, "rb").read()
    n = struct.unpack_from("<I", r, 12)[0]
    j = json.loads(r[20:20 + n])
    b = r[20 + n:]
    m = struct.unpack_from("<I", b, 0)[0]
    return j, bytearray(b[8:8 + m])


def write(p, d, b):
    d["buffers"] = [{"byteLength": len(b)}]
    j = json.dumps(d, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    b += b"\0" * (-len(b) % 4)
    open(p, "wb").write(struct.pack("<III", 0x46546C67, 2, 28 + len(j) + len(b)) + struct.pack("<II", len(j), 0x4E4F534A) + j + struct.pack("<II", len(b), 0x004E4942) + b)


def local(n):
    if "matrix" in n:
        return np.array(n["matrix"]).reshape(4, 4).T
    t = np.eye(4)
    t[:3, 3] = n.get("translation", [0, 0, 0])
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    s = np.diag(n.get("scale", [1, 1, 1]))
    t[:3, :3] = r @ s
    return t


d, b = read(rig_path)
p, pb = read(prop_path)
if any(n.get("name") == name for n in d["nodes"]):
    sys.exit(f"{rig_path} already carries {name}")
parent = {c: i for i, n in enumerate(d["nodes"]) for c in n.get("children", [])}
ji = next(i for i, n in enumerate(d["nodes"]) if n.get("name") == joint)
W, i = np.eye(4), ji
while i is not None:
    W = local(d["nodes"][i]) @ W
    i = parent.get(i)
base = len(b) + (-len(b) % 4)
b += b"\0" * (base - len(b)) + pb
off = {k: len(d.get(k, [])) for k in ("bufferViews", "accessors", "images", "samplers", "textures", "materials", "meshes")}
for bv in p.get("bufferViews", []):
    bv["buffer"] = 0
    bv["byteOffset"] = bv.get("byteOffset", 0) + base
for a in p.get("accessors", []):
    a["bufferView"] += off["bufferViews"]
for im in p.get("images", []):
    im["bufferView"] += off["bufferViews"]
for t in p.get("textures", []):
    t["source"] += off["images"]
    if "sampler" in t:
        t["sampler"] += off["samplers"]


def retex(v):
    if isinstance(v, dict):
        for k, x in v.items():
            if k == "index" and isinstance(x, int):
                v[k] = x + off["textures"]
            else:
                retex(x)
    elif isinstance(v, list):
        for x in v:
            retex(x)


for m in p.get("materials", []):
    retex(m)
for mesh in p["meshes"]:
    for pr in mesh["primitives"]:
        pr["attributes"] = {k: v + off["accessors"] for k, v in pr["attributes"].items()}
        if "indices" in pr:
            pr["indices"] += off["accessors"]
        if "material" in pr:
            pr["material"] += off["materials"]
for k in off:
    d.setdefault(k, []).extend(p.get(k, []))
if not d["samplers"]:
    del d["samplers"]
pm = next(n for n in p["nodes"] if "mesh" in n)
node = {"name": name, "mesh": pm["mesh"] + off["meshes"], "matrix": (np.linalg.inv(W) @ local(pm)).T.flatten().tolist()}
d["nodes"].append(node)
d["nodes"][ji].setdefault("children", []).append(len(d["nodes"]) - 1)
write(rig_path, d, b)
print(f"{rig_path}: {name} under {joint} ({len(pb)} bytes added)")
