#!/usr/bin/env python3
"""Hero Look pilot (docs/state/herolook.md): give a generated surface a normal map and a material tune, in place, byte-level.
TRELLIS.2 ships colour + ORM only, so the metal reads flat under the Profile and kill-screen light. The normal map is derived from the
colour map's luminance (Sobel over a blurred height, strength --strength), written as a JPEG at --size and set as normalTexture on every
material named *Surface. --metal scales metallicFactor (the generated plate renders near-black under a dim environment at metal 1).
    ~/.venvs/face/bin/python scripts/character/herolook_normal.py public/herolook/legionary-head.glb [--size 1024] [--strength 2.5] [--metal 0.55]
"""
import io
import json
import struct
import sys

import numpy as np
from PIL import Image, ImageFilter

path = sys.argv[1]
opt = {k: sys.argv[sys.argv.index(k) + 1] for k in ("--size", "--strength", "--metal") if k in sys.argv}
SIZE, STRENGTH, METAL = int(opt.get("--size", 1024)), float(opt.get("--strength", 2.5)), float(opt.get("--metal", 0.55))
raw = open(path, "rb").read()
n = struct.unpack_from("<I", raw, 12)[0]
d = json.loads(raw[20:20 + n])
b = bytearray(raw[28 + n:28 + n + struct.unpack_from("<I", raw, 20 + n)[0]])


def image_of(tex):
    t = d["textures"][tex]
    s = t.get("source", t.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))
    bv = d["bufferViews"][d["images"][s]["bufferView"]]
    return Image.open(io.BytesIO(bytes(b[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]])))


done = 0
for m in d["materials"]:
    if not m.get("name", "").endswith("Surface") or "baseColorTexture" not in m.get("pbrMetallicRoughness", {}):
        continue
    col = image_of(m["pbrMetallicRoughness"]["baseColorTexture"]["index"]).convert("L").resize((SIZE, SIZE), Image.LANCZOS)
    h = np.asarray(col.filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
    gx = np.zeros_like(h)
    gy = np.zeros_like(h)
    gx[:, 1:-1] = h[:, 2:] - h[:, :-2]
    gy[1:-1, :] = h[2:, :] - h[:-2, :]
    nx, ny, nz = -gx * STRENGTH, gy * STRENGTH, np.ones_like(h)   # glTF: +Y up in tangent space, image rows run down
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / ln, ny / ln, nz / ln], -1) * 0.5 + 0.5
    buf = io.BytesIO()
    Image.fromarray((rgb * 255).astype(np.uint8)).save(buf, "JPEG", quality=88)
    data = buf.getvalue()
    off = len(b) + (-len(b) % 4)
    b += b"\0" * (off - len(b)) + data
    d["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(data)})
    d["images"].append({"bufferView": len(d["bufferViews"]) - 1, "mimeType": "image/jpeg", "name": m["name"] + "Normal"})
    d["textures"].append({"source": len(d["images"]) - 1, **({"sampler": d["textures"][m["pbrMetallicRoughness"]["baseColorTexture"]["index"]]["sampler"]} if "sampler" in d["textures"][m["pbrMetallicRoughness"]["baseColorTexture"]["index"]] else {})})
    uv = m["pbrMetallicRoughness"]["baseColorTexture"].get("texCoord", 0)
    m["normalTexture"] = {"index": len(d["textures"]) - 1, "texCoord": uv}
    m["pbrMetallicRoughness"]["metallicFactor"] = METAL
    done += 1
    print(f"{m['name']}: normal {SIZE}px ({len(data) // 1024} KB), strength {STRENGTH}, metallicFactor {METAL}")
d["buffers"] = [{"byteLength": len(b)}]
j = json.dumps(d, separators=(",", ":")).encode()
j += b" " * (-len(j) % 4)
b += b"\0" * (-len(b) % 4)
open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 28 + len(j) + len(b)) + struct.pack("<II", len(j), 0x4E4F534A) + j + struct.pack("<II", len(b), 0x004E4942) + b)
print(f"{path}: {done} surface(s) tuned")
