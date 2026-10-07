"""Duel cost pass (Lead 2026-10-07, ruling on #1723: <= 24 MB decoded per body). Downsizes a GLB's images by slot and touches nothing else:
UVs, materials, rig, clips and every non-image bufferView stay byte-for-byte, so the look only changes by the lost texel detail.
  python3 scripts/character/texture_budget.py <in.glb> <out.glb> '<policy json>'
policy: {"Face.map": 1024, "*.normal": 512, "*.mr": 256, "default": 256}; the key is "<material>.<slot>" (slot: map, mr, normal, occ, emis,
or "<extension>.<name>"), "*.<slot>" matches any material, "default" the rest. An image is only ever downscaled (max side), keeping its aspect.
Prints the decoded size (w*h*4, no mips) before and after per image."""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image


def read(p):
    r = Path(p).read_bytes()
    n = struct.unpack_from("<I", r, 12)[0]
    return json.loads(r[20 : 20 + n]), r[28 + n :]


def source_of(d, index):
    t = d["textures"][index]
    return t["source"] if "source" in t else next(v["source"] for v in t.get("extensions", {}).values() if "source" in v)   # EXT_texture_webp


def slots(d):
    out = {}
    for m in d["materials"]:
        pbr = m.get("pbrMetallicRoughness", {})
        for slot, t in (("map", pbr.get("baseColorTexture")), ("mr", pbr.get("metallicRoughnessTexture")), ("normal", m.get("normalTexture")),
                        ("occ", m.get("occlusionTexture")), ("emis", m.get("emissiveTexture"))):
            if t:
                out.setdefault(source_of(d, t["index"]), f'{m.get("name", "?")}.{slot}')
        for ext, v in m.get("extensions", {}).items():
            for k, t in v.items():
                if isinstance(t, dict) and "index" in t:
                    out.setdefault(source_of(d, t["index"]), f'{m.get("name", "?")}.{ext.replace("KHR_materials_", "")}.{k}')
    return out


def limit(policy, name):
    mat, _, slot = name.partition(".")
    return policy.get(name) or policy.get(f"*.{slot}") or policy.get("default") or 10**6


def main(src, dst, policy):
    d, b = read(src)
    names = slots(d)
    views = d["bufferViews"]
    new, before, after = {}, 0.0, 0.0
    for i, im in enumerate(d["images"]):
        v = views[im["bufferView"]]
        raw = bytes(b[v.get("byteOffset", 0) : v.get("byteOffset", 0) + v["byteLength"]])
        img = Image.open(io.BytesIO(raw))
        w, h = img.size
        cap = limit(policy, names.get(i, "?.?"))
        s = min(1.0, cap / max(w, h))
        if s < 1.0:
            nw, nh = max(1, round(w * s)), max(1, round(h * s))
            img = img.convert("RGB" if img.mode in ("RGB", "P", "L") and im.get("mimeType") == "image/jpeg" else img.mode).resize((nw, nh), Image.LANCZOS)
            buf = io.BytesIO()
            if im.get("mimeType") == "image/png":
                img.save(buf, "PNG", optimize=True)
            elif im.get("mimeType") == "image/webp":
                img.save(buf, "WEBP", quality=90, method=6)
            else:
                img.convert("RGB").save(buf, "JPEG", quality=90, optimize=True)
            new[i] = buf.getvalue()
        before += w * h * 4 / 1048576
        nw, nh = (img.size if i in new else (w, h))
        after += nw * nh * 4 / 1048576
        print(f'{names.get(i, "?"):34} {w}x{h} -> {nw}x{nh}')
    imageviews = {im["bufferView"]: i for i, im in enumerate(d["images"])}
    out = bytearray()
    for vi, v in enumerate(views):
        data = new[imageviews[vi]] if vi in imageviews and imageviews[vi] in new else bytes(b[v.get("byteOffset", 0) : v.get("byteOffset", 0) + v["byteLength"]])
        out += b"\0" * (-len(out) % 4)
        v["byteOffset"], v["byteLength"] = len(out), len(data)
        out += data
    d["buffers"] = [{"byteLength": len(out)}]
    j = json.dumps(d, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    out += b"\0" * (-len(out) % 4)
    Path(dst).write_bytes(struct.pack("<III", 0x46546C67, 2, 28 + len(j) + len(out)) + struct.pack("<II", len(j), 0x4E4F534A) + j + struct.pack("<II", len(out), 0x004E4942) + bytes(out))
    print(f"DECODED {before:.1f} MB -> {after:.1f} MB; file {Path(src).stat().st_size / 1048576:.2f} -> {Path(dst).stat().st_size / 1048576:.2f} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 else {})
