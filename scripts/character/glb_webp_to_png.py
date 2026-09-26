# Re-embed a GLB's EXT_texture_webp images as PNG (lossless, same pixels) so every browser path decodes them: the raw TRELLIS-max
# mesh's 4096 WebP colour map failed to load in Chromium (THREE.GLTFLoader "Couldn't load texture blob") for the raw-vs-fitted stills.
#   python scripts/character/glb_webp_to_png.py in.glb out.glb
import io, json, struct, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
b = open(src, "rb").read(); n = struct.unpack_from("<I", b, 12)[0]; j = json.loads(b[20:20 + n]); binc = b[20 + n + 8:]
views, out = j["bufferViews"], bytearray()
blobs = {}
for im in j["images"]:
    v = views[im["bufferView"]]; raw = binc[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
    if im.get("mimeType") == "image/webp":
        buf = io.BytesIO(); Image.open(io.BytesIO(raw)).save(buf, "PNG", compress_level=6); raw = buf.getvalue(); im["mimeType"] = "image/png"
    blobs[im["bufferView"]] = raw
for i, v in enumerate(views):   # rebuild the one buffer view by view, 4-byte aligned
    data = blobs.get(i, binc[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]])
    while len(out) % 4: out.append(0)
    v["byteOffset"] = len(out); v["byteLength"] = len(data); out += data
while len(out) % 4: out.append(0)
j["buffers"][0]["byteLength"] = len(out)
for t in j.get("textures", []):
    if "extensions" in t and "EXT_texture_webp" in t["extensions"]: t["source"] = t["extensions"].pop("EXT_texture_webp")["source"]; t.pop("extensions") if not t["extensions"] else None
for k in ("extensionsUsed", "extensionsRequired"):
    if k in j: j[k] = [e for e in j[k] if e != "EXT_texture_webp"] or j.pop(k)
js = json.dumps(j, separators=(",", ":")).encode(); js += b" " * (-len(js) % 4)
open(dst, "wb").write(struct.pack("<III", 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(out), 0x004E4942) + bytes(out))
print(dst, round((28 + len(js) + len(out)) / 1e6, 1), "MB")
